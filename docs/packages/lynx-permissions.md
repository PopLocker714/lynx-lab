---
verified: 2026-08-21
lynx_version: 4.0.1
status: spec
estimate: 4.5–6 недель
defects_open: 9
---

# lynx-permissions

Запрос и проверка разрешений. Модель взята из `react-native-permissions` 5.6.1,
адаптирована под ограничения Lynx.

Имена свободны (проверено 2026-08-21): `lynx-permissions`, `@lynx-js/permissions`,
`react-lynx-permissions` — все 404 на npm.

## Раскладка

```
lynx-permissions/
  lynx.lib.json
  src/            index.ts results.ts permissions.ts native.ts mock.ts
  android/
    build.gradle.kts
    src/main/AndroidManifest.xml            ← ZERO <uses-permission>
    src/main/java/dev/lynxperms/
      LynxPermissionsModule.kt              @LynxNativeModule диспетчер
      Permissions.kt
      PermissionRequestActivity.kt
      RequestLog.kt
  ios/
    LynxPermissions.podspec                 корневой спек + 8 подспеков
    src/       LynxPermissionHandler.h LynxPermissionsModule.{h,m}
    handlers/  Camera/ Microphone/ PhotoLibrary/ PhotoLibraryAddOnly/
               LocationWhenInUse/ Contacts/ AppTrackingTransparency/ Notifications/
```

Экспорты: `.` (фасад), `./mock` (фейк для тестов), `./lynx.lib.json`.

## API

Никаких енумов: они не переживают мост. Автокомплит и проверка полноты берутся из
`as const` плюс индексных типов, то есть чисто на компиляции, а через мост едут строки.

```ts
// src/results.ts
export const RESULTS = {
  UNAVAILABLE: 'unavailable',
  DENIED:      'denied',
  BLOCKED:     'blocked',
  GRANTED:     'granted',
  LIMITED:     'limited',
} as const

export type PermissionStatus = (typeof RESULTS)[keyof typeof RESULTS]
```

Обе таблицы `PERMISSIONS.ANDROID` и `PERMISSIONS.IOS` делаем **настоящими замороженными
объектами**. RNP оборачивает чужую платформу в `Proxy` (`proxifyPermissions` в `src/utils.ts`),
чтобы не тащить 144 виндовых константы в бандл, и платит за это багом: его README
документирует `PERMISSIONS.ANDROID.POST_NOTIFICATIONS`, которого в исходной карте нет,
и в рантайме это `undefined`. У нас 18 строк, экономия того не стоит.

### Набор v1

