# Changelog

Формат: дата, что изменилось, чем подтверждено.

## 2026-11-18

- Probe `a11a4dd`: полноэкранный host загружает Lynx после attach/layout через
  публичный SPKContainerView. Release build, строгая Swift-проверка и независимое
  review прошли; три simulator video дают bounded first-frame PASS. Secure,
  crypto, lifecycle, keyboard и итоговые rotation inset проверены повторно.
- Открыт независимый очищенный `lynx-lab`; исходный GitHub repo, ветки и issues
  сохранены приватно. 48 commit trees и 894 исходных candidate objects проверены,
  удалены 10 точных классов локальных идентификаторов; оригиналы evidence сохранены.
- Все четыре package-репозитория публичны. Локальные JS/native checks и remote
  JS/Android/iOS jobs прошли на task-ветках с Xcode 27.2. Audit Secure Store
  проходит; crypto/lifecycle/edge блокирует GHSA-fc5q-39xc-vjpf, без нового ignore.
- Simulator Release probe `9874e6c`: Secure Store 10/10 и persistence, crypto,
  lifecycle A/B, UIKit keyboard `0 → 349 → 0` прошли. Три видеозаписи выявили
  first-frame дефект edge: сначала fallback, затем сдвиг на 62 pt; расследуется.
- Подготовлена очистка истории лаборатории с приватным Git bundle и оригиналами
  evidence. Добавлены MIT, исходные third-party notices и EN/RU правила публичных
  производных; неподтверждённый сторонний snapshot исключается из экспорта.

## 2026-11-17

- Probe `e806327`: убрана Release portrait-блокировка host, диагностические строки
  видны в landscape. Android16 Release rotation/insets подтверждены screenshots;
  сохранён final APK, временная установка и build intermediates убраны.
- Remote CI task-веток: crypto JS/audit/Android pass; lifecycle strict JSX conflict
  исправлен dev-only patch (`d2eb9c2`, edge `f226ff6`) с negative ref fixtures и
  независимым mutation review. Edge jobs блокирует GitHub billing; private repo
  отдельно блокирует provenance. Настройки и публикации не менялись.
- Secure Store приведён к стандарту: 65 tests, strict TS, native checks, reviewed
  consumer source-binding gate и direct Android runner. Physical Android/iOS
  Debug/Release и persistence подтверждены; ограничения и два неуспешных runner
  сценария сохранены отдельно. Probe `855fdde` / evidence `8dffb04`.
- App-lifecycle `87a7b93`: consumer/device acceptance завершён в новом JS profile,
  probe `616c66a`, evidence `51ae596`. Две JS-подписки, foreground/background,
  initial Android background и настоящее Activity recreation подтверждены.
  Parent проверил 68 evidence hashes и четыре сборки; ограничения host сохранены.
- По выбору пользователя probe `e924fbc` переведён в отдельный ReactLynx 0.125 /
  Rsbuild 2 candidate; JS build проходит, native host сохранён. Старый проверенный
  профиль остаётся baseline. Точные версии и ограничения — D13.
- Crypto `6805c374`: reviewed source-binding helper перенесён в пакет, 50 tests.
  Runtime/native файлы нового архива идентичны ранее проверенным.
- Edge-to-edge `2ba4bc3`: per-view ownership, Android bars и React effect lifecycle
  исправлены, findings независимого review закрыты; strict/native checks проходят.
  README сохраняет языки/бейджи; physical consumer evidence `44f68fb` принят с явными
  first-frame/Release rotation/keyboard границами. Реальные два view и late owner прошли.
- EN/RU документы всех четырёх пакетов синхронизированы с evidence; docs-only archive
  deltas проверены побайтно. Финальные локальные commits/архивы перечислены в STATE.md.
  Освобождено около 13 ГиБ собственных build intermediates после проверки артефактов;
  worktrees, приложения, evidence и защищённый ownership recording resource сохранены.

## 2026-11-16

- Crypto pilot `9d1bd34`: проверки кода, independent review и consumer/device QA
  завершены для одного профиля. Physical Android/iOS Debug/Release прошли,
  Android R8, tarball/lock/bundle hashes сверены; probe source `c3e957d`.
  Эталон Biome обновлён до проверенного 2.5.9;
  уточнены TS-окружения, bundled dependencies/audit и идентичность release tarball.
  Публикация crypto заблокирована; два audit-исключения требуют пересмотра
  до 2026-12-17. Это не завершение миграции остальных пакетов.
- Зафиксированы стандарт production-пакетов, stable gate и политика поддержки
  Lynx + проверяемых host. Добавлены эталонные Biome/TS/EditorConfig/clang-format
  настройки и общий TS pipeline. Внедрение в четыре пакета ещё впереди.
- Эталоны проверены на Biome 2.0.0 / TypeScript 5.9.3: корректный fixture проходит,
  форматирование в 2 пробела, any, непроверенный индекс и неверный optional undefined
  отклоняются; TSX включён, --error-on-warnings блокирует warning. Независимое
  read-only review без блокеров. Native formatter/build не запускались.

## 2026-11-09

- В план добавлен `@lynx-lab/secure-store` как обязательная часть авторизации
  по запросу Ильи. Создан набросок требований.
  Референсы Expo SecureStore и react-native-keychain проверены по официальной
  документации, ссылки в наброске.
