---
last_updated: 2026-09-05
lynx_version: 4.0.1 (Maven) / 4.0.0 (CocoaPods)
sparkling: 2.0.1 (latest) / 2.1.0-rc.36 (rc)
bun: 1.4.0
---

# Состояние проекта

**Это первый файл, который надо прочитать, возвращаясь сюда после паузы.**
Он написан и для человека, и для модели, которая откроет репозиторий с нуля.

## Коротко

Пишем недостающие нативные пакеты для **Lynx** под скоупом `@lynx-lab`.
Два выпущены и проверены на живых устройствах, у третьего пройден спайк дня 1.

| Пакет | Состояние | Где |
|---|---|---|
| `@lynx-lab/crypto` | ✅ **1.0.3** | [npm](https://www.npmjs.com/package/@lynx-lab/crypto) · [repo](https://github.com/PopLocker714/lynx-crypto) |
| `@lynx-lab/app-lifecycle` | ✅ **1.0.0** | [npm](https://www.npmjs.com/package/@lynx-lab/app-lifecycle) · [repo](https://github.com/PopLocker714/lynx-app-lifecycle) |
| `@lynx-lab/edge-to-edge` | 🧪 **спайк дня 1 пройден** (S6, эмулятор), дальше день 2: скелет в `packages/lynx-edge-to-edge` | [docs/packages/lynx-edge-to-edge.md](docs/packages/lynx-edge-to-edge.md) · [docs/spikes.md](docs/spikes.md) |
| остальные семь | 🗒 наброски | [docs/packages/](docs/packages/) |

## Если читать только одно

**[docs/01-platform-traps.md](docs/01-platform-traps.md) — тридцать пять ловушек.**
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

# логи жизненного цикла на iOS: --console-pty отваливается при сворачивании
xcrun simctl spawn booted log stream --style compact --predicate 'eventMessage CONTAINS "МАРКЕР"'

# пробнику нужен local.properties с sdk.dir и foojay-резолвер в settings.gradle.kts
printf 'sdk.dir=%s/Library/Android/sdk\n' "$HOME" > android/local.properties

# спайк S6 заново (Pixel или эмулятор): режимы predraw | earliest | none
cd apps/probe-e2e && ./run-spike.sh earliest pixel android/app/build/outputs/apk/release/app-arm64-v8a-release.apk

# факты по исходникам на теге, без памяти и без агентов
git -C upstream/lynx grep -n 'init_global_props_' 4.0.1 -- core
git -C upstream/sparkling grep -n 'updateGlobalProps' 2.1.0-rc.36 -- 'packages/sparkling-sdk/android/**/*.kt'
```

## Незакрытые хвосты

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

**`@lynx-lab/edge-to-edge`, день 2: скелет пакета** в `packages/lynx-edge-to-edge`
по шаблону `packages/lynx-app-lifecycle` (он новее crypto и уже на Java 11).
Android-код писать по D8, а не по исходному тексту спеки: пуш из
`onActivityPostStarted`, инсеты из `WindowMetrics`, pre-draw только для обновлений.
`docs/spikes/s6/Spike.kt` это готовая заготовка `EdgeToEdge.kt`.

S6 на Pixel 9 прогнан, результат совпал с эмулятором.

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
| `docs/spikes/s6/` | логи, скриншоты и код спайка S6 |
| `packages/`, `apps/`, `upstream/` | вложенные клоны пакетов, пробники, исходники апстрима на тегах. Не в git, см. `CLAUDE.md` «Раскладка на диске» |
| [DECISIONS.md](DECISIONS.md) | лог решений с обоснованием и условием пересмотра |
| [CLAUDE.md](CLAUDE.md) | правила работы в этом репозитории |
