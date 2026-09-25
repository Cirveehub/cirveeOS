import { Plus, Trash2 } from 'lucide-react'

import type { ConditionGroup } from '@/mocks/types'
import { Button, CurrencyInput, IconButton, Input, Select } from '@/ui'

import {
  FIELDS,
  emptyGroup,
  fieldMeta,
  groupText,
  isGroup,
  operatorArity,
  operatorsFor,
  type ConditionRule,
  type FieldMeta,
} from './lib'

function FieldSelect({
  value,
  onChange,
  label,
  fields,
}: {
  value: string
  onChange: (path: string) => void
  label: string
  fields: FieldMeta[]
}) {
  const entities = [...new Set(fields.map((f) => f.entity))]
  return (
    <Select
      selectSize="sm"
      value={value}
      placeholder="Choose a field"
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    >
      {entities.map((entity) => (
        <optgroup key={entity} label={entity}>
          {fields.filter((f) => f.entity === entity).map((f) => (
            <option key={f.path} value={f.path}>
              {f.label}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  )
}

function ValueInput({
  meta,
  op,
  value,
  onChange,
  label,
}: {
  meta: FieldMeta | undefined
  op: string
  value: unknown
  onChange: (value: unknown) => void
  label: string
}) {
  const arity = operatorArity(op)

  if (arity === 'none') {
    return <p className="px-1 py-2 text-body-13 text-text-secondary">No value needed</p>
  }

  if (meta?.type === 'boolean') {
    return (
      <Select
        selectSize="sm"
        aria-label={label}
        value={value === true ? 'true' : value === false ? 'false' : ''}
        placeholder="Choose"
        onChange={(e) => onChange(e.target.value === 'true')}
        options={[
          { value: 'true', label: 'True' },
          { value: 'false', label: 'False' },
        ]}
      />
    )
  }

  if (meta?.type === 'enum' && meta.options) {
    if (arity === 'many') {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className="flex flex-wrap gap-1.5">
          {meta.options.map((o) => {
            const on = selected.includes(o.value)
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                className={`rounded-lg border px-2 py-1 text-body-12 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  on ? 'border-accent bg-accent-subtle text-accent' : 'border-border-strong text-text-secondary hover:bg-surface-hover'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      )
    }
    return (
      <Select
        selectSize="sm"
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        placeholder="Choose a value"
        onChange={(e) => onChange(e.target.value)}
        options={meta.options}
      />
    )
  }

  if (meta?.type === 'money') {
    return (
      <CurrencyInput
        inputSize="sm"
        aria-label={label}
        value={typeof value === 'number' ? value : null}
        onChange={(kobo) => onChange(kobo)}
      />
    )
  }

  if (meta?.type === 'number') {
    return (
      <Input
        inputSize="sm"
        type="number"
        aria-label={label}
        value={typeof value === 'number' ? String(value) : ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
    )
  }

  if (meta?.type === 'date') {
    return (
      <Input
        inputSize="sm"
        type="date"
        aria-label={label}
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  return (
    <Input
      inputSize="sm"
      aria-label={label}
      placeholder={arity === 'many' ? 'Comma-separated values' : 'Value'}
      value={
        Array.isArray(value)
          ? (value as string[]).join(', ')
          : value === null || value === undefined
            ? ''
            : String(value)
      }
      onChange={(e) =>
        onChange(arity === 'many' ? e.target.value.split(',').map((v) => v.trim()).filter(Boolean) : e.target.value)
      }
    />
  )
}

export interface ConditionEditorProps {
  group: ConditionGroup
  onChange: (group: ConditionGroup) => void
  depth?: number
  showSummary?: boolean
  emptyHint?: string
  fields?: FieldMeta[]
}

export function ConditionEditor({
  group,
  onChange,
  depth = 0,
  showSummary = true,
  emptyHint = 'No rows yet. Without a condition, every trigger passes straight through.',
  fields = FIELDS,
}: ConditionEditorProps) {
  const setRule = (index: number, patch: Partial<ConditionRule>) => {
    const rules = group.rules.map((r, i) => (i === index && !isGroup(r) ? { ...(r as ConditionRule), ...patch } : r))
    onChange({ ...group, rules })
  }

  const setNested = (index: number, nested: ConditionGroup) => {
    onChange({ ...group, rules: group.rules.map((r, i) => (i === index ? nested : r)) })
  }

  const removeAt = (index: number) => {
    onChange({ ...group, rules: group.rules.filter((_, i) => i !== index) })
  }

  const addRule = () => {
    onChange({ ...group, rules: [...group.rules, { field: '', op: 'is', value: '' }] })
  }

  const addGroup = () => {
    onChange({ ...group, rules: [...group.rules, emptyGroup(group.operator === 'and' ? 'or' : 'and')] })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-label-11 uppercase tracking-wide text-text-label">Match</span>
        <div className="inline-flex overflow-hidden rounded-lg border border-border-strong" role="group" aria-label="Match all or any">
          {(['and', 'or'] as const).map((op) => (
            <button
              key={op}
              type="button"
              aria-pressed={group.operator === op}
              onClick={() => onChange({ ...group, operator: op })}
              className={`px-3 py-1 text-body-12 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                group.operator === op ? 'bg-accent text-on-accent' : 'bg-surface text-text-secondary hover:bg-surface-hover'
              }`}
            >
              {op === 'and' ? 'All of these' : 'Any of these'}
            </button>
          ))}
        </div>
      </div>

      {group.rules.length === 0 && <p className="text-body-13 text-text-secondary">{emptyHint}</p>}

      <ul className="flex flex-col gap-2">
        {group.rules.map((rule, index) => {
          if (isGroup(rule)) {
            return (
              <li key={`group-${index}`} className="rounded-xl border border-border bg-surface-sunken p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-label-11 uppercase tracking-wide text-text-label">Nested group</span>
                  <IconButton
                    icon={Trash2}
                    label="Remove this nested group"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAt(index)}
                  />
                </div>
                <ConditionEditor
                  group={rule}
                  onChange={(next) => setNested(index, next)}
                  depth={depth + 1}
                  showSummary={false}
                  fields={fields}
                />
              </li>
            )
          }

          const r = rule as ConditionRule
          const meta = fieldMeta(r.field)
          const ops = operatorsFor(meta?.type)
          return (
            <li key={`rule-${index}`} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] items-start gap-2">
              <FieldSelect
                value={r.field}
                onChange={(path) => setRule(index, { field: path, value: '' })}
                label={`Row ${index + 1} field`}
                fields={fields}
              />
              <Select
                selectSize="sm"
                aria-label={`Row ${index + 1} operator`}
                value={r.op}
                onChange={(e) => setRule(index, { op: e.target.value })}
                options={ops.map((o) => ({ value: o.op, label: o.label }))}
              />
              <ValueInput
                meta={meta}
                op={r.op}
                value={r.value}
                onChange={(value) => setRule(index, { value })}
                label={`Row ${index + 1} value`}
              />
              <IconButton
                icon={Trash2}
                label={`Remove row ${index + 1}`}
                variant="ghost"
                size="sm"
                onClick={() => removeAt(index)}
              />
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={addRule} leftIcon={<Plus size={16} />}>
          Add condition
        </Button>
        {depth === 0 && (
          <Button size="sm" variant="ghost" onClick={addGroup} leftIcon={<Plus size={16} />}>
            Add nested group
          </Button>
        )}
      </div>

      {showSummary && (
        <p className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-body-13 text-text">
          {groupText(group)}
        </p>
      )}
    </div>
  )
}
