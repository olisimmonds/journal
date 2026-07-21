import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './schema'
import {
  createNote,
  deleteNote,
  listNotes,
  listNoteVersions,
  reorderNotes,
  restoreNoteVersion,
  updateNote,
} from './notes.repo'

beforeEach(async () => {
  await db.notes.clear()
  await db.tombstones.clear()
  await db.noteVersions.clear()
})

afterEach(() => {
  vi.useRealTimers()
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

  it('snapshots the previous state before an update, and restoring it brings the content back', async () => {
    // Only fake Date, not timers — Dexie's IndexedDB backend relies on real
    // setTimeout/microtasks internally, and faking those hangs the test.
    vi.useFakeTimers({ toFake: ['Date'] })
    const note = await createNote()

    await updateNote(note.id, { title: 'Draft', body: 'Some important text' })
    vi.setSystemTime(Date.now() + 61_000) // clear the snapshot throttle window
    await updateNote(note.id, { title: '', body: '' }) // simulates an accidental full delete

    const [afterDelete] = await listNotes()
    expect(afterDelete.body).toBe('')

    const versions = await listNoteVersions(note.id)
    // One snapshot for the note's blank starting state, one for the state
    // right before the destructive edit — versions are newest first.
    expect(versions).toHaveLength(2)
    expect(versions[0].body).toBe('Some important text')

    await restoreNoteVersion(note.id, versions[0].id)

    const [restored] = await listNotes()
    expect(restored.title).toBe('Draft')
    expect(restored.body).toBe('Some important text')
  })

  it('throttles snapshots so rapid autosaves do not each create a version', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const note = await createNote()

    await updateNote(note.id, { title: 'v1', body: '' })
    await updateNote(note.id, { title: 'v2', body: '' })
    await updateNote(note.id, { title: 'v3', body: '' })

    // Only the first update's snapshot (the note's blank starting state) is
    // taken — the next two updates land inside the throttle window.
    expect(await listNoteVersions(note.id)).toHaveLength(1)
  })

  it('deletes a note\'s version history along with the note', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const note = await createNote()
    await updateNote(note.id, { title: 'v1', body: '' })
    vi.setSystemTime(Date.now() + 61_000)
    await updateNote(note.id, { title: 'v2', body: '' })

    expect(await listNoteVersions(note.id)).toHaveLength(2)

    await deleteNote(note.id)

    expect(await listNoteVersions(note.id)).toHaveLength(0)
  })
})
