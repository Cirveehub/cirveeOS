/**
 * Finance — customer accounts, 96 invoices, 134 payments, the raw bank feed,
 * expenses, refunds and credit notes.
 *
 * The arithmetic is derived, never typed twice:
 *
 *   invoice.subtotal  = Σ line.quantity × line.unitPrice
 *   invoice.total     = subtotal − discountAmount
 *   invoice.paidAmount= Σ allocations pointing at this invoice
 *   invoice.balance   = total − paidAmount
 *   account.balance   = invoiced − paid − credits + refunds
 *
 * Nothing is edited after the fact. A correction is a credit note or a refund,
 * both of which are their own records, and the original invoice is untouched.
 *
 * **Collected and invoiced revenue are reported separately, never netted** —
 * the PRD is explicit about that, and the Home dashboard shows the collection
 * rate as the ratio rather than hiding one inside the other.
 */

import {
  accountId as asAccountId,
  bankTxnId,
  creditNoteId as asCreditNoteId,
  expenseId as asExpenseId,
  invoiceId as asInvoiceId,
  invLineId,
  ngn,
  paymentId as asPaymentId,
  refundId as asRefundId,
  approvalId,
  commissionId,
  type BankTransaction,
  type CreditNote,
  type CustomerAccount,
  type Expense,
  type Invoice,
  type InvoiceLine,
  type InvoiceStatus,
  type Kobo,
  type Payment,
  type PaymentAllocation,
  type PaymentMethod,
  type Refund,
} from '@/mocks/types'
import { BR, FLOW, ORGS, P, U, UNIT } from '@/mocks/seed/ids'
import { cohortById, courseById } from '@/mocks/seed/academy'
import { admissionById, invoicedAdmissions } from '@/mocks/seed/crm'
import { enrollments } from '@/mocks/seed/learn'
import { fullName } from '@/mocks/seed/people'
import {
  addDays,
  at,
  audit,
  chance,
  daysAgo,
  daysBetweenTodayAnd,
  int,
  pad,
  pick,
  rng,
  splitInstalments,
  TODAY,
} from '@/mocks/seed/_helpers'

const r = rng(505050)

/** ₦18,420,000.00 — the Home dashboard's collected-revenue figure for September. */
const TARGET_COLLECTED_MTD = ngn(18_420_000)
/** ₦24,900,000.00 — the matching invoiced figure. 18.42 / 24.9 = the 74% collection rate. */
const TARGET_INVOICED_MTD = ngn(24_900_000)

const MTD_FROM = '2026-09-01'

/* -------------------------------------------------------------------------- */
/* Invoices built from admissions                                             */
/* -------------------------------------------------------------------------- */

const invoices: Invoice[] = []
const accounts: CustomerAccount[] = []

function lineFor(
  invoiceRef: string,
  description: string,
  unitPrice: Kobo,
  discount: Kobo,
  quantity: number,
  unitId: InvoiceLine['unitId'],
  courseId: InvoiceLine['courseId'],
  cohortId: InvoiceLine['cohortId'],
  enrollmentId: InvoiceLine['enrollmentId'],
  seq: number,
): InvoiceLine {
  return {
    id: invLineId(`${invoiceRef}-L${seq}`),
    description,
    courseId,
    cohortId,
    enrollmentId,
    quantity,
    unitPrice,
    discountAmount: discount,
    amount: (unitPrice * quantity - discount) as Kobo,
    unitId,
  }
}

for (const adm of invoicedAdmissions) {
  if (!adm.invoiceId) continue
  const course = courseById.get(adm.courseId)
  const cohort = cohortById.get(adm.cohortId)
  const issueDate = addDays(adm.createdAt.slice(0, 10), 1)
  const dueDate = addDays(issueDate, adm.paymentPlan === 'full' ? 21 : 45)
  const accountId = asAccountId(`acct-${adm.id.replace('adm-', '')}`)
  const ref = `INV-2026-${adm.invoiceId.replace('inv-', '')}`

  const line = lineFor(
    ref,
    `${course?.title ?? 'Programme'} — ${cohort?.code ?? 'cohort'} (${adm.mode.replace('_', ' ')})`,
    adm.quotedFee,
    adm.discountAmount,
    1,
    adm.unitId,
    adm.courseId,
    adm.cohortId,
    adm.enrolmentId as InvoiceLine['enrollmentId'],
    1,
  )

  invoices.push({
    id: adm.invoiceId,
    ref,
    accountId,
    personId: adm.personId,
    organisationId: null,
    admissionId: adm.id,
    unitId: adm.unitId,
    branchId: adm.branchId,
    issueDate,
    dueDate,
    subtotal: adm.quotedFee,
    discountAmount: adm.discountAmount,
    total: adm.netFee,
    paidAmount: 0 as Kobo,
    balance: adm.netFee,
    status: 'issued',
    daysOverdue: 0,
    issuedByUserId: U.ibrahim,
    voidedAt: null,
    voidReason: null,
    creditNoteIds: [],
    lines: [line],
    ...audit(at(issueDate, 9, 12), U.ibrahim),
  })

  accounts.push({
    id: accountId,
    ref: `ACC-${adm.id.replace('adm-', '')}`,
    personId: adm.personId,
    organisationId: null,
    unitId: adm.unitId,
    branchId: adm.branchId,
    originalFee: adm.quotedFee,
    approvedDiscount: adm.discountAmount,
    netFee: adm.netFee,
    invoicedTotal: adm.netFee,
    paidTotal: 0 as Kobo,
    creditTotal: 0 as Kobo,
    refundedTotal: 0 as Kobo,
    balance: adm.netFee,
    daysOverdue: 0,
    status: 'current',
    ...audit(at(issueDate, 9, 12), U.ibrahim),
  })
}

