/**
 * Google OAuth via Google Identity Services (GIS), requesting only the
 * narrow `drive.appdata` scope — this grants access exclusively to a
 * hidden per-app folder in the user's Drive, never their visible files.
 *
 * The access token is kept in memory only (never persisted) and is short
 * lived (~1 hour); callers should request a fresh one before each sync.
 */

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'
const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

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
}

/**
 * Requests an access token, prompting the Google sign-in/consent popup only
 * when necessary (first use, or after the cached token expires).
 */
export async function requestDriveAccessToken(): Promise<string> {
  const cached = getCachedAccessToken()
  if (cached) return cached

  await loadGisScript()
  const clientId = getClientId()

  return new Promise((resolve, reject) => {
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_APPDATA_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'Google sign-in did not return an access token.'))
          return
        }
        // Google access tokens for this flow are valid for 1 hour; refresh
        // a little early to avoid using an expired token mid-sync.
        cachedAccessToken = {
          token: response.access_token,
          expiresAt: Date.now() + 55 * 60 * 1000,
        }
        resolve(response.access_token)
      },
      error_callback: (error) => {
        reject(new Error(`Google sign-in failed: ${error.type}`))
      },
    })

    tokenClient.requestAccessToken({ prompt: cached ? '' : 'consent' })
  })
}
