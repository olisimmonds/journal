import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '../../components/EmptyState'
import { CakeIcon, SearchIcon } from '../../components/icons'
import { formatFullDate } from '../../utils/date'
import { BirthdaysTab } from '../birthdays/BirthdaysTab'
import { searchEntries } from './searchIndex'

type SearchTab = 'search' | 'birthdays'

/** The Search tab (full-text over every entry) and the Birthdays tab (add
 *  yearless recurring dates shown as green dots on the calendar). Both are
 *  read/write surfaces with a shared header, mirroring how Keep groups its
 *  secondary navigation. */
export function SearchPage() {
  const [tab, setTab] = useState<SearchTab>('search')

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pt-6">
      <h1 className="mb-4 text-xl font-semibold text-ink-primary">Search</h1>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border bg-surface-1 p-1">
        <TabButton active={tab === 'search'} onClick={() => setTab('search')}>
          <SearchIcon width={16} height={16} />
          Search
        </TabButton>
        <TabButton active={tab === 'birthdays'} onClick={() => setTab('birthdays')}>
          <CakeIcon width={16} height={16} />
          Birthdays
        </TabButton>
      </div>

      {tab === 'search' ? <SearchTab /> : <BirthdaysTab />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors duration-150 ${
        active
          ? 'bg-surface-3 text-ink-primary'
          : 'text-ink-tertiary hover:text-ink-secondary'
      }`}
    >
      {children}
    </button>
  )
}

function SearchTab() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const results = useLiveQuery(() => searchEntries(query), [query])

  return (
    <div className="animate-fade-in">
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
        <div className="flex flex-col gap-2 pb-10">
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