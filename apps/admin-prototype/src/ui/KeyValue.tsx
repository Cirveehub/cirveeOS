import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface KeyValueProps {
  label: ReactNode
  children: ReactNode
  /** Small print under the value — a source, a timestamp, a reference. */
  hint?: ReactNode
  /** `row` puts label and value side by side; `stacked` puts the value beneath. */
  layout?: 'row' | 'stacked'
  /** Hairline under the row. On by default inside a KeyValueList. */
  divided?: boolean
  align?: 'left' | 'right'
  className?: string
}

/** One row of a detail pane. Semantically a `<dt>`/`<dd>` pair. */
export function KeyValue({
  label,
  children,
  hint,
  layout = 'row',
  divided = true,
  align = 'left',
  className,
}: KeyValueProps) {
  return (
    <div
      className={cn(
        'py-2.5',
        divided && 'border-b border-border last:border-b-0',
        layout === 'row'
          ? 'grid grid-cols-[minmax(0,40%)_minmax(0,60%)] items-baseline gap-4'
          : 'flex flex-col gap-0.5',
        className,
      )}
    >
      <dt className="text-body-13 text-text-muted">{label}</dt>
      <dd className={cn('min-w-0 text-body-14 text-text', align === 'right' && 'text-right')}>
        {children}
        {hint && <span className="mt-0.5 block text-body-12 text-text-muted">{hint}</span>}
      </dd>
    </div>
  )
}

export interface KeyValueListProps {
  children: ReactNode
  /** Two columns of rows on wide viewports. */
  columns?: 1 | 2
  className?: string
}

export function KeyValueList({ children, columns = 1, className }: KeyValueListProps) {
  return (
    <dl
      className={cn(
        columns === 2 ? 'grid grid-cols-1 gap-x-8 md:grid-cols-2' : 'block',
        className,
      )}
    >
      {children}
    </dl>
  )
}
