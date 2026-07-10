import { NavLink } from 'react-router-dom'
import { CalendarIcon, NotesIcon, SearchIcon } from './icons'

const NAV_ITEMS = [
  { to: '/', label: 'Calendar', icon: CalendarIcon, end: true },
  { to: '/notes', label: 'Notes', icon: NotesIcon, end: false },
  { to: '/search', label: 'Search', icon: SearchIcon, end: false },
]

/** Fixed bottom tab bar — the app's primary navigation on every screen size. */
export function BottomNav() {
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface-1/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-w-16 flex-1 flex-col items-center gap-1 py-2.5 text-xs transition-colors duration-150 ${
                isActive ? 'text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary'
              }`
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
