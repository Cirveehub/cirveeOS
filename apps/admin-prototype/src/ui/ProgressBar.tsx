import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type ProgressTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral'

export interface ProgressBarProps {
  value: number
  max?: number
  label?: ReactNode
  /** Right-hand caption — defaults to a percentage when `showValue` is set. */
  valueLabel?: ReactNode
  showValue?: boolean
  tone?: ProgressTone
  size?: 'sm' | 'md'
  /** Announced name when there is no visible `label`. */
  'aria-label'?: string
  className?: string
}

const TONES: Record<ProgressTone, string> = {
  accent: 'bg-accent',
  success: 'bg-success-600',
  warning: 'bg-warning-500',
  danger: 'bg-danger-600',
  neutral: 'bg-text-muted',
}

export function ProgressBar({
  value,
  max = 100,
  label,
  valueLabel,
  showValue = false,
  tone = 'accent',
  size = 'md',
  className,
  ...rest
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1
  const clamped = Math.min(Math.max(value, 0), safeMax)
  const percent = (clamped / safeMax) * 100
  const caption = valueLabel ?? (showValue ? `${Math.round(percent)}%` : null)

  return (
    <div className={cn('w-full', className)}>
      {(label || caption) && (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {label && <span className="text-body-13 text-text-label">{label}</span>}
          {caption && <span className="text-body-12 font-medium text-text-secondary tabular-nums">{caption}</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-label={rest['aria-label'] ?? (typeof label === 'string' ? label : undefined)}
        className={cn(
          'w-full overflow-hidden rounded-full bg-surface-sunken',
          size === 'sm' ? 'h-1.5' : 'h-2',
        )}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-300', TONES[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
