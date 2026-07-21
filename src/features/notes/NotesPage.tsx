import { useState, useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { createNote, listNotes, reorderNotes } from '../../db/notes.repo'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { PlusIcon } from '../../components/icons'
import { triggerSync } from '../../sync/triggerSync'
import { NoteCard } from './NoteCard'
import { NoteEditor } from './NoteEditor'
import {
  getPendingNoteDeletionId,
  subscribePendingNoteDeletion,
  undoNoteDeletion,
} from './pendingNoteDeletion'

/** Persistent notes tab, independent of the calendar. Shows notes as a
 *  Google Keep-style grid of preview tiles; tapping one opens a fullscreen
 *  editor. Supports drag-to-reorder within the grid. */
export function NotesPage() {
  const notes = useLiveQuery(() => listNotes(), [])
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)
  const pendingDeleteId = useSyncExternalStore(subscribePendingNoteDeletion, getPendingNoteDeletionId)

  // A note being deleted is hidden immediately (optimistically), even
  // though its actual removal from IndexedDB is delayed a few seconds to
  // allow "Undo" — see pendingNoteDeletion.ts.
  const visibleNotes = notes?.filter((note) => note.id !== pendingDeleteId)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!visibleNotes || !over || active.id === over.id) return

    const oldIndex = visibleNotes.findIndex((n) => n.id === active.id)
    const newIndex = visibleNotes.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(visibleNotes, oldIndex, newIndex)
    await reorderNotes(reordered.map((n) => n.id))
    triggerSync()
  }

  const handleCreateNote = async () => {
    const note = await createNote()
    triggerSync()
    setOpenNoteId(note.id)
  }

  const openNote = notes?.find((n) => n.id === openNoteId)

  return (
    <div className="safe-top mx-auto max-w-3xl px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-primary">Notes</h1>
        <Button variant="ghost" onClick={handleCreateNote} aria-label="New note">
          <PlusIcon />
        </Button>
      </header>

      {visibleNotes === undefined ? null : visibleNotes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Notes are separate from your calendar journal and stick around until you delete them."
          action={
            <Button variant="primary" onClick={handleCreateNote}>
              Create your first note
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visibleNotes.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 pb-10 animate-fade-in sm:grid-cols-3 md:grid-cols-4">
              {visibleNotes.map((note) => (
                <NoteCard key={note.id} note={note} onOpen={() => setOpenNoteId(note.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {openNote && <NoteEditor note={openNote} onClose={() => setOpenNoteId(null)} />}

      {pendingDeleteId && (
        <div className="safe-bottom fixed inset-x-0 bottom-20 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm text-ink-primary shadow-lg animate-fade-in">
            <span>Note deleted.</span>
            <button
              type="button"
              onClick={() => undoNoteDeletion(pendingDeleteId)}
              className="font-medium underline"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
