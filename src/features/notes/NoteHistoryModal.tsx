import { useEffect, useState } from 'react'
import type { NoteVersion } from '../../db/types'
import { listNoteVersions, restoreNoteVersion } from '../../db/notes.repo'
import { Modal } from '../../components/Modal'
import { Button } from '../../components/Button'

interface NoteHistoryModalProps {
  open: boolean
  noteId: string
  onClose: () => void
  onRestored: (version: NoteVersion) => void
}

/** Lists past saved snapshots of a note (see notes.repo.ts) so an
 *  accidental edit or deletion of its text can be undone. */
export function NoteHistoryModal({ open, noteId, onClose, onRestored }: NoteHistoryModalProps) {
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    listNoteVersions(noteId).then(setVersions)
  }, [open, noteId])

  async function handleRestore(version: NoteVersion) {
    setRestoringId(version.id)
    try {
      await restoreNoteVersion(noteId, version.id)
      onRestored(version)
      onClose()
    } finally {
      setRestoringId(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Version history">
      {versions.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          No earlier versions yet — they're saved automatically as you edit this note over time.
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
          {versions.map((version) => (
            <li
              key={version.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-primary">
                  {version.title || version.body.slice(0, 40) || 'Untitled note'}
                </p>
                <p className="truncate text-xs text-ink-tertiary">
                  {new Date(version.savedAt).toLocaleString()}
                </p>
              </div>
              <Button
                variant="ghost"
                onClick={() => handleRestore(version)}
                disabled={restoringId !== null}
              >
                {restoringId === version.id ? 'Restoring…' : 'Restore'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
