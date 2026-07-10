import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { addImageToEntry, upsertEntry } from '../db/entries.repo'
import { createNote, updateNote } from '../db/notes.repo'
import { buildBackupData } from './backupSerializer'

beforeEach(async () => {
  await db.entries.clear()
  await db.images.clear()
  await db.notes.clear()
  await db.tombstones.clear()
})

describe('backup serializer', () => {
  it('serializes entries, images, and notes into a plain backup snapshot', async () => {
    await upsertEntry('2026-07-09', { title: 'Hike', body: 'Great weather today.' })
    await addImageToEntry('2026-07-09', new Blob(['fake-image-bytes']), 'image/png')
    const note = await createNote()
    await updateNote(note.id, { title: 'Groceries', body: 'Milk, eggs' })

    const data = await buildBackupData()

    expect(data.entries).toHaveLength(1)
    expect(data.entries[0].title).toBe('Hike')
    expect(data.images).toHaveLength(1)
    expect(data.images[0].mimeType).toBe('image/png')
    expect(data.notes).toHaveLength(1)
    expect(data.notes[0].title).toBe('Groceries')
  })
})
