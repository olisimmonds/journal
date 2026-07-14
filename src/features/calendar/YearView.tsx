import { formatShortMonthLabel, getMonthGrid, parseDateId } from '../../utils/date'
import type { EntrySummary } from './useCalendarEntries'

interface YearViewProps {
  year: number
  summaries: Map<string, EntrySummary> | undefined
  todayId: string
  onSelectMonth: (year: number, month: number) => void
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i)

/**
 * The year as twelve mini-months. Each day is a dot rather than a number:
 * at this size numbers would be unreadable, and what a year view is actually
 * for is seeing at a glance which stretches of the year were journaled and
 * jumping to a month — not picking out a specific day.
 */
export function YearView({ year, summaries, todayId, onSelectMonth }: YearViewProps) {
  const today = parseDateId(todayId)
  const currentMonth = today.getFullYear() === year ? today.getMonth() : -1

  return (
    <div className="grid animate-fade-in grid-cols-3 gap-2 sm:grid-cols-4">
      {MONTHS.map((month) => (
        <MiniMonth
          key={month}
          year={year}
          month={month}
          summaries={summaries}
          todayId={todayId}
          isCurrentMonth={month === currentMonth}
          onSelect={onSelectMonth}
        />
      ))}
    </div>
  )
}

interface MiniMonthProps {
  year: number
  month: number
  summaries: Map<string, EntrySummary> | undefined
  todayId: string
  isCurrentMonth: boolean
  onSelect: (year: number, month: number) => void
}

function MiniMonth({ year, month, summaries, todayId, isCurrentMonth, onSelect }: MiniMonthProps) {
  const grid = getMonthGrid(year, month)
  const label = formatShortMonthLabel(year, month)
  const entryCount = grid.filter((d) => d.isCurrentMonth && summaries?.has(d.dateId)).length

  return (
    <button
      type="button"
      onClick={() => onSelect(year, month)}
      aria-label={`${label} ${year}, ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
      className={`flex flex-col gap-2 rounded-xl border p-2 text-left transition-colors duration-150 hover:bg-surface-2 ${
        isCurrentMonth ? 'border-border bg-surface-1' : 'border-transparent'
      }`}
    >
      <span
        className={`text-xs font-medium ${isCurrentMonth ? 'text-ink-primary' : 'text-ink-secondary'}`}
      >
        {label}
      </span>

      <div className="grid grid-cols-7 gap-px">
        {grid.map((day) => (
          <span key={day.dateId} className="flex aspect-square items-center justify-center">
            {day.isCurrentMonth && (
              <span
                className={`h-1/2 w-1/2 rounded-full ${
                  summaries?.has(day.dateId) ? 'bg-ink-primary' : 'bg-ink-tertiary/30'
                } ${day.dateId === todayId ? 'ring-1 ring-ink-primary ring-offset-1 ring-offset-surface-0' : ''}`}
              />
            )}
          </span>
        ))}
      </div>
    </button>
  )
}
