# Лог решений

Каждая запись: что решили, почему, чем подтверждено, и что заставило бы передумать.

---

## D1 · Один npm-пакет на библиотеку, а не пакет на провайдера

**2026-08-21 · принято**

Схема «ядро плюс пакет на провайдера» на Lynx 4.0.1 не собирается физически.

- Android: `LynxLibrarySettingsPlugin` делает только `settings.include(projectPath)`
  и ставит `projectDir`. `LynxLibraryBuildPlugin.configureAndroidConsumer` добавляет каждую
  библиотеку безусловным `implementation project(...)` **в приложение**, никогда в другую
  библиотеку. Значит `lynx-notify-fcm` не скомпилируется против интерфейса из `lynx-notify`
  без публикации в Maven или хардкода внутреннего пути `:lynx_library_<mangled>`.
- iOS: `Autolink.install!` пишет ровно `podfile.pod pod_name, :path => File.dirname(...)`.
  Ни `:subspecs`, ни опций. Второй `pod 'LynxNotify/FCM'` в Podfile хоста ловит
  `Analyzer#verify_no_pods_with_different_sources!`.

**Передумаем, если** Lynx добавит межбиблиотечные зависимости в Autolink,
либо если появится смысл публиковать артефакты в Maven Central и CocoaPods trunk отдельно.

---

## D2 · Codegen не используем ни в одном пакете

**2026-08-21 · принято**

`@lynx-js/autolink-codegen@0.4.1` мапит `object`, `array`, `function` и `promise`
в `java.lang.Object`, а `LynxMethodWrapper.paramTypeToChar` этот тип отвергает
исключением. Codegen v1 умеет только методы, где каждый параметр это
`string | number | boolean`, а возврат один из них или `void`. Опциональные параметры
отвергает явно. Оба наших API этого не переживают.

Пишем натив руками, как `@amritk/lynx-location`. Цена: таблица `+methodLookup` на iOS
проверяется руками, поэтому расхождение арности падает в рантайме, а не на сборке.
Закрывается проверкой на `prepack` (дефект `P8`).

**Передумаем, если** выйдет codegen v2 с пользовательскими типами.

---

## D3 · Обнаружение провайдеров рефлексией, не через реестр Lynx

**2026-08-21 · принято**

Реестр Lynx регистрирует Native Modules, а провайдеры это не модули. Вместо реестра
фиксированная таблица пар `(id, className)`, каждая проверяется рефлексией.
Это механизм самого Lynx: `Class.forName` внутри `catch (Throwable)` на Android
и `NSClassFromString` на iOS. Ломается только там, где уже сломался autolink.

Два условия: свой `consumerProguardFiles` с `-keep` (шипованные правила Lynx кроют
только `@LynxNativeModule` и `LynxLibraryProvider`), и флаг `-ObjC`, который CocoaPods
ставит при статической линковке.

---

## D4 · Локальные уведомления отделены структурно

**2026-08-21 · принято**

Требование: локальные уведомления работают без токена, без провайдера,
без `google-services.json`. Реализуется тем, что весь push-код заперт в `PushHub`,
а локальный путь в него не заходит вообще. Список провайдеров по умолчанию пустой,
и тогда провайдерского кода нет в бинарнике.

---

## D5 · Первым делаем lynx-permissions

**2026-08-21 · принято**

Он нужен всем остальным пакетам: ни камера, ни геолокация, ни уведомления
не заводятся без него. Плюс он меньше по объёму и даёт обкатать весь конвейер
Autolink на чём-то, что не завязано на чужие SDK.

---

## D6 · Громкость ошибок живёт в TS-фасаде, а не в нативе

**2026-08-21 · принято**

`LynxModuleDarwin::InvokeMethod` оборачивает весь вызов в `@try/@catch`, пишет лог
и до JS не доводит ничего. Значит `NSException` как способ громко сообщить о проблеме
не работает: приложение получает `undefined` вместо статуса. Все проверки конфигурации
делаем в TS и бросаем оттуда. См. дефект `T3`.

---

