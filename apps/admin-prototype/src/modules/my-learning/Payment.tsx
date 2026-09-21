/**
 * Payment — `/my-learning/payment`.
 *
 * A screen the legacy portal has and Cirvee OS never did: the learner's own
 * money, read straight from the same `Invoice` and `Payment` records Finance
 * works from, scoped to their `personId`. Nothing here is a copy of a number
 * held elsewhere — the balance on this page is the balance the ledger has,
 * and the certificate screen's financial-clearance criterion reads the same
 * invoices.
 *
 * The density is the legacy's, not the admin Finance dashboard's: three
 * cards, one concern each — where you stand, what you were invoiced, what you
 * have paid. No ageing buckets, no collection rate, no unit P&L. A learner
 * checking whether they owe anything is not running an operation.
 *
 * Money is kobo throughout, rendered by `MoneyCell`/`formatNaira`.
 */

import { useMemo } from 'react'
import { CreditCard, Download } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira } from '@/lib/format'
import { useScreenLoad } from '@/lib/view-state'
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  MoneyCell,
  PageHeader,
  ProgressBar,
  SkeletonTable,
  StatusBadge,
  type Column,
} from '@/ui'
import {
  coursesCollection,
  invoicesCollection,
  paymentsCollection,
  useCollection,
  TODAY,
  type Invoice,
  type Payment as PaymentRecord,
  type PaymentMethod,
} from '@/mocks'

import { detailOf, moneyFor, Screen, useStudent } from './common'

const METHOD_LABEL: Record<PaymentMethod, string> = {
  bank_transfer: 'Bank transfer',
  paystack_card: 'Card',
  paystack_transfer: 'Transfer',
  cash: 'Cash',
  pos: 'POS',
  cheque: 'Cheque',
}

