import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { getMonthDateIdBounds } from '../../utils/date'

/**
 * Live-queries which dates in the given month have a non-empty entry, mapped
 * to that entry's title (empty string if the entry has no title yet). The
 * calendar grid uses map membership to mark a day as having an entry, and
 * the (possibly empty) title to render on the day cell. Re-runs
 * automatically whenever the underlying Dexie table changes (Dexie's
 * `liveQuery` + React hook).
 */
export function useMonthEntryTitles(year: number, month: number): Map<string, string> | undefined {
  return useLiveQuery(async () => {
    const [start, end] = getMonthDateIdBounds(year, month)
    const entries = await db.entries.where('id').between(start, end, true, true).toArray()

    const withText = entries.filter((e) => e.title.trim() !== '' || e.body.trim() !== '')
    const titlesByDateId = new Map(withText.map((e) => [e.id, e.title.trim()]))

    // An entry with only images (no text yet) should still be marked on the calendar.
    const emptyTextEntries = entries.filter((e) => !titlesByDateId.has(e.id))
    const imageCounts = await Promise.all(
      emptyTextEntries.map((e) => db.images.where('entryId').equals(e.id).count()),
    )
    emptyTextEntries.forEach((entry, i) => {
      if (imageCounts[i] > 0) titlesByDateId.set(entry.id, entry.title.trim())
    })

    return titlesByDateId
  }, [year, month])
}
