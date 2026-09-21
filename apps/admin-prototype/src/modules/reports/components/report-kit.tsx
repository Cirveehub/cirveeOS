import type { ReactNode } from 'react'

import { Card, CardHeader } from '@/ui'
import { cn } from '@/lib/cn'
import type { BusinessUnit } from '@/app/module-registry'

export const UNIT_COLOUR: Record<BusinessUnit, string> = {
  academy: 'var(--color-accent)',
  teens: 'var(--color-teal-700)',
  corporate: 'var(--color-info-600)',
  dexurb: 'var(--color-warning-600)',
  africa: 'var(--color-success-600)',
  tcf: 'var(--color-ui-500)',
}

export const SERIES_COLOUR = [
  'var(--color-accent)',
  'var(--color-info-600)',
  'var(--color-teal-700)',
  'var(--color-warning-600)',
  'var(--color-success-600)',
  'var(--color-ui-500)',
] as const

export const POSITIVE = 'var(--color-success-600)'
export const NEGATIVE = 'var(--color-danger-600)'

export const AXIS = {
  stroke: 'var(--color-border)',
  tick: { fill: 'var(--color-text-muted)', fontSize: 11 },
} as const

export function ChartCard({
  title,
  description,
  actions,
  footer,
  height = 260,
  children,
  className,
}: {
  title: string
  description?: string
  actions?: ReactNode
  footer?: ReactNode
  height?: number
  children: ReactNode
  className?: string
}) {
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title={title} description={description} actions={actions} />
      <div className="px-3 pt-4" style={{ height }}>
        {children}
      </div>
      {footer && <div className="px-6 pb-5 pt-3">{footer}</div>}
    </Card>
  )
}

export function ChartLegend({ keys }: { keys: Array<{ label: string; colour: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {keys.map((key) => (
        <li key={key.label} className="flex items-center gap-1.5 text-body-12 text-text-secondary">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: key.colour }}
          />
          {key.label}
        </li>
      ))}
    </ul>
  )
}

interface TooltipDatum {
  name?: string | number
  value?: string | number
  color?: string
  dataKey?: string | number
}

export function ChartTooltip({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean
  payload?: readonly TooltipDatum[]
  label?: string | number
  format?: (value: number) => string
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="min-w-44 rounded-xl border border-border bg-surface p-3 shadow-md">
      {label !== undefined && <p className="mb-2 text-label-11 text-text-muted">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((row, index) => (
          <li key={`${String(row.dataKey)}-${index}`} className="flex items-center gap-2 text-body-13">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <span className="text-text-secondary">{String(row.name ?? row.dataKey)}</span>
            <span className="ml-auto font-semibold text-text tabular-nums">
              {format ? format(Number(row.value)) : String(row.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HeadlineStrip({
  items,
}: {
  items: Array<{ label: string; value: string; hint?: string }>
}) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border bg-surface p-5">
          <dt className="text-label-11 text-text-muted">{item.label}</dt>
          <dd className="mt-2 text-display-32 text-text tabular-nums">{item.value}</dd>
          {item.hint && <p className="mt-2 text-body-13 text-text-secondary">{item.hint}</p>}
        </div>
      ))}
    </dl>
  )
}
