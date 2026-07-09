import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { CalendarPage } from './features/calendar/CalendarPage'
import { EntryPage } from './features/entry/EntryPage'
import { NotesPage } from './features/notes/NotesPage'
import { SearchPage } from './features/search/SearchPage'
import { SettingsPage } from './features/settings/SettingsPage'
import { PassphraseGate } from './features/settings/PassphraseGate'

/**
 * Uses HashRouter rather than BrowserRouter: the app is served as a static
 * PWA bundle (no server-side routing), and hash-based URLs are guaranteed
 * to work identically whether installed to a home screen, opened offline
 * from cache, or hosted on any static file host.
 */
function App() {
  return (
    <PassphraseGate>
      <HashRouter>
        <div className="min-h-dvh bg-surface-0 pb-20">
          <Routes>
            <Route path="/" element={<CalendarPage />} />
            <Route path="/day/:date" element={<EntryPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <BottomNav />
        </div>
      </HashRouter>
    </PassphraseGate>
  )
}

export default App
