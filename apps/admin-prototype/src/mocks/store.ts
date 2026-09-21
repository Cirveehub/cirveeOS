/**
 * The store.
 *
 * One `Collection<T>` per entity, and a set of **derived selectors** on top.
 *
 * The single most important property of this prototype: dashboards call
 * selectors, never constants. Approve a commission on one screen and the
 * payroll preview on another moves. Match a payment and the Home page's
 * collected-revenue figure changes. That cross-module liveness is most of what
 * makes the thing convincing, and it only works if nobody ever hard-codes a
 * number into a card.
 *
 * ```tsx
 * const leads = useCollection(leadsCollection)
 * const lead  = useRecord(leadsCollection, id)
 * const total = useQuery(paymentsCollection, () => select.collectedRevenue(MTD))
 * ```
 *
 * Money is kobo. Dates are derived from `TODAY` (20 September 2026).
 */

import { Collection } from '@/mocks/collection'
import type {
  Activity,
  Admission,
  ApprovalRequest,
  ApprovalRoute,
  ApprovalStep,
  ApprovalType,
  Assignment,
  AttendanceEvent,
  AuditEvent,
  Automation,
  AutomationException,
  AutomationRun,
  BankTransaction,
  Branch,
  Campaign,
  Candidate,
  Card,
  Certificate,
  ClassSession,
  ClientOrg,
  Cohort,
  Commission,
  CommissionDispute,
  CommissionEvaluationInput,
  CommissionFilters,
  CommissionPreview,
  CommissionRule,
  CommissionState,
  CompanyAsset,
  CorporateDeal,
  Course,
  CourseModule,
  CreditNote,
  CustomerAccount,
  DateRange,
  Decision,
  Department,
  DocumentTemplate,
  DuplicateCandidate,
  EligibilityResult,
  Employee,
  Employer,
  Enrollment,
  EnrollmentId,
  Expense,
  FollowUp,
  FunnelStep,
  GeneratedDocument,
  Interview,
  Invoice,
  JobOpening,
  Kobo,
  KnowledgeArticle,
  Lead,
  LeadFilters,
  LeadSource,
  LeadStage,
  LeaveRequest,
  Lesson,
  Meeting,
  Message,
  MessageTemplate,
  Notification,
  Offer,
  Organisation,
  OutcomeRecord,
  PayoutBatch,
  PayrollAdjustment,
  PayrollItem,
  PayrollPeriod,
  Payment,
  Payslip,
  PerformanceReview,
  Person,
  PersonId,
  PolicyVersion,
  Progress,
  ProcurementRequest,
  CohortDiscussionPost,
  ProofAsset,
  Quiz,
  QuizAttempt,
  Reader,
  Referral,
  ReferrerProfile,
  Refund,
  Relationship,
  ReviewRequest,
  Role,
  RouteContext,
  Scorecard,
  Segment,
  StudentAttendance,
  Submission,
  TapEvent,
  Task,
  Testimonial,
  Ticket,
  Unit,
  UnitId,
  User,
  Visitor,
  ContentAsset,
  ActionItem,
  ExitCase,
  Team,
  TutorAssignment,
} from '@/mocks/types'

import { TODAY, LAST_30D, LAST_90D, MTD, LAST_MONTH, daysBetweenTodayAnd } from '@/mocks/seed/_helpers'

/* Seeds ------------------------------------------------------------------- */
import { branches, departments, organisations, policyVersions, roles, teams, units, users, CURRENT_USER_ID } from '@/mocks/seed/foundation'
import { people, personRelationships } from '@/mocks/seed/people'
import { classSessions, cohorts, courses, tutorAssignments } from '@/mocks/seed/academy'
import { activities, admissions, duplicateCandidates, followUps, leads } from '@/mocks/seed/crm'
import {
  assignments,
  certificates,
  contentAssets,
  courseModules,
  discussionPosts,
  enrollments,
  lessons,
  progress,
  quizzes,
  studentAttendance,
  submissions,
} from '@/mocks/seed/learn'
import { accounts, bankTransactions, creditNotes, expenses, invoices, payments, refunds, CASH_POSITION } from '@/mocks/seed/finance'
import {
  commissionDisputes,
  commissionRules,
  commissions,
  computeCommission,
  payoutBatches,
  referrals,
  referrerProfiles,
  ruleInForce,
} from '@/mocks/seed/referral'
import {
  approvalRequests,
  approvalRoutes,
  buildSteps,
  companyAssets,
  documentTemplates,
  generatedDocuments,
  knowledgeArticles,
  procurementRequests,
  tasks,
} from '@/mocks/seed/approvals'
import {
  attendanceEvents,
  candidates,
  employees,
  exitCases,
  interviews,
  jobOpenings,
  leaveRequests,
  offers,
  payrollAdjustments,
  payrollItems,
  payrollPeriods,
  payslips,
  performanceReviews,
  scorecards,
} from '@/mocks/seed/hr'
import {
  automationExceptions,
  automationRuns,
  automations,
  campaigns,
  messageTemplates,
  messages,
  notifications,
  segments,
} from '@/mocks/seed/automation'
import {
  actionItems,
  cards,
  clientOrgs,
  corporateDeals,
  decisions,
  employers,
  meetings,
  outcomeRecords,
  proofAssets,
  readers,
  reviewRequests,
  tapEvents,
  testimonials,
  tickets,
  visitors,
} from '@/mocks/seed/ops'
import { auditEvents } from '@/mocks/seed/audit'

export { TODAY, LAST_30D, LAST_90D, MTD, LAST_MONTH, CURRENT_USER_ID, CASH_POSITION }

/* -------------------------------------------------------------------------- */
/* Collections                                                                */
/* -------------------------------------------------------------------------- */

/* Foundation */
export const organisationsCollection = new Collection<Organisation>('organisations', organisations)
export const branchesCollection = new Collection<Branch>('branches', branches)
export const unitsCollection = new Collection<Unit>('units', units)
export const departmentsCollection = new Collection<Department>('departments', departments)
export const teamsCollection = new Collection<Team>('teams', teams)
export const rolesCollection = new Collection<Role>('roles', roles)
export const usersCollection = new Collection<User>('users', users)
export const policyVersionsCollection = new Collection<PolicyVersion>('policyVersions', policyVersions)
export const peopleCollection = new Collection<Person>('people', people)
export const relationshipsCollection = new Collection<Relationship>('relationships', personRelationships)
export const auditEventsCollection = new Collection<AuditEvent>('auditEvents', auditEvents)
export const activitiesCollection = new Collection<Activity>('activities', activities)

/* CRM */
export const leadsCollection = new Collection<Lead>('leads', leads)
export const followUpsCollection = new Collection<FollowUp>('followUps', followUps)
export const admissionsCollection = new Collection<Admission>('admissions', admissions)
export const duplicateCandidatesCollection = new Collection<DuplicateCandidate>('duplicateCandidates', duplicateCandidates)

/* Referral & commission */
export const referrerProfilesCollection = new Collection<ReferrerProfile>('referrerProfiles', referrerProfiles)
export const referralsCollection = new Collection<Referral>('referrals', referrals)
export const commissionRulesCollection = new Collection<CommissionRule>('commissionRules', commissionRules)
export const commissionsCollection = new Collection<Commission>('commissions', commissions)
export const payoutBatchesCollection = new Collection<PayoutBatch>('payoutBatches', payoutBatches)
export const commissionDisputesCollection = new Collection<CommissionDispute>('commissionDisputes', commissionDisputes)

/* Academy */
export const coursesCollection = new Collection<Course>('courses', courses)
export const cohortsCollection = new Collection<Cohort>('cohorts', cohorts)
export const tutorAssignmentsCollection = new Collection<TutorAssignment>('tutorAssignments', tutorAssignments)
export const classSessionsCollection = new Collection<ClassSession>('classSessions', classSessions)
export const enrollmentsCollection = new Collection<Enrollment>('enrollments', enrollments)
export const studentAttendanceCollection = new Collection<StudentAttendance>('studentAttendance', studentAttendance)

/* Learn */
export const courseModulesCollection = new Collection<CourseModule>('courseModules', courseModules)
export const lessonsCollection = new Collection<Lesson>('lessons', lessons)
export const contentAssetsCollection = new Collection<ContentAsset>('contentAssets', contentAssets)
export const assignmentsCollection = new Collection<Assignment>('assignments', assignments)
export const submissionsCollection = new Collection<Submission>('submissions', submissions)
export const quizzesCollection = new Collection<Quiz>('quizzes', quizzes)
/** Starts empty — a real attempt is only ever inserted at runtime when a student takes a quiz. */
export const quizAttemptsCollection = new Collection<QuizAttempt>('quizAttempts', [])
export const progressCollection = new Collection<Progress>('progress', progress)
export const cohortDiscussionPostsCollection = new Collection<CohortDiscussionPost>(
  'cohortDiscussionPosts',
  discussionPosts,
)
export const certificatesCollection = new Collection<Certificate>('certificates', certificates)

