import type { MonthGridDay } from '../../utils/date'
import type { EntrySummary } from './useCalendarEntries'

interface DayCellProps {
  day: MonthGridDay
  isToday: boolean
  summary?: EntrySummary
  onSelect: (dateId: string) => void
}

export function DayCell({ day, isToday, summary, onSelect }: DayCellProps) {
  const title = summary?.title ?? ''
  const hasTitle = title.length > 0

  return (
    <button
      type="button"
      onClick={() => onSelect(day.dateId)}
      className={`relative flex aspect-[4/5] flex-col items-start gap-0.5 overflow-hidden rounded-xl px-1.5 py-1 text-sm transition-colors duration-150 ${
        day.isCurrentMonth ? 'text-ink-primary' : 'text-ink-tertiary/50'
      } ${isToday ? 'bg-ink-primary text-surface-0 font-semibold' : 'hover:bg-surface-2'}`}
      aria-label={`${day.dateId}${summary ? `, has journal entry${hasTitle ? `: ${title}` : ''}` : ''}`}
    >
      <span className="text-xs">{day.date.getDate()}</span>
      {hasTitle ? (
        <span
          title={title}
          className={`line-clamp-2 w-full text-left text-[11px] leading-tight font-normal ${
            isToday ? 'text-surface-0/80' : 'text-ink-tertiary'
          }`}
        >
          {title}
        </span>
      ) : (
        summary && (
          <span
            className={`absolute bottom-1.5 left-1.5 size-1.5 rounded-full ${
              isToday ? 'bg-surface-0' : 'bg-ink-secondary'
            }`}
          />
        )
      )}
    </button>
  )
}
