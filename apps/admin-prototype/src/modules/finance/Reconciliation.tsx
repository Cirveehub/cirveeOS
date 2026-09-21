import { useMemo, useState } from 'react'
import { CheckCircle2, CircleSlash, Inbox, Link2Off, ShieldAlert, Split, ThumbsDown } from 'lucide-react'

import { formatDate, formatNaira, formatNumber, formatPercent } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  CurrencyInput,
  DataTable,
  EmptyState,
  Field,
  KeyValue,
  KeyValueList,
  Modal,
  MoneyCell,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  UnitTag,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  TODAY,
  asKobo,
  bankTransactionsCollection,
  invoicesCollection,
  nextId,
  paymentsCollection,
  useCollection,
} from '@/mocks'
import type { BankMatchCandidate, BankTransaction, Invoice, Payment } from '@/mocks'
import { paymentId as makePaymentId } from '@/mocks/types'

import { FINANCE_TABS, Page, ScreenError, personName, unitKey, useModuleNav, useScreenState } from './shared'

const NOW = `${TODAY}T11:20:00+01:00`

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

interface Allocation {
  invoiceId: string
  amount: number
}

/**
 * The one write on this screen. A confirmed match creates a payment, applies
 * its allocations to the invoices, and links the bank transaction to it.
 * Nothing is edited in place and nothing is deleted: the bank row keeps its
 * narration and gains a payment reference.
 */
function settle(transaction: BankTransaction, allocations: Allocation[]) {
  const credit = transaction.credit ?? 0
  const applied = allocations.filter((a) => a.amount > 0)
  const allocatedTotal = applied.reduce((acc, a) => acc + a.amount, 0)
  const first = applied[0] ? invoicesCollection.find(applied[0].invoiceId) : undefined

  const payment: Payment = {
    id: makePaymentId(nextId('pay', 2000)),
    ref: nextId('PAY', 1400),
    receivedAt: `${transaction.date}T09:00:00+01:00`,
    amount: asKobo(credit),
    method: 'bank_transfer',
    payerName: transaction.narration.slice(0, 48),
    payerReference: transaction.reference,
    personId: first?.personId ?? null,
    organisationId: first?.organisationId ?? null,
    unitId: first?.unitId ?? null,
    branchId: first?.branchId ?? null,
    status: 'matched',
    bankTransactionId: transaction.id,
    allocations: applied.map((a) => ({
      invoiceId: a.invoiceId as Payment['allocations'][number]['invoiceId'],
      amount: asKobo(a.amount),
      allocatedAt: NOW,
      allocatedBy: CURRENT_USER_ID,
    })),
    unallocatedAmount: asKobo(credit - allocatedTotal),
    receiptSentAt: null,
    reversedAt: null,
    reversalReason: null,
    daysUnmatched: 0,
    createdAt: NOW,
    createdBy: CURRENT_USER_ID,
    updatedAt: NOW,
    updatedBy: CURRENT_USER_ID,
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
      updatedAt: NOW,
      updatedBy: CURRENT_USER_ID,
    })
  }

  bankTransactionsCollection.update(transaction.id, {
    matchStatus: 'matched',
    paymentId: payment.id,
    daysUnmatched: 0,
    updatedAt: NOW,
    updatedBy: CURRENT_USER_ID,
  })

  return payment
}

/* -------------------------------------------------------------------------- */

