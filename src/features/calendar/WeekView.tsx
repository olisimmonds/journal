import { getWeekDays } from '../../utils/date'
import { ImageIcon } from '../../components/icons'
import type { EntrySummary } from './useCalendarEntries'

interface WeekViewProps {
  anchor: Date
  summaries: Map<string, EntrySummary> | undefined
  todayId: string
  onSelectDay: (dateId: string) => void
}

/**
 * The week as seven full-width rows rather than seven columns. A journal has
 * one untimed entry per day, so there is no time axis to lay out against —
 * giving each day a full-width row instead buys enough room to read its title
 * and a preview of the body without opening it, which is the whole point of
 * zooming in from the month grid.
 */
export function WeekView({ anchor, summaries, todayId, onSelectDay }: WeekViewProps) {
  return (
    <div className="animate-fade-in divide-y divide-border border-y border-border">
      {getWeekDays(anchor).map((day) => {
        const summary = summaries?.get(day.dateId)
        const isToday = day.dateId === todayId

        return (
          <button
            key={day.dateId}
            type="button"
            onClick={() => onSelectDay(day.dateId)}
            className="flex min-h-16 w-full gap-3 px-1 py-3 text-left transition-colors duration-150 hover:bg-surface-2"
          >
            <div className="flex w-10 shrink-0 flex-col items-center gap-1">
              <span className="text-[10px] tracking-wide text-ink-tertiary uppercase">
                {day.date.toLocaleDateString(undefined, { weekday: 'short' })}
              </span>
              <span
                className={`flex size-7 items-center justify-center rounded-full text-sm ${
                  isToday ? 'bg-ink-primary font-semibold text-surface-0' : 'text-ink-primary'
                }`}
              >
                {day.date.getDate()}
              </span>
            </div>

            <div className="min-w-0 flex-1 self-center">
              <DayRowContent summary={summary} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function DayRowContent({ summary }: { summary?: EntrySummary }) {
  if (!summary) {
    return <p className="text-sm text-ink-tertiary">No entry</p>
  }

  const { title, body, hasImages } = summary

  return (
    <div className="flex flex-col gap-1">
      {title && (
        <div className="flex items-center gap-1.5">
          <p className="line-clamp-1 font-medium text-ink-primary">{title}</p>
          {hasImages && <ImageIcon width={13} height={13} className="shrink-0 text-ink-tertiary" />}
        </div>
      )}
      {body && (
        // Without a title the body is the only thing identifying the day, so
        // give it the extra line the title would have used.
        <p className={`${title ? 'line-clamp-2' : 'line-clamp-3'} text-sm text-ink-secondary`}>
          {body}
        </p>
      )}
      {!title && !body && hasImages && (
        <div className="flex items-center gap-1.5 text-sm text-ink-secondary">
          <ImageIcon width={14} height={14} className="shrink-0" />
          <span>Photos</span>
        </div>
      )}
    </div>
  )
}
