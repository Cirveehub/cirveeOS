import {
  TODAY,
  CURRENT_USER_ID,
  auditEventsCollection,
  certificatesCollection,
  cohortsCollection,
  corporateDealsCollection,
  clientOrgsCollection,
  outcomeRecordsCollection,
  peopleCollection,
  proofAssetsCollection,
  reviewRequestsCollection,
  rolesCollection,
  submissionsCollection,
  testimonialsCollection,
  usersCollection,
} from '@/mocks'
import {
  auditId as asAuditId,
  reviewReqId as asReviewRequestId,
  testimonialId as asTestimonialId,
  type AuditEvent,
  type BranchId,
  type Channel,
  type CohortId,
  type CourseId,
  type PersonId,
  type ProofAsset,
  type ReviewRequest,
  type ReviewTriggerMoment,
  type Testimonial,
  type UserId,
} from '@/mocks/types'

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
    id: asAuditId(`aud-rep-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
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

export interface TriggerEvent {
  key: string
  triggerMoment: ReviewTriggerMoment
  personId: PersonId
  personName: string
  sourceEventType: string
  sourceEventId: string
  summary: string
  occurredAt: string
  branchId: BranchId | null
  cohortId: CohortId | null
  courseId: CourseId | null
}

const DEFAULT_BRANCH = (): BranchId | null =>
  (cohortsCollection.all()[0]?.branchId as BranchId | undefined) ?? null

function branchForPerson(personId: PersonId, cohortId: CohortId | null): BranchId | null {
  const person = peopleCollection.find(personId)
  if (person?.primaryBranchId) return person.primaryBranchId
  if (cohortId) {
    const cohort = cohortsCollection.find(cohortId)
    if (cohort) return cohort.branchId
  }
  return DEFAULT_BRANCH()
}

export function triggerEvents(options: { excludeAlreadyRequested?: boolean } = {}): TriggerEvent[] {
  const exclude = options.excludeAlreadyRequested ?? true
  const already = new Set(
    reviewRequestsCollection.all().map((r) => `${r.sourceEventType}:${r.sourceEventId}`),
  )

  const events: TriggerEvent[] = []

  for (const certificate of certificatesCollection.all()) {
    if (certificate.status !== 'issued' || !certificate.issuedAt) continue
    events.push({
      key: `certificate_issued:${certificate.id}`,
      triggerMoment: 'certificate_issued',
      personId: certificate.personId,
      personName: personName(certificate.personId),
      sourceEventType: 'Certificate',
      sourceEventId: certificate.id as string,
      summary: `Certificate ${certificate.certificateId} issued`,
      occurredAt: certificate.issuedAt,
      branchId: certificate.issuingBranchId,
      cohortId: certificate.cohortId,
      courseId: certificate.courseId,
    })
  }

  for (const submission of submissionsCollection.all()) {
    if (submission.status !== 'graded' || !submission.gradedAt) continue
    if (submission.passed !== true || (submission.totalScore ?? 0) < 80) continue
    events.push({
      key: `strong_grade:${submission.id}`,
      triggerMoment: 'strong_grade',
      personId: submission.personId,
      personName: personName(submission.personId),
      sourceEventType: 'Submission',
      sourceEventId: submission.id as string,
      summary: `Scored ${submission.totalScore} on a graded assignment`,
      occurredAt: submission.gradedAt,
      branchId: branchForPerson(submission.personId, null),
      cohortId: null,
      courseId: null,
    })
  }

  for (const record of outcomeRecordsCollection.all()) {
    if (!record.placementDate || record.outcomeType === 'not_yet_placed') continue
    events.push({
      key: `placement_confirmed:${record.id}`,
      triggerMoment: 'placement_confirmed',
      personId: record.personId,
      personName: personName(record.personId),
      sourceEventType: 'OutcomeRecord',
      sourceEventId: record.id as string,
      summary: `Placement confirmed${record.jobTitle ? ` as ${record.jobTitle}` : ''}`,
      occurredAt: `${record.placementDate}T09:00:00+01:00`,
      branchId: branchForPerson(record.personId, record.cohortId),
      cohortId: record.cohortId,
      courseId: record.courseId,
    })
  }

  for (const deal of corporateDealsCollection.all()) {
    if (deal.stage !== 'completed') continue
    const org = clientOrgsCollection.find(deal.organisationId)
    if (!org) continue
    events.push({
      key: `corporate_engagement_completed:${deal.id}`,
      triggerMoment: 'corporate_engagement_completed',
      personId: org.primaryContactPersonId,
      personName: personName(org.primaryContactPersonId),
      sourceEventType: 'CorporateDeal',
      sourceEventId: deal.id as string,
      summary: `${org.name} — ${deal.title} completed`,
      occurredAt: `${deal.expectedCloseDate}T09:00:00+01:00`,
      branchId: branchForPerson(org.primaryContactPersonId, null),
      cohortId: null,
      courseId: null,
    })
  }

  return events
    .filter((event) => !exclude || !already.has(`${event.sourceEventType}:${event.sourceEventId}`))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
}

export function daysSince(isoDateTime: string): number {
  return Math.max(
    0,
    Math.round(
      (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${isoDateTime.slice(0, 10)}T00:00:00Z`)) /
        86_400_000,
    ),
  )
}