export default function Payment() {
  const { loading } = useScreenLoad('my-learning-payment')
  const { personId, enrolments } = useStudent()

  const allInvoices = useCollection(invoicesCollection)
  const allPayments = useCollection(paymentsCollection)

  const invoices = useMemo(
    () =>
      allInvoices
        .filter((i) => i.personId === personId && i.voidedAt === null)
        .sort((a, b) => b.issueDate.localeCompare(a.issueDate)),
    [allInvoices, personId],
  )

  const payments = useMemo(
    () =>
      allPayments
        .filter((p) => p.personId === personId)
        .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [allPayments, personId],
  )

  const money = useMemo(() => moneyFor(personId), [personId, allInvoices])
  const paidPercent = money.total > 0 ? Math.round((money.paid / money.total) * 100) : 0
  const settled = money.balance <= 0

  const invoiceColumns: Array<Column<Invoice>> = [
    {
      key: 'ref',
      header: 'Invoice',
      cell: (row) => (
        <div className="min-w-0">
          <p className="text-body-14 font-semibold">{row.ref}</p>
          <p className="truncate text-body-12 text-text-muted">
            {row.lines.map((l) => l.description).join(' · ')}
          </p>
        </div>
      ),
      sortValue: (row) => row.ref,
      minWidth: 280,
    },
    {
      key: 'issued',
      header: 'Issued',
      accessor: (row) => formatDate(row.issueDate),
      sortValue: (row) => row.issueDate,
      width: 120,
    },
    {
      key: 'due',
      header: 'Due',
      cell: (row) => (
        <span
          className={
            row.balance > 0 && row.dueDate < TODAY
              ? 'text-body-13 font-medium text-danger-text'
              : 'text-body-13'
          }
        >
          {formatDate(row.dueDate)}
        </span>
      ),
      sortValue: (row) => row.dueDate,
      width: 120,
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      cell: (row) => (
        <MoneyCell
          kobo={row.total}
          sub={row.discountAmount > 0 ? `after ${formatNaira(row.discountAmount)} discount` : undefined}
        />
      ),
      sortValue: (row) => row.total,
      width: 160,
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.paidAmount} tone="positive" />,
      sortValue: (row) => row.paidAmount,
      width: 140,
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      cell: (row) => (
        <MoneyCell kobo={row.balance} tone={row.balance > 0 ? 'negative' : 'muted'} strong />
      ),
      sortValue: (row) => row.balance,
      width: 140,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
      sortValue: (row) => row.status,
      width: 140,
    },
  ]

  const paymentColumns: Array<Column<PaymentRecord>> = [
    {
      key: 'ref',
      header: 'Reference',
      cell: (row) => (
        <div>
          <p className="text-body-14 font-semibold">{row.ref}</p>
          <p className="text-body-12 text-text-muted">{row.payerReference}</p>
        </div>
      ),
      sortValue: (row) => row.ref,
      minWidth: 200,
    },
    {
      key: 'received',
      header: 'Received',
      accessor: (row) => formatDateTime(row.receivedAt),
      sortValue: (row) => row.receivedAt,
      width: 180,
    },
    {
      key: 'method',
      header: 'Method',
      accessor: (row) => METHOD_LABEL[row.method],
      width: 140,
    },
    {
      key: 'allocated',
      header: 'Applied to',
      cell: (row) => (
        <span className="text-body-13">
          {row.allocations.length === 0
            ? 'Not yet applied'
            : row.allocations
                .map((a) => invoicesCollection.find(a.invoiceId)?.ref ?? a.invoiceId)
                .join(', ')}
        </span>
      ),
      minWidth: 180,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => (
        <MoneyCell
          kobo={row.amount}
          tone={row.reversedAt ? 'muted' : 'positive'}
          strong
          sub={row.reversedAt ? 'reversed' : undefined}
        />
      ),
      sortValue: (row) => row.amount,
      width: 160,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      align: 'right',
      cell: (row) =>
        row.receiptSentAt ? (
          <Button size="sm" variant="ghost" leftIcon={<Download size={14} />}>
            Receipt
          </Button>
        ) : (
          <span className="text-body-13 text-text-muted">Pending</span>
        ),
      width: 130,
    },
  ]

  return (
    <Screen>
      <PageHeader
        title="Payment"
        description="Your tuition, what has been paid and what is left."
      />

      {!loading && invoices.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={CreditCard}
            title="No payment record found"
            message="Nothing has been invoiced against your record yet."
            bordered
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          {/* 1 — where you stand. One card, four numbers, one bar. */}
          <section className="rounded-2xl border border-border bg-surface px-6 py-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-body-15 font-bold">Your tuition</p>
                <p className="text-body-13 text-text-secondary">
                  {enrolments
                    .map((e) => {
                      const { cohort } = detailOf(e)
                      return `${coursesCollection.find(e.courseId)?.title ?? 'Course'} · ${cohort?.code ?? ''}`
                    })
                    .join(' · ') || 'Your enrolment'}
                </p>
              </div>
              <Badge tone={settled ? 'success' : money.overdue ? 'danger' : 'warning'} variant="subtle">
                {settled ? 'Settled' : money.overdue ? 'Payment overdue' : 'Part paid'}
              </Badge>
            </div>

            <ProgressBar
              value={paidPercent}
              tone={settled ? 'success' : 'warning'}
              valueLabel={`${paidPercent}% paid`}
              showValue
              className="mt-5"
              aria-label="Tuition paid"
            />

            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
              <Figure label="Total invoiced" value={formatNaira(money.total)} />
              <Figure label="Paid" value={formatNaira(money.paid)} tone="positive" />
              <Figure
                label="Balance"
                value={formatNaira(money.balance)}
                tone={money.balance > 0 ? 'negative' : 'muted'}
              />
              <Figure
                label="Next due"
                value={money.nextDueDate ? formatDate(money.nextDueDate) : 'Nothing due'}
                tone={money.overdue ? 'negative' : 'default'}
              />
            </dl>

            {money.balance > 0 && (
              <p className="mt-5 border-t border-border pt-4 text-body-13 text-text-secondary">
                Paying at the academy office or by bank transfer both work. Your balance updates here
                once Finance matches the payment to your invoice.
              </p>
            )}
          </section>

          {/* 2 — what you were invoiced. */}
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-5">
              <p className="text-body-15 font-bold">Invoices</p>
              <p className="text-body-12 text-text-muted">
                {invoices.length} invoice{invoices.length === 1 ? '' : 's'} on your record
              </p>
            </div>
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={2} />
              </div>
            ) : (
              <DataTable
                data={invoices}
                columns={invoiceColumns}
                rowKey={(row) => row.id}
                defaultSort={{ key: 'issued', direction: 'desc' }}
                emptyTitle="No invoices"
                emptyMessage="Nothing has been invoiced against your record yet."
                minWidth={980}
              />
            )}
          </section>

          {/* 3 — what you have paid. */}
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-5">
              <p className="text-body-15 font-bold">Payments received</p>
              <p className="text-body-12 text-text-muted">
                {payments.length} payment{payments.length === 1 ? '' : 's'} recorded
              </p>
            </div>
            {loading ? (
              <div className="p-6">
                <SkeletonTable rows={2} />
              </div>
            ) : (
              <DataTable
                data={payments}
                columns={paymentColumns}
                rowKey={(row) => row.id}
                defaultSort={{ key: 'received', direction: 'desc' }}
                emptyTitle="No payments yet"
                emptyMessage="Payments show up here once Finance matches them to your invoice."
                minWidth={900}
              />
            )}
          </section>
        </div>
      )}
    </Screen>
  )
}

function Figure({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative' | 'muted'
}) {
  const colour =
    tone === 'positive'
      ? 'text-success-text'
      : tone === 'negative'
        ? 'text-danger-text'
        : tone === 'muted'
          ? 'text-text-muted'
          : 'text-text'
  return (
    <div>
      <dt className="text-label-10 text-text-label">{label}</dt>
      <dd className={`mt-1.5 text-heading-20 ${colour}`}>{value}</dd>
    </div>
  )
}
