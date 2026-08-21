---
verified: 2026-08-21
lynx_version: 4.0.1
status: draft
---

# lynx-browser-handoff

**Оценка: 1.5–2 недели. Самый ценный объект во всей экосистеме Lynx прямо сейчас.**

Открыть URL в настоящем системном браузере и вернуть callback-URL в ожидающий вызов JS.

## Почему нужен

Встроенный `<webview>` **не перехватывает навигацию ни на одной платформе**:

- Android: `WebViewClient` переопределяет только `onPageFinished` и `onReceivedError`.
  `shouldOverrideUrlLoading` не переопределён
- iOS: только `didFinishNavigation` и `didFailNavigation`.
  `decidePolicyForNavigationAction` отсутствует
- Сами протоколы делегатов (`ILynxWebViewCallback`, `LynxWebViewLoaderDelegate`)
  **не имеют слота под навигацию**, поэтому даже свой нативный загрузчик не сможет
  доложить о смене URL наверх

Следствие: `intent://qr.nspk.ru/...#Intent;scheme=bank100000000111;...` умирает
как `ERR_UNKNOWN_URL_SCHEME`, а `bank100000000008://` на iOS молча отменяется.

Системный браузер (Chrome Custom Tabs, `ASWebAuthenticationSession`) эти схемы
**обрабатывает** и отдаёт callback обратно.

## Что разблокирует

СБП, SberPay, Alfa Pay, T-Pay, Mir Pay (пять из двенадцати методов ЮKassa),
попапный 3DS, плюс вход через VK ID, Госуслуги и Яндекс.

## Половина уже есть, и об этом никто не знает

`sparkling-navigation` принимает недокументированный `options.useSysBrowser`:

- **iOS: работает полностью.** `SPKRouter.openInSystemBrowser` → `UIApplication.open`,
  с guard на http/https
- **Android: тихая заглушка.** `SparklingHostRouterDepend.openScheme` игнорирует
  `extraParams`, открывает Lynx-контейнер и возвращает `true`. JS рапортует успех,
  а не произошло ничего. Починка это **пять строк `Intent(ACTION_VIEW)`
  в твоём собственном файле**

Но у `useSysBrowser` **нет обратной ноги**: ни колбэка возврата, ни обработчика
deep link в шаблоне, ни события возврата на передний план. Это и есть предмет пакета.

Ограничение iOS-реализации: `SPKRouter.openInSystemBrowser` **жёстко отвергает всё,
что не http/https** («Only web URLs are supported for security reasons»), то есть
для схем банков он не годится и нужен свой путь.

## Конкуренция

`@sigx/lynx-webauth` делает архитектурно правильную вещь
(`ASWebAuthenticationSession` и Chrome Custom Tabs), но привязан к фреймворку
`@sigx/lynx` вместо ReactLynx, требует шага `sigx prebuild`, и у него
142 загрузки в неделю против 36 166 у `@lynx-js/react`.

## Открытый вопрос

Проверить end-to-end оплату СБП через Custom Tabs и `ASWebAuthenticationSession`.
Архитектурно всё сходится, но публичного доказательства для российских платежей
на Lynx не существует.
