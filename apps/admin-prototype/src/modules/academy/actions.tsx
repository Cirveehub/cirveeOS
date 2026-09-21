/**
 * The four things Academy operations can now actually do: enrol a student,
 * assign or replace a tutor, schedule a class, and take a register.
 *
 * Each is a single self-contained modal over one call into `writes.ts` — none
 * of them has sequencing that would justify a wizard. The PRD rules they
 * exist to demonstrate live in `writes.ts`, not here; these only have to make
 * the rule legible while someone is using it, which is why the tutor dialog
 * shows the outgoing assignment's delivered-session count before it ends it
 * and the register dialog labels a changed state as an override.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { CalendarClock, GraduationCap, Repeat, UserPlus } from 'lucide-react'

import { formatDate, formatNaira } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Field,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Switch,
  Textarea,
} from '@/ui'
import {
  TODAY,
  classSessionsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  peopleCollection,
  relationshipsCollection,
  studentAttendanceCollection,
  tutorAssignmentsCollection,
  useCollection,
  type ClassSession,
  type Cohort,
  type PersonId,
  type StudentAttendanceState,
  type TutorAssignment,
} from '@/mocks'

import { personName } from './shared'
import {
  admissionsAwaitingEnrolment,
  assignTutor,
  endTutorAssignment,
  enrolStudent,
  recordAttendance,
  replaceTutor,
  scheduleSession,
  type AttendanceEntry,
} from './writes'

/* -------------------------------------------------------------------------- */
/* Shared pieces                                                              */
/* -------------------------------------------------------------------------- */

function useError(): [string | null, (e: unknown) => void, () => void] {
  const [error, setError] = useState<string | null>(null)
  return [
    error,
    (e: unknown) => setError(e instanceof Error ? e.message : 'That write could not be completed.'),
    () => setError(null),
  ]
}

function Failure({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Alert tone="danger" title="Nothing was written">
      {message}
    </Alert>
  )
}