export function sendReviewRequest(event: TriggerEvent, channel: Channel): ReviewRequest {
  const at = nowIso()
  const request: ReviewRequest = {
    id: asReviewRequestId(`rvq-ui-${Date.now().toString(36)}`),
    personId: event.personId,
    triggerMoment: event.triggerMoment,
    sourceEventType: event.sourceEventType,
    sourceEventId: event.sourceEventId,
    sentAt: at,
    channel,
    openedAt: null,
    clickedAt: null,
    reviewed: false,
    rating: null,
    branchId: (event.branchId ?? DEFAULT_BRANCH()) as BranchId,
    cohortId: event.cohortId,
    ...auditable(at),
  }
  reviewRequestsCollection.insert(request)

  emitAudit({
    action: 'review_request.send',
    entityType: 'ReviewRequest',
    entityId: request.id,
    entityRef: event.personName,
    field: 'triggerMoment',
    before: null,
    after: `${event.triggerMoment} — ${event.sourceEventType} ${event.sourceEventId}`,
  })

  return request
}

export interface NewTestimonialInput {
  personId: PersonId
  courseId: CourseId
  cohortId: CohortId
  outcome: string
  quote: string
  channel: Channel
  consentGranted: boolean
  tags: string[]
}

export function createTestimonial(input: NewTestimonialInput): Testimonial {
  const at = nowIso()
  const testimonial: Testimonial = {
    id: asTestimonialId(`tst-ui-${Date.now().toString(36)}`),
    personId: input.personId,
    courseId: input.courseId,
    cohortId: input.cohortId,
    outcome: input.outcome.trim(),
    quote: input.quote.trim(),
    capturedAt: at,
    capturedByUserId: CURRENT_USER_ID,
    channel: input.channel,
    consentGranted: input.consentGranted,
    consentCapturedAt: input.consentGranted ? at : null,
    mediaUrls: [],
    tags: input.tags,
    usage: [],
    status: 'new',
    ...auditable(at),
  }
  testimonialsCollection.insert(testimonial)

  emitAudit({
    action: 'testimonial.capture',
    entityType: 'Testimonial',
    entityId: testimonial.id,
    entityRef: personName(input.personId),
    field: 'status',
    before: null,
    after: 'new',
  })
  emitAudit({
    action: 'testimonial.consent.capture',
    entityType: 'Testimonial',
    entityId: testimonial.id,
    entityRef: personName(input.personId),
    field: 'consentGranted',
    before: null,
    after: input.consentGranted
      ? `Granted on ${at}, captured over ${input.channel}`
      : 'Not granted — may not be published',
  })

  return testimonial
}

export function setTestimonialStatus(
  testimonial: Testimonial,
  status: Testimonial['status'],
  where?: string,
): void {
  if (status === 'published' && !testimonial.consentGranted) return
  const at = nowIso()
  testimonialsCollection.update(testimonial.id, {
    status,
    usage:
      status === 'published' && where
        ? [...testimonial.usage, { where, publishedAt: TODAY }]
        : testimonial.usage,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: `testimonial.${status}`,
    entityType: 'Testimonial',
    entityId: testimonial.id,
    entityRef: personName(testimonial.personId),
    field: 'status',
    before: testimonial.status,
    after: status,
  })
}

export function canApproveProof(asset: ProofAsset): boolean {
  return asset.consentStatus === 'granted' && (asset.status === 'drafted' || asset.status === 'in_production')
}

export function approveProofAsset(asset: ProofAsset, channel: string, assigneeUserId: UserId | null): boolean {
  if (!canApproveProof(asset)) return false
  const at = nowIso()
  proofAssetsCollection.update(asset.id, {
    status: 'approved',
    channel: channel || asset.channel,
    assigneeUserId: assigneeUserId ?? asset.assigneeUserId,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'proof_asset.approve',
    entityType: 'ProofAsset',
    entityId: asset.id,
    entityRef: `${asset.sourceEventRef} — ${personName(asset.subjectPersonId)}`,
    field: 'status',
    before: asset.status,
    after: 'approved',
  })
  return true
}

export function startProofProduction(asset: ProofAsset, assigneeUserId: UserId): void {
  const at = nowIso()
  proofAssetsCollection.update(asset.id, {
    status: 'in_production',
    assigneeUserId,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'proof_asset.production.start',
    entityType: 'ProofAsset',
    entityId: asset.id,
    entityRef: `${asset.sourceEventRef} — ${personName(asset.subjectPersonId)}`,
    field: 'status',
    before: asset.status,
    after: 'in_production',
  })
}

export function discardProofAsset(asset: ProofAsset, reason: string): void {
  const at = nowIso()
  proofAssetsCollection.update(asset.id, {
    status: 'discarded',
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
    archivedAt: at,
    archivedReason: reason,
  })
  emitAudit({
    action: 'proof_asset.discard',
    entityType: 'ProofAsset',
    entityId: asset.id,
    entityRef: `${asset.sourceEventRef} — ${personName(asset.subjectPersonId)}`,
    field: 'status',
    before: asset.status,
    after: `discarded — ${reason}`,
  })
}
