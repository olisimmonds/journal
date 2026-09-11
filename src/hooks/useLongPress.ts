import { useCallback, useRef } from 'react'

const DEFAULT_DURATION_MS = 500
// Movement beyond this (e.g. a scroll or drag) cancels the long-press, so a
// user can't trigger it accidentally while the page is moving under their finger.
const MOVE_TOLERANCE_PX = 12

/**
 * Long-press (press-and-hold) gesture detection, matching the pattern Google
 * Notes uses to surface per-note actions. Returns:
 *
 *  - `pointerProps`: spread onto the target element. The pointer handlers arm
 *    the hold timer on press, cancel it on movement/leave/up, and suppress the
 *    browser's native context menu that some platforms show during a long
 *    press.
 *  - `tap(action)`: a click handler that runs `action`, but swallows the click
 *    that fires as the *release half* of a long press (otherwise the card
 *    would both open the action sheet *and* open the note).
 *
 * The press flag resets on every new press, so a long-press whose release
 * click lands elsewhere (e.g. on a just-opened overlay) can't swallow the
 * next genuine tap.
 */
export function useLongPress(
  onLongPress: () => void,
  durationMs = DEFAULT_DURATION_MS,
  moveTolerancePx = MOVE_TOLERANCE_PX,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startRef = useRef<{ x: number; y: number } | null>(null)
  const pressedRef = useRef(false)

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    startRef.current = null
  }, [])

  const handlePointerDown = useCallback(
    (event: React.PointerEvent) => {
      // Only primary clicks count; ignore secondary (right) and pen/touch
      // inputs' non-primary buttons.
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pressedRef.current = false
      startRef.current = { x: event.clientX, y: event.clientY }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        pressedRef.current = true
        onLongPress()
      }, durationMs)
    },
    [durationMs, onLongPress],
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const start = startRef.current
      if (!start) return
      const moved =
        Math.abs(event.clientX - start.x) > moveTolerancePx ||
        Math.abs(event.clientY - start.y) > moveTolerancePx
      if (moved) clear()
    },
    [clear, moveTolerancePx],
  )

  const pointerProps = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
  }

  const tap = useCallback((action: () => void) => () => {
    if (pressedRef.current) {
      pressedRef.current = false
      return
    }
    action()
  }, [])

  return { pointerProps, tap }
}