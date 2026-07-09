import { listAllEntries } from '../../db/entries.repo'
import type { JournalEntry } from '../../db/types'

export interface SearchResult {
  entry: JournalEntry
  /** A short excerpt of the body around the first match, for context. */
  snippet: string
}

const SNIPPET_RADIUS = 60

/**
 * Full-text search across all journal entries. A personal journal's entry
 * count is small enough (thousands of days, at most) that a client-side
 * substring scan is simpler and just as fast as building a persisted index.
 */
export async function searchEntries(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim()
  if (trimmed === '') return []

  const needle = trimmed.toLowerCase()
  const entries = await listAllEntries()

  const results: SearchResult[] = []
  for (const entry of entries) {
    const haystack = `${entry.title}\n${entry.body}`
    const matchIndex = haystack.toLowerCase().indexOf(needle)
    if (matchIndex === -1) continue

    results.push({ entry, snippet: buildSnippet(haystack, matchIndex, needle.length) })
  }

  // Most recent matches first.
  return results.sort((a, b) => (a.entry.id < b.entry.id ? 1 : -1))
}

function buildSnippet(text: string, matchIndex: number, matchLength: number): string {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS)
  const end = Math.min(text.length, matchIndex + matchLength + SNIPPET_RADIUS)

  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''

  return `${prefix}${text.slice(start, end).replace(/\n+/g, ' ')}${suffix}`
}
