import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { IconButton } from './IconButton'
import { Select } from './Select'

export interface PaginationProps {
  /** 1-based. */
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  /** "students", "invoices" — used in the range line. */
  itemNoun?: string
  /** Hairline above the row. Off when it already sits under a bordered table. */
  divided?: boolean
  className?: string
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  itemNoun,
  divided = false,
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-3',
        divided && 'border-t border-border',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {onPageSizeChange && (
          <>
            <label htmlFor="pagination-page-size" className="text-body-13 text-text-secondary">
              Rows
            </label>
            <Select
              id="pagination-page-size"
              selectSize="sm"
              value={String(pageSize)}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              containerClassName="w-auto"
              options={pageSizeOptions.map((option) => ({
                value: String(option),
                label: String(option),
              }))}
            />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <p className="text-body-13 text-text-secondary tabular-nums" aria-live="polite">
          {total === 0 ? (
            <>No {itemNoun ?? 'results'}</>
          ) : (
            <>
              {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
              {itemNoun ? ` ${itemNoun}` : null}
            </>
          )}
        </p>

        <nav aria-label="Pagination" className="flex items-center gap-1">
          <IconButton
            icon={ChevronLeft}
            label="Previous page"
            variant="secondary"
            size="sm"
            disabled={current <= 1}
            onClick={() => onPageChange(current - 1)}
          />
          <span className="px-1 text-body-13 text-text-secondary tabular-nums">
            Page {formatNumber(current)} of {formatNumber(pageCount)}
          </span>
          <IconButton
            icon={ChevronRight}
            label="Next page"
            variant="secondary"
            size="sm"
            disabled={current >= pageCount}
            onClick={() => onPageChange(current + 1)}
          />
        </nav>
      </div>
    </div>
  )
}
