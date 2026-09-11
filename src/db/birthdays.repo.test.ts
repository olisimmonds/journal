import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { createBirthday, deleteBirthday, listBirthdays } from './birthdays.repo'

beforeEach(async () => {
  await db.birthdays.clear()
  await db.tombstones.clear()
})

describe('birthdays.repo', () => {
  it('creates birthdays with month and day, trimmed names', async () => {
    const birthday = await createBirthday('  Gran  ', 12, 25)
    expect(birthday.name).toBe('Gran')
    expect(birthday.month).toBe(12)
    expect(birthday.day).toBe(25)

    const all = await listBirthdays()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(birthday.id)
  })

  it('rejects an impossible date (Feb 30)', async () => {
    await expect(createBirthday('Nobody', 2, 30)).rejects.toThrow()
    await expect(createBirthday('Nobody', 13, 1)).rejects.toThrow()
    await expect(createBirthday('', 1, 1)).rejects.toThrow()
    expect(await listBirthdays()).toHaveLength(0)
  })

  it('accepts a leap-day birthday (Feb 29)', async () => {
    const birthday = await createBirthday('Leap', 2, 29)
    expect(birthday.day).toBe(29)
  })

  it('deletes a birthday and records a tombstone', async () => {
    const birthday = await createBirthday('Gran', 12, 25)

    await deleteBirthday(birthday.id)

    expect(await listBirthdays()).toHaveLength(0)
    const tombstone = await db.tombstones.get(birthday.id)
    expect(tombstone?.type).toBe('birthday')
  })
})