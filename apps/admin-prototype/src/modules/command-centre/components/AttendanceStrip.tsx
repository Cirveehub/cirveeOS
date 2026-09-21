/**
 * A month of clock-ins as one strip.
 *
 * Colour alone never carries the state: every cell has an accessible name that
 * reads the date and the state, and the strip is followed by a legend in
 * words. The tinted cells use the `*-fill` / `*-ink` / `*-line` triple, which
 * is the set that inverts correctly in the dark theme.
 */

import type { AttendanceEvent, AttendanceState } from '@/mocks'
import { humanize } from '@/lib/format'
import { cn } from '@/lib/cn'

const CELL: Record<AttendanceState, string> = {
  present: 'bg-success-fill text-success-ink border-success-line',
  remote_approved: 'bg-info-fill text-info-ink border-info-line',
  late: 'bg-warning-fill text-warning-ink border-warning-line',
  early_departure: 'bg-warning-fill text-warning-ink border-warning-line',
  missing_clock_out: 'bg-warning-fill text-warning-ink border-warning-line',
  absent: 'bg-danger-fill text-danger-ink border-danger-line',
  approved_leave: 'bg-surface-sunken text-text-secondary border-border',
  excused: 'bg-surface-sunken text-text-secondary border-border',
  holiday: 'bg-surface-sunken text-text-muted border-border',
  off_day: 'bg-surface-sunken text-text-muted border-border',
}

const LEGEND: Array<{ state: AttendanceState; label: string }> = [
  { state: 'present', label: 'Present' },
  { state: 'late', label: 'Late' },
  { state: 'remote_approved', label: 'Remote' },
  { state: 'absent', label: 'Absent' },
  { state: 'off_day', label: 'Off day' },
]

export function AttendanceStrip({ events }: { events: AttendanceEvent[] }) {
  const ordered = [...events].sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div>
      <ol className="flex flex-wrap gap-1">
        {ordered.map((event) => (
          <li key={event.id}>
            <span
              className={cn(
                'grid size-7 place-items-center rounded-md border text-body-12 font-semibold tabular-nums',
                CELL[event.state],
              )}
              title={`${event.date} — ${humanize(event.state)}`}
            >
              <span aria-hidden="true">{Number(event.date.slice(8, 10))}</span>
              <span className="sr-only">{`${event.date}, ${humanize(event.state)}`}</span>
            </span>
          </li>
        ))}
      </ol>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {LEGEND.map((item) => (
          <li key={item.state} className="flex items-center gap-1.5 text-body-12 text-text-secondary">
            <span
              aria-hidden="true"
              className={cn('size-3 shrink-0 rounded-sm border', CELL[item.state])}
            />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
