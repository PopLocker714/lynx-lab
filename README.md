# lynx-lab

Рабочая база знаний по экосистеме **Lynx** (ByteDance/TikTok) и по нативным пакетам,
которые мы для неё пишем.

Это не код. Это то, что должно пережить паузы между заходами: что проверено, где грабли,
что уже сломано в наших же спеках, и в каком порядке всё делать.

## Зачем

Экосистема Lynx почти пустая: GitHub code search по `lynx.lib.json` находит **8 репозиториев
во всём мире**, три из них шаблоны ByteDance. Значит почти всё, что нужно реальному
приложению, придётся написать самому. Этот репозиторий держит план и результаты разведки,
чтобы каждый заход начинался не с нуля.

**Трекинг работы:** [issues](https://github.com/PopLocker714/lynx-lab/issues) — по одному
на пакет, с чек-листом дефектов внутри. Спека это «что мы знаем», issue это «что делаем».

## Статус пакетов

| Пакет | Статус | Оценка | Дефектов открыто | Спека |
|---|---|---|---|---|
| `lynx-permissions` | 📋 спека готова | 4.5–6 нед | 9 | [docs/packages/lynx-permissions.md](docs/packages/lynx-permissions.md) |
| `lynx-notify` (локальные) | 📋 спека готова | 8–9 нед | 10 | [docs/packages/lynx-notify.md](docs/packages/lynx-notify.md) |
| `lynx-notify` (провайдеры) | 📋 спека готова | +7 нед | — | там же |
| `@lynx-lab/edge-to-edge` | 📋 спека готова | 9–10 дней | — | [docs/packages/lynx-edge-to-edge.md](docs/packages/lynx-edge-to-edge.md) |
| `lynx-app-lifecycle` | 🗒 набросок | 3 дня | — | [docs/packages/lynx-app-lifecycle.md](docs/packages/lynx-app-lifecycle.md) |
| `lynx-browser-handoff` | 🗒 набросок | 1.5–2 нед | — | [docs/packages/lynx-browser-handoff.md](docs/packages/lynx-browser-handoff.md) |
| `@lynx-lab/crypto` | 🔨 **в работе** | 3–4 дня | — | [репозиторий](https://github.com/PopLocker714/lynx-crypto) · [спека](docs/packages/lynx-crypto.md) |
| `lynx-deeplinks` | 🗒 набросок | 2 нед | — | [docs/packages/lynx-deeplinks.md](docs/packages/lynx-deeplinks.md) |
| `lynx-websocket` | 🗒 набросок | 3–4 нед | — | [docs/packages/lynx-websocket.md](docs/packages/lynx-websocket.md) |
| `lynx-webview-plus` | 🗒 набросок | 3–4 нед | — | [docs/packages/lynx-webview-plus.md](docs/packages/lynx-webview-plus.md) |
| `lynx-ota` | 🗒 набросок | неск. недель | — | [docs/packages/lynx-ota.md](docs/packages/lynx-ota.md) |

Легенда: 🗒 набросок · 📋 спека готова · 🔨 в работе · ✅ выпущен

## С чего начинать любой заход

1. **[docs/01-platform-traps.md](docs/01-platform-traps.md)** — шесть ловушек, которые
   бьют по каждому пакету одинаково. Каждая выглядит как рабочий код и молча не работает.
   Читать перед любой строкой натива.
2. **[docs/02-modularity.md](docs/02-modularity.md)** — почему один npm-пакет, а не пакет
   на провайдера, и как устроен выбор на этапе сборки.
3. Спека нужного пакета в `docs/packages/`.
4. **[docs/spikes.md](docs/spikes.md)** — что проверить руками до написания кода.

## Порядок работ

```
lynx-permissions              нужен всем остальным пакетам
        │
        ├─► lynx-app-lifecycle        3 дня, разблокирует больше всего на единицу труда
        │
        ├─► lynx-notify (локальные)   самодостаточно, без провайдеров и токенов
        │           │
        │           └─► FCM + APNs ──► HMS + RuStore
        │
        └─► browser-handoff ─► deeplinks     ветка «магазин»
                    │
                    └─► crypto ─► websocket   ветка «мессенджер»
```

## Свежесть

Lynx движется быстро: месячные релизы, 300+ коммитов в месяц. У каждого документа
в шапке стоит `verified` и `lynx_version`. **Факт старше трёх месяцев считается
неподтверждённым**, пока не перепроверен.

Актуальные версии на момент последней проверки:

- Lynx **4.0.1** (2026-07-31)
- Sparkling npm `latest` — **2.0.1**, но живая ветка `2.1.0-rc.36`; шаблон пинит Lynx **3.9.0**
- `@lynx-js/react` **0.124.0**, `@lynx-js/types` **4.1.0**

## Документы

- [docs/00-verdict.md](docs/00-verdict.md) — стоит ли вообще ставить на Lynx
- [docs/01-platform-traps.md](docs/01-platform-traps.md) — общие ловушки
- [docs/02-modularity.md](docs/02-modularity.md) — модульность и обнаружение
- [docs/03-ecosystem.md](docs/03-ecosystem.md) — что в экосистеме есть и чего нет
- [docs/04-risk.md](docs/04-risk.md) — риск ставки и дистрибуция
- [docs/05-shop.md](docs/05-shop.md) — интернет-магазин на Lynx
- [docs/spikes.md](docs/spikes.md) — спайки
- [DECISIONS.md](DECISIONS.md) — лог решений
- [SOURCES.md](SOURCES.md) — все проверенные источники с датами
