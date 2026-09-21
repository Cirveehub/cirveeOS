import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface Series {
  key: string
  label: string
  className: string
}

export interface StackedRow {
  label: string
  values: Record<string, number>
  total: number
  href?: string
  onClick?: () => void
}

export function ChartLegend({ series, className }: { series: Series[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-body-12 text-text-secondary">
          <span aria-hidden="true" className={cn('size-2.5 rounded-sm', s.className)} />
          {s.label}
        </li>
      ))}
    </ul>
  )
}

export function StackedBars({
  rows,
  series,
  emptyMessage,
  valueLabel,
}: {
  rows: StackedRow[]
  series: Series[]
  emptyMessage: string
  valueLabel?: (row: StackedRow) => ReactNode
}) {
  const max = Math.max(1, ...rows.map((r) => r.total))

  if (rows.length === 0) {
    return <p className="text-body-13 text-text-secondary">{emptyMessage}</p>
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label} className="grid grid-cols-[9.5rem_1fr_auto] items-center gap-3">
          <span className="truncate text-body-13 text-text-label" title={row.label}>
            {row.label}
          </span>
          <span className="flex h-3 items-stretch gap-[2px] overflow-hidden rounded-sm bg-surface-sunken">
            {series.map((s) => {
              const value = row.values[s.key] ?? 0
              if (value <= 0) return null
              return (
                <span
                  key={s.key}
                  className={cn('first:rounded-l-sm last:rounded-r-sm', s.className)}
                  style={{ width: `${(value / max) * 100}%` }}
                  title={`${row.label} · ${s.label}: ${value}`}
                />
              )
            })}
          </span>
          <span className="text-body-13 tabular-nums text-text-secondary">
            {valueLabel ? valueLabel(row) : row.total}
          </span>
        </div>
      ))}
    </div>
  )
}

export interface Bucket {
  label: string
  value: number
  alarming?: boolean
}

export function BucketBars({ buckets, caption }: { buckets: Bucket[]; caption: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.value))

  return (
    <div>
      <div className="flex items-end gap-3" role="img" aria-label={caption}>
        {buckets.map((bucket) => (
          <div key={bucket.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-body-13 tabular-nums text-text">{bucket.value}</span>
            <span
              className={cn(
                'w-full rounded-t-sm',
                bucket.alarming ? 'bg-danger-500' : 'bg-accent',
              )}
              style={{ height: `${Math.max(4, (bucket.value / max) * 96)}px` }}
            />
            <span className="w-full truncate text-center text-body-12 text-text-secondary" title={bucket.label}>
              {bucket.label}
            </span>
          </div>
        ))}
      </div>
      <p className="sr-only">{caption}</p>
    </div>
  )
}
