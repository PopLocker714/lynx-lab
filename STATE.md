---
last_updated: 2026-11-18
lynx_version: 4.0.1 (Maven) / 4.0.0 (CocoaPods)
sparkling: 2.0.1 (latest) / 2.1.0-rc.36 (rc)
bun: 1.4.0
---

# Состояние проекта

2026-11-18, итог повторного simulator QA: probe `a11a4dd` использует публичный
`SPKContainerView` и загружает шаблон после присоединения полноэкранного host к окну
и layout. Прежний `SPKViewController` начинал загрузку в `viewDidLoad`, до получения
safe-area. Новый Release прошёл три видеопрогона: первый различимый новый контент
сразу имеет `top=62/bottom=34/g1`, прежний сдвиг на 62 pt не наблюдается.
Это ограниченный PASS записанных кадров iOS 27 Simulator, а не гарантия любого
Sparkling host, вложенного view или физического устройства.
Secure Store 10/10, crypto, lifecycle A/B, keyboard `0 → 349 → 0` и восстановление
итоговых inset после landscape → portrait прошли. Пакетный runtime не менялся.
[Evidence и ограничения](docs/evidence/ios-simulator-2026-11-18/results.json).

Лаборатория теперь публична: новый независимый `PopLocker714/lynx-lab`, MIT.
Старый репозиторий сохранён приватным как `lynx-lab-private-archive`, включая
рабочие ветки, 13 issues и 6 comments; issues публично не переносились.
Очистка охватывает историю, device/signing identifiers и локальный home-prefix;
оригинальные evidence и соответствие очищенным копиям сохранены приватно.
[Правила evidence](docs/public-evidence.ru.md),
[проверка публикации](docs/evidence/public-history-2026-11-18/results.json).
Продолжать документацию следует в чистом `lynx-lab-public-standards`; старые
worktree сохраняют сырую историю, их origin push отключён. `main` публичной
лаборатории сохраняет исторический baseline со ссылкой на эту task-ветку.

Открыто: first-frame Android и физический iOS, physical Release keyboard,
minimum OS, OIDC/trusted publishing и audit трёх пакетов. Ни один пакет не
объявлен stable; package main/version/npm publication не выполнялись.
Сессия симулятора закрыта, свой probe удалён, симулятор выключен. После сохранения
обеих сборок до/после исправления и matching dSYM удалены ещё 6.71 ГиБ собственных
build intermediates и неудачных сборок ([receipt](docs/evidence/ios-simulator-cleanup-2026-11-18/results.json)).

Ниже — подробности проверенного CI и исходного дефекта до исправления host.

2026-11-18: все четыре репозитория пакетов публичны; исходники пакетов имеют MIT,
лицензии заимствованного кода сохранены отдельно. Текущие task-ветки:

| Пакет | Commit | Локальные JS / Android / iOS | Remote JS / Android / iOS | Audit |
|---|---|---|---|---|
| crypto | `cfffe739` | PASS | PASS | FAIL |
| app-lifecycle | `96e9ed2` | PASS | PASS | FAIL |
| edge-to-edge | `b9a27f9` | PASS | PASS | FAIL |
| secure-store | `0ac0db7` | PASS | PASS | PASS |

У crypto/lifecycle/edge общий блокер audit — `GHSA-fc5q-39xc-vjpf` в picomatch;
на дату проверки исправленной опубликованной версии нет, новое исключение не добавлено.
Поэтому три workflow в целом завершились FAIL, несмотря на успешные JS/native jobs.
Secure Store CI полностью PASS. [Результаты и ссылки на CI](docs/evidence/local-ci-2026-11-18/results.json).
На Mac установлен один Xcode 27.2 (`27B52`); CI использует тот же компилятор на
`xcode-27`, но версии macOS/SDK фиксируются отдельно. Xcode 16.4 не требуется.
Старые записи ниже о private-репозиториях пакетов, edge billing и недоступности
macOS runners заменены этими результатами. Это не новый npm-релиз и не merge в main;
у Secure Store `private: true` остаётся предохранителем публикации в npm.

2026-11-18: Release probe `9874e6c` на общем iPhone 18 Pro / iOS 27 Simulator:
Secure Store 10/10 и persistence после relaunch PASS, Crypto native smoke PASS,
lifecycle A/B background → active PASS. Клавиатура проверена на этой же финальной
сборке через opt-in native host input: `kb=349/g2` → Done → `kb=0/g3`,
`top=62/bottom=34` сохраняются. Это проверка симулятора; физический iOS Release
keyboard остаётся открытым. Предыдущая unsigned-сборка получала Keychain `-34018`;
Xcode теперь формирует только simulator entitlements, физическая подпись не изменена.

First-frame теперь **FAIL, 3/3 cold relaunch**, а не просто unverified: на записи
виден `top=0/bottom=0/g=-1 fallback`, затем контент смещается примерно на 62 pt
при `top=62/bottom=34/g1 globalProps`. Неправильный отступ различим около 120–128 мс.
261 декодированный кадр сверены с исходными видео; VFR-запись не доказывает каждый
физически показанный кадр, но подтверждает наблюдаемый дефект. Исправление ещё не принято.
Артефакты — `probe-e2e-android-verification/evidence-local/ios-keyboard-2026-11-18/`,
включая `frame-analysis/results.json` с PTS и контрольными суммами.

