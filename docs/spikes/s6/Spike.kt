package dev.lynxlab.spike

import android.app.Activity
import android.app.Application
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowInsets
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.lynx.tasm.LynxView
import com.lynx.tasm.LynxViewClient
import java.util.WeakHashMap

/**
 * Режим через `adb shell setprop debug.spike.mode <mode>`:
 *  - predraw  (default) — пуш только при первом pre-draw, где LynxView уже виден. Это дизайн спеки.
 *  - earliest — пуш при самом первом появлении LynxView в любом хуке, плюс второй пуш на первом pre-draw.
 *  - none     — только наблюдение, без пушей (контроль: что кладёт сам Sparkling).
 */
object Spike {
  private var installed = false
  private val hooks = WeakHashMap<Activity, ViewTreeObserver.OnPreDrawListener>()
  private val predrawCount = WeakHashMap<Activity, Int>()
  private val pushedKinds = WeakHashMap<LynxView, MutableSet<String>>()
  private val seen = WeakHashMap<LynxView, Boolean>()
  private var generation = 0

  fun mode(): String = runCatching {
    val p = Runtime.getRuntime().exec(arrayOf("getprop", "debug.spike.mode"))
    p.inputStream.bufferedReader().readText().trim()
  }.getOrDefault("").ifEmpty { "predraw" }

