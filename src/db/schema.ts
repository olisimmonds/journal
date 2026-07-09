import Dexie, { type EntityTable } from 'dexie'
import type { ImageAttachment, JournalEntry, Note, Tombstone } from './types'

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
  }
}

export const db = new JournalDatabase()
