import {
  TODAY,
  CURRENT_USER_ID,
  auditEventsCollection,
  automationRunsCollection,
  automationsCollection,
  certificateEligibility,
  certificatesCollection,
  cohortsCollection,
  courseModulesCollection,
  coursesCollection,
  enrollmentsCollection,
  lessonsCollection,
  outcomeRecordsCollection,
  proofAssetsCollection,
  quizzesCollection,
  relationshipsCollection,
  reviewRequestsCollection,
  rolesCollection,
  unitsCollection,
  usersCollection,
  AUTO,
  BR,
  TPL,
} from '@/mocks'
import {
  auditId as asAuditId,
  certId as asCertId,
  courseId as asCourseId,
  lessonId as asLessonId,
  outcomeId as asOutcomeId,
  proofId as asProofId,
  quizId as asQuizId,
  relId as asRelId,
  reviewReqId as asReviewReqId,
  runId as asRunId,
  asKobo,
  type AuditEvent,
  type AuditSource,
  type Certificate,
  type ContentFormat,
  type Course,
  type CourseLevel,
  type CourseModuleId,
  type DocumentTemplateId,
  type EnrollmentId,
  type Kobo,
  type Lesson,
  type Mode,
  type OutcomeRecord,
  type ProofAsset,
  type Quiz,
  type Relationship,
  type ReviewRequest,
  type UnitId,
} from '@/mocks/types'

import { nowIso, personName, userName } from './common'

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

