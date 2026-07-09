import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { upsertEntry } from '../../db/entries.repo'
import { searchEntries } from './searchIndex'

beforeEach(async () => {
  await db.entries.clear()
})

describe('searchEntries', () => {
  it('returns no results for an empty query', async () => {
    await upsertEntry('2026-07-01', { body: 'anything' })
    expect(await searchEntries('   ')).toEqual([])
  })

  it('finds entries by body text, case-insensitively', async () => {
    await upsertEntry('2026-07-01', { title: 'Trip', body: 'We went hiking in the mountains.' })
    await upsertEntry('2026-07-02', { title: 'Errand', body: 'Bought groceries.' })

    const results = await searchEntries('HIKING')

    expect(results).toHaveLength(1)
    expect(results[0].entry.id).toBe('2026-07-01')
    expect(results[0].snippet).toContain('hiking')
  })

  it('finds entries by title', async () => {
    await upsertEntry('2026-07-01', { title: 'Birthday party', body: 'Fun day.' })
    const results = await searchEntries('birthday')
    expect(results).toHaveLength(1)
  })

  it('sorts results with the most recent date first', async () => {
    await upsertEntry('2026-07-01', { body: 'apple' })
    await upsertEntry('2026-07-15', { body: 'apple pie' })

    const results = await searchEntries('apple')
    expect(results.map((r) => r.entry.id)).toEqual(['2026-07-15', '2026-07-01'])
  })
})
