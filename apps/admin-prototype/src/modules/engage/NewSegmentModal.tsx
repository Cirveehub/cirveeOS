import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import {
  Button,
  Field,
  IconButton,
  Input,
  Modal,
  PersonChip,
  Radio,
  RadioGroup,
  Select,
  Textarea,
} from '@/ui'
import { peopleCollection, segmentsCollection, useCollection } from '@/mocks'

import {
  SEGMENT_FIELDS,
  findField,
  operatorLabel,
  resolveMembers,
  summarise,
  type DraftRule,
  type OperatorKey,
} from './segment-fields'
import { createSegment } from './writes'

const MIN_NAME = 4

function blankRule(): DraftRule {
  const field = SEGMENT_FIELDS[0]
  return {
    id: `rule-${Math.random().toString(36).slice(2, 9)}`,
    field: field.key,
    operator: field.operators[0],
    value: '',
  }
}

export function NewSegmentModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean
  onClose: () => void
  onDone: (message: string) => void
}) {
  const segments = useCollection(segmentsCollection)
  const people = useCollection(peopleCollection)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [operator, setOperator] = useState<'and' | 'or'>('and')
  const [rules, setRules] = useState<DraftRule[]>([blankRule()])
  const [touched, setTouched] = useState(false)

  const members = useMemo(() => resolveMembers(operator, rules), [operator, rules])
  const summary = summarise(operator, rules)

  const sample = useMemo(() => {
    const ids = [...members].slice(0, 8)
    return ids
      .map((id) => people.find((p) => (p.id as string) === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined)
  }, [members, people])

  const duplicate = segments.some((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())
  const nameError =
    name.trim().length < MIN_NAME
      ? 'Give the audience a name of at least four characters.'
      : duplicate
        ? 'An audience already carries this name. Two with the same name is how the wrong one gets picked.'
        : undefined
  const descriptionError =
    description.trim().length < 10 ? 'Say in a sentence who this is and why you would message them.' : undefined
  const rulesError = rules.every((rule) => rule.value === '')
    ? 'Add at least one rule. An audience with no rules would resolve to nobody.'
    : undefined
  const valid = !nameError && !descriptionError && !rulesError

  function reset() {
    setName('')
    setDescription('')
    setOperator('and')
    setRules([blankRule()])
    setTouched(false)
  }

  function patchRule(id: string, patch: Partial<DraftRule>) {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)))
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New audience"
      description="Who a campaign will go to. Resolved fresh from Person records every time it is used."
      size="xl"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!valid) return
              const segment = createSegment({
                name: name.trim(),
                description: description.trim(),
                operator,
                rules,
              })
              reset()
              onDone(
                `${segment.name} created. It resolves to ${formatNumber(segment.memberCount)} ${segment.memberCount === 1 ? 'person' : 'people'} right now — the count is recomputed from Person records every time, not stored as a list.`,
              )
              onClose()
            }}
          >
            Create audience
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Name" required error={touched || name.length > 0 ? nameError : undefined}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Alumni in Lagos who have not enrolled again"
          />
        </Field>

        <Field label="Who this is, and why you would message them" required error={touched ? descriptionError : undefined}>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            maxLength={200}
            showCount
            placeholder="Re-engagement target for the advanced cohorts — they finished a course but never came back."
          />
        </Field>

        <RadioGroup
          legend="Include a person when they match"
          description="All: a person must match every rule. Any: matching one rule is enough."
          orientation="horizontal"
        >
          <Radio
            name="segment-operator"
            value="and"
            checked={operator === 'and'}
            onChange={() => setOperator('and')}
            label="All of them"
          />
          <Radio
            name="segment-operator"
            value="or"
            checked={operator === 'or'}
            onChange={() => setOperator('or')}
            label="Any of them"
          />
        </RadioGroup>

        {/* ---- the rules ---- */}
        <section className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-label-11 text-text-muted">Rules</span>
            <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => setRules((prev) => [...prev, blankRule()])}>
              Add rule
            </Button>
          </div>
          <ul className="divide-y divide-border">
            {rules.map((rule) => {
              const field = findField(rule.field)
              const options = field?.options() ?? []
              return (
                <li key={rule.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.7fr)_minmax(0,1.2fr)_auto] sm:items-end">
                  <Field label="Attribute or behaviour" hint={field?.hint}>
                    <Select
                      value={rule.field}
                      options={SEGMENT_FIELDS.map((f) => ({ value: f.key, label: `${f.group} · ${f.label}` }))}
                      onChange={(event) => {
                        const next = findField(event.target.value)
                        patchRule(rule.id, {
                          field: event.target.value,
                          operator: next?.operators[0] ?? 'is',
                          value: '',
                        })
                      }}
                    />
                  </Field>
                  <Field label="Operator">
                    <Select
                      value={rule.operator}
                      options={(field?.operators ?? ['is']).map((op) => ({ value: op, label: operatorLabel(op as OperatorKey) }))}
                      onChange={(event) => patchRule(rule.id, { operator: event.target.value as OperatorKey })}
                    />
                  </Field>
                  <Field label="Value">
                    {field?.input === 'number' ? (
                      <Input
                        type="number"
                        min={0}
                        value={rule.value}
                        onChange={(event) => patchRule(rule.id, { value: event.target.value })}
                      />
                    ) : (
                      <Select
                        value={rule.value}
                        placeholder="Pick a value"
                        options={options}
                        onChange={(event) => patchRule(rule.id, { value: event.target.value })}
                      />
                    )}
                  </Field>
                  <IconButton
                    icon={Trash2}
                    label="Remove this rule"
                    variant="ghost"
                    disabled={rules.length === 1}
                    onClick={() => setRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  />
                </li>
              )
            })}
          </ul>
          {touched && rulesError && (
            <p className="border-t border-border px-4 py-2.5 text-body-13 text-danger-text">{rulesError}</p>
          )}
        </section>

        {/* ---- the live resolution ---- */}
        <section className="rounded-xl border border-border p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-label-11 text-text-muted">Resolves to, right now</span>
            <span className="text-heading-24 tabular-nums text-text">{formatNumber(members.size)}</span>
          </div>
          <p className="mt-1 text-body-13 text-text-secondary">{summary}</p>
          {members.size === 0 ? (
            <p className="mt-3 text-body-13 text-warning-text">
              Nobody matches these rules yet. Saving would create an audience nothing can be sent to — widen a rule, or
              switch to Any of them.
            </p>
          ) : (
            <>
              <p className="mt-3 text-label-11 text-text-muted">Sample of who is in it</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {sample.map((person) => (
                  <li key={person.id as string}>
                    <PersonChip name={`${person.firstName} ${person.lastName}`} size="sm" />
                  </li>
                ))}
              </ul>
              {members.size > sample.length && (
                <p className="mt-2 text-body-12 text-text-secondary">
                  and {formatNumber(members.size - sample.length)} more. Membership resolves again at send time, so
                  somebody who qualifies tomorrow is included tomorrow.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  )
}
