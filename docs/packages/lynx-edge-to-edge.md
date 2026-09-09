---
verified: 2026-09-10
lynx_version: 4.0.1 (Maven) / 4.0.0 (CocoaPods)
sparkling_version: 2.1.0-rc.36
status: building
estimate: 9–10 дней
---

# @lynx-lab/edge-to-edge

Safe area, инсеты и системные бары. Аналог `react-native-edge-to-edge` плюс
`react-native-safe-area-context` в одном пакете.

Репозиторий: `PopLocker714/lynx-edge-to-edge` (один репозиторий на пакет, как у crypto).

## Вердикт: greenfield

Ничего пригодного не существует.

| Кандидат | Почему не годится |
|---|---|
| `@tamer4lynx/tamer-insets` | Приварен к своему CLI: `lynx.ext.json` плюс `activityPatches` переписывают пять хуков хостовой Activity. Пинится к Lynx 3.3.1. Кода включения edge-to-edge нет вовсе |
| `@sigx/lynx-safe-area` | Hard dependency на `@sigx/reactivity`, возвращает `Computed`/`PrimitiveSignal`. Из ReactLynx не потребляется |
| `SafeAreaView` из шаблона Sparkling | Читает `globalProps` **один раз без подписки**, хардкодит `left:0`/`right:0`, а на Android берёт `resources.getIdentifier("navigation_bar_height")`, то есть 48dp трёхкнопочной навигации там, где реальный инсет жестовой около 24dp. И дважды прибавляет нав-бар |

Ни в одном из трёх нет главного: **включения edge-to-edge**.

## Главный вывод: `env(safe-area-inset-*)` чинить нельзя

Проверено на бинарнике, а не по исходникам.

`nm -D` по `jni/arm64-v8a/liblynx.so` из `lynx-4.0.1.aar`: **670 динамических символов,
совпадений по `SAFE_AREA` ноль**. `objdump -h` показывает отсутствие `.symtab`, то есть
полный strip. Статики `ComputedCSSStyle::SAFE_AREA_INSET_*` не помечены `LYNX_EXPORT`,
библиотека собрана с `-fvisibility=hidden` (`BUILD.gn:151`), а `lynx_export.h` прямо
пишет, что без макроса символ «can not be exported, even if you use a --version-script».
JNI-пути тоже нет: в `classes.jar` ни одного safe-area класса.

**На Android сеттер физически недостижим.**

На iOS достижим (под исходниковый, заголовок с публичными статиками едет в проект),
но негоден по трём причинам: статики **процесс-глобальные**, то есть одни на все
`LynxView`; запись **не вызывает релэйаут**; `GetEnvValue` возвращает
`std::pair<int,bool>`, то есть float усекается в int, и значение уходит
в `NLength::MakeUnitNLength` мимо масштабирования `layouts_unit_per_px_`.

И корень глубже сеттера:

```cpp
// core/renderer/css/dynamic_css_styles_manager.cc:208
case CSSValuePattern::ENV:
  // TODO:
  break;
```

`ENV` не зарегистрирован как динамическая зависимость стиля, в `StyleDynamicType` нет
флага safe-area. Даже правильно записанное значение не инвалидирует ни один уже
разрешённый стиль. **Это структурная причина, почему issue #299 висит с марта 2025.**

Поправка к более ранним записям: на **HarmonyOS инсеты тоже захардкожены нулями**
(`platform/harmony/.../lynx_template_renderer.cc:84-87`), как и в эмбеддере.
Ненулевые они **только на iOS**.

## Приз забираем через CSS-переменные

Lynx поддерживает CSS custom properties, они наследуются по умолчанию, и с 3.6 их можно
объявлять инлайном. `SafeAreaProvider` рендерит один `<view>` и вешает на него:

```
--safe-area-inset-top / -right / -bottom / -left, --safe-area-keyboard-height
```

Имена выбраны буквально так, чтобы **миграция существующего CSS была поиском-заменой
`env(` на `var(--`**, без изменения ни одного значения.

## Транспорт: три канала, приоритет у globalProps

**Канал A, `lynx.__globalProps.safeArea`, главный.** `BTSRuntime::OnGlobalPropsUpdated`
**буферизует** пуш, сделанный до старта рантайма, в `init_global_props_` и отдаёт его
в `LoadApp`. То есть ранний пуш становится **инициальным значением**, а не теряется.
Единственный канал без дыры на холодном старте.

Со стороны JS это первоклассный API: `useGlobalProps` документирован как «If
`lynx.__globalProps` is changed, a re-render will be triggered automatically», плюс
`useGlobalPropsChanged`. И это **официально рекомендованный мейнтейнером путь**:
MoonfaceX, discussion #165, 2025-03-07: «we're handling this through a dynamic approach
where native containers inject `status_bar_height` and `bottom_area_height` via
`__globalProps`». Там же обещано «We will seriously consider providing a built-in element
like `<SafeAreaView>`» — семнадцать месяцев спустя не выпущено ничего.

В отличие от `env()`-статик, globalProps живут **на LynxView, а не на процессе**, поэтому
несколько LynxView с разными инсетами работают корректно.

**Канал B, синхронный `getSnapshot()`** из нативного модуля. Читает тёплый кеш,
заполненный ещё до `Application.onCreate`. Авторитетный fallback.

**Канал C, `sendGlobalEvent` только для дельт.** Первое значение им не доставляется
никогда, потому что `LynxContext.sendGlobalEvent` молча дропает при отсутствии
`GlobalEventEmitter`. Каждый снимок несёт монотонный `generation`.

Правило чтения в JS: globalProps (если `generation` не старше кеша) → нативный геттер →
нули с одним `warn`.

## Результат спайка дня 1 (2026-09-05, эмулятор)

Главное допущение **подтвердилось**: ранний `updateGlobalProps` буферизуется в
`init_global_props_` и приезжает в JS как начальное значение на обоих потоках. Но
точка пуша в этой спеке была выбрана неверно, и код ниже надо читать с тремя поправками.
Полный разбор с таймлайнами, логами и цитатами исходников: [spikes.md, S6](../spikes.md).

1. **Пуш из `onActivityPostStarted`, не с pre-draw.** Первый pre-draw декора приходит
   после `LoadApp` (T31), а `LynxView` появляется в дереве в `onActivityPostStarted`,
   потому что Sparkling материализует фрагмент в `onStart`. `onActivityResumed`
   остаётся для перепривязки после фона, pre-draw остаётся для обновлений.
2. **Значения до attach окна берутся из `WindowManager.currentWindowMetrics.windowInsets`**
   (API 30+), потому что `getRootWindowInsets` в этот момент `null` (T32).
   Ниже API 30 — тёплый кеш `SafeAreaStore`, иначе нули; pre-draw поправит.
3. **Канал C (`sendGlobalEvent`) не нужен.** Обновление после старта приезжает
   как `__NotifyGlobalPropsUpdated`, ReactLynx делает `Object.assign(lynx.__globalProps, data)`
   и `GlobalEventEmitter.emit('onGlobalPropsChanged')` уже в 0.116
   (`runtime/lib/lynx/tt.js:219-229`), в 0.125 поверх этого есть `useGlobalPropsChanged`.
   `SafeAreaStore.publish` должен дедуплицировать по значениям: в спайке второй пуш
   с теми же числами породил лишний ре-рендер.

Мерж по верхнему ключу делает платформенный `TemplateData` через `LynxViewDataManager::UpdateData`,
а не движок (T33); на iOS проверено по исходникам 2026-09-10, вложенные таблицы мержатся тоже. ContentProvider из манифеста library-модуля
смержился и пережил R8 в release. На реальном Pixel 9 спайк не прогонялся.

## Результат дней 2–6 (2026-09-05 Pixel 9, 2026-09-10 эмулятор и симулятор)

Пакет живёт в `packages/lynx-edge-to-edge`, репозиторий `PopLocker714/lynx-edge-to-edge`
(пока приватный, откроется на 0.1.0). Сделано и проверено на стоковом rc-шаблоне
с единственной правкой `kapt(libs.lynx.processor)`, пакет ставился из тарбола:

| Проверка | Результат |
|---|---|
| JS: typecheck, lint, 25 тестов, build, тарбол | зелёные |
| `android-check` standalone | AAR собирается |
| Хост AGP 7.4.2 / Kotlin 1.8.10 через autolink | собирается, провайдер в смерженном манифесте |
| Первый кадр | `render#1` на MTS и BTS с `top=65.9 bottom=24`, `source: globalProps`, `generation: 1` |
| Трёхкнопочная навигация | `bottom` 24 → 48 → 24 через `onGlobalPropsChanged`, ре-рендер |
| Второй LynxView в том же процессе | получает снимок в `postStarted`, без событий |
| CSS-переменные | `padding-top: var(--safe-area-inset-top)` применился внутри `SafeAreaProvider` |
| Пробник: `<input>` | Sparkling не везёт `xelement-input`; для теста клавиатуры в хост добавлены `org.lynxsdk.lynx:xelement-input:3.9.0` и `Behavior("input")` через `SparklingLynxConfig.addBehaviors` |
| Поворот | альбомная: `left=65.9` (вырез слева), `top=24`, `bottom=24`, gen=2 **на первом кадре** нового LynxView; обратно `top=65.9`, gen=3. Debug-схема шаблона несёт `screen_orientation=portrait`, для теста заменена на `unspecified` (T37) |
| `refresh()` | 2026-09-10, эмулятор: `LynxModuleAndroid Create`, колбэк вернул снимок, g не растёт при тех же значениях |
| `setSystemBarStyle` | `light` → `mLastAppearance` без `LIGHT_STATUS_BARS`, белые иконки; `dark` → `LIGHT_STATUS_BARS LIGHT_NAVIGATION_BARS`, тёмные. Проверено `dumpsys window` и скриншотами |
| `setSystemBarHidden` | `true` → `statusBars visible=false`, `navigationBars visible=false`, `bottom` 24 → 0 событием; `false` → обратно. `top` остаётся 51.8: это `displayCutout`, не бар |
| Клавиатура (`<input>` из `xelement-input`) | `keyboardHeight` 0 → 336.4 → 0 через `onGlobalPropsChanged`, поколения 1 → 2 → 3 |
| Release под R8 (`isMinifyEnabled`, `isShrinkResources`) | 2026-09-10, эмулятор: в dex остались `EdgeToEdgeInitProvider`, `LynxEdgeToEdgeModule`, `LynxLibraryProviderImpl`, остальное обфусцировано; `hide`/`show` переключают бары, инсеты на первом кадре верные |
| **iOS, симулятор iPhone 17 (iOS 26.5), день 6** | 2026-09-10, стоковый rc-шаблон, `pod install` через гем autolink, `LynxEdgeToEdgeModule registered with param (address): 0x0` |
| iOS: первый кадр | после D10: `module-scope` и `render#1` на MTS видят `gen=1 top=62 bottom=34` из globalProps; до D10 было `null` (T39) |
| iOS: поворот | альбомная `t=0 l=62 r=62 b=20` (gen 2), обратно `t=62 b=34` (gen 3), через `safeAreaInsetsDidChange` observer-вьюхи и `onGlobalPropsChanged` |
| iOS: мерж globalProps | по исходникам (T33), ключи Sparkling не затирались, `statusBarHeight` и остальные на месте |
| iOS: `refresh()`, бары, клавиатура | **не проверены**: тап по симулятору не доставился ни через mobile-MCP, ни через `interceptor macos click`; `<input>` в поде Lynx 3.9.0 нет (только `text`, `view`, `image`, `scroll-view`, `list`...). Проверять на iPhone 11 |
| Регистрация модуля | **не работала четыре прогона** из-за устаревшего autolink-реестра (T38), после `rm -rf .../lynxLibraryRegistry` заработала |

