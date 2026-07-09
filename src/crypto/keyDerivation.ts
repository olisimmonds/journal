/**
 * Derives an AES-256-GCM key from a user-chosen passphrase using PBKDF2.
 *
 * The passphrase itself is never stored or transmitted anywhere — only the
 * derived key lives in memory for the current session (see
 * `passphrase.session.ts`), and only a random salt (not a secret) is
 * persisted so the same passphrase re-derives the same key on other devices.
 */

const PBKDF2_ITERATIONS = 150_000
export const SALT_BYTE_LENGTH = 16

export function generateSalt(): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH))
}

export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const passphraseBytes = new TextEncoder().encode(passphrase)

  const baseKey = await crypto.subtle.importKey(
    'raw',
    passphraseBytes,
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable — the key can only be used, never exported
    ['encrypt', 'decrypt'],
  )
}
