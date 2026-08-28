---
verified: 2026-08-21
lynx_version: 4.0.1
status: draft
---

# lynx-app-lifecycle

**Оценка: 3 дня. Лучшее соотношение затрат к разблокированному во всём списке.**

События foreground / background / active плюс геттер состояния запуска.

## Почему нужен

Глобальных событий в Lynx **ровно четыре**: `keyboardstatuschanged`, `onWindowResize`,
`exposure`, `disexposure`. Событий жизненного цикла приложения среди них нет.

При этом `onAppEnterForeground(): void {}` **существует** в классе `App` внутри
`lynx-core`, подключён к нативным lifecycle-сообщениям, и **никогда не выводится
наружу в ReactLynx**. В `@lynx-js/react@0.124.0` ноль упоминаний
`EnterForeground` / `EnterBackground`.

## Что разблокирует

- «Пользователь вернулся из приложения банка» → начать опрос статуса платежа.
  Без этого возврат из оплаты не детектируется вообще.
- Сессионная аналитика
- Обновление токена при возврате
- Ресинк корзины и непрочитанных

## Наброски

- Android: `ProcessLifecycleOwner` или `Application.ActivityLifecycleCallbacks`
- iOS: `UIApplication` notifications (`didBecomeActive`, `willResignActive`,
  `didEnterBackground`, `willEnterForeground`)
- Наружу: глобальные события Lynx плюс синхронный `getAppState(): string`

## Открытые вопросы

- Можно ли вместо своего модуля просто пробросить существующий `onAppEnterForeground`
  из `lynx-core`. Если да, это патч в апстрим, а не пакет.
- Как это ведёт себя при нескольких LynxView и нескольких контейнерах Sparkling.

---

## Уточнение 2026-08-27: вопрос сузился до одной строки

При проверке `@lynx-lab/crypto` на симуляторе iOS в нативном логе обнаружилось, что
события жизненного цикла **внутри Lynx уже ходят**:

```
EventTarget::DispatchEvent name: __OnAppEnterForeground, phase: 2
RuntimeLifecycleObserverImpl::OnAppEnterForeground
JSClosureEventListener::Invoke name: __OnAppEnterForeground
```

Проверено в `@lynx-js/react@0.125.0`: хука жизненного цикла **нет**. Полный список
экспортируемых хуков это `useCallback`, `useContext`, `useDebugValue`, `useErrorBoundary`,
`useId`, `useLynxGlobalEventListener`, `useMainThreadRef`, `useMemo`, `useReducer`,
`useRef`, `useState`, `useTransition`. Grep по всему `node_modules` на
`OnAppEnterForeground` даёт **ноль**.

### Спайк S5, одна строка, решает судьбу пакета

```ts
useLynxGlobalEventListener('__OnAppEnterForeground', () => console.log('FG'))
```

- **Если событие приходит** — пакета почти нет. Это тонкая типизированная обёртка
  на JS, ноль нативного кода, день работы вместо трёх, и вопрос «а не апстрим ли это»
  снимается сам.
- **Если не приходит** — событие внутреннее, `JSClosureEventListener` это не
  `GlobalEventEmitter`, и тогда пакет пишется как задумано: `ProcessLifecycleOwner`
  на Android, нотификации `UIApplication` на iOS.

Гонять спайк на устройстве не нужно: хватает симулятора и `adb`, приложение достаточно
свернуть и развернуть.

---

## Спайк S5 прогнан 2026-08-28. Результат: пакет нужен, но по другой причине

Симулятор iPhone 17 Pro, `create-sparkling-app@rc`, Sparkling 2.1.0-rc.36, Lynx 3.9.0.

### Что подтвердилось

**`lynx.getCoreContext()` реально работает из пользовательского JS.** Он есть в публичных
типах (`@lynx-js/types/types/common/lynx.d.ts:102`), возвращает `ContextProxy`
с `addEventListener(type: string, listener)`, и подписка на события проходит:

