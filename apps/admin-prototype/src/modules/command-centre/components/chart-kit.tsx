/**
 * The chart frame.
 *
 * `@/ui` has no chart primitive, so the shared pieces live here: the palette,
 * the axis styling and the tooltip. Everything resolves to a design-system CSS
 * variable rather than a literal colour, which is also what gives the charts a
 * dark theme for free — `--color-accent` is a different purple under
 * `[data-theme="dark"]`, and the bars follow it.
 *
 * If a second module needs charts, this file is the thing to lift into
 * `src/ui/` and into the kitchen sink.
 */

import type { ReactNode } from 'react'

import { Card, CardHeader } from '@/ui'
import { cn } from '@/lib/cn'
import type { BusinessUnit } from '@/app/module-registry'

/** Matches `UNIT_META`'s dot colours, so a unit is the same colour everywhere. */
export const UNIT_COLOUR: Record<BusinessUnit, string> = {
  academy: 'var(--color-accent)',
  teens: 'var(--color-teal-700)',
  corporate: 'var(--color-info-600)',
  dexurb: 'var(--color-warning-600)',
  africa: 'var(--color-success-600)',
  tcf: 'var(--color-ui-500)',
}

/** Three branches, three tones that stay apart in both themes. */
export const BRANCH_COLOUR = [
  'var(--color-accent)',
  'var(--color-info-600)',
  'var(--color-teal-700)',
] as const

export const AXIS = {
  stroke: 'var(--color-border)',
  tick: { fill: 'var(--color-text-muted)', fontSize: 11 },
} as const

export interface ChartCardProps {
  title: string
  description?: string
  actions?: ReactNode
  /** Rendered under the chart — a legend, a caption, a total. */
  footer?: ReactNode
  height?: number
  children: ReactNode
  className?: string
}

export function ChartCard({
  title,
  description,
  actions,
  footer,
  height = 260,
  children,
  className,
}: ChartCardProps) {
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

export interface LegendKey {
  label: string
  colour: string
}

export function ChartLegend({ keys }: { keys: LegendKey[] }) {
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

export interface ChartTooltipProps {
  active?: boolean
  payload?: readonly TooltipDatum[]
  label?: string | number
  /** Turns a raw series value into display text — `formatNaira`, usually. */
  format?: (value: number) => string
  /** Appended under the rows — a total, a conversion note. */
  caption?: string
}

export function ChartTooltip({ active, payload, label, format, caption }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const rows = payload.filter((row) => Number(row.value) !== 0)
  if (rows.length === 0) return null

  return (
    <div className="min-w-44 rounded-xl border border-border bg-surface p-3 shadow-md">
      {label !== undefined && (
        <p className="mb-2 text-label-11 text-text-muted">{String(label)}</p>
      )}
      <ul className="space-y-1">
        {rows.map((row, index) => (
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
      {caption && <p className="mt-2 border-t border-border pt-2 text-body-12 text-text-muted">{caption}</p>}
    </div>
  )
}
