import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChecklistItem, Note } from '../../db/types'
import { deleteNote, updateNote } from '../../db/notes.repo'
import { useAutosave } from '../entry/useAutosave'
import { ChevronLeftIcon, TrashIcon } from '../../components/icons'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { triggerSync } from '../../sync/triggerSync'
import { ChecklistEditor } from './ChecklistEditor'

interface NoteEditorProps {
  note: Note
  onClose: () => void
}

/** Fullscreen note editor, opened by tapping a card in the grid — mirrors
 *  Google Keep's tap-to-expand pattern while staying inside the app's
 *  existing dark, grayscale visual language. */
export function NoteEditor({ note, onClose }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(note.checklist)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useAutosave({ title, body, checklist }, async (value) => {
    await updateNote(note.id, value)
    triggerSync()
  })

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="safe-top safe-bottom fixed inset-0 z-50 flex flex-col bg-surface-0 animate-fade-in">
      <header className="flex items-center justify-between border-b border-border px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to notes"
          className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-ink-secondary transition-colors duration-150 hover:bg-surface-2 hover:text-ink-primary"
        >
          <ChevronLeftIcon width={20} height={20} />
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete note"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-tertiary transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
        >
          <TrashIcon width={18} height={18} />
        </button>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled note"
          autoFocus={!note.title && !note.body}
          className="min-w-0 bg-transparent text-lg font-medium text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a note…"
          rows={8}
          className="w-full flex-1 resize-none bg-transparent text-sm leading-relaxed text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />

        <ChecklistEditor items={checklist} onChange={setChecklist} />
      </div>

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
          onClose()
        }}
      />
    </div>,
    document.body,
  )
}
