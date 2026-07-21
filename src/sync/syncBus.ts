/** Tiny pub/sub so any component can report/observe the latest sync error,
 *  without a settings page or dedicated sync-status screen to hold that state. */

export interface SyncErrorState {
  message: string
  /** True when the failure is in obtaining a Drive access token (as opposed
   *  to a network/Drive API error) — lets the banner offer a "Connect"/
   *  "Reconnect" action instead of just a generic message. */
  isAuthError: boolean
  /** True when Drive has never been connected on this device — lets the
   *  banner say "Connect" instead of "Reconnect". */
  neverConnected: boolean
}

type Listener = (error: SyncErrorState | null) => void

let currentError: SyncErrorState | null = null
const listeners = new Set<Listener>()

export function setSyncError(error: SyncErrorState | null): void {
  currentError = error
  listeners.forEach((listener) => listener(error))
}

export function subscribeSyncError(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSyncError(): SyncErrorState | null {
  return currentError
}