Android (11): `CAMERA`, `RECORD_AUDIO`, `READ_CONTACTS`, `ACCESS_FINE_LOCATION`,
`ACCESS_COARSE_LOCATION`, `POST_NOTIFICATIONS`, `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`,
`READ_MEDIA_VISUAL_USER_SELECTED`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`.

iOS (7): `CAMERA`, `MICROPHONE`, `PHOTO_LIBRARY`, `PHOTO_LIBRARY_ADD_ONLY`,
`LOCATION_WHEN_IN_USE`, `CONTACTS`, `APP_TRACKING_TRANSPARENCY`.

Плюс отдельная пара `checkNotifications` / `requestNotifications`, потому что уведомления
не влезают в общий протокол (см. `P1`).

### Нативный контракт

```ts
type Native = {
  check(p: string): string
  checkMultiple(p: string[]): string[]
  request(p: string, cb: (s: string) => void): void
  requestMultiple(p: string[], cb: (s: string[]) => void): void
  shouldShowRequestRationale(p: string): boolean
  hasBeenRequested(p: string): boolean
  openSettings(type: string | null, cb: (ok: boolean) => void): void
  checkNotifications(): { status: string; settings: Record<string, boolean> }
  requestNotifications(cb: (r: {...}) => void): void
  missingUsageDescriptionKeys(): string[]
}
```

⚠️ Синхронность `check` и `checkNotifications` **отменяется дефектом `P1`**.
После его починки они становятся промисами.

## DENIED против BLOCKED

**Трюка с SharedPreferences в RNP больше нет.** Его удалили в 3.4.0 (PR #696), потому что
он ломает «Спросить в следующий раз» и «Только в этот раз» на Android 11+.
Текущая логика:

```
// внутри колбэка request(), и ТОЛЬКО там
results[0] == GRANTED                        → granted
shouldShowRequestPermissionRationale(perm)   → denied
иначе                                        → blocked
```

`check()` и `checkMultiple()` **не возвращают blocked никогда**: только granted, denied,
unavailable. У замены есть признанное автором ложное срабатывание: закрытие диалога
свайпом на Android 11+ рапортует BLOCKED. Наследуем и поведение, и изъян, потому что
альтернатива хуже.

`@sigx/lynx-permissions` 0.27.0 переизобретает ровно тот трюк, от которого zoontek
отказался в 2022. Плюс он Android-only, без JS-поверхности, и живёт внутри чужого
фреймворка со своим `signalx-module.json` и шагом `sigx prebuild`.

**На iOS деление точное и бесплатное.** `stringForStatus` в `RNPermissions.mm` мапит
шестизначный внутренний енум так:

| Внутреннее | RESULTS |
|---|---|
| `NotAvailable`, `Restricted` | `unavailable` |
| `NotDetermined` | **`denied`** |
| `Denied` | **`blocked`** |
| `Limited` | `limited` |
| `Authorized` | `granted` |

CoreLocation, AVFoundation и Photos отдают `notDetermined` отдельным случаем, поэтому
различить можно всегда.

**Персистентный флаг у RNP остался только на iOS**: `flagAsRequested:` / `isFlaggedAsRequested:`
пишут массив ID обработчиков в `NSUserDefaults` под ключом `@RNPermissions:Requested`.
Используется ровно тремя обработчиками, где енум ОС не отличает «не спрашивали» от
«спросили и частично отказали»: `LOCATION_ALWAYS`, `CALENDARS`, `FACE_ID`.
Это единственная запись в их `PrivacyInfo.xcprivacy` (CA92.1).

## Реестр дефектов

### P1 · Протокол из классовых методов не выражает два своих же случая
**Блокер · открыт**

`LynxPermissionHandler` объявлен как все-классовые-методы: `+ (NSString *)currentStatus`
и `+ (void)requestWithResolve:`. Ни инстанса, ни состояния. Это не работает дважды:

**(a) Уведомления.** У `UNUserNotificationCenter` нет синхронного аксессора статуса,
только `getNotificationSettings(completionHandler:)`. Доказательство структурное и лежит
в библиотеке, которую мы портируем: каждый обработчик RNP это
`RNPermissionHandlerCamera : NSObject<RNPermissionHandler>`, а
`RNPermissionHandlerNotifications.h` это `NSObject` **без conformance**, со своим
`- (void)checkWithResolver:`, потому что он не может дать `- (RNPermissionStatus)currentStatus`,
объявленный `@required`.

**(b) LocationWhenInUse.** `requestWhenInUseAuthorization` не принимает completion,
ответ приходит в `locationManagerDidChangeAuthorization:`. Обработчику RNP приходится
быть инстансом и держать оба куска состояния:

```objc
@property (nonatomic, strong) CLLocationManager *locationManager;
@property (nonatomic, strong) void (^resolve)(RNPermissionStatus status);
```

Классовые методы вынудили бы парковать это в файловых статиках, то есть вернуть тот самый
однослотовый дефект, который андроидная половина правильно и громко чинит через `SparseArray`.
Плюс `CLLocationManager` хочет поток с активным run loop, а Lynx зовёт методы модуля
инлайн на JS-потоке (`T5`).

**Чинить:** обработчики становятся инстансами `NSObject<LynxPermissionHandler>`;
обязательная форма протокола асинхронная (`- (void)checkWithResolve:`), с опциональным
синхронным быстрым путём там, где ОС его реально даёт (AVFoundation, Photos, Contacts, ATT);
диспетчер держит по инстансу на разрешение; CoreLocation уходит на main.
Следствие: `check`, `checkMultiple`, `checkNotifications` становятся промисами.

### P2 · `NSException` как громкая ошибка проглатывается
**Блокер · открыт**

См. `T3`. `LynxPermissionCheckUsageKeys` бросает из `- (NSString *)check:`,
исключение до JS не доходит, приложение получает `undefined` вместо статуса,
а фасад слепо кастует `native().check(p) as PermissionStatus`.

Тезис «падать здесь, называя ключ и куда его класть, строго лучше» под этим фреймворком
**развёрнут наоборот**: щадящий `#if RCT_DEV` лог у RNP выживает, а бросок нет.

