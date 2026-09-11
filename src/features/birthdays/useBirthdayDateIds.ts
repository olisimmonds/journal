import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { addDays, parseDateId, toDateId } from '../../utils/date'

/**
 * The set of date ids in `[startDateId, endDateId]` that fall on a birthday.
 * Birthdays are yearless (month + day), so each calendar day in the range is
 * compared against every stored birthday. Ranges are at most a year long and
 * birthday lists are small, so the naive per-day scan is fine.
 *
 * Returns `undefined` until the query resolves (matching the calendar's other
 * live queries), so the caller can avoid flashing dates as birthday-free.
 */
export function useBirthdayDateIds(
  startDateId: string,
  endDateId: string,
): Set<string> | undefined {
  return useLiveQuery(async () => {
    const birthdays = await db.birthdays.toArray()
    const result = new Set<string>()

    let day = parseDateId(startDateId)
    const end = parseDateId(endDateId)
    while (day.getTime() <= end.getTime()) {
      if (birthdays.some((b) => b.month === day.getMonth() + 1 && b.day === day.getDate())) {
        result.add(toDateId(day))
      }
      day = addDays(day, 1)
    }
    return result
  }, [startDateId, endDateId])
}