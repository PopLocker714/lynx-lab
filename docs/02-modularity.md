---
verified: 2026-08-21
lynx_version: 4.0.1
status: spec
---

# Модульность и обнаружение

Как сделать пакет, у которого части подключаются по выбору и не тянут в сборку то,
что не выбрано. Нужно и для провайдеров пушей, и для обработчиков разрешений.

## Почему не пакет на провайдера

Решение `D1`. Схема «ядро плюс `lynx-notify-fcm`, `lynx-notify-hms`, …» на Lynx 4.0.1
не собирается, и это проверено с обеих сторон.

**Android.** `LynxLibrarySettingsPlugin` делает только `settings.include(projectPath)`
и ставит `projectDir`. `LynxLibraryBuildPlugin.configureAndroidConsumer` добавляет каждую
найденную библиотеку безусловным `implementation project(...)` **в приложение**,
никогда в другую библиотеку. Значит `lynx-notify-fcm` не может скомпилироваться против
интерфейса `LynxPushProvider` из `lynx-notify` без публикации артефакта в Maven или
хардкода внутреннего пути `:lynx_library_<mangled>`.

Источник: `platform/android/lynx_library_plugin/src/main/groovy/org/lynxsdk/library/`,
файлы `LynxLibraryBuildPlugin.groovy` и `LynxLibrarySettingsPlugin.groovy` на теге 4.0.1.

**iOS.** `Autolink.install!` пишет ровно:

```ruby
podfile.pod pod_name, :path => File.dirname(library.podspec_path)
```

Ни `:subspecs`, ни опций. А второй `pod 'LynxNotify/FCM'` в Podfile хоста ловит
`Analyzer#verify_no_pods_with_different_sources!`, потому что `nil` и `{:path=>'/abs'}`
для CocoaPods разные источники.

Источник: `tools/ios_tools/cocoapods-lynx-library/lib/lynx/library/autolink.rb` на 4.0.1.

## Значит: один пакет, выбор на этапе сборки

| Платформа | Механизм | Чем рулит |
|---|---|---|
| Android | свойство в **корневом** `gradle.properties`: `lynxNotify.providers=fcm` | дополнительные `java.srcDirs`, дополнительные `implementation(...)`, какие фрагменты манифеста попадут в сборку |
| iOS | глобал в Podfile `$LynxNotifyProviders = ['apns']`, читается в podspec, задаёт `default_subspecs` | какие подспеки компилируются; плюс каждый подспек ставит `GCC_PREPROCESSOR_DEFINITIONS`, а диспетчер обёрнут в `#if`, поэтому символы невыбранных фреймворков не линкуются вообще |

Android читает именно **корневой** `gradle.properties`, потому что библиотека это обычный
сабпроект хостовой сборки и её собственный `gradle.properties` для project properties
игнорируется. Это единственный надёжный канал.

### Почему глобал Podfile виден в podspec

`Specification.from_string` вызывает `Pod::_eval_podspec`, а это `eval(string, nil, path)`
в том же процессе Ruby и уже **после** чтения Podfile. Проверено локально на
cocoapods-core 1.17.0: `$LynxNotifyProviders = ['apns']` дал
`default_subspecs: ["Core","APNs"]`, а `subspec_dependencies` для голой корневой
зависимости резолвнулся ровно в `["LynxNotify/Core","LynxNotify/APNs"]`.

Прецедент в живой природе: `RNFBApp.podspec` так читает `$RNFirebaseAsStaticFramework`.

### Ловушка, из-за которой механизм даёт обратный эффект

Пустой выбор обязан мапиться в **`:none`**, а не в `[]`.

`Specification#subspec_dependencies` резолвит голую корневую зависимость:

- в `default_subspecs`, если оно задано
- **во все подспеки**, если это `[]`
- ни во что, если `:none`

То есть приложение, забывшее глобал, соберёт **все** обработчики и получит отказ ревью:
ровно то, ради чего механизм и делался.

### Чем это лучше setup_permissions у zoontek

В `react-native-permissions` скрипт `scripts/setup.rb` делает `gsub` прямо по файлу
`node_modules/react-native-permissions/RNPermissions.podspec`, переписывая `s.source_files`
и `s.frameworks`, а `ios/RNPermissions.mm` оборачивает каждый импорт и каждую ветку
диспетчера в `#if __has_include("RNPermissionHandlerX.h")`.

