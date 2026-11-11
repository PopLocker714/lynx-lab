# Secure Store для Lynx: исследование и выбор

Дата: 2026-11-09. Задача: хранение токенов для авторизации в ReactLynx/Sparkling.
Проверены опубликованные исходники; тесты, компиляция и устройства исключены
по запросу пользователя. Наличие кода не доказывает нативную совместимость.

Код: `../lynx-secure-store-implementation`, ветка `feat/secure-store`.
Локальный репозиторий: `packages/lynx-secure-store`; remote не создан.
Код сохранён commit `9e86957` в `feat/secure-store`, интеграция в main отложена.
Отчёт и исходные snapshots сохранены в Git в ветке документации; находятся в worktree
`../lynx-lab-secure-store`, ветка `docs/secure-store`.

## Вывод

Готовые Lynx-библиотеки **есть**. Проверены npm-тарболы трёх кандидатов, а не
только их README. Ни один не принят без изменений: причины ниже относятся к
конкретным проверенным версиям, а не ко всем будущим релизам проектов.

Для нашего небольшого API выбран самостоятельный `@lynx-lab/secure-store`:
существующий шаблон @lynx-lab/autolink, Keychain на iOS, платформенный
AES-GCM + Android Keystore на Android. Без Expo/RN runtime и без биометрии в v1.
Это инженерный выбор, а не результат сравнения производительности или аудита безопасности.

## Готовые пакеты

### @amritk/lynx-secure-storage 0.2.0

**Подтверждено кодом [HIGH].** MIT, `lynx.lib.json`, Objective-C/Kotlin,
зависимость `@amritk/mini-lynx-native@0.2.2`. Это ближайший вариант по механике
autolink; адаптация возможна, несовместимость с ReactLynx не заявляется.

Причина не брать целиком: `SecureStore.withStore` ловит `Exception` от операции,
затем запускает `openOrRecover(force = true)`, который удаляет preferences и
master key. Следующий read может получить отсутствие записи после скрытого
сброса. Нам нужен отказ, который приложение отличит от отсутствия токена.
Это непосредственно видно в `android/.../SecureStore.kt`, а не гипотеза из README.

