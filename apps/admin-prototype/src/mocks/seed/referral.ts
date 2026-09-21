/**
 * Referral & Commission.
 *
 * This is the module the PRD cares most about, and the one that carries the
 * two non-negotiables:
 *
 *  1. **Referrer, lead owner and closer are independent.** A rule declares
 *     which of the three it pays via `roleOnDeal`. One admission can produce a
 *     referrer commission *and* a closer commission, to two different people.
 *
 *  2. **Rules are effective-dated configuration, not code.** `alumni-referral`
 *     has three versions with non-overlapping ranges — v1 (Jan–Mar), v2
 *     (Apr–Jun), v3 (Jul onwards). Every commission stores the version that
 *     was in force when it was created **and its original computed amount**.
 *     Publishing v4 must never rewrite them, and this seed is what proves it.
 *
 * Corrections are records. A reversal is a new negative Commission row that
 * points back at the original; the original keeps its state and its amount.
 */

import {
  commissionId as asCommissionId,
  disputeId,
  ngn,
  payoutId,
  referralId as asReferralId,
  referrerId as asReferrerId,
  ruleId as asRuleId,
  approvalId,
  refundId,
  type Commission,
  type CommissionBasis,
  type CommissionDispute,
  type CommissionRule,
  type CommissionRoleOnDeal,
  type CommissionState,
  type CommissionStateChange,
  type Invoice,
  type Kobo,
  type PayoutBatch,
  type PayoutLine,
  type PersonId,
  type Referral,
  type ReferrerProfile,
  type ReferrerType,
  type UserId,
} from '@/mocks/types'
import { BR, C, NGOZI_REFERRER, P, ROLE, RULE, U, UNIT } from '@/mocks/seed/ids'
import { admissionById } from '@/mocks/seed/crm'
import { leads } from '@/mocks/seed/crm'
import { invoices, payments, refunds } from '@/mocks/seed/finance'
import { fullName, personById, personRelationships } from '@/mocks/seed/people'
import { addDays, at, audit, chance, daysAgo, int, pad, percentOf, pick, rng, TODAY } from '@/mocks/seed/_helpers'

const r = rng(141592)

/* -------------------------------------------------------------------------- */
/* Referrer profiles                                                          */
/* -------------------------------------------------------------------------- */

const BANKS = ['Zenith Bank', 'GTBank', 'Providus Bank', 'Access Bank', 'First Bank', 'Sterling Bank']

const referrerRelationships = personRelationships.filter((rel) => rel.type === 'referrer')

const referrerProfiles: ReferrerProfile[] = []
const profileByPerson = new Map<string, ReferrerProfile>()

/** REF-0142 belongs to Ngozi Adeyemi; the generated sequence skips it. */
let refNumber = 0
function nextRefNumber(): number {
  refNumber += 1
  if (refNumber === 142) refNumber += 1
  return refNumber
}

function codeFor(personId: PersonId, n: number): string {
  const p = personById.get(personId)
  const stem = (p?.firstName ?? 'CIRVEE').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6)
  return `${stem}${pad(n % 100, 2)}`
}

function typeFor(personId: PersonId): ReferrerType {
  const rels = personRelationships.filter((rel) => rel.personId === personId).map((rel) => rel.type)
  if (rels.includes('employee')) return 'employee'
  if (rels.includes('parent_guardian')) return 'parent'
  if (rels.includes('alumnus')) return 'alumnus'
  if (rels.includes('student')) return 'student'
  return 'external_agent'
}

/* Ngozi first, so she owns REF-0142. */
referrerProfiles.push({
  id: NGOZI_REFERRER,
  ref: 'REF-0142',
  personId: P.ngozi,
  type: 'alumnus',
  code: 'NGOZI15',
  supersededCodes: ['NGOZI10'],
  trackedUrl: 'https://cirvee.com/r/NGOZI15',
  qrPayload: 'https://cirvee.com/r/NGOZI15',
  status: 'active',
  joinedAt: '2025-03-11',
  payoutMethod: { kind: 'bank_transfer', bankName: 'GTBank', accountLast4: '4417', verified: true },
  taxNote: 'Individual referrer. No WHT applied below ₦1,000,000 per annum.',
  stats: { clicks: 412, signups: 38, converted: 11, earned: 0 as Kobo, paid: 0 as Kobo, outstanding: 0 as Kobo },
  ...audit(at('2025-03-11', 9, 0), U.ifeoma),
})
profileByPerson.set(P.ngozi, referrerProfiles[0])

for (const rel of referrerRelationships) {
  if (rel.personId === P.ngozi) continue
  if (profileByPerson.has(rel.personId)) continue
  const n = nextRefNumber()
  const type = typeFor(rel.personId)
  const profile: ReferrerProfile = {
    id: asReferrerId(`ref-${pad(n)}`),
    ref: `REF-${pad(n)}`,
    personId: rel.personId,
    type,
    code: codeFor(rel.personId, n),
    supersededCodes: [],
    trackedUrl: `https://cirvee.com/r/${codeFor(rel.personId, n)}`,
    qrPayload: `https://cirvee.com/r/${codeFor(rel.personId, n)}`,
    status: rel.status === 'suspended' ? 'suspended' : rel.status === 'ended' ? 'ended' : 'active',
    joinedAt: rel.startDate,
    payoutMethod:
      type === 'employee'
        ? { kind: 'payroll', verified: true }
        : { kind: 'bank_transfer', bankName: pick(r, BANKS), accountLast4: pad(int(r, 1000, 9999), 4), verified: chance(r, 0.78) },
    taxNote: type === 'employee' ? 'Paid through payroll. PAYE applies.' : null,
    stats: {
      clicks: int(r, 0, 260),
      signups: int(r, 0, 14),
      converted: 0,
      earned: 0 as Kobo,
      paid: 0 as Kobo,
      outstanding: 0 as Kobo,
    },
    ...audit(at(rel.startDate, 9, 0), U.ifeoma),
  }
  referrerProfiles.push(profile)
  profileByPerson.set(rel.personId, profile)
}

export { referrerProfiles }

/* -------------------------------------------------------------------------- */
/* Commission rules — 6 rules, 11 versions                                    */
/* -------------------------------------------------------------------------- */

const ruleAudit = audit(at('2025-12-20', 10, 0), U.musa)

function rule(spec: Omit<CommissionRule, keyof ReturnType<typeof audit>>): CommissionRule {
  return { ...spec, ...ruleAudit }
}

const commissionRules: CommissionRule[] = [
  /* ── CR-001 · student-referral ─────────────────────────────────────────── */
  rule({
    id: RULE.studentV1,
    ruleKey: 'student-referral',
    version: 1,
    name: 'Student referral',
    description: 'A current student who brings a classmate earns 5% of the net fee.',
    status: 'superseded',
    unitIds: [UNIT.academy],
    branchIds: [],
    beneficiaryType: 'student',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 5 },
    basis: 'net_after_discount',
    eligibility: { requiresFullPayment: false, minimumPercentPaid: 50, paymentAgedDays: null, requiresManualApproval: true, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2025-01-01',
    effectiveTo: '2025-12-31',
    payoutSchedule: 'monthly',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: null,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),
  rule({
    id: RULE.studentV2,
    ruleKey: 'student-referral',
    version: 2,
    name: 'Student referral',
    description: 'Raised to 7.5% and moved onto amount actually collected after the 2025 write-off review.',
    status: 'active',
    unitIds: [UNIT.academy],
    branchIds: [],
    beneficiaryType: 'student',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 7.5 },
    basis: 'amount_collected',
    eligibility: { requiresFullPayment: false, minimumPercentPaid: 50, paymentAgedDays: 7, requiresManualApproval: true, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    payoutSchedule: 'monthly',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: RULE.studentV1,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),

  /* ── CR-002 · closer-bonus ─────────────────────────────────────────────── */
  rule({
    id: RULE.closerV1,
    ruleKey: 'closer-bonus',
    version: 1,
    name: 'Closer bonus',
    description:
      'A flat ₦15,000 to whoever closed the deal. Pays the **closer**, not the referrer and not the lead owner — those are separate fields and separate rules.',
    status: 'active',
    unitIds: [UNIT.academy, UNIT.teens],
    branchIds: [],
    beneficiaryType: 'staff',
    roleOnDeal: 'closer',
    calculation: { kind: 'fixed', amount: ngn(15_000) },
    basis: 'net_after_discount',
    eligibility: { requiresFullPayment: false, minimumPercentPaid: 100, paymentAgedDays: null, requiresManualApproval: false, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'full', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    payoutSchedule: 'per_payroll',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: null,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),

  /* ── CR-003 · staff-referral ───────────────────────────────────────────── */
  rule({
    id: RULE.staffV1,
    ruleKey: 'staff-referral',
    version: 1,
    name: 'Staff referral',
    description: 'Flat ₦20,000 to any employee whose referral enrols.',
    status: 'superseded',
    unitIds: [],
    branchIds: [],
    beneficiaryType: 'employee',
    roleOnDeal: 'referrer',
    calculation: { kind: 'fixed', amount: ngn(20_000) },
    basis: 'net_after_discount',
    eligibility: { requiresFullPayment: true, minimumPercentPaid: 100, paymentAgedDays: null, requiresManualApproval: false, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'full', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2025-01-01',
    effectiveTo: '2026-06-30',
    payoutSchedule: 'per_payroll',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: null,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),
  rule({
    id: RULE.staffV2,
    ruleKey: 'staff-referral',
    version: 2,
    name: 'Staff referral',
    description: 'Moved from a flat fee to 4% of collections, so a ₦650,000 referral is worth more than a ₦180,000 one.',
    status: 'active',
    unitIds: [],
    branchIds: [],
    beneficiaryType: 'employee',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 4 },
    basis: 'amount_collected',
    eligibility: { requiresFullPayment: true, minimumPercentPaid: 100, paymentAgedDays: null, requiresManualApproval: false, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
    payoutSchedule: 'per_payroll',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: RULE.staffV1,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),

  /* ── CR-004 · alumni-referral · THREE VERSIONS, NO OVERLAP ─────────────── */
  rule({
    id: RULE.alumniV1,
    ruleKey: 'alumni-referral',
    version: 1,
    name: 'Alumni referral',
    description: 'Launch version. 7.5% of the net fee, paid once the student is half-paid.',
    status: 'superseded',
    unitIds: [UNIT.academy],
    branchIds: [],
    beneficiaryType: 'alumnus',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 7.5 },
    basis: 'net_after_discount',
    eligibility: { requiresFullPayment: false, minimumPercentPaid: 50, paymentAgedDays: null, requiresManualApproval: false, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-03-31',
    payoutSchedule: 'monthly',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: null,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),
  rule({
    id: RULE.alumniV2,
    ruleKey: 'alumni-referral',
    version: 2,
    name: 'Alumni referral',
    description: 'Raised to 8.5% for the Q2 push.',
    status: 'superseded',
    unitIds: [UNIT.academy],
    branchIds: [],
    beneficiaryType: 'alumnus',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 8.5 },
    basis: 'net_after_discount',
    eligibility: { requiresFullPayment: false, minimumPercentPaid: 50, paymentAgedDays: null, requiresManualApproval: false, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2026-04-01',
    effectiveTo: '2026-06-30',
    payoutSchedule: 'monthly',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: RULE.alumniV1,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),
  rule({
    id: RULE.alumniV3,
    ruleKey: 'alumni-referral',
    version: 3,
    name: 'Alumni referral',
    description:
      '10% of the amount **actually collected**, released only when the invoice is fully paid. This is the version Flow 2 clones into a tiered v4.',
    status: 'active',
    unitIds: [UNIT.academy],
    branchIds: [],
    beneficiaryType: 'alumnus',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 10 },
    basis: 'amount_collected',
    eligibility: { requiresFullPayment: true, minimumPercentPaid: 100, paymentAgedDays: null, requiresManualApproval: true, stateBeforeEligible: 'pending' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'deduct_next_payout' },
    effectiveFrom: '2026-07-01',
    effectiveTo: null,
    payoutSchedule: 'monthly',
    approvalRequired: true,
    approverRoleId: ROLE.financeManager,
    supersedesVersionId: RULE.alumniV2,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),

  /* ── CR-005 · corporate-partner ────────────────────────────────────────── */
  rule({
    id: RULE.corporateV1,
    ruleKey: 'corporate-partner',
    version: 1,
    name: 'Corporate partner',
    description: 'Flat 3% of contract value to the introducing partner.',
    status: 'superseded',
    unitIds: [UNIT.corporate],
    branchIds: [],
    beneficiaryType: 'corporate_partner',
    roleOnDeal: 'referrer',
    calculation: { kind: 'percentage', rate: 3 },
    basis: 'gross_fee',
    eligibility: { requiresFullPayment: true, minimumPercentPaid: 100, paymentAgedDays: 30, requiresManualApproval: true, stateBeforeEligible: 'tracked' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'create_receivable' },
    effectiveFrom: '2025-01-01',
    effectiveTo: '2025-12-31',
    payoutSchedule: 'on_approval',
    approvalRequired: true,
    approverRoleId: ROLE.cfo,
    supersedesVersionId: null,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),
  rule({
    id: RULE.corporateV2,
    ruleKey: 'corporate-partner',
    version: 2,
    name: 'Corporate partner',
    description: 'Tiered on contract value, so a ₦40m contract does not pay the same rate as a ₦3m one.',
    status: 'active',
    unitIds: [UNIT.corporate],
    branchIds: [],
    beneficiaryType: 'corporate_partner',
    roleOnDeal: 'referrer',
    calculation: {
      kind: 'tiered',
      tiers: [
        { fromAmount: 0 as Kobo, toAmount: ngn(5_000_000), rate: 4 },
        { fromAmount: ngn(5_000_000), toAmount: ngn(20_000_000), rate: 3 },
        { fromAmount: ngn(20_000_000), toAmount: null, rate: 2 },
      ],
    },
    basis: 'amount_collected',
    eligibility: { requiresFullPayment: false, minimumPercentPaid: 50, paymentAgedDays: 30, requiresManualApproval: true, stateBeforeEligible: 'tracked' },
    reversal: { onRefund: 'proportional', ifAlreadyPaid: 'create_receivable' },
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    payoutSchedule: 'on_approval',
    approvalRequired: true,
    approverRoleId: ROLE.cfo,
    supersedesVersionId: RULE.corporateV1,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),

  /* ── CR-006 · influencer-campaign ──────────────────────────────────────── */
  rule({
    id: RULE.influencerV1,
    ruleKey: 'influencer-campaign',
    version: 1,
    name: 'Influencer campaign — Q4 intake',
    description: 'Course-specific rates for the October intake push. Ends 31 Oct 2026.',
    status: 'active',
    unitIds: [UNIT.academy],
    branchIds: [BR.ibadan, BR.lagos],
    beneficiaryType: 'influencer',
    roleOnDeal: 'referrer',
    calculation: {
      kind: 'course_specific',
      rates: [
        { courseId: C.dataAnalysis, rate: 12 },
        { courseId: C.productDesign, rate: 10 },
      ],
      fallbackRate: 6,
    },
    basis: 'amount_collected',
    eligibility: { requiresFullPayment: true, minimumPercentPaid: 100, paymentAgedDays: null, requiresManualApproval: true, stateBeforeEligible: 'tracked' },
    reversal: { onRefund: 'full', ifAlreadyPaid: 'write_off_with_approval' },
    effectiveFrom: '2026-08-01',
    effectiveTo: '2026-10-31',
    payoutSchedule: 'on_approval',
    approvalRequired: true,
    approverRoleId: ROLE.headOfGrowth,
    supersedesVersionId: null,
    commissionCount: 0,
    commissionTotal: 0 as Kobo,
  }),
]

export { commissionRules }
export const ruleById = new Map<string, CommissionRule>(commissionRules.map((rl) => [rl.id, rl]))

/** The rule version in force for a key on a given date. Flow 2 step 1 uses this. */
export function ruleInForce(ruleKey: string, onDate: string): CommissionRule | undefined {
  return commissionRules.find(
    (rl) =>
      rl.ruleKey === ruleKey &&
      rl.effectiveFrom <= onDate &&
      (rl.effectiveTo === null || rl.effectiveTo >= onDate) &&
      rl.status !== 'draft',
  )
}

/* -------------------------------------------------------------------------- */
/* Commission arithmetic                                                      */
/* -------------------------------------------------------------------------- */

export interface Workings {
  basisAmount: Kobo
  rateApplied: number | null
  tierLabel: string | null
  amount: Kobo
  explanation: string
}

const nairaText = (k: Kobo) => `₦${(k / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

/** The one place commission money is computed. Selectors reuse it verbatim. */
export function computeCommission(
  rl: CommissionRule,
  amounts: { grossFee: Kobo; netAfterDiscount: Kobo; amountCollected: Kobo },
): Workings {
  const basisAmount: Kobo =
    rl.basis === 'gross_fee' ? amounts.grossFee : rl.basis === 'net_after_discount' ? amounts.netAfterDiscount : amounts.amountCollected

  switch (rl.calculation.kind) {
    case 'fixed': {
      const amount = rl.calculation.amount
      return { basisAmount, rateApplied: null, tierLabel: null, amount, explanation: `Flat ${nairaText(amount)}` }
    }
    case 'percentage': {
      const rate = rl.calculation.rate
      const amount = percentOf(basisAmount, rate)
      return {
        basisAmount,
        rateApplied: rate,
        tierLabel: null,
        amount,
        explanation: `${nairaText(basisAmount)} × ${rate}% = ${nairaText(amount)}`,
      }
    }
    case 'tiered': {
      const tier = rl.calculation.tiers.find((t) => basisAmount >= t.fromAmount && (t.toAmount === null || basisAmount < t.toAmount))
      const rate = tier?.rate ?? 0
      const amount = percentOf(basisAmount, rate)
      const label = tier
        ? `${nairaText(tier.fromAmount)}–${tier.toAmount === null ? 'above' : nairaText(tier.toAmount)} → ${rate}%`
        : null
      return {
        basisAmount,
        rateApplied: rate,
        tierLabel: label,
        amount,
        explanation: `${nairaText(basisAmount)} falls in tier ${label} = ${nairaText(amount)}`,
      }
    }
    case 'course_specific':
    case 'campaign_specific': {
      const rate = rl.calculation.fallbackRate
      const amount = percentOf(basisAmount, rate)
      return {
        basisAmount,
        rateApplied: rate,
        tierLabel: null,
        amount,
        explanation: `${nairaText(basisAmount)} × ${rate}% (fallback rate) = ${nairaText(amount)}`,
      }
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Commissions — 88 rows, all nine states, six rule versions                  */
/* -------------------------------------------------------------------------- */

const paidByInvoice = new Map<string, number>()
for (const p of payments) {
  if (p.status !== 'matched') continue
  for (const a of p.allocations) paidByInvoice.set(a.invoiceId, (paidByInvoice.get(a.invoiceId) ?? 0) + a.amount)
}
const paymentIdsByInvoice = new Map<string, string[]>()
for (const p of payments) {
  if (p.status !== 'matched') continue
  for (const a of p.allocations) {
    const list = paymentIdsByInvoice.get(a.invoiceId) ?? []
    list.push(p.id)
    paymentIdsByInvoice.set(a.invoiceId, list)
  }
}

/** Invoices that belong to an admission — the only ones a commission can hang off. */
const commissionableInvoices: Invoice[] = invoices.filter((i) => i.admissionId !== null && i.personId !== null)

/**
 * 88 commissions. Thirty-eight of them sit under alumni-referral v3, which is
 * the count Flow 2's edit-warning dialog quotes.
 */
const STATE_PLAN: ReadonlyArray<readonly [CommissionState, number]> = [
  ['tracked', 8],
  ['pending', 14],
  ['earned', 12],
  ['approved', 9],
  ['payable', 7],
  // 29 here plus COM-2026-0441 above makes 30 paid across 88 commissions.
  ['paid', 29],
  ['disputed', 3],
  ['reversed', 4],
  ['cancelled', 1],
]

const RULE_PLAN: ReadonlyArray<readonly [string, number]> = [
  [RULE.alumniV3, 38],
  [RULE.closerV1, 14],
  [RULE.studentV2, 12],
  [RULE.alumniV2, 10],
  [RULE.alumniV1, 8],
  [RULE.staffV2, 6],
]

const stateSequence = STATE_PLAN.flatMap(([s, n]) => Array.from({ length: n }, () => s))
const ruleSequence = RULE_PLAN.flatMap(([id, n]) => Array.from({ length: n }, () => id))

const commissions: Commission[] = []

function history(states: CommissionState[], start: string, by: UserId): CommissionStateChange[] {
  const out: CommissionStateChange[] = []
  for (let i = 1; i < states.length; i++) {
    out.push({
      from: states[i - 1],
      to: states[i],
      at: at(addDays(start, i * 4), 10 + i, 12),
      byUserId: by,
      note:
        states[i] === 'earned'
          ? 'Invoice fully paid — eligibility satisfied.'
          : states[i] === 'approved'
            ? 'Approved by Finance.'
            : states[i] === 'payable'
              ? 'Added to the payout run.'
              : states[i] === 'paid'
                ? 'Paid by bank transfer.'
                : `Moved to ${states[i]}.`,
    })
  }
  return out
}

const PATH: Record<CommissionState, CommissionState[]> = {
  tracked: ['tracked'],
  pending: ['tracked', 'pending'],
  earned: ['tracked', 'pending', 'earned'],
  approved: ['tracked', 'pending', 'earned', 'approved'],
  payable: ['tracked', 'pending', 'earned', 'approved', 'payable'],
  paid: ['tracked', 'pending', 'earned', 'approved', 'payable', 'paid'],
  disputed: ['tracked', 'pending', 'earned', 'disputed'],
  reversed: ['tracked', 'pending', 'earned', 'approved', 'payable', 'paid', 'reversed'],
  cancelled: ['tracked', 'pending', 'cancelled'],
}

/* ── COM-2026-0441: Ngozi's paid ₦40,500 on Chiamaka's admission ─────────── */

const chiamakaAdmission = admissionById.get('adm-0151')
const chiamakaInvoice = invoices.find((i) => i.id === 'inv-0851')
const alumniV3 = ruleById.get(RULE.alumniV3)

if (chiamakaAdmission && chiamakaInvoice && alumniV3) {
  const workings = computeCommission(alumniV3, {
    grossFee: chiamakaAdmission.quotedFee,
    netAfterDiscount: chiamakaAdmission.netFee,
    amountCollected: chiamakaInvoice.paidAmount,
  })
  commissions.push({
    id: asCommissionId('com-0441'),
    ref: 'COM-2026-0441',
    beneficiaryPersonId: P.ngozi,
    roleOnDeal: 'referrer',
    admissionId: chiamakaAdmission.id,
    invoiceId: chiamakaInvoice.id,
    courseId: chiamakaAdmission.courseId,
    unitId: chiamakaAdmission.unitId,
    branchId: chiamakaAdmission.branchId,
    ruleId: alumniV3.id,
    ruleKey: alumniV3.ruleKey,
    ruleVersion: 3,
    basis: alumniV3.basis,
    basisAmount: workings.basisAmount,
    rateApplied: workings.rateApplied,
    tierLabel: null,
    amount: workings.amount,
    state: 'paid',
    eligibilityNote: null,
    triggeringPaymentIds: (paymentIdsByInvoice.get(chiamakaInvoice.id) ?? []) as Commission['triggeringPaymentIds'],
    earnedAt: at('2026-09-08', 10, 3),
    approvalRequestId: approvalId('apr-0275'),
    approvedByUserId: U.fatima,
    approvedAt: at('2026-09-10', 11, 20),
    payoutBatchId: payoutId('payb-017'),
    paidAt: at('2026-09-12', 15, 40),
    stateHistory: history(PATH.paid, '2026-08-09', U.fatima),
    adjustmentOfCommissionId: null,
    reversalOfCommissionId: null,
    reversedByCommissionId: null,
    reversalReason: null,
    triggeringRefundId: null,
    ...audit(at('2026-08-09', 10, 20), U.fatima),
  })
}

/* ── The other 87 ───────────────────────────────────────────────────────── */

let commissionNumber = 353 // COM-2026-0354 … COM-2026-0440, then 0441 above.
const reversalOriginals: Commission[] = []

for (let i = 0; i < 87; i++) {
  commissionNumber += 1
  const invoice = commissionableInvoices[(i * 5 + 3) % commissionableInvoices.length]
  const admission = invoice.admissionId ? admissionById.get(invoice.admissionId) : undefined
  if (!admission) continue
  const rl = ruleById.get(ruleSequence[i])
  if (!rl) continue

  const state = stateSequence[i]
  const roleOnDeal: CommissionRoleOnDeal = rl.roleOnDeal
  // The beneficiary is whichever of the three fields this rule targets.
  const beneficiary: PersonId | null =
    roleOnDeal === 'referrer'
      ? (admission.referrerPersonId ?? referrerProfiles[(i * 3) % referrerProfiles.length].personId)
      : roleOnDeal === 'closer'
        ? personForUser(admission.closerUserId ?? U.adebayo)
        : personForUser(admission.leadOwnerUserId)
  if (!beneficiary) continue

  const collected = (paidByInvoice.get(invoice.id) ?? 0) as Kobo
  const workings = computeCommission(rl, {
    grossFee: admission.quotedFee,
    netAfterDiscount: admission.netFee,
    amountCollected: collected,
  })

  const createdDay = addDays(invoice.issueDate, 1)
  const paidPercent = invoice.total > 0 ? Math.round((collected / invoice.total) * 100) : 0
  const held = state === 'pending' || state === 'tracked'

  commissions.push({
    id: asCommissionId(`com-${pad(commissionNumber)}`),
    ref: `COM-2026-${pad(commissionNumber)}`,
    beneficiaryPersonId: beneficiary,
    roleOnDeal,
    admissionId: admission.id,
    invoiceId: invoice.id,
    courseId: admission.courseId,
    unitId: admission.unitId,
    branchId: admission.branchId,
    ruleId: rl.id,
    ruleKey: rl.ruleKey,
    ruleVersion: rl.version,
    basis: rl.basis,
    basisAmount: workings.basisAmount,
    rateApplied: workings.rateApplied,
    tierLabel: workings.tierLabel,
    amount: workings.amount,
    state,
    eligibilityNote: held
      ? rl.eligibility.requiresFullPayment
        ? `Held: ${paidPercent}% paid, rule requires 100%`
        : `Held: ${paidPercent}% paid, rule requires ${rl.eligibility.minimumPercentPaid ?? 0}%`
      : state === 'cancelled'
        ? 'Cancelled — the admission was withdrawn before the cohort started.'
        : null,
    triggeringPaymentIds: (paymentIdsByInvoice.get(invoice.id) ?? []) as Commission['triggeringPaymentIds'],
    earnedAt: ['earned', 'approved', 'payable', 'paid', 'disputed', 'reversed'].includes(state)
      ? at(addDays(createdDay, 12), 10, 0)
      : null,
    approvalRequestId: ['approved', 'payable', 'paid', 'reversed'].includes(state) ? approvalId(`apr-${pad(275 + (i % 17))}`) : null,
    approvedByUserId: ['approved', 'payable', 'paid', 'reversed'].includes(state) ? U.fatima : null,
    approvedAt: ['approved', 'payable', 'paid', 'reversed'].includes(state) ? at(addDays(createdDay, 16), 11, 0) : null,
    payoutBatchId: ['paid', 'reversed'].includes(state) ? payoutId(`payb-${pad(13 + (i % 5), 3)}`) : null,
    paidAt: ['paid', 'reversed'].includes(state) ? at(addDays(createdDay, 21), 15, 0) : null,
    stateHistory: history(PATH[state], createdDay, U.fatima),
    adjustmentOfCommissionId: null,
    reversalOfCommissionId: null,
    reversedByCommissionId: null,
    reversalReason: null,
    triggeringRefundId: null,
    ...audit(at(createdDay, 9, 40), U.fatima),
  })
}

function personForUser(userId: UserId): PersonId | null {
  const map: Record<string, PersonId> = {
    [U.adebayo]: P.adebayo,
    [U.chidinma]: P.chidinma,
    [U.ifeoma]: P.ifeoma,
    [U.blessing]: P.blessing,
    [U.chukwuemeka]: P.chukwuemeka,
    [U.folake]: P.folake,
    [U.aisha]: P.aisha,
  }
  return map[userId] ?? P.adebayo
}

/* ── Turn the four "reversed" rows into genuine correction pairs ─────────── */

/**
 * A reversal is not an edit. Each of the four `reversed` rows is rewritten as
 * a **negative correction record** pointing back at one of the Paid rows. The
 * original keeps its state, its amount and its payout batch. Two rows, one
 * story, nothing overwritten — which is the whole argument.
 */
const reversedRows = commissions.filter((c) => c.state === 'reversed')
const paidRows = commissions.filter((c) => c.state === 'paid' && c.id !== 'com-0441')

reversedRows.forEach((row, i) => {
  const original = paidRows[i]
  if (!original) return
  reversalOriginals.push(original)

  // Proportional: 40% of the fee came back, so 40% of the commission does.
  row.amount = -Math.round(original.amount * 0.4) as Kobo
  row.basisAmount = original.basisAmount
  row.admissionId = original.admissionId
  row.invoiceId = original.invoiceId
  row.beneficiaryPersonId = original.beneficiaryPersonId
  row.roleOnDeal = original.roleOnDeal
  row.ruleId = original.ruleId
  row.ruleKey = original.ruleKey
  row.ruleVersion = original.ruleVersion
  row.basis = original.basis
  row.rateApplied = original.rateApplied
  row.reversalOfCommissionId = original.id
  row.reversedByCommissionId = null
  row.payoutBatchId = null
  row.paidAt = null
  row.approvalRequestId = original.approvalRequestId
  row.reversalReason = `Proportional reversal on refund REF-${pad(i + 1, 4)} — ${
    original.basis === 'amount_collected' ? 'per amount actually collected' : 'per net fee'
  }, per rule ${original.ruleKey} v${original.ruleVersion}.`
  row.triggeringRefundId = refundId(`ref-${pad(i + 1, 4)}`)
  row.eligibilityNote = 'Correction record. The original commission is unchanged and still Paid.'

  original.reversedByCommissionId = row.id
})

export { commissions }
export const commissionById = new Map<string, Commission>(commissions.map((c) => [c.id, c]))

/* Backfill the per-rule counters the edit-warning dialog reads. */
for (const rl of commissionRules) {
  const mine = commissions.filter((c) => c.ruleId === rl.id)
  rl.commissionCount = mine.length
  rl.commissionTotal = mine.reduce((acc, c) => acc + c.amount, 0) as Kobo
}

/* Backfill referrer stats from the ledger, so the profile pages are truthful. */
for (const profile of referrerProfiles) {
  const mine = commissions.filter((c) => c.beneficiaryPersonId === profile.personId)
  const earned = mine.filter((c) => c.state !== 'cancelled').reduce((acc, c) => acc + c.amount, 0)
  const paid = mine.filter((c) => c.state === 'paid').reduce((acc, c) => acc + c.amount, 0)
  profile.stats = {
    ...profile.stats,
    converted: new Set(mine.map((c) => c.admissionId)).size,
    earned: earned as Kobo,
    paid: paid as Kobo,
    outstanding: (earned - paid) as Kobo,
  }
}

/* -------------------------------------------------------------------------- */
/* Referrals — the click-to-enrolment trail                                   */
/* -------------------------------------------------------------------------- */

const referrals: Referral[] = []
let referralSeq = 0

for (const lead of leads) {
  if (!lead.referrerPersonId) continue
  const profile = profileByPerson.get(lead.referrerPersonId)
  if (!profile) continue
  referralSeq += 1
  const admission = [...admissionById.values()].find((a) => a.leadId === lead.id)
  referrals.push({
    id: asReferralId(`rfl-${pad(referralSeq, 4)}`),
    referrerProfileId: profile.id,
    referredPersonId: lead.personId,
    leadId: lead.id,
    admissionId: admission?.id ?? null,
    capturedVia: lead.referralCode ? (chance(r, 0.6) ? 'link' : 'code') : 'manual',
    capturedAt: lead.createdAt,
    currentStage: lead.stage,
    value: lead.quotedValue,
    ...audit(lead.createdAt, U.ifeoma),
  })
}

export { referrals }

/* -------------------------------------------------------------------------- */
/* Payout batches                                                             */
/* -------------------------------------------------------------------------- */

function linesFor(batchId: string): PayoutLine[] {
  const rows = commissions.filter((c) => c.payoutBatchId === batchId)
  const byBeneficiary = new Map<string, Commission[]>()
  for (const c of rows) {
    const list = byBeneficiary.get(c.beneficiaryPersonId) ?? []
    list.push(c)
    byBeneficiary.set(c.beneficiaryPersonId, list)
  }
  return [...byBeneficiary.entries()].map(([personId, cs], i) => {
    const profile = profileByPerson.get(personId)
    return {
      beneficiaryPersonId: personId as PersonId,
      commissionIds: cs.map((c) => c.id),
      amount: cs.reduce((acc, c) => acc + c.amount, 0) as Kobo,
      bankName: profile?.payoutMethod.bankName ?? 'GTBank',
      accountLast4: profile?.payoutMethod.accountLast4 ?? '0000',
      status: i === 2 ? 'failed' : 'paid',
      failureReason: i === 2 ? 'Account name mismatch at the receiving bank' : null,
      bankReference: i === 2 ? null : `ZEN/TRF/${int(r, 10000, 99999)}`,
    }
  })
}

const payoutBatches: PayoutBatch[] = ['payb-013', 'payb-014', 'payb-015', 'payb-016', 'payb-017'].map((id, i) => {
  const lines = linesFor(id)
  const scheduled = ['2026-05-29', '2026-06-26', '2026-07-31', '2026-08-28', '2026-09-12'][i]
  return {
    id: payoutId(id),
    ref: `PAY-B-2026-${pad(13 + i, 3)}`,
    scheduledDate: scheduled,
    method: 'bank_transfer',
    status: lines.some((l) => l.status === 'failed') ? 'partially_failed' : 'paid',
    totalAmount: lines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
    beneficiaryCount: lines.length,
    approvalRequestId: approvalId(`apr-${pad(270 + i)}`),
    lines,
    ...audit(at(addDays(scheduled, -3), 10, 0), U.fatima),
  }
})

/**
 * PAY-B-2026-018 is the open draft — the batch Flow 3 drops its −₦18,000
 * deduction line into. Flow 1 creates PAY-B-2026-019 alongside it.
 */
const payableCommissions = commissions.filter((c) => c.state === 'payable')
const draftLines: PayoutLine[] = [...new Map(payableCommissions.map((c) => [c.beneficiaryPersonId, c])).keys()].map((personId) => {
  const cs = payableCommissions.filter((c) => c.beneficiaryPersonId === personId)
  const profile = profileByPerson.get(personId)
  return {
    beneficiaryPersonId: personId,
    commissionIds: cs.map((c) => c.id),
    amount: cs.reduce((acc, c) => acc + c.amount, 0) as Kobo,
    bankName: profile?.payoutMethod.bankName ?? 'GTBank',
    accountLast4: profile?.payoutMethod.accountLast4 ?? '0000',
    status: 'pending',
    failureReason: null,
    bankReference: null,
  }
})

payoutBatches.push({
  id: payoutId('payb-018'),
  ref: 'PAY-B-2026-018',
  scheduledDate: '2026-09-30',
  method: 'bank_transfer',
  status: 'draft',
  totalAmount: draftLines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
  beneficiaryCount: draftLines.length,
  approvalRequestId: null,
  lines: draftLines,
  ...audit(at(daysAgo(3), 9, 15), U.fatima),
})

export { payoutBatches }

/* -------------------------------------------------------------------------- */
/* Disputes                                                                   */
/* -------------------------------------------------------------------------- */

const disputedCommissions = commissions.filter((c) => c.state === 'disputed')

export const commissionDisputes: CommissionDispute[] = [
  ...disputedCommissions.map((c, i) => ({
    id: disputeId(`dsp-${pad(i + 1, 4)}`),
    ref: `DSP-2026-${pad(i + 1, 4)}`,
    commissionId: c.id,
    raisedByPersonId: c.beneficiaryPersonId,
    raisedAt: at(daysAgo(int(r, 4, 30)), 14, 0),
    category: (['wrong_amount', 'attribution_contested', 'not_paid'] as const)[i % 3],
    amountInDispute: c.amount,
    narrative: [
      'The invoice was discounted after I referred her. My commission should be on the fee she was quoted, not the discounted one.',
      'I introduced this student at the June open day. The referral code on the record is not mine.',
      'Marked as paid on 12 August but nothing has reached my Providus account.',
    ][i % 3],
    status: (['open', 'under_review', 'upheld'] as const)[i % 3],
    assigneeUserId: U.fatima,
    resolutionNote: i % 3 === 2 ? 'Bank returned the transfer — account name mismatch. Re-queued in the next batch.' : null,
    resultingCommissionId: null,
    ...audit(at(daysAgo(int(r, 4, 30)), 14, 0), U.fatima),
  })),
  {
    id: disputeId('dsp-0004'),
    ref: 'DSP-2026-0004',
    commissionId: commissions[6]?.id ?? asCommissionId('com-0441'),
    raisedByPersonId: commissions[6]?.beneficiaryPersonId ?? P.ngozi,
    raisedAt: at('2026-07-19', 9, 30),
    category: 'eligibility_contested',
    amountInDispute: ngn(32_000),
    narrative: 'The student has paid 80% and started classes. Holding the commission until 100% is not what I was told when I signed up.',
    status: 'rejected',
    assigneeUserId: U.fatima,
    resolutionNote:
      'Rule CR-004 v3, effective 1 Jul 2026, requires full payment before the commission is earned. The rule in force at the time of the referral is the one that applies. Explained and closed.',
    resultingCommissionId: null,
    ...audit(at('2026-07-19', 9, 30), U.fatima),
  },
]

/* -------------------------------------------------------------------------- */
/* Close the loop back to Finance                                             */
/* -------------------------------------------------------------------------- */

/**
 * A refund's approval screen has to name the commissions it will reverse
 * *before* anyone decides. Finance builds the refunds first, so the link is
 * written back here, once the reversal pairs exist.
 */
for (const rf of refunds) {
  const reversal = commissions.find((c) => c.triggeringRefundId === rf.id)
  if (!reversal) continue
  rf.affectedCommissionIds = [reversal.reversalOfCommissionId, reversal.id].filter(
    (id): id is Commission['id'] => id !== null,
  )
}

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const REFERRAL_COUNTS = {
  referrerProfiles: referrerProfiles.length,
  activeReferrers: referrerProfiles.filter((p) => p.status === 'active').length,
  commissions: commissions.length,
  rules: new Set(commissionRules.map((rl) => rl.ruleKey)).size,
  ruleVersions: commissionRules.length,
  referrals: referrals.length,
  payoutBatches: payoutBatches.length,
} as const

void TODAY
void fullName
