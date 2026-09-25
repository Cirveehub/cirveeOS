/**
 * Cirvee OS — entity model.
 *
 * Every shape in `docs/prototype/screen-spec.md` Part B lives here, and every
 * screen reads these types and nothing else.
 *
 * Two rules the type system enforces for us:
 *
 *  1. **Money is kobo.** `Kobo` is a branded number. You cannot hand a naira
 *     float to a field that wants kobo without saying so out loud. ₦450,000.00
 *     is `45_000_000`. The largest seeded corporate contract, ₦52,000,000.00,
 *     is `5_200_000_000` — safe in a JS number, but it would have silently
 *     overflowed the legacy `int32` kobo column (build plan §2.3). The real
 *     system needs `BigInt`.
 *
 *  2. **Ids are branded.** A `PersonId` is not an `InvoiceId`. Mixing them is a
 *     compile error rather than a 2am support ticket.
 *
 * Nothing here is ever hard-deleted. Corrections are new records; withdrawals,
 * reversals and archives are status transitions.
 */

/* -------------------------------------------------------------------------- */
/* B.0 — Branded primitives                                                   */
/* -------------------------------------------------------------------------- */

export type ID<T extends string> = string & { readonly __brand: T }
export type Kobo = number & { readonly __kobo: true }
/** "2026-09-20" */
export type ISODate = string
/** "2026-09-20T14:43:00+01:00" — always Africa/Lagos */
export type ISODateTime = string
/** 0–100, one decimal place at most. */
export type Percent = number

/** Cast a plain number of kobo. Use `naira()` from `@/lib/format` at the edges. */
export const asKobo = (n: number): Kobo => n as Kobo
/** ₦ → kobo, branded. `ngn(450_000)` === ₦450,000.00 === 45_000_000 kobo. */
export const ngn = (amountInNaira: number): Kobo => Math.round(amountInNaira * 100) as Kobo

/** Builds a branded-id caster for one entity family. */
const idMaker =
  <T extends string>() =>
  (value: string): ID<T> =>
    value as ID<T>

/* -------------------------------------------------------------------------- */
/* Id aliases — one per entity family                                         */
/* -------------------------------------------------------------------------- */

export type OrganisationId = ID<'org'>
export type BranchId = ID<'branch'>
export type UnitId = ID<'unit'>
export type DepartmentId = ID<'dept'>
export type TeamId = ID<'team'>
export type PersonId = ID<'person'>
export type RelationshipId = ID<'rel'>
export type UserId = ID<'user'>
export type RoleId = ID<'role'>
export type AuditEventId = ID<'audit'>
export type ActivityId = ID<'activity'>
export type PolicyVersionId = ID<'policy'>
export type FileAttachmentId = ID<'file'>

export type LeadId = ID<'lead'>
export type FollowUpId = ID<'followup'>
export type AdmissionId = ID<'admission'>
export type DuplicateCandidateId = ID<'dupe'>

export type ReferrerProfileId = ID<'referrer'>
export type ReferralId = ID<'referral'>
export type CommissionRuleId = ID<'commrule'>
export type CommissionId = ID<'commission'>
export type PayoutBatchId = ID<'payout'>
export type CommissionDisputeId = ID<'dispute'>

export type CourseId = ID<'course'>
export type CohortId = ID<'cohort'>
export type TutorAssignmentId = ID<'tutorassign'>
export type EnrollmentId = ID<'enrollment'>
export type ClassSessionId = ID<'session'>
export type StudentAttendanceId = ID<'stuatt'>
export type CourseModuleId = ID<'module'>
export type LessonId = ID<'lesson'>
export type CohortDiscussionPostId = ID<'discussionPost'>
export type ContentAssetId = ID<'asset'>
export type AssignmentId = ID<'assignment'>
export type SubmissionId = ID<'submission'>
export type QuizId = ID<'quiz'>
export type QuizAttemptId = ID<'quizAttempt'>
export type ProgressId = ID<'progress'>
export type CertificateId = ID<'cert'>

export type CustomerAccountId = ID<'account'>
export type InvoiceId = ID<'invoice'>
export type InvoiceLineId = ID<'invline'>
export type PaymentId = ID<'payment'>
export type BankTransactionId = ID<'banktxn'>
export type ExpenseId = ID<'expense'>
export type RefundId = ID<'refund'>
export type CreditNoteId = ID<'creditnote'>

export type ApprovalRequestId = ID<'approval'>
export type ApprovalRouteId = ID<'approute'>
export type TaskId = ID<'task'>
export type DocumentTemplateId = ID<'template'>
export type GeneratedDocumentId = ID<'document'>
export type CompanyAssetId = ID<'companyasset'>
export type ProcurementRequestId = ID<'procurement'>
export type KnowledgeArticleId = ID<'kb'>

export type JobOpeningId = ID<'opening'>
export type CandidateId = ID<'candidate'>
export type InterviewId = ID<'interview'>
export type ScorecardId = ID<'scorecard'>
export type OfferId = ID<'offer'>
export type EmployeeId = ID<'employee'>
export type CompensationVersionId = ID<'comp'>
export type AttendanceEventId = ID<'attevent'>
export type LeaveRequestId = ID<'leave'>
export type ExitCaseId = ID<'exit'>
export type PerformanceReviewId = ID<'perfreview'>
export type PayrollPeriodId = ID<'period'>
export type PayrollItemId = ID<'payitem'>
export type PayrollAdjustmentId = ID<'payadj'>
export type PayslipId = ID<'payslip'>

export type AutomationId = ID<'automation'>
export type AutomationRunId = ID<'run'>
export type AutomationExceptionId = ID<'exception'>
export type SegmentId = ID<'segment'>
export type CampaignId = ID<'campaign'>
export type MessageTemplateId = ID<'msgtemplate'>
export type MessageId = ID<'message'>
export type NotificationId = ID<'notification'>

export type CardId = ID<'card'>
export type ReaderId = ID<'reader'>
export type TapEventId = ID<'tap'>
export type VisitorId = ID<'visitor'>
export type OutcomeRecordId = ID<'outcome'>
export type EmployerId = ID<'employer'>
export type TicketId = ID<'ticket'>
export type ClientOrgId = ID<'clientorg'>
export type CorporateDealId = ID<'deal'>
export type ReviewRequestId = ID<'reviewreq'>
export type TestimonialId = ID<'testimonial'>
export type ProofAssetId = ID<'proof'>
export type MeetingId = ID<'meeting'>
export type ActionItemId = ID<'actionitem'>
export type DecisionId = ID<'decision'>

/* Casters. `pid('per-0004')` is a `PersonId`. */
export const orgId = idMaker<'org'>()
export const branchId = idMaker<'branch'>()
export const unitId = idMaker<'unit'>()
export const deptId = idMaker<'dept'>()
export const teamId = idMaker<'team'>()
export const pid = idMaker<'person'>()
export const relId = idMaker<'rel'>()
export const uid = idMaker<'user'>()
export const roleId = idMaker<'role'>()
export const auditId = idMaker<'audit'>()
export const activityId = idMaker<'activity'>()
export const policyId = idMaker<'policy'>()
export const fileId = idMaker<'file'>()

export const leadId = idMaker<'lead'>()
export const followUpId = idMaker<'followup'>()
export const admissionId = idMaker<'admission'>()
export const dupeId = idMaker<'dupe'>()

export const referrerId = idMaker<'referrer'>()
export const referralId = idMaker<'referral'>()
export const ruleId = idMaker<'commrule'>()
export const commissionId = idMaker<'commission'>()
export const payoutId = idMaker<'payout'>()
export const disputeId = idMaker<'dispute'>()

export const courseId = idMaker<'course'>()
export const cohortId = idMaker<'cohort'>()
export const tutorAssignId = idMaker<'tutorassign'>()
export const enrollmentId = idMaker<'enrollment'>()
export const sessionId = idMaker<'session'>()
export const stuAttId = idMaker<'stuatt'>()
export const moduleId = idMaker<'module'>()
export const lessonId = idMaker<'lesson'>()
export const discussionPostId = idMaker<'discussionPost'>()
export const assetId = idMaker<'asset'>()
export const assignmentId = idMaker<'assignment'>()
export const submissionId = idMaker<'submission'>()
export const quizId = idMaker<'quiz'>()
export const quizAttemptId = idMaker<'quizAttempt'>()
export const progressId = idMaker<'progress'>()
export const certId = idMaker<'cert'>()

export const accountId = idMaker<'account'>()
export const invoiceId = idMaker<'invoice'>()
export const invLineId = idMaker<'invline'>()
export const paymentId = idMaker<'payment'>()
export const bankTxnId = idMaker<'banktxn'>()
export const expenseId = idMaker<'expense'>()
export const refundId = idMaker<'refund'>()
export const creditNoteId = idMaker<'creditnote'>()

export const approvalId = idMaker<'approval'>()
export const routeId = idMaker<'approute'>()
export const taskId = idMaker<'task'>()
export const templateId = idMaker<'template'>()
export const documentId = idMaker<'document'>()
export const companyAssetId = idMaker<'companyasset'>()
export const procurementId = idMaker<'procurement'>()
export const kbId = idMaker<'kb'>()

export const openingId = idMaker<'opening'>()
export const candidateId = idMaker<'candidate'>()
export const interviewId = idMaker<'interview'>()
export const scorecardId = idMaker<'scorecard'>()
export const offerId = idMaker<'offer'>()
export const employeeId = idMaker<'employee'>()
export const compId = idMaker<'comp'>()
export const attEventId = idMaker<'attevent'>()
export const leaveId = idMaker<'leave'>()
export const exitId = idMaker<'exit'>()
export const performanceReviewId = idMaker<'perfreview'>()
export const periodId = idMaker<'period'>()
export const payItemId = idMaker<'payitem'>()
export const payAdjId = idMaker<'payadj'>()
export const payslipId = idMaker<'payslip'>()

export const automationId = idMaker<'automation'>()
export const runId = idMaker<'run'>()
export const exceptionId = idMaker<'exception'>()
export const segmentId = idMaker<'segment'>()
export const campaignId = idMaker<'campaign'>()
export const msgTemplateId = idMaker<'msgtemplate'>()
export const messageId = idMaker<'message'>()
export const notificationId = idMaker<'notification'>()

export const cardId = idMaker<'card'>()
export const readerId = idMaker<'reader'>()
export const tapId = idMaker<'tap'>()
export const visitorId = idMaker<'visitor'>()
export const outcomeId = idMaker<'outcome'>()
export const employerId = idMaker<'employer'>()
export const ticketId = idMaker<'ticket'>()
export const clientOrgId = idMaker<'clientorg'>()
export const dealId = idMaker<'deal'>()
export const reviewReqId = idMaker<'reviewreq'>()
export const testimonialId = idMaker<'testimonial'>()
export const proofId = idMaker<'proof'>()
export const meetingId = idMaker<'meeting'>()
export const actionItemId = idMaker<'actionitem'>()
export const decisionId = idMaker<'decision'>()