/* Finance */
export const accountsCollection = new Collection<CustomerAccount>('accounts', accounts)
export const invoicesCollection = new Collection<Invoice>('invoices', invoices)
export const paymentsCollection = new Collection<Payment>('payments', payments)
export const bankTransactionsCollection = new Collection<BankTransaction>('bankTransactions', bankTransactions)
export const expensesCollection = new Collection<Expense>('expenses', expenses)
export const refundsCollection = new Collection<Refund>('refunds', refunds)
export const creditNotesCollection = new Collection<CreditNote>('creditNotes', creditNotes)

/* Work & approvals */
export const approvalRequestsCollection = new Collection<ApprovalRequest>('approvalRequests', approvalRequests)
export const approvalRoutesCollection = new Collection<ApprovalRoute>('approvalRoutes', approvalRoutes)
export const tasksCollection = new Collection<Task>('tasks', tasks)
export const documentTemplatesCollection = new Collection<DocumentTemplate>('documentTemplates', documentTemplates)
export const generatedDocumentsCollection = new Collection<GeneratedDocument>('generatedDocuments', generatedDocuments)
export const companyAssetsCollection = new Collection<CompanyAsset>('companyAssets', companyAssets)
export const procurementRequestsCollection = new Collection<ProcurementRequest>('procurementRequests', procurementRequests)
export const knowledgeArticlesCollection = new Collection<KnowledgeArticle>('knowledgeArticles', knowledgeArticles)

/* People & payroll */
export const jobOpeningsCollection = new Collection<JobOpening>('jobOpenings', jobOpenings)
export const candidatesCollection = new Collection<Candidate>('candidates', candidates)
export const interviewsCollection = new Collection<Interview>('interviews', interviews)
export const scorecardsCollection = new Collection<Scorecard>('scorecards', scorecards)
export const offersCollection = new Collection<Offer>('offers', offers)
export const employeesCollection = new Collection<Employee>('employees', employees)
export const attendanceEventsCollection = new Collection<AttendanceEvent>('attendanceEvents', attendanceEvents)
export const leaveRequestsCollection = new Collection<LeaveRequest>('leaveRequests', leaveRequests)
export const exitCasesCollection = new Collection<ExitCase>('exitCases', exitCases)
export const performanceReviewsCollection = new Collection<PerformanceReview>('performanceReviews', performanceReviews)
export const payrollPeriodsCollection = new Collection<PayrollPeriod>('payrollPeriods', payrollPeriods)
export const payrollItemsCollection = new Collection<PayrollItem>('payrollItems', payrollItems)
export const payrollAdjustmentsCollection = new Collection<PayrollAdjustment>('payrollAdjustments', payrollAdjustments)
export const payslipsCollection = new Collection<Payslip>('payslips', payslips)

/* Automation & engage */
export const automationsCollection = new Collection<Automation>('automations', automations)
export const automationRunsCollection = new Collection<AutomationRun>('automationRuns', automationRuns)
export const automationExceptionsCollection = new Collection<AutomationException>('automationExceptions', automationExceptions)
export const segmentsCollection = new Collection<Segment>('segments', segments)
export const campaignsCollection = new Collection<Campaign>('campaigns', campaigns)
export const messageTemplatesCollection = new Collection<MessageTemplate>('messageTemplates', messageTemplates)
export const messagesCollection = new Collection<Message>('messages', messages)
export const notificationsCollection = new Collection<Notification>('notifications', notifications)

/* Physical, outcomes, CX, corporate, reputation, meetings */
export const cardsCollection = new Collection<Card>('cards', cards)
export const readersCollection = new Collection<Reader>('readers', readers)
export const tapEventsCollection = new Collection<TapEvent>('tapEvents', tapEvents)
export const visitorsCollection = new Collection<Visitor>('visitors', visitors)
export const outcomeRecordsCollection = new Collection<OutcomeRecord>('outcomeRecords', outcomeRecords)
export const employersCollection = new Collection<Employer>('employers', employers)
export const ticketsCollection = new Collection<Ticket>('tickets', tickets)
export const clientOrgsCollection = new Collection<ClientOrg>('clientOrgs', clientOrgs)
export const corporateDealsCollection = new Collection<CorporateDeal>('corporateDeals', corporateDeals)
export const reviewRequestsCollection = new Collection<ReviewRequest>('reviewRequests', reviewRequests)
export const testimonialsCollection = new Collection<Testimonial>('testimonials', testimonials)
export const proofAssetsCollection = new Collection<ProofAsset>('proofAssets', proofAssets)
export const meetingsCollection = new Collection<Meeting>('meetings', meetings)
export const actionItemsCollection = new Collection<ActionItem>('actionItems', actionItems)
export const decisionsCollection = new Collection<Decision>('decisions', decisions)

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const K = (n: number): Kobo => n as Kobo
const inRange = (date: string, range: DateRange) => date >= range.from && date <= range.to
const pct = (part: number, whole: number): number => (whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1)))

function personName(id: PersonId): string {
  const p = peopleCollection.find(id)
  return p ? `${p.firstName} ${p.lastName}` : id
}

/* -------------------------------------------------------------------------- */
/* Selectors (spec §B.11)                                                     */
/* -------------------------------------------------------------------------- */

/** Money actually received in a window. Matched payments only. */
export function collectedRevenue(range: DateRange = MTD, unitId?: UnitId): Kobo {
  return K(
    paymentsCollection
      .all()
      .filter((p) => p.status === 'matched' && inRange(p.receivedAt.slice(0, 10), range))
      .filter((p) => !unitId || p.unitId === unitId)
      .reduce((acc, p) => acc + p.amount, 0),
  )
}

/** Money billed in a window. Never netted against collections — PRD rule. */
export function invoicedRevenue(range: DateRange = MTD, unitId?: UnitId): Kobo {
  return K(
    invoicesCollection
      .all()
      .filter((i) => i.status !== 'cancelled' && inRange(i.issueDate, range))
      .filter((i) => !unitId || i.unitId === unitId)
      .reduce((acc, i) => acc + i.total, 0),
  )
}

/** Collected ÷ invoiced, as a percentage. Shown as a ratio, never as one number. */
export function collectionRate(range: DateRange = MTD, unitId?: UnitId): number {
  return pct(collectedRevenue(range, unitId), invoicedRevenue(range, unitId))
}

/**
 * Open balances owed by **students**. Corporate contract receivables are a
 * different question with a different collections process, so they are
 * reported separately rather than folded in here.
 */
export function outstandingTuition(unitId?: UnitId): Kobo {
  return K(
    invoicesCollection
      .all()
      .filter((i) => i.balance > 0 && i.status !== 'cancelled' && i.personId !== null)
      .filter((i) => !unitId || i.unitId === unitId)
      .reduce((acc, i) => acc + i.balance, 0),
  )
}

/** Open balances owed by client organisations. */
export function outstandingCorporate(): Kobo {
  return K(
    invoicesCollection
      .all()
      .filter((i) => i.balance > 0 && i.status !== 'cancelled' && i.organisationId !== null)
      .reduce((acc, i) => acc + i.balance, 0),
  )
}

/** How many distinct students carry a balance. */
export function studentsWithBalance(): number {
  return new Set(
    invoicesCollection
      .all()
      .filter((i) => i.balance > 0 && i.status !== 'cancelled' && i.personId)
      .map((i) => i.personId as string),
  ).size
}

export function overdueBuckets(): Array<{ label: string; amount: Kobo; count: number }> {
  const buckets = [
    { label: 'Current', min: -Infinity, max: 0 },
    { label: '1–30 days', min: 1, max: 30 },
    { label: '31–60 days', min: 31, max: 60 },
    { label: '61–90 days', min: 61, max: 90 },
    { label: '90+ days', min: 91, max: Infinity },
  ]
  return buckets.map((b) => {
    const rows = invoicesCollection.all().filter((i) => i.balance > 0 && i.daysOverdue >= b.min && i.daysOverdue <= b.max)
    return { label: b.label, amount: K(rows.reduce((acc, i) => acc + i.balance, 0)), count: rows.length }
  })
}

/* ── Pipeline ───────────────────────────────────────────────────────────── */

const FUNNEL_ORDER: LeadStage[] = ['new', 'contacted', 'qualified', 'counselling', 'application', 'payment_pending', 'enrolled']

