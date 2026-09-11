import { describe, expect, it } from 'vitest'
import type { JournalEntry } from '../../db/types'
import {
  aggregateWeekFitness,
  NHS_WEEKLY_TARGETS,
  weekFitnessStatus,
} from './weekFitness'

function entry(id: string, gym: boolean, vigorousMinutes: number): JournalEntry {
  return {
    id,
    title: '',
    body: '',
    gym,
    vigorousMinutes,
    createdAt: 0,
    updatedAt: 0,
  }
}

describe('weekFitnessStatus', () => {
  it('is green when both NHS criteria are met', () => {
    expect(weekFitnessStatus(2, 75)).toBe('good')
    expect(weekFitnessStatus(3, 90)).toBe('good')
  })

  it('is amber when exactly one criterion is met', () => {
    expect(weekFitnessStatus(2, 74)).toBe('partial') // gym ok, minutes not
    expect(weekFitnessStatus(1, 80)).toBe('partial') // minutes ok, gym not
  })

  it('is red when neither criterion is met', () => {
    expect(weekFitnessStatus(0, 0)).toBe('missed')
    expect(weekFitnessStatus(1, 40)).toBe('missed')
  })

  it('exposes the NHS targets for tests and UI copy', () => {
    expect(NHS_WEEKLY_TARGETS).toEqual({ gymSessions: 2, vigorousMinutes: 75 })
  })
})

describe('aggregateWeekFitness', () => {
  it('sums gym sessions and vigorous minutes per week, keyed by the Monday', () => {
    // 2026-07-13 is a Monday; 2026-07-20 is the following Monday.
    const entries = [
      entry('2026-07-13', true, 30),
      entry('2026-07-15', true, 20),
      entry('2026-07-19', false, 25), // Sunday of the same week
      entry('2026-07-20', true, 10),
    ]

    const buckets = aggregateWeekFitness(entries)

    expect(buckets.get('2026-07-13')).toEqual({
      weekStartId: '2026-07-13',
      gymSessions: 2,
      vigorousMinutes: 75,
    })
    expect(buckets.get('2026-07-20')).toEqual({
      weekStartId: '2026-07-20',
      gymSessions: 1,
      vigorousMinutes: 10,
    })
  })

  it('ignores days with no health data at all', () => {
    const buckets = aggregateWeekFitness([
      entry('2026-07-13', false, 0),
      entry('2026-07-14', true, 0),
    ])
    expect(buckets.get('2026-07-13')?.gymSessions).toBe(1)
  })

  it('treats a missing vigorousMinutes field (old records) as zero', () => {
    const legacy = { ...entry('2026-07-13', true, 0) } as JournalEntry
    delete (legacy as { vigorousMinutes?: number }).vigorousMinutes

    const buckets = aggregateWeekFitness([legacy])
    expect(buckets.get('2026-07-13')).toEqual({
      weekStartId: '2026-07-13',
      gymSessions: 1,
      vigorousMinutes: 0,
    })
  })
})