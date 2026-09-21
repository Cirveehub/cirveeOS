import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatDelta } from '@/lib/format'
import { Skeleton } from './Skeleton'

export type StatCardVariant = 'default' | 'success' | 'warning' | 'danger'
export type DeltaTone = 'auto' | 'positive' | 'negative' | 'neutral'

export interface StatCardDelta {
  /** Percentage change. Sign sets the arrow unless `direction` is given. */
  value: number
  direction?: 'up' | 'down' | 'flat'
  /** "vs last month" */
  label?: string
  /**
   * `auto` reads up as good. Set `negative` on metrics where rising is bad —
   * refund rate, churn, days-to-collect.
   */
  tone?: DeltaTone
}

export interface StatCardProps {
  label: string
  value: ReactNode
  /** Small print under the value. */
  caption?: ReactNode
  delta?: StatCardDelta
  icon?: LucideIcon
  variant?: StatCardVariant
  /** Values for the inline sparkline. Two or more points. */
  sparkline?: number[]
  loading?: boolean
  onClick?: () => void
  className?: string
}

/*
 * The source's StatsCard gave `warning` and `danger` the same fill. These four
 * are pulled apart on three axes at once: chip tint, sparkline hue and the
 * hairline above the value.
 */
const CHIP: Record<StatCardVariant, string> = {
  default: 'bg-accent-subtle text-accent',
  success: 'bg-success-fill text-success-ink',
  warning: 'bg-warning-fill text-warning-ink',
  danger: 'bg-danger-fill text-danger-ink',
}

const SPARK: Record<StatCardVariant, string> = {
  default: 'text-accent',
  success: 'text-success-text',
  warning: 'text-warning-500',
  danger: 'text-danger-500',
}

const RULE: Record<StatCardVariant, string> = {
  default: 'bg-accent-subtle',
  success: 'bg-success-line',
  warning: 'bg-warning-line',
  danger: 'bg-danger-line',
}

const DELTA_CLASS = {
  positive: 'text-success-text',
  negative: 'text-danger-text',
  neutral: 'text-text-secondary',
} as const

function resolveDelta(delta: StatCardDelta) {
  const direction = delta.direction ?? (delta.value > 0 ? 'up' : delta.value < 0 ? 'down' : 'flat')
  const tone = delta.tone ?? 'auto'

  let key: keyof typeof DELTA_CLASS
  if (tone === 'auto') {
    key = direction === 'flat' ? 'neutral' : direction === 'up' ? 'positive' : 'negative'
  } else {
    key = tone
  }

  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  return { direction, Icon, className: DELTA_CLASS[key] }
}

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  if (values.length < 2) return null

  const width = 104
  const height = 30
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - 2 - ((value - min) / range) * (height - 6)
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const line = `M${points.join(' L')}`
  const area = `${line} L${width},${height} L0,${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn('h-8 w-26 shrink-0 overflow-visible', className)}
    >
      <path d={area} fill="currentColor" opacity={0.12} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export function StatCard({
  label,
  value,
  caption,
  delta,
  icon: Icon,
  variant = 'default',
  sparkline,
  loading = false,
  onClick,
  className,
}: StatCardProps) {
  if (loading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label={`Loading ${label}`}
        className={cn('rounded-xl border border-border bg-surface p-5', className)}
      >
        <div className="flex items-start justify-between gap-4">
          <Skeleton width={96} height={11} />
          <Skeleton width={36} height={36} rounded="lg" />
        </div>
        <Skeleton width={136} height={34} className="mt-4" />
        <Skeleton width={84} height={11} className="mt-3.5" />
      </div>
    )
  }

  const resolved = delta ? resolveDelta(delta) : null

  const shell = cn(
    'block w-full rounded-xl border border-border bg-surface p-5 text-left',
    onClick && 'transition-shadow duration-150 hover:shadow-md',
    className,
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-4">
        <p className="text-label-11 text-text-muted">{label}</p>
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', CHIP[variant])}>
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-display-32 text-text tabular-nums">{value}</p>
        {sparkline && sparkline.length > 1 && (
          <Sparkline values={sparkline} className={SPARK[variant]} />
        )}
      </div>

      {(resolved || caption) && (
        <>
          <div aria-hidden="true" className={cn('mt-3.5 h-px w-full', RULE[variant])} />
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            {resolved && delta && (
              <span className={cn('inline-flex items-center gap-0.5 text-body-13 font-semibold tabular-nums', resolved.className)}>
                <resolved.Icon size={14} aria-hidden="true" />
                {formatDelta(delta.value)}
              </span>
            )}
            {delta?.label && <span className="text-body-13 text-text-secondary">{delta.label}</span>}
            {caption && <span className="text-body-13 text-text-secondary">{caption}</span>}
          </div>
        </>
      )}
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {body}
      </button>
    )
  }

  return <div className={shell}>{body}</div>
}
