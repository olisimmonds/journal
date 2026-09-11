import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { aggregateWeekFitness, type WeekFitness } from './weekFitness'

/**
 * Live-queries the health data for a date range, then buckets it into per-week
 * sums keyed by each week's Monday. Re-runs automatically when entries change.
 * Returns `undefined` until the query resolves, so callers can avoid rendering
 * a "missed" verdict for a fraction of a second before real data arrives.
 */
export function useWeekFitness(startDateId: string, endDateId: string): Map<string, WeekFitness> | undefined {
  return useLiveQuery(async () => {
    const entries = await db.entries
      .where('id')
      .between(startDateId, endDateId, true, true)
      .toArray()
    return aggregateWeekFitness(entries)
  }, [startDateId, endDateId])
}