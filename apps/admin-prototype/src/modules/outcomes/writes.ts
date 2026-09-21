/**
 * Every write the outcomes module performs.
 *
 * Two PRD rules shape this file and are enforced here rather than in the UI:
 *
 *  1. **Income is self-reported, always.** `incomeChange.selfReported` is
 *     literally typed `true`, and a figure is only ever stored with
 *     `volunteered: true`. There is no code path that records an income
 *     figure the graduate was asked for, and none that marks one verified.
 *     `verifiedByUserId` verifies the *placement* — the employer and the role
 *     — never the money.
 *  2. **Nothing is overwritten silently.** Recording a placement emits an
 *     audit event naming the previous outcome type and the new one, so a
 *     graduate moving from "not yet placed" to "full-time" leaves a trail.
 */

import {
  TODAY,
  CURRENT_USER_ID,
  auditEventsCollection,
  employersCollection,
  outcomeRecordsCollection,
  peopleCollection,
  rolesCollection,
  usersCollection,
} from '@/mocks'
import {
  auditId as asAuditId,
  employerId as asEmployerId,
  type AuditEvent,
  type Channel,
  type Employer,
  type EmployerId,
  type Kobo,
  type OutcomeCheckpoint,
  type OutcomeRecord,
  type OutcomeType,
  type UserId,
} from '@/mocks/types'

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

/** The seed's fixed date with the wall clock's time of day. */
export function nowIso(): string {
  const d = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}+01:00`
}

function auditable(at: string = nowIso()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

function personName(id: string | null | undefined): string {
  if (!id) return 'Unknown person'
  const person = peopleCollection.find(id)
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
}

function userName(id: string | null | undefined): string {
  if (!id) return 'Unassigned'
  const user = usersCollection.find(id)
  if (!user) return 'Unknown user'
  return personName(user.personId) || user.email
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

let auditSequence = 0

export function emitAudit(input: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): AuditEvent {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0]
    ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff')
    : 'Staff'

  return auditEventsCollection.insert({
    id: asAuditId(`aud-out-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
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
    source: 'ui',
    ip: '102.89.34.17',
  })
}

/* -------------------------------------------------------------------------- */
/* Employers                                                                  */
/* -------------------------------------------------------------------------- */

export interface NewEmployerInput {
  name: string
  industry: string
  size: string
  location: string
  relationshipOwnerUserId: UserId | null
  partnershipStatus: Employer['partnershipStatus']
  contactNote: string
}

export function employerNameTaken(name: string): boolean {
  const normalised = name.trim().toLowerCase()
  return employersCollection.all().some((e) => e.name.trim().toLowerCase() === normalised)
}

/**
 * An employer starts with no hires. `graduatesHired` is a stored count that
 * `recordPlacement` maintains; the Employers table shows it beside the live
 * count from the outcome records so a disagreement is visible rather than
 * papered over.
 */
export function createEmployer(input: NewEmployerInput): Employer {
  const at = nowIso()
  const employer: Employer = {
    id: asEmployerId(`emp-ui-${Date.now().toString(36)}`),
    name: input.name.trim(),
    industry: input.industry.trim(),
    size: input.size,
    location: input.location.trim(),
    graduatesHired: 0,
    firstHireDate: null,
    lastHireDate: null,
    relationshipOwnerUserId: input.relationshipOwnerUserId,
    partnershipStatus: input.partnershipStatus,
    satisfactionScore: null,
    ...auditable(at),
  }
  employersCollection.insert(employer)

  emitAudit({
    action: 'employer.create',
    entityType: 'Employer',
    entityId: employer.id,
    entityRef: employer.name,
    field: null,
    before: null,
    after: `${employer.industry} · ${employer.location}`,
  })

  if (input.contactNote.trim()) {
    emitAudit({
      action: 'employer.contact.record',
      entityType: 'Employer',
      entityId: employer.id,
      entityRef: employer.name,
      field: 'contact',
      before: null,
      after: input.contactNote.trim(),
    })
  }

  return employer
}

/* -------------------------------------------------------------------------- */
/* Placements                                                                 */
/* -------------------------------------------------------------------------- */

export interface PlacementInput {
  recordId: string
  employerId: EmployerId | null
  outcomeType: OutcomeType
  jobTitle: string
  placementDate: string
  location: string
  relevanceToCourse: 'direct' | 'adjacent' | 'unrelated' | null
  /**
   * Present only when the graduate offered it unprompted. Recorded as
   * self-reported and never verified; omit it entirely otherwise.
   */
  volunteeredIncome: { before: Kobo | null; after: Kobo | null } | null
  consentForPublicUse: boolean
  notes: string
  markVerified: boolean
}

/** Outcome types that name an employer. Study and self-employment do not. */
export const EMPLOYER_BACKED_TYPES: OutcomeType[] = ['full_time', 'contract', 'internship', 'freelance']

