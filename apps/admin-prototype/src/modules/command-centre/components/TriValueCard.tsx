/**
 * The tri-value card the spec asks for — "Pending approvals · unresolved
 * tickets · attention flags", each segment its own link.
 *
 * `@/ui`'s `StatCard` holds one value, so this is built here. It borrows the
 * StatCard shell exactly (same radius, hairline, label scale) so the row does
 * not break. It belongs in `src/ui/` if a second module wants it.
 */

import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/cn'

export interface TriValueSegment {
  label: string
  value: number
  to: string
  /** Rising is bad on all three of these, so a non-zero value is never "good". */
  tone?: 'neutral' | 'warning' | 'danger'
}

export interface TriValueCardProps {
  label: string
  caption?: string
  icon?: LucideIcon
  segments: TriValueSegment[]
  className?: string
}

const TONE: Record<NonNullable<TriValueSegment['tone']>, string> = {
  neutral: 'text-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
}

export function TriValueCard({ label, caption, icon: Icon, segments, className }: TriValueCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-5', className)}>
      <div className="flex items-start justify-between gap-4">
        <p className="text-label-11 text-text-muted">{label}</p>
        {Icon && (
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-fill text-warning-ink">
            <Icon size={18} aria-hidden="true" />
          </span>
        )}
      </div>

      <ul className="mt-3 grid grid-cols-3 gap-2">
        {segments.map((segment) => (
          <li key={segment.label} className="min-w-0">
            <Link
              to={segment.to}
              className="block rounded-lg px-1 py-1 -mx-1 transition-colors hover:bg-surface-hover"
            >
              <span
                className={cn(
                  'block text-heading-24 tabular-nums',
                  TONE[segment.value === 0 ? 'neutral' : (segment.tone ?? 'warning')],
                )}
              >
                {formatNumber(segment.value)}
              </span>
              <span className="mt-0.5 block truncate text-body-12 text-text-secondary">
                {segment.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {caption && (
        <>
          <div aria-hidden="true" className="mt-3.5 h-px w-full bg-warning-line" />
          <p className="mt-2.5 text-body-13 text-text-secondary">{caption}</p>
        </>
      )}
    </div>
  )
}
