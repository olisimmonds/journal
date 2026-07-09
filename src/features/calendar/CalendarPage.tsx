import { useState } from 'react'
import { Button } from '../../components/Button'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons'
import { formatMonthLabel, getMonthGrid, todayDateId, WEEKDAY_LABELS } from '../../utils/date'
import { DayCell } from './DayCell'
import { useMonthEntryDateIds } from './useMonthEntries'

/** Home page: a monthly calendar grid. Tap any day to open its journal entry. */
export function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const grid = getMonthGrid(year, month)
  const entryDateIds = useMonthEntryDateIds(year, month)
  const today = todayDateId()

  const goToPreviousMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const goToToday = () => {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-ink-primary">{formatMonthLabel(year, month)}</h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="px-2" onClick={goToPreviousMonth} aria-label="Previous month">
            <ChevronLeftIcon />
          </Button>
          <Button variant="ghost" onClick={goToToday}>
            Today
          </Button>
          <Button variant="ghost" className="px-2" onClick={goToNextMonth} aria-label="Next month">
            <ChevronRightIcon />
          </Button>
        </div>
      </header>

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
            isToday={day.dateId === today}
            hasEntry={entryDateIds?.has(day.dateId) ?? false}
          />
        ))}
      </div>
    </div>
  )
}
