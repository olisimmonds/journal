import { db } from './schema'
import type { Birthday } from './types'

/** Data access layer for birthdays (yearless recurring dates). */

const MONTH_DAY_LIMITS = [
  31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
] // Feb allows 29 (leap years are valid birthdays).

/** Guards the stored shape: month 1-12 and a day that can exist in that month. */
function assertValidBirthday(month: number, day: number): void {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid birthday month: ${month}`)
  }
  const dayLimit = MONTH_DAY_LIMITS[month - 1]
  if (!Number.isInteger(day) || day < 1 || day > dayLimit) {
    throw new Error(`Invalid birthday day: ${day} for month ${month}`)
  }
}

export async function listBirthdays(): Promise<Birthday[]> {
  const birthdays = await db.birthdays.toArray()
  return birthdays.sort((a, b) => a.createdAt - b.createdAt)
}

/** Creates a birthday. Throws on a month/day that cannot exist (e.g. Feb 30). */
export async function createBirthday(name: string, month: number, day: number): Promise<Birthday> {
  assertValidBirthday(month, day)
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Birthday name cannot be empty')

  const now = Date.now()
  const birthday: Birthday = {
    id: crypto.randomUUID(),
    name: trimmed,
    month,
    day,
    createdAt: now,
    updatedAt: now,
  }

  await db.birthdays.add(birthday)
  return birthday
}

/**
 * Deletes a birthday and records a tombstone so a stale Google Drive backup
 * never resurrects it on the next sync (see src/sync/syncManager.ts).
 */
export async function deleteBirthday(id: string): Promise<void> {
  await db.transaction('rw', db.birthdays, db.tombstones, async () => {
    await db.birthdays.delete(id)
    await db.tombstones.put({ id, type: 'birthday', deletedAt: Date.now() })
  })
}