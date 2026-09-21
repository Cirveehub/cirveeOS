/**
 * Person and staff pickers.
 *
 * Referrer, lead owner and closer are three independent fields, so they get
 * three independent pickers. Nothing here derives one from another, and each
 * one clears on its own.
 */

import { useMemo, useState } from 'react'
import { Check, ChevronDown, UserSearch, X } from 'lucide-react'
import {
  Button,
  PersonChip,
  Popover,
  SearchInput,
  Select,
  type SelectOption,
} from '@/ui'
import { relationshipsCollection, useCollection, peopleCollection } from '@/mocks'
import type { PersonId, UserId } from '@/mocks/types'
import { RELATIONSHIP_LABELS, personFullName, useDirectory, userRoleName } from '../lib/lookups'

/* -------------------------------------------------------------------------- */
/* Person picker                                                              */
/* -------------------------------------------------------------------------- */

export interface PersonPickerProps {
  value: PersonId | null
  onChange: (value: PersonId | null) => void
  /** Accessible name for the trigger when there is no visible label. */
  label: string
  placeholder?: string
  /** Narrow the list to people holding this relationship — referrers, say. */
  relationship?: 'referrer' | 'student' | 'alumnus'
  id?: string
  disabled?: boolean
}

export function PersonPicker({
  value,
  onChange,
  label,
  placeholder = 'Search by name, email or phone',
  relationship,
  id,
  disabled = false,
}: PersonPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const people = useCollection(peopleCollection)
  const relationships = useCollection(relationshipsCollection)

  const eligibleIds = useMemo(() => {
    if (!relationship) return null
    return new Set(
      relationships
        .filter((r) => r.type === relationship && r.status === 'active')
        .map((r) => r.personId as string),
    )
  }, [relationships, relationship])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return people
      .filter((p) => !p.mergedIntoPersonId)
      .filter((p) => !eligibleIds || eligibleIds.has(p.id as string))
      .filter((p) => {
        if (!q) return true
        return (
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q) ||
          (p.email ?? '').toLowerCase().includes(q) ||
          (p.phone ?? '').includes(q)
        )
      })
      .slice(0, 40)
  }, [people, eligibleIds, query])

  const selected = value ? people.find((p) => p.id === value) : undefined

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      role="dialog"
      width={340}
      content={
        <div className="flex flex-col gap-2 p-2">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={placeholder}
            inputSize="sm"
            aria-label={`Search people for ${label.toLowerCase()}`}
          />
          <ul className="max-h-72 overflow-y-auto">
            {results.length === 0 && (
              <li className="px-2 py-6 text-center text-body-13 text-text-secondary">
                No person matches “{query}”. Check the spelling, or leave this field empty.
              </li>
            )}
            {results.map((person) => {
              const types = relationships
                .filter((r) => r.personId === person.id && r.status === 'active')
                .map((r) => RELATIONSHIP_LABELS[r.type])
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(person.id)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <PersonChip
                      name={personFullName(person)}
                      size="sm"
                      role={types.length ? types.join(' · ') : (person.email ?? 'No relationships yet')}
                    />
                    {person.id === value && (
                      <Check size={14} aria-hidden="true" className="ml-auto text-accent" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      }
    >
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-label={label}
        className="flex h-9 w-full items-center gap-2 rounded-xl border border-border bg-surface px-2.5 text-left text-body-14 transition-colors hover:border-border-strong disabled:cursor-not-allowed disabled:bg-surface-sunken"
      >
        {selected ? (
          <PersonChip name={personFullName(selected)} size="sm" />
        ) : (
          <span className="flex items-center gap-2 text-text-muted">
            <UserSearch size={16} aria-hidden="true" />
            Not set
          </span>
        )}
        <ChevronDown size={14} aria-hidden="true" className="ml-auto shrink-0 text-text-muted" />
      </button>
    </Popover>
  )
}

export function PersonPickerRow({
  value,
  onChange,
  label,
  relationship,
  id,
  disabled,
}: PersonPickerProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <PersonPicker
          value={value}
          onChange={onChange}
          label={label}
          relationship={relationship}
          id={id}
          disabled={disabled}
        />
      </div>
      {value && !disabled && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          leftIcon={<X size={14} aria-hidden="true" />}
        >
          Clear
        </Button>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Staff picker                                                               */
/* -------------------------------------------------------------------------- */

export interface UserPickerProps {
  value: UserId | null
  onChange: (value: UserId | null) => void
  id?: string
  'aria-label'?: string
  allowEmpty?: boolean
  emptyLabel?: string
  invalid?: boolean
  disabled?: boolean
}

export function UserPicker({
  value,
  onChange,
  id,
  allowEmpty = false,
  emptyLabel = 'Not set',
  invalid,
  disabled,
  ...rest
}: UserPickerProps) {
  const { staffOptions } = useDirectory()
  const options: SelectOption[] = staffOptions.map((option) => ({
    value: option.value,
    label: userRoleName(option.value as UserId)
      ? `${option.label} · ${userRoleName(option.value as UserId)}`
      : option.label,
  }))

  return (
    <Select
      id={id}
      aria-label={rest['aria-label']}
      value={(value as string | null) ?? ''}
      invalid={invalid}
      disabled={disabled}
      onChange={(event) => onChange((event.target.value || null) as UserId | null)}
      options={allowEmpty ? [{ value: '', label: emptyLabel }, ...options] : options}
      placeholder={allowEmpty ? undefined : 'Choose a person'}
    />
  )
}