export function emitAudit(input: AuditInput): AuditEvent {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff') : 'Staff'

  return auditEventsCollection.insert({
    id: asAuditId(`aud-learn-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
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

function auditable(at: string = nowIso()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

const FORMATS: readonly ContentFormat[] = ['video', 'audio', 'podcast', 'pdf', 'transcript']

function emptyCoverage(): Record<ContentFormat, { have: number; total: number }> {
  return FORMATS.reduce(
    (acc, format) => {
      acc[format] = { have: 0, total: 0 }
      return acc
    },
    {} as Record<ContentFormat, { have: number; total: number }>,
  )
}

export interface NewCourseInput {
  title: string
  code: string
  summary: string
  unitId: UnitId
  level: CourseLevel
  durationWeeks: number
  modes: Mode[]
  listPrice: Kobo
}

export function courseCodeTaken(code: string, exceptId?: string): boolean {
  const wanted = code.trim().toUpperCase()
  if (!wanted) return false
  return coursesCollection.all().some((c) => c.id !== exceptId && c.code.toUpperCase() === wanted)
}

export function suggestCourseCode(title: string): string {
  const initials =
    title
      .split(/\s+/)
      .filter((word) => /^[A-Za-z]/.test(word))
      .slice(0, 3)
      .map((word) => word[0].toUpperCase())
      .join('') || 'CRS'
  for (let n = 101; n < 400; n++) {
    const candidate = `${initials}-${n}`
    if (!courseCodeTaken(candidate)) return candidate
  }
  return `${initials}-${Date.now() % 1000}`
}

export function createCourse(input: NewCourseInput): Course {
  const at = nowIso()
  const course: Course = {
    id: asCourseId(`course-ui-${Date.now().toString(36)}`),
    code: input.code.trim().toUpperCase(),
    title: input.title.trim(),
    summary: input.summary.trim(),
    description: '',
    unitId: input.unitId,
    level: input.level,
    durationWeeks: input.durationWeeks,
    modes: input.modes,
    listPrice: input.listPrice,
    coverImageUrl: '',
    learningOutcomes: [],
    prerequisiteCourseIds: [],
    tags: [],
    status: 'draft',
    certificateRules: {
      attendanceThreshold: 75,
      contentCompletionThreshold: 100,
      requiredAssignments: 'all',
      requiredAssignmentIds: [],
      minimumAssignmentCount: null,
      projectRequired: false,
      projectMinimumGrade: null,
      finalAssessmentRequired: false,
      finalAssessmentPassMark: null,
      financialClearanceRequired: true,
      templateId: defaultCertificateTemplateId(),
      autoIssue: false,
    },
    stats: { activeCohorts: 0, totalEnrolled: 0, completionRate: 0, formatCoverage: emptyCoverage() },
    ...auditable(at),
  }
  coursesCollection.insert(course)

  emitAudit({
    action: 'course.create',
    entityType: 'Course',
    entityId: course.id,
    entityRef: course.code,
    field: 'status',
    before: null,
    after: 'draft',
  })
  return course
}

function defaultCertificateTemplateId(): DocumentTemplateId {
  return coursesCollection.all()[0]?.certificateRules.templateId ?? TPL.certificate
}

export interface NewQuizInput {
  courseId: string
  moduleId: CourseModuleId
  title: string
  passMark: number
  attemptsAllowed: number
  timeLimitMinutes: number | null
}

export interface NewQuizResult {
  quiz: Quiz
  lesson: Lesson
}

export function createQuiz(input: NewQuizInput): NewQuizResult {
  const at = nowIso()
  const stamp = Date.now().toString(36)
  const siblings = lessonsCollection.where((l) => l.moduleId === input.moduleId)
  const quizIdValue = asQuizId(`quiz-ui-${stamp}`)
  const lessonIdValue = asLessonId(`lesson-ui-${stamp}`)

  const lesson: Lesson = {
    id: lessonIdValue,
    moduleId: input.moduleId,
    courseId: asCourseId(input.courseId),
    sequence: siblings.length + 1,
    title: input.title.trim(),
    type: 'quiz',
    durationMinutes: input.timeLimitMinutes ?? 15,
    status: 'draft',
    formats: {},
    offlineEnabled: false,
    androidCheck: { passes: true, issues: [] },
    resources: [],
    quizId: quizIdValue,
    assignmentId: null,
    ...auditable(at),
  }
  lessonsCollection.insert(lesson)

  const quiz: Quiz = {
    id: quizIdValue,
    lessonId: lessonIdValue,
    courseId: asCourseId(input.courseId),
    title: input.title.trim(),
    passMark: input.passMark,
    timeLimitMinutes: input.timeLimitMinutes,
    attemptsAllowed: input.attemptsAllowed,
    randomiseQuestions: false,
    randomiseAnswers: false,
    showAnswersAfter: 'after_submission',
    status: 'draft',
    questions: [],
    stats: { attempts: 0, passRate: 0, averageScore: 0, averageMinutes: 0 },
    ...auditable(at),
  }
  quizzesCollection.insert(quiz)

  emitAudit({
    action: 'quiz.create',
    entityType: 'Quiz',
    entityId: quiz.id,
    entityRef: quiz.title,
    field: 'status',
    before: null,
    after: 'draft',
  })

  return { quiz, lesson }
}

export function nextCertificatePublicId(): string {
  const year = TODAY.slice(0, 4)
  const prefix = `CIR-CERT-${year}-`
  const highest = certificatesCollection
    .all()
    .map((c) => c.certificateId)
    .filter((id) => id.startsWith(prefix))
    .map((id) => Number(id.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
  return `${prefix}${String((highest.length ? Math.max(...highest) : 0) + 1).padStart(4, '0')}`
}

export interface IssueResult {
  certificate: Certificate
  relationship: Relationship
  outcome: OutcomeRecord
  reviewRequest: ReviewRequest
  proofAsset: ProofAsset
  cascade: Array<{ label: string; ref: string; to: string }>
}

export function issueCertificate(enrollmentIdValue: EnrollmentId): IssueResult {
  const at = nowIso()
  const enrolment = enrollmentsCollection.find(enrollmentIdValue)
  if (!enrolment) throw new Error('Enrolment not found')

  const eligibility = certificateEligibility(enrollmentIdValue)
  const clearance = eligibility.criteria.find((c) => c.criterion === 'Financial clearance')
  if (clearance && !clearance.met) {
    throw new Error(`Financial clearance is required by this course's rules. ${clearance.actual}.`)
  }

  const cohort = cohortsCollection.find(enrolment.cohortId)
  const branchId = cohort?.branchId ?? BR.ibadan

  const existing = certificatesCollection
    .all()
    .find((c) => c.enrollmentId === enrollmentIdValue && c.status === 'eligible_not_issued')

  const publicId = existing?.certificateId ?? nextCertificatePublicId()
  const certificateIdValue = existing?.id ?? asCertId(`cert-ui-${Date.now().toString(36)}`)
  const outcomeIdValue = asOutcomeId(`outcome-ui-${Date.now().toString(36)}`)

  const issuedFields = {
    issuedAt: at,
    issuedByUserId: CURRENT_USER_ID,
    status: 'issued' as const,
    eligibilitySnapshot: eligibility.criteria.map((c) => ({
      criterion: c.criterion,
      required: c.required,
      actual: c.actual,
      met: c.met,
    })),
    outcomeRecordId: outcomeIdValue,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  }

  let certificate: Certificate
  if (existing) {
    certificate = certificatesCollection.update(existing.id, issuedFields) ?? existing
  } else {
    certificate = certificatesCollection.insert({
      id: certificateIdValue,
      certificateId: publicId,
      personId: enrolment.personId,
      enrollmentId: enrollmentIdValue,
      courseId: enrolment.courseId,
      cohortId: enrolment.cohortId,
      issuingBranchId: branchId,
      verificationUrl: `https://verify.cirvee.com/${publicId}`,
      qrPayload: `https://verify.cirvee.com/${publicId}`,
      revokedAt: null,
      revokedReason: null,
      ...issuedFields,
      ...auditable(at),
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  emitAudit({
    action: 'certificate.issue',
    entityType: 'Certificate',
    entityId: certificate.id,
    entityRef: publicId,
    field: 'status',
    before: existing ? 'eligible_not_issued' : null,
    after: 'issued',
  })

  const relationship = relationshipsCollection
    .all()
    .find((r) => r.personId === enrolment.personId && r.type === 'alumnus' && r.status === 'active')
    ?? relationshipsCollection.insert({
      id: asRelId(`rel-ui-alumnus-${Date.now().toString(36)}`),
      personId: enrolment.personId,
      type: 'alumnus',
      startDate: TODAY,
      endDate: null,
      status: 'active',
      unitId: enrolment.unitId,
      branchId,
      relatedRecordId: certificate.id,
      ...auditable(at),
    })

  const outcome = outcomeRecordsCollection.insert({
    id: outcomeIdValue,
    personId: enrolment.personId,
    certificateId: certificate.id,
    courseId: enrolment.courseId,
    cohortId: enrolment.cohortId,
    graduatedAt: TODAY,
    outcomeType: 'not_yet_placed',
    employerId: null,
    jobTitle: null,
    placementDate: null,
    location: null,
    incomeChange: null,
    relevanceToCourse: null,
    consentForPublicUse: false,
    consentCapturedAt: null,
    checkpoints: ([3, 6, 12] as const).map((month) => ({
      month,
      dueDate: addMonths(TODAY, month),
      status: 'scheduled' as const,
      respondedAt: null,
      attempts: 0,
      lastChannel: null,
    })),
    verifiedByUserId: null,
    notes: `Opened automatically when ${publicId} was issued. Nothing is claimed until the graduate answers a checkpoint.`,
    ...auditable(at),
  })

  emitAudit({
    action: 'outcome.open',
    entityType: 'OutcomeRecord',
    entityId: outcome.id,
    entityRef: publicId,
    field: 'outcomeType',
    before: null,
    after: 'not_yet_placed',
    source: 'automation',
  })

  const reviewRequest = reviewRequestsCollection.insert({
    id: asReviewReqId(`reviewreq-ui-${Date.now().toString(36)}`),
    personId: enrolment.personId,
    triggerMoment: 'certificate_issued',
    sourceEventType: 'Certificate',
    sourceEventId: certificate.id,
    sentAt: at,
    channel: 'whatsapp',
    openedAt: null,
    clickedAt: null,
    reviewed: false,
    rating: null,
    branchId,
    cohortId: enrolment.cohortId,
    ...auditable(at),
  })

  const proofAsset = proofAssetsCollection.insert({
    id: asProofId(`proof-ui-${Date.now().toString(36)}`),
    type: 'graduation',
    subjectPersonId: enrolment.personId,
    sourceEventType: 'Certificate',
    sourceEventId: certificate.id,
    sourceEventRef: publicId,
    draftedAt: at,
    assigneeUserId: null,
    status: 'drafted',
    channel: null,
    publishedUrl: null,
    consentStatus: 'pending',
    ...auditable(at),
  })

  recordCascadeRun(certificate, publicId, {
    relationship,
    outcome,
    reviewRequest,
    proofAsset,
  })

  const cascade: IssueResult['cascade'] = [
    { label: 'Alumnus relationship added', ref: personName(enrolment.personId), to: '/outcomes/graduates' },
    { label: 'Outcome record opened', ref: publicId, to: `/outcomes/records/${outcome.id}` },
    {
      label: '3, 6 and 12-month follow-ups scheduled',
      ref: outcome.checkpoints.map((c) => `${c.month}m`).join(' · '),
      to: '/outcomes/follow-ups',
    },
    { label: 'Review request queued', ref: 'WhatsApp, on the graduation moment', to: '/engage/reviews/requests' },
    { label: 'Story drafted', ref: 'Graduation — consent pending', to: '/engage/reviews/stories' },
  ]

  return { certificate, relationship, outcome, reviewRequest, proofAsset, cascade }
}

function recordCascadeRun(
  certificate: Certificate,
  publicId: string,
  produced: {
    relationship: Relationship
    outcome: OutcomeRecord
    reviewRequest: ReviewRequest
    proofAsset: ProofAsset
  },
): void {
  const automation = automationsCollection.find(AUTO.certificateCascade)
  if (!automation) return
  const at = nowIso()

  automationRunsCollection.insert({
    id: asRunId(`run-ui-${Date.now().toString(36)}`),
    automationId: automation.id,
    automationKey: automation.automationKey,
    automationVersion: automation.version,
    triggerType: 'certificate_issued',
    triggerPayload: { certificateId: publicId, personId: certificate.personId },
    subjectType: 'Certificate',
    subjectId: certificate.id,
    subjectLabel: publicId,
    startedAt: at,
    endedAt: at,
    durationMs: 180,
    status: 'succeeded',
    idempotencyKey: `certificate_issued:${certificate.id}`,
    actionsExecuted: 4,
    actionsTotal: 4,
    errorSummary: null,
    steps: [
      step('add-alumnus', 'Alumnus relationship added', 'Relationship', produced.relationship.id, personName(certificate.personId), at),
      step('open-outcome', 'Outcome record opened with 3/6/12-month checkpoints', 'OutcomeRecord', produced.outcome.id, publicId, at),
      step('queue-review', 'Review request queued on WhatsApp', 'ReviewRequest', produced.reviewRequest.id, publicId, at),
      step('draft-proof', 'Graduation proof asset drafted, consent pending', 'ProofAsset', produced.proofAsset.id, publicId, at),
    ],
  })
}

function step(nodeId: string, label: string, type: string, id: string, ref: string, at: string) {
  return {
    nodeId,
    kind: 'action',
    label,
    at,
    durationMs: 45,
    inputs: {},
    outcome: `created — ${ref}`,
    outputs: [{ type, id, ref }],
    error: null,
    skippedReason: null,
  }
}

export function revokeCertificate(certificateRecordId: string, reason: string): Certificate | undefined {
  const at = nowIso()
  const certificate = certificatesCollection.find(certificateRecordId)
  if (!certificate) return undefined

  const updated = certificatesCollection.update(certificateRecordId, {
    status: 'revoked',
    revokedAt: at,
    revokedReason: reason,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  relationshipsCollection
    .all()
    .filter(
      (r) => r.personId === certificate.personId && r.type === 'alumnus' && r.status === 'active' && r.relatedRecordId === certificate.id,
    )
    .forEach((r) => {
      relationshipsCollection.update(r.id, {
        status: 'ended',
        endDate: TODAY,
        endReason: reason,
        updatedAt: at,
        updatedBy: CURRENT_USER_ID,
      })
    })

  if (certificate.outcomeRecordId) {
    outcomeRecordsCollection.update(certificate.outcomeRecordId, {
      notes: `Closed when ${certificate.certificateId} was revoked. Reason: ${reason}`,
      checkpoints:
        outcomeRecordsCollection
          .find(certificate.outcomeRecordId)
          ?.checkpoints.map((c) => (c.status === 'scheduled' ? { ...c, status: 'no_response' as const } : c)) ?? [],
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  emitAudit({
    action: 'certificate.revoke',
    entityType: 'Certificate',
    entityId: certificate.id,
    entityRef: certificate.certificateId,
    field: 'status',
    before: certificate.status,
    after: 'revoked',
  })

  return updated
}

export function addMonths(date: string, months: number): string {
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function unitName(unitIdValue: UnitId | string | null | undefined): string {
  if (!unitIdValue) return 'Unassigned'
  return unitsCollection.find(unitIdValue)?.name ?? 'Unassigned'
}

export function modulesOf(courseIdValue: string) {
  return courseModulesCollection
    .where((m) => m.courseId === courseIdValue)
    .sort((a, b) => a.sequence - b.sequence)
}

export const nairaToKobo = (naira: number): Kobo => asKobo(Math.round(naira * 100))
