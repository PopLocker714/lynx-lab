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