/** Everyone who has ever held a tutor assignment, plus anyone with the relationship. */
function useTutorRoster(): Array<{ personId: string; name: string }> {
  const assignments = useCollection(tutorAssignmentsCollection)
  const relationships = useCollection(relationshipsCollection)

  return useMemo(() => {
    const ids = new Set<string>()
    assignments.forEach((a) => ids.add(a.tutorPersonId))
    relationships.filter((r) => r.type === 'tutor' && r.status === 'active').forEach((r) => ids.add(r.personId))
    return [...ids]
      .map((personId) => ({ personId, name: personName(personId) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [assignments, relationships])
}

/* -------------------------------------------------------------------------- */
/* Enrol a student                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Academy's enrolments come from confirmed admissions, so the admission path
 * is the default and the direct path is deliberately the harder one: it needs
 * a typed reason, which lands in the audit trail beside the enrolment.
 */
export function EnrolStudentModal({
  cohort,
  open,
  onClose,
  onEnrolled,
}: {
  cohort: Cohort
  open: boolean
  onClose: () => void
  onEnrolled: (name: string) => void
}) {
  const people = useCollection(peopleCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const [error, fail, clearError] = useError()

  const waiting = useMemo(() => admissionsAwaitingEnrolment(cohort.id), [cohort.id, enrollments])
  const [source, setSource] = useState<'admission' | 'direct'>(waiting.length ? 'admission' : 'direct')
  const [admissionId, setAdmissionId] = useState('')
  const [personId, setPersonId] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setSource(waiting.length ? 'admission' : 'direct')
    setAdmissionId(waiting[0]?.id ?? '')
    setPersonId('')
    setReason('')
    setTouched(false)
    clearError()
    // `waiting` is recomputed from the cohort; resetting on open is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cohort.id])

  const enrolledPersonIds = new Set(
    enrollments.filter((e) => e.cohortId === cohort.id && e.status !== 'withdrawn').map((e) => e.personId as string),
  )
  const selectable = people.filter((p) => !enrolledPersonIds.has(p.id)).slice(0, 300)

  const admissionError = touched && source === 'admission' && !admissionId ? 'Choose the admission to enrol.' : undefined
  const personError = touched && source === 'direct' && !personId ? 'Choose the person to enrol.' : undefined
  const reasonError =
    touched && source === 'direct' && reason.trim().length < 8
      ? 'Say why this is being enrolled without an admission. It is written to the audit trail.'
      : undefined

  const seatsLeft = cohort.seats - cohort.enrolledCount
  const selectedAdmission = waiting.find((a) => a.id === admissionId)

  function submit() {
    setTouched(true)
    clearError()
    try {
      if (source === 'admission') {
        const admission = waiting.find((a) => a.id === admissionId)
        if (!admission) return
        enrolStudent({
          cohortId: cohort.id,
          personId: admission.personId,
          admissionId: admission.id,
          advisorUserId: admission.leadOwnerUserId,
          reason: null,
        })
        onEnrolled(personName(admission.personId))
      } else {
        if (!personId || reason.trim().length < 8) return
        enrolStudent({
          cohortId: cohort.id,
          personId: personId as PersonId,
          admissionId: null,
          advisorUserId: null,
          reason,
        })
        onEnrolled(personName(personId))
      }
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Enrol a student onto ${cohort.code}`}
      description="An enrolment is the record Learn reads for progress, grading and certificate eligibility. It is the same record an admission produces."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Enrol student</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Failure message={error} />

        {seatsLeft <= 0 && (
          <Alert tone="warning" title={`${cohort.code} is full`}>
            {cohort.enrolledCount} of {cohort.seats} seats are taken. Enrolling anyway is allowed and visible — the
            cohort profile shows the over-subscription rather than the system quietly refusing.
          </Alert>
        )}

        <RadioGroup legend="Where this enrolment comes from">
          <Radio
            name="enrol-source"
            value="admission"
            checked={source === 'admission'}
            disabled={waiting.length === 0}
            onChange={() => setSource('admission')}
            label={
              waiting.length
                ? `A confirmed admission (${waiting.length} waiting)`
                : 'A confirmed admission — none is waiting on this cohort'
            }
            description="The normal path. Carries the fee, the invoice and the attribution already agreed at admission."
          />
          <Radio
            name="enrol-source"
            value="direct"
            checked={source === 'direct'}
            onChange={() => setSource('direct')}
            label="Directly, with a reason"
            description="A transfer, a scholarship placement or a correction. There is no fee record behind it, so the reason is required."
          />
        </RadioGroup>

        {source === 'admission' ? (
          <>
            <Field label="Admission" required error={admissionError} id="enrol-admission">
              <Select
                id="enrol-admission"
                value={admissionId}
                invalid={Boolean(admissionError)}
                placeholder="Choose an admission"
                options={waiting.map((a) => ({
                  value: a.id,
                  label: `${a.ref} · ${personName(a.personId)} · ${formatNaira(a.netFee)} · ${a.status.replace(/_/g, ' ')}`,
                }))}
                onChange={(e) => setAdmissionId(e.target.value)}
              />
            </Field>
            {selectedAdmission?.status === 'pending_discount_approval' && (
              <Alert tone="warning" title="This admission's discount has not been approved yet">
                Its invoice is held until the approval clears, so enrolling now puts the student in class ahead of the
                money. That is a real operational choice — it is visible here rather than hidden, and the enrolment's
                audit entry names the admission it came from.
              </Alert>
            )}
          </>
        ) : (
          <>
            <Field label="Person" required error={personError} id="enrol-person">
              <Select
                id="enrol-person"
                value={personId}
                invalid={Boolean(personError)}
                placeholder="Choose a person"
                options={selectable.map((p) => ({
                  value: p.id,
                  label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ''}`,
                }))}
                onChange={(e) => setPersonId(e.target.value)}
              />
            </Field>
            <Field
              label="Reason"
              required
              error={reasonError}
              hint="Recorded on the enrolment's audit event, so finance can see why there is no admission behind it."
              id="enrol-reason"
            >
              <Textarea
                id="enrol-reason"
                rows={2}
                value={reason}
                invalid={Boolean(reasonError)}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
          </>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Assign, replace or end a tutor                                             */
/* -------------------------------------------------------------------------- */

export type TutorDialogMode = 'assign' | 'replace' | 'end'

export function TutorAssignmentModal({
  cohort,
  mode,
  assignment,
  open,
  onClose,
  onDone,
}: {
  cohort: Cohort
  mode: TutorDialogMode
  /** The assignment being replaced or ended. */
  assignment: TutorAssignment | null
  open: boolean
  onClose: () => void
  onDone: (message: string, detail: string) => void
}) {
  const roster = useTutorRoster()
  const [error, fail, clearError] = useError()

  const [tutorPersonId, setTutorPersonId] = useState('')
  const [role, setRole] = useState<TutorAssignment['role']>('lead')
  const [effectiveDate, setEffectiveDate] = useState(TODAY)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setTutorPersonId('')
    setRole(assignment?.role ?? 'lead')
    setEffectiveDate(TODAY)
    setReason('')
    setTouched(false)
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, assignment?.id])

  const needsTutor = mode !== 'end'
  const needsReason = mode !== 'assign'

  const tutorError = touched && needsTutor && !tutorPersonId ? 'Choose the tutor.' : undefined
  const reasonError =
    touched && needsReason && reason.trim().length < 8
      ? 'A tutor change is audited. Say what happened — cover, handover, illness, performance.'
      : undefined

  const title =
    mode === 'assign'
      ? `Assign a tutor to ${cohort.code}`
      : mode === 'replace'
        ? `Replace ${assignment ? personName(assignment.tutorPersonId) : 'the tutor'}`
        : `End ${assignment ? personName(assignment.tutorPersonId) : 'this'} assignment`

  function submit() {
    setTouched(true)
    clearError()
    try {
      if (mode === 'assign') {
        if (!tutorPersonId) return
        assignTutor({
          cohortId: cohort.id,
          tutorPersonId: tutorPersonId as PersonId,
          role,
          startDate: effectiveDate,
        })
        onDone(`${personName(tutorPersonId)} assigned to ${cohort.code}`, `As ${role}, from ${formatDate(effectiveDate)}.`)
      } else if (mode === 'replace') {
        if (!assignment || !tutorPersonId || reason.trim().length < 8) return
        replaceTutor({
          assignmentId: assignment.id,
          incomingTutorPersonId: tutorPersonId as PersonId,
          role,
          effectiveDate,
          reason,
        })
        onDone(
          `${personName(tutorPersonId)} took over ${cohort.code}`,
          `${personName(assignment.tutorPersonId)}'s assignment ended on ${formatDate(effectiveDate)} and keeps its ${assignment.sessionsDelivered} delivered sessions.`,
        )
      } else {
        if (!assignment || reason.trim().length < 8) return
        endTutorAssignment(assignment.id, reason, effectiveDate)
        onDone(
          `${personName(assignment.tutorPersonId)}'s assignment ended`,
          `${cohort.code} now has nobody in that role. Delivered sessions are unchanged.`,
        )
      }
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={
        mode === 'replace'
          ? 'Nobody is swapped in place. The outgoing assignment is end-dated with a reason and a new one starts, so historical delivery credit survives.'
          : mode === 'end'
            ? 'The record stays, with its end date, its reason and its delivered-session count.'
            : 'An assignment is what makes somebody responsible for delivery and creditable for the sessions they teach.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={mode === 'end' ? 'danger' : 'primary'} onClick={submit}>
            {mode === 'assign' ? 'Assign tutor' : mode === 'replace' ? 'End and reassign' : 'End assignment'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Failure message={error} />

        {assignment && mode !== 'assign' && (
          <Alert tone="info" icon={Repeat} title={`${personName(assignment.tutorPersonId)} — ${assignment.role}`}>
            Assigned since {formatDate(assignment.startDate)} · {assignment.sessionsDelivered} sessions delivered. That
            count does not move.
          </Alert>
        )}

        {needsTutor && (
          <Field
            label={mode === 'replace' ? 'Incoming tutor' : 'Tutor'}
            required
            error={tutorError}
            id="tutor-person"
          >
            <Select
              id="tutor-person"
              value={tutorPersonId}
              invalid={Boolean(tutorError)}
              placeholder="Choose a tutor"
              options={roster
                .filter((t) => t.personId !== assignment?.tutorPersonId)
                .map((t) => ({ value: t.personId, label: t.name }))}
              onChange={(e) => setTutorPersonId(e.target.value)}
            />
          </Field>
        )}

        {needsTutor && (
          <Field label="Role" required id="tutor-role">
            <Select
              id="tutor-role"
              value={role}
              options={[
                { value: 'lead', label: 'Lead' },
                { value: 'assistant', label: 'Assistant' },
                { value: 'guest', label: 'Guest' },
              ]}
              onChange={(e) => setRole(e.target.value as TutorAssignment['role'])}
            />
          </Field>
        )}

        <Field
          label={mode === 'assign' ? 'Start date' : 'Effective date'}
          required
          hint={mode === 'replace' ? "The outgoing assignment's last day and the incoming one's first." : undefined}
          id="tutor-date"
        >
          <Input id="tutor-date" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
        </Field>

        {needsReason && (
          <Field
            label="Reason"
            required
            error={reasonError}
            hint="Shown on the assignment row and written to the audit log."
            id="tutor-reason"
          >
            <Textarea
              id="tutor-reason"
              rows={2}
              value={reason}
              invalid={Boolean(reasonError)}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Schedule a class session                                                   */
/* -------------------------------------------------------------------------- */

export function ScheduleSessionModal({
  cohort: fixedCohort,
  open,
  onClose,
  onScheduled,
}: {
  /** Null on the timetable, where the cohort is chosen inside the dialog. */
  cohort: Cohort | null
  open: boolean
  onClose: () => void
  onScheduled: (session: ClassSession) => void
}) {
  const assignments = useCollection(tutorAssignmentsCollection)
  const allCohorts = useCollection(cohortsCollection)
  const roster = useTutorRoster()
  const [error, fail, clearError] = useError()

  const [cohortId, setCohortId] = useState(fixedCohort?.id ?? '')
  const cohort = fixedCohort ?? allCohorts.find((c) => c.id === cohortId) ?? null

  const activeTutors = assignments.filter((a) => cohort && a.cohortId === cohort.id && a.status === 'active')

  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(TODAY)
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [virtual, setVirtual] = useState(false)
  const [room, setRoom] = useState('')
  const [meetingUrl, setMeetingUrl] = useState('')
  const [tutorPersonId, setTutorPersonId] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setCohortId(fixedCohort?.id ?? '')
    setTopic('')
    setDate(TODAY)
    setStartTime('18:00')
    setEndTime('20:00')
    setVirtual(fixedCohort?.mode === 'virtual')
    setRoom('')
    setMeetingUrl('')
    setTutorPersonId(fixedCohort ? (activeTutors[0]?.tutorPersonId ?? '') : '')
    setTouched(false)
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixedCohort?.id])

  const cohortError = touched && !cohort ? 'A session belongs to a cohort — choose one.' : undefined
  const topicError = touched && !topic.trim() ? 'Give the session a topic — it is what appears on the timetable.' : undefined
  const tutorError = touched && !tutorPersonId ? 'A session with no tutor cannot be delivered or credited.' : undefined
  const timeError = touched && endTime <= startTime ? 'The session has to end after it starts.' : undefined

  function submit() {
    setTouched(true)
    clearError()
    if (!cohort || !topic.trim() || !tutorPersonId || endTime <= startTime) return
    try {
      const session = scheduleSession({
        cohortId: cohort.id,
        topic,
        date,
        startTime,
        endTime,
        room: virtual ? null : room,
        meetingUrl: virtual ? meetingUrl || `https://meet.cirvee.com/${cohort.code.toLowerCase()}` : null,
        tutorPersonId: tutorPersonId as PersonId,
      })
      onScheduled(session)
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={cohort ? `Schedule a class on ${cohort.code}` : 'Schedule a class'}
      description="Until a session exists there is nothing to take a register against and no delivery for a tutor to be credited with."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Schedule class</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Failure message={error} />

        {!fixedCohort && (
          <Field label="Cohort" required error={cohortError} id="session-cohort">
            <Select
              id="session-cohort"
              value={cohortId}
              invalid={Boolean(cohortError)}
              placeholder="Choose a cohort"
              options={allCohorts
                .filter((c) => c.status !== 'completed' && c.status !== 'cancelled')
                .map((c) => ({ value: c.id, label: `${c.code} — ${courseTitleOf(c)}` }))}
              onChange={(e) => {
                setCohortId(e.target.value)
                const picked = allCohorts.find((c) => c.id === e.target.value)
                setVirtual(picked?.mode === 'virtual')
                setTutorPersonId('')
              }}
            />
          </Field>
        )}

        <Field label="Topic" required error={topicError} id="session-topic">
          <Input
            id="session-topic"
            value={topic}
            invalid={Boolean(topicError)}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Joins and window functions"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Date" required id="session-date">
            <Input id="session-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Starts" required id="session-start">
            <Input id="session-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </Field>
          <Field label="Ends" required error={timeError} id="session-end">
            <Input
              id="session-end"
              type="time"
              value={endTime}
              invalid={Boolean(timeError)}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </Field>
        </div>

        <Switch
          checked={virtual}
          onChange={setVirtual}
          label="Virtual session"
          description={cohort ? `This cohort runs ${cohort.mode.replace(/_/g, ' ')}.` : undefined}
        />

        {virtual ? (
          <Field label="Meeting link" hint="Left blank, a room link is generated from the cohort code." id="session-link">
            <Input
              id="session-link"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder={cohort ? `https://meet.cirvee.com/${cohort.code.toLowerCase()}` : 'https://meet.cirvee.com/...'}
            />
          </Field>
        ) : (
          <Field label="Room" id="session-room">
            <Input id="session-room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="Ibadan HQ · Lab 2" />
          </Field>
        )}

        <Field label="Tutor" required error={tutorError} id="session-tutor">
          <Select
            id="session-tutor"
            value={tutorPersonId}
            invalid={Boolean(tutorError)}
            placeholder="Choose a tutor"
            options={roster.map((t) => ({
              value: t.personId,
              label: activeTutors.some((a) => a.tutorPersonId === t.personId)
                ? `${t.name} — assigned to this cohort`
                : t.name,
            }))}
            onChange={(e) => setTutorPersonId(e.target.value)}
          />
        </Field>

        {activeTutors.length === 0 && (
          <Alert tone="warning" title="No tutor holds an active assignment on this cohort">
            The session can still be scheduled, but nobody is formally responsible for delivering it and no assignment
            will be credited with it.
          </Alert>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Take a register / override attendance                                      */
/* -------------------------------------------------------------------------- */

const STATES: Array<{ value: StudentAttendanceState; label: string }> = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
]

/**
 * The register. A student with no row yet is simply recorded; changing a state
 * that already exists is an override, so the row opens a required reason field
 * the moment it is touched and stays open until it is filled.
 */
export function AttendanceModal({
  session,
  open,
  onClose,
  onRecorded,
}: {
  session: ClassSession
  open: boolean
  onClose: () => void
  onRecorded: (result: { created: number; overridden: number }) => void
}) {
  const enrollments = useCollection(enrollmentsCollection)
  const attendance = useCollection(studentAttendanceCollection)
  const cohorts = useCollection(cohortsCollection)
  const [error, fail, clearError] = useError()

  const cohort = cohorts.find((c) => c.id === session.cohortId)

  const roster = useMemo(
    () =>
      enrollments
        .filter((e) => e.cohortId === session.cohortId && e.status !== 'withdrawn')
        .map((e) => ({
          enrolment: e,
          existing: attendance.find((a) => a.sessionId === session.id && a.enrollmentId === e.id) ?? null,
        }))
        .sort((a, b) => personName(a.enrolment.personId).localeCompare(personName(b.enrolment.personId))),
    [enrollments, attendance, session.id, session.cohortId],
  )

  const [states, setStates] = useState<Record<string, StudentAttendanceState>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setStates(
      Object.fromEntries(roster.map((r) => [r.enrolment.id, r.existing?.state ?? 'present'])) as Record<
        string,
        StudentAttendanceState
      >,
    )
    setReasons({})
    setTouched(false)
    clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session.id])

  const overrides = roster.filter((r) => r.existing && states[r.enrolment.id] && states[r.enrolment.id] !== r.existing.state)
  const missingReasons = overrides.filter((r) => (reasons[r.enrolment.id] ?? '').trim().length < 8)

  function submit() {
    setTouched(true)
    clearError()
    if (missingReasons.length > 0) return
    try {
      const entries: AttendanceEntry[] = roster.map((r) => ({
        enrollmentId: r.enrolment.id,
        personId: r.enrolment.personId,
        state: states[r.enrolment.id] ?? 'present',
        overrideReason: reasons[r.enrolment.id],
      }))
      const result = recordAttendance(session.id, entries)
      onRecorded(result)
      onClose()
    } catch (e) {
      fail(e)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={`Register — ${session.sequence}. ${session.topic}`}
      description={`${cohort?.code ?? ''} · ${formatDate(session.date)} · ${session.startTime}–${session.endTime}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>
            {overrides.length > 0 ? `Save with ${overrides.length} override${overrides.length === 1 ? '' : 's'}` : 'Save register'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Failure message={error} />

        <Alert tone="info" title="Attendance is a teaching signal, not a billing one">
          Nothing here changes what a student owes. Changing a state the system already recorded is an override and
          needs a reason, which is kept with the record and written to the audit log.
        </Alert>

        {roster.length === 0 ? (
          <p className="text-body-13 text-text-secondary">
            Nobody is enrolled on this cohort, so there is no register to take.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {roster.map(({ enrolment, existing }) => {
              const value = states[enrolment.id] ?? 'present'
              const changed = Boolean(existing) && existing?.state !== value
              const reasonMissing = touched && changed && (reasons[enrolment.id] ?? '').trim().length < 8
              return (
                <li key={enrolment.id} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-body-13 font-medium text-text">{personName(enrolment.personId)}</div>
                      <div className="text-body-12 text-text-secondary">
                        {existing ? `Recorded ${existing.state} via ${existing.source.replace(/_/g, ' ')}` : 'No record yet'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {changed && (
                        <Badge tone="warning" size="sm">
                          Override
                        </Badge>
                      )}
                      <Select
                        aria-label={`Attendance state for ${personName(enrolment.personId)}`}
                        selectSize="sm"
                        value={value}
                        options={STATES}
                        containerClassName="w-36"
                        onChange={(e) =>
                          setStates((prev) => ({ ...prev, [enrolment.id]: e.target.value as StudentAttendanceState }))
                        }
                      />
                    </div>
                  </div>
                  {changed && (
                    <div className="mt-2">
                      <Field
                        label="Override reason"
                        required
                        error={reasonMissing ? 'An override without a reason is not auditable.' : undefined}
                        id={`override-${enrolment.id}`}
                      >
                        <Input
                          id={`override-${enrolment.id}`}
                          inputSize="sm"
                          value={reasons[enrolment.id] ?? ''}
                          invalid={reasonMissing}
                          placeholder="Tapped a colleague's card; confirmed present by the tutor"
                          onChange={(e) => setReasons((prev) => ({ ...prev, [enrolment.id]: e.target.value }))}
                        />
                      </Field>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Small shared trigger, so every screen opens these the same way             */
/* -------------------------------------------------------------------------- */

export function ActionButton({
  kind,
  onClick,
  children,
  size = 'sm',
}: {
  kind: 'enrol' | 'tutor' | 'schedule' | 'register'
  onClick: () => void
  children: ReactNode
  size?: 'sm' | 'md'
}) {
  const icon =
    kind === 'enrol' ? (
      <UserPlus size={16} />
    ) : kind === 'tutor' ? (
      <GraduationCap size={16} />
    ) : kind === 'schedule' ? (
      <CalendarClock size={16} />
    ) : (
      <Repeat size={16} />
    )
  return (
    <Button size={size} variant="secondary" leftIcon={icon} onClick={onClick}>
      {children}
    </Button>
  )
}

/** Sessions of a cohort, newest first — the register picker's source. */
export function sessionsOf(cohortId: string): ClassSession[] {
  return classSessionsCollection
    .where((s) => s.cohortId === cohortId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

/** A cohort's course title, for dialog copy. */
export function courseTitleOf(cohort: Cohort): string {
  return coursesCollection.find(cohort.courseId)?.title ?? cohort.courseId
}