/* -------------------------------------------------------------------------- */
/* Shared enums                                                               */
/* -------------------------------------------------------------------------- */

export type UnitCode = 'ACADEMY' | 'TEENS' | 'CORPORATE' | 'DEXURB' | 'AFRICA' | 'TCF'
export type BranchCode = 'IBADAN_HQ' | 'LAGOS' | 'VIRTUAL'
export type Mode = 'on_campus' | 'virtual' | 'hybrid'
export type Channel = 'in_app' | 'email' | 'whatsapp' | 'sms'
export type BusinessUnit = UnitCode

/** Every record carries this. No exceptions. */
export interface Auditable {
  createdAt: ISODateTime
  createdBy: UserId
  updatedAt: ISODateTime
  updatedBy: UserId
  /** Soft delete only — the row is never removed from the array. */
  archivedAt?: ISODateTime
  archivedReason?: string
}

/* -------------------------------------------------------------------------- */
/* B.2 Foundation                                                             */
/* -------------------------------------------------------------------------- */

export interface Organisation extends Auditable {
  id: OrganisationId
  legalName: string
  tradingName: string
  rcNumber: string
  tin: string
  address: string
  logoUrl: string
  brandPrimary: '#6d00e7'
  currency: 'NGN'
  timezone: 'Africa/Lagos'
  /** 1–12 */
  financialYearStartMonth: number
}

export type BranchType = 'hq' | 'campus' | 'virtual'
export type ActiveStatus = 'active' | 'inactive'

export interface Branch extends Auditable {
  id: BranchId
  code: BranchCode
  name: string
  type: BranchType
  address: string
  city: string
  state: string
  phone: string
  managerId: EmployeeId | null
  capacity: number
  activeFrom: ISODate
  status: ActiveStatus
}

export interface Unit extends Auditable {
  id: UnitId
  code: UnitCode
  name: string
  description: string
  headId: EmployeeId | null
  activeFrom: ISODate
  status: ActiveStatus
}

export interface Department extends Auditable {
  id: DepartmentId
  name: string
  branchId: BranchId
  headId: EmployeeId | null
}

export interface Team extends Auditable {
  id: TeamId
  name: string
  departmentId: DepartmentId
  leadId: EmployeeId | null
  memberIds: EmployeeId[]
}

export type Gender = 'male' | 'female' | 'other' | 'undisclosed'
export type ConsentType = 'data_processing' | 'photography' | 'communications' | 'public_outcome'
export type ConsentCapturedVia = 'form' | 'kiosk' | 'staff' | 'parent_portal' | 'contract'

export interface Consent {
  type: ConsentType
  granted: boolean
  capturedAt: ISODateTime
  capturedVia: ConsentCapturedVia
  capturedBy: UserId | null
  /** Required when the subject is a minor. */
  guardianPersonId?: PersonId
}

/** The identity record. One row per human being, ever. */
export interface Person extends Auditable {
  id: PersonId
  firstName: string
  lastName: string
  otherNames?: string
  preferredName?: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  dateOfBirth: ISODate | null
  gender?: Gender
  city: string
  state: string
  country: 'Nigeria' | string
  /** "CO" — no photos in the seed. */
  avatarInitials: string
  primaryBranchId: BranchId | null
  tags: string[]
  /** Set when this record lost a merge. */
  mergedIntoPersonId: PersonId | null
  /** Timelines are preserved, never lost. */
  mergedFromPersonIds: PersonId[]
  consents: Consent[]
}

export type RelationshipType =
  | 'lead'
  | 'applicant'
  | 'student'
  | 'alumnus'
  | 'parent_guardian'
  | 'employee'
  | 'candidate'
  | 'tutor'
  | 'referrer'
  | 'corporate_contact'
  | 'event_attendee'
  | 'sponsor'

export type RelationshipStatus = 'active' | 'ended' | 'suspended'

/** Relationships carry dates. They are never overwritten, only end-dated. */
export interface Relationship extends Auditable {
  id: RelationshipId
  personId: PersonId
  type: RelationshipType
  startDate: ISODate
  endDate: ISODate | null
  status: RelationshipStatus
  unitId: UnitId | null
  branchId: BranchId | null
  /** Enrolment, employment, referrer profile… */
  relatedRecordId: string | null
  /** Guardian ↔ child. */
  linkedPersonId?: PersonId
  endReason?: string
}

export type UserStatus = 'active' | 'invited' | 'suspended' | 'deactivated'

export interface User extends Auditable {
  id: UserId
  personId: PersonId
  email: string
  roleIds: RoleId[]
  primaryBranchId: BranchId
  departmentId: DepartmentId | null
  status: UserStatus
  mfaEnabled: boolean
  lastLoginAt: ISODateTime | null
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'approve' | 'assign' | 'export' | 'manage'
export type PermissionScope = 'none' | 'own' | 'team' | 'department' | 'branch' | 'organisation'
export type RoleType = 'system' | 'custom'

export interface Role extends Auditable {
  id: RoleId
  name: string
  description: string
  type: RoleType
  /** "crm.lead" -> { view: "branch", create: "own", … } */
  permissions: Record<string, Record<PermissionAction, PermissionScope>>
  /** Denormalised for the matrix editor's impact preview. */
  userCount: number
}

export type AuditSource = 'ui' | 'api' | 'automation' | 'import'

/**
 * Immutable, append-only, and **not** the activity feed. No `updatedAt`, no
 * `archivedAt` — this record is never modified.
 */
export interface AuditEvent {
  id: AuditEventId
  at: ISODateTime
  actorUserId: UserId
  actorName: string
  actorRole: string
  /** "commission.reverse", "lead.owner.change" */
  action: string
  entityType: string
  entityId: string
  /** "COM-2026-0441" */
  entityRef: string
  field: string | null
  before: string | null
  after: string | null
  source: AuditSource
  ip: string
}

export type ActivitySubjectType =
  | 'person'
  | 'lead'
  | 'admission'
  | 'invoice'
  | 'ticket'
  | 'employee'
  | 'deal'
export type ActivityType = 'note' | 'call' | 'whatsapp' | 'email' | 'meeting' | 'sms' | 'system'
export type CallOutcome = 'connected' | 'no_answer' | 'busy' | 'wrong_number'

/** The activity feed. Ordinary, editable, user-facing. Separate from audit. */
export interface Activity extends Auditable {
  id: ActivityId
  subjectType: ActivitySubjectType
  subjectId: string
  type: ActivityType
  body: string
  callOutcome?: CallOutcome
  durationMinutes?: number
  attachmentIds: FileAttachmentId[]
  /** System entries are not editable. */
  isSystemGenerated: boolean
}

export type PolicyKind =
  | 'approval_threshold'
  | 'discount_threshold'
  | 'attendance'
  | 'certificate_default'
  | 'commission_payout'
  | 'fee_schedule'
  | 'leave_entitlement'
  | 'sla'

export type PolicyStatus = 'draft' | 'active' | 'superseded'

export interface PolicyScope {
  unitId?: UnitId
  branchId?: BranchId
  departmentId?: DepartmentId
  employmentType?: string
  personId?: PersonId
}

export interface PolicyVersion extends Auditable {
  id: PolicyVersionId
  kind: PolicyKind
  version: number
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
  status: PolicyStatus
  /** Most specific wins. */
  scope: PolicyScope
  config: Record<string, unknown>
  setByUserId: UserId
  notes: string
}

export type AttendanceConsequence =
  | 'none'
  | 'notify_employee'
  | 'notify_manager'
  | 'warning_record'
  | 'escalate_performance'
  | 'propose_adjustment'

/** The attendance policy's config, spelled out because it is a non-negotiable. */
export interface AttendancePolicyConfig {
  graceMinutes: number
  lateAfterMinutes: number
  absentAfterMinutes: number
  /** SEEDED FALSE. The engine exists; it ships off. */
  financialConsequenceEnabled: false
  consequences: AttendanceConsequence[]
  /** e.g. "dailyRate * 0.5" — never a literal amount. */
  adjustmentFormula: string | null
  adjustmentCapPerPeriod: Kobo | null
  disputeWindowDays: number
}

/* -------------------------------------------------------------------------- */
/* B.3 CRM & Admissions                                                       */
/* -------------------------------------------------------------------------- */

export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'counselling'
  | 'application'
  | 'payment_pending'
  | 'enrolled'
  | 'not_interested'
  | 'lost'
  | 'invalid'
  | 'unresponsive'
  | 'future_nurture'

export type LeadSource =
  | 'website_form'
  | 'whatsapp'
  | 'walk_in_kiosk'
  | 'instagram_dm'
  | 'referral_link'
  | 'event_scan'
  | 'phone'
  | 'import'
  | 'facebook_ad'
  | 'google_ad'
  | 'alumni_word_of_mouth'

export type LossReason =
  | 'price'
  | 'timing'
  | 'chose_competitor'
  | 'unresponsive'
  | 'not_qualified'
  | 'location'
  | 'course_not_offered'
  | 'duplicate'

export interface Utm {
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
}

export interface OwnershipChange {
  fromUserId: UserId | null
  toUserId: UserId
  at: ISODateTime
  byUserId: UserId
  reason: string
}

export interface Lead extends Auditable {
  id: LeadId
  /** "CIR-L-0912" */
  ref: string
  personId: PersonId
  courseInterestId: CourseId | null
  mode: Mode
  branchId: BranchId
  unitId: UnitId

  stage: LeadStage
  stageEnteredAt: ISODateTime
  /** Derived, cached for sorting. */
  daysInStage: number
  quotedValue: Kobo | null

  /* ── THE THREE INDEPENDENT FIELDS. Never derive one from another. ── */
  /** Who brought them. May be null. */
  referrerPersonId: PersonId | null
  /** Who is working it. Required. */
  ownerUserId: UserId
  /** Who closed it. Often ≠ owner. */
  closerUserId: UserId | null

  /** Written once and never changed. */
  originalSource: LeadSource
  latestSource: LeadSource
  campaignId: CampaignId | null
  utm: Utm
  landingPage: string | null
  referralCode: string | null

  firstResponseAt: ISODateTime | null
  firstResponseMinutes: number | null
  /** Seeded 120. */
  responseSlaMinutes: number

  nextAction: string | null
  nextActionDueAt: ISODateTime | null
  lastActivityAt: ISODateTime | null
  lossReason: LossReason | null
  lossNote: string | null

