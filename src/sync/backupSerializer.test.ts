import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { addImageToEntry, upsertEntry } from '../db/entries.repo'
import { createNote, setNotePinned, updateNote } from '../db/notes.repo'
import { createBirthday } from '../db/birthdays.repo'
import { BACKUP_FORMAT_VERSION, buildBackupData } from './backupSerializer'

beforeEach(async () => {
  await db.entries.clear()
  await db.images.clear()
  await db.notes.clear()
  await db.birthdays.clear()
  await db.tombstones.clear()
})

describe('backup serializer', () => {
  it('serializes entries, images, notes, and birthdays into a plain backup snapshot', async () => {
    await upsertEntry('2026-07-09', {
      title: 'Hike',
      body: 'Great weather today.',
      gym: true,
      vigorousMinutes: 45,
    })
    await addImageToEntry('2026-07-09', new Blob(['fake-image-bytes']), 'image/png')
    const note = await createNote()
    await updateNote(note.id, { title: 'Groceries', body: 'Milk, eggs' })
    await setNotePinned(note.id, true)
    await createBirthday('Gran', 12, 25)

    const data = await buildBackupData()

    expect(data.version).toBe(BACKUP_FORMAT_VERSION)
    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].title).toBe('Hike')
    // Health-tracker fields ride on the entry row and are part of the backup.
    expect(data.entries[0].gym).toBe(true)
    expect(data.entries[0].vigorousMinutes).toBe(45)
    expect(data.images).toHaveLength(1)
    expect(data.images[0].mimeType).toBe('image/png')
    expect(data.notes).toHaveLength(1)
    expect(data.notes[0].title).toBe('Groceries')
    // Pin state is a plain note field, so it backs up and syncs like any edit.
    expect(data.notes[0].pinned).toBe(true)
    expect(data.birthdays).toHaveLength(1)
    expect(data.birthdays[0].name).toBe('Gran')
  })
})
