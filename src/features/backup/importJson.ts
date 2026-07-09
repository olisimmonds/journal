import type { BackupData } from '../../sync/backupSerializer'
import { mergeRemoteIntoLocal } from '../../sync/syncManager'

export interface ImportResult {
  mergedEntries: number
  mergedNotes: number
}

/**
 * Imports a previously exported JSON backup. Reuses the same
 * last-write-wins merge logic as Google Drive sync (`mergeRemoteIntoLocal`)
 * so importing a backup behaves identically to merging in data from
 * another device — existing local data newer than the import is kept.
 */
export async function importFromJson(file: File): Promise<ImportResult> {
  const text = await file.text()
  const data = parseBackupData(text)

  return mergeRemoteIntoLocal(data)
}

function parseBackupData(text: string): BackupData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as BackupData).entries) ||
    !Array.isArray((parsed as BackupData).notes) ||
    !Array.isArray((parsed as BackupData).images)
  ) {
    throw new Error('This file does not look like a Journal export.')
  }

  const data = parsed as BackupData
  return { ...data, tombstones: data.tombstones ?? [] }
}
