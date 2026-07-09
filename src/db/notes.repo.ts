import { db } from './schema'
import type { ChecklistItem, Note } from './types'

/** Data access layer for persistent notes (independent of the calendar). */

export async function listNotes(): Promise<Note[]> {
  return db.notes.orderBy('order').toArray()
}

export async function getNote(id: string): Promise<Note | undefined> {
  return db.notes.get(id)
}

export async function createNote(): Promise<Note> {
  const highestOrder = await db.notes.orderBy('order').last()
  const now = Date.now()

  const note: Note = {
    id: crypto.randomUUID(),
    order: (highestOrder?.order ?? -1) + 1,
    title: '',
    body: '',
    checklist: [],
    createdAt: now,
    updatedAt: now,
  }

  await db.notes.add(note)
  return note
}

export async function updateNote(
  id: string,
  fields: Partial<Pick<Note, 'title' | 'body' | 'checklist'>>,
): Promise<void> {
  await db.notes.update(id, { ...fields, updatedAt: Date.now() })
}

/**
 * Deletes a note and records a tombstone so a stale Google Drive backup
 * never resurrects it on the next sync (see src/sync/syncManager.ts).
 */
export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.tombstones, async () => {
    await db.notes.delete(id)
    await db.tombstones.put({ id, type: 'note', deletedAt: Date.now() })
  })
}

/**
 * Persists a new manual ordering after a drag-to-reorder gesture.
 * `orderedIds` must contain every note id, in its new display order.
 */
export async function reorderNotes(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    await Promise.all(
      orderedIds.map((id, index) => db.notes.update(id, { order: index })),
    )
  })
}

export function createChecklistItem(text: string): ChecklistItem {
  return { id: crypto.randomUUID(), text, done: false }
}