До stable остаются исправление first-frame с повторным QA, minimum OS,
физическая проверка iOS Release keyboard и OIDC/trusted publishing; audit блокирует
выпуск трёх пакетов. Для самой лаборатории подготовлен отдельный очищенный кандидат
истории и проверенный приватный архив оригиналов; публичная история ещё не опубликована.
Исходные worktree и refs сохранены. Удалено 8.32 ГиБ завершённых собственных native
fixtures ([receipt](docs/evidence/local-ci-2026-11-18/cleanup-fixtures.json));
около 6.5 ГиБ активной сборки probe пока сохранено для дальнейшего QA.

Ниже — история предыдущих проверок; актуальные границы и блокеры указаны выше.

2026-11-17: Android Release rotation подтверждён на общем Android16/API36 emulator.
Причина прежнего отказа — `screen_orientation=portrait` в Release host URL;
таймаут `1ms` был вторичным дефектом сообщения agent-device. Probe `e806327`
разрешает поворот как Debug и держит диагностические строки видимыми в landscape.
Проверены portrait → landscape-left → landscape-right → portrait, перенос inset
51.81 слева направо и восстановление верхнего inset. Итоговые screenshots и APK
сверены независимым reviewer. [Evidence](docs/evidence/android-rotation-2026-11-17/results.json).
First-visible-frame и физический Android rotation этим прогоном не подтверждены.
Свой probe удалён с эмулятора, session/Device panel закрыты, воспроизводимые
intermediates убраны; ранее работавший общий эмулятор оставлен включённым.

2026-11-17: task-ветки crypto/lifecycle/edge отправлены на GitHub для remote CI;
main не интегрирован, публикаций нет. Crypto JS/audit/Android прошли; macOS job
отменён GitHub после нескольких неудачных попыток выделить hosted runner. Чистый CI lifecycle выявил legacy `react.JSX` augmentation в
`@lynx-js/types@4.2.1`: локальный GlobalStore скрывал конфликт DOM/native refs.
Dev-only patch удаляет только legacy augmentation; строгие JSX/ref fixtures,
mutation control и version/hash guard сохраняют проверку типов. Lifecycle `d2eb9c2`
и edge `f226ff6`: full checks/audit проходят с isolated и clean hoisted,
независимое review завершено, runtime/dist bytes прежние. Повторный JS/audit/Android CI
lifecycle проходит; macOS job ещё ожидает runner.
Edge CI блокируется GitHub billing до выполнения steps; private repo отдельно
блокирует npm provenance. npm trust не удалось прочитать (E401), environments
отсутствуют; реальный OIDC exchange не проверен. [Readiness](docs/evidence/remote-ci-2026-11-17/oidc-readiness.json).

Ниже — предыдущие проверки; при расхождении приоритет у более новых записей выше.

2026-11-17: immutable release tooling готово локально: crypto `1508946`,
app-lifecycle `0d1106e`, edge-to-edge `327ca4f`. Два manual этапа release.yml
связывают final version/changelog, commit, tarball SHA и QA receipt; publish не
перепаковывает архив и повторяет audit. Все три full checks и по 33 release tests
проходят; parent повторил integration test, independent review без оставшихся
блокеров. [Evidence](docs/evidence/release-tooling-2026-11-17/results.json), D14.
Runtime/native/declarations побайтно прежние. Новые архивы — проверки tooling,
не финальные accepted releases. Remote CI/OIDC, настройка trust, выбор версий,
полная QA-матрица, merge/push/publish остаются отдельными шагами. Secure Store private.

2026-11-17: probe `6c21ab9` — три старые TS-ошибки устранены, устаревший App
test заменён двумя проверками реальных QA-панелей и cleanup подписок. Strict TS,
2/2 tests, Biome/scanner и JS build проходят; independent review без findings.
Upstream warnings тестового окружения остаются видимыми. Сохранённые native
сборки и ресурсы прежнего QA восстановлены побайтно; новая JS-сборка не прошла
новый device-прогон. [Evidence](docs/evidence/probe-quality-2026-11-17/results.json).

2026-11-17: дополнительный Release-прогон на общем Android16/API36 эмуляторе:
Secure Store 10/10 и persistence после relaunch, Crypto native smoke, lifecycle
A/B background g2 → active g3 прошли. Edge portrait snapshot: top51.81/bottom24/g1.
Rotation снова tool-blocked (`adb timed out after 1ms`), first-visible-frame не
подтверждён. [Evidence](docs/evidence/android-emulator-2026-11-17/results.json).
Установленный для прогона probe удалён, session и Device panel закрыты; общий
ранее запущенный эмулятор оставлен работающим, новых сборок/зависимостей нет.

2026-11-17: стандарт внедрён в рабочие ветки всех четырёх библиотек. Выполнены
strict TS, форматирование в 4 пробела, проверки native-кода, независимое review,
упаковка и проверки actual native source bindings в consumer. README EN/RU,
бейджи, таблицы поддержки и отдельные документы реализации/совместимости сохранены.

| Пакет | Текущий локальный commit | Проверенная граница |
|---|---|---|
| crypto | `1508946` | Physical Debug/Release и native contracts; повторный Release smoke в финальном профиле |
| secure-store | `006eb82` | Physical Debug/Release 10/10, persistence, direct Android 7/7; остаётся private |
| app-lifecycle | `d2eb9c2` | Physical Debug/Release, две JS-подписки, ранний Android background и настоящее Activity recreation; dev-only JSX patch |
| edge-to-edge | `f226ff6` | Debug/Release builds, реальные два view/late owner, Android16 Release rotation; dev-only JSX patch |