/* -------------------------------------------------------------------------- */
/* Corporate invoices — one invoice, many enrolments                          */
/* -------------------------------------------------------------------------- */

const exB08Enrolments = enrollments.filter((e) => e.cohortId === 'coh-ex-b08').slice(0, 16)
const corporateSeatPrice = ngn(320_000)

interface CorporateInvoiceSpec {
  n: number
  org: (typeof ORGS)[keyof typeof ORGS]
  orgName: string
  seats: number
  issueDate: string
  description: string
  paidFraction: number
}

const CORPORATE_SPECS: CorporateInvoiceSpec[] = [
  {
    n: 929,
    org: ORGS.sterling,
    orgName: 'Sterling Bank Plc',
    seats: 6,
    issueDate: '2026-04-02',
    description: 'Corporate Excel & Analytics — EX-B08, cohort of 6 (Retail Ops)',
    paidFraction: 1,
  },
  {
    n: 930,
    org: ORGS.ibedc,
    orgName: 'Ibadan Electricity Distribution Company',
    seats: 6,
    issueDate: '2026-04-02',
    description: 'Corporate Excel & Analytics — EX-B08, cohort of 6 (Metering & Billing)',
    paidFraction: 0.5,
  },
  {
    n: 931,
    org: ORGS.interswitch,
    orgName: 'Interswitch',
    seats: 4,
    issueDate: '2026-04-02',
    description: 'Corporate Excel & Analytics — EX-B08, cohort of 4 (Finance)',
    paidFraction: 0,
  },
]

let seatCursor = 0
for (const spec of CORPORATE_SPECS) {
  const ref = `INV-2026-${pad(spec.n)}`
  const accountId = asAccountId(`acct-org-${spec.n}`)
  const seats = exB08Enrolments.slice(seatCursor, seatCursor + spec.seats)
  seatCursor += spec.seats
  const lines = seats.map((e, i) =>
    lineFor(ref, `Seat ${i + 1} — ${fullName(e.personId)}`, corporateSeatPrice, 0 as Kobo, 1, UNIT.corporate, e.courseId, e.cohortId, e.id, i + 1),
  )
  const subtotal = lines.reduce((acc, l) => acc + l.amount, 0) as Kobo
  invoices.push({
    id: asInvoiceId(`inv-${pad(spec.n)}`),
    ref,
    accountId,
    personId: null,
    organisationId: spec.org,
    admissionId: null,
    unitId: UNIT.corporate,
    branchId: BR.lagos,
    issueDate: spec.issueDate,
    dueDate: addDays(spec.issueDate, 30),
    subtotal,
    discountAmount: 0 as Kobo,
    total: subtotal,
    paidAmount: 0 as Kobo,
    balance: subtotal,
    status: 'issued',
    daysOverdue: 0,
    issuedByUserId: U.chukwuemeka,
    voidedAt: null,
    voidReason: null,
    creditNoteIds: [],
    lines: lines.length
      ? lines
      : [lineFor(ref, spec.description, corporateSeatPrice, 0 as Kobo, spec.seats, UNIT.corporate, null, null, null, 1)],
    ...audit(at(spec.issueDate, 10, 0), U.chukwuemeka),
  })
  accounts.push({
    id: accountId,
    ref: `ACC-ORG-${spec.n}`,
    personId: null,
    organisationId: spec.org,
    unitId: UNIT.corporate,
    branchId: BR.lagos,
    originalFee: subtotal,
    approvedDiscount: 0 as Kobo,
    netFee: subtotal,
    invoicedTotal: subtotal,
    paidTotal: 0 as Kobo,
    creditTotal: 0 as Kobo,
    refundedTotal: 0 as Kobo,
    balance: subtotal,
    daysOverdue: 0,
    status: 'current',
    ...audit(at(spec.issueDate, 10, 0), U.chukwuemeka),
  })
}

/* -------------------------------------------------------------------------- */
/* The September corporate milestone — invoice 96                             */
/* -------------------------------------------------------------------------- */

/**
 * The 96th invoice is the Sterling Bank milestone for the Q4 upskilling
 * contract. Its value is set so that **September invoiced revenue lands
 * exactly on ₦24,900,000.00**, which is the figure the Home dashboard quotes
 * and the denominator of the 74% collection rate. It is a real record with
 * real lines, not a fudge factor: the seat price and count are the variables.
 */
const septemberInvoicedSoFar = invoices
  .filter((i) => i.issueDate >= MTD_FROM && i.issueDate <= TODAY)
  .reduce((acc, i) => acc + i.total, 0) as Kobo

const milestoneTotal = Math.max(ngn(2_400_000), TARGET_INVOICED_MTD - septemberInvoicedSoFar) as Kobo
const milestoneRef = 'INV-2026-0932'
const milestoneAccount = asAccountId('acct-org-932')
const milestoneSeats = 40
const milestoneUnitPrice = Math.floor(milestoneTotal / milestoneSeats) as Kobo
const milestoneRemainder = (milestoneTotal - milestoneUnitPrice * milestoneSeats) as Kobo