## D7 · Пакеты, пробники и апстрим лежат внутри lynx-lab как вложенные клоны

**2026-09-04 · принято**

До этого `lynx-crypto` и `lynx-app-lifecycle` лежали россыпью в `~/Documents/dev`,
и сессия, открытая в пакете, не видела ни `STATE.md`, ни реестр ловушек. Теперь:

- `packages/<name>/` — собственный git-репозиторий каждого пакета, в `.gitignore` этого репо
- `apps/<name>/` — одноразовые пробники `create-sparkling-app`, тоже в `.gitignore`
- `upstream/lynx`, `upstream/sparkling` — shallow-клоны на тегах, чтобы правило
  «ни одного утверждения без источника» выполнялось по `git grep`, а не по памяти

Почему вложение, а не соседняя папка `~/Documents/dev/libs`: Claude Code подхватывает
`CLAUDE.md` из родительских папок, значит любая сессия внутри `packages/*` автоматически
получает правила этого репозитория. Симметрия `docs/packages/<name>.md` ↔ `packages/<name>/`
идёт бонусом. `react-native-nitro-xray-core` не Lynx и остаётся у VPN-проекта.

**Передумаем, если** понадобится единая CI-проверка всех пакетов разом (тогда submodules
или workspace), либо если набор пакетов перестанет быть только про Lynx.

---

## D8 · edge-to-edge: пуш инсетов из `onActivityPostStarted`, значения из `WindowMetrics`

**2026-09-05 · принято по результату спайка S6**

Спека ставила пуш `updateGlobalProps` на первый pre-draw декора. На устройстве
pre-draw приходит после `LoadApp` (T31), и первый экран получает `safeArea=null`
на ~100 мс. Пуш из `onActivityPostStarted` приходит до старта MTS с запасом ~50 мс
и становится начальным значением через `init_global_props_`
(`bts_runtime.cc:1123-1135` @4.0.1). Так же доставляет свои globalProps сам Sparkling.

Значения в этот момент берутся из `WindowManager.currentWindowMetrics.windowInsets`
(API 30+), потому что `getRootWindowInsets` до attach окна `null` (T32).

Заодно убран канал C (`sendGlobalEvent`): обновления и так приезжают через
`__NotifyGlobalPropsUpdated` → `onGlobalPropsChanged` в ReactLynx.

**Передумаем, если** на реальном Pixel 9 или OEM-прошивке `currentWindowMetrics`
до attach вернёт не те инсеты, что потом `getRootWindowInsets`, либо если Sparkling
перенесёт создание LynxView в `onCreate`.

---

## D9 · React-вход пакетов шипится TSX-исходником, ядро — из `dist`

**2026-09-05 · принято на устройстве**

`exports["./react"]` указывает на `src/react/index.tsx`, `exports["."]` на `dist/index.js`.
Скомпилированный `jsx("view")` ReactLynx не понимает (T36), а TSX из `node_modules`
его лоадер компилирует в снапшоты так же, как код приложения. Внутри TSX импорты только
по имени пакета, чтобы ядро не собралось дважды. Типы по-прежнему из `dist/react/index.d.ts`.

Цена: у потребителя должен быть rspeedy с `pluginReactLynx` (у всех есть) и TSX-парсинг
`node_modules` (включён по умолчанию в Rsbuild). `@lynx-lab/app-lifecycle` это не задело:
там хуки без элементов.

**Передумаем, если** ReactLynx начнёт публиковать стабильный формат
предскомпилированных снапшотов для библиотек.

---

## D10 · edge-to-edge на iOS: регистрация LynxView из глобального lifecycle-хука

**2026-09-10 · принято по прогону на симуляторе**

Спека предполагала, что iOS-модуль сам найдёт `LynxView` через `getLynxView` при
создании. Модуль создаётся после `LoadApp`, и первый кадр получал `null`. Теперь
`LEESafeAreaStore` ставит `LynxViewLifecycle`-клиента в `LynxEnv.lifecycleDispatcher`
на `UIApplicationDidFinishLaunching`, и в `lynxViewDidStartLoading:` (синхронно из
`loadTemplateFromURL:`) греет кеш из key window, регистрирует view, пушит globalProps
и вешает observer. Модуль делает то же самое повторно, идемпотентно, как страховка (T39).

