/**
 * Google OAuth via Google Identity Services (GIS), requesting only the
 * narrow `drive.file` scope — this grants access exclusively to files this
 * app itself creates in Drive (the single visible backup file it writes),
 * never your other Drive files.
 *
 * The access token is kept in memory only (never persisted) and is short
 * lived (~1 hour); callers should request a fresh one before each sync.
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
        }
      }
    }
  }
}

interface TokenClientConfig {
  client_id: string
  scope: string
  callback: (response: TokenResponse) => void
  error_callback?: (error: { type: string }) => void
}

interface TokenResponse {
  access_token?: string
  error?: string
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void
}

let gisScriptLoadPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisScriptLoadPromise) return gisScriptLoadPromise

  gisScriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script.'))
    document.head.appendChild(script)
  })

  return gisScriptLoadPromise
}

function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env and add your Google OAuth client ID (see README).',
    )
  }
  return clientId
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

export function getCachedAccessToken(): string | null {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token
  }
  return null
}

export function signOutOfGoogleDrive(): void {
  cachedAccessToken = null
  lastAuthFailure = null
  localStorage.removeItem(HAS_GRANTED_STORAGE_KEY)
  clearScheduledRefresh()
}

/** Error thrown for failures in the token-acquisition flow itself (as
 *  opposed to network/Drive API errors once a token was already obtained),
 *  so callers can offer a "Reconnect" action instead of a generic retry. */
export class DriveAuthError extends Error {
  readonly isAuthError = true
}

// Sync is triggered from several places in quick succession (autosave, image
// add/remove, note edits, app load, reconnect). Without this guard, each of
// those would spin up its own Google Identity Services token client at the
// same time — overlapping popups is exactly what made the sign-in dialog
// look like it kept reopening/reloading. Concurrent callers now all await
// the same in-flight request instead of opening a second popup.
let pendingTokenRequest: Promise<string> | null = null

// If sign-in is failing (wrong origin, account not added as a test user,
// popup blocked, etc.), every subsequent action still calls triggerSync(),
// and without this cooldown each one would retry the OAuth handshake from
// scratch — reopening a new popup (or, when mobile browsers block the
// popup, a new tab) on every autosave. While a recent attempt is still
// within the cooldown, callers get the same cached failure instead of
// triggering another sign-in attempt.
const AUTH_FAILURE_COOLDOWN_MS = 30_000
let lastAuthFailure: { error: Error; failedAt: number } | null = null

// Once the user has granted Drive access at least once on this browser,
// later token renewals try a silent request first (`prompt: ''`) — Google
// can reissue a token with no popup at all if the browser session and
// grant are still valid, which is what makes repeat sign-ins on the same
// device mostly invisible. Only falls back to the interactive consent
// popup if the silent attempt fails (e.g. the grant was revoked, or this
// is genuinely a new browser/device).
const HAS_GRANTED_STORAGE_KEY = 'journal.sync.hasGrantedDriveAccess'

function hasGrantedBefore(): boolean {
  return localStorage.getItem(HAS_GRANTED_STORAGE_KEY) === 'true'
}

/**
 * Requests an access token, prompting the Google sign-in/consent popup only
 * when necessary (first use, a revoked grant, or after a silent renewal
 * attempt fails).
 */
export async function requestDriveAccessToken(): Promise<string> {
  const cached = getCachedAccessToken()
  if (cached) return cached

  if (pendingTokenRequest) return pendingTokenRequest

  if (lastAuthFailure && Date.now() - lastAuthFailure.failedAt < AUTH_FAILURE_COOLDOWN_MS) {
    throw lastAuthFailure.error
  }

  pendingTokenRequest = requestNewAccessToken()
    .then((token) => {
      lastAuthFailure = null
      return token
    })
    .catch((err: unknown) => {
      lastAuthFailure = {
        error: err instanceof Error ? err : new DriveAuthError('Google sign-in failed.'),
        failedAt: Date.now(),
      }
      throw err
    })
    .finally(() => {
      pendingTokenRequest = null
    })
  return pendingTokenRequest
}

/** Forces the interactive consent popup, skipping the silent attempt and
 *  the failure cooldown. Only call this from a user gesture (e.g. a
 *  "Reconnect" button click) — browsers block popups opened without one. */
export async function reconnectGoogleDrive(): Promise<string> {
  await loadGisScript()
  const clientId = getClientId()
  const token = await requestTokenWithPrompt(clientId, 'consent')
  lastAuthFailure = null
  return token
}

const SILENT_RETRY_DELAY_MS = 1_500

async function requestNewAccessToken(): Promise<string> {
  await loadGisScript()
  const clientId = getClientId()

  if (hasGrantedBefore()) {
    try {
      return await requestTokenWithPrompt(clientId, '')
    } catch {
      // The silent iframe occasionally loses a race on first load or hits a
      // transient network blip rather than a genuinely revoked/blocked
      // grant — one quick retry avoids escalating those to a visible popup.
      await new Promise((resolve) => setTimeout(resolve, SILENT_RETRY_DELAY_MS))
      try {
        return await requestTokenWithPrompt(clientId, '')
      } catch {
        // Still failing — fall through to an interactive prompt.
      }
    }
  }

  return requestTokenWithPrompt(clientId, 'consent')
}

function requestTokenWithPrompt(clientId: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(
            new DriveAuthError(response.error ?? 'Google sign-in did not return an access token.'),
          )
          return
        }
        // Google access tokens for this flow are valid for 1 hour; refresh
        // a little early to avoid using an expired token mid-sync.
        cachedAccessToken = {
          token: response.access_token,
          expiresAt: Date.now() + 55 * 60 * 1000,
        }
        localStorage.setItem(HAS_GRANTED_STORAGE_KEY, 'true')
        scheduleProactiveRefresh()
        resolve(response.access_token)
      },
      error_callback: (error) => {
        reject(new DriveAuthError(`Google sign-in failed: ${error.type}`))
      },
    })

    tokenClient.requestAccessToken({ prompt })
  })
}

// Keeps the cached token warm during a long-open session so an in-progress
// visit never hits the ~55 min mark and has to silently (or interactively)
// re-authenticate mid-action. Only runs once a grant already exists on this
// browser — never opens a popup on its own.
let scheduledRefreshTimer: ReturnType<typeof setTimeout> | null = null

function clearScheduledRefresh(): void {
  if (scheduledRefreshTimer) {
    clearTimeout(scheduledRefreshTimer)
    scheduledRefreshTimer = null
  }
}

function scheduleProactiveRefresh(): void {
  clearScheduledRefresh()
  if (!cachedAccessToken) return

  const REFRESH_MARGIN_MS = 5 * 60 * 1000
  const delay = Math.max(cachedAccessToken.expiresAt - Date.now() - REFRESH_MARGIN_MS, 0)

  scheduledRefreshTimer = setTimeout(() => {
    requestDriveAccessToken().catch(() => {
      // Surfaces to the user the next time something actually needs to
      // sync; a background keep-alive failure alone shouldn't interrupt.
    })
  }, delay)
}

let proactiveRefreshInitialized = false

/** Call once on app start. Re-arms the silent refresh when the tab regains
 *  visibility if the cached token has since gone stale (e.g. the laptop was
 *  asleep past expiry), so returning to the app doesn't surprise the user
 *  with a popup on their next action. */
export function initProactiveDriveRefresh(): void {
  if (proactiveRefreshInitialized) return
  proactiveRefreshInitialized = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (!hasGrantedBefore()) return
    if (getCachedAccessToken()) return
    requestDriveAccessToken().catch(() => {
      // Same as above — real failures surface via the next real sync.
    })
  })
}