const milestoneLines: InvoiceLine[] = [
  lineFor(milestoneRef, 'Data & Analytics upskilling — 40 seats, milestone 2 of 3', milestoneUnitPrice, 0 as Kobo, milestoneSeats, UNIT.corporate, null, null, null, 1),
]
if (milestoneRemainder > 0) {
  milestoneLines.push(
    lineFor(milestoneRef, 'Facilitation and materials adjustment', milestoneRemainder, 0 as Kobo, 1, UNIT.corporate, null, null, null, 2),
  )
}

invoices.push({
  id: asInvoiceId('inv-0932'),
  ref: milestoneRef,
  accountId: milestoneAccount,
  personId: null,
  organisationId: ORGS.sterling,
  admissionId: null,
  unitId: UNIT.corporate,
  branchId: BR.lagos,
  issueDate: '2026-09-04',
  dueDate: '2026-10-04',
  subtotal: milestoneLines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
  discountAmount: 0 as Kobo,
  total: milestoneLines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
  paidAmount: 0 as Kobo,
  balance: milestoneLines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
  status: 'issued',
  daysOverdue: 0,
  issuedByUserId: U.chukwuemeka,
  voidedAt: null,
  voidReason: null,
  creditNoteIds: [],
  lines: milestoneLines,
  ...audit(at('2026-09-04', 11, 20), U.chukwuemeka),
})

accounts.push({
  id: milestoneAccount,
  ref: 'ACC-ORG-932',
  personId: null,
  organisationId: ORGS.sterling,
  unitId: UNIT.corporate,
  branchId: BR.lagos,
  originalFee: milestoneTotal,
  approvedDiscount: 0 as Kobo,
  netFee: milestoneTotal,
  invoicedTotal: milestoneTotal,
  paidTotal: 0 as Kobo,
  creditTotal: 0 as Kobo,
  refundedTotal: 0 as Kobo,
  balance: milestoneTotal,
  daysOverdue: 0,
  status: 'current',
  ...audit(at('2026-09-04', 11, 20), U.chukwuemeka),
})

const invoiceById = new Map<string, Invoice>(invoices.map((i) => [i.id, i]))

/* -------------------------------------------------------------------------- */
/* Payments                                                                   */
/* -------------------------------------------------------------------------- */

const METHODS: ReadonlyArray<readonly [PaymentMethod, number]> = [
  ['bank_transfer', 38],
  ['paystack_transfer', 24],
  ['paystack_card', 20],
  ['pos', 9],
  ['cash', 7],
  ['cheque', 2],
]

const payments: Payment[] = []
let payNumber = 1109 // PAY-1110 … PAY-1243. Flow 1 creates PAY-1244.

function nextPaymentRef(): string {
  payNumber += 1
  return `PAY-${payNumber}`
}

function allocation(invoiceId: Invoice['id'], amount: Kobo, when: string): PaymentAllocation {
  return { invoiceId, amount, allocatedAt: when, allocatedBy: U.ibrahim }
}

function pushPayment(args: {
  invoice: Invoice
  amount: Kobo
  receivedAt: string
  method?: PaymentMethod
}): Payment {
  const ref = nextPaymentRef()
  const id = asPaymentId(`pay-${ref.replace('PAY-', '')}`)
  const p: Payment = {
    id,
    ref,
    receivedAt: args.receivedAt,
    amount: args.amount,
    method: args.method ?? pick(r, METHODS.map(([m]) => m)),
    payerName: args.invoice.personId ? fullName(args.invoice.personId).toUpperCase() : 'STERLING BANK PLC',
    payerReference: `${args.invoice.ref.replace('INV-2026-', 'INV')}/${int(r, 10000, 99999)}`,
    personId: args.invoice.personId,
    organisationId: args.invoice.organisationId,
    unitId: args.invoice.unitId,
    branchId: args.invoice.branchId,
    status: 'matched',
    bankTransactionId: null,
    allocations: [allocation(args.invoice.id, args.amount, args.receivedAt)],
    unallocatedAmount: 0 as Kobo,
    receiptSentAt: at(args.receivedAt.slice(0, 10), 18, 0),
    reversedAt: null,
    reversalReason: null,
    daysUnmatched: 0,
    ...audit(args.receivedAt, U.ibrahim),
  }
  payments.push(p)
  return p
}

/* ── The two named accounts, paid by hand ───────────────────────────────── */

// Chiamaka: ₦405,000 in two instalments of ₦202,500. Balance ₦0.
const chiamakaInvoice = invoiceById.get(FLOW.chiamakaInvoice)
if (chiamakaInvoice) {
  pushPayment({ invoice: chiamakaInvoice, amount: ngn(202_500), receivedAt: '2026-08-09T10:14:00+01:00', method: 'bank_transfer' })
  pushPayment({ invoice: chiamakaInvoice, amount: ngn(202_500), receivedAt: '2026-09-08T09:47:00+01:00', method: 'bank_transfer' })
}

// Tunde Adeyemi: ₦330,000 of ₦450,000. **₦120,000 outstanding** — the blocker.
const tundeInvoice = invoiceById.get(FLOW.tundeInvoice)
if (tundeInvoice) {
  pushPayment({ invoice: tundeInvoice, amount: ngn(150_000), receivedAt: '2026-06-30T12:02:00+01:00', method: 'bank_transfer' })
  pushPayment({ invoice: tundeInvoice, amount: ngn(150_000), receivedAt: '2026-07-28T15:31:00+01:00', method: 'paystack_transfer' })
  pushPayment({ invoice: tundeInvoice, amount: ngn(30_000), receivedAt: '2026-08-26T11:09:00+01:00', method: 'pos' })
}

