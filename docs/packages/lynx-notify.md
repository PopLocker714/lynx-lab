---
verified: 2026-08-21
lynx_version: 4.0.1
status: spec
estimate: 8–9 недель локальные, 14–18 всё
defects_open: 10
---

# lynx-notify

Локальные уведомления плюс модульные провайдеры пушей. Один npm-пакет, три точки входа,
провайдеры выбираются на сборке.

Требование заказчика дословно: провайдеры Google, Apple, Huawei и RuStore как подключаемые
куски без конфликтов, с настраиваемым выбором; плюс базовые локальные механизмы, которые
работают «неважно, есть ли у нас токен или нет».

## Раскладка

```
lynx-notify                      # единственный пакет с lynx.lib.json
├── lynx.lib.json
├── src/index.ts                 # локальные            → "lynx-notify"
├── src/push.ts                  # токены и топики      → "lynx-notify/push"
├── src/mock.ts                  # фейк в памяти        → "lynx-notify/mock"
├── android/
│   ├── build.gradle.kts         # читает lynxNotify.providers
│   ├── src/main/                # ЯДРО: ноль импортов провайдеров, ноль <service>
│   │   ├── AndroidManifest.xml
│   │   └── java/dev/lynxnotify/core/…
│   └── src/providers/{fcm,hms,rustore}/{java/…, AndroidManifest.xml}
└── ios/
    ├── LynxNotify.podspec       # подспеки, default_subspecs из глобала
    └── src/core/… , src/providers/{apns,fcm}/…
```

Отложено на потом: `@lynx-notify/server`, сборщик payload на Node. Чистый TS,
без `lynx.lib.json`, нулевая связность. Не в v1.

## Шов

```
                   ┌────────────────────────────────────────┐
  TS фасад         │ lynx-notify          lynx-notify/push  │
  (руками)         │ display / schedule   getTokens / topics│
                   └──────────────┬─────────────────────────┘
                NativeModules.LynxNotify   (BTS-поток)
                   ┌──────────────┴─────────────────────────┐
  ОДИН модуль      │ LynxNotifyModule                       │
  (руками,         │  ├ NotificationStore   (локальные, JSON)│
   без codegen)    │  ├ Presenter           (показ в ОС)     │
                   │  ├ ChannelManager      (Android)        │
                   │  ├ Scheduler           (AlarmManager /  │
                   │  │                      UNCalendar)     │
                   │  ├ PendingBuffer       (холодный старт) │
                   │  └ PushHub  ◄── единственный push-код   │
                   └──────────────┬─────────────────────────┘
              LynxPushProvider    │   LNPushProvider
      ┌────────────┬──────────────┼──────────────┬───────────┐
   FcmProvider  HmsProvider  RuStoreProvider  LNApnsProvider  LNFcmProvider
```

Всё слева от `PushHub` компилируется и работает при нулевом коде провайдеров.
`PushHub` с пустым списком это объект-пустышка. Требование «локальные без токена»
выражено **структурой**, а не дисциплиной.

При пустом выборе: нет Firebase/HMS/RuStore на classpath, нет `<service>` в смерженном
манифесте, нет провайдерского подспека на iOS, `google-services.json` не нужен,
`getTokens()` возвращает `{}`. Код не просто не используется, его нет в бинарнике.

## Нативный контракт

