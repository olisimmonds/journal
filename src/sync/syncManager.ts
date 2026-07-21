import { db } from '../db/schema'
import { buildBackupData, deserializeImage, type BackupData } from './backupSerializer'
import {
  createSnapshotFile,
  deleteFile,
  downloadBackupContent,
  findBackupFileId,
  listSnapshotFiles,
  SNAPSHOT_FILE_PREFIX,
  uploadBackupContent,
} from './driveClient'
import { requestDriveAccessToken, signOutOfGoogleDrive } from './googleAuth'

const LAST_SYNCED_STORAGE_KEY = 'journal.sync.lastSyncedAt'
const LAST_SNAPSHOT_STORAGE_KEY = 'journal.sync.lastSnapshotAt'

// A safety net independent of the live backup file: if a bad sync (or a
// mistake on your end) ever overwrites journal-backup.json with something
// you didn't want, Drive's own revision history for that file isn't
// guaranteed to still have what you need — Drive prunes old revisions of
// API-uploaded files after ~30 days. These snapshots are separate,
// never-overwritten files instead, so they survive regardless of what
// happens to the live backup or its revision history.
const SNAPSHOT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_SNAPSHOTS = 12

export function getLastSyncedAt(): number | null {
  const raw = localStorage.getItem(LAST_SYNCED_STORAGE_KEY)
  return raw ? Number(raw) : null
}

/** Writes a new dated snapshot file once a week (and prunes the oldest
 *  beyond `MAX_SNAPSHOTS`), so old data can still be recovered even if the
 *  live backup file gets overwritten with something wrong. Best-effort:
 *  failures here don't fail the overall sync, since the live backup above
 *  already succeeded. */
export async function maybeCreateWeeklySnapshot(accessToken: string, content: string): Promise<void> {
  const lastSnapshotAt = Number(localStorage.getItem(LAST_SNAPSHOT_STORAGE_KEY) ?? 0)
  if (Date.now() - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return

  const dateLabel = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  await createSnapshotFile(accessToken, `${SNAPSHOT_FILE_PREFIX}${dateLabel}.json`, content)
  localStorage.setItem(LAST_SNAPSHOT_STORAGE_KEY, String(Date.now()))

  const snapshots = await listSnapshotFiles(accessToken)
  const stale = snapshots.slice(0, Math.max(0, snapshots.length - MAX_SNAPSHOTS))
  await Promise.all(stale.map((file) => deleteFile(accessToken, file.id)))
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
  const serialized = JSON.stringify(localData)
  await uploadBackupContent(accessToken, fileId, serialized)

  try {
    await maybeCreateWeeklySnapshot(accessToken, serialized)
  } catch (err) {
    // See maybeCreateWeeklySnapshot's doc comment — this is a best-effort
    // safety net, not the primary sync path.
    console.warn('Failed to create/prune a weekly Drive backup snapshot.', err)
  }

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
