import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'
export type BadgeVariant = 'subtle' | 'solid' | 'outline'
export type BadgeSize = 'sm' | 'md'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  variant?: BadgeVariant
  size?: BadgeSize
  /** Leading status dot in the current text colour. */
  dot?: boolean
  icon?: ReactNode
  children: ReactNode
}

/*
 * Tinted fills use the `*-fill` / `*-ink` role pair, which inverts together
 * with the theme — the chip darkens and its ink lightens in one step. Never
 * pair a `*-fill` with `*-text`: that one reads on `surface`, not on a tint,
 * and goes invisible in dark. The pairing here also fixes the 3.2:1 that the
 * source system shipped for `success-600` on `success-25`.
 */
const SUBTLE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-sunken text-text-label',
  accent: 'bg-accent-subtle text-accent',
  success: 'bg-success-fill text-success-ink',
  warning: 'bg-warning-fill text-warning-ink',
  danger: 'bg-danger-fill text-danger-ink',
  info: 'bg-info-fill text-info-ink',
}

const SOLID: Record<BadgeTone, string> = {
  // `bg-text`/`text-surface` is the one pair that inverts cleanly in both themes.
  neutral: 'bg-text text-surface',
  accent: 'bg-accent text-on-accent',
  success: 'bg-success-600 text-success-25',
  warning: 'bg-warning-500 text-on-warning',
  danger: 'bg-danger-600 text-danger-25',
  info: 'bg-info-600 text-info-25',
}

const OUTLINE: Record<BadgeTone, string> = {
  neutral: 'border border-border-strong text-text-label',
  accent: 'border border-accent text-accent',
  success: 'border border-success-600 text-success-text',
  warning: 'border border-warning-600 text-warning-text',
  danger: 'border border-danger-600 text-danger-text',
  info: 'border border-info-600 text-info-text',
}

const SIZES: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 gap-1 text-label-10',
  md: 'h-6 px-2 gap-1.5 text-label-11',
}

export function Badge({
  tone = 'neutral',
  variant = 'subtle',
  size = 'md',
  dot = false,
  icon,
  className,
  children,
  ...rest
}: BadgeProps) {
  const palette = variant === 'solid' ? SOLID : variant === 'outline' ? OUTLINE : SUBTLE

  return (
    <span
      {...rest}
      className={cn(
        'inline-flex shrink-0 items-center rounded-full whitespace-nowrap',
        SIZES[size],
        palette[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className={cn('rounded-full bg-current', size === 'sm' ? 'size-1' : 'size-1.5')}
        />
      )}
      {icon}
      {children}
    </span>
  )
}
