import { useSyncExternalStore } from 'react'

function subscribe(callback: () => void): () => void {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}

function getSnapshot(): boolean {
  return navigator.onLine
}

/** Calm, non-alarming banner (as opposed to SyncErrorBanner's red one) that
 *  reassures the user their edits are still being saved while offline —
 *  the app always writes to IndexedDB first regardless of connectivity, so
 *  nothing is at risk; this just makes that fact visible instead of the
 *  user wondering where their changes went. Disappears the moment the
 *  device reconnects, at which point `useBackgroundSync`'s `online`
 *  listener triggers a catch-up Drive sync automatically. */
export function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribe, getSnapshot)
  if (isOnline) return null

  return (
    <div className="safe-top fixed inset-x-0 top-0 z-40 bg-surface-2 px-4 py-2 text-center text-sm text-ink-secondary">
      You're offline — changes are being saved on this device and will sync automatically once
      you're back online.
    </div>
  )
}