- Затем исследованы опубликованные исходники трёх Lynx-пакетов secure storage,
  Expo/RN и платформенные API. Выбран и написан самостоятельный минимальный пакет:
  TS-фасад, Android Keystore/AES-GCM, iOS Keychain, autolink, README EN/RU.
  Сборки и тесты не запускались по запросу пользователя; пакет не готов к релизу.
  Доказательства и ограничения: `docs/secure-store-research.md`.

## 2026-08-21

- Репозиторий заведён. Внесены результаты трёх заходов разведки: 20 агентов,
  1248 вызовов инструментов, три состязательные проверки.
- Заведены реестры дефектов: `T1`–`T6` (общие), `P1`–`P9` (`lynx-permissions`),
  `N1`–`N10` (`lynx-notify`).
- Зафиксирована архитектура модульности: один npm-пакет, выбор провайдеров
  на этапе сборки. Схема «пакет на провайдера» отвергнута с доказательством.

## 2026-08-29

- **`@lynx-lab/app-lifecycle` 1.0.0 выпущен.** Второй пакет. Проверен на Pixel 9
  и iPhone 11, поведение платформ совпадает.
- **`@lynx-lab/crypto` 1.0.3.** Перенесён на Java 11, сообщения об ошибках на английском.
- Новое правило: **пакеты собираются под Java 11**, чтобы вставать в стоковый шаблон
  Sparkling без апгрейда тулчейна потребителем. См. T29.
- Заведены T28–T30: протокол `LynxContextModule` на iOS, Java 11, и то что
  `bun add file:` ломает iOS-автолинк.

## 2026-09-01

- **Добавлен [STATE.md](STATE.md)** — единый документ возврата в проект: состояние,
  доказанное на железе, пять самых дорогих находок, окружение, рабочий метод,
  незакрытые хвосты и следующий шаг. Написан и для человека, и для модели,
  открывающей репозиторий с нуля.
- **Реестр ловушек сведён в один файл.** T7–T13 лежали в спеке crypto и терялись;
  подняты в `docs/01-platform-traps.md`. Теперь там все тридцать.
- В `CLAUDE.md` добавлено правило: первое действие в новой сессии это STATE.md
  плюс реестр ловушек, и STATE.md обновляется в конце каждого захода.

## 2026-09-05

- **Спайк S6 пройден** (эмулятор, Sparkling 2.1.0-rc.36, Lynx 3.9.0): ранний
  `updateGlobalProps` буферизуется в `init_global_props_` и становится начальным
  значением `lynx.__globalProps`, но только если пушить из `onActivityPostStarted`.
  Пуш с pre-draw проигрывает `LoadApp`. Подтверждено `bts_runtime.cc:1123-1135`
  и `template_assembler.cc:251-270` на теге 4.0.1, плюс исходниками Sparkling.
- Заведены **T31–T34**: pre-draw после старта JS, `getRootWindowInsets` до attach,
  мерж globalProps живёт в Java, JS-консоль в release молчит.
- **D8**: точка пуша и источник инсетов для edge-to-edge изменены. Спека поправлена
  разделом «Результат спайка дня 1», риск №1 и риск R8 закрыты.
- **D7 и новая раскладка**: пакеты переехали в `packages/`, пробники в `apps/`,
  shallow-клоны `lynx` (4.0.1, 3.9.0) и `sparkling` в `upstream/`. Всё в `.gitignore`,
  правило в `CLAUDE.md`.
- Хвост «trusted publisher для app-lifecycle» упёрся в незалогиненный профиль браузера.
- **S6 подтверждён на Pixel 9**, T35 про 16 КБ zip-выравнивание в rc-шаблоне (AGP 7.4.2).
- **`@lynx-lab/edge-to-edge` собран**: дни 2–5 и JS-слой, проверен на Pixel 9 через
  autolink из тарбола. Репозиторий создан приватным. T36 и D9: React-вход
  библиотеки шипится TSX-исходником. Спека переведена в `status: building`.

## 2026-09-10

- **edge-to-edge, день 5**: все методы модуля и клавиатура проверены на эмуляторе.
- **T38**: autolink-реестр Android не перегенерируется после `bun add`, модуль молча
  не регистрируется. Записано в README пакета.
- Release с пакетом под R8 проверен на эмуляторе: провайдер, модуль и реестр выжили.
- **edge-to-edge, день 6, iOS на симуляторе**: первый кадр и поворот верные после D10
  (регистрация через `LynxEnv.lifecycleDispatcher`, T39). T40 про `@YES` → `1`.
  T33 закрыт для iOS по исходникам.
- README EN/RU для `edge-to-edge` (день 9), vitest 4.1.11 из-за `bun audit`.

- 2026-11-17: Android16 emulator Release smoke: Secure10/10+persistence, crypto, lifecycle A/B PASS; edge rotation tool-blocked. Own probe removed and T3 session closed; evidence in docs/evidence/android-emulator-2026-11-17/.

- 2026-11-17: Probe strict TS и актуальные component tests исправлены (6c21ab9); immutable prepare/QA/publish pipeline реализован в crypto1508946, lifecycle0d1106e, edge327ca4f. Full local checks,33 release tests per package и exact archive inspections прошли; remote/OIDC/publication не запускались. Baseline device artifacts сохранены.