Источники: [npm](https://www.npmjs.com/package/@amritk/lynx-secure-storage),
[исходники](https://github.com/amritk/mini/tree/c2516a9f0a935e9e8e1eda316d651ac48e0ccc71/packages/lynx-secure-storage).
Локальная копия: `.research/secure-store/amritk/package/`.

### @tamer4lynx/tamer-secure-store 0.0.3

**Подтверждено кодом [HIGH].** npm metadata указывает MIT. API похож на Expo,
используется `NativeModules.SecureStoreModule`, без JS runtime dependency.

`dist/src/SecureStore.js`: отсутствующий модуль приводит к `null` при чтении
и успешному завершению `setItemAsync`/`deleteItemAsync` без сохранения.
В Gradle используются `libs.lynx`, `libs.lynx.jssdk`, `libs.lynx.trace`, Java 17;
манифест подключения — `lynx.ext.json`, а не схема наших `lynx.lib.json`.
Android создаёт отдельный Thread на вызов. Подключение к Sparkling потребует
адаптации и проверки; простой установки зависимости недостаточно доказать.

Источник: [npm](https://www.npmjs.com/package/@tamer4lynx/tamer-secure-store).
Локальная копия: `.research/secure-store/tamer4lynx/package/`.

### @sigx/lynx-secure-storage 0.35.0

**Подтверждено кодом [HIGH].** MIT, зависимость `@sigx/lynx-core@^0.35.0`,
`signalx-module.json`, Swift/Kotlin, подключение через инфраструктуру SignalX.
Есть биометрия, что расширяет API и набор сценариев проверки.

JS использует `callAsync` из lynx-core. Android-конфигурация содержит
`androidx.security:security-crypto:1.1.0-alpha06`. В iOS `set` сначала вызывает
`SecItemDelete(baseQuery)`, затем `SecItemAdd`: отказ добавления после удаления
оставит запись потерянной. Для обычной перезаписи токена нам нужен `SecItemUpdate`.

Источники: [npm](https://www.npmjs.com/package/@sigx/lynx-secure-storage),
[документация использования](https://sigx.dev/lynx/modules/secure-storage/usage/).
Локальная копия: `.research/secure-store/sigx/package/`.

## Что ещё можно переиспользовать

- **Expo SecureStore.** Нативные механизмы подходят как референс, но Swift-код
  импортирует ExpoModulesCore, Kotlin тоже завязан на Expo-модуль и его helpers.
  Это не готовая Lynx-зависимость. API из трёх async-операций удобно повторить,
  не обещая совместимость со всеми Expo options.
- **react-native-keychain.** Подходит для RN bare. В проверенном Kotlin-модуле
  используются `com.facebook.react.bridge.*`, ReactModule и React Native
  context. Для Lynx потребовался бы другой мост; перенос полного API с биометрией
  сейчас избыточен.
- **AndroidX EncryptedSharedPreferences.** Готовая криптографическая обёртка,
  но AndroidX пометил все security-crypto API deprecated в пользу платформенных
  API и прямого Android Keystore. Для нового пакета выбрана текущая рекомендация.
  Deprecation сама по себе не доказывает уязвимость существующих библиотек.
- **MMKV с шифрованием.** Ключ `cryptKey` передаёт вызывающий код. Управление
  защищённым ключом всё равно придётся реализовать отдельно; для нескольких
  токенов это не сокращает нашу задачу.
- **sparkling-storage.** В локальном Sparkling Android использует обычные
  SharedPreferences; iOS template содержит StorageServiceImpl на UserDefaults.
  Это не наш secure store. Утверждение стороннего README «на iOS вообще нет
  реализации» нельзя переносить на шаблон хоста: там реализация найдена.

## Выбранный контракт и архитектура

Минимальный профиль библиотеки: TS фасад → Lynx callback bridge → платформенное
хранилище. Нет UI, providers, FSD или зависимостей от чужих JS-рантаймов.
Public API: `getItemAsync`, `setItemAsync`, `deleteItemAsync`,
`SecureStoreError`, `MAX_VALUE_BYTES`. Владение ключами, шифрованием и диском —
нативный слой; JS проверяет аргументы и ответ, представляет отказы как Promise rejection.
Login/refresh/logout orchestration и отзыв серверной сессии — приложение.

Ключи: ASCII `[A-Za-z0-9._-]`, 1–256 символов; значения: корректный Unicode,
до 16 KiB UTF-8. Это выбранный предел нашего token-store, не лимит ОС.
Отсутствие = `null`; ошибка никогда не означает отсутствие. Никакой
автоматической очистки при повреждении, потере ключа или блокировке.

Android: отдельный AES-256-GCM ключ Keystore на запись; случайный nonce;
AAD привязывает запись к ключу/namespace; ciphertext в `noBackupFilesDir`,
файл записывается через temporary + sync + rename. Нет общей mutable preferences
карты и замены backup-настроек приложения. Все операции одной последовательной
очередью на процесс. Multi-process доступ не поддерживается.

iOS: отдельный service + account, synchronizable=false,
AfterFirstUnlockThisDeviceOnly, `SecItemUpdate` для существующего значения.
Это доступ после первого unlock, а не запрет чтения при каждой блокировке.
ThisDeviceOnly означает отсутствие миграции на другое устройство, не отсутствие
любого backup. Reinstall может оставить Keychain; автоматического first-run wipe нет.

Угрозы за пределами API: исполнение чужого JS в доверенном приложении,
компрометация процесса/ОС, гарантированное стирание JS-строк в памяти.
Аппаратную защиту ключей для любого устройства не обещаем.

## Источники платформ и референсов

Проверены 2026-11-09; snapshots изменяемых raw-файлов и SHA-256 перечислены
в `.research/secure-store/sources.json`. npm metadata с версиями и integrity
сохранены в `<candidate>/registry.json` рядом с распакованным tarball.

1. [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/) — API, ограничения и persistence.
2. [Expo iOS source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-secure-store/ios/SecureStoreModule.swift).
3. [Expo Android AES source](https://raw.githubusercontent.com/expo/expo/main/packages/expo-secure-store/android/src/main/java/expo/modules/securestore/encryptors/AESEncryptor.kt).
4. [RN Keychain Kotlin](https://raw.githubusercontent.com/oblador/react-native-keychain/master/android/src/main/java/com/oblador/keychain/KeychainModule.kt).
5. [Android Keystore](https://developer.android.com/privacy-and-security/keystore) — неэкспортируемые ключи и границы hardware backing.
6. [AndroidX Security release notes](https://developer.android.com/jetpack/androidx/releases/security#1.1.0-beta01) — deprecation security-crypto.
7. [Context.noBackupFilesDir](https://developer.android.com/reference/android/content/Context#getNoBackupFilesDir()) — каталог вне автоматического backup.
8. [Apple Keychain](https://developer.apple.com/documentation/security/keychain-services).
9. [Apple AfterFirstUnlockThisDeviceOnly](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly).
10. [MMKV encryption](https://github.com/Tencent/MMKV/wiki/android_advance#encryption) — caller-owned cryptKey.
11. Локальный Sparkling `c4ce8d25c5ea277e13752d68ff1f2a66f5704240`:
    `packages/methods/sparkling-storage/`, `template/sparkling-app-template/ios/SparklingGo/SparklingGo/MethodServices/StorageServiceImpl.swift`.
12. Локальный Lynx `53f070c8ce50a1661e7f6db248af9c2b04b29d81`:
    `platform/android/lynx_android/src/main/java/com/lynx/jsbridge/CallbackImpl.java`,
    `platform/darwin/common/lynx/public/module/LynxModule.h` — callback контракт.

## Граница результата

Два прохода поиска по secure-store/secure-storage/Keychain и Lynx/autolink
привели к тем же трём прямым кандидатам. Это не доказательство отсутствия иных
пакетов. Рекламные оценки популярности и заявления о проверках не использованы
как доказательство качества. Все выводы о кандидатах ограничены прочитанным кодом.

Черновой код создан в отдельном локальном репозитории; сборок и runtime-прогонов
нет. Нельзя обещать «быстро готово к продакшену». Небольшой API написать удалось;
реальный остаток — JS/native tests, компиляция, автолинк/R8 и проверки на Android/iOS:
обычный CRUD, блокировка, reboot, reinstall/restore, потеря ключа, повреждение
записи, отказ диска, конкурентные вызовы и уничтожение Lynx view во время операции.

## Выполненный review

Один независимый read-only reviewer изучил код, контракты, упаковку и исходники
моста Lynx. Подтвердил два дефекта, оба исправлены:

- Для iOS 12–15.3 заменён `Object.hasOwn` на совместимый
  `Object.prototype.hasOwnProperty.call`; локальное исключение Biome объясняет причину.
- Android existence/deletion переведены на `Os.stat`/`Os.unlink`: только `ENOENT`
  означает отсутствие. Другие errno не превращаются в `null` и не разрешают
  удаление ключа после неуспешного удаления ciphertext.

Исправления перечитаны основным агентом. Форматирование Biome, статический lint и
`git diff --check` выполнены; runtime-проверки, typecheck и сборки не выполнялись.
Это не security certification и не подтверждение работы на устройствах.