/* ── Everyone else ──────────────────────────────────────────────────────── */

/**
 * 134 payments in total: 119 matched, 9 unmatched, 4 possible matches and 2
 * reversed. Five matched payments are already written above (Chiamaka's two,
 * Tunde's three) and one more tops September up at the end, so the 94
 * remaining invoices carry 113 between them — 10 unpaid, 58 with one payment,
 * 23 with two, 3 with three. The stride below walks the plan as a permutation,
 * so the unpaid ones are scattered rather than clustered at one end.
 */
const PAYMENT_COUNT_PLAN: number[] = [
  ...Array.from({ length: 10 }, () => 0),
  ...Array.from({ length: 56 }, () => 1),
  ...Array.from({ length: 25 }, () => 2),
  ...Array.from({ length: 3 }, () => 3),
]

/**
 * The two named invoices are already settled above, and the Sterling milestone
 * is held back as the balancing instrument for September — it is paid once, at
 * the end of this file, for exactly the amount that lands the month's
 * collections on the dashboard figure.
 */
const remainingInvoices = invoices.filter(
  (i) => i.id !== FLOW.chiamakaInvoice && i.id !== FLOW.tundeInvoice && i.id !== 'inv-0932',
)

remainingInvoices.forEach((invoice, idx) => {
  // Deterministic spread: walk the plan with a stride so unpaid invoices are
  // not all clustered at one end of the list.
  const count = PAYMENT_COUNT_PLAN[(idx * 37) % PAYMENT_COUNT_PLAN.length]
  if (count === 0) return

  const corporate = invoice.organisationId !== null
  // Corporate invoices with a paid fraction settle to plan; everyone else
  // either clears the invoice or leaves a part balance.
  const spec = CORPORATE_SPECS.find((s) => `inv-${pad(s.n)}` === invoice.id)
  // Age matters. An invoice from last year has almost certainly been settled;
  // a September one is far more likely to be part-paid. That is what gives the
  // ageing buckets and the "outstanding across N students" figure real shape,
  // instead of scattering overdue balances evenly across three years.
  const ageDays = daysBetweenTodayAnd(invoice.issueDate)
  const clears = corporate
    ? spec
      ? spec.paidFraction === 1
      : chance(r, 0.4)
    : chance(r, ageDays > 150 ? 0.92 : ageDays > 60 ? 0.62 : 0.24)
  const targetPaid = (
    clears ? invoice.total : Math.round(invoice.total * (spec?.paidFraction ?? pick(r, [0.6, 0.7, 0.75, 0.8, 0.85, 0.9])))
  ) as Kobo
  if (targetPaid <= 0) return

  const parts = splitInstalments(targetPaid, count)
  parts.forEach((amount, i) => {
    if (amount <= 0) return
    const day = addDays(invoice.issueDate, 2 + i * int(r, 20, 34))
    // A payment can never be in the future. Fall back across the whole trailing
    // year rather than the last fortnight, or September collects everything.
    const receivedAt = at(day > TODAY ? daysAgo(int(r, 1, 250)) : day, int(r, 8, 19), int(r, 0, 59))
    pushPayment({ invoice, amount, receivedAt })
  })
})

/* ── Land September collections on the dashboard figure ─────────────────── */

/**
 * Two passes, both of which keep every payment a real allocation against a
 * real invoice:
 *
 *  1. **Spread.** Ageing puts a lot of instalments in September. Where a
 *     payment belongs to an invoice issued *before* September, its date is
 *     pulled back into the window between the issue date and 31 August — a
 *     legitimate date for that instalment — until the month is no longer
 *     over-collected. Nothing moves before its own invoice.
 *  2. **Top up.** One more Sterling Bank transfer against the milestone
 *     invoice closes the remaining gap, so **September matched collections
 *     total exactly ₦18,420,000.00**. A part payment on a corporate milestone
 *     is the most ordinary line in this ledger.
 *
 * The point is that the Home dashboard's headline reads off real allocations
 * rather than a constant, and still shows the number the spec quotes.
 */
const milestoneInvoice = invoiceById.get(asInvoiceId('inv-0932'))

const inSeptember = (p: Payment) => p.receivedAt.slice(0, 10) >= MTD_FROM && p.receivedAt.slice(0, 10) <= TODAY
const septemberTotal = () =>
  payments.filter((p) => p.status === 'matched' && inSeptember(p)).reduce((acc, p) => acc + p.amount, 0)

const dayGap = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)

let excess = septemberTotal() - TARGET_COLLECTED_MTD
if (excess > 0) {
  const movable = payments
    .filter((p) => p.status === 'matched' && inSeptember(p) && p.allocations.length === 1)
    .sort((a, b) => b.amount - a.amount)
  for (const p of movable) {
    if (excess <= 0) break
    const invoice = invoiceById.get(p.allocations[0].invoiceId)
    if (!invoice || invoice.issueDate >= MTD_FROM) continue
    const span = dayGap(invoice.issueDate, '2026-08-31')
    if (span < 1) continue
    const moved = at(addDays(invoice.issueDate, 1 + (p.amount % span)), int(r, 8, 18), int(r, 0, 59))
    p.receivedAt = moved
    p.allocations[0] = { ...p.allocations[0], allocatedAt: moved }
    p.receiptSentAt = at(moved.slice(0, 10), 18, 0)
    excess -= p.amount
  }
}

