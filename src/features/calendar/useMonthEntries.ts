import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getMonthDateIdBounds } from '../../utils/date'

/**
 * Live-queries which dates in the given month have a non-empty entry, so the
 * calendar grid can mark them. Re-runs automatically whenever the underlying
 * Dexie table changes (Dexie's `liveQuery` + React hook).
 */
export function useMonthEntryDateIds(year: number, month: number): Set<string> | undefined {
  return useLiveQuery(async () => {
    const [start, end] = getMonthDateIdBounds(year, month)
    const entries = await db.entries.where('id').between(start, end, true, true).toArray()

    const withText = entries.filter((e) => e.title.trim() !== '' || e.body.trim() !== '')
    const withTextIds = new Set(withText.map((e) => e.id))

    // An entry with only images (no text yet) should still be marked on the calendar.
    const emptyTextEntries = entries.filter((e) => !withTextIds.has(e.id))
    const imageCounts = await Promise.all(
      emptyTextEntries.map((e) => db.images.where('entryId').equals(e.id).count()),
    )
    emptyTextEntries.forEach((entry, i) => {
      if (imageCounts[i] > 0) withTextIds.add(entry.id)
    })

    return withTextIds
  }, [year, month])
}