Финальный consumer: ReactLynx 0.125.0 / Rsbuild 2.1.10, Sparkling 2.1.0-rc.36 /
native Lynx 3.9.0. Probe source `6c57f33`, evidence `44f68fb`; [107 файлов evidence](docs/evidence/edge-2026-11-17/results.json).
Parent независимо сверил четыре tarball, source hashes, четыре bundle/binary и все
файлы двух iOS .app, matching Release dSYM; raw geometry logs и UIKit snapshots прочитаны.
Архивы crypto `9d510aa2`, secure-store `341fba16`, lifecycle `a4b85e8d`, edge `5c235a69`
прошли эту сборку. Последующее обновление только docs edge — архив `755956e6`;
65 остальных файлов идентичны проверенному `5c235a69`, нового device-прогона для docs нет.

Stable gate ещё открыт: first-visible-frame edge не подтверждён на обеих платформах;
Android Release rotation проверен на emulator, iOS Release keyboard не имеет host input.
Minimum OS и полный remote CI не подтверждены. Старые ошибки TS и App test пробника исправлены в `6c21ab9`;
собственные package checks проходят. Immutable release pipeline реализован; выпуск блокируется до
готовности final version/QA receipt и remote configuration; два dev audit exceptions имеют
срок пересмотра/expiry в декабре. Изменения сохранены в локальных невлитых task-ветках.

После проверки самодостаточности приложений удалены только воспроизводимые
`probe-e2e-android-verification/ios/build-device` и `android/app/build`: около 13 ГиБ,
[измерения и проверка владения](docs/evidence/edge-2026-11-17/parent-cleanup.json).
Артефакты, rollback, Pods, зависимости и worktree сохранены. Собственные процессы QA
завершены. Retired iOS recording state и helper bundle оставлены из-за смены ownership;
точные пути и ограничение — [cleanup.json](docs/evidence/edge-2026-11-17/cleanup.json).

2026-11-17: Secure Store migration принят для проверенного consumer-профиля.
Package `c350fce`, tarball `35c107ef060160b9559f5065734d790b9c46bdf0d292090c7b9014dc86877acd`:
65 package tests, strict TS, lint, native compile/analysis и независимое review.
Probe `855fdde` / evidence `8dffb04`: Android/iOS Debug/Release — по 10/10 сценариев,
persistence, Android R8; direct Android instrumentation — 7/7 на финальном архиве.
Четыре сборки проверяли `3f3aff`; финальный архив отличается только CONTRIBUTING
EN/RU, остальные 25 файлов идентичны, JS bundle и APK Debug совпадают побайтно.
[Результаты и границы](docs/evidence/secure-store-2026-11-17/results.json).
UTP старого AGP упал до запуска тестов; отдельная попытка Debug test APK поверх
Release также не прошла. Эти результаты не смешаны с успешным Release UI smoke.
Пакет остаётся private: locked-Keychain, поздний callback после teardown, minimum OS
и remote CI ещё не подтверждены. Runner/daemon завершены, данные устройств сохранены.

App-lifecycle: core `10af007`, tooling `196d912`; independent review нашло отсутствие
публикации initial background snapshot после ранней Android initialization.
Исправлено в `87a7b93`, Android Debug/Release/Lint/JVM checks и упаковка прошли.
Новый tarball `c8cabd693d35b308b53aa166e7644b8c5b555e78fd8dc4b1daa936e452b93529`.
Consumer/device QA завершена для отдельного candidate JS profile
ReactLynx 0.125.0 / types 4.2.1 / Rsbuild 2; старый probe 0.116.5 сохранён как
baseline и не удовлетворяет опубликованным peer ranges. Probe `e924fbc` собирает
новый JS profile без изменения native Lynx 3.9 / Sparkling 2.1.0-rc.36; точные
версии и причина — [D13](DECISIONS.md#d13--отдельный-reactlynx-0125--rsbuild-2-candidate).
Probe source `616c66a`, tooling patch `3cb55f3`, evidence `51ae596`: Android/iOS
Debug/Release — lifecycle events, две JS-подписки, отписка/повторная подписка;
отдельная Android instrumentation проверяет initial background до первой Activity
и её настоящее пересоздание. Release Secure Store 10/10 и crypto smoke прошли.
Parent сверил 68 evidence hashes, архивы, исходники, четыре embedded bundles и
бинарные артефакты. [Результаты](docs/evidence/lifecycle-2026-11-17/results.json).
React 0.125 testing-library не объявляет Vitest peer; добавлен metadata-only Bun
patch, 692 runtime файла идентичны. Команда test теперь стартует, но единственный
старый тест probe ожидает уже отсутствующий onMounted стартового шаблона и падает.
Это подтверждено baseline; приложение и тест ради проверки не переписывались.
Три прежние TS-ошибки probe сохраняются, собственные strict checks пакета проходят.
После patch изменились локальные пути некоторых зависимостей: старые tested
receipts сохранены; финальный consumer с edge затем собран и проверен отдельно,
результаты и ограничения приведены в начале файла.

Edge-to-edge: mechanical `a263844`, core/review fixes до `d1a9f15`, pipeline `5d0cdb4`,
README repair `2ba4bc3`. 31 JS, 12 binding и 5 JVM tests; strict TS, Android
Debug/Release/Lint, actual iOS store adapters, compile/static analysis прошли.
Independent review выявило и закрыло missing declarations и регистрацию позднего
preloaded owner. Tarball `5c235a69cfcb567cd23ca15d72495ce62fea84ebe346b03044fee118f6250232`
повторяется детерминированно; относительно `5d0cdb4` изменены только README EN/RU
и package description, 66 файлов идентичны. Consumer/device QA завершена с
ограничениями из итоговой матрицы выше; последнее обновление docs — `1d74031`.

Crypto source-binding backport `6805c374`, tarball
`c73335d3eb9ec10c4c25cd3513966da46995de733047ec6c0720e5bb4fa1a290`:
50 tests; относительно физически проверенного `11be0db` изменились только
CONTRIBUTING EN/RU и package.json, остальные 49 файлов идентичны. Новый candidate
использует этот архив; Release native smoke на обоих устройствах и actual native
source-binding gate подтверждены в lifecycle evidence выше.

2026-11-16: согласованы цель production-пакетов Lynx, поддержка Lynx + проверяемые
host (Sparkling первый), stable gate, 4 пробела и strict TS без усложнения архитектуры.
Зафиксированы [стандарт](docs/package-standard.md),
[порядок обновления host и SemVer](docs/compatibility-policy.md),
[эталонные конфиги](standards/README.md). Целевая матрица: рекомендуемая и предыдущая
поддерживаемая связка; непроверенная версия не получает verified автоматически.
Crypto pilot реализован в `refactor/package-standard-v1`, commit `9d1bd34`:
41 тест, strict TS, повторная упаковка, Android compile/Lint и отдельные ObjC
compile/static analysis прошли; независимое review выполнено, findings исправлены.
Consumer/device QA прошла: Pixel 9 / Android 17 и iPhone 11 / iOS 18.4.1,
Debug/Release (Android R8), Lynx 3.9.0 / Sparkling 2.1.0-rc.36.
Tarball `11be0db8735d435a58a4f1f4443b566d7ec4c5e0076519e063e78cee669adf2f`,
probe source `c3e957d`; parent сверил hash bundle во всех четырёх артефактах.
Native и отдельные failure-injection сценарии прошли, повторный native после
восстановления состояния тоже. Это smoke, не измерение энтропии.
[Результаты и raw evidence](docs/evidence/crypto-2026-11-16/results.json).
GitHub CI не запускался; минимум ОС и второй профиль совместимости не проверены.
Публикация заблокирована
до реализации выпуска именно проверенного финального tarball. Audit имеет два
срочных исключения, пересмотр до 2026-12-17. Пакет ещё не объявлен stable по новому
стандарту. Secure-store и app-lifecycle мигрируются; edge-to-edge прошёл read-only
аудит, его миграция впереди. Подтверждены прежние lifecycle multi-view/generation
дефекты и общий snapshot разных views в edge-to-edge; их исправления и специальные
regression/device проверки обязательны, прежний smoke их не покрывал.

2026-11-16: физический iPhone 11 / iOS 18.4.1 — обе библиотеки собраны и
проверены в Debug и Release на Lynx 3.9.0 / Sparkling 2.1.0-rc.36. Secure Store:
по 10/10 JS/native сценариев, autolink и сохранность после перезапуска процесса
и обновления Debug→Release поверх приложения. Release edge-to-edge: начальные
инсеты, refresh и поворот подтверждены.
edge-to-edge: начальные globalProps top=48/bottom=34, refresh, поворот
left=right=48/bottom=21, возврат в portrait и keyboardHeight 0→346→0 pt.
Клавиатура проверена через нативное поле debug-панели: Lynx input в старом
iOS-хосте не подключён. Стиль/скрытие баров на iOS остаются no-op в v1.
Дубли текста исправлены в probe `aeb2706`: незарегистрированный iOS `<input>`
мешал удалению поддерева при переключении панелей, поворот делал оставшиеся строки
заметными. Контролируемый эксперимент без input и возврат исходной сборки
подтвердили причину. Три цикла переключений/refresh/поворота без дублей,
Secure Store 10/10 на исправленном bundle. Native Release shell не менялся;
новая native Debug-сборка и повторный Android-прогон не выполнялись.
[Evidence исправления](docs/evidence/ios-rendering-2026-11-16/results.json).
iOS status bar оставлен native host: safe-area не требует его управления.
README/JSDoc пакета уточнены в `4fb75f1`, `docs/ios-host-contract`,
worktree `../lynx-edge-to-edge-ios-contract`; runtime API не менялся.
Сборка Xcode 27.2 требует override `IPHONEOS_DEPLOYMENT_TARGET=15.6` для старых
Pods; библиотечный минимум iOS 12 этим не проверен. Interceptor не подключился
(-1009, в Local Network runner отсутствует); QA выполнена через отдельную
сессию agent-device с корректной signing team.
Evidence: [iOS results.json](docs/evidence/ios-2026-11-16/results.json).
Публикации и интеграции веток не было; оставшиеся recovery/lifecycle проверки
перечислены ниже и в спецификации Secure Store.

2026-11-16: физический Pixel 9 / Android 17 — edge-to-edge и secure-store
проверены в debug и release с R8. Secure Store: 7 нативных тестов, по 10
JS/native сценариев, 3 Bun regression tests; сохранность после обновления APK
и перезапуска процесса подтверждена. Фактический runtime пробника — Lynx 3.9.0
(Sparkling 2.1.0-rc.36); `compileOnly` библиотек — 4.0.1, это разные версии.
Исправлены недоступный Android `Os.unlink`
и потеря NUL при передаче строк: JSON-конверт записи и percent-encoding ответа.
edge-to-edge: первый кадр, refresh, стили/скрытие баров, клавиатура, поворот,
жесты ↔ три кнопки прошли. Настройки телефона восстановлены.
Evidence: [results.json](docs/evidence/android-2026-11-16/results.json).
Код Secure Store: `6ea2ae6`, ветка `feat/secure-store`; пробник впервые сохранён
отдельным Git-репозиторием в `apps/probe-e2e`, рабочая ветка `test/android-libraries`
в `/Users/REDACTED_LOCAL_USER/Documents/dev/probe-e2e-android-verification` (`3d9bd65`).
На момент Android-прогона iOS ещё не был проверен; результат iPhone приведён выше.
Locked-device, reinstall/backup/restore и callback после уничтожения Lynx view
ещё не проверены. Оба пакета остаются private, публикации не было.
Старый host пробника выдаёт debug-предупреждение о 16-КиБ выравнивании зависимостей;
полный typecheck пробника имеет 3 старые ошибки, typecheck самого secure-store проходит.

2026-11-11: по просьбе Ильи удалены локальные node_modules, Pods, dist,
Android build/.gradle и обе iOS build-директории пробника; освобождено около
14 ГиБ. Исторические упоминания готовых APK/.app ниже больше не актуальны.
Исходники, lock-файлы, evidence, локальный tarball edge-to-edge и невлитые
worktree сохранены. Для продолжения нужны установка зависимостей и новые сборки;
сначала проверить свободное место. На тот момент тесты/сборки были отложены;
Android-проверку пользователь разрешил 2026-11-16, см. запись выше.

**Это первый файл, который надо прочитать, возвращаясь сюда после паузы.**
Он написан и для человека, и для модели, которая откроет репозиторий с нуля.

## Коротко

Пишем недостающие нативные пакеты для **Lynx** под скоупом `@lynx-lab`.
Два выпущены; edge-to-edge и secure-store проверены на физических Android и iPhone,
но ещё не опубликованы; границы проверки и оставшиеся сценарии приведены выше.

| Пакет | Состояние | Где |
|---|---|---|
| `@lynx-lab/crypto` | ✅ **1.0.3** | [npm](https://www.npmjs.com/package/@lynx-lab/crypto) · [repo](https://github.com/PopLocker714/lynx-crypto) |
| `@lynx-lab/app-lifecycle` | ✅ **1.0.0** | [npm](https://www.npmjs.com/package/@lynx-lab/app-lifecycle) · [repo](https://github.com/PopLocker714/lynx-app-lifecycle) |
| `@lynx-lab/edge-to-edge` | 🔨 **Pixel 9 и iPhone 11 проверены 2026-11-16**; iOS style/hidden — no-op, пакет private | [packages/lynx-edge-to-edge](packages/lynx-edge-to-edge) · [repo (private)](https://github.com/PopLocker714/lynx-edge-to-edge) · [спека](docs/packages/lynx-edge-to-edge.md) |
| остальные семь | 🗒 наброски | [docs/packages/](docs/packages/) |
| `@lynx-lab/secure-store` | 🔨 **Pixel 9 и iPhone 11 проверены 2026-11-16**; дополнительные recovery/lifecycle сценарии впереди, пакет private | [спека](docs/packages/lynx-secure-store.md) · [исследование](docs/secure-store-research.md) |

2026-11-09: secure-store исследован и написан по запросу Ильи. В плане 11 библиотек:
две выпущены, edge-to-edge и secure-store требуют проверок, семь не реализованы.
Результаты проверок остальных пакетов остаются от 2026-09-10.

Secure-store: основной локальный репозиторий `packages/lynx-secure-store`, код
в соседнем worktree `../lynx-secure-store-implementation`, ветка `feat/secure-store`.
Документация этой задачи — worktree `../lynx-lab-secure-store`, `docs/secure-store`.
Код сохранён commit `9e86957` в `feat/secure-store`; документация сохранена
в `docs/secure-store`. В main не влито; remote нового пакета не создан, публикации нет.
DevDependencies устанавливались без lifecycle scripts и удалены при уборке 2026-11-11.
Тесты, typecheck, нативные сборки
и устройства по просьбе Ильи не запускались. Подробности и отложенные сценарии — в отчёте.

## Если читать только одно

**[docs/01-platform-traps.md](docs/01-platform-traps.md) — сорок ловушек.**
Почти каждая выглядит как рабочий код и молча не работает. Ни одна не выводится
из документации Lynx: все найдены сборкой, чтением исходников или прогоном
на устройстве.

Пять, которые стоят дороже всех:

1. **T3** — исключение из нативного модуля **проглатывается** `@try/@catch` в
   `LynxModuleDarwin::InvokeMethod`. В JS приходит `undefined`. Все громкие ошибки
   строим в TS-фасаде, никогда в нативе.
2. **T4** — `sendGlobalEvent` до готовности рантайма **дропается с логом**.
   Начальное значение всегда берётся синхронным геттером, подпиской — никогда.
   Исключение: `__globalProps` буферизуется в `init_global_props_`, это единственный
   канал без дыры на холодном старте.
3. **T5** — методы модуля выполняются **инлайн на JS-потоке**, без хопа на main.
   Любое обращение к UIKit надо явно уводить в `DispatchQueue.main`.
4. **T28** — на iOS есть протокол **`LynxContextModule`**, и при conform к нему Lynx
   сам подставляет контекст через `initWithLynxContext:`. Autolink регистрирует
   **без param**, поэтому `initWithParam:` не вызовется никогда. **Без этого протокола
   нативный модуль на iOS не может отправить в JS вообще ничего.** В доках этого нет.
5. **T29** — наши пакеты собираются под **Java 11**, не 17. Шаблон Sparkling везёт
   Java 11 и Kotlin 1.8.10, и библиотека на 17 туда не встаёт.

## Что доказано на живом железе

Pixel 9 (Android 17, API 37) и iPhone 11 (iOS 18.4.1), пакеты ставились **из npm**,
не из локальной папки.

| | Android | iOS |
|---|---|---|
| Autolink нашёл библиотеку | да | да |
| kapt отработал, модуль зарегистрирован | да | да, через `LynxContextModule` |
| Нативные методы реально вызваны | да | да |
| `crypto`: `getRandomValues` вернул **тот же объект** | да | да |
| `crypto`: два вызова дали разные байты | да | да |
| `app-lifecycle`: `background gen=1` → `active gen=2` | да | да |
| Ошибка при вызове с главного потока | наше сообщение | наше сообщение |

**Вывод: конвейер работает end-to-end.** npm, Autolink, kapt на Android, гем и
`NSClassFromString` на iOS, регистрация, вызов, возврат значения, публикация с
provenance. Всё, что ломалось по дороге, ломалось **в шаблонах и версиях Lynx**,
а не в схеме.

## Пять вещей, которые удивили сильнее всего

1. **`env(safe-area-inset-*)` на Android починить нельзя.** Проверено на бинарнике:
   в `liblynx.so` из `lynx-4.0.1.aar` 670 динамических символов и **ноль** совпадений
   по `SAFE_AREA`, библиотека собрана с `-fvisibility=hidden`, JNI-пути нет.
   Плюс `dynamic_css_styles_manager.cc:208` содержит `case CSSValuePattern::ENV: // TODO: break;`
   — `ENV` вообще не зарегистрирован как динамическая зависимость стиля. Поэтому
   issue #299 висит с марта 2025 и структурно не чинится без правки движка.
2. **Официальный `create-lynx-library@0.5.2` генерит нерабочий проект.** Версии
   артефактов `0.0.1-alpha.1` не существуют на Maven Central, а маркер
   `@LynxNativeModuleRegister` не существует в исходниках Lynx. См. T12, T13, T27.
3. **Версии Android и iOS у Lynx разошлись.** 4.0.1 есть на Maven Central, но на
   CocoaPods стабильные кончаются на 4.0.0, и даже он не резолвится из-за конфликта
   `LynxServiceAPI`. Работает только 3.6.0 / 3.9.0. См. T19.
4. **`MessageEventType` содержит 24 события, в публичных типах объявлено 8.**
   Среди недокументированных `__OnAppEnterForeground`, `__OnAppFirstScreen`,
   `__OnNativeAppReady` и `__NotifyGlobalPropsUpdated`. Подписаться можно
   через `lynx.getCoreContext().addEventListener()`, он есть в публичных типах.
5. **`__OnAppEnterForeground` означает не то, что написано.** Это видимость
   **контейнера страницы**, а не жизненный цикл приложения: Sparkling зовёт
   `onEnterForeground()` из `onshow(params:)`, а на `UIApplication` не подписан никто.
   Проверено на устройстве: **ноль** событий при настоящем сворачивании.

## edge-to-edge: день 6, iOS (2026-09-10, симулятор iPhone 17)

Первый прогон показал `null` на первом кадре: кеш инсетов был верным, но `LynxView`
некому было зарегистрировать до `LoadApp`. Решение D10: глобальный `LynxViewLifecycle`
через `LynxEnv.lifecycleDispatcher`, `lynxViewDidStartLoading:` приходит синхронно из
`loadTemplateFromURL:` (T39). После него `render#1` на MTS и BTS видит `top=62 bottom=34`,
поворот даёт `l=62 r=62 b=20` и обратно. Две попутные ловушки: `@YES` в globalProps
это `1` в JS (T40), observer публиковал нули из `didMoveToWindow`. Логи JS на iOS через
`lynx.reportError` плюс `log show --last`. Скриншоты в `docs/evidence/edge-to-edge/ios-sim-*`.

## edge-to-edge: день 5, модуль (2026-09-10, эмулятор)

Все четыре метода `LynxEdgeToEdgeModule` вызваны из JS и проверены через `dumpsys window`
и скриншоты: `refresh`, `setSystemBarStyle` (`light` белые иконки, `dark` тёмные),
`setSystemBarHidden` (оба бара, `bottom` 24 → 0 → 24), клавиатура через `<input>`
(`keyboardHeight` 336.4 dp и обратно 0). Скриншоты в `docs/evidence/edge-to-edge/emu-module-*`.

Главная находка дня: **T38**. Autolink-реестр Android не перегенерируется при добавлении
библиотеки, и модуль четыре прогона подряд был не зарегистрирован, а инсеты при этом
работали, потому что идут мимо модуля. Лечится `rm -rf app/build/generated/source/lynxLibraryRegistry`.
Pixel 9 в этот заход не был подключён, модуль проверен только на эмуляторе.

## edge-to-edge: дни 2–5 (2026-09-05)

Пакет в `packages/lynx-edge-to-edge`, три коммита, приватный репозиторий на GitHub,
CI запущен. На Pixel 9 через стоковый rc-шаблон и тарбол: первый кадр с верными
инсетами на обоих потоках, трёхкнопочная навигация меняет `bottom` 24 → 48 → 24,
CSS-переменные наследуются, поворот даёт `left=65.9` от выреза на первом кадре. Полная таблица в спеке, раздел «Результат дней 2–5», скриншоты в `docs/evidence/edge-to-edge/`.

Две вещи, которые стоили по циклу сборки каждая, теперь в реестре: **T36** (React-вход
библиотеки обязан шипиться TSX-исходником, иначе `Snapshot not found: view`) и
bun-кеш тарболов (см. команды ниже). Решение D9.

## Спайк S6: edge-to-edge, день 1 (2026-09-05)

Вопрос, на котором держалась вся спека: успевает ли ранний `updateGlobalProps` стать
`init_global_props_`. **Ответ: да, но не с pre-draw.** Подробно в
[docs/spikes.md](docs/spikes.md), логи и скриншоты в `docs/spikes/s6/`.

| | Результат |
|---|---|
| Где | эмулятор AVD `twowe` (Pixel 7, Android 36) и **Pixel 9 (Android 17, API 37)**, результат совпал |
| Пуш с первого pre-draw | **проигрывает** `LoadApp`: на эмуляторе на 80–120 мс, на Pixel 9 на 1 мс. Первый экран с `null` (T31) |
| Пуш из `onActivityPostStarted` | **становится начальным значением** на MTS и BTS, запас ~50 мс |
| Инсеты в этот момент | `getRootWindowInsets` = `null`, `currentWindowMetrics` даёт верные (T32) |
| Ключи Sparkling после нашего пуша | уцелели, мерж делает `LynxTemplateRender` в Java (T33) |
| ContentProvider из library-модуля | смержился, пережил R8 в release |
| Исходники | `bts_runtime.cc:1123-1135`, `template_assembler.cc:251-270`, `js_app.cc:3085` @4.0.1; `SimpleLynxKitView.kt:74-75`, `SparklingActivity.kt:99-106` @rc.36 |

Решение зафиксировано как D8, спека поправлена в разделе «Результат спайка дня 1».

## Метод, который сработал

Он важнее любого отдельного факта, потому что все находки выше добыты именно так.

1. **Спайк до кода.** Каждый пакет начинается с проверки допущения, на котором держится
   архитектура. `app-lifecycle` начался с одной строки, и она **опровергла** удобную
   гипотезу за час вместо третьего дня.
2. **Читать исходники и бинарники, не документацию.** Документация Lynx врёт
   в нескольких несущих местах. `nm -D` по `.so` и `unzip` по `classes.jar` отвечают
   однозначно.
3. **Проверять на устройстве, а не на «должно работать».** Java 17 против Java 11
   нашлось только реальной сборкой в стоковый шаблон.
4. **Каждую находку сразу в реестр `T`.** Ловушка, оставленная в спеке одного пакета,
   будет заново найдена при работе над следующим. Так и случилось с T7–T13, их
   пришлось поднимать обратно.
5. **Текст ошибки — это функциональность.** Диагностическое сообщение окупилось
   на первом же запуске на устройстве (T18) и потом ещё раз на iOS.

## Окружение

| Что | Состояние |
|---|---|
| bun | 1.4.0, запинен в CI явной версией, `latest` **запрещён** |
| JDK | только 17. Шаблон просит **тулчейн** Java 11, лечится foojay-резолвером в `settings.gradle.kts` **после** блока `pluginManagement` |
| Android SDK | `~/Library/Android/sdk`, NDK 27, platforms 35/36/37 |
| Устройства | Pixel 9 по USB, iPhone 11 спарен (Developer Mode включён, Apple ID в Xcode залогинен). 2026-09-05 оба были offline |
| Эмулятор | AVD `twowe` (Pixel 7 профиль, Android 36, arm64, плотность 420), запасной вариант: `~/Library/Android/sdk/emulator/emulator -avd twowe` |
| npm | залогинен как `poplocker714`, 2FA на записи требует подтверждения в браузере |
| Публикация | по OIDC с provenance. **Долгоживущих токенов нет ни в одном репозитории** |

### Команды, которые работают

```sh
# новый пробник на rc-линии (в latest ломается Xcode 26)
bunx create-sparkling-app@rc <имя> --template-version rc

# ЕДИНСТВЕННАЯ правка стокового rc-шаблона под наши пакеты
#   android/app/build.gradle.kts: раскомментировать kapt(libs.lynx.processor)

# ставить пакет для проверки ТОЛЬКО из тарбола: bun add file: ломает iOS-автолинк (T30)
npm pack && bun add /путь/pkg.tgz
# ...но bun кеширует тарбол по name@version: повторный npm pack с той же версией
# в node_modules НЕ попадает (стоило одного цикла сборки 2026-09-05). Обновлять так:
rm -rf node_modules/@lynx-lab/<pkg> && mkdir -p node_modules/@lynx-lab/<pkg> \
  && tar xzf /путь/pkg.tgz --strip-components=1 -C node_modules/@lynx-lab/<pkg>

# логи жизненного цикла на iOS: --console-pty отваливается при сворачивании
xcrun simctl spawn booted log stream --style compact --predicate 'eventMessage CONTAINS "МАРКЕР"'

# пробнику нужен local.properties с sdk.dir и foojay-резолвер в settings.gradle.kts
printf 'sdk.dir=%s/Library/Android/sdk\n' "$HOME" > android/local.properties

# после bun add/remove любой Lynx-библиотеки реестр autolink НЕ перегенерируется (T38):
rm -rf android/app/build/generated/source/lynxLibraryRegistry

# пробник: для теста поворота в DebugDevUrlSupport.kt заменить screen_orientation=portrait на unspecified (T37)
# затем: adb shell wm user-rotation lock 1 … adb shell wm user-rotation free

# iOS-пробник: bundle install && bundle exec pod install в apps/probe-e2e/ios, затем
xcodebuild -workspace SparklingGo.xcworkspace -scheme SparklingGoInHouse -configuration Debug \
  -destination 'id=<sim-udid>' -derivedDataPath build build CODE_SIGNING_ALLOWED=NO -quiet
cd apps/probe-e2e && ./run-ios.sh cold    # логи через lynx.reportError, см. T24

# спайк S6 заново (Pixel или эмулятор): режимы predraw | earliest | none
cd apps/probe-e2e && ./run-spike.sh earliest pixel android/app/build/outputs/apk/release/app-arm64-v8a-release.apk

# факты по исходникам на теге, без памяти и без агентов
git -C upstream/lynx grep -n 'init_global_props_' 4.0.1 -- core
git -C upstream/sparkling grep -n 'updateGlobalProps' 2.1.0-rc.36 -- 'packages/sparkling-sdk/android/**/*.kt'
```

## Незакрытые хвосты

Закрыто 2026-09-10: vitest 4.1.11 во всех трёх пакетах (GHSA-82fw-gwwq-j7x9), в crypto
ещё `js-yaml` 4.3.2 через `bun audit fix` (GHSA-2883-xcg3-v3hh). Все три CI зелёные
на момент пуша. `bun audit` в CI падает на любой новой advisory, так что это будет
повторяться; лечится `bun audit fix`, не отключением проверки.


- [ ] **Включить trusted publisher** для `@lynx-lab/app-lifecycle` на npmjs.com.
      Первая версия опубликована локально, потому что npm не даёт настроить его
      до существования пакета. Поля: `PopLocker714`, `lynx-app-lifecycle`,
      `release.yml`, allowed actions `npm publish`
- [ ] **Trusted publisher для `app-lifecycle` упёрся в логин.** Профиль Chrome, которым
      управляет Interceptor (`interceptor-test`), не залогинен в npmjs.com, поэтому даже
      прочитать страницу `/access` нельзя. Либо Илья логинится в этом профиле один раз,
      либо ставит сам: `PopLocker714` / `lynx-app-lifecycle` / `release.yml`
- [ ] **Апстрим-трек** (медленный, отдельный): реализовать Android write path для
      safe-area и заменить `// TODO` на `dynamic_css_styles_manager.cc:208`.
      Правильно чинит #299 для всех, но зависеть от этого пакет не может
- [ ] **Predictive back** — одна строка `android:enableOnBackInvokedCallback="true"`
      в манифесте, но она молча убивает «нажми назад дважды» в `SparklingActivity`.
      Решение сознательное, см. [docs/packages/back-and-calls.md](docs/packages/back-and-calls.md)
- [ ] Проверить на устройстве, во что стоковый ReactLynx резолвит `<list>` по умолчанию

## Следующий шаг

Проверки на физических Pixel 9 и iPhone 11 разрешены и выполнены 2026-11-16;
актуальные границы и evidence — в начале этого файла. Историческая iOS-сборка
от сентября удалена при уборке 2026-11-11; не использовать её старый путь.

1. Для Secure Store остаются locked-device, reinstall/backup/restore и callback
   после уничтожения Lynx view. API и код проверены на runtime 3.9.0, не на 4.0.1.
2. Для edge-to-edge iOS style/hidden остаются ответственностью native host.
   Неработающие controls и незарегистрированный iOS input заменены пояснениями
   в probe; дубли устранены. При необходимости теста Lynx input на iOS его нужно
   отдельно подключить в host; весь старый host не сертифицирован для production.
3. Изменения сохранены в task-ветках, main не интегрирован. Перед релизом отдельно
   согласовать интеграцию, версии, публикацию и настройку OIDC; эта QA-задача
   не разрешает npm publish, push или изменение видимости репозиториев.

## Карта репозитория

| Файл | О чём |
|---|---|
| [docs/00-verdict.md](docs/00-verdict.md) | стоит ли вообще ставить на Lynx, с цифрами адопшна |
| [docs/01-platform-traps.md](docs/01-platform-traps.md) | **тридцать ловушек, главный файл** |
| [docs/02-modularity.md](docs/02-modularity.md) | почему один пакет, а не пакет на провайдера |
| [docs/03-ecosystem.md](docs/03-ecosystem.md) | что в экосистеме есть и чего нет |
| [docs/04-risk.md](docs/04-risk.md) | дистрибуция, Android Developer Verification |
| [docs/05-shop.md](docs/05-shop.md) | интернет-магазин: вчетверо дешевле мессенджера |
| [docs/packages/back-and-calls.md](docs/packages/back-and-calls.md) | predictive back и WebRTC-звонки |
| [docs/spikes.md](docs/spikes.md) | спайки S1–S6 и их результаты |
| `apps/probe-e2e/run-pkg.sh` | прогон пакета на устройстве по сценариям: cold, rotate, threebutton, background |
| `docs/spikes/s6/` | логи, скриншоты и код спайка S6 |
| `packages/`, `apps/`, `upstream/` | вложенные клоны пакетов, пробники, исходники апстрима на тегах. Не в git, см. `CLAUDE.md` «Раскладка на диске» |
| [DECISIONS.md](DECISIONS.md) | лог решений с обоснованием и условием пересмотра |
| [CLAUDE.md](CLAUDE.md) | правила работы в этом репозитории |
