import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

export interface SectionHeaderProps {
  title: ReactNode
  description?: ReactNode
  /** Count pill after the title — "Invoices 128". */
  count?: number
  actions?: ReactNode
  /** Heading level. Pick the one that keeps the document outline correct. */
  as?: 'h2' | 'h3' | 'h4'
  size?: 'sm' | 'md'
  divided?: boolean
  className?: string
}

export function SectionHeader({
  title,
  description,
  count,
  actions,
  as: Heading = 'h2',
  size = 'md',
  divided = false,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-2',
        divided && 'border-b border-border pb-3',
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Heading className={cn('text-text', size === 'sm' ? 'text-body-15 font-bold' : 'text-heading-18')}>
            {title}
          </Heading>
          {count !== undefined && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-sunken px-1.5 text-body-12 font-semibold text-text-secondary tabular-nums">
              {formatNumber(count)}
            </span>
          )}
        </div>
        {description && <p className="mt-1 text-body-13 text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
