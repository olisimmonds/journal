/**
 * Google OAuth via a direct Authorization Code + PKCE flow (RFC 7636),
 * requesting only the narrow `drive.file` scope — this grants access
 * exclusively to files this app itself creates in Drive (the single
 * visible backup file it writes), never your other Drive files.
 *
 * Unlike Google Identity Services' token-client (implicit-style) flow used
 * previously, this flow obtains a genuine long-lived refresh token, stored
 * locally in IndexedDB (`db.authTokens`). That refresh token is used to
 * silently mint new access tokens via a direct `fetch` to Google's token
 * endpoint — no popup, no iframe, and (unlike the old silent-iframe
 * renewal) it isn't defeated by browsers that block third-party cookies
 * (notably iOS PWAs). The interactive consent popup is only needed once,
 * ever — until you explicitly disconnect or revoke access from your Google
 * Account.
 *
 * This requires a client secret (`VITE_GOOGLE_CLIENT_SECRET`) to be shipped
 * in the client bundle, which is not how OAuth is normally supposed to
 * work for a public/browser client — see the README's "Data & privacy"
 * section for why that trade-off is acceptable for this single-user app.
 *
 * The in-memory access token cache is unchanged: never persisted, short
 * lived (~1 hour), refreshed a little early.
 */

import { db } from '../db/schema'
import { deriveCodeChallenge, generateRandomToken } from './pkce'

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke'
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
const AUTH_TOKEN_ROW_ID = 'google'

function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID is not set. Copy .env.example to .env and add your Google OAuth client ID (see README).',
    )
  }
  return clientId
}

function getClientSecret(): string {
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET
  if (!clientSecret) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_SECRET is not set. Copy .env.example to .env and add your Google OAuth client secret (see README).',
    )
  }
  return clientSecret
}

/** The static, non-React redirect target (public/oauth-callback.html) that
 *  completes the popup-based flow — see that file for what it does.
 *  Built from `BASE_URL` so it resolves correctly both in local dev and
 *  under a GitHub Pages subpath. */
