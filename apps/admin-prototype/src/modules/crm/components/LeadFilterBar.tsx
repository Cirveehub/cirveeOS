import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Badge, Button, Checkbox, FilterBar, Input, Popover, type FilterDef } from '@/ui'
import type { LeadStage, PersonId } from '@/mocks/types'
import {
  ALL_SOURCES,
  RAW_STAGES_OF,
  SIMPLE_OUTCOMES,
  SIMPLE_PIPELINE,
  SIMPLE_STAGE_LABEL,
  SOURCE_LABELS,
  useDirectory,
  type SimpleStage,
} from '../lib/lookups'
import { CREATED_RANGES, NEXT_ACTION_OPTIONS, SAVED_VIEWS } from '../lib/lead-filters'
import type { QueryState } from '../lib/view-state'
import { PersonPicker } from './Pickers'

const ALL_SIMPLE: SimpleStage[] = [...SIMPLE_PIPELINE, ...SIMPLE_OUTCOMES]

export interface LeadFilterBarProps {
  query: QueryState
  hideOwner?: boolean
}

export function LeadFilterBar({ query, hideOwner = false }: LeadFilterBarProps) {
  const { courseOptions, branchOptions, staffOptions } = useDirectory()

  const filters: FilterDef[] = useMemo(
    () => [
      { key: 'course', label: 'Course', options: courseOptions },
      { key: 'branch', label: 'Branch', options: branchOptions },
      {
        key: 'created',
        label: 'Came in',
        options: CREATED_RANGES.map((r) => ({ value: r.value, label: r.label })),
        placeholder: 'Any time',
      },
      {
        key: 'next',
        label: 'Next step',
        options: NEXT_ACTION_OPTIONS,
        placeholder: 'Any',
      },
    ],
    [courseOptions, branchOptions],
  )

  const activeView = query.get('view')
  const rawStages = query.getList('stage') as LeadStage[]
  const selectedSimple = ALL_SIMPLE.filter((s) => RAW_STAGES_OF[s].every((raw) => rawStages.includes(raw)))

  const toggleSimple = (stage: SimpleStage) => {
    const raws = RAW_STAGES_OF[stage]
    const on = raws.every((raw) => rawStages.includes(raw))
    const next = on
      ? rawStages.filter((raw) => !raws.includes(raw))
      : [...new Set([...rawStages, ...raws])]
    query.setList('stage', next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {SAVED_VIEWS.map((view) => {
          const active = activeView === view.key
          return (
            <Button
              key={view.key}
              size="sm"
              variant={active ? 'primary' : 'secondary'}
              title={view.description}
              onClick={() => {
                const scope = query.get('scope')
                query.clear(['layout'])
                if (!active) query.setMany({ ...view.params, view: view.key, scope })
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
        searchPlaceholder="Search name, phone or email"
        filters={filters}
        values={Object.fromEntries(filters.map((f) => [f.key, query.get(f.key)]))}
        onFilterChange={(key, value) => query.set(key, value)}
        onClearAll={() => query.clear(['layout', 'scope'])}
      >
        <MultiSelectFilter
          label="Stage"
          selected={selectedSimple}
          options={ALL_SIMPLE.map((s) => ({ value: s, label: SIMPLE_STAGE_LABEL[s] }))}
          onChange={(values) => query.setList('stage', values.flatMap((v) => RAW_STAGES_OF[v as SimpleStage]))}
          onToggle={(value) => toggleSimple(value as SimpleStage)}
        />
        {!hideOwner && (
          <MultiSelectFilter
            label="Handled by"
            selected={query.getList('owner')}
            options={staffOptions}
            onChange={(values) => query.setList('owner', values)}
          />
        )}
        <MultiSelectFilter
          label="Came via"
          selected={query.getList('source')}
          options={ALL_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
          onChange={(values) => query.setList('source', values)}
        />

        <div className="w-52">
          <PersonPicker
            label="Referred by"
            value={(query.get('referrer') as PersonId | undefined) ?? null}
            onChange={(value) => query.set('referrer', value ?? undefined)}
            relationship="referrer"
          />
        </div>

        <label className="flex items-center gap-1.5 text-body-13 text-text-secondary">
          Waiting more than
          <Input
            type="number"
            min={0}
            inputSize="sm"
            containerClassName="w-20"
            value={query.get('days') ?? ''}
            onChange={(event) => query.set('days', event.target.value || undefined)}
            aria-label="Waiting more than this many days"
          />
          days
        </label>
      </FilterBar>
    </div>
  )
}

export interface MultiSelectFilterProps {
  label: string
  options: Array<{ value: string; label: string }>
  selected: string[]
  onChange: (values: string[]) => void
  onToggle?: (value: string) => void
}

export function MultiSelectFilter({ label, options, selected, onChange, onToggle }: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false)

  const toggle = (value: string) => {
    if (onToggle) {
      onToggle(value)
      return
    }
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
