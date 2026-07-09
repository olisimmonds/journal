import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../db/schema'
import { upsertEntry } from '../db/entries.repo'
import { createNote } from '../db/notes.repo'
import type { BackupData } from './backupSerializer'
import { mergeRemoteIntoLocal } from './syncManager'

beforeEach(async () => {
  await db.entries.clear()
  await db.images.clear()
  await db.notes.clear()
  await db.tombstones.clear()
})

function emptyRemote(overrides: Partial<BackupData> = {}): BackupData {
  return {
    version: 1,
    exportedAt: Date.now(),
    entries: [],
    images: [],
    notes: [],
    tombstones: [],
    ...overrides,
  }
}

describe('mergeRemoteIntoLocal', () => {
  it('adds a remote entry that does not exist locally', async () => {
    const remote = emptyRemote({
      entries: [{ id: '2026-07-09', title: 'Remote', body: 'From another device', createdAt: 1, updatedAt: 1 }],
    })

    const stats = await mergeRemoteIntoLocal(remote)

    expect(stats.mergedEntries).toBe(1)
    const local = await db.entries.get('2026-07-09')
    expect(local?.title).toBe('Remote')
  })

  it('prefers the newer entry between local and remote (last-write-wins)', async () => {
    await upsertEntry('2026-07-09', { title: 'Local older', body: 'x' })
    const local = await db.entries.get('2026-07-09')

    const remote = emptyRemote({
      entries: [{ id: '2026-07-09', title: 'Remote newer', body: 'y', createdAt: local!.createdAt, updatedAt: local!.updatedAt + 1000 }],
    })

    await mergeRemoteIntoLocal(remote)

    expect((await db.entries.get('2026-07-09'))?.title).toBe('Remote newer')
  })

  it('keeps the local entry when it is newer than the remote copy', async () => {
    await upsertEntry('2026-07-09', { title: 'Local newer', body: 'x' })
    const local = await db.entries.get('2026-07-09')

    const remote = emptyRemote({
      entries: [{ id: '2026-07-09', title: 'Remote older', body: 'y', createdAt: local!.createdAt, updatedAt: local!.updatedAt - 1000 }],
    })

    await mergeRemoteIntoLocal(remote)

    expect((await db.entries.get('2026-07-09'))?.title).toBe('Local newer')
  })

  it('does not resurrect an entry that was deleted locally after the remote copy was made', async () => {
    await upsertEntry('2026-07-09', { title: 'To delete', body: 'x' })
    const local = await db.entries.get('2026-07-09')
    await db.entries.delete('2026-07-09')
    await db.tombstones.put({ id: '2026-07-09', type: 'entry', deletedAt: local!.updatedAt + 500 })

    const remote = emptyRemote({
      entries: [{ id: '2026-07-09', title: 'Stale remote copy', body: 'x', createdAt: local!.createdAt, updatedAt: local!.updatedAt }],
    })

    await mergeRemoteIntoLocal(remote)

    expect(await db.entries.get('2026-07-09')).toBeUndefined()
  })

  it('applies a remote tombstone and deletes the local copy plus its images', async () => {
    await upsertEntry('2026-07-09', { title: 'Will be deleted remotely', body: 'x' })
    const local = await db.entries.get('2026-07-09')

    const remote = emptyRemote({
      tombstones: [{ id: '2026-07-09', type: 'entry', deletedAt: local!.updatedAt + 1000 }],
    })

    await mergeRemoteIntoLocal(remote)

    expect(await db.entries.get('2026-07-09')).toBeUndefined()
  })

  it('merges notes with the same last-write-wins semantics', async () => {
    const note = await createNote()

    const remote = emptyRemote({
      notes: [
        {
          id: note.id,
          order: note.order,
          title: 'Remote title',
          body: 'Remote body',
          checklist: [],
          createdAt: note.createdAt,
          updatedAt: note.updatedAt + 1000,
        },
      ],
    })

    const stats = await mergeRemoteIntoLocal(remote)

    expect(stats.mergedNotes).toBe(1)
    expect((await db.notes.get(note.id))?.title).toBe('Remote title')
  })
})