function filterLeads(filters: LeadFilters = {}): Lead[] {
  return leadsCollection.all().filter((l) => {
    if (filters.range && !inRange(l.createdAt.slice(0, 10), filters.range)) return false
    if (filters.unitId && l.unitId !== filters.unitId) return false
    if (filters.branchId && l.branchId !== filters.branchId) return false
    if (filters.ownerUserId && l.ownerUserId !== filters.ownerUserId) return false
    if (filters.source && l.originalSource !== filters.source) return false
    return true
  })
}

/**
 * The funnel, with stage-to-stage conversion. A lead that reached Enrolled has
 * passed through every earlier stage, so each step counts everyone at or
 * beyond it — otherwise the funnel widens at the bottom and looks broken.
 */
export function pipelineFunnel(filters: LeadFilters = {}): FunnelStep[] {
  const rows = filterLeads(filters)
  const counts = FUNNEL_ORDER.map((stage, i) => {
    const reached = rows.filter((l) => {
      const idx = FUNNEL_ORDER.indexOf(l.stage)
      return idx >= i
    }).length
    return { stage, count: reached }
  })
  return counts.map((c, i) => ({
    stage: c.stage,
    count: c.count,
    conversionFromPrevious: i === 0 ? null : pct(c.count, counts[i - 1].count),
  }))
}

export function leadsBySource(filters: LeadFilters = {}): Array<{ source: LeadSource; count: number; conversion: number }> {
  const rows = filterLeads(filters)
  const sources = [...new Set(rows.map((l) => l.originalSource))]
  return sources
    .map((source) => {
      const mine = rows.filter((l) => l.originalSource === source)
      return { source, count: mine.length, conversion: pct(mine.filter((l) => l.stage === 'enrolled').length, mine.length) }
    })
    .sort((a, b) => b.count - a.count)
}

/**
 * Enrolled admissions ÷ leads — the figure Home labels "Lead → enrolment
 * conversion". Only admissions that came *from a lead* count, otherwise a
 * migrated historical intake would inflate the numerator against a lead
 * population it was never part of.
 */
export function leadConversionRate(range: DateRange = LAST_90D): number {
  const leadIds = new Set(filterLeads({ range }).map((l) => l.id as string))
  const enrolled = admissionsCollection.count(
    (a) => a.status === 'enrolled' && a.leadId !== null && leadIds.has(a.leadId as string),
  )
  return pct(enrolled, leadIds.size)
}

/** Admissions created in a window, by status. The CRM dashboard's counters. */
export function admissionsCreated(range: DateRange = LAST_90D): { total: number; enrolled: number; pendingDiscount: number; withdrawn: number } {
  const rows = admissionsCollection.where((a) => inRange(a.createdAt.slice(0, 10), range))
  return {
    total: rows.length,
    enrolled: rows.filter((a) => a.status === 'enrolled').length,
    pendingDiscount: rows.filter((a) => a.status === 'pending_discount_approval').length,
    withdrawn: rows.filter((a) => a.status === 'withdrawn').length,
  }
}

export function newLeads(range: DateRange = LAST_90D): number {
  return filterLeads({ range }).length
}

/** Median minutes to first response. `null` when nobody has responded yet. */
export function medianFirstResponseMinutes(range: DateRange = LAST_90D): number | null {
  const values = filterLeads({ range })
    .map((l) => l.firstResponseMinutes)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  if (!values.length) return null
  const mid = Math.floor(values.length / 2)
  return values.length % 2 ? values[mid] : Math.round((values[mid - 1] + values[mid]) / 2)
}

export function respondedWithinSlaRate(range: DateRange = LAST_90D): number {
  const rows = filterLeads({ range })
  const responded = rows.filter((l) => l.firstResponseMinutes !== null)
  return pct(responded.filter((l) => (l.firstResponseMinutes ?? 0) <= l.responseSlaMinutes).length, rows.length)
}

/** Sum of quoted value on leads that are still open. */
export function pipelineValue(filters: LeadFilters = {}): Kobo {
  const closed: LeadStage[] = ['enrolled', 'lost', 'not_interested', 'invalid']
  return K(
    filterLeads(filters)
      .filter((l) => !closed.includes(l.stage))
      .reduce((acc, l) => acc + (l.quotedValue ?? 0), 0),
  )
}

export function stalledLeads(minDaysInStage = 14): Lead[] {
  const closed: LeadStage[] = ['enrolled', 'lost', 'not_interested', 'invalid']
  return leadsCollection
    .all()
    .filter((l) => !closed.includes(l.stage) && l.daysInStage >= minDaysInStage)
    .sort((a, b) => b.daysInStage - a.daysInStage)
}

/* ── Commission ─────────────────────────────────────────────────────────── */

function filterCommissions(filters: CommissionFilters = {}): Commission[] {
  return commissionsCollection.all().filter((c) => {
    if (filters.range && !inRange(c.createdAt.slice(0, 10), filters.range)) return false
    if (filters.unitId && c.unitId !== filters.unitId) return false
    if (filters.branchId && c.branchId !== filters.branchId) return false
    if (filters.beneficiaryPersonId && c.beneficiaryPersonId !== filters.beneficiaryPersonId) return false
    if (filters.roleOnDeal && c.roleOnDeal !== filters.roleOnDeal) return false
    if (filters.ruleKey && c.ruleKey !== filters.ruleKey) return false
    return true
  })
}

const ALL_STATES: CommissionState[] = ['tracked', 'pending', 'earned', 'approved', 'payable', 'paid', 'disputed', 'reversed', 'cancelled']

export function commissionTotalsByState(filters: CommissionFilters = {}): Record<CommissionState, Kobo> {
  const rows = filterCommissions(filters)
  const out = {} as Record<CommissionState, Kobo>
  for (const state of ALL_STATES) {
    out[state] = K(rows.filter((c) => c.state === state).reduce((acc, c) => acc + c.amount, 0))
  }
  return out
}

export function commissionCountsByState(filters: CommissionFilters = {}): Record<CommissionState, number> {
  const rows = filterCommissions(filters)
  const out = {} as Record<CommissionState, number>
  for (const state of ALL_STATES) out[state] = rows.filter((c) => c.state === state).length
  return out
}

/** "A referral programme that pays late dies within one cohort." */
export function averageDaysEarnedToPaid(): number {
  const rows = commissionsCollection.all().filter((c) => c.earnedAt && c.paidAt)
  if (!rows.length) return 0
  const total = rows.reduce((acc, c) => acc + (Date.parse(c.paidAt as string) - Date.parse(c.earnedAt as string)) / 86_400_000, 0)
  return Number((total / rows.length).toFixed(1))
}

export function commissionByRule(): Array<{ ruleId: string; ruleKey: string; ruleName: string; version: number; count: number; total: Kobo }> {
  return commissionRulesCollection.all().map((rule) => {
    const rows = commissionsCollection.where((c) => c.ruleId === rule.id)
    return {
      ruleId: rule.id,
      ruleKey: rule.ruleKey,
      ruleName: rule.name,
      version: rule.version,
      count: rows.length,
      total: K(rows.reduce((acc, c) => acc + c.amount, 0)),
    }
  })
}

/** The rule version in force for a key on a date. Flow 2's "in force on" filter. */
export function ruleInForceOn(ruleKey: string, onDate: string = TODAY): CommissionRule | undefined {
  return commissionRulesCollection
    .all()
    .find((r) => r.ruleKey === ruleKey && r.status !== 'draft' && r.effectiveFrom <= onDate && (r.effectiveTo === null || r.effectiveTo >= onDate))
}

export function rulesInForceOn(onDate: string = TODAY): CommissionRule[] {
  const keys = [...new Set(commissionRulesCollection.all().map((r) => r.ruleKey))]
  return keys.map((k) => ruleInForceOn(k, onDate)).filter((r): r is CommissionRule => r !== undefined)
}

/**
 * The commission engine, run as a preview.
 *
 * Evaluates **each of the three fields independently** — referrer, lead owner
 * and closer — against the rules in force on the given date. One admission can
 * therefore produce more than one commission, to more than one person. That is
 * the whole point, and the builder's simulator and Flow 1 step 14 both render
 * straight from this.
 */