Побочно: observer-вьюха больше не публикует из `didMoveToWindow`, там safe area ещё
нулевые до первого layout; `edgeToEdge` нормализуется из `1` (T40).

**Передумаем, если** Lynx даст `LynxViewBuilder`-уровневый способ задать globalProps
до загрузки, либо если `lifecycleDispatcher` перестанет быть публичным.



## D11 · Secure-store: минимальный самостоятельный модуль для токенов

2026-11-09. После проверки npm-исходников amritk 0.2.0, Tamer 0.0.3 и SignalX
0.35.0 выбран собственный небольшой TS/Objective-C/Kotlin модуль. Причины:
дополнительные мосты и конфигурация хостов, молчаливый успех без натива либо
автоматическая потеря записей при ошибках в проверенных кандидатах.

API: три async CRUD-операции, null только для отсутствия записи, отдельные
ошибки. Android: Keystore/AES-GCM, ciphertext в noBackupFilesDir; iOS:
Keychain AfterFirstUnlockThisDeviceOnly, обновление через SecItemUpdate.
Биометрия и полный Expo/RN API не входят в первую версию. При ошибках не очищать
хранилище автоматически. Доступность после reinstall различается по платформам.

[Исследование и источники](docs/secure-store-research.md). Код написан без
сборок/тестов по просьбе Ильи; решение не означает готовность к релизу.
Пересмотреть, если готовый пакет устранит перечисленные ограничения и подтвердит
подключение к нашему Sparkling, либо будущие нативные проверки опровергнут выбранный путь.

## D12 · Общий стандарт пакетов, проверяемые host и безопасные обновления

2026-11-16. Пользователь подтвердил основу Lynx + проверяемые host, критерии stable,
единый стиль с 4 пробелами, строгие TS checks и устранение warnings без лишних слоёв.
Приняты [стандарт](docs/package-standard.md) и
[политика совместимости](docs/compatibility-policy.md). README по структуре Tauri,
бейджи и EN/RU сохраняются. Native гарантии проверяются отдельно от TS.

Новый host сначала candidate: проверка старого tarball, локализация несовместимости,
исправление с regression test, обратная проверка старой связки, evidence и только
затем recommended. Прекращение заявленной поддержки — breaking change, не patch.
Эталонные конфиги — в standards; установка во все пакеты ещё не выполнена.
Пилот последовательно уточняет инструменты; не переписывать ObjC/архитектуру ради
одинакового вида. Пересмотр — по конкретным ограничениям host/toolchain и результатам пилота.

## D13 · Отдельный ReactLynx 0.125 / Rsbuild 2 candidate

2026-11-17. Для app-lifecycle пользователь выбрал обновление JS toolchain отдельного
candidate-профиля. Проверенный probe `8dffb04` (ReactLynx 0.116 / Rsbuild 1) сохранён
как baseline; опубликованный peer range lifecycle не расширяется до этой версии.
Старый React plugin не поддерживает 0.125 (`Missing field removeCall`); подходящий
plugin 0.19.1 требует Rsbuild 2. QR plugin также обновлён из-за удалённого hook.

Probe `e924fbc`: ReactLynx 0.125.0, types 4.2.1, react-rsbuild-plugin 0.19.1,
Rspeedy 0.16.5, Rsbuild 2.1.10, Rspack 2.1.8, QR plugin 0.6.0. JS build и прежние
пути main/second bundles проверены. Native Lynx 3.9 / Sparkling 2.1.0-rc.36
сохранены. Lifecycle Debug/Release и Release crypto/secure-store smoke приняты
на обоих физических устройствах (probe evidence `51ae596`). Это проверка
конкретных пакетов/артефактов, не сертификация всего host: старые TS-ошибки и один
устаревший App test probe остаются. Metadata-only patch React объявляет Vitest peer
для isolated Bun; runtime-файлы не изменены. Финальный edge consumer ещё проверяется.
