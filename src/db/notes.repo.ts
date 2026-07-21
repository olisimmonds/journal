import { db } from './schema'
import type { ChecklistItem, Note, NoteVersion } from './types'

/** Data access layer for persistent notes (independent of the calendar). */

// Undo support: before each write we may snapshot the note's prior state so
// an accidental edit or full deletion of a note's text can be recovered.
// Snapshots are throttled rather than taken on every autosave (every ~600ms
// pause in typing) so a long editing session doesn't burn through the kept
// versions before anything worth restoring happens — a snapshot at most
// once a minute per note still leaves the version right before an
// accidental "select all, delete" close by.
const MAX_VERSIONS_PER_NOTE = 20
const VERSION_SNAPSHOT_THROTTLE_MS = 60_000

async function listVersionsNewestFirst(noteId: string): Promise<NoteVersion[]> {
  const versions = await db.noteVersions.where('noteId').equals(noteId).toArray()
  return versions.sort((a, b) => b.savedAt - a.savedAt)
}

async function maybeSnapshotVersion(note: Note): Promise<void> {
  const versions = await listVersionsNewestFirst(note.id)
  const mostRecent = versions[0]
  if (mostRecent && Date.now() - mostRecent.savedAt < VERSION_SNAPSHOT_THROTTLE_MS) return

  await db.noteVersions.add({
    id: crypto.randomUUID(),
    noteId: note.id,
    title: note.title,
    body: note.body,
    checklist: note.checklist,
    savedAt: Date.now(),
  })

  const stale = versions.slice(MAX_VERSIONS_PER_NOTE - 1)
  if (stale.length > 0) {
    await db.noteVersions.bulkDelete(stale.map((v) => v.id))
  }
}

/** Past saved versions of a note, newest first — lets the user restore an
 *  earlier version if a recent edit (or an accidental full deletion of the
 *  text) wasn't what they wanted. */
export async function listNoteVersions(noteId: string): Promise<NoteVersion[]> {
  return listVersionsNewestFirst(noteId)
}

/** Restores a note's title/body/checklist to an earlier saved version. The
 *  note's current state is itself snapshotted first (subject to the same
 *  throttle), so restoring is not a dead end if it turns out to be the
 *  wrong version. */
export async function restoreNoteVersion(noteId: string, versionId: string): Promise<void> {
  const version = await db.noteVersions.get(versionId)
  if (!version || version.noteId !== noteId) return

  const current = await db.notes.get(noteId)
  if (current) await maybeSnapshotVersion(current)

  await db.notes.update(noteId, {
    title: version.title,
    body: version.body,
    checklist: version.checklist,
    updatedAt: Date.now(),
  })
}

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
  const current = await db.notes.get(id)
  if (current) await maybeSnapshotVersion(current)
  await db.notes.update(id, { ...fields, updatedAt: Date.now() })
}

/**
 * Deletes a note and records a tombstone so a stale Google Drive backup
 * never resurrects it on the next sync (see src/sync/syncManager.ts).
 */
export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.tombstones, db.noteVersions, async () => {
    await db.notes.delete(id)
    await db.tombstones.put({ id, type: 'note', deletedAt: Date.now() })
    await db.noteVersions.where('noteId').equals(id).delete()
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
