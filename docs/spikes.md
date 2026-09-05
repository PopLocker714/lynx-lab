---
verified: 2026-09-05
lynx_version: 4.0.1 (исходники) / 3.9.0 (на устройстве, пин rc-шаблона Sparkling)
sparkling_version: 2.1.0-rc.36
status: spec
---

# Спайки

Проверки на день или меньше. Все отвечают на вопросы о **форме кода**, а не о деталях,
поэтому прогоняются до первой строки реализации.

Результат каждого спайка дописывается сюда же, с датой.

## S1 · Подспеки из глобала Podfile

**Для:** `lynx-permissions`, `lynx-notify` · **Закрывает:** `N9`

Два прогона, не один:

1. `$LynxNotifyProviders = ['apns']` в Podfile, `pod install`, проверить что
   скомпилировался только APNs-подспек
2. **Сменить глобал**, повторить `pod install` с сохранёнными `Podfile.lock`
   и `Pods/Manifest.lock`

Смена глобала ничего не меняет на диске, поэтому контрольная сумма podspec идентична.
Перечитывает ли CocoaPods `:path`-подспек при живом лок-файле, не выяснено.

**Если провалится:** весь механизм модульности на iOS надо менять. Запасные варианты:
скрипт вида `setup.rb` у zoontek (правит podspec на диске), или переменная окружения,
или `post_install` хук.

**Результат:** _не прогонялся_

---

## S2 · Синхронный возврат String из нативного модуля

**Для:** `lynx-permissions`

```kotlin
@LynxMethod fun check(permission: String): String
```

на обеих платформах.

**Ожидание: пройдёт.** `returnTypeToChar` принимает `String` как `'T'`,
а `PerformMethodInvocation` читает `[[inv methodSignature] methodReturnType]`
и обрабатывает `_C_ID` вместе со всеми числовыми и `_C_BOOL`.

**Если провалится:** весь API разрешений становится колбэчным. Но `P1` его и так
частично туда двигает, так что цена ниже, чем кажется.

**Результат:** _не прогонялся_

---

## S3 · `addStaticManifestFile` через Autolink

**Для:** `lynx-notify` · **Закрывает:** `N4`

```kotlin
androidComponents.onVariants { variant ->
  variant.sources.manifests.addStaticManifestFile("src/providers/fcm/AndroidManifest.xml")
}
```

в проекте библиотеки, потребляемой через Autolink. Проверить, что фрагмент долетает
до смерженного манифеста приложения.

**Отменяет:** самодельную склейку манифестов и весь риск `N4`.

**Результат:** _не прогонялся_

---

## S4 · Прозрачная Activity на реальном MIUI

**Для:** `lynx-permissions` · **Закрывает:** `P6`

Взять технику `@amritk/lynx-location` и проверить на реальном MIUI или HyperOS:

- переживает ли поворот экрана
- переживает ли смерть процесса
- что происходит при подавлении фонового старта активити
- видит ли пользователь мигание

**Если провалится:** нужен `ActivityResultLauncher` против хостовой Activity, но тогда
надо подтвердить, что `SparklingActivity` это `ComponentActivity` или `AppCompatActivity`.

**Результат:** _не прогонялся_

---

---

## S6 · Успевает ли ранний `updateGlobalProps` стать `init_global_props_`

**Для:** `lynx-edge-to-edge` · **Закрывает:** риск №1 спеки («один кадр с нулями»)
и риск «ContentProvider под R8»

**Вопрос.** Вся доставка инсетов в спеке держится на одном допущении: пуш
`LynxView.updateGlobalProps` до старта JS-рантайма буферизуется и приезжает в JS
как **начальное** значение `lynx.__globalProps`, а не как позднее обновление.
Спека предлагала пушить на первом pre-draw декора.

**Как гоняли.** Стоковый rc-шаблон (`create-sparkling-app@rc`, Sparkling 2.1.0-rc.36,
Lynx 3.9.0), library-модуль `:spike` с `ContentProvider` в собственном манифесте,
`ActivityLifecycleCallbacks` с логом каждого хука и обходом дерева в поисках `LynxView`,
`LynxViewClient` для `onRuntimeReady`/`onFirstScreen`, и JS, который печатает
`lynx.__globalProps.safeArea` на module scope обоих потоков, в каждом рендере и по событию
`onGlobalPropsChanged`. Режим через `adb shell setprop debug.spike.mode`:
`predraw` (дизайн спеки), `earliest` (пуш при первом появлении LynxView), `none` (контроль).
Код, логи и скриншоты: [docs/spikes/s6/](spikes/s6/), пробник `apps/probe-e2e`.

**Где гоняли.** Сначала эмулятор AVD `twowe` (профиль Pixel 7, Android 36, arm64-v8a,
плотность 420), затем **Pixel 9 (Android 17, API 37, плотность 420)** в тех же трёх
режимах, debug и release. Порядок событий совпал полностью, см. `pixel-*.log`
и `pixel9-release-earliest.png`.

**Результат: ДА, буферизуется, но не с того хука, что в спеке.**

| Хук | `LynxView` в дереве | Что доступно |
|---|---|---|
| `onActivityCreated` / `PostCreated` / `Started` | нет | — |
| **`onActivityPostStarted`** | **да, впервые** | `getRootWindowInsets` = `null` (окно не attach'нуто), `WindowManager.currentWindowMetrics.windowInsets` = верные числа (API 30+) |
| `onActivityResumed` | да | то же |
| первый pre-draw декора | да | всё, но **после** старта JS |

Таймлайн `earliest` (debug, `emu2-earliest.log`), t от `provider.onCreate`:

| t, мс | Событие |
|---|---|
| 473 | Sparkling сам делает `UpdateGlobalProps` с 22 ключами (после `renderTemplateUrl`, см. ниже) |
| 476 | `onActivityPostStarted`, LynxView найден |
| 482 | **наш пуш**, `source=windowMetrics`, top=51.8dp, bottom=24dp → в логе `UpdateGlobalProps 23` |
| 534 | JS module scope на **MTS**: `safeArea` уже есть, generation=1 |
| 557 | JS module scope на **BTS**: то же |
| 590 | `onRuntimeReady` |
| 602 | первый pre-draw; повторный пуш (gen=2) приходит уже событием `__NotifyGlobalPropsUpdated` |
| 679 | `onFirstScreen` |

Запас между пушем и стартом MTS около 50 мс на эмуляторе. Первый экран отрисован
с правильными инсетами, событие обновления для gen=1 не приходило вовсе: значение
уехало внутри `LoadApp`.

Таймлайн `predraw` (`emu-predraw.log`): MTS-рендер на 627 мс, pre-draw на 706 мс,
пуш на 735 мс → `safeArea=null` на первом рендере обоих потоков, `__NotifyGlobalPropsUpdated`
на 872 мс, BTS ре-рендер, `onFirstScreen` на 806 мс, `onPageUpdate` на 906 мс.
То есть **сто миллисекунд первого экрана с нулями**, ровно тот сценарий, которого боялась
спека. В release-сборке pre-draw один раз успел (`rel-predraw.log`: пуш 322 мс,
`onRuntimeReady` 664 мс), второй раз нет: это гонка, а не порядок.

**Release и R8.** `rel2-*.log` и два скриншота: провайдер из манифеста library-модуля
смержился (`manifest-merger-*-report.txt`: `ADDED from [:spike]`), пережил
`isMinifyEnabled = true` + `isShrinkResources = true`, таймлайн тот же. На экране
`initial=` (снимок на module scope) в режиме `earliest` содержит `hook: postStarted,
source: windowMetrics`, в режиме `predraw` показывает `null`.

**Подтверждено исходниками (тег 4.0.1, то же в 3.9.0):**

- `core/shell/runtime/bts/bts_runtime.cc:1123-1135` — `BTSRuntime::OnGlobalPropsUpdated`:
  при `state_ == State::kNotStarted` делает `init_global_props_ = props`, иначе шлёт
  `MessageEvent` типа `__NotifyGlobalPropsUpdated` в JS-контекст
- `bts_runtime.cc:701-709` — `OnJSSourcePrepared` кладёт в `init_global_props_`
  копию `global_props_` из `TemplateAssembler`, `:778` отдаёт её в `App::LoadApp`
- `core/runtime/js/bindings/js_app.cc:2011` и `:3085` — `LoadApp` сохраняет,
  `App::GetInitGlobalProps` отдаёт `ShallowCopy` в JS
- `core/renderer/template_assembler.cc:251-270` — `TemplateAssembler::UpdateGlobalProps`
  делает `global_props_ = data` (**замена, не мерж**) и при `template_loaded_`
  зовёт `NotifyGlobalPropsChanged`; `:2903` отдаёт `lepus::Value::Clone(global_props_)`
  в `OnJSSourcePrepared`. То есть пуш, пришедший до декодирования шаблона, тоже
  становится начальным, через другую ветку
- Мерж по верхнему ключу живёт на Java-стороне:
  `LynxTemplateRender.internalMergeGlobalPropsSafely(TemplateData)` (javap по
  `lynx-3.9.0.aar`), в логе `UpdateGlobalProps 22` → `23`. Ключи Sparkling уцелели
- Sparkling 2.1.0-rc.36, `SimpleLynxKitView.kt:74-75`: `renderTemplateUrl(...)`, затем
  `updateGlobalProps(GlobalPropsUtils...)`. **Sparkling сам живёт на этой же
  буферизации**, его `statusBarHeight` и остальные 22 ключа доставляются пушем после
  старта загрузки
- `SparklingActivity.kt:99-106`: фрагмент коммитится `commit()` из `onCreate`,
  `SparklingFragment.onCreateView` создаёт `SparklingView` и зовёт `loadUrl()`.
  Материализуется во время `onStart` после `super.onStart()`, поэтому `onActivityStarted`
  ещё не видит LynxView, а `onActivityPostStarted` уже видит

**Что меняется в спеке.** Точка пуша: `onActivityPostStarted` (и `onActivityResumed`
для перепривязки), а не pre-draw. Источник значений до attach окна:
`WindowManager.currentWindowMetrics.windowInsets` на API 30+, иначе тёплый кеш из
предыдущего окна, иначе нули. Pre-draw остаётся для обновлений и как страховка, с
дедупликацией по значениям (gen=2 в спайке был идентичен gen=1 и породил лишний
ре-рендер). Канал C (`sendGlobalEvent`) не нужен: обновления приезжают через
`__NotifyGlobalPropsUpdated`, ReactLynx 0.116 превращает его в
`Object.assign(lynx.__globalProps, data)` плюс `GlobalEventEmitter.emit('onGlobalPropsChanged')`
(`@lynx-js/react/runtime/lib/lynx/tt.js:219-229`). См. D8.

**Pixel 9 (`pixel-earliest.log`, debug):** `onActivityPostStarted` 608 мс, пуш 616 мс
(`windowMetrics=Insets{0,173,0,63}` → top 65.9dp, bottom 24dp), module scope MTS/BTS
~668 мс с `generation=1`, `onRuntimeReady` 709 мс. Запас те же ~50 мс.
**`pixel-predraw.log`:** MTS стартовал на **1 мс раньше** первого pre-draw
(`05.174` против `05.175`), первый рендер обоих потоков с `null`, поправка событием.
На железе гонка ещё туже, чем на эмуляторе. Release на Pixel: скриншот с
`initial={... hook: postStarted, source: windowMetrics}`.

**Не проверено и остаётся:** поведение `currentWindowMetrics` до attach на OEM-прошивках
(MIUI/HyperOS/ColorOS); iOS целиком (день 6).

**Результат:** _пройден 2026-09-05 на эмуляторе и 2026-09-05 на Pixel 9_

## Что проверять НЕ надо

**Рефлексивное обнаружение под R8 и dead stripping.** Разобрано в
`docs/02-modularity.md` и оказалось наименее рискованной частью обоих проектов.
Autolink самого Lynx использует ровно тот же `Class.forName` в `catch (Throwable)`
и `NSClassFromString`, поэтому оно сломается только там, где уже сломался autolink.

Единственный реальный риск это потеря флага `-ObjC` приложением, перезаписавшим
`OTHER_LDFLAGS` без `$(inherited)`. Но тогда молча отваливается **весь** autolink Lynx,
не только наш, и диагностируется это через `getLinkedProviders()`.
