import { buildBackupData } from '../../sync/backupSerializer'
import { downloadBlob } from '../../utils/download'

/**
 * Exports the full, unencrypted app state (entries, images, notes) as a
 * single JSON file — the guaranteed no-lock-in escape hatch. Anyone can
 * migrate away from this app with this file alone, no passphrase required.
 */
export async function exportAsJson(): Promise<void> {
  const data = await buildBackupData()
  const json = JSON.stringify(data, null, 2)
  const filename = `journal-export-${new Date().toISOString().slice(0, 10)}.json`

  downloadBlob(filename, new Blob([json], { type: 'application/json' }))
}
