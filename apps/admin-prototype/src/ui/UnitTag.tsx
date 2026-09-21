import type { BusinessUnit } from '@/app/module-registry'
import { cn } from '@/lib/cn'

export interface UnitTagProps {
  unit: BusinessUnit
  size?: 'sm' | 'md'
  /** Drop the label and show only the dot — for very dense rows. */
  dotOnly?: boolean
  className?: string
}

/**
 * The six business units. Per docs/build-plan.md §2.2 gap 6, every revenue and
 * cost record carries one, so the tag needs six tones that stay apart at a
 * glance and stay the same colour on every screen.
 *
 * Red is deliberately unused: it means failure everywhere else in the system.
 */
export const UNIT_META: Record<BusinessUnit, { label: string; short: string; className: string; dot: string }> = {
  academy: { label: 'Academy', short: 'ACA', className: 'bg-accent-subtle text-accent', dot: 'bg-accent' },
  teens: { label: 'Teens', short: 'TEN', className: 'bg-teal-100 text-teal-700', dot: 'bg-teal-700' },
  corporate: { label: 'Corporate', short: 'COR', className: 'bg-info-fill text-info-ink', dot: 'bg-info-600' },
  dexurb: { label: 'Dexurb', short: 'DEX', className: 'bg-warning-fill text-warning-ink', dot: 'bg-warning-600' },
  africa: { label: 'Cirvee Africa', short: 'AFR', className: 'bg-success-fill text-success-ink', dot: 'bg-success-600' },
  tcf: { label: 'TCF', short: 'TCF', className: 'bg-ui-100 text-ui-700', dot: 'bg-ui-600' },
}

export const BUSINESS_UNITS: BusinessUnit[] = ['academy', 'teens', 'corporate', 'dexurb', 'africa', 'tcf']

export function UnitTag({ unit, size = 'md', dotOnly = false, className }: UnitTagProps) {
  const meta = UNIT_META[unit]

  if (dotOnly) {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)} title={meta.label}>
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', meta.dot)} />
        <span className="sr-only">{meta.label}</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full whitespace-nowrap',
        size === 'sm' ? 'h-5 px-1.5 text-label-10' : 'h-6 px-2 text-label-11',
        meta.className,
        className,
      )}
    >
      <span aria-hidden="true" className={cn('rounded-full bg-current', size === 'sm' ? 'size-1' : 'size-1.5')} />
      {meta.label}
    </span>
  )
}
