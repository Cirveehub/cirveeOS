/**
 * Duplicate review queue — §2.11.
 *
 * This route used to alias `LeadList`, so the merge engine in
 * `lib/writes.ts` — `mergePeople()` — had no caller at all. It now has one.
 *
 * Split pane: candidate pairs on the left with match score and matched fields,
 * a field-by-field comparison on the right. The three answers match the ones
 * `NewLead.tsx`'s own duplicate panel offers, because a reviewer should not
 * have to learn two vocabularies for the same decision: **merge** (choosing the
 * surviving value per conflicting field), **not a duplicate** (recorded so the
 * pair never resurfaces) or **skip**.
 *
 * Nothing is deleted by a merge. The losing record is marked
 * `mergedIntoPersonId` and archived; every lead, admission, activity and
 * relationship is repointed so both timelines survive on the survivor.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck, Merge, SkipForward, Users } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  PersonChip,
  Radio,
  SkeletonCard,
  Tabs,
  Textarea,
} from '@/ui'
import { formatDate, formatPhone } from '@/lib/format'
import {
  duplicateCandidatesCollection,
  peopleCollection,
  relationshipsCollection,
  useCollection,
} from '@/mocks'
import type { DuplicateStatus, Person, PersonId } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { toast } from '../components/Toasts'
import { attachedRecords, describeAttached } from '../lib/duplicates'
import { RELATIONSHIP_LABELS, personFullName } from '../lib/lookups'
import { useQueryState, useScreenLoad } from '../lib/view-state'
import { mergePeople, resolveDuplicate } from '../lib/writes'

type MergeableField = 'firstName' | 'lastName' | 'email' | 'phone' | 'whatsapp' | 'city' | 'state'

const FIELDS: Array<{ key: MergeableField; label: string; phone?: boolean }> = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone', phone: true },
  { key: 'whatsapp', label: 'WhatsApp', phone: true },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
]

const QUEUES: Array<{ id: DuplicateStatus; label: string }> = [
  { id: 'open', label: 'Open' },
  { id: 'merged', label: 'Merged' },
  { id: 'not_duplicate', label: 'Not a duplicate' },
  { id: 'skipped', label: 'Skipped' },
]

function valueOf(person: Person | undefined, field: MergeableField): string {
  if (!person) return ''
  const raw = person[field]
  return typeof raw === 'string' ? raw : ''
}

export default function DuplicateQueue() {
  const query = useQueryState()
  const { loading, error, retry } = useScreenLoad('crm.duplicates')

  const candidates = useCollection(duplicateCandidatesCollection)
  const people = useCollection(peopleCollection)
  const relationships = useCollection(relationshipsCollection)

  const queue = (QUEUES.some((q) => q.id === query.get('queue'))
    ? query.get('queue')
    : 'open') as DuplicateStatus

  const rows = useMemo(
    () => candidates.filter((c) => c.status === queue).sort((a, b) => b.score - a.score),
    [candidates, queue],
  )

  const selectedId = query.get('pair') ?? rows[0]?.id ?? null
  const candidate = candidates.find((c) => c.id === selectedId) ?? rows[0]

  const personA = candidate ? people.find((p) => p.id === candidate.personAId) : undefined
  const personB = candidate ? people.find((p) => p.id === candidate.personBId) : undefined

  /* Which record survives, and which value wins for each conflicting field. */
  const [survivor, setSurvivor] = useState<'a' | 'b'>('a')
  const [choices, setChoices] = useState<Record<string, 'a' | 'b'>>({})
  const [mergeOpen, setMergeOpen] = useState(false)
  const [notDuplicateOpen, setNotDuplicateOpen] = useState(false)
  const [note, setNote] = useState('')

  const conflicts = useMemo(() => {
    if (!personA || !personB) return []
    return FIELDS.filter((field) => {
      const a = valueOf(personA, field.key)
      const b = valueOf(personB, field.key)
      return a !== b && (a !== '' || b !== '')
    })
  }, [personA, personB])

  const survivingPerson = survivor === 'a' ? personA : personB
  const mergedPerson = survivor === 'a' ? personB : personA

  const select = (id: string) => {
    query.set('pair', id)
    setSurvivor('a')
    setChoices({})
  }

  const runMerge = () => {
    if (!candidate || !survivingPerson || !mergedPerson) return

    const fieldChoices: Partial<Record<MergeableField, string>> = {}
    for (const field of conflicts) {
      const pick = choices[field.key] ?? survivor
      const winner = pick === 'a' ? personA : personB
      const value = valueOf(winner, field.key)
      if (value) fieldChoices[field.key] = value
    }

    const moved = mergePeople({
      survivingId: survivingPerson.id,
      mergedId: mergedPerson.id,
      fieldChoices,
    })
    resolveDuplicate(
      candidate,
      'merged',
      note.trim() ||
        `Merged into ${personFullName(survivingPerson)}. ${moved.movedLeads} leads, ${moved.movedAdmissions} admissions, ${moved.movedActivities} activities and ${moved.movedRelationships} relationships repointed.`,
    )

    toast({
      tone: 'success',
      title: `Merged into ${personFullName(survivingPerson)}`,
      body: `${moved.movedLeads} lead${moved.movedLeads === 1 ? '' : 's'}, ${moved.movedAdmissions} admission${moved.movedAdmissions === 1 ? '' : 's'} and ${moved.movedActivities} activit${moved.movedActivities === 1 ? 'y' : 'ies'} moved. Both timelines are preserved; nothing was deleted.`,
    })
    setMergeOpen(false)
    setNote('')
    query.set('pair', undefined)
  }

  const movesIfMerged = mergedPerson ? attachedRecords(mergedPerson.id) : null

  return (
    <CrmPage
      title="Duplicate review"
      description="One human being, one record. Every pair here is resolved by a person, never automatically."
      breadcrumbs={[{ label: 'CRM & admissions', to: '/crm' }, { label: 'Duplicates' }]}
      error={error}
      onRetry={retry}
      actions={
        <Button variant="secondary" asChild>
          <Link to="/crm/leads">Back to leads</Link>
        </Button>
      }
    >
      <Tabs
        aria-label="Duplicate queues"
        variant="pill"
        size="sm"
        className="mb-4"
        tabs={QUEUES.map((q) => ({
          id: q.id,
          label: q.label,
          badge: candidates.filter((c) => c.status === q.id).length || undefined,
        }))}
        value={queue}
        onChange={(id) => {
          query.setMany({ queue: id === 'open' ? undefined : id, pair: undefined })
        }}
      />

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={queue === 'open' ? CircleCheck : Users}
          title={queue === 'open' ? 'No possible duplicates in the queue' : 'Nothing in this queue'}
          message={
            queue === 'open'
              ? 'Every candidate pair has been resolved. New pairs arrive from the lead wizard and from a CSV import.'
              : 'Resolved pairs land here and stay visible — a merge decision is a record, not a deletion.'
          }
          action={
            <Button variant="secondary" asChild>
              <Link to="/crm/leads/new">New lead</Link>
            </Button>
          }
          bordered
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          {/* ---- candidate list ---- */}
          <Card padding="none">
            <CardHeader
              title={`${rows.length} pair${rows.length === 1 ? '' : 's'}`}
              description="Strongest match first."
              bare
            />
            <ul className="max-h-[calc(100vh-320px)] overflow-y-auto">
              {rows.map((row) => {
                const a = people.find((p) => p.id === row.personAId)
                const b = people.find((p) => p.id === row.personBId)
                const active = candidate?.id === row.id
                return (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => select(row.id)}
                      aria-current={active ? 'true' : undefined}
                      className={
                        active
                          ? 'flex w-full flex-col gap-1 border-l-2 border-accent bg-accent-subtle px-3 py-2.5 text-left'
                          : 'flex w-full flex-col gap-1 border-l-2 border-transparent px-3 py-2.5 text-left hover:bg-surface-hover'
                      }
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-body-14 font-medium text-text">
                          {personFullName(a)}
                        </span>
                        <Badge tone={row.score >= 80 ? 'danger' : 'warning'} variant="subtle" size="sm">
                          {row.score}%
                        </Badge>
                      </span>
                      <span className="min-w-0 truncate text-body-13 text-text-secondary">
                        against {personFullName(b)}
                      </span>
                      <span className="text-body-12 text-text-muted">
                        Matched on{' '}
                        {row.matchedFields.map((f) => f.replace('whatsapp', 'WhatsApp')).join(', ')}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>

          {/* ---- comparison ---- */}
          <div className="flex flex-col gap-4">
            {candidate && personA && personB ? (
              <>
                <Card>
                  <CardHeader
                    title="Side by side"
                    description="Matched fields are highlighted. Choose which record survives, then which value wins on each conflict."
                    actions={
                      <Badge tone={candidate.score >= 80 ? 'danger' : 'warning'} variant="subtle">
                        {candidate.score}% match
                      </Badge>
                    }
                  />
                  <CardBody>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SurvivorCard
                        person={personA}
                        label="Record A"
                        selected={survivor === 'a'}
                        onSelect={() => setSurvivor('a')}
                        relationshipLabels={relationships
                          .filter((r) => r.personId === personA.id && r.status === 'active')
                          .map((r) => RELATIONSHIP_LABELS[r.type])}
                      />
                      <SurvivorCard
                        person={personB}
                        label="Record B"
                        selected={survivor === 'b'}
                        onSelect={() => setSurvivor('b')}
                        relationshipLabels={relationships
                          .filter((r) => r.personId === personB.id && r.status === 'active')
                          .map((r) => RELATIONSHIP_LABELS[r.type])}
                      />
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] border-separate border-spacing-0">
                        <caption className="sr-only">
                          Field-by-field comparison of the two candidate records
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col" className="border-b border-border px-3 py-2 text-left text-label-11 text-text-label">
                              Field
                            </th>
                            <th scope="col" className="border-b border-border px-3 py-2 text-left text-label-11 text-text-label">
                              Record A
                            </th>
                            <th scope="col" className="border-b border-border px-3 py-2 text-left text-label-11 text-text-label">
                              Record B
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {FIELDS.map((field) => {
                            const a = valueOf(personA, field.key)
                            const b = valueOf(personB, field.key)
                            const matched = a !== '' && a === b
                            const conflicting = conflicts.some((c) => c.key === field.key)
                            const pick = choices[field.key] ?? survivor
                            const render = (value: string) =>
                              value ? (field.phone ? formatPhone(value) : value) : '—'

                            return (
                              <tr key={field.key}>
                                <th
                                  scope="row"
                                  className="border-b border-border px-3 py-2 text-left text-body-13 font-medium text-text"
                                >
                                  {field.label}
                                </th>
                                {(['a', 'b'] as const).map((side) => {
                                  const value = side === 'a' ? a : b
                                  return (
                                    <td
                                      key={side}
                                      className={
                                        matched
                                          ? 'border-b border-border bg-warning-fill px-3 py-2 text-body-13 text-warning-ink'
                                          : 'border-b border-border px-3 py-2 text-body-13 text-text'
                                      }
                                    >
                                      {conflicting ? (
                                        <Radio
                                          name={`merge-${field.key}`}
                                          checked={pick === side}
                                          onChange={() =>
                                            setChoices((c) => ({ ...c, [field.key]: side }))
                                          }
                                          label={render(value)}
                                        />
                                      ) : (
                                        render(value)
                                      )}
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {conflicts.length === 0 && (
                      <Alert tone="info" title="Nothing conflicts" className="mt-4">
                        Both records carry the same values on every field compared. The merge simply
                        folds one timeline into the other.
                      </Alert>
                    )}
                  </CardBody>
                </Card>

                {candidate.status === 'open' ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      leftIcon={<Merge size={16} aria-hidden="true" />}
                      onClick={() => setMergeOpen(true)}
                    >
                      Merge into {personFullName(survivingPerson)}
                    </Button>
                    <Button variant="secondary" onClick={() => setNotDuplicateOpen(true)}>
                      Not a duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      leftIcon={<SkipForward size={16} aria-hidden="true" />}
                      onClick={() => {
                        resolveDuplicate(candidate, 'skipped', 'Skipped for now.')
                        toast({
                          tone: 'info',
                          title: 'Pair skipped',
                          body: 'It stays in the skipped queue rather than disappearing.',
                        })
                        query.set('pair', undefined)
                      }}
                    >
                      Skip
                    </Button>
                  </div>
                ) : (
                  <Alert
                    tone={candidate.status === 'merged' ? 'success' : 'info'}
                    title={`This pair was resolved as ${candidate.status.replace(/_/g, ' ')}`}
                  >
                    {candidate.resolutionNote ?? 'No note recorded.'}
                    {candidate.resolvedAt && ` · ${formatDate(candidate.resolvedAt)}`}
                  </Alert>
                )}
              </>
            ) : (
              <EmptyState
                size="sm"
                title="Choose a pair"
                message="Pick a candidate on the left to compare the two records field by field."
              />
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        onConfirm={runMerge}
        title={`Merge into ${personFullName(survivingPerson)}?`}
        confirmLabel="Merge records"
        size="lg"
      >
        <div className="flex flex-col gap-3">
          <p className="text-body-14 text-text">
            {movesIfMerged ? describeAttached(movesIfMerged) : 'Nothing'} will attach to{' '}
            {personFullName(survivingPerson)}. Both timelines are preserved.{' '}
            {personFullName(mergedPerson)} is not deleted — the record is archived and marked as
            merged into the survivor, so any old link still resolves.
          </p>
          {conflicts.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-xl border border-border bg-surface-sunken p-3 text-body-13">
              {conflicts.map((field) => {
                const pick = choices[field.key] ?? survivor
                const winner = pick === 'a' ? personA : personB
                return (
                  <li key={field.key} className="flex justify-between gap-3">
                    <span className="text-text-secondary">{field.label}</span>
                    <span className="font-medium text-text">
                      {valueOf(winner, field.key) || '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <Field label="Note" optional hint="Recorded on the resolution and in the audit log.">
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Same person — she enquired twice, once through the website and once at the open day."
            />
          </Field>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={notDuplicateOpen}
        onClose={() => setNotDuplicateOpen(false)}
        onConfirm={() => {
          if (!candidate) return
          resolveDuplicate(
            candidate,
            'not_duplicate',
            note.trim() || 'Confirmed as two different people.',
          )
          toast({
            tone: 'success',
            title: 'Recorded as two different people',
            body: 'This pair will not resurface in the queue.',
          })
          setNotDuplicateOpen(false)
          setNote('')
          query.set('pair', undefined)
        }}
        title="These are two different people?"
        confirmLabel="Record the decision"
      >
        <div className="flex flex-col gap-3">
          <p className="text-body-14 text-text">
            The decision is recorded against the pair so it never resurfaces, and it is audited.
            Neither record changes.
          </p>
          <Field label="Why" optional hint="Helps whoever meets the same pair from an import later.">
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Twin sisters. Same household phone, different people — confirmed on the call."
            />
          </Field>
        </div>
      </ConfirmDialog>
    </CrmPage>
  )
}

/* -------------------------------------------------------------------------- */
/* Survivor card                                                              */
/* -------------------------------------------------------------------------- */

function SurvivorCard({
  person,
  label,
  selected,
  onSelect,
  relationshipLabels,
}: {
  person: Person
  label: string
  selected: boolean
  onSelect: () => void
  relationshipLabels: string[]
}) {
  const records = attachedRecords(person.id as PersonId)

  return (
    <div
      className={
        selected
          ? 'rounded-xl border-2 border-accent bg-accent-subtle p-3'
          : 'rounded-xl border border-border bg-surface p-3'
      }
    >
      <Radio
        name="merge-survivor"
        checked={selected}
        onChange={onSelect}
        label={`${label} survives`}
      />
      <div className="mt-2">
        <PersonChip name={personFullName(person)} size="sm" role={person.email ?? 'No email'} />
      </div>
      <dl className="mt-2 flex flex-col gap-0.5 text-body-12">
        <div className="flex gap-1.5">
          <dt className="text-text-muted">Created</dt>
          <dd className="text-text-secondary">{formatDate(person.createdAt)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-text-muted">Attached</dt>
          <dd className="text-text-secondary">{describeAttached(records)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-text-muted">Relationships</dt>
          <dd className="text-text-secondary">
            {relationshipLabels.length ? relationshipLabels.join(', ') : 'None yet'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