```
LCPROBE CORE __OnAppEnterForeground FIRED   ×6
LCPROBE CORE __OnAppFirstScreen FIRED       ×6
LCPROBE CORE __OnNativeAppReady FIRED       ×6
```

Точные имена взяты из `js_libraries/lynx-core/src/lynx/interface.ts@4.0.1`,
`const enum MessageEventType`.

### Что опровергнулось, и это главное

**`__OnAppEnterBackground` не пришёл ни разу**, при настоящем уходе приложения в фон
(запуск Safari поверх). Ноль срабатываний.

Причина найдена в исходниках Sparkling,
`Sources/Service/LynxService/SPKWrapperLynxView.swift:383,392`:

```swift
public func onshow(params: [AnyHashable: Any]) {
    self.onEnterForeground()   // ← из onshow, не из UIApplication
}
public func onHide(params: [AnyHashable: Any]) {
    self.onEnterBackground()
}
```

`onshow` и `onHide` это **видимость контейнера** (появление и исчезновение
`SPKViewController`), а не жизненный цикл приложения. На `UIApplication`
никто не подписан: `didEnterBackground` и `willEnterForeground` в Sparkling
встречаются только в `SPKViewController` и к LynxView не ведут.

### Что это значит

`__OnAppEnterForeground` означает **«эта Lynx-страница стала видимой»**,
а не «приложение вернулось из фона». Для сценария «пользователь вернулся из приложения
банка, начинаем опрос статуса платежа» этот сигнал **не годится**.

### Следствия для пакета

Пакет **нужен**, и делится на два уровня:

| Уровень | Стоимость | Что даёт |
|---|---|---|
| **Видимость страницы** | Ноль натива, чистый JS на `getCoreContext()` | Готово сегодня, отдаём как бонус в том же пакете |
| **Жизненный цикл приложения** | Нативный код | То, ради чего пакет и нужен: `ProcessLifecycleOwner` на Android, нотификации `UIApplication` на iOS |

Оценка **три дня остаётся в силе**. Гипотеза «это апстрим-патч, а не пакет» **закрыта**:
патчить нечего, событие есть, его просто никто не приводит в движение с уровня приложения.

### Попутная находка: каталог из 24 событий, публичных только 8

`MessageEventType` в `interface.ts@4.0.1` содержит 24 имени. В публичных типах
(`LynxMessageEvents` в `events.d.ts@4.1.0`) объявлено **восемь**: `__DestroyLifetime`,
`__GlobalEvent`, `__OnLowMemory`, `__RemoveComponents`, `__RenderPage`, `__SSRHydrate`,
`__UpdateGlobalProps`, `__UpdatePage`.

Недокументированные, но рабочие и полезные:

| Событие | Зачем |
|---|---|
| `__OnAppEnterForeground` / `__OnAppEnterBackground` | видимость страницы, см. выше |
| `__OnAppFirstScreen` | первый экран отрисован |
| `__OnNativeAppReady` | рантайм готов |
| `__NotifyGlobalPropsUpdated` | **прямо нужно для `edge-to-edge`**: уведомление об изменении globalProps |
| `__OnLifecycleEvent` | не исследовано |

`addEventListener` принимает обычную строку, поэтому подписаться можно и на те, что
не объявлены в типах.

### Ещё одно наблюдение из замера

Модульная область выполняется **на обоих потоках**. На BTS
`lynx.getJSModule('GlobalEventEmitter')` есть, на главном потоке его **нет**, ровно как
и `NativeModules`. Это подтверждает контракт ещё раз, теперь на iOS.

### Методическая заметка

`simctl launch --console-pty` **отваливается, когда приложение уходит в фон**, и первый
замер дал ложный отрицательный результат. Для проверок жизненного цикла нужен
`xcrun simctl spawn booted log stream`, он переживает сворачивание.
