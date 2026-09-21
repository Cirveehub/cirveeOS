/**
 * Every write the CRM module performs.
 *
 * Three rules hold across this file, and the PRD is unforgiving about all
 * three:
 *
 *  1. **Attribution is never overwritten.** Reassigning an owner appends to
 *     `ownershipHistory`; it does not touch the referrer or the closer.
 *  2. **`originalSource` is written once.** Only `latestSource` ever moves.
 *  3. **Audited actions emit an `AuditEvent`** — actor, timestamp, field,
 *     before and after — which is a different record from an `Activity`.
 *
 * Nothing here removes a row. Withdrawals, archives and merges are status
 * transitions that leave the original visible.
 */

import {
  TODAY,
  CURRENT_USER_ID,
  activitiesCollection,
  admissionsCollection,
  approvalRequestsCollection,
  auditEventsCollection,
  commissionsCollection,
  cohortsCollection,
  coursesCollection,
  duplicateCandidatesCollection,
  enrollmentsCollection,
  followUpsCollection,
  invoicesCollection,
  accountsCollection,
  leadsCollection,
  peopleCollection,
  policyVersionsCollection,
  relationshipsCollection,
  rolesCollection,
  usersCollection,
  select,
} from '@/mocks'
import {
  activityId as asActivityId,
  admissionId as asAdmissionId,
  approvalId as asApprovalId,
  auditId as asAuditId,
  commissionId as asCommissionId,
  enrollmentId as asEnrollmentId,
  followUpId as asFollowUpId,
  invoiceId as asInvoiceId,
  invLineId as asInvoiceLineId,
  leadId as asLeadId,
  pid as asPersonId,
  relId as asRelationshipId,
  accountId as asAccountId,
  asKobo,
  type Activity,
  type ActivitySubjectType,
  type ActivityType,
  type Admission,
  type AdmissionStatus,
  type ApprovalRequest,
  type AuditEvent,
  type AuditSource,
  type BranchId,
  type CallOutcome,
  type CohortId,
  type Commission,
  type CommissionPreview,
  type CourseId,
  type DiscountType,
  type DuplicateCandidate,
  type FollowUp,
  type Instalment,
  type Invoice,
  type Kobo,
  type Lead,
  type LeadSource,
  type LeadStage,
  type LossReason,
  type Mode,
  type PaymentPlan,
  type Person,
  type PersonId,
  type RelationshipType,
  type UnitId,
  type UserId,
} from '@/mocks/types'
import { personName, userName } from './lookups'

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The prototype's now. The date is always the seed's fixed TODAY so relative
 * dates never rot; only the time of day comes from the wall clock, which is
 * what makes the response-time chip tick during a demo.
 */
export function nowIso(): string {
  const d = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}+01:00`
}

export function addDaysIso(date: string, days: number): string {
  const base = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  return new Date(base + days * 86_400_000).toISOString().slice(0, 10)
}

export function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000))
}

export function daysBetween(from: string, to: string): number {
  return Math.max(
    0,
    Math.floor((Date.parse(to.slice(0, 10)) - Date.parse(from.slice(0, 10))) / 86_400_000),
  )
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

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
  actorUserId?: UserId
}

/** Append-only. There is no update or delete path for an audit event. */
export function emitAudit(input: AuditInput): AuditEvent {
  auditSequence += 1
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const user = usersCollection.find(actorUserId)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff') : 'Staff'

  const event: AuditEvent = {
    id: asAuditId(`aud-ui-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: nowIso(),
    actorUserId,
    actorName: userName(actorUserId),
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
  }
  return auditEventsCollection.insert(event)
}

