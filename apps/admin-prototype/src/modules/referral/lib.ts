/**
 * Referral & commission — shared vocabulary, rule drafting and simulation.
 *
 * Three rules govern this file:
 *
 *  1. **The calculation engine is not reimplemented here.** `computeCommission`
 *     comes from the store and is the single place commission money is worked
 *     out. `simulateRule()` below only wraps it with the applicability and
 *     eligibility *narration* the builder's simulator needs, because
 *     `evaluateCommissionRules()` can only see rules that already exist in the
 *     collection — and the whole point of the builder is a rule that does not
 *     exist yet. Every naira the simulator prints came out of
 *     `computeCommission`.
 *  2. **No rate, threshold or grace period is typed into a component.** Rules
 *     are data; this file only reads and drafts them.
 *  3. **Nothing is hard-deleted.** A new version end-dates its predecessor.
 */

import {
  TODAY,
  addDays,
  admissionsCollection,
  branchesCollection,
  commissionRulesCollection,
  commissionsCollection,
  computeCommission,
  coursesCollection,
  invoicesCollection,
  payrollPeriodsCollection,
  peopleCollection,
  referrerProfilesCollection,
  rolesCollection,
  unitsCollection,
  usersCollection,
} from '@/mocks'
import { campaignId as asCampaignId, courseId as asCourseId, ruleId as asRuleId } from '@/mocks/types'
import type {
  Admission,
  BranchId,
  Commission,
  CommissionBasis,
  CommissionRule,
  CommissionRoleOnDeal,
  CommissionState,
  Kobo,
  PersonId,
  ReferrerType,
  RoleId,
  UnitId,
  UserId,
} from '@/mocks/types'
import type { BadgeTone } from '@/ui'
import type { BusinessUnit } from '@/app/module-registry'
import { BUSINESS_UNITS } from '@/ui'
import { formatDate, formatNaira } from '@/lib/format'

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

export const ROLE_ON_DEAL: CommissionRoleOnDeal[] = ['referrer', 'lead_owner', 'closer']

export const ROLE_LABEL: Record<CommissionRoleOnDeal, string> = {
  referrer: 'Referrer',
  lead_owner: 'Lead owner',
  closer: 'Closer',
}

/**
 * The three roles carry a distinct tone each, per §3.6 — the independence is
 * meant to be visible at a glance in a dense ledger.
 */
export const ROLE_TONE: Record<CommissionRoleOnDeal, BadgeTone> = {
  referrer: 'accent',
  lead_owner: 'info',
  closer: 'success',
}

export const ROLE_HELP =
  'These are independent. A rule that pays the closer does not pay the referrer. Create a second rule for that.'

export const COMMISSION_STATES: CommissionState[] = [
  'tracked',
  'pending',
  'earned',
  'approved',
  'payable',
  'paid',
  'disputed',
  'reversed',
  'cancelled',
]

/** The main line of the funnel; the rest are the side branch. */
export const FUNNEL_STATES: CommissionState[] = ['tracked', 'pending', 'earned', 'approved', 'payable', 'paid']
export const SIDE_STATES: CommissionState[] = ['disputed', 'reversed', 'cancelled']

export const STATE_LABEL: Record<CommissionState, string> = {
  tracked: 'Tracked',
  pending: 'Pending',
  earned: 'Earned',
  approved: 'Approved',
  payable: 'Payable',
  paid: 'Paid',
  disputed: 'Disputed',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
}

export const STATE_TONE: Record<CommissionState, BadgeTone> = {
  tracked: 'neutral',
  pending: 'warning',
  earned: 'info',
  approved: 'success',
  payable: 'success',
  paid: 'accent',
  disputed: 'warning',
  reversed: 'danger',
  cancelled: 'danger',
}

export const BASIS_OPTIONS: CommissionBasis[] = ['gross_fee', 'net_after_discount', 'amount_collected']

export const BASIS_LABEL: Record<CommissionBasis, string> = {
  gross_fee: 'Gross fee',
  net_after_discount: 'Net after discount',
  amount_collected: 'Amount actually collected',
}

export const BASIS_HELP: Record<CommissionBasis, string> = {
  gross_fee: 'The fee before any discount. Pays on what was quoted, not on what came in.',
  net_after_discount: 'The fee after discount. Pays on what is owed, whether or not it has been received.',
  amount_collected: 'Only money actually received. Nothing is earned on an unpaid invoice.',
}

export const BENEFICIARY_TYPES: Array<ReferrerType | 'staff'> = [
  'staff',
  'student',
  'alumnus',
  'parent',
  'employee',
  'tutor',
  'influencer',
  'partner',
  'external_agent',
  'corporate_partner',
]

export const BENEFICIARY_LABEL: Record<ReferrerType | 'staff', string> = {
  staff: 'Staff',
  student: 'Student',
  alumnus: 'Alumnus',
  parent: 'Parent',
  employee: 'Employee',
  tutor: 'Tutor',
  influencer: 'Influencer',
  partner: 'Partner',
  external_agent: 'External agent',
  corporate_partner: 'Corporate partner',
}

