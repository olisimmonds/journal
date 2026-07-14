/**
 * Date helpers used across the calendar and entry features. All dates are
 * treated as local calendar days (not UTC/instants) since a journal entry
 * belongs to "July 9th" regardless of timezone technicalities.
 */

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Converts a Date to its "YYYY-MM-DD" entry id, using local time. */
export function toDateId(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/** Parses a "YYYY-MM-DD" id back into a local-midnight Date. */
export function parseDateId(dateId: string): Date {
  const [year, month, day] = dateId.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isSameDateId(a: string, b: string): boolean {
  return a === b
}

export function todayDateId(): string {
  return toDateId(new Date())
}

/** How much of the calendar is shown at once. Ordered outermost -> innermost. */
export type ZoomLevel = 'year' | 'month' | 'week'

export interface CalendarDay {
  date: Date
  dateId: string
}

export interface MonthGridDay extends CalendarDay {
  isCurrentMonth: boolean
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Adds months, clamping the day-of-month to the target month's length so
 * Jan 31 + 1 month is Feb 28 rather than spilling into March (which is what
 * a naive `setMonth` would do).
 */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), daysInTarget))
  return target
}

/** Adds years via `addMonths`, so Feb 29 clamps to Feb 28 in a non-leap year. */
export function addYears(date: Date, years: number): Date {
  return addMonths(date, years * 12)
}

/** The Sunday on or before `date`, matching the Sunday-start month grid. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay())
}

/** The seven days of the week containing `date`, Sunday first. */
export function getWeekDays(date: Date): CalendarDay[] {
  const start = startOfWeek(date)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(start, i)
    return { date: day, dateId: toDateId(day) }
  })
}

/**
 * True only for a well-formed, real calendar date id. The round-trip check
 * rejects ids that parse but don't exist (e.g. "2026-02-31" rolls to Mar 3).
 */
export function isValidDateId(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = parseDateId(value)
  return !Number.isNaN(parsed.getTime()) && toDateId(parsed) === value
}

/**
 * Builds a 6-row x 7-column grid (42 cells) for the given month, including
 * the leading/trailing days from adjacent months needed to fill full weeks.
 * Weeks start on Sunday.
 */
export function getMonthGrid(year: number, month: number): MonthGridDay[] {
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay() // 0 (Sun) - 6 (Sat)
  const gridStart = new Date(year, month, 1 - startOffset)

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + i)
    return {
      date,
      dateId: toDateId(date),
      isCurrentMonth: date.getMonth() === month,
    }
  })
}

export function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })
}

export function formatFullDate(dateId: string): string {
  return parseDateId(dateId).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Bounds covering the whole 42-cell month grid, including the adjacent-month
 * days it renders — querying this range (rather than the month proper) means
 * those trailing/leading cells show their entries instead of looking empty.
 */
export function getMonthGridDateIdBounds(year: number, month: number): [string, string] {
  const grid = getMonthGrid(year, month)
  return [grid[0].dateId, grid[grid.length - 1].dateId]
}

export function getWeekDateIdBounds(date: Date): [string, string] {
  const start = startOfWeek(date)
  return [toDateId(start), toDateId(addDays(start, 6))]
}

export function getYearDateIdBounds(year: number): [string, string] {
  return [toDateId(new Date(year, 0, 1)), toDateId(new Date(year, 11, 31))]
}

/**
 * Labels the week containing `date`, collapsing whatever the two ends share:
 * "12 – 18 July 2026", "28 Jun – 4 Jul 2026", "29 Dec 2025 – 4 Jan 2026".
 */
export function formatWeekLabel(date: Date): string {
  const start = startOfWeek(date)
  const end = addDays(start, 6)
  const sameYear = start.getFullYear() === end.getFullYear()

  if (sameYear && start.getMonth() === end.getMonth()) {
    const monthYear = start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
    return `${start.getDate()} – ${end.getDate()} ${monthYear}`
  }

  const startLabel = start.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
  const endLabel = end.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export function formatShortMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'short' })
}
