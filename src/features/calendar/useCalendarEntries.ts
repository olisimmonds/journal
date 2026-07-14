import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'

/** What a calendar cell needs to know about a day, without opening the entry. */
export interface EntrySummary {
  title: string
  /** The entry's body, for views with room to preview it. */
  body: string
  hasImages: boolean
}

/**
 * Live-queries a date range, mapping each day that has *something* on it to a
 * summary. Days whose entry row exists but is completely empty are omitted —
 * an empty row is a side effect of opening a day, not a journal entry.
 *
 * Range-based rather than month-based so the year, month, and week views can
 * all share one query shape; each passes the bounds of what it renders.
 * Re-runs automatically whenever the underlying Dexie tables change.
 */
export function useEntrySummaries(
  startDateId: string,
  endDateId: string,
): Map<string, EntrySummary> | undefined {
  return useLiveQuery(async () => {
    const entries = await db.entries.where('id').between(startDateId, endDateId, true, true).toArray()
    if (entries.length === 0) return new Map<string, EntrySummary>()

    // One indexed key scan beats a per-entry count query when the range is a
    // whole year; `uniqueKeys` reads the entryId index without loading blobs.
    const entryIdsWithImages = new Set(
      (await db.images.orderBy('entryId').uniqueKeys()) as string[],
    )

    const summaries = new Map<string, EntrySummary>()
    for (const entry of entries) {
      const title = entry.title.trim()
      const body = entry.body.trim()
      const hasImages = entryIdsWithImages.has(entry.id)
      if (!title && !body && !hasImages) continue
      summaries.set(entry.id, { title, body, hasImages })
    }
    return summaries
  }, [startDateId, endDateId])
}
