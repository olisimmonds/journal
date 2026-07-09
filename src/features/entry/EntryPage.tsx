import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addImageToEntry,
  deleteEntry,
  getEntry,
  listImagesForEntry,
  removeImage,
  upsertEntry,
} from '../../db/entries.repo'
import { formatFullDate } from '../../utils/date'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { ChevronLeftIcon, TrashIcon } from '../../components/icons'
import { EntryEditor } from './EntryEditor'
import { ImageGallery } from './ImageGallery'
import { useAutosave } from './useAutosave'

/** Route wrapper: remounts the editor whenever the date param changes, so
 *  no per-day state (autosave timers, loaded-flag) leaks between days. */
export function EntryPage() {
  const { date } = useParams<{ date: string }>()
  if (!date) return null
  return <EntryPageContent key={date} dateId={date} />
}

function EntryPageContent({ dateId }: { dateId: string }) {
  const navigate = useNavigate()

  const loadedEntry = useLiveQuery(
    async () => ({ entry: await getEntry(dateId) }),
    [dateId],
  )
  const images = useLiveQuery(() => listImagesForEntry(dateId), [dateId]) ?? []

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const hasSyncedInitialValue = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!loadedEntry || hasSyncedInitialValue.current) return
    setTitle(loadedEntry.entry?.title ?? '')
    setBody(loadedEntry.entry?.body ?? '')
    hasSyncedInitialValue.current = true
  }, [loadedEntry])

  const saveStatus = useAutosave({ title, body }, async (value) => {
    await upsertEntry(dateId, value)
  })

  const handleAddImages = async (files: File[]) => {
    // Ensure the entry row exists before attaching images to it (e.g. when
    // the user adds a photo before typing any text).
    await upsertEntry(dateId, {})
    for (const file of files) {
      await addImageToEntry(dateId, file, file.type || 'image/jpeg')
    }
  }

  const handleDelete = async () => {
    await deleteEntry(dateId)
    setConfirmDelete(false)
    navigate('/')
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <Button variant="ghost" className="px-2" onClick={() => navigate('/')} aria-label="Back to calendar">
          <ChevronLeftIcon />
        </Button>
        <p className="text-sm text-ink-secondary">{formatFullDate(dateId)}</p>
        <Button
          variant="ghost"
          className="px-2 text-danger"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete entry"
        >
          <TrashIcon />
        </Button>
      </header>

      <div className="flex flex-col gap-6 pb-10 animate-fade-in">
        <EntryEditor
          title={title}
          body={body}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          saveStatus={saveStatus}
        />

        <ImageGallery
          images={images}
          onAddImages={handleAddImages}
          onRemoveImage={(imageId) => removeImage(imageId)}
        />
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this entry?"
        description="The title, text, and all photos for this day will be permanently deleted."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />
    </div>
  )
}
