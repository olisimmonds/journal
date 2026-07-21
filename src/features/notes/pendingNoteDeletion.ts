import { deleteNote } from '../../db/notes.repo'
import { triggerSync } from '../../sync/triggerSync'

/**
 * Lets a note deletion be undone for a few seconds before it actually
 * happens. Deleting a note no longer removes it immediately — NoteEditor
 * calls `scheduleNoteDeletion`, which hides the note right away but only
 * finalizes the real deletion after `UNDO_WINDOW_MS`, giving NotesPage's
 * snackbar a window to offer "Undo". Only one deletion is ever pending at a
 * time, since only one note can be open for editing at once.
 */
const UNDO_WINDOW_MS = 6_000

interface Pending {
  noteId: string
  timeoutId: ReturnType<typeof setTimeout>
}

let pending: Pending | null = null
type Listener = (pendingNoteId: string | null) => void
const listeners = new Set<Listener>()

function notify(): void {
  const noteId = pending?.noteId ?? null
  listeners.forEach((listener) => listener(noteId))
}

export function subscribePendingNoteDeletion(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getPendingNoteDeletionId(): string | null {
  return pending?.noteId ?? null
}

function finalize(noteId: string): void {
  void deleteNote(noteId).then(() => triggerSync())
}

/** Hides a note immediately and finalizes its deletion a few seconds later
 *  unless undone. Starting a new deletion finalizes any previous pending
 *  one right away — its own undo window already had its chance, and only
 *  one note can realistically be mid-delete at once. */
export function scheduleNoteDeletion(noteId: string): void {
  if (pending) {
    clearTimeout(pending.timeoutId)
    finalize(pending.noteId)
  }

  const timeoutId = setTimeout(() => {
    pending = null
    notify()
    finalize(noteId)
  }, UNDO_WINDOW_MS)

  pending = { noteId, timeoutId }
  notify()
}

/** Cancels a still-pending deletion. Returns false if it already finalized
 *  (the undo window closed) or refers to a different note. */
export function undoNoteDeletion(noteId: string): boolean {
  if (!pending || pending.noteId !== noteId) return false
  clearTimeout(pending.timeoutId)
  pending = null
  notify()
  return true
}
