import { describe, expect, it } from 'vitest'
import {
  getMonthDateIdBounds,
  getMonthGrid,
  parseDateId,
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

  it('computes correct month bounds including short/leap-affected months', () => {
    expect(getMonthDateIdBounds(2026, 1)).toEqual(['2026-02-01', '2026-02-28'])
    expect(getMonthDateIdBounds(2024, 1)).toEqual(['2024-02-01', '2024-02-29']) // leap year
  })
})
