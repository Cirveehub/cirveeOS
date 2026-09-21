import type { Unit } from '@/mocks'
import { Select } from '@/ui'
import { cn } from '@/lib/cn'

import { PRESET_OPTIONS, type ReportScopeState } from '../lib/scope'

export function ScopeBar({
  scope,
  units,
  className,
}: {
  scope: ReportScopeState
  units: Unit[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3',
        className,
      )}
    >
      <label className="flex flex-col gap-1">
        <span className="text-label-10 text-text-muted">Period</span>
        <Select
          value={scope.preset}
          onChange={(e) => scope.setPreset(e.target.value as typeof scope.preset)}
          aria-label="Reporting period"
        >
          {PRESET_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>

      {scope.preset === 'custom' && (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-label-10 text-text-muted">From</span>
            <input
              type="date"
              value={scope.range.from}
              onChange={(e) => scope.setCustom('from', e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-body-13 text-text"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-label-10 text-text-muted">To</span>
            <input
              type="date"
              value={scope.range.to}
              onChange={(e) => scope.setCustom('to', e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface px-2.5 text-body-13 text-text"
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-label-10 text-text-muted">Business unit</span>
        <Select
          value={scope.unitId ?? ''}
          onChange={(e) => scope.setUnit(e.target.value)}
          aria-label="Business unit"
        >
          <option value="">All units</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </Select>
      </label>

      <p className="ml-auto text-body-13 text-text-secondary">{scope.rangeLabel}</p>
    </div>
  )
}