  fun install(app: Application) {
    if (installed) return
    installed = true
    SpikeLog.log("install", "mode=${mode()}")
    app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
      override fun onActivityPreCreated(a: Activity, s: Bundle?) { SpikeLog.log("activity.preCreated", a.javaClass.name) }
      override fun onActivityCreated(a: Activity, s: Bundle?) {
        SpikeLog.log("activity.created", a.javaClass.name)
        scan(a, "created")
        attachPreDraw(a)
      }
      override fun onActivityPostCreated(a: Activity, s: Bundle?) { SpikeLog.log("activity.postCreated", a.javaClass.simpleName); scan(a, "postCreated") }
      override fun onActivityStarted(a: Activity) { SpikeLog.log("activity.started", a.javaClass.simpleName); scan(a, "started") }
      override fun onActivityPostStarted(a: Activity) { SpikeLog.log("activity.postStarted", a.javaClass.simpleName); scan(a, "postStarted") }
      override fun onActivityPreResumed(a: Activity) { SpikeLog.log("activity.preResumed", a.javaClass.simpleName); scan(a, "preResumed") }
      override fun onActivityResumed(a: Activity) { SpikeLog.log("activity.resumed", a.javaClass.simpleName); scan(a, "resumed") }
      override fun onActivityPostResumed(a: Activity) { SpikeLog.log("activity.postResumed", a.javaClass.simpleName); scan(a, "postResumed") }
      override fun onActivityPaused(a: Activity) { SpikeLog.log("activity.paused", a.javaClass.simpleName) }
      override fun onActivityStopped(a: Activity) { SpikeLog.log("activity.stopped", a.javaClass.simpleName) }
      override fun onActivitySaveInstanceState(a: Activity, o: Bundle) {}
      override fun onActivityDestroyed(a: Activity) {
        SpikeLog.log("activity.destroyed", a.javaClass.simpleName)
        hooks.remove(a)?.let { h -> a.window?.decorView?.viewTreeObserver?.takeIf { it.isAlive }?.removeOnPreDrawListener(h) }
      }
    })
  }

  private fun attachPreDraw(a: Activity) {
    val decor = a.window?.decorView ?: return
    val hook = ViewTreeObserver.OnPreDrawListener {
      val n = (predrawCount[a] ?: 0) + 1
      predrawCount[a] = n
      if (n <= 3 || n % 60 == 0) SpikeLog.log("predraw#$n", a.javaClass.simpleName)
      scan(a, "predraw#$n")
      true
    }
    decor.viewTreeObserver.addOnPreDrawListener(hook)
    hooks[a] = hook
  }

  private fun collect(root: View, out: MutableList<LynxView>) {
    if (root is LynxView) { out.add(root); return }
    if (root is ViewGroup) for (i in 0 until root.childCount) collect(root.getChildAt(i), out)
  }

  private fun scan(a: Activity, hook: String) {
    val decor = a.window?.decorView ?: return
    val views = ArrayList<LynxView>()
    collect(decor, views)
    val isPredraw = hook.startsWith("predraw")
    val n = predrawCount[a] ?: 0
    if (!isPredraw || n <= 3) SpikeLog.log("scan.$hook", "lynxViews=${views.size}")
    val m = mode()
    for (v in views) {
      val id = System.identityHashCode(v)
      if (seen[v] != true) {
        seen[v] = true
        SpikeLog.log("lynxview.found", "hook=$hook view=$id ctxNull=${v.lynxContext == null}")
        v.addLynxViewClient(object : LynxViewClient() {
          override fun onPageStart(url: String?) = SpikeLog.log("lynx.onPageStart", "view=$id url=${url ?: ""}")
          override fun onRuntimeReady() = SpikeLog.log("lynx.onRuntimeReady", "view=$id")
          override fun onFirstScreen() = SpikeLog.log("lynx.onFirstScreen", "view=$id")
          override fun onLoadSuccess() = SpikeLog.log("lynx.onLoadSuccess", "view=$id")
          override fun onLoadFailed(msg: String?) = SpikeLog.log("lynx.onLoadFailed", "view=$id msg=${msg ?: ""}")
          override fun onDataUpdated() = SpikeLog.log("lynx.onDataUpdated", "view=$id")
          override fun onPageUpdate() = SpikeLog.log("lynx.onPageUpdate", "view=$id")
        })
      }
      val kinds = pushedKinds.getOrPut(v) { mutableSetOf() }
      val wantEarly = m == "earliest" && !kinds.contains("early")
      val wantPredraw = (m == "earliest" || m == "predraw") && isPredraw && !kinds.contains("predraw")
      when {
        wantEarly -> { kinds.add("early"); if (isPredraw) kinds.add("predraw"); push(v, a, hook, id) }
        wantPredraw -> { kinds.add("predraw"); push(v, a, hook, id) }
        m == "none" && kinds.isEmpty() -> { kinds.add("none"); SpikeLog.log("push.skipped", "hook=$hook mode=none view=$id") }
      }
    }
  }

  private data class Ins(val top: Float, val right: Float, val bottom: Float, val left: Float, val source: String)

  /** Инсеты до attach окна: getRootWindowInsets == null, поэтому второй источник это WindowMetrics (API 30+). */
  private fun readInsets(a: Activity): Ins {
    val density = a.resources.displayMetrics.density
    val decor = a.window?.decorView
    val root = decor?.let { ViewCompat.getRootWindowInsets(it) }
    val rootBars = root?.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
    var metricsStr = "n/a"
    var metrics: android.graphics.Insets? = null
    if (Build.VERSION.SDK_INT >= 30) {
      val r = runCatching {
        a.windowManager.currentWindowMetrics.windowInsets
          .getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
      }
      metrics = r.getOrNull()
      metricsStr = metrics?.toString() ?: "err=${r.exceptionOrNull()}"
    }
    SpikeLog.log("insets.read", "attached=${decor?.isAttachedToWindow} rootWindowInsets=${rootBars?.toString() ?: "null"} windowMetrics=$metricsStr")
    return when {
      rootBars != null -> Ins(rootBars.top / density, rootBars.right / density, rootBars.bottom / density, rootBars.left / density, "rootWindowInsets")
      metrics != null -> Ins(metrics.top / density, metrics.right / density, metrics.bottom / density, metrics.left / density, "windowMetrics")
      else -> Ins(-1f, -1f, -1f, -1f, "none")
    }
  }

  private fun push(v: LynxView, a: Activity, hook: String, id: Int) {
    generation += 1
    val ins = readInsets(a)
    val payload: Map<String, Any> = mapOf(
      "top" to ins.top.toDouble(),
      "right" to ins.right.toDouble(),
      "bottom" to ins.bottom.toDouble(),
      "left" to ins.left.toDouble(),
      "generation" to generation.toDouble(),
      "hook" to hook,
      "source" to ins.source,
      "pushedWallMs" to System.currentTimeMillis().toDouble(),
    )
    SpikeLog.log("push.updateGlobalProps", "hook=$hook gen=$generation view=$id payload=$payload")
    val r = runCatching { v.updateGlobalProps(mapOf("safeArea" to payload)) }
    SpikeLog.log("push.done", "gen=$generation ok=${r.isSuccess} err=${r.exceptionOrNull()?.toString() ?: ""}")
  }
}
