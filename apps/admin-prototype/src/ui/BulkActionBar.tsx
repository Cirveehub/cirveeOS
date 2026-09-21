import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { pluralize } from '@/lib/format'

export interface BulkActionBarProps {
  count: number
  onClearSelection?: () => void
  /** Buttons. Keep to three or fewer; put the rest behind a Popover. */
  children?: ReactNode
  /** Singular noun — "student", "invoice". */
  itemNoun?: string
  /** `inline` sits under the toolbar; `floating` docks to the bottom of the viewport. */
  variant?: 'inline' | 'floating'
  className?: string
}

/** Renders nothing when nothing is selected. */
export function BulkActionBar({
  count,
  onClearSelection,
  children,
  itemNoun = 'row',
  variant = 'inline',
  className,
}: BulkActionBarProps) {
  if (count <= 0) return null

  const body = (
    <>
      <p className="text-body-14 font-semibold text-text tabular-nums">
        {pluralize(count, itemNoun)} selected
      </p>
      <span aria-hidden="true" className="h-5 w-px bg-border-strong" />
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {onClearSelection && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          leftIcon={<X size={14} aria-hidden="true" />}
          className="ml-auto"
        >
          Clear
        </Button>
      )}
    </>
  )

  if (variant === 'floating') {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-3',
          'rounded-2xl border border-border bg-surface px-4 py-2.5 shadow-md animate-slide-up',
          className,
        )}
      >
        {body}
      </div>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-wrap items-center gap-3 rounded-xl border border-accent-subtle bg-accent-wash px-4 py-2.5',
        className,
      )}
    >
      {body}
    </div>
  )
}
