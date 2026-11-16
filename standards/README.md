# Эталонные конфиги · package standard v1

Область: собственный код пакетов Lynx Lab. Политика —
[package-standard.md](../docs/package-standard.md), обновления host —
[compatibility-policy.md](../docs/compatibility-policy.md).

Эти файлы ещё не подключены к четырём репозиториям пакетов. Внедрять по одному
пакету в отдельном worktree, с baseline checks, review и сохранением API.
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
4. Закрепить инструменты: конфиг Biome проверяется на 2.0.0, TS база на 5.9.3.
   Пакет с другой версией проходит отдельную проверку конфига, а не слепой downgrade.
   Выбрать и закрепить совместимые ktlint/clang-format версии при native-пилоте.
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
