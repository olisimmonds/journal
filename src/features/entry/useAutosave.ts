import { useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved'

/**
 * Debounces a changing value and persists it via `onSave` after the user
 * pauses typing. `onSave` is read from a ref so callers can pass a fresh
 * closure every render without retriggering the debounce timer.
 *
 * Any edit still pending when the component unmounts — a browser or OS back
 * gesture, a route change that bypasses the app's explicit flush — is
 * persisted immediately rather than silently dropped. React cancels the
 * debounce timer on unmount, which would otherwise lose the last <delayMs>
 * of input; the unlikely-but-real case is toggling a health widget and
 * leaving the page within the debounce window. The write is fire-and-forget:
 * it completes in IndexedDB regardless of the component being gone.
 */
export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = 600,
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const onSaveRef = useRef(onSave)
  const isMountedRef = useRef(true)
  const isFirstRender = useRef(true)

  // The freshest value, plus whether an edit is waiting to be persisted. The
  // pending flag is only cleared when a save matching the current value
  // completes — if a newer edit landed mid-save it must stay pending. Ref
  // updates live in effects, not render, so the freshest value is available
  // to an already-scheduled debounce callback and the unmount flush.
  const pendingValueRef = useRef(value)
  const hasPendingEdit = useRef(false)
  useEffect(() => {
    pendingValueRef.current = value
  })

  const flushRef = useRef<() => Promise<void>>(async () => {})
  useEffect(() => {
    onSaveRef.current = onSave
    flushRef.current = async () => {
      const snapshot = pendingValueRef.current
      await onSaveRef.current(snapshot)
      if (pendingValueRef.current === snapshot) {
        hasPendingEdit.current = false
      }
    }
  })

  useEffect(() => {
    // Don't autosave on mount — only on subsequent user-driven changes.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    hasPendingEdit.current = true
    setStatus('idle')
    const timeoutId = window.setTimeout(async () => {
      setStatus('saving')
      await flushRef.current()
      if (!isMountedRef.current) return
      setStatus('saved')
    }, delayMs)

    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      // The debounce timer's cleanup runs first and cancels it; anything not
      // yet persisted must be written now so it survives the navigation.
      if (hasPendingEdit.current) {
        void flushRef.current()
      }
    }
  }, [])

  return status
}