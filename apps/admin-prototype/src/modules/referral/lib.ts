import {
  TODAY,
  addDays,
  branchesCollection,
  commissionRulesCollection,
  commissionsCollection,
  coursesCollection,
  payrollPeriodsCollection,
  peopleCollection,
  rolesCollection,
  unitsCollection,
  usersCollection,
} from '@/mocks'
import { campaignId as asCampaignId, courseId as asCourseId, ruleId as asRuleId } from '@/mocks/types'
import type {
  BranchId,
  Commission,
  CommissionBasis,
  CommissionRule,
  CommissionRoleOnDeal,
  CommissionState,
  Kobo,
  Person,
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

export const ROLE_ON_DEAL: CommissionRoleOnDeal[] = ['referrer', 'lead_owner', 'closer']

export const ROLE_LABEL: Record<CommissionRoleOnDeal, string> = {
  referrer: 'Referred by',
  lead_owner: 'Handled by',
  closer: 'Closed by',
}

export const ROLE_TONE: Record<CommissionRoleOnDeal, BadgeTone> = {
  referrer: 'accent',
  lead_owner: 'info',
  closer: 'success',
}

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

export const STATE_LABEL: Record<CommissionState, string> = {
  tracked: 'Tracked',
  pending: 'Waiting for payment',
  earned: 'Earned',
  approved: 'Approved',
  payable: 'Ready to pay',
  paid: 'Paid',
  disputed: 'Queried',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
}

export type SimpleState = 'waiting' | 'earned' | 'paid'
export type SideFlag = 'queried' | 'reversed' | 'cancelled'

export const SIMPLE_STATES: SimpleState[] = ['waiting', 'earned', 'paid']
export const SIDE_FLAGS: SideFlag[] = ['queried', 'reversed', 'cancelled']

export const SIMPLE_STATE_LABEL: Record<SimpleState, string> = {
  waiting: 'Waiting for payment',
  earned: 'Earned',
  paid: 'Paid',
}

export const SIMPLE_STATE_TONE: Record<SimpleState, BadgeTone> = {
  waiting: 'warning',
  earned: 'info',
  paid: 'success',
}

export const SIDE_FLAG_LABEL: Record<SideFlag, string> = {
  queried: 'Queried',
  reversed: 'Reversed',
  cancelled: 'Cancelled',
}

export const UNDERLYING: Record<SimpleState | SideFlag, CommissionState[]> = {
  waiting: ['tracked', 'pending'],
  earned: ['earned', 'approved', 'payable'],
  paid: ['paid'],
  queried: ['disputed'],
  reversed: ['reversed'],
  cancelled: ['cancelled'],
}

export const OWED_STATES: CommissionState[] = ['earned', 'approved', 'payable']

export function isSimpleState(value: string): value is SimpleState {
  return (SIMPLE_STATES as string[]).includes(value)
}

export function isSideFlag(value: string): value is SideFlag {
  return (SIDE_FLAGS as string[]).includes(value)
}

export function isCommissionState(value: string): value is CommissionState {
  return (COMMISSION_STATES as string[]).includes(value)
}

export function stateMatches(c: Commission, filter: string): boolean {
  if (isSimpleState(filter) || isSideFlag(filter)) return UNDERLYING[filter].includes(c.state)
  if (isCommissionState(filter)) return c.state === filter
  return true
}

export function priorState(c: Commission): CommissionState {
  return c.stateHistory.filter((h) => h.to !== 'disputed').at(-1)?.to ?? 'earned'
}

export function presentState(c: Commission): { simple: SimpleState | null; flag: SideFlag | null } {
  if (c.state === 'disputed') {
    const prior = priorState(c)
    return { simple: simpleOf(prior), flag: 'queried' }
  }
  if (c.state === 'reversed') return { simple: null, flag: 'reversed' }
  if (c.state === 'cancelled') return { simple: null, flag: 'cancelled' }
  return { simple: simpleOf(c.state), flag: null }
}

function simpleOf(state: CommissionState): SimpleState | null {
  if (UNDERLYING.waiting.includes(state)) return 'waiting'
  if (UNDERLYING.earned.includes(state)) return 'earned'
  if (state === 'paid') return 'paid'
  return null
}

export function needsApproval(c: Commission): boolean {
  if (c.state !== 'earned') return false
  return findRule(c.ruleId)?.approvalRequired ?? false
}

export const BASIS_OPTIONS: CommissionBasis[] = ['gross_fee', 'net_after_discount', 'amount_collected']

export const BASIS_LABEL: Record<CommissionBasis, string> = {
  gross_fee: 'The fee',
  net_after_discount: 'The fee after discount',
  amount_collected: 'Money actually received',
}

export const BASIS_HINT: Record<CommissionBasis, string> = {
  gross_fee: 'What was quoted, before any discount.',
  net_after_discount: 'What the student owes after discount, whether or not it has come in yet.',
  amount_collected: 'Only what has landed in the bank.',
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

export const REFERRER_TYPES: ReferrerType[] = [
  'alumnus',
  'student',
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
  alumnus: 'Alumna / Alumnus',
  parent: 'Parent',
  employee: 'Staff member',
  tutor: 'Tutor',
  influencer: 'Influencer',
  partner: 'Partner',
  external_agent: 'Agent',
  corporate_partner: 'Corporate partner',
}

export const BENEFICIARY_PLURAL: Record<ReferrerType | 'staff', string> = {
  staff: 'Staff',
  student: 'Students',
  alumnus: 'Alumni',
  parent: 'Parents',
  employee: 'Staff',
  tutor: 'Tutors',
  influencer: 'Influencers',
  partner: 'Partners',
  external_agent: 'Agents',
  corporate_partner: 'Corporate partners',
}

export type CalculationKind = CommissionRule['calculation']['kind']

export type PayoutSchedule = CommissionRule['payoutSchedule']

export const PAYOUT_SCHEDULES: PayoutSchedule[] = ['per_payroll', 'weekly', 'monthly', 'on_approval']

export const SCHEDULE_LABEL: Record<PayoutSchedule, string> = {
  per_payroll: 'With each payroll run',
  weekly: 'Weekly',
  monthly: 'Monthly',
  on_approval: 'As soon as it is approved',
}

export type OnRefund = CommissionRule['reversal']['onRefund']
export type IfAlreadyPaid = CommissionRule['reversal']['ifAlreadyPaid']

export const ON_REFUND_LABEL: Record<OnRefund, string> = {
  full: 'Take the whole commission back',
  proportional: 'Take back the same share that was refunded',
  none: 'Leave the commission alone',
}

export const IF_PAID_LABEL: Record<IfAlreadyPaid, string> = {
  create_receivable: 'Record it as money they owe us',
  deduct_next_payout: 'Deduct it from their next payout',
  write_off_with_approval: 'Write it off, with sign-off',
}

export const RULE_STATUS_LABEL: Record<CommissionRule['status'], string> = {
  draft: 'Draft',
  scheduled: 'Starts later',
  active: 'In force',
  superseded: 'Replaced',
}

export const RULE_STATUS_TONE: Record<CommissionRule['status'], BadgeTone> = {
  draft: 'neutral',
  scheduled: 'info',
  active: 'success',
  superseded: 'neutral',
}

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

export function unitKey(id: UnitId | null | undefined): BusinessUnit | null {
  if (!id) return null
  const stem = id.replace(/^unit-/, '') as BusinessUnit
  return BUSINESS_UNITS.includes(stem) ? stem : null
}

export function whatsappHref(person: Person | undefined | null): string | null {
  const raw = person?.whatsapp ?? person?.phone
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0') && digits.length === 11) digits = `234${digits.slice(1)}`
  if (digits.length < 10) return null
  return `https://wa.me/${digits}`
}

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

export function tierSummary(tiers: TierDraft[]): string {
  if (!tiers.length) return 'no rate steps yet'
  return tiers
    .map((t) => {
      const from = formatNaira(t.fromAmount, { compact: true })
      const to = t.toAmount === null ? '+' : `–${formatNaira(t.toAmount, { compact: true })}`
      return `${from}${to} → ${t.rate}%`
    })
    .join(' · ')
}

function ofWhat(basis: CommissionBasis): string {
  return BASIS_LABEL[basis].charAt(0).toLowerCase() + BASIS_LABEL[basis].slice(1)
}

export function calculationSentence(draft: RuleDraft): string {
  switch (draft.calcKind) {
    case 'percentage':
      return `${draft.percentageRate}% of ${ofWhat(draft.basis)}`
    case 'fixed':
      return formatNaira(draft.fixedAmount ?? 0)
    case 'tiered':
      return `a stepped rate on ${ofWhat(draft.basis)} (${tierSummary(draft.tiers)})`
    case 'course_specific':
      return `a per-course rate on ${ofWhat(draft.basis)}, ${draft.courseFallback}% for any other course`
    case 'campaign_specific':
      return `a per-campaign rate on ${ofWhat(draft.basis)}, ${draft.campaignFallback}% for any other campaign`
  }
}

export function ruleCalculationSentence(rule: CommissionRule): string {
  return calculationSentence(draftFromRule(rule))
}

export function whoGetsPaid(draft: Pick<RuleDraft, 'beneficiaryType' | 'roleOnDeal'>): string {
  if (draft.roleOnDeal === 'closer') return 'Staff who close a sale'
  if (draft.roleOnDeal === 'lead_owner') return 'Staff who handle the enquiry'
  return `${BENEFICIARY_PLURAL[draft.beneficiaryType]} who refer someone`
}

export function whenPaid(draft: RuleDraft): string {
  const parts: string[] = []
  if (draft.requiresFullPayment) parts.push('once the invoice is fully paid')
  else if (draft.minimumPercentPaid !== null) parts.push(`once ${draft.minimumPercentPaid}% of the invoice is paid`)
  else parts.push('once the invoice is issued')
  if (draft.paymentAgedDays !== null) parts.push(`and the money has settled for ${draft.paymentAgedDays} days`)
  return parts.join(' ')
}

export function rateSentence(draft: RuleDraft): string {
  return `${whoGetsPaid(draft)} get ${calculationSentence(draft)}, ${whenPaid(draft)}.`
}

export function ruleRateSentence(rule: CommissionRule): string {
  return rateSentence(draftFromRule(rule))
}

export function ruleSentence(draft: RuleDraft): string {
  const scope = draft.unitIds.length
    ? `Applies to ${draft.unitIds.map((u) => unitName(u)).join(' and ')} enrolments`
    : 'Applies to enrolments in every unit'
  const branch = draft.branchIds.length ? ` at ${draft.branchIds.map((b) => branchName(b)).join(' and ')}` : ''
  const approval = draft.approvalRequired
    ? `Needs sign-off from ${roleName(draft.approverRoleId)} before it is paid.`
    : 'Paid without a separate sign-off.'
  const schedule = `Paid ${SCHEDULE_LABEL[draft.payoutSchedule].toLowerCase()}.`
  const dates = draft.effectiveTo
    ? `In force ${formatDate(draft.effectiveFrom)} to ${formatDate(draft.effectiveTo)}.`
    : `In force from ${formatDate(draft.effectiveFrom)}.`
  const refund = `On a refund: ${ON_REFUND_LABEL[draft.onRefund].toLowerCase()}; if already paid out, ${IF_PAID_LABEL[draft.ifAlreadyPaid].toLowerCase()}.`
  return `${rateSentence(draft)} ${scope}${branch}. ${approval} ${schedule} ${dates} ${refund}`
}

export interface TierDraft {
  fromAmount: Kobo
  toAmount: Kobo | null
  rate: number
}

export interface RuleDraft {
  supersedesVersionId: string | null
  ruleKey: string
  version: number
  name: string
  description: string
  unitIds: UnitId[]
  branchIds: BranchId[]
  beneficiaryType: ReferrerType | 'staff'
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
    roleOnDeal: 'referrer',
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

export function nextVersionDraft(rule: CommissionRule, effectiveFrom: string): RuleDraft {
  return {
    ...draftFromRule(rule),
    supersedesVersionId: rule.id,
    version: rule.version + 1,
    effectiveFrom,
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

export function candidateRule(
  draft: RuleDraft,
  opts: { id: string; status: CommissionRule['status']; actor: UserId; now: string },
): CommissionRule {
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

export function nextRuleId(draft: RuleDraft): string {
  if (draft.supersedesVersionId) {
    const stem = draft.supersedesVersionId.split('-v')[0]
    return `${stem}-v${draft.version}`
  }
  const existing = commissionRulesCollection.all().map((r) => Number(r.id.split('-')[1] ?? 0))
  const next = Math.max(0, ...existing) + 1
  return `cr-${String(next).padStart(3, '0')}-v${draft.version}`
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export interface TierProblem {
  index: number
  message: string
}

export function validateTiers(tiers: TierDraft[]): TierProblem[] {
  const problems: TierProblem[] = []
  if (!tiers.length) {
    problems.push({ index: -1, message: 'Add at least one rate step.' })
    return problems
  }
  if (tiers[0].fromAmount !== 0) {
    problems.push({ index: 0, message: 'The first step must start at ₦0, or amounts below it earn nothing.' })
  }
  tiers.forEach((tier, i) => {
    if (tier.rate < 0 || tier.rate > 100) {
      problems.push({ index: i, message: 'Rate must be between 0% and 100%.' })
    }
    if (tier.toAmount !== null && tier.toAmount <= tier.fromAmount) {
      problems.push({ index: i, message: 'This step ends before it starts.' })
    }
    if (tier.toAmount === null && i !== tiers.length - 1) {
      problems.push({ index: i, message: 'Only the last step can be open-ended.' })
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

export function validateDraft(draft: RuleDraft): Partial<Record<string, string>> {
  const fields: Partial<Record<string, string>> = {}

  if (!draft.name.trim()) fields.name = 'Give this rate a short name.'
  if (!draft.ruleKey.trim()) fields.ruleKey = 'A rate needs a key.'
  if (!draft.roleOnDeal) fields.roleOnDeal = 'Choose who gets paid.'
  if (draft.calcKind === 'percentage' && (draft.percentageRate <= 0 || draft.percentageRate > 100)) {
    fields.percentageRate = 'Rate must be above 0% and at most 100%.'
  }
  if (draft.calcKind === 'fixed' && (draft.fixedAmount === null || draft.fixedAmount <= 0)) {
    fields.fixedAmount = 'Enter the amount.'
  }
  if (draft.calcKind === 'tiered') {
    const problems = validateTiers(draft.tiers)
    if (problems.length) fields.tiers = problems[0].message
  }
  if (draft.calcKind === 'course_specific' && !draft.courseRates.length) {
    fields.courseRates = 'Add at least one course, or turn per-course rates off.'
  }
  if (draft.calcKind === 'campaign_specific' && !draft.campaignRates.length) {
    fields.campaignRates = 'Add at least one campaign, or use a single rate instead.'
  }
  if (!draft.requiresFullPayment && draft.minimumPercentPaid !== null) {
    if (draft.minimumPercentPaid <= 0 || draft.minimumPercentPaid > 100) {
      fields.minimumPercentPaid = 'Must be between 1% and 100%.'
    }
  }
  if (draft.paymentAgedDays !== null && draft.paymentAgedDays < 0) {
    fields.paymentAgedDays = 'Days cannot be negative.'
  }
  if (!draft.effectiveFrom) {
    fields.effectiveFrom = 'Choose the date this starts.'
  } else {
    const floor = payrollFloor()
    if (floor && draft.effectiveFrom < floor.firstAllowed) {
      fields.effectiveFrom = `Payroll for ${floor.label} is already closed. The earliest start is ${formatDate(floor.firstAllowed)}.`
    }
  }
  if (draft.effectiveTo && draft.effectiveFrom && draft.effectiveTo < draft.effectiveFrom) {
    fields.effectiveTo = 'The end date is before the start date.'
  }
  if (draft.approvalRequired && !draft.approverRoleId) {
    fields.approverRoleId = 'Pick who signs off.'
  }

  return fields
}

export function unpaidAgeing(today: string = TODAY): Array<{ label: string; count: number; amount: Kobo; alarming: boolean }> {
  const buckets: Array<{ label: string; min: number; max: number | null; alarming: boolean }> = [
    { label: '0–7 days', min: 0, max: 7, alarming: false },
    { label: '8–14 days', min: 8, max: 14, alarming: false },
    { label: '15–30 days', min: 15, max: 30, alarming: false },
    { label: '30+ days', min: 31, max: null, alarming: true },
  ]
  const unpaid = commissionsCollection.where((c) => c.earnedAt !== null && !c.paidAt && OWED_STATES.includes(c.state))
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

export function daysBetween(from: string, today: string = TODAY): number {
  return Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(from)) / 86_400_000))
}

export function waitingTone(days: number): BadgeTone {
  if (days > 30) return 'danger'
  if (days > 14) return 'warning'
  return 'neutral'
}

export function commissionsForRule(ruleId: string): Commission[] {
  return commissionsCollection.where((c) => c.ruleId === ruleId)
}

export function dayBefore(date: string): string {
  return addDays(date, -1)
}

export interface RuleDiffRow {
  field: string
  before: string
  after: string
}

function describe(rule: CommissionRule): Record<string, string> {
  const draft = draftFromRule(rule)
  return {
    Name: rule.name,
    'Who gets paid': whoGetsPaid(draft),
    'How much': calculationSentence(draft),
    'Of what': BASIS_LABEL[rule.basis],
    'When it is paid': whenPaid(draft),
    Units: rule.unitIds.length ? rule.unitIds.map(unitName).join(', ') : 'All units',
    Branches: rule.branchIds.length ? rule.branchIds.map(branchName).join(', ') : 'All branches',
    'On a refund': ON_REFUND_LABEL[rule.reversal.onRefund],
    'If already paid out': IF_PAID_LABEL[rule.reversal.ifAlreadyPaid],
    'Payout timing': SCHEDULE_LABEL[rule.payoutSchedule],
    'Sign-off needed': rule.approvalRequired ? `Yes — ${roleName(rule.approverRoleId)}` : 'No',
    'From when': formatDate(rule.effectiveFrom),
    'Until': rule.effectiveTo ? formatDate(rule.effectiveTo) : 'Open',
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