Три поправки к коду в этой спеке, все уже в репозитории пакета:

1. `compileOnly androidx.annotation` **убран**: `androidx.core:1.13.1` приносит его
   транзитивно, а явная другая версия ломает consistent resolution AGP
   (`Cannot find a version of androidx.annotation that satisfies {strictly 1.6.0}`)
   и в `android-check`, и в хосте.
2. React-вход шипится **TSX-исходником** (T36, D9). Раздел `src/react/index.tsx` ниже
   верен по коду, но `exports["./react"]` указывает на `src`, не на `dist`.
Побочная находка на повороте: Sparkling при пересоздании Activity создаёт **два**
`SimpleLynxKitView` (восстановленный FragmentManager'ом фрагмент плюс новый через
`replace` в `onCreate`), оба грузят бандл. Сирота не попадает в дерево, наш пуш его не
достигает, и он рендерится с fallback (нули, gen=-1), после чего умирает. Видимый
второй получает снимок в `postStarted`. Лог: `docs/evidence/edge-to-edge/pixel9-rotation-window.log`.

3. `useGlobalProps` заменён на `useSyncExternalStore` поверх подписки core на
   `onGlobalPropsChanged`: хук есть в ReactLynx 0.116, который везёт rc-шаблон.

## Android: включение

Точка входа это **`ContentProvider` в манифесте библиотеки** (прецедент
`androidx.startup.InitializationProvider`), а **не** нативный модуль. Причина жёсткая:
сгенерированный `LynxLibraryProviderImpl` умеет ровно `registerModule` / `addBehaviors` /
`registerService`, произвольный код туда не вставить, а у `LynxViewBuilder` нет
`addLynxViewClient`. Модуль же создаётся **лениво на BTS при первом обращении из JS**,
то есть позже первого кадра.

Провайдер даёт `Application` **до** `Application.onCreate` →
`registerActivityLifecycleCallbacks` → `onActivityCreated` на каждой Activity, включая
`SparklingActivity`, которую мы не объявляли.

Включаем **руками, без `androidx.activity`**. `enableEdgeToEdge()` это расширение
`ComponentActivity`, но appcompat 1.6.1 тянет activity 1.6.0, где его ещё нет, а 1.10.x
требует compileSdk 35 при шаблонных 34. Плюс ручной путь всё равно нужен для
не-`ComponentActivity` хостов (Lynx Explorer, brownfield).

Порядок из androidx `EdgeToEdge.kt` воспроизводим полностью, **включая единственное, что
реально чинит альбомную ориентацию с вырезом**: `layoutInDisplayCutoutMode = SHORT_EDGES`
на API 28-29 и `ALWAYS` на 30+. Голый `setDecorFitsSystemWindows(false)` оставляет режим
`DEFAULT`, и окно летербоксится от выреза.

### Про targetSdk

Шаблон Sparkling это `compileSdk`/`targetSdk` **34**, значит включение делаем мы и это
весь продукт. Но Google Play с 31 августа 2026 требует targetSdk 36 для новых приложений
и обновлений. Всё, что реально уедет в Play, окажется на **принудительном edge-to-edge**,
где `setDecorFitsSystemWindows` открывается строкой `if (mEdgeToEdgeEnforced) { return; }`
и весь продукт это отчёт инсетов. **Оба пути гоняются безусловно, ветвления по SDK нет.**

## iOS

Включать нечего: Sparkling уже рисует под барами и всегда будет.
`SPKViewController.setupViewContainer` пинит контейнер к сырому `self.view`
(`make.left.right.bottom.equalTo(self.view)`, строка 509), а схема шаблона это
`hide_status_bar=1&hide_nav_bar=1`, что даёт `topOffset = 0`. Из схемы это не чинится.

Наша работа на iOS ровно одна: **отдавать правильные числа и обновлять их** на повороте,
split view и смене Dynamic Island через `viewSafeAreaInsetsDidChange`.

## Конфигурация: сколько делает автор приложения

**Android — ноль шагов.** `bun add` и всё. `<provider>` мержится AGP автоматически.

Тему **сознательно не шипим**, хотя `react-native-edge-to-edge` делает именно так.
Приоритет мержа манифестов это variant > app > library с hard error при конфликте
атрибута, а при мерже ресурсов «If a given resource name is defined in both modules, the
resource from the app is used». Библиотека может подложить только тот атрибут, который
приложение опустило.

Опт-аут для тех, кто хочет управлять окном сам, одна строка в манифесте:

```xml
<provider android:name="dev.lynxlab.edgetoedge.EdgeToEdgeInitProvider"
          android:authorities="${applicationId}.lynx-edge-to-edge"
          tools:node="remove" />
```

**iOS — ноль шагов для инсетов**, `pod install` и всё.

**iOS system bars — единственный ручной шаг, и он не в v1.** Config-плагинов у Sparkling
нет, `Info.plist` пакет инжектить не может. В v1.1 автор добавляет руками:

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

Ровно этот ключ единственная причина, по которой `StatusBar.setBarStyle` работает
в React Native. **В v1 iOS-методы баров это честные no-op, и README говорит это прямым
текстом, а не молчит.**

## Что пишет автор в коде

```tsx
import { SafeAreaProvider, SystemBars } from '@lynx-lab/edge-to-edge/react'

export function App() {
  return (
    <SafeAreaProvider>
      <SystemBars style="auto" />
      <Screen />
    </SafeAreaProvider>
  )
}
```

Дальше два способа, оба работают:

```css
/* 1. CSS — миграция с env() это поиск-замена */
.header { padding-top: var(--safe-area-inset-top); }
```

```ts
// 2. JS
const insets = useSafeAreaInsets()
```

## TypeScript API