export function evaluateCommissionRules(input: CommissionEvaluationInput): CommissionPreview[] {
  const admission = admissionsCollection.find(input.admissionId)
  if (!admission) return []

  const onDate = input.onDate ?? admission.createdAt.slice(0, 10)
  const invoice = admission.invoiceId ? invoicesCollection.find(admission.invoiceId) : undefined
  const collected = K(input.collectedAmount ?? invoice?.paidAmount ?? 0)

  const referrerPersonId = input.referrerPersonId !== undefined ? input.referrerPersonId : admission.referrerPersonId
  const leadOwnerUserId = input.leadOwnerUserId ?? admission.leadOwnerUserId
  const closerUserId = input.closerUserId !== undefined ? input.closerUserId : admission.closerUserId

  const personForUser = (userId: string): PersonId | null => usersCollection.find(userId)?.personId ?? null

  const beneficiaries: Record<string, PersonId | null> = {
    referrer: referrerPersonId,
    lead_owner: personForUser(leadOwnerUserId),
    closer: closerUserId ? personForUser(closerUserId) : null,
  }

  const out: CommissionPreview[] = []

  for (const rule of rulesInForceOn(onDate)) {
    if (rule.unitIds.length && !rule.unitIds.includes(admission.unitId)) continue
    if (rule.branchIds.length && !rule.branchIds.includes(admission.branchId)) continue

    const beneficiaryPersonId = beneficiaries[rule.roleOnDeal]
    if (!beneficiaryPersonId) continue

    // A rule only pays the beneficiary type it declares.
    if (rule.roleOnDeal === 'referrer') {
      const profile = referrerProfilesCollection.all().find((p) => p.personId === beneficiaryPersonId)
      if (!profile || (rule.beneficiaryType !== 'staff' && profile.type !== rule.beneficiaryType)) continue
      if (profile.status !== 'active') continue
    }

    const workings = computeCommission(rule, {
      grossFee: admission.quotedFee,
      netAfterDiscount: admission.netFee,
      amountCollected: collected,
    })

    const paidPercent = invoice && invoice.total > 0 ? Math.round((collected / invoice.total) * 100) : 0
    const fullyPaid = invoice ? collected >= invoice.total : false
    const meetsMinimum = rule.eligibility.minimumPercentPaid === null || paidPercent >= rule.eligibility.minimumPercentPaid
    const eligible = rule.eligibility.requiresFullPayment ? fullyPaid : meetsMinimum

    out.push({
      beneficiaryPersonId,
      beneficiaryName: personName(beneficiaryPersonId),
      roleOnDeal: rule.roleOnDeal,
      ruleId: rule.id,
      ruleKey: rule.ruleKey,
      ruleName: rule.name,
      ruleVersion: rule.version,
      basis: rule.basis,
      basisAmount: workings.basisAmount,
      rateApplied: workings.rateApplied,
      tierLabel: workings.tierLabel,
      amount: workings.amount,
      state: eligible ? 'earned' : rule.eligibility.stateBeforeEligible,
      eligibilityNote: eligible
        ? rule.approvalRequired
          ? 'Approval required before payable: yes'
          : null
        : rule.eligibility.requiresFullPayment
          ? `Held: ${paidPercent}% paid, rule requires 100%`
          : `Held: ${paidPercent}% paid, rule requires ${rule.eligibility.minimumPercentPaid ?? 0}%`,
      workings: workings.explanation,
    })
  }

  return out
}

/**
 * Back-test: what a candidate rule *would* have produced over a window,
 * without writing anything. Flow 2 step 11 renders this.
 */
export function backTestRule(rule: CommissionRule, range: DateRange = LAST_90D): { count: number; total: Kobo; rows: Array<{ admissionId: string; ref: string; amount: Kobo }> } {
  const rows: Array<{ admissionId: string; ref: string; amount: Kobo }> = []
  for (const admission of admissionsCollection.all()) {
    if (!inRange(admission.createdAt.slice(0, 10), range)) continue
    if (rule.unitIds.length && !rule.unitIds.includes(admission.unitId)) continue
    if (rule.roleOnDeal === 'referrer' && !admission.referrerPersonId) continue
    if (rule.roleOnDeal === 'closer' && !admission.closerUserId) continue
    const invoice = admission.invoiceId ? invoicesCollection.find(admission.invoiceId) : undefined
    const workings = computeCommission(rule, {
      grossFee: admission.quotedFee,
      netAfterDiscount: admission.netFee,
      amountCollected: K(invoice?.paidAmount ?? 0),
    })
    if (workings.amount <= 0) continue
    rows.push({ admissionId: admission.id, ref: admission.ref, amount: workings.amount })
  }
  return { count: rows.length, total: K(rows.reduce((acc, r) => acc + r.amount, 0)), rows }
}

export function topReferrers(limit = 10) {
  return referrerProfilesCollection
    .all()
    .map((p) => {
      const mine = commissionsCollection.where((c) => c.beneficiaryPersonId === p.personId)
      const referred = referralsCollection.where((r) => r.referrerProfileId === p.id)
      const converted = referred.filter((r) => r.admissionId !== null).length
      const earned = K(mine.filter((c) => c.state !== 'cancelled').reduce((acc, c) => acc + c.amount, 0))
      const paid = K(mine.filter((c) => c.state === 'paid').reduce((acc, c) => acc + c.amount, 0))
      return {
        profileId: p.id,
        ref: p.ref,
        personId: p.personId,
        name: personName(p.personId),
        type: p.type,
        referrals: referred.length,
        converted,
        conversion: pct(converted, referred.length),
        earned,
        paid,
        outstanding: K(earned - paid),
      }
    })
    .sort((a, b) => b.earned - a.earned)
    .slice(0, limit)
}

/**
 * Referral conversion against the overall rate — the module's business case,
 * and the one number that justifies paying commission at all. Both sides use
 * the same definition as `leadConversionRate`, so the comparison is honest.
 */
export function referralConversionComparison(range: DateRange = LAST_90D): { referral: number; overall: number } {
  const rows = filterLeads({ range })
  const enrolledLeadIds = new Set(
    admissionsCollection
      .where((a) => a.status === 'enrolled' && a.leadId !== null)
      .map((a) => a.leadId as string),
  )
  const referred = rows.filter((l) => l.referrerPersonId !== null)
  return {
    referral: pct(referred.filter((l) => enrolledLeadIds.has(l.id)).length, referred.length),
    overall: pct(rows.filter((l) => enrolledLeadIds.has(l.id)).length, rows.length),
  }
}

/* ── Certificates ───────────────────────────────────────────────────────── */

/**
 * Recomputed live from progress, grades, attendance and the money. This is
 * what blocks Tunde Adeyemi in Flow 5 step 14 and clears Chiamaka in step 13.
 */
export function certificateEligibility(enrollmentId: EnrollmentId): EligibilityResult {
  const enrolment = enrollmentsCollection.find(enrollmentId)
  if (!enrolment) {
    return { enrollmentId, personId: '' as PersonId, courseId: '' as EligibilityResult['courseId'], eligible: false, blockedBy: ['Enrolment not found'], criteria: [] }
  }
  const course = coursesCollection.find(enrolment.courseId)
  const rules = course?.certificateRules
  const prog = progressCollection.all().find((p) => p.enrollmentId === enrollmentId)
  const mySubmissions = submissionsCollection.where((s) => s.enrollmentId === enrollmentId)
  const graded = mySubmissions.filter((s) => s.status === 'graded')
  const projectScore = graded.length ? Math.max(...graded.map((s) => s.totalScore ?? 0)) : 0

  const sessions = classSessionsCollection.where((s) => s.cohortId === enrolment.cohortId && s.status === 'delivered')
  const myAttendance = studentAttendanceCollection.where((a) => a.enrollmentId === enrollmentId)
  const present = myAttendance.filter((a) => a.state === 'present' || a.state === 'late' || a.state === 'excused').length
  const attendance = sessions.length ? Math.round((present / Math.max(1, myAttendance.length)) * 100) : (cohortsCollection.find(enrolment.cohortId)?.attendanceRate ?? 0)

  const balance = K(
    invoicesCollection
      .all()
      .filter((i) => i.personId === enrolment.personId && i.status !== 'cancelled')
      .reduce((acc, i) => acc + i.balance, 0),
  )

  const criteria = [
    {
      criterion: 'Attendance',
      required: rules?.attendanceThreshold === null || rules === undefined ? 'Not required' : `≥ ${rules.attendanceThreshold}%`,
      actual: `${attendance}%`,
      met: rules?.attendanceThreshold == null ? true : attendance >= rules.attendanceThreshold,
    },
    {
      criterion: 'Content completion',
      required: rules?.contentCompletionThreshold == null ? 'Not required' : `${rules.contentCompletionThreshold}%`,
      actual: `${prog?.percentComplete ?? 0}%`,
      met: rules?.contentCompletionThreshold == null ? true : (prog?.percentComplete ?? 0) >= rules.contentCompletionThreshold,
    },
    {
      criterion: 'Assignments',
      required: 'All graded',
      actual: `${graded.length}/${mySubmissions.length} graded`,
      met: mySubmissions.length > 0 && graded.length === mySubmissions.length,
    },
    {
      criterion: 'Project grade',
      required: rules?.projectRequired ? `≥ ${rules.projectMinimumGrade ?? 60}%` : 'Not required',
      actual: `${projectScore}%`,
      met: rules?.projectRequired ? projectScore >= (rules.projectMinimumGrade ?? 60) : true,
    },
    {
      criterion: 'Financial clearance',
      required: rules?.financialClearanceRequired ? 'Balance ₦0' : 'Not required',
      actual: balance === 0 ? '₦0' : `₦${(balance / 100).toLocaleString('en-NG')} outstanding`,
      met: rules?.financialClearanceRequired ? balance <= 0 : true,
    },
  ]

  return {
    enrollmentId,
    personId: enrolment.personId,
    courseId: enrolment.courseId,
    eligible: criteria.every((c) => c.met),
    blockedBy: criteria.filter((c) => !c.met).map((c) => c.criterion),
    criteria,
  }
}

