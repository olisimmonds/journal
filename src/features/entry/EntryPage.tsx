import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
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
import { CakeIcon, ChevronLeftIcon, TrashIcon } from '../../components/icons'
import { useBirthdaysForDate } from '../birthdays/useBirthdaysForDate'
import { triggerSync } from '../../sync/triggerSync'
import { EntryEditor } from './EntryEditor'
import { ImageGallery } from './ImageGallery'
import { useAutosave } from './useAutosave'
import { FitnessWidgets } from '../health/FitnessWidgets'

/** Route wrapper: remounts the editor whenever the date param changes, so
 *  no per-day state (autosave timers, loaded-flag) leaks between days. */
export function EntryPage() {
  const { date } = useParams<{ date: string }>()
  if (!date) return null
  return <EntryPageContent key={date} dateId={date} />
}

function EntryPageContent({ dateId }: { dateId: string }) {
  const navigate = useNavigate()
  const location = useLocation()

  // The calendar records which view it opened this entry from, so closing the
  // entry returns to that exact zoom level and date rather than resetting to
  // the default month. Falls back to the calendar root for a direct deep link.
  const backTo = (location.state as { from?: string } | null)?.from ?? '/'

  const loadedEntry = useLiveQuery(
    async () => ({ entry: await getEntry(dateId) }),
    [dateId],
  )
  const images = useLiveQuery(() => listImagesForEntry(dateId), [dateId]) ?? []
  const birthdays = useBirthdaysForDate(dateId)

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [gym, setGym] = useState(false)
  const [vigorousMinutes, setVigorousMinutes] = useState(0)
  const hasSyncedInitialValue = useRef(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!loadedEntry || hasSyncedInitialValue.current) return
    setTitle(loadedEntry.entry?.title ?? '')
    setBody(loadedEntry.entry?.body ?? '')
    setGym(loadedEntry.entry?.gym ?? false)
    setVigorousMinutes(loadedEntry.entry?.vigorousMinutes ?? 0)
    hasSyncedInitialValue.current = true
  }, [loadedEntry])

  const saveStatus = useAutosave({ title, body, gym, vigorousMinutes }, async (value) => {
    await upsertEntry(dateId, value)
    triggerSync()
  })

  const handleAddImages = async (files: File[]) => {
    // Ensure the entry row exists before attaching images to it (e.g. when
    // the user adds a photo before typing any text).
    await upsertEntry(dateId, {})
    for (const file of files) {
      await addImageToEntry(dateId, file, file.type || 'image/jpeg')
    }
    triggerSync()
  }

  const handleRemoveImage = async (imageId: string) => {
    await removeImage(imageId)
    triggerSync()
  }

  const handleDelete = async () => {
    await deleteEntry(dateId)
    setConfirmDelete(false)
    triggerSync()
    navigate(backTo)
  }

  const handleBack = async () => {
    // Flush the latest edit immediately rather than relying on the debounce
    // timer, which is cancelled on unmount and would otherwise drop an edit
    // (including a just-toggled health widget) made in the last 600ms.
    await upsertEntry(dateId, { title, body, gym, vigorousMinutes })
    triggerSync()
    navigate(backTo)
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-4">
      <header className="mb-4 flex items-center justify-between">
        <Button variant="ghost" className="px-2" onClick={handleBack} aria-label="Back to calendar">
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

      {birthdays && birthdays.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface-1 px-3 py-2 text-sm text-ink-primary">
          <CakeIcon width={16} height={16} className="shrink-0 text-success" />
          <span>
            {birthdays.length === 1
              ? `${birthdays[0].name}'s birthday`
              : `Birthdays: ${birthdays.map((b) => b.name).join(', ')}`}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-6 pb-10 animate-fade-in">
        <EntryEditor
          title={title}
          body={body}
          onTitleChange={setTitle}
          onBodyChange={setBody}
          saveStatus={saveStatus}
        />

        <FitnessWidgets
          gym={gym}
          vigorousMinutes={vigorousMinutes}
          onGymChange={setGym}
          onVigorousMinutesChange={setVigorousMinutes}
        />

        <ImageGallery
          images={images}
          onAddImages={handleAddImages}
          onRemoveImage={handleRemoveImage}
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
