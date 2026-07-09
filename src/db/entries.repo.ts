import { db } from './schema'
import type { ImageAttachment, JournalEntry } from './types'

/** Data access layer for journal entries and their images. */

export async function getEntry(dateId: string): Promise<JournalEntry | undefined> {
  return db.entries.get(dateId)
}

/**
 * Creates or updates the entry for a given date. Callers pass only the
 * fields the user edited; `createdAt` is preserved on update and `updatedAt`
 * is always refreshed so sync can detect the change.
 */
export async function upsertEntry(
  dateId: string,
  fields: { title?: string; body?: string },
): Promise<JournalEntry> {
  const now = Date.now()
  const existing = await db.entries.get(dateId)

  const next: JournalEntry = {
    id: dateId,
    title: fields.title ?? existing?.title ?? '',
    body: fields.body ?? existing?.body ?? '',
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.entries.put(next)
  return next
}

/**
 * Deletes an entry and all of its images, and records a tombstone so a
 * stale Google Drive backup never resurrects it on the next sync.
 */
export async function deleteEntry(dateId: string): Promise<void> {
  await db.transaction('rw', db.entries, db.images, db.tombstones, async () => {
    await db.images.where('entryId').equals(dateId).delete()
    await db.entries.delete(dateId)
    await db.tombstones.put({ id: dateId, type: 'entry', deletedAt: Date.now() })
  })
}

/** Inclusive range query, used by the monthly calendar view. */
export async function listEntriesInRange(
  startDateId: string,
  endDateId: string,
): Promise<JournalEntry[]> {
  return db.entries.where('id').between(startDateId, endDateId, true, true).toArray()
}

/** All entries, sorted by date. Used by search and full-data export. */
export async function listAllEntries(): Promise<JournalEntry[]> {
  return db.entries.orderBy('id').toArray()
}

export async function listImagesForEntry(entryId: string): Promise<ImageAttachment[]> {
  const images = await db.images.where('entryId').equals(entryId).toArray()
  return images.sort((a, b) => a.order - b.order)
}

export async function addImageToEntry(
  entryId: string,
  blob: Blob,
  mimeType: string,
): Promise<ImageAttachment> {
  const existingCount = await db.images.where('entryId').equals(entryId).count()

  const image: ImageAttachment = {
    id: crypto.randomUUID(),
    entryId,
    blob,
    mimeType,
    order: existingCount,
    createdAt: Date.now(),
  }

  await db.images.add(image)
  // Touch the parent entry so its updatedAt reflects the image change for sync purposes.
  await db.entries.update(entryId, { updatedAt: Date.now() })

  return image
}

export async function removeImage(imageId: string): Promise<void> {
  const image = await db.images.get(imageId)
  if (!image) return

  await db.images.delete(imageId)
  await db.entries.update(image.entryId, { updatedAt: Date.now() })
}

/** All images across every entry. Used by full-data export/import only. */
export async function listAllImages(): Promise<ImageAttachment[]> {
  return db.images.toArray()
}
