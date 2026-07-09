/** AES-GCM encrypt/decrypt helpers, plus base64 codecs for JSON transport. */

export const IV_BYTE_LENGTH = 12

export interface EncryptedPayload {
  /** Base64-encoded initialization vector. */
  iv: string
  /** Base64-encoded ciphertext (includes the GCM auth tag). */
  ciphertext: string
}

export async function encryptToPayload(
  key: CryptoKey,
  plaintext: string,
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTE_LENGTH))
  const plaintextBytes = new TextEncoder().encode(plaintext)

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintextBytes,
  )

  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(ciphertextBuffer)),
  }
}

export async function decryptFromPayload(
  key: CryptoKey,
  payload: EncryptedPayload,
): Promise<string> {
  const iv = base64ToBuffer(payload.iv)
  const ciphertext = base64ToBuffer(payload.ciphertext)

  const plaintextBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)

  return new TextDecoder().decode(plaintextBuffer)
}

export function bufferToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBuffer(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
