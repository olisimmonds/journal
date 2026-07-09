import { type FormEvent, type ReactNode, useState } from 'react'
import { Button } from '../../components/Button'
import { LockIcon } from '../../components/icons'
import {
  getSessionKey,
  isPassphraseConfigured,
  setupPassphrase,
  unlockWithPassphrase,
} from '../../crypto/passphrase.session'

interface PassphraseGateProps {
  children: ReactNode
}

/**
 * Blocks the rest of the app until an encryption passphrase has been set
 * (first run) or re-entered (every new browser session). The derived key
 * only ever lives in memory — see src/crypto/passphrase.session.ts.
 */
export function PassphraseGate({ children }: PassphraseGateProps) {
  const [unlocked, setUnlocked] = useState(() => getSessionKey() !== null)
  // A cheap synchronous localStorage check — no need to cache it in state.
  const configured = isPassphraseConfigured()
  const [passphrase, setPassphrase] = useState('')
  const [confirmPassphrase, setConfirmPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (unlocked) return <>{children}</>

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!configured) {
      if (passphrase.length < 8) {
        setError('Choose a passphrase of at least 8 characters.')
        return
      }
      if (passphrase !== confirmPassphrase) {
        setError('Passphrases do not match.')
        return
      }
      setSubmitting(true)
      await setupPassphrase(passphrase)
      setSubmitting(false)
      setUnlocked(true)
      return
    }

    setSubmitting(true)
    const success = await unlockWithPassphrase(passphrase)
    setSubmitting(false)

    if (!success) {
      setError('Incorrect passphrase.')
      return
    }
    setUnlocked(true)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-0 px-6 animate-fade-in">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-primary">
            <LockIcon />
          </div>
          <h1 className="text-xl font-semibold text-ink-primary">
            {configured ? 'Enter your passphrase' : 'Set an encryption passphrase'}
          </h1>
          <p className="text-sm text-ink-tertiary">
            {configured
              ? 'Your journal is encrypted on this device. Enter your passphrase to continue.'
              : 'This passphrase encrypts your journal before any cloud backup. It is never sent anywhere and cannot be recovered if lost — store it somewhere safe.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="password"
            autoFocus
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            placeholder="Passphrase"
            className="min-h-11 rounded-xl border border-border bg-surface-2 px-4 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink-secondary"
          />

          {!configured && (
            <input
              type="password"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              placeholder="Confirm passphrase"
              className="min-h-11 rounded-xl border border-border bg-surface-2 px-4 text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink-secondary"
            />
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" variant="primary" disabled={submitting || !passphrase}>
            {configured ? 'Unlock' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  )
}
