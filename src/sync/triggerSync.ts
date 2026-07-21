import { DriveAuthError } from './googleAuth'
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

// While a sync is failing, keep retrying in the background even if the user
// isn't actively editing anything — otherwise a dismissed banner combined
// with a quiet reading session would leave sync silently broken with no
// further signal. This is what makes failures "shout loudly": the banner
// keeps reappearing until a sync actually succeeds.
const RETRY_INTERVAL_MS = 5 * 60 * 1000
let retryTimer: ReturnType<typeof setTimeout> | null = null

export function triggerSync(): void {
  // Every edit still saves locally to IndexedDB regardless — this only
  // skips the Drive round-trip. `useBackgroundSync`'s `online` listener
  // re-triggers a sync as soon as connectivity returns, so nothing needs to
  // be queued here; retrying against a connection we already know is down
  // would just produce a scary "Failed to fetch" in the error banner for a
  // perfectly expected state (see OfflineBanner for how that's surfaced
  // instead).
  if (!navigator.onLine) {
    // OfflineBanner already communicates this state calmly — an existing
    // red error banner (e.g. from a failure right before connectivity
    // dropped) would otherwise linger alongside it and read as two
    // conflicting messages.
    setSyncError(null)
    return
  }

  if (syncInFlight) {
    syncQueued = true
    return
  }

  syncInFlight = runSyncUntilQuiet()
}

async function runSyncUntilQuiet(): Promise<void> {
  do {
    syncQueued = false
    if (!navigator.onLine) {
      clearRetryTimer()
      break
    }
    try {
      await syncWithGoogleDrive()
      setSyncError(null)
      clearRetryTimer()
    } catch (err: unknown) {
      if (!navigator.onLine) {
        // Connectivity dropped mid-request — expected, not a real failure.
        clearRetryTimer()
        break
      }
      const isAuthError = err instanceof DriveAuthError
      setSyncError({
        message: err instanceof Error ? err.message : 'Google Drive sync failed.',
        isAuthError,
        neverConnected: isAuthError && err.neverConnected,
      })
      scheduleRetry()
    }
  } while (syncQueued)

  syncInFlight = null
}

function clearRetryTimer(): void {
  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    triggerSync()
  }, RETRY_INTERVAL_MS)
}
