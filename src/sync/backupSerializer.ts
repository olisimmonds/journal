import { base64ToBuffer, bufferToBase64 } from '../utils/base64'
import { db } from '../db/schema'
import type { Birthday, ImageAttachment, JournalEntry, Note, Tombstone } from '../db/types'

export const BACKUP_FORMAT_VERSION = 2

/** The full contents of the app — the shape stored for Drive backup and also
 *  produced verbatim by the plain-JSON export feature. */
export interface BackupData {
  version: typeof BACKUP_FORMAT_VERSION
  exportedAt: number
  entries: JournalEntry[]
  images: SerializedImage[]
  notes: Note[]
  birthdays: Birthday[]
  tombstones: Tombstone[]
}

export interface SerializedImage {
  id: string
  entryId: string
  mimeType: string
  order: number
  createdAt: number
  /** Base64-encoded image bytes. */
  base64: string
}

export async function buildBackupData(): Promise<BackupData> {
  const [entries, images, notes, birthdays, tombstones] = await Promise.all([
    db.entries.orderBy('id').toArray(),
    db.images.toArray(),
    db.notes.orderBy('order').toArray(),
    db.birthdays.toArray(),
    db.tombstones.toArray(),
  ])

  const serializedImages = await Promise.all(images.map(serializeImage))

  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    entries,
    images: serializedImages,
    notes,
    birthdays,
    tombstones,
  }
}

async function serializeImage(image: ImageAttachment): Promise<SerializedImage> {
  const bytes = new Uint8Array(await image.blob.arrayBuffer())
  return {
    id: image.id,
    entryId: image.entryId,
    mimeType: image.mimeType,
    order: image.order,
    createdAt: image.createdAt,
    base64: bufferToBase64(bytes),
  }
}

export function deserializeImage(image: SerializedImage): ImageAttachment {
  const bytes = base64ToBuffer(image.base64)
  return {
    id: image.id,
    entryId: image.entryId,
    mimeType: image.mimeType,
    order: image.order,
    createdAt: image.createdAt,
    blob: new Blob([bytes], { type: image.mimeType }),
  }
}
