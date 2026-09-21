import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { BulkActionBar } from './BulkActionBar'

export interface TableToolbarProps {
  /** Usually a `<FilterBar />`. */
  children?: ReactNode
  /** Right-aligned page actions — "Export", "New invoice". */
  actions?: ReactNode
  /** Above the filters — a title, a count, a segmented control. */
  lead?: ReactNode

  selectedCount?: number
  bulkActions?: ReactNode
  onClearSelection?: () => void
  itemNoun?: string
  bulkVariant?: 'inline' | 'floating'

  className?: string
}

/** Filters on the left, page actions on the right, bulk actions underneath. */
export function TableToolbar({
  children,
  actions,
  lead,
  selectedCount = 0,
  bulkActions,
  onClearSelection,
  itemNoun = 'row',
  bulkVariant = 'inline',
  className,
}: TableToolbarProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {lead}

      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">{children}</div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      <BulkActionBar
        count={selectedCount}
        onClearSelection={onClearSelection}
        itemNoun={itemNoun}
        variant={bulkVariant}
      >
        {bulkActions}
      </BulkActionBar>
    </div>
  )
}
