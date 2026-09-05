// Спайк дня 1 для @lynx-lab/edge-to-edge: что видит JS в lynx.__globalProps и когда.
// console.info на Android уходит в logcat через lynx_console.cc (T24 в lynx-lab).

declare const __MAIN_THREAD__: boolean | undefined

const thread =
  typeof __MAIN_THREAD__ !== 'undefined' && __MAIN_THREAD__ ? 'MTS' : 'BTS'

export function readSafeArea(): unknown {
  if (typeof lynx === 'undefined') return 'no-lynx'
  const gp = lynx.__globalProps as Record<string, unknown> | undefined
  if (!gp) return 'no-globalProps'
  return gp['safeArea'] ?? null
}

export function spike(event: string, extra?: unknown): void {
  const gp =
    typeof lynx === 'undefined'
      ? undefined
      : (lynx.__globalProps as Record<string, unknown> | undefined)
  const keys = gp ? Object.keys(gp).join(',') : 'none'
  const line = `SPIKE ${event} thread=${thread} wall=${Date.now()} safeArea=${JSON.stringify(readSafeArea())} keys=${keys}${extra !== undefined ? ' extra=' + JSON.stringify(extra) : ''}`
  console.info(line)
}
