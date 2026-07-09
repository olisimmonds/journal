import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { upsertEntry } from '../../db/entries.repo'
import { buildBackupData } from '../../sync/backupSerializer'
import { importFromJson } from './importJson'

beforeEach(async () => {
  await db.entries.clear()
  await db.images.clear()
  await db.notes.clear()
  await db.tombstones.clear()
})

function jsonFile(contents: unknown): File {
  return new File([JSON.stringify(contents)], 'backup.json', { type: 'application/json' })
}

describe('importFromJson', () => {
  it('merges entries from a valid exported backup', async () => {
    await upsertEntry('2026-07-09', { title: 'Original', body: 'x' })
    const backup = await buildBackupData()
    await db.entries.clear()

    const result = await importFromJson(jsonFile(backup))

    expect(result.mergedEntries).toBe(1)
    expect((await db.entries.get('2026-07-09'))?.title).toBe('Original')
  })

  it('rejects a file that is not valid JSON', async () => {
    const badFile = new File(['not json'], 'backup.json', { type: 'application/json' })
    await expect(importFromJson(badFile)).rejects.toThrow('not valid JSON')
  })

  it('rejects JSON that does not look like a Journal export', async () => {
    await expect(importFromJson(jsonFile({ foo: 'bar' }))).rejects.toThrow('does not look like')
  })
})