export type CalculationKind = CommissionRule['calculation']['kind']

export const CALCULATION_KINDS: CalculationKind[] = [
  'percentage',
  'fixed',
  'tiered',
  'course_specific',
  'campaign_specific',
]

export const CALCULATION_LABEL: Record<CalculationKind, string> = {
  percentage: 'Percentage',
  fixed: 'Fixed',
  tiered: 'Tiered',
  course_specific: 'Course-specific',
  campaign_specific: 'Campaign-specific',
}

export type PayoutSchedule = CommissionRule['payoutSchedule']

export const PAYOUT_SCHEDULES: PayoutSchedule[] = ['per_payroll', 'weekly', 'monthly', 'on_approval']

export const SCHEDULE_LABEL: Record<PayoutSchedule, string> = {
  per_payroll: 'Per payroll run',
  weekly: 'Weekly',
  monthly: 'Monthly',
  on_approval: 'On approval',
}

export type OnRefund = CommissionRule['reversal']['onRefund']
export type IfAlreadyPaid = CommissionRule['reversal']['ifAlreadyPaid']

export const ON_REFUND_LABEL: Record<OnRefund, string> = {
  full: 'Full reversal on refund or chargeback',
  proportional: 'Proportional to the amount refunded',
  none: 'No reversal',
}

export const IF_PAID_LABEL: Record<IfAlreadyPaid, string> = {
  create_receivable: 'Create a receivable against the beneficiary',
  deduct_next_payout: 'Deduct from the next payout',
  write_off_with_approval: 'Write off with approval',
}

export const RULE_STATUS_LABEL: Record<CommissionRule['status'], string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  superseded: 'Superseded',
}

export const RULE_STATUS_TONE: Record<CommissionRule['status'], BadgeTone> = {
  draft: 'neutral',
  scheduled: 'info',
  active: 'success',
  superseded: 'neutral',
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export function personName(id: PersonId | null | undefined): string {
  if (!id) return 'Unassigned'
  const p = peopleCollection.find(id)
  return p ? `${p.firstName} ${p.lastName}` : id
}

export function personInitials(id: PersonId | null | undefined): string {
  if (!id) return '—'
  return peopleCollection.find(id)?.avatarInitials ?? '—'
}

export function userName(id: UserId | null | undefined): string {
  if (!id) return 'Unassigned'
  const u = usersCollection.find(id)
  return u ? personName(u.personId) : id
}

export function userPersonId(id: UserId | null | undefined): PersonId | null {
  if (!id) return null
  return usersCollection.find(id)?.personId ?? null
}

export function roleName(id: RoleId | null | undefined): string {
  if (!id) return 'No approver role'
  return rolesCollection.find(id)?.name ?? id
}

export function courseTitle(id: string | null | undefined): string {
  if (!id) return '—'
  return coursesCollection.find(id)?.title ?? id
}

export function unitName(id: UnitId | null | undefined): string {
  if (!id) return '—'
  return unitsCollection.find(id)?.name ?? id
}

export function branchName(id: BranchId | null | undefined): string {
  if (!id) return '—'
  return branchesCollection.find(id)?.name ?? id
}

/** `unit-academy` → `academy`, the key `UnitTag` wants. */
export function unitKey(id: UnitId | null | undefined): BusinessUnit | null {
  if (!id) return null
  const stem = id.replace(/^unit-/, '') as BusinessUnit
  return BUSINESS_UNITS.includes(stem) ? stem : null
}

/** `cr-004-v3` → `CR-004`. The reference staff say out loud. */
export function ruleCode(rule: Pick<CommissionRule, 'id'>): string {
  const stem = rule.id.split('-v')[0]
  return stem.toUpperCase()
}

export function ruleLabel(rule: Pick<CommissionRule, 'id' | 'name' | 'version'>): string {
  return `${rule.name} v${rule.version}`
}

export function findRule(id: string | null | undefined): CommissionRule | undefined {
  return id ? commissionRulesCollection.find(id) : undefined
}

/** Every version of one rule key, oldest first. Nothing is ever removed. */
export function versionsOf(ruleKey: string): CommissionRule[] {
  return commissionRulesCollection
    .where((r) => r.ruleKey === ruleKey)
    .slice()
    .sort((a, b) => a.version - b.version)
}

export function latestVersionOf(ruleKey: string): CommissionRule | undefined {
  return versionsOf(ruleKey).at(-1)
}

export function effectiveRange(rule: Pick<CommissionRule, 'effectiveFrom' | 'effectiveTo'>): string {
  const from = formatDate(rule.effectiveFrom)
  return rule.effectiveTo ? `${from} – ${formatDate(rule.effectiveTo)}` : `${from} – open`
}

/* -------------------------------------------------------------------------- */
/* Plain-English rendering                                                    */
/* -------------------------------------------------------------------------- */

export function tierSummary(tiers: TierDraft[]): string {
  if (!tiers.length) return 'No bands yet'
  return tiers
    .map((t) => {
      const from = formatNaira(t.fromAmount, { compact: true })
      const to = t.toAmount === null ? '+' : `–${formatNaira(t.toAmount, { compact: true })}`
      return `${from}${to} → ${t.rate}%`
    })
    .join(' · ')
}

export function calculationSentence(draft: RuleDraft): string {
  switch (draft.calcKind) {
    case 'percentage':
      return `${draft.percentageRate}% of the ${BASIS_LABEL[draft.basis].toLowerCase()}`
    case 'fixed':
      return `a flat ${formatNaira(draft.fixedAmount ?? 0)}`
    case 'tiered':
      return `a tiered rate on the ${BASIS_LABEL[draft.basis].toLowerCase()} (${tierSummary(draft.tiers)})`
    case 'course_specific':
      return `a per-course rate on the ${BASIS_LABEL[draft.basis].toLowerCase()}, ${draft.courseFallback}% for any other course`
    case 'campaign_specific':
      return `a per-campaign rate on the ${BASIS_LABEL[draft.basis].toLowerCase()}, ${draft.campaignFallback}% for any other campaign`
  }
}

/** The calculation column of §3.4, rendered from data rather than stored prose. */
export function ruleCalculationSentence(rule: CommissionRule): string {
  return calculationSentence(draftFromRule(rule))
}

function eligibilityClause(draft: RuleDraft): string {
  const holds: string[] = []
  if (draft.requiresFullPayment) holds.push('the invoice is fully paid')
  else if (draft.minimumPercentPaid !== null) holds.push(`${draft.minimumPercentPaid}% of the invoice is paid`)
  if (draft.paymentAgedDays !== null) holds.push(`the payment has settled for ${draft.paymentAgedDays} days`)
  if (!holds.length) return 'earned as soon as the admission is created'
  return `held as ${draft.stateBeforeEligible === 'tracked' ? 'Tracked' : 'Pending'} until ${holds.join(' and ')}`
}

/**
 * The sentence the right pane regenerates on every keystroke. Section 3.5's
 * "prove commission is configuration, not code" lives or dies on this reading
 * like something a founder would say out loud.
 */
export function ruleSentence(draft: RuleDraft): string {
  const role = draft.roleOnDeal ? ROLE_LABEL[draft.roleOnDeal].toLowerCase() : 'nobody — pick a role on the deal'
  const who = `the ${role}`
  const kind = BENEFICIARY_LABEL[draft.beneficiaryType].toLowerCase()
  const scope = draft.unitIds.length
    ? `on ${draft.unitIds.map((u) => unitName(u)).join(' and ')} admissions`
    : 'on admissions in every unit'
  const branch = draft.branchIds.length
    ? ` at ${draft.branchIds.map((b) => branchName(b)).join(' and ')}`
    : ''
  const approval = draft.approvalRequired
    ? `, approved by ${roleName(draft.approverRoleId)} before it becomes payable`
    : ', payable without a separate approval'
  const schedule = `, paid ${SCHEDULE_LABEL[draft.payoutSchedule].toLowerCase()}`
  const dates = draft.effectiveTo
    ? `In force ${formatDate(draft.effectiveFrom)} to ${formatDate(draft.effectiveTo)}.`
    : `In force from ${formatDate(draft.effectiveFrom)}, until a later version supersedes it.`
  const reversal = `On a refund: ${ON_REFUND_LABEL[draft.onRefund].toLowerCase()}; if it has already been paid out, ${IF_PAID_LABEL[draft.ifAlreadyPaid].toLowerCase()}.`

  return (
    `Pay ${who} — who must be ${article(kind)} ${kind} — ${calculationSentence(draft)} ${scope}${branch}, ` +
    `${eligibilityClause(draft)}${approval}${schedule}. ${dates} ${reversal}`
  )
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a'
}

/* -------------------------------------------------------------------------- */
/* The draft a builder edits                                                  */
/* -------------------------------------------------------------------------- */

export interface TierDraft {
  fromAmount: Kobo
  toAmount: Kobo | null
  rate: number
}

export interface RuleDraft {
  /** The version being superseded, or null for a brand-new rule key. */
  supersedesVersionId: string | null
  ruleKey: string
  version: number
  name: string
  description: string
  unitIds: UnitId[]
  branchIds: BranchId[]
  beneficiaryType: ReferrerType | 'staff'
  /** Required, and deliberately null until the user chooses. */
  roleOnDeal: CommissionRoleOnDeal | null
  calcKind: CalculationKind
  percentageRate: number
  fixedAmount: Kobo | null
  tiers: TierDraft[]
  courseRates: Array<{ courseId: string; rate: number }>
  courseFallback: number
  campaignRates: Array<{ campaignId: string; rate: number }>
  campaignFallback: number
  basis: CommissionBasis
  requiresFullPayment: boolean
  minimumPercentPaid: number | null
  paymentAgedDays: number | null
  requiresManualApproval: boolean
  stateBeforeEligible: 'pending' | 'tracked'
  onRefund: OnRefund
  ifAlreadyPaid: IfAlreadyPaid
  effectiveFrom: string
  effectiveTo: string | null
  payoutSchedule: PayoutSchedule
  approvalRequired: boolean
  approverRoleId: RoleId | null
}

const k = (n: number): Kobo => n as Kobo

export function blankDraft(): RuleDraft {
  return {
    supersedesVersionId: null,
    ruleKey: '',
    version: 1,
    name: '',
    description: '',
    unitIds: [],
    branchIds: [],
    beneficiaryType: 'alumnus',
    roleOnDeal: null,
    calcKind: 'percentage',
    percentageRate: 10,
    fixedAmount: k(1_500_000),
    tiers: [
      { fromAmount: k(0), toAmount: k(30_000_000), rate: 8 },
      { fromAmount: k(30_000_000), toAmount: k(60_000_000), rate: 10 },
      { fromAmount: k(60_000_000), toAmount: null, rate: 12 },
    ],
    courseRates: [],
    courseFallback: 6,
    campaignRates: [],
    campaignFallback: 6,
    basis: 'amount_collected',
    requiresFullPayment: true,
    minimumPercentPaid: null,
    paymentAgedDays: null,
    requiresManualApproval: false,
    stateBeforeEligible: 'pending',
    onRefund: 'proportional',
    ifAlreadyPaid: 'deduct_next_payout',
    effectiveFrom: TODAY,
    effectiveTo: null,
    payoutSchedule: 'monthly',
    approvalRequired: true,
    approverRoleId: null,
  }
}

export function draftFromRule(rule: CommissionRule): RuleDraft {
  const calc = rule.calculation
  return {
    supersedesVersionId: rule.supersedesVersionId,
    ruleKey: rule.ruleKey,
    version: rule.version,
    name: rule.name,
    description: rule.description,
    unitIds: [...rule.unitIds],
    branchIds: [...rule.branchIds],
    beneficiaryType: rule.beneficiaryType,
    roleOnDeal: rule.roleOnDeal,
    calcKind: calc.kind,
    percentageRate: calc.kind === 'percentage' ? calc.rate : 10,
    fixedAmount: calc.kind === 'fixed' ? calc.amount : k(1_500_000),
    tiers:
      calc.kind === 'tiered'
        ? calc.tiers.map((t) => ({ fromAmount: t.fromAmount, toAmount: t.toAmount, rate: t.rate }))
        : blankDraft().tiers,
    courseRates: calc.kind === 'course_specific' ? calc.rates.map((r) => ({ courseId: r.courseId, rate: r.rate })) : [],
    courseFallback: calc.kind === 'course_specific' ? calc.fallbackRate : 6,
    campaignRates:
      calc.kind === 'campaign_specific' ? calc.rates.map((r) => ({ campaignId: r.campaignId, rate: r.rate })) : [],
    campaignFallback: calc.kind === 'campaign_specific' ? calc.fallbackRate : 6,
    basis: rule.basis,
    requiresFullPayment: rule.eligibility.requiresFullPayment,
    minimumPercentPaid: rule.eligibility.minimumPercentPaid,
    paymentAgedDays: rule.eligibility.paymentAgedDays,
    requiresManualApproval: rule.eligibility.requiresManualApproval,
    stateBeforeEligible: rule.eligibility.stateBeforeEligible,
    onRefund: rule.reversal.onRefund,
    ifAlreadyPaid: rule.reversal.ifAlreadyPaid,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    payoutSchedule: rule.payoutSchedule,
    approvalRequired: rule.approvalRequired,
    approverRoleId: rule.approverRoleId,
  }
}

/**
 * Pre-fill the builder as the *next* version of an existing rule. The edit is
 * refused; this is what is offered instead. Nothing about `rule` is mutated.
 */
export function nextVersionDraft(rule: CommissionRule, effectiveFrom: string): RuleDraft {
  return {
    ...draftFromRule(rule),
    supersedesVersionId: rule.id,
    version: rule.version + 1,
    effectiveFrom,
    effectiveTo: null,
  }
}

export function duplicateDraft(rule: CommissionRule, ruleKey: string): RuleDraft {
  return {
    ...draftFromRule(rule),
    supersedesVersionId: null,
    ruleKey,
    version: 1,
    name: `${rule.name} (copy)`,
    effectiveFrom: TODAY,
    effectiveTo: null,
  }
}

function calculationFrom(draft: RuleDraft): CommissionRule['calculation'] {
  switch (draft.calcKind) {
    case 'percentage':
      return { kind: 'percentage', rate: draft.percentageRate }
    case 'fixed':
      return { kind: 'fixed', amount: draft.fixedAmount ?? k(0) }
    case 'tiered':
      return { kind: 'tiered', tiers: draft.tiers.map((t) => ({ ...t })) }
    case 'course_specific':
      return {
        kind: 'course_specific',
        rates: draft.courseRates.map((r) => ({ courseId: asCourseId(r.courseId), rate: r.rate })),
        fallbackRate: draft.courseFallback,
      }
    case 'campaign_specific':
      return {
        kind: 'campaign_specific',
        rates: draft.campaignRates.map((r) => ({ campaignId: asCampaignId(r.campaignId), rate: r.rate })),
        fallbackRate: draft.campaignFallback,
      }
  }
}

/**
 * The candidate rule object. Built in memory only — it is what the simulator
 * and the back-test run against, and it is what `Activate` inserts.
 */
export function candidateRule(draft: RuleDraft, opts: { id: string; status: CommissionRule['status']; actor: UserId; now: string }): CommissionRule {
  return {
    id: asRuleId(opts.id),
    ruleKey: draft.ruleKey,
    version: draft.version,
    name: draft.name,
    description: draft.description,
    status: opts.status,
    unitIds: [...draft.unitIds],
    branchIds: [...draft.branchIds],
    beneficiaryType: draft.beneficiaryType,
    roleOnDeal: draft.roleOnDeal ?? 'referrer',
    calculation: calculationFrom(draft),
    basis: draft.basis,
    eligibility: {
      requiresFullPayment: draft.requiresFullPayment,
      minimumPercentPaid: draft.minimumPercentPaid,
      paymentAgedDays: draft.paymentAgedDays,
      requiresManualApproval: draft.requiresManualApproval,
      stateBeforeEligible: draft.stateBeforeEligible,
    },
    reversal: { onRefund: draft.onRefund, ifAlreadyPaid: draft.ifAlreadyPaid },
    effectiveFrom: draft.effectiveFrom,
    effectiveTo: draft.effectiveTo,
    payoutSchedule: draft.payoutSchedule,
    approvalRequired: draft.approvalRequired,
    approverRoleId: draft.approverRoleId,
    supersedesVersionId: draft.supersedesVersionId ? asRuleId(draft.supersedesVersionId) : null,
    commissionCount: 0,
    commissionTotal: k(0),
    createdAt: opts.now,
    createdBy: opts.actor,
    updatedAt: opts.now,
    updatedBy: opts.actor,
  }
}

/** `cr-004-v3` → `cr-004-v4`. A new key gets the next free `cr-0NN-v1`. */
export function nextRuleId(draft: RuleDraft): string {
  if (draft.supersedesVersionId) {
    const stem = draft.supersedesVersionId.split('-v')[0]
    return `${stem}-v${draft.version}`
  }
  const existing = commissionRulesCollection.all().map((r) => Number(r.id.split('-')[1] ?? 0))
  const next = Math.max(0, ...existing) + 1
  return `cr-${String(next).padStart(3, '0')}-v${draft.version}`
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface TierProblem {
  index: number
  message: string
}

/**
 * Bands must start at zero, be ordered, and hand straight over to the next one.
 * A gap or an overlap in a commission band table is a silent underpayment or a
 * double payment, so it blocks.
 */
export function validateTiers(tiers: TierDraft[]): TierProblem[] {
  const problems: TierProblem[] = []
  if (!tiers.length) {
    problems.push({ index: -1, message: 'A tiered rule needs at least one band.' })
    return problems
  }
  if (tiers[0].fromAmount !== 0) {
    problems.push({ index: 0, message: 'The first band must start at ₦0, or amounts below it earn nothing.' })
  }
  tiers.forEach((tier, i) => {
    if (tier.rate < 0 || tier.rate > 100) {
      problems.push({ index: i, message: 'Rate must be between 0% and 100%.' })
    }
    if (tier.toAmount !== null && tier.toAmount <= tier.fromAmount) {
      problems.push({ index: i, message: 'This band ends before it starts.' })
    }
    if (tier.toAmount === null && i !== tiers.length - 1) {
      problems.push({ index: i, message: 'Only the last band can be open-ended.' })
    }
    if (i > 0) {
      const previous = tiers[i - 1]
      if (previous.toAmount === null) return
      if (tier.fromAmount > previous.toAmount) {
        problems.push({
          index: i,
          message: `Gap: nothing covers ${formatNaira(previous.toAmount)} to ${formatNaira(tier.fromAmount)}.`,
        })
      } else if (tier.fromAmount < previous.toAmount) {
        problems.push({
          index: i,
          message: `Overlap: ${formatNaira(tier.fromAmount)} to ${formatNaira(previous.toAmount)} is covered twice.`,
        })
      }
    }
  })
  return problems
}

/** Not blocking — a closed top band is legal, just usually a mistake. */
export function tierWarning(tiers: TierDraft[]): string | null {
  if (!tiers.length) return null
  return tiers[tiers.length - 1].toAmount === null
    ? null
    : 'The top band is closed. Any basis amount above it earns nothing.'
}

export type SectionKey = 'identity' | 'beneficiary' | 'calculation' | 'basis' | 'eligibility' | 'reversal' | 'dating'

export interface DraftProblems {
  fields: Partial<Record<string, string>>
  sections: SectionKey[]
}

/**
 * The last closed payroll period is a hard floor on effective-from: a rule
 * cannot start paying inside a period that has already been signed off.
 */
export function payrollFloor(): { label: string; firstAllowed: string } | null {
  const closed = payrollPeriodsCollection
    .where((p) => p.status === 'closed')
    .slice()
    .sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month))
  const last = closed.at(-1)
  if (!last) return null
  const nextMonth = last.month === 12 ? 1 : last.month + 1
  const nextYear = last.month === 12 ? last.year + 1 : last.year
  return { label: last.label, firstAllowed: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01` }
}

export function validateDraft(draft: RuleDraft): DraftProblems {
  const fields: Partial<Record<string, string>> = {}
  const sections = new Set<SectionKey>()

  if (!draft.name.trim()) {
    fields.name = 'Give the rule a name people will recognise on a commission row.'
    sections.add('identity')
  }
  if (!draft.ruleKey.trim()) {
    fields.ruleKey = 'A rule key is required. It stays the same across every version.'
    sections.add('identity')
  }
  if (!draft.roleOnDeal) {
    fields.roleOnDeal = 'Choose which of the three fields this rule pays. Nothing is calculated without it.'
    sections.add('beneficiary')
  }
  if (draft.calcKind === 'percentage' && (draft.percentageRate <= 0 || draft.percentageRate > 100)) {
    fields.percentageRate = 'Rate must be above 0% and at most 100%.'
    sections.add('calculation')
  }
  if (draft.calcKind === 'fixed' && (draft.fixedAmount === null || draft.fixedAmount <= 0)) {
    fields.fixedAmount = 'Enter the amount this rule pays.'
    sections.add('calculation')
  }
  if (draft.calcKind === 'tiered') {
    const problems = validateTiers(draft.tiers)
    if (problems.length) {
      fields.tiers = problems[0].message
      sections.add('calculation')
    }
  }
  if (draft.calcKind === 'course_specific' && !draft.courseRates.length) {
    fields.courseRates = 'Add at least one course rate, or use a flat percentage instead.'
    sections.add('calculation')
  }
  if (draft.calcKind === 'campaign_specific' && !draft.campaignRates.length) {
    fields.campaignRates = 'Add at least one campaign rate, or use a flat percentage instead.'
    sections.add('calculation')
  }
  if (!draft.requiresFullPayment && draft.minimumPercentPaid !== null) {
    if (draft.minimumPercentPaid <= 0 || draft.minimumPercentPaid > 100) {
      fields.minimumPercentPaid = 'Minimum paid must be between 1% and 100%.'
      sections.add('eligibility')
    }
  }
  if (draft.paymentAgedDays !== null && draft.paymentAgedDays < 0) {
    fields.paymentAgedDays = 'Ageing cannot be negative.'
    sections.add('eligibility')
  }
  if (!draft.effectiveFrom) {
    fields.effectiveFrom = 'Effective from is required. A rule with no start date never takes effect.'
    sections.add('dating')
  } else {
    const floor = payrollFloor()
    if (floor && draft.effectiveFrom < floor.firstAllowed) {
      fields.effectiveFrom = `Cannot take effect before the last closed payroll period (${floor.label}). The earliest allowed date is ${formatDate(floor.firstAllowed)}.`
      sections.add('dating')
    }
  }
  if (draft.effectiveTo && draft.effectiveFrom && draft.effectiveTo < draft.effectiveFrom) {
    fields.effectiveTo = 'Effective to cannot be before effective from.'
    sections.add('dating')
  }
  if (draft.approvalRequired && !draft.approverRoleId) {
    fields.approverRoleId = 'Pick the role that approves commissions under this rule.'
    sections.add('dating')
  }

  return { fields, sections: [...sections] }
}

/* -------------------------------------------------------------------------- */
/* Simulation                                                                 */
/* -------------------------------------------------------------------------- */

export interface BasisComparisonRow {
  basis: CommissionBasis
  amount: Kobo
  commission: Kobo
  selected: boolean
}

/**
 * §4's worked example. Renders the same three lines for whatever numbers the
 * simulator is pointed at, so the founder sees the difference between "what we
 * quoted", "what they owe" and "what we have" in naira, live.
 */
export function basisComparison(
  draft: RuleDraft,
  amounts: { grossFee: Kobo; netAfterDiscount: Kobo; amountCollected: Kobo },
  actor: UserId,
): BasisComparisonRow[] {
  return BASIS_OPTIONS.map((basis) => {
    const probe = candidateRule({ ...draft, basis }, { id: 'sim', status: 'draft', actor, now: TODAY })
    const workings = computeCommission(probe, amounts)
    return {
      basis,
      amount: workings.basisAmount,
      commission: workings.amount,
      selected: basis === draft.basis,
    }
  })
}

export interface SimulationResult {
  applies: boolean
  /** Why it does or does not apply, in the founder's language. */
  reasons: string[]
  beneficiaryPersonId: PersonId | null
  beneficiaryName: string
  basisAmount: Kobo
  rateApplied: number | null
  tierLabel: string | null
  amount: Kobo
  workings: string
  state: CommissionState
  eligibilityOutstanding: string | null
  paidPercent: number
}

export interface SimulationAmounts {
  grossFee: Kobo
  netAfterDiscount: Kobo
  amountCollected: Kobo
  invoiceTotal: Kobo
}

/**
 * The simulator's verdict for a rule that does not exist yet.
 *
 * The money comes from `computeCommission` — the store's engine, unmodified.
 * What is added here is the narration: which of the three fields this rule
 * targets, whether that field is filled on this admission, and which
 * eligibility condition is still outstanding.
 */
export function simulateRule(
  rule: CommissionRule,
  admission: Admission | null,
  amounts: SimulationAmounts,
  beneficiaryPersonId: PersonId | null,
): SimulationResult {
  const reasons: string[] = []
  let applies = true

  if (admission) {
    if (rule.unitIds.length && !rule.unitIds.includes(admission.unitId)) {
      applies = false
      reasons.push(`The rule is limited to ${rule.unitIds.map(unitName).join(', ')}; this admission is ${unitName(admission.unitId)}.`)
    } else if (rule.unitIds.length) {
      reasons.push(`Unit matches: ${unitName(admission.unitId)}.`)
    } else {
      reasons.push('The rule applies to every unit.')
    }

    if (rule.branchIds.length && !rule.branchIds.includes(admission.branchId)) {
      applies = false
      reasons.push(`The rule is limited to ${rule.branchIds.map(branchName).join(', ')}; this admission is ${branchName(admission.branchId)}.`)
    }
  }

  if (!beneficiaryPersonId) {
    applies = false
    reasons.push(`This rule pays the ${ROLE_LABEL[rule.roleOnDeal].toLowerCase()}, and this admission has no ${ROLE_LABEL[rule.roleOnDeal].toLowerCase()} recorded.`)
  } else {
    reasons.push(`${ROLE_LABEL[rule.roleOnDeal]} on this admission is ${personName(beneficiaryPersonId)}.`)
    if (rule.roleOnDeal === 'referrer') {
      const profile = referrerProfilesCollection.all().find((p) => p.personId === beneficiaryPersonId)
      if (!profile) {
        applies = false
        reasons.push(`${personName(beneficiaryPersonId)} has no referrer profile, so no referrer rule can pay them.`)
      } else if (rule.beneficiaryType !== 'staff' && profile.type !== rule.beneficiaryType) {
        applies = false
        reasons.push(
          `The rule pays ${BENEFICIARY_LABEL[rule.beneficiaryType].toLowerCase()} referrers; ${personName(beneficiaryPersonId)} is registered as ${BENEFICIARY_LABEL[profile.type].toLowerCase()}.`,
        )
      } else if (profile.status !== 'active') {
        applies = false
        reasons.push(`${personName(beneficiaryPersonId)}'s referrer profile is ${profile.status}.`)
      } else {
        reasons.push(`Beneficiary type matches: ${BENEFICIARY_LABEL[profile.type].toLowerCase()}.`)
      }
    }
  }

  const workings = computeCommission(rule, {
    grossFee: amounts.grossFee,
    netAfterDiscount: amounts.netAfterDiscount,
    amountCollected: amounts.amountCollected,
  })

  const paidPercent = amounts.invoiceTotal > 0 ? Math.round((amounts.amountCollected / amounts.invoiceTotal) * 100) : 0
  const fullyPaid = amounts.invoiceTotal > 0 && amounts.amountCollected >= amounts.invoiceTotal
  const meetsMinimum = rule.eligibility.minimumPercentPaid === null || paidPercent >= rule.eligibility.minimumPercentPaid
  const eligible = rule.eligibility.requiresFullPayment ? fullyPaid : meetsMinimum

  const outstanding = eligible
    ? rule.eligibility.requiresManualApproval
      ? 'Manual approval required before it can be approved.'
      : null
    : rule.eligibility.requiresFullPayment
      ? `Full payment. ${paidPercent}% of the invoice is paid, the rule requires 100%.`
      : `Minimum payment. ${paidPercent}% of the invoice is paid, the rule requires ${rule.eligibility.minimumPercentPaid ?? 0}%.`

  return {
    applies,
    reasons,
    beneficiaryPersonId,
    beneficiaryName: personName(beneficiaryPersonId),
    basisAmount: workings.basisAmount,
    rateApplied: workings.rateApplied,
    tierLabel: workings.tierLabel,
    amount: workings.amount,
    workings: workings.explanation,
    state: eligible ? 'earned' : rule.eligibility.stateBeforeEligible,
    eligibilityOutstanding: outstanding,
    paidPercent,
  }
}

