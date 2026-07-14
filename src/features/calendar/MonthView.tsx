import { getMonthGrid, WEEKDAY_LABELS } from '../../utils/date'
import { DayCell } from './DayCell'
import type { EntrySummary } from './useCalendarEntries'

interface MonthViewProps {
  year: number
  month: number
  summaries: Map<string, EntrySummary> | undefined
  todayId: string
  onSelectDay: (dateId: string) => void
}

/** The month-at-a-glance grid: 6 weeks x 7 days, each day showing its title. */
export function MonthView({ year, month, summaries, todayId, onSelectDay }: MonthViewProps) {
  const grid = getMonthGrid(year, month)

  return (
    <div className="animate-fade-in">
      <div className="mb-1 grid grid-cols-7 text-center text-xs text-ink-tertiary">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((day) => (
          <DayCell
            key={day.dateId}
            day={day}
            isToday={day.dateId === todayId}
            summary={summaries?.get(day.dateId)}
            onSelect={onSelectDay}
          />
        ))}
      </div>
    </div>
  )
}
