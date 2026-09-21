import { useMemo, useState } from 'react'
import { Ban, FileMinus, Landmark, Receipt, Undo2 } from 'lucide-react'

import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Checkbox,
  CurrencyInput,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  Select,
  Textarea,
  UnitTag,
} from '@/ui'
import {
  TODAY,
  branchesCollection,
  invoicesCollection,
  unitsCollection,
  useCollection,
} from '@/mocks'
import type { Expense, Invoice, Payment } from '@/mocks'

import { personName, unitKey } from './shared'
import {
  commissionImpactOfRefund,
  createExpense,
  createRefund,
  issueCreditNote,
  previewRefundRoute,
  recordManualPayment,
  voidInvoice,
  type RefundResult,
} from './writes'

const MIN_REASON = 8

function useUnitOptions() {
  const units = useCollection(unitsCollection)
  return useMemo(() => units.map((u) => ({ value: u.id as string, label: u.name })), [units])
}

function useBranchOptions() {
  const branches = useCollection(branchesCollection)
  return useMemo(() => branches.map((b) => ({ value: b.id as string, label: b.name })), [branches])
}

export function CreditNoteModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const value = amount ?? 0
  const amountError =
    value <= 0
      ? 'Enter an amount greater than zero.'
      : invoice && value > invoice.total
        ? `A credit note cannot exceed the invoice total of ${formatNaira(invoice.total)}.`
        : undefined
  const reasonError =
    reason.trim().length < MIN_REASON ? 'Give a reason of at least eight characters. It is written into the record.' : undefined
  const valid = !amountError && !reasonError

  function reset() {
    setAmount(null)
    setReason('')
    setTouched(false)
  }

  return (
    <Modal
      open={invoice !== null}
      onClose={() => {
        reset()
        onClose()
      }}
      title={invoice ? `Issue a credit note against ${invoice.ref}` : ''}
      description="The invoice is never edited. A credit note is its own record, linked to the original and listed beneath it."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            leftIcon={<FileMinus size={16} />}
            onClick={() => {
              setTouched(true)
              if (!invoice || !valid) return
              const note = issueCreditNote({ invoice, amount: value, reason: reason.trim() })
              reset()
              onDone(
                `${note.ref} created for ${formatNaira(note.amount)} against ${invoice.ref}. The invoice keeps its ${formatNaira(invoice.total)} total and every line it had.`,
              )
              onClose()
            }}
          >
            Create credit note
          </Button>
        </>
      }
    >
      {invoice && (
        <div className="flex flex-col gap-4">
          <KeyValueList columns={2}>
            <KeyValue label="Invoice total" divided>
              <span className="tabular-nums">{formatNaira(invoice.total)}</span>
            </KeyValue>
            <KeyValue label="Already paid" divided>
              <span className="tabular-nums">{formatNaira(invoice.paidAmount)}</span>
            </KeyValue>
            <KeyValue label="Balance" divided>
              <span className="tabular-nums">{formatNaira(invoice.balance)}</span>
            </KeyValue>
            <KeyValue label="Unit" divided>
              {(() => {
                const key = unitKey(invoice.unitId)
                return key ? <UnitTag unit={key} size="sm" /> : 'Unassigned'
              })()}
            </KeyValue>
          </KeyValueList>

          <Field label="Credit amount" required error={touched ? amountError : undefined}>
            <CurrencyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Reason" required error={touched || reason.length > 0 ? reasonError : undefined}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={240}
              showCount
              placeholder="Three sessions were lost to a power outage and the fee was reduced by agreement."
            />
          </Field>

          <Alert tone="info" title="What this writes">
            One new credit note. The invoice gains a link to it and nothing else — no amount, no line and no payment on{' '}
            {invoice.ref} changes.
          </Alert>
        </div>
      )}
    </Modal>
  )
}