export default function Reconciliation() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const transactions = useCollection(bankTransactionsCollection)
  const invoices = useCollection(invoicesCollection)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<BankMatchCandidate | null>(null)
  const [splitOpen, setSplitOpen] = useState(false)
  const [creditOpen, setCreditOpen] = useState(false)
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number | null>>({})
  const [rejected, setRejected] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const queue = useMemo(
    () =>
      transactions
        .filter((t) => t.credit !== null && (t.matchStatus === 'unmatched' || t.matchStatus === 'possible_match'))
        .sort((a, b) => b.daysUnmatched - a.daysUnmatched),
    [transactions],
  )

  const selected = queue.find((t) => t.id === selectedId) ?? queue[0] ?? null

  const candidates = useMemo(() => {
    if (!selected) return []
    return selected.candidates
      .filter((candidate) => !rejected.includes(`${selected.id}:${candidate.invoiceId}`))
      .map((candidate) => ({ candidate, invoice: invoicesCollection.find(candidate.invoiceId) }))
      .filter((row): row is { candidate: BankMatchCandidate; invoice: Invoice } => Boolean(row.invoice))
      .sort((a, b) => b.candidate.score - a.candidate.score)
    // `invoices` is a dependency so a settled invoice drops out of the list.
  }, [selected, rejected, invoices])

  const splitTotal = Object.values(splitAmounts).reduce<number>((acc, value) => acc + (value ?? 0), 0)
  const remainder = (selected?.credit ?? 0) - splitTotal

  function openSplit() {
    if (!selected) return
    const seeded: Record<string, number | null> = {}
    let left = selected.credit ?? 0
    for (const { invoice } of candidates) {
      const take = Math.min(left, invoice.balance)
      seeded[invoice.id] = take > 0 ? take : null
      left -= take
    }
    setSplitAmounts(seeded)
    setSplitOpen(true)
  }

  function runSettle(allocations: Allocation[], message: string) {
    if (!selected) return
    settle(selected, allocations)
    setSelectedId(null)
    setNotice(message)
  }

  const queueColumns: Array<Column<BankTransaction>> = [
    {
      key: 'date',
      header: 'Date',
      width: 108,
      accessor: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span>,
      sortValue: (row) => row.date,
      sortable: true,
    },
    {
      key: 'amount',
      header: 'Credit',
      align: 'right',
      width: 132,
      cell: (row) => <MoneyCell kobo={row.credit ?? 0} tone="positive" />,
      sortValue: (row) => row.credit ?? 0,
      sortable: true,
    },
    {
      key: 'narration',
      header: 'Narration',
      minWidth: 260,
      cell: (row) => (
        <div>
          <p className="font-mono text-body-12 text-text">{row.narration}</p>
          <p className="mt-0.5 font-mono text-body-12 text-text-secondary">{row.reference}</p>
        </div>
      ),
      sortValue: (row) => row.narration,
      sortable: true,
    },
    {
      key: 'days',
      header: 'Days unmatched',
      align: 'right',
      width: 128,
      cell: (row) => (
        <span className={`tabular-nums ${row.daysUnmatched >= 7 ? 'text-danger-text font-semibold' : 'text-text'}`}>
          {formatNumber(row.daysUnmatched)}
        </span>
      ),
      sortValue: (row) => row.daysUnmatched,
      sortable: true,
    },
    {
      key: 'confidence',
      header: 'Best candidate',
      width: 132,
      cell: (row) => {
        const best = [...row.candidates].sort((a, b) => b.score - a.score)[0]
        if (!best) return <Badge tone="neutral">No candidate</Badge>
        return (
          <Badge tone={best.score >= 85 ? 'success' : best.score >= 60 ? 'warning' : 'neutral'}>
            {formatPercent(best.score, 0)} confidence
          </Badge>
        )
      },
      sortValue: (row) => Math.max(0, ...row.candidates.map((c) => c.score)),
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Reconciliation"
        description="Bank credits on the left, the invoices they might belong to on the right, and a person in between."
        tabs={FINANCE_TABS}
        activeTab="reconciliation"
        onTabChange={navigate}
        meta={<Badge tone={queue.length > 0 ? 'warning' : 'success'}>{formatNumber(queue.length)} in the queue</Badge>}
      />

      <ScreenError state={state} />

      <Alert tone="warning" icon={ShieldAlert} title="Unmatched items stay visible until a human resolves them" className="mb-6">
        Nothing is ever auto-assigned on a guess. A confidence score is a prompt for a decision, not a decision.
      </Alert>

      {notice && (
        <Alert tone="success" title="Match recorded" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Bank credits awaiting a decision"
            description="Oldest first. A row stays here until somebody resolves it."
          />
          <CardBody padding="none">
            <DataTable
              data={queue}
              columns={queueColumns}
              rowKey={(row) => row.id}
              loading={state.loading}
              onRowClick={(row) => setSelectedId(row.id)}
              activeRowKey={selected?.id}
              density="compact"
              bordered={false}
              maxHeight={560}
              minWidth={760}
              caption="Bank transactions that are unmatched or only possibly matched"
              empty={
                <EmptyState
                  icon={CheckCircle2}
                  variant="default"
                  title="The reconciliation queue is clear"
                  message="Every bank credit has been matched to an invoice or recorded as an unallocated credit. New bank transactions arrive from the Zenith, GTBank and Providus feeds."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('bank-transactions')}>
                      Open the bank feed
                    </Button>
                  }
                />
              }
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={selected ? 'Candidate invoices' : 'Nothing selected'}
            description={
              selected
                ? 'Every score shows the reasons behind it. If none of them convinces you, leave the item unmatched.'
                : 'Pick a bank credit on the left to see what it might belong to.'
            }
          />
          <CardBody className="space-y-5">
            {state.loading ? (
              <SkeletonTable rows={5} columns={4} />
            ) : !selected ? (
              <EmptyState
                icon={Inbox}
                title="Select a bank credit"
                message="The queue on the left holds every credit that has not been resolved. Choosing one shows the invoices it could belong to, and why."
                bordered={false}
              />
            ) : (
              <>
                <KeyValueList columns={2}>
                  <KeyValue label="Amount received">
                    <MoneyCell kobo={selected.credit ?? 0} strong tone="positive" />
                  </KeyValue>
                  <KeyValue label="Received">{formatDate(selected.date)}</KeyValue>
                  <KeyValue label="Bank">{`${selected.bank} · ${selected.accountLast4}`}</KeyValue>
                  <KeyValue label="Match status">
                    <StatusBadge status={selected.matchStatus} />
                  </KeyValue>
                  <KeyValue label="Narration" hint="Exactly as the bank sent it.">
                    <span className="font-mono text-body-12">{selected.narration}</span>
                  </KeyValue>
                  <KeyValue label="Reference">
                    <span className="font-mono text-body-12">{selected.reference}</span>
                  </KeyValue>
                </KeyValueList>

                {candidates.length === 0 ? (
                  <EmptyState
                    icon={Link2Off}
                    title="No candidate invoice for this credit"
                    message="Nothing in the ledger matches this narration, reference or amount. Record it as an unallocated credit so the money is visible, or leave it in the queue for whoever recognises the payer."
                    action={
                      <Button size="sm" variant="secondary" onClick={() => setCreditOpen(true)}>
                        Mark as unallocated credit
                      </Button>
                    }
                    bordered
                  />
                ) : (
                  <ul className="space-y-3">
                    {candidates.map(({ candidate, invoice }) => {
                      const key = unitKey(invoice.unitId)
                      return (
                        <li key={invoice.id} className="rounded-xl border border-border p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-body-13 font-semibold text-text">{invoice.ref}</span>
                                {key && <UnitTag unit={key} size="sm" />}
                                <StatusBadge status={invoice.status} size="sm" />
                              </div>
                              <p className="mt-1 text-body-13 text-text-secondary">
                                {personName(invoice.personId)} · due {formatDate(invoice.dueDate)}
                              </p>
                            </div>
                            <div className="text-right">
                              <MoneyCell kobo={invoice.balance} strong sub={`of ${formatNaira(invoice.total)} invoiced`} />
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge tone={candidate.score >= 85 ? 'success' : candidate.score >= 60 ? 'warning' : 'neutral'}>
                              {formatPercent(candidate.score, 0)} confidence
                            </Badge>
                            {candidate.reasons.map((reason) => (
                              <Badge key={reason} tone="neutral" variant="outline">
                                {reason}
                              </Badge>
                            ))}
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button size="sm" leftIcon={<CheckCircle2 size={16} />} onClick={() => setConfirming(candidate)}>
                              Confirm match
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              leftIcon={<ThumbsDown size={16} />}
                              onClick={() => setRejected((prev) => [...prev, `${selected.id}:${candidate.invoiceId}`])}
                            >
                              Not this invoice
                            </Button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button size="sm" variant="secondary" leftIcon={<Split size={16} />} onClick={openSplit} disabled={candidates.length === 0}>
                    Split across invoices
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={<CircleSlash size={16} />} onClick={() => setCreditOpen(true)}>
                    Mark as unallocated credit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
                    Leave unmatched
                  </Button>
                </div>
                <p className="text-body-12 text-text-secondary">
                  Leaving an item unmatched is a valid outcome. It stays in the queue and keeps counting days until somebody can say
                  whose money it is.
                </p>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Confirm one invoice ------------------------------------------------ */}
      <ConfirmDialog
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Confirm this match"
        icon={CheckCircle2}
        confirmLabel="Confirm match"
        onConfirm={() => {
          if (!selected || !confirming) return
          const invoice = invoicesCollection.find(confirming.invoiceId)
          if (!invoice) return
          const amount = Math.min(selected.credit ?? 0, invoice.balance)
          const leftover = (selected.credit ?? 0) - amount
          runSettle(
            [{ invoiceId: invoice.id, amount }],
            leftover > 0
              ? `${formatNaira(amount)} applied to ${invoice.ref}. ${formatNaira(leftover)} is held as an unallocated credit on the new payment.`
              : `${formatNaira(amount)} applied to ${invoice.ref}. The invoice is now settled.`,
          )
          setConfirming(null)
        }}
      >
        {confirming && selected && (
          <div className="space-y-2 text-body-14 text-text-secondary">
            <p>
              This creates a payment of {formatNaira(selected.credit ?? 0)} and applies it to{' '}
              {invoicesCollection.find(confirming.invoiceId)?.ref ?? 'the invoice'}. The invoice balance falls; the invoice itself is
              not edited.
            </p>
            <p>Anything left over is held on the payment as an unallocated credit rather than spread across other invoices.</p>
          </div>
        )}
      </ConfirmDialog>

      {/* Split -------------------------------------------------------------- */}
      <Modal
        open={splitOpen}
        onClose={() => setSplitOpen(false)}
        title="Split this credit across invoices"
        description="The corporate case: one transfer settling several students. Allocate down to zero, or leave a remainder as an unallocated credit."
        size="lg"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <span className={`text-body-13 tabular-nums ${remainder < 0 ? 'text-danger-text' : 'text-text-secondary'}`}>
              Remainder {formatNaira(remainder)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setSplitOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={remainder < 0 || splitTotal <= 0}
                onClick={() => {
                  runSettle(
                    Object.entries(splitAmounts).map(([invoiceId, amount]) => ({ invoiceId, amount: amount ?? 0 })),
                    `${formatNaira(splitTotal)} allocated across ${Object.values(splitAmounts).filter((a) => (a ?? 0) > 0).length} invoices.`,
                  )
                  setSplitOpen(false)
                }}
              >
                Apply allocation
              </Button>
            </div>
          </div>
        }
      >
        {selected && (
          <div className="space-y-4">
            <KeyValueList>
              <KeyValue label="Credit to allocate">
                <MoneyCell kobo={selected.credit ?? 0} strong />
              </KeyValue>
              <KeyValue label="Allocated so far">
                <MoneyCell kobo={splitTotal} />
              </KeyValue>
            </KeyValueList>

            {candidates.map(({ invoice }) => (
              <Field
                key={invoice.id}
                label={`${invoice.ref} — ${personName(invoice.personId)}`}
                hint={`Outstanding balance ${formatNaira(invoice.balance)}`}
                error={(splitAmounts[invoice.id] ?? 0) > invoice.balance ? 'More than this invoice is owed.' : undefined}
              >
                <CurrencyInput
                  value={splitAmounts[invoice.id] ?? null}
                  onChange={(kobo) => setSplitAmounts((prev) => ({ ...prev, [invoice.id]: kobo }))}
                />
              </Field>
            ))}

            {remainder < 0 && (
              <Alert tone="danger" title="Allocated more than was received">
                Reduce an allocation by {formatNaira(Math.abs(remainder))} before applying.
              </Alert>
            )}
          </div>
        )}
      </Modal>

      {/* Unallocated credit -------------------------------------------------- */}
      <ConfirmDialog
        open={creditOpen}
        onClose={() => setCreditOpen(false)}
        title="Record as an unallocated credit"
        icon={CircleSlash}
        confirmLabel="Record credit"
        onConfirm={() => {
          if (!selected) return
          runSettle(
            [],
            `${formatNaira(selected.credit ?? 0)} recorded as an unallocated credit. It sits on the payment until somebody claims it.`,
          )
          setCreditOpen(false)
        }}
      >
        <p className="text-body-14 text-text-secondary">
          The money is recognised as received but applied to no invoice. It stays visible on the payment as an unallocated amount,
          and no student's balance moves.
        </p>
      </ConfirmDialog>
    </Page>
  )
}
