interface FitnessWidgetsProps {
  gym: boolean
  vigorousMinutes: number
  onGymChange: (gym: boolean) => void
  onVigorousMinutesChange: (minutes: number) => void
}

/**
 * Minimal daily health trackers, tucked under the day's writing so they stay
 * out of the way while typing. They log the two inputs the NHS weekly targets
 * care about: a gym session (yes/no) and minutes of vigorous activity. The
 * month view's week indicators are computed from these on the same day.
 */
export function FitnessWidgets({
  gym,
  vigorousMinutes,
  onGymChange,
  onVigorousMinutesChange,
}: FitnessWidgetsProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => onGymChange(!gym)}
        aria-pressed={gym}
        aria-label={gym ? 'Gym done today' : 'Gym not done today'}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors duration-150 ${
          gym
            ? 'border-success/40 bg-success/10 text-success'
            : 'border-border text-ink-secondary hover:bg-surface-2'
        }`}
      >
        <span className="size-2 rounded-full bg-current" aria-hidden="true" />
        Gym
        <span className={gym ? 'font-medium' : 'text-ink-tertiary'}>{gym ? 'done' : 'not yet'}</span>
      </button>

      <label className="flex items-center gap-2 text-sm text-ink-tertiary">
        <span>Vigorous activity</span>
        <input
          type="number"
          min={0}
          step={5}
          inputMode="numeric"
          value={vigorousMinutes > 0 ? vigorousMinutes : ''}
          onChange={(e) => {
            const raw = Number(e.target.value)
            const minutes = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
            onVigorousMinutesChange(minutes)
          }}
          placeholder="min"
          aria-label="Minutes of vigorous activity today"
          className="w-16 min-h-8 rounded-lg border border-border bg-surface-2 px-2 text-center text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-ink-secondary"
        />
      </label>
    </div>
  )
}