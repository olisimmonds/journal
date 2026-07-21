import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { maybeCreateWeeklySnapshot } from './syncManager'
import * as driveClient from './driveClient'

const LAST_SNAPSHOT_STORAGE_KEY = 'journal.sync.lastSnapshotAt'

describe('maybeCreateWeeklySnapshot', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(driveClient, 'createSnapshotFile').mockResolvedValue('new-file-id')
    vi.spyOn(driveClient, 'deleteFile').mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('creates a snapshot when none has ever been taken', async () => {
    vi.spyOn(driveClient, 'listSnapshotFiles').mockResolvedValue([{ id: 'new-file-id', name: 'x' }])

    await maybeCreateWeeklySnapshot('token', '{}')

    expect(driveClient.createSnapshotFile).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(LAST_SNAPSHOT_STORAGE_KEY)).not.toBeNull()
  })

  it('skips creating a snapshot within the 7-day window', async () => {
    localStorage.setItem(LAST_SNAPSHOT_STORAGE_KEY, String(Date.now()))
    vi.spyOn(driveClient, 'listSnapshotFiles').mockResolvedValue([])

    await maybeCreateWeeklySnapshot('token', '{}')

    expect(driveClient.createSnapshotFile).not.toHaveBeenCalled()
  })

  it('creates a snapshot again once the 7-day window has passed', async () => {
    localStorage.setItem(LAST_SNAPSHOT_STORAGE_KEY, String(Date.now() - 8 * 24 * 60 * 60 * 1000))
    vi.spyOn(driveClient, 'listSnapshotFiles').mockResolvedValue([{ id: 'new-file-id', name: 'x' }])

    await maybeCreateWeeklySnapshot('token', '{}')

    expect(driveClient.createSnapshotFile).toHaveBeenCalledTimes(1)
  })

  it('prunes the oldest snapshots beyond the 12-snapshot cap', async () => {
    const existing = Array.from({ length: 12 }, (_, i) => ({
      id: `id-${i}`,
      name: `journal-backup-2026-01-${String(i + 1).padStart(2, '0')}.json`,
    }))
    vi.spyOn(driveClient, 'listSnapshotFiles').mockResolvedValue([
      ...existing,
      { id: 'new-file-id', name: 'journal-backup-2026-02-01.json' },
    ])

    await maybeCreateWeeklySnapshot('token', '{}')

    // 13 total, cap is 12 — the single oldest (id-0) should be deleted.
    expect(driveClient.deleteFile).toHaveBeenCalledTimes(1)
    expect(driveClient.deleteFile).toHaveBeenCalledWith('token', 'id-0')
  })

  it('does not delete anything when at or under the cap', async () => {
    const existing = Array.from({ length: 5 }, (_, i) => ({ id: `id-${i}`, name: `n${i}` }))
    vi.spyOn(driveClient, 'listSnapshotFiles').mockResolvedValue(existing)

    await maybeCreateWeeklySnapshot('token', '{}')

    expect(driveClient.deleteFile).not.toHaveBeenCalled()
  })
})