if (milestoneInvoice) {
  const topUp = Math.min(milestoneInvoice.total, Math.max(0, TARGET_COLLECTED_MTD - septemberTotal())) as Kobo
  if (topUp > 0) {
    pushPayment({
      invoice: milestoneInvoice,
      amount: topUp,
      receivedAt: '2026-09-15T13:22:00+01:00',
      method: 'bank_transfer',
    })
  }
}

/* ── The messy tail: 9 unmatched, 4 possible matches, 2 reversed ────────── */

const UNMATCHED_NARRATIONS: ReadonlyArray<readonly [string, number, string]> = [
  ['OKONKWO C  TRF', 202_500, 'Chiamaka Okonkwo'],
  ['TRF FRM ADAEZE NNAJI', 240_000, 'Adaeze Nnaji'],
  ['NIP/GTB/ 0912 TUITION', 150_000, 'Unknown payer'],
  ['MOB/TRF/SALAMI Y', 85_000, 'Y Salami'],
  ['USSD TRANSFER 8107442901', 120_000, 'Unknown payer'],
  ['TRF/ONYEKA K/CIRVEE', 420_000, 'K Onyeka'],
  ['POS SETTLEMENT 18/09', 97_500, 'POS settlement'],
  ['IBADAN ELECT DIST CO PART PYMT', 960_000, 'Ibadan Electricity Distribution Company'],
  ['TRF FROM MRS B UCHE FOR SON', 150_000, 'B Uche'],
]

UNMATCHED_NARRATIONS.forEach(([narration, amountNaira, payer], i) => {
  const ref = nextPaymentRef()
  payments.push({
    id: asPaymentId(`pay-${ref.replace('PAY-', '')}`),
    ref,
    receivedAt: at(daysAgo(int(r, 2, 21)), int(r, 8, 18), int(r, 0, 59)),
    amount: ngn(amountNaira),
    method: 'bank_transfer',
    payerName: payer,
    payerReference: narration,
    personId: null,
    organisationId: null,
    unitId: null,
    branchId: null,
    status: 'unmatched',
    bankTransactionId: bankTxnId(`btx-u${pad(i + 1, 2)}`),
    allocations: [],
    unallocatedAmount: ngn(amountNaira),
    receiptSentAt: null,
    reversedAt: null,
    reversalReason: null,
    daysUnmatched: int(r, 2, 21),
    ...audit(at(daysAgo(int(r, 2, 21)), 9, 0), U.ibrahim),
  })
})

const possibleMatchTargets = invoices.filter((i) => i.organisationId === null).slice(20, 24)
possibleMatchTargets.forEach((invoice, i) => {
  const ref = nextPaymentRef()
  const amount = Math.round(invoice.total / 2) as Kobo
  payments.push({
    id: asPaymentId(`pay-${ref.replace('PAY-', '')}`),
    ref,
    receivedAt: at(daysAgo(int(r, 1, 9)), int(r, 9, 17), int(r, 0, 59)),
    amount,
    method: 'bank_transfer',
    payerName: invoice.personId ? fullName(invoice.personId).toUpperCase() : 'UNKNOWN',
    payerReference: `TRF/${invoice.personId ? fullName(invoice.personId).split(' ')[1].toUpperCase() : 'NA'}/TUITION`,
    personId: null,
    organisationId: null,
    unitId: null,
    branchId: null,
    status: 'possible_match',
    bankTransactionId: bankTxnId(`btx-p${pad(i + 1, 2)}`),
    allocations: [],
    unallocatedAmount: amount,
    receiptSentAt: null,
    reversedAt: null,
    reversalReason: null,
    daysUnmatched: int(r, 1, 9),
    ...audit(at(daysAgo(int(r, 1, 9)), 9, 0), U.ibrahim),
  })
})

/** Two reversed payments — a failed cheque and a duplicated Paystack charge. */
const reversalTargets = invoices.filter((i) => i.organisationId === null).slice(30, 32)
reversalTargets.forEach((invoice, i) => {
  const ref = nextPaymentRef()
  const when = at(daysAgo(int(r, 25, 60)), 12, 0)
  payments.push({
    id: asPaymentId(`pay-${ref.replace('PAY-', '')}`),
    ref,
    receivedAt: when,
    amount: ngn(i === 0 ? 200_000 : 135_000),
    method: i === 0 ? 'cheque' : 'paystack_card',
    payerName: invoice.personId ? fullName(invoice.personId).toUpperCase() : 'UNKNOWN',
    payerReference: i === 0 ? 'CHQ 004182 ZENITH' : 'PSTK_REF_8841902',
    personId: invoice.personId,
    organisationId: null,
    unitId: invoice.unitId,
    branchId: invoice.branchId,
    status: 'reversed',
    bankTransactionId: null,
    allocations: [],
    unallocatedAmount: 0 as Kobo,
    receiptSentAt: null,
    reversedAt: at(addDays(when.slice(0, 10), 3), 10, 30),
    reversalReason: i === 0 ? 'Cheque returned unpaid — insufficient funds' : 'Duplicate Paystack charge, refunded at source',
    daysUnmatched: 0,
    ...audit(when, U.ibrahim),
  })
})

export { payments }

/* -------------------------------------------------------------------------- */
/* Reconcile: derive paidAmount, balance and status from the allocations      */
/* -------------------------------------------------------------------------- */

const paidByInvoice = new Map<string, number>()
for (const p of payments) {
  if (p.status !== 'matched') continue
  for (const a of p.allocations) {
    paidByInvoice.set(a.invoiceId, (paidByInvoice.get(a.invoiceId) ?? 0) + a.amount)
  }
}

for (const invoice of invoices) {
  const paid = (paidByInvoice.get(invoice.id) ?? 0) as Kobo
  invoice.paidAmount = paid
  invoice.balance = (invoice.total - paid) as Kobo
  const overdueDays = daysBetweenTodayAnd(invoice.dueDate)
  invoice.daysOverdue = invoice.balance > 0 && overdueDays > 0 ? overdueDays : 0
  invoice.status =
    invoice.balance <= 0
      ? 'paid'
      : invoice.daysOverdue > 0
        ? 'overdue'
        : paid > 0
          ? 'partially_paid'
          : 'issued'
}

/* One cancelled invoice and one already refunded, so every status exists. */
const cancelled = invoices.find(
  (i) => i.paidAmount === 0 && i.organisationId === null && i.issueDate < MTD_FROM && i.admissionId !== null,
)
if (cancelled) {
  cancelled.status = 'cancelled'
  cancelled.voidedAt = at(daysAgo(18), 16, 20)
  cancelled.voidReason = 'Raised against the wrong cohort. Re-issued as a new invoice — this one is voided, not edited.'
}

/* -------------------------------------------------------------------------- */
/* Credit notes and refunds                                                   */
/* -------------------------------------------------------------------------- */

const creditNotes: CreditNote[] = []
const refunds: Refund[] = []

const refundables = invoices.filter((i) => i.status === 'paid' && i.personId !== null && i.id !== FLOW.chiamakaInvoice)

/** Thirteen historical refunds. Flow 3 creates REF-0014. */
for (let i = 0; i < 13; i++) {
  const invoice = refundables[i % refundables.length]
  if (!invoice || !invoice.personId) continue
  const refundAmount = Math.round(invoice.total * pick(r, [0.25, 0.4, 0.5])) as Kobo
  const requestedDay = daysAgo(int(r, 12, 140))
  const status = i < 2 ? 'requested' : i === 2 ? 'rejected' : 'processed'
  refunds.push({
    id: asRefundId(`ref-${pad(i + 1, 4)}`),
    ref: `REF-${pad(i + 1, 4)}`,
    invoiceId: invoice.id,
    personId: invoice.personId,
    originalAmount: invoice.total,
    refundAmount,
    reason: pick(r, [
      'Withdrew after 2 weeks — pro-rata per policy',
      'Cohort cancelled by Cirvee — full pro-rata refund',
      'Duplicate payment refunded to source',
      'Medical withdrawal, supported by a letter',
    ]),
    requestedByUserId: U.ibrahim,
    approvalRequestId: approvalId(`apr-${pad(250 + i)}`),
    affectedCommissionIds: [],
    status,
    processedAt: status === 'processed' ? at(addDays(requestedDay, 4), 14, 0) : null,
    ...audit(at(requestedDay, 10, 0), U.ibrahim),
  })

  if (status === 'processed') {
    const cnId = asCreditNoteId(`cn-${pad(i + 1, 4)}`)
    creditNotes.push({
      id: cnId,
      ref: `CN-${pad(i + 1, 4)}`,
      invoiceId: invoice.id,
      amount: refundAmount,
      reason: 'Issued against the refund. The original invoice is unchanged.',
      unitId: invoice.unitId,
      approvalRequestId: approvalId(`apr-${pad(250 + i)}`),
      ...audit(at(addDays(requestedDay, 4), 14, 5), U.fatima),
    })
    invoice.creditNoteIds = [...invoice.creditNoteIds, cnId]
    invoice.status = 'refunded'
  }
}

/* Seven more standalone credit notes — goodwill adjustments, no refund. */
for (let i = 13; i < 20; i++) {
  const invoice = refundables[(i * 5) % refundables.length]
  if (!invoice) continue
  const cnId = asCreditNoteId(`cn-${pad(i + 1, 4)}`)
  creditNotes.push({
    id: cnId,
    ref: `CN-${pad(i + 1, 4)}`,
    invoiceId: invoice.id,
    amount: ngn(pick(r, [10_000, 15_000, 25_000, 40_000])),
    reason: pick(r, [
      'Goodwill adjustment — three sessions lost to a power outage',
      'Duplicate line on the original invoice',
      'Agreed reduction after the cohort start date moved',
    ]),
    unitId: invoice.unitId,
    approvalRequestId: null,
    ...audit(at(daysAgo(int(r, 10, 120)), 11, 0), U.fatima),
  })
  invoice.creditNoteIds = [...invoice.creditNoteIds, cnId]
}

export { creditNotes, refunds }

/* -------------------------------------------------------------------------- */
/* Account roll-up                                                            */
/* -------------------------------------------------------------------------- */

const accountById = new Map<string, CustomerAccount>(accounts.map((a) => [a.id, a]))
const creditByInvoice = new Map<string, number>()
for (const cn of creditNotes) creditByInvoice.set(cn.invoiceId, (creditByInvoice.get(cn.invoiceId) ?? 0) + cn.amount)
const refundByInvoice = new Map<string, number>()
for (const rf of refunds) {
  if (rf.status !== 'processed') continue
  refundByInvoice.set(rf.invoiceId, (refundByInvoice.get(rf.invoiceId) ?? 0) + rf.refundAmount)
}

for (const invoice of invoices) {
  const account = accountById.get(invoice.accountId)
  if (!account) continue
  account.paidTotal = (account.paidTotal + invoice.paidAmount) as Kobo
  account.creditTotal = (account.creditTotal + (creditByInvoice.get(invoice.id) ?? 0)) as Kobo
  account.refundedTotal = (account.refundedTotal + (refundByInvoice.get(invoice.id) ?? 0)) as Kobo
}

for (const account of accounts) {
  account.balance = (account.invoicedTotal - account.paidTotal - account.creditTotal + account.refundedTotal) as Kobo
  const overdue = invoices.filter((i) => i.accountId === account.id).reduce((acc, i) => Math.max(acc, i.daysOverdue), 0)
  account.daysOverdue = account.balance > 0 ? overdue : 0
  account.status =
    account.balance < 0
      ? 'in_credit'
      : account.balance === 0
        ? 'settled'
        : account.daysOverdue > 0
          ? 'overdue'
          : 'current'
}

export { accounts, invoices }

/* -------------------------------------------------------------------------- */
/* Bank feed — raw, ugly narrations                                           */
/* -------------------------------------------------------------------------- */

const bankTransactions: BankTransaction[] = []
let running = ngn(31_205_000)
let btxSeq = 0

function pushBankTxn(args: {
  id: string
  bank: BankTransaction['bank']
  date: string
  narration: string
  credit: Kobo | null
  debit: Kobo | null
  reference: string
  matchStatus: BankTransaction['matchStatus']
  paymentId: BankTransaction['paymentId']
  daysUnmatched: number
  candidates?: BankTransaction['candidates']
}) {
  running = (running + (args.credit ?? 0) - (args.debit ?? 0)) as Kobo
  bankTransactions.push({
    id: bankTxnId(args.id),
    bank: args.bank,
    accountLast4: args.bank === 'Zenith' ? '4471' : args.bank === 'GTBank' ? '9028' : '1163',
    date: args.date,
    narration: args.narration,
    credit: args.credit,
    debit: args.debit,
    runningBalance: running,
    reference: args.reference,
    matchStatus: args.matchStatus,
    paymentId: args.paymentId,
    daysUnmatched: args.daysUnmatched,
    candidates: args.candidates ?? [],
    ...audit(at(args.date, 23, 55), U.ibrahim),
  })
}

/**
 * Flow 1 step 18 looks for these two by name. They are the payments Chiamaka
 * will make against the invoice the reviewer is about to create, so they carry
 * no match candidates yet — the reconciliation screen scores them live.
 */
pushBankTxn({
  id: 'btx-f001',
  bank: 'Zenith',
  date: daysAgo(2),
  narration: 'TRF/CHIAMAKA OKONKWO/DATA ANALYSIS',
  credit: ngn(202_500),
  debit: null,
  reference: 'ZEN/NIP/20260918/884120',
  matchStatus: 'unmatched',
  paymentId: null,
  daysUnmatched: 2,
})
pushBankTxn({
  id: 'btx-f002',
  bank: 'Zenith',
  date: daysAgo(1),
  narration: 'TRF/CHIAMAKA OKONKWO/DATA ANALYSIS 2ND INST',
  credit: ngn(202_500),
  debit: null,
  reference: 'ZEN/NIP/20260919/884377',
  matchStatus: 'unmatched',
  paymentId: null,
  daysUnmatched: 1,
})

/* The nine genuinely unmatched credits, mirrored from the payments above. */
UNMATCHED_NARRATIONS.forEach(([narration, amountNaira], i) => {
  const payment = payments.find((p) => p.bankTransactionId === `btx-u${pad(i + 1, 2)}`)
  pushBankTxn({
    id: `btx-u${pad(i + 1, 2)}`,
    bank: i % 3 === 0 ? 'Zenith' : i % 3 === 1 ? 'GTBank' : 'Providus',
    date: payment?.receivedAt.slice(0, 10) ?? daysAgo(6),
    narration,
    credit: ngn(amountNaira),
    debit: null,
    reference: `REF${int(r, 100000, 999999)}`,
    matchStatus: 'unmatched',
    paymentId: payment?.id ?? null,
    daysUnmatched: payment?.daysUnmatched ?? 6,
  })
})

/* The four possible matches, with scored candidates and stated reasons. */
possibleMatchTargets.forEach((invoice, i) => {
  const payment = payments.find((p) => p.bankTransactionId === `btx-p${pad(i + 1, 2)}`)
  const surname = invoice.personId ? fullName(invoice.personId).split(' ')[1].toUpperCase() : 'NA'
  pushBankTxn({
    id: `btx-p${pad(i + 1, 2)}`,
    bank: 'GTBank',
    date: payment?.receivedAt.slice(0, 10) ?? daysAgo(4),
    narration: `NIP/TRF/${surname}/${invoice.ref.replace('INV-2026-', '')}`,
    credit: payment?.amount ?? (Math.round(invoice.total / 2) as Kobo),
    debit: null,
    reference: `GTB/NIP/${int(r, 100000, 999999)}`,
    matchStatus: 'possible_match',
    paymentId: payment?.id ?? null,
    daysUnmatched: payment?.daysUnmatched ?? 4,
    candidates: [
      {
        invoiceId: invoice.id,
        score: 74 + i * 4,
        reasons: ['payer surname matches', `reference contains ${invoice.ref}`, 'within date window', 'amount matches instalment 1'],
      },
    ],
  })
})

/* A settled history so the feed looks like a bank statement, not a demo. */
const bankBackedPayments = payments.filter(
  (p) => p.status === 'matched' && (p.method === 'bank_transfer' || p.method === 'paystack_transfer' || p.method === 'cheque'),
)
for (const p of bankBackedPayments) {
  btxSeq += 1
  pushBankTxn({
    id: `btx-${pad(btxSeq, 4)}`,
    bank: btxSeq % 3 === 0 ? 'Providus' : btxSeq % 2 === 0 ? 'GTBank' : 'Zenith',
    date: p.receivedAt.slice(0, 10),
    narration: `TRF/${p.payerName}/${p.payerReference}`,
    credit: p.amount,
    debit: null,
    reference: p.payerReference,
    matchStatus: 'matched',
    paymentId: p.id,
    daysUnmatched: 0,
  })
  p.bankTransactionId = bankTxnId(`btx-${pad(btxSeq, 4)}`)
}

/* Outgoings, so the running balance moves in both directions. */
const DEBIT_NARRATIONS = [
  ['IBEDC PREPAID TOKEN BODIJA', 340_000],
  ['STAFF SALARY BATCH SEP 2026', 19_220_000],
  ['MTN DATA BUNDLE - CAMPUS', 180_000],
  ['ZENITH COMMISSION ON TURNOVER', 12_400],
  ['GENERATOR DIESEL - 400L', 620_000],
  ['REFERRAL PAYOUT BATCH PAY-B-2026-017', 1_120_000],
] as const

DEBIT_NARRATIONS.forEach(([narration, amountNaira], i) => {
  btxSeq += 1
  pushBankTxn({
    id: `btx-${pad(btxSeq, 4)}`,
    bank: 'Zenith',
    date: daysAgo(4 + i * 3),
    narration,
    credit: null,
    debit: ngn(amountNaira),
    reference: `ZEN/DR/${int(r, 100000, 999999)}`,
    matchStatus: 'ignored',
    paymentId: null,
    daysUnmatched: 0,
  })
})

export { bankTransactions }

/* -------------------------------------------------------------------------- */
/* Expenses                                                                   */
/* -------------------------------------------------------------------------- */

const EXPENSE_CATEGORIES: ReadonlyArray<readonly [string, string, number, number]> = [
  ['Utilities', 'Ibadan Electricity Distribution Company', 180_000, 420_000],
  ['Facilities', 'Bodija Facility Services Ltd', 90_000, 260_000],
  ['Diesel & power', 'Rainoil Ibadan', 240_000, 680_000],
  ['Internet & data', 'MTN Nigeria', 120_000, 310_000],
  ['Marketing', 'Meta Platforms Ireland', 250_000, 1_400_000],
  ['Equipment', 'Slot Systems Limited', 180_000, 2_100_000],
  ['Tutor fees (contract)', 'Contract faculty pool', 150_000, 900_000],
  ['Refreshments', 'Bodija Catering', 40_000, 160_000],
  ['Software', 'Microsoft Nigeria', 90_000, 640_000],
  ['Travel', 'Air Peace', 120_000, 480_000],
]

const EXPENSE_UNITS = [UNIT.academy, UNIT.academy, UNIT.academy, UNIT.teens, UNIT.corporate, UNIT.dexurb, UNIT.africa, UNIT.tcf]

export const expenses: Expense[] = Array.from({ length: 86 }, (_, i) => {
  const [category, vendor, lo, hi] = EXPENSE_CATEGORIES[i % EXPENSE_CATEGORIES.length]
  const date = daysAgo(int(r, 0, 150))
  const amount = ngn(int(r, lo, hi))
  const status: Expense['status'] =
    i % 17 === 0 ? 'pending_approval' : i % 23 === 0 ? 'rejected' : i % 5 === 0 ? 'approved' : 'paid'
  return {
    id: asExpenseId(`exp-${pad(i + 1, 4)}`),
    ref: `EXP-2026-${pad(i + 1, 4)}`,
    date,
    category,
    vendor,
    amount,
    unitId: EXPENSE_UNITS[i % EXPENSE_UNITS.length],
    branchId: i % 4 === 0 ? BR.lagos : BR.ibadan,
    requesterUserId: [U.emeka, U.damilola, U.amarachi, U.folake, U.yetunde][i % 5],
    approvalRequestId: amount > ngn(100_000) ? approvalId(`apr-${pad(296 + (i % 15))}`) : null,
    status,
    paidDate: status === 'paid' ? addDays(date, int(r, 1, 9)) : null,
    receiptUrl: status === 'rejected' ? null : `/receipts/exp-${pad(i + 1, 4)}.pdf`,
    budgetLine: `${category} — FY2026`,
    ...audit(at(date, int(r, 9, 17), int(r, 0, 59)), U.emeka),
  }
})

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const FINANCE_COUNTS = {
  invoices: invoices.length,
  payments: payments.length,
  accounts: accounts.length,
  bankTransactions: bankTransactions.length,
  expenses: expenses.length,
  refunds: refunds.length,
  creditNotes: creditNotes.length,
} as const

/** Seeded, not derived — there is no cash-book in the prototype. */
export const CASH_POSITION = ngn(31_205_000)

void admissionById
void commissionId
void P
