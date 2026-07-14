import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { ChevronLeftIcon, ChevronRightIcon } from '../../components/icons'
import {
  addDays,
  addMonths,
  addYears,
  formatMonthLabel,
  formatWeekLabel,
  getMonthGridDateIdBounds,
  getWeekDateIdBounds,
  getYearDateIdBounds,
  isValidDateId,
  parseDateId,
  toDateId,
  todayDateId,
  type ZoomLevel,
} from '../../utils/date'
import { MonthView } from './MonthView'
import { WeekView } from './WeekView'
import { YearView } from './YearView'
import { ZoomSwitcher } from './ZoomSwitcher'
import { useEntrySummaries } from './useCalendarEntries'

/**
 * Home page: the calendar, at one of three zoom levels (year / month / week),
 * with a day's entry as the innermost level.
 *
 * Zoom level and an *anchor date* live in the URL query (`?z=week&d=2026-07-14`,
 * defaulting to the current month) rather than component state, so that the
 * back button restores where you were, and returning from an entry lands you
 * back on the view you opened it from.
 *
 * Every level renders the period containing the anchor, and zooming keeps the
 * anchor fixed — so moving between levels never loses your place, and jumping
 * from "July" to "Week" lands on the week you were already looking at.
 */
export function CalendarPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const zoom = parseZoom(searchParams.get('z'))
  const anchorParam = searchParams.get('d')
  const anchorId = isValidDateId(anchorParam) ? anchorParam : todayDateId()
  const anchor = useMemo(() => parseDateId(anchorId), [anchorId])
  const todayId = todayDateId()

  const [rangeStart, rangeEnd] = useMemo(() => {
    if (zoom === 'year') return getYearDateIdBounds(anchor.getFullYear())
    if (zoom === 'week') return getWeekDateIdBounds(anchor)
    return getMonthGridDateIdBounds(anchor.getFullYear(), anchor.getMonth())
  }, [zoom, anchor])

  const summaries = useEntrySummaries(rangeStart, rangeEnd)

  /**
   * Date navigation replaces history while zooming pushes it, so that `back`
   * consistently means "zoom back out" rather than replaying every month the
   * user paged through.
   */
  const show = (nextZoom: ZoomLevel, nextAnchor: Date, replace: boolean) => {
    setSearchParams({ z: nextZoom, d: toDateId(nextAnchor) }, { replace })
  }

  const step = (direction: 1 | -1) => {
    if (zoom === 'year') return show(zoom, addYears(anchor, direction), true)
    if (zoom === 'week') return show(zoom, addDays(anchor, direction * 7), true)
    return show(zoom, addMonths(anchor, direction), true)
  }

  const handleSelectMonth = (year: number, month: number) => {
    // Land on today when zooming into the current month, so a following jump
    // to Week shows the current week rather than the month's first week.
    const today = parseDateId(todayId)
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
    show('month', isCurrentMonth ? today : new Date(year, month, 1), false)
  }

  const handleSelectDay = (dateId: string) => {
    navigate(`/day/${dateId}`, { state: { from: `${location.pathname}${location.search}` } })
  }

  return (
    <div className="safe-top mx-auto max-w-2xl px-4 pt-6">
      <header className="mb-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h1 className="truncate text-xl font-semibold text-ink-primary">{title(zoom, anchor)}</h1>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              className="px-2"
              onClick={() => step(-1)}
              aria-label={`Previous ${zoom}`}
            >
              <ChevronLeftIcon />
            </Button>
            <Button variant="ghost" onClick={() => show(zoom, parseDateId(todayId), true)}>
              Today
            </Button>
            <Button
              variant="ghost"
              className="px-2"
              onClick={() => step(1)}
              aria-label={`Next ${zoom}`}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>

        <ZoomSwitcher value={zoom} onChange={(next) => show(next, anchor, false)} />
      </header>

      {zoom === 'year' && (
        <YearView
          year={anchor.getFullYear()}
          summaries={summaries}
          todayId={todayId}
          onSelectMonth={handleSelectMonth}
        />
      )}
      {zoom === 'month' && (
        <MonthView
          year={anchor.getFullYear()}
          month={anchor.getMonth()}
          summaries={summaries}
          todayId={todayId}
          onSelectDay={handleSelectDay}
        />
      )}
      {zoom === 'week' && (
        <WeekView
          anchor={anchor}
          summaries={summaries}
          todayId={todayId}
          onSelectDay={handleSelectDay}
        />
      )}
    </div>
  )
}

function parseZoom(value: string | null): ZoomLevel {
  return value === 'year' || value === 'week' ? value : 'month'
}

function title(zoom: ZoomLevel, anchor: Date): string {
  if (zoom === 'year') return String(anchor.getFullYear())
  if (zoom === 'week') return formatWeekLabel(anchor)
  return formatMonthLabel(anchor.getFullYear(), anchor.getMonth())
}
