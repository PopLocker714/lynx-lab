---
last_updated: 2026-09-10
lynx_version: 4.0.1 (Maven) / 4.0.0 (CocoaPods)
sparkling: 2.0.1 (latest) / 2.1.0-rc.36 (rc)
bun: 1.4.0
---

# Состояние проекта

**Это первый файл, который надо прочитать, возвращаясь сюда после паузы.**
Он написан и для человека, и для модели, которая откроет репозиторий с нуля.

## Коротко

Пишем недостающие нативные пакеты для **Lynx** под скоупом `@lynx-lab`.
Два выпущены и проверены на живых устройствах, третий собран и доставляет инсеты на первый кадр на Pixel 9.

| Пакет | Состояние | Где |
|---|---|---|
| `@lynx-lab/crypto` | ✅ **1.0.3** | [npm](https://www.npmjs.com/package/@lynx-lab/crypto) · [repo](https://github.com/PopLocker714/lynx-crypto) |
| `@lynx-lab/app-lifecycle` | ✅ **1.0.0** | [npm](https://www.npmjs.com/package/@lynx-lab/app-lifecycle) · [repo](https://github.com/PopLocker714/lynx-app-lifecycle) |
| `@lynx-lab/edge-to-edge` | 🔨 **готов к 0.1.0 после железа**: Android (дни 1–5), JS-слой, release под R8, iOS (день 6, симулятор) и README (день 9) сделаны; остались iPhone 11 и Pixel 9 по проводу | [packages/lynx-edge-to-edge](packages/lynx-edge-to-edge) · [repo (private)](https://github.com/PopLocker714/lynx-edge-to-edge) · [спека](docs/packages/lynx-edge-to-edge.md) |
| остальные семь | 🗒 наброски | [docs/packages/](docs/packages/) |

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

**`@lynx-lab/edge-to-edge`, финиш.** По порядку:

1. iPhone 11 по проводу: холодный старт, `refresh()`, поворот (`apps/probe-e2e/run-ios.sh`
   плюс тап пальцем или `interceptor ios`). На симуляторе тапы не доставляются.
2. Pixel 9 по проводу: повторить день 5 (`./run-pkg.sh pixel <apk>` и тапы по координатам
   из `docs/evidence/edge-to-edge/emu-module-*.png`).
3. 0.1.0 через `release.yml` (README EN/RU уже написаны), сразу после публикации
   trusted publisher на npmjs.com: `PopLocker714` / `lynx-edge-to-edge` / `release.yml`.
   Репозиторий сделать публичным перед релизом.

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
