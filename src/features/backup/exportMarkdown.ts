import JSZip from 'jszip'
import { db } from '../../db/schema'
import type { ImageAttachment, JournalEntry, Note } from '../../db/types'
import { downloadBlob } from '../../utils/download'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? 'bin'
}

function entryToMarkdown(entry: JournalEntry, images: ImageAttachment[]): string {
  const lines = [`# ${entry.title || entry.id}`, '', `_${entry.id}_`, '']

  if (entry.body.trim()) {
    lines.push(entry.body, '')
  }

  for (const image of images) {
    lines.push(`![](../images/${image.id}.${extensionFor(image.mimeType)})`, '')
  }

  return lines.join('\n')
}

function noteToMarkdown(note: Note): string {
  const lines = [`## ${note.title || 'Untitled note'}`, '']

  if (note.body.trim()) {
    lines.push(note.body, '')
  }

  for (const item of note.checklist) {
    lines.push(`- [${item.done ? 'x' : ' '}] ${item.text}`)
  }

  return lines.join('\n')
}

/**
 * Exports the journal and notes as human-readable Markdown files, zipped
 * together with the original image files. Fully portable — no proprietary
 * format, readable in any text editor.
 */
export async function exportAsMarkdown(): Promise<void> {
  const [entries, notes] = await Promise.all([
    db.entries.orderBy('id').toArray(),
    db.notes.orderBy('order').toArray(),
  ])

  const zip = new JSZip()
  const entriesFolder = zip.folder('entries')!
  const imagesFolder = zip.folder('images')!

  for (const entry of entries) {
    if (!entry.title.trim() && !entry.body.trim()) continue

    const images = await db.images.where('entryId').equals(entry.id).toArray()
    entriesFolder.file(`${entry.id}.md`, entryToMarkdown(entry, images))

    for (const image of images) {
      imagesFolder.file(`${image.id}.${extensionFor(image.mimeType)}`, image.blob)
    }
  }

  if (notes.length > 0) {
    const notesMarkdown = ['# Notes', '', ...notes.map(noteToMarkdown)].join('\n')
    zip.file('notes.md', notesMarkdown)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(`journal-markdown-${new Date().toISOString().slice(0, 10)}.zip`, blob)
}
