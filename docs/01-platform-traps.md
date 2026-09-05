---
verified: 2026-09-05
lynx_version: 4.0.1
sparkling_version: 2.1.0-rc.36
status: spec
---

# Ловушки платформы

Читать перед любой строкой нативного кода. Каждая выглядит как рабочий код
и молча не работает. Пространство ID `T` общее для всех пакетов: если ловушка вскрылась
в одном пакете, она поднимается сюда.

## Реестр

### T1 · `import { NativeModules } from '@lynx-js/types'` не резолвится

**Статус: открыт (обходится) · Severity: Блокер**

В тарболе `@lynx-js/types@4.1.0` **нет ни одного `.js`**. Карта `exports` содержит только
условие `"types"` (`{".": {"types": "./types/index.d.ts"}}`), и `main` тоже указывает на
`.d.ts`. Плюс `NativeModules` вообще не экспорт: он объявлен как
`declare global { var NativeModules: INativeModules }` в `types/common/global.d.ts`.

Импорт падает дважды: нет рантайм-условия для резолва и нет именованного экспорта.
Под rsbuild/rspeedy это ошибка сборки; снисходительный бандлер даст `undefined`,
и каждый вызов будет падать.

**Правильно:**
```ts
declare const NativeModules: Record<string, any> | undefined

const m = typeof NativeModules === 'undefined' ? undefined : NativeModules.LynxPermissions
```

Смежное: `LynxJSIModuleBinding::get` возвращает `Value::null()` для незарегистрированного
модуля, поэтому проверка `if (!m) throw` работает. Но сообщение должно различать
«не слинковано» и «вызвано с main-потока», потому что причины разные.

---

### T2 · `__ANDROID__` не существует

**Статус: открыт (обходится) · Severity: Блокер**

Такого идентификатора нет ни в `@lynx-js/react@0.124.0`, ни в `@lynx-js/rspeedy@0.16.4`,
ни в `@lynx-js/types`. Существуют: `__DEV__`, `__PROFILE__`, `__BACKGROUND__`,
`__MAIN_THREAD__`, `__LEPUS__`, `__ALOG__`, `__ENABLE_SSR__`, `__PREFRESH__`.

Свободный идентификатор в модульной области это **`ReferenceError`**, а не `undefined`.
То есть проверка платформы падает раньше, чем успевает что-то проверить, и на обеих
платформах сразу.

**Правильно:**
```ts
// SystemInfo — настоящий глобал, types/common/global.d.ts
// platform: 'Android' | 'iOS' | 'Harmony' | 'windows' | 'macOS' | 'pc'
if (SystemInfo.platform === 'Android') { ... }
```

---

### T3 · Исключение из нативного модуля проглатывается

**Статус: открыт (архитектурное) · Severity: Блокер**

`LynxModuleDarwin::InvokeMethod` оборачивает весь вызов:

```objc
@try { ... invokeObjCMethod(...) ... }
@catch (NSException *exception) {
  _LogE(@"NativeModule: Exception '%@' was thrown while invoking function %s ...");
  callErrorCode = error::E_NATIVE_MODULES_EXCEPTION;
  ... lock_delegate->OnErrorOccurred(...);
}
```

Исключение до JS **не доходит**. `res` остаётся default-constructed, JS получает `undefined`
там, где ждал статус, и в логе только нативная запись.

**Следствие:** громкость строим в TS-фасаде. Натив возвращает различимое значение,
фасад решает, ронять или нет. См. решение `D6`.

---

### T4 · `sendGlobalEvent` до готовности рантайма дропается

**Статус: открыт (архитектурное) · Severity: Важно**

`LynxTemplateRender.sendGlobalEvent` имеет ровно один кэширующий путь, для SSR-гидрации.
Иначе:

```java
if (checkIfEnvPrepared() && mLynxContext != null) { ... }
else { LLog.e(TAG, "sendGlobalEvent error, can't get GlobalEventEmitter in " + this); }
```

Логируется и выбрасывается. Буфера нет.

**Следствие:** холодный старт нельзя решать «отправим событие и авось поймают».
Нужен consume-once геттер, который приложение **ждёт промисом**:
`getInitialNotification()`, `getInitialURL()`. У промиса нет требований к порядку подписок,
у события есть.

Не выяснено: очередят ли `IKitView.sendEventByJSON` и `SPKViewController.send(event:)`
события до загрузки бандла. У `IKitView` есть хук `readyToSendEvent()` с дефолтом `true`,
что намекает на воротца, но где он читается, не прослежено. **Проверить при работе над
роутингом тапов.**

---

### T5 · Методы модуля выполняются инлайн на JS-потоке

**Статус: открыт (архитектурное) · Severity: Важно**

`PerformMethodInvocation` собирает блок и **немедленно вызывает его**, без хопа на очередь:

```objc
void (^block)() = ^{ [inv invokeWithTarget:module]; };
block();
```

Значит любое обращение к UIKit с JS-потока это нарушение main-thread-only контракта.
Затрагивает как минимум: `UIApplication.shared.open`, `registerForRemoteNotifications`,
`isRegisteredForRemoteNotifications`, всё из `openSettings`.

**Правильно:** явный `DispatchQueue.main.async` вокруг таких вызовов.
Так же делает `react-native-permissions` в `RNPermissionHandlerNotifications.mm`.

