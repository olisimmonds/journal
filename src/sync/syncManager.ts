import { db } from '../db/schema'
import { buildBackupData, deserializeImage, type BackupData } from './backupSerializer'
import { downloadBackupContent, findBackupFileId, uploadBackupContent } from './driveClient'
import { requestDriveAccessToken, signOutOfGoogleDrive } from './googleAuth'

const LAST_SYNCED_STORAGE_KEY = 'journal.sync.lastSyncedAt'

export function getLastSyncedAt(): number | null {
  const raw = localStorage.getItem(LAST_SYNCED_STORAGE_KEY)
  return raw ? Number(raw) : null
}

export interface SyncResult {
  /** Records pulled from Drive that were newer than the local copy. */
  mergedEntries: number
  mergedNotes: number
  pushedAt: number
}

/**
 * Runs one full sync cycle: pull the remote backup (if any) and merge
 * anything newer into the local database, then push the resulting local
 * state back up. This is intentionally simple last-write-wins-per-record
 * sync, appropriate for a single user working across a few personal
 * devices — not a general-purpose CRDT/multi-writer merge.
 */
export async function syncWithGoogleDrive(): Promise<SyncResult> {
  const accessToken = await requestDriveAccessToken()
  const fileId = await findBackupFileId(accessToken)

  let mergedEntries = 0
  let mergedNotes = 0

  if (fileId) {
    const raw = await downloadBackupContent(accessToken, fileId)
    const remote = JSON.parse(raw) as BackupData
    ;({ mergedEntries, mergedNotes } = await mergeRemoteIntoLocal(remote))
  }

  const localData = await buildBackupData()
  await uploadBackupContent(accessToken, fileId, JSON.stringify(localData))

  const pushedAt = Date.now()
  localStorage.setItem(LAST_SYNCED_STORAGE_KEY, String(pushedAt))

  return { mergedEntries, mergedNotes, pushedAt }
}

/**
 * Merges a remote backup into the local database.
 *
 * Tombstones are applied first and always win over an older remote copy,
 * so a deletion made on one device is never resurrected by an older backup
 * from another device. Non-deleted records use last-write-wins by
 * `updatedAt`.
 */
export async function mergeRemoteIntoLocal(
  remote: BackupData,
): Promise<{ mergedEntries: number; mergedNotes: number }> {
  let mergedEntries = 0
  let mergedNotes = 0

  await db.transaction(
    'rw',
    db.entries,
    db.images,
    db.notes,
    db.tombstones,
    async () => {
      const localTombstones = await db.tombstones.toArray()
      const tombstoneByRecordId = new Map(localTombstones.map((t) => [t.id, t]))

      for (const remoteTombstone of remote.tombstones) {
        const localTombstone = tombstoneByRecordId.get(remoteTombstone.id)
        if (localTombstone && localTombstone.deletedAt >= remoteTombstone.deletedAt) continue

        await db.tombstones.put(remoteTombstone)
        tombstoneByRecordId.set(remoteTombstone.id, remoteTombstone)

        if (remoteTombstone.type === 'entry') {
          await db.images.where('entryId').equals(remoteTombstone.id).delete()
          await db.entries.delete(remoteTombstone.id)
        } else {
          await db.notes.delete(remoteTombstone.id)
        }
      }

      for (const remoteEntry of remote.entries) {
        const tombstone = tombstoneByRecordId.get(remoteEntry.id)
        if (tombstone && tombstone.deletedAt >= remoteEntry.updatedAt) continue

        const localEntry = await db.entries.get(remoteEntry.id)
        if (!localEntry || remoteEntry.updatedAt > localEntry.updatedAt) {
          await db.entries.put(remoteEntry)
          mergedEntries++
        }
      }

      for (const remoteImage of remote.images) {
        const tombstone = tombstoneByRecordId.get(remoteImage.entryId)
        if (tombstone && tombstone.deletedAt >= remoteImage.createdAt) continue

        const alreadyLocal = await db.images.get(remoteImage.id)
        if (!alreadyLocal) {
          await db.images.add(deserializeImage(remoteImage))
        }
      }

      for (const remoteNote of remote.notes) {
        const tombstone = tombstoneByRecordId.get(remoteNote.id)
        if (tombstone && tombstone.deletedAt >= remoteNote.updatedAt) continue

        const localNote = await db.notes.get(remoteNote.id)
        if (!localNote || remoteNote.updatedAt > localNote.updatedAt) {
          await db.notes.put(remoteNote)
          mergedNotes++
        }
      }
    },
  )

  return { mergedEntries, mergedNotes }
}

export async function disconnectGoogleDrive(): Promise<void> {
  await signOutOfGoogleDrive()
}
