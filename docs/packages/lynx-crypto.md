---
verified: 2026-08-21
lynx_version: 4.0.1
status: draft
---

# lynx-crypto

**Оценка: 3–4 дня.**

`getRandomValues`, `randomUUID`, SHA-256, HMAC.

## Почему нужен

`getRandomValues` и `crypto.subtle`: **0 результатов** и в `lynx-family/primjs`,
и в `lynx-family/lynx`. Всё дерево PrimJS (660 путей) не содержит ни одного файла
по `random|crypto|entropy`. Нет глобала `crypto`, нет `randomUUID`.

noble-curves, tweetnacl, libsignal отказываются работать без CSPRNG.
`Math.random` на QuickJS не считается.

## Что разблокирует

| Кому | Зачем |
|---|---|
| Магазин | ключи идемпотентности для платежей, идентификаторы установки, дедупликация |
| OAuth | PKCE требует SHA-256 |
| Мессенджер | вообще любое шифрование |

## Ключевое проектное решение

Обычный Native Module или N-API через `@lynx-js/weak-node-api`?

Аргументы за N-API: `getRandomValues` ожидается **синхронным** и часто зовётся
в тесных циклах крипто-библиотеками, а каждый вызов обычного модуля конвертирует
аргументы через `JSValueToPubValue` / `PubValueToJSValue`.

Ограничение: **одна NAPI-декларация на библиотеку**.

## Спецификация, которую надо соблюсти

- `crypto.getRandomValues(typedArray)` **заполняет и возвращает тот же самый**
  TypedArray, а не копию
- бросает `QuotaExceededError` свыше 65536 байт
- отвергает не-целочисленные типизированные массивы
- `crypto.randomUUID`: v4 из того же источника энтропии, корректные биты версии и варианта

Нативные API: `java.security.SecureRandom` и `SecRandomCopyBytes`.

## Открытый вопрос

Может ли библиотека установить глобал `crypto`, или это обязан делать сам автор
приложения. Глобалы Lynx ставятся в `lynx-core` (`index.card.ts`), где уже стоят
`Headers`, `AbortController`, `AbortSignal`, `URL`, `URLSearchParams`.

Рекомендация к обсуждению: **`crypto.subtle` не делать**. Отдать `getRandomValues`,
а дальше пусть noble-curves работает на чистом JS.

---

## Реализация начата: 2026-08-21

Репозиторий: **https://github.com/PopLocker714/lynx-crypto**
Пакет на npm: **`@lynx-lab/crypto`** (скоуп `@lynx-lab` выбран как общий для всех
пакетов; решение принято до первой публикации, потому что переезд между
unscoped и scoped после релиза стоит депрекейта).

### Решения, принятые при написании

**Форма моста: base64 `String`, а не `byte[]`.** `byte[]` действительно легальный
возврат (`LynxMethodWrapper.returnTypeToChar` даёт `'a'`) и прилетает в JS настоящим
`ArrayBuffer`. Но `String` это `'T'` из `commonTypeToChar`, ветки, общей для параметров
и возвратов, а на iOS он едет по `_C_ID` → `NSString`, самому исхоженному пути
в `PerformMethodInvocation`. При 16–32 байтах на вызов кодирование бесплатно.
`byte[]` это патч на 1.1, когда конвейер доказан.

**Спека WebCrypto соблюдена, хотя мутация на месте невозможна.** TypedArray через
мост не проходит вообще: `LynxJSIModule::invokeMethod` принимает аргумент только
если `o.isArrayBuffer()`, а `Uint8Array` этой проверки не проходит. И даже настоящий
`ArrayBuffer` копируется memcpy на границе JSI (`ValueUtils::ConvertPiperToArrayBuffer`)
и ещё раз на платформенном слое. Поэтому заполняет массив JS-обёртка, а не натив,
и тот же объект возвращается.

**iOS-половина на Objective-C, не на Swift.** Маркер `@LynxNativeModule("...")` это
препроцессорный макрос под `#if defined(__OBJC__)`, раскрывающийся в
`@class LynxNativeModuleMarker;`. В Swift он существовать не может, а регулярка гема
`cocoapods-lynx-library` требует ровно это написание.

### Новые находки, поднятые в T-пространство

Ни одна из них не была известна до написания кода:

- **T7** — Gradle-плагин Lynx прокидывает `-Alynx.library.packageName` только внутри
  `project.plugins.withId('kotlin-kapt')` и сам плагин **не применяет**. Без
  `id("org.jetbrains.kotlin.kapt")` и `kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")`
  в библиотеке `LynxLibraryProcessor.getProviderPackageName()` возвращает `""`
  и процессор выходит, не записав ни файла. Без ошибки.
- **T8** — конструктор Kotlin-модуля обязан быть **ровно** `(Context)` или
  `(Context, Object)`: `CommonModuleCreator.createModuleWrapper` делает
  `Context.class.equals(types[0])`, точное сравнение классов, наследники не подходят.
  Конструктор с `LynxContext` работает, только если наследоваться от `LynxContextModule`.
- **T9** — экспортируемые методы должны быть объявлены **на конкретном классе**:
  `findMethods()` зовёт `getDeclaredMethods()`, а не `getMethods()`, поэтому
  унаследованные `@LynxMethod` невидимы.
- **T10** — имя экспортируемого метода не должно начинаться с ARC selector family
  (`new*`, `copy*`, `init*`, `alloc*`, `mutableCopy*`): `PerformMethodInvocation`
  делает `[inv getReturnValue:&rawResult]` и `(__bridge id)` без передачи владения,
  поэтому +1 возврат утечёт или пере-освободится.
- **T11** — один плохой тип возврата **молча убивает весь модуль**, а не один метод:
  `LynxModuleWrapper.findMethods()` строит подписи в цикле по всем `@LynxMethod`.
- **T12** — `create-lynx-library@0.5.2` эмитит версии артефактов `0.0.1-alpha.1`,
  которых **не существует** на Maven Central (список версий начинается с `3.2.0-alpha.3`).
  Gradle их не разрешит. Если скаффолдить, это первое, что надо чинить.
- **T13** — `create-lynx-library@0.5.2` эмитит маркер `@LynxNativeModuleRegister`,
  которого в `lynx-family/lynx` не существует. Правильное написание `@LynxNativeModule`,
  и именно его ищет сканер гема.
