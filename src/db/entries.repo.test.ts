import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import {
  addImageToEntry,
  deleteEntry,
  getEntry,
  listEntriesInRange,
  listImagesForEntry,
  removeImage,
  upsertEntry,
} from './entries.repo'

beforeEach(async () => {
  await db.entries.clear()
  await db.images.clear()
  await db.tombstones.clear()
})

describe('entries.repo', () => {
  it('creates an entry on first upsert and preserves createdAt on subsequent edits', async () => {
    const created = await upsertEntry('2026-07-09', { body: 'Hello' })
    expect(created.body).toBe('Hello')

    await new Promise((r) => setTimeout(r, 5))
    const updated = await upsertEntry('2026-07-09', { body: 'Hello, updated' })

    expect(updated.createdAt).toBe(created.createdAt)
    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt)
    expect(updated.body).toBe('Hello, updated')
  })

  it('returns undefined for a date with no entry', async () => {
    expect(await getEntry('2026-01-01')).toBeUndefined()
  })

  it('lists entries within an inclusive date range', async () => {
    await upsertEntry('2026-07-01', { body: 'a' })
    await upsertEntry('2026-07-15', { body: 'b' })
    await upsertEntry('2026-08-01', { body: 'c' })

    const july = await listEntriesInRange('2026-07-01', '2026-07-31')
    expect(july.map((e) => e.id).sort()).toEqual(['2026-07-01', '2026-07-15'])
  })

  it('attaches images in order and lists them back sorted', async () => {
    await upsertEntry('2026-07-09', { body: 'entry with photos' })

    const blobA = new Blob(['a'], { type: 'image/png' })
    const blobB = new Blob(['b'], { type: 'image/png' })
    await addImageToEntry('2026-07-09', blobA, 'image/png')
    await addImageToEntry('2026-07-09', blobB, 'image/png')

    const images = await listImagesForEntry('2026-07-09')
    expect(images).toHaveLength(2)
    expect(images[0].order).toBe(0)
    expect(images[1].order).toBe(1)
  })

  it('removing an image updates the parent entry updatedAt', async () => {
    const entry = await upsertEntry('2026-07-09', { body: 'entry' })
    const image = await addImageToEntry('2026-07-09', new Blob(['a']), 'image/png')

    await new Promise((r) => setTimeout(r, 5))
    await removeImage(image.id)

    const refreshed = await getEntry('2026-07-09')
    expect(refreshed?.updatedAt).toBeGreaterThan(entry.updatedAt)
    expect(await listImagesForEntry('2026-07-09')).toHaveLength(0)
  })

  it('deleting an entry cascades to its images', async () => {
    await upsertEntry('2026-07-09', { body: 'entry' })
    await addImageToEntry('2026-07-09', new Blob(['a']), 'image/png')

    await deleteEntry('2026-07-09')

    expect(await getEntry('2026-07-09')).toBeUndefined()
    expect(await listImagesForEntry('2026-07-09')).toHaveLength(0)
  })
})