**Обратная ошибка тоже реальна:** заворачивать в main **колбэк** не надо.
`ConvertModuleCallbackToCallbackBlock` уже маршалит на JS-поток через
`lock_delegate->InvokeCallback`. Лишний проход через main только добавляет способ подвиснуть.

На Android с JS-потока безопасны `checkSelfPermission` и `startActivity`
из application context.

---

### T6 · Колбэк ровно один раз, ровно один объект

**Статус: открыт (правило) · Severity: Важно**

`typedef void (^LynxCallbackBlock)(id result)` структурно одноаргументный.
`ConvertModuleCallbackToCallbackBlock` гасит повторный вызов:

```objc
if (wrapperWasCalled) { LOGR("...called more than once"); return; }
```

То есть второй вызов это **тихий дроп с логом**, а не видимая ошибка. В библиотеке,
чей главный тезис «тихие отказы это враг», об этом стоит помнить отдельно.

**Правило:** каждый асинхронный результат это хвостовой колбэк, вызванный ровно один раз
ровно одним объектом. Никогда голой строкой, никогда двумя аргументами.

---

## Codegen: не использовать

`@lynx-js/autolink-codegen@0.4.1` мапит `object`, `array`, `function` (то есть хвостовой
колбэк) и `promise` в `java.lang.Object`. Диспетчер Lynx этот тип отвергает:

```java
// lynx_android/src/main/java/com/lynx/jsbridge/LynxMethodWrapper.java
private static char paramTypeToChar(Class paramClass) {
  char tryCommon = commonTypeToChar(paramClass);   // примитивы + String
  if (tryCommon != '\0') return tryCommon;
  if (paramClass == Callback.class) return 'X';
  ...
  else throw new RuntimeException("Got unknown param class: " + paramClass.getSimpleName());
}
```

`commonTypeToChar` покрывает только byte/short/long/char/boolean/int/double/float
(и боксы) плюс `String`. Опциональные параметры codegen отвергает явно:
`Optional parameter "…" is not supported by Lynx library codegen v1`.

**Что можно передавать, если писать руками:**

| Тип | Код | Примечание |
|---|---|---|
| примитивы и `String` | разные | `commonTypeToChar` |
| `Callback` | `'X'` | хвостовой колбэк |
| `Promise` | `'P'` | конвенция ошибок не документирована, не используем |
| `Dynamic` | `'Y'` | |
| `byte[]` | `'a'` | путь для бинарных данных |
| `LynxContext` | `'K'` | |
| `ReadableMap` / `WritableMap` / `JavaOnlyMap` | `'M'` | и как параметр, и как возврат |
| `ReadableArray` / `WritableArray` / `JavaOnlyArray` | `'A'` | |

Множества `mJavaOnlyMapClassSets` и `mJavaOnlyArrayClassSets` считаются как
«сам класс плюс суперкласс плюс интерфейсы первого уровня» от `JavaOnlyMap` и
`JavaOnlyArray`, поэтому все шесть интерфейсных типов легальны.

Единственный map-подобный тип, которого в списке **нет**, это `Object`. Ровно его и
генерит codegen.

---

## Правила подписи, общие для всех пакетов

1. Каждая полезная нагрузка переходит **одним объектом**: `ReadableMap` или `NSDictionary *`.
2. Каждый асинхронный результат это хвостовой колбэк, **ровно один раз ровно одним объектом**.
3. Синхронные методы возвращают `String` (`'T'`), это самый безопасный тип возврата.
4. `Promise` в параметрах не используем.
5. Таблица `+methodLookup` на iOS проверяется на `prepack`: запись с несуществующим
   селектором **молча пропускается при конструировании** (`if (msig == nil) { continue; }`),
   а потом падает пойманным `NSInvalidArgumentException` при вызове. То есть опечатка
   даёт «лог и `undefined`», а не видимую ошибку.

---

## Ещё один тихий отказ

Gradle-плагин прокидывает `-Alynx.library.packageName=...`, но **сам процессор не добавляет**.
Библиотека обязана объявить `kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")` сама.
Без него не регистрируется ничего, и ошибки при этом нет.

Отдельно: `kapt` ломается на JDK 17+ без семи флагов `--add-exports`, задокументированного
пути на KSP нет, официальной страницы траблшутинга тоже. Единственный разбор
у Software Mansion, и он датирован декабрём 2025 против Lynx 3.4.1/3.5.1.


---

## T7–T13 · Найдено при первой сборке `@lynx-lab/crypto`

Записи перенесены сюда из спеки crypto, чтобы реестр ловушек был один.

- **T7** — Gradle-плагин Lynx прокидывает `-Alynx.library.packageName` только внутри
  `project.plugins.withId('kotlin-kapt')` и сам плагин **не применяет**. Без
  `id("org.jetbrains.kotlin.kapt")` и `kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")`
  в библиотеке `LynxLibraryProcessor.getProviderPackageName()` возвращает `""`
  и процессор выходит, не записав ни файла. Без ошибки.
- **T8** — конструктор Kotlin-модуля обязан быть **ровно** `(Context)` или
  `(Context, Object)`: `CommonModuleCreator.createModuleWrapper` делает
  `Context.class.equals(types[0])`, точное сравнение классов, наследники не подходят.
  Конструктор с `LynxContext` работает, только если наследоваться от `LynxContextModule`.
- **T9** — экспортируемые методы должны быть объявлены **на конкретном классе**:
  `findMethods()` зовёт `getDeclaredMethods()`, а не `getMethods()`, поэтому
  унаследованные `@LynxMethod` невидимы.
- **T10** — имя экспортируемого метода не должно начинаться с ARC selector family
  (`new*`, `copy*`, `init*`, `alloc*`, `mutableCopy*`): `PerformMethodInvocation`
  делает `[inv getReturnValue:&rawResult]` и `(__bridge id)` без передачи владения,
  поэтому +1 возврат утечёт или пере-освободится.
- **T11** — один плохой тип возврата **молча убивает весь модуль**, а не один метод:
  `LynxModuleWrapper.findMethods()` строит подписи в цикле по всем `@LynxMethod`.
- **T12** — `create-lynx-library@0.5.2` эмитит версии артефактов `0.0.1-alpha.1`,
  которых **не существует** на Maven Central (список версий начинается с `3.2.0-alpha.3`).
  Gradle их не разрешит. Если скаффолдить, это первое, что надо чинить.
- **T13** — `create-lynx-library@0.5.2` эмитит маркер `@LynxNativeModuleRegister`,
  которого в `lynx-family/lynx` не существует. Правильное написание `@LynxNativeModule`,
  и именно его ищет сканер гема.

---

## T14–T18 · Найдено при первой реальной сборке на устройстве

Дата: 2026-08-21. Устройство: Pixel 9, Android 17, API 37, arm64-v8a.
Проверялось на `@lynx-lab/crypto@1.0.1` в приложении, созданном
`create-sparkling-app@2.0.1`.

### T14 · Lynx Autolink несовместим со стоковым Sparkling

**Статус: открыт (обходится) · Severity: Блокер**

Плагин Autolink генерирует `LynxAutolinkGenerated.java`, который зовёт
`com.lynx.tasm.library.LynxLibraryRegistry`. Этот класс **появился только
в `lynx-4.0.1.aar`** (проверено распаковкой артефактов из кеша Gradle).

А `com.tiktok.sparkling:sparkling:2.0.1` тянет **`org.lynxsdk.lynx:lynx:3.6.0`**
транзитивно, и эта версия перебивает любой апгрейд в `libs.versions.toml`.

Симптом: сборка падает на `compileDebugJavaWithJavac` с
`cannot find symbol: variable LynxLibraryRegistry` **в сгенерированном файле**,
то есть выглядит как баг Lynx, а на деле это конфликт версий.

**Обход**, проверен и работает:
```kotlin
configurations.all {
    resolutionStrategy {
        force("org.lynxsdk.lynx:lynx:4.0.1")
        force("org.lynxsdk.lynx:lynx-jssdk:4.0.1")
        force("org.lynxsdk.lynx:lynx-trace:4.0.1")
        force("org.lynxsdk.lynx:lynx-base:4.0.1")
        force("org.lynxsdk.lynx:service-api:4.0.1")
        force("org.lynxsdk.lynx:primjs:4.0.0")   // см. T16
    }
}
```

### T15 · Шаблон Sparkling не подключает плагины Lynx Autolink вообще

**Статус: открыт (обходится) · Severity: Важно**

В `settings.gradle.kts` есть только блок `// BEGIN SPARKLING AUTOLINK`, и он
покрывает исключительно пакеты Sparkling Method. Плагинов
`org.lynxsdk.lynx.library-settings` и `library-build` там нет.

Значит **`bun add` любой Autolink-библиотеки Lynx сам по себе не сработает**:
автор приложения обязан добавить их руками.

```kotlin
// android/settings.gradle.kts
plugins { id("org.lynxsdk.lynx.library-settings") version "4.0.1" }

// android/app/build.gradle.kts
plugins { id("org.lynxsdk.lynx.library-build") }
dependencies { kapt(libs.lynx.processor) }   // в шаблоне закомментирован
```

### T16 · `primjs` версионируется отдельно от `lynx`

**Статус: открыт (факт) · Severity: Мелочь**

Версии `lynx` и `primjs` **не совпадают**. `primjs:4.0.1` не существует:
на Maven Central после `4.0.0` идут только альфы `4.0.1-alpha.2..4`.
Форсирование `primjs:4.0.1` роняет резолв.

### T17 · Стоковый шаблон требует полного апгрейда тулчейна

**Статус: открыт (факт) · Severity: Важно**

`create-sparkling-app@2.0.1` везёт: AGP **7.4.2**, Kotlin **1.8.10**,
Gradle wrapper **8.2**, `jvmToolchain(11)`, `forcedKotlinVersion = "1.8.10"`,
`compileSdk`/`targetSdk` **34**. Современная библиотека (Java 17, Kotlin 2.x)
не собирается против этого ничем.

Минимальный набор правок, проверенный до зелёной сборки:

| Что | Было | Стало |
|---|---|---|
| Gradle wrapper | 8.2 | **8.9** (AGP 8.7 требует ≥8.9) |
| AGP | 7.4.2 | 8.7.0 |
| Kotlin, включая `forcedKotlinVersion` | 1.8.10 | 2.0.21 |
| `jvmToolchain` и все `VERSION_11` | 11 | 17 |
| compileSdk / targetSdk | 34 | 35 |
| `buildFeatures { buildConfig = true }` | отсутствует | **обязателен** |

Последнее не очевидно: AGP 8 выключил генерацию `BuildConfig` по умолчанию,
а `SparklingApplication.kt` из шаблона на него ссылается. Симптом
`Unresolved reference 'BuildConfig'` в коде, который ты не писал.

### T18 · Диагностическое сообщение окупилось на первом же запуске

**Статус: подтверждено практикой**

Проба вызвала библиотеку с обоих потоков. С фонового всё сработало,
а с главного пришло ровно наше сообщение вместо `undefined`:

```
LYNXCRYPTO RESULT=OK   same-object=true | bytes=f4e88a0a…  | differs=true | uuid=8d6cf892-…
[main-thread.js] LYNXCRYPTO RESULT=FAIL  NativeModules недоступен … обязан выполняться на фоновом потоке (BTS)
```

Вывод для всех будущих пакетов: **текст ошибки в фасаде это функциональность,
а не украшение.** Стоит писать его до того, как код поедет на устройство.

---

## T19–T22 · Найдено при первой реальной сборке под iOS

Дата: 2026-08-21. Xcode 26.6, CocoaPods 1.17.0, `cocoapods-lynx-library` 4.0.1.

### T19 · Поды Lynx 4.x на CocoaPods не резолвятся

**Статус: открыт · Severity: Блокер**

`pod 'Lynx', '4.0.1'` и `'4.0.0'` оба падают:

```
There are only pre-release versions available satisfying the following requirements:
	'LynxServiceAPI', '>= 0'
	'LynxServiceAPI', '= 4.0.0'
```

При этом сам `LynxServiceAPI` 4.0.0 и 4.0.1 **опубликованы и не отозваны**
(проверено через `trunk.cocoapods.org/api/v1/pods/LynxServiceAPI`), и
локальный CDN-индекс их содержит. Конфликт возникает на субспеке `/Core`.

Проверено, что дело **не в нашей библиотеке**: конфликт воспроизводится
после полного удаления нашего пода из Podfile.

Дополнительно: стабильные версии пода `Lynx` на CocoaPods заканчиваются
на **4.0.0**, дальше только nightly. То есть **4.0.1 существует на Maven Central,
но не на CocoaPods**. Версии Android и iOS у Lynx расходятся.

Резолвится только **3.6.0**.

### T20 · Макрос `LynxNativeModule` появился только в 4.x

**Статус: открыт (обходится) · Severity: Блокер**

В `Lynx/LynxModule.h` версии **3.6.0 макроса нет вообще** (проверено grep
по установленному поду). Значит `@LynxNativeModule("Имя")` разбирается как
`@` плюс неизвестный идентификатор:

```
error: unexpected '@' in program
error: 'LynxCryptoModule' cannot use 'super' because it is a root class
```

Второе следствие первого: `@interface` после сломанного `@` парсится неверно.

Вместе с **T19** это деадлок: маркер требует 4.x, а 4.x не ставится.

**Обход, проверен и работает.** Объявить макрос самим, ровно тем же, чем
это делает Lynx 4.x:

```objc
#ifndef LynxNativeModule
#define LynxNativeModule(module_name) class LynxNativeModuleMarker;
#endif
```

Раскрывается в `@class LynxNativeModuleMarker;`, а нужен исключительно для
того, чтобы регулярка гема нашла маркер. Сгенерированный реестр использует
`NSClassFromString`, которому версия Lynx безразлична.

**Это должно быть в каждом нашем пакете.**

### T21 · Пин версии Lynx в podspec ломает резолв

**Статус: открыт (правило) · Severity: Важно**

`s.dependency "Lynx", ">= 3.9"` делает установку невозможной: работает
только 3.6.0. Но и убрать зависимость нельзя, тогда не находится
`<Lynx/LynxModule.h>`.

**Правило: `s.dependency "Lynx"` без ограничения версии.** Версию выбирает хост.

### T22 · Sparkling 2.0.1 не компилируется под Xcode 26.6

**Статус: открыт · Severity: Блокер для проверки на iOS**

Собственный Swift Sparkling падает:

```
SPKLynxService.swift:11:129:     error: unsupported type in a constant expression
SPKResourceLoaderImpl.swift:47:143: error: unsupported type in a constant expression
```

Наша библиотека к этому моменту уже компилируется чисто. То есть на iOS
**рантайм-проверка через Sparkling сейчас невозможна** независимо от
качества нашего кода.

Что при этом **подтверждено**:

- гем нашёл наш под и поставил его: `Installing LynxCrypto (1.0.1)`
- сгенерировал `ios/generated/lynx-library/LynxGeneratedLibraryRegistry.m`
  ровно с нашим модулем:
  ```objc
  if (NSClassFromString(@"LynxCryptoModule")) {
    [config registerModule:NSClassFromString(@"LynxCryptoModule") withName:@"LynxCryptoModule"];
  }
  ```
- наш Objective-C компилируется после обхода из T20

Не подтверждено: регистрация и вызов в рантайме, и переживает ли класс
dead stripping при `use_frameworks!` без `:linkage => :static`.

**Следующий шаг для iOS:** минимальный нативный хост на голом Lynx,
без Sparkling.

---

## T23 · Решение iOS: rc-линия Sparkling, а не latest

**Статус: РЕШЕНО** · дата: 2026-08-21

Блокер **T22** (Sparkling 2.0.1 не компилируется под Xcode 26.6) снимается
переходом на rc-линию. Это задокументированный и **закрытый** баг апстрима:

> **tiktok/sparkling#36** — «[Bug]: Latest rc iOS app has multiple regressions
> on Xcode 26.4 (build failures + missing globalProps/queryItems)».
> Закрыт 2026-04-15 как COMPLETED.