  ownershipHistory: OwnershipChange[]
}

export type FollowUpStatus = 'open' | 'completed' | 'rescheduled' | 'cancelled'

export interface FollowUp extends Auditable {
  id: FollowUpId
  leadId: LeadId
  ownerUserId: UserId
  action: string
  dueAt: ISODateTime
  status: FollowUpStatus
  outcome: string | null
  completedAt: ISODateTime | null
}

export type DiscountType = 'none' | 'percentage' | 'fixed' | 'scholarship'
export type PaymentPlan = 'full' | '2_instalments' | '3_instalments' | '4_instalments' | 'custom'
export type InstalmentStatus = 'pending' | 'due' | 'paid' | 'overdue'
export type AdmissionStatus =
  | 'draft'
  | 'pending_discount_approval'
  | 'invoiced'
  | 'partially_paid'
  | 'enrolled'
  | 'withdrawn'

export interface Instalment {
  number: number
  dueDate: ISODate
  amount: Kobo
  status: InstalmentStatus
}

export interface Admission extends Auditable {
  id: AdmissionId
  /** "ADM-2026-0187" */
  ref: string
  leadId: LeadId | null
  personId: PersonId
  courseId: CourseId
  cohortId: CohortId
  mode: Mode
  branchId: BranchId
  /** REQUIRED — this is what makes per-unit P&L possible. */
  unitId: UnitId
  expectedStartDate: ISODate

  quotedFee: Kobo
  discountType: DiscountType
  /** % or kobo, depending on `discountType`. */
  discountValue: number
  discountAmount: Kobo
  discountReason: string | null
  /** Set when over threshold. */
  discountApprovalId: ApprovalRequestId | null
  netFee: Kobo

  paymentPlan: PaymentPlan
  instalments: Instalment[]

  /* The three fields again, snapshotted for commission evaluation. */
  referrerPersonId: PersonId | null
  leadOwnerUserId: UserId
  closerUserId: UserId | null

  invoiceId: InvoiceId | null
  status: AdmissionStatus
  enrolmentId: EnrollmentId | null
  withdrawnAt: ISODateTime | null
  withdrawnReason: string | null
}

export type DuplicateMatchField = 'email' | 'phone' | 'whatsapp' | 'name' | 'dob'
export type DuplicateStatus = 'open' | 'merged' | 'not_duplicate' | 'skipped'

export interface DuplicateCandidate {
  id: DuplicateCandidateId
  personAId: PersonId
  personBId: PersonId
  score: Percent
  matchedFields: DuplicateMatchField[]
  status: DuplicateStatus
  resolvedAt: ISODateTime | null
  resolvedBy: UserId | null
  resolutionNote: string | null
}

/* -------------------------------------------------------------------------- */
/* B.4 Referral & Commission                                                  */
/* -------------------------------------------------------------------------- */

export type ReferrerType =
  | 'student'
  | 'alumnus'
  | 'parent'
  | 'employee'
  | 'tutor'
  | 'influencer'
  | 'partner'
  | 'external_agent'
  | 'corporate_partner'

export type ReferrerStatus = 'active' | 'suspended' | 'ended'
export type PayoutMethodKind = 'bank_transfer' | 'payroll' | 'wallet'

export interface PayoutMethod {
  kind: PayoutMethodKind
  bankName?: string
  accountLast4?: string
  verified: boolean
}

export interface ReferrerStats {
  clicks: number
  signups: number
  converted: number
  earned: Kobo
  paid: Kobo
  outstanding: Kobo
}

export interface ReferrerProfile extends Auditable {
  id: ReferrerProfileId
  /** "REF-0142" */
  ref: string
  personId: PersonId
  type: ReferrerType
  /** "NGOZI15" */
  code: string
  /** Old codes keep resolving. */
  supersededCodes: string[]
  trackedUrl: string
  qrPayload: string
  status: ReferrerStatus
  joinedAt: ISODate
  payoutMethod: PayoutMethod
  taxNote: string | null
  stats: ReferrerStats
}

export type ReferralCapture = 'link' | 'code' | 'qr' | 'manual'

export interface Referral extends Auditable {
  id: ReferralId
  referrerProfileId: ReferrerProfileId
  referredPersonId: PersonId
  leadId: LeadId | null
  admissionId: AdmissionId | null
  capturedVia: ReferralCapture
  capturedAt: ISODateTime
  currentStage: LeadStage
  value: Kobo | null
}

export type CommissionRoleOnDeal = 'referrer' | 'lead_owner' | 'closer'
export type CommissionBasis = 'gross_fee' | 'net_after_discount' | 'amount_collected'
export type CommissionRuleStatus = 'draft' | 'scheduled' | 'active' | 'superseded'
export type PayoutSchedule = 'per_payroll' | 'weekly' | 'monthly' | 'on_approval'

export interface CommissionTier {
  fromAmount: Kobo
  toAmount: Kobo | null
  rate: Percent
}

export type CommissionCalculation =
  | { kind: 'percentage'; rate: Percent }
  | { kind: 'fixed'; amount: Kobo }
  | { kind: 'tiered'; tiers: CommissionTier[] }
  | { kind: 'course_specific'; rates: Array<{ courseId: CourseId; rate: Percent }>; fallbackRate: Percent }
  | {
      kind: 'campaign_specific'
      rates: Array<{ campaignId: CampaignId; rate: Percent }>
      fallbackRate: Percent
    }

export interface CommissionEligibility {
  requiresFullPayment: boolean
  minimumPercentPaid: Percent | null
  paymentAgedDays: number | null
  requiresManualApproval: boolean
  stateBeforeEligible: 'pending' | 'tracked'
}

export interface CommissionReversalPolicy {
  onRefund: 'full' | 'proportional' | 'none'
  ifAlreadyPaid: 'create_receivable' | 'deduct_next_payout' | 'write_off_with_approval'
}

/** The rule. Effective-dated, versioned, never hard-coded. */
export interface CommissionRule extends Auditable {
  id: CommissionRuleId
  /** Stable across versions, e.g. "alumni-referral". */
  ruleKey: string
  version: number
  name: string
  description: string
  status: CommissionRuleStatus

  /** [] = all units. */
  unitIds: UnitId[]
  /** [] = all branches. */
  branchIds: BranchId[]

  beneficiaryType: ReferrerType | 'staff'
  /** REQUIRED. Independence of the three fields is enforced here. */
  roleOnDeal: CommissionRoleOnDeal

  calculation: CommissionCalculation
  basis: CommissionBasis
  eligibility: CommissionEligibility
  reversal: CommissionReversalPolicy

  effectiveFrom: ISODate
  /** null = still in force. */
  effectiveTo: ISODate | null
  payoutSchedule: PayoutSchedule
  approvalRequired: boolean
  approverRoleId: RoleId | null

  supersedesVersionId: CommissionRuleId | null
  /** For the edit-warning dialog. */
  commissionCount: number
  commissionTotal: Kobo
}

export type CommissionState =
  | 'tracked'
  | 'pending'
  | 'earned'
  | 'approved'
  | 'payable'
  | 'paid'
  | 'disputed'
  | 'reversed'
  | 'cancelled'

export interface CommissionStateChange {
  from: CommissionState
  to: CommissionState
  at: ISODateTime
  byUserId: UserId
  note: string
}

export interface Commission extends Auditable {
  id: CommissionId
  /** "COM-2026-0441" */
  ref: string
  beneficiaryPersonId: PersonId
  /** Which of the three fields earned it. */
  roleOnDeal: CommissionRoleOnDeal
  admissionId: AdmissionId
  invoiceId: InvoiceId
  courseId: CourseId
  unitId: UnitId
  branchId: BranchId

  ruleId: CommissionRuleId
  ruleKey: string
  /** Displayed on every ledger row. */
  ruleVersion: number

  basis: CommissionBasis
  basisAmount: Kobo
  rateApplied: Percent | null
  tierLabel: string | null
  amount: Kobo

  state: CommissionState
  /** "Held: 55% paid, rule requires 100%" */
  eligibilityNote: string | null
  /** The trace back to money. */
  triggeringPaymentIds: PaymentId[]
  earnedAt: ISODateTime | null
  approvalRequestId: ApprovalRequestId | null
  approvedByUserId: UserId | null
  approvedAt: ISODateTime | null
  payoutBatchId: PayoutBatchId | null
  paidAt: ISODateTime | null

  stateHistory: CommissionStateChange[]

