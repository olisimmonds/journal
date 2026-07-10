import { syncWithGoogleDrive } from './syncManager'
import { setSyncError } from './syncBus'

/**
 * Fire-and-forget Google Drive sync. There is no manual "sync now" button —
 * every mutating user action (saving an entry, deleting a note, etc.) calls
 * this so the Drive backup stays continuously up to date. Failures (missing
 * `VITE_GOOGLE_CLIENT_ID`, network errors, Drive API errors) are never
 * swallowed — they surface via the global sync error banner until dismissed.
 *
 * Calls are coalesced rather than run in parallel: several actions often
 * fire in quick succession (e.g. app load plus the first autosave), and
 * running `syncWithGoogleDrive` concurrently would each independently try
 * to obtain a Drive access token, opening more than one Google sign-in
 * popup at once. While a sync is in flight, further calls just mark one
 * more sync as queued, which runs immediately after the current one finishes.
 */
let syncInFlight: Promise<void> | null = null
let syncQueued = false

export function triggerSync(): void {
  if (syncInFlight) {
    syncQueued = true
    return
  }

  syncInFlight = runSyncUntilQuiet()
}

async function runSyncUntilQuiet(): Promise<void> {
  do {
    syncQueued = false
    try {
      await syncWithGoogleDrive()
      setSyncError(null)
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : 'Google Drive sync failed.')
    }
  } while (syncQueued)

  syncInFlight = null
}
