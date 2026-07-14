import { useSyncExternalStore, useState } from 'react'
import { getSyncError, setSyncError, subscribeSyncError } from '../sync/syncBus'
import { reconnectGoogleDrive } from '../sync/googleAuth'
import { triggerSync } from '../sync/triggerSync'

/** Fixed banner that surfaces the latest Drive sync failure loudly — stays
 *  up until the user dismisses it or a later sync succeeds, and keeps
 *  reappearing on the background auto-retry while the failure persists. */
export function SyncErrorBanner() {
  const error = useSyncExternalStore(subscribeSyncError, getSyncError)
  const [reconnecting, setReconnecting] = useState(false)
  if (!error) return null

  async function handleReconnect() {
    setReconnecting(true)
    try {
      await reconnectGoogleDrive()
      triggerSync()
    } catch {
      // reconnectGoogleDrive already reports its own failure via the next
      // triggerSync() call chain — nothing extra to do here.
    } finally {
      setReconnecting(false)
    }
  }

  return (
    <div className="safe-top fixed inset-x-0 top-0 z-50 flex items-start gap-3 bg-danger px-4 py-3 text-sm text-white">
      <span className="flex-1">{error.message}</span>
      {error.isAuthError && (
        <button
          type="button"
          onClick={handleReconnect}
          disabled={reconnecting}
          className="shrink-0 font-medium underline disabled:opacity-60"
        >
          {reconnecting ? 'Reconnecting…' : 'Reconnect'}
        </button>
      )}
      <button
        type="button"
        onClick={() => setSyncError(null)}
        aria-label="Dismiss sync error"
        className="shrink-0 font-medium underline"
      >
        Dismiss
      </button>
    </div>
  )
}
