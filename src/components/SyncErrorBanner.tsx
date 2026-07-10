import { useSyncExternalStore } from 'react'
import { getSyncError, setSyncError, subscribeSyncError } from '../sync/syncBus'

/** Fixed banner that surfaces the latest Drive sync failure loudly — stays
 *  up until the user dismisses it or a later sync succeeds. */
export function SyncErrorBanner() {
  const error = useSyncExternalStore(subscribeSyncError, getSyncError)
  if (!error) return null

  return (
    <div className="safe-top fixed inset-x-0 top-0 z-50 flex items-start gap-3 bg-danger px-4 py-3 text-sm text-white">
      <span className="flex-1">{error}</span>
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
