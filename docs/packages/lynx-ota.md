---
verified: 2026-08-19
lynx_version: 4.0.1
status: draft
---

# lynx-ota

Обновления бандла по воздуху.

## Гипотеза подтвердилась с поправкой

Lynx действительно грузит бандл в рантайме: `.lynx.bundle` это бинарный контейнер,
который нативный `LynxView` получает по URL или байтами. **Но сетевого слоя у Lynx нет:**

> Lynx Engine itself does not have the ability to load resources, so it is necessary to
> initialize `LynxEnv`, or when constructing `LynxView` to pass in the specific
> implementation of the `LynxTemplateProvider` protocol.

Движок отдаёт провайдеру строку URL и ждёт байты. Всё, что делает OTA именно OTA
(скачивание, кэш, версионирование, атомарная установка, откат, подпись) живёт по нашу
сторону колбэка. «Подменить URL» не проходит.

## API

**Android** (`com.lynx.tasm.LynxView`):
```java
renderTemplateUrl(String templateUrl, String jsonData)   // через провайдер
renderTemplate(byte[] template, TemplateData data)       // сырые байты
renderTemplateBundle(TemplateBundle bundle, ...)         // предпарсенный
loadTemplate(LynxLoadMeta meta)                          // единая точка входа
```
Приоритет в `LynxLoadMeta`: **bundle > binaryData > url**.

**iOS** (`LynxView.h`): `loadTemplate:`, `loadTemplateFromURL:`,
`loadTemplate:(NSData*)tem withURL:`, `loadTemplateBundle:`.

**Примитив валидации:** `TemplateBundle.fromTemplate(byte[])` плюс `isValid()`.
Скачал, распарсил, проверил, потом ставишь. Вне рендер-пути.

**Абстракция загрузки:** `LynxTemplateResourceFetcher` с `fetchTemplate` и `fetchSSRData`,
регистрируется через `LynxViewBuilder.setTemplateResourceFetcher(...)`.
Легаси-поколение: `AbsTemplateProvider`.

**Кэша нет ни в одном.** `lynx.requestResourcePrefetch()` работает только для
image, video, audio, font; шаблоны явно исключены.

## Недокументированный шов под подпись

```java
private static SecurityResult verifyTasm(ILynxSecurityTarget target, byte[] template,
                                         ByteBuffer buffer, String url) {
  ILynxSecurityService s = LynxServiceCenter.inst().getService(ILynxSecurityService.class);
  if (s != null) return s.verifyTASM(target, template, buffer, url, ...);
  return SecurityResult.onSuccess();   // сервис не зарегистрирован = пропускаем всё
}
```

Вызывается на **каждом** парсинге шаблона, реализации в опенсорсе нет.
Почти наверняка сюда ByteDance вешает своё подписывание бандлов.

**Практический вывод:** подпись вешать сюда, а не в свой fetcher. Так покрываются
и lazy bundles, и обойти другим путём загрузки нельзя.

## Три вещи бесплатно

1. **Загрузка из байтов.** Самая грязная часть CodePush, патчинг пути к JS-бандлу
   через нативный модуль, тут просто отсутствует
2. **`engineVersion`** как нативный пин совместимости, который форсит сам движок.
   Аналог `runtimeVersion` в expo, только проверяет фреймворк. Превышение фатально,
   ошибка 10204
3. **Шов верификации** выше

## Конкуренция: ниша пустая

`esc5221/lynx-codepush`: MIT, **2 звезды, 0 форков**, создан и последний раз запушен
28 июля 2026, один день активности. Только Android, ~700 строк.

Дизайн клиента здравый и стоит посмотреть: SHA-256 при скачивании, машина состояний
`pending → trial → committed` в SharedPreferences, коммит по `onLoadSuccess`,
откат при фатальной ошибке шаблона или незакоммиченном trial на старте (то есть после
краша), перманентный блеклист плохого хеша.

Нет iOS, нет staged rollout, нет телеметрии, нет дельт.

Sparkling официально отказался: issue #21, ответ коллаборатора «We provides standard APIs
for loading and executing Lynx bundles without any hot update solutions».
В роадмапе 2026 слов OTA, hot update и CDN нет ни разу.

## Сторы

- **Google Play разрешает явно.** Политика Device and Network Abuse выводит
  интерпретируемый код из-под запрета на загрузку исполняемого
- **Apple.** Пункта 3.3.2 в Review Guidelines нет, там раздел 3 кончается на 3.2.2.
  Ограничение живёт в Developer Program License Agreement, плюс в гайдлайнах есть 2.5.2
- Секции бандла (`template_binary.h`): строки, CSS, шаблоны элементов, конфиг,
  JS-исходник, JS-байткод, Lepus-байткод. **Секции нативного кода не существует.**
  Структурно то же, что Hermes-байткод у expo-updates
- **Оговорка специфична для Lynx:** PLA называет JavaScriptCore поимённо. На iOS фоновый
  поток идёт через JSC и попадает в исключение, а main-thread script и Lepus идут через
  PrimJS и в букву не попадают. RN в том же положении годами, прецедентов нет.
  **Публичных случаев ревью Apple с Lynx OTA не найдено ни одного, ни за, ни против**

## Что строить

| Кусок | Сложность |
|---|---|
| Сервер раздачи и хранилище | Низкая. R8 плюс D1 хватает, бандлы 100 КБ – 1 МБ |
| Клиент: скачать, проверить, атомарно поставить | Низко-средняя, ×2 платформы |
| **Откат** | Средняя, самое сложное. Порядок персиста состояния ДО попытки рендера |
| Пин к нативной версии | Почти бесплатно, движок проверяет сам |
| Подпись Ed25519 через security service | Средняя |
| Staged rollout | Низкая. Хеш стабильного device ID mod 100 против серверного процента |
| **iOS-паритет** | Средняя, **главная дыра рынка** |
| Кэш и мультибандл | Средняя+, Lynx не даёт ничего |
| Дельты | Пропустить |

## Не подтверждено

- Спеки формата бандла нет: issue #760 «Lynx Bundle Spec» открыт с 16 апреля 2025
  без единого комментария. Считать формат непрозрачным блобом, не парсить
- Нет первичного подтверждения, что TikTok сам качает бандлы по сети в проде.
  Вывод по косвенным признакам: HTTP-способный провайдер в шаблоне Sparkling
  и DI-шов `SPKResourceLoaderProtocol` в iOS SDK
- Точную формулировку PLA 2026 достать не удалось
- Lazy bundles (`lazy(() => import('https://host/...', { with: { type: 'component' } }))`)
  это встроенная в фреймворк загрузка удалённого кода через тот же fetcher,
  но API помечен экспериментальным, кэш не документирован