**Чинить:** через границу Lynx не бросать никогда. Возвращать различимый статус
и опираться на `missingUsageDescriptionKeys()`, который в спеке и так есть.

### P3 · `s.dependency 'Lynx', '~> 4.0'` уронит `pod install`
**Важно · открыт**

Стабильный CocoaPods trunk для `Lynx` заканчивается на 4.0.1, а шаблон Sparkling
2.1.0-rc пинит под на **3.9.0**. `~> 4.0` это `>= 4.0, < 5.0`, набор требований
неразрешим, CocoaPods откажется резолвить.

**Чинить:** `s.dependency 'Lynx', '>= 3.9'`.

Смежное, не проверено: `compileOnly("org.lynxsdk.lynx:lynx:4.0.1")` против рантайма 3.9.0
скорее всего безопасен — `ContextUtils.getActivity(Context)` существует идентично на 3.9.0
и 4.0.1, `LynxContextModule(LynxContext)` с `protected LynxContext mLynxContext` стабилен.
Но `kapt("...lynx-processor:4.0.1")`, генерящий против 3.9.0, **не тестировался**.

### P4 · Дефолтная установка на iOS мертва и молча
**Важно · открыт**

`default_subspecs = :none` при неустановленном глобале это правильный выбор против
ловушки «`[]` значит все». Но результат: модуль регистрируется, `LynxPermissionHandlerFor()`
возвращает nil для всего, `check` и `request` отвечают `unavailable`, а
`missingUsageDescriptionKeys()` возвращает пустой массив, **потому что обработчиков
не скомпилировано**.

`RESULTS.UNAVAILABLE` документирован как «функция недоступна на этом устройстве»,
значит приложение не отличит «забыл строку в Podfile» от «на этом айпаде нет камеры».
`Pod::UI.warn` при `pod install` просто улетает в скролл.

**Чинить:** добавить `getCompiledHandlers(): string[]`, в фасаде бросать именованную
ошибку на iOS при пустом списке.

### P5 · На Android два разных `unavailable` неразличимы
**Важно · открыт**

`Permissions.check` возвращает `unavailable` и при реальном промахе по версии API,
и для разрешения, которое хост забыл объявить в манифесте. Отличаются только записью
в `Log.e`. Это андроидный близнец `P4`.

**Чинить:** `declared(context)` уже вычисляет нужное. Добавить
`missingManifestPermissions(permissions: string[]): string[]` или свести оба случая
в один `diagnostics()`. Около пятнадцати строк.

### P6 · Подавленный запуск Activity вешает промис навсегда
**Важно · открыт**

`startActivity` из `applicationContext` с `FLAG_ACTIVITY_NEW_TASK` на JS-потоке.
На MIUI, HyperOS и ColorOS фоновый старт активити режут, и это **ровно целевой рынок**.
Если запуск подавлен, запись в `pending[code]` никто не заберёт, промис не зарезолвится
никогда, экран висит.

