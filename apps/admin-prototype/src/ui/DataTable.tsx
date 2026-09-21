import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Checkbox } from './Checkbox'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

export type ColumnAlign = 'left' | 'center' | 'right'
export type SortDirection = 'asc' | 'desc'
export type TableDensity = 'comfortable' | 'compact'

export interface SortState {
  key: string
  direction: SortDirection
}

export interface Column<T> {
  key: string
  header: ReactNode
  /** Plain value for a cell. Also used for sorting when `sortValue` is absent. */
  accessor?: (row: T) => ReactNode
  /** Full control over the cell. Takes precedence over `accessor`. */
  cell?: (row: T, index: number) => ReactNode
  /** Comparable value. Needed when `accessor` returns an element. */
  sortValue?: (row: T) => string | number | Date | boolean | null | undefined
  align?: ColumnAlign
  width?: number | string
  minWidth?: number | string
  sortable?: boolean
  className?: string
  headerClassName?: string
  /** Keep this column in view while the table scrolls sideways. Leading columns only. */
  pinned?: boolean
}

export interface DataTableProps<T> {
  data: T[]
  columns: Array<Column<T>>
  /** Stable identity per row — used for selection and React keys. */
  rowKey: (row: T, index: number) => string

  loading?: boolean
  skeletonRows?: number

  /** Replaces the built-in empty state entirely. */
  empty?: ReactNode
  emptyTitle?: string
  emptyMessage?: string
  emptyAction?: ReactNode

  onRowClick?: (row: T, index: number) => void
  rowClassName?: (row: T, index: number) => string | undefined
  /** Highlights a row — for the record currently open in a Drawer. */
  activeRowKey?: string

  selectable?: boolean
  selectedKeys?: string[]
  onSelectionChange?: (keys: string[]) => void

  density?: TableDensity
  stickyHeader?: boolean
  /** Caps the scroll area — required for `stickyHeader` to do anything useful. */
  maxHeight?: number | string
  /** Forces horizontal scrolling rather than squeezing 12 columns together. */
  minWidth?: number | string

  defaultSort?: SortState
  /** Controlled sorting. Supply with `onSortChange` to sort on the server. */
  sort?: SortState | null
  onSortChange?: (sort: SortState | null) => void

  /** Screen-reader description of the table. */
  caption?: string
  /** A totals row, rendered in `<tfoot>` and pinned under the body. */
  footer?: ReactNode
  bordered?: boolean
  className?: string
}

const DENSITY: Record<TableDensity, { cell: string; head: string; text: string }> = {
  comfortable: { cell: 'px-4 py-3', head: 'px-4 py-2.5', text: 'text-body-14' },
  compact: { cell: 'px-3 py-1.5', head: 'px-3 py-2', text: 'text-body-13' },
}

const ALIGN: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
}

const SELECT_COLUMN_WIDTH = 44

function compare(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty && bEmpty) return 0
  if (aEmpty) return 1 // empties sort last in both directions
  if (bEmpty) return -1

  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
}

/**
 * Zebra-free: hairline row borders only, per the brand book. Sorting is
 * client-side unless `sort`/`onSortChange` are supplied.
 */
export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  skeletonRows = 8,
  empty,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'No records match the current view.',
  emptyAction,
  onRowClick,
  rowClassName,
  activeRowKey,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  density = 'comfortable',
  stickyHeader = true,
  maxHeight,
  minWidth,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  caption,
  footer,
  bordered = true,
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortState | null>(defaultSort ?? null)
  const isSortControlled = controlledSort !== undefined
  const sort: SortState | null = (isSortControlled ? controlledSort : internalSort) ?? null

  const pad = DENSITY[density]
  const selected = useMemo(() => new Set(selectedKeys ?? []), [selectedKeys])

  const sortedData = useMemo(() => {
    // Controlled sorting means the caller already ordered the rows.
    if (!sort || isSortControlled) return data
    const column = columns.find((candidate) => candidate.key === sort.key)
    if (!column) return data

    const valueOf = (row: T) =>
      column.sortValue ? column.sortValue(row) : column.accessor ? column.accessor(row) : undefined

    const factor = sort.direction === 'asc' ? 1 : -1
    return [...data].sort((a, b) => compare(valueOf(a), valueOf(b)) * factor)
  }, [data, columns, sort, isSortControlled])

  // asc → desc → unsorted.
  const toggleSort = (column: Column<T>) => {
    if (!column.sortable) return

    let next: SortState | null
    if (!sort || sort.key !== column.key) next = { key: column.key, direction: 'asc' }
    else if (sort.direction === 'asc') next = { key: column.key, direction: 'desc' }
    else next = null

    if (!isSortControlled) setInternalSort(next)
    onSortChange?.(next)
  }

  const visibleKeys = sortedData.map((row, index) => rowKey(row, index))
  const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selected.has(key))
  const someSelected = !allSelected && visibleKeys.some((key) => selected.has(key))

  const toggleAll = () => {
    if (!onSelectionChange) return
    if (allSelected) {
      onSelectionChange((selectedKeys ?? []).filter((key) => !visibleKeys.includes(key)))
    } else {
      onSelectionChange(Array.from(new Set([...(selectedKeys ?? []), ...visibleKeys])))
    }
  }

  const toggleRow = (key: string) => {
    if (!onSelectionChange) return
    const next = new Set(selectedKeys ?? [])
    if (next.has(key)) next.delete(key)
    else next.add(key)
    onSelectionChange(Array.from(next))
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (!onRowClick) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target !== event.currentTarget) return
    event.preventDefault()
    onRowClick(row, index)
  }

  const totalColumns = columns.length + (selectable ? 1 : 0)

  const pinnedLeft = selectable ? SELECT_COLUMN_WIDTH : 0

  const headCell = (column: Column<T>) => {
    const activeSort = sort && sort.key === column.key ? sort : null
    const SortIcon = !activeSort ? ChevronsUpDown : activeSort.direction === 'asc' ? ArrowUp : ArrowDown

    return (
      <th
        key={column.key}
        scope="col"
        aria-sort={
          column.sortable
            ? activeSort
              ? activeSort.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none'
            : undefined
        }
        style={{
          width: column.width,
          minWidth: column.minWidth ?? column.width,
          left: column.pinned ? pinnedLeft : undefined,
        }}
        className={cn(
          'border-b border-border bg-surface-sunken text-label-11 text-text-label whitespace-nowrap',
          pad.head,
          ALIGN[column.align ?? 'left'],
          stickyHeader && 'sticky top-0 z-20',
          column.pinned && 'sticky z-30',
          column.headerClassName,
        )}
      >
        {column.sortable ? (
          <button
            type="button"
            onClick={() => toggleSort(column)}
            className={cn(
              'group inline-flex w-full items-center gap-1 rounded-sm text-label-11 text-text-label',
              'transition-colors hover:text-text',
              column.align === 'right' && 'justify-end',
              column.align === 'center' && 'justify-center',
            )}
          >
            {column.header}
            <SortIcon
              size={13}
              aria-hidden="true"
              className={cn(
                'shrink-0 transition-opacity',
                activeSort ? 'text-accent opacity-100' : 'opacity-0 group-hover:opacity-60',
              )}
            />
          </button>
        ) : (
          column.header
        )}
      </th>
    )
  }

  return (
    <div
      className={cn(
        'relative w-full overflow-auto',
        bordered && 'rounded-xl border border-border bg-surface',
        className,
      )}
      style={{ maxHeight }}
    >
      <table className="w-full border-separate border-spacing-0" style={{ minWidth }}>
        {caption && <caption className="sr-only">{caption}</caption>}

        <thead>
          <tr>
            {selectable && (
              <th
                scope="col"
                style={{ width: SELECT_COLUMN_WIDTH, minWidth: SELECT_COLUMN_WIDTH }}
                className={cn(
                  'border-b border-border bg-surface-sunken',
                  pad.head,
                  stickyHeader && 'sticky top-0 z-30',
                  'left-0 sticky',
                )}
              >
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleAll}
                  aria-label={allSelected ? 'Deselect all rows' : 'Select all rows'}
                  disabled={visibleKeys.length === 0}
                />
              </th>
            )}
            {columns.map((column) => headCell(column))}
          </tr>
        </thead>

        <tbody>
          {loading &&
            Array.from({ length: skeletonRows }, (_, rowIndex) => (
              <tr key={`skeleton-${rowIndex}`}>
                {selectable && (
                  <td className={cn('border-b border-border bg-surface', pad.cell)}>
                    <Skeleton width={16} height={16} rounded="sm" />
                  </td>
                )}
                {columns.map((column, columnIndex) => (
                  <td key={column.key} className={cn('border-b border-border bg-surface', pad.cell)}>
                    <Skeleton
                      height={12}
                      width={columnIndex === 0 ? '70%' : columnIndex % 3 === 0 ? '40%' : '55%'}
                    />
                  </td>
                ))}
              </tr>
            ))}

          {!loading && sortedData.length === 0 && (
            <tr>
              <td colSpan={totalColumns} className="p-0">
                {empty ?? (
                  <EmptyState
                    icon={Inbox}
                    title={emptyTitle}
                    message={emptyMessage}
                    action={emptyAction}
                  />
                )}
              </td>
            </tr>
          )}

          {!loading &&
            sortedData.map((row, index) => {
              const key = rowKey(row, index)
              const isSelected = selected.has(key)
              const isActive = activeRowKey === key
              const isLast = index === sortedData.length - 1

              const cellShell = cn(
                isLast ? 'border-b-0' : 'border-b border-border',
                isActive || isSelected ? 'bg-accent-wash' : 'bg-surface',
                onRowClick && 'group-hover:bg-surface-hover',
              )

              return (
                <tr
                  key={key}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row, index) : undefined}
                  onKeyDown={(event) => handleRowKeyDown(event, row, index)}
                  className={cn('group', onRowClick && 'cursor-pointer', rowClassName?.(row, index))}
                >
                  {selectable && (
                    <td
                      onClick={(event) => event.stopPropagation()}
                      className={cn('sticky left-0 z-10', cellShell, pad.cell)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleRow(key)}
                        aria-label={`Select row ${index + 1}`}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth ?? column.width,
                        left: column.pinned ? pinnedLeft : undefined,
                      }}
                      className={cn(
                        'align-middle text-text-label',
                        cellShell,
                        pad.cell,
                        pad.text,
                        ALIGN[column.align ?? 'left'],
                        column.pinned && 'sticky z-10',
                        column.className,
                      )}
                    >
                      {column.cell
                        ? column.cell(row, index)
                        : column.accessor
                          ? column.accessor(row)
                          : null}
                    </td>
                  ))}
                </tr>
              )
            })}
        </tbody>

        {footer && !loading && sortedData.length > 0 && (
          <tfoot>
            <tr>
              <td
                colSpan={totalColumns}
                className={cn('sticky bottom-0 z-20 border-t border-border bg-surface-sunken', pad.cell)}
              >
                {footer}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
