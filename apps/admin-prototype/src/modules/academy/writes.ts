/**
 * Every write Academy operations performs.
 *
 * The module was read-only before this pass, which meant the two rules the PRD
 * is most insistent about had nowhere to be demonstrated:
 *
 *  1. **A tutor is never reassigned in place.** Replacing one ends the
 *     outgoing assignment with a date and a reason and starts a new record.
 *     The sessions the outgoing tutor delivered stay on their row, which is
 *     what makes delivery credit and pay reconcilable months later.
 *  2. **An attendance override needs a reason and an audit event.** Changing
 *     what the system recorded is a human decision, so it is captured as one —
 *     actor, timestamp, previous state, new state, reason.
 *
 * Enrolment is the seam this module shares with Cirvee Learn: the `Enrollment`
 * written here is the same record the Learn module reads for progress,
 * grading and certificate eligibility. It is also the record an admission
 * produces — so the modal that calls `enrolFromAdmission` prefers a confirmed
 * admission and only falls back to a direct enrolment with a stated reason.
 */

import {
  TODAY,
  CURRENT_USER_ID,
  admissionsCollection,
  auditEventsCollection,
  classSessionsCollection,
  cohortsCollection,
  enrollmentsCollection,
  relationshipsCollection,
  rolesCollection,
  studentAttendanceCollection,
  tutorAssignmentsCollection,
  usersCollection,
} from '@/mocks'
import {
  auditId as asAuditId,
  enrollmentId as asEnrollmentId,
  relId as asRelId,
  sessionId as asSessionId,
  stuAttId as asStuAttId,
  tutorAssignId as asTutorAssignId,
  type Admission,
  type AuditEvent,
  type AuditSource,
  type ClassSession,
  type Cohort,
  type Enrollment,
  type PersonId,
  type StudentAttendance,
  type StudentAttendanceSource,
  type StudentAttendanceState,
  type TutorAssignment,
  type UserId,
} from '@/mocks/types'

import { personName, userName } from './shared'

/* -------------------------------------------------------------------------- */
/* The clock and the audit trail                                              */
/* -------------------------------------------------------------------------- */

/** The seed's fixed date, the wall clock's time — so relative dates never rot. */
export function nowIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+01:00`
}

function auditable(at: string = nowIso()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

let auditSequence = 0

export interface AuditInput {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
  source?: AuditSource
}

/** Append-only. There is no update or delete path for an audit event. */
export function emitAudit(input: AuditInput): AuditEvent {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff') : 'Staff'

  return auditEventsCollection.insert({
    id: asAuditId(`aud-academy-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: nowIso(),
    actorUserId: CURRENT_USER_ID,
    actorName: userName(CURRENT_USER_ID),
    actorRole: roleName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: input.source ?? 'ui',
    ip: '102.89.34.17',
  })
}

/* -------------------------------------------------------------------------- */
/* Enrolment                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Admissions against this cohort that have been paid for or approved but have
 * not produced an enrolment yet. This is the list the enrol dialog should
 * prefer — an enrolment with no admission behind it has no fee, no invoice and
 * nothing for finance to reconcile against.
 */
export function admissionsAwaitingEnrolment(cohortId: string): Admission[] {
  return admissionsCollection
    .where(
      (a) =>
        a.cohortId === cohortId &&
        a.enrolmentId === null &&
        a.status !== 'withdrawn' &&
        a.status !== 'draft',
    )
    .sort((a, b) => a.ref.localeCompare(b.ref))
}

export interface EnrolInput {
  cohortId: string
  personId: PersonId
  /** Null only on the direct path, which then requires `reason`. */
  admissionId: string | null
  advisorUserId: UserId | null
  /** Required when `admissionId` is null — why this bypassed admissions. */
  reason: string | null
}

export interface EnrolResult {
  enrolment: Enrollment
  cohort: Cohort
}