function auditable(at: string = nowIso()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

/* -------------------------------------------------------------------------- */
/* References                                                                 */
/* -------------------------------------------------------------------------- */

function nextSequence(refs: string[], prefix: string): number {
  const numbers = refs
    .filter((r) => r.startsWith(prefix))
    .map((r) => Number(r.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
  return (numbers.length ? Math.max(...numbers) : 0) + 1
}

export function nextLeadRef(): string {
  const n = nextSequence(
    leadsCollection.all().map((l) => l.ref),
    'CIR-L-',
  )
  return `CIR-L-${String(n).padStart(4, '0')}`
}

export function nextAdmissionRef(): string {
  const year = TODAY.slice(0, 4)
  const n = nextSequence(
    admissionsCollection.all().map((a) => a.ref),
    `ADM-${year}-`,
  )
  return `ADM-${year}-${String(n).padStart(4, '0')}`
}

export function nextInvoiceRef(): string {
  const year = TODAY.slice(0, 4)
  const n = nextSequence(
    invoicesCollection.all().map((i) => i.ref),
    `INV-${year}-`,
  )
  return `INV-${year}-${String(n).padStart(4, '0')}`
}

export function nextCommissionRef(): string {
  const year = TODAY.slice(0, 4)
  const n = nextSequence(
    commissionsCollection.all().map((c) => c.ref),
    `COM-${year}-`,
  )
  return `COM-${year}-${String(n).padStart(4, '0')}`
}

export function nextApprovalRef(): string {
  const year = TODAY.slice(0, 4)
  const n = nextSequence(
    approvalRequestsCollection.all().map((a) => a.ref),
    `APR-${year}-`,
  )
  return `APR-${year}-${String(n).padStart(4, '0')}`
}

/* -------------------------------------------------------------------------- */
/* Activity feed                                                              */
/* -------------------------------------------------------------------------- */

export function logActivity(args: {
  subjectType: ActivitySubjectType
  subjectId: string
  type: ActivityType
  body: string
  callOutcome?: CallOutcome
  durationMinutes?: number
  system?: boolean
  at?: string
}): Activity {
  const at = args.at ?? nowIso()
  const activity: Activity = {
    id: asActivityId(`act-ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
    subjectType: args.subjectType,
    subjectId: args.subjectId,
    type: args.type,
    body: args.body,
    callOutcome: args.callOutcome,
    durationMinutes: args.durationMinutes,
    attachmentIds: [],
    isSystemGenerated: args.system ?? false,
    ...auditable(at),
  }
  return activitiesCollection.insert(activity)
}

/**
 * Logging a human touch on a lead stops the response-time clock — once, and
 * only once. `firstResponseAt` is the PRD's reported metric, so a later call
 * must not reset it.
 */
export function recordLeadTouch(lead: Lead, at: string = nowIso()): void {
  if (lead.firstResponseAt) {
    leadsCollection.update(lead.id, { lastActivityAt: at, updatedAt: at, updatedBy: CURRENT_USER_ID })
    return
  }
  const minutes = minutesBetween(lead.createdAt, at)
  leadsCollection.update(lead.id, {
    firstResponseAt: at,
    firstResponseMinutes: minutes,
    lastActivityAt: at,
    stage: lead.stage === 'new' ? 'contacted' : lead.stage,
    stageEnteredAt: lead.stage === 'new' ? at : lead.stageEnteredAt,
    daysInStage: lead.stage === 'new' ? 0 : lead.daysInStage,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'lead.first_response',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'firstResponseAt',
    before: null,
    after: at,
  })
  if (lead.stage === 'new') {
    emitAudit({
      action: 'lead.stage.change',
      entityType: 'Lead',
      entityId: lead.id,
      entityRef: lead.ref,
      field: 'stage',
      before: 'New',
      after: 'Contacted',
    })
  }
}

/* -------------------------------------------------------------------------- */
/* People                                                                     */
/* -------------------------------------------------------------------------- */

export interface NewPersonInput {
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  city: string
  state: string
  primaryBranchId: BranchId | null
}

export function createPerson(input: NewPersonInput): Person {
  const at = nowIso()
  const person: Person = {
    id: asPersonId(`per-ui-${Date.now().toString(36)}`),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    whatsapp: input.whatsapp?.trim() || null,
    dateOfBirth: null,
    city: input.city.trim() || 'Ibadan',
    state: input.state.trim() || 'Oyo',
    country: 'Nigeria',
    avatarInitials: `${input.firstName.trim()[0] ?? ''}${input.lastName.trim()[0] ?? ''}`.toUpperCase(),
    primaryBranchId: input.primaryBranchId,
    tags: [],
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: [
      {
        type: 'data_processing',
        granted: true,
        capturedAt: at,
        capturedVia: 'staff',
        capturedBy: CURRENT_USER_ID,
      },
    ],
    ...auditable(at),
  }
  peopleCollection.insert(person)
  emitAudit({
    action: 'person.create',
    entityType: 'Person',
    entityId: person.id,
    entityRef: `${person.firstName} ${person.lastName}`,
    field: null,
    before: null,
    after: 'Created',
  })
  return person
}

export function addRelationship(args: {
  personId: PersonId
  type: RelationshipType
  unitId: UnitId | null
  branchId: BranchId | null
  relatedRecordId: string | null
}): void {
  const existing = relationshipsCollection
    .all()
    .find((r) => r.personId === args.personId && r.type === args.type && r.status === 'active')
  if (existing) return

  relationshipsCollection.insert({
    id: asRelationshipId(`rel-ui-${Date.now().toString(36)}-${args.type}`),
    personId: args.personId,
    type: args.type,
    startDate: TODAY,
    endDate: null,
    status: 'active',
    unitId: args.unitId,
    branchId: args.branchId,
    relatedRecordId: args.relatedRecordId,
    ...auditable(),
  })
}

export function endRelationship(relationshipId: string, reason: string): void {
  const rel = relationshipsCollection.find(relationshipId)
  if (!rel) return
  relationshipsCollection.update(relationshipId, {
    status: 'ended',
    endDate: TODAY,
    endReason: reason,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'person.relationship.end',
    entityType: 'Relationship',
    entityId: rel.id,
    entityRef: `${personName(rel.personId)} · ${rel.type}`,
    field: 'status',
    before: 'active',
    after: 'ended',
  })
}

/* -------------------------------------------------------------------------- */
/* Leads                                                                      */
/* -------------------------------------------------------------------------- */

export interface NewLeadInput {
  personId: PersonId
  courseInterestId: CourseId | null
  mode: Mode
  branchId: BranchId
  unitId: UnitId
  source: LeadSource
  campaignId: null
  utm: { source?: string; medium?: string; campaign?: string; content?: string; term?: string }
  landingPage: string | null
  referrerPersonId: PersonId | null
  ownerUserId: UserId
  quotedValue: Kobo | null
  nextAction: string | null
  nextActionDueAt: string | null
  notes: string
  /** The routing rule that chose the owner, named on the profile's audit row. */
  routingRule: string
}

export function createLead(input: NewLeadInput): Lead {
  const at = nowIso()
  const ref = nextLeadRef()
  const lead: Lead = {
    id: asLeadId(`lead-ui-${Date.now().toString(36)}`),
    ref,
    personId: input.personId,
    courseInterestId: input.courseInterestId,
    mode: input.mode,
    branchId: input.branchId,
    unitId: input.unitId,
    stage: 'new',
    stageEnteredAt: at,
    daysInStage: 0,
    quotedValue: input.quotedValue,
    referrerPersonId: input.referrerPersonId,
    ownerUserId: input.ownerUserId,
    closerUserId: null,
    originalSource: input.source,
    latestSource: input.source,
    campaignId: input.campaignId,
    utm: input.utm,
    landingPage: input.landingPage,
    referralCode: null,
    firstResponseAt: null,
    firstResponseMinutes: null,
    responseSlaMinutes: 120,
    nextAction: input.nextAction,
    nextActionDueAt: input.nextActionDueAt,
    lastActivityAt: at,
    lossReason: null,
    lossNote: null,
    ownershipHistory: [
      {
        fromUserId: null,
        toUserId: input.ownerUserId,
        at,
        byUserId: CURRENT_USER_ID,
        reason: input.routingRule,
      },
    ],
    ...auditable(at),
  }

  leadsCollection.insert(lead)
  addRelationship({
    personId: input.personId,
    type: 'lead',
    unitId: input.unitId,
    branchId: input.branchId,
    relatedRecordId: lead.id,
  })

  emitAudit({
    action: 'lead.create',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: ref,
    field: null,
    before: null,
    after: 'New',
  })
  emitAudit({
    action: 'lead.owner.change',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: ref,
    field: 'ownerUserId',
    before: null,
    after: userName(input.ownerUserId),
    source: 'automation',
  })
  emitAudit({
    action: 'lead.source.locked',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: ref,
    field: 'originalSource',
    before: null,
    after: `${input.source} — immutable after creation`,
    source: 'api',
  })

  logActivity({
    subjectType: 'lead',
    subjectId: lead.id,
    type: 'system',
    body: `Lead created. Source ${input.source.replace(/_/g, ' ')}. Owner ${userName(input.ownerUserId)} via ${input.routingRule}.`,
    system: true,
    at,
  })

  if (input.notes.trim()) {
    logActivity({ subjectType: 'lead', subjectId: lead.id, type: 'note', body: input.notes.trim(), at })
  }

  if (input.nextAction && input.nextActionDueAt) {
    createFollowUp({
      leadId: lead.id,
      ownerUserId: input.ownerUserId,
      action: input.nextAction,
      dueAt: input.nextActionDueAt,
    })
  }

  return lead
}

export function changeStage(lead: Lead, to: LeadStage, loss?: { reason: LossReason; note: string }): void {
  if (lead.stage === to) return
  const at = nowIso()

  leadsCollection.update(lead.id, {
    stage: to,
    stageEnteredAt: at,
    daysInStage: 0,
    lastActivityAt: at,
    lossReason: loss ? loss.reason : lead.lossReason,
    lossNote: loss ? loss.note : lead.lossNote,
    nextAction: loss ? null : lead.nextAction,
    nextActionDueAt: loss ? null : lead.nextActionDueAt,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'lead.stage.change',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'stage',
    before: lead.stage,
    after: to,
  })

  if (loss) {
    emitAudit({
      action: 'lead.loss_reason.set',
      entityType: 'Lead',
      entityId: lead.id,
      entityRef: lead.ref,
      field: 'lossReason',
      before: lead.lossReason,
      after: loss.reason,
    })
  }

  logActivity({
    subjectType: 'lead',
    subjectId: lead.id,
    type: 'system',
    body: `Stage changed from ${lead.stage.replace(/_/g, ' ')} to ${to.replace(/_/g, ' ')}.`,
    system: true,
    at,
  })
}

/**
 * Ownership moves; history is appended, never replaced. Referrer and closer
 * are untouched by design — the person who brought the lead is not the person
 * working it, and reassignment must not silently rewrite attribution.
 */
export function reassignOwner(lead: Lead, toUserId: UserId, reason: string): void {
  if (lead.ownerUserId === toUserId) return
  const at = nowIso()

  leadsCollection.update(lead.id, {
    ownerUserId: toUserId,
    ownershipHistory: [
      ...lead.ownershipHistory,
      { fromUserId: lead.ownerUserId, toUserId, at, byUserId: CURRENT_USER_ID, reason },
    ],
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'lead.owner.change',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'ownerUserId',
    before: userName(lead.ownerUserId),
    after: userName(toUserId),
  })

  logActivity({
    subjectType: 'lead',
    subjectId: lead.id,
    type: 'system',
    body: `Owner changed from ${userName(lead.ownerUserId)} to ${userName(toUserId)}. Reason: ${reason}`,
    system: true,
    at,
  })
}

export function setCloser(lead: Lead, closerUserId: UserId | null): void {
  const at = nowIso()
  leadsCollection.update(lead.id, { closerUserId, updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'lead.closer.set',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'closerUserId',
    before: lead.closerUserId ?? 'null',
    after: closerUserId ?? 'null',
  })
}

export function setReferrer(lead: Lead, referrerPersonId: PersonId | null, reason: string): void {
  const at = nowIso()
  leadsCollection.update(lead.id, { referrerPersonId, updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'lead.referrer.change',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'referrerPersonId',
    before: lead.referrerPersonId ? personName(lead.referrerPersonId) : 'null',
    after: referrerPersonId ? personName(referrerPersonId) : 'null',
  })
  logActivity({
    subjectType: 'lead',
    subjectId: lead.id,
    type: 'system',
    body: `Referrer changed. Reason: ${reason}`,
    system: true,
    at,
  })
}

/** Original source stays where it is. Only the latest source moves. */
export function setLatestSource(lead: Lead, source: LeadSource): void {
  leadsCollection.update(lead.id, { latestSource: source, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'lead.source.change',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'latestSource',
    before: lead.latestSource,
    after: source,
  })
}

export function setNextAction(lead: Lead, action: string, dueAt: string): void {
  leadsCollection.update(lead.id, {
    nextAction: action,
    nextActionDueAt: dueAt,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
}

export function archiveLead(lead: Lead, reason: string): void {
  const at = nowIso()
  leadsCollection.update(lead.id, { archivedAt: at, archivedReason: reason, updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'lead.archive',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: lead.ref,
    field: 'archivedAt',
    before: null,
    after: at,
  })
}

/* -------------------------------------------------------------------------- */
/* Follow-ups                                                                 */
/* -------------------------------------------------------------------------- */

export function createFollowUp(args: {
  leadId: string
  ownerUserId: UserId
  action: string
  dueAt: string
}): FollowUp {
  const followUp: FollowUp = {
    id: asFollowUpId(`fup-ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`),
    leadId: asLeadId(args.leadId),
    ownerUserId: args.ownerUserId,
    action: args.action,
    dueAt: args.dueAt,
    status: 'open',
    outcome: null,
    completedAt: null,
    ...auditable(),
  }
  return followUpsCollection.insert(followUp)
}

export function completeFollowUp(followUp: FollowUp, outcome: string, note: string): void {
  const at = nowIso()
  followUpsCollection.update(followUp.id, {
    status: 'completed',
    outcome,
    completedAt: at,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  const lead = leadsCollection.find(followUp.leadId)
  if (lead) {
    logActivity({
      subjectType: 'lead',
      subjectId: lead.id,
      type: 'note',
      body: note.trim() || `Follow-up completed: ${followUp.action}. Outcome: ${outcome}.`,
      at,
    })
    recordLeadTouch(lead, at)
    leadsCollection.update(lead.id, { nextAction: null, nextActionDueAt: null })
  }
}

export function rescheduleFollowUp(followUp: FollowUp, dueAt: string): void {
  followUpsCollection.update(followUp.id, {
    dueAt,
    status: 'rescheduled',
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
  const lead = leadsCollection.find(followUp.leadId)
  if (lead) leadsCollection.update(lead.id, { nextActionDueAt: dueAt })
}

export function reassignFollowUp(followUp: FollowUp, ownerUserId: UserId): void {
  followUpsCollection.update(followUp.id, { ownerUserId, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
}

/* -------------------------------------------------------------------------- */
/* Duplicates                                                                 */
/* -------------------------------------------------------------------------- */

export function resolveDuplicate(
  candidate: DuplicateCandidate,
  status: 'merged' | 'not_duplicate' | 'skipped',
  note: string,
): void {
  duplicateCandidatesCollection.update(candidate.id, {
    status,
    resolvedAt: nowIso(),
    resolvedBy: CURRENT_USER_ID,
    resolutionNote: note,
  })
  emitAudit({
    action: `person.duplicate.${status}`,
    entityType: 'DuplicateCandidate',
    entityId: candidate.id,
    entityRef: `${personName(candidate.personAId)} / ${personName(candidate.personBId)}`,
    field: 'status',
    before: candidate.status,
    after: status,
  })
}

/**
 * Merge. The losing record is never removed — it is marked
 * `mergedIntoPersonId`, and every lead, admission and activity is repointed
 * so both timelines survive on the surviving record.
 */
export function mergePeople(args: {
  survivingId: PersonId
  mergedId: PersonId
  fieldChoices: Partial<Pick<Person, 'firstName' | 'lastName' | 'email' | 'phone' | 'whatsapp' | 'city' | 'state'>>
}): { movedLeads: number; movedAdmissions: number; movedActivities: number; movedRelationships: number } {
  const at = nowIso()
  const surviving = peopleCollection.find(args.survivingId)
  const merged = peopleCollection.find(args.mergedId)
  if (!surviving || !merged) {
    return { movedLeads: 0, movedAdmissions: 0, movedActivities: 0, movedRelationships: 0 }
  }

  peopleCollection.update(args.survivingId, {
    ...args.fieldChoices,
    mergedFromPersonIds: [...surviving.mergedFromPersonIds, args.mergedId],
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  peopleCollection.update(args.mergedId, {
    mergedIntoPersonId: args.survivingId,
    archivedAt: at,
    archivedReason: `Merged into ${personName(args.survivingId)}`,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  const movedLeads = leadsCollection.updateWhere((l) => l.personId === args.mergedId, {
    personId: args.survivingId,
  })
  const movedAdmissions = admissionsCollection.updateWhere((a) => a.personId === args.mergedId, {
    personId: args.survivingId,
  })
  const movedActivities = activitiesCollection.updateWhere(
    (a) => a.subjectType === 'person' && a.subjectId === (args.mergedId as string),
    { subjectId: args.survivingId as string },
  )
  const movedRelationships = relationshipsCollection.updateWhere((r) => r.personId === args.mergedId, {
    personId: args.survivingId,
  })

  emitAudit({
    action: 'person.merge',
    entityType: 'Person',
    entityId: args.mergedId,
    entityRef: `${merged.firstName} ${merged.lastName}`,
    field: 'mergedIntoPersonId',
    before: null,
    after: args.survivingId,
  })

  return { movedLeads, movedAdmissions, movedActivities, movedRelationships }
}

/**
 * The reviewer chose to create a new Person despite a likely match. The PRD
 * requires the reason to be captured and audited, not silently swallowed.
 */
export function logDuplicateOverride(person: Person, matchedPerson: Person, reason: string): void {
  emitAudit({
    action: 'person.duplicate.override',
    entityType: 'Person',
    entityId: person.id,
    entityRef: `${person.firstName} ${person.lastName}`,
    field: 'duplicateCheck',
    before: `Likely match: ${matchedPerson.firstName} ${matchedPerson.lastName}`,
    after: `Created anyway — ${reason}`,
  })
}

/* -------------------------------------------------------------------------- */
/* Discount policy                                                            */
/* -------------------------------------------------------------------------- */

export interface DiscountBand {
  fromPercent: number
  toPercent: number | null
  approverRoleId: string | null
  label: string
}

/**
 * The threshold is configuration, not a constant in a component. It is read
 * from the active `discount_threshold` policy version.
 */
export function discountBands(): DiscountBand[] {
  const policy = policyVersionsCollection
    .all()
    .find((p) => p.kind === 'discount_threshold' && p.status === 'active')
  const bands = policy?.config.bands
  return Array.isArray(bands) ? (bands as DiscountBand[]) : []
}

export function discountThresholdPercent(): number {
  const bands = discountBands()
  const free = bands.find((b) => b.approverRoleId === null)
  return free?.toPercent ?? 15
}

export function bandForDiscount(percent: number): DiscountBand | null {
  return (
    discountBands().find(
      (b) => percent > b.fromPercent && (b.toPercent === null || percent <= b.toPercent),
    ) ?? null
  )
}

export function approverRoleLabel(percent: number): string {
  return bandForDiscount(percent)?.label ?? 'No approval needed'
}

/* -------------------------------------------------------------------------- */
/* Admissions                                                                 */
/* -------------------------------------------------------------------------- */

export interface AdmissionDraft {
  leadId: string | null
  personId: PersonId
  courseId: CourseId
  cohortId: CohortId
  mode: Mode
  branchId: BranchId
  unitId: UnitId
  expectedStartDate: string
  quotedFee: Kobo
  discountType: DiscountType
  discountValue: number
  discountAmount: Kobo
  discountReason: string | null
  netFee: Kobo
  paymentPlan: PaymentPlan
  instalments: Instalment[]
  referrerPersonId: PersonId | null
  leadOwnerUserId: UserId
  closerUserId: UserId | null
}

export interface AdmissionResult {
  admission: Admission
  invoice: Invoice | null
  approval: ApprovalRequest | null
  commissions: Commission[]
  enrolmentId: string | null
}

export function discountPercentOf(draft: {
  quotedFee: number
  discountType: DiscountType
  discountValue: number
  discountAmount: number
}): number {
  if (draft.discountType === 'none' || draft.quotedFee <= 0) return 0
  return Number(((draft.discountAmount / draft.quotedFee) * 100).toFixed(1))
}

export function computeDiscountAmount(
  quotedFee: number,
  type: DiscountType,
  value: number,
): number {
  if (type === 'none') return 0
  if (type === 'percentage' || type === 'scholarship') {
    return Math.round((quotedFee * Math.min(Math.max(value, 0), 100)) / 100)
  }
  return Math.min(Math.max(Math.round(value), 0), quotedFee)
}

export function splitInstalmentAmounts(total: number, count: number): number[] {
  if (count <= 1) return [total]
  const base = Math.floor(total / count / 100) * 100
  const parts = Array.from({ length: count }, () => base)
  parts[parts.length - 1] = total - base * (count - 1)
  return parts
}

/**
 * The one write in this module that touches five collections at once, and the
 * moment Flow 1 turns a lead into a student. In order: Admission, Student
 * relationship, Enrolment, Invoice (held when a discount needs approval),
 * commission rows, audit events.
 */
export function createAdmission(draft: AdmissionDraft, preview: CommissionPreview[]): AdmissionResult {
  const at = nowIso()
  const ref = nextAdmissionRef()
  const discountPercent = discountPercentOf(draft)
  const band = bandForDiscount(discountPercent)
  const needsApproval = band !== null && band.approverRoleId !== null

  const admissionId = asAdmissionId(`adm-ui-${Date.now().toString(36)}`)

  const admission: Admission = {
    id: admissionId,
    ref,
    leadId: draft.leadId ? asLeadId(draft.leadId) : null,
    personId: draft.personId,
    courseId: draft.courseId,
    cohortId: draft.cohortId,
    mode: draft.mode,
    branchId: draft.branchId,
    unitId: draft.unitId,
    expectedStartDate: draft.expectedStartDate,
    quotedFee: draft.quotedFee,
    discountType: draft.discountType,
    discountValue: draft.discountValue,
    discountAmount: draft.discountAmount,
    discountReason: draft.discountReason,
    discountApprovalId: null,
    netFee: draft.netFee,
    paymentPlan: draft.paymentPlan,
    instalments: draft.instalments,
    referrerPersonId: draft.referrerPersonId,
    leadOwnerUserId: draft.leadOwnerUserId,
    closerUserId: draft.closerUserId,
    invoiceId: null,
    status: needsApproval ? 'pending_discount_approval' : 'invoiced',
    enrolmentId: null,
    withdrawnAt: null,
    withdrawnReason: null,
    ...auditable(at),
  }
  admissionsCollection.insert(admission)

  emitAudit({
    action: 'admission.create',
    entityType: 'Admission',
    entityId: admission.id,
    entityRef: ref,
    field: null,
    before: null,
    after: admission.status,
  })

  /* Identity gains a Student relationship — the Person record is not duplicated. */
  addRelationship({
    personId: draft.personId,
    type: 'student',
    unitId: draft.unitId,
    branchId: draft.branchId,
    relatedRecordId: admission.id,
  })

  /* Enrolment. */
  const enrolmentId = asEnrollmentId(`enr-ui-${Date.now().toString(36)}`)
  enrollmentsCollection.insert({
    id: enrolmentId,
    personId: draft.personId,
    cohortId: draft.cohortId,
    courseId: draft.courseId,
    admissionId: admission.id,
    unitId: draft.unitId,
    enrolledAt: TODAY,
    status: 'active',
    advisorUserId: draft.leadOwnerUserId,
    attentionFlags: [],
    flaggedAt: null,
    ...auditable(at),
  })
  const cohort = cohortsCollection.find(draft.cohortId)
  if (cohort) cohortsCollection.update(cohort.id, { enrolledCount: cohort.enrolledCount + 1 })
  admissionsCollection.update(admission.id, { enrolmentId })

  /* Approval, when the discount is over the configured threshold. */
  let approval: ApprovalRequest | null = null
  if (needsApproval && band) {
    approval = raiseDiscountApproval(admission, discountPercent, band)
    admissionsCollection.update(admission.id, { discountApprovalId: approval.id })
  }

  /* Invoice — held while the discount waits for a decision. */
  let invoice: Invoice | null = null
  if (!needsApproval) {
    invoice = issueInvoiceFor({ ...admission, enrolmentId })
    admissionsCollection.update(admission.id, { invoiceId: invoice.id })
  }

  /* Commission expectations, one row per rule that matched a beneficiary. */
  const commissions = invoice ? writeCommissions(admission, invoice, preview) : []

  logActivity({
    subjectType: 'admission',
    subjectId: admission.id,
    type: 'system',
    body: `Admission ${ref} created from ${draft.leadId ? 'lead' : 'a direct application'}.`,
    system: true,
    at,
  })

  const updated = admissionsCollection.find(admission.id) ?? admission
  return { admission: updated, invoice, approval, commissions, enrolmentId }
}

function raiseDiscountApproval(
  admission: Admission,
  discountPercent: number,
  band: DiscountBand,
): ApprovalRequest {
  const at = nowIso()
  const steps = select.resolveApprovalRoute('discount', admission.discountAmount, {
    unitId: admission.unitId,
    branchId: admission.branchId,
    requesterUserId: CURRENT_USER_ID,
  })
  const ref = nextApprovalRef()
  const request: ApprovalRequest = {
    id: asApprovalId(`apr-ui-${Date.now().toString(36)}`),
    ref,
    type: 'discount',
    title: `${discountPercent}% discount — ${personName(admission.personId)}`,
    justification:
      admission.discountReason ??
      'Discount requested during admission. No reason was recorded on the wizard.',
    requesterUserId: CURRENT_USER_ID,
    amount: admission.discountAmount,
    unitId: admission.unitId,
    branchId: admission.branchId,
    relatedEntityType: 'Admission',
    relatedEntityId: admission.id,
    relatedEntityRef: admission.ref,
    attachmentIds: [],
    routeId: asApprovalRouteId('rt-discount-v2'),
    routeVersion: 2,
    steps,
    currentStepIndex: 0,
    currentApproverUserId: steps[0]?.approverUserId ?? null,
    raisedAt: at,
    ageHours: 0,
    slaHours: 24,
    slaState: 'within',
    escalatesToUserId: null,
    escalatesAt: null,
    status: 'pending',
    decidedAt: null,
    impact: [
      {
        text: `reduce the fee from ₦${(admission.quotedFee / 100).toLocaleString('en-NG')} to ₦${(admission.netFee / 100).toLocaleString('en-NG')}`,
        entityType: 'Admission',
        entityId: admission.id,
        entityRef: admission.ref,
      },
      {
        text: 'issue the invoice and release the enrolment',
        entityType: 'Admission',
        entityId: admission.id,
        entityRef: admission.ref,
      },
    ],
    thread: [
      {
        at,
        actorUserId: CURRENT_USER_ID,
        body: admission.discountReason ?? 'Discount requested during admission.',
        kind: 'comment',
      },
      {
        at,
        actorUserId: 'system',
        body: `Routed via the discount route v2. ${discountPercent}% exceeds the ${discountThresholdPercent()}% threshold — ${band.label}.`,
        kind: 'system',
      },
    ],
    ...auditable(at),
  }
  approvalRequestsCollection.insert(request)

  emitAudit({
    action: 'approval.raise',
    entityType: 'ApprovalRequest',
    entityId: request.id,
    entityRef: ref,
    field: 'status',
    before: null,
    after: 'pending',
  })
  emitAudit({
    action: 'admission.discount.request',
    entityType: 'Admission',
    entityId: admission.id,
    entityRef: admission.ref,
    field: 'discountApprovalId',
    before: null,
    after: ref,
  })
  return request
}

/** The invoice. Lines sum to the total; balance is total minus paid. */
export function issueInvoiceFor(admission: Admission): Invoice {
  const at = nowIso()
  const ref = nextInvoiceRef()
  const course = coursesCollection.find(admission.courseId)
  const cohort = cohortsCollection.find(admission.cohortId)

  let account = accountsCollection.all().find((a) => a.personId === admission.personId)
  if (!account) {
    account = accountsCollection.insert({
      id: asAccountId(`acct-ui-${Date.now().toString(36)}`),
      ref: `ACC-${admission.ref.slice(-4)}`,
      personId: admission.personId,
      organisationId: null,
      unitId: admission.unitId,
      branchId: admission.branchId,
      originalFee: admission.quotedFee,
      approvedDiscount: admission.discountAmount,
      netFee: admission.netFee,
      invoicedTotal: admission.netFee,
      paidTotal: asKobo(0),
      creditTotal: asKobo(0),
      refundedTotal: asKobo(0),
      balance: admission.netFee,
      daysOverdue: 0,
      status: 'current',
      ...auditable(at),
    })
  }

  const dueDate = admission.instalments[0]?.dueDate ?? admission.expectedStartDate

  const invoice: Invoice = {
    id: asInvoiceId(`inv-ui-${Date.now().toString(36)}`),
    ref,
    accountId: account.id,
    personId: admission.personId,
    organisationId: null,
    admissionId: admission.id,
    unitId: admission.unitId,
    branchId: admission.branchId,
    issueDate: TODAY,
    dueDate,
    subtotal: admission.quotedFee,
    discountAmount: admission.discountAmount,
    total: admission.netFee,
    paidAmount: asKobo(0),
    balance: admission.netFee,
    status: 'issued',
    daysOverdue: 0,
    issuedByUserId: CURRENT_USER_ID,
    voidedAt: null,
    voidReason: null,
    creditNoteIds: [],
    lines: [
      {
        id: asInvoiceLineId(`invl-ui-${Date.now().toString(36)}`),
        description: `${course?.title ?? 'Course'} — cohort ${cohort?.code ?? 'TBC'}`,
        courseId: admission.courseId,
        cohortId: admission.cohortId,
        enrollmentId: admission.enrolmentId,
        quantity: 1,
        unitPrice: admission.quotedFee,
        discountAmount: admission.discountAmount,
        amount: admission.netFee,
        unitId: admission.unitId,
      },
    ],
    ...auditable(at),
  }
  invoicesCollection.insert(invoice)

  accountsCollection.update(account.id, {
    invoicedTotal: asKobo(account.invoicedTotal + admission.netFee),
    balance: asKobo(account.balance + admission.netFee),
  })

  emitAudit({
    action: 'invoice.issue',
    entityType: 'Invoice',
    entityId: invoice.id,
    entityRef: ref,
    field: 'status',
    before: 'draft',
    after: 'issued',
  })
  return invoice
}

function writeCommissions(
  admission: Admission,
  invoice: Invoice,
  preview: CommissionPreview[],
): Commission[] {
  const at = nowIso()
  return preview.map((row, index) => {
    const commission: Commission = {
      id: asCommissionId(`com-ui-${Date.now().toString(36)}-${index}`),
      ref: nextCommissionRef(),
      beneficiaryPersonId: row.beneficiaryPersonId,
      roleOnDeal: row.roleOnDeal,
      admissionId: admission.id,
      invoiceId: invoice.id,
      courseId: admission.courseId,
      unitId: admission.unitId,
      branchId: admission.branchId,
      ruleId: row.ruleId,
      ruleKey: row.ruleKey,
      ruleVersion: row.ruleVersion,
      basis: row.basis,
      basisAmount: row.basisAmount,
      rateApplied: row.rateApplied,
      tierLabel: row.tierLabel,
      amount: row.amount,
      state: row.state === 'earned' ? 'earned' : 'pending',
      eligibilityNote: row.eligibilityNote,
      triggeringPaymentIds: [],
      earnedAt: null,
      approvalRequestId: null,
      approvedByUserId: null,
      approvedAt: null,
      payoutBatchId: null,
      paidAt: null,
      stateHistory: [
        {
          from: 'tracked',
          to: row.state === 'earned' ? 'earned' : 'pending',
          at,
          byUserId: CURRENT_USER_ID,
          note: `Created on admission ${admission.ref} under ${row.ruleName} v${row.ruleVersion}.`,
        },
      ],
      adjustmentOfCommissionId: null,
      reversalOfCommissionId: null,
      reversedByCommissionId: null,
      reversalReason: null,
      triggeringRefundId: null,
      ...auditable(at),
    }
    commissionsCollection.insert(commission)
    emitAudit({
      action: 'commission.create',
      entityType: 'Commission',
      entityId: commission.id,
      entityRef: commission.ref,
      field: 'state',
      before: null,
      after: commission.state,
    })
    return commission
  })
}

/**
 * Withdrawal. Nothing is deleted: the invoice is voided, pending commissions
 * are cancelled with a reason, the Student relationship is end-dated and the
 * admission stays visible with a Withdrawn badge.
 */
export function withdrawAdmission(admission: Admission, reason: string): void {
  const at = nowIso()
  admissionsCollection.update(admission.id, {
    status: 'withdrawn' as AdmissionStatus,
    withdrawnAt: at,
    withdrawnReason: reason,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  if (admission.invoiceId) {
    const invoice = invoicesCollection.find(admission.invoiceId)
    if (invoice && invoice.status !== 'cancelled') {
      invoicesCollection.update(invoice.id, {
        status: 'cancelled',
        voidedAt: at,
        voidReason: reason,
        updatedAt: at,
        updatedBy: CURRENT_USER_ID,
      })
      emitAudit({
        action: 'invoice.void',
        entityType: 'Invoice',
        entityId: invoice.id,
        entityRef: invoice.ref,
        field: 'status',
        before: invoice.status,
        after: 'cancelled',
      })
    }
  }

  commissionsCollection
    .where((c) => c.admissionId === admission.id && ['tracked', 'pending', 'earned'].includes(c.state))
    .forEach((c) => {
      commissionsCollection.update(c.id, {
        state: 'cancelled',
        reversalReason: reason,
        stateHistory: [
          ...c.stateHistory,
          { from: c.state, to: 'cancelled', at, byUserId: CURRENT_USER_ID, note: reason },
        ],
      })
      emitAudit({
        action: 'commission.cancel',
        entityType: 'Commission',
        entityId: c.id,
        entityRef: c.ref,
        field: 'state',
        before: c.state,
        after: 'cancelled',
      })
    })

  relationshipsCollection
    .where((r) => r.personId === admission.personId && r.type === 'student' && r.status === 'active')
    .forEach((r) => endRelationship(r.id, reason))

  if (admission.enrolmentId) {
    enrollmentsCollection.update(admission.enrolmentId, { status: 'withdrawn' })
  }

  emitAudit({
    action: 'admission.withdraw',
    entityType: 'Admission',
    entityId: admission.id,
    entityRef: admission.ref,
    field: 'status',
    before: admission.status,
    after: 'withdrawn',
  })
}

/* Re-exported so the approval id caster does not leak into every page. */
function asApprovalRouteId(value: string) {
  return value as ApprovalRequest['routeId']
}