/** Which person this rule would pay on a given admission. Three independent fields. */
export function beneficiaryFor(rule: CommissionRule, admission: Admission | null): PersonId | null {
  if (!admission) return null
  if (rule.roleOnDeal === 'referrer') return admission.referrerPersonId
  if (rule.roleOnDeal === 'lead_owner') return userPersonId(admission.leadOwnerUserId)
  return userPersonId(admission.closerUserId)
}

export function amountsForAdmission(admission: Admission): SimulationAmounts {
  const invoice = admission.invoiceId ? invoicesCollection.find(admission.invoiceId) : undefined
  return {
    grossFee: admission.quotedFee,
    netAfterDiscount: admission.netFee,
    amountCollected: k(invoice?.paidAmount ?? 0),
    invoiceTotal: k(invoice?.total ?? admission.netFee),
  }
}

/** The admissions the simulator offers. Most recent first, and the ones with a referrer first. */
export function simulatableAdmissions(limit = 40): Admission[] {
  return admissionsCollection
    .all()
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}

/* -------------------------------------------------------------------------- */
/* Commission reporting helpers                                               */
/* -------------------------------------------------------------------------- */

/** Days since a commission was earned but not yet paid. Ageing, per §3.1. */
export function unpaidAgeing(today: string = TODAY): Array<{ label: string; count: number; amount: Kobo; alarming: boolean }> {
  const buckets: Array<{ label: string; min: number; max: number | null; alarming: boolean }> = [
    { label: '0–7 days', min: 0, max: 7, alarming: false },
    { label: '8–14 days', min: 8, max: 14, alarming: false },
    { label: '15–30 days', min: 15, max: 30, alarming: false },
    { label: '30+ days', min: 31, max: null, alarming: true },
  ]
  const unpaid = commissionsCollection.where(
    (c) => c.earnedAt !== null && !c.paidAt && ['earned', 'approved', 'payable'].includes(c.state),
  )
  return buckets.map((b) => {
    const rows = unpaid.filter((c) => {
      const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(c.earnedAt as string)) / 86_400_000)
      return days >= b.min && (b.max === null || days <= b.max)
    })
    return {
      label: b.label,
      count: rows.length,
      amount: k(rows.reduce((acc, c) => acc + c.amount, 0)),
      alarming: b.alarming,
    }
  })
}

export function daysSinceEarned(commission: Commission, today: string = TODAY): number | null {
  if (!commission.earnedAt) return null
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(commission.earnedAt)) / 86_400_000)
}

export function commissionsForRule(ruleId: string): Commission[] {
  return commissionsCollection.where((c) => c.ruleId === ruleId)
}

/** The day before a date — what a superseded version's effective-to becomes. */
export function dayBefore(date: string): string {
  return addDays(date, -1)
}

/* -------------------------------------------------------------------------- */
/* Field-level diff between two rule versions                                 */
/* -------------------------------------------------------------------------- */

export interface RuleDiffRow {
  field: string
  before: string
  after: string
}

function describe(rule: CommissionRule): Record<string, string> {
  return {
    Name: rule.name,
    'Beneficiary type': BENEFICIARY_LABEL[rule.beneficiaryType],
    'Role on deal': ROLE_LABEL[rule.roleOnDeal],
    Calculation: ruleCalculationSentence(rule),
    Basis: BASIS_LABEL[rule.basis],
    Units: rule.unitIds.length ? rule.unitIds.map(unitName).join(', ') : 'All units',
    Branches: rule.branchIds.length ? rule.branchIds.map(branchName).join(', ') : 'All branches',
    'Requires full payment': rule.eligibility.requiresFullPayment ? 'Yes' : 'No',
    'Minimum percent paid': rule.eligibility.minimumPercentPaid === null ? 'None' : `${rule.eligibility.minimumPercentPaid}%`,
    'Payment aged': rule.eligibility.paymentAgedDays === null ? 'None' : `${rule.eligibility.paymentAgedDays} days`,
    'State before eligible': rule.eligibility.stateBeforeEligible === 'tracked' ? 'Tracked' : 'Pending',
    'On refund': ON_REFUND_LABEL[rule.reversal.onRefund],
    'If already paid': IF_PAID_LABEL[rule.reversal.ifAlreadyPaid],
    'Payout schedule': SCHEDULE_LABEL[rule.payoutSchedule],
    'Approval required': rule.approvalRequired ? `Yes — ${roleName(rule.approverRoleId)}` : 'No',
    'Effective from': formatDate(rule.effectiveFrom),
    'Effective to': rule.effectiveTo ? formatDate(rule.effectiveTo) : 'Open',
  }
}

export function diffRules(before: CommissionRule, after: CommissionRule): RuleDiffRow[] {
  const a = describe(before)
  const b = describe(after)
  return Object.keys(b)
    .filter((key) => a[key] !== b[key])
    .map((key) => ({ field: key, before: a[key], after: b[key] }))
}

export function describeRule(rule: CommissionRule): Record<string, string> {
  return describe(rule)
}