/** Courses down, formats across — the Learn dashboard's signature chart. */
export function contentCoverageMatrix() {
  return coursesCollection.all().map((course) => {
    const courseLessons = lessonsCollection.where((l) => l.courseId === course.id && l.type === 'content')
    const total = courseLessons.length
    const formats = (['video', 'audio', 'podcast', 'pdf', 'transcript'] as const).map((format) => ({
      format,
      have: courseLessons.filter((l) => l.formats[format] !== undefined).length,
      total,
    }))
    return {
      courseId: course.id,
      code: course.code,
      title: course.title,
      formats,
      complete: formats.every((f) => f.total > 0 && f.have === f.total),
    }
  })
}

/**
 * Courses that carry **every** one of the five formats somewhere in their
 * outline. Data Analysis qualifies even though it is 9/14 on audio; the gap is
 * what the coverage matrix is for. Thirteen courses ship video only.
 */
export function coursesWithFullMultiFormat(): number {
  return contentCoverageMatrix().filter((c) => c.formats.every((f) => f.have > 0)).length
}

/** The other side of the same number — the gap the Learn dashboard states. */
export function videoOnlyCourses(): number {
  return contentCoverageMatrix().filter((c) => c.formats.every((f) => f.format === 'video' || f.have === 0)).length
}

/** Full-text search across seeded transcripts. Flow 5 step 6 searches "regression". */
export function searchTranscripts(query: string): Array<{ lessonId: string; lessonTitle: string; courseId: string; snippet: string }> {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return contentAssetsCollection
    .all()
    .filter((a) => a.format === 'transcript' && (a.transcriptBody ?? '').toLowerCase().includes(q))
    .map((a) => {
      const lesson = lessonsCollection.find(a.lessonId)
      const body = a.transcriptBody ?? ''
      const idx = body.toLowerCase().indexOf(q)
      return {
        lessonId: a.lessonId,
        lessonTitle: lesson?.title ?? a.lessonId,
        courseId: lesson?.courseId ?? '',
        snippet: `…${body.slice(Math.max(0, idx - 90), idx + 120).trim()}…`,
      }
    })
}

export function activeLearners(): number {
  return enrollmentsCollection.count((e) => e.status === 'active')
}

export function enrolledStudents(): number {
  return enrollmentsCollection.count((e) => e.status !== 'withdrawn')
}

export function gradingBacklog(): Submission[] {
  return submissionsCollection.where((s) => s.status === 'awaiting_grading').sort((a, b) => b.daysWaiting - a.daysWaiting)
}

export function medianGradingTurnaroundDays(): number {
  const values = submissionsCollection
    .where((s) => s.status === 'graded' && s.gradedAt !== null)
    .map((s) => (Date.parse(s.gradedAt as string) - Date.parse(s.submittedAt)) / 86_400_000)
    .sort((a, b) => a - b)
  if (!values.length) return 0
  return Number(values[Math.floor(values.length / 2)].toFixed(1))
}

/* ── Approvals ──────────────────────────────────────────────────────────── */

/**
 * Resolves a route to the concrete approver chain for a given type and amount.
 * The refund builder calls this on every keystroke, which is why the CFO step
 * appears live as the amount crosses ₦150,000 in Flow 3 step 3.
 */
export function resolveApprovalRoute(type: ApprovalType, amount: Kobo, ctx: RouteContext = {}): ApprovalStep[] {
  return buildSteps(type, amount, ctx.onDate ?? TODAY)
}

export function approvalsPendingOn(userId: string): ApprovalRequest[] {
  return approvalRequestsCollection.where((a) => a.status === 'pending' && a.currentApproverUserId === userId)
}

/** The PRD's absolute: an approver can never approve their own request. */
export function canDecide(request: ApprovalRequest, userId: string): { allowed: boolean; reason: string | null } {
  if (request.status !== 'pending') return { allowed: false, reason: 'This request has already been decided.' }
  if (request.requesterUserId === userId) return { allowed: false, reason: 'An approver cannot approve their own request.' }
  if (request.currentApproverUserId !== userId) return { allowed: false, reason: 'This step is not assigned to you.' }
  return { allowed: true, reason: null }
}

export function approvalsByType(): Array<{ type: ApprovalType; pending: number; total: number; medianDays: number }> {
  const types = [...new Set(approvalRequestsCollection.all().map((a) => a.type))]
  return types.map((type) => {
    const rows = approvalRequestsCollection.where((a) => a.type === type)
    const decided = rows.filter((a) => a.decidedAt !== null)
    const days = decided.map((a) => (Date.parse(a.decidedAt as string) - Date.parse(a.raisedAt)) / 86_400_000).sort((a, b) => a - b)
    return {
      type,
      pending: rows.filter((a) => a.status === 'pending').length,
      total: rows.length,
      medianDays: days.length ? Number(days[Math.floor(days.length / 2)].toFixed(1)) : 0,
    }
  })
}

export function medianApprovalDays(): number {
  const days = approvalRequestsCollection
    .all()
    .filter((a) => a.decidedAt !== null)
    .map((a) => (Date.parse(a.decidedAt as string) - Date.parse(a.raisedAt)) / 86_400_000)
    .sort((a, b) => a - b)
  return days.length ? Number(days[Math.floor(days.length / 2)].toFixed(1)) : 0
}

/* ── Unit P&L ───────────────────────────────────────────────────────────── */

export function unitPnl(range: DateRange = MTD) {
  return unitsCollection.all().map((unit) => {
    const invoiced = invoicedRevenue(range, unit.id)
    const collected = collectedRevenue(range, unit.id)
    const directCost = K(
      expensesCollection
        .all()
        .filter((e) => e.unitId === unit.id && e.status !== 'rejected' && inRange(e.date, range))
        .reduce((acc, e) => acc + e.amount, 0),
    )
    const payroll = K(
      payrollItemsCollection
        .all()
        .filter((i) => i.unitId === unit.id && i.periodId === payrollPeriodsCollection.all().find((p) => p.status === 'open')?.id)
        .reduce((acc, i) => acc + i.gross, 0),
    )
    const headcount = employeesCollection.count((e) => e.unitId === unit.id && e.status !== 'exited')
    const grossMargin = K(invoiced - directCost - payroll)
    return {
      unitId: unit.id,
      code: unit.code,
      name: unit.name,
      invoiced,
      collected,
      directCost,
      payroll,
      grossMargin,
      marginPercent: pct(grossMargin, invoiced),
      headcount,
      revenuePerHead: K(headcount ? Math.round(invoiced / headcount) : 0),
    }
  })
}

export function revenueByUnit(range: DateRange = MTD) {
  return unitsCollection.all().map((unit) => ({
    unitId: unit.id,
    code: unit.code,
    name: unit.name,
    collected: collectedRevenue(range, unit.id),
    invoiced: invoicedRevenue(range, unit.id),
  }))
}

/* ── Operations and people ──────────────────────────────────────────────── */

export function unmatchedPayments(): Payment[] {
  return paymentsCollection
    .where((p) => p.status === 'unmatched' || p.status === 'possible_match')
    .sort((a, b) => b.daysUnmatched - a.daysUnmatched)
}

export function needsAttentionStudents() {
  return enrollmentsCollection
    .where((e) => e.attentionFlags.length > 0 && e.status === 'active')
    .map((e) => ({
      enrollmentId: e.id,
      personId: e.personId,
      name: personName(e.personId),
      cohortCode: cohortsCollection.find(e.cohortId)?.code ?? '',
      flags: e.attentionFlags,
      daysFlagged: e.flaggedAt ? daysBetweenTodayAnd(e.flaggedAt.slice(0, 10)) : 0,
    }))
    .sort((a, b) => b.daysFlagged - a.daysFlagged)
}

export function staffAttendanceRate(date: string = TODAY): { rate: number; present: number; total: number } {
  const rows = attendanceEventsCollection.where((a) => a.date === date)
  const present = rows.filter((a) => ['present', 'late', 'remote_approved'].includes(a.state)).length
  return { rate: pct(present, rows.length), present, total: rows.length }
}

