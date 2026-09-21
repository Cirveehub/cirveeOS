import { useMemo, useState } from 'react'
import { Banknote, Plus, ShieldAlert } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  BUSINESS_UNITS,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  MoneyCell,
  PageHeader,
  Pagination,
  StatusBadge,
  TableToolbar,
  UNIT_META,
  UnitTag,
  type Column,
  type FilterValues,
} from '@/ui'
import { invoicesCollection, paymentsCollection, useCollection } from '@/mocks'
import type { Payment } from '@/mocks'

import { ManualPaymentModal } from './modals'
import { FINANCE_TABS, Page, ScreenError, branchName, unitKey, userName, useModuleNav, useScreenState } from './shared'

const METHODS = ['bank_transfer', 'paystack_card', 'paystack_transfer', 'cash', 'pos', 'cheque'] as const
const STATUSES = ['matched', 'possible_match', 'unmatched', 'reversed'] as const
const PAGE_SIZE = 25

export default function Payments() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const payments = useCollection(paymentsCollection)
  const invoices = useCollection(invoicesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [recordOpen, setRecordOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payments
      .filter((payment) => {
        if (filters.status && payment.status !== filters.status) return false
        if (filters.method && payment.method !== filters.method) return false
        if (filters.unit && unitKey(payment.unitId) !== filters.unit) return false
        if (!term) return true
        return (
          payment.ref.toLowerCase().includes(term) ||
          payment.payerName.toLowerCase().includes(term) ||
          payment.payerReference.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }, [payments, filters, search])

  const unresolved = payments.filter((p) => p.status === 'unmatched' || p.status === 'possible_match').length
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  function allocationLabel(payment: Payment): string {
    if (payment.allocations.length === 0) return 'Not allocated'
    const total = payment.allocations.reduce((acc, a) => acc + a.amount, 0)
    return `${formatNaira(total)} across ${formatNumber(payment.allocations.length)} ${payment.allocations.length === 1 ? 'invoice' : 'invoices'}`
  }

  const columns: Array<Column<Payment>> = [
    { key: 'ref', header: 'Payment', pinned: true, width: 132, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    { key: 'date', header: 'Received', width: 152, accessor: (row) => formatDateTime(row.receivedAt), sortValue: (row) => row.receivedAt, sortable: true },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <MoneyCell kobo={row.amount} strong />, sortValue: (row) => row.amount, sortable: true },
    { key: 'method', header: 'Method', width: 148, accessor: (row) => <span className="capitalize">{row.method.replace(/_/g, ' ')}</span>, sortValue: (row) => row.method, sortable: true },
    { key: 'payer', header: 'Payer', minWidth: 180, accessor: (row) => row.payerName, sortValue: (row) => row.payerName, sortable: true },
    { key: 'payerRef', header: 'Payer reference', minWidth: 160, accessor: (row) => <span className="font-mono text-body-12 text-text-secondary">{row.payerReference || '—'}</span>, sortValue: (row) => row.payerReference },
    {
      key: 'invoices',
      header: 'Matched invoices',
      minWidth: 190,
      cell: (row) =>
        row.allocations.length === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <span className="font-mono text-body-12">
            {row.allocations
              .map((a) => invoices.find((i) => i.id === a.invoiceId)?.ref ?? a.invoiceId)
              .slice(0, 2)
              .join(', ')}
            {row.allocations.length > 2 ? ` +${row.allocations.length - 2}` : ''}
          </span>
        ),
      sortValue: (row) => row.allocations.length,
      sortable: true,
    },
    { key: 'allocation', header: 'Allocation', minWidth: 190, accessor: (row) => allocationLabel(row), sortValue: (row) => row.allocations.reduce((acc, a) => acc + a.amount, 0), sortable: true },
    {
      key: 'unallocated',
      header: 'Unallocated',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.unallocatedAmount} tone={row.unallocatedAmount > 0 ? 'negative' : 'muted'} />,
      sortValue: (row) => row.unallocatedAmount,
      sortable: true,
    },
    {
      key: 'unit',
      header: 'Unit',
      width: 132,
      cell: (row) => {
        const key = unitKey(row.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : <Badge tone="warning" size="sm">Untagged</Badge>
      },
      sortValue: (row) => unitKey(row.unitId) ?? 'zzz',
      sortable: true,
    },
    { key: 'branch', header: 'Branch', width: 124, accessor: (row) => branchName(row.branchId), sortValue: (row) => branchName(row.branchId) },
    { key: 'status', header: 'Status', width: 140, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    { key: 'receivedBy', header: 'Received by', minWidth: 150, accessor: (row) => userName(row.createdBy), sortValue: (row) => userName(row.createdBy) },
    {
      key: 'receipt',
      header: 'Receipt sent',
      width: 132,
      cell: (row) =>
        row.receiptSentAt ? (
          <span className="text-body-13">{formatDate(row.receiptSentAt)}</span>
        ) : (
          <Badge tone="neutral" size="sm">Not sent</Badge>
        ),
      sortValue: (row) => row.receiptSentAt ?? '',
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Payments"
        description="Money received, and exactly which invoices it was applied to. A payment can cover several invoices, and any surplus stays visible as unallocated."
        tabs={FINANCE_TABS}
        activeTab="payments"
        onTabChange={navigate}
        actions={
          <>
            <Button size="sm" variant="secondary" onClick={() => navigate('reconciliation')}>
              Go to reconciliation
            </Button>
            <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setRecordOpen(true)}>
              Record payment
            </Button>
          </>
        }
      />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title="Payment recorded" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {unresolved > 0 && (
        <Alert tone="warning" icon={ShieldAlert} title={`${formatNumber(unresolved)} payments are not fully resolved`} className="mb-6">
          They stay on this list with their status showing. None of them has been guessed onto an invoice.
        </Alert>
      )}

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by payment reference, payer or payer reference"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setPage(1)
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                { key: 'method', label: 'Method', options: METHODS.map((m) => ({ value: m, label: m.replace(/_/g, ' ') })) },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={2040}
            bordered={false}
            caption="Payments received, their method, allocation across invoices and match status"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No payments match these filters"
                  message="Try a wider status or method, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Banknote}
                  title="No payments recorded"
                  message="Payments appear once a bank credit is matched to an invoice, or when money that arrived as cash, POS or a cheque is recorded by hand. Until then the money sits in the reconciliation queue where a person can see it."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => setRecordOpen(true)}>
                        Record a payment
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => navigate('reconciliation')}>
                        Open reconciliation
                      </Button>
                    </div>
                  }
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="payments" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <ManualPaymentModal open={recordOpen} onClose={() => setRecordOpen(false)} onDone={setNotice} />
    </Page>
  )
}
