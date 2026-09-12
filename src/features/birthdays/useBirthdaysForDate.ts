import { useLiveQuery } from 'dexie-react-hooks'
import { listBirthdays } from '../../db/birthdays.repo'
import type { Birthday } from '../../db/types'
import { parseDateId } from '../../utils/date'

/**
 * The birthdays that fall on `dateId`. Uses the same month/day match as the
 * calendar's green dot (useBirthdayDateIds), so a dot on a date and the names
 * shown on that date's page always agree — e.g. a Feb 29 birthday only applies
 * on Feb 29. Returns `undefined` until the query resolves.
 */
export function useBirthdaysForDate(dateId: string): Birthday[] | undefined {
  return useLiveQuery(async () => {
    const birthdays = await listBirthdays()
    const date = parseDateId(dateId)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return birthdays.filter((b) => b.month === month && b.day === day)
  }, [dateId])
}