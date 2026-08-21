---
verified: 2026-08-21
lynx_version: 4.0.1
status: draft
---

# lynx-websocket

**Оценка: 3–4 недели.** Нужен только мессенджеру; магазину не нужен.

Реализация `NativeModules.LynxWebSocketModule` вне devtool-дерева.

## Почему нужен

`@lynx-js/websocket` это **не реализация**, а тонкий JS-фасад над
`NativeModules.LynxWebSocketModule` (`ws/lib/WebSocket.js`:
`new WebSocketImpl(NativeModules.LynxWebSocketModule, ...)`), который при отсутствии
модуля рапортует «WebSocket is not found. Please use Lynx >= 2.16 or consider using
a polyfill».

Сам нативный модуль живёт **только в devtool-дереве**. Полный обход
`lynx-family/lynx@develop` (13 635 путей), все вхождения `websocket`:

```
clay/lynx_adaptor/native_module/lynx_websocket_module.{cc,h}       ← desktop only
platform/android/lynx_devtool/.../LynxWebSocketModule.java
platform/darwin/common/lynx_devtool/Module/LynxWebSocketModule.{h,mm}
platform/harmony/lynx_devtool/.../LynxWebSocketModule.ets
```

В `lynx_android`, `lynx_service` и `platform/darwin/common/lynx` его нет.
Вендорится через `LynxDevToolService.getLynxWebSocketModuleClass()` и регистрируется
в `LynxDevtool.onRegisterModule()`, **первая строка которого**:

```java
if (!LynxEnv.inst().isLynxDebugEnabled()) return;
```

А шаблон Sparkling выпиливает devtool во **всех** вариантах:

```kotlin
implementation("com.tiktok.sparkling:sparkling:2.1.0-rc.12") {
    exclude(group = "org.lynxsdk.lynx", module = "lynx-service-devtool")
    exclude(group = "org.lynxsdk.lynx", module = "lynx-devtool")
    exclude(group = "org.lynxsdk.lynx", module = "debug-router")
    exclude(group = "org.lynxsdk.lynx", module = "base-devtool")
}
```

iOS делает то же по построению: production-таргет `SparklingGo` не линкует ни одного
devtool-пода.

**Вывод: у production-приложений на Lynx нет двунаправленного транспорта.**
То, что этого не заметили за 17 месяцев, само по себе лучший индикатор,
сколько людей возят на Lynx сетевые приложения.

## Ключевое преимущество: контракт уже зафиксирован

Имя модуля и сигнатуры методов заданы **фасадом самого ByteDance**.
Значит `import { WebSocket } from '@lynx-js/websocket'` начинает работать в момент
линковки: наследуем официальный API вместо изобретения своего.

Извлечено из тарбола `@lynx-js/websocket@0.0.4`, **не угадано**:

```
connect(url, protocols, options, socketID)
send(message, socketID)
ping(socketID)
close(statusCode, closeReason, socketID)   // код и причина ПЕРЕД socketID
```

iOS-версия devtool дополнительно публикует `sendBinary(base64String, socketID)`.
У Android-версии `sendBinary` нет вовсе.

События через `lynx.getJSModule('GlobalEventEmitter')`:
`websocketOpen`, `websocketMessage`, `websocketClosed`, `websocketFailed`.

## Находка: приём бинарных фреймов уже работает

`WebSocketImpl.#onMessage`:

```js
const data = event.data;
switch (event.type) { case 'text': break; /* TODO: support binary data */ }
this.dispatchEvent(this.#createWebSocketEvent('message', { data }));
```

У `switch` **нет `default`** и он никогда не трогает `data`. Значит как только натив
пришлёт `{ type:'binary', data:<ArrayBuffer>, id }`, стоковый `socket.onmessage`
получит `event.data instanceof ArrayBuffer === true`. Патчить фасад не надо.

Блокирует фасад **только отправку**:
```js
if (typeof data === 'string') { ...send...; return }
throw new Error('Unsupported data type')
```
Значит своим JS-слоем закрываем ровно эту половину.

## Реализация

- Android: OkHttp `WebSocket` плюс `WebSocketListener`. Модуль ~250 строк,
  devtool-версия даёт рабочий скелет, который надо поправить
- iOS: `NSURLSessionWebSocketTask`. **Тяжёлая половина**: нужен цикл приёма,
  посессионная обвязка делегата, учёт `bufferedAmount`, приведение кодов закрытия.
  Devtool-код на SocketRocket тут не помогает
- Значение сверх devtool-версии: **настоящие бинарные фреймы**. Devtool кидает
  `Unsupported data type` на всё, кроме строки. `ArrayBuffer` мапится в `byte[]` и `NSData`
- Добавляем: заголовки в `options` (в Android-версии devtool стоит
  `// TODO: support options.headers` и они молча теряются), `pingIntervalMs`,
  `getBufferedAmount`

## Риски по срокам

1. `putByteArray` и `NSData` могут не пережить конвертер `sendGlobalEvent`.
   Тогда fallback на base64 плюс JS-декодер, минус день
2. Autolink может не уважать конструктор `LynxContext` у наследника
   `LynxContextModule`. Тогда обычный `LynxModule` плюс отдельный поиск `LynxContext`
3. Коллизия с модулем в debug-сборке, где devtool-версия зарегистрирована. Не проверено
