import { beforeEach, describe, expect, it } from 'vitest'
import { decryptFromPayload, encryptToPayload } from './aesGcm'
import { deriveKeyFromPassphrase, generateSalt } from './keyDerivation'
import {
  getSessionKey,
  isPassphraseConfigured,
  lockSession,
  resetPassphraseConfiguration,
  setupPassphrase,
  unlockWithPassphrase,
} from './passphrase.session'

describe('AES-GCM round trip', () => {
  it('encrypts and decrypts back to the original plaintext', async () => {
    const key = await deriveKeyFromPassphrase('correct horse battery staple', generateSalt())
    const payload = await encryptToPayload(key, 'sensitive journal content')

    expect(await decryptFromPayload(key, payload)).toBe('sensitive journal content')
  })

  it('fails to decrypt with the wrong key', async () => {
    const salt = generateSalt()
    const key = await deriveKeyFromPassphrase('correct passphrase', salt)
    const wrongKey = await deriveKeyFromPassphrase('wrong passphrase', salt)

    const payload = await encryptToPayload(key, 'secret')
    await expect(decryptFromPayload(wrongKey, payload)).rejects.toThrow()
  })

  it('produces a different ciphertext each time due to a random IV', async () => {
    const key = await deriveKeyFromPassphrase('passphrase', generateSalt())
    const a = await encryptToPayload(key, 'same message')
    const b = await encryptToPayload(key, 'same message')

    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })
})

describe('passphrase session', () => {
  beforeEach(() => {
    localStorage.clear()
    lockSession()
  })

  it('is not configured until setupPassphrase runs', () => {
    expect(isPassphraseConfigured()).toBe(false)
  })

  it('sets up a passphrase and caches the session key', async () => {
    await setupPassphrase('my passphrase')

    expect(isPassphraseConfigured()).toBe(true)
    expect(getSessionKey()).not.toBeNull()
  })

  it('unlocks successfully with the correct passphrase after a lock', async () => {
    await setupPassphrase('my passphrase')
    lockSession()
    expect(getSessionKey()).toBeNull()

    const ok = await unlockWithPassphrase('my passphrase')

    expect(ok).toBe(true)
    expect(getSessionKey()).not.toBeNull()
  })

  it('rejects an incorrect passphrase without throwing', async () => {
    await setupPassphrase('my passphrase')
    lockSession()

    const ok = await unlockWithPassphrase('wrong guess')

    expect(ok).toBe(false)
    expect(getSessionKey()).toBeNull()
  })

  it('throws if unlocking before any passphrase has been configured', async () => {
    await expect(unlockWithPassphrase('anything')).rejects.toThrow()
  })

  it('resetPassphraseConfiguration clears stored state', async () => {
    await setupPassphrase('my passphrase')
    resetPassphraseConfiguration()

    expect(isPassphraseConfigured()).toBe(false)
    expect(getSessionKey()).toBeNull()
  })
})