export function studentAttendanceRate(days = 7): number {
  const from = new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
  const sessions = new Set(classSessionsCollection.where((s) => s.date >= from && s.status === 'delivered').map((s) => s.id))
  const rows = studentAttendanceCollection.where((a) => sessions.has(a.sessionId))
  return pct(rows.filter((a) => a.state === 'present' || a.state === 'late').length, rows.length)
}

export function payrollTotals(periodId?: string) {
  const period = periodId ? payrollPeriodsCollection.find(periodId) : payrollPeriodsCollection.all().find((p) => p.status === 'open')
  if (!period) return null
  const items = payrollItemsCollection.where((i) => i.periodId === period.id)
  const commissionLines = items.flatMap((i) => i.commissionLines)
  return {
    period,
    employeeCount: items.length,
    gross: K(items.reduce((acc, i) => acc + i.gross, 0)),
    deductions: K(items.reduce((acc, i) => acc + i.deductions, 0)),
    net: K(items.reduce((acc, i) => acc + i.net, 0)),
    commissionLineCount: commissionLines.length,
    commissionTotal: K(commissionLines.reduce((acc, l) => acc + l.amount, 0)),
    /** Always zero. Attendance deductions are disabled by policy. */
    attendanceDerivedAdjustments: payrollAdjustmentsCollection.count(
      (a) => a.periodId === period.id && a.type === 'attendance' && a.status === 'applied',
    ),
  }
}

export function automationHealth() {
  const runs = automationRunsCollection.all()
  return {
    active: automationsCollection.count((a) => a.status === 'active'),
    paused: automationsCollection.count((a) => a.status === 'paused'),
    draft: automationsCollection.count((a) => a.status === 'draft'),
    runs7d: runs.length,
    succeeded: runs.filter((r) => r.status === 'succeeded').length,
    failed: runs.filter((r) => r.status === 'failed').length,
    successRate: pct(runs.filter((r) => r.status === 'succeeded').length, runs.length),
    /** Excludes runs that are still waiting — the operational read of the same data. */
    completionSuccessRate: pct(
      runs.filter((r) => r.status === 'succeeded').length,
      runs.filter((r) => r.status === 'succeeded' || r.status === 'failed').length,
    ),
    exceptionsOpen: automationExceptionsCollection.count((e) => e.status === 'open'),
    actionsExecuted7d: runs.reduce((acc, r) => acc + r.actionsExecuted, 0),
    messagesSent7d: messagesCollection.count((m) => m.direction === 'outbound'),
    idempotencyCollisionsPrevented: runs.filter((r) => r.status === 'skipped_duplicate').length,
  }
}

/** Everything Home's stat grid needs, derived. No card holds a constant. */
export function executiveSummary(range: DateRange = MTD) {
  const funnel = pipelineFunnel({ range: LAST_90D })
  return {
    collectedRevenue: collectedRevenue(range),
    invoicedRevenue: invoicedRevenue(range),
    collectionRate: collectionRate(range),
    outstandingTuition: outstandingTuition(),
    studentsWithBalance: studentsWithBalance(),
    cashPosition: CASH_POSITION,
    enrolmentsThisPeriod: admissionsCollection.count((a) => a.status === 'enrolled' && inRange(a.createdAt.slice(0, 10), LAST_90D)),
    newLeads: newLeads(LAST_90D),
    leadConversionRate: leadConversionRate(LAST_90D),
    medianFirstResponseMinutes: medianFirstResponseMinutes(LAST_90D),
    staffAttendance: staffAttendanceRate(),
    studentAttendance: studentAttendanceRate(),
    pendingApprovals: approvalRequestsCollection.count((a) => a.status === 'pending'),
    unresolvedTickets: ticketsCollection.count((t) => ['new', 'open', 'pending_customer', 'escalated', 'reopened'].includes(t.status)),
    attentionFlags: needsAttentionStudents().length,
    funnel,
  }
}

/** A single namespace, matching the spec's `MockStore.select` contract. */
export const select = {
  collectedRevenue,
  invoicedRevenue,
  collectionRate,
  outstandingTuition,
  outstandingCorporate,
  studentsWithBalance,
  overdueBuckets,
  pipelineFunnel,
  leadsBySource,
  leadConversionRate,
  admissionsCreated,
  newLeads,
  medianFirstResponseMinutes,
  respondedWithinSlaRate,
  pipelineValue,
  stalledLeads,
  commissionTotalsByState,
  commissionCountsByState,
  averageDaysEarnedToPaid,
  commissionByRule,
  ruleInForceOn,
  rulesInForceOn,
  evaluateCommissionRules,
  backTestRule,
  topReferrers,
  referralConversionComparison,
  certificateEligibility,
  contentCoverageMatrix,
  coursesWithFullMultiFormat,
  videoOnlyCourses,
  searchTranscripts,
  activeLearners,
  enrolledStudents,
  gradingBacklog,
  medianGradingTurnaroundDays,
  resolveApprovalRoute,
  approvalsPendingOn,
  canDecide,
  approvalsByType,
  medianApprovalDays,
  unitPnl,
  revenueByUnit,
  unmatchedPayments,
  needsAttentionStudents,
  staffAttendanceRate,
  studentAttendanceRate,
  payrollTotals,
  automationHealth,
  executiveSummary,
} as const

/* -------------------------------------------------------------------------- */
/* Seed validation                                                            */
/* -------------------------------------------------------------------------- */

export interface SeedProblem {
  collection: string
  recordId: string
  field: string
  value: string
  message: string
}

/**
 * Walks every foreign key in the seed and reports the ones that do not
 * resolve, plus the arithmetic invariants a reviewer would check by hand.
 * Runs automatically in development, below.
 */
