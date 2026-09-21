/**
 * Lets a wide table default to a curated column set instead of showing every
 * possible column at once — the fix for the pattern audit found repeated
 * across the app: "there's more data" became "add another column" rather
 * than "pick sensible defaults and let people opt into the rest." Extracted
 * from `modules/crm/pages/LeadList.tsx`, which built this once for a
 * 33-column lead catalogue shown 13 at a time — proven, on-brand, already
 * reviewed. Any table with 10+ possible columns should use this rather than
 * showing them all.
 *
 * Pairs with `useColumnVisibility` below, which keeps the visible set in the
 * query string via `@/lib/view-state`'s `useQueryState` — so a curated view
 * is still a link, and "show me everything" is one click away rather than
 * the default.
 */
import { useState } from 'react'
import { Columns3 } from 'lucide-react'

import { Button } from './Button'
import { Checkbox } from './Checkbox'
import { Popover } from './Popover'
import { useQueryState } from '@/lib/view-state'

export interface ColumnCatalogueEntry {
  key: string
  label: string
  /** Shown by default when no `?cols=` override is in the URL. */
  defaultVisible: boolean
  /** Cannot be hidden — the row's primary identifying column, typically. */
  locked?: boolean
}

export interface ColumnPickerProps {
  catalogue: ColumnCatalogueEntry[]
  visible: string[]
  defaultKeys: string[]
  onChange: (keys: string[]) => void
}

export function ColumnPicker({ catalogue, visible, defaultKeys, onChange }: ColumnPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      role="dialog"
      width={250}
      content={
        <div className="flex max-h-96 flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-label-11 text-text-label">Columns</span>
            <Button variant="link" size="sm" onClick={() => onChange(defaultKeys)}>
              Reset
            </Button>
          </div>
          <ul className="overflow-y-auto p-2">
            {catalogue.map((column) => (
              <li key={column.key} className="px-1 py-1">
                <Checkbox
                  checked={visible.includes(column.key)}
                  disabled={column.locked}
                  onChange={() =>
                    onChange(
                      visible.includes(column.key)
                        ? visible.filter((k) => k !== column.key)
                        : catalogue
                            .filter((c) => visible.includes(c.key) || c.key === column.key)
                            .map((c) => c.key),
                    )
                  }
                  label={column.label}
                />
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <Button variant="secondary" size="sm" leftIcon={<Columns3 size={14} aria-hidden="true" />}>
        Columns
      </Button>
    </Popover>
  )
}

/**
 * Wires `ColumnPicker`'s visible set to `?cols=` via `useQueryState`, so a
 * screen adopts the whole pattern — catalogue in, visible list + setter out
 * — without re-deriving the query-string plumbing `LeadList.tsx` wrote once.
 *
 * `paramName` only needs changing when a screen has more than one column set
 * to manage (rare); every other caller can use the default.
 */
export function useColumnVisibility(
  catalogue: ColumnCatalogueEntry[],
  paramName = 'cols',
): { visible: string[]; defaultKeys: string[]; setVisible: (keys: string[]) => void } {
  const query = useQueryState()
  const defaultKeys = catalogue.filter((c) => c.defaultVisible).map((c) => c.key)
  const fromQuery = query.getList(paramName)
  const visible = fromQuery.length ? fromQuery : defaultKeys

  const setVisible = (keys: string[]) => {
    query.set(paramName, keys.join(',') === defaultKeys.join(',') ? undefined : keys.join(','))
  }

  return { visible, defaultKeys, setVisible }
}
