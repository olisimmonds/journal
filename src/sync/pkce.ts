/**
 * PKCE (Proof Key for Code Exchange, RFC 7636) helpers for the Google OAuth
 * Authorization Code flow — see googleAuth.ts for how these are used.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** A random, URL-safe string used both as the PKCE code verifier and (in a
 *  second call) as the OAuth `state` CSRF token. */
export function generateRandomToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return base64UrlEncode(bytes)
}

/** Derives the PKCE `code_challenge` (S256 method) from a verifier. */
export async function deriveCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}
