/**
 * Core data model shared across the local Dexie database, the backup/export
 * layer, and the Google Drive sync layer. Keeping these types in one place
 * means every consumer (UI, sync, export) agrees on the same shape.
 */

/** One journal entry per calendar day. `id` is the ISO date, e.g. "2026-07-09". */
export interface JournalEntry {
  id: string
  title: string
  body: string
  createdAt: number
  updatedAt: number
}

/** An image attached to a journal entry, stored as a Blob in its own table. */
export interface ImageAttachment {
  id: string
  entryId: string
  blob: Blob
  mimeType: string
  /** Position of the image within the entry, for stable inline ordering. */
  order: number
  createdAt: number
}

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

/**
 * Records that a record was deleted, so Google Drive sync never resurrects
 * it if another device's backup still has an older copy. See
 * src/sync/syncManager.ts for how these are applied during merge.
 */
export interface Tombstone {
  id: string
  type: 'entry' | 'note'
  deletedAt: number
}

/** A persistent note, independent of any calendar date. */
export interface Note {
  id: string
  /** Position in the user's manually-sorted list (lower = earlier). */
  order: number
  title: string
  body: string
  checklist: ChecklistItem[]
  createdAt: number
  updatedAt: number
}