export function validateSeed(): SeedProblem[] {
  const problems: SeedProblem[] = []

  const ids = {
    person: new Set(people.map((p) => p.id as string)),
    user: new Set(users.map((u) => u.id as string)),
    role: new Set(roles.map((r) => r.id as string)),
    branch: new Set(branches.map((b) => b.id as string)),
    unit: new Set(units.map((u) => u.id as string)),
    dept: new Set(departments.map((d) => d.id as string)),
    employee: new Set(employees.map((e) => e.id as string)),
    course: new Set(courses.map((c) => c.id as string)),
    cohort: new Set(cohorts.map((c) => c.id as string)),
    lead: new Set(leads.map((l) => l.id as string)),
    admission: new Set(admissions.map((a) => a.id as string)),
    enrollment: new Set(enrollments.map((e) => e.id as string)),
    invoice: new Set(invoices.map((i) => i.id as string)),
    payment: new Set(payments.map((p) => p.id as string)),
    account: new Set(accounts.map((a) => a.id as string)),
    commission: new Set(commissions.map((c) => c.id as string)),
    rule: new Set(commissionRules.map((r) => r.id as string)),
    referrer: new Set(referrerProfiles.map((r) => r.id as string)),
    payout: new Set(payoutBatches.map((p) => p.id as string)),
    approval: new Set(approvalRequests.map((a) => a.id as string)),
    route: new Set(approvalRoutes.map((r) => r.id as string)),
    policy: new Set(policyVersions.map((p) => p.id as string)),
    template: new Set(documentTemplates.map((t) => t.id as string)),
    lesson: new Set(lessons.map((l) => l.id as string)),
    module: new Set(courseModules.map((m) => m.id as string)),
    asset: new Set(contentAssets.map((a) => a.id as string)),
    assignment: new Set(assignments.map((a) => a.id as string)),
    certificate: new Set(certificates.map((c) => c.id as string)),
    period: new Set(payrollPeriods.map((p) => p.id as string)),
    automation: new Set(automations.map((a) => a.id as string)),
    run: new Set(automationRuns.map((r) => r.id as string)),
    card: new Set(cards.map((c) => c.id as string)),
    reader: new Set(readers.map((r) => r.id as string)),
    clientOrg: new Set(clientOrgs.map((c) => c.id as string)),
    segment: new Set(segments.map((s) => s.id as string)),
    msgTemplate: new Set(messageTemplates.map((t) => t.id as string)),
    meeting: new Set(meetings.map((m) => m.id as string)),
    session: new Set(classSessions.map((s) => s.id as string)),
    opening: new Set(jobOpenings.map((o) => o.id as string)),
    candidate: new Set(candidates.map((c) => c.id as string)),
    interview: new Set(interviews.map((i) => i.id as string)),
    refund: new Set(refunds.map((r) => r.id as string)),
    employer: new Set(employers.map((e) => e.id as string)),
  }

  function check(collection: string, recordId: string, field: string, value: string | null | undefined, set: Set<string>) {
    if (value === null || value === undefined) return
    if (!set.has(value)) {
      problems.push({ collection, recordId, field, value, message: `does not resolve to a ${field.replace(/Id$/, '')}` })
    }
  }

  /* Auditable authorship resolves on every collection that carries it. */
  const auditable: Array<[string, Array<{ id: string; createdBy: string; updatedBy: string }>]> = [
    ['people', people as never],
    ['leads', leads as never],
    ['admissions', admissions as never],
    ['invoices', invoices as never],
    ['payments', payments as never],
    ['commissions', commissions as never],
    ['approvalRequests', approvalRequests as never],
    ['employees', employees as never],
    ['enrollments', enrollments as never],
  ]
  for (const [name, rows] of auditable) {
    for (const row of rows) {
      check(name, row.id, 'createdBy', row.createdBy, ids.user)
      check(name, row.id, 'updatedBy', row.updatedBy, ids.user)
    }
  }

  for (const u of users) {
    check('users', u.id, 'personId', u.personId, ids.person)
    check('users', u.id, 'primaryBranchId', u.primaryBranchId, ids.branch)
    check('users', u.id, 'departmentId', u.departmentId, ids.dept)
    for (const rid of u.roleIds) check('users', u.id, 'roleIds', rid, ids.role)
  }

  for (const rel of personRelationships) check('relationships', rel.id, 'personId', rel.personId, ids.person)

  for (const l of leads) {
    check('leads', l.id, 'personId', l.personId, ids.person)
    check('leads', l.id, 'courseInterestId', l.courseInterestId, ids.course)
    check('leads', l.id, 'ownerUserId', l.ownerUserId, ids.user)
    check('leads', l.id, 'closerUserId', l.closerUserId, ids.user)
    check('leads', l.id, 'referrerPersonId', l.referrerPersonId, ids.person)
    check('leads', l.id, 'branchId', l.branchId, ids.branch)
    check('leads', l.id, 'unitId', l.unitId, ids.unit)
  }

  for (const a of admissions) {
    check('admissions', a.id, 'personId', a.personId, ids.person)
    check('admissions', a.id, 'leadId', a.leadId, ids.lead)
    check('admissions', a.id, 'courseId', a.courseId, ids.course)
    check('admissions', a.id, 'cohortId', a.cohortId, ids.cohort)
    check('admissions', a.id, 'unitId', a.unitId, ids.unit)
    check('admissions', a.id, 'branchId', a.branchId, ids.branch)
    check('admissions', a.id, 'invoiceId', a.invoiceId, ids.invoice)
    check('admissions', a.id, 'enrolmentId', a.enrolmentId, ids.enrollment)
    check('admissions', a.id, 'leadOwnerUserId', a.leadOwnerUserId, ids.user)
    check('admissions', a.id, 'closerUserId', a.closerUserId, ids.user)
    check('admissions', a.id, 'referrerPersonId', a.referrerPersonId, ids.person)
    check('admissions', a.id, 'discountApprovalId', a.discountApprovalId, ids.approval)
    if (a.netFee !== a.quotedFee - a.discountAmount) {
      problems.push({ collection: 'admissions', recordId: a.id, field: 'netFee', value: String(a.netFee), message: 'netFee ≠ quotedFee − discountAmount' })
    }
    const instalmentTotal = a.instalments.reduce((acc, i) => acc + i.amount, 0)
    if (a.instalments.length && instalmentTotal !== a.netFee) {
      problems.push({ collection: 'admissions', recordId: a.id, field: 'instalments', value: String(instalmentTotal), message: 'instalments do not sum to netFee' })
    }
  }

  for (const e of enrollments) {
    check('enrollments', e.id, 'personId', e.personId, ids.person)
    check('enrollments', e.id, 'admissionId', e.admissionId, ids.admission)
    check('enrollments', e.id, 'cohortId', e.cohortId, ids.cohort)
    check('enrollments', e.id, 'courseId', e.courseId, ids.course)
    check('enrollments', e.id, 'advisorUserId', e.advisorUserId, ids.user)
  }

  for (const i of invoices) {
    check('invoices', i.id, 'accountId', i.accountId, ids.account)
    check('invoices', i.id, 'personId', i.personId, ids.person)
    check('invoices', i.id, 'organisationId', i.organisationId, ids.clientOrg)
    check('invoices', i.id, 'admissionId', i.admissionId, ids.admission)
    check('invoices', i.id, 'unitId', i.unitId, ids.unit)
    const lineTotal = i.lines.reduce((acc, l) => acc + l.amount, 0)
    if (lineTotal !== i.subtotal - i.discountAmount && i.lines.length) {
      problems.push({ collection: 'invoices', recordId: i.id, field: 'lines', value: String(lineTotal), message: 'lines do not sum to subtotal − discount' })
    }
    if (i.balance !== i.total - i.paidAmount) {
      problems.push({ collection: 'invoices', recordId: i.id, field: 'balance', value: String(i.balance), message: 'balance ≠ total − paidAmount' })
    }
    for (const l of i.lines) check('invoices', i.id, 'lines.enrollmentId', l.enrollmentId, ids.enrollment)
  }

  for (const p of payments) {
    check('payments', p.id, 'personId', p.personId, ids.person)
    check('payments', p.id, 'organisationId', p.organisationId, ids.clientOrg)
    for (const alloc of p.allocations) check('payments', p.id, 'allocations.invoiceId', alloc.invoiceId, ids.invoice)
    const allocated = p.allocations.reduce((acc, a) => acc + a.amount, 0)
    if (p.status === 'matched' && allocated + p.unallocatedAmount !== p.amount) {
      problems.push({ collection: 'payments', recordId: p.id, field: 'allocations', value: String(allocated), message: 'allocations + unallocated ≠ amount' })
    }
  }

  for (const c of commissions) {
    check('commissions', c.id, 'beneficiaryPersonId', c.beneficiaryPersonId, ids.person)
    check('commissions', c.id, 'admissionId', c.admissionId, ids.admission)
    check('commissions', c.id, 'invoiceId', c.invoiceId, ids.invoice)
    check('commissions', c.id, 'ruleId', c.ruleId, ids.rule)
    check('commissions', c.id, 'courseId', c.courseId, ids.course)
    check('commissions', c.id, 'unitId', c.unitId, ids.unit)
    check('commissions', c.id, 'approvalRequestId', c.approvalRequestId, ids.approval)
    check('commissions', c.id, 'payoutBatchId', c.payoutBatchId, ids.payout)
    check('commissions', c.id, 'reversalOfCommissionId', c.reversalOfCommissionId, ids.commission)
    check('commissions', c.id, 'reversedByCommissionId', c.reversedByCommissionId, ids.commission)
    check('commissions', c.id, 'triggeringRefundId', c.triggeringRefundId, ids.refund)
    for (const pid of c.triggeringPaymentIds) check('commissions', c.id, 'triggeringPaymentIds', pid, ids.payment)
    const rule = commissionRules.find((r) => r.id === c.ruleId)
    if (rule && rule.version !== c.ruleVersion) {
      problems.push({ collection: 'commissions', recordId: c.id, field: 'ruleVersion', value: String(c.ruleVersion), message: 'ruleVersion does not match the referenced rule version' })
    }
  }

  /* Rule versions for one key must not overlap. */
  const byKey = new Map<string, CommissionRule[]>()
  for (const rule of commissionRules) {
    const list = byKey.get(rule.ruleKey) ?? []
    list.push(rule)
    byKey.set(rule.ruleKey, list)
  }
  for (const [key, versions] of byKey) {
    const sorted = [...versions].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      if (prev.effectiveTo === null || prev.effectiveTo >= sorted[i].effectiveFrom) {
        problems.push({ collection: 'commissionRules', recordId: sorted[i].id, field: 'effectiveFrom', value: sorted[i].effectiveFrom, message: `overlaps ${prev.id} for rule key ${key}` })
      }
    }
  }

  for (const a of approvalRequests) {
    check('approvalRequests', a.id, 'requesterUserId', a.requesterUserId, ids.user)
    check('approvalRequests', a.id, 'routeId', a.routeId, ids.route)
    check('approvalRequests', a.id, 'currentApproverUserId', a.currentApproverUserId, ids.user)
    for (const s of a.steps) check('approvalRequests', a.id, 'steps.approverUserId', s.approverUserId, ids.user)
  }

  for (const rf of refunds) {
    check('refunds', rf.id, 'invoiceId', rf.invoiceId, ids.invoice)
    check('refunds', rf.id, 'personId', rf.personId, ids.person)
    check('refunds', rf.id, 'approvalRequestId', rf.approvalRequestId, ids.approval)
    for (const cid of rf.affectedCommissionIds) check('refunds', rf.id, 'affectedCommissionIds', cid, ids.commission)
  }
  for (const cn of creditNotes) {
    check('creditNotes', cn.id, 'invoiceId', cn.invoiceId, ids.invoice)
    check('creditNotes', cn.id, 'approvalRequestId', cn.approvalRequestId, ids.approval)
  }
  for (const e of expenses) {
    check('expenses', e.id, 'unitId', e.unitId, ids.unit)
    check('expenses', e.id, 'requesterUserId', e.requesterUserId, ids.user)
    check('expenses', e.id, 'approvalRequestId', e.approvalRequestId, ids.approval)
  }

  for (const l of lessons) {
    check('lessons', l.id, 'moduleId', l.moduleId, ids.module)
    check('lessons', l.id, 'courseId', l.courseId, ids.course)
    check('lessons', l.id, 'assignmentId', l.assignmentId, ids.assignment)
    for (const assetRef of Object.values(l.formats)) check('lessons', l.id, 'formats', assetRef, ids.asset)
  }
  for (const s of submissions) {
    check('submissions', s.id, 'assignmentId', s.assignmentId, ids.assignment)
    check('submissions', s.id, 'enrollmentId', s.enrollmentId, ids.enrollment)
    check('submissions', s.id, 'personId', s.personId, ids.person)
    check('submissions', s.id, 'gradedByPersonId', s.gradedByPersonId, ids.person)
  }
  for (const c of certificates) {
    check('certificates', c.id, 'personId', c.personId, ids.person)
    check('certificates', c.id, 'enrollmentId', c.enrollmentId, ids.enrollment)
    check('certificates', c.id, 'courseId', c.courseId, ids.course)
    check('certificates', c.id, 'cohortId', c.cohortId, ids.cohort)
  }
  for (const p of progress) {
    check('progress', p.id, 'enrollmentId', p.enrollmentId, ids.enrollment)
    check('progress', p.id, 'personId', p.personId, ids.person)
  }
  for (const s of studentAttendance) {
    check('studentAttendance', s.id, 'sessionId', s.sessionId, ids.session)
    check('studentAttendance', s.id, 'enrollmentId', s.enrollmentId, ids.enrollment)
  }

  for (const e of employees) {
    check('employees', e.id, 'personId', e.personId, ids.person)
    check('employees', e.id, 'departmentId', e.departmentId, ids.dept)
    check('employees', e.id, 'unitId', e.unitId, ids.unit)
    check('employees', e.id, 'managerUserId', e.managerUserId, ids.user)
  }
  for (const a of attendanceEvents) {
    check('attendanceEvents', a.id, 'employeeId', a.employeeId, ids.employee)
    check('attendanceEvents', a.id, 'policyVersionId', a.policyVersionId, ids.policy)
    if (a.consequence !== 'none') {
      problems.push({ collection: 'attendanceEvents', recordId: a.id, field: 'consequence', value: a.consequence, message: 'attendance must have no financial consequence in the seed' })
    }
  }
  for (const i of payrollItems) {
    check('payrollItems', i.id, 'periodId', i.periodId, ids.period)
    check('payrollItems', i.id, 'employeeId', i.employeeId, ids.employee)
    for (const l of i.commissionLines) check('payrollItems', i.id, 'commissionLines.commissionId', l.commissionId, ids.commission)
    const gross = i.base + i.allowanceLines.reduce((a, l) => a + l.amount, 0) + i.commissionLines.reduce((a, l) => a + l.amount, 0) + i.bonusLines.reduce((a, l) => a + l.amount, 0)
    if (gross !== i.gross) {
      problems.push({ collection: 'payrollItems', recordId: i.id, field: 'gross', value: String(i.gross), message: 'gross ≠ base + allowances + commission + bonus' })
    }
    if (i.net !== i.gross - i.deductions) {
      problems.push({ collection: 'payrollItems', recordId: i.id, field: 'net', value: String(i.net), message: 'net ≠ gross − deductions' })
    }
  }

  for (const run of automationRuns) check('automationRuns', run.id, 'automationId', run.automationId, ids.automation)
  for (const ex of automationExceptions) {
    check('automationExceptions', ex.id, 'runId', ex.runId, ids.run)
    check('automationExceptions', ex.id, 'automationId', ex.automationId, ids.automation)
  }
  for (const c of campaigns) {
    check('campaigns', c.id, 'segmentId', c.segmentId, ids.segment)
    check('campaigns', c.id, 'templateId', c.templateId, ids.msgTemplate)
  }
  for (const m of messages) check('messages', m.id, 'personId', m.personId, ids.person)
  for (const n of notifications) check('notifications', n.id, 'userId', n.userId, ids.user)

  for (const c of cards) {
    check('cards', c.id, 'personId', c.personId, ids.person)
    check('cards', c.id, 'replacesCardId', c.replacesCardId, ids.card)
    check('cards', c.id, 'replacedByCardId', c.replacedByCardId, ids.card)
  }
  for (const t of tapEvents) {
    check('tapEvents', t.id, 'cardId', t.cardId, ids.card)
    check('tapEvents', t.id, 'readerId', t.readerId, ids.reader)
  }
  for (const o of outcomeRecords) {
    check('outcomeRecords', o.id, 'personId', o.personId, ids.person)
    check('outcomeRecords', o.id, 'certificateId', o.certificateId, ids.certificate)
    check('outcomeRecords', o.id, 'employerId', o.employerId, ids.employer)
  }
  for (const t of tickets) check('tickets', t.id, 'requesterPersonId', t.requesterPersonId, ids.person)
  for (const d of corporateDeals) check('corporateDeals', d.id, 'organisationId', d.organisationId, ids.clientOrg)
  for (const ai of actionItems) check('actionItems', ai.id, 'meetingId', ai.meetingId, ids.meeting)
  for (const c of candidates) {
    check('candidates', c.id, 'personId', c.personId, ids.person)
    check('candidates', c.id, 'openingId', c.openingId, ids.opening)
  }
  for (const iv of interviews) check('interviews', iv.id, 'candidateId', iv.candidateId, ids.candidate)
  for (const sc of scorecards) check('scorecards', sc.id, 'interviewId', sc.interviewId, ids.interview)
  for (const o of offers) {
    check('offers', o.id, 'candidateId', o.candidateId, ids.candidate)
    check('offers', o.id, 'personId', o.personId, ids.person)
  }

  return problems
}