function getRedirectUri(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}oauth-callback.html`
}

/** Error thrown for failures in the token-acquisition flow itself (as
 *  opposed to network/Drive API errors once a token was already obtained),
 *  so callers can offer a "Connect"/"Reconnect" action instead of a
 *  generic retry. */
export class DriveAuthError extends Error {
  readonly isAuthError = true
  /** True when Drive has never been connected on this device (as opposed
   *  to a previously-working connection that broke) — lets the UI show
   *  "Connect" instead of "Reconnect". */
  readonly neverConnected: boolean

  constructor(message: string, options?: { neverConnected?: boolean }) {
    super(message)
    this.neverConnected = options?.neverConnected ?? false
  }
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

export function getCachedAccessToken(): string | null {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token
  }
  return null
}

function cacheAccessToken(accessToken: string, expiresInSeconds: number): void {
  // Refresh a little early to avoid using an expired token mid-sync.
  const REFRESH_MARGIN_MS = 5 * 60 * 1000
  cachedAccessToken = {
    token: accessToken,
    expiresAt: Date.now() + expiresInSeconds * 1000 - REFRESH_MARGIN_MS,
  }
  scheduleProactiveRefresh()
}

async function getStoredRefreshToken(): Promise<string | null> {
  const row = await db.authTokens.get(AUTH_TOKEN_ROW_ID)
  return row?.refreshToken ?? null
}

async function setStoredRefreshToken(refreshToken: string): Promise<void> {
  await db.authTokens.put({ id: AUTH_TOKEN_ROW_ID, refreshToken, updatedAt: Date.now() })
}

async function clearStoredRefreshToken(): Promise<void> {
  await db.authTokens.delete(AUTH_TOKEN_ROW_ID)
}

/** Disconnects Google Drive on this device: clears the cached access token
 *  and the stored refresh token, and (best-effort) tells Google to revoke
 *  it server-side too. */
export async function signOutOfGoogleDrive(): Promise<void> {
  const refreshToken = await getStoredRefreshToken()
  cachedAccessToken = null
  lastAuthFailure = null
  clearScheduledRefresh()
  await clearStoredRefreshToken()

  if (refreshToken) {
    fetch(`${GOOGLE_REVOKE_ENDPOINT}?token=${encodeURIComponent(refreshToken)}`, {
      method: 'POST',
    }).catch(() => {
      // Best-effort — the local disconnect above is what actually matters
      // for this device; if the revoke call fails, Google will still expire
      // the token normally on its own schedule.
    })
  }
}

// Sync is triggered from several places in quick succession (autosave, image
// add/remove, note edits, app load, reconnect). Without this guard, each of
// those would independently try to refresh the access token at the same
// time. Concurrent callers now all await the same in-flight request.
let pendingTokenRequest: Promise<string> | null = null

// If sign-in is failing (revoked grant, network error, etc.), every
// subsequent action still calls triggerSync(), and without this cooldown
// each one would retry from scratch. While a recent attempt is still within
// the cooldown, callers get the same cached failure instead of retrying.
const AUTH_FAILURE_COOLDOWN_MS = 30_000
let lastAuthFailure: { error: DriveAuthError; failedAt: number } | null = null

/**
 * Returns a valid Drive access token, silently refreshing it from the
 * stored refresh token if needed. Never opens a popup — if Drive has never
 * been connected (no refresh token stored yet) or the stored refresh token
 * has been revoked, this throws a `DriveAuthError` instead, for the UI to
 * offer an explicit "Connect"/"Reconnect" action (see `reconnectGoogleDrive`).
 * A real user gesture is required to open the Google consent popup, so this
 * function deliberately never attempts to open one on its own.
 */
export async function requestDriveAccessToken(): Promise<string> {
  const cached = getCachedAccessToken()
  if (cached) return cached

  if (pendingTokenRequest) return pendingTokenRequest

  if (lastAuthFailure && Date.now() - lastAuthFailure.failedAt < AUTH_FAILURE_COOLDOWN_MS) {
    throw lastAuthFailure.error
  }

  pendingTokenRequest = silentlyRefreshAccessToken()
    .then((token) => {
      lastAuthFailure = null
      return token
    })
    .catch((err: unknown) => {
      const authError =
        err instanceof DriveAuthError ? err : new DriveAuthError('Google Drive sync failed.')
      lastAuthFailure = { error: authError, failedAt: Date.now() }
      throw authError
    })
    .finally(() => {
      pendingTokenRequest = null
    })
  return pendingTokenRequest
}

async function silentlyRefreshAccessToken(): Promise<string> {
  const refreshToken = await getStoredRefreshToken()
  if (!refreshToken) {
    throw new DriveAuthError("Google Drive isn't connected yet.", { neverConnected: true })
  }

  let tokens: { access_token: string; expires_in: number; refresh_token?: string }
  try {
    tokens = await postToTokenEndpoint({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })
  } catch {
    // The stored refresh token is no longer valid (revoked from the Google
    // Account's "Third-party access" settings, or similar) — clear it so we
    // don't keep retrying a token that will never work again.
    await clearStoredRefreshToken()
    throw new DriveAuthError('Google Drive access was revoked. Please reconnect.')
  }

  // Google does not normally rotate the refresh token on this grant type,
  // but store it if a new one is ever returned.
  if (tokens.refresh_token) await setStoredRefreshToken(tokens.refresh_token)
  cacheAccessToken(tokens.access_token, tokens.expires_in)
  return tokens.access_token
}

/** Forces the interactive consent popup — the only way to obtain the
 *  initial refresh token, or to replace one that was revoked. Only call
 *  this from a user gesture (a "Connect"/"Reconnect" button click);
 *  browsers block popups opened without one. */
export async function reconnectGoogleDrive(): Promise<string> {
  const tokens = await runAuthorizationCodeFlow()
  if (!tokens.refresh_token) {
    throw new DriveAuthError(
      'Google did not return a refresh token. If you previously connected this app, remove its access under myaccount.google.com/permissions and try connecting again.',
    )
  }
  await setStoredRefreshToken(tokens.refresh_token)
  cacheAccessToken(tokens.access_token, tokens.expires_in)
  lastAuthFailure = null
  return tokens.access_token
}

interface TokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
}

async function postToTokenEndpoint(params: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })

  if (!response.ok) {
    throw new DriveAuthError(`Google sign-in failed (${response.status}): ${await response.text()}`)
  }

  return response.json() as Promise<TokenResponse>
}

async function runAuthorizationCodeFlow(): Promise<TokenResponse> {
  const codeVerifier = generateRandomToken()
  const codeChallenge = await deriveCodeChallenge(codeVerifier)
  const state = generateRandomToken()
  const redirectUri = getRedirectUri()

  const authUrl = new URL(GOOGLE_AUTH_ENDPOINT)
  authUrl.searchParams.set('client_id', getClientId())
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', DRIVE_FILE_SCOPE)
  // access_type=offline + prompt=consent guarantees a refresh_token comes
  // back — Google otherwise omits it on a repeat consent for the same app.
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  authUrl.searchParams.set('state', state)

  const popup = window.open(authUrl.toString(), 'google-oauth', 'width=480,height=680')
  if (!popup) {
    throw new DriveAuthError(
      'The Google sign-in popup was blocked. Please allow popups for this site and try again.',
    )
  }

  const { code } = await waitForOauthCallback(popup, state)

  return postToTokenEndpoint({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  })
}

/** Listens for the postMessage sent by public/oauth-callback.html once the
 *  popup completes the Google consent screen and is redirected back. */
function waitForOauthCallback(popup: Window, expectedState: string): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    let settled = false

    function cleanup() {
      window.removeEventListener('message', onMessage)
      clearInterval(closedPollTimer)
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as
        | { type?: string; code?: string; state?: string; error?: string }
        | undefined
      if (!data || data.type !== 'journal-oauth-callback') return

      settled = true
      cleanup()
      popup.close()

      if (data.error) {
        reject(new DriveAuthError(`Google sign-in failed: ${data.error}`))
      } else if (data.state !== expectedState) {
        reject(new DriveAuthError('Google sign-in failed: unexpected response (state mismatch).'))
      } else if (!data.code) {
        reject(new DriveAuthError('Google sign-in did not return an authorization code.'))
      } else {
        resolve({ code: data.code })
      }
    }

    window.addEventListener('message', onMessage)

    // The user may close the popup manually instead of completing sign-in.
    const closedPollTimer = setInterval(() => {
      if (popup.closed && !settled) {
        cleanup()
        reject(new DriveAuthError('Google sign-in was cancelled.'))
      }
    }, 500)
  })
}

// Keeps the cached token warm during a long-open session so an in-progress
// visit never hits the ~55 min mark and has to pause mid-action for a
// refresh. This is a plain fetch against the refresh token, so — unlike the
// old silent-iframe approach — it works the same regardless of third-party
// cookie policy.
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

  const delay = Math.max(cachedAccessToken.expiresAt - Date.now(), 0)
  scheduledRefreshTimer = setTimeout(() => {
    requestDriveAccessToken().catch(() => {
      // Surfaces to the user the next time something actually needs to
      // sync; a background keep-alive failure alone shouldn't interrupt.
    })
  }, delay)
}

let proactiveRefreshInitialized = false

/** Call once on app start. Re-attempts the token refresh when the tab
 *  regains visibility if the cached token has since gone stale (e.g. the
 *  laptop was asleep past expiry), so returning to the app doesn't surprise
 *  the user with a delay on their next action. Never opens a popup — if no
 *  refresh token is stored yet, `requestDriveAccessToken` fails fast and
 *  this just swallows that (the next real sync surfaces it properly). */
export function initProactiveDriveRefresh(): void {
  if (proactiveRefreshInitialized) return
  proactiveRefreshInitialized = true

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (getCachedAccessToken()) return
    requestDriveAccessToken().catch(() => {
      // Same as above — real failures surface via the next real sync.
    })
  })
}