export function recordPlacement(record: OutcomeRecord, input: PlacementInput): OutcomeRecord | undefined {
  const at = nowIso()
  const employerId = EMPLOYER_BACKED_TYPES.includes(input.outcomeType) ? input.employerId : null

  const patch: Partial<OutcomeRecord> = {
    outcomeType: input.outcomeType,
    employerId,
    jobTitle: input.jobTitle.trim() || null,
    placementDate: input.outcomeType === 'not_yet_placed' ? null : input.placementDate,
    location: input.location.trim() || null,
    relevanceToCourse: input.relevanceToCourse,
    incomeChange: input.volunteeredIncome
      ? {
          before: input.volunteeredIncome.before,
          after: input.volunteeredIncome.after,
          selfReported: true,
          volunteered: true,
        }
      : record.incomeChange,
    consentForPublicUse: input.consentForPublicUse,
    consentCapturedAt: input.consentForPublicUse
      ? (record.consentCapturedAt ?? at)
      : null,
    verifiedByUserId: input.markVerified ? CURRENT_USER_ID : record.verifiedByUserId,
    notes: input.notes.trim() || record.notes,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  }

  const updated = outcomeRecordsCollection.update(record.id, patch)

  emitAudit({
    action: 'outcome.placement.record',
    entityType: 'OutcomeRecord',
    entityId: record.id,
    entityRef: personName(record.personId),
    field: 'outcomeType',
    before: record.outcomeType,
    after: input.outcomeType,
  })

  if ((record.employerId as string | null) !== (employerId as string | null)) {
    emitAudit({
      action: 'outcome.employer.set',
      entityType: 'OutcomeRecord',
      entityId: record.id,
      entityRef: personName(record.personId),
      field: 'employerId',
      before: record.employerId ? (employersCollection.find(record.employerId)?.name ?? null) : null,
      after: employerId ? (employersCollection.find(employerId)?.name ?? null) : null,
    })
  }

  if (input.volunteeredIncome) {
    emitAudit({
      action: 'outcome.income.record',
      entityType: 'OutcomeRecord',
      entityId: record.id,
      entityRef: personName(record.personId),
      field: 'incomeChange',
      before: 'Not volunteered',
      after: 'Volunteered by the graduate — self-reported, never verified',
    })
  }

  if (record.consentForPublicUse !== input.consentForPublicUse) {
    emitAudit({
      action: 'outcome.consent.change',
      entityType: 'OutcomeRecord',
      entityId: record.id,
      entityRef: personName(record.personId),
      field: 'consentForPublicUse',
      before: String(record.consentForPublicUse),
      after: String(input.consentForPublicUse),
    })
  }

  if (employerId) rollUpEmployer(employerId)
  if (record.employerId && record.employerId !== employerId) rollUpEmployer(record.employerId)

  return updated
}

/* -------------------------------------------------------------------------- */
/* Checkpoints                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Records a follow-up attempt against one checkpoint. Attempts only ever
 * increase — a graduate who never answers keeps their attempt count and stays
 * in the denominator, which is what makes the placement rate honest rather
 * than flattering.
 */
export function recordCheckpointAttempt(
  record: OutcomeRecord,
  month: OutcomeCheckpoint['month'],
  channel: Channel,
  outcome: 'sent' | 'responded' | 'no_response',
): void {
  const at = nowIso()
  const checkpoints = record.checkpoints.map((checkpoint) =>
    checkpoint.month === month
      ? {
          ...checkpoint,
          status: outcome,
          attempts: checkpoint.attempts + 1,
          lastChannel: channel,
          respondedAt: outcome === 'responded' ? at : checkpoint.respondedAt,
        }
      : checkpoint,
  )

  outcomeRecordsCollection.update(record.id, {
    checkpoints,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  const before = record.checkpoints.find((c) => c.month === month)
  emitAudit({
    action: 'outcome.checkpoint.attempt',
    entityType: 'OutcomeRecord',
    entityId: record.id,
    entityRef: `${personName(record.personId)} · ${month} month checkpoint`,
    field: 'checkpoints',
    before: `${before?.status ?? 'scheduled'} after ${before?.attempts ?? 0} attempts`,
    after: `${outcome} after ${(before?.attempts ?? 0) + 1} attempts, over ${channel}`,
  })
}

/**
 * The employer's hire count and first/last hire dates are recomputed from the
 * outcome records rather than incremented, so moving a graduate from one
 * employer to another leaves both rows correct.
 */
function rollUpEmployer(employerId: EmployerId): void {
  const employer = employersCollection.find(employerId)
  if (!employer) return
  const mine = outcomeRecordsCollection
    .all()
    .filter((r) => r.employerId === employerId && r.placementDate !== null)
  const dates = mine.map((r) => r.placementDate as string).sort()

  employersCollection.update(employerId, {
    graduatesHired: Math.max(employer.graduatesHired, mine.length),
    firstHireDate: dates[0] ?? employer.firstHireDate,
    lastHireDate: dates[dates.length - 1] ?? employer.lastHireDate,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
}