В теле issue среди прочего: «The iOS SDK failed to compile because of
`unsupported type in a constant expression` in the generated Sparkling pod
sources» — дословно наша ошибка.

Причина в исходниках: `@_section("__DATA, SPK_PRE_SVC")` над
`private let spkRegister… : UnsafePointer<CChar>? = UnsafeRawPointer(...)`.
Новый Swift не принимает такое выражение как константное.

### Как брать rc

```sh
bunx create-sparkling-app@rc <имя> --template-version rc
```

npm dist-tags у `sparkling-app-template`: `latest = 2.0.1`, `rc = 2.1.0-rc.36`.

### Поправки к T15 и T17 для rc-линии

rc **уже подключает Lynx Autolink на обеих платформах**, в отличие от `latest`:

| Что | latest 2.0.1 | rc 2.1.0-rc.36 |
|---|---|---|
| `ios/Gemfile` с `cocoapods-lynx-library` | нет вообще | **есть**, версия 3.9.0 |
| Плагины Autolink в Android | нет | **есть**: `apply(plugin = "org.lynxsdk.library-settings")` и `"org.lynxsdk.library-build"` |
| Пин Lynx | 3.6.0 | **3.9.0** |
| PrimJS | 3.6.1 | 3.8.0-alpha.6 |

⚠️ Идентификаторы плагинов в rc это **`org.lynxsdk.library-*`**, а не
`org.lynxsdk.lynx.library-*`, как в документации Lynx. Написание разное.

Что осталось прежним: `kapt(libs.lynx.processor)` по-прежнему закомментирован,
AGP 7.4.2, Kotlin 1.8.10, compileSdk 34, `platform :ios, '12.0'`.

### Итог проверки на iOS

Симулятор iPhone 17 Pro, Xcode 26.6, Sparkling 2.1.0-rc.36, Lynx 3.9.0,
`@lynx-lab/crypto@1.0.2` поставлен из npm:

```
LYNXCRYPTO same-object=true | bytes=6afb5970daa0b2b80c699a05d66f27ca
           differs=true | uuid=0c040b8d-c552-4b8b-a051-13d8c5347a65 | RESULT=OK
```

Плюс в нативном логе `LynxModule, module: LynxCryptoModule registered` и по паре
`will invokeMethod` / `did invokeMethod` на каждый вызов.

**Dead stripping класс пережил** при `use_frameworks!` без `:linkage => :static`,
то есть опасение из раздела про обнаружение не подтвердилось на этой конфигурации.

### Побочно подтверждено ещё раз

Проба, случайно уехавшая в `setTimeout`, выполнилась на **главном** потоке
и вернула наше же сообщение об ошибке вместо `undefined`. То есть контракт
«NativeModules только на BTS» держится и на iOS, и диагностика работает.


---

## T24 · Консоль JS не пробивается в лог устройства на iOS

**Статус: открыт (обходится) · Severity: Мелочь, но экономит час**

`console.log`, `console.warn` и `console.error` из BTS-скрипта **не попадают**
ни в `simctl launch --console-pty`, ни в `devicectl device process launch --console`.
На Android тот же вызов виден сразу через `lynx_console.cc`.

Что пробивается: **`lynx.reportError`**. Он уходит через `js_error_reporter.cc`
и печатается целиком, вместе с текстом сообщения.

```ts
try { lynx.reportError(new Error(результат)) } catch { /* ignore */ }
```

Смежная ловушка, стоившая отдельного захода: проба, вынесенная в `setTimeout`,
выполняется на **главном** потоке. То есть отложить вызов, чтобы дождаться
консоли, нельзя: `NativeModules` там не существует. Либо модульная область
(BTS), либо ничего.

---

## Итог проверки на устройствах

Обе платформы закрыты на реальном железе, пакет ставился из npm.

| | Android | iOS |
|---|---|---|
| Устройство | Pixel 9, Android 17, API 37, arm64-v8a | iPhone 11, iOS 18.4.1 |
| Хост | `create-sparkling-app@2.0.1` + ручной апгрейд тулчейна | `create-sparkling-app@rc` (2.1.0-rc.36), без правок |
| Lynx | 4.0.1 (форс через `resolutionStrategy`) | 3.9.0 (штатный пин шаблона) |
| Версия пакета | 1.0.1 | 1.0.2 |
| Регистрация модуля | да | да |
| Нативные вызовы | да | 4 × `randomBytesBase64`, 2 × `randomUUID` |
| `same-object` | `true` | `true` |
| Байты | `f4e88a0a21decc17f09e556b92af3b85` | `dfa2a4d216ec53fb2cfbb3b184ad6ac1` |
| Два вызова различаются | да | да |
| UUID v4 | `8d6cf892-a3bd-4d2c-81f2-e6e1afec97c8` | `12c03763-54f6-4ac3-8873-e686d84df181` |
| Ошибка при вызове с main-потока | наше сообщение | наше сообщение |

**Вывод по конвейеру: он работает end-to-end.** npm, Autolink, kapt на Android,
гем и `NSClassFromString` на iOS, регистрация, вызов, возврат значения.
Всё, что ломалось по дороге, ломалось в шаблонах и в версиях Lynx, а не в схеме.

---

## T25–T27 · Поправки про custom Elements

Найдено 2026-08-26 при разведке по WebRTC. **Три записи выше нуждаются в уточнении.**

### T25 · Autolink покрывает Elements, вопреки более ранней записи

**Статус: поправка**