  /* Corrections are records, never edits. */
  adjustmentOfCommissionId: CommissionId | null
  reversalOfCommissionId: CommissionId | null
  reversedByCommissionId: CommissionId | null
  reversalReason: string | null
  triggeringRefundId: RefundId | null
}

export type PayoutBatchStatus = 'draft' | 'approved' | 'processing' | 'paid' | 'partially_failed'
export type PayoutLineStatus = 'pending' | 'paid' | 'failed'

export interface PayoutLine {
  beneficiaryPersonId: PersonId
  commissionIds: CommissionId[]
  amount: Kobo
  bankName: string
  accountLast4: string
  status: PayoutLineStatus
  failureReason: string | null
  bankReference: string | null
}

export interface PayoutBatch extends Auditable {
  id: PayoutBatchId
  /** "PAY-B-2026-018" */
  ref: string
  scheduledDate: ISODate
  method: 'bank_transfer' | 'payroll'
  status: PayoutBatchStatus
  totalAmount: Kobo
  beneficiaryCount: number
  approvalRequestId: ApprovalRequestId | null
  lines: PayoutLine[]
}

export type DisputeCategory =
  | 'wrong_beneficiary'
  | 'wrong_amount'
  | 'not_paid'
  | 'eligibility_contested'
  | 'attribution_contested'
export type DisputeStatus = 'open' | 'under_review' | 'upheld' | 'rejected' | 'withdrawn'

export interface CommissionDispute extends Auditable {
  id: CommissionDisputeId
  ref: string
  commissionId: CommissionId
  raisedByPersonId: PersonId
  raisedAt: ISODateTime
  category: DisputeCategory
  amountInDispute: Kobo
  narrative: string
  status: DisputeStatus
  assigneeUserId: UserId | null
  resolutionNote: string | null
  resultingCommissionId: CommissionId | null
}

/* -------------------------------------------------------------------------- */
/* B.5 Academy & Learn                                                        */
/* -------------------------------------------------------------------------- */

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced'
export type CourseStatus = 'draft' | 'published' | 'archived'
export type ContentFormat = 'video' | 'audio' | 'podcast' | 'pdf' | 'transcript'
export type LessonType = 'content' | 'quiz' | 'assignment' | 'project' | 'live_session'

export interface CertificateEligibilityRules {
  attendanceThreshold: Percent | null
  contentCompletionThreshold: Percent | null
  requiredAssignments: 'all' | 'listed' | 'minimum_count'
  requiredAssignmentIds: AssignmentId[]
  minimumAssignmentCount: number | null
  projectRequired: boolean
  projectMinimumGrade: Percent | null
  finalAssessmentRequired: boolean
  finalAssessmentPassMark: Percent | null
  financialClearanceRequired: boolean
  templateId: DocumentTemplateId
  autoIssue: boolean
}

export interface CourseStats {
  activeCohorts: number
  totalEnrolled: number
  completionRate: Percent
  formatCoverage: Record<ContentFormat, { have: number; total: number }>
}

export interface Course extends Auditable {
  id: CourseId
  code: string
  title: string
  summary: string
  description: string
  unitId: UnitId
  level: CourseLevel
  durationWeeks: number
  modes: Mode[]
  listPrice: Kobo
  coverImageUrl: string
  learningOutcomes: string[]
  prerequisiteCourseIds: CourseId[]
  tags: string[]
  status: CourseStatus
  certificateRules: CertificateEligibilityRules
  stats: CourseStats
}

export type CohortStatus = 'planned' | 'open' | 'running' | 'completed' | 'cancelled'

export interface Cohort extends Auditable {
  id: CohortId
  /** "DA-C12" */
  code: string
  courseId: CourseId
  branchId: BranchId
  unitId: UnitId
  mode: Mode
  startDate: ISODate
  endDate: ISODate
  seats: number
  enrolledCount: number
  waitlistCount: number
  status: CohortStatus
  /** "Tue & Thu, 18:00–20:00" */
  scheduleSummary: string
  attendanceRate: Percent
  completionRate: Percent
}

export interface TutorAssignment extends Auditable {
  id: TutorAssignmentId
  cohortId: CohortId
  tutorPersonId: PersonId
  role: 'lead' | 'assistant' | 'guest'
  startDate: ISODate
  /** Ended, never reassigned in place. */
  endDate: ISODate | null
  sessionsDelivered: number
  status: 'active' | 'ended'
  endReason: string | null
  replacedByAssignmentId: TutorAssignmentId | null
}

export type EnrollmentStatus = 'active' | 'completed' | 'withdrawn' | 'deferred' | 'suspended'
export type AttentionFlag =
  | 'repeated_absence'
  | 'low_attendance'
  | 'missing_assignments'
  | 'low_lms_activity'
  | 'overdue_balance'

export interface Enrollment extends Auditable {
  id: EnrollmentId
  personId: PersonId
  cohortId: CohortId
  courseId: CourseId
  admissionId: AdmissionId
  /** REQUIRED. */
  unitId: UnitId
  enrolledAt: ISODate
  status: EnrollmentStatus
  advisorUserId: UserId | null
  /** Advisory only — never a financial consequence. */
  attentionFlags: AttentionFlag[]
  flaggedAt: ISODateTime | null
}

export type ClassSessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'delivered'
  | 'cancelled'
  | 'rescheduled'

export interface ClassSession extends Auditable {
  id: ClassSessionId
  cohortId: CohortId
  sequence: number
  topic: string
  date: ISODate
  startTime: string
  endTime: string
  room: string | null
  meetingUrl: string | null
  recordingUrl: string | null
  tutorPersonId: PersonId
  expectedCount: number
  presentCount: number
  status: ClassSessionStatus
}

export type StudentAttendanceState = 'present' | 'late' | 'absent' | 'excused'
export type StudentAttendanceSource = 'nfc_tap' | 'qr' | 'tutor_manual' | 'kiosk'

export interface StudentAttendance extends Auditable {
  id: StudentAttendanceId
  sessionId: ClassSessionId
  enrollmentId: EnrollmentId
  personId: PersonId
  state: StudentAttendanceState
  source: StudentAttendanceSource
  tapEventId: TapEventId | null
  tappedAt: ISODateTime | null
  tutorConfirmed: boolean
  overrideReason: string | null
}

export interface CourseModule extends Auditable {
  id: CourseModuleId
  courseId: CourseId
  sequence: number
  title: string
  summary: string
  status: 'draft' | 'published'
}

export interface Lesson extends Auditable {
  id: LessonId
  moduleId: CourseModuleId
  courseId: CourseId
  sequence: number
  title: string
  type: LessonType
  durationMinutes: number
  status: 'draft' | 'published'
  /** A missing key is a missing format. That absence is the whole point. */
  formats: Partial<Record<ContentFormat, ContentAssetId>>
  offlineEnabled: boolean
  androidCheck: { passes: boolean; issues: string[] }
  resources: Array<{ label: string; url: string }>
  quizId: QuizId | null
  assignmentId: AssignmentId | null
}

/**
 * A flat, reverse-chronological post feed for one cohort — deliberately not
 * a threaded forum. Nothing else in Cirvee OS has an adjacent comment/thread
 * model to build on, and a full forum is materially more than "cohort
 * discussion" needs to mean.
 */
export interface CohortDiscussionPost extends Auditable {
  id: CohortDiscussionPostId
  cohortId: CohortId
  authorPersonId: PersonId
  authorRole: 'tutor' | 'student'
  body: string
  postedAt: ISODateTime
  pinned: boolean
}

export type ContentAssetStatus = 'missing' | 'uploaded' | 'processing' | 'published'
export type VideoVariantLabel = '1080p' | '720p' | '480p' | '240p_low_data'

export interface VideoVariant {
  label: VideoVariantLabel
  fileSizeBytes: number
  bitrateKbps: number
  status: 'ready' | 'processing' | 'missing'
}

export interface PodcastMeta {
  feedName: string
  episodeNumber: number
  episodeTitle: string
  publishedAt: ISODate
  publicFeedUrl: string
}

export interface ContentAsset extends Auditable {
  id: ContentAssetId
  lessonId: LessonId
  format: ContentFormat
  fileName: string
  fileSizeBytes: number
  language: 'en'
  status: ContentAssetStatus
  durationSeconds?: number
  pageCount?: number
  downloadCount: number
  offlineEnabled: boolean

