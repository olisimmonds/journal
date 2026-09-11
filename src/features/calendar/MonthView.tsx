import { getMonthGrid, WEEKDAY_LABELS } from '../../utils/date'
import {
  weekFitnessStatus,
  type WeekFitness,
  type WeekFitnessStatus,
} from '../health/weekFitness'
import { DayCell } from './DayCell'
import type { EntrySummary } from './useCalendarEntries'

interface MonthViewProps {
  year: number
  month: number
  summaries: Map<string, EntrySummary> | undefined
  weekFitness: Map<string, WeekFitness> | undefined
  birthdayDateIds: Set<string> | undefined
  todayId: string
  onSelectDay: (dateId: string) => void
}

const STATUS_LABEL: Record<WeekFitnessStatus, string> = {
  good: 'Met the NHS weekly targets (2 gym sessions and 75 min vigorous activity).',
  partial: 'Partly met the NHS weekly targets.',
  missed: 'Did not meet the NHS weekly targets.',
}

const HEALTH_DOT_CLASS: Record<WeekFitnessStatus, string> = {
  good: 'bg-success',
  partial: 'bg-warning',
  missed: 'bg-danger',
}

/**
 * The month-at-a-glance grid: 6 weeks x 7 days, each day showing its title.
 * Birthday days get a small green dot. The gutter to the left of each Monday
 * row carries the weekly NHS health verdict (green/amber/red) for the current
 * and past weeks — future weeks show nothing, since there's nothing to judge.
 */
export function MonthView({
  year,
  month,
  summaries,
  weekFitness,
  birthdayDateIds,
  todayId,
  onSelectDay,
}: MonthViewProps) {
  const grid = getMonthGrid(year, month)
  const weeks = Array.from({ length: 6 }, (_, i) => grid.slice(i * 7, i * 7 + 7))

  return (
    <div className="animate-fade-in">
      <div className="mb-1 flex items-center gap-1 text-center text-xs text-ink-tertiary">
        <div className="w-6 shrink-0" aria-hidden="true" />
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="flex-1 py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        {weeks.map((week) => {
          const mondayId = week[0].dateId
          const fitness = weekFitness?.get(mondayId)
          const showVerdict = weekFitness !== undefined && mondayId <= todayId
          const status = fitness
            ? weekFitnessStatus(fitness.gymSessions, fitness.vigorousMinutes)
            : 'missed'

          return (
            <div key={mondayId} className="flex items-stretch gap-1">
              <div className="flex w-6 shrink-0 items-center justify-center">
                {showVerdict && (
                  <span
                    className={`size-1.5 rounded-full ${HEALTH_DOT_CLASS[status]}`}
                    aria-label={STATUS_LABEL[status]}
                    title={STATUS_LABEL[status]}
                  />
                )}
              </div>
              {week.map((day) => (
                <DayCell
                  key={day.dateId}
                  day={day}
                  isToday={day.dateId === todayId}
                  summary={summaries?.get(day.dateId)}
                  hasBirthday={birthdayDateIds?.has(day.dateId)}
                  onSelect={onSelectDay}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}