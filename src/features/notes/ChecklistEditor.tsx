import { type KeyboardEvent, useState } from 'react'
import type { ChecklistItem } from '../../db/types'
import { createChecklistItem } from '../../db/notes.repo'
import { PlusIcon, TrashIcon } from '../../components/icons'

interface ChecklistEditorProps {
  items: ChecklistItem[]
  onChange: (items: ChecklistItem[]) => void
}

/** Simple checklist support within a note: add, toggle, edit, remove items. */
export function ChecklistEditor({ items, onChange }: ChecklistEditorProps) {
  const [draft, setDraft] = useState('')

  const addItem = () => {
    const text = draft.trim()
    if (!text) return
    onChange([...items, createChecklistItem(text)])
    setDraft('')
  }

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addItem()
    }
  }

  const toggleItem = (id: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)))
  }

  const updateItemText = (id: string, text: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)))
  }

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id))
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => toggleItem(item.id)}
            aria-label={item.done ? 'Mark item incomplete' : 'Mark item complete'}
            className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors duration-150 ${
              item.done ? 'border-ink-primary bg-ink-primary text-surface-0' : 'border-border'
            }`}
          >
            {item.done && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <input
            value={item.text}
            onChange={(e) => updateItemText(item.id, e.target.value)}
            className={`min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${
              item.done ? 'text-ink-tertiary line-through' : 'text-ink-primary'
            }`}
          />
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            aria-label="Remove checklist item"
            className="text-ink-tertiary hover:text-danger"
          >
            <TrashIcon width={16} height={16} />
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2">
        <PlusIcon width={18} height={18} className="shrink-0 text-ink-tertiary" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleDraftKeyDown}
          onBlur={addItem}
          placeholder="Add item"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />
      </div>
    </div>
  )
}
