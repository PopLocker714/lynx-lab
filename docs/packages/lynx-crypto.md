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
