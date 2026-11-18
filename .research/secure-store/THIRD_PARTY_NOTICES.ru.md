---
verified: 2026-11-18
lynx_version: 3.9.0
sparkling_version: 2.1.0-rc.36
status: spec
---

> [English](./THIRD_PARTY_NOTICES.md) · **Русский**

# Исследование Secure Store: уведомления сторонних правообладателей

[Корневая MIT-лицензия](../../LICENSE) относится к собственным материалам
Lynx Lab. Сторонние исследовательские копии сохраняют исходных правообладателей
и лицензии; корневая лицензия не заменяет их условия. Эта директория содержит
исследовательские материалы, а не runtime-зависимости `@lynx-lab/secure-store`.

## Expo SecureStore

`expo-secure-store.swift` и `expo-aes.kt` — неизменённые копии исходников Expo.
Оба файла побайтно совпадают с commit
[`5a97a546476fd0bea35227b60297ad472f065168`](https://github.com/expo/expo/commit/5a97a546476fd0bea35227b60297ad472f065168).
При первоначальном сборе записан плавающий URL `main`, а не commit. Указанная
ревизия проверена позднее по совпадению содержимого; дата исходного скачивания
по ней не восстанавливается.

Исходное уведомление MIT указывает **650 Industries, Inc. (aka Expo),
2015-present**. Его полный неизменённый текст сохранён в
[`licenses/expo-MIT.txt`](./licenses/expo-MIT.txt) из
[`LICENSE`](https://github.com/expo/expo/blob/5a97a546476fd0bea35227b60297ad472f065168/LICENSE)
этого commit.

## React Native Keychain

`rn-keychain-module.kt` и `rn-keychain-package.json` побайтно совпадают с commit
[`ff42a81f957a82485f9f9574ad3ccef92f648c93`](https://github.com/oblador/react-native-keychain/commit/ff42a81f957a82485f9f9574ad3ccef92f648c93).
Metadata пакета указывает версию `11.0.0`. При первоначальном сборе записан
`master`; указанный commit проверен по совпадению содержимого.

Исходное уведомление MIT указывает **Joel Arvidsson, 2015**. Его полный
неизменённый текст сохранён в
[`licenses/react-native-keychain-MIT.txt`](./licenses/react-native-keychain-MIT.txt)
из [`LICENSE`](https://github.com/oblador/react-native-keychain/blob/ff42a81f957a82485f9f9574ad3ccef92f648c93/LICENSE)
этого commit.

## Tamer4Lynx: исходное уведомление не подтверждено

Metadata опубликованного `@tamer4lynx/tamer-secure-store@0.0.3` указывает
лицензию `MIT` и автора `Nanofuxion`. Все 20 файлов исследовательской копии,
сохраняемой в приватном архиве, совпали с опубликованным npm-архивом. Файлы
`LICENSE`, `COPYING` или `NOTICE` не найдены ни в архиве, ни в одном из пяти
коммитов [исходного репозитория](https://github.com/tamer4lynx/tamer-secure-store/tree/0fe9b68e4434c90510cc4f371f4a70d2b2d5389c).
В копии исходников нет copyright notice. Metadata сохраняется как доказательство;
подлинное лицензионное уведомление не установлено.

Публичные экспорты должны исключать `tamer4lynx/package/` до подтверждения
уведомления upstream. Исходную исследовательскую копию следует сохранить в
приватном архиве. Год copyright, уведомление и заменяющая лицензия от имени
автора не выдумываются. [Registry metadata](./tamer4lynx/registry.json) и
[provenance лицензий](./license-provenance.json) сохраняют точный URL npm-архива,
версию, integrity и hashes для воспроизведения. SHA-256 архива:
`c3caaea1a159e552dae4e1fd81a347568acde51c6158e03b15fdfee512d52db2`.

## Остальные сохранённые материалы

Оригинальные уведомления из других пакетов уже сохранены в
[`amritk/package/LICENSE`](./amritk/package/LICENSE) и
[`sigx/package/LICENSE`](./sigx/package/LICENSE). Они здесь не заменяются.
Полные копии документации Apple `apple-accessibility.md` и `apple-keychain.md`
исключаются из публичных экспортов. Оригиналы следует сохранить в приватном
исследовательском архиве, а исходные URL и hashes — в
[`sources.json`](./sources.json) и [`license-provenance.json`](./license-provenance.json),
вместе с собственными исследовательскими выводами Lynx Lab. На эти сторонние
документы MIT-лицензия Lynx Lab не распространяется.

Точные URL исходников, совпадающие ревизии и SHA-256 лицензий записаны в
[`license-provenance.json`](./license-provenance.json). Исходный
[`sources.json`](./sources.json) и байты кода не изменены.
