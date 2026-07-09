import { base64ToBuffer, bufferToBase64, decryptFromPayload, encryptToPayload } from './aesGcm'
import { deriveKeyFromPassphrase, generateSalt } from './keyDerivation'

/**
 * Manages the app's single encryption key for the current browser session.
 *
 * The key itself is derived from a user passphrase and never persisted —
 * only a random salt and a small "canary" ciphertext are kept in
 * localStorage, so a re-entered passphrase can be verified as correct
 * without ever storing the passphrase or the key on disk. Losing the
 * passphrase means the encrypted Drive backup is unrecoverable by design.
 */

const SALT_STORAGE_KEY = 'journal.crypto.salt'
const CANARY_STORAGE_KEY = 'journal.crypto.canary'
const CANARY_PLAINTEXT = 'journal-passphrase-verification'

let sessionKey: CryptoKey | null = null

export function isPassphraseConfigured(): boolean {
  return (
    localStorage.getItem(SALT_STORAGE_KEY) !== null &&
    localStorage.getItem(CANARY_STORAGE_KEY) !== null
  )
}

export function getSessionKey(): CryptoKey | null {
  return sessionKey
}

/** Clears the in-memory key. Does not touch the persisted salt/canary. */
export function lockSession(): void {
  sessionKey = null
}

/**
 * First-run setup: establishes a new passphrase and derives the session key.
 * A specific `salt` may be supplied when restoring an existing encrypted
 * Google Drive backup onto a new device, so the same passphrase re-derives
 * the exact key that backup was encrypted with.
 */
export async function setupPassphrase(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer> = generateSalt(),
): Promise<void> {
  const key = await deriveKeyFromPassphrase(passphrase, salt)
  const canary = await encryptToPayload(key, CANARY_PLAINTEXT)

  localStorage.setItem(SALT_STORAGE_KEY, bufferToBase64(salt))
  localStorage.setItem(CANARY_STORAGE_KEY, JSON.stringify(canary))

  sessionKey = key
}

/** The current device's salt, base64-encoded — embedded in every Drive backup. */
export function getStoredSaltBase64(): string | null {
  return localStorage.getItem(SALT_STORAGE_KEY)
}

/**
 * Attempts to unlock the session with a re-entered passphrase.
 * Returns `false` (without throwing) if the passphrase is incorrect —
 * this is an expected, user-facing outcome, not an error condition.
 */
export async function unlockWithPassphrase(passphrase: string): Promise<boolean> {
  const saltBase64 = localStorage.getItem(SALT_STORAGE_KEY)
  const canaryJson = localStorage.getItem(CANARY_STORAGE_KEY)

  if (!saltBase64 || !canaryJson) {
    throw new Error('No passphrase has been configured on this device yet.')
  }

  const salt = base64ToBuffer(saltBase64)
  const key = await deriveKeyFromPassphrase(passphrase, salt)

  try {
    const decrypted = await decryptFromPayload(key, JSON.parse(canaryJson))
    if (decrypted !== CANARY_PLAINTEXT) return false
  } catch {
    // AES-GCM authentication failure means the passphrase was wrong.
    return false
  }

  sessionKey = key
  return true
}

/**
 * Resets all local passphrase state, e.g. when the user explicitly chooses
 * to start over. This does not delete journal data or Drive backups.
 */
export function resetPassphraseConfiguration(): void {
  localStorage.removeItem(SALT_STORAGE_KEY)
  localStorage.removeItem(CANARY_STORAGE_KEY)
  lockSession()
}