/**
 * One enrolment, the Student relationship that goes with it, the cohort's seat
 * count, and — when it came from one — the admission is marked enrolled.
 * `seats` is not a hard cap here: over-enrolling is an operational decision
 * the cohort profile shows rather than a write this function refuses.
 */
export function enrolStudent(input: EnrolInput): EnrolResult {
  const at = nowIso()
  const cohort = cohortsCollection.find(input.cohortId)
  if (!cohort) throw new Error('Cohort not found')

  const already = enrollmentsCollection
    .all()
    .find((e) => e.cohortId === input.cohortId && e.personId === input.personId && e.status !== 'withdrawn')
  if (already) throw new Error(`${personName(input.personId)} is already enrolled on ${cohort.code}.`)

  if (!input.admissionId && !input.reason?.trim()) {
    throw new Error('A direct enrolment needs a stated reason — Academy enrolments normally come from an admission.')
  }

  const admission = input.admissionId ? admissionsCollection.find(input.admissionId) : undefined

  const enrolment = enrollmentsCollection.insert({
    id: asEnrollmentId(`enrollment-ui-${Date.now().toString(36)}`),
    personId: input.personId,
    cohortId: cohort.id,
    courseId: cohort.courseId,
    // The type requires an admission id. A direct enrolment points at the
    // cohort instead, which is visibly not an admission reference — better
    // than inventing a fake one that finance would later try to reconcile.
    admissionId: (admission?.id ?? cohort.id) as Enrollment['admissionId'],
    unitId: cohort.unitId,
    enrolledAt: TODAY,
    status: 'active',
    advisorUserId: input.advisorUserId ?? admission?.leadOwnerUserId ?? null,
    attentionFlags: [],
    flaggedAt: null,
    ...auditable(at),
  })

  const updatedCohort =
    cohortsCollection.update(cohort.id, {
      enrolledCount: cohort.enrolledCount + 1,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    }) ?? cohort

  /* Identity gains a Student relationship rather than a second Person. */
  const existingRelationship = relationshipsCollection
    .all()
    .find((r) => r.personId === input.personId && r.type === 'student' && r.status === 'active')
  if (!existingRelationship) {
    relationshipsCollection.insert({
      id: asRelId(`rel-ui-student-${Date.now().toString(36)}`),
      personId: input.personId,
      type: 'student',
      startDate: TODAY,
      endDate: null,
      status: 'active',
      unitId: cohort.unitId,
      branchId: cohort.branchId,
      relatedRecordId: admission?.id ?? enrolment.id,
      ...auditable(at),
    })
  }

  if (admission) {
    admissionsCollection.update(admission.id, {
      enrolmentId: enrolment.id,
      status: 'enrolled',
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
    emitAudit({
      action: 'admission.enrol',
      entityType: 'Admission',
      entityId: admission.id,
      entityRef: admission.ref,
      field: 'status',
      before: admission.status,
      after: 'enrolled',
    })
  }

  emitAudit({
    action: 'enrolment.create',
    entityType: 'Enrollment',
    entityId: enrolment.id,
    entityRef: `${personName(input.personId)} · ${cohort.code}`,
    field: 'status',
    before: null,
    after: admission ? `active — from admission ${admission.ref}` : `active — direct enrolment: ${input.reason?.trim()}`,
  })

  /* Every future session is now expecting one more person. */
  recountExpectedAttendance(cohort.id)

  return { enrolment, cohort: updatedCohort }
}

/* -------------------------------------------------------------------------- */
/* Tutor assignments                                                          */
/* -------------------------------------------------------------------------- */

export interface AssignTutorInput {
  cohortId: string
  tutorPersonId: PersonId
  role: TutorAssignment['role']
  startDate: string
}

export function assignTutor(input: AssignTutorInput): TutorAssignment {
  const at = nowIso()
  const cohort = cohortsCollection.find(input.cohortId)

  const assignment = tutorAssignmentsCollection.insert({
    id: asTutorAssignId(`tutorassign-ui-${Date.now().toString(36)}`),
    cohortId: input.cohortId as TutorAssignment['cohortId'],
    tutorPersonId: input.tutorPersonId,
    role: input.role,
    startDate: input.startDate,
    endDate: null,
    sessionsDelivered: 0,
    status: 'active',
    endReason: null,
    replacedByAssignmentId: null,
    ...auditable(at),
  })

  emitAudit({
    action: 'tutor.assign',
    entityType: 'TutorAssignment',
    entityId: assignment.id,
    entityRef: `${personName(input.tutorPersonId)} · ${cohort?.code ?? input.cohortId}`,
    field: 'status',
    before: null,
    after: `active as ${input.role}`,
  })

  return assignment
}

export interface ReplaceTutorInput {
  /** The assignment being wound up. */
  assignmentId: string
  incomingTutorPersonId: PersonId
  role: TutorAssignment['role']
  /** The outgoing assignment's last day; the incoming one starts here too. */
  effectiveDate: string
  reason: string
}

export interface ReplaceTutorResult {
  ended: TutorAssignment
  started: TutorAssignment
}

/**
 * The never-reassign-in-place rule, implemented literally. The outgoing row
 * keeps its `sessionsDelivered` and gains an end date, a reason and a pointer
 * to whoever took over; the incoming tutor gets a new row starting the same
 * day. Nothing about the outgoing tutor's delivery history moves.
 */
export function replaceTutor(input: ReplaceTutorInput): ReplaceTutorResult {
  const at = nowIso()
  const outgoing = tutorAssignmentsCollection.find(input.assignmentId)
  if (!outgoing) throw new Error('Assignment not found')
  if (outgoing.status !== 'active') throw new Error('That assignment has already ended.')
  if (!input.reason.trim()) throw new Error('A tutor change needs a stated reason.')

  const started = assignTutor({
    cohortId: outgoing.cohortId,
    tutorPersonId: input.incomingTutorPersonId,
    role: input.role,
    startDate: input.effectiveDate,
  })

  const ended =
    tutorAssignmentsCollection.update(outgoing.id, {
      status: 'ended',
      endDate: input.effectiveDate,
      endReason: input.reason.trim(),
      replacedByAssignmentId: started.id,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    }) ?? outgoing

  const cohort = cohortsCollection.find(outgoing.cohortId)
  emitAudit({
    action: 'tutor.replace',
    entityType: 'TutorAssignment',
    entityId: outgoing.id,
    entityRef: `${personName(outgoing.tutorPersonId)} · ${cohort?.code ?? outgoing.cohortId}`,
    field: 'status',
    before: `active — ${outgoing.sessionsDelivered} sessions delivered`,
    after: `ended ${input.effectiveDate}, replaced by ${personName(input.incomingTutorPersonId)} — ${input.reason.trim()}`,
  })

  return { ended, started }
}

export function endTutorAssignment(assignmentId: string, reason: string, effectiveDate: string): TutorAssignment | undefined {
  const at = nowIso()
  const assignment = tutorAssignmentsCollection.find(assignmentId)
  if (!assignment) return undefined
  if (!reason.trim()) throw new Error('Ending an assignment needs a stated reason.')

  const updated = tutorAssignmentsCollection.update(assignmentId, {
    status: 'ended',
    endDate: effectiveDate,
    endReason: reason.trim(),
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  const cohort = cohortsCollection.find(assignment.cohortId)
  emitAudit({
    action: 'tutor.assignment.end',
    entityType: 'TutorAssignment',
    entityId: assignment.id,
    entityRef: `${personName(assignment.tutorPersonId)} · ${cohort?.code ?? assignment.cohortId}`,
    field: 'status',
    before: 'active',
    after: `ended ${effectiveDate} — ${reason.trim()}`,
  })

  return updated
}

/* -------------------------------------------------------------------------- */
/* Class sessions                                                             */
/* -------------------------------------------------------------------------- */

export interface ScheduleSessionInput {
  cohortId: string
  topic: string
  date: string
  startTime: string
  endTime: string
  room: string | null
  meetingUrl: string | null
  tutorPersonId: PersonId
}

/** Who a session on this cohort should be expecting. */
export function expectedFor(cohortId: string): number {
  return enrollmentsCollection.count((e) => e.cohortId === cohortId && e.status === 'active')
}

export function scheduleSession(input: ScheduleSessionInput): ClassSession {
  const at = nowIso()
  const cohort = cohortsCollection.find(input.cohortId)
  const existing = classSessionsCollection.where((s) => s.cohortId === input.cohortId)
  const sequence = existing.reduce((max, s) => Math.max(max, s.sequence), 0) + 1

  const session = classSessionsCollection.insert({
    id: asSessionId(`session-ui-${Date.now().toString(36)}`),
    cohortId: input.cohortId as ClassSession['cohortId'],
    sequence,
    topic: input.topic.trim(),
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    room: input.room?.trim() || null,
    meetingUrl: input.meetingUrl?.trim() || null,
    tutorPersonId: input.tutorPersonId,
    expectedCount: expectedFor(input.cohortId),
    presentCount: 0,
    status: 'scheduled',
    ...auditable(at),
  })

  emitAudit({
    action: 'class_session.schedule',
    entityType: 'ClassSession',
    entityId: session.id,
    entityRef: `${cohort?.code ?? input.cohortId} · ${sequence}. ${session.topic}`,
    field: 'status',
    before: null,
    after: `scheduled ${input.date} ${input.startTime}–${input.endTime}`,
  })

  return session
}

export function cancelSession(sessionId: string, reason: string): ClassSession | undefined {
  const at = nowIso()
  const session = classSessionsCollection.find(sessionId)
  if (!session) return undefined
  if (!reason.trim()) throw new Error('Cancelling a session needs a stated reason.')

  const updated = classSessionsCollection.update(sessionId, {
    status: 'cancelled',
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'class_session.cancel',
    entityType: 'ClassSession',
    entityId: session.id,
    entityRef: `${session.sequence}. ${session.topic}`,
    field: 'status',
    before: session.status,
    after: `cancelled — ${reason.trim()}`,
  })

  return updated
}

/** New enrolments change how many people every future session is expecting. */
function recountExpectedAttendance(cohortId: string): void {
  const expected = expectedFor(cohortId)
  classSessionsCollection
    .where((s) => s.cohortId === cohortId && (s.status === 'scheduled' || s.status === 'rescheduled'))
    .forEach((s) => {
      if (s.expectedCount !== expected) classSessionsCollection.update(s.id, { expectedCount: expected })
    })
}

/* -------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* -------------------------------------------------------------------------- */

export interface AttendanceEntry {
  enrollmentId: string
  personId: PersonId
  state: StudentAttendanceState
  /** Required when an existing record's state is being changed. */
  overrideReason?: string
}

export interface AttendanceResult {
  created: number
  overridden: number
}

/**
 * Logging a register. A student with no record yet gets one; a student whose
 * recorded state changes is an **override** and needs a reason, which is
 * written to the record and emitted as an audit event naming both states.
 *
 * FLAG — `StudentAttendance` has no `supersedesAttendanceId`, so an override
 * updates the row and relies on the audit event for the before/after pair,
 * rather than the never-mutate shape used for money. Making attendance
 * corrections append-only the way a credit note is needs that one extra field
 * in `src/mocks/types.ts`, which this module does not own.
 */
export function recordAttendance(
  sessionId: string,
  entries: AttendanceEntry[],
  source: StudentAttendanceSource = 'tutor_manual',
): AttendanceResult {
  const at = nowIso()
  const session = classSessionsCollection.find(sessionId)
  if (!session) throw new Error('Session not found')

  let created = 0
  let overridden = 0

  for (const entry of entries) {
    const existing = studentAttendanceCollection
      .all()
      .find((a) => a.sessionId === sessionId && a.enrollmentId === entry.enrollmentId)

    if (!existing) {
      studentAttendanceCollection.insert({
        id: asStuAttId(`stuatt-ui-${Date.now().toString(36)}-${created}`),
        sessionId: session.id,
        enrollmentId: entry.enrollmentId as StudentAttendance['enrollmentId'],
        personId: entry.personId,
        state: entry.state,
        source,
        tapEventId: null,
        tappedAt: source === 'tutor_manual' ? null : at,
        tutorConfirmed: source === 'tutor_manual',
        overrideReason: null,
        ...auditable(at),
      })
      created += 1
      continue
    }

    if (existing.state === entry.state) continue

    const reason = entry.overrideReason?.trim()
    if (!reason) {
      throw new Error(
        `Changing ${personName(entry.personId)} from ${existing.state} to ${entry.state} is an override and needs a reason.`,
      )
    }

    studentAttendanceCollection.update(existing.id, {
      state: entry.state,
      source: 'tutor_manual',
      tutorConfirmed: true,
      overrideReason: reason,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
    overridden += 1

    emitAudit({
      action: 'attendance.override',
      entityType: 'StudentAttendance',
      entityId: existing.id,
      entityRef: `${personName(entry.personId)} · ${session.sequence}. ${session.topic}`,
      field: 'state',
      before: `${existing.state} (${existing.source})`,
      after: `${entry.state} — ${reason}`,
    })
  }

  if (created > 0) {
    emitAudit({
      action: 'attendance.record',
      entityType: 'ClassSession',
      entityId: session.id,
      entityRef: `${session.sequence}. ${session.topic}`,
      field: 'attendance',
      before: null,
      after: `${created} recorded`,
    })
  }

  refreshAttendanceCounts(session.id)
  return { created, overridden }
}

/** A single row's state changed from the attendance list. Same rule, one row. */
export function overrideAttendance(
  attendanceId: string,
  state: StudentAttendanceState,
  reason: string,
): StudentAttendance | undefined {
  const record = studentAttendanceCollection.find(attendanceId)
  if (!record) return undefined
  recordAttendance(record.sessionId, [
    { enrollmentId: record.enrollmentId, personId: record.personId, state, overrideReason: reason },
  ])
  return studentAttendanceCollection.find(attendanceId)
}

/**
 * A session's present count and its cohort's attendance rate are both derived
 * from the rows, so they are recomputed rather than incremented — an override
 * has to be able to move a number down.
 */
export function refreshAttendanceCounts(sessionId: string): void {
  const session = classSessionsCollection.find(sessionId)
  if (!session) return

  const rows = studentAttendanceCollection.where((a) => a.sessionId === sessionId)
  const present = rows.filter((a) => a.state === 'present' || a.state === 'late').length

  classSessionsCollection.update(session.id, {
    presentCount: present,
    // A register that has been taken means the session happened.
    status: session.status === 'scheduled' && rows.length > 0 ? 'delivered' : session.status,
  })

  const cohortSessions = classSessionsCollection.where(
    (s) => s.cohortId === session.cohortId && (s.status === 'delivered' || s.id === session.id),
  )
  const cohortRows = studentAttendanceCollection.where((a) =>
    cohortSessions.some((s) => s.id === a.sessionId),
  )
  if (cohortRows.length > 0) {
    const attended = cohortRows.filter((a) => a.state === 'present' || a.state === 'late' || a.state === 'excused').length
    cohortsCollection.update(session.cohortId, {
      attendanceRate: Math.round((attended / cohortRows.length) * 100),
    })
  }

  /* Delivered sessions are what a tutor is credited for. */
  const delivered = classSessionsCollection.count(
    (s) => s.cohortId === session.cohortId && s.status === 'delivered' && s.tutorPersonId === session.tutorPersonId,
  )
  const assignment = tutorAssignmentsCollection
    .all()
    .find((a) => a.cohortId === session.cohortId && a.tutorPersonId === session.tutorPersonId && a.status === 'active')
  if (assignment && assignment.sessionsDelivered !== delivered) {
    tutorAssignmentsCollection.update(assignment.id, { sessionsDelivered: delivered })
  }
}