  variants?: VideoVariant[]
  audioOrigin?: 'generated_from_video' | 'recorded_separately'
  voice?: string
  podcast?: PodcastMeta
  /** Real text — the library search indexes this. */
  transcriptBody?: string
  transcriptOrigin?: 'auto_generated' | 'human_reviewed'
}

export interface RubricRow {
  criterion: string
  weight: Percent
  description: string
}

export interface Assignment extends Auditable {
  id: AssignmentId
  lessonId: LessonId
  courseId: CourseId
  cohortId: CohortId | null
  title: string
  brief: string
  acceptedFormats: string[]
  maxFileSizeMb: number
  dueOffsetDays: number | null
  dueDate: ISODate | null
  maxScore: number
  rubric: RubricRow[]
  latePolicy: 'accept' | 'accept_with_penalty' | 'reject'
  latePenaltyPercent: Percent | null
  tutorGuidance: string
}

export type SubmissionStatus = 'awaiting_grading' | 'graded' | 'returned_for_revision' | 'missing'

export interface Submission extends Auditable {
  id: SubmissionId
  assignmentId: AssignmentId
  enrollmentId: EnrollmentId
  personId: PersonId
  attempt: number
  submittedAt: ISODateTime
  isLate: boolean
  files: Array<{ fileName: string; sizeBytes: number; url: string }>
  note: string | null
  status: SubmissionStatus
  rubricScores: Array<{ criterion: string; score: number; comment: string }>
  totalScore: number | null
  passed: boolean | null
  feedback: string | null
  voiceNote: { url: string; durationSeconds: number } | null
  gradedByPersonId: PersonId | null
  gradedAt: ISODateTime | null
  daysWaiting: number
}

export type QuizQuestionType =
  | 'multiple_choice'
  | 'multiple_select'
  | 'true_false'
  | 'short_answer'
  | 'numeric'

export interface QuizQuestion {
  id: string
  sequence: number
  type: QuizQuestionType
  stem: string
  points: number
  explanation: string
  options: Array<{ id: string; text: string; correct: boolean }>
}

export interface Quiz extends Auditable {
  id: QuizId
  lessonId: LessonId
  courseId: CourseId
  title: string
  passMark: Percent
  timeLimitMinutes: number | null
  attemptsAllowed: number
  randomiseQuestions: boolean
  randomiseAnswers: boolean
  showAnswersAfter: 'never' | 'after_submission' | 'after_due_date'
  status: 'draft' | 'published'
  questions: QuizQuestion[]
  stats: { attempts: number; passRate: Percent; averageScore: Percent; averageMinutes: number }
}

/**
 * A student's real attempt at a quiz. `QuizQuestion` carries no accepted-
 * answer field for `short_answer`/`numeric` types — only options carry a
 * `correct` flag — so those answers are recorded but never auto-scored:
 * `correct: null`, `pointsAwarded: 0`, and the attempt is flagged
 * `needsManualReview`. `scorePercent` is computed only over the auto-gradable
 * questions' points, never silently treating an unscoreable answer as wrong
 * or as right.
 */
export interface QuizAttemptAnswer {
  questionId: string
  selectedOptionIds: string[]
  textAnswer: string | null
  /** null = not auto-gradable (short_answer/numeric). */
  correct: boolean | null
  pointsAwarded: number
}

export interface QuizAttempt extends Auditable {
  id: QuizAttemptId
  quizId: QuizId
  enrollmentId: EnrollmentId
  personId: PersonId
  attemptNumber: number
  answers: QuizAttemptAnswer[]
  scorePercent: Percent
  passed: boolean
  needsManualReview: boolean
  startedAt: ISODateTime
  submittedAt: ISODateTime
}

export type LessonProgressState = 'not_started' | 'in_progress' | 'complete' | 'failed'

export interface Progress extends Auditable {
  id: ProgressId
  enrollmentId: EnrollmentId
  personId: PersonId
  courseId: CourseId
  lessonsCompleted: number
  lessonsTotal: number
  modulesCompleted: number
  modulesTotal: number
  percentComplete: Percent
  lastLessonId: LessonId | null
  lastDevice: string
  lastActivityAt: ISODateTime
  daysInactive: number
  perLesson: Array<{
    lessonId: LessonId
    state: LessonProgressState
    formatUsed: ContentFormat | null
    completedAt: ISODateTime | null
  }>
}

export type CertificateStatus = 'eligible_not_issued' | 'issued' | 'revoked' | 'superseded'

export interface Certificate extends Auditable {
  id: CertificateId
  /** "CIR-CERT-2026-0418" — public. */
  certificateId: string
  personId: PersonId
  enrollmentId: EnrollmentId
  courseId: CourseId
  cohortId: CohortId
  issuedAt: ISODateTime | null
  issuedByUserId: UserId | null
  issuingBranchId: BranchId
  status: CertificateStatus
  eligibilitySnapshot: Array<{ criterion: string; required: string; actual: string; met: boolean }>
  verificationUrl: string
  qrPayload: string
  outcomeRecordId: OutcomeRecordId | null
  revokedAt: ISODateTime | null
  revokedReason: string | null
}

/* -------------------------------------------------------------------------- */
/* B.6 Finance                                                                */
/* -------------------------------------------------------------------------- */

export type CustomerAccountStatus = 'current' | 'overdue' | 'in_credit' | 'settled' | 'written_off'

export interface CustomerAccount extends Auditable {
  id: CustomerAccountId
  ref: string
  /** Exactly one of these two is set. */
  personId: PersonId | null
  organisationId: ClientOrgId | null
  unitId: UnitId
  branchId: BranchId
  originalFee: Kobo
  approvedDiscount: Kobo
  netFee: Kobo
  invoicedTotal: Kobo
  paidTotal: Kobo
  creditTotal: Kobo
  refundedTotal: Kobo
  balance: Kobo
  daysOverdue: number
  status: CustomerAccountStatus
}

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'refunded'

export interface InvoiceLine {
  id: InvoiceLineId
  description: string
  courseId: CourseId | null
  cohortId: CohortId | null
  enrollmentId: EnrollmentId | null
  quantity: number
  unitPrice: Kobo
  discountAmount: Kobo
  amount: Kobo
  unitId: UnitId
}

export interface Invoice extends Auditable {
  id: InvoiceId
  /** "INV-2026-0932" */
  ref: string
  accountId: CustomerAccountId
  personId: PersonId | null
  organisationId: ClientOrgId | null
  admissionId: AdmissionId | null
  /** REQUIRED — this is per-unit P&L. */
  unitId: UnitId
  branchId: BranchId
  issueDate: ISODate
  dueDate: ISODate
  subtotal: Kobo
  discountAmount: Kobo
  total: Kobo
  paidAmount: Kobo
  balance: Kobo
  status: InvoiceStatus
  daysOverdue: number
  issuedByUserId: UserId | null
  voidedAt: ISODateTime | null
  voidReason: string | null
  creditNoteIds: CreditNoteId[]
  lines: InvoiceLine[]
}

export type PaymentMethod =
  | 'bank_transfer'
  | 'paystack_card'
  | 'paystack_transfer'
  | 'cash'
  | 'pos'
  | 'cheque'
export type PaymentStatus = 'matched' | 'possible_match' | 'unmatched' | 'reversed'

export interface PaymentAllocation {
  invoiceId: InvoiceId
  amount: Kobo
  allocatedAt: ISODateTime
  allocatedBy: UserId
}

export interface Payment extends Auditable {
  id: PaymentId
  /** "PAY-1243" */
  ref: string
  receivedAt: ISODateTime
  amount: Kobo
  method: PaymentMethod
  payerName: string
  payerReference: string
  personId: PersonId | null
  organisationId: ClientOrgId | null
  unitId: UnitId | null
  branchId: BranchId | null
  status: PaymentStatus
  bankTransactionId: BankTransactionId | null
  /** One payment can cover many invoices — the corporate case. */
  allocations: PaymentAllocation[]
  /** Overpayment sits here. */
  unallocatedAmount: Kobo
  receiptSentAt: ISODateTime | null
  reversedAt: ISODateTime | null
  reversalReason: string | null
  daysUnmatched: number
}

export type BankName = 'Zenith' | 'GTBank' | 'Providus'
export type BankMatchStatus = 'unmatched' | 'possible_match' | 'matched' | 'ignored'

export interface BankMatchCandidate {
  invoiceId: InvoiceId
  score: Percent
  /** "amount exact", "reference contains INV-2026-0932" */
  reasons: string[]
}

export interface BankTransaction extends Auditable {
  id: BankTransactionId
  bank: BankName
  accountLast4: string
  date: ISODate
  /** Raw, ugly, realistic. This is what makes matching hard. */
  narration: string
  credit: Kobo | null
  debit: Kobo | null
  runningBalance: Kobo
  reference: string
  matchStatus: BankMatchStatus
  paymentId: PaymentId | null
  daysUnmatched: number
  candidates: BankMatchCandidate[]
}

export type ExpenseStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'rejected'

export interface Expense extends Auditable {
  id: ExpenseId
  ref: string
  date: ISODate
  category: string
  vendor: string
  amount: Kobo
  /** REQUIRED. */
  unitId: UnitId
  branchId: BranchId
  requesterUserId: UserId
  approvalRequestId: ApprovalRequestId | null
  status: ExpenseStatus
  paidDate: ISODate | null
  receiptUrl: string | null
  budgetLine: string
}

export type RefundStatus = 'requested' | 'approved' | 'processed' | 'rejected'

export interface Refund extends Auditable {
  id: RefundId
  ref: string
  invoiceId: InvoiceId
  personId: PersonId
  originalAmount: Kobo
  refundAmount: Kobo
  reason: string
  requestedByUserId: UserId
  approvalRequestId: ApprovalRequestId
  /** Shown in the approval's impact preview. */
  affectedCommissionIds: CommissionId[]
  status: RefundStatus
  processedAt: ISODateTime | null
}

export interface CreditNote extends Auditable {
  id: CreditNoteId
  ref: string
  invoiceId: InvoiceId
  amount: Kobo
  reason: string
  unitId: UnitId
  approvalRequestId: ApprovalRequestId | null
}

/* -------------------------------------------------------------------------- */
/* B.7 Work, Approvals, Documents                                             */
/* -------------------------------------------------------------------------- */

export type ApprovalType =
  | 'expense'
  | 'refund'
  | 'discount'
  | 'leave'
  | 'hire'
  | 'salary_change'
  | 'procurement'
  | 'contract_signature'
  | 'commission_dispute'
  | 'commission_approval'
  | 'payout'

export type ApprovalStepState =
  | 'not_reached'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'skipped'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'returned_for_information'
  | 'withdrawn'
  | 'expired'

export type SlaState = 'within' | 'due_today' | 'breached'

export interface ApprovalStep {
  sequence: number
  approverUserId: UserId
  approverRole: string
  /** "Discount 15–30% → Head of Growth" */
  thresholdLabel: string
  state: ApprovalStepState
  decidedAt: ISODateTime | null
  comment: string | null
}

export interface ApprovalImpactLine {
  text: string
  entityType: string
  entityId: string
  entityRef: string
}

export interface ApprovalThreadEntry {
  at: ISODateTime
  actorUserId: UserId | 'system'
  body: string
  kind: 'comment' | 'system'
}

export interface ApprovalRequest extends Auditable {
  id: ApprovalRequestId
  /** "APR-2026-0311" */
  ref: string
  type: ApprovalType
  title: string
  justification: string
  requesterUserId: UserId
  amount: Kobo | null
  unitId: UnitId | null
  branchId: BranchId | null
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityRef: string
  attachmentIds: FileAttachmentId[]

  routeId: ApprovalRouteId
  /** In-flight requests keep the route version they were raised under. */
  routeVersion: number
  steps: ApprovalStep[]
  currentStepIndex: number
  currentApproverUserId: UserId | null

  raisedAt: ISODateTime
  ageHours: number
  slaHours: number
  slaState: SlaState
  escalatesToUserId: UserId | null
  escalatesAt: ISODateTime | null

  status: ApprovalStatus
  decidedAt: ISODateTime | null

