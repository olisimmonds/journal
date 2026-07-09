import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { SearchIcon } from '../../components/icons'
import { formatFullDate } from '../../utils/date'
import { searchEntries } from './searchIndex'

/** Full-text search across every journal entry. */
export function SearchPage() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const results = useLiveQuery(() => searchEntries(query), [query])

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-primary">Search</h1>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3">
        <SearchIcon width={18} height={18} className="shrink-0 text-ink-tertiary" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your journal…"
          className="min-h-11 w-full bg-transparent text-ink-primary placeholder:text-ink-tertiary focus:outline-none"
        />
      </div>

      {query.trim() === '' ? (
        <EmptyState
          title="Search your journal"
          description="Find any word or phrase across every entry you've written."
        />
      ) : results?.length === 0 ? (
        <EmptyState title="No matches" description={`Nothing found for "${query}".`} />
      ) : (
        <div className="flex flex-col gap-2 pb-10 animate-fade-in">
          {results?.map(({ entry, snippet }) => (
            <button
              key={entry.id}
              onClick={() => navigate(`/day/${entry.id}`)}
              className="flex flex-col gap-1 rounded-xl border border-border bg-surface-1 p-3 text-left transition-colors duration-150 hover:bg-surface-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-ink-primary">
                  {entry.title || formatFullDate(entry.id)}
                </span>
                <span className="shrink-0 text-xs text-ink-tertiary">{entry.id}</span>
              </div>
              <p className="text-sm text-ink-secondary">{snippet}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
