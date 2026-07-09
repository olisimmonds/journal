import { beforeEach, describe, expect, it } from 'vitest'
import { deriveKeyFromPassphrase, generateSalt } from '../crypto/keyDerivation'
import { bufferToBase64 } from '../crypto/aesGcm'
import { db } from '../db/schema'
import { addImageToEntry, upsertEntry } from '../db/entries.repo'
import { createNote, updateNote } from '../db/notes.repo'
import { buildBackupData, decryptBackup, encryptBackup } from './backupSerializer'

beforeEach(async () => {
  await db.entries.clear()
  await db.images.clear()
  await db.notes.clear()
  await db.tombstones.clear()
})

describe('backup serializer', () => {
  it('round-trips entries, images, and notes through encrypt/decrypt', async () => {
    await upsertEntry('2026-07-09', { title: 'Hike', body: 'Great weather today.' })
    await addImageToEntry('2026-07-09', new Blob(['fake-image-bytes']), 'image/png')
    const note = await createNote()
    await updateNote(note.id, { title: 'Groceries', body: 'Milk, eggs' })

    const salt = generateSalt()
    const saltBase64 = bufferToBase64(salt)
    const key = await deriveKeyFromPassphrase('test passphrase', salt)

    const data = await buildBackupData()
    const envelope = await encryptBackup(data, key, saltBase64)

    expect(envelope.salt).toBe(saltBase64)

    const decrypted = await decryptBackup(envelope, key)

    expect(decrypted.entries).toHaveLength(1)
    expect(decrypted.entries[0].title).toBe('Hike')
    expect(decrypted.images).toHaveLength(1)
    expect(decrypted.images[0].mimeType).toBe('image/png')
    expect(decrypted.notes).toHaveLength(1)
    expect(decrypted.notes[0].title).toBe('Groceries')
  })

  it('fails to decrypt with a key derived from the wrong passphrase', async () => {
    await upsertEntry('2026-07-09', { body: 'secret' })

    const salt = generateSalt()
    const key = await deriveKeyFromPassphrase('right passphrase', salt)
    const wrongKey = await deriveKeyFromPassphrase('wrong passphrase', salt)

    const data = await buildBackupData()
    const envelope = await encryptBackup(data, key, bufferToBase64(salt))

    await expect(decryptBackup(envelope, wrongKey)).rejects.toThrow()
  })
})
