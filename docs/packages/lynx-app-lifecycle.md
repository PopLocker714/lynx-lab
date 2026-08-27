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
