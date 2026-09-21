/**
 * The lead filter bar, shared by the list and the pipeline board.
 *
 * Every control writes straight to the query string, so the view a growth
 * head is looking at is a URL they can paste into a WhatsApp group.
 */

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge, Button, Checkbox, FilterBar, Input, Popover, type FilterDef } from '@/ui'
import type { PersonId } from '@/mocks/types'
import {
  ALL_SOURCES,
  ALL_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  useDirectory,
} from '../lib/lookups'
import { CREATED_RANGES, NEXT_ACTION_OPTIONS, SAVED_VIEWS } from '../lib/lead-filters'
import type { QueryState } from '../lib/view-state'
import { PersonPicker } from './Pickers'

export interface LeadFilterBarProps {
  query: QueryState
}

export function LeadFilterBar({ query }: LeadFilterBarProps) {
  const { courseOptions, branchOptions, unitOptions, staffOptions } = useDirectory()

  const filters: FilterDef[] = useMemo(
    () => [
      { key: 'course', label: 'Course', options: courseOptions },
      { key: 'branch', label: 'Branch', options: branchOptions },
      { key: 'unit', label: 'Unit', options: unitOptions },
      {
        key: 'created',
        label: 'Created',
        options: CREATED_RANGES.map((r) => ({ value: r.value, label: r.label })),
        placeholder: 'Any time',
      },
      {
        key: 'next',
        label: 'Next action',
        options: NEXT_ACTION_OPTIONS,
        placeholder: 'Any next action',
      },
    ],
    [courseOptions, branchOptions, unitOptions],
  )

  const activeView = query.get('view')

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-label-10 text-text-muted">Saved views</span>
        {SAVED_VIEWS.map((view) => {
          const active = activeView === view.key
          return (
            <Button
              key={view.key}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              title={view.description}
              onClick={() => {
                if (active) {
                  query.clear()
                  return
                }
                query.clear()
                query.setMany({ ...view.params, view: view.key })
              }}
            >
              {view.label}
            </Button>
          )
        })}
      </div>

      <FilterBar
        search={query.get('q') ?? ''}
        onSearchChange={(value) => query.set('q', value || undefined)}
        searchPlaceholder="Search name, phone, email or reference"
        filters={filters}
        values={Object.fromEntries(filters.map((f) => [f.key, query.get(f.key)]))}
        onFilterChange={(key, value) => query.set(key, value)}
        onClearAll={() => query.clear()}
      >
        <MultiSelectFilter
          label="Stage"
          selected={query.getList('stage')}
          options={ALL_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
          onChange={(values) => query.setList('stage', values)}
        />
        <MultiSelectFilter
          label="Owner"
          selected={query.getList('owner')}
          options={[{ value: 'me', label: 'Me (Adebayo Ogunlana)' }, ...staffOptions]}
          onChange={(values) => query.setList('owner', values)}
        />
        <MultiSelectFilter
          label="Source"
          selected={query.getList('source')}
          options={ALL_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
          onChange={(values) => query.setList('source', values)}
        />

        <div className="w-52">
          <PersonPicker
            label="Referrer"
            value={(query.get('referrer') as PersonId | undefined) ?? null}
            onChange={(value) => query.set('referrer', value ?? undefined)}
            relationship="referrer"
          />
        </div>

        <label className="flex items-center gap-1.5 text-body-13 text-text-secondary">
          Days in stage over
          <Input
            type="number"
            min={0}
            inputSize="sm"
            containerClassName="w-20"
            value={query.get('days') ?? ''}
            onChange={(event) => query.set('days', event.target.value || undefined)}
            aria-label="Minimum days in stage"
          />
        </label>
      </FilterBar>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Multi-select                                                               */
/* -------------------------------------------------------------------------- */

export interface MultiSelectFilterProps {
  label: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (values: string[]) => void
}

export function MultiSelectFilter({ label, options, selected, onChange }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      role="dialog"
      width={260}
      content={
        <div className="flex max-h-80 flex-col">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-label-11 text-text-label">{label}</span>
            <Button variant="link" size="sm" onClick={() => onChange([])} disabled={!selected.length}>
              Clear
            </Button>
          </div>
          <ul className="overflow-y-auto p-2">
            {options.map((option) => (
              <li key={option.value} className="px-1 py-1">
                <Checkbox
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  label={option.label}
                />
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <button
        type="button"
        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface px-2.5 text-body-14 text-text transition-colors hover:border-border-strong"
      >
        {label}
        {selected.length > 0 && (
          <Badge tone="accent" variant="subtle" size="sm">
            {selected.length}
          </Badge>
        )}
        <ChevronDown size={14} aria-hidden="true" className="text-text-muted" />
      </button>
    </Popover>
  )
}
