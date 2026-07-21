import Dexie, { type EntityTable } from 'dexie'
import type {
  ImageAttachment,
  JournalEntry,
  Note,
  NoteVersion,
  StoredGoogleAuth,
  Tombstone,
} from './types'

/**
 * The single local database for the app. All app data lives here first;
 * Google Drive sync (see src/sync) is a backup/restore layer on top, never
 * the primary read path.
 *
 * Schema versioning: add a new `.version(n)` block with `.upgrade()` when
 * changing the shape of stored data. Never mutate an existing `.version()`
 * block once it has shipped.
 */
export class JournalDatabase extends Dexie {
  entries!: EntityTable<JournalEntry, 'id'>
  images!: EntityTable<ImageAttachment, 'id'>
  notes!: EntityTable<Note, 'id'>
  tombstones!: EntityTable<Tombstone, 'id'>
  noteVersions!: EntityTable<NoteVersion, 'id'>
  authTokens!: EntityTable<StoredGoogleAuth, 'id'>

  constructor() {
    super('journal-db')

    this.version(1).stores({
      // Indexed on updatedAt to support incremental sync and "recently edited" queries.
      entries: 'id, updatedAt',
      // Indexed on entryId so an entry's images can be loaded without a table scan.
      images: 'id, entryId, order',
      notes: 'id, order, updatedAt',
      // Records deleted entries/notes so Drive sync never resurrects them
      // after they were removed on another device. See src/sync/syncManager.ts.
      tombstones: 'id, deletedAt',
    })

    // Note version history (undo support) — local-only, never synced to
    // Drive, so it doesn't need to be part of BackupData.
    this.version(2).stores({
      entries: 'id, updatedAt',
      images: 'id, entryId, order',
      notes: 'id, order, updatedAt',
      tombstones: 'id, deletedAt',
      noteVersions: 'id, noteId, savedAt',
    })

    // Google OAuth refresh token (see src/sync/googleAuth.ts) — local-only,
    // never synced to Drive.
    this.version(3).stores({
      entries: 'id, updatedAt',
      images: 'id, entryId, order',
      notes: 'id, order, updatedAt',
      tombstones: 'id, deletedAt',
      noteVersions: 'id, noteId, savedAt',
      authTokens: 'id',
    })
  }
}

export const db = new JournalDatabase()
