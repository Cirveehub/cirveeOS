/**
 * §20 — Invoice detail.
 *
 * The screen the two corrections hang off. Its whole argument is the banner at
 * the top: an issued invoice is never edited. A refund, a credit note and a
 * void are all new records that point back here, and the tabs below show every
 * one of them sitting beside the original rather than in place of it.
 *
 * A persistent summary rail carries the money; four tabs carry the detail, so
 * the page never stacks lines, payments, credits, commissions and audit in one
 * scroll.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Ban, FileMinus, Landmark, Receipt, ShieldCheck, Undo2 } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  KeyValue,
  KeyValueList,
  MoneyCell,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  TabPanel,
  Tabs,
  UnitTag,
  type Column,
  type TabItem,
} from '@/ui'
import {
  auditEventsCollection,
  commissionsCollection,
  creditNotesCollection,
  invoicesCollection,
  paymentsCollection,
  refundsCollection,
  useCollection,
} from '@/mocks'
import type { AuditEvent, Commission, CreditNote, Invoice, InvoiceLine, Refund } from '@/mocks'

import { CreditNoteModal, ManualPaymentModal, RefundModal, VoidInvoiceModal } from './modals'
import { Page, ScreenError, branchName, personName, unitKey, userName, useScreenState } from './shared'

export default function InvoiceDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const state = useScreenState()
  const query = useQueryState()

  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const creditNotes = useCollection(creditNotesCollection)
  const refunds = useCollection(refundsCollection)
  const commissions = useCollection(commissionsCollection)
  const auditEvents = useCollection(auditEventsCollection)

  const [notice, setNotice] = useState<string | null>(null)
  const [creditNoteFor, setCreditNoteFor] = useState<Invoice | null>(null)
  const [refundFor, setRefundFor] = useState<Invoice | null>(null)
  const [voidFor, setVoidFor] = useState<Invoice | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)

  /* Accepts either the internal id or the human reference, so a link written
     as /finance/invoices/INV-2026-0933 resolves too. */
  const invoice = invoices.find((i) => i.id === id) ?? invoices.find((i) => i.ref === id) ?? null

  if (state.loading) {
    return (
      <Page>
        <PageHeader title="Invoice" description="Loading the invoice, its payments and every correction against it." />
        <Card padding="none">
          <SkeletonTable rows={8} columns={6} />
        </Card>
      </Page>
    )
  }

  if (!invoice) {
    return (
      <Page>
        <PageHeader
          title="Invoice not found"
          breadcrumbs={[
            { label: 'Finance', to: '/finance' },
            { label: 'Invoices', to: '/finance/invoices' },
            { label: id },
          ]}
        />
        <ScreenError state={state} />
        <EmptyState
          icon={Receipt}
          title={`No invoice matches ${id}`}
          message="It may have been raised under a different reference, or the link is stale. Nothing is ever deleted here, so an invoice that once existed is still in the list."
          action={
            <Button asChild>
              <Link to="/finance/invoices">Back to invoices</Link>
            </Button>
          }
          bordered
        />
      </Page>
    )
  }

  const invoicePayments = payments.filter((p) => p.allocations.some((a) => a.invoiceId === invoice.id))
  const invoiceCreditNotes = creditNotes.filter((c) => c.invoiceId === invoice.id)
  const invoiceRefunds = refunds.filter((r) => r.invoiceId === invoice.id)
  const invoiceCommissions = commissions.filter((c) => c.invoiceId === invoice.id)
  const invoiceAudit = auditEvents
    .filter(
      (event) =>
        event.entityId === invoice.id ||
        event.entityRef === invoice.ref ||
        invoiceCreditNotes.some((note) => note.id === event.entityId) ||
        invoiceRefunds.some((refund) => refund.id === event.entityId) ||
        invoicePayments.some((payment) => payment.id === event.entityId),
    )
    .sort((a, b) => b.at.localeCompare(a.at))

  const creditedTotal = invoiceCreditNotes.reduce((acc, note) => acc + note.amount, 0)
  const lineTotal = invoice.lines.reduce((acc, line) => acc + line.amount, 0)
  const key = unitKey(invoice.unitId)

  const tabs: TabItem[] = [
    { id: 'lines', label: 'Lines and totals', panelId: 'invoice-panel-lines' },
    { id: 'payments', label: 'Payments', badge: invoicePayments.length, panelId: 'invoice-panel-payments' },
    {
      id: 'corrections',
      label: 'Credit notes and refunds',
      badge: invoiceCreditNotes.length + invoiceRefunds.length,
      panelId: 'invoice-panel-corrections',
    },
    { id: 'commissions', label: 'Commissions', badge: invoiceCommissions.length, panelId: 'invoice-panel-commissions' },
    { id: 'audit', label: 'Audit', badge: invoiceAudit.length, panelId: 'invoice-panel-audit' },
  ]
  const activeTab = query.get('tab') ?? 'lines'

  const lineColumns: Array<Column<InvoiceLine>> = [
    { key: 'description', header: 'Description', minWidth: 240, accessor: (row) => row.description, sortValue: (row) => row.description },
    { key: 'qty', header: 'Qty', align: 'right', width: 70, accessor: (row) => row.quantity, sortValue: (row) => row.quantity },
    { key: 'unitPrice', header: 'Unit price', align: 'right', cell: (row) => <MoneyCell kobo={row.unitPrice} />, sortValue: (row) => row.unitPrice },
    {
      key: 'discount',
      header: 'Discount',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.discountAmount} tone={row.discountAmount > 0 ? 'negative' : 'muted'} />,
      sortValue: (row) => row.discountAmount,
    },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <MoneyCell kobo={row.amount} strong />, sortValue: (row) => row.amount },
    {
      key: 'unit',
      header: 'Unit',
      width: 126,
      cell: (row) => {
        const lineKey = unitKey(row.unitId)
        return lineKey ? <UnitTag unit={lineKey} size="sm" /> : <Badge tone="warning" size="sm">Untagged</Badge>
      },
      sortValue: (row) => unitKey(row.unitId) ?? 'zzz',
    },
  ]

  const creditColumns: Array<Column<CreditNote>> = [
    { key: 'ref', header: 'Credit note', width: 132, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.ref}</span>, sortValue: (row) => row.ref },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <MoneyCell kobo={row.amount} tone="negative" strong />, sortValue: (row) => row.amount },
    { key: 'reason', header: 'Reason', minWidth: 300, accessor: (row) => row.reason, sortValue: (row) => row.reason },
    { key: 'issued', header: 'Issued', width: 120, accessor: (row) => formatDate(row.createdAt), sortValue: (row) => row.createdAt },
    { key: 'by', header: 'Issued by', minWidth: 150, accessor: (row) => userName(row.createdBy), sortValue: (row) => userName(row.createdBy) },
    {
      key: 'approval',
      header: 'Approval',
      width: 150,
      accessor: (row) =>
        row.approvalRequestId ? (
          <span className="font-mono text-body-12">{row.approvalRequestId}</span>
        ) : (
          <span className="text-text-secondary">Under threshold</span>
        ),
      sortValue: (row) => row.approvalRequestId ?? '',
    },
  ]

  const refundColumns: Array<Column<Refund>> = [
    { key: 'ref', header: 'Refund', width: 128, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.ref}</span>, sortValue: (row) => row.ref },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <MoneyCell kobo={row.refundAmount} tone="negative" strong />, sortValue: (row) => row.refundAmount },
    { key: 'reason', header: 'Reason', minWidth: 280, accessor: (row) => row.reason, sortValue: (row) => row.reason },
    { key: 'status', header: 'Status', width: 128, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
    {
      key: 'commissions',
      header: 'Commission impact',
      minWidth: 240,
      accessor: (row) =>
        row.affectedCommissionIds.length === 0 ? (
          <span className="text-text-secondary">No commission affected</span>
        ) : (
          <span className="text-warning-text">
            Reverses{' '}
            {row.affectedCommissionIds
              .map((commissionId) => commissions.find((c) => c.id === commissionId)?.ref ?? commissionId)
              .join(', ')}
          </span>
        ),
      sortValue: (row) => row.affectedCommissionIds.length,
    },
    {
      key: 'approval',
      header: 'Approval',
      width: 150,
      accessor: (row) => <span className="font-mono text-body-12">{row.approvalRequestId}</span>,
      sortValue: (row) => row.approvalRequestId,
    },
  ]

  const commissionColumns: Array<Column<Commission>> = [
    {
      key: 'ref',
      header: 'Commission',
      width: 160,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-body-13 font-semibold">{row.ref}</span>
          {row.reversalOfCommissionId && (
            <span className="text-body-12 text-danger-text">
              Reversal of {commissions.find((c) => c.id === row.reversalOfCommissionId)?.ref ?? row.reversalOfCommissionId}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.ref,
    },
    { key: 'beneficiary', header: 'Beneficiary', minWidth: 170, accessor: (row) => personName(row.beneficiaryPersonId), sortValue: (row) => personName(row.beneficiaryPersonId) },
    { key: 'role', header: 'Role on deal', width: 140, accessor: (row) => row.roleOnDeal.replace(/_/g, ' '), sortValue: (row) => row.roleOnDeal },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.amount} strong tone={row.amount < 0 ? 'negative' : 'positive'} />,
      sortValue: (row) => row.amount,
    },
    { key: 'state', header: 'State', width: 126, cell: (row) => <StatusBadge status={row.state} />, sortValue: (row) => row.state },
    { key: 'rule', header: 'Rule version', width: 140, accessor: (row) => `${row.ruleKey} v${row.ruleVersion}`, sortValue: (row) => `${row.ruleKey}${row.ruleVersion}` },
  ]

  const auditColumns: Array<Column<AuditEvent>> = [
    { key: 'at', header: 'When', width: 168, accessor: (row) => formatDateTime(row.at), sortValue: (row) => row.at },
    { key: 'actor', header: 'Actor', minWidth: 170, accessor: (row) => `${row.actorName} · ${row.actorRole}`, sortValue: (row) => row.actorName },
    { key: 'action', header: 'Action', minWidth: 190, accessor: (row) => <span className="font-mono text-body-12">{row.action}</span>, sortValue: (row) => row.action },
    { key: 'record', header: 'Record', width: 150, accessor: (row) => <span className="font-mono text-body-12">{row.entityRef}</span>, sortValue: (row) => row.entityRef },
    { key: 'field', header: 'Field', width: 130, accessor: (row) => row.field ?? '—', sortValue: (row) => row.field ?? '' },
    { key: 'before', header: 'Previous value', minWidth: 150, accessor: (row) => row.before ?? '—', sortValue: (row) => row.before ?? '' },
    { key: 'after', header: 'New value', minWidth: 150, accessor: (row) => row.after ?? '—', sortValue: (row) => row.after ?? '' },
  ]

  return (
    <Page>
      <PageHeader
        breadcrumbs={[
          { label: 'Finance', to: '/finance' },
          { label: 'Invoices', to: '/finance/invoices' },
          { label: invoice.ref },
        ]}
        title={invoice.ref}
        description={`${invoice.organisationId ? 'Organisation account' : personName(invoice.personId)} · issued ${formatDate(invoice.issueDate)} · due ${formatDate(invoice.dueDate)}`}
        meta={
          <>
            <StatusBadge status={invoice.status} />
            {key ? <UnitTag unit={key} size="sm" /> : <Badge tone="warning" size="sm">Untagged</Badge>}
            {invoice.daysOverdue > 0 && (
              <Badge tone={invoice.daysOverdue > 30 ? 'danger' : 'warning'} size="sm">
                {formatNumber(invoice.daysOverdue)} days overdue
              </Badge>
            )}
          </>
        }
        actions={
          <>
            <Button size="sm" variant="secondary" leftIcon={<Landmark size={16} />} onClick={() => setPaymentOpen(true)}>
              Record payment
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<FileMinus size={16} />} onClick={() => setCreditNoteFor(invoice)}>
              Issue credit note
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Undo2 size={16} />}
              disabled={invoice.paidAmount <= 0}
              onClick={() => setRefundFor(invoice)}
            >
              Refund
            </Button>
            <Button
              size="sm"
              variant="danger"
              leftIcon={<Ban size={16} />}
              disabled={invoice.status === 'cancelled'}
              onClick={() => setVoidFor(invoice)}
            >
              Void
            </Button>
          </>
        }
      />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title="Record created" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <Alert tone="info" icon={ShieldCheck} title="An issued invoice is never edited" className="mb-6">
        There is no way to change a line, a price or a total on this page — and that is deliberate. A reduction is a credit
        note, money going back is a refund, and cancelling is a void that credits rather than erases. Each one is its own
        record, listed under Credit notes and refunds, and each names this invoice.
        {invoice.voidedAt && ` Voided ${formatDate(invoice.voidedAt)}: ${invoice.voidReason ?? 'no reason recorded'}.`}
      </Alert>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* ---- persistent money rail ---- */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="The money" />
            <CardBody className="space-y-2">
              <SummaryRow label="Subtotal" kobo={invoice.subtotal} />
              <SummaryRow label="Discount" kobo={invoice.discountAmount} tone={invoice.discountAmount > 0 ? 'negative' : 'muted'} />
              <div className="flex items-center justify-between border-t border-border pt-2 text-body-14 font-semibold">
                <span>Total</span>
                <MoneyCell kobo={invoice.total} strong />
              </div>
              <SummaryRow label="Paid" kobo={invoice.paidAmount} tone="positive" />
              <SummaryRow label="Credited" kobo={creditedTotal} tone={creditedTotal > 0 ? 'negative' : 'muted'} />
              <div className="flex items-center justify-between border-t border-border pt-2 text-body-14 font-semibold">
                <span>Balance</span>
                <MoneyCell kobo={invoice.balance} strong tone={invoice.balance > 0 ? 'negative' : 'muted'} />
              </div>
              {lineTotal !== invoice.total && (
                <p className="text-body-12 text-text-secondary">
                  Lines sum to {formatNaira(lineTotal)} against a total of {formatNaira(invoice.total)} — the difference is the
                  discount recorded as a cost rather than folded into the prices.
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Where it belongs" />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Unit" divided>
                  {key ? <UnitTag unit={key} size="sm" /> : 'Unassigned'}
                </KeyValue>
                <KeyValue label="Branch" divided>
                  {branchName(invoice.branchId)}
                </KeyValue>
                <KeyValue label="Account" divided>
                  <span className="font-mono text-body-12">{invoice.accountId}</span>
                </KeyValue>
                <KeyValue label="Admission" divided>
                  {invoice.admissionId ?? 'Not linked to an admission'}
                </KeyValue>
                <KeyValue label="Issued by" divided>
                  {userName(invoice.issuedByUserId)}
                </KeyValue>
                <KeyValue
                  label="Customer"
                  divided
                  hint={
                    invoice.organisationId
                      ? 'One organisation invoice can allocate across many participant enrolments — the lines below carry the split.'
                      : undefined
                  }
                >
                  {invoice.organisationId ? 'Organisation account' : personName(invoice.personId)}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>
        </div>

        {/* ---- tabbed detail ---- */}
        <div>
          <Tabs tabs={tabs} value={activeTab} onChange={(next) => query.set('tab', next)} aria-label="Invoice sections" />

          <div className="mt-5">
            <TabPanel id="invoice-panel-lines" tabId="lines" active={activeTab === 'lines'}>
              <Card padding="none">
                <CardHeader
                  title="Line items"
                  description="Each line carries its own unit tag, so one invoice can span two units without the P&L guessing."
                />
                <CardBody padding="none">
                  <DataTable
                    data={invoice.lines}
                    columns={lineColumns}
                    rowKey={(line) => line.id}
                    density="compact"
                    bordered={false}
                    caption={`Line items on invoice ${invoice.ref}`}
                    emptyTitle="No line items"
                    emptyMessage="An invoice with no lines cannot be issued. This one would have to be voided and raised again."
                  />
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel id="invoice-panel-payments" tabId="payments" active={activeTab === 'payments'}>
              <Card padding="none">
                <CardHeader
                  title="Payment history"
                  description="What was actually received against this invoice, and how much of each payment landed here rather than elsewhere."
                  actions={
                    <Button size="sm" variant="secondary" leftIcon={<Landmark size={16} />} onClick={() => setPaymentOpen(true)}>
                      Record payment
                    </Button>
                  }
                />
                <CardBody>
                  {invoicePayments.length === 0 ? (
                    <EmptyState
                      size="sm"
                      bordered
                      title="Nothing paid against this invoice yet"
                      message="Payments arrive either from a matched bank credit on the reconciliation screen, or recorded here by hand when the money came in as cash, POS or a cheque. Nothing is ever applied automatically."
                      action={
                        <Button size="sm" onClick={() => setPaymentOpen(true)}>
                          Record a payment
                        </Button>
                      }
                    />
                  ) : (
                    <ul className="space-y-2">
                      {invoicePayments.map((payment) => {
                        const applied = payment.allocations
                          .filter((a) => a.invoiceId === invoice.id)
                          .reduce((acc, a) => acc + a.amount, 0)
                        return (
                          <li
                            key={payment.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                          >
                            <div className="min-w-0">
                              <span className="font-mono text-body-13 font-semibold">{payment.ref}</span>
                              <p className="text-body-12 text-text-secondary">
                                {formatDateTime(payment.receivedAt)} · {payment.method.replace(/_/g, ' ')} · {payment.payerName}
                              </p>
                              {payment.allocations.length > 1 && (
                                <p className="text-body-12 text-text-secondary">
                                  Split across {formatNumber(payment.allocations.length)} invoices — this one took{' '}
                                  {formatNaira(applied)} of {formatNaira(payment.amount)}.
                                </p>
                              )}
                              {payment.unallocatedAmount > 0 && (
                                <p className="text-body-12 text-warning-text">
                                  {formatNaira(payment.unallocatedAmount)} of this payment is still unallocated.
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={payment.status} size="sm" />
                              <MoneyCell kobo={applied} tone="positive" strong />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel id="invoice-panel-corrections" tabId="corrections" active={activeTab === 'corrections'}>
              <div className="flex flex-col gap-6">
                <Card padding="none">
                  <CardHeader
                    title="Credit notes"
                    description="Each one reduces what is owed without touching a single figure on the invoice above."
                    actions={
                      <Button size="sm" variant="secondary" leftIcon={<FileMinus size={16} />} onClick={() => setCreditNoteFor(invoice)}>
                        Issue credit note
                      </Button>
                    }
                  />
                  <CardBody padding="none">
                    <DataTable
                      data={invoiceCreditNotes}
                      columns={creditColumns}
                      rowKey={(row) => row.id}
                      density="compact"
                      bordered={false}
                      minWidth={1100}
                      caption={`Credit notes issued against ${invoice.ref}`}
                      emptyTitle="No credit notes"
                      emptyMessage="Nothing has been credited back. Any correction to this invoice would appear here as its own record, never as an edit."
                    />
                  </CardBody>
                </Card>

                <Card padding="none">
                  <CardHeader
                    title="Refunds"
                    description="A refund names the commissions it reverses before anyone approves it."
                    actions={
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Undo2 size={16} />}
                        disabled={invoice.paidAmount <= 0}
                        onClick={() => setRefundFor(invoice)}
                      >
                        Refund
                      </Button>
                    }
                  />
                  <CardBody padding="none">
                    <DataTable
                      data={invoiceRefunds}
                      columns={refundColumns}
                      rowKey={(row) => row.id}
                      density="compact"
                      bordered={false}
                      minWidth={1200}
                      caption={`Refunds raised against ${invoice.ref}`}
                      emptyTitle="No refunds"
                      emptyMessage={
                        invoice.paidAmount > 0
                          ? 'Nothing has gone back to the payer. A refund would appear here alongside the credit note that carries the money.'
                          : 'Nothing has been received against this invoice, so there is nothing to refund.'
                      }
                    />
                  </CardBody>
                </Card>
              </div>
            </TabPanel>

            <TabPanel id="invoice-panel-commissions" tabId="commissions" active={activeTab === 'commissions'}>
              <Card padding="none">
                <CardHeader
                  title="Commissions earned on this invoice"
                  description="A refund here creates a new negative commission pointing back at the original. The original keeps its amount, its state and its payout batch."
                  actions={
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/referral/commissions">Open the ledger</Link>
                    </Button>
                  }
                />
                <CardBody padding="none">
                  <DataTable
                    data={invoiceCommissions}
                    columns={commissionColumns}
                    rowKey={(row) => row.id}
                    density="compact"
                    bordered={false}
                    minWidth={1080}
                    caption={`Commissions computed from ${invoice.ref}`}
                    emptyTitle="No commission was earned on this invoice"
                    emptyMessage="No rule version in force when this invoice was raised matched it, so a refund here has no commission cascade to consider."
                  />
                </CardBody>
              </Card>
            </TabPanel>

            <TabPanel id="invoice-panel-audit" tabId="audit" active={activeTab === 'audit'}>
              <Card padding="none">
                <CardHeader
                  title="Audit"
                  description="Separate from any activity feed. Actor, timestamp, record, field, previous value and new value — append-only."
                />
                <CardBody padding="none">
                  <DataTable
                    data={invoiceAudit}
                    columns={auditColumns}
                    rowKey={(row) => row.id}
                    density="compact"
                    bordered={false}
                    minWidth={1280}
                    caption={`Audit events touching ${invoice.ref}`}
                    emptyTitle="No audit events yet"
                    emptyMessage="This invoice has not been corrected in this session. Issuing a credit note, raising a refund or recording a payment writes a row here immediately."
                  />
                </CardBody>
              </Card>
            </TabPanel>
          </div>
        </div>
      </div>

      <CreditNoteModal invoice={creditNoteFor} onClose={() => setCreditNoteFor(null)} onDone={setNotice} />
      <RefundModal
        invoice={refundFor}
        onClose={() => setRefundFor(null)}
        onDone={(_result, message) => {
          setNotice(message)
          query.set('tab', 'corrections')
        }}
      />
      <VoidInvoiceModal
        invoice={voidFor}
        onClose={() => setVoidFor(null)}
        onDone={(message) => {
          setNotice(message)
          query.set('tab', 'corrections')
        }}
      />
      <ManualPaymentModal
        open={paymentOpen}
        invoice={invoice}
        onClose={() => setPaymentOpen(false)}
        onDone={(message) => {
          setNotice(message)
          query.set('tab', 'payments')
        }}
      />

      <div className="mt-8">
        <Button variant="ghost" onClick={() => navigate('/finance/invoices')}>
          Back to invoices
        </Button>
      </div>
    </Page>
  )
}

function SummaryRow({ label, kobo, tone }: { label: string; kobo: number; tone?: 'positive' | 'negative' | 'muted' }) {
  return (
    <div className="flex items-center justify-between text-body-13">
      <span className="text-text-secondary">{label}</span>
      <MoneyCell kobo={kobo} tone={tone} />
    </div>
  )
}
