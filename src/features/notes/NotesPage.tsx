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
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { createNote, listNotes, reorderNotes } from '../../db/notes.repo'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { PlusIcon } from '../../components/icons'
import { NoteCard } from './NoteCard'

/** Persistent notes tab, independent of the calendar. Supports drag-to-reorder. */
export function NotesPage() {
  const notes = useLiveQuery(() => listNotes(), [])

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
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-primary">Notes</h1>
        <Button variant="ghost" onClick={() => createNote()} aria-label="New note">
          <PlusIcon />
        </Button>
      </header>

      {notes === undefined ? null : notes.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Notes are separate from your calendar journal and stick around until you delete them."
          action={
            <Button variant="primary" onClick={() => createNote()}>
              Create your first note
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={notes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3 pb-10 animate-fade-in">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
