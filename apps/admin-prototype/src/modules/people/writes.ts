/**
 * Every write the People module makes.
 *
 * Four rules this file exists to enforce, all of them PRD absolutes rather
 * than house style:
 *
 *  1. **A pipeline stage transition never overwrites its history.** The
 *     `Candidate` record carries one current stage, so the trail lives in the
 *     audit log: one row per move, with the stage it came from, the stage it
 *     went to, who moved it and why. `candidateTrail()` reads it back. A
 *     candidate's past is therefore reconstructable even though the record
 *     itself only holds "where are they now".
 *
 *  2. **An accepted offer does not create an employee.** Acceptance is a
 *     response from the candidate; resumption is an event that may never
 *     happen. `recordOfferResponse` only ever sets the response.
 *     `recordResumption` is a separate, deliberate act and is the *only*
 *     path that inserts an `Employee`. An accepted offer whose start date
 *     passes without a resumption becomes `lapsed` — no employment record,
 *     no payroll line, nothing to unwind.
 *
 *  3. **Compensation is versioned.** The first `CompensationVersion` is
 *     written at resumption from the offer's own figures, with the approval
 *     that authorised the hire named on it. Nothing here ever edits one.
 *
 *  4. **Raising a requisition goes through the approval route**, resolved
 *     from the configured bands at the salary band's ceiling. No threshold is
 *     typed in this file.
 */

import {
  CURRENT_USER_ID,
  TODAY,
  TPL,
  addDays,
  approvalRequestsCollection,
  approvalRoutesCollection,
  auditEventsCollection,
  candidatesCollection,
  cardsCollection,
  employeesCollection,
  exitCasesCollection,
  generatedDocumentsCollection,
  interviewsCollection,
  jobOpeningsCollection,
  leaveRequestsCollection,
  offersCollection,
  peopleCollection,
  performanceReviewsCollection,
  relationshipsCollection,
  resolveApprovalRoute,
  scorecardsCollection,
  tasksCollection,
  usersCollection,
} from '@/mocks'
import {
  approvalId,
  candidateId as asCandidateId,
  compId,
  documentId as asDocumentId,
  employeeId as asEmployeeId,
  exitId as asExitId,
  interviewId as asInterviewId,
  offerId as asOfferId,
  openingId as asOpeningId,
  performanceReviewId as asPerformanceReviewId,
  pid,
  relId,
  scorecardId as asScorecardId,
  taskId as asTaskId,
  auditId,
} from '@/mocks/types'
import type {
  ApprovalRequest,
  ApprovalRequestId,
  ApprovalStep,
  AuditEvent,
  BranchId,
  Candidate,
  CandidateId,
  CandidateStage,
  CompensationVersion,
  DepartmentId,
  Employee,
  EmploymentType,
  ExitCase,
  ExitCaseId,
  GeneratedDocument,
  HireRecommendation,
  Interview,
  InterviewId,
  InterviewType,
  JobOpening,
  JobOpeningId,
  Kobo,
  Mode,
  Offer,
  OfferId,
  PerformanceReview,
  Person,
  PersonId,
  Scorecard,
  Task,
  TaskStatus,
  UnitId,
  UserId,
} from '@/mocks'

import { deactivateCard } from '@/modules/physical/writes'

import { EXIT_STAGE_ORDER, STAGE_LABEL, personName, userName, userRoleName } from './shared'

const IP = '102.89.34.17'

export function nowIso(): string {
  return new Date().toISOString()
}

function stamp(): { createdAt: string; createdBy: UserId; updatedAt: string; updatedBy: UserId } {
  const at = nowIso()
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

function rand(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

export interface AuditInput {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
  actorUserId?: UserId
}

/**
 * The audit log, not the activity feed. Actor, timestamp, record, field,
 * previous value and new value — the six things the PRD requires of an audit
 * row, and the reason a stage history can be rebuilt from it.
 */
export function emitAudit(input: AuditInput): AuditEvent {
  const actorUserId = input.actorUserId ?? CURRENT_USER_ID
  const event: AuditEvent = {
    id: auditId(rand('aud')),
    at: nowIso(),
    actorUserId,
    actorName: userName(actorUserId),
    actorRole: userRoleName(actorUserId),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: 'ui',
    ip: IP,
  }
  auditEventsCollection.insert(event)
  return event
}

/** Every audited event against one record, newest first. */
export function auditTrail(entityType: string, entityId: string): AuditEvent[] {
  return auditEventsCollection
    .where((e) => e.entityType === entityType && e.entityId === entityId)
    .sort((a, b) => b.at.localeCompare(a.at))
}

/* -------------------------------------------------------------------------- */
/* Approvals — raised from here, decided in the Work & approvals module        */
/* -------------------------------------------------------------------------- */

function nextApprovalRef(): string {
  const numbers = approvalRequestsCollection
    .all()
    .map((r) => Number(r.ref.split('-').pop() ?? 0))
    .filter((n) => Number.isFinite(n))
  return `APR-2026-${String(Math.max(300, ...numbers) + 1).padStart(4, '0')}`
}

export interface RaiseInput {
  type: 'hire' | 'salary_change' | 'leave'
  title: string
  justification: string
  amount: Kobo
  unitId: UnitId
  branchId: BranchId
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityRef: string
  impact: Array<{ text: string; entityType: string; entityId: string; entityRef: string }>
}

/**
 * Preview the approver chain the configured bands resolve to, without writing
 * anything. The requisition form calls this on every salary keystroke, so who
 * has to sign is visible before the request exists — and if the hire route is
 * ever re-banded, this screen follows it without a code change.
 */
export function previewRoute(type: RaiseInput['type'], amount: Kobo): ApprovalStep[] {
  return resolveApprovalRoute(type, amount)
}

export function routeVersionFor(type: RaiseInput['type']): { routeId: string; version: number } | null {
  const route = approvalRoutesCollection
    .where((r) => r.type === type && r.effectiveFrom <= TODAY && (r.effectiveTo === null || r.effectiveTo > TODAY))
    .sort((a, b) => b.version - a.version)[0]
  return route ? { routeId: route.id as string, version: route.version } : null
}

export function raiseRequest(input: RaiseInput): ApprovalRequest | null {
  const steps = previewRoute(input.type, input.amount)
  const route = routeVersionFor(input.type)
  if (!route || steps.length === 0) return null

  const at = nowIso()
  const request: ApprovalRequest = {
    id: approvalId(rand('apr')),
    ref: nextApprovalRef(),
    type: input.type,
    title: input.title,
    justification: input.justification,
    requesterUserId: CURRENT_USER_ID,
    amount: input.amount,
    unitId: input.unitId,
    branchId: input.branchId,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEntityRef: input.relatedEntityRef,
    attachmentIds: [],
    routeId: route.routeId as ApprovalRequest['routeId'],
    routeVersion: route.version,
    steps: steps.map(
      (step, index): ApprovalStep => ({ ...step, state: index === 0 ? 'pending' : 'not_reached' }),
    ),
    currentStepIndex: 0,
    currentApproverUserId: steps[0].approverUserId,
    raisedAt: at,
    ageHours: 0,
    slaHours: 48,
    slaState: 'within',
    escalatesToUserId: null,
    escalatesAt: null,
    status: 'pending',
    decidedAt: null,
    impact: input.impact,
    thread: [
      { at, actorUserId: CURRENT_USER_ID, body: input.justification, kind: 'comment' },
      {
        at,
        actorUserId: 'system',
        body: `Routed on the ${input.type.replace(/_/g, ' ')} route v${route.version}. ${steps.length} step${steps.length === 1 ? '' : 's'}. This request keeps this route version even if the configuration changes.`,
        kind: 'system',
      },
    ],
    ...stamp(),
  }

  approvalRequestsCollection.insert(request)
  emitAudit({
    action: 'approval.raise',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'status',
    before: null,
    after: 'Pending',
  })
  return request
}

/* -------------------------------------------------------------------------- */
/* Job openings                                                               */
/* -------------------------------------------------------------------------- */

function nextOpeningRef(): string {
  const numbers = jobOpeningsCollection
    .all()
    .map((o) => Number(o.ref.split('-').pop() ?? 0))
    .filter((n) => Number.isFinite(n))
  return `JOB-2026-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`
}

export interface NewOpeningInput {
  title: string
  departmentId: DepartmentId
  unitId: UnitId
  branchId: BranchId
  employmentType: EmploymentType
  headcount: number
  salaryMin: Kobo
  salaryMax: Kobo
  hiringManagerUserId: UserId
  jobDescription: string
  reason: string
  targetStartDate: string
  /** False raises the requisition as a draft with no approval attached. */
  seekApproval: boolean
}

export interface OpeningResult {
  opening: JobOpening
  approval: ApprovalRequest | null
}

/**
 * A requisition. The annual cost of the headcount at the top of the band is
 * what the approval route is resolved against — a two-headcount role at
 * ₦700,000 is a different decision from a one-headcount role at ₦250,000, and
 * the route bands are what decides who signs it.
 */
export function createJobOpening(input: NewOpeningInput): OpeningResult {
  const opening: JobOpening = {
    id: asOpeningId(rand('job')),
    ref: nextOpeningRef(),
    title: input.title.trim(),
    departmentId: input.departmentId,
    unitId: input.unitId,
    branchId: input.branchId,
    employmentType: input.employmentType,
    headcount: input.headcount,
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    hiringManagerUserId: input.hiringManagerUserId,
    approvalRequestId: null,
    jobDescription: input.jobDescription.trim(),
    reason: input.reason.trim(),
    status: 'draft',
    openedAt: null,
    targetStartDate: input.targetStartDate,
    applicantCount: 0,
    inPipelineCount: 0,
    ...stamp(),
  }
  jobOpeningsCollection.insert(opening)
  emitAudit({
    action: 'opening.create',
    entityType: 'JobOpening',
    entityId: opening.id as string,
    entityRef: opening.ref,
    field: 'status',
    before: null,
    after: 'Draft',
  })

  if (!input.seekApproval) return { opening, approval: null }

  const approval = raiseRequest({
    type: 'hire',
    title: `Requisition: ${opening.title}`,
    justification: opening.reason,
    amount: annualisedCost(opening),
    unitId: opening.unitId,
    branchId: opening.branchId,
    relatedEntityType: 'JobOpening',
    relatedEntityId: opening.id as string,
    relatedEntityRef: opening.ref,
    impact: [
      {
        text: `${opening.headcount} new ${opening.headcount === 1 ? 'position' : 'positions'} added to establishment on approval`,
        entityType: 'JobOpening',
        entityId: opening.id as string,
        entityRef: opening.ref,
      },
    ],
  })

  if (approval) {
    jobOpeningsCollection.update(opening.id, {
      approvalRequestId: approval.id as ApprovalRequestId,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    })
    emitAudit({
      action: 'opening.approval.attach',
      entityType: 'JobOpening',
      entityId: opening.id as string,
      entityRef: opening.ref,
      field: 'approvalRequestId',
      before: null,
      after: approval.ref,
    })
  }

  return { opening: jobOpeningsCollection.find(opening.id) ?? opening, approval }
}

/** Twelve months of the band ceiling, times the headcount. */
export function annualisedCost(opening: Pick<JobOpening, 'salaryMax' | 'headcount'>): Kobo {
  return (opening.salaryMax * 12 * opening.headcount) as Kobo
}

export function setOpeningStatus(openingId: JobOpeningId, status: JobOpening['status'], reason: string): void {
  const opening = jobOpeningsCollection.find(openingId)
  if (!opening || opening.status === status) return
  jobOpeningsCollection.update(openingId, {
    status,
    openedAt: status === 'open' && opening.openedAt === null ? TODAY : opening.openedAt,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'opening.status.change',
    entityType: 'JobOpening',
    entityId: opening.id as string,
    entityRef: opening.ref,
    field: 'status',
    before: opening.status,
    after: `${status}${reason.trim() ? ` — ${reason.trim()}` : ''}`,
  })
}

/* -------------------------------------------------------------------------- */
/* Candidates                                                                 */
/* -------------------------------------------------------------------------- */

export interface NewCandidateInput {
  /** An existing person, or null to create one from the name and contact. */
  personId: PersonId | null
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
  state: string
  openingId: JobOpeningId
  source: string
  recruiterUserId: UserId
  nextStep: string
}

function createPerson(input: NewCandidateInput, branchId: BranchId | null): Person {
  const person: Person = {
    id: pid(rand('per')),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    whatsapp: input.phone.trim() || null,
    dateOfBirth: null,
    city: input.city.trim(),
    state: input.state.trim(),
    country: 'Nigeria',
    avatarInitials: `${input.firstName.trim()[0] ?? ''}${input.lastName.trim()[0] ?? ''}`.toUpperCase(),
    primaryBranchId: branchId,
    tags: ['candidate'],
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: [],
    ...stamp(),
  }
  peopleCollection.insert(person)
  emitAudit({
    action: 'person.create',
    entityType: 'Person',
    entityId: person.id as string,
    entityRef: `${person.firstName} ${person.lastName}`,
    field: null,
    before: null,
    after: 'Created from a job application',
  })
  return person
}

export function createCandidate(input: NewCandidateInput): Candidate {
  const opening = jobOpeningsCollection.find(input.openingId)
  const personId =
    input.personId ?? createPerson(input, (opening?.branchId ?? null) as BranchId | null).id

  const at = nowIso()
  const candidate: Candidate = {
    id: asCandidateId(rand('cnd')),
    personId,
    openingId: input.openingId,
    source: input.source,
    appliedAt: TODAY,
    stage: 'applied',
    stageEnteredAt: at,
    recruiterUserId: input.recruiterUserId,
    cvUrl: `/cvs/${personId}.pdf`,
    averageScore: null,
    nextStep: input.nextStep.trim() || 'Screening call',
    ...stamp(),
  }
  candidatesCollection.insert(candidate)

  relationshipsCollection.insert({
    id: relId(rand('rel')),
    personId,
    type: 'candidate',
    startDate: TODAY,
    endDate: null,
    status: 'active',
    unitId: opening?.unitId ?? null,
    branchId: opening?.branchId ?? null,
    relatedRecordId: candidate.id as string,
    ...stamp(),
  })

  if (opening) {
    jobOpeningsCollection.update(opening.id, {
      applicantCount: opening.applicantCount + 1,
      inPipelineCount: opening.inPipelineCount + 1,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  emitAudit({
    action: 'candidate.create',
    entityType: 'Candidate',
    entityId: candidate.id as string,
    entityRef: personName(personId),
    field: 'stage',
    before: null,
    after: STAGE_LABEL.applied,
  })

  return candidate
}

/**
 * Move a candidate along the pipeline.
 *
 * The record keeps one current stage; the move itself is written to the audit
 * log with both ends of the transition, so the trail is append-only and a
 * later move can never erase an earlier one.
 */
export function moveCandidateStage(
  candidateId: CandidateId,
  to: CandidateStage,
  reason: string,
  nextStep?: string,
): Candidate | undefined {
  const candidate = candidatesCollection.find(candidateId)
  if (!candidate || candidate.stage === to) return candidate

  const at = nowIso()
  const from = candidate.stage
  const updated = candidatesCollection.update(candidateId, {
    stage: to,
    stageEnteredAt: at,
    nextStep: nextStep?.trim() ? nextStep.trim() : stageDefaultNextStep(to),
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'candidate.stage.change',
    entityType: 'Candidate',
    entityId: candidate.id as string,
    entityRef: personName(candidate.personId),
    field: 'stage',
    before: STAGE_LABEL[from],
    after: reason.trim() ? `${STAGE_LABEL[to]} — ${reason.trim()}` : STAGE_LABEL[to],
  })

  const opening = jobOpeningsCollection.find(candidate.openingId)
  if (opening) {
    const stillOpen = candidatesCollection.where(
      (c) => c.openingId === opening.id && c.stage !== 'hired' && !['rejected', 'withdrawn', 'talent_pool', 'no_show'].includes(c.stage),
    ).length
    jobOpeningsCollection.update(opening.id, { inPipelineCount: stillOpen, updatedAt: at, updatedBy: CURRENT_USER_ID })
  }

  return updated
}

function stageDefaultNextStep(stage: CandidateStage): string | null {
  switch (stage) {
    case 'applied':
      return 'Screening call'
    case 'screening':
      return 'Review the screening notes'
    case 'shortlisted':
      return 'Schedule the first interview'
    case 'interview':
      return 'Panel interview'
    case 'assessment':
      return 'Mark the take-home'
    case 'final_review':
      return 'Hiring manager decision'
    case 'offer':
      return 'Awaiting response'
    case 'hired':
      return 'Onboarding'
    case 'talent_pool':
      return 'Revisit on the next opening'
    default:
      return null
  }
}

/**
 * The stage trail, rebuilt from the audit log. This is what makes the
 * never-mutate discipline visible: every move a candidate has ever made is
 * still here, in order, with who made it and why.
 */
export interface StageMove {
  id: string
  at: string
  actorName: string
  from: string | null
  to: string
}

export function candidateTrail(candidateId: CandidateId): StageMove[] {
  return auditEventsCollection
    .where(
      (e) =>
        e.entityId === (candidateId as string) &&
        (e.action === 'candidate.stage.change' || e.action === 'candidate.create'),
    )
    .sort((a, b) => a.at.localeCompare(b.at))
    .map((e) => ({ id: e.id as string, at: e.at, actorName: e.actorName, from: e.before, to: e.after ?? '' }))
}

/* -------------------------------------------------------------------------- */
/* Interviews and scorecards                                                  */
/* -------------------------------------------------------------------------- */

export interface NewInterviewInput {
  candidateId: CandidateId
  type: InterviewType
  date: string
  time: string
  durationMinutes: number
  interviewerUserIds: UserId[]
  mode: Mode
  location: string
  meetingUrl: string
}

export function scheduleInterview(input: NewInterviewInput): Interview {
  const interview: Interview = {
    id: asInterviewId(rand('int')),
    candidateId: input.candidateId,
    type: input.type,
    scheduledAt: `${input.date}T${input.time}:00+01:00`,
    durationMinutes: input.durationMinutes,
    interviewerUserIds: input.interviewerUserIds,
    mode: input.mode,
    location: input.mode === 'virtual' ? null : input.location.trim() || null,
    meetingUrl: input.mode === 'on_campus' ? null : input.meetingUrl.trim() || null,
    status: 'scheduled',
    outcome: null,
    ...stamp(),
  }
  interviewsCollection.insert(interview)

  const candidate = candidatesCollection.find(input.candidateId)
  emitAudit({
    action: 'interview.schedule',
    entityType: 'Interview',
    entityId: interview.id as string,
    entityRef: candidate ? personName(candidate.personId) : (interview.id as string),
    field: 'scheduledAt',
    before: null,
    after: interview.scheduledAt,
  })
  return interview
}

export function setInterviewOutcome(
  interviewId: InterviewId,
  status: Interview['status'],
  outcome: Interview['outcome'],
): void {
  const interview = interviewsCollection.find(interviewId)
  if (!interview) return
  interviewsCollection.update(interviewId, {
    status,
    outcome,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
  const candidate = candidatesCollection.find(interview.candidateId)
  emitAudit({
    action: 'interview.outcome',
    entityType: 'Interview',
    entityId: interview.id as string,
    entityRef: candidate ? personName(candidate.personId) : (interview.id as string),
    field: 'outcome',
    before: interview.outcome ?? interview.status,
    after: outcome ?? status,
  })
}

export interface NewScorecardInput {
  interviewId: InterviewId
  interviewerUserId: UserId
  competencies: Array<{ name: string; score: 1 | 2 | 3 | 4 | 5; note: string }>
  recommendation: HireRecommendation
  notes: string
}

/**
 * A submitted scorecard is evidence, not an opinion that can be revised away —
 * it is written once and the candidate's average recomputes from every
 * scorecard on record rather than being typed.
 */
export function submitScorecard(input: NewScorecardInput): Scorecard {
  const at = nowIso()
  const scorecard: Scorecard = {
    id: asScorecardId(rand('scr')),
    interviewId: input.interviewId,
    interviewerUserId: input.interviewerUserId,
    competencies: input.competencies,
    recommendation: input.recommendation,
    notes: input.notes.trim(),
    submittedAt: at,
    ...stamp(),
  }
  scorecardsCollection.insert(scorecard)

  const interview = interviewsCollection.find(input.interviewId)
  if (interview) {
    if (interview.status === 'scheduled') {
      interviewsCollection.update(interview.id, { status: 'completed', updatedAt: at, updatedBy: CURRENT_USER_ID })
    }
    recomputeCandidateScore(interview.candidateId)
  }

  emitAudit({
    action: 'scorecard.submit',
    entityType: 'Scorecard',
    entityId: scorecard.id as string,
    entityRef: interview && candidatesCollection.find(interview.candidateId)
      ? personName(candidatesCollection.find(interview.candidateId)?.personId ?? null)
      : (scorecard.id as string),
    field: 'recommendation',
    before: null,
    after: input.recommendation,
  })
  return scorecard
}

export function averageOf(scorecard: Scorecard): number {
  if (scorecard.competencies.length === 0) return 0
  return scorecard.competencies.reduce((acc, c) => acc + c.score, 0) / scorecard.competencies.length
}

function recomputeCandidateScore(candidateId: CandidateId): void {
  const interviewIds = new Set(
    interviewsCollection.where((i) => i.candidateId === candidateId).map((i) => i.id as string),
  )
  const cards = scorecardsCollection.where(
    (s) => interviewIds.has(s.interviewId as string) && s.submittedAt !== null,
  )
  const average =
    cards.length === 0 ? null : Number((cards.reduce((acc, c) => acc + averageOf(c), 0) / cards.length).toFixed(1))
  candidatesCollection.update(candidateId, { averageScore: average, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
}

/* -------------------------------------------------------------------------- */
/* Offers                                                                     */
/* -------------------------------------------------------------------------- */

function nextOfferRef(): string {
  const numbers = offersCollection
    .all()
    .map((o) => Number(o.ref.split('-').pop() ?? 0))
    .filter((n) => Number.isFinite(n))
  return `OFR-2026-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`
}

export interface NewOfferInput {
  candidateId: CandidateId
  jobTitle: string
  unitId: UnitId
  branchId: BranchId
  departmentId: DepartmentId
  managerUserId: UserId
  baseSalary: Kobo
  allowances: Array<{ label: string; amount: Kobo }>
  startDate: string
  probationMonths: number
  expiresAt: string
  /** Issue straight away rather than leaving the offer in draft. */
  issueNow: boolean
}

export function offerGross(offer: Pick<Offer, 'baseSalary' | 'allowances'>): Kobo {
  return (offer.baseSalary + offer.allowances.reduce((acc, a) => acc + a.amount, 0)) as Kobo
}

/**
 * Generate an offer from the offer-letter template. The document is a real
 * `GeneratedDocument` row naming the template version it was rendered from, so
 * a letter sent last year can still be explained by the template that produced
 * it after the template moves on.
 */
export function createOffer(input: NewOfferInput): Offer {
  const candidate = candidatesCollection.find(input.candidateId)
  if (!candidate) throw new Error('That candidate no longer exists.')

  const at = nowIso()
  const offer: Offer = {
    id: asOfferId(rand('ofr')),
    ref: nextOfferRef(),
    candidateId: input.candidateId,
    personId: candidate.personId,
    jobTitle: input.jobTitle.trim(),
    unitId: input.unitId,
    branchId: input.branchId,
    departmentId: input.departmentId,
    managerUserId: input.managerUserId,
    baseSalary: input.baseSalary,
    allowances: input.allowances.filter((a) => a.amount > 0),
    startDate: input.startDate,
    probationMonths: input.probationMonths,
    approvalRequestId: jobOpeningsCollection.find(candidate.openingId)?.approvalRequestId ?? null,
    documentId: null,
    issuedAt: input.issueNow ? at : null,
    expiresAt: input.expiresAt,
    status: input.issueNow ? 'issued' : 'draft',
    respondedAt: null,
    ...stamp(),
  }
  offersCollection.insert(offer)

  const document: GeneratedDocument = {
    id: asDocumentId(rand('doc')),
    ref: `DOC-${offer.ref}`,
    type: 'offer_letter',
    templateId: TPL.offerLetter,
    templateVersion: 3,
    personId: candidate.personId,
    relatedEntityType: 'Offer',
    relatedEntityId: offer.id as string,
    generatedByUserId: CURRENT_USER_ID,
    generatedAt: at,
    fileUrl: `/documents/${offer.ref.toLowerCase()}.pdf`,
    signatureStatus: input.issueNow ? 'awaiting' : 'not_required',
    signedAt: null,
    signatories: [{ personId: candidate.personId, signedAt: null }],
    voidedAt: null,
    ...stamp(),
  }
  generatedDocumentsCollection.insert(document)
  offersCollection.update(offer.id, { documentId: document.id, updatedAt: at, updatedBy: CURRENT_USER_ID })

  emitAudit({
    action: 'document.generate',
    entityType: 'GeneratedDocument',
    entityId: document.id as string,
    entityRef: document.ref,
    field: 'type',
    before: null,
    after: `Offer of employment v${document.templateVersion} for ${personName(candidate.personId)}`,
  })
  emitAudit({
    action: 'offer.create',
    entityType: 'Offer',
    entityId: offer.id as string,
    entityRef: offer.ref,
    field: 'status',
    before: null,
    after: input.issueNow ? 'Issued' : 'Draft',
  })

  if (candidate.stage !== 'offer') {
    moveCandidateStage(input.candidateId, 'offer', `Offer ${offer.ref} generated`, 'Awaiting response')
  }

  return offersCollection.find(offer.id) ?? offer
}

export function issueOffer(offerId: OfferId): void {
  const offer = offersCollection.find(offerId)
  if (!offer || offer.status !== 'draft') return
  const at = nowIso()
  offersCollection.update(offerId, { status: 'issued', issuedAt: at, updatedAt: at, updatedBy: CURRENT_USER_ID })
  if (offer.documentId) {
    generatedDocumentsCollection.update(offer.documentId, {
      signatureStatus: 'awaiting',
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }
  emitAudit({
    action: 'offer.issue',
    entityType: 'Offer',
    entityId: offer.id as string,
    entityRef: offer.ref,
    field: 'status',
    before: 'Draft',
    after: 'Issued',
  })
}

/**
 * The candidate's answer, and nothing more.
 *
 * Accepting an offer creates **no employment record**. The PRD's edge case is
 * exactly this: people accept and then never resume, and a system that treats
 * acceptance as employment has to unwind a payroll line, a card, a mailbox and
 * a unit cost allocation for someone who never walked in. Resumption is a
 * separate event — see `recordResumption`.
 */
export function recordOfferResponse(offerId: OfferId, response: 'accepted' | 'declined', note: string): void {
  const offer = offersCollection.find(offerId)
  if (!offer || offer.status !== 'issued') return
  const at = nowIso()
  offersCollection.update(offerId, { status: response, respondedAt: at, updatedAt: at, updatedBy: CURRENT_USER_ID })
  if (offer.documentId) {
    generatedDocumentsCollection.update(offer.documentId, {
      signatureStatus: response === 'accepted' ? 'signed' : 'declined',
      signedAt: response === 'accepted' ? at : null,
      signatories: [{ personId: offer.personId, signedAt: response === 'accepted' ? at : null }],
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }
  emitAudit({
    action: 'offer.respond',
    entityType: 'Offer',
    entityId: offer.id as string,
    entityRef: offer.ref,
    field: 'status',
    before: 'Issued',
    after: note.trim() ? `${response === 'accepted' ? 'Accepted' : 'Declined'} — ${note.trim()}` : response === 'accepted' ? 'Accepted' : 'Declined',
  })

  if (response === 'declined') {
    moveCandidateStage(offer.candidateId, 'withdrawn', `Offer ${offer.ref} declined. ${note.trim()}`.trim())
  }
}

export function withdrawOffer(offerId: OfferId, reason: string): void {
  const offer = offersCollection.find(offerId)
  if (!offer || offer.status === 'withdrawn' || offer.status === 'lapsed') return
  const at = nowIso()
  offersCollection.update(offerId, { status: 'withdrawn', respondedAt: at, updatedAt: at, updatedBy: CURRENT_USER_ID })
  if (offer.documentId) {
    generatedDocumentsCollection.update(offer.documentId, { voidedAt: at, updatedAt: at, updatedBy: CURRENT_USER_ID })
  }
  emitAudit({
    action: 'offer.withdraw',
    entityType: 'Offer',
    entityId: offer.id as string,
    entityRef: offer.ref,
    field: 'status',
    before: offer.status,
    after: `Withdrawn — ${reason.trim()}`,
  })
}

/**
 * Accepted, start date passed, never resumed. The offer closes as **lapsed**
 * and no employment record is created, so nothing downstream has to be
 * unwound. This is the state the PRD calls out by name.
 */
export function lapseOffer(offerId: OfferId, reason: string): void {
  const offer = offersCollection.find(offerId)
  if (!offer || offer.status !== 'accepted') return
  const at = nowIso()
  offersCollection.update(offerId, { status: 'lapsed', updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'offer.lapse',
    entityType: 'Offer',
    entityId: offer.id as string,
    entityRef: offer.ref,
    field: 'status',
    before: 'Accepted',
    after: `Lapsed — ${reason.trim() || 'accepted but never resumed'}. No employment record was created.`,
  })
  moveCandidateStage(offer.candidateId, 'no_show', `Offer ${offer.ref} lapsed. ${reason.trim()}`.trim())
}

export function offerIsOverdueToResume(offer: Offer): boolean {
  return offer.status === 'accepted' && offer.startDate < TODAY && !employeeForOffer(offer)
}

export function employeeForOffer(offer: Offer): Employee | undefined {
  return employeesCollection
    .where((e) => e.personId === offer.personId)
    .find((e) => e.startDate === offer.startDate || e.jobTitle === offer.jobTitle)
}

/* -------------------------------------------------------------------------- */
/* Resumption — the only path that creates an employee                        */
/* -------------------------------------------------------------------------- */

function nextEmployeeNumber(): string {
  const numbers = employeesCollection
    .all()
    .map((e) => Number(e.employeeId.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))
  return `EMP-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`
}

export const ONBOARDING_TASKS: Array<{ group: string; title: string; dueOffsetDays: number }> = [
  { group: 'Documentation', title: 'Collect signed offer, guarantor forms and ID', dueOffsetDays: 0 },
  { group: 'Documentation', title: 'File qualification certificates', dueOffsetDays: 3 },
  { group: 'Email and access', title: 'Create the Cirvee mailbox', dueOffsetDays: 0 },
  { group: 'Email and access', title: 'Grant system access for the role', dueOffsetDays: 1 },
  { group: 'Role assignment', title: 'Assign the role and permission set', dueOffsetDays: 1 },
  { group: 'NFC card', title: 'Issue and activate the NFC access card', dueOffsetDays: 1 },
  { group: 'Asset allocation', title: 'Allocate laptop and accessories', dueOffsetDays: 2 },
  { group: 'Orientation', title: 'Run the first-day orientation', dueOffsetDays: 0 },
  { group: 'SOPs', title: 'Walk through the department SOPs', dueOffsetDays: 4 },
  { group: 'Manager setup', title: 'Manager sets the probation objectives', dueOffsetDays: 5 },
  { group: 'Manager setup', title: 'Introduce the onboarding buddy', dueOffsetDays: 0 },
  { group: 'First-week tasks', title: 'Complete the first-week checklist review', dueOffsetDays: 7 },
]

export interface ResumptionInput {
  offerId: OfferId
  /** The day they actually walked in, which need not be the offered start date. */
  resumedOn: string
  employmentType: EmploymentType
  buddyUserId: UserId | null
}

export interface ResumptionResult {
  employee: Employee
  tasks: Task[]
}

/**
 * The person resumed. Now — and only now — an employment record exists.
 *
 * Creates the `Employee`, its first immutable `CompensationVersion` from the
 * offer's own figures, a candidate relationship end-date, an employee
 * relationship, and the onboarding checklist.
 */
export function recordResumption(input: ResumptionInput): ResumptionResult | null {
  const offer = offersCollection.find(input.offerId)
  if (!offer || offer.status !== 'accepted') return null
  if (employeeForOffer(offer)) return null

  const at = nowIso()
  const employeeRecordId = asEmployeeId(rand('emp'))
  const gross = offerGross(offer)

  const version: CompensationVersion = {
    id: compId(rand('comp')),
    employeeId: employeeRecordId,
    effectiveFrom: input.resumedOn,
    effectiveTo: null,
    baseSalary: offer.baseSalary,
    allowances: offer.allowances,
    gross,
    reason: `Opening compensation on resumption, from offer ${offer.ref}`,
    approvalRequestId: offer.approvalRequestId,
    approvedByUserId: offer.managerUserId,
    createdAt: at,
  }

  const employee: Employee = {
    id: employeeRecordId,
    employeeId: nextEmployeeNumber(),
    personId: offer.personId,
    jobTitle: offer.jobTitle,
    departmentId: offer.departmentId,
    unitId: offer.unitId,
    branchId: offer.branchId,
    managerUserId: offer.managerUserId,
    employmentType: input.employmentType,
    startDate: input.resumedOn,
    endDate: null,
    status: offer.probationMonths > 0 ? 'probation' : 'active',
    probationEndsAt: offer.probationMonths > 0 ? addDays(input.resumedOn, offer.probationMonths * 30) : null,
    probationOutcome: null,
    priorEmploymentIds: employeesCollection.where((e) => e.personId === offer.personId).map((e) => e.id),
    compensationVersions: [version],
    leaveBalances: [
      { type: 'annual', entitled: 20, taken: 0, remaining: 20 },
      { type: 'sick', entitled: 10, taken: 0, remaining: 10 },
    ],
    bankDetails: null,
    disciplinaryRecords: [],
    ...stamp(),
  }
  employeesCollection.insert(employee)

  relationshipsCollection.updateWhere(
    (r) => r.personId === offer.personId && r.type === 'candidate' && r.status === 'active',
    { status: 'ended', endDate: input.resumedOn, endReason: 'Hired', updatedAt: at, updatedBy: CURRENT_USER_ID },
  )
  relationshipsCollection.insert({
    id: relId(rand('rel')),
    personId: offer.personId,
    type: 'employee',
    startDate: input.resumedOn,
    endDate: null,
    status: 'active',
    unitId: offer.unitId,
    branchId: offer.branchId,
    relatedRecordId: employee.id as string,
    ...stamp(),
  })

  const tasks = ONBOARDING_TASKS.map((spec) => {
    const task: Task = {
      id: asTaskId(rand('tsk')),
      title: spec.title,
      description: `${spec.group} · onboarding for ${personName(offer.personId)}`,
      ownerUserId: spec.group === 'Manager setup' ? offer.managerUserId : CURRENT_USER_ID,
      departmentId: offer.departmentId,
      relatedEntityType: 'Employee',
      relatedEntityId: employee.id as string,
      relatedEntityRef: employee.employeeId,
      dueAt: `${addDays(input.resumedOn, spec.dueOffsetDays)}T17:00:00+01:00`,
      priority: spec.dueOffsetDays === 0 ? 'high' : 'normal',
      status: 'open',
      completedAt: null,
      ...stamp(),
    }
    tasksCollection.insert(task)
    return task
  })

  moveCandidateStage(offer.candidateId, 'hired', `Resumed on ${input.resumedOn} as ${employee.employeeId}`)

  emitAudit({
    action: 'employee.create',
    entityType: 'Employee',
    entityId: employee.id as string,
    entityRef: employee.employeeId,
    field: 'status',
    before: null,
    after: `${employee.status} — resumed ${input.resumedOn} against offer ${offer.ref}`,
  })
  emitAudit({
    action: 'compensation.version.create',
    entityType: 'Employee',
    entityId: employee.id as string,
    entityRef: employee.employeeId,
    field: 'compensation',
    before: null,
    after: `Version 1 effective ${input.resumedOn}. This row is immutable; a change appends version 2.`,
  })
  if (input.buddyUserId) {
    emitAudit({
      action: 'onboarding.buddy.assign',
      entityType: 'Employee',
      entityId: employee.id as string,
      entityRef: employee.employeeId,
      field: 'buddy',
      before: null,
      after: userName(input.buddyUserId),
    })
  }

  return { employee, tasks }
}

/* -------------------------------------------------------------------------- */
/* Onboarding checklist                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The same twelve tasks `recordResumption` writes, raised against somebody who
 * already has an employment record. The seed's employees predate this screen,
 * so without this an onboarding checklist could only ever exist for a hire made
 * inside the current session.
 */
export function createOnboardingChecklist(employeeRecordId: string): Task[] {
  const employee = employeesCollection.find(employeeRecordId)
  if (!employee) return []
  if (onboardingTasksFor(employeeRecordId).length > 0) return []

  const tasks = ONBOARDING_TASKS.map((spec) => {
    const task: Task = {
      id: asTaskId(rand('tsk')),
      title: spec.title,
      description: `${spec.group} · onboarding for ${personName(employee.personId)}`,
      ownerUserId: spec.group === 'Manager setup' && employee.managerUserId ? employee.managerUserId : CURRENT_USER_ID,
      departmentId: employee.departmentId,
      relatedEntityType: 'Employee',
      relatedEntityId: employee.id as string,
      relatedEntityRef: employee.employeeId,
      dueAt: `${addDays(employee.startDate, spec.dueOffsetDays)}T17:00:00+01:00`,
      priority: spec.dueOffsetDays === 0 ? 'high' : 'normal',
      status: 'open',
      completedAt: null,
      ...stamp(),
    }
    tasksCollection.insert(task)
    return task
  })

  emitAudit({
    action: 'onboarding.checklist.create',
    entityType: 'Employee',
    entityId: employee.id as string,
    entityRef: employee.employeeId,
    field: 'onboarding',
    before: null,
    after: `${tasks.length} tasks raised`,
  })
  return tasks
}

/** Which checklist group a task belongs to, read back off its description. */
export function taskGroup(task: Task): string {
  return task.description?.split(' · ')[0] ?? 'Other'
}

export function onboardingTasksFor(employeeRecordId: string): Task[] {
  return tasksCollection
    .where((t) => t.relatedEntityType === 'Employee' && t.relatedEntityId === employeeRecordId)
    .sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''))
}

export function setTaskStatus(taskIdValue: string, status: TaskStatus): void {
  const task = tasksCollection.find(taskIdValue)
  if (!task || task.status === status) return
  const at = nowIso()
  tasksCollection.update(taskIdValue, {
    status,
    completedAt: status === 'done' ? at : null,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'onboarding.task.update',
    entityType: 'Task',
    entityId: task.id as string,
    entityRef: task.title,
    field: 'status',
    before: task.status,
    after: status,
  })
}

/* -------------------------------------------------------------------------- */
/* Performance reviews                                                        */
/* -------------------------------------------------------------------------- */

export interface NewPerformanceReviewInput {
  employeeId: string
  reviewerUserId: UserId
  periodLabel: string
  competencies: Array<{ name: string; score: 1 | 2 | 3 | 4 | 5; note: string }>
  overallNote: string
  recommendedBonus: Kobo | null
}

export function createPerformanceReview(input: NewPerformanceReviewInput): PerformanceReview {
  const review: PerformanceReview = {
    id: asPerformanceReviewId(rand('perf')),
    employeeId: input.employeeId as Employee['id'],
    reviewerUserId: input.reviewerUserId,
    periodLabel: input.periodLabel,
    competencies: input.competencies,
    overallNote: input.overallNote,
    recommendedBonus: input.recommendedBonus,
    status: 'draft',
    submittedAt: null,
    acknowledgedAt: null,
    ...stamp(),
  }
  performanceReviewsCollection.insert(review)
  emitAudit({
    action: 'performance.review.create',
    entityType: 'PerformanceReview',
    entityId: review.id as string,
    entityRef: `${input.periodLabel} — ${personName(employeesCollection.find(input.employeeId)?.personId)}`,
    field: 'status',
    before: null,
    after: 'Draft',
  })
  return review
}

export function submitPerformanceReview(reviewId: string): void {
  const review = performanceReviewsCollection.find(reviewId)
  if (!review || review.status !== 'draft') return
  const at = nowIso()
  performanceReviewsCollection.update(reviewId, {
    status: 'submitted',
    submittedAt: at,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'performance.review.submit',
    entityType: 'PerformanceReview',
    entityId: review.id as string,
    entityRef: review.periodLabel,
    field: 'status',
    before: 'Draft',
    after: 'Submitted',
  })
}

export function acknowledgePerformanceReview(reviewId: string): void {
  const review = performanceReviewsCollection.find(reviewId)
  if (!review || review.status !== 'submitted') return
  const at = nowIso()
  performanceReviewsCollection.update(reviewId, {
    status: 'acknowledged',
    acknowledgedAt: at,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'performance.review.acknowledge',
    entityType: 'PerformanceReview',
    entityId: review.id as string,
    entityRef: review.periodLabel,
    field: 'status',
    before: 'Submitted',
    after: 'Acknowledged',
  })
}

/* -------------------------------------------------------------------------- */
/* Exit cases                                                                 */
/* -------------------------------------------------------------------------- */

const CLEARANCE_DEPARTMENTS = ['IT', 'Finance', 'HR', 'Facilities', 'Line manager']

function nextExitRef(): string {
  const numbers = exitCasesCollection
    .all()
    .map((e) => Number(e.ref.split('-').pop() ?? 0))
    .filter((n) => Number.isFinite(n))
  return `EXIT-2026-${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`
}

export interface NewExitCaseInput {
  employeeId: string
  type: ExitCase['type']
  noticeDate: string
  lastWorkingDay: string
}

export function createExitCase(input: NewExitCaseInput): ExitCase {
  const at = nowIso()
  const exitCase: ExitCase = {
    id: asExitId(rand('exit')),
    ref: nextExitRef(),
    employeeId: input.employeeId as Employee['id'],
    type: input.type,
    noticeDate: input.noticeDate,
    lastWorkingDay: input.lastWorkingDay,
    stage: EXIT_STAGE_ORDER[0],
    clearances: CLEARANCE_DEPARTMENTS.map((department) => ({
      department,
      clearedByUserId: null,
      clearedAt: null,
      note: null,
    })),
    outstandingAssetIds: [],
    outstandingFinanceAmount: 0 as Kobo,
    commissionReconciliationStatus: 'pending',
    finalSettlement: null,
    accessRevokedAt: null,
    cardDeactivatedAt: null,
    exitInterviewDone: false,
    approvalRequestId: null,
    ...stamp(),
  }
  exitCasesCollection.insert(exitCase)
  employeesCollection.update(input.employeeId, { status: 'notice', updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'exit.case.create',
    entityType: 'ExitCase',
    entityId: exitCase.id as string,
    entityRef: exitCase.ref,
    field: 'stage',
    before: null,
    after: EXIT_STAGE_ORDER[0],
  })
  return exitCase
}

export function clearExitDepartment(exitCaseId: string, department: string, note: string): void {
  const exitCase = exitCasesCollection.find(exitCaseId)
  if (!exitCase) return
  const at = nowIso()
  const clearances = exitCase.clearances.map((c) =>
    c.department === department
      ? { ...c, clearedAt: at, clearedByUserId: CURRENT_USER_ID, note: note.trim() || null }
      : c,
  )
  exitCasesCollection.update(exitCaseId, { clearances, updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'exit.department.clear',
    entityType: 'ExitCase',
    entityId: exitCase.id as string,
    entityRef: exitCase.ref,
    field: department,
    before: 'Not cleared',
    after: 'Cleared',
  })
}

/**
 * Walks the PRD's own §6 sequence. `department_clearance` cannot advance
 * while any department is still unsigned; reaching `access_review` revokes
 * the employee's real card through the Physical module rather than hand-
 * setting a timestamp (closing gap §5's exit-side half for free); reaching
 * `closed` is what finally end-dates the employee — nothing else in the app
 * does, so an "exited" employee stayed active everywhere until this existed.
 */
export function advanceExitCase(exitCaseId: string): { ok: boolean; reason?: string } {
  const exitCase = exitCasesCollection.find(exitCaseId)
  if (!exitCase) return { ok: false, reason: 'This exit case no longer exists.' }

  const index = EXIT_STAGE_ORDER.indexOf(exitCase.stage)
  if (index === -1 || index === EXIT_STAGE_ORDER.length - 1) {
    return { ok: false, reason: 'This case is already closed.' }
  }

  if (exitCase.stage === 'department_clearance') {
    const clearedCount = exitCase.clearances.filter((c) => c.clearedAt !== null).length
    if (clearedCount < exitCase.clearances.length) {
      return { ok: false, reason: 'Every department has to sign off before this can advance.' }
    }
  }

  const next = EXIT_STAGE_ORDER[index + 1]
  const at = nowIso()
  const patch: Partial<ExitCase> = { stage: next, updatedAt: at, updatedBy: CURRENT_USER_ID }

  if (next === 'access_review') {
    const employee = employeesCollection.find(exitCase.employeeId)
    const card = employee
      ? cardsCollection
          .all()
          .find((c) => c.personId === employee.personId && c.holderType === 'employee' && c.status === 'active')
      : undefined
    if (card) deactivateCard(card, `Exit case ${exitCase.ref}`, 'deactivated')
    patch.accessRevokedAt = at
    if (card) patch.cardDeactivatedAt = at
  }

  if (next === 'closed') {
    employeesCollection.update(exitCase.employeeId, {
      status: 'exited',
      endDate: exitCase.lastWorkingDay,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  exitCasesCollection.update(exitCaseId, patch)
  emitAudit({
    action: 'exit.stage.advance',
    entityType: 'ExitCase',
    entityId: exitCase.id as string,
    entityRef: exitCase.ref,
    field: 'stage',
    before: exitCase.stage,
    after: next,
  })
  return { ok: true }
}

/* -------------------------------------------------------------------------- */
/* Probation                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * `ended` never sets the employee `exited` directly — that is
 * `advanceExitCase`'s job at `closed`, the same "never delete, always open
 * the downstream case" rule the rest of this file follows. This opens a real
 * `ExitCase` and lets the exit flow itself carry the employee the rest of
 * the way.
 */
export function setProbationOutcome(
  employeeId: string,
  outcome: 'confirmed' | 'extended' | 'ended',
  note: string,
  newProbationEndsAt?: string,
): void {
  const employee = employeesCollection.find(employeeId)
  if (!employee || employee.status !== 'probation') return
  const at = nowIso()

  if (outcome === 'confirmed') {
    employeesCollection.update(employeeId, {
      status: 'active',
      probationOutcome: 'confirmed',
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  } else if (outcome === 'extended') {
    employeesCollection.update(employeeId, {
      probationOutcome: 'extended',
      probationEndsAt: newProbationEndsAt ?? employee.probationEndsAt,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  } else {
    employeesCollection.update(employeeId, { probationOutcome: 'ended', updatedAt: at, updatedBy: CURRENT_USER_ID })
    createExitCase({ employeeId, type: 'termination', noticeDate: TODAY, lastWorkingDay: TODAY })
  }

  emitAudit({
    action: 'probation.outcome',
    entityType: 'Employee',
    entityId: employee.id as string,
    entityRef: employee.employeeId,
    field: 'probationOutcome',
    before: 'Pending',
    after: `${outcome}${note.trim() ? ` — ${note.trim()}` : ''}`,
  })
}

/* -------------------------------------------------------------------------- */
/* Directory helpers the forms need                                           */
/* -------------------------------------------------------------------------- */

export function staffOptions(): Array<{ value: string; label: string }> {
  return usersCollection
    .where((u) => u.status === 'active')
    .map((u) => ({ value: u.id as string, label: `${personName(u.personId)} · ${userRoleName(u.id)}` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}
