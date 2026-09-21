/**
 * The impact preview.
 *
 * The PRD's rule is that an approver never decides blind: before the buttons
 * are live, the screen names every downstream record a yes would touch. That
 * is computed here from live collections rather than written into a component,
 * so approving a commission elsewhere moves these lines too.
 *
 * A refund is the case the spec calls out by name, and it must produce four
 * lines: the payer's balance, the commission reversal, the revenue period, and
 * the explicit statement that sales attribution does not move.
 */

import {
  admissionsCollection,
  commissionRulesCollection,
  commissionsCollection,
  employeesCollection,
  expensesCollection,
  invoicesCollection,
  procurementRequestsCollection,
  unitsCollection,
  TODAY,
} from '@/mocks'
import type { ApprovalImpactLine, ApprovalRequest, ApprovalType, Kobo } from '@/mocks'
import { formatNaira } from '@/lib/format'
import { personName, unitName, userName } from './shared'

/** What the wizard holds while the approver-facing preview is being computed. */
export interface ImpactDraft {
  type: ApprovalType
  amount: Kobo | null
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityRef: string
  unitId: string | null
  /** Type-specific extras the wizard collects. */
  budgetLine?: string
  vendor?: string
  category?: string
  effectiveFrom?: string
  employeeId?: string
  leaveDays?: number
  leaveType?: string
  quantity?: number
  counterparty?: string
}

function line(text: string, entityType: string, entityId: string, entityRef: string): ApprovalImpactLine {
  return { text, entityType, entityId, entityRef }
}

function monthName(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-NG', { month: 'long', timeZone: 'UTC' })
}

/* -------------------------------------------------------------------------- */
/* Refund — the one the spec names                                            */
/* -------------------------------------------------------------------------- */

export interface CommissionReversalPreview {
  commissionId: string
  commissionRef: string
  beneficiary: string
  roleOnDeal: string
  originalAmount: Kobo
  state: string
  reversalAmount: Kobo
  ruleLabel: string
  settlement: string
}

/**
 * What a refund does to every commission earned on the same invoice.
 * Proportional to the share of the invoice being refunded, per the rule's own
 * reversal policy — never a rate typed into this file.
 */
export function commissionReversalPreview(invoiceId: string, refundAmount: Kobo): CommissionReversalPreview[] {
  const invoice = invoicesCollection.find(invoiceId)
  if (!invoice || invoice.total <= 0) return []

  const share = Math.min(1, refundAmount / invoice.total)

  return commissionsCollection
    .where((c) => c.invoiceId === invoiceId && c.state !== 'reversed' && c.state !== 'cancelled' && c.amount > 0)
    .map((commission) => {
      const rule = commissionRulesCollection.find(commission.ruleId)
      const policy = rule?.reversal.onRefund ?? 'proportional'
      const reversalAmount = (policy === 'none'
        ? 0
        : policy === 'full'
          ? commission.amount
          : Math.round(commission.amount * share)) as Kobo

      const alreadyPaid = commission.state === 'paid'
      const ifPaid = rule?.reversal.ifAlreadyPaid ?? 'deduct_next_payout'
      const settlement = !alreadyPaid
        ? 'cancelled before payout'
        : ifPaid === 'deduct_next_payout'
          ? 'deducted from the next payout'
          : ifPaid === 'create_receivable'
            ? 'raised as a receivable against the beneficiary'
            : 'written off, with a separate approval'

      return {
        commissionId: commission.id as string,
        commissionRef: commission.ref,
        beneficiary: personName(commission.beneficiaryPersonId),
        roleOnDeal: commission.roleOnDeal.replace(/_/g, ' '),
        originalAmount: commission.amount,
        state: commission.state,
        reversalAmount,
        ruleLabel: `${rule?.name ?? commission.ruleKey} v${commission.ruleVersion}`,
        settlement,
      }
    })
    .filter((row) => row.reversalAmount > 0)
}

function refundImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const amount = (draft.amount ?? 0) as Kobo
  const invoice = invoicesCollection.find(draft.relatedEntityId)

  if (!invoice) {
    return [
      line(
        `refund ${formatNaira(amount)} — pick an invoice to see the full downstream impact`,
        'Invoice',
        draft.relatedEntityId,
        draft.relatedEntityRef || '—',
      ),
    ]
  }

  const payer = personName(invoice.personId)
  const remainingPaid = Math.max(0, invoice.paidAmount - amount) as Kobo
  const lines: ApprovalImpactLine[] = [
    line(
      `reduce ${payer}'s net paid balance on ${invoice.ref} to ${formatNaira(remainingPaid)} through a credit note — the original invoice lines are never edited`,
      'Invoice',
      invoice.id as string,
      invoice.ref,
    ),
  ]

  const reversals = commissionReversalPreview(invoice.id as string, amount)
  if (reversals.length === 0) {
    lines.push(
      line(
        'reverse no commission — nothing has been earned against this invoice',
        'Invoice',
        invoice.id as string,
        invoice.ref,
      ),
    )
  } else {
    for (const reversal of reversals) {
      lines.push(
        line(
          `reverse ${reversal.commissionRef} (${formatNaira(reversal.originalAmount)}, ${reversal.beneficiary}, ${reversal.state}) proportionally per rule ${reversal.ruleLabel} — ${formatNaira(reversal.reversalAmount)}, ${reversal.settlement}`,
          'Commission',
          reversal.commissionId,
          reversal.commissionRef,
        ),
      )
    }
  }

  const unit = unitsCollection.find(invoice.unitId)
  lines.push(
    line(
      `reduce ${unit?.name ?? 'the unit'} collected revenue for ${monthName(TODAY)} by ${formatNaira(amount)}`,
      'Unit',
      invoice.unitId as string,
      unit?.name ?? 'Unit',
    ),
  )

  const admission = invoice.admissionId ? admissionsCollection.find(invoice.admissionId) : undefined
  lines.push(
    line(
      'leave sales attribution unchanged — referrer, owner and closer are not altered by a refund',
      'Admission',
      (admission?.id as string) ?? '',
      admission?.ref ?? 'No admission linked',
    ),
  )

  return lines
}

/* -------------------------------------------------------------------------- */
/* Discount                                                                   */
/* -------------------------------------------------------------------------- */

function discountImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const admission = admissionsCollection.find(draft.relatedEntityId)
  const amount = (draft.amount ?? 0) as Kobo

  if (!admission) {
    return [
      line(
        `forgo ${formatNaira(amount)} of quoted fee — pick an admission to see the fee maths`,
        'Admission',
        draft.relatedEntityId,
        draft.relatedEntityRef || '—',
      ),
    ]
  }

  const newNet = Math.max(0, admission.quotedFee - amount) as Kobo
  const commissionDelta = commissionsCollection
    .where((c) => c.admissionId === admission.id && c.basis === 'net_after_discount')
    .reduce((acc, c) => acc + Math.round(((c.rateApplied ?? 0) / 100) * amount), 0) as Kobo

  return [
    line(
      `reduce the fee on ${admission.ref} from ${formatNaira(admission.quotedFee)} to ${formatNaira(newNet)} — a ${admission.quotedFee > 0 ? ((amount / admission.quotedFee) * 100).toFixed(1) : '0'}% discount`,
      'Admission',
      admission.id as string,
      admission.ref,
    ),
    line(
      commissionDelta > 0
        ? `reduce every commission computed on net fee for this admission by ${formatNaira(commissionDelta)}`
        : 'leave commission unchanged — no rule on this admission is computed on net fee',
      'Admission',
      admission.id as string,
      admission.ref,
    ),
    line(
      `issue the invoice for ${formatNaira(newNet)} and release the enrolment for ${personName(admission.personId)}`,
      'Admission',
      admission.id as string,
      admission.ref,
    ),
    line(
      'leave the three attribution fields unchanged — a discount does not move referrer, owner or closer',
      'Admission',
      admission.id as string,
      admission.ref,
    ),
  ]
}

/* -------------------------------------------------------------------------- */
/* Salary change                                                              */
/* -------------------------------------------------------------------------- */

function salaryChangeImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const employee = employeesCollection.find(draft.employeeId ?? draft.relatedEntityId)
  const proposedAnnual = (draft.amount ?? 0) as Kobo
  const effectiveFrom = draft.effectiveFrom ?? TODAY

  if (!employee) {
    return [
      line(
        `set annual compensation to ${formatNaira(proposedAnnual)} — pick an employee to see the current figure`,
        'Employee',
        draft.relatedEntityId,
        draft.relatedEntityRef || '—',
      ),
    ]
  }

  const current = employee.compensationVersions.find((v) => v.effectiveTo === null) ?? employee.compensationVersions[0]
  const currentAnnual = ((current?.gross ?? 0) * 12) as Kobo
  const delta = (proposedAnnual - currentAnnual) as Kobo
  const monthlyDelta = Math.round(delta / 12) as Kobo

  return [
    line(
      `move ${personName(employee.personId)} from ${formatNaira(currentAnnual)} to ${formatNaira(proposedAnnual)} a year — a ${delta >= 0 ? 'rise' : 'reduction'} of ${formatNaira(Math.abs(delta) as Kobo)}`,
      'Employee',
      employee.id as string,
      employee.employeeId,
    ),
    line(
      `append a new compensation version effective ${effectiveFrom} — the current version is end-dated, never overwritten`,
      'Employee',
      employee.id as string,
      employee.employeeId,
    ),
    line(
      `change monthly payroll cost by ${formatNaira(monthlyDelta)} from the ${monthName(effectiveFrom)} run`,
      'Employee',
      employee.id as string,
      employee.employeeId,
    ),
    line(
      `prorate the first month if ${effectiveFrom} falls mid-period — the payroll run computes the split, this approval does not`,
      'Employee',
      employee.id as string,
      employee.employeeId,
    ),
  ]
}

/* -------------------------------------------------------------------------- */
/* Procurement, expense and the rest                                          */
/* -------------------------------------------------------------------------- */

function procurementImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const request = procurementRequestsCollection.find(draft.relatedEntityId)
  const amount = (draft.amount ?? 0) as Kobo
  const unitId = request?.unitId ?? draft.unitId
  const committed = expensesCollection.sum(
    (e) => e.amount,
    (e) => e.unitId === unitId && e.status !== 'rejected',
  )

  return [
    line(
      `raise a purchase order with ${request?.vendor ?? draft.vendor ?? 'the selected vendor'} for ${formatNaira(amount)}`,
      'ProcurementRequest',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      `commit ${formatNaira(amount)} against ${draft.budgetLine ?? `${request?.category ?? 'Operations'} — FY2026`}, taking ${unitName(unitId)} committed spend to ${formatNaira((committed + amount) as Kobo)}`,
      'Unit',
      (unitId as string) ?? '',
      unitName(unitId),
    ),
    line(
      `create ${request?.quantity ?? draft.quantity ?? 1} asset record${(request?.quantity ?? draft.quantity ?? 1) === 1 ? '' : 's'} on delivery, and an expense when the invoice lands`,
      'ProcurementRequest',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
  ]
}

function expenseImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const amount = (draft.amount ?? 0) as Kobo
  const budgetLine = draft.budgetLine ?? `${draft.category ?? 'Operations'} — FY2026`
  const committed = expensesCollection.sum(
    (e) => e.amount,
    (e) => e.budgetLine === budgetLine && e.status !== 'rejected',
  )

  return [
    line(
      `commit ${formatNaira(amount)} against ${budgetLine}`,
      'Expense',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      `take spend on that budget line to ${formatNaira((committed + amount) as Kobo)} for ${unitName(draft.unitId)}`,
      'Unit',
      draft.unitId ?? '',
      unitName(draft.unitId),
    ),
    line(
      `reduce ${unitName(draft.unitId)} contribution for ${monthName(TODAY)} by ${formatNaira(amount)}`,
      'Unit',
      draft.unitId ?? '',
      unitName(draft.unitId),
    ),
  ]
}

function leaveImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const days = draft.leaveDays ?? 0
  const type = draft.leaveType ?? 'Annual'
  return [
    line(
      `reduce the ${type.toLowerCase()} leave balance by ${days} day${days === 1 ? '' : 's'}`,
      'LeaveRequest',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      'mark those days as approved leave on the attendance record — no financial consequence attaches, by policy',
      'LeaveRequest',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      'hand the cover note to the named stand-in for the period',
      'LeaveRequest',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
  ]
}

function hireImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const amount = (draft.amount ?? 0) as Kobo
  return [
    line(
      `open ${draft.relatedEntityRef || 'the requisition'} for applications`,
      'JobOpening',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      `commit ${formatNaira(amount)} of annual payroll to ${unitName(draft.unitId)}`,
      'Unit',
      draft.unitId ?? '',
      unitName(draft.unitId),
    ),
    line(
      'start the hiring pipeline — screening, interviews, scorecards and an offer, each with its own record',
      'JobOpening',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
  ]
}

function contractImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const amount = (draft.amount ?? 0) as Kobo
  return [
    line(
      `countersign the agreement with ${(draft.counterparty ?? draft.relatedEntityRef) || 'the counterparty'} at ${formatNaira(amount)}`,
      'ClientOrg',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      'generate the signed document from the contract template and send it for e-signature with a full audit trail',
      'DocumentTemplate',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      'unlock invoicing against the milestone schedule',
      'ClientOrg',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
  ]
}

function disputeImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  const amount = (draft.amount ?? 0) as Kobo
  return [
    line(
      `if upheld, create an adjustment commission of ${formatNaira(amount)} — the original commission is never edited`,
      'CommissionDispute',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      'add the adjustment to the next payout batch for the beneficiary',
      'PayoutBatch',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
    line(
      'close the dispute with the decision and the reasoning attached',
      'CommissionDispute',
      draft.relatedEntityId,
      draft.relatedEntityRef || '—',
    ),
  ]
}

/* -------------------------------------------------------------------------- */
/* Entry points                                                               */
/* -------------------------------------------------------------------------- */

export function buildImpact(draft: ImpactDraft): ApprovalImpactLine[] {
  switch (draft.type) {
    case 'refund':
      return refundImpact(draft)
    case 'discount':
      return discountImpact(draft)
    case 'salary_change':
      return salaryChangeImpact(draft)
    case 'procurement':
      return procurementImpact(draft)
    case 'expense':
      return expenseImpact(draft)
    case 'leave':
      return leaveImpact(draft)
    case 'hire':
      return hireImpact(draft)
    case 'contract_signature':
      return contractImpact(draft)
    case 'commission_dispute':
      return disputeImpact(draft)
    default:
      return []
  }
}

/**
 * The preview for a request that already exists. Recomputed live where the
 * request points at a record we can read, so the panel moves when the
 * underlying money moves; otherwise the stored preview stands.
 */
export function impactForRequest(request: ApprovalRequest): {
  lines: ApprovalImpactLine[]
  live: boolean
} {
  const draft: ImpactDraft = {
    type: request.type,
    amount: request.amount,
    relatedEntityType: request.relatedEntityType,
    relatedEntityId: request.relatedEntityId,
    relatedEntityRef: request.relatedEntityRef,
    unitId: request.unitId as string | null,
    employeeId: request.relatedEntityType === 'Employee' ? request.relatedEntityId : undefined,
    counterparty: request.relatedEntityRef,
  }

  const computable: ApprovalType[] = [
    'refund',
    'discount',
    'salary_change',
    'procurement',
    'expense',
    'hire',
    'contract_signature',
    'commission_dispute',
  ]

  if (computable.includes(request.type)) {
    const lines = buildImpact(draft)
    if (lines.length > 0) return { lines, live: true }
  }

  return { lines: request.impact, live: false }
}

/** The one-line plain-English summary of what approving does, for confirms. */
export function consequenceSentence(request: ApprovalRequest): string {
  const meta = `${request.ref} · ${request.title}`
  switch (request.type) {
    case 'refund':
      return `Approving ${meta} issues a credit note and creates the commission reversals listed in the impact preview. Both are new records; nothing existing is edited.`
    case 'discount':
      return `Approving ${meta} fixes the net fee, issues the invoice and releases the enrolment.`
    case 'salary_change':
      return `Approving ${meta} appends a new compensation version and end-dates the current one.`
    case 'procurement':
      return `Approving ${meta} authorises the purchase order and commits the budget line.`
    case 'expense':
      return `Approving ${meta} commits the budget line and clears the expense for payment.`
    default:
      return `Approving ${meta} advances the request to the next step in its route, or completes it if this is the last step.`
  }
}

/** Who raised it, in one string — used by the decision confirm. */
export function requesterLabel(request: ApprovalRequest): string {
  return `${userName(request.requesterUserId)} · ${new Date(request.raisedAt).toLocaleDateString('en-NG')}`
}