export function RefundModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice | null
  onClose: () => void
  onDone: (result: RefundResult, message: string) => void
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [excluded, setExcluded] = useState<string[]>([])
  const [touched, setTouched] = useState(false)

  const value = amount ?? 0
  const impacts = invoice ? commissionImpactOfRefund(invoice, value) : []
  const route = previewRefundRoute(value)
  const impactLines = invoice ? refundPreviewLines(invoice, value, impacts) : []

  const amountError =
    value <= 0
      ? 'Enter an amount greater than zero.'
      : invoice && value > invoice.paidAmount
        ? `Only ${formatNaira(invoice.paidAmount)} has been received against this invoice. A refund cannot exceed it.`
        : undefined
  const reasonError =
    reason.trim().length < MIN_REASON ? 'Give a reason of at least eight characters. It is written into the record.' : undefined
  const valid = !amountError && !reasonError

  function reset() {
    setAmount(null)
    setReason('')
    setExcluded([])
    setTouched(false)
  }

  return (
    <Modal
      open={invoice !== null}
      onClose={() => {
        reset()
        onClose()
      }}
      title={invoice ? `Refund against ${invoice.ref}` : ''}
      description="A refund is a new record. The invoice, its lines and the payments already applied to it are left exactly as they are."
      size="xl"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            leftIcon={<Undo2 size={16} />}
            onClick={() => {
              setTouched(true)
              if (!invoice || !valid) return
              const result = createRefund({
                invoice,
                refundAmount: value,
                reason: reason.trim(),
                reverseCommissionIds: impacts
                  .filter((impact) => !excluded.includes(impact.commission.id))
                  .map((impact) => impact.commission.id),
              })
              reset()
              onDone(
                result,
                `${result.refund.ref} raised for ${formatNaira(result.refund.refundAmount)}, credit note ${result.creditNote.ref} issued, approval ${result.approval.ref} routed${
                  result.reversals.length > 0
                    ? `, ${formatNumber(result.reversals.length)} commission reversal${result.reversals.length === 1 ? '' : 's'} created`
                    : ''
                }. ${invoice.ref} is unchanged.`,
              )
              onClose()
            }}
          >
            Raise refund
          </Button>
        </>
      }
    >
      {invoice && (
        <div className="flex flex-col gap-5">
          <KeyValueList columns={2}>
            <KeyValue label="Invoice total" divided>
              <span className="tabular-nums">{formatNaira(invoice.total)}</span>
            </KeyValue>
            <KeyValue label="Received" divided>
              <span className="tabular-nums">{formatNaira(invoice.paidAmount)}</span>
            </KeyValue>
            <KeyValue label="Customer" divided>
              {invoice.organisationId ? 'Organisation account' : personName(invoice.personId)}
            </KeyValue>
          </KeyValueList>

          <Field label="Refund amount" required error={touched ? amountError : undefined}>
            <CurrencyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Reason" required error={touched || reason.length > 0 ? reasonError : undefined}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={240}
              showCount
              placeholder="Withdrew after two weeks — pro-rata per policy."
            />
          </Field>

          {/* ---- impact preview, before the decision, not after ---- */}
          <section className="rounded-xl border border-border p-4">
            <h3 className="text-label-11 text-text-muted">What this will do</h3>
            {value <= 0 ? (
              <p className="mt-2 text-body-13 text-text-secondary">Enter an amount to see the downstream effects.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {impactLines.map((line) => (
                  <li key={line} className="text-body-13 text-text-secondary">
                    {line}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ---- the commission cascade ---- */}
          {impacts.length > 0 && (
            <section className="rounded-xl border border-warning-line bg-warning-fill p-4">
              <h3 className="text-label-11 text-warning-ink">Commission cascade</h3>
              <p className="mt-1 text-body-13 text-warning-ink">
                This invoice earned {formatNumber(impacts.length)} commission
                {impacts.length === 1 ? '' : 's'}. Reversing one creates a new negative commission pointing back at the
                original; the original keeps its amount, its state and its payout batch.
              </p>
              <ul className="mt-3 space-y-2">
                {impacts.map((impact) => (
                  <li key={impact.commission.id} className="rounded-lg border border-warning-line bg-surface p-3">
                    <Checkbox
                      checked={!excluded.includes(impact.commission.id)}
                      onChange={() =>
                        setExcluded((prev) =>
                          prev.includes(impact.commission.id)
                            ? prev.filter((id) => id !== impact.commission.id)
                            : [...prev, impact.commission.id],
                        )
                      }
                      label={`Reverse ${impact.commission.ref} — ${formatNaira(impact.reversalAmount)} of ${formatNaira(impact.commission.amount)}`}
                    />
                    <p className="mt-1 pl-7 text-body-12 text-text-secondary">
                      State {impact.commission.state}.
                      {impact.alreadyPaid
                        ? ' Already paid. Whether the reversal is deducted from the next payout or raised as a receivable is a policy decision — this prototype records the reversal and does not choose between them.'
                        : ' Not yet paid, so the reversal simply reduces what becomes payable.'}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---- the live approval route ---- */}
          <section className="rounded-xl border border-border p-4">
            <h3 className="text-label-11 text-text-muted">Approval route, at this amount</h3>
            {route.length === 0 ? (
              <p className="mt-2 text-body-13 text-text-secondary">
                No refund route is configured. The request will be raised with no approver, which is itself worth fixing in
                Settings.
              </p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {route.map((step) => (
                  <li key={step.sequence} className="flex flex-wrap items-center gap-2 text-body-13">
                    <Badge tone="neutral" size="sm">
                      Step {step.sequence}
                    </Badge>
                    <span className="text-text">{step.approverRole}</span>
                    <span className="text-text-secondary">{step.thresholdLabel}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-2 text-body-12 text-text-secondary">
              The chain re-renders as the amount crosses a band. Raising the refund creates a real approval request you can
              open in Work &amp; approvals.
            </p>
          </section>
        </div>
      )}
    </Modal>
  )
}

function refundPreviewLines(
  invoice: Invoice,
  refundAmount: number,
  impacts: ReturnType<typeof commissionImpactOfRefund>,
): string[] {
  const lines = [
    `Credit ${formatNaira(refundAmount)} against ${invoice.ref}. The invoice keeps its ${formatNaira(invoice.total)} total and every line it had — the credit note is a separate record.`,
  ]
  for (const impact of impacts) {
    lines.push(
      `Reverse ${impact.commission.ref} proportionally: ${formatNaira(impact.reversalAmount)} of ${formatNaira(impact.commission.amount)}.`,
    )
  }
  lines.push(`Reduce collected revenue by ${formatNaira(refundAmount)}. Invoiced revenue is never netted down against it.`)
  lines.push('Leave sales attribution unchanged — referrer, lead owner and closer are not altered by a refund.')
  return lines
}

export function VoidInvoiceModal({
  invoice,
  onClose,
  onDone,
}: {
  invoice: Invoice | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const reasonError = reason.trim().length < MIN_REASON ? 'Say why. The reason stays on the record permanently.' : undefined

  return (
    <Modal
      open={invoice !== null}
      onClose={() => {
        setReason('')
        setTouched(false)
        onClose()
      }}
      title={invoice ? `Void ${invoice.ref}` : ''}
      description="Voiding does not delete anything. A credit note is raised for the outstanding value and the invoice stays visible with its reason recorded."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              setReason('')
              setTouched(false)
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            leftIcon={<Ban size={16} />}
            onClick={() => {
              setTouched(true)
              if (!invoice || reasonError) return
              const note = voidInvoice(invoice, reason.trim())
              setReason('')
              setTouched(false)
              onDone(`${invoice.ref} voided. Credit note ${note.ref} raised for ${formatNaira(note.amount)}. Nothing was deleted.`)
              onClose()
            }}
          >
            Void invoice
          </Button>
        </>
      }
    >
      {invoice && (
        <div className="flex flex-col gap-4">
          <Alert tone="warning" title="What this will do">
            {invoice.ref} moves to Cancelled and a credit note for {formatNaira(invoice.total - invoice.paidAmount)} is
            raised. The lines, the total and every payment already applied stay exactly as they are.
          </Alert>
          <Field label="Reason" required error={touched || reason.length > 0 ? reasonError : undefined}>
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              maxLength={240}
              showCount
              placeholder="Raised against the wrong cohort. Re-issued as a new invoice."
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

const METHODS: Array<{ value: Payment['method']; label: string }> = [
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'pos', label: 'POS' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'paystack_card', label: 'Paystack card' },
  { value: 'paystack_transfer', label: 'Paystack transfer' },
]

export function ManualPaymentModal({
  open,
  invoice,
  onClose,
  onDone,
}: {
  open: boolean
  invoice?: Invoice | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const invoices = useCollection(invoicesCollection)
  const unitOptions = useUnitOptions()
  const branchOptions = useBranchOptions()

  const [amount, setAmount] = useState<number | null>(null)
  const [method, setMethod] = useState<Payment['method']>('cash')
  const [payerName, setPayerName] = useState('')
  const [payerReference, setPayerReference] = useState('')
  const [receivedOn, setReceivedOn] = useState(TODAY)
  const [unitId, setUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [invoiceId, setInvoiceId] = useState('')
  const [touched, setTouched] = useState(false)

  const target = invoice ?? invoices.find((i) => i.id === invoiceId) ?? null
  const effectiveUnit = unitId || target?.unitId || ''
  const effectiveBranch = branchId || target?.branchId || ''
  const value = amount ?? 0

  const openInvoices = useMemo(
    () =>
      invoices
        .filter((i) => i.balance > 0 && i.status !== 'cancelled')
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 80),
    [invoices],
  )

  const amountError = value <= 0 ? 'Enter the amount received.' : undefined
  const payerError = payerName.trim().length < 2 ? 'Name the payer. This is what reconciliation matches against later.' : undefined
  const unitError = effectiveUnit
    ? undefined
    : 'A unit tag is required on every payment. Unit P&L is only trustworthy because nothing is left untagged.'
  const branchError = effectiveBranch ? undefined : 'Pick the branch that received the money.'
  const overAllocated = target !== null && value > target.balance
  const valid = !amountError && !payerError && !unitError && !branchError

  function reset() {
    setAmount(null)
    setMethod('cash')
    setPayerName('')
    setPayerReference('')
    setReceivedOn(TODAY)
    setUnitId('')
    setBranchId('')
    setInvoiceId('')
    setTouched(false)
  }

  const allocation = target ? Math.min(value, target.balance) : 0
  const surplus = value - allocation

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Record a payment"
      description="Money that arrived outside the bank feed — cash at the desk, a POS terminal, a cheque. Anything not allocated stays visible rather than being spread onto a guess."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            leftIcon={<Landmark size={16} />}
            onClick={() => {
              setTouched(true)
              if (!valid) return
              const payment = recordManualPayment({
                amount: value,
                method,
                payerName: payerName.trim(),
                payerReference: payerReference.trim(),
                receivedAt: `${receivedOn}T10:00:00+01:00`,
                unitId: effectiveUnit,
                branchId: effectiveBranch,
                allocations: target && allocation > 0 ? [{ invoiceId: target.id, amount: allocation }] : [],
              })
              reset()
              onDone(
                target && allocation > 0
                  ? `${payment.ref} recorded for ${formatNaira(payment.amount)}. ${formatNaira(allocation)} applied to ${target.ref}${payment.unallocatedAmount > 0 ? `, ${formatNaira(payment.unallocatedAmount)} held as an unallocated credit` : ''}.`
                  : `${payment.ref} recorded for ${formatNaira(payment.amount)} and left unmatched. It stays in the reconciliation queue until somebody says whose money it is.`,
              )
              onClose()
            }}
          >
            Record payment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received" required error={touched ? amountError : undefined}>
            <CurrencyInput value={amount} onChange={setAmount} />
          </Field>
          <Field label="Method" required>
            <Select value={method} options={METHODS} onChange={(event) => setMethod(event.target.value as Payment['method'])} />
          </Field>
          <Field label="Payer name" required error={touched ? payerError : undefined}>
            <Input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Name on the receipt" />
          </Field>
          <Field label="Payer reference" hint="The teller slip or POS reference, if there is one.">
            <Input value={payerReference} onChange={(event) => setPayerReference(event.target.value)} />
          </Field>
          <Field label="Received on" required>
            <Input type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
          </Field>
          {!invoice && (
            <Field label="Apply to invoice" hint="Leave empty to record the money and resolve it in reconciliation.">
              <Select
                value={invoiceId}
                placeholder="Leave unmatched"
                options={openInvoices.map((i) => ({
                  value: i.id as string,
                  label: `${i.ref} — ${i.organisationId ? 'Organisation account' : personName(i.personId)} · ${formatNaira(i.balance)} outstanding`,
                }))}
                onChange={(event) => setInvoiceId(event.target.value)}
              />
            </Field>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Unit"
            required
            hint="Required on every invoice, expense and payroll allocation — never optional metadata."
            error={touched ? unitError : undefined}
          >
            <Select
              value={effectiveUnit}
              placeholder="Pick a unit"
              options={unitOptions}
              onChange={(event) => setUnitId(event.target.value)}
            />
          </Field>
          <Field label="Branch" required error={touched ? branchError : undefined}>
            <Select
              value={effectiveBranch}
              placeholder="Pick a branch"
              options={branchOptions}
              onChange={(event) => setBranchId(event.target.value)}
            />
          </Field>
        </div>

        {target && (
          <Alert tone={overAllocated ? 'warning' : 'info'} title={`Allocation against ${target.ref}`}>
            {formatNaira(allocation)} of {formatNaira(value)} applies to a balance of {formatNaira(target.balance)}.
            {surplus > 0
              ? ` ${formatNaira(surplus)} is held on the payment as an unallocated credit — it is not spread across other invoices.`
              : ' Nothing is left over.'}
          </Alert>
        )}
      </div>
    </Modal>
  )
}

const CATEGORY_FALLBACK = [
  'Rent',
  'Utilities',
  'Tutor fees',
  'Marketing',
  'Software',
  'Internet',
  'Equipment',
  'Travel',
]

export function NewExpenseModal({
  open,
  existing,
  onClose,
  onDone,
}: {
  open: boolean
  existing: Expense[]
  onClose: () => void
  onDone: (message: string) => void
}) {
  const unitOptions = useUnitOptions()
  const branchOptions = useBranchOptions()

  const categories = useMemo(() => {
    const seen = [...new Set(existing.map((e) => e.category))].sort()
    return (seen.length > 0 ? seen : CATEGORY_FALLBACK).map((c) => ({ value: c, label: c }))
  }, [existing])
  const budgetLines = useMemo(
    () => [...new Set(existing.map((e) => e.budgetLine))].filter(Boolean).sort(),
    [existing],
  )

  const [date, setDate] = useState(TODAY)
  const [category, setCategory] = useState('')
  const [vendor, setVendor] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [unitId, setUnitId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [budgetLine, setBudgetLine] = useState('')
  const [receiptAttached, setReceiptAttached] = useState(false)
  const [submitForApproval, setSubmitForApproval] = useState(true)
  const [touched, setTouched] = useState(false)

  const value = amount ?? 0
  const categoryError = category ? undefined : 'Pick a category. Expenses by category is the only view that makes costs legible.'
  const vendorError = vendor.trim().length < 2 ? 'Name the vendor.' : undefined
  const amountError = value <= 0 ? 'Enter the amount.' : undefined
  const unitError = unitId
    ? undefined
    : 'A unit tag is required on every expense. Without it the unit P&L silently overstates margin.'
  const branchError = branchId ? undefined : 'Pick the branch this cost belongs to.'
  const budgetError = budgetLine.trim().length < 2 ? 'Name the budget line this draws against.' : undefined
  const valid = !categoryError && !vendorError && !amountError && !unitError && !branchError && !budgetError

  function reset() {
    setDate(TODAY)
    setCategory('')
    setVendor('')
    setAmount(null)
    setUnitId('')
    setBranchId('')
    setBudgetLine('')
    setReceiptAttached(false)
    setSubmitForApproval(true)
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New expense"
      description="Every cost carries the unit it belonged to. That single field is why unit P&L can be trusted at all."
      size="lg"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button
            leftIcon={<Receipt size={16} />}
            onClick={() => {
              setTouched(true)
              if (!valid) return
              const expense = createExpense({
                date,
                category,
                vendor: vendor.trim(),
                amount: value,
                unitId,
                branchId,
                budgetLine: budgetLine.trim(),
                receiptAttached,
                submitForApproval,
              })
              reset()
              onDone(
                `${expense.ref} created for ${formatNaira(expense.amount)} against ${budgetLine.trim()}${
                  submitForApproval ? ' and submitted for approval' : ' as a draft'
                }.`,
              )
              onClose()
            }}
          >
            Create expense
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Category" required error={touched ? categoryError : undefined}>
            <Select
              value={category}
              placeholder="Pick a category"
              options={categories}
              onChange={(event) => setCategory(event.target.value)}
            />
          </Field>
          <Field label="Vendor" required error={touched ? vendorError : undefined}>
            <Input value={vendor} onChange={(event) => setVendor(event.target.value)} placeholder="Who was paid" />
          </Field>
          <Field label="Amount" required error={touched ? amountError : undefined}>
            <CurrencyInput value={amount} onChange={setAmount} />
          </Field>
          <Field
            label="Unit"
            required
            hint="Required. An untagged cost is invisible to unit P&L."
            error={touched ? unitError : undefined}
          >
            <Select value={unitId} placeholder="Pick a unit" options={unitOptions} onChange={(event) => setUnitId(event.target.value)} />
          </Field>
          <Field label="Branch" required error={touched ? branchError : undefined}>
            <Select
              value={branchId}
              placeholder="Pick a branch"
              options={branchOptions}
              onChange={(event) => setBranchId(event.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Budget line"
          required
          hint={budgetLines.length > 0 ? `Existing lines include ${budgetLines.slice(0, 3).join(', ')}.` : undefined}
          error={touched ? budgetError : undefined}
        >
          <Input value={budgetLine} onChange={(event) => setBudgetLine(event.target.value)} list="finance-budget-lines" />
        </Field>
        <datalist id="finance-budget-lines">
          {budgetLines.map((line) => (
            <option key={line} value={line} />
          ))}
        </datalist>

        <div className="flex flex-col gap-2">
          <Checkbox
            checked={receiptAttached}
            onChange={(event) => setReceiptAttached(event.target.checked)}
            label="A receipt is attached"
          />
          <Checkbox
            checked={submitForApproval}
            onChange={(event) => setSubmitForApproval(event.target.checked)}
            label="Submit for approval now"
          />
        </div>

        <Alert tone="info" title="Recorded as of">
          {formatDate(date)}. Nothing is paid by creating this record — an expense becomes Paid only after approval and a
          payment run.
        </Alert>
      </div>
    </Modal>
  )
}