`@LynxElement` регистрирует элементы **на обеих платформах** через тот же autolink.
Раньше в этих заметках было сказано, что codegen «покрывает Native Modules only, never
Elements» — это верно **только про TypeScript-codegen**. Регистрация работает.

Что действительно приходится писать дважды и никто не сверяет: **пропсы и события**,
нативной аннотацией плюс `declare module '@lynx-js/types' { interface IntrinsicElements }`.

### T26 · Маркерные макросы на iOS появились в 3.9.0, а не в 4.x

**Статус: уточнение к T20**

T20 фиксировал, что в Lynx **3.6.0** макроса `LynxNativeModule` нет (проверено grep).
Это верно. Но появился он в **3.9.0**, а не в 4.x, как там написано.

Практический вывод не меняется: `#ifndef`-guard в наших заголовках нужен, потому что
`latest`-шаблон Sparkling пинит 3.6.0. Но на rc-линии (Lynx 3.9.0) он уже избыточен.

### T27 · Шаблон элемента в create-lynx-library генерит нерегистрируемый элемент

**Статус: открыт · Severity: Важно**

`create-lynx-library@0.5.2` для iOS-элемента эмитит `@LynxUIRegister(...)`, а гем
`cocoapods-lynx-library` **сканирует `@LynxElement`**. Написание не совпадает, элемент
молча не регистрируется. Это та же болезнь, что T13 у модулей.

### Прочие грабли элементов, найденные в один заход

- Документация врёт в нескольких несущих местах: id Gradle-плагинов, синтаксис
  `compileOnly project(...)`, упоминается несуществующий `@LynxEvent`, а пример события
  на Android использует класс, дающий `e.params`, тогда как JS-пример читает `e.detail`.
- **Prop-сеттеры на iOS не гарантированно на главном потоке**, guard пишем сами.
- Swift не получает `LYNX_PROP_SETTER` и `LYNX_UI_METHOD`, поэтому элементы на iOS
  пишутся на Objective-C. Ровно поэтому `tamer-webview` это `.m`.
- Первый элемент стоит закладывать на день, ожидая две-три из этих граблей.
- В Lynx есть первопартийный `<video>`, его исходник — лучший образец для своего элемента.

---

## T28–T30 · Из первой сборки `@lynx-lab/app-lifecycle` на устройствах

Дата: 2026-08-28. Pixel 9 (Android 17) и iPhone 11 (iOS 18.4.1), плюс симулятор.

### T28 · На iOS есть `LynxContextModule`, и он единственный путь к `sendGlobalEvent`

**Статус: открыт (важнейшее) · Severity: Блокер для любого пакета с push в JS**

`CommonModuleCreator::getModule` (`common_module_creator.mm:68-74`):

```objc
if ([instance conformsToProtocol:@protocol(LynxContextModule)]) {
  LynxContext* context = context_finder_ ? context_finder_->FindContext("") : nil;
  instance = [(id<LynxContextModule>)instance initWithLynxContext:context];
} else if (param != nil && [instance respondsToSelector:@selector(initWithParam:)]) {
  ...
}
```

То есть при conform к `LynxContextModule` Lynx **сам подставляет контекст**.
А `initWithParam:` вызывается **только когда param не nil**, и autolink регистрирует
модули **без param** (в логе видно `registered with param (address): 0x0`).

**Следствие: без этого протокола нативный модуль на iOS не может отправить
ничего в JS.** Ни `sendGlobalEvent`, ни `getJSModule`. В документации этого нет.

Симметрично Android-овскому `LynxContextModule`, но с другим именем инициализатора.

### T29 · Java 17 в библиотеке ломает установку в стоковый шаблон

**Статус: открыт (правило) · Severity: Важно**

Шаблон Sparkling везёт **Java 11 и Kotlin 1.8.10** (обе линии, latest и rc).
Библиотека, собранная под Java 17, туда не встаёт: bytecode 61 не читается
компилятором, таргетящим 11.

**Правило: наши пакеты собираются под Java 11**, старым DSL
`kotlinOptions { jvmTarget = "11" }`, а не `kotlin { compilerOptions { } }`
(последний стабилен только с KGP 1.9).

Проверено: после понижения сборка на **стоковом rc-шаблоне** проходит, и из правок
нужна ровно одна — раскомментировать `kapt(libs.lynx.processor)`.

Это надо **портировать в `@lynx-lab/crypto`**: там сейчас Java 17, и он проверялся
только на шаблоне, который я апгрейдил целиком.

### T30 · `bun add file:` ломает iOS-автолинк

**Статус: открыт (методическое) · Severity: Мелочь, но стоит часа**

`bun add file:../path` делает **симлинк**, а гем `cocoapods-lynx-library` резолвит
realpath и отказывается:

```
[!] Invalid `Podfile` file: iOS podspecPath 'ios/X.podspec' must stay within
    package directory for .../node_modules/@scope/pkg/lynx.lib.json.
```

Для локальной проверки пакета ставить **из тарбола**: `npm pack`, затем
`bun add /путь/к/pkg.tgz`. Заодно ближе к тому, что получит реальный потребитель.

### Попутно: тулчейн Java 11 надо уметь достать

Шаблон просит **тулчейн** Java 11, а не просто таргет. Если на машине только JDK 17,
сборка падает с `No matching toolchains found`. Лечится одной строкой в
`settings.gradle.kts`, **после** блока `pluginManagement`:

```kotlin
plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "0.8.0"
}
```

Блок `plugins` до `pluginManagement` Gradle отвергает явной ошибкой.


