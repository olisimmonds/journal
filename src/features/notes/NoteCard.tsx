import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ChecklistItem, Note } from '../../db/types'
import { deleteNote, updateNote } from '../../db/notes.repo'
import { useAutosave } from '../entry/useAutosave'
import { DragHandleIcon, TrashIcon } from '../../components/icons'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { triggerSync } from '../../sync/triggerSync'
import { ChecklistEditor } from './ChecklistEditor'

interface NoteCardProps {
  note: Note
}

export function NoteCard({ note }: NoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  })

  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useAutosave({ title, body, checklist }, async (value) => {
    await updateNote(note.id, value)
    triggerSync()
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4 ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 cursor-grab touch-none text-ink-tertiary active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <DragHandleIcon width={18} height={18} />
        </button>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled note"
          className="min-w-0 flex-1 bg-transparent font-medium text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete note"
          className="text-ink-tertiary hover:text-danger"
        >
          <TrashIcon width={18} height={18} />
        </button>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write a note…"
        rows={3}
        className="w-full resize-none bg-transparent text-sm leading-relaxed text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
      />

      <ChecklistEditor items={checklist} onChange={setChecklist} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this note?"
        description="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteNote(note.id)
          setConfirmDelete(false)
          triggerSync()
        }}
      />
    </div>
  )
}
