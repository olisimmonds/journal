import { useState } from 'react'
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

/** Persistent notes tab, independent of the calendar. Shows notes as a
 *  Google Keep-style grid of preview tiles; tapping one opens a fullscreen
 *  editor. Supports drag-to-reorder within the grid. */
export function NotesPage() {
  const notes = useLiveQuery(() => listNotes(), [])
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!notes || !over || active.id === over.id) return

    const oldIndex = notes.findIndex((n) => n.id === active.id)
    const newIndex = notes.findIndex((n) => n.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(notes, oldIndex, newIndex)
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

      {notes === undefined ? null : notes.length === 0 ? (
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
          <SortableContext items={notes.map((n) => n.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 pb-10 animate-fade-in sm:grid-cols-3 md:grid-cols-4">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} onOpen={() => setOpenNoteId(note.id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {openNote && <NoteEditor note={openNote} onClose={() => setOpenNoteId(null)} />}
    </div>
  )
}