---

## T31–T37 · Из спайка S6 и первых дней `@lynx-lab/edge-to-edge`

Дата: 2026-09-05. Эмулятор AVD (Pixel 7 профиль, Android 36, arm64), стоковый
rc-шаблон Sparkling 2.1.0-rc.36, Lynx 3.9.0. Подробности и логи в
[spikes.md](spikes.md#s6--успевает-ли-ранний-updateglobalprops-стать-init_global_props_).

### T31 · Первый pre-draw декора приходит ПОСЛЕ старта JS-рантайма

**Статус: открыт (архитектурное) · Severity: Блокер для всего, что хочет попасть в первый кадр**

Пуш на первом `OnPreDrawListener` декора проигрывает `LoadApp` на 80–120 мс
(`emu-predraw.log`: MTS-рендер 627 мс, pre-draw 706 мс; на Pixel 9 `pixel-predraw.log`:
MTS на 1 мс раньше pre-draw). В release иногда выигрывает, иногда нет: это гонка. Первый экран рисуется с тем, что было в `__globalProps`
на момент `LoadApp`, обновление приезжает через `__NotifyGlobalPropsUpdated` и
BTS-ре-рендер спустя ~100 мс.

**Правильно:** пушить из `Application.ActivityLifecycleCallbacks.onActivityPostStarted`.
В Sparkling `LynxView` впервые виден в дереве именно там: фрагмент коммитится
асинхронно из `onCreate` (`SparklingActivity.kt:99-106`) и материализуется в `onStart`
после `super.onStart()`, поэтому `onActivityCreated`, `PostCreated` и `Started`
видят ноль LynxView. Запас до старта MTS около 50 мс, но главное не запас, а то что
`BTSRuntime::OnGlobalPropsUpdated` (`bts_runtime.cc:1123-1135` @4.0.1) при
`state_ == kNotStarted` кладёт значение в `init_global_props_`, и оно уезжает
в `LoadApp`. Sparkling доставляет свои 22 ключа тем же способом
(`SimpleLynxKitView.kt:74-75`: `updateGlobalProps` **после** `renderTemplateUrl`).

### T32 · `getRootWindowInsets` равен `null` до attach окна

**Статус: открыт (факт) · Severity: Важно**

В `onActivityPostStarted` и даже в `onActivityResumed` декор ещё не прикреплён
(`isAttachedToWindow=false`), `ViewCompat.getRootWindowInsets(decor)` возвращает `null`,
и наивный код пушит нули или `-1`. Attach и первый `dispatchApplyWindowInsets`
случаются в первом traversal, то есть на pre-draw, а это уже T31.

**Правильно:** на API 30+ читать `activity.windowManager.currentWindowMetrics.windowInsets`
`.getInsets(systemBars() or displayCutout())`. В спайке он дал те же числа, что
позже `getRootWindowInsets` (`Insets{0,136,0,63}` при плотности 2.625 = 51.8dp / 24dp).
Ниже API 30 — тёплый кеш предыдущего окна, иначе нули с поправкой на pre-draw.

### T33 · Мерж `updateGlobalProps` по ключам живёт в Java, а C++ заменяет

**Статус: открыт (факт) · Severity: Важно для iOS**

`TemplateAssembler::UpdateGlobalProps` (`template_assembler.cc:251-270` @4.0.1) делает
`global_props_ = data`, а `BTSRuntime::OnGlobalPropsUpdated` делает
`init_global_props_ = props`. Оба **заменяют**. То, что ключи Sparkling пережили наш
пуш (`UpdateGlobalProps 22` → `23` в логе), заслуга Android-обвязки:
`LynxTemplateRender.internalMergeGlobalPropsSafely(TemplateData)` (javap по AAR 3.9.0).

**Следствие:** на iOS мерж надо проверить отдельно (`LynxTemplateRender.mm`), прежде
чем полагаться на «пушим только свой ключ». Не проверено.

### T34 · В release-сборке JS-консоль не попадает в logcat

**Статус: открыт (методическое) · Severity: Мелочь, но ломает диагностику**

`console.info` из BTS и MTS в debug виден через `lynx_console.cc(254)`, в release
(`isMinifyEnabled=true`, тот же код) не печатается вообще. Пробник, который доказывает
что-то только логами JS, в release слепой.

**Правильно:** выводить проверяемое значение на экран (`<text>`) и снимать
`adb exec-out screencap`, как сделано в S6. `lynx.reportError` в release не проверялся.

### T35 · rc-шаблон Sparkling собирает APK без выравнивания по 16 КБ

**Статус: открыт (шаблон) · Severity: Важно для публикации в Play**

На Pixel 9 (Android 17) поверх release-сборки пробника вылез системный диалог
«Совместимость приложений Android: приложение не поддерживает страницы памяти 16 КБ»
со списком `liblynxbase.so`, `libwasm.so`, `liblynx_v8_bridge.so`, `liblynxtrace.so`,
`libnapi_v8.so` и других как «несжатая библиотека не выровнена».

Виноват не Lynx. `llvm-readelf -l` по `.so` из `lynx-3.9.0.aar` и `lynx-4.0.1.aar`
(`liblynx`, `liblynxbase`, `liblynx_v8_bridge`, `liblynxtrace`, `libnapi*`, `libquick`,
`libwasm`) показывает `LOAD` с `Align 0x4000`, то есть ELF выровнен как надо.
Fresco и вовсе `0x10000`. А `zipalign -c -P 16 -v 4 app-release.apk` из build-tools 36
даёт `Verification FAILED`: `liblynx.so (BAD - 4096)`, `liblynxbase.so (BAD - 12288)`
и так далее. Это **раскладка внутри zip**, её делает AGP, а шаблон везёт AGP 7.4.2
(`gradle/libs.versions.toml`), который кладёт несжатые `.so` с шагом 4 КБ.

**Следствие:** любое приложение на стоковом шаблоне получит этот диалог на устройствах
с 16 КБ страницами и, по политике Google Play для targetSdk 35+, не пройдёт загрузку
(`verified-secondary`, дата требования в эту сессию не проверялась).

**Как чинить:** апгрейд AGP до версии с 16 КБ zip-выравниванием (T17 уже описывает
апгрейд до 8.7.0 и его цену), либо прогонять `zipalign -P 16` по готовому APK.
Пакетов `@lynx-lab/*` это не касается: своих `.so` у них нет.

### T36 · Компоненты для ReactLynx нельзя шипить скомпилированными

**Статус: открыт (архитектурное) · Severity: Блокер для любой библиотеки с `<view>`**

Библиотека, которая собрала `src/react/index.tsx` в `dist/react/index.js`
(обычный `tsc` с `jsx: react-jsx`), на устройстве падает целиком:
`main-thread.js exception: Snapshot not found: view` на MTS и
`BackgroundSnapshot not found: view` на BTS, `LoadApp fail: call load_app_func fail!`,
пустой экран и тост «loadCard failed». Проверено на Pixel 9 с `@lynx-lab/edge-to-edge`.

Причина в компиляторе ReactLynx: JSX превращается не в `jsx("view", props)`, а в
снапшоты (`createSnapshot("__snapshot_<hash>", …)`, регистрация в `snapshotCreatorMap`),
и рантайм на обоих потоках ищет vnode по id снапшота. `new SnapshotInstance(type)` в
`@lynx-js/react` бросает, когда `type` это строка `view`, а не id
(`runtime/lib/snapshot.js`, «Snapshot not found: » + type). Уже скомпилированный
`jsx("view")` из `@lynx-js/react/jsx-runtime` лоадер не трогает: он работает с JSX-AST.

**Правильно:** шипить React-вход **исходником** и указывать на него в `exports`:

```json
"./react": { "types": "./dist/react/index.d.ts", "import": "./src/react/index.tsx", "default": "./src/react/index.tsx" }
```

Rsbuild по умолчанию включает `.ts/.tsx/.jsx` из `node_modules` в JS-правило
(`@rsbuild/core/dist/131.js`: `rule.include.add(/\.(?:ts|tsx|jsx|mts|cts)$/)`),
rspeedy добавляет `/\.(?:js|mjs|cjs)$/`, а лоадеры ReactLynx висят на этом правиле как
`oneOf` для слоёв `react:background` и `react:main-thread`
(`@lynx-js/react-rsbuild-plugin/dist/208.js`, `applyLoaders`). Значит TSX из
`node_modules` проходит через тот же трансформ, что и код приложения. Проверено:
`__snapshot_f89b0_ba622_1` для `SafeAreaProvider` появился в бандле, оба потока отрисовали.

Два следствия. Импорты внутри такого файла только через имя пакета
(`from '@lynx-lab/edge-to-edge'`), иначе ядро соберётся дважды, из `dist` и из `src`,
с двумя разными кешами. И `files` в `package.json` обязан включать `src/**/*.tsx`,
а `check-publishable` обязан это проверять.

Методическое: бандл лежит в assets APK. После `bun run build` нужен `assembleDebug`
и переустановка, иначе прогон идёт на старом JS. Стоило трёх прогонов подряд.

### T37 · Debug-схема rc-шаблона запирает портрет

**Статус: открыт (шаблон) · Severity: Мелочь, но тест поворота молча не идёт**

`android/app/src/debug/java/.../DebugDevUrlSupport.kt:39,41` строит схему главной
страницы с `&screen_orientation=portrait`, а `SparklingActivity.initSparklingFragment`
превращает это в `requestedOrientation = SCREEN_ORIENTATION_PORTRAIT`. Ни
`settings put system user_rotation 1`, ни `wm user-rotation lock 1` экран не поворачивают,
и в логе тишина. Для тестов поворота в пробнике менять на `screen_orientation=unspecified`.
В release-схеме (`SparklingVariantHooksImpl` из `src/release`) параметр смотреть отдельно.

---

## Итог проверки `@lynx-lab/app-lifecycle` на устройствах

| | Android | iOS |
|---|---|---|
| Устройство | Pixel 9, Android 17 | iPhone 11, iOS 18.4.1 (переходы сняты на симуляторе, код тот же) |
| Хост | стоковый rc-шаблон, только `kapt` раскомментирован | стоковый rc-шаблон |
| Регистрация модуля | да | да, через `LynxContextModule` |
| `getState()` нативно | да | да |
| Начальное состояние | `active gen=0` | `active gen=0` |
| Сворачивание | `CHANGE state=background gen=1 missed=false` | `CHANGE state=background gen=1 missed=false` |
| Возврат | `CHANGE state=active gen=2 missed=false` | `CHANGE state=active gen=2 missed=false` |
| Видимость страницы | `PAGE visible` / `PAGE hidden` | `PAGE visible` |

Поколения растут монотонно, пропусков нет, поведение платформ **совпадает**.
