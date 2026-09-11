import type { MouseEvent } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Note } from '../../db/types'
import { updateNote } from '../../db/notes.repo'
import { DragHandleIcon, PinIcon } from '../../components/icons'
import { useLongPress } from '../../hooks/useLongPress'
import { triggerSync } from '../../sync/triggerSync'

interface NoteCardProps {
  note: Note
  onOpen: () => void
  onLongPress: () => void
}

const PREVIEW_CHECKLIST_LIMIT = 6

/** A compact Keep-style preview tile. Tap anywhere on the card to open the
 *  fullscreen editor; long-press opens the pin/delete action sheet; pinned
 *  notes show a pin in the corner. Checklist items can be ticked off directly
 *  from the preview without opening it. */
export function NoteCard({ note, onOpen, onLongPress }: NoteCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: note.id,
  })
  const { pointerProps, tap } = useLongPress(onLongPress)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isPinned = note.pinned === true
  const isEmpty = !note.title && !note.body && note.checklist.length === 0
  const shownItems = note.checklist.slice(0, PREVIEW_CHECKLIST_LIMIT)
  const hiddenCount = note.checklist.length - shownItems.length

  const toggleItem = async (event: MouseEvent, itemId: string) => {
    event.stopPropagation()
    const checklist = note.checklist.map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item,
    )
    await updateNote(note.id, { checklist })
    triggerSync()
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...pointerProps}
      onClick={tap(onOpen)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className={`group relative flex max-h-80 min-h-24 cursor-pointer select-none flex-col gap-2 overflow-hidden break-inside-avoid rounded-2xl border border-border bg-surface-1 p-3 transition-colors duration-150 hover:bg-surface-2 ${
        isDragging ? 'opacity-60' : ''
      }`}
    >
      <div className="absolute right-2 top-2 flex items-center gap-1">
        {isPinned && (
          <PinIcon width={15} height={15} className="text-ink-tertiary" aria-label="Pinned note" />
        )}
        <button
          type="button"
          className="cursor-grab touch-none text-ink-tertiary opacity-0 transition-opacity duration-150 active:cursor-grabbing group-hover:opacity-100"
          aria-label="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <DragHandleIcon width={16} height={16} />
        </button>
      </div>

      {note.title && (
        <h3 className={`line-clamp-2 font-medium text-ink-primary ${isPinned ? 'pr-12' : 'pr-6'}`}>
          {note.title}
        </h3>
      )}

      {note.body && (
        <p className="line-clamp-6 whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">
          {note.body}
        </p>
      )}

      {shownItems.length > 0 && (
        <div className="flex flex-col gap-1">
          {shownItems.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => toggleItem(e, item.id)}
                aria-label={item.done ? 'Mark item incomplete' : 'Mark item complete'}
                className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors duration-150 ${
                  item.done ? 'border-ink-primary bg-ink-primary text-surface-0' : 'border-border'
                }`}
              >
                {item.done && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  item.done ? 'text-ink-tertiary line-through' : 'text-ink-secondary'
                }`}
              >
                {item.text}
              </span>
            </div>
          ))}
          {hiddenCount > 0 && (
            <span className="pl-6 text-xs text-ink-tertiary">+{hiddenCount} more</span>
          )}
        </div>
      )}

      {isEmpty && <p className="text-sm text-ink-tertiary">Empty note</p>}
    </div>
  )
}