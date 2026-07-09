import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { exportAsJson } from './exportJson'
import { importFromJson } from './importJson'

/**
 * Markdown export (JSZip) and PDF export (jsPDF, which pulls in a sizeable
 * html2canvas dependency) are dynamically imported so they never inflate
 * the app's initial load bundle — most sessions never touch them.
 */
const loadMarkdownExporter = () => import('./exportMarkdown').then((m) => m.exportAsMarkdown)
const loadPdfExporter = () => import('./exportPdf').then((m) => m.exportAsPdf)

type Task = 'export-json' | 'import-json' | 'export-markdown' | 'export-pdf' | null

/** Settings section: full-data export/import so users can always migrate away. */
export function ExportSection() {
  const [runningTask, setRunningTask] = useState<Task>(null)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const runTask = async (task: Exclude<Task, null>, action: () => Promise<void>) => {
    setRunningTask(task)
    setMessage(null)
    try {
      await action()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setRunningTask(null)
    }
  }

  const handleImportFile = (file: File) =>
    runTask('import-json', async () => {
      const result = await importFromJson(file)
      setMessage(`Imported ${result.mergedEntries} entries and ${result.mergedNotes} notes.`)
    })

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-xs font-medium tracking-wide text-ink-tertiary uppercase">
        Backup & export
      </h2>
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-1 p-4">
        <p className="text-sm text-ink-secondary">
          You can always take your data with you. JSON is the complete, re-importable backup;
          Markdown and PDF are for reading or archiving elsewhere.
        </p>

        {message && <p className="text-sm text-ink-secondary">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            disabled={runningTask !== null}
            onClick={() => runTask('export-json', exportAsJson)}
          >
            {runningTask === 'export-json' ? 'Exporting…' : 'Export JSON'}
          </Button>

          <Button
            variant="secondary"
            disabled={runningTask !== null}
            onClick={() => fileInputRef.current?.click()}
          >
            {runningTask === 'import-json' ? 'Importing…' : 'Import JSON'}
          </Button>

          <Button
            variant="secondary"
            disabled={runningTask !== null}
            onClick={() => runTask('export-markdown', async () => (await loadMarkdownExporter())())}
          >
            {runningTask === 'export-markdown' ? 'Exporting…' : 'Export Markdown'}
          </Button>

          <Button
            variant="secondary"
            disabled={runningTask !== null}
            onClick={() => runTask('export-pdf', async () => (await loadPdfExporter())())}
          >
            {runningTask === 'export-pdf' ? 'Exporting…' : 'Export PDF'}
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleImportFile(file)
            event.target.value = ''
          }}
        />
      </div>
    </section>
  )
}
