/** Tiny pub/sub so any component can report/observe the latest sync error,
 *  without a settings page or dedicated sync-status screen to hold that state. */

type Listener = (error: string | null) => void

let currentError: string | null = null
const listeners = new Set<Listener>()

export function setSyncError(error: string | null): void {
  currentError = error
  listeners.forEach((listener) => listener(error))
}

export function subscribeSyncError(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncError(): string | null {
  return currentError
}
