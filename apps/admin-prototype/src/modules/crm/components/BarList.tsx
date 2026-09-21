/**
 * A horizontal bar row that doubles as a filter link.
 *
 * Every chart on the CRM dashboard is a way into `/crm/leads`, per §2.1, so
 * the bar and its label are one link rather than a chart with a legend nobody
 * can click.
 */

import { Link } from 'react-router-dom'
import { ProgressBar, type ProgressTone } from '@/ui'
import { formatNumber, formatPercent } from '@/lib/format'

export interface BarRow {
  key: string
  label: string
  value: number
  /** Second figure shown to the right — conversion, usually. */
  secondary?: number | null
  secondaryLabel?: string
  tone?: ProgressTone
  to?: string
}

export interface BarListProps {
  rows: BarRow[]
  /** Denominator for the bar width. Defaults to the largest row. */
  max?: number
  emptyMessage: string
}

export function BarList({ rows, max, emptyMessage }: BarListProps) {
  if (!rows.length) {
    return <p className="py-6 text-center text-body-13 text-text-secondary">{emptyMessage}</p>
  }

  const ceiling = max ?? Math.max(...rows.map((r) => r.value), 1)

  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((row) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body-13 text-text">{row.label}</span>
              <span className="shrink-0 text-body-13 tabular-nums text-text-secondary">
                {formatNumber(row.value)}
                {row.secondary !== null && row.secondary !== undefined && (
                  <span className="ml-2 text-text-muted">
                    {formatPercent(row.secondary)} {row.secondaryLabel ?? 'conversion'}
                  </span>
                )}
              </span>
            </div>
            <ProgressBar
              value={row.value}
              max={ceiling}
              tone={row.tone ?? 'accent'}
              size="sm"
              aria-label={`${row.label}: ${formatNumber(row.value)}`}
              className="mt-1"
            />
          </>
        )

        return (
          <li key={row.key}>
            {row.to ? (
              <Link
                to={row.to}
                className="block rounded-lg px-1 py-1 transition-colors hover:bg-surface-hover"
              >
                {body}
              </Link>
            ) : (
              <div className="px-1 py-1">{body}</div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