  /** Rendered by the Impact preview panel. Precomputed in the seed. */
  impact: ApprovalImpactLine[]
  thread: ApprovalThreadEntry[]
}

export interface ApprovalBand {
  fromAmount: Kobo
  toAmount: Kobo | null
  approverRoleIds: RoleId[]
  mode: 'all_must_approve' | 'any_one'
  slaHours: number
  escalateToRoleId: RoleId | null
  escalateAfterHours: number
  qualifiers?: { unitId?: UnitId; branchId?: BranchId; requesterRoleId?: RoleId }
}

export interface ApprovalRoute extends Auditable {
  id: ApprovalRouteId
  type: ApprovalType
  version: number
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
  bands: ApprovalBand[]
}

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'cancelled'

export type TaskIncentiveType = 'money' | 'other'

export interface TaskIncentive {
  type: TaskIncentiveType
  /** Set when `type` is 'money'; null otherwise. */
  amount: Kobo | null
  /** The reward description when `type` is 'other'; an optional note when 'money'. */
  note: string | null
}

export interface Task extends Auditable {
  id: TaskId
  title: string
  description: string | null
  ownerUserId: UserId
  departmentId: DepartmentId | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  relatedEntityRef: string | null
  dueAt: ISODateTime | null
  priority: TaskPriority
  status: TaskStatus
  completedAt: ISODateTime | null
  incentive: TaskIncentive | null
  /**
   * Set once a money incentive has actually been posted to payroll — on the
   * task moving to `done`, never before. Stays null for an 'other' incentive,
   * or for a money incentive that could not be posted (no open payroll
   * period, or the owner isn't a paid employee).
   */
  incentivePayrollAdjustmentId: PayrollAdjustmentId | null
}

export interface DocumentTemplate extends Auditable {
  id: DocumentTemplateId
  name: string
  type: string
  version: number
  bodyHtml: string
  mergeFields: string[]
  letterhead: boolean
  signatureBlocks: Array<{ role: string; label: string }>
  status: 'draft' | 'active' | 'archived'
  documentsGenerated: number
}

export type SignatureStatus = 'not_required' | 'awaiting' | 'signed' | 'declined'

export interface GeneratedDocument extends Auditable {
  id: GeneratedDocumentId
  ref: string
  type: string
  templateId: DocumentTemplateId
  templateVersion: number
  personId: PersonId | null
  relatedEntityType: string
  relatedEntityId: string
  generatedByUserId: UserId
  generatedAt: ISODateTime
  fileUrl: string
  signatureStatus: SignatureStatus
  signedAt: ISODateTime | null
  signatories: Array<{ personId: PersonId; signedAt: ISODateTime | null }>
  voidedAt: ISODateTime | null
}

export type AssetCondition = 'new' | 'good' | 'fair' | 'needs_repair' | 'retired'
export type AssetStatus = 'in_store' | 'assigned' | 'on_loan' | 'in_repair' | 'lost' | 'retired'

export interface CompanyAsset extends Auditable {
  id: CompanyAssetId
  /** "AST-0188" */
  assetId: string
  category: string
  name: string
  serial: string
  purchaseDate: ISODate
  purchaseValue: Kobo
  currentValue: Kobo
  branchId: BranchId
  assignedToPersonId: PersonId | null
  assignedAt: ISODate | null
  condition: AssetCondition
  status: AssetStatus
  lastServiceDate: ISODate | null
  returnDueDate: ISODate | null
  serviceHistory: Array<{ date: ISODate; note: string; cost: Kobo }>
}

export type ProcurementStage =
  | 'requested'
  | 'approved'
  | 'quoting'
  | 'ordered'
  | 'received'
  | 'paid'
  | 'closed'
  | 'rejected'

export interface ProcurementRequest extends Auditable {
  id: ProcurementRequestId
  ref: string
  item: string
  category: string
  quantity: number
  estimatedCost: Kobo
  actualCost: Kobo | null
  unitId: UnitId
  branchId: BranchId
  requesterUserId: UserId
  stage: ProcurementStage
  approvalRequestId: ApprovalRequestId | null
  vendor: string | null
  expectedDelivery: ISODate | null
  resultingAssetId: CompanyAssetId | null
  resultingExpenseId: ExpenseId | null
}

export interface KnowledgeArticle extends Auditable {
  id: KnowledgeArticleId
  title: string
  category: string
  audience: string[]
  bodyHtml: string
  version: number
  ownerUserId: UserId
  lastReviewedAt: ISODate
  nextReviewDue: ISODate
  requiresAcknowledgement: boolean
  readReceipts: Array<{ userId: UserId; readAt: ISODateTime | null }>
}

/* -------------------------------------------------------------------------- */
/* B.8 People, Payroll                                                        */
/* -------------------------------------------------------------------------- */

export type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'intern'
export type JobOpeningStatus = 'draft' | 'approved' | 'open' | 'on_hold' | 'filled' | 'cancelled'

export interface JobOpening extends Auditable {
  id: JobOpeningId
  ref: string
  title: string
  departmentId: DepartmentId
  unitId: UnitId
  branchId: BranchId
  employmentType: EmploymentType
  headcount: number
  salaryMin: Kobo
  salaryMax: Kobo
  hiringManagerUserId: UserId
  approvalRequestId: ApprovalRequestId | null
  jobDescription: string
  reason: string
  status: JobOpeningStatus
  openedAt: ISODate | null
  targetStartDate: ISODate
  applicantCount: number
  inPipelineCount: number
}

export type CandidateStage =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'interview'
  | 'assessment'
  | 'final_review'
  | 'offer'
  | 'hired'
  | 'rejected'
  | 'withdrawn'
  | 'talent_pool'
  | 'no_show'

export interface Candidate extends Auditable {
  id: CandidateId
  personId: PersonId
  openingId: JobOpeningId
  source: string
  appliedAt: ISODate
  stage: CandidateStage
  stageEnteredAt: ISODateTime
  recruiterUserId: UserId
  cvUrl: string
  averageScore: number | null
  nextStep: string | null
}

export type InterviewType = 'screening' | 'technical' | 'panel' | 'final'
export type InterviewStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

export interface Interview extends Auditable {
  id: InterviewId
  candidateId: CandidateId
  type: InterviewType
  scheduledAt: ISODateTime
  durationMinutes: number
  interviewerUserIds: UserId[]
  mode: Mode
  location: string | null
  meetingUrl: string | null
  status: InterviewStatus
  outcome: 'advance' | 'reject' | 'hold' | null
}

export type HireRecommendation = 'strong_hire' | 'hire' | 'no_decision' | 'no_hire' | 'strong_no_hire'

export interface Scorecard extends Auditable {
  id: ScorecardId
  interviewId: InterviewId
  interviewerUserId: UserId
  competencies: Array<{ name: string; score: 1 | 2 | 3 | 4 | 5; note: string }>
  recommendation: HireRecommendation
  notes: string
  submittedAt: ISODateTime | null
}

export type OfferStatus =
  | 'draft'
  | 'pending_approval'
  | 'issued'
  | 'accepted'
  | 'declined'
  /** Accepted but never resumed. No Employee record is created. */
  | 'lapsed'
  | 'withdrawn'

export interface Offer extends Auditable {
  id: OfferId
  ref: string
  candidateId: CandidateId
  personId: PersonId
  jobTitle: string
  unitId: UnitId
  branchId: BranchId
  departmentId: DepartmentId
  managerUserId: UserId
  baseSalary: Kobo
  allowances: Array<{ label: string; amount: Kobo }>
  startDate: ISODate
  probationMonths: number
  approvalRequestId: ApprovalRequestId | null
  documentId: GeneratedDocumentId | null
  issuedAt: ISODateTime | null
  expiresAt: ISODate | null
  status: OfferStatus
  respondedAt: ISODateTime | null
}

export type EmployeeStatus = 'active' | 'probation' | 'on_leave' | 'notice' | 'exited' | 'suspended'

/** Never mutated. A change appends a new version and end-dates the old one. */
export interface CompensationVersion {
  id: CompensationVersionId
  employeeId: EmployeeId
  effectiveFrom: ISODate
  effectiveTo: ISODate | null
  baseSalary: Kobo
  allowances: Array<{ label: string; amount: Kobo }>
  gross: Kobo
  reason: string
  approvalRequestId: ApprovalRequestId | null
  approvedByUserId: UserId
  createdAt: ISODateTime
}

export interface Employee extends Auditable {
  id: EmployeeId
  employeeId: string
  personId: PersonId
  jobTitle: string
  departmentId: DepartmentId
  unitId: UnitId
  branchId: BranchId
  managerUserId: UserId | null
  employmentType: EmploymentType
  startDate: ISODate
  endDate: ISODate | null
  status: EmployeeStatus
  probationEndsAt: ISODate | null
  probationOutcome: 'confirmed' | 'extended' | 'ended' | null
  /** Rehire: a new record, history preserved. */
  priorEmploymentIds: EmployeeId[]
  compensationVersions: CompensationVersion[]
  leaveBalances: Array<{ type: string; entitled: number; taken: number; remaining: number }>
  /**
   * Named by the PRD as sitting "behind narrower permissions than the rest
   * of the record," alongside compensation. Kept lean on purpose — full
   * ID-document storage needs real file upload this prototype doesn't have.
   */
  bankDetails: { bankName: string; accountLast4: string } | null
  disciplinaryRecords: Array<{
    id: string
    date: ISODate
    category: string
    summary: string
    issuedByUserId: UserId
  }>
}

/**
 * Modeled on `Scorecard` — the closest existing "someone rates someone else
 * against named criteria" shape. `submittedAt`/`acknowledgedAt` separate a
 * still-editable draft from a review the employee has actually seen, the
 * same draft-vs-final distinction `Scorecard.submittedAt` already draws.
 */
export interface PerformanceReview extends Auditable {
  id: PerformanceReviewId
  employeeId: EmployeeId
  reviewerUserId: UserId
  /** "Q3 2026" — free text, matching how `PayrollPeriod` labels are already free text. */
  periodLabel: string
  competencies: Array<{ name: string; score: 1 | 2 | 3 | 4 | 5; note: string }>
  overallNote: string
  recommendedBonus: Kobo | null
  status: 'draft' | 'submitted' | 'acknowledged'
  submittedAt: ISODateTime | null
  acknowledgedAt: ISODateTime | null
}

export type AttendanceState =
  | 'present'
  | 'late'
  | 'absent'
  | 'approved_leave'
  | 'remote_approved'
  | 'holiday'
  | 'off_day'
  | 'early_departure'
  | 'missing_clock_out'
  | 'excused'

export type AttendanceSource = 'nfc_tap' | 'qr' | 'approved_device' | 'office_network' | 'manual'

export interface AttendanceEvent extends Auditable {
  id: AttendanceEventId
  employeeId: EmployeeId
  personId: PersonId
  date: ISODate
  clockInAt: ISODateTime | null
  clockOutAt: ISODateTime | null
  hours: number | null
  state: AttendanceState
  source: AttendanceSource
  tapEventId: TapEventId | null
  lateByMinutes: number | null
  /** Which rule was in force that day. */
  policyVersionId: PolicyVersionId
  /** SEED NOTE: "none" on every row. The engine exists; it ships off. */
  consequence: AttendanceConsequence
  proposedAdjustmentId: PayrollAdjustmentId | null
  overrideReason: string | null
  overriddenByUserId: UserId | null
}

export type LeaveType =
  | 'annual'
  | 'sick'
  | 'compassionate'
  | 'maternity'
  | 'paternity'
  | 'study'
  | 'unpaid'
export type LeaveStatus = 'requested' | 'approved' | 'rejected' | 'cancelled'

export interface LeaveRequest extends Auditable {
  id: LeaveRequestId
  ref: string
  employeeId: EmployeeId
  type: LeaveType
  fromDate: ISODate
  toDate: ISODate
  days: number
  balanceBefore: number
  balanceAfter: number
  reason: string
  approvalRequestId: ApprovalRequestId | null
  status: LeaveStatus
  decidedAt: ISODateTime | null
}

export type ExitStage =
  | 'notice_review'
  | 'handover'
  | 'asset_return'
  | 'access_review'
  | 'finance_reconciliation'
  | 'commission_reconciliation'
  | 'hr_documentation'
  | 'exit_interview'
  | 'department_clearance'
  | 'final_approval'
  | 'final_payment'
  | 'closed'

export interface ExitCase extends Auditable {
  id: ExitCaseId
  ref: string
  employeeId: EmployeeId
  type: 'resignation' | 'termination' | 'contract_end'
  noticeDate: ISODate
  lastWorkingDay: ISODate
  stage: ExitStage
  clearances: Array<{
    department: string
    clearedByUserId: UserId | null
    clearedAt: ISODateTime | null
    note: string | null
  }>
  outstandingAssetIds: CompanyAssetId[]
  outstandingFinanceAmount: Kobo
  commissionReconciliationStatus: 'pending' | 'clear' | 'receivable'
  finalSettlement: Kobo | null
  accessRevokedAt: ISODateTime | null
  cardDeactivatedAt: ISODateTime | null
  exitInterviewDone: boolean
  approvalRequestId: ApprovalRequestId | null
}

export type PayrollPeriodStatus = 'draft' | 'open' | 'in_review' | 'approved' | 'paid' | 'closed'

/** A closed period is immutable. Corrections become adjustments in the next period. */
export interface PayrollPeriod extends Auditable {
  id: PayrollPeriodId
  /** "Sep 2026" */
  label: string
  month: number
  year: number
  status: PayrollPeriodStatus
  employeeCount: number
  grossTotal: Kobo
  deductionTotal: Kobo
  netTotal: Kobo
  openedAt: ISODateTime
  closedAt: ISODateTime | null
  approvedByUserId: UserId | null
  payslipsIssued: number
}

export interface PayrollItem extends Auditable {
  id: PayrollItemId
  periodId: PayrollPeriodId
  employeeId: EmployeeId
  /** REQUIRED — payroll allocation by unit. */
  unitId: UnitId
  base: Kobo
  commissionLines: Array<{ commissionId: CommissionId; amount: Kobo; ref: string }>
  bonusLines: Array<{ label: string; amount: Kobo; sourceRef: string | null }>
  allowanceLines: Array<{ label: string; amount: Kobo }>
  adjustmentIds: PayrollAdjustmentId[]
  statutoryLines: Array<{ label: 'PAYE' | 'Pension' | 'NHF'; amount: Kobo }>
  gross: Kobo
  deductions: Kobo
  net: Kobo
}

export type PayrollAdjustmentType =
  | 'attendance'
  | 'commission'
  | 'performance_bonus'
  | 'advance_repayment'
  | 'manual_correction'
  | 'statutory'

export type PayrollAdjustmentStatus =
  | 'proposed'
  | 'disputed'
  | 'hr_reviewed'
  | 'finance_reviewed'
  | 'applied'
  | 'voided'

export interface PayrollAdjustment extends Auditable {
  id: PayrollAdjustmentId
  ref: string
  periodId: PayrollPeriodId
  employeeId: EmployeeId
  type: PayrollAdjustmentType
  /** Signed: negative = deduction. */
  amount: Kobo
  sourceEventType: string | null
  sourceEventId: string | null
  sourceEventRef: string | null
  policyVersionId: PolicyVersionId | null
  /** "dailyRate * 0.5" — never a bare number. */
  formulaUsed: string | null
  status: PayrollAdjustmentStatus
  disputeWindowEndsAt: ISODateTime | null
  /** "Attendance corrected 15 Sep" */
  voidedReason: string | null
}

export interface Payslip extends Auditable {
  id: PayslipId
  periodId: PayrollPeriodId
  employeeId: EmployeeId
  payrollItemId: PayrollItemId
  issuedAt: ISODateTime
  viewedAt: ISODateTime | null
  downloadedAt: ISODateTime | null
  ytdGross: Kobo
  ytdDeductions: Kobo
  ytdNet: Kobo
  documentId: GeneratedDocumentId
}

/* -------------------------------------------------------------------------- */
/* B.9 Automation, Engage, Notifications                                      */
/* -------------------------------------------------------------------------- */

export type AutomationTriggerType =
  | 'lead_created'
  | 'lead_stage_changed'
  | 'payment_received'
  | 'tuition_fully_paid'
  | 'invoice_issued'
  | 'invoice_overdue'
  | 'admission_created'
  | 'discount_approved'
  | 'offer_accepted'
  | 'employee_exited'
  | 'certificate_issued'
  | 'course_completed'
  | 'student_absent'
  | 'attendance_breach_detected'
  | 'card_tapped'
  | 'deal_won'
  | 'birthday'
  | 'work_anniversary'
  | 'commission_earned'
  | 'outcome_recorded'
  | 'scheduled'

export interface ConditionGroup {
  operator: 'and' | 'or'
  rules: Array<{ field: string; op: string; value: unknown } | ConditionGroup>
}

export type AutomationActionType =
  | 'send_message'
  | 'assign_owner'
  | 'create_task'
  | 'calculate_commission'
  | 'change_status'
  | 'generate_document'
  | 'request_approval'
  | 'issue_card'
  | 'grant_lms_access'
  | 'add_tag'
  | 'update_field'
  | 'webhook'

export type AutomationNode =
  | {
      id: string
      kind: 'trigger'
      triggerType: AutomationTriggerType
      params: Record<string, unknown>
      summary: string
    }
  | { id: string; kind: 'condition'; group: ConditionGroup; summary: string }
  | {
      id: string
      kind: 'delay'
      wait:
        | { amount: number; unit: 'minutes' | 'hours' | 'days' }
        | { untilField: string }
        | { untilCondition: ConditionGroup; giveUpAfterHours: number }
      workingHoursOnly: boolean
      summary: string
    }
  | {
      id: string
      kind: 'branch'
      label: string
      lanes: Array<{ label: string; condition: ConditionGroup | null; nodeIds: string[] }>
    }
  | {
      id: string
      kind: 'action'
      actionType: AutomationActionType
      params: Record<string, unknown>
      summary: string
    }
  | { id: string; kind: 'stop'; condition: ConditionGroup; summary: string }

export type AutomationStatus = 'draft' | 'active' | 'paused' | 'archived'

export interface Automation extends Auditable {
  id: AutomationId
  automationKey: string
  version: number
  name: string
  description: string
  status: AutomationStatus
  ownerUserId: UserId
  /** Ordered; branches nest one level. */
  nodes: AutomationNode[]
  modulesTouched: string[]
  reliability: {
    /** ["person.id", "invoice.id"] */
    idempotencyKeyFields: string[]
    retryAttempts: number
    retryBackoff: 'fixed' | 'exponential'
    onFailure: 'retry_then_exception' | 'skip' | 'stop_automation'
    maxRunsPerPersonPerPeriod: number | null
  }
  stats: { runs7d: number; successRate: Percent; lastRunAt: ISODateTime | null }
  supersedesVersionId: AutomationId | null
}

export type AutomationRunStatus =
  | 'succeeded'
  | 'failed'
  | 'running'
  | 'waiting_delay'
  | 'waiting_approval'
  | 'stopped_by_condition'
  | 'skipped_conditions_not_met'
  /** The idempotency guard fired. */
  | 'skipped_duplicate'

export interface AutomationRunStep {
  nodeId: string
  kind: string
  label: string
  at: ISODateTime
  durationMs: number
  inputs: Record<string, unknown>
  /** "true — lead.course = Data Analysis" */
  outcome: string
  outputs: Array<{ type: string; id: string; ref: string }>
  error: { class: string; message: string; attempts: number } | null
  skippedReason: string | null
}

/** Runs are never rewritten. Editing the automation creates a new version instead. */
export interface AutomationRun {
  id: AutomationRunId
  automationId: AutomationId
  automationKey: string
  /** The version that executed. */
  automationVersion: number
  triggerType: AutomationTriggerType
  triggerPayload: Record<string, unknown>
  subjectType: string
  subjectId: string
  subjectLabel: string
  startedAt: ISODateTime
  endedAt: ISODateTime | null
  durationMs: number | null
  status: AutomationRunStatus
  idempotencyKey: string
  actionsExecuted: number
  actionsTotal: number
  errorSummary: string | null
  steps: AutomationRunStep[]
}

export type AutomationExceptionStatus = 'open' | 'retrying' | 'resolved' | 'ignored'

export interface AutomationException extends Auditable {
  id: AutomationExceptionId
  runId: AutomationRunId
  automationId: AutomationId
  subjectLabel: string
  failedNodeId: string
  failedNodeLabel: string
  errorClass: string
  errorMessage: string
  firstFailedAt: ISODateTime
  lastAttemptAt: ISODateTime
  retryAttempts: number
  assigneeUserId: UserId | null
  status: AutomationExceptionStatus
  ignoreReason: string | null
}

/** Built from Person records only. There is no separate marketing contact list. */
export interface Segment extends Auditable {
  id: SegmentId
  name: string
  description: string
  criteria: ConditionGroup
  /** Plain English. */
  criteriaSummary: string
  memberCount: number
  lastRefreshedAt: ISODateTime
  usedByCampaignIds: CampaignId[]
  ownerUserId: UserId
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'completed'

export interface Campaign extends Auditable {
  id: CampaignId
  name: string
  objective: string
  channel: Channel
  segmentId: SegmentId
  audienceSize: number
  templateId: MessageTemplateId
  emailDesignId?: string | null
  ownerUserId: UserId
  unitId: UnitId
  budget: Kobo | null
  scheduledAt: ISODateTime | null
  status: CampaignStatus
  utm: { source: string; medium: string; campaign: string }
  stats: {
    sent: number
    delivered: number
    opened: number
    clicked: number
    replied: number
    unsubscribed: number
    converted: number
    enrolments: number
    revenueAttributed: Kobo
  }
}

export interface MessageTemplate extends Auditable {
  id: MessageTemplateId
  name: string
  channel: Channel
  category: string
  subject: string | null
  preview: string
  body: string
  mergeFields: string[]
  language: 'en'
  version: number
  whatsappApprovalStatus: 'approved' | 'pending' | 'rejected' | 'n_a'
  usedByCount: number
}

export type MessageStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'failed'
  | 'bounced'
  | 'unsubscribed'

export interface Message extends Auditable {
  id: MessageId
  personId: PersonId
  channel: Channel
  direction: 'outbound' | 'inbound'
  sourceType: 'campaign' | 'automation' | 'manual' | 'system'
  sourceId: string | null
  templateId: MessageTemplateId | null
  subject: string | null
  preview: string
  body: string
  sentAt: ISODateTime
  status: MessageStatus
  failureReason: string | null
  retryCount: number
}

export type NotificationCategory =
  | 'approvals'
  | 'finance'
  | 'crm'
  | 'academy'
  | 'people'
  | 'automation'
  | 'system'

export interface Notification extends Auditable {
  id: NotificationId
  userId: UserId
  category: NotificationCategory
  title: string
  body: string
  channel: Channel
  read: boolean
  readAt: ISODateTime | null
  snoozedUntil: ISODateTime | null
  relatedEntityType: string | null
  relatedEntityId: string | null
  relatedEntityRef: string | null
  actorUserId: UserId | 'system'
}

/* -------------------------------------------------------------------------- */
/* B.10 Physical, Outcomes, CX, Corporate, Reputation, Meetings               */
/* -------------------------------------------------------------------------- */

export type CardStatus = 'active' | 'suspended' | 'lost' | 'deactivated' | 'replaced'

export interface Card extends Auditable {
  id: CardId
  cardId: string
  /** hex, e.g. "04A3F2C1B57E80" */
  uid: string
  personId: PersonId
  holderType: 'student' | 'employee' | 'tutor' | 'visitor' | 'contractor'
  branchId: BranchId
  accessProfile: string
  issuedAt: ISODate
  issuedByUserId: UserId
  status: CardStatus
  deactivatedAt: ISODateTime | null
  deactivationReason: string | null
  replacesCardId: CardId | null
  replacedByCardId: CardId | null
  lastTapAt: ISODateTime | null
}

export type ReaderType =
  | 'gate'
  | 'door'
  | 'classroom'
  | 'staff_entry'
  | 'restricted_area'
  | 'kiosk'
  | 'equipment_desk'
  | 'event_gate'
  | 'meeting_room'

export type ReaderStatus = 'online' | 'offline' | 'buffering' | 'fault'

export interface Reader extends Auditable {
  id: ReaderId
  readerId: string
  name: string
  type: ReaderType
  branchId: BranchId
  location: string
  status: ReaderStatus
  lastHeartbeatAt: ISODateTime
  bufferedEventCount: number
  firmware: string
  tapsToday: number
}

export type TapDenialReason =
  | 'card_deactivated'
  | 'outside_access_hours'
  | 'status_withdrawn'
  | 'unpaid_balance'
  | 'not_authorised_for_area'

export interface TapEvent {
  id: TapEventId
  cardId: CardId
  personId: PersonId
  readerId: ReaderId
  /** When the tap happened. */
  at: ISODateTime
  /** When it reached the server — differs when the reader was buffering. */
  syncedAt: ISODateTime
  wasBuffered: boolean
  result: 'granted' | 'denied'
  denialReason: TapDenialReason | null
  sessionId: ClassSessionId | null
  meetingId: MeetingId | null
  overrideByUserId: UserId | null
  overrideReason: string | null
}

export interface Visitor extends Auditable {
  id: VisitorId
  name: string
  organisation: string | null
  hostPersonId: PersonId
  purpose: string
  badgeNumber: string
  branchId: BranchId
  phone: string
  checkedInAt: ISODateTime
  checkedOutAt: ISODateTime | null
}

export type OutcomeType =
  | 'full_time'
  | 'contract'
  | 'freelance'
  | 'internship'
  | 'self_employed'
  | 'further_study'
  | 'not_yet_placed'

export interface OutcomeCheckpoint {
  month: 3 | 6 | 12
  dueDate: ISODate
  status: 'scheduled' | 'sent' | 'responded' | 'no_response'
  respondedAt: ISODateTime | null
  attempts: number
  lastChannel: Channel | null
}

export interface OutcomeRecord extends Auditable {
  id: OutcomeRecordId
  personId: PersonId
  certificateId: CertificateId
  courseId: CourseId
  cohortId: CohortId
  graduatedAt: ISODate
  outcomeType: OutcomeType
  employerId: EmployerId | null
  jobTitle: string | null
  placementDate: ISODate | null
  location: string | null
  incomeChange: {
    before: Kobo | null
    after: Kobo | null
    selfReported: true
    volunteered: boolean
  } | null
  relevanceToCourse: 'direct' | 'adjacent' | 'unrelated' | null
  consentForPublicUse: boolean
  consentCapturedAt: ISODateTime | null
  checkpoints: OutcomeCheckpoint[]
  verifiedByUserId: UserId | null
  notes: string
}

export interface Employer extends Auditable {
  id: EmployerId
  name: string
  industry: string
  size: string
  location: string
  graduatesHired: number
  firstHireDate: ISODate | null
  lastHireDate: ISODate | null
  relationshipOwnerUserId: UserId | null
  partnershipStatus: 'none' | 'informal' | 'partner' | 'hiring_partner'
  satisfactionScore: number | null
}

export type TicketCategory =
  | 'payments'
  | 'class'
  | 'tutor'
  | 'certificate'
  | 'technical'
  | 'complaint'
  | 'refund'
  | 'other'

export type TicketStatus =
  | 'new'
  | 'open'
  | 'pending_customer'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'reopened'

export interface TicketMessage {
  id: string
  at: ISODateTime
  direction: 'inbound' | 'outbound' | 'internal'
  authorPersonId: PersonId | null
  channel: Channel
  body: string
  attachmentIds: FileAttachmentId[]
}

export interface Ticket extends Auditable {
  id: TicketId
  ref: string
  subject: string
  requesterPersonId: PersonId
  category: TicketCategory
  priority: TaskPriority
  status: TicketStatus
  ownerUserId: UserId | null
  source: 'student_portal' | 'parent_portal' | 'email' | 'whatsapp' | 'staff' | 'automation'
  relatedEntityType: string | null
  relatedEntityId: string | null
  createdAtTime: ISODateTime
  firstResponseAt: ISODateTime | null
  slaPolicyId: string
  slaState: 'within' | 'due_soon' | 'breached'
  resolvedAt: ISODateTime | null
  resolution: string | null
  messages: TicketMessage[]
}

export interface ClientOrg extends Auditable {
  id: ClientOrgId
  name: string
  industry: string
  size: string
  primaryContactPersonId: PersonId
  accountOwnerUserId: UserId
  contactPersonIds: PersonId[]
  lifetimeRevenue: Kobo
  outstandingBalance: Kobo
  participantsTrained: number
  renewalDate: ISODate | null
  portalAccessEnabled: boolean
}

export type DealStage =
  | 'prospect'
  | 'discovery'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'delivery'
  | 'completed'
  | 'renewal'

export interface CorporateDeal extends Auditable {
  id: CorporateDealId
  ref: string
  organisationId: ClientOrgId
  title: string
  stage: DealStage
  value: Kobo
  probability: Percent
  weightedValue: Kobo
  ownerUserId: UserId
  unitId: UnitId
  source: string
  expectedCloseDate: ISODate
  stageEnteredAt: ISODateTime
  nextAction: string | null
}

export type ReviewTriggerMoment =
  | 'certificate_issued'
  | 'strong_grade'
  | 'placement_confirmed'
  | 'corporate_engagement_completed'
  | 'exit_kiosk_tap'

export interface ReviewRequest extends Auditable {
  id: ReviewRequestId
  personId: PersonId
  triggerMoment: ReviewTriggerMoment
  sourceEventType: string
  sourceEventId: string
  sentAt: ISODateTime
  channel: Channel
  openedAt: ISODateTime | null
  clickedAt: ISODateTime | null
  reviewed: boolean
  rating: number | null
  branchId: BranchId
  cohortId: CohortId | null
}

export interface Testimonial extends Auditable {
  id: TestimonialId
  personId: PersonId
  courseId: CourseId
  cohortId: CohortId
  outcome: string
  quote: string
  capturedAt: ISODateTime
  capturedByUserId: UserId
  channel: Channel
  consentGranted: boolean
  consentCapturedAt: ISODateTime | null
  mediaUrls: string[]
  tags: string[]
  usage: Array<{ where: string; publishedAt: ISODate }>
  status: 'new' | 'approved' | 'published' | 'archived'
}

export type ProofAssetType = 'graduation' | 'placement' | 'standout_project' | 'cohort_milestone'

export interface ProofAsset extends Auditable {
  id: ProofAssetId
  type: ProofAssetType
  subjectPersonId: PersonId
  sourceEventType: string
  sourceEventId: string
  sourceEventRef: string
  /** Automatic — this is the proof engine. */
  draftedAt: ISODateTime
  assigneeUserId: UserId | null
  status: 'drafted' | 'in_production' | 'approved' | 'published' | 'discarded'
  channel: string | null
  publishedUrl: string | null
  consentStatus: 'granted' | 'pending' | 'declined'
}

export type MeetingType =
  | 'weekly_leadership'
  | 'weekly_admissions'
  | 'monthly_business_review'
  | 'quarterly_reset'
  | 'ad_hoc'

export interface Meeting extends Auditable {
  id: MeetingId
  title: string
  type: MeetingType
  startAt: ISODateTime
  durationMinutes: number
  chairUserId: UserId
  location: string | null
  meetingUrl: string | null
  agendaItems: Array<{
    sequence: number
    title: string
    ownerUserId: UserId
    timeboxMinutes: number
    notes: string
  }>
  attendance: Array<{
    personId: PersonId
    method: 'nfc_tap' | 'platform_log' | 'apology'
    arrivedAt: ISODateTime | null
  }>
  minutesCirculatedAt: ISODateTime | null
  status: 'scheduled' | 'in_progress' | 'held' | 'cancelled'
}

export type ActionItemStatus = 'open' | 'in_progress' | 'blocked' | 'done' | 'carried_forward'

export interface ActionItem extends Auditable {
  id: ActionItemId
  title: string
  meetingId: MeetingId
  ownerUserId: UserId
  deadline: ISODate
  status: ActionItemStatus
  /** The accountability number. */
  carriedForwardCount: number
  lastUpdateAt: ISODateTime
  lastUpdateNote: string
  relatedEntityType: string | null
  relatedEntityId: string | null
}

export interface Decision extends Auditable {
  id: DecisionId
  ref: string
  title: string
  /** Full text — this is what people search. */
  decision: string
  rationale: string
  alternativesConsidered: string[]
  decidedByUserIds: UserId[]
  decidedOn: ISODate
  meetingId: MeetingId | null
  affectedAreas: string[]
  supersedesDecisionId: DecisionId | null
  supersededByDecisionId: DecisionId | null
  status: 'active' | 'superseded' | 'reversed'
  reviewDate: ISODate | null
}

/* -------------------------------------------------------------------------- */
/* Selector support types (B.11)                                              */
/* -------------------------------------------------------------------------- */

export interface DateRange {
  from: ISODate
  to: ISODate
}

export interface LeadFilters {
  range?: DateRange
  unitId?: UnitId
  branchId?: BranchId
  ownerUserId?: UserId
  source?: LeadSource
}

export interface CommissionFilters {
  range?: DateRange
  unitId?: UnitId
  branchId?: BranchId
  beneficiaryPersonId?: PersonId
  roleOnDeal?: CommissionRoleOnDeal
  ruleKey?: string
}

export interface CommissionEvaluationInput {
  admissionId: AdmissionId
  /** Defaults to the admission's own date. Set it to back-test a rule version. */
  onDate?: ISODate
  /** Overrides the admission's snapshot when simulating. */
  referrerPersonId?: PersonId | null
  leadOwnerUserId?: UserId
  closerUserId?: UserId | null
  /** Overrides the live figure when simulating. */
  collectedAmount?: Kobo
}

export interface CommissionPreview {
  beneficiaryPersonId: PersonId
  beneficiaryName: string
  roleOnDeal: CommissionRoleOnDeal
  ruleId: CommissionRuleId
  ruleKey: string
  ruleName: string
  ruleVersion: number
  basis: CommissionBasis
  basisAmount: Kobo
  rateApplied: Percent | null
  tierLabel: string | null
  amount: Kobo
  state: CommissionState
  eligibilityNote: string | null
  workings: string
}

export interface EligibilityCriterion {
  criterion: string
  required: string
  actual: string
  met: boolean
}

export interface EligibilityResult {
  enrollmentId: EnrollmentId
  personId: PersonId
  courseId: CourseId
  eligible: boolean
  blockedBy: string[]
  criteria: EligibilityCriterion[]
}

export interface RouteContext {
  unitId?: UnitId
  branchId?: BranchId
  requesterUserId?: UserId
  onDate?: ISODate
}

export interface FunnelStep {
  stage: LeadStage
  count: number
  /** Conversion from the previous stage, as a percentage. */
  conversionFromPrevious: Percent | null
}
