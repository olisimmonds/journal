import { useEffect, useRef, useState } from 'react'

export type AutosaveStatus = 'idle' | 'saving' | 'saved'

/**
 * Debounces a changing value and persists it via `onSave` after the user
 * pauses typing. `onSave` is read from a ref so callers can pass a fresh
 * closure every render without retriggering the debounce timer.
 */
export function useAutosave<T>(
  value: T,
  onSave: (value: T) => Promise<void>,
  delayMs = 600,
): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const onSaveRef = useRef(onSave)
  useEffect(() => {
    onSaveRef.current = onSave
  })

  const isFirstRender = useRef(true)

  useEffect(() => {
    // Don't autosave on mount — only on subsequent user-driven changes.
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }

    setStatus('idle')
    const timeoutId = window.setTimeout(async () => {
      setStatus('saving')
      await onSaveRef.current(value)
      setStatus('saved')
    }, delayMs)

    return () => window.clearTimeout(timeoutId)
  }, [value, delayMs])

  return status
}
