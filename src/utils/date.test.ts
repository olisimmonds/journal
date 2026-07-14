import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  addYears,
  formatWeekLabel,
  getMonthGrid,
  getMonthGridDateIdBounds,
  getWeekDateIdBounds,
  getWeekDays,
  getYearDateIdBounds,
  isValidDateId,
  parseDateId,
  startOfWeek,
  toDateId,
} from './date'

describe('date utils', () => {
  it('round-trips a date through toDateId/parseDateId', () => {
    const date = new Date(2026, 6, 9) // July 9 2026
    const id = toDateId(date)
    expect(id).toBe('2026-07-09')
    expect(toDateId(parseDateId(id))).toBe(id)
  })

  it('builds a 42-cell grid that fully covers the month', () => {
    const grid = getMonthGrid(2026, 6) // July 2026
    expect(grid).toHaveLength(42)

    const currentMonthDays = grid.filter((d) => d.isCurrentMonth)
    expect(currentMonthDays).toHaveLength(31)
    expect(currentMonthDays[0].dateId).toBe('2026-07-01')
    expect(currentMonthDays[30].dateId).toBe('2026-07-31')
  })

  it('grid weeks start on Sunday', () => {
    const grid = getMonthGrid(2026, 6)
    expect(grid[0].date.getDay()).toBe(0)
  })
})

describe('date arithmetic', () => {
  it('adds days across a month boundary', () => {
    expect(toDateId(addDays(new Date(2026, 6, 30), 3))).toBe('2026-08-02')
    expect(toDateId(addDays(new Date(2026, 0, 1), -1))).toBe('2025-12-31')
  })

  it('clamps the day-of-month when adding months', () => {
    // Naive setMonth would spill Jan 31 into March.
    expect(toDateId(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(toDateId(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29') // leap year
    expect(toDateId(addMonths(new Date(2026, 6, 14), 1))).toBe('2026-08-14')
  })

  it('rolls the year over when adding months past December', () => {
    expect(toDateId(addMonths(new Date(2026, 11, 15), 1))).toBe('2027-01-15')
    expect(toDateId(addMonths(new Date(2026, 0, 15), -1))).toBe('2025-12-15')
  })

  it('clamps Feb 29 when adding years into a non-leap year', () => {
    expect(toDateId(addYears(new Date(2024, 1, 29), 1))).toBe('2025-02-28')
    expect(toDateId(addYears(new Date(2026, 6, 14), -1))).toBe('2025-07-14')
  })
})

describe('week helpers', () => {
  it('starts weeks on the Sunday on or before the date', () => {
    // 2026-07-14 is a Tuesday; its week starts Sunday 2026-07-12.
    expect(toDateId(startOfWeek(new Date(2026, 6, 14)))).toBe('2026-07-12')
    // A Sunday is already the start of its own week.
    expect(toDateId(startOfWeek(new Date(2026, 6, 12)))).toBe('2026-07-12')
  })

  it('returns seven consecutive days, Sunday first', () => {
    const days = getWeekDays(new Date(2026, 6, 14))
    expect(days).toHaveLength(7)
    expect(days[0].dateId).toBe('2026-07-12')
    expect(days[6].dateId).toBe('2026-07-18')
    expect(days[0].date.getDay()).toBe(0)
  })

  it('bounds a week spanning a month boundary', () => {
    expect(getWeekDateIdBounds(new Date(2026, 6, 1))).toEqual(['2026-06-28', '2026-07-04'])
  })

  it('labels a week, collapsing whatever the two ends share', () => {
    expect(formatWeekLabel(new Date(2026, 6, 14))).toBe('12 – 18 July 2026')
    // Spanning two months, and two years, keeps both ends qualified.
    expect(formatWeekLabel(new Date(2026, 6, 1))).toMatch(/Jun.*–.*Jul.*2026/)
    expect(formatWeekLabel(new Date(2025, 11, 31))).toMatch(/2025.*–.*2026/)
  })
})

describe('range bounds', () => {
  it('bounds the whole 42-cell month grid, not just the month', () => {
    const [start, end] = getMonthGridDateIdBounds(2026, 6) // July 2026
    const grid = getMonthGrid(2026, 6)
    expect(start).toBe(grid[0].dateId)
    expect(end).toBe(grid[41].dateId)
    // The grid's adjacent-month days fall inside the range.
    expect(start < '2026-07-01').toBe(true)
    expect(end > '2026-07-31').toBe(true)
  })

  it('bounds a full year', () => {
    expect(getYearDateIdBounds(2026)).toEqual(['2026-01-01', '2026-12-31'])
  })
})

describe('isValidDateId', () => {
  it('accepts a real calendar date', () => {
    expect(isValidDateId('2026-07-14')).toBe(true)
    expect(isValidDateId('2024-02-29')).toBe(true) // leap year
  })

  it('rejects malformed, missing, or non-existent dates', () => {
    expect(isValidDateId(null)).toBe(false)
    expect(isValidDateId('')).toBe(false)
    expect(isValidDateId('nonsense')).toBe(false)
    expect(isValidDateId('2026-7-4')).toBe(false) // unpadded
    expect(isValidDateId('2026-02-31')).toBe(false) // parses, but rolls to Mar 3
    expect(isValidDateId('2025-02-29')).toBe(false) // not a leap year
    expect(isValidDateId('2026-13-01')).toBe(false)
  })
})
