---
verified: 2026-08-21
lynx_version: 4.0.1
status: draft
---

# lynx-deeplinks

**Оценка: 2 недели.**

App Links, Universal Links, кастомные схемы, `getInitialURL()`, тёплый вход
в живой контейнер.

## Состояние: нет ничего

Grep по всему репозиторию Sparkling (223 Swift, 374 Kotlin/Java, HEAD c4ce8d2)
на `onNewIntent`, `openURL`, `application(_:open:options:)`, `continueUserActivity`,
`NSUserActivity`, `CFBundleURLTypes`, `associated-domains`, `applinks:`,
`intent.action.VIEW`, `BROWSABLE`, `deepLink` → **ноль попаданий**.

По дампу документации lynxjs.org (`llms-full.txt`, 4.1 МБ, 148 686 строк) → тоже ноль,
плюс ноль по push/APNs/FCM.

Шаблон объявляет `INTERNET` плюс `MAIN/LAUNCHER` на Android, а `Info.plist` содержит
только `NSAllowsLocalNetworking`. Файла `.entitlements` в репозитории нет вообще.

`hybrid://` строго внутренний: у `IHostRouterDepend.openScheme` ровно один вызывающий
во фреймворке, это IDL-метод `router.open` из JS. `SparklingActivity` объявлена
`android:exported="false"`, без intent-filter, и никогда не читает `intent.data`.

⚠️ Документация Sparkling **лжёт**: утверждает, что «any scheme URL can be triggered
from outside the app (push notifications, other apps, etc.)» и показывает пример
`SparklingRouter.open()`. `SparklingRouter` существует в 4 строках документации
и **0 строках исходников**.

## Хорошая новость

Канал «натив → JS» первоклассный и документирован с обеих сторон:
`LynxView.sendGlobalEvent` → `GlobalEventEmitter` → `useLynxGlobalEventListener`,
с любым именем события. Sparkling публично оборачивает: на Android
`KitViewManager.getKitViews()` плюс `IKitView.sendEventByJSON`,
на iOS `SPKViewController.send(event:)`.

Холодный старт имеет две документированные полосы: параметры схемы →
`lynx.__globalProps.queryItems`, и `initData` → `useInitData`.

То есть путь «URL уже в `onNewIntent`» → «JS его видит» **решён**.
Путь «URL есть у ОС» → «приложение его получило» целиком наш.

## Архитектура

- Android-половину отдаём **целиком через мерж манифеста библиотеки**: активность
  с intent-filter, `singleTask`, `onNewIntent`, значения через manifest placeholder
- iOS: документированный сниппет в `Info.plist` плюс хелпер, который автор зовёт
  из трёх методов AppDelegate. Пакет физически не может дописать plist
- `getInitialURL()` как consume-once промис, а не событие (см. `T4` в docs/01-platform-traps.md)

## Конкуренция

`@amritk/lynx-deep-linking`: ~24 КБ натива в 5 Kotlin и 4 ObjC файлах плюс ~54 КБ TS.
Вердикт самого автора: «Pre-alpha, and nothing here has run on a device». 25 загрузок в неделю.

## Открытый вопрос

`IKitView.readyToSendEvent()` имеет дефолт `true` и намекает на воротца.
Очередятся или дропаются события, отправленные до загрузки бандла, **не выяснено**.
Это самый рискованный неизвестный для тёплого возврата.
