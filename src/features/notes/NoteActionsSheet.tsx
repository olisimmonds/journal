import { Modal } from '../../components/Modal'
import { PinIcon, TrashIcon } from '../../components/icons'
import { setNotePinned } from '../../db/notes.repo'
import type { Note } from '../../db/types'
import { triggerSync } from '../../sync/triggerSync'
import { scheduleNoteDeletion } from './pendingNoteDeletion'

interface NoteActionsSheetProps {
  note: Note
  onClose: () => void
}

/** Bottom-sheet actions for a note, opened by long-pressing a card — the
 *  Google Notes pattern. Pin/unpin keeps the note pinned to the top of the
 *  list; delete hides it immediately and offers "Undo" for a few seconds. */
export function NoteActionsSheet({ note, onClose }: NoteActionsSheetProps) {
  const handleTogglePin = async () => {
    await setNotePinned(note.id, !note.pinned)
    triggerSync()
    onClose()
  }

  const handleDelete = () => {
    scheduleNoteDeletion(note.id)
    onClose()
  }

  return (
    <Modal open onClose={onClose} title={note.title || 'Untitled note'}>
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={handleTogglePin}
          className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm text-ink-primary transition-colors duration-150 hover:bg-surface-2"
        >
          <PinIcon width={18} height={18} className="shrink-0 text-ink-secondary" />
          {note.pinned ? 'Unpin note' : 'Pin note'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-left text-sm text-danger transition-colors duration-150 hover:bg-surface-2"
        >
          <TrashIcon width={18} height={18} className="shrink-0" />
          Delete note
        </button>
      </div>
    </Modal>
  )
}