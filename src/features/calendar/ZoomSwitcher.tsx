import type { ZoomLevel } from '../../utils/date'

const LEVELS: { value: ZoomLevel; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
]

interface ZoomSwitcherProps {
  value: ZoomLevel
  onChange: (level: ZoomLevel) => void
}

/**
 * Segmented control for the calendar's zoom level, ordered widest-to-narrowest
 * so moving right reads as zooming in (year -> month -> week -> a day's entry).
 */
export function ZoomSwitcher({ value, onChange }: ZoomSwitcherProps) {
  return (
    <div
      role="group"
      aria-label="Calendar zoom level"
      className="flex gap-0.5 rounded-xl border border-border bg-surface-1 p-0.5"
    >
      {LEVELS.map((level) => {
        const isActive = level.value === value
        return (
          <button
            key={level.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(level.value)}
            className={`min-h-9 flex-1 rounded-[10px] text-sm font-medium transition-colors duration-150 ${
              isActive
                ? 'bg-ink-primary text-surface-0'
                : 'text-ink-secondary hover:bg-surface-2 hover:text-ink-primary'
            }`}
          >
            {level.label}
          </button>
        )
      })}
    </div>
  )
}
