/**
 * Work, documents and approvals.
 *
 * The approval engine is generic: one `ApprovalRequest` shape carries an
 * expense, a refund, a discount, a hire and a commission payout, and the route
 * is configuration (`ApprovalRoute`, versioned and effective-dated) rather
 * than code. An in-flight request keeps the route version it was raised under,
 * so republishing a route never re-routes something already moving.
 *
 * Two things the seed has to make demonstrable:
 *
 *  - **Self-approval is blocked.** `apr-0311` is raised by the signed-in user
 *    and routed to a step where they are also the approver. The decision
 *    buttons must refuse it, visibly.
 *  - **Impact before decision.** Every request carries a precomputed `impact`
 *    list naming the downstream records a yes would touch, each one linked.
 */

import {
  approvalId as asApprovalId,
  companyAssetId,
  documentId as asDocumentId,
  kbId,
  ngn,
  procurementId,
  routeId as asRouteId,
  taskId as asTaskId,
  type ApprovalBand,
  type ApprovalImpactLine,
  type ApprovalRequest,
  type ApprovalRoute,
  type ApprovalStatus,
  type ApprovalStep,
  type ApprovalType,
  type CompanyAsset,
  type DocumentTemplate,
  type GeneratedDocument,
  type Kobo,
  type KnowledgeArticle,
  type ProcurementRequest,
  type SlaState,
  type Task,
  type UserId,
} from '@/mocks/types'
import { BR, DEPT, ROLE, ROUTE, TPL, U, UNIT, person } from '@/mocks/seed/ids'
import { commissions } from '@/mocks/seed/referral'
import { expenses, invoices, refunds } from '@/mocks/seed/finance'
import { admissions } from '@/mocks/seed/crm'
import { fullName } from '@/mocks/seed/people'
import { addDays, at, audit, daysAgo, hoursSince, int, pad, pick, rng, TODAY } from '@/mocks/seed/_helpers'

const r = rng(246813)

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

function band(
  fromNaira: number,
  toNaira: number | null,
  approverRoleIds: ApprovalBand['approverRoleIds'],
  mode: ApprovalBand['mode'],
  slaHours: number,
  escalateToRoleId: ApprovalBand['escalateToRoleId'],
  escalateAfterHours: number,
): ApprovalBand {
  return {
    fromAmount: ngn(fromNaira),
    toAmount: toNaira === null ? null : ngn(toNaira),
    approverRoleIds,
    mode,
    slaHours,
    escalateToRoleId,
    escalateAfterHours,
  }
}

const routeAudit = audit(at('2026-03-22', 16, 10), U.oluwaseun)

export const approvalRoutes: ApprovalRoute[] = [
  {
    id: ROUTE.refund,
    type: 'refund',
    version: 3,
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
    bands: [
      band(0, 150_000, [ROLE.financeManager], 'any_one', 24, ROLE.cfo, 24),
      // Above ₦150,000 the CFO joins. Flow 3 watches this band appear live as
      // the amount field crosses the threshold.
      band(150_000, null, [ROLE.financeManager, ROLE.cfo], 'all_must_approve', 48, ROLE.ceo, 22),
    ],
    ...routeAudit,
  },
  {
    id: ROUTE.expense,
    type: 'expense',
    version: 2,
    effectiveFrom: '2026-04-01',
    effectiveTo: null,
    bands: [
      band(0, 100_000, [ROLE.academyManager], 'any_one', 24, ROLE.financeManager, 24),
      band(100_000, 750_000, [ROLE.financeManager], 'any_one', 48, ROLE.cfo, 24),
      band(750_000, null, [ROLE.financeManager, ROLE.cfo], 'all_must_approve', 72, ROLE.ceo, 48),
    ],
    ...routeAudit,
  },
  {
    id: ROUTE.discount,
    type: 'discount',
    version: 2,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    // Modelled on percentage bands, expressed here as the kobo value forgone.
    bands: [
      band(0, 67_500, [ROLE.headOfGrowth], 'any_one', 24, ROLE.ceo, 24),
      band(67_500, null, [ROLE.ceo], 'any_one', 48, null, 0),
    ],
    ...routeAudit,
  },
  {
    id: ROUTE.leave,
    type: 'leave',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [band(0, null, [ROLE.hrManager], 'any_one', 48, ROLE.ceo, 48)],
    ...routeAudit,
  },
  {
    id: ROUTE.hire,
    type: 'hire',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [band(0, null, [ROLE.hrManager, ROLE.cfo], 'all_must_approve', 72, ROLE.ceo, 48)],
    ...routeAudit,
  },
  {
    id: ROUTE.salaryChange,
    type: 'salary_change',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [band(0, null, [ROLE.hrManager, ROLE.cfo], 'all_must_approve', 72, ROLE.ceo, 48)],
    ...routeAudit,
  },
  {
    id: ROUTE.procurement,
    type: 'procurement',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [
      band(0, 250_000, [ROLE.financeManager], 'any_one', 48, ROLE.cfo, 24),
      band(250_000, null, [ROLE.cfo], 'any_one', 72, ROLE.ceo, 48),
    ],
    ...routeAudit,
  },
  {
    id: ROUTE.contractSignature,
    type: 'contract_signature',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [band(0, null, [ROLE.ceo], 'any_one', 72, null, 0)],
    ...routeAudit,
  },
  {
    id: ROUTE.commissionDispute,
    type: 'commission_dispute',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [band(0, null, [ROLE.financeManager], 'any_one', 48, ROLE.cfo, 48)],
    ...routeAudit,
  },
  {
    id: ROUTE.commissionApproval,
    type: 'commission_approval',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [band(0, null, [ROLE.financeManager], 'any_one', 48, ROLE.cfo, 24)],
    ...routeAudit,
  },
  {
    id: ROUTE.payout,
    type: 'payout',
    version: 1,
    effectiveFrom: '2026-01-01',
    effectiveTo: null,
    bands: [
      band(0, 1_000_000, [ROLE.financeManager], 'any_one', 24, ROLE.cfo, 24),
      band(1_000_000, null, [ROLE.financeManager, ROLE.cfo], 'all_must_approve', 48, ROLE.ceo, 24),
    ],
    ...routeAudit,
  },
]

const routeByType = new Map<ApprovalType, ApprovalRoute>(approvalRoutes.map((rt) => [rt.type, rt]))

/** Approver user for a role — the prototype has exactly one holder per role. */
const APPROVER_BY_ROLE: Record<string, { user: UserId; label: string }> = {
  [ROLE.financeManager]: { user: U.fatima, label: 'Finance Manager' },
  [ROLE.cfo]: { user: U.oluwaseun, label: 'Chief Financial Officer' },
  [ROLE.ceo]: { user: U.musa, label: 'Chief Executive' },
  [ROLE.headOfGrowth]: { user: U.ifeoma, label: 'Head of Growth' },
  [ROLE.hrManager]: { user: U.yetunde, label: 'HR Manager' },
  [ROLE.academyManager]: { user: U.emeka, label: 'Academy Operations Manager' },
}

/** Resolves a route to a concrete step list. The selectors reuse this verbatim. */
export function buildSteps(type: ApprovalType, amount: Kobo | null, onDate: string = TODAY): ApprovalStep[] {
  const route = routeByType.get(type)
  if (!route) return []
  if (route.effectiveFrom > onDate) return []
  const value = amount ?? (0 as Kobo)
  const matched =
    route.bands.find((b) => value >= b.fromAmount && (b.toAmount === null || value < b.toAmount)) ?? route.bands[0]
  return matched.approverRoleIds.map((roleId, i) => {
    const approver = APPROVER_BY_ROLE[roleId] ?? { user: U.musa, label: 'Chief Executive' }
    const upper = matched.toAmount === null ? 'and above' : `– ₦${(matched.toAmount / 100).toLocaleString('en-NG')}`
    return {
      sequence: i + 1,
      approverUserId: approver.user,
      approverRole: approver.label,
      thresholdLabel: `₦${(matched.fromAmount / 100).toLocaleString('en-NG')} ${upper} → ${approver.label}`,
      state: 'not_reached',
      decidedAt: null,
      comment: null,
    }
  })
}

function slaFor(type: ApprovalType, amount: Kobo | null): { slaHours: number; escalateTo: UserId | null; escalateAfter: number } {
  const route = routeByType.get(type)
  const value = amount ?? (0 as Kobo)
  const matched = route?.bands.find((b) => value >= b.fromAmount && (b.toAmount === null || value < b.toAmount)) ?? route?.bands[0]
  return {
    slaHours: matched?.slaHours ?? 48,
    escalateTo: matched?.escalateToRoleId ? (APPROVER_BY_ROLE[matched.escalateToRoleId]?.user ?? null) : null,
    escalateAfter: matched?.escalateAfterHours ?? 24,
  }
}

/* -------------------------------------------------------------------------- */
/* Approval requests — 62                                                     */
/* -------------------------------------------------------------------------- */

const approvalRequests: ApprovalRequest[] = []

interface RequestArgs {
  n: number
  type: ApprovalType
  title: string
  justification: string
  requesterUserId: UserId
  amount: Kobo | null
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityRef: string
  raisedDaysAgo: number
  status: ApprovalStatus
  impact: ApprovalImpactLine[]
  /** Index of the step currently pending; ignored unless status is pending. */
  currentStep?: number
  slaOverride?: SlaState
  unitId?: ApprovalRequest['unitId']
}

function makeRequest(a: RequestArgs): ApprovalRequest {
  const route = routeByType.get(a.type)
  const raisedAt = at(daysAgo(a.raisedDaysAgo), int(r, 8, 17), int(r, 0, 59))
  const steps = buildSteps(a.type, a.amount, raisedAt.slice(0, 10))
  const { slaHours, escalateTo, escalateAfter } = slaFor(a.type, a.amount)
  const ageHours = hoursSince(raisedAt)
  const cursor = a.currentStep ?? 0

  if (a.status === 'pending') {
    steps.forEach((s, i) => {
      s.state = i < cursor ? 'approved' : i === cursor ? 'pending' : 'not_reached'
      if (i < cursor) {
        s.decidedAt = at(daysAgo(Math.max(0, a.raisedDaysAgo - 1)), 11, 0)
        s.comment = 'Checked against the budget line. Approved.'
      }
    })
  } else if (a.status === 'approved') {
    steps.forEach((s, i) => {
      s.state = 'approved'
      s.decidedAt = at(daysAgo(Math.max(0, a.raisedDaysAgo - 1 - i)), 12, 0)
      s.comment = i === 0 ? 'Approved.' : 'Second approval — within policy.'
    })
  } else if (a.status === 'rejected') {
    steps.forEach((s, i) => {
      s.state = i === 0 ? 'rejected' : 'not_reached'
      if (i === 0) {
        s.decidedAt = at(daysAgo(Math.max(0, a.raisedDaysAgo - 1)), 12, 0)
        s.comment = 'Not in this quarter. Re-raise after the October review.'
      }
    })
  } else if (a.status === 'returned_for_information') {
    steps.forEach((s, i) => {
      s.state = i === 0 ? 'returned' : 'not_reached'
      if (i === 0) {
        s.decidedAt = at(daysAgo(Math.max(0, a.raisedDaysAgo - 1)), 12, 0)
        s.comment = 'Confirm the pro-rata calculation against the attendance record.'
      }
    })
  }

  const slaState: SlaState =
    a.slaOverride ??
    (a.status !== 'pending'
      ? 'within'
      : ageHours > slaHours
        ? 'breached'
        : ageHours > slaHours - 12
          ? 'due_today'
          : 'within')

  return {
    id: asApprovalId(`apr-${pad(a.n)}`),
    ref: `APR-2026-${pad(a.n)}`,
    type: a.type,
    title: a.title,
    justification: a.justification,
    requesterUserId: a.requesterUserId,
    amount: a.amount,
    unitId: a.unitId ?? UNIT.academy,
    branchId: BR.ibadan,
    relatedEntityType: a.relatedEntityType,
    relatedEntityId: a.relatedEntityId,
    relatedEntityRef: a.relatedEntityRef,
    attachmentIds: [],
    routeId: route?.id ?? asRouteId('rt-refund-v3'),
    routeVersion: route?.version ?? 1,
    steps,
    currentStepIndex: a.status === 'pending' ? cursor : steps.length,
    currentApproverUserId: a.status === 'pending' ? (steps[cursor]?.approverUserId ?? null) : null,
    raisedAt,
    ageHours,
    slaHours,
    slaState,
    escalatesToUserId: a.status === 'pending' ? escalateTo : null,
    escalatesAt: a.status === 'pending' ? at(addDays(raisedAt.slice(0, 10), Math.ceil(escalateAfter / 24)), 9, 0) : null,
    status: a.status,
    decidedAt: a.status === 'pending' ? null : at(daysAgo(Math.max(0, a.raisedDaysAgo - 1)), 12, 30),
    impact: a.impact,
    thread: [
      { at: raisedAt, actorUserId: a.requesterUserId, body: a.justification, kind: 'comment' },
      {
        at: at(daysAgo(a.raisedDaysAgo), 18, 0),
        actorUserId: 'system',
        body: `Routed via ${route?.type ?? a.type} route v${route?.version ?? 1}. ${steps.length} step${steps.length === 1 ? '' : 's'}.`,
        kind: 'system',
      },
    ],
    ...audit(raisedAt, a.requesterUserId),
  }
}

/* ── 0250–0262 · refunds ────────────────────────────────────────────────── */

refunds.forEach((refund, i) => {
  const invoice = invoices.find((inv) => inv.id === refund.invoiceId)
  approvalRequests.push(
    makeRequest({
      n: 250 + i,
      type: 'refund',
      title: `Refund ₦${(refund.refundAmount / 100).toLocaleString('en-NG')} — ${fullName(refund.personId)}`,
      justification: refund.reason,
      requesterUserId: U.ibrahim,
      amount: refund.refundAmount,
      relatedEntityType: 'Refund',
      relatedEntityId: refund.id,
      relatedEntityRef: refund.ref,
      raisedDaysAgo: 12 + i * 8,
      status: refund.status === 'requested' ? 'pending' : refund.status === 'rejected' ? 'rejected' : 'approved',
      impact: [
        {
          text: `reduce ${fullName(refund.personId)}'s paid balance by ₦${(refund.refundAmount / 100).toLocaleString('en-NG')}`,
          entityType: 'Invoice',
          entityId: refund.invoiceId,
          entityRef: invoice?.ref ?? refund.invoiceId,
        },
        {
          text: 'issue a credit note against the original invoice — the original is never edited',
          entityType: 'CreditNote',
          entityId: `cn-${pad(i + 1, 4)}`,
          entityRef: `CN-${pad(i + 1, 4)}`,
        },
        {
          text: 'leave sales attribution unchanged — referrer, owner and closer are not altered by a refund',
          entityType: 'Admission',
          entityId: invoice?.admissionId ?? '',
          entityRef: invoice?.admissionId ?? '—',
        },
      ],
    }),
  )
})

/* ── 0263–0269 · expenses over the manager threshold ────────────────────── */

expenses.slice(0, 7).forEach((expense, i) => {
  approvalRequests.push(
    makeRequest({
      n: 263 + i,
      type: 'expense',
      title: `${expense.category} — ${expense.vendor}`,
      justification: `Budget line ${expense.budgetLine}. Quote attached.`,
      requesterUserId: expense.requesterUserId,
      amount: expense.amount,
      relatedEntityType: 'Expense',
      relatedEntityId: expense.id,
      relatedEntityRef: expense.ref,
      raisedDaysAgo: 4 + i * 5,
      status: i === 0 ? 'pending' : i === 6 ? 'rejected' : 'approved',
      unitId: expense.unitId,
      impact: [
        {
          text: `commit ₦${(expense.amount / 100).toLocaleString('en-NG')} against ${expense.budgetLine}`,
          entityType: 'Expense',
          entityId: expense.id,
          entityRef: expense.ref,
        },
      ],
    }),
  )
})

/* ── 0270–0274 · payout batches ─────────────────────────────────────────── */

for (let i = 0; i < 5; i++) {
  approvalRequests.push(
    makeRequest({
      n: 270 + i,
      type: 'payout',
      title: `Referral payout batch PAY-B-2026-${pad(13 + i, 3)}`,
      justification: 'Monthly referral payout run. All commissions in the batch are Approved.',
      requesterUserId: U.fatima,
      amount: ngn(int(r, 400_000, 2_100_000)),
      relatedEntityType: 'PayoutBatch',
      relatedEntityId: `payb-${pad(13 + i, 3)}`,
      relatedEntityRef: `PAY-B-2026-${pad(13 + i, 3)}`,
      raisedDaysAgo: 120 - i * 25,
      status: 'approved',
      impact: [
        {
          text: 'move every commission in the batch from Approved to Payable',
          entityType: 'PayoutBatch',
          entityId: `payb-${pad(13 + i, 3)}`,
          entityRef: `PAY-B-2026-${pad(13 + i, 3)}`,
        },
      ],
    }),
  )
}

/* ── 0275–0291 · commission approvals ───────────────────────────────────── */

for (let i = 0; i < 17; i++) {
  const linked = commissions.filter((c) => c.approvalRequestId === `apr-${pad(275 + i)}`)
  const total = linked.reduce((acc, c) => acc + c.amount, 0) as Kobo
  approvalRequests.push(
    makeRequest({
      n: 275 + i,
      type: 'commission_approval',
      title: `Approve ${linked.length || 1} commission${linked.length === 1 ? '' : 's'} — ₦${(Math.abs(total) / 100).toLocaleString('en-NG')}`,
      justification: 'Commissions have met their rule eligibility and are ready to be made payable.',
      requesterUserId: U.ifeoma,
      amount: Math.abs(total) as Kobo,
      relatedEntityType: 'Commission',
      relatedEntityId: linked[0]?.id ?? 'com-0441',
      relatedEntityRef: linked[0]?.ref ?? 'COM-2026-0441',
      raisedDaysAgo: 6 + i * 4,
      status: i < 3 ? 'pending' : 'approved',
      impact: linked.slice(0, 3).map((c) => ({
        text: `move ${c.ref} (${fullName(c.beneficiaryPersonId)}, ${c.roleOnDeal.replace('_', ' ')}) from Earned to Payable`,
        entityType: 'Commission',
        entityId: c.id,
        entityRef: c.ref,
      })),
    }),
  )
}

/* ── 0292–0295 · discounts over the 15% threshold ───────────────────────── */

const pendingDiscountAdmissions = admissions.filter((a) => a.status === 'pending_discount_approval')
pendingDiscountAdmissions.forEach((adm, i) => {
  approvalRequests.push(
    makeRequest({
      n: 292 + i,
      type: 'discount',
      title: `${adm.discountValue}% discount — ${fullName(adm.personId)}`,
      justification: adm.discountReason ?? 'Requested by the sales executive.',
      requesterUserId: adm.leadOwnerUserId,
      amount: adm.discountAmount,
      relatedEntityType: 'Admission',
      relatedEntityId: adm.id,
      relatedEntityRef: adm.ref,
      raisedDaysAgo: 1 + i * 3,
      status: 'pending',
      unitId: adm.unitId,
      impact: [
        {
          text: `reduce the fee from ₦${(adm.quotedFee / 100).toLocaleString('en-NG')} to ₦${(adm.netFee / 100).toLocaleString('en-NG')}`,
          entityType: 'Admission',
          entityId: adm.id,
          entityRef: adm.ref,
        },
        {
          text: 'reduce any percentage commission computed on net fee for this admission',
          entityType: 'Admission',
          entityId: adm.id,
          entityRef: adm.ref,
        },
        {
          text: 'issue the invoice and release the enrolment',
          entityType: 'Admission',
          entityId: adm.id,
          entityRef: adm.ref,
        },
      ],
    }),
  )
})

/* ── 0296–0310 · the rest of the working queue ──────────────────────────── */

interface MiscSpec {
  type: ApprovalType
  title: string
  justification: string
  requester: UserId
  amountNaira: number | null
  entityType: string
  entityId: string
  entityRef: string
  days: number
  status: ApprovalStatus
  impact: string[]
}

const MISC: MiscSpec[] = [
  { type: 'hire', title: 'Hire a second Data tutor — Ibadan', justification: 'DA-C13 opens on 5 Oct with 18 of 25 seats sold. One lead tutor cannot cover three evenings a week.', requester: U.emeka, amountNaira: 4_800_000, entityType: 'JobOpening', entityId: 'job-0003', entityRef: 'JOB-2026-0003', days: 9, status: 'pending', impact: ['open JOB-2026-0003 for applications', 'commit ₦4,800,000 of annual payroll to the Academy unit'] },
  { type: 'salary_change', title: 'Confirm Chidinma Eze after probation — +18%', justification: 'Probation review passed. Market adjustment for a Sales Executive in Ibadan.', requester: U.yetunde, amountNaira: 3_240_000, entityType: 'Employee', entityId: 'emp-0002', entityRef: 'EMP-0002', days: 3, status: 'pending', impact: ['append a new CompensationVersion effective 1 Oct 2026 — the current one is end-dated, never overwritten', 'increase monthly payroll by ₦45,000'] },
  { type: 'procurement', title: '12 replacement laptops — Bodija Lab 2', justification: 'Six machines are past economic repair. Quote from Slot Systems attached.', requester: U.damilola, amountNaira: 5_400_000, entityType: 'ProcurementRequest', entityId: 'prc-0004', entityRef: 'PRC-2026-0004', days: 6, status: 'pending', impact: ['raise a purchase order with Slot Systems Limited', 'create 12 CompanyAsset records on delivery', 'create an Expense of ₦5,400,000 against the Dexurb unit'] },
  { type: 'leave', title: 'Annual leave — Ibrahim Sani, 5 days', justification: 'Family event in Kaduna. Handover note attached; Fatima covers reconciliation.', requester: U.ibrahim, amountNaira: null, entityType: 'LeaveRequest', entityId: 'lv-0007', entityRef: 'LV-2026-0007', days: 2, status: 'pending', impact: ['reduce annual leave balance from 14 to 9 days', 'reassign the reconciliation queue for the week of 28 Sep'] },
  { type: 'contract_signature', title: 'Sterling Bank Q4 upskilling contract — ₦19.8m', justification: 'Milestone 2 of 3 on the 2026 framework. Legal has cleared the terms.', requester: U.chukwuemeka, amountNaira: 19_800_000, entityType: 'ClientOrg', entityId: 'cli-sterling', entityRef: 'Sterling Bank Plc', days: 11, status: 'pending', impact: ['countersign the framework extension', 'unlock invoicing for milestone 2'] },
  { type: 'commission_dispute', title: 'Dispute DSP-2026-0001 — wrong amount', justification: 'Referrer contends the commission should be computed on the quoted fee, not the discounted one.', requester: U.fatima, amountNaira: 18_000, entityType: 'CommissionDispute', entityId: 'dsp-0001', entityRef: 'DSP-2026-0001', days: 5, status: 'pending', impact: ['if upheld, create an adjustment commission — the original is not edited'] },
  { type: 'expense', title: 'Meta Ads — October intake campaign', justification: 'Q4 enrolment push across Ibadan and Lagos. Last campaign returned 3.1x.', requester: U.amarachi, amountNaira: 1_400_000, entityType: 'Expense', entityId: 'exp-0005', entityRef: 'EXP-2026-0005', days: 1, status: 'pending', impact: ['commit ₦1,400,000 against Marketing — FY2026'] },
  { type: 'expense', title: 'Diesel — September generator run', justification: '400 litres. Grid supply averaged 9 hours a day this month.', requester: U.emeka, amountNaira: 620_000, entityType: 'Expense', entityId: 'exp-0005', entityRef: 'EXP-2026-0005', days: 8, status: 'pending', impact: ['commit ₦620,000 against Diesel & power — FY2026'] },
  { type: 'procurement', title: 'NFC readers ×4 — Lagos campus', justification: 'Yaba has two working readers for four doors. Attendance capture is falling back to manual.', requester: U.damilola, amountNaira: 980_000, entityType: 'ProcurementRequest', entityId: 'prc-0009', entityRef: 'PRC-2026-0009', days: 14, status: 'approved', impact: ['order four readers', 'create four CompanyAsset records on delivery'] },
  { type: 'leave', title: 'Study leave — Kabiru Lawal, 5 days', justification: 'AWS certification exam window.', requester: U.kabiru, amountNaira: null, entityType: 'LeaveRequest', entityId: 'lv-0011', entityRef: 'LV-2026-0011', days: 20, status: 'approved', impact: ['reduce study leave balance from 5 to 0 days'] },
  { type: 'hire', title: 'Hire a Reconciliation Officer — Finance', justification: 'Nine unmatched payments outstanding and a two-person desk. This is the bottleneck on collections.', requester: U.oluwaseun, amountNaira: 3_600_000, entityType: 'JobOpening', entityId: 'job-0005', entityRef: 'JOB-2026-0005', days: 34, status: 'approved', impact: ['open JOB-2026-0005 for applications'] },
  { type: 'expense', title: 'Cohort graduation — DA-C11 venue and catering', justification: 'Nineteen graduates plus guests. Bodija Catering quote attached.', requester: U.folake, amountNaira: 480_000, entityType: 'Expense', entityId: 'exp-0008', entityRef: 'EXP-2026-0008', days: 46, status: 'approved', impact: ['commit ₦480,000 against Refreshments — FY2026'] },
  { type: 'salary_change', title: 'Off-cycle adjustment — Tunde Bakare', justification: 'Retention. Competing offer from a Lagos consultancy.', requester: U.yetunde, amountNaira: 5_400_000, entityType: 'Employee', entityId: 'emp-0003', entityRef: 'EMP-0003', days: 62, status: 'approved', impact: ['append a new CompensationVersion effective 1 Aug 2026'] },
  { type: 'procurement', title: 'Projector replacement — Bodija Seminar Room', justification: 'Lamp failed mid-session twice this month.', requester: U.emeka, amountNaira: 240_000, entityType: 'ProcurementRequest', entityId: 'prc-0012', entityRef: 'PRC-2026-0012', days: 71, status: 'rejected', impact: ['order one replacement projector'] },
  { type: 'expense', title: 'Conference stand — Lagos Tech Week', justification: 'Lead generation. Last year produced 84 leads at ₦9,400 each.', requester: U.amarachi, amountNaira: 2_100_000, entityType: 'Expense', entityId: 'exp-0015', entityRef: 'EXP-2026-0015', days: 88, status: 'approved', impact: ['commit ₦2,100,000 against Marketing — FY2026'] },
]

MISC.forEach((m, i) => {
  approvalRequests.push(
    makeRequest({
      n: 296 + i,
      type: m.type,
      title: m.title,
      justification: m.justification,
      requesterUserId: m.requester,
      amount: m.amountNaira === null ? null : ngn(m.amountNaira),
      relatedEntityType: m.entityType,
      relatedEntityId: m.entityId,
      relatedEntityRef: m.entityRef,
      raisedDaysAgo: m.days,
      status: m.status,
      impact: m.impact.map((text) => ({ text, entityType: m.entityType, entityId: m.entityId, entityRef: m.entityRef })),
    }),
  )
})

/* ── 0311 · raised by the signed-in user. Self-approval must be blocked. ── */

/**
 * Adebayo Ogunlana is the Super Admin *and* an approver on this route. The UI
 * has to refuse his own decision here — "An approver cannot approve their own
 * request." Nothing about the data prevents it; the rule is enforced at the
 * decision, and this row is what makes that visible.
 */
const selfRaised = makeRequest({
  n: 311,
  type: 'refund',
  title: 'Refund ₦210,000 — Oluchi Nnaji, cohort moved twice',
  justification:
    'DM-C08 start date moved twice. She has attended two of eight sessions and asked to withdraw. Pro-rata refund per policy.',
  requesterUserId: U.adebayo,
  amount: ngn(210_000),
  relatedEntityType: 'Invoice',
  relatedEntityId: invoices[12]?.id ?? 'inv-0849',
  relatedEntityRef: invoices[12]?.ref ?? 'INV-2026-0849',
  raisedDaysAgo: 2,
  status: 'pending',
  impact: [
    { text: 'reduce the paid balance on the invoice by ₦210,000', entityType: 'Invoice', entityId: invoices[12]?.id ?? 'inv-0849', entityRef: invoices[12]?.ref ?? 'INV-2026-0849' },
    { text: 'issue a credit note — the original invoice is not edited', entityType: 'CreditNote', entityId: 'cn-0021', entityRef: 'CN-0021' },
    { text: 'reduce Academy collected revenue for September by ₦210,000', entityType: 'Unit', entityId: UNIT.academy, entityRef: 'Cirvee Academy' },
    { text: 'leave sales attribution unchanged — referrer, owner and closer are not altered by a refund', entityType: 'Admission', entityId: 'adm-0151', entityRef: 'ADM-2026-0151' },
  ],
})
// Put the requester on the pending step, so the block is unavoidable.
selfRaised.steps = selfRaised.steps.map((s, i) =>
  i === 0 ? { ...s, approverUserId: U.adebayo, approverRole: 'Super Admin', state: 'pending' } : s,
)
selfRaised.currentApproverUserId = U.adebayo
approvalRequests.push(selfRaised)

/* ── Three breaching SLA, one returned for information ──────────────────── */

const pendingRequests = approvalRequests.filter((a) => a.status === 'pending')
pendingRequests.slice(0, 3).forEach((a) => {
  a.slaState = 'breached'
  a.ageHours = a.slaHours + int(r, 6, 40)
})
pendingRequests.slice(3, 5).forEach((a) => {
  a.slaState = 'due_today'
})

const toReturn = approvalRequests.find((a) => a.type === 'expense' && a.status === 'approved')
if (toReturn) {
  toReturn.status = 'returned_for_information'
  toReturn.decidedAt = null
  toReturn.steps = toReturn.steps.map((s, i) =>
    i === 0 ? { ...s, state: 'returned', comment: 'Attach the vendor quote before I can approve this.' } : { ...s, state: 'not_reached', decidedAt: null, comment: null },
  )
  toReturn.thread.push({
    at: at(daysAgo(1), 10, 12),
    actorUserId: 'system',
    body: 'Returned for information. SLA clock paused.',
    kind: 'system',
  })
}

export { approvalRequests }

/* -------------------------------------------------------------------------- */
/* Tasks                                                                      */
/* -------------------------------------------------------------------------- */

const TASK_TITLES = [
  'Call the four leads that went quiet this week',
  'Chase the Interswitch invoice — 40 days overdue',
  'Confirm tutor cover for DA-C13 evenings',
  'Reconcile the nine unmatched payments',
  'Draft the October intake campaign brief',
  'Review the exception queue with Damilola',
  'Prepare the September payroll variance note',
  'Book the DA-C12 graduation venue',
  'Collect consent forms for the Teens photo shoot',
  'Update the certificate template with the new registrar signature',
  'Follow up on the Sterling Bank milestone 2 sign-off',
  'Audit the Lagos asset register before the move',
  'Write the Q3 outcomes report',
  'Schedule probation reviews for October starters',
  'Replace the Bodija Lab 2 projector lamp',
]

const TASK_OWNERS = [U.chidinma, U.fatima, U.emeka, U.ibrahim, U.amarachi, U.damilola, U.folake, U.yetunde, U.adebayo]

const OTHER_INCENTIVES = [
  'A shout-out in the all-hands',
  'Half a day off in lieu',
  'First pick of the next conference slot',
]

export const tasks: Task[] = Array.from({ length: 94 }, (_, i) => {
  const overdue = i < 9
  const status: Task['status'] =
    i < 62 ? (i % 7 === 0 ? 'in_progress' : i % 13 === 0 ? 'blocked' : 'open') : i % 9 === 0 ? 'cancelled' : 'done'
  const dueDay = overdue ? daysAgo(int(r, 1, 12)) : addDays(TODAY, int(r, 0, 21))
  // Only tasks still open for one to be earned carry an incentive here — a
  // 'done' seed row with an unpaid incentive would look like a broken
  // payout, and the real payout only ever happens through setTaskStatus.
  const stillOpen = status !== 'done' && status !== 'cancelled'
  const incentive: Task['incentive'] =
    stillOpen && i % 8 === 0
      ? { type: 'money', amount: ngn(pick(r, [5_000, 10_000, 15_000, 20_000, 25_000])), note: null }
      : stillOpen && i % 11 === 0
        ? { type: 'other', amount: null, note: pick(r, OTHER_INCENTIVES) }
        : null
  return {
    id: asTaskId(`tsk-${pad(i + 1, 4)}`),
    title: TASK_TITLES[i % TASK_TITLES.length],
    description: i % 3 === 0 ? 'Raised from the weekly leadership meeting.' : null,
    ownerUserId: TASK_OWNERS[i % TASK_OWNERS.length],
    departmentId: [DEPT.growth, DEPT.finance, DEPT.academy, DEPT.marketing, DEPT.tech][i % 5],
    relatedEntityType: i % 4 === 0 ? 'Invoice' : i % 4 === 1 ? 'Lead' : null,
    relatedEntityId: i % 4 === 0 ? (invoices[i % invoices.length]?.id ?? null) : null,
    relatedEntityRef: i % 4 === 0 ? (invoices[i % invoices.length]?.ref ?? null) : null,
    dueAt: at(status === 'done' ? daysAgo(int(r, 3, 40)) : dueDay, int(r, 9, 17), 0),
    priority: overdue ? 'high' : (['low', 'normal', 'normal', 'high', 'urgent'] as const)[i % 5],
    status,
    completedAt: status === 'done' ? at(daysAgo(int(r, 1, 30)), 16, 0) : null,
    incentive,
    incentivePayrollAdjustmentId: null,
    ...audit(at(daysAgo(int(r, 5, 60)), 9, 0), U.adebayo),
  }
})

/* -------------------------------------------------------------------------- */
/* Document templates and generated documents                                 */
/* -------------------------------------------------------------------------- */

export const documentTemplates: DocumentTemplate[] = [
  { id: TPL.certificate, name: 'Certificate of completion', type: 'certificate', version: 4, bodyHtml: '<h1>Certificate of Completion</h1><p>This is to certify that <strong>{{person.fullName}}</strong> has successfully completed <strong>{{course.title}}</strong> with Cirvee Academy, {{cohort.code}}, on {{certificate.issuedAt}}.</p>', mergeFields: ['person.fullName', 'course.title', 'cohort.code', 'certificate.issuedAt', 'certificate.id', 'branch.name'], letterhead: true, signatureBlocks: [{ role: 'registrar', label: 'Registrar' }, { role: 'ceo', label: 'Chief Executive' }], status: 'active', documentsGenerated: 418 },
  { id: TPL.offerLetter, name: 'Offer of employment', type: 'offer_letter', version: 3, bodyHtml: '<p>Dear {{person.firstName}},</p><p>We are pleased to offer you the role of {{offer.jobTitle}} at a gross annual salary of {{offer.gross}}, starting {{offer.startDate}}.</p>', mergeFields: ['person.firstName', 'offer.jobTitle', 'offer.gross', 'offer.startDate', 'offer.probationMonths'], letterhead: true, signatureBlocks: [{ role: 'hr', label: 'HR Manager' }, { role: 'candidate', label: 'Candidate' }], status: 'active', documentsGenerated: 41 },
  { id: TPL.invoicePdf, name: 'Invoice', type: 'invoice', version: 2, bodyHtml: '<table>{{invoice.lines}}</table>', mergeFields: ['invoice.ref', 'invoice.total', 'invoice.dueDate', 'customer.name'], letterhead: true, signatureBlocks: [], status: 'active', documentsGenerated: 96 },
  { id: TPL.receipt, name: 'Payment receipt', type: 'receipt', version: 2, bodyHtml: '<p>Received with thanks from {{payment.payerName}} the sum of {{payment.amount}}.</p>', mergeFields: ['payment.ref', 'payment.amount', 'payment.payerName', 'invoice.ref'], letterhead: true, signatureBlocks: [], status: 'active', documentsGenerated: 119 },
  { id: TPL.corporateContract, name: 'Corporate training contract', type: 'contract', version: 5, bodyHtml: '<h2>Training Services Agreement</h2><p>Between Cirvee Technologies Limited and {{org.name}}…</p>', mergeFields: ['org.name', 'deal.value', 'deal.startDate', 'deal.seats'], letterhead: true, signatureBlocks: [{ role: 'ceo', label: 'For Cirvee' }, { role: 'client', label: 'For the Client' }], status: 'active', documentsGenerated: 22 },
  { id: TPL.confirmationLetter, name: 'Confirmation of employment', type: 'hr_letter', version: 2, bodyHtml: '<p>This letter confirms that {{person.fullName}} has successfully completed probation.</p>', mergeFields: ['person.fullName', 'employee.jobTitle', 'employee.startDate'], letterhead: true, signatureBlocks: [{ role: 'hr', label: 'HR Manager' }], status: 'active', documentsGenerated: 18 },
  { id: TPL.exitClearance, name: 'Exit clearance form', type: 'hr_form', version: 1, bodyHtml: '<p>Departmental clearance for {{person.fullName}}, last working day {{exit.lastWorkingDay}}.</p>', mergeFields: ['person.fullName', 'exit.lastWorkingDay', 'exit.finalSettlement'], letterhead: true, signatureBlocks: [{ role: 'it', label: 'IT' }, { role: 'finance', label: 'Finance' }, { role: 'hr', label: 'HR' }], status: 'active', documentsGenerated: 7 },
  { id: TPL.payslip, name: 'Payslip', type: 'payslip', version: 3, bodyHtml: '<p>{{period.label}} — {{employee.name}}</p>', mergeFields: ['period.label', 'employee.name', 'payslip.gross', 'payslip.net'], letterhead: false, signatureBlocks: [], status: 'active', documentsGenerated: 432 },
].map((t) => ({ ...t, ...audit(at('2026-01-08', 10, 0), U.yetunde) })) as DocumentTemplate[]

const DOC_TYPES: ReadonlyArray<readonly [string, keyof typeof TPL, string]> = [
  ['certificate', 'certificate', 'Certificate'],
  ['receipt', 'receipt', 'Receipt'],
  ['invoice', 'invoicePdf', 'Invoice'],
  ['offer_letter', 'offerLetter', 'Offer'],
  ['contract', 'corporateContract', 'Contract'],
  ['hr_letter', 'confirmationLetter', 'Letter'],
]

export const generatedDocuments: GeneratedDocument[] = Array.from({ length: 146 }, (_, i) => {
  const [type, tplKey, prefix] = DOC_TYPES[i % DOC_TYPES.length]
  const generatedAt = at(i < 88 ? `2026-09-${pad(1 + (i % 19), 2)}` : daysAgo(int(r, 22, 200)), int(r, 9, 18), int(r, 0, 59))
  const needsSignature = type === 'contract' || type === 'offer_letter'
  const signed = needsSignature && i % 5 !== 0
  return {
    id: asDocumentId(`doc-${pad(i + 1, 4)}`),
    ref: `${prefix.toUpperCase()}-2026-${pad(i + 1, 4)}`,
    type,
    templateId: TPL[tplKey],
    templateVersion: documentTemplates.find((t) => t.id === TPL[tplKey])?.version ?? 1,
    personId: person(53 + (i % 240)),
    relatedEntityType: type === 'invoice' ? 'Invoice' : type === 'certificate' ? 'Certificate' : 'Person',
    relatedEntityId: type === 'invoice' ? (invoices[i % invoices.length]?.id ?? '') : person(53 + (i % 240)),
    generatedByUserId: [U.ibrahim, U.emeka, U.yetunde, U.chukwuemeka][i % 4],
    generatedAt,
    fileUrl: `/documents/${prefix.toLowerCase()}-${pad(i + 1, 4)}.pdf`,
    signatureStatus: needsSignature ? (signed ? 'signed' : 'awaiting') : 'not_required',
    signedAt: signed ? at(addDays(generatedAt.slice(0, 10), 3), 14, 0) : null,
    signatories: needsSignature
      ? [{ personId: person(53 + (i % 240)), signedAt: signed ? at(addDays(generatedAt.slice(0, 10), 3), 14, 0) : null }]
      : [],
    voidedAt: null,
    ...audit(generatedAt, U.yetunde),
  }
})

/* -------------------------------------------------------------------------- */
/* Company assets                                                             */
/* -------------------------------------------------------------------------- */

const ASSET_CATALOGUE: ReadonlyArray<readonly [string, string, number]> = [
  ['Laptop', 'HP ProBook 450 G9', 620_000],
  ['Laptop', 'Lenovo ThinkPad E14', 580_000],
  ['Desktop', 'Dell OptiPlex 7010', 480_000],
  ['Projector', 'Epson EB-X51', 340_000],
  ['NFC reader', 'Cirvee Gate Reader v2', 245_000],
  ['Router', 'MikroTik hEX S', 96_000],
  ['UPS', 'APC Back-UPS 1100VA', 180_000],
  ['Camera', 'Sony ZV-E10', 740_000],
  ['Generator', 'Mikano 15kVA', 4_200_000],
  ['Air conditioner', 'LG Dual Inverter 1.5HP', 420_000],
]

export const companyAssets: CompanyAsset[] = Array.from({ length: 126 }, (_, i) => {
  const [category, name, valueNaira] = ASSET_CATALOGUE[i % ASSET_CATALOGUE.length]
  const purchaseDate = daysAgo(int(r, 60, 1300))
  const purchaseValue = ngn(valueNaira)
  const ageYears = int(r, 0, 3)
  const status: CompanyAsset['status'] =
    i < 41 ? 'on_loan' : i < 78 ? 'assigned' : i < 104 ? 'in_store' : i < 116 ? 'in_repair' : i < 122 ? 'retired' : 'lost'
  const assigned = status === 'on_loan' || status === 'assigned'
  return {
    id: companyAssetId(`ast-${pad(i + 1, 4)}`),
    assetId: `AST-${pad(i + 1, 4)}`,
    category,
    name,
    serial: `CIR-${category.slice(0, 3).toUpperCase()}-${pad(int(r, 10000, 99999), 5)}`,
    purchaseDate,
    purchaseValue,
    currentValue: Math.round(purchaseValue * Math.pow(0.78, ageYears)) as Kobo,
    branchId: i % 4 === 0 ? BR.lagos : BR.ibadan,
    assignedToPersonId: assigned ? person(1 + (i % 52)) : null,
    assignedAt: assigned ? addDays(purchaseDate, 14) : null,
    condition: status === 'retired' ? 'retired' : status === 'in_repair' ? 'needs_repair' : ageYears === 0 ? 'new' : ageYears < 2 ? 'good' : 'fair',
    status,
    lastServiceDate: i % 3 === 0 ? daysAgo(int(r, 20, 300)) : null,
    returnDueDate: status === 'on_loan' ? addDays(TODAY, int(r, -14, 60)) : null,
    serviceHistory:
      i % 3 === 0
        ? [{ date: daysAgo(int(r, 20, 300)), note: pick(r, ['Battery replaced', 'Screen hinge repaired', 'Full service and clean', 'Firmware update']), cost: ngn(int(r, 8_000, 90_000)) }]
        : [],
    ...audit(at(purchaseDate, 11, 0), U.damilola),
  }
})

/* -------------------------------------------------------------------------- */
/* Procurement                                                                */
/* -------------------------------------------------------------------------- */

const PROCUREMENT_ITEMS: ReadonlyArray<readonly [string, string, number, number]> = [
  ['Replacement laptops', 'IT equipment', 12, 5_400_000],
  ['NFC readers', 'IT equipment', 4, 980_000],
  ['Projector', 'AV equipment', 1, 240_000],
  ['Office chairs', 'Furniture', 20, 1_600_000],
  ['Whiteboards', 'Furniture', 6, 360_000],
  ['Diesel storage tank', 'Facilities', 1, 780_000],
  ['Branded notebooks', 'Marketing', 500, 450_000],
  ['Server rack UPS', 'IT equipment', 1, 1_250_000],
  ['Air conditioners', 'Facilities', 3, 1_260_000],
]

export const procurementRequests: ProcurementRequest[] = Array.from({ length: 19 }, (_, i) => {
  const [item, category, quantity, costNaira] = PROCUREMENT_ITEMS[i % PROCUREMENT_ITEMS.length]
  const stage: ProcurementRequest['stage'] =
    i < 6 ? (['requested', 'approved', 'quoting'] as const)[i % 3] : i < 12 ? (['ordered', 'received'] as const)[i % 2] : i === 18 ? 'rejected' : (['paid', 'closed'] as const)[i % 2]
  const estimated = ngn(costNaira)
  const closed = stage === 'paid' || stage === 'closed'
  return {
    id: procurementId(`prc-${pad(i + 1, 4)}`),
    ref: `PRC-2026-${pad(i + 1, 4)}`,
    item,
    category,
    quantity,
    estimatedCost: estimated,
    actualCost: closed ? (Math.round(estimated * (0.94 + (i % 5) * 0.03)) as Kobo) : null,
    unitId: [UNIT.academy, UNIT.dexurb, UNIT.corporate, UNIT.teens][i % 4],
    branchId: i % 3 === 0 ? BR.lagos : BR.ibadan,
    requesterUserId: [U.damilola, U.emeka, U.amarachi][i % 3],
    stage,
    approvalRequestId: i < 3 ? asApprovalId(`apr-${pad(298 + i)}`) : null,
    vendor: stage === 'requested' ? null : pick(r, ['Slot Systems Limited', 'Computer Village Traders', 'Mikano International', 'Bodija Furniture Works']),
    expectedDelivery: stage === 'ordered' ? addDays(TODAY, int(r, 3, 21)) : null,
    resultingAssetId: closed ? companyAssetId(`ast-${pad(i + 1, 4)}`) : null,
    resultingExpenseId: closed ? expenses[i % expenses.length]?.id ?? null : null,
    ...audit(at(daysAgo(int(r, 5, 160)), 10, 0), U.damilola),
  }
})

/* -------------------------------------------------------------------------- */
/* Knowledge base                                                             */
/* -------------------------------------------------------------------------- */

const KB: ReadonlyArray<readonly [string, string, string[], boolean]> = [
  ['How to handle a discount request above 15%', 'Sales', ['Sales Executive', 'Head of Growth'], true],
  ['Reconciling a bank transfer with no reference', 'Finance', ['Finance Officer', 'Finance Manager'], true],
  ['Issuing a certificate when a balance is outstanding', 'Academy', ['Academy Operations', 'Finance'], true],
  ['The three attribution fields, and why they are separate', 'Sales', ['All staff'], true],
  ['Running a payout batch', 'Finance', ['Finance Manager'], false],
  ['What to do when an NFC reader goes offline', 'Facilities', ['IT', 'Front desk'], false],
  ['Grading with the rubric — tutor guide', 'Academy', ['Tutors'], true],
  ['Raising a procurement request', 'Operations', ['All staff'], false],
  ['Attendance policy and why there are no deductions', 'People', ['All staff'], true],
  ['Handling a parent complaint — Cirvee Teens', 'Customer experience', ['Front desk', 'Advisors'], false],
  ['Data protection: what we may and may not publish', 'Compliance', ['All staff'], true],
  ['Onboarding a new tutor', 'People', ['HR', 'Academy Operations'], false],
  ['Closing a payroll period', 'Finance', ['Finance Manager', 'HR Manager'], true],
  ['Escalating an automation exception', 'Technology', ['IT'], false],
]

export const knowledgeArticles: KnowledgeArticle[] = KB.map(([title, category, audience, ack], i) => {
  const reviewed = daysAgo(int(r, 20, 260))
  return {
    id: kbId(`kb-${pad(i + 1, 4)}`),
    title,
    category,
    audience: [...audience],
    bodyHtml: `<h2>${title}</h2><p>Owner: ${category}. Last reviewed ${reviewed}. This article is the single source of truth for the procedure it describes; if practice and this article disagree, raise it rather than improvising.</p>`,
    version: 1 + (i % 4),
    ownerUserId: [U.ifeoma, U.fatima, U.emeka, U.yetunde, U.damilola][i % 5],
    lastReviewedAt: reviewed,
    nextReviewDue: addDays(reviewed, 180),
    requiresAcknowledgement: ack,
    readReceipts: ack
      ? [U.chidinma, U.blessing, U.aisha, U.folake, U.ibrahim].map((userId, j) => ({
          userId,
          readAt: j < 3 ? at(daysAgo(int(r, 1, 40)), 12, 0) : null,
        }))
      : [],
    ...audit(at(reviewed, 9, 0), U.yetunde),
  }
})

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const WORK_COUNTS = {
  approvals: approvalRequests.length,
  pending: approvalRequests.filter((a) => a.status === 'pending').length,
  breaching: approvalRequests.filter((a) => a.slaState === 'breached').length,
  tasks: tasks.length,
  openTasks: tasks.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'blocked').length,
  documents: generatedDocuments.length,
  assets: companyAssets.length,
  procurement: procurementRequests.length,
} as const