```ts
type Cb = (result: Record<string, unknown>) => void

interface LynxNotifyNative {
  // разрешения
  getPermissionStatus(cb: Cb): void
  requestPermission(options: object, cb: Cb): void
  openNotificationSettings(): void
  // каналы — Android, no-op на iOS
  createChannel(channel: object): void
  deleteChannel(channelId: string): void
  getChannels(cb: Cb): void
  // показ и планирование
  display(notification: object, cb: Cb): void
  schedule(notification: object, trigger: object, cb: Cb): void
  cancel(id: string): void
  cancelAll(): void
  getScheduled(cb: Cb): void
  getDisplayed(cb: Cb): void
  // бейдж — на iOS настоящий, на Android только флаг канала
  getBadgeCount(cb: Cb): void
  setBadgeCount(count: number): void
  // категории и действия — iOS
  setCategories(categories: object): void
  // точные будильники — Android
  canScheduleExactAlarms(cb: Cb): void
  openExactAlarmSettings(): void
  // push
  getLinkedProviders(): string        // "firebase,apns" | ""
  checkAvailability(cb: Cb): void
  getTokens(cb: Cb): void
  deleteTokens(cb: Cb): void
  subscribeToTopic(topic: string): void
  unsubscribeFromTopic(topic: string): void
  // холодный старт
  flushPending(): void                // ⚠ заменяется, см. N5
}
```

## Потолок, вокруг которого проектируем

**В Lynx нет headless-выполнения JS.** При убитом приложении
`FirebaseMessagingService.onMessageReceived` отработает в нативном процессе, где рантайма
Lynx нет вообще. Значит библиотека честно предлагает **только нативный показ**,
без JS-обработчика.

Всё, что в Notifee называется `onBackgroundEvent`, на Lynx не портируется.
**Это пишем в README первой строкой**, а не выясняем в проде.

## Реестр дефектов

### N1 · Импорт фасада не резолвится
**Блокер · открыт** · см. `T1`

`import { NativeModules } from '@lynx-js/types'` в `src/index.ts`. Под rsbuild это ошибка
сборки, у снисходительного бандлера `undefined` и падение на каждом вызове.
**Чинить:** удалить импорт, читать глобал.

### N2 · Главный защитный инвариант это ReferenceError
**Блокер · открыт** · см. `T2`

```ts
if (__ANDROID__ && typeof n.channelId !== 'string')
  throw new Error("notification.channelId is required on Android")
```

Стоит в `displayNotification` и `scheduleNotification`, то есть падает **на обеих
платформах при каждом вызове**, до того как успевает что-то проверить.

А защищала она от худшего режима отказа во всей библиотеке: на API 26+ уведомление
с неизвестным каналом **исчезает молча**.

**Чинить:** `SystemInfo.platform === 'Android'`.

### N3 · `LNApnsProvider` не conform-ится к `LNPushProvider`
**Блокер · открыт**

Протокол объявляет `- (void)unsubscribeFromTopic:(NSString *)topic;`,
класс реализует `public func unsubscribeToTopic(_ topic: String) {}`.
Разные селекторы, нет conformance, ошибка сборки.

Тривиально чинится, но означает, что две половины протокола никто не сверял,
а на нём держится весь iOS-шов.

**Чинить:** одно имя плюс проверка conformance в CI.

### N4 · Склейка манифестов решает несуществующую проблему и делает это неверно
**Блокер · открыт**

Посылка спеки: «`sourceSets.main.manifest.srcFile` одноместный, поэтому N условных
фрагментов нельзя просто перечислить, их надо склеить в один файл». Верно для legacy DSL
и **нерелевантно**.

AGP 8 даёт документированный не-incubating API. В `gradle-api:8.7.0-sources.jar`,
`com/android/build/api/variant/Sources.kt` экспонирует `val manifests: ManifestFiles`,
а `ManifestFiles.kt`:

```kotlin
fun addStaticManifestFile(relativeFilePath: String)
fun <TASK: Task> addGeneratedManifestFile(
    taskProvider: TaskProvider<TASK>, wiredWith: (TASK) -> RegularFileProperty)
```

с комментарием «Adding manifest is always added static and generated manifests carry
the highest possible priority across all manifests».

Один `addStaticManifestFile(...)` на выбранного провайдера внутри
`androidComponents.onVariants { }`. Ни задачи склейки, ни маркера-комментария
`<!-- LYNXNOTIFY_PROVIDER_COMPONENTS -->`, ни `.replace()` по строке, ни угадывания имён
через `tasks.matching { it.name.startsWith("process") }`.

