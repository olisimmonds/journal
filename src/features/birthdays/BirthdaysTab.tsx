import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { createBirthday, deleteBirthday, listBirthdays } from '../../db/birthdays.repo'
import { Button } from '../../components/Button'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CakeIcon, TrashIcon } from '../../components/icons'
import { EmptyState } from '../../components/EmptyState'
import { triggerSync } from '../../sync/triggerSync'

/** Number of days in each month (Feb allows 29 — leap-day birthdays exist). */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }),
)

function formatBirthdayDate(month: number, day: number): string {
  return new Date(2000, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
  })
}

/**
 * Add, list, and remove birthdays. Birthdays are yearless dates that recur on
 * the same day every year and show as a green dot on the calendar, so they
 * live alongside recurring-personal-events rather than in the journal itself.
 */
export function BirthdaysTab() {
  const birthdays = useLiveQuery(() => listBirthdays(), [])
  const [name, setName] = useState('')
  const [month, setMonth] = useState(1)
  const [day, setDay] = useState(1)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleMonthChange = (value: number) => {
    setMonth(value)
    // Clamp the day to the new month's length (e.g. Apr 31 -> Apr 30) so the
    // form can never hold a date that doesn't exist.
    const maxDay = DAYS_IN_MONTH[value - 1]
    setDay((current) => Math.min(current, maxDay))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    await createBirthday(name, month, day)
    triggerSync()
    setName('')
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await deleteBirthday(deleteId)
    triggerSync()
    setDeleteId(null)
  }

  const canAdd = name.trim().length > 0

  return (
    <div className="animate-fade-in">
      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-surface-1 p-3"
      >
        <label className="flex items-center gap-2 text-sm text-ink-tertiary">
          <CakeIcon width={16} height={16} className="shrink-0" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Who? e.g. Gran"
            className="min-w-0 flex-1 bg-transparent py-1 text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
          />
        </label>
        <div className="flex gap-2">
          <select
            value={month}
            onChange={(e) => handleMonthChange(Number(e.target.value))}
            aria-label="Birthday month"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 text-sm text-ink-primary focus:outline-none"
          >
            {MONTH_NAMES.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            aria-label="Birthday day"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-2 text-sm text-ink-primary focus:outline-none"
          >
            {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <Button variant="primary" type="submit" disabled={!canAdd}>
            Add
          </Button>
        </div>
      </form>

      {birthdays === undefined ? null : birthdays.length === 0 ? (
        <EmptyState
          title="No birthdays yet"
          description="Add a birthday above and it'll show as a green dot on the calendar every year."
        />
      ) : (
        <ul className="flex flex-col gap-2 pb-10">
          {birthdays.map((birthday) => (
            <li
              key={birthday.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-1 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-primary">{birthday.name}</p>
                <p className="text-xs text-ink-tertiary">
                  {formatBirthdayDate(birthday.month, birthday.day)}
                  {' · '}every year
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteId(birthday.id)}
                aria-label={`Delete ${birthday.name}'s birthday`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-ink-tertiary transition-colors duration-150 hover:bg-surface-2 hover:text-danger"
              >
                <TrashIcon width={18} height={18} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this birthday?"
        description="It will stop showing on the calendar, and the change syncs to your backup."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteId(null)}
        onConfirm={handleDelete}
      />
    </div>
  )
}