import { useNavigate } from 'react-router-dom'
import type { MonthGridDay } from '../../utils/date'

interface DayCellProps {
  day: MonthGridDay
  isToday: boolean
  hasEntry: boolean
}

export function DayCell({ day, isToday, hasEntry }: DayCellProps) {
  const navigate = useNavigate()

  return (
    <button
      type="button"
      onClick={() => navigate(`/day/${day.dateId}`)}
      className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors duration-150 ${
        day.isCurrentMonth ? 'text-ink-primary' : 'text-ink-tertiary/50'
      } ${isToday ? 'bg-ink-primary text-surface-0 font-semibold' : 'hover:bg-surface-2'}`}
      aria-label={`${day.dateId}${hasEntry ? ', has journal entry' : ''}`}
    >
      <span>{day.date.getDate()}</span>
      {hasEntry && (
        <span
          className={`absolute bottom-1.5 size-1.5 rounded-full ${
            isToday ? 'bg-surface-0' : 'bg-ink-secondary'
          }`}
        />
      )}
    </button>
  )
}
