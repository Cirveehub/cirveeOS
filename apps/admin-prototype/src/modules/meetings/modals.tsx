/**
 * The module's three creation flows.
 *
 * All three are single modals rather than wizards, following
 * `referral/Referrers.tsx`'s `NewReferrerModal`: each creates one self-contained
 * record with no step that depends on a decision made in an earlier step.
 *
 * The decision modal is the exception worth reading. A decision is never
 * edited; when one replaces another, this writes a *new* decision and links the
 * predecessor forward as superseded or reversed, exactly as
 * `referral/Ledger.tsx` handles a correction.
 */

import { useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Field,
  IconButton,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/ui'
import { TODAY, decisionsCollection, meetingsCollection, peopleCollection, useCollection, usersCollection } from '@/mocks'
import type {
  ActionItemStatus,
  Decision,
  DecisionId,
  Meeting,
  MeetingId,
  MeetingType,
  PersonId,
  UserId,
} from '@/mocks'
import { formatDate } from '@/lib/format'

import {
  ACTION_STATUS_LABEL,
  MEETING_TYPE_LABEL,
  MEETING_TYPE_ORDER,
  useUserName,
} from './parts'
import {
  addActionItem,
  logDecision,
  logMeeting,
  type LogMeetingResult,
} from './writes'

/* -------------------------------------------------------------------------- */
/* Shared option builders                                                     */
/* -------------------------------------------------------------------------- */

function useUserOptions(): Array<{ value: string; label: string }> {
  const users = useCollection(usersCollection)
  const userName = useUserName()
  return useMemo(
    () =>
      users
        .filter((u) => u.status === 'active')
        .map((u) => ({ value: u.id as string, label: userName(u.id) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [users, userName],
  )
}

/* -------------------------------------------------------------------------- */
/* Log a meeting                                                              */
/* -------------------------------------------------------------------------- */

interface AgendaDraft {
  key: number
  title: string
  ownerUserId: string
  timeboxMinutes: number
}

export function NewMeetingModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (result: LogMeetingResult) => void
}) {
  const users = useCollection(usersCollection)
  const people = useCollection(peopleCollection)
  const userOptions = useUserOptions()
  const userName = useUserName()

  const [title, setTitle] = useState('')
  const [type, setType] = useState<MeetingType>('weekly_leadership')
  const [date, setDate] = useState(TODAY)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [chair, setChair] = useState('')
  const [location, setLocation] = useState('Bodija HQ seminar room')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])
  const [agenda, setAgenda] = useState<AgendaDraft[]>([
    { key: 1, title: '', ownerUserId: '', timeboxMinutes: 15 },
  ])
  const [touched, setTouched] = useState(false)

  /* Attendance is stored against people; the picker lists the users who hold accounts. */
  const attendeeOptions = useMemo(() => {
    const names = new Map(people.map((p) => [p.id as string, `${p.firstName} ${p.lastName}`]))
    return users
      .filter((u) => u.status === 'active')
      .map((u) => ({ userId: u.id as string, personId: u.personId as string, name: names.get(u.personId) ?? u.email }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [users, people])

  const status: Meeting['status'] = date <= TODAY ? 'held' : 'scheduled'

  const titleError = touched && title.trim() === '' ? 'Give the sitting a name.' : undefined
  const chairError = touched && chair === '' ? 'Every meeting has a chair. Name them.' : undefined
  const attendeeError =
    touched && attendees.length === 0 ? 'Record who was in the room, even if it was one person.' : undefined
  const agendaError =
    touched && agenda.every((item) => item.title.trim() === '')
      ? 'A meeting with no agenda has no time-boxes and no owners.'
      : undefined

  const reset = () => {
    setTitle('')
    setDate(TODAY)
    setTime('10:00')
    setDuration(60)
    setChair('')
    setMeetingUrl('')
    setAttendees([])
    setAgenda([{ key: 1, title: '', ownerUserId: '', timeboxMinutes: 15 }])
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    const items = agenda.filter((item) => item.title.trim() !== '')
    if (title.trim() === '' || chair === '' || attendees.length === 0 || items.length === 0) return

    const result = logMeeting({
      title,
      type,
      date,
      time,
      durationMinutes: duration,
      chairUserId: chair as UserId,
      location,
      meetingUrl,
      attendeePersonIds: attendees as PersonId[],
      agendaItems: items.map((item) => ({
        title: item.title.trim(),
        ownerUserId: (item.ownerUserId || chair) as UserId,
        timeboxMinutes: item.timeboxMinutes,
        notes: '',
      })),
      status,
    })
    onCreated(result)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Log a meeting"
      description="Records the sitting, its agenda and who was there. Unresolved actions from the last meeting of this type are swept onto the new agenda automatically."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Log meeting</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" required error={titleError}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(titleError)}
            placeholder="Weekly leadership — week 38"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type" required>
            <Select
              value={type}
              options={MEETING_TYPE_ORDER.map((t) => ({ value: t, label: MEETING_TYPE_LABEL[t] }))}
              onChange={(e) => setType(e.target.value as MeetingType)}
            />
          </Field>
          <Field label="Chair" required error={chairError}>
            <Select
              value={chair}
              placeholder="Choose the chair"
              options={userOptions}
              onChange={(e) => setChair(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" required hint={status === 'held' ? 'Recorded as held' : 'Recorded as scheduled'}>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Start time" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field label="Duration" required hint="Minutes">
            <Input
              type="number"
              min={5}
              step={5}
              value={String(duration)}
              onChange={(e) => setDuration(Math.max(5, Number(e.target.value) || 5))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location" optional>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} />
          </Field>
          <Field label="Meeting link" optional>
            <Input
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="https://meet.cirvee.com/leadership"
            />
          </Field>
        </div>

        <Field
          label="Attendees"
          required
          error={attendeeError}
          hint={`${attendees.length} selected. Attendance can be upgraded to an NFC tap by the reader on the room door.`}
        >
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border p-2">
            <ul className="space-y-1">
              {attendeeOptions.map((option) => (
                <li key={option.userId}>
                  <Checkbox
                    label={option.name}
                    checked={attendees.includes(option.personId)}
                    onChange={() =>
                      setAttendees((prev) =>
                        prev.includes(option.personId)
                          ? prev.filter((id) => id !== option.personId)
                          : [...prev, option.personId],
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        </Field>

        <Field label="Agenda" required error={agendaError}>
          <div className="space-y-2">
            {agenda.map((item, index) => (
              <div key={item.key} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_180px_96px_auto]">
                <Input
                  value={item.title}
                  aria-label={`Agenda item ${index + 1} title`}
                  placeholder="Pipeline review — Ibadan"
                  onChange={(e) =>
                    setAgenda((prev) =>
                      prev.map((row) => (row.key === item.key ? { ...row, title: e.target.value } : row)),
                    )
                  }
                />
                <Select
                  value={item.ownerUserId}
                  aria-label={`Agenda item ${index + 1} owner`}
                  placeholder="Owner"
                  options={userOptions}
                  onChange={(e) =>
                    setAgenda((prev) =>
                      prev.map((row) =>
                        row.key === item.key ? { ...row, ownerUserId: e.target.value } : row,
                      ),
                    )
                  }
                />
                <Input
                  type="number"
                  min={5}
                  step={5}
                  aria-label={`Agenda item ${index + 1} time-box in minutes`}
                  value={String(item.timeboxMinutes)}
                  onChange={(e) =>
                    setAgenda((prev) =>
                      prev.map((row) =>
                        row.key === item.key
                          ? { ...row, timeboxMinutes: Math.max(5, Number(e.target.value) || 5) }
                          : row,
                      ),
                    )
                  }
                />
                <IconButton
                  icon={Trash2}
                  label={`Remove agenda item ${index + 1}`}
                  variant="ghost"
                  disabled={agenda.length === 1}
                  onClick={() => setAgenda((prev) => prev.filter((row) => row.key !== item.key))}
                />
              </div>
            ))}
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={16} />}
              onClick={() =>
                setAgenda((prev) => [
                  ...prev,
                  {
                    key: Math.max(0, ...prev.map((row) => row.key)) + 1,
                    title: '',
                    ownerUserId: chair,
                    timeboxMinutes: 15,
                  },
                ])
              }
            >
              Add agenda item
            </Button>
          </div>
        </Field>

        {chair !== '' && (
          <p className="text-body-12 text-text-secondary">
            Chaired by {userName(chair)} on {formatDate(date)}, recorded as{' '}
            {status === 'held' ? 'held' : 'scheduled'}.
          </p>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Add an action item                                                         */
/* -------------------------------------------------------------------------- */

const ACTION_STATUSES: ActionItemStatus[] = ['open', 'in_progress', 'blocked']

export function NewActionModal({
  open,
  onClose,
  onCreated,
  meetingId,
}: {
  open: boolean
  onClose: () => void
  onCreated: (title: string) => void
  /** Pre-selected when the modal is opened from a meeting. */
  meetingId?: MeetingId
}) {
  const meetings = useCollection(meetingsCollection)
  const userOptions = useUserOptions()

  const [title, setTitle] = useState('')
  const [meeting, setMeeting] = useState<string>(meetingId ?? '')
  const [owner, setOwner] = useState('')
  const [deadline, setDeadline] = useState(addDays(TODAY, 7))
  const [status, setStatus] = useState<ActionItemStatus>('open')
  const [note, setNote] = useState('')
  const [relatedRef, setRelatedRef] = useState('')
  const [touched, setTouched] = useState(false)

  const effectiveMeeting = meetingId ?? meeting
  const titleError = touched && title.trim() === '' ? 'Say what has to be done.' : undefined
  const meetingError =
    touched && effectiveMeeting === ''
      ? 'An action belongs to the meeting that raised it — that is how it carries forward.'
      : undefined
  const ownerError = touched && owner === '' ? 'An action with no owner is a wish.' : undefined
  const deadlineError = touched && deadline === '' ? 'Give it a deadline.' : undefined

  const submit = () => {
    setTouched(true)
    if (title.trim() === '' || effectiveMeeting === '' || owner === '' || deadline === '') return
    addActionItem({
      title,
      meetingId: effectiveMeeting as MeetingId,
      ownerUserId: owner as UserId,
      deadline,
      status,
      note,
      relatedEntityType: relatedRef.trim() ? relatedRef.trim().split('-')[0].toUpperCase() : null,
      relatedEntityId: relatedRef.trim() || null,
    })
    onCreated(title.trim())
    setTitle('')
    setOwner('')
    setNote('')
    setRelatedRef('')
    setTouched(false)
    onClose()
  }

  const meetingOptions = useMemo(
    () =>
      [...meetings]
        .sort((a, b) => b.startAt.localeCompare(a.startAt))
        .map((m) => ({ value: m.id as string, label: `${m.title} · ${formatDate(m.startAt)}` })),
    [meetings],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add an action item"
      description="One owner, one deadline, one status. Anything not done by the next meeting of this type carries forward by itself and its carry count goes up."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add action</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Action" required error={titleError}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(titleError)}
            placeholder="Publish the revised discount bands to the sales team"
          />
        </Field>

        {!meetingId && (
          <Field label="Raised in" required error={meetingError}>
            <Select
              value={meeting}
              placeholder="Choose the meeting"
              options={meetingOptions}
              onChange={(e) => setMeeting(e.target.value)}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner" required error={ownerError}>
            <Select
              value={owner}
              placeholder="Choose an owner"
              options={userOptions}
              onChange={(e) => setOwner(e.target.value)}
            />
          </Field>
          <Field label="Deadline" required error={deadlineError}>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </Field>
        </div>

        <Field label="Status" required>
          <Select
            value={status}
            options={ACTION_STATUSES.map((s) => ({ value: s, label: ACTION_STATUS_LABEL[s] }))}
            onChange={(e) => setStatus(e.target.value as ActionItemStatus)}
          />
        </Field>

        <Field label="Related record" optional hint="A reference from another module, such as INV-2026-0932.">
          <Input value={relatedRef} onChange={(e) => setRelatedRef(e.target.value)} />
        </Field>

        <Field label="First update" optional>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            showCount
            placeholder="Agreed in the room. Draft to circulate before Friday."
          />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Log a decision                                                             */
/* -------------------------------------------------------------------------- */

export function NewDecisionModal({
  open,
  onClose,
  onCreated,
  meetingId,
  replacing,
}: {
  open: boolean
  onClose: () => void
  onCreated: (decision: Decision) => void
  meetingId?: MeetingId
  /** Opened from an existing decision, to record what replaced it. */
  replacing?: Decision | null
}) {
  const meetings = useCollection(meetingsCollection)
  const decisions = useCollection(decisionsCollection)
  const userOptions = useUserOptions()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [rationale, setRationale] = useState('')
  const [alternatives, setAlternatives] = useState('')
  const [decidedBy, setDecidedBy] = useState<string[]>([])
  const [decidedOn, setDecidedOn] = useState(TODAY)
  const [meeting, setMeeting] = useState<string>(meetingId ?? '')
  const [areas, setAreas] = useState('')
  const [reviewDate, setReviewDate] = useState('')
  const [replaceMode, setReplaceMode] = useState<'superseded' | 'reversed'>('superseded')
  const [touched, setTouched] = useState(false)

  const knownAreas = useMemo(
    () => [...new Set(decisions.flatMap((d) => d.affectedAreas))].sort((a, b) => a.localeCompare(b)),
    [decisions],
  )

  const titleError = touched && title.trim() === '' ? 'Name the decision so it can be found again.' : undefined
  const bodyError =
    touched && body.trim() === ''
      ? 'Write out what was decided. This full text is what the log searches.'
      : undefined
  const byError = touched && decidedBy.length === 0 ? 'Name whoever took the decision.' : undefined
  const rationaleError =
    touched && rationale.trim() === ''
      ? 'Record the reasoning now. Reconstructed afterwards, it is a justification rather than a reason.'
      : undefined

  const submit = () => {
    setTouched(true)
    if (title.trim() === '' || body.trim() === '' || rationale.trim() === '' || decidedBy.length === 0) return

    const decision = logDecision({
      title,
      decision: body,
      rationale,
      alternativesConsidered: alternatives
        .split('\n')
        .map((a) => a.trim())
        .filter(Boolean),
      decidedByUserIds: decidedBy as UserId[],
      decidedOn,
      meetingId: (meetingId ?? (meeting || null)) as MeetingId | null,
      affectedAreas: areas
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      reviewDate: reviewDate || null,
      replaces: replacing ? { id: replacing.id as DecisionId, as: replaceMode } : null,
    })

    onCreated(decision)
    setTitle('')
    setBody('')
    setRationale('')
    setAlternatives('')
    setDecidedBy([])
    setAreas('')
    setReviewDate('')
    setTouched(false)
    onClose()
  }

  const meetingOptions = useMemo(
    () =>
      [...meetings]
        .sort((a, b) => b.startAt.localeCompare(a.startAt))
        .map((m) => ({ value: m.id as string, label: `${m.title} · ${formatDate(m.startAt)}` })),
    [meetings],
  )

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={replacing ? `Replace ${replacing.ref}` : 'Log a decision'}
      description="What was decided, by whom, when and why — searchable across the full text, and never edited once written."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{replacing ? 'Log the replacement' : 'Log decision'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {replacing && (
          <Alert tone="info" title={`${replacing.ref} stays in the log, exactly as written`}>
            Logging this writes a new decision and links {replacing.ref} forward to it. The original
            keeps its text, its rationale and its date — it is marked{' '}
            {replaceMode === 'superseded' ? 'superseded' : 'reversed'}, not rewritten.
          </Alert>
        )}

        {replacing && (
          <Field label="How this replaces it" required>
            <Select
              value={replaceMode}
              options={[
                { value: 'superseded', label: 'Superseded — a later decision takes its place' },
                { value: 'reversed', label: 'Reversed — the decision is taken back' },
              ]}
              onChange={(e) => setReplaceMode(e.target.value as 'superseded' | 'reversed')}
            />
          </Field>
        )}

        <Field label="Title" required error={titleError}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(titleError)}
            placeholder="Discounts above 20% route to the CFO"
          />
        </Field>

        <Field
          label="What was decided"
          required
          error={bodyError}
          hint="The full text. This is what the decision log searches across."
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            invalid={Boolean(bodyError)}
            placeholder="From 1 October, any discount above 20% of list fee requires CFO approval regardless of unit or branch."
          />
        </Field>

        <Field label="Why" required error={rationaleError}>
          <Textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            invalid={Boolean(rationaleError)}
            placeholder="Discounting above 20% has accounted for most of the margin loss this quarter, and the approver at that level currently has no view of unit margin."
          />
        </Field>

        <Field label="Alternatives considered" optional hint="One per line. What was rejected, so it is not proposed again as if it were new.">
          <Textarea
            value={alternatives}
            onChange={(e) => setAlternatives(e.target.value)}
            rows={3}
            placeholder={'Cap discounts at 20% outright\nLeave the threshold with the Head of Growth'}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Decided on" required>
            <Input type="date" value={decidedOn} onChange={(e) => setDecidedOn(e.target.value)} />
          </Field>
          <Field label="Review date" optional hint="When this should be looked at again.">
            <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
          </Field>
        </div>

        {!meetingId && (
          <Field label="Meeting" optional hint="A decision taken outside a meeting can be logged without one.">
            <Select
              value={meeting}
              placeholder="Not taken in a meeting"
              options={meetingOptions}
              onChange={(e) => setMeeting(e.target.value)}
            />
          </Field>
        )}

        <Field label="Decided by" required error={byError} hint={`${decidedBy.length} selected.`}>
          <div className="max-h-40 overflow-y-auto rounded-xl border border-border p-2">
            <ul className="space-y-1">
              {userOptions.map((option) => (
                <li key={option.value}>
                  <Checkbox
                    label={option.label}
                    checked={decidedBy.includes(option.value)}
                    onChange={() =>
                      setDecidedBy((prev) =>
                        prev.includes(option.value)
                          ? prev.filter((id) => id !== option.value)
                          : [...prev, option.value],
                      )
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        </Field>

        <Field
          label="Affected areas"
          optional
          hint="Comma separated. Used as chips on the decision and as a filter on the log."
        >
          <Input
            value={areas}
            onChange={(e) => setAreas(e.target.value)}
            placeholder="Sales, Finance, Pricing"
          />
        </Field>

        {knownAreas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-body-12 text-text-secondary">Already in use:</span>
            {knownAreas.slice(0, 8).map((area) => (
              <button
                key={area}
                type="button"
                onClick={() =>
                  setAreas((prev) => {
                    const parts = prev.split(',').map((p) => p.trim()).filter(Boolean)
                    return parts.includes(area) ? prev : [...parts, area].join(', ')
                  })
                }
                className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Badge tone="neutral" variant="outline" size="sm">
                  {area}
                </Badge>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */

/** Dates hang off the seed's fixed clock, never `Date.now()`. */
function addDays(from: string, days: number): string {
  const date = new Date(`${from.slice(0, 10)}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
