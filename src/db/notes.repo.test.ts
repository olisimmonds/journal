import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import {
  createNote,
  deleteNote,
  listNotes,
  reorderNotes,
  updateNote,
} from './notes.repo'

beforeEach(async () => {
  await db.notes.clear()
  await db.tombstones.clear()
})

describe('notes.repo', () => {
  it('creates notes with increasing order', async () => {
    const first = await createNote()
    const second = await createNote()

    expect(first.order).toBe(0)
    expect(second.order).toBe(1)
  })

  it('updates fields and refreshes updatedAt', async () => {
    const note = await createNote()
    await new Promise((r) => setTimeout(r, 5))

    await updateNote(note.id, { title: 'Groceries', body: 'Milk\nEggs' })

    const [updated] = await listNotes()
    expect(updated.title).toBe('Groceries')
    expect(updated.body).toBe('Milk\nEggs')
    expect(updated.updatedAt).toBeGreaterThan(note.updatedAt)
  })

  it('deletes a note', async () => {
    const note = await createNote()
    await deleteNote(note.id)
    expect(await listNotes()).toHaveLength(0)
  })

  it('reorders notes according to the given id list', async () => {
    const a = await createNote()
    const b = await createNote()
    const c = await createNote()

    await reorderNotes([c.id, a.id, b.id])

    const ordered = await listNotes()
    expect(ordered.map((n) => n.id)).toEqual([c.id, a.id, b.id])
  })
})
