/**
 * Finance's write path, kept out of the components so it can be bundled and
 * run in Node against the real seed. Every function here follows one rule:
 *
 *   **A financial correction is a new record. The original is never edited.**
 *
 * That is `referral/Ledger.tsx`'s `adjust()` / `reverse()` pattern applied to
 * money. A refund inserts a `Refund`, a `CreditNote` and — where the money had
 * already earned somebody a commission — a negative `Commission` pointing back
 * at the original. The invoice's own `subtotal`, `discountAmount`, `total`,
 * `paidAmount`, `balance` and `lines` are never touched by any of it. The only
 * writes back to the original are the two links the data model asks for
 * (`creditNoteIds`, and `status` moving to Refunded once the credit covers the
 * total) — the same two the seed itself makes, and exactly analogous to
 * `Ledger.reverse()` setting `reversedByCommissionId` on the original.
 */

import {
  CURRENT_USER_ID,
  TODAY,
  approvalRequestsCollection,
  approvalRoutesCollection,
  asKobo,
  auditEventsCollection,
  commissionsCollection,
  creditNotesCollection,
  expensesCollection,
  invoicesCollection,
  nextId,
  paymentsCollection,
  peopleCollection,
  refundsCollection,
  resolveApprovalRoute,
  rolesCollection,
  usersCollection,
} from '@/mocks'
import type {
  ApprovalBand,
  ApprovalImpactLine,
  ApprovalRequest,
  AuditEvent,
  AuditSource,
  Commission,
  CreditNote,
  Expense,
  Invoice,
  Kobo,
  Payment,
  Refund,
  UserId,
} from '@/mocks'
import {
  approvalId as asApprovalId,
  auditId as asAuditId,
  commissionId as asCommissionId,
  creditNoteId as asCreditNoteId,
  expenseId as asExpenseId,
  paymentId as asPaymentId,
  refundId as asRefundId,
} from '@/mocks/types'

/* -------------------------------------------------------------------------- */
/* Clock and audit                                                            */
/* -------------------------------------------------------------------------- */

/** The seed's fixed clock, so relative dates in a demo never rot. */
export function financeNow(): string {
  return `${TODAY}T11:20:00+01:00`
}

function auditable(at = financeNow()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

function actorName(userId: UserId): string {
  const user = usersCollection.find(userId)
  if (!user) return 'Unknown user'
  const person = peopleCollection.find(user.personId)
  return person ? `${person.firstName} ${person.lastName}` : user.email
}

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

/** Append-only. There is no update or delete path for an audit event. */
export function emitAudit(input: AuditInput): AuditEvent {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff') : 'Staff'

  return auditEventsCollection.insert({
    id: asAuditId(`aud-fin-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: financeNow(),
    actorUserId: CURRENT_USER_ID,
    actorName: actorName(CURRENT_USER_ID),
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

/* -------------------------------------------------------------------------- */
/* References                                                                 */
/* -------------------------------------------------------------------------- */

function nextNumber(refs: string[], prefix: string): number {
  const numbers = refs
    .filter((ref) => ref.startsWith(prefix))
    .map((ref) => Number(ref.slice(prefix.length).replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n))
  return Math.max(0, ...numbers) + 1
}

const pad = (n: number, width = 4) => String(n).padStart(width, '0')

export function nextRefundRef(): string {
  return `REF-${pad(nextNumber(refundsCollection.all().map((r) => r.ref), 'REF-'))}`
}

export function nextCreditNoteRef(): string {
  return `CN-${pad(nextNumber(creditNotesCollection.all().map((c) => c.ref), 'CN-'))}`
}

export function nextPaymentRef(): string {
  return `PAY-${nextNumber(paymentsCollection.all().map((p) => p.ref), 'PAY-')}`
}

export function nextExpenseRef(): string {
  const year = TODAY.slice(0, 4)
  return `EXP-${year}-${pad(nextNumber(expensesCollection.all().map((e) => e.ref), `EXP-${year}-`))}`
}

function nextCommissionRef(): string {
  const year = TODAY.slice(0, 4)
  return `COM-${year}-${pad(nextNumber(commissionsCollection.all().map((c) => c.ref), `COM-${year}-`))}`
}

/* -------------------------------------------------------------------------- */
/* The commission cascade a refund sets off                                   */
/* -------------------------------------------------------------------------- */

export interface CommissionImpact {
  commission: Commission
  /** Proportional share of the original, rounded to the kobo. */
  reversalAmount: Kobo
  /** True when the money has already left the building. */
  alreadyPaid: boolean
}

/**
 * What a refund of `refundAmount` against `invoice` would do to commissions.
 *
 * The PRD's rule is that a refund after a commission has been paid produces
 * either a reversal or a receivable *per policy* — and this prototype has no
 * policy engine. So the preview computes the arithmetic and states, for each
 * already-paid line, that which of the two it becomes is an unencoded policy
 * decision. It never silently picks one.
 */
export function commissionImpactOfRefund(invoice: Invoice, refundAmount: number): CommissionImpact[] {
  if (invoice.total <= 0) return []
  const share = Math.min(1, refundAmount / invoice.total)
  return commissionsCollection
    .where(
      (c) =>
        c.invoiceId === invoice.id &&
        c.amount > 0 &&
        c.reversedByCommissionId === null &&
        c.state !== 'cancelled' &&
        c.state !== 'reversed',
    )
    .map((commission) => ({
      commission,
      reversalAmount: asKobo(Math.round(commission.amount * share)),
      alreadyPaid: commission.state === 'paid',
    }))
}

/* -------------------------------------------------------------------------- */
/* Credit notes                                                               */
/* -------------------------------------------------------------------------- */

export interface CreditNoteInput {
  invoice: Invoice
  amount: number
  reason: string
}

/**
 * A credit note is its own record. The invoice keeps every figure it had; it
 * gains a link, and moves to Refunded only once the credit covers the total.
 */
export function issueCreditNote({ invoice, amount, reason }: CreditNoteInput): CreditNote {
  const at = financeNow()
  const note: CreditNote = {
    id: asCreditNoteId(`cn-ui-${Date.now().toString(36)}`),
    ref: nextCreditNoteRef(),
    invoiceId: invoice.id,
    amount: asKobo(amount),
    reason,
    unitId: invoice.unitId,
    approvalRequestId: null,
    ...auditable(at),
  }
  creditNotesCollection.insert(note)

  const creditedTotal =
    creditNotesCollection.where((c) => c.invoiceId === invoice.id).reduce((acc, c) => acc + c.amount, 0)

  invoicesCollection.update(invoice.id, {
    creditNoteIds: [...invoice.creditNoteIds, note.id],
    status: creditedTotal >= invoice.total ? 'refunded' : invoice.status,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'finance.credit_note.issue',
    entityType: 'creditNote',
    entityId: note.id,
    entityRef: note.ref,
    field: 'amount',
    before: null,
    after: String(note.amount),
  })

  return note
}

/* -------------------------------------------------------------------------- */
/* Routing a refund through the shared approval engine                        */
/* -------------------------------------------------------------------------- */

/** The refund route in force today, resolved from the shared data layer. */
export function refundRouteInForce() {
  return approvalRoutesCollection
    .where((r) => r.type === 'refund' && r.effectiveFrom <= TODAY && (r.effectiveTo === null || r.effectiveTo > TODAY))
    .sort((a, b) => b.version - a.version)[0]
}

function bandFor(bands: ApprovalBand[], amount: number): ApprovalBand | undefined {
  return bands.find((b) => amount >= b.fromAmount && (b.toAmount === null || amount < b.toAmount)) ?? bands[0]
}

function holderOfRole(roleId: string | null): UserId | null {
  if (!roleId) return null
  return (usersCollection.all().find((u) => (u.roleIds as string[]).includes(roleId))?.id as UserId) ?? null
}

/** Live preview of the approver chain — re-renders as the amount crosses a band. */
export function previewRefundRoute(amount: number) {
  return resolveApprovalRoute('refund', asKobo(amount))
}

/**
 * Raise the refund's approval request through the shared route configuration,
 * so the reference on the refund record resolves to something real in Work &
 * approvals rather than a fabricated string.
 */
function raiseRefundApproval(
  invoice: Invoice,
  refundAmount: number,
  reason: string,
  impact: ApprovalImpactLine[],
): ApprovalRequest {
  const at = financeNow()
  const route = refundRouteInForce()
  const band = route ? bandFor(route.bands, refundAmount) : undefined
  const steps = resolveApprovalRoute('refund', asKobo(refundAmount)).map((step, index) => ({
    ...step,
    state: index === 0 ? ('pending' as const) : ('not_reached' as const),
  }))

  const request: ApprovalRequest = {
    id: asApprovalId(`apr-fin-${Date.now().toString(36)}`),
    ref: nextId(`APR-${TODAY.slice(0, 4)}`, 400),
    type: 'refund',
    title: `Refund ${formatKobo(refundAmount)} against ${invoice.ref}`,
    justification: reason,
    requesterUserId: CURRENT_USER_ID,
    amount: asKobo(refundAmount),
    unitId: invoice.unitId,
    branchId: invoice.branchId,
    relatedEntityType: 'invoice',
    relatedEntityId: invoice.id,
    relatedEntityRef: invoice.ref,
    attachmentIds: [],
    routeId: (route?.id ?? '') as ApprovalRequest['routeId'],
    routeVersion: route?.version ?? 1,
    steps,
    currentStepIndex: 0,
    currentApproverUserId: steps[0]?.approverUserId ?? null,
    raisedAt: at,
    ageHours: 0,
    slaHours: band?.slaHours ?? 24,
    slaState: 'within',
    escalatesToUserId: holderOfRole((band?.escalateToRoleId as string | null) ?? null),
    escalatesAt: null,
    status: 'pending',
    decidedAt: null,
    impact,
    thread: [],
    ...auditable(at),
  }
  approvalRequestsCollection.insert(request)
  return request
}

/** Kobo as naira, without pulling the UI formatter into the write path. */
function formatKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * The four lines Flow 3 requires an operator to see *before* deciding — the
 * last of which states the non-negotiable: a refund never rewrites attribution.
 */
export function refundImpactLines(
  invoice: Invoice,
  refundAmount: number,
  impacts: CommissionImpact[],
): ApprovalImpactLine[] {
  const lines: ApprovalImpactLine[] = [
    {
      text: `Credit ${formatKobo(refundAmount)} against ${invoice.ref}. The invoice keeps its ${formatKobo(invoice.total)} total and its lines — the credit note is a separate record.`,
      entityType: 'invoice',
      entityId: invoice.id,
      entityRef: invoice.ref,
    },
  ]
  for (const impact of impacts) {
    lines.push({
      text: `Reverse ${impact.commission.ref} (${formatKobo(impact.commission.amount)}, ${impact.commission.state}) proportionally — ${formatKobo(impact.reversalAmount)}.${impact.alreadyPaid ? ' Already paid: whether this is deducted from the next payout or raised as a receivable is a policy decision this prototype does not encode.' : ''}`,
      entityType: 'commission',
      entityId: impact.commission.id,
      entityRef: impact.commission.ref,
    })
  }
  lines.push({
    text: `Reduce collected revenue for ${invoice.unitId} by ${formatKobo(refundAmount)}. Invoiced revenue is not netted down.`,
    entityType: 'unit',
    entityId: invoice.unitId,
    entityRef: invoice.unitId,
  })
  lines.push({
    text: 'Leave sales attribution unchanged — referrer, lead owner and closer are not altered by a refund.',
    entityType: 'invoice',
    entityId: invoice.id,
    entityRef: invoice.ref,
  })
  return lines
}

/* -------------------------------------------------------------------------- */
/* Refunds                                                                    */
/* -------------------------------------------------------------------------- */

export interface RefundInput {
  invoice: Invoice
  refundAmount: number
  reason: string
  /** Commissions the operator confirmed should be reversed, by commission id. */
  reverseCommissionIds: string[]
}

export interface RefundResult {
  refund: Refund
  creditNote: CreditNote
  reversals: Commission[]
  approval: ApprovalRequest
}

/**
 * The never-mutate correction, end to end.
 *
 * Inserts a `Refund`, the `CreditNote` that carries the money, and one negative
 * `Commission` per confirmed reversal. Every original — invoice and commission
 * alike — keeps its amounts and its state; each gains only a back-link.
 */
export function createRefund({ invoice, refundAmount, reason, reverseCommissionIds }: RefundInput): RefundResult {
  const at = financeNow()
  const impacts = commissionImpactOfRefund(invoice, refundAmount).filter((impact) =>
    reverseCommissionIds.includes(impact.commission.id),
  )

  const approval = raiseRefundApproval(invoice, refundAmount, reason, refundImpactLines(invoice, refundAmount, impacts))

  const refund: Refund = {
    id: asRefundId(`ref-ui-${Date.now().toString(36)}`),
    ref: nextRefundRef(),
    invoiceId: invoice.id,
    personId: invoice.personId ?? peopleCollection.all()[0].id,
    originalAmount: invoice.total,
    refundAmount: asKobo(refundAmount),
    reason,
    requestedByUserId: CURRENT_USER_ID,
    approvalRequestId: approval.id,
    affectedCommissionIds: impacts.map((impact) => impact.commission.id),
    status: 'requested',
    processedAt: null,
    ...auditable(at),
  }
  refundsCollection.insert(refund)

  const creditNote = issueCreditNote({
    invoice,
    amount: refundAmount,
    reason: `Issued against refund ${refund.ref}. The original invoice is unchanged. ${reason}`,
  })

  const reversals: Commission[] = []
  for (const impact of impacts) {
    const original = impact.commission
    const reversalId = asCommissionId(`com-rev-${original.id}-${Date.now().toString(36)}`)
    const reversal: Commission = {
      ...original,
      id: reversalId,
      ref: nextCommissionRef(),
      amount: asKobo(-impact.reversalAmount),
      state: 'reversed',
      eligibilityNote: 'Correction record. The original commission is unchanged.',
      reversalOfCommissionId: original.id,
      adjustmentOfCommissionId: null,
      reversedByCommissionId: null,
      reversalReason: `Proportional reversal on refund ${refund.ref}: ${reason}`,
      triggeringRefundId: refund.id,
      payoutBatchId: null,
      paidAt: null,
      approvalRequestId: null,
      approvedByUserId: null,
      approvedAt: null,
      stateHistory: [
        {
          from: original.state,
          to: 'reversed',
          at,
          byUserId: CURRENT_USER_ID,
          note: `Reversal of ${original.ref} raised by refund ${refund.ref}.`,
        },
      ],
      ...auditable(at),
    }
    commissionsCollection.insert(reversal)
    commissionsCollection.update(original.id, {
      reversedByCommissionId: reversalId,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
    reversals.push(reversal)

    emitAudit({
      action: 'finance.commission.reverse',
      entityType: 'commission',
      entityId: reversal.id,
      entityRef: reversal.ref,
      field: 'amount',
      before: String(original.amount),
      after: String(reversal.amount),
    })
  }

  emitAudit({
    action: 'finance.refund.raise',
    entityType: 'refund',
    entityId: refund.id,
    entityRef: refund.ref,
    field: 'refundAmount',
    before: null,
    after: String(refund.refundAmount),
  })

  return { refund, creditNote, reversals, approval }
}

/* -------------------------------------------------------------------------- */
/* Manual payment                                                             */
/* -------------------------------------------------------------------------- */

export interface ManualPaymentInput {
  amount: number
  method: Payment['method']
  payerName: string
  payerReference: string
  receivedAt: string
  /** Required on every invoice, expense and payroll allocation — never optional. */
  unitId: string
  branchId: string
  allocations: Array<{ invoiceId: string; amount: number }>
}

/**
 * Money that arrived outside the bank feed — cash at the desk, a POS terminal,
 * a cheque. Same shape as the payment `Reconciliation.tsx` writes on a
 * confirmed match, with no bank transaction behind it. The surplus stays
 * visible as `unallocatedAmount` rather than being spread onto a guess.
 */
export function recordManualPayment(input: ManualPaymentInput): Payment {
  const at = financeNow()
  const applied = input.allocations.filter((a) => a.amount > 0)
  const allocatedTotal = applied.reduce((acc, a) => acc + a.amount, 0)
  const first = applied[0] ? invoicesCollection.find(applied[0].invoiceId) : undefined

  const payment: Payment = {
    id: asPaymentId(`pay-ui-${Date.now().toString(36)}`),
    ref: nextPaymentRef(),
    receivedAt: input.receivedAt,
    amount: asKobo(input.amount),
    method: input.method,
    payerName: input.payerName,
    payerReference: input.payerReference,
    personId: first?.personId ?? null,
    organisationId: first?.organisationId ?? null,
    unitId: input.unitId as Payment['unitId'],
    branchId: input.branchId as Payment['branchId'],
    status: applied.length > 0 ? 'matched' : 'unmatched',
    bankTransactionId: null,
    allocations: applied.map((a) => ({
      invoiceId: a.invoiceId as Payment['allocations'][number]['invoiceId'],
      amount: asKobo(a.amount),
      allocatedAt: at,
      allocatedBy: CURRENT_USER_ID,
    })),
    unallocatedAmount: asKobo(input.amount - allocatedTotal),
    receiptSentAt: null,
    reversedAt: null,
    reversalReason: null,
    daysUnmatched: 0,
    ...auditable(at),
  }
  paymentsCollection.insert(payment)

  for (const allocation of applied) {
    const invoice = invoicesCollection.find(allocation.invoiceId)
    if (!invoice) continue
    const paidAmount = asKobo(invoice.paidAmount + allocation.amount)
    const balance = asKobo(invoice.total - paidAmount)
    invoicesCollection.update(invoice.id, {
      paidAmount,
      balance,
      status: balance <= 0 ? 'paid' : 'partially_paid',
      daysOverdue: balance <= 0 ? 0 : invoice.daysOverdue,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  emitAudit({
    action: 'finance.payment.record_manual',
    entityType: 'payment',
    entityId: payment.id,
    entityRef: payment.ref,
    field: 'amount',
    before: null,
    after: String(payment.amount),
  })

  return payment
}

/* -------------------------------------------------------------------------- */
/* Expense                                                                    */
/* -------------------------------------------------------------------------- */

export interface ExpenseInput {
  date: string
  category: string
  vendor: string
  amount: number
  /** Required. Unit P&L is only trustworthy because every cost carries one. */
  unitId: string
  branchId: string
  budgetLine: string
  receiptAttached: boolean
  submitForApproval: boolean
}

export function createExpense(input: ExpenseInput): Expense {
  const at = financeNow()
  const expense: Expense = {
    id: asExpenseId(`expense-ui-${Date.now().toString(36)}`),
    ref: nextExpenseRef(),
    date: input.date,
    category: input.category,
    vendor: input.vendor,
    amount: asKobo(input.amount),
    unitId: input.unitId as Expense['unitId'],
    branchId: input.branchId as Expense['branchId'],
    requesterUserId: CURRENT_USER_ID,
    approvalRequestId: null,
    status: input.submitForApproval ? 'pending_approval' : 'draft',
    paidDate: null,
    receiptUrl: input.receiptAttached ? `/receipts/${nextExpenseRef().toLowerCase()}.pdf` : null,
    budgetLine: input.budgetLine,
    ...auditable(at),
  }
  expensesCollection.insert(expense)

  emitAudit({
    action: 'finance.expense.create',
    entityType: 'expense',
    entityId: expense.id,
    entityRef: expense.ref,
    field: 'amount',
    before: null,
    after: String(expense.amount),
  })

  return expense
}

/* -------------------------------------------------------------------------- */
/* Void                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Voiding is the one lifecycle change an invoice can take, and it still credits
 * rather than erases: a full-value credit note is raised first, so the money
 * reconciles, and the original row stays visible with its reason recorded.
 */
export function voidInvoice(invoice: Invoice, reason: string): CreditNote {
  const at = financeNow()
  const note = issueCreditNote({ invoice, amount: invoice.total - invoice.paidAmount, reason })
  invoicesCollection.update(invoice.id, {
    status: 'cancelled',
    voidedAt: at,
    voidReason: reason,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'finance.invoice.void',
    entityType: 'invoice',
    entityId: invoice.id,
    entityRef: invoice.ref,
    field: 'status',
    before: invoice.status,
    after: 'cancelled',
  })
  return note
}