```ts
// ═══════════════════════════════════════════════════════════════════════════
// src/types.ts — общие типы. Никаких enum: через мост ходят только number,
// string, boolean и плоские объекты. Все «перечисления» — union строковых
// литералов, они стираются в компиляции и на мосту становятся обычной строкой.
// ═══════════════════════════════════════════════════════════════════════════

export interface EdgeInsets {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

export type Edge = 'top' | 'right' | 'bottom' | 'left'
export type SafeAreaMode = 'padding' | 'margin'
export type SystemBarStyle = 'auto' | 'inverted' | 'light' | 'dark'

export interface SafeAreaSnapshot {
  /** Инсеты в dp (Android) / pt (iOS). Клавиатуру НЕ включают — как в iOS. */
  readonly insets: EdgeInsets
  /** Высота клавиатуры отдельным полем. Android: только API 30+, иначе 0. */
  readonly keyboardHeight: number
  /** Монотонный счётчик. Разрыв означает пропущенное событие — перечитай. */
  readonly generation: number
  /** Реально ли окно рисует под барами. На iOS в Sparkling всегда true. */
  readonly edgeToEdge: boolean
  /** Откуда пришло значение. Диагностика, не логика. */
  readonly source: 'globalProps' | 'native' | 'fallback'
}

export const ZERO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 }

// ═══════════════════════════════════════════════════════════════════════════
// src/native.ts — шов к нативу. Тот же паттерн, что в @lynx-lab/crypto:
// NativeModules это `declare global` из @lynx-js/types, в тарболе пакета нет
// ни одного .js, поэтому импортировать его нельзя — будет падение в рантайме.
// ═══════════════════════════════════════════════════════════════════════════

declare const NativeModules: Record<string, unknown> | undefined

/**
 * Проволочная форма ПЛОСКАЯ. Вложенных объектов через мост не гоняем:
 * возврат JavaOnlyMap подтверждён в whitelist LynxMethodWrapper, но вложенность
 * прогоняется через конвертацию TemplateData, и лишний слой — лишний риск.
 */
export interface SafeAreaWire {
  top: number
  right: number
  bottom: number
  left: number
  keyboardHeight: number
  generation: number
  edgeToEdge: boolean
}

export interface LynxEdgeToEdgeNative {
  /** Синхронно. Читает тёплый кеш, окна не трогает — на UI-поток не ходит. */
  getSnapshot(): SafeAreaWire
  /** Холодный путь для brownfield-хостов, где не отработал ContentProvider. */
  refresh(callback: (wire: SafeAreaWire) => void): void
  /** 'auto' | 'inverted' | 'light' | 'dark'. На iOS v1 — no-op. */
  setSystemBarStyle(statusBar: string, navigationBar: string): void
  setSystemBarHidden(statusBar: boolean, navigationBar: boolean): void
}

const MODULE_NAME = 'LynxEdgeToEdgeModule'

let injected: LynxEdgeToEdgeNative | null = null

/** Шов для тестов. setNativeModule(null) возвращает настоящий поиск. */
export function setNativeModule(module: LynxEdgeToEdgeNative | null): void {
  injected = module
}

/** Возвращает null вместо броска: на главном потоке модуля просто нет. */
export function tryGetNativeModule(): LynxEdgeToEdgeNative | null {
  if (injected) return injected
  if (typeof NativeModules === 'undefined' || NativeModules === null) return null
  const candidate = NativeModules[MODULE_NAME] as
    | Partial<LynxEdgeToEdgeNative>
    | undefined
  if (!candidate || typeof candidate.getSnapshot !== 'function') return null
  return candidate as LynxEdgeToEdgeNative
}

// ═══════════════════════════════════════════════════════════════════════════
// src/core.ts — источник истины в JS. Не зависит от React.
// ═══════════════════════════════════════════════════════════════════════════

import {
  type EdgeInsets,
  type SafeAreaSnapshot,
  ZERO_INSETS,
} from './types.js'
import {
  type LynxEdgeToEdgeNative,
  type SafeAreaWire,
  tryGetNativeModule,
} from './native.js'

export const SAFE_AREA_EVENT = 'safeareainsetschange'
export const GLOBAL_PROPS_KEY = 'safeArea'

/** lynx.__globalProps типизируем через declaration merging (см. globals.ts). */
declare const lynx:
  | {
      __globalProps?: Record<string, unknown>
      getJSModule?: (name: string) => {
        addListener(event: string, cb: (...args: unknown[]) => void): void
        removeListener(event: string, cb: (...args: unknown[]) => void): void
      } | null
    }
  | undefined

type Listener = (snapshot: SafeAreaSnapshot) => void

const listeners = new Set<Listener>()
let cached: SafeAreaSnapshot = {
  insets: ZERO_INSETS,
  keyboardHeight: 0,
  generation: -1,
  edgeToEdge: false,
  source: 'fallback',
}
let warned = false
let emitterBound = false

function fromWire(
  wire: SafeAreaWire,
  source: SafeAreaSnapshot['source']
): SafeAreaSnapshot {
  return {
    insets: {
      top: wire.top ?? 0,
      right: wire.right ?? 0,
      bottom: wire.bottom ?? 0,
      left: wire.left ?? 0,
    },
    keyboardHeight: wire.keyboardHeight ?? 0,
    generation: wire.generation ?? 0,
    edgeToEdge: wire.edgeToEdge === true,
    source,
  }
}

function readGlobalProps(): SafeAreaSnapshot | null {
  if (typeof lynx === 'undefined' || !lynx?.__globalProps) return null
  const raw = lynx.__globalProps[GLOBAL_PROPS_KEY] as SafeAreaWire | undefined
  if (!raw || typeof raw.generation !== 'number') return null
  return fromWire(raw, 'globalProps')
}

function readNative(): SafeAreaSnapshot | null {
  const native = tryGetNativeModule()
  if (!native) return null
  try {
    return fromWire(native.getSnapshot(), 'native')
  } catch {
    return null
  }
}

function adopt(next: SafeAreaSnapshot | null): void {
  if (!next) return
  // generation монотонен и общий для обоих каналов: старое событие,
  // догнавшее нас после свежих globalProps, не откатывает состояние.
  if (next.generation < cached.generation) return
  const a = cached.insets
  const b = next.insets
  const same =
    next.generation === cached.generation &&
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left &&
    cached.keyboardHeight === next.keyboardHeight
  cached = next
  if (same) return
  for (const l of listeners) l(next)
}

/**
 * Порядок чтения: globalProps → нативный геттер → нули.
 * globalProps первым, потому что это единственный канал, который жив
 * на первом кадре: пуш, сделанный до старта рантайма, буферизуется
 * BTSRuntime::OnGlobalPropsUpdated в init_global_props_ и приезжает
 * как ИНИЦИАЛЬНОЕ значение, а не теряется.
 */
export function getSafeAreaSnapshot(): SafeAreaSnapshot {
  const next = readGlobalProps() ?? readNative()
  if (next) {
    adopt(next)
    return cached
  }
  if (!warned && cached.generation < 0) {
    warned = true
    console.warn(
      '@lynx-lab/edge-to-edge: инсеты недоступны, отдаю нули.\n' +
        '  Главный поток (MTS): NativeModules здесь не существует, это ожидаемо — ' +
        'используй useSafeAreaInsets из "@lynx-lab/edge-to-edge/react", он читает globalProps.\n' +
        '  Android: если и на BTS нули — не отработал ContentProvider. ' +
        'adb logcat | grep LynxEdgeToEdge.\n' +
        '  iOS: проверь, что в Pods/ есть autolink-реестр с LynxEdgeToEdgeModule.'
    )
  }
  return cached
}

export function getSafeAreaInsets(): EdgeInsets {
  return getSafeAreaSnapshot().insets
}

export function getKeyboardHeight(): number {
  return getSafeAreaSnapshot().keyboardHeight
}

/**
 * Подписка на дельты. Только BTS: GlobalEventEmitter это JSModule.
 * Событие, отправленное до готовности рантайма, ДРОПАЕТСЯ с логом —
 * поэтому первое значение всегда берётся из getSafeAreaSnapshot(),
 * а не ожидается от события.
 */
export function subscribeSafeArea(listener: Listener): () => void {
  listeners.add(listener)
  bindEmitter()
  listener(getSafeAreaSnapshot())
  return () => {
    listeners.delete(listener)
  }
}

function bindEmitter(): void {
  if (emitterBound) return
  if (typeof lynx === 'undefined' || typeof lynx?.getJSModule !== 'function') return
  const emitter = lynx.getJSModule('GlobalEventEmitter')
  if (!emitter) return
  emitterBound = true
  emitter.addListener(SAFE_AREA_EVENT, (...args: unknown[]) => {
    const wire = args[0] as SafeAreaWire | undefined
    if (!wire || typeof wire.generation !== 'number') return
    adopt(fromWire(wire, 'native'))
  })
}

/** Догоняющий вызов для brownfield-хостов, где ContentProvider не отработал. */
export function refreshSafeArea(): Promise<SafeAreaSnapshot> {
  const native = tryGetNativeModule()
  if (!native) return Promise.resolve(getSafeAreaSnapshot())
  return new Promise((resolve) => {
    native.refresh((wire) => {
      adopt(fromWire(wire, 'native'))
      resolve(cached)
    })
  })
}

/**
 * Имена переменных выбраны так, чтобы миграция существующего CSS была
 * поиском-заменой `env(` → `var(--`. env(safe-area-inset-top) на Android
 * всегда 0 (статики в liblynx.so застриплены), var(--safe-area-inset-top)
 * работает одинаково на обеих платформах и реактивен.
 */
export function safeAreaCssVarString(snapshot: SafeAreaSnapshot): string {
  const { top, right, bottom, left } = snapshot.insets
  return (
    `--safe-area-inset-top:${top}px;` +
    `--safe-area-inset-right:${right}px;` +
    `--safe-area-inset-bottom:${bottom}px;` +
    `--safe-area-inset-left:${left}px;` +
    `--safe-area-keyboard-height:${snapshot.keyboardHeight}px;`
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// src/globals.ts — declaration merging. @lynx-js/react экспортирует ПУСТОЙ
// `interface GlobalProps` именно под это (проверено в 0.125.0,
// runtime/lib/core/globalProps.d.ts). Импортируется за побочный эффект типов.
// ═══════════════════════════════════════════════════════════════════════════

import type { SafeAreaWire } from './native.js'

declare module '@lynx-js/react' {
  interface GlobalProps {
    safeArea?: SafeAreaWire
  }
}

export {}

// ═══════════════════════════════════════════════════════════════════════════
// src/system-bars.ts — стек записей, порт zoontek/react-native-edge-to-edge.
// Чистый JS поверх двух нативных сеттеров. Побеждает самый глубокий /
// последним смонтированный. Батчинг — микротаска (setImmediate в Lynx нет).
// ═══════════════════════════════════════════════════════════════════════════

import type { SystemBarStyle } from './types.js'
import { tryGetNativeModule } from './native.js'

export interface SystemBarsEntry {
  statusBarStyle: SystemBarStyle | null
  navigationBarStyle: SystemBarStyle | null
  statusBarHidden: boolean | null
  navigationBarHidden: boolean | null
}

export interface SystemBarsProps {
  style?: SystemBarStyle | { statusBar?: SystemBarStyle; navigationBar?: SystemBarStyle }
  hidden?: boolean | { statusBar?: boolean; navigationBar?: boolean }
}

const stack: SystemBarsEntry[] = []
let flushScheduled = false
let lastPushed: SystemBarsEntry | null = null

export function createEntry(props: SystemBarsProps): SystemBarsEntry {
  const { style, hidden } = props
  const styleObj = typeof style === 'object' && style !== null ? style : undefined
  const hiddenObj = typeof hidden === 'object' && hidden !== null ? hidden : undefined
  return {
    statusBarStyle: styleObj ? (styleObj.statusBar ?? null) : ((style as SystemBarStyle) ?? null),
    navigationBarStyle: styleObj ? (styleObj.navigationBar ?? null) : ((style as SystemBarStyle) ?? null),
    statusBarHidden: hiddenObj ? (hiddenObj.statusBar ?? null) : ((hidden as boolean) ?? null),
    navigationBarHidden: hiddenObj ? (hiddenObj.navigationBar ?? null) : ((hidden as boolean) ?? null),
  }
}

function merge(): SystemBarsEntry {
  const out: SystemBarsEntry = {
    statusBarStyle: 'auto',
    navigationBarStyle: 'auto',
    statusBarHidden: false,
    navigationBarHidden: false,
  }
  for (const entry of stack) {
    if (entry.statusBarStyle !== null) out.statusBarStyle = entry.statusBarStyle
    if (entry.navigationBarStyle !== null) out.navigationBarStyle = entry.navigationBarStyle
    if (entry.statusBarHidden !== null) out.statusBarHidden = entry.statusBarHidden
    if (entry.navigationBarHidden !== null) out.navigationBarHidden = entry.navigationBarHidden
  }
  return out
}

function schedule(): void {
  if (flushScheduled) return
  flushScheduled = true
  Promise.resolve().then(() => {
    flushScheduled = false
    const native = tryGetNativeModule()
    if (!native) return
    const next = merge()
    if (
      lastPushed &&
      lastPushed.statusBarStyle === next.statusBarStyle &&
      lastPushed.navigationBarStyle === next.navigationBarStyle &&
      lastPushed.statusBarHidden === next.statusBarHidden &&
      lastPushed.navigationBarHidden === next.navigationBarHidden
    ) {
      return
    }
    lastPushed = next
    native.setSystemBarStyle(
      next.statusBarStyle ?? 'auto',
      next.navigationBarStyle ?? 'auto'
    )
    native.setSystemBarHidden(
      next.statusBarHidden === true,
      next.navigationBarHidden === true
    )
  })
}

export function pushStackEntry(props: SystemBarsProps): SystemBarsEntry {
  const entry = createEntry(props)
  stack.push(entry)
  schedule()
  return entry
}

export function popStackEntry(entry: SystemBarsEntry): void {
  const i = stack.indexOf(entry)
  if (i !== -1) stack.splice(i, 1)
  schedule()
}

export function replaceStackEntry(
  entry: SystemBarsEntry,
  props: SystemBarsProps
): SystemBarsEntry {
  const next = createEntry(props)
  const i = stack.indexOf(entry)
  if (i !== -1) stack[i] = next
  else stack.push(next)
  schedule()
  return next
}

export function setSystemBarStyle(style: SystemBarStyle): void {
  pushStackEntry({ style })
}

export function setSystemBarHidden(hidden: boolean): void {
  pushStackEntry({ hidden })
}

// ═══════════════════════════════════════════════════════════════════════════
// src/index.ts — ядро без React.
// ═══════════════════════════════════════════════════════════════════════════

import './globals.js'

export type {
  EdgeInsets,
  Edge,
  SafeAreaMode,
  SafeAreaSnapshot,
  SystemBarStyle,
} from './types.js'
export { ZERO_INSETS } from './types.js'
export type { LynxEdgeToEdgeNative, SafeAreaWire } from './native.js'
export { setNativeModule } from './native.js'
export {
  SAFE_AREA_EVENT,
  GLOBAL_PROPS_KEY,
  getSafeAreaInsets,
  getSafeAreaSnapshot,
  getKeyboardHeight,
  subscribeSafeArea,
  refreshSafeArea,
  safeAreaCssVarString,
} from './core.js'
export type { SystemBarsEntry, SystemBarsProps } from './system-bars.js'
export {
  pushStackEntry,
  popStackEntry,
  replaceStackEntry,
  setSystemBarStyle,
  setSystemBarHidden,
} from './system-bars.js'

// ═══════════════════════════════════════════════════════════════════════════
// src/react/index.tsx — хуки и компоненты. Отдельная точка входа, чтобы
// ядро не тянуло @lynx-js/react (он optional peer).
// ═══════════════════════════════════════════════════════════════════════════

import type { ReactNode } from '@lynx-js/react'
import {
  useCallback,
  useEffect,
  useGlobalProps,
  useMemo,
  useState,
  useSyncExternalStore,
} from '@lynx-js/react'
import type { Edge, EdgeInsets, SafeAreaMode, SafeAreaSnapshot, SystemBarsProps } from '../index.js'
import {
  getSafeAreaSnapshot,
  safeAreaCssVarString,
  subscribeSafeArea,
} from '../core.js'
import { popStackEntry, pushStackEntry, replaceStackEntry } from '../system-bars.js'

/**
 * Читает globalProps через useGlobalProps (документировано: «If
 * lynx.__globalProps is changed, a re-render will be triggered automatically»)
 * И подписывается на нативное событие. Оба канала сходятся в core, который
 * дедуплицирует по generation, так что двойного ререндера не будет.
 */
export function useSafeAreaSnapshot(): SafeAreaSnapshot {
  useGlobalProps() // подписка на реактивный канал; значение читаем через core
  const subscribe = useCallback(
    (onChange: () => void) => subscribeSafeArea(() => onChange()),
    []
  )
  return useSyncExternalStore(subscribe, getSafeAreaSnapshot, getSafeAreaSnapshot)
}

export function useSafeAreaInsets(): EdgeInsets {
  return useSafeAreaSnapshot().insets
}

export function useKeyboardHeight(): number {
  return useSafeAreaSnapshot().keyboardHeight
}

export interface SafeAreaProviderProps {
  children?: ReactNode
  className?: string
}

/**
 * Один <view>, который вешает CSS-переменные. Всё поддерево может писать
 * padding-top: var(--safe-area-inset-top) — миграция с env() это чистый
 * поиск-замена. Переменные наследуются вниз по умолчанию (Lynx docs,
 * «CSS custom properties are inherited by default»), инлайн-объявление
 * поддерживается с Lynx 3.6.
 */
export function SafeAreaProvider(props: SafeAreaProviderProps) {
  const snapshot = useSafeAreaSnapshot()
  const style = useMemo(
    () => `${safeAreaCssVarString(snapshot)}flex:1;`,
    [snapshot.generation]
  )
  return (
    <view className={props.className} style={style}>
      {props.children}
    </view>
  )
}

export interface SafeAreaViewProps {
  children?: ReactNode
  className?: string
  style?: string
  /** По умолчанию все четыре. Горизонтальные важны: альбомный вырез и iPad. */
  edges?: readonly Edge[]
  /** 'padding' (по умолчанию) или 'margin'. */
  mode?: SafeAreaMode
  /** Добавлять ли высоту клавиатуры к нижнему инсету. По умолчанию нет — как в iOS. */
  avoidKeyboard?: boolean
}

const ALL_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left']

export function SafeAreaView(props: SafeAreaViewProps) {
  const { insets, keyboardHeight } = useSafeAreaSnapshot()
  const edges = props.edges ?? ALL_EDGES
  const prop = props.mode === 'margin' ? 'margin' : 'padding'
  const bottom =
    props.avoidKeyboard === true
      ? Math.max(insets.bottom, keyboardHeight)
      : insets.bottom
  let style = ''
  if (edges.includes('top')) style += `${prop}-top:${insets.top}px;`
  if (edges.includes('right')) style += `${prop}-right:${insets.right}px;`
  if (edges.includes('bottom')) style += `${prop}-bottom:${bottom}px;`
  if (edges.includes('left')) style += `${prop}-left:${insets.left}px;`
  return (
    <view className={props.className} style={style + (props.style ?? '')}>
      {props.children}
    </view>
  )
}

/** Компонент ничего не рендерит; вся работа — в стеке записей. */
export function SystemBars(props: SystemBarsProps) {
  const [entry] = useState(() => pushStackEntry(props))
  useEffect(() => {
    replaceStackEntry(entry, props)
  }, [props.style, props.hidden])
  useEffect(() => () => popStackEntry(entry), [])
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// src/testing/index.ts — фейк для юнит-тестов, как ./testing в crypto.
// ═══════════════════════════════════════════════════════════════════════════

import type { LynxEdgeToEdgeNative, SafeAreaWire } from '../native.js'

export function createFakeEdgeToEdge(
  initial: Partial<SafeAreaWire> = {}
): LynxEdgeToEdgeNative & { emit(next: Partial<SafeAreaWire>): void } {
  let wire: SafeAreaWire = {
    top: 47, right: 0, bottom: 34, left: 0,
    keyboardHeight: 0, generation: 1, edgeToEdge: true,
    ...initial,
  }
  return {
    getSnapshot: () => wire,
    refresh: (cb) => cb(wire),
    setSystemBarStyle: () => {},
    setSystemBarHidden: () => {},
    emit(next) {
      wire = { ...wire, ...next, generation: wire.generation + 1 }
    },
  }
}
```

## Android, Kotlin

```kotlin
// ═══════════════════════════════════════════════════════════════════════════
// android/src/main/AndroidManifest.xml
//
// Мержится AGP автоматически, правок в приложении не требует. Прецедент —
// androidx.startup.InitializationProvider. ТЕМУ здесь объявлять нельзя:
// приоритет мержа это variant > app > library, а конфликт атрибута даёт
// hard error с требованием tools:replace. Всё делаем в рантайме.
// ═══════════════════════════════════════════════════════════════════════════
/*
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          xmlns:tools="http://schemas.android.com/tools">
  <application>
    <provider
        android:name="dev.lynxlab.edgetoedge.EdgeToEdgeInitProvider"
        android:authorities="${applicationId}.lynx-edge-to-edge"
        android:exported="false"
        android:initOrder="200"
        tools:node="merge" />
  </application>
</manifest>
*/

// ═══════════════════════════════════════════════════════════════════════════
// android/consumer-rules.pro
// ═══════════════════════════════════════════════════════════════════════════
/*
-keep class dev.lynxlab.edgetoedge.EdgeToEdgeInitProvider { <init>(); }
-keep class dev.lynxlab.edgetoedge.LynxEdgeToEdgeModule { <init>(...); }
-keepclassmembers class dev.lynxlab.edgetoedge.LynxEdgeToEdgeModule {
    @com.lynx.jsbridge.LynxMethod <methods>;
}
-keep class dev.lynxlab.edgetoedge.LynxLibraryProviderImpl { *; }
*/

// ═══════════════════════════════════════════════════════════════════════════
// android/build.gradle.kts (дельта относительно шаблона crypto)
// ═══════════════════════════════════════════════════════════════════════════
/*
plugins {
  id("com.android.library")
  id("org.jetbrains.kotlin.android")
  // НЕ ОПЦИОНАЛЬНО: LynxLibraryBuildPlugin прокидывает -Alynx.library.packageName
  // только внутри plugins.withId('kotlin-kapt') и сам плагин не применяет.
  id("org.jetbrains.kotlin.kapt")
}
android {
  namespace = "dev.lynxlab.edgetoedge"
  compileSdk = 35
  defaultConfig {
    minSdk = 23
    consumerProguardFiles("consumer-rules.pro")
  }
}
dependencies {
  compileOnly("org.lynxsdk.lynx:lynx:4.0.1")
  compileOnly("androidx.annotation:annotation:1.9.1")
  kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")

  // implementation, не compileOnly: WindowCompat/WindowInsetsCompat нужны в
  // рантайме. 1.13.1 — minCompileSdk 34, потолок при compileSdk 34 у хоста
  // (1.15.0 требует 35). androidx.activity НЕ берём: appcompat 1.6.1 тянет
  // activity 1.6.0 без enableEdgeToEdge(), а 1.10.x требует compileSdk 35.
  // Ручной путь всё равно обязателен для не-ComponentActivity хостов.
  implementation("androidx.core:core:1.13.1")
}
*/

// ═══════════════════════════════════════════════════════════════════════════
// EdgeToEdgeInitProvider.kt
// Существует ровно ради одного: получить Application ДО Application.onCreate.
// Autolink сюда не годится — сгенерированный LynxLibraryProviderImpl умеет
// только registerModule/addBehaviors/registerService, а нативный модуль
// создаётся лениво на BTS, то есть уже после первого кадра.
// ═══════════════════════════════════════════════════════════════════════════
package dev.lynxlab.edgetoedge

import android.app.Application
import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.net.Uri

class EdgeToEdgeInitProvider : ContentProvider() {
  override fun onCreate(): Boolean {
    (context?.applicationContext as? Application)?.let(EdgeToEdge::install)
    return false
  }
  override fun query(u: Uri, p: Array<out String>?, s: String?, a: Array<out String>?, o: String?): Cursor? = null
  override fun getType(uri: Uri): String? = null
  override fun insert(uri: Uri, v: ContentValues?): Uri? = null
  override fun delete(uri: Uri, s: String?, a: Array<out String>?): Int = 0
  override fun update(uri: Uri, v: ContentValues?, s: String?, a: Array<out String>?): Int = 0
}

// ═══════════════════════════════════════════════════════════════════════════
// SafeAreaStore.kt — процесс-глобальный тёплый кеш + рассылка.
// ═══════════════════════════════════════════════════════════════════════════
package dev.lynxlab.edgetoedge

import com.lynx.react.bridge.JavaOnlyArray
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.LynxView
import com.lynx.tasm.behavior.LynxContext
import java.util.Collections
import java.util.WeakHashMap

data class Snapshot(
  val top: Float = 0f,
  val right: Float = 0f,
  val bottom: Float = 0f,
  val left: Float = 0f,
  val keyboardHeight: Float = 0f,
  val edgeToEdge: Boolean = false,
  val generation: Int = 0,
) {
  fun sameValues(other: Snapshot): Boolean =
    top == other.top && right == other.right && bottom == other.bottom &&
      left == other.left && keyboardHeight == other.keyboardHeight &&
      edgeToEdge == other.edgeToEdge

  fun toJavaOnlyMap(): JavaOnlyMap = JavaOnlyMap().apply {
    putDouble("top", top.toDouble())
    putDouble("right", right.toDouble())
    putDouble("bottom", bottom.toDouble())
    putDouble("left", left.toDouble())
    putDouble("keyboardHeight", keyboardHeight.toDouble())
    putDouble("generation", generation.toDouble())
    putBoolean("edgeToEdge", edgeToEdge)
  }

  fun toPlainMap(): Map<String, Any> = mapOf(
    "top" to top.toDouble(),
    "right" to right.toDouble(),
    "bottom" to bottom.toDouble(),
    "left" to left.toDouble(),
    "keyboardHeight" to keyboardHeight.toDouble(),
    "generation" to generation.toDouble(),
    "edgeToEdge" to edgeToEdge,
  )
}

object SafeAreaStore {

  const val GLOBAL_PROPS_KEY = "safeArea"
  const val EVENT_NAME = "safeareainsetschange"

  @Volatile
  var snapshot: Snapshot = Snapshot()
    private set

  // Слабые ссылки: LynxView умирает вместе с Activity при повороте.
  private val views: MutableSet<LynxView> =
    Collections.newSetFromMap(WeakHashMap<LynxView, Boolean>())
  private val contexts: MutableSet<LynxContext> =
    Collections.newSetFromMap(WeakHashMap<LynxContext, Boolean>())

  /** Вызывается с UI-потока (pre-draw) или из модуля. */
  @Synchronized
  fun registerView(view: LynxView) {
    if (views.add(view)) {
      // Догоняем новичка немедленно: если рантайм ещё не стартовал,
      // BTSRuntime::OnGlobalPropsUpdated положит это в init_global_props_
      // и значение приедет как ИНИЦИАЛЬНОЕ, а не как обновление.
      pushGlobalProps(view, snapshot)
    }
  }

  @Synchronized
  fun registerContext(context: LynxContext) {
    contexts.add(context)
    context.lynxView?.let(::registerView)
  }

  /** Только с UI-потока. Возвращает true, если значение изменилось. */
  @Synchronized
  fun publish(next: Snapshot): Boolean {
    val current = snapshot
    if (current.sameValues(next) && current.generation != 0) return false
    val stamped = next.copy(generation = current.generation + 1)
    snapshot = stamped
    for (view in views) pushGlobalProps(view, stamped)
    // Событие только для дельт: LynxContext.sendGlobalEvent молча дропает,
    // если GlobalEventEmitter ещё не поднят. Первое значение доставляет
    // globalProps и синхронный геттер, но не оно.
    val args = JavaOnlyArray().apply { pushMap(stamped.toJavaOnlyMap()) }
    for (ctx in contexts) {
      runCatching { ctx.sendGlobalEvent(EVENT_NAME, args) }
    }
    return true
  }

  private fun pushGlobalProps(view: LynxView, value: Snapshot) {
    // updateGlobalProps мержит по верхнему ключу, поэтому чужие globalProps
    // (Sparkling кладёт statusBarHeight, theme и прочее) не затираются.
    runCatching { view.updateGlobalProps(mapOf(GLOBAL_PROPS_KEY to value.toPlainMap())) }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EdgeToEdge.kt — включение окна + чтение инсетов.
// ═══════════════════════════════════════════════════════════════════════════
package dev.lynxlab.edgetoedge

import android.app.Activity
import android.app.Application
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.ViewTreeObserver
import android.view.WindowManager
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.lynx.tasm.LynxView
import java.util.WeakHashMap

object EdgeToEdge {

  // Скримы взяты 1-в-1 из androidx EdgeToEdge.kt / RN WindowUtil.kt —
  // обе реализации совпадают до констант.
  private const val LIGHT_NAV_SCRIM = 0xE6FFFFFF.toInt()
  private const val DARK_NAV_SCRIM = 0x801B1B1B.toInt()

  private var installed = false
  private val hooks = WeakHashMap<Activity, ViewTreeObserver.OnPreDrawListener>()
  private val scanBudget = WeakHashMap<Activity, Int>()

  @Volatile var statusBarHidden = false
  @Volatile var navigationBarHidden = false

  fun install(app: Application) {
    if (installed) return
    installed = true
    app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
      override fun onActivityCreated(a: Activity, s: Bundle?) = attach(a)
      // OEM-прошивки и сторонние библиотеки сбрасывают окно при возврате из
      // фона — zoontek ловил это в #45/#57/#66. Перенакатываем каждый resume.
      override fun onActivityResumed(a: Activity) {
        applyWindow(a); scanBudget[a] = 240
      }
      override fun onActivityDestroyed(a: Activity) = detach(a)
      override fun onActivityStarted(a: Activity) = Unit
      override fun onActivityPaused(a: Activity) = Unit
      override fun onActivityStopped(a: Activity) = Unit
      override fun onActivitySaveInstanceState(a: Activity, o: Bundle) = Unit
    })
  }

  /** Диспатчится Application'ом на UI-потоке сразу после Activity.onCreate. */
  fun attach(activity: Activity) {
    applyWindow(activity)

    val decor = activity.window.decorView
    // OnPreDrawListener, а не setOnApplyWindowInsetsListener: у View РОВНО ОДИН
    // слот слушателя, второй пакет молча выигрывает. У ViewTreeObserver — список.
    // Плюс getRootWindowInsets читает оконные, непотреблённые инсеты: subDecor
    // AppCompat (FitWindowsLinearLayout, fitsSystemWindows=true) в не-edge-to-edge
    // режиме съедает инсеты, и слушатель на LynxView не сработал бы вовсе.
    val hook = ViewTreeObserver.OnPreDrawListener { onPreDraw(activity); true }
    decor.viewTreeObserver.addOnPreDrawListener(hook)
    hooks[activity] = hook
    scanBudget[activity] = 240
    onPreDraw(activity)
  }

  private fun detach(activity: Activity) {
    hooks.remove(activity)?.let { hook ->
      activity.window.decorView.viewTreeObserver
        .takeIf { it.isAlive }?.removeOnPreDrawListener(hook)
    }
    scanBudget.remove(activity)
  }

  /**
   * targetSdk <= 34: это и есть продукт.
   * targetSdk >= 35: PhoneWindow.setDecorFitsSystemWindows открывается строкой
   *   `if (mEdgeToEdgeEnforced) { return; }`, mStatusBarColor уже TRANSPARENT.
   *   Все вызовы ниже вырождаются в безвредный no-op. Ветвления не нужно —
   *   гоняем безусловно. android:windowOptOutEdgeToEdgeEnforcement НЕ шипим:
   *   на targetSdk 36 он отключён через DISABLE_OPT_OUT_EDGE_TO_EDGE.
   */
  fun applyWindow(activity: Activity) {
    val window = activity.window ?: return
    // Порядок как в androidx EdgeToEdge.kt.
    WindowCompat.setDecorFitsSystemWindows(window, false)

    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT

    val nightMode = (activity.resources.configuration.uiMode and
      android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
      android.content.res.Configuration.UI_MODE_NIGHT_YES

    @Suppress("DEPRECATION")
    window.navigationBarColor = when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> Color.TRANSPARENT
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 && !nightMode -> LIGHT_NAV_SCRIM
      else -> DARK_NAV_SCRIM
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      window.isStatusBarContrastEnforced = false
      // Контраст нав-бара НЕ трогаем: полупрозрачный скрим под трёхкнопочной
      // навигацией это документированный дефолт Android 15, а не баг.
    }

    // ЕДИНСТВЕННОЕ, чего нет в голом setDecorFitsSystemWindows(false), и что
    // реально чинит альбомную ориентацию с вырезом: без этого режим остаётся
    // DEFAULT и окно летербоксится от выреза.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      window.attributes = window.attributes.apply {
        layoutInDisplayCutoutMode =
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
          else
            WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
      }
    }
    applyBars(activity)
  }

  /** Иконки баров и их видимость. Под enforcement на 35+ ЭТО продолжает работать. */
  fun applyBars(activity: Activity, statusLight: Boolean? = null, navLight: Boolean? = null) {
    val window = activity.window ?: return
    // Контроллер конструируем заново каждый раз и перенакатываем hidden:
    // свежий WindowInsetsControllerCompat теряет состояние скрытия (issue #66).
    val c = WindowInsetsControllerCompat(window, window.decorView)
    c.systemBarsBehavior =
      WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    statusLight?.let { c.isAppearanceLightStatusBars = it }
    navLight?.let { c.isAppearanceLightNavigationBars = it }
    if (statusBarHidden) c.hide(WindowInsetsCompat.Type.statusBars())
    else c.show(WindowInsetsCompat.Type.statusBars())
    if (navigationBarHidden) c.hide(WindowInsetsCompat.Type.navigationBars())
    else c.show(WindowInsetsCompat.Type.navigationBars())
  }

  private fun onPreDraw(activity: Activity) {
    val decor = activity.window?.decorView ?: return
    val insets = ViewCompat.getRootWindowInsets(decor) ?: return
    val density = activity.resources.displayMetrics.density

    // systemBars() = STATUS_BARS | NAVIGATION_BARS | CAPTION_BAR | SYSTEM_OVERLAYS,
    // и в javadoc прямо сказано «but not ime()». displayCutout нужен потому,
    // что при LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS в альбомной вырез сбоку,
    // где никакого системного бара нет. navigationBars() уже внутри systemBars().
    // tappableElement() ЗАПРЕЩЁН: SystemUI ставит его в Insets.NONE при
    // config_navBarTapThrough (жестовый оверлей всегда его выставляет), то есть
    // 0 ровно там, где iOS отдаёт 34pt home indicator.
    val bars = insets.getInsets(
      WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
    )

    // ime() отдаём ОТДЕЛЬНЫМ полем — iOS safeAreaInsets клавиатуру не включает.
    // Ниже API 30 WindowInsetsCompat эмулирует ime() сравнением с stableInset,
    // а под edge-to-edge окно перестало ресайзиться, и эмуляция врёт. Значит 0.
    val ime = if (Build.VERSION.SDK_INT >= 30)
      insets.getInsets(WindowInsetsCompat.Type.ime()).bottom else 0

    val changed = SafeAreaStore.publish(
      Snapshot(
        top = bars.top / density,
        right = bars.right / density,
        bottom = bars.bottom / density,
        left = bars.left / density,
        keyboardHeight = ime / density,
        edgeToEdge = true,
      )
    )

    // Ищем LynxView только когда есть смысл: значение изменилось, либо мы ещё
    // в бюджете холодного старта. Иначе обход дерева каждый кадр навсегда.
    val budget = scanBudget[activity] ?: 0
    if (changed || budget > 0) {
      if (budget > 0) scanBudget[activity] = budget - 1
      collectLynxViews(decor)
    }
  }

  private fun collectLynxViews(root: View) {
    if (root is LynxView) { SafeAreaStore.registerView(root); return }
    if (root is ViewGroup) {
      for (i in 0 until root.childCount) collectLynxViews(root.getChildAt(i))
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LynxEdgeToEdgeModule.kt — только читатель кеша и командный канал.
// Окно из модуля НЕ трогаем напрямую без хопа: @LynxMethod объявлен как
// `public @interface LynxMethod {}` (ни одного параметра, никакого runOnUIThread),
// методы исполняются инлайн на JS-потоке, а setDecorFitsSystemWindows уходит в
// ViewRootImpl.requestFitSystemWindows(), первая строка которого — checkThread().
// ═══════════════════════════════════════════════════════════════════════════
package dev.lynxlab.edgetoedge

import com.lynx.jsbridge.LynxContextModule
import com.lynx.jsbridge.LynxMethod
import com.lynx.jsbridge.LynxNativeModule
import com.lynx.react.bridge.Callback
import com.lynx.react.bridge.JavaOnlyMap
import com.lynx.tasm.behavior.LynxContext
import com.lynx.tasm.utils.ContextUtils
import com.lynx.tasm.utils.UIThreadUtils
import androidx.core.view.ViewCompat

/**
 * Конструктор (LynxContext) обязателен и поддержан: CommonModuleCreator
 * проверяет LynxContextModule.class.isAssignableFrom(moduleClass), требует,
 * чтобы контекст был LynxContext («... must be created with LynxContext»),
 * и зовёт Constructor.newInstance на ctor с параметром LynxContext.
 * Проверено по байткоду lynx-4.0.1.aar.
 *
 * Ручная регистрация, если хост без autolink:
 *   LynxEnv.inst().registerModule("LynxEdgeToEdgeModule", LynxEdgeToEdgeModule::class.java)
 */
@LynxNativeModule(name = "LynxEdgeToEdgeModule")
class LynxEdgeToEdgeModule(context: LynxContext) : LynxContextModule(context) {

  init {
    // Покрывает brownfield-хост, где ContentProvider не отработал: LynxView
    // регистрируется сам, и globalProps начинают приезжать хотя бы отсюда.
    SafeAreaStore.registerContext(context)
  }

  /**
   * Синхронный, потому что читает кеш, прогретый ContentProvider'ом ещё до
   * Application.onCreate — окно не трогается, на UI-поток идти не надо.
   * Иначе синхронность недостижима: runOnUiThreadSync есть только на lynx main,
   * в AAR 4.0.1 его нет. Возврат JavaOnlyMap — в whitelist LynxMethodWrapper.
   */
  @LynxMethod
  fun getSnapshot(): JavaOnlyMap = SafeAreaStore.snapshot.toJavaOnlyMap()

  /** Холодный путь. Callback, а не возврат: блокирующего хопа не существует. */
  @LynxMethod
  fun refresh(callback: Callback) {
    // Activity НИКОГДА не кешировать: LynxUIRenderer.attachBodyView зовёт
    // lynxContext.setBaseContext(context), а LynxContext это MutableContextWrapper,
    // у которого база переуказывается при переattach. Перерешаем каждый раз.
    val activity = ContextUtils.getActivity(mLynxContext)
    if (activity == null) {
      callback.invoke(SafeAreaStore.snapshot.toJavaOnlyMap())
      return
    }
    UIThreadUtils.runOnUiThread {
      EdgeToEdge.applyWindow(activity)
      ViewCompat.requestApplyInsets(activity.window.decorView) // тут живёт checkThread()
      callback.invoke(SafeAreaStore.snapshot.toJavaOnlyMap())
    }
  }

  /** style: "auto" | "inverted" | "light" | "dark". Строки, не enum. */
  @LynxMethod
  fun setSystemBarStyle(statusBar: String, navigationBar: String) {
    val activity = ContextUtils.getActivity(mLynxContext) ?: return
    UIThreadUtils.runOnUiThread {
      val night = (activity.resources.configuration.uiMode and
        android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
        android.content.res.Configuration.UI_MODE_NIGHT_YES
      // isAppearanceLight*Bars == true означает ТЁМНЫЕ иконки на светлом баре.
      fun resolve(style: String): Boolean = when (style) {
        "light" -> false          // светлое содержимое → светлые иконки
        "dark" -> true
        "inverted" -> !night
        else -> night             // "auto"
      }
      EdgeToEdge.applyBars(activity, resolve(statusBar), resolve(navigationBar))
    }
  }

  @LynxMethod
  fun setSystemBarHidden(statusBar: Boolean, navigationBar: Boolean) {
    val activity = ContextUtils.getActivity(mLynxContext) ?: return
    UIThreadUtils.runOnUiThread {
      EdgeToEdge.statusBarHidden = statusBar
      EdgeToEdge.navigationBarHidden = navigationBar
      EdgeToEdge.applyBars(activity)
    }
  }
}
```

## iOS, Objective-C

```objc
// ═══════════════════════════════════════════════════════════════════════════
// ios/LynxEdgeToEdge.podspec — копия crypto с заменёнными полями.
// s.dependency "Lynx" БЕЗ ограничения версии: любой пин ломает резолв —
// шаблон Sparkling пинит 3.6.0, а поды Lynx 4.x на CocoaPods не резолвятся
// из-за конфликта LynxServiceAPI. Зависимость нужна только ради header
// search paths, иначе <Lynx/LynxContextModule.h> не находится.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ios/src/LEESafeAreaStore.h
// ═══════════════════════════════════════════════════════════════════════════
#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

typedef struct {
  CGFloat top, right, bottom, left;
  CGFloat keyboardHeight;
  NSInteger generation;
} LEESnapshot;

/**
 * Процесс-глобальный тёплый кеш. Аналог Android-провайдера: греется из +load,
 * ещё до того как появится хоть один LynxView, чтобы синхронный getSnapshot
 * не отдавал нули на холодном старте.
 */
@interface LEESafeAreaStore : NSObject

@property(class, readonly) LEESnapshot snapshot;

+ (NSDictionary<NSString *, id> *)snapshotDictionary;

/** Только с главной очереди. Публикует, если значения изменились. */
+ (void)publishInsets:(UIEdgeInsets)insets keyboardHeight:(CGFloat)keyboard;

/** LynxView регистрирует себя, чтобы получать updateGlobalPropsWithDictionary:. */
+ (void)registerLynxView:(UIView *)lynxView;
+ (void)registerContext:(id)lynxContext;

@end

NS_ASSUME_NONNULL_END

// ═══════════════════════════════════════════════════════════════════════════
// ios/src/LEESafeAreaStore.m
// ═══════════════════════════════════════════════════════════════════════════
#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxView.h>

static LEESnapshot gSnapshot = {0, 0, 0, 0, 0, 0};
static NSHashTable<UIView *> *gViews = nil;
static NSHashTable *gContexts = nil;
static os_unfair_lock gLock = OS_UNFAIR_LOCK_INIT;

@implementation LEESafeAreaStore

/**
 * +load выполняется при загрузке образа, задолго до первого LynxView.
 * Здесь мы поднимаем ОКОННЫЙ уровень точности: keyWindow.safeAreaInsets.
 * Точный, повью-шный уровень включится позже, когда появится модуль и мы
 * вставим LEESafeAreaObserverView в сам LynxView.
 */
+ (void)load {
  gViews = [NSHashTable weakObjectsHashTable];
  gContexts = [NSHashTable weakObjectsHashTable];
  NSNotificationCenter *nc = NSNotificationCenter.defaultCenter;
  // Одного safeAreaInsetsDidChange мало — react-native-safe-area-context
  // в проде слушает весь этот набор, потому что отдельные случаи он не ловит.
  for (NSNotificationName name in @[
         UIApplicationDidBecomeActiveNotification,
         UIWindowDidBecomeVisibleNotification,
         UIKeyboardDidShowNotification,
         UIKeyboardDidHideNotification,
         UIKeyboardDidChangeFrameNotification,
       ]) {
    [nc addObserver:self selector:@selector(lee_resync:) name:name object:nil];
  }
}

+ (void)lee_resync:(NSNotification *)note {
  if (!NSThread.isMainThread) {
    dispatch_async(dispatch_get_main_queue(), ^{ [self lee_resync:note]; });
    return;
  }
  UIWindow *window = nil;
  for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
    if (![scene isKindOfClass:UIWindowScene.class]) continue;
    for (UIWindow *w in ((UIWindowScene *)scene).windows) {
      if (w.isKeyWindow) { window = w; break; }
    }
    if (window) break;
  }
  if (!window) return;

  CGFloat keyboard = 0;
  NSValue *frameValue = note.userInfo[UIKeyboardFrameEndUserInfoKey];
  if (frameValue) {
    CGRect frame = [window convertRect:frameValue.CGRectValue fromWindow:nil];
    CGFloat overlap = CGRectGetMaxY(window.bounds) - CGRectGetMinY(frame);
    keyboard = MAX(0, MIN(overlap, CGRectGetHeight(window.bounds)));
    if ([note.name isEqualToString:UIKeyboardDidHideNotification]) keyboard = 0;
  } else {
    keyboard = gSnapshot.keyboardHeight;
  }
  [self publishInsets:window.safeAreaInsets keyboardHeight:keyboard];
}

+ (LEESnapshot)snapshot {
  os_unfair_lock_lock(&gLock);
  LEESnapshot copy = gSnapshot;
  os_unfair_lock_unlock(&gLock);
  return copy;
}

+ (NSDictionary<NSString *, id> *)snapshotDictionary {
  LEESnapshot s = [self snapshot];
  return @{
    @"top" : @(s.top),
    @"right" : @(s.right),
    @"bottom" : @(s.bottom),
    @"left" : @(s.left),
    @"keyboardHeight" : @(s.keyboardHeight),
    @"generation" : @(s.generation),
    // На iOS контейнер Sparkling пинит LynxView к сырому view контроллера
    // (make.left.right.bottom.equalTo(self.view)), а схема шаблона несёт
    // hide_status_bar=1, поэтому topOffset == 0. Окно всегда edge-to-edge.
    @"edgeToEdge" : @YES,
  };
}

+ (void)publishInsets:(UIEdgeInsets)insets keyboardHeight:(CGFloat)keyboard {
  NSCAssert(NSThread.isMainThread, @"publishInsets только с главной очереди");
  os_unfair_lock_lock(&gLock);
  BOOL same = gSnapshot.top == insets.top && gSnapshot.right == insets.right &&
              gSnapshot.bottom == insets.bottom && gSnapshot.left == insets.left &&
              gSnapshot.keyboardHeight == keyboard;
  if (same && gSnapshot.generation != 0) {
    os_unfair_lock_unlock(&gLock);
    return;
  }
  gSnapshot = (LEESnapshot){insets.top, insets.right, insets.bottom, insets.left,
                            keyboard, gSnapshot.generation + 1};
  os_unfair_lock_unlock(&gLock);

  NSDictionary *dict = [self snapshotDictionary];
  for (UIView *view in gViews.allObjects) {
    if ([view isKindOfClass:LynxView.class]) {
      // Публичен на LynxView начиная с 3.6.0 — проверено на 3.6.0/3.9.0/4.0.0.
      // Мержит по верхнему ключу, чужие globalProps не затираются.
      [(LynxView *)view updateGlobalPropsWithDictionary:@{@"safeArea" : dict}];
    }
  }
  for (id ctx in gContexts.allObjects) {
    // Только дельты: sendGlobalEvent до готовности рантайма дропается.
    [(LynxContext *)ctx sendGlobalEvent:@"safeareainsetschange" withParams:@[ dict ]];
  }
}

+ (void)registerLynxView:(UIView *)lynxView {
  if (!lynxView) return;
  [gViews addObject:lynxView];
  if ([lynxView isKindOfClass:LynxView.class]) {
    [(LynxView *)lynxView
        updateGlobalPropsWithDictionary:@{@"safeArea" : [self snapshotDictionary]}];
  }
}

+ (void)registerContext:(id)lynxContext {
  if (lynxContext) [gContexts addObject:lynxContext];
}

@end

// ═══════════════════════════════════════════════════════════════════════════
// ios/src/LynxEdgeToEdgeModule.h
// ═══════════════════════════════════════════════════════════════════════════
#import <Foundation/Foundation.h>
#import <Lynx/LynxContextModule.h>
#import <Lynx/LynxModule.h>

// Макрос появился только в Lynx 4.x. На 3.x `@LynxNativeModule("...")` это
// `@` плюс неизвестный идентификатор → ошибка компиляции. Объявляем сами тем
// же самым, чем Lynx 4.x: раскрывается в @class-forward и нужен исключительно
// затем, чтобы регулярка гема cocoapods-lynx-library нашла маркер.
#ifndef LynxNativeModule
#define LynxNativeModule(module_name) class LynxNativeModuleMarker;
#endif

NS_ASSUME_NONNULL_BEGIN

// Маркер обязан стоять НЕПОСРЕДСТВЕННО перед @interface: регулярка гема
// допускает между ними только пробельные символы, комментарий её ломает.
@LynxNativeModule("LynxEdgeToEdgeModule")
@interface LynxEdgeToEdgeModule : NSObject <LynxContextModule>
@end

NS_ASSUME_NONNULL_END

// ═══════════════════════════════════════════════════════════════════════════
// ios/src/LynxEdgeToEdgeModule.m
// ═══════════════════════════════════════════════════════════════════════════
#import "LynxEdgeToEdgeModule.h"
#import "LEESafeAreaStore.h"
#import <Lynx/LynxContext.h>
#import <Lynx/LynxView.h>

#pragma mark - Наблюдатель

/**
 * Невидимая вьюха на весь LynxView. Именно она чинит одноразовый снимок
 * LynxEnv::setKeyWindowAndStatusBar (вызывается ровно раз из initLayoutConfig,
 * без наблюдателя за поворотом, split view и Dynamic Island) — это и есть
 * lynx-family/lynx issue #299, открытый с марта 2025.
 *
 * Она pinned к bounds родителя через autoresizingMask, поэтому её
 * safeAreaInsets равны safeAreaInsets самого LynxView.
 */
@interface LEESafeAreaObserverView : UIView
@end

@implementation LEESafeAreaObserverView

- (instancetype)initWithFrame:(CGRect)frame {
  if (self = [super initWithFrame:frame]) {
    self.userInteractionEnabled = NO;
    self.hidden = NO;              // hidden=YES отключает обновление safe area
    self.alpha = 0.0;
    self.backgroundColor = UIColor.clearColor;
    self.autoresizingMask =
        UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
  }
  return self;
}

- (void)lee_publish {
  LEESnapshot current = LEESafeAreaStore.snapshot;
  [LEESafeAreaStore publishInsets:self.safeAreaInsets
                   keyboardHeight:current.keyboardHeight];
}

- (void)safeAreaInsetsDidChange {
  [super safeAreaInsetsDidChange];
  [self lee_publish];             // поворот, split view, Dynamic Island
}

- (void)layoutSubviews {
  [super layoutSubviews];
  [self lee_publish];             // одного safeAreaInsetsDidChange не хватает
}

- (void)didMoveToWindow {
  [super didMoveToWindow];
  if (self.window) [self lee_publish];
}

@end

#pragma mark - Модуль

@implementation LynxEdgeToEdgeModule {
  __weak LynxContext *_context;
}

// name и methodLookup — классовые свойства протокола LynxModule. Строки
// сигнатуры на iOS не существует: диспетчеризация это рефлексия
// NSMethodSignature по этим селекторам.
+ (NSString *)name {
  return @"LynxEdgeToEdgeModule";
}

+ (NSDictionary<NSString *, NSString *> *)methodLookup {
  return @{
    @"getSnapshot" : NSStringFromSelector(@selector(getSnapshot)),
    @"refresh" : NSStringFromSelector(@selector(refresh:)),
    @"setSystemBarStyle" : NSStringFromSelector(@selector(setSystemBarStyle:navigationBar:)),
    @"setSystemBarHidden" : NSStringFromSelector(@selector(setSystemBarHidden:navigationBar:)),
  };
}

- (instancetype)initWithLynxContext:(LynxContext *)context {
  if (self = [super init]) {
    _context = context;
    [LEESafeAreaStore registerContext:context];
    // Модуль создаётся на JS-потоке — к UIKit только через главную очередь.
    dispatch_async(dispatch_get_main_queue(), ^{
      [self lee_attach];
    });
  }
  return self;
}

- (instancetype)initWithLynxContext:(LynxContext *)context WithParam:(id)param {
  return [self initWithLynxContext:context];
}

- (void)lee_attach {
  // getLynxView публичен на LynxContext начиная с 3.6.0 — проверено на
  // 3.6.0 / 3.9.0 / 4.0.0.
  LynxView *lynxView = [_context getLynxView];
  if (!lynxView) return;
  [LEESafeAreaStore registerLynxView:lynxView];

  for (UIView *sub in lynxView.subviews) {
    if ([sub isKindOfClass:LEESafeAreaObserverView.class]) return;  // уже стоит
  }
  LEESafeAreaObserverView *observer =
      [[LEESafeAreaObserverView alloc] initWithFrame:lynxView.bounds];
  [lynxView addSubview:observer];
  [lynxView sendSubviewToBack:observer];
  [observer lee_publish];
}

#pragma mark - Мостовые методы

/** Синхронно, без хопа: читает тёплый кеш, прогретый из +load. */
- (NSDictionary *)getSnapshot {
  return [LEESafeAreaStore snapshotDictionary];
}

- (void)refresh:(LynxCallbackBlock)callback {
  dispatch_async(dispatch_get_main_queue(), ^{
    [self lee_attach];
    callback([LEESafeAreaStore snapshotDictionary]);
  });
}

/**
 * v1: НА iOS ЭТО NO-OP, и это осознанный отказ, а не забывчивость.
 *
 * Публичный путь к стилю статус-бара это preferredStatusBarStyle /
 * prefersStatusBarHidden на UIViewController, что требует ключа
 * UIViewControllerBasedStatusBarAppearance и переопределения методов на
 * контроллере, которым мы не владеем (пришлось бы свизлить SPKViewController).
 * Непубличный путь — [UIApplication.sharedApplication setValue:forKey:@"statusBarStyle"],
 * то самое KVC, которым пользуется tamer-system-ui: это риск отказа ревью
 * App Store, и мы туда не идём.
 *
 * Ждём v1.1 и ручного шага в Info.plist. Врать про паритет здесь нельзя.
 */
- (void)setSystemBarStyle:(NSString *)statusBar navigationBar:(NSString *)navigationBar {
  // Намеренно пусто. См. README § iOS system bars.
}

- (void)setSystemBarHidden:(BOOL)statusBar navigationBar:(BOOL)navigationBar {
  // Намеренно пусто. То же обоснование.
}

@end
```

## Риски

- **ЗАКРЫТ 2026-09-05, см. «Результат спайка дня 1»: буферизация подтверждена, но пуш переехал с pre-draw на `onActivityPostStarted`.** Было: ПЕРВЫЙ ПО ВАЖНОСТИ, НЕ ПРОВЕРЕНО НА УСТРОЙСТВЕ: успевает ли первый pre-draw вызвать updateGlobalProps раньше, чем стартует рантайм и отработает LoadApp. Вся история про «правильные инсеты на первом кадре» держится на буферизации BTSRuntime::OnGlobalPropsUpdated в init_global_props_. Если не успевает — будет один кадр с нулями, и понадобится второй механизм. Это день 1 плана, не день 8.
- **ЗАКРЫТ 2026-09-05 на эмуляторе: провайдер из library-модуля смержился и пережил R8 в release.** Было: ContentProvider внутри сборки Sparkling под R8 не проверен. Шаблон релизится с isMinifyEnabled/isShrinkResources true, initOrder относительно других autolink-пакетов не наблюдался, merged manifest report не читался. consumer-rules.pro с keep на провайдер написан по рассуждению, а не по факту падения.
- Обход дерева вьюх в поисках LynxView каждый кадр — бюджет 240 кадров на attach/resume, дальше только при изменении. На глубоком дереве это заметный расход на холодном старте. Не профилировалось.
- Ленивое создание модуля на BTS означает, что sendGlobalEvent и registerContext появляются только после первого обращения JS к NativeModules. До этого работает лишь канал globalProps. На brownfield-хосте без ContentProvider первый инсет придёт только после первого вызова getSnapshot().
- setDecorFitsSystemWindows(false) отключает SOFT_INPUT_ADJUST_RESIZE — это в javadoc самого Window, и это старейшая незакрытая жалоба в трекере zoontek (открыта с 2022, баг Google, ответ RN — отдать проблему в react-native-keyboard-controller на 100+ kB). У Lynx такой библиотеки нет. Мы отдаём ime() и говорим в README, что избегание клавиатуры становится задачей приложения. Это не починка.
- Второй порядок того же: KeyboardMonitor Lynx меряет клавиатуру скрытым Dialog с SOFT_INPUT_ADJUST_RESIZE, а isEdgeToEdgeEnforced не проверяет mIsFloating и завязан на ApplicationInfo.targetSdkVersion. Значит на targetSdk 35+ штатный keyboardstatuschanged Lynx, похоже, сломан независимо от нашего пакета. Выведено из исходников, на Pixel не проверено — а проверить надо до написания README.
- Что isAppearanceLightStatusBars / isAppearanceLightNavigationBars переживают enforcement на API 35, выведено из отсутствия их в списке deprecated-and-disabled, а не из положительного утверждения в доках. Нужен прогон на Pixel с targetSdk 36.
- iOS: чему равен window.safeAreaInsets.top при prefersStatusBarHidden == YES на телефоне с вырезом, я не проверил. Шаблон Sparkling одновременно прячет статус-бар и читает оконные инсеты. Если UIKit отдаёт 0, то +load-прогрев на iOS даёт нули, и до появления observer view верхняя защита отсутствует. Именно поэтому observer view на LynxView, а не оконный кеш, объявлен точным уровнем.
- androidx.core как implementation в сабпроекте чужой сборки: 1.13.1 требует minCompileSdk 34, шаблон на 34 — сходится. Но Gradle возьмёт максимум из версии хоста и нашей, а поведение AGP 7.4.2 при compileSdk 35 у библиотеки и 34 у приложения не подтверждено как официально поддерживаемое (у Ильи это работает в crypto, но проверки aar-metadata там не было).
- Порядок регистрации observer view на iOS: если хост создаёт несколько LynxView, каждый получит свой observer, но LEESafeAreaStore хранит ОДИН процесс-глобальный снимок. Для нескольких LynxView с разными инсетами (Stage Manager, split view на iPad) это неверно. На Android то же ограничение. Архитектурно globalProps позволяет per-view значения — код v1 их не использует. Осознанный долг, зафиксировать в README.

## План по дням

- День 1 — **сделан 2026-09-05 (S6), ответ «да, но с `onActivityPostStarted`».** Снять главный риск ДО написания пакета. Форк шаблона Sparkling, ContentProvider-заглушка, логирующая timestamp Application.onCreate, первого pre-draw и первого updateGlobalProps, плюс лог из JS о том, чему равен lynx.__globalProps.safeArea на самом первом рендере. Прогон на Pixel 9. Ответ на вопрос «успевает ли пуш стать init_global_props_» определяет, останется ли архитектура такой. Заодно проверить, что провайдер вообще смержился и пережил R8 в release-сборке.
- День 2 — **сделан 2026-09-05.** Скелет пакета по шаблону lynx-crypto: package.json с тремя exports, lynx.lib.json, tsconfig, biome, vitest, semantic-release, consumer-rules.pro. types.ts, native.ts (шов setNativeModule), testing/create-fake. Юнит-тесты на fromWire/adopt/дедупликацию по generation — они не требуют устройства и написать их сейчас дешевле всего.
- День 3 — **включение сделано и проверено 2026-09-05, вырез в альбомной проверен: `left=65.9`, окно не летербоксится.** Android, включение. EdgeToEdgeInitProvider, EdgeToEdge.install/attach/applyWindow/applyBars. Проверка на Pixel 9 при targetSdk 34: контент уезжает под бары, бары прозрачные, вырез в альбомной не летербоксит (это тест на layoutInDisplayCutoutMode). Затем бамп шаблона на targetSdk 36 и проверка, что при enforcement ничего не сломалось и вызовы выродились в no-op.
- День 4 — **доставка сделана и проверена 2026-09-05, жестовая против трёхкнопочной проверена.** Android, чтение и доставка. SafeAreaStore, OnPreDrawListener, systemBars()|displayCutout(), ime() на API 30+, поиск LynxView с бюджетом кадров, updateGlobalProps + sendGlobalEvent + generation. Тест: числа совпадают с тем, что показывает эталонное RN-приложение с react-native-safe-area-context на том же устройстве. Отдельно проверить жестовую навигацию против трёхкнопочной — это место, где ломается шаблон Sparkling.
- День 5 — **сделан 2026-09-10 на эмуляторе: все четыре метода модуля и клавиатура проверены. На Pixel 9 повторить.** Android, модуль и бары. LynxEdgeToEdgeModule на LynxContextModule, getSnapshot/refresh/setSystemBarStyle/setSystemBarHidden, хопы через UIThreadUtils.runOnUiThread. Тест поворота (Activity пересоздаётся, configChanges не объявлены — значит проверяем, что переattach отрабатывает), split-screen, фон/передний план (не сбросил ли OEM окно).
- День 6 — **сделан 2026-09-10 на симуляторе: первый кадр, поворот, регистрация. Модуль тапом не проверен.** iOS. LEESafeAreaStore с +load, LEESafeAreaObserverView, LynxEdgeToEdgeModule. Podspec копируется с crypto. Прогон на iPhone 11: поворот, split view, Dynamic Island на симуляторе 15 Pro, клавиатура. Главная проверка — что инсеты ОБНОВЛЯЮТСЯ при повороте, потому что именно этого нет ни в Lynx, ни у кого в экосистеме.
- День 7 — **JS-слой написан и проверен на Android 2026-09-05 (T36 закрыл вопрос формата поставки).** JS-слой целиком. core.ts, system-bars.ts, react/index.tsx, globals.ts с declaration merging в GlobalProps. Прогон обеих платформ на одном экране, сверка чисел один в один. Проверка порядка чтения: с globalProps, без него, на MTS (там NativeModules нет и предупреждение обязано быть внятным).
- День 8 — CSS-переменные и миграционная история. Демо-экран, где верстка написана через var(--safe-area-inset-top) и ничего больше, доказательство, что переменные наследуются вниз и обновляются на повороте. Плюс демо с клавиатурой на avoidKeyboard, чтобы честно понять, что мы отдаём вместо сломанного adjustResize.
- День 9 — README (EN + RU, как в crypto), включая раздел с прямым текстом о трёх вещах: iOS system bars в v1 нет и почему, клавиатурное избегание становится задачей приложения и почему, один процесс-глобальный снимок на несколько LynxView. Диагностические сообщения об ошибках с точными командами adb logcat, как в crypto. Первая публикация под 0.1.0 с пометкой, что API может двигаться.
- День 10 (буфер, скорее всего понадобится) — то, что вылезет на устройстве: поведение R8, порядок initOrder провайдеров, повторный attach observer view, гонки при быстром повороте. Если день 1 показал, что пуш НЕ успевает до LoadApp — этот день уходит на второй механизм холодного старта, а не на полировку.

## Оценка

9-10 рабочих дней до публикуемой 0.1.0 для одного человека, у которого уже есть отлаженный шаблон пакета (@lynx-lab/crypto), Pixel 9 и iPhone 11 под рукой, и который уже прошёл через все грабли autolink — kapt как обязательный плагин, маркер @LynxNativeModule под #ifndef, podspec без пина версии Lynx.

Распределение непривычное и его стоит понимать заранее. Android это примерно 55% работы, iOS около 20%, JS около 25%. На iOS значения уже существуют в UIKit, и вся задача — доставлять их вовремя. На Android нет ничего: ни включения edge-to-edge (LynxView это голый FrameLayout, наследник UIBody.UIBodyView, без fitsSystemWindows и без единого сеттера инсетов на LynxViewBuilder), ни производителя инсетов (поиск safe.?area по всему platform/android даёт ноль), ни способа дотянуться до Activity раньше первого кадра штатными средствами autolink.

Самый большой источник неопределённости не в коде, а в одном непроверенном факте — успевает ли ранний updateGlobalProps стать init_global_props_. Поэтому день 1 отдан ему целиком, до написания собственно пакета. Если ответ «нет», архитектура доставки меняется, и узнать это на десятый день вместо первого стоит примерно неделю.

Дальше, вне этой оценки, лежит апстрим-трек: реализовать Android write path и заменить `// TODO` на dynamic_css_styles_manager.cc:208 флагом kUpdateSafeArea. Это правильно чинит #299 для всех и даёт репутацию в экосистеме, но зависеть от него пакет не может — пользователи запускают уже собранные бинари Lynx. Отдельный медленный трек, не часть v1."
