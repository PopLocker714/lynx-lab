---
verified: 2026-08-21
lynx_version: 4.0.1
status: draft
---

# lynx-webview-plus

**Оценка: 3–4 недели.** Кандидат на апстрим вместо форка.

Элемент webview с перехватом навигации и остальным, чего нет у встроенного.

## Состояние встроенного `<webview>`

Он **существует на мобильных**: `org.lynxsdk.lynx:xelement-webview:4.0.1` на Maven Central,
pod `XElement` на CocoaPods trunk. Но поверхность крошечная:
**7 пропсов, 3 события, 2 метода**.

Всё, за чем потянулась бы платёжная интеграция, помечено `@PC` в TypeScript-определениях
и доступно только на Clay/CEF (десктоп): `bindlocationchange`, `bindopenwindow`,
проп `cookies` и методы `cookies.*`, `initjs`, `use-osr`.

Собственный AI-скилл в репозитории Lynx говорит это прямым текстом:

> Do not use `<webview>` when you need to assume PC or Windows-only APIs such as
> cookie methods, `initjs`, `use-osr`, `openwindow`, or `locationchange` on mobile.

## Что именно надо добавить

| Дыра | Детали |
|---|---|
| Перехват навигации | Android: `shouldOverrideUrlLoading` не переопределён. iOS: `decidePolicyForNavigationAction` отсутствует. **И сами протоколы делегатов (`ILynxWebViewCallback`, `LynxWebViewLoaderDelegate`) не имеют слота под навигацию**, поэтому даже свой нативный загрузчик не сможет доложить наверх |
| URL в событии загрузки | Жестокий near-miss: сигнатура Android это `onPageFinished(WebView view, String url)`, URL уже там, а `LynxUIWebView` его **выбрасывает** и шлёт голый `load` с пустым detail |
| Сторонние куки | Android никогда не зовёт `setAcceptThirdPartyCookies(webView, true)`, а AOSP по умолчанию запрещает их для target Lollipop+. Кросс-доменные ACS-фреймы 3DS теряют состояние |
| `WebChromeClient` | Нет, поэтому `target="_blank"` и `window.open` молча теряются. Попапный 3DS просто виснет. Плюс нет геолокации в странице и выбора файла |
| `UIDelegate` на iOS | Не установлен, та же проблема с попапами |
| Кастомные схемы | Ни на одной платформе: `bankapp://`, `intent://`, СБП, `tel:`, `mailto:` — все в тупик |
| Белый список источников для моста | **Реальный дефект безопасности, не придирка.** Android форсит mixed content и отдаёт JS-мост **каждому** источнику, куда зайдёт вебвью, включая страницу эквайера и страницу банка. Payload из `bindmessage` считать недоверенным |

## Что уже работает

Мост инжектится **после каждой** загрузки страницы на всех трёх платформах:
Android через `addJavascriptInterface` плюс инжектированный форвардер
`window.addEventListener('message')`, iOS через `WKUserContentController` с хендлером
`nativeApp`, Harmony через `javaScriptOnDocumentEnd`.

Единый API со стороны страницы: `window.postMessage(string)`, и он **переживает цепочку
редиректов**, потому что переинжектится на каждой навигации.

Полумера для чужих страниц: `eval` выполняет произвольный JS (обе платформы выбрасывают
возвращаемое значение), поэтому `eval('window.postMessage(window.location.href)')`
и приём через `bindmessage` дают опрашивающую замену `bindlocationchange`.

## Интеграционные факты, которые стоят дня до начала

- `<webview>` **не входит ни в один шаблон Sparkling**: iOS Podfile тянет только
  `Framework` и `ReleaseResource`, без `XElement`; Android никогда не зависит
  от `org.lynxsdk.lynx:xelement-webview`
- `kapt(libs.lynx.processor)` в шаблоне **закомментирован**, поэтому авторегистрация
  `@LynxBehavior` не сработает и behavior надо регистрировать руками
- `hybrid://webview?url=` выглядит как полноценный веб-контейнер, но это заглушка:
  схема мапится в `SPKHybridEngineTypeWeb`, сервис для этого движка не зарегистрирован,
  `WKWebView` в SDK отсутствует, `createKitView` возвращает nil. Тот же паттерн
  «объявлено типом, не реализовано», что и `AppConfig.plugin`

## Рекомендация

**Нести апстримом в `lynx-family/lynx`, а не форкать.** Протоколам делегатов нужен слот
под навигацию, и такое изменение живёт в SDK лучше, чем в форке. Риск: бэклог внешних
PR у Lynx 887 штук, а PR от CTO Sentry висит с марта 2025.

Прагматичный план: сделать элемент у себя, параллельно открыть PR в апстрим.
