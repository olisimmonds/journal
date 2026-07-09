import { type ReactNode, useState } from 'react'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LockIcon } from '../../components/icons'
import { lockSession, resetPassphraseConfiguration } from '../../crypto/passphrase.session'
import { db } from '../../db/schema'
import { DriveSyncSection } from '../backup/DriveSyncSection'
import { ExportSection } from '../backup/ExportSection'

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-ink-tertiary uppercase">{title}</h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4">
        {children}
      </div>
    </section>
  )
}

/** Settings: passphrase/security controls, Google Drive sync, backup & export, danger zone. */
export function SettingsPage() {
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const handleLockNow = () => {
    lockSession()
    // Reload so the PassphraseGate re-checks session state from scratch.
    window.location.reload()
  }

  const handleResetPassphrase = () => {
    resetPassphraseConfiguration()
    setConfirmReset(false)
    window.location.reload()
  }

  const handleWipeLocalData = async () => {
    await db.delete()
    setConfirmWipe(false)
    window.location.reload()
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-6 pb-10">
      <h1 className="mb-4 text-xl font-semibold text-ink-primary">Settings</h1>

      <SettingsSection title="Security">
        <p className="text-sm text-ink-secondary">
          Your journal is encrypted with a passphrase on this device. Locking clears the key from
          memory until you re-enter it.
        </p>
        <Button variant="secondary" onClick={handleLockNow}>
          <LockIcon width={16} height={16} />
          Lock journal now
        </Button>
      </SettingsSection>

      <DriveSyncSection />

      <ExportSection />

      <SettingsSection title="Danger zone">
        <div>
          <p className="mb-2 text-sm text-ink-secondary">
            Resetting your passphrase forgets it on this device. You will need your original
            passphrase to decrypt any existing Drive backup — this does not delete local data.
          </p>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            Reset passphrase
          </Button>
        </div>
        <div>
          <p className="mb-2 text-sm text-ink-secondary">
            Permanently deletes all journal entries, images, and notes stored on this device.
            Export a backup first if you want to keep your data.
          </p>
          <Button variant="danger" onClick={() => setConfirmWipe(true)}>
            Erase all local data
          </Button>
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={confirmReset}
        title="Reset passphrase?"
        description="You'll be asked to set a new passphrase. Any existing Google Drive backup can only be restored with the original passphrase."
        confirmLabel="Reset"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleResetPassphrase}
      />

      <ConfirmDialog
        open={confirmWipe}
        title="Erase all local data?"
        description="This permanently deletes every journal entry, photo, and note on this device. This cannot be undone."
        confirmLabel="Erase everything"
        destructive
        onCancel={() => setConfirmWipe(false)}
        onConfirm={handleWipeLocalData}
      />
    </div>
  )
}
