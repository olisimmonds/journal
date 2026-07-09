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

export interface MonthGridDay {
  date: Date
  dateId: string
  isCurrentMonth: boolean
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

/** First and last date ids of a given month, for range-querying entries. */
export function getMonthDateIdBounds(year: number, month: number): [string, string] {
  const first = toDateId(new Date(year, month, 1))
  const last = toDateId(new Date(year, month + 1, 0))
  return [first, last]
}
