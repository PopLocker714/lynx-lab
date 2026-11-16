# Эталонные конфиги · package standard v1

Область: собственный код пакетов Lynx Lab. Политика —
[package-standard.md](../docs/package-standard.md), обновления host —
[compatibility-policy.md](../docs/compatibility-policy.md).

Стандарт внедрён в рабочую ветку crypto; consumer/device QA одного профиля прошла.
Остальные пакеты мигрируются по одному в отдельном worktree, с baseline checks,
review и сохранением API. Это не означает готовность всех четырёх пакетов.
У этого репозитория знаний нет package.json; устанавливать зависимости здесь не нужно.

## Внедрение

1. Скопировать biome.json, .editorconfig и .clang-format в корень пакета.
   Добавить tsconfig.strict.json и extends в существующий tsconfig, сохранив
   target/lib/module/moduleResolution/JSX/потоки и include/exclude этого пакета.
   При существующей цепочке extends объединить её явно: не потерять host defaults.
2. Убрать локальные настройки, которые незаметно переопределяют strict-базу;
   проверить итоговый `tsc --showConfig`. Исключения фиксировать по стандарту.
3. Объединить scripts из package-scripts.json с имеющимся package.json; test/build
   остаются настоящими командами пакета. Существующие prepack/prepublish/release
   hooks сохранить. Сначала проверить, что check-publishable.mjs действительно
   существует и проверяет актуальные exports/native/docs в tarball. Для secure-store
   его ещё нужно реализовать; не подставлять команду, которая всегда успешна.
4. Закрепить инструменты: конфиг Biome проверяется на 2.5.9, TS база на 5.9.3.
   Пакет с другой версией проходит отдельную проверку конфига, а не слепой downgrade.
   В crypto проверены ktlint 1.7.1 и clang-format 21.1.8. Проверить их совместимость
   с конкретным пакетом и закрепить версии; не обновлять глобальный toolchain.
5. Отдельный commit — механическое форматирование; отдельный — исправления типов
   и поведения. Strict migration не должна менять контракт ради прохождения check.
6. Записать в contribution docs пакета версию стандарта/commit источника, инструменты
   и обоснованные отклонения. Обновления конфигов копируются явным reviewed diff.
   Не ссылаться из отдельного репозитория на соседний локальный checkout.

## Команды

| Команда | Обязательный смысл после внедрения |
|---|---|
| bun run format | Форматирование TS/JS/JSON через Biome |
| bun run format:native | Форматирование своих Kotlin/ObjC файлов, без vendor/generated |
| bun run lint | Biome check, warnings вызывают failure |
| bun run typecheck | Проверка TS исходников/тестов по явному include |
| bun run test | Поведенческие и контрактные тесты пакета |
| bun run build | Реальная сборка JS/declarations с noEmitOnError |
| bun run check:package | Упаковка и проверка поставляемых exports, native source, metadata и EN/RU docs |
| bun run check | Последовательный быстрый TS/test/build/package gate |
| bun run check:android | Kotlin/formatter/Android Lint/native compile и нужные native tests |
| bun run check:ios | ObjC/formatter/compiler/static analysis и нужные native tests |
| bun run check:consumer | Consumer tarball integration Debug/Release, Android R8 |

package-scripts.json содержит готовые значения только для общего TS gate. Native
и consumer команды реализуются в конкретном пакете после проверки его Gradle/Xcode
проекта. Таблица — контракт внедрения, не утверждение, что эти команды уже доступны.
Отсутствующая обязательная команда блокирует завершение миграции/релизный gate.
Аппаратные сценарии могут выполняться отдельным QA job с evidence, а не одной командой.

Biome не проверяет Kotlin/ObjC. EditorConfig задаёт редактору стиль, но не заменяет
native formatter/linter. Generated/vendor и зависимости исключать по точным путям,
а не по маске, скрывающей собственный код. Форматирование не запускается с write в CI.

## Состояние эталона

Конфиги предназначены для валидации существующими инструментами без обновления
SDK/host. Проверки эталона записываются в CHANGELOG лаборатории. Успешная проверка
эталонного fixture не доказывает, что исходники четырёх библиотек уже проходят его.

2026-11-16: Biome 2.0.0 принял конфиг; TypeScript 5.9.3 принял strict-базу.
Изолированный fixture подтвердил успешный корректный пример и отказ для 2-пробельного
отступа, explicit any, unchecked indexed access и optional undefined. Проверены
охват TSX и переход warning → failure с --error-on-warnings. Fixture удалён.
Независимое read-only review не выявило блокеров. clang-format/ktlint не запускались:
настройка/проверка native tooling остаётся частью пилота, не заявляется выполненной.

Следующий этап 2026-11-16: crypto `9d1bd34` прошёл 41 тест, strict TS,
повторную упаковку с проверкой README examples, Android Debug/Release compile +
Lint и отдельные ObjC compile/static analysis против Lynx 3.9.0 headers.
Проверены Biome 2.5.9, ktlint 1.7.1 и clang-format 21.1.8. Эталон Biome обновлён
на проверенный синтаксис 2.5.9. Отдельная компиляция ObjC не доказывает host autolink;
полная consumer/device QA отдельно прошла на физических Pixel 9 / Android 17 и
iPhone 11 / iOS 18.4.1 в Debug/Release, Android R8. Связка Lynx 3.9.0 /
Sparkling 2.1.0-rc.36, probe `c3e957d`; результаты в
[evidence](../docs/evidence/crypto-2026-11-16/results.json). Минимальные ОС и второй
профиль не проверены. GitHub CI ещё не запускался; release blocker остаётся.

Вклад пилота в следующие миграции:

- Runtime tsconfig не получает DOM/Node globals только ради тестов; окружение
  тестов/инструментов задаётся отдельным tsconfig. Проверяются поставляемые declarations.
- `check:package` повторяем и проверяем реально созданный архив. Receipt хранить
  под именем вроде `package-evidence.json`: `package.json` меняет Node package scope.
- У bundled dependencies проверять фактически установленные версии: сведения
  lockfile могут не совпадать с содержимым npm-архива зависимости.
- Исключение audit привязано к advisory, фактическому графу, владельцу и сроку;
  истечение срока или изменение графа требует пересмотра. В crypto остаются два
  временных исключения, а не нулевой raw audit.
- `check:consumer` с native build — compile gate; аппаратный сценарий требует
  отдельного результата. Чувствительность QA проверяется дефектными заглушками.
- Публикация crypto заблокирована до реализации цепочки final version/changelog →
  immutable tarball → consumer QA → публикация того же tarball. Обычная повторная
  упаковка semantic-release после QA не подтверждает идентичность артефакта.
