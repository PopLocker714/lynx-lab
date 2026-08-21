---
verified: 2026-08-21
lynx_version: 4.0.1
status: spec
---

# Ловушки платформы

Читать перед любой строкой нативного кода. Каждая из шести выглядит как рабочий код
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
