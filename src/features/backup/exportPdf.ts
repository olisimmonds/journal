import { jsPDF } from 'jspdf'
import { bufferToBase64 } from '../../crypto/aesGcm'
import { db } from '../../db/schema'
import { formatFullDate } from '../../utils/date'
import { downloadBlob } from '../../utils/download'

const PAGE_MARGIN = 15
const LINE_HEIGHT = 6

const JSPDF_FORMAT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WEBP',
}

/**
 * Exports the full journal as a single printable, human-readable PDF —
 * entry text and inline photos, one section per day. Intended as a
 * migration/archival format, not a pixel-perfect reproduction of the app.
 */
export async function exportAsPdf(): Promise<void> {
  const entries = await db.entries.orderBy('id').toArray()
  const nonEmptyEntries = entries.filter((e) => e.title.trim() || e.body.trim())

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PAGE_MARGIN * 2

  let cursorY = PAGE_MARGIN
  let isFirstEntry = true

  const ensureSpace = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - PAGE_MARGIN) {
      doc.addPage()
      cursorY = PAGE_MARGIN
    }
  }

  for (const entry of nonEmptyEntries) {
    if (!isFirstEntry) {
      doc.addPage()
      cursorY = PAGE_MARGIN
    }
    isFirstEntry = false

    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(entry.title || formatFullDate(entry.id), PAGE_MARGIN, cursorY)
    cursorY += LINE_HEIGHT

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(120)
    doc.text(formatFullDate(entry.id), PAGE_MARGIN, cursorY)
    doc.setTextColor(0)
    cursorY += LINE_HEIGHT * 1.5

    doc.setFontSize(11)
    const bodyLines: string[] = doc.splitTextToSize(entry.body, contentWidth)
    for (const line of bodyLines) {
      ensureSpace(LINE_HEIGHT)
      doc.text(line, PAGE_MARGIN, cursorY)
      cursorY += LINE_HEIGHT
    }

    const images = await db.images.where('entryId').equals(entry.id).toArray()
    for (const image of images) {
      const format = JSPDF_FORMAT_BY_MIME[image.mimeType]
      if (!format) continue // Skip formats jsPDF can't embed (e.g. GIF, SVG).

      const bytes = new Uint8Array(await image.blob.arrayBuffer())
      const dataUrl = `data:${image.mimeType};base64,${bufferToBase64(bytes)}`

      const bitmap = await createImageBitmap(image.blob)
      const imageWidth = contentWidth
      const imageHeight = (bitmap.height / bitmap.width) * imageWidth
      bitmap.close()

      cursorY += LINE_HEIGHT / 2
      ensureSpace(imageHeight)
      doc.addImage(dataUrl, format, PAGE_MARGIN, cursorY, imageWidth, imageHeight)
      cursorY += imageHeight + LINE_HEIGHT / 2
    }
  }

  if (nonEmptyEntries.length === 0) {
    doc.setFontSize(12)
    doc.text('No journal entries yet.', PAGE_MARGIN, cursorY)
  }

  downloadBlob(`journal-export-${new Date().toISOString().slice(0, 10)}.pdf`, doc.output('blob'))
}
