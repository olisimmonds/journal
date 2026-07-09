import { useState } from 'react'
import { Button } from '../../components/Button'
import { CloudIcon } from '../../components/icons'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { getLastSyncedAt, syncWithGoogleDrive } from '../../sync/syncManager'

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

/** Settings section: connect to Google Drive and trigger encrypted backup/sync. */
export function DriveSyncSection() {
  const isOnline = useOnlineStatus()
  const [status, setStatus] = useState<'idle' | 'syncing' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(getLastSyncedAt())

  const handleSyncNow = async () => {
    setStatus('syncing')
    setError(null)
    try {
      const result = await syncWithGoogleDrive()
      setLastSyncedAt(result.pushedAt)
      setStatus('idle')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Sync failed.')
    }
  }

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-ink-tertiary uppercase">
        Cloud backup
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4">
        <p className="text-sm text-ink-secondary">
          Your journal is encrypted on this device before it ever leaves it, then stored in a
          hidden, app-only folder in your own Google Drive — visible to this app alone, not your
          regular Drive files.
        </p>

        <p className="text-xs text-ink-tertiary">
          {lastSyncedAt ? `Last synced ${formatTimestamp(lastSyncedAt)}` : 'Never synced yet'}
        </p>

        {!isOnline && <p className="text-xs text-ink-tertiary">You are offline. Connect to sync.</p>}
        {error && <p className="text-sm text-danger">{error}</p>}

        <Button variant="secondary" onClick={handleSyncNow} disabled={!isOnline || status === 'syncing'}>
          <CloudIcon width={16} height={16} />
          {status === 'syncing' ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>
    </section>
  )
}
