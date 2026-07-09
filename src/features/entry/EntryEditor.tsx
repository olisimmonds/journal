import type { AutosaveStatus } from './useAutosave'

interface EntryEditorProps {
  title: string
  body: string
  onTitleChange: (title: string) => void
  onBodyChange: (body: string) => void
  saveStatus: AutosaveStatus
}

const STATUS_LABEL: Record<AutosaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
}

/** The title + unlimited-text body editor for a single day's journal entry. */
export function EntryEditor({ title, body, onTitleChange, onBodyChange, saveStatus }: EntryEditorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title (optional)"
          className="w-full bg-transparent text-lg font-semibold text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />
        <span className="shrink-0 pl-3 text-xs text-ink-tertiary">{STATUS_LABEL[saveStatus]}</span>
      </div>

      <textarea
        value={body}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Write about your day…"
        rows={10}
        className="w-full resize-none bg-transparent text-base leading-relaxed text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
      />
    </div>
  )
}
