/**
 * The duplicate panel.
 *
 * Fires on blur of email, phone or WhatsApp, **before any Person is written**.
 * On a likely match the user chooses: use the existing record, take the pair
 * to the merge queue, or create anyway with a reason that is audited. The PRD
 * treats this as the gate on the identity layer, and Flow 1 step 3 opens with
 * it.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleAlert, Spline } from 'lucide-react'
import { Badge, Button, Field, PersonChip, Spinner, Textarea } from '@/ui'
import { formatDate, formatPhone } from '@/lib/format'
import { relationshipsCollection, useCollection } from '@/mocks'
import type { Person } from '@/mocks/types'
import type { DuplicateMatch } from '../lib/duplicates'
import { attachedRecords, describeAttached } from '../lib/duplicates'
import { RELATIONSHIP_LABELS, personFullName, userName } from '../lib/lookups'

export interface DuplicatePanelProps {
  checking: boolean
  matches: DuplicateMatch[]
  onUseExisting: (person: Person) => void
  onMerge: (person: Person) => void
  /** Called once the reviewer supplies a reason for overriding the check. */
  onCreateAnyway: (person: Person, reason: string) => void
}

export function DuplicatePanel({
  checking,
  matches,
  onUseExisting,
  onMerge,
  onCreateAnyway,
}: DuplicatePanelProps) {
  const [overrideFor, setOverrideFor] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const relationships = useCollection(relationshipsCollection)

  if (checking) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-sunken px-3 py-2.5 text-body-13 text-text-secondary">
        <Spinner size="xs" label="Checking for an existing person" />
        Checking email, phone and WhatsApp against existing people…
      </div>
    )
  }

  if (!matches.length) return null

  return (
    <div className="rounded-xl border border-warning-line bg-warning-fill p-3 text-warning-ink">
      <div className="flex items-start gap-2">
        <CircleAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <h3 className="text-body-14 font-semibold">
            Possible duplicate — {matches.length === 1 ? 'one existing person matches' : `${matches.length} existing people match`}
          </h3>
          <p className="mt-0.5 text-body-13">
            Nothing has been written yet. Choose what to do before this lead is created.
          </p>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {matches.map((match) => {
          const person = match.person
          const records = attachedRecords(person.id)
          const types = relationships
            .filter((r) => r.personId === person.id && r.status === 'active')
            .map((r) => RELATIONSHIP_LABELS[r.type])

          return (
            <li key={person.id} className="rounded-lg border border-border bg-surface p-3 text-text">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <PersonChip
                    name={personFullName(person)}
                    role={person.email ?? (person.phone ? formatPhone(person.phone) : 'No contact details')}
                  />
                  <dl className="mt-2 grid gap-x-6 gap-y-1 text-body-12 sm:grid-cols-2">
                    <Detail label="Created">{formatDate(person.createdAt)}</Detail>
                    <Detail label="Matched on">
                      {match.matchedFields.map((f) => f.replace('whatsapp', 'WhatsApp')).join(', ')}
                    </Detail>
                    <Detail label="Relationships">
                      {types.length ? types.join(', ') : 'None yet'}
                    </Detail>
                    <Detail label="Attached records">{describeAttached(records)}</Detail>
                    <Detail label="Last activity">
                      {records.lastActivityAt ? formatDate(records.lastActivityAt) : 'No activity yet'}
                    </Detail>
                    <Detail label="Created by">{userName(person.createdBy)}</Detail>
                  </dl>
                </div>
                <Badge tone="warning" variant="subtle">
                  {match.score}% match
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={() => onUseExisting(person)}>
                  Use existing person
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<Spline size={14} aria-hidden="true" />}
                  onClick={() => onMerge(person)}
                >
                  Merge
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setOverrideFor(overrideFor === person.id ? null : person.id)
                    setReason('')
                    setTouched(false)
                  }}
                  aria-expanded={overrideFor === person.id}
                >
                  Create anyway
                </Button>
                <Link
                  to="/crm/leads"
                  className="ml-auto rounded-lg text-body-13 font-medium text-accent underline-offset-2 hover:underline"
                >
                  Open record
                </Link>
              </div>

              {overrideFor === person.id && (
                <div className="mt-3 border-t border-border pt-3">
                  <Field
                    label="Why is this a different person?"
                    required
                    hint="Recorded as an audited duplicate override against the new record."
                    error={touched && !reason.trim() ? 'A reason is required before a second record is created.' : undefined}
                  >
                    <Textarea
                      rows={2}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Twin sister. Same household phone, different person — confirmed on the call."
                    />
                  </Field>
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setOverrideFor(null)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        setTouched(true)
                        if (!reason.trim()) return
                        onCreateAnyway(person, reason.trim())
                      }}
                      disabled={!reason.trim()}
                    >
                      Create a separate person
                    </Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 truncate text-text-secondary">{children}</dd>
    </div>
  )
}