Работает, но у автора же признано (issues #906 iOS+tvOS, #942 multi-app): правится файл,
а не под, поэтому настройка **глобальна для пакета и не может отличаться от таргета
к таргету**. Его собственный пример зовёт `setup_permissions` на верхнем уровне Podfile,
вне `target do`. Плюс нужен guard на `prepack`, потому что `pod install` пачкает
опубликованный файл.

Подспеки таргето-специфичны по построению и ничего не правят на диске.

### Историческая справка, чтобы не изобретать заново

- v1.x компилировал все обработчики → Apple требовала все usage description → отказы (#240, #266)
- v2.0.0 переписан «чтобы не встраивать лишние обработчики и не получить негативное ревью»
- v2–v3: **один podspec на разрешение** (`pod 'Permission-Camera'`)
- 3.9.0: заменено на `setup_permissions`, потому что per-podspec ломался под хойстингом монорепо
- 4.0.0: per-permission podspecs удалены

## Обнаружение: рефлексия, и это механизм самого Lynx

Ядро **не спрашивает** реестр Lynx: реестр регистрирует Native Modules, а провайдеры
и обработчики это не модули. Вместо этого фиксированная таблица пар `(id, className)`,
каждая проверяется рефлексией. Некомпилированный класс просто отсутствует.

```java
// Android — LynxLibraryRegistry.setupProvider делает ровно это
Class.forName(name)   // внутри catch (Throwable t) { LLog.w(TAG, "Skip unavailable ...") }
```

```objc
// iOS — так гем генерирует КАЖДУЮ строку реестра
if (NSClassFromString(@"X")) { [config registerModule:...]; }
// а сам реестр находится через objc_getClass("LynxGeneratedLibraryRegistry")
```

То есть если рефлексия не сработала, то autolink уже сломан сам по себе.

### Два условия, оба проверены

**R8 на Android.** Шипованные `consumerProguardFiles` Lynx кроют классы с
`@LynxNativeModule` и `* implements LynxLibraryProvider`, но **не наши провайдеры**.
Поэтому каждый провайдер несёт `androidx.annotation.Keep`, а пакет везёт свой
`consumerProguardFiles` с `-keep class dev.lynxnotify.providers.** { *; }`.

**Dead stripping на iOS.** `NSClassFromString` требует, чтобы объектный файл был слинкован.
CocoaPods добавляет `-ObjC`, когда `pod_targets.any?(&:build_as_static?)`, а
`build_as_static?` это `build_type.static?` — истина для шаблона Sparkling с
`use_frameworks! :linkage => :static`. Проверено в шаблонном Podfile и в cocoapods 1.17.0
(`target.rb:129`, `build_settings.rb:1321`).

**Задокументированный режим отказа:** приложение, перезаписавшее `OTHER_LDFLAGS` без
`$(inherited)`, теряет `-ObjC`, и тогда молча отваливается **весь** autolink Lynx,
не только наш.

### Поэтому в публичном API обязателен интроспектор

`getLinkedProviders(): string` и `getCompiledHandlers(): string[]`. Одна строка из JS
вместо диагностики по пустой карте токенов. Это не удобство, а единственный способ
отличить «не настроил» от «не поддерживается устройством». См. дефекты `P4` и `N-интроспекция`.

## Регистрация самого модуля

**Android:** `@LynxNativeModule(name = "LynxNotify")` на классе модуля. Форма аннотации
проверена: `@Target(TYPE) @Retention(RUNTIME) public @interface LynxNativeModule { String name(); }`
в `platform/android/lynx_processor/.../LynxNativeModule.java`. `LynxLibraryProcessor`
эмитит `registry.registerModule($S, $T.class)` в один `LynxLibraryProviderImpl`.

**Не забыть:** плагин прокидывает `-Alynx.library.packageName=...`, но процессор не добавляет.
`kapt("org.lynxsdk.lynx:lynx-processor:4.0.1")` объявляет сама библиотека.

**iOS:** маркер пишется как `@LynxNativeModule("LynxNotify")` непосредственно перед
`@implementation` или `@interface`.

### Спор про имя макроса, разрешён

Доки говорят `@LynxNativeModule` / `@LynxElement`, а часть шипованных шаблонов
использует `@LynxNativeModuleRegister` / `@LynxUIRegister`. **Правы доки.**

- Заголовки Lynx на теге 4.0.1 определяют `LynxNativeModule` и `LynxElement` как макросы,
  разворачивающиеся в маркерные forward-декларации
- Сканер, шипуемый в геме, грепает `@LynxNativeModule` и `@LynxElement` и не содержит
  ни одного вхождения написания с `Register`
- Code search по `lynx-family/lynx` на `LynxNativeModuleRegister` и `LynxUIRegister`
  даёт 0 попаданий каждый
- Единственная реальная сторонняя Autolink-библиотека, `lynx-screens`, использует `@LynxElement`

То есть **сломан шаблон**, а не документация: он эмитит неопределённый макрос,
который ничем не сканируется.

## `lynx.lib.json`

Форма скопирована с `@amritk/lynx-location@0.2.1`, прочитанного из npm-тарбола:

```json
{"platforms": {
  "android": {"packageName": "dev.lynxperms", "sourceDir": "android"},
  "ios": {"sourceDir": "ios", "podspecPath": "ios/LynxPermissions.podspec"}}}
```

Важно: гем сканирует `library.source_dir` из манифеста
(`Dir[File.join(source_dir, '**/*.{h,m,mm,swift}')]`), а **не** `source_files` из podspec.
Поэтому он выпустит строку реестра для любого аннотированного класса, даже из исключённого
подспека, а каждая строка обёрнута в `if (NSClassFromString(...))`. Нескомпилированный класс
это тихий пропуск, а не ошибка линковки.