**Чинить:** таймаут на запись в `SparseArray`, по нему резолвить значением `check()`,
снятым до запроса. Заблокированный запуск деградирует в `denied`, а не в вечное ожидание.

### P7 · Лишний хоп на main в колбэке
**Мелочь · открыт**

`dispatch_async(dispatch_get_main_queue(), ^{ callback(status); })` внутри
`request:callback:` бессмыслен: `ConvertModuleCallbackToCallbackBlock` уже маршалит
на JS-поток через `lock_delegate->InvokeCallback`. Проход через main только добавляет
способ подвиснуть, если main занят.

Но `openSettings` **обязан** быть на main: `openURL:options:completionHandler:`
main-thread-only, и в спеке его реализация не показана вообще.

### P8 · Опечатка в `methodLookup` даёт `undefined`, а не ошибку
**Мелочь · открыт**

Запись с несуществующим селектором молча пропускается при конструировании
(`if (msig == nil) { /* TODO (liujilong): Log this. */ continue; }`), а потом падает
пойманным `NSInvalidArgumentException` при вызове.

**Чинить:** проверка таблицы на `prepack`. Касается обоих пакетов.

### P9 · Формулировка про privacy manifest вводит в заблуждение
**Мелочь · открыт**

«v1 не везёт privacy manifest, потому что не трогает декларируемые API» верно про SDK,
но линковка `AppTrackingTransparency` и вызов `requestTrackingAuthorization` обязывают
**потребляющее приложение** объявить трекинг в своём privacy manifest.

**Чинить:** строка в README.

## Что сделано правильно, не трогать

Андроидная половина это сильнейшая инженерная часть обеих спек:

- `SparseArray` по коду запроса вместо одного слота
- `markRequested` **до** показа промпта
- фильтрация `toAsk` через предварительный `check`
- осознанный отказ возвращать трюк с SharedPreferences
- **ноль `<uses-permission>`** в манифесте библиотеки

Последнее принципиально. Библиотека **могла бы** мержить разрешения (манифесты библиотек
мержатся через AGP, и `@amritk/lynx-location` так и делает с `ACCESS_FINE_LOCATION`),
но не должна: объявленное и неиспользуемое разрешение это проблема листинга в сторе.
RNP поступает так же — его `android/src/main/AndroidManifest.xml` это голый `<manifest>`
с нулём `<uses-permission>`.

## Ручная работа автора приложения

| Платформа | Что руками | Почему нельзя автоматизировать |
|---|---|---|
| iOS | `$LynxPermissions = [...]` в Podfile, ключи usage description в `Info.plist` | у Sparkling нет config-плагинов: `AppConfig.plugin` объявлен типом, но не читается ни одной строкой кода |
| Android | строки `<uses-permission>` в манифесте приложения | технически мог бы пакет, но не должен (см. выше) |

## План

| Дни | Что |
|---|---|
| 1–2 | Каркас, `lynx.lib.json` по образцу `@amritk/lynx-location`, спайки `S1` и `S2` |
| 3–6 | Android целиком: диспетчер, `PermissionRequestActivity`, `SparseArray`, `RequestLog`, таймаут `P6`, `missingManifestPermissions` `P5` |
| 7–16 | **iOS: переделать протокол под `P1`, затем восемь обработчиков.** Здесь перерасход: оценка 8×55 строк калибрована по коротким обработчикам RNP (Camera это 25 строк) и игнорирует, что Location и Notifications это две длинные и две ломающие протокол |
| 17–20 | Подспеки, `GCC_PREPROCESSOR_DEFINITIONS`, `#if`-цепочка, `getCompiledHandlers` `P4` |
| 21–30 | TS-фасад с громкими ошибками (в TS, не в нативе), `mock`, проверка таблицы на prepack, пример на обеих платформах в release |

**4.5–6 недель.** Первая оценка 2.5–3 недели умерла вместе с `P1`.
