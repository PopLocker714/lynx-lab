# Источники

Всё проверено напрямую: исходники на конкретном теге, npm-тарболы, реестры, issue с датами.
Дата в скобках это когда факт подтверждался.

## Исходники

- `lynx-family/lynx` — https://github.com/lynx-family/lynx (2026-08-21, теги 3.9.0 и 4.0.1)
- `lynx-family/primjs` — https://github.com/lynx-family/primjs (2026-08-19)
- `lynx-family/lynx-website` — исходники доков в `.mdx` (2026-08-19)
- `lynx-family/lynx-stack` — web-platform, `XList.ts` (2026-08-19)
- `tiktok/sparkling` — https://github.com/tiktok/sparkling (2026-08-21, HEAD `c4ce8d2`)
- `zoontek/react-native-permissions` — HEAD `5c69bd9`, версия 5.6.1 (2026-08-21)

Ключевые файлы, на которые ссылаются документы:

```
platform/android/lynx_android/.../jsbridge/LynxMethodWrapper.java       типы параметров
platform/android/lynx_android/.../LynxTemplateRender.java               дроп sendGlobalEvent
platform/android/lynx_android/.../TemplateBundle.java                   verifyTasm
platform/android/lynx_library_plugin/.../LynxLibraryBuildPlugin.groovy  autolink Android
platform/android/lynx_processor/.../LynxNativeModule.java               форма аннотации
platform/android/lynx_xelement/.../DefaultWebViewServiceImpl.java       нет перехвата навигации
platform/darwin/ios/lynx_xelement/webview/LynxWebViewDefaultLoader.m    то же на iOS
platform/darwin/common/lynx/public/module/LynxModule.h                  LynxCallbackBlock
core/runtime/js/bindings/modules/ios/lynx_module_darwin.mm              @try/@catch, инлайн-вызов
core/renderer/ui_component/list/                                        C++ движок списка
core/template_bundle/template_codec/template_binary.h                   секции бандла
js_libraries/lynx-core/src/index.card.ts                                какие глобалы ставятся
js_libraries/types/types/common/element/webview.d.ts                    поверхность webview
tools/ios_tools/cocoapods-lynx-library/lib/lynx/library/autolink.rb     autolink iOS
```

## Документация

- https://lynxjs.org/guide/start/integrate-with-existing-apps.html (2026-08-19)
- https://lynxjs.org/guide/autolink.html (2026-08-19)
- https://lynxjs.org/guide/compatibility — `engineVersion` (2026-08-19)
- https://lynxjs.org/guide/scripting-runtime/ — два рантайма (2026-08-19)
- https://lynxjs.org/api/elements/built-in/list.html (2026-08-19)
- https://lynxjs.org/api/elements/built-in/webview.html (2026-08-21)
- https://lynxjs.org/api/errors/error-code (2026-08-19)
- https://lynxjs.org/react/code-splitting — lazy bundles (2026-08-19)
- https://lynxjs.org/blog/lynx-open-source-roadmap-2026 (2026-08-19)

## Issue и PR

- https://github.com/lynx-family/lynx/issues/760 — спека формата бандла, открыт без ответа
- https://github.com/lynx-family/lynx/issues/299 — safe-area, открыт с марта 2025
- https://github.com/lynx-family/lynx/issues/1542 — 16 КБ page size, закрыт в 3.4.2
- https://github.com/lynx-family/lynx/issues/8342 — чат-список, **воспроизводился на Lynxtron, не на мобильных**
- https://github.com/lynx-family/lynx/pull/159 — PR от Sentry, **отклонён** 2025-03-07, оставлен открытым
- https://github.com/tiktok/sparkling/issues/21 — hot update, отказ коллаборатора
- https://github.com/zoontek/react-native-permissions/pull/696 — удаление трюка с SharedPreferences в 3.4.0

## Соседи по экосистеме

- https://github.com/software-mansion-labs/lynx-screens — примитивы навигации, активны
- https://github.com/esc5221/lynx-codepush — 2 звезды, только Android, единственный OTA
- `@amritk/lynx-location@0.2.1` — образец `lynx.lib.json`, техника прозрачной Activity
- `@amritk/lynx-secure-storage` — MIT, ~500 строк, кандидат на форк вместо написания
- `@amritk/lynx-deep-linking` — «pre-alpha, nothing here has run on a device»
- `@sigx/*` — ~100 пакетов, но привязаны к своему фреймворку, для ReactLynx непригодны

## Политики сторов

- https://support.google.com/googleplay/android-developer/answer/9888379 — интерпретируемый код
- https://support.google.com/googleplay/android-developer/answer/15685001 — продавцовские сервисы в РФ
- https://support.google.com/googleplay/android-developer/answer/11950272 — биллинг в РФ
- https://developer.apple.com/app-store/review/guidelines/ — 2.5.2 и 3.1.3(e)
- https://developer.android.com/develop/background-work/services/alarms/schedule — `SCHEDULE_EXACT_ALARM`
- https://www.rustore.ru/help/en/developers/publishing-and-verifying-apps/requirement-apps
- https://www.rustore.ru/help/en/sdk/general-push-notifications/kotlin/6-4-0 — Universal Push

## Артефакты

- Документ решения: https://claude.ai/code/artifact/c4a3d1d5-2199-4240-ab12-1c60d845bf4d
- Спека пакетов: https://claude.ai/code/artifact/0ccc8425-3fe2-4cc5-9b07-9a926e6787e5
