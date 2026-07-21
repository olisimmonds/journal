import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { createNote, listNotes } from '../../db/notes.repo'
import {
  getPendingNoteDeletionId,
  scheduleNoteDeletion,
  undoNoteDeletion,
} from './pendingNoteDeletion'

beforeEach(async () => {
  await db.notes.clear()
  await db.tombstones.clear()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('pendingNoteDeletion', () => {
  it('keeps the note in the database until the undo window elapses', async () => {
    const note = await createNote()

    scheduleNoteDeletion(note.id)
    expect(getPendingNoteDeletionId()).toBe(note.id)
    expect(await listNotes()).toHaveLength(1) // not actually deleted yet

    await vi.advanceTimersByTimeAsync(6_000)

    expect(getPendingNoteDeletionId()).toBeNull()
    expect(await listNotes()).toHaveLength(0)
  })

  it('undo cancels the deletion before the window elapses', async () => {
    const note = await createNote()

    scheduleNoteDeletion(note.id)
    const undone = undoNoteDeletion(note.id)

    expect(undone).toBe(true)
    expect(getPendingNoteDeletionId()).toBeNull()

    await vi.advanceTimersByTimeAsync(10_000)
    expect(await listNotes()).toHaveLength(1) // still there
  })

  it('undo does nothing once the window has already elapsed', async () => {
    const note = await createNote()

    scheduleNoteDeletion(note.id)
    await vi.advanceTimersByTimeAsync(6_000)

    expect(undoNoteDeletion(note.id)).toBe(false)
  })

  it('starting a new deletion finalizes a previous still-pending one immediately', async () => {
    const first = await createNote()
    const second = await createNote()

    scheduleNoteDeletion(first.id)
    scheduleNoteDeletion(second.id)
    await vi.advanceTimersByTimeAsync(0) // flush the finalize()'s async delete

    // The first note's own undo window never got a chance to run out, but
    // starting a second deletion finalizes it right away.
    expect(await listNotes()).toHaveLength(1)
    expect(getPendingNoteDeletionId()).toBe(second.id)
  })
})
