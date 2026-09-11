import type { JournalEntry } from '../../db/types'
import { parseDateId, startOfWeek, toDateId } from '../../utils/date'

/**
 * NHS weekly activity targets for adults: at least two gym/workout sessions
 * and at least 75 minutes of vigorous activity each week.
 */
export const NHS_WEEKLY_TARGETS = {
  gymSessions: 2,
  vigorousMinutes: 75,
} as const

export type WeekFitnessStatus = 'good' | 'partial' | 'missed'

export interface WeekFitness {
  /** ISO date of the week's Monday — the row the month grid anchors it to. */
  weekStartId: string
  /** Number of days in the week logged as a gym session. */
  gymSessions: number
  /** Sum of vigorous minutes logged in the week. */
  vigorousMinutes: number
}

/** How well a completed (or in-progress) week meets the NHS targets. */
export function weekFitnessStatus(
  gymSessions: number,
  vigorousMinutes: number,
): WeekFitnessStatus {
  const gymOk = gymSessions >= NHS_WEEKLY_TARGETS.gymSessions
  const minutesOk = vigorousMinutes >= NHS_WEEKLY_TARGETS.vigorousMinutes
  if (gymOk && minutesOk) return 'good'
  if (gymOk || minutesOk) return 'partial'
  return 'missed'
}

/**
 * Sums each entry's health data into per-week buckets, grouped by the Monday
 * that starts the week (the calendar is Monday-start throughout). Days with
 * neither a gym session nor any vigorous minutes contribute nothing, so
 * ordinary journal days never create an empty bucket.
 */
export function aggregateWeekFitness(entries: JournalEntry[]): Map<string, WeekFitness> {
  const byWeek = new Map<string, WeekFitness>()

  for (const entry of entries) {
    const gym = entry.gym === true
    const minutes = entry.vigorousMinutes ?? 0
    if (!gym && minutes === 0) continue

    const weekStartId = toDateId(startOfWeek(parseDateId(entry.id)))
    const bucket = byWeek.get(weekStartId) ?? { weekStartId, gymSessions: 0, vigorousMinutes: 0 }
    if (gym) bucket.gymSessions += 1
    bucket.vigorousMinutes += minutes
    byWeek.set(weekStartId, bucket)
  }

  return byWeek
}