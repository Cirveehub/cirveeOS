import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { SearchInput } from './SearchInput'
import { Select, type SelectOption } from './Select'

export interface FilterDef {
  key: string
  /** Prefixes the active chip — "Unit: Academy". */
  label: string
  options: SelectOption[]
  /** Shown when the filter is unset. Defaults to "All {label}". */
  placeholder?: string
  width?: number | string
}

export type FilterValues = Record<string, string | undefined>

export interface FilterBarProps {
  search?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string

  filters?: FilterDef[]
  values?: FilterValues
  onFilterChange?: (key: string, value: string | undefined) => void
  onClearAll?: () => void

  /** Extra controls rendered after the filter selects — a date range, a toggle. */
  children?: ReactNode
  /** Right-aligned slot — view switchers, column config. */
  right?: ReactNode
  /** Hide the active-filter chip row even when filters are set. */
  hideChips?: boolean
  size?: 'sm' | 'md'
  className?: string
}

interface ActiveChip {
  key: string
  label: string
  value: string
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search',
  filters = [],
  values = {},
  onFilterChange,
  onClearAll,
  children,
  right,
  hideChips = false,
  size = 'md',
  className,
}: FilterBarProps) {
  const active: ActiveChip[] = filters
    .filter((filter) => values[filter.key])
    .map((filter) => ({
      key: filter.key,
      label: filter.label,
      value:
        filter.options.find((option) => option.value === values[filter.key])?.label ??
        String(values[filter.key]),
    }))

  const searchActive = Boolean(search && search.length > 0 && onSearchChange)
  const hasActive = active.length > 0 || searchActive

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <SearchInput
            value={search ?? ''}
            onChange={onSearchChange}
            placeholder={searchPlaceholder}
            inputSize={size}
            containerClassName="w-full max-w-xs"
          />
        )}

        {filters.map((filter) => (
          <Select
            key={filter.key}
            aria-label={filter.label}
            selectSize={size}
            value={values[filter.key] ?? ''}
            onChange={(event) => onFilterChange?.(filter.key, event.target.value || undefined)}
            containerClassName="w-auto min-w-40"
            style={{ width: filter.width }}
          >
            <option value="">{filter.placeholder ?? `All ${filter.label.toLowerCase()}`}</option>
            {filter.options.map((option) => (
              <option key={option.value} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </Select>
        ))}

        {children}

        {right && <div className="ml-auto flex items-center gap-2">{right}</div>}
      </div>

      {!hideChips && hasActive && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-10 text-text-muted">Filters</span>

          {searchActive && (
            <Chip label="Search" value={search ?? ''} onClear={() => onSearchChange?.('')} />
          )}

          {active.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              value={chip.value}
              onClear={() => onFilterChange?.(chip.key, undefined)}
            />
          ))}

          {onClearAll && (
            <Button variant="link" size="sm" onClick={onClearAll} className="text-body-13">
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function Chip({ label, value, onClear }: { label: string; value: string; onClear: () => void }) {
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border-strong bg-surface pl-2 pr-1 text-body-12">
      <span className="text-text-muted">{label}:</span>
      <span className="max-w-40 truncate font-medium text-text">{value}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
        className="grid size-4 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-sunken hover:text-text"
      >
        <X size={11} aria-hidden="true" />
      </button>
    </span>
  )
}
