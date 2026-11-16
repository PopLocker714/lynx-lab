---
verified: 2026-11-16
lynx_version: 3.9.0 (verified Android/iOS runtime), 4.0.1 (Android compile target)
status: building
---

# @lynx-lab/secure-store

**Обязательная библиотека для авторизации.** Добавлена по запросу Ильи 2026-11-09.
Реализация написана 2026-11-09; Android проверен на Pixel 9 2026-11-16.
Исследование готовых пакетов, исходники и выбор: [отчёт](../secure-store-research.md).
Пройдены debug/release с R8, 7 нативных и по 10 JS/native проверок, 3 Bun-теста,
перезапуск процесса и обновление APK без удаления данных.
[Машинные результаты и screenshots](../evidence/android-2026-11-16/results.json).
iPhone 11 / iOS 18.4.1: Debug и Release прошли по 10 JS/native сценариев,
autolink, сохранность после перезапуска процесса и обновления Debug→Release. [iOS evidence](../evidence/ios-2026-11-16/results.json).
Оставшиеся lifecycle/recovery сценарии не проверены; пакет private.

Исправления `6ea2ae6`: публичный `Os.remove` вместо недоступного `Os.unlink`;
JSON-конверт записи и percent-encoded значение ответа сохраняют NUL через
Lynx/JNI и JSON.parse runtime пробника. Public API и формат хранилища не изменены.

Защищённое локальное хранение токенов сессии, включая refresh token, чтобы
восстанавливать авторизацию после перезапуска приложения и удалять данные при выходе.

## Референсы

- [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) —
  защищённое key-value хранилище. На iOS использует Keychain, на Android хранит
  зашифрованные значения с ключами под защитой Android Keystore.
- [react-native-keychain](https://oblador.github.io/react-native-keychain/) —
  аналог для React Native bare: хранение credentials и токенов с нативной защитой.

Документация референсов проверена 2026-11-09. Это ориентиры для собственного
Lynx-пакета, а не подтверждение совместимости этих RN-библиотек с Lynx.

## Контракт черновой реализации

- Асинхронные запись, чтение и удаление строкового секрета по ключу.
- iOS Keychain; на Android — шифрование значений с защитой ключей через Keystore.
- Сохранение данных между запусками; удаление токенов при logout.
- Отсутствующий ключ отличается от ошибки доступа или расшифровки.
- Никакого fallback к открытому хранению и никакого вывода секретов в логи.

API: `getItemAsync(key)`, `setItemAsync(key, value)`, `deleteItemAsync(key)`.
Ошибки — `SecureStoreError` с кодом; отсутствие — только `null`.
Значения до 16 KiB UTF-8, ключи — 1–256 ASCII-букв/цифр и `._-`.
Вызовы только с BTS. Биометрия, синхронные методы и общий clear не входят в v1.
Android: AES-GCM + отдельный Keystore key на запись, файлы в noBackupFilesDir.
iOS: AfterFirstUnlockThisDeviceOnly и SecItemUpdate, без очистки при reinstall.

## Что проверить перед выпуском

- Доступность данных при заблокированном устройстве и фоновом обновлении сессии.
- Политика backup/restore и переустановки: платформы ведут себя по-разному.
- Биометрию рассматривать отдельно после базового API.
- Ограничения размера, разделение ключей между аккаунтами и параллельные операции.
- Нативный мост, autolink и проверка на физических Android/iOS-устройствах.

Пакет хранит секреты; сам login, обновление токенов и серверная авторизация
остаются ответственностью приложения.