**Хуже того, предложенный подход не просто хрупок, у него нет гарантии порядка вообще.**
`AndroidSourceFile.srcFile(srcPath: Any)` документирован как «evaluated as
`org.gradle.api.Project.file`» — `file()`, не `files()`, то есть **не несёт зависимости
задач**. А мерж, который на самом деле важен, происходит в задаче обработки манифеста
**приложения**, потребляющей манифест библиотеки через artifact transform.
`dependsOn(mergeManifest)` в проекте библиотеки не упорядочит мерж потребителя.
Первая чистая сборка прочитает несуществующий или устаревший файл.

**Чинить:** `variant.sources.manifests.addStaticManifestFile`. Спайк на самодельную
склейку отменяется целиком.

Попутно проверено и оказалось верным: `srcDirs(vararg srcDirs: Any)` документирован
как «Adds the given source directories» (заменяющий это `setSrcDirs`), поэтому
`sourceSets["main"].java.srcDirs(...)` не затирает `src/main/java`. И передача `List`
в этот vararg законна, потому что он вычисляется как `Project.files`.

### N5 · Холодный старт сделан хуже, чем это делает фреймворк
**Важно · открыт** · см. `T4`

Фреймворковая часть подтверждена: `LynxTemplateRender.sendGlobalEvent` имеет ровно один
кэширующий путь (SSR-гидрация), иначе логирует и дропает.

Самострел: `flushPending()` это **один глобальный метод без аргументов**, а зовут его
и `onNotificationResponse`, и `onDeviceToken`. При однослотовом буфере, очищаемом на
первом сливе, приложение, подписавшееся на `onDeviceToken` раньше, **сливает тап холодного
старта в несуществующего слушателя**.

Требование README «подписывайтесь в корне при первом рендере» не спасает: обе подписки
и так в корне, а их порядок задаёт граф модулей.

**Чинить:** либо `flushPending(kind: string)` по каналам, либо, что лучше, выкинуть
буфер для пути ответов и сделать consume-once `getInitialNotification()` как у Notifee.
Промис, который приложение ждёт, не имеет требований к порядку вообще.

### N6 · Спека противоречит себе по владению делегатом
**Важно · открыт**

Раздел конфигурации: ядро занимает `UNUserNotificationCenter.delegate` из `+load`,
наблюдая `UIApplicationDidFinishLaunchingNotification`, захватывает существующий делегат
и чейнит к нему (механизм Notifee).

Раздел рисков: занимает **лениво** при первом использовании модуля.

Это разные механизмы с противоположным поведением на холодном старте. Ленивый теряет
каждое показанное в форграунде уведомление и каждый тап, пришедший до появления первого
LynxView, то есть ровно тот случай, ради которого строился буфер.

**Чинить:** выбрать один и записать до начала работы над iOS.

### N7 · Планировочные разрешения мержатся в каждый APK
**Важно · открыт**

Манифест библиотеки мержит `POST_NOTIFICATIONS`, `VIBRATE`, `RECEIVE_BOOT_COMPLETED`
и `SCHEDULE_EXACT_ALARM` **в каждый** потребляющий APK, включая заявленный сценарий
«только локальные, поставил и всё».

Документация Google по `SCHEDULE_EXACT_ALARM`: выдаётся пользователем, отзывается
пользователем и системой, «not pre-granted to fresh installs of apps targeting Android 13
(API level 33) and higher», и «Subject to an upcoming Google Play policy».

Спека аккуратно никогда не объявляет `USE_EXACT_ALARM` и при этом безусловно раздаёт всем
другое.

**Чинить:** механизм уже есть. Вынести планировочные разрешения в фрагмент манифеста
за флагом `lynxNotify.scheduling`, по умолчанию выключенный, ровно как фрагменты провайдеров.

### N8 · `getTokens()` может не зарезолвиться никогда
**Важно · открыт**