/** Total rows in the seed — handy for the demo panel and for sanity checks. */
export function seedSummary(): Record<string, number> {
  return {
    people: people.length,
    users: users.length,
    leads: leads.length,
    admissions: admissions.length,
    enrollments: enrollments.length,
    invoices: invoices.length,
    payments: payments.length,
    commissions: commissions.length,
    commissionRules: commissionRules.length,
    courses: courses.length,
    cohorts: cohorts.length,
    lessons: lessons.length,
    contentAssets: contentAssets.length,
    submissions: submissions.length,
    certificates: certificates.length,
    employees: employees.length,
    approvalRequests: approvalRequests.length,
    automations: automations.length,
    automationRuns: automationRuns.length,
    auditEvents: auditEvents.length,
  }
}

if (typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) {
  const problems = validateSeed()
  if (problems.length) {
    // eslint-disable-next-line no-console
    console.warn(
      `[cirvee-os] validateSeed found ${problems.length} dangling reference${problems.length === 1 ? '' : 's'}:`,
      problems.slice(0, 40),
    )
  }
}

/* -------------------------------------------------------------------------- */
/* Demo controls                                                              */
/* -------------------------------------------------------------------------- */

let clockOffsetDays = 0
let latencyMs = 0
const forcedErrors = new Set<string>()
const forcedEmpty = new Set<string>()

export const demo = {
  /** Wipes persisted state and reloads, back to this exact seed. */
  reset(): void {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith('cirvee-os:'))
        .forEach((k) => sessionStorage.removeItem(k))
      window.location.reload()
    } catch {
      /* ignore */
    }
  },
  /** Moves the effective clock forward, so ageing, overdue and SLA states move. */
  advanceClock(days: 30 | 60 | 90): void {
    clockOffsetDays += days
  },
  clockOffsetDays: () => clockOffsetDays,
  /** The date the app should treat as today, once the demo clock has moved. */
  effectiveToday(): string {
    return new Date(Date.parse(`${TODAY}T00:00:00Z`) + clockOffsetDays * 86_400_000).toISOString().slice(0, 10)
  },
  forceError(scope: string): void {
    forcedErrors.add(scope)
  },
  clearError(scope: string): void {
    forcedErrors.delete(scope)
  },
  isErrored: (scope: string) => forcedErrors.has(scope),
  forceEmpty(module: string): void {
    forcedEmpty.add(module)
  },
  clearEmpty(module: string): void {
    forcedEmpty.delete(module)
  },
  isEmpty: (module: string) => forcedEmpty.has(module),
  setLatency(ms: number): void {
    latencyMs = ms
  },
  latency: () => latencyMs,
} as const

export { ruleInForce, computeCommission, buildSteps }
