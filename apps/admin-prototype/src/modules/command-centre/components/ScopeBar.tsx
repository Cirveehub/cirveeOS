import { CalendarRange } from 'lucide-react'

import type { Unit } from '@/mocks'
import { FilterBar, Input, Label } from '@/ui'

import { PRESET_OPTIONS, type Scope } from '../lib/scope'

export interface ScopeBarProps {
  scope: Scope
  units: Unit[]
}

export function ScopeBar({ scope, units }: ScopeBarProps) {
  return (
    <FilterBar
      filters={[
        {
          key: 'unit',
          label: 'Unit',
          placeholder: 'All units',
          options: units.map((unit) => ({ value: unit.id, label: unit.name })),
        },
      ]}
      values={{ unit: scope.unitId ?? undefined }}
      onFilterChange={(_key, value) => scope.setUnit(value ?? '')}
      onClearAll={() => scope.setUnit('')}
      right={
        <span className="inline-flex items-center gap-1.5 text-body-13 text-text-secondary">
          <CalendarRange size={14} aria-hidden="true" />
          {scope.rangeLabel}
        </span>
      }
    >
      <div className="flex items-center gap-2">
        <Label htmlFor="home-range" className="sr-only">
          Date range
        </Label>
        <select
          id="home-range"
          value={scope.preset}
          onChange={(event) => scope.setPreset(event.target.value as Scope['preset'])}
          className="h-10 min-w-40 rounded-xl border border-border-strong bg-surface px-3 text-body-14 text-text transition-colors focus:border-accent"
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {scope.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="home-from" className="text-body-13">
            From
          </Label>
          <Input
            id="home-from"
            type="date"
            value={scope.range.from}
            onChange={(event) => scope.setCustom('from', event.target.value)}
            containerClassName="w-auto"
          />
          <Label htmlFor="home-to" className="text-body-13">
            To
          </Label>
          <Input
            id="home-to"
            type="date"
            value={scope.range.to}
            onChange={(event) => scope.setCustom('to', event.target.value)}
            containerClassName="w-auto"
          />
        </div>
      )}
    </FilterBar>
  )
}