`LNApnsProvider.getToken` дописывает в массив `waiting` с комментарием «таймаута нет,
офлайн-регистрация может занять сколько угодно; ядро резолвит `getTokens()` тем, что есть».
Два предложения описывают **разные объекты**, и кто разгребает `waiting`, не сказано.

На iOS невызванный `LynxCallbackBlock` это промис, который никогда не settle,
а фасад его `await`-ит.

**Чинить:** записать правило. Ядро резолвит JS-колбэк **немедленно** закэшированными
токенами; провайдерские колбэки, пришедшие позже, идут только в `onDeviceToken`.

### N9 · Подспеки не проверены под вторым `pod install`
**Важно · открыт**

Трюк `$LynxNotifyProviders` → `default_subspecs` проверен изолированно, но не под
повторной установкой: смена глобала в Podfile **ничего не меняет на диске**, поэтому
контрольная сумма podspec идентична. Перечитывает ли CocoaPods `:path`-подспек при живых
`Podfile.lock` и `Pods/Manifest.lock`, не выяснено.

**Чинить:** спайк `S1` прогнать двумя запусками: сначала `['apns']`, потом сменить глобал
и повторить.

### N10 · main-thread-only свойство читается с JS-потока
**Мелочь · открыт** · см. `T5`

`isAvailable()` читает `UIApplication.shared.isRegisteredForRemoteNotifications`.
В том же файле `registerForRemoteNotifications()` уже правильно завёрнут в
`DispatchQueue.main.async`, то есть правило известно и применено непоследовательно.

## Локальные уведомления: что портируем из Notifee

Notifee заархивирован Invertase в апреле 2026; `react-native-notify-kit` это
поддерживаемый форк. То есть исходный план «портировать notify-kit» означал портировать
форк архива.

Берём: модель `displayNotification` / `createTriggerNotification` / `cancel`, каналы и
группы каналов Android, категории и действия iOS, `UNNotificationPresentationOptions`
для показа в форграунде, триггеры на `AlarmManager` и `UNCalendarNotificationTrigger`,
`getInitialNotification`.

Не берём: `onBackgroundEvent` (нет headless JS), foreground services, всё, что у Notifee
построено на Room и WorkManager как на бэспоук-персистенции.

## План

| Недели | Что |
|---|---|
| 1 | Каркас, спайки `S1` и `S3`, письменное решение по `N4` и `N6` |
| 2–4 | Локальные, Android: каналы, `Presenter`, `NotificationStore`, `Scheduler`, флаг `lynxNotify.scheduling` из `N7` |
| 5–6 | Локальные, iOS: категории, действия, `UNCalendarNotificationTrigger`, презентация в форграунде, бейдж |
| 7–9 | **Роутинг тапов и холодный старт. Здесь перерасход.** Три версии ОС × живое/фоновое/убитое × лаунчеры OEM, плюс смерть процесса. Каждый дефект выглядит как «тапнул и ничего». `getInitialNotification()` из `N5` |
| 10–12 | Провайдеры FCM и APNs: `PushHub`, интерфейс, рефлексивное обнаружение, `getLinkedProviders()`, правило из `N8` |
| 13+ | HMS и RuStore. Второй по риску кусок и единственный, завязанный на железо, которого может не быть |

**14–18 недель соло с реальным тестированием.** Локальная половина отдельно:
**8–9 недель**, и она самодостаточна.

## Провайдеры: заметки на потом

- На устройствах без сервисов Google **FCM не доставляет**. Реальный канал в России
  это RuStore Universal Push, значит пуш-модуль для этого рынка выглядит как
  RuStore плюс APNs, а не Firebase.
- **Не проверено:** является ли RuStore Universal Push сам по себе мульти-провайдерной
  абстракцией, маршрутизирующей между FCM, HMS и своим каналом. Если да, наш слой
  частично лишний. Выяснить до недели 13.
- **Не проверено:** уживаются ли FCM, HMS и RuStore в одном APK без duplicate-class
  и без конкуренции за показ уведомления.
