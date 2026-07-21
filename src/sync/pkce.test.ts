import { describe, expect, it } from 'vitest'
import { deriveCodeChallenge, generateRandomToken } from './pkce'

describe('pkce', () => {
  it('generates URL-safe, sufficiently random tokens', () => {
    const a = generateRandomToken()
    const b = generateRandomToken()

    expect(a).not.toBe(b)
    expect(a.length).toBeGreaterThanOrEqual(43) // RFC 7636 minimum verifier length
    expect(a).toMatch(/^[A-Za-z0-9\-_]+$/)
  })

  it('derives the same challenge for the same verifier (deterministic)', async () => {
    const verifier = generateRandomToken()
    const challengeA = await deriveCodeChallenge(verifier)
    const challengeB = await deriveCodeChallenge(verifier)

    expect(challengeA).toBe(challengeB)
    expect(challengeA).not.toBe(verifier)
  })

  it('derives different challenges for different verifiers', async () => {
    const challengeA = await deriveCodeChallenge(generateRandomToken())
    const challengeB = await deriveCodeChallenge(generateRandomToken())

    expect(challengeA).not.toBe(challengeB)
  })
})
