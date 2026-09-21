import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  BUSINESS_UNITS,
  Button,
  Card,
  CardBody,
  Checkbox,
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
import { invoicesCollection, unitsCollection, useCollection } from '@/mocks'
import type { Invoice } from '@/mocks'

import { FINANCE_TABS, Page, ScreenError, branchName, personName, unitKey, userName, useModuleNav, useScreenState } from './shared'

const STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded'] as const

const AMOUNT_BANDS = [
  { value: 'under-250k', label: 'Under ₦250,000', min: 0, max: 25_000_000 },
  { value: '250k-1m', label: '₦250,000 – ₦1,000,000', min: 25_000_000, max: 100_000_000 },
  { value: 'over-1m', label: 'Over ₦1,000,000', min: 100_000_000, max: Number.MAX_SAFE_INTEGER },
]

const PAGE_SIZE = 25

export default function Invoices() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()

  const invoices = useCollection(invoicesCollection)
  const units = useCollection(unitsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const band = AMOUNT_BANDS.find((b) => b.value === filters.amount)
    const term = search.trim().toLowerCase()
    return invoices
      .filter((invoice) => {
        if (filters.status && invoice.status !== filters.status) return false
        if (filters.unit && unitKey(invoice.unitId) !== filters.unit) return false
        if (overdueOnly && invoice.daysOverdue <= 0) return false
        if (band && (invoice.total < band.min || invoice.total >= band.max)) return false
        if (!term) return true
        return (
          invoice.ref.toLowerCase().includes(term) || personName(invoice.personId).toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.issueDate.localeCompare(a.issueDate))
  }, [invoices, filters, overdueOnly, search, units])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const columns: Array<Column<Invoice>> = [
    {
      key: 'ref',
      header: 'Invoice',
      pinned: true,
      width: 148,
      accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.ref}</span>,
      sortValue: (row) => row.ref,
      sortable: true,
    },
    {
      key: 'customer',
      header: 'Customer',
      minWidth: 180,
      accessor: (row) => (row.organisationId ? 'Corporate account' : personName(row.personId)),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    {
      key: 'admission',
      header: 'Admission',
      width: 128,
      accessor: (row) => <span className="font-mono text-body-12 text-text-secondary">{row.admissionId ?? '—'}</span>,
      sortValue: (row) => row.admissionId ?? '',
    },
    { key: 'issue', header: 'Issued', width: 116, accessor: (row) => formatDate(row.issueDate), sortValue: (row) => row.issueDate, sortable: true },
    { key: 'due', header: 'Due', width: 116, accessor: (row) => formatDate(row.dueDate), sortValue: (row) => row.dueDate, sortable: true },
    {
      key: 'unit',
      header: 'Unit',
      width: 132,
      cell: (row) => {
        const key = unitKey(row.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : <span className="text-text-secondary">—</span>
      },
      sortValue: (row) => unitKey(row.unitId) ?? '',
      sortable: true,
    },
    { key: 'branch', header: 'Branch', width: 124, accessor: (row) => branchName(row.branchId), sortValue: (row) => branchName(row.branchId), sortable: true },
    { key: 'subtotal', header: 'Subtotal', align: 'right', cell: (row) => <MoneyCell kobo={row.subtotal} tone="muted" />, sortValue: (row) => row.subtotal, sortable: true },
    { key: 'discount', header: 'Discount', align: 'right', cell: (row) => <MoneyCell kobo={row.discountAmount} tone={row.discountAmount > 0 ? 'negative' : 'muted'} />, sortValue: (row) => row.discountAmount, sortable: true },
    { key: 'total', header: 'Total', align: 'right', cell: (row) => <MoneyCell kobo={row.total} strong />, sortValue: (row) => row.total, sortable: true },
    { key: 'paid', header: 'Paid', align: 'right', cell: (row) => <MoneyCell kobo={row.paidAmount} tone="positive" />, sortValue: (row) => row.paidAmount, sortable: true },
    { key: 'balance', header: 'Balance', align: 'right', cell: (row) => <MoneyCell kobo={row.balance} tone={row.balance > 0 ? 'negative' : 'muted'} />, sortValue: (row) => row.balance, sortable: true },
    { key: 'status', header: 'Status', width: 132, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    {
      key: 'overdue',
      header: 'Days overdue',
      align: 'right',
      width: 118,
      accessor: (row) => (
        <span className={`tabular-nums ${row.daysOverdue > 30 ? 'text-danger-text font-semibold' : ''}`}>
          {row.daysOverdue > 0 ? formatNumber(row.daysOverdue) : '—'}
        </span>
      ),
      sortValue: (row) => row.daysOverdue,
      sortable: true,
    },
    { key: 'issuedBy', header: 'Issued by', minWidth: 150, accessor: (row) => userName(row.issuedByUserId), sortValue: (row) => userName(row.issuedByUserId) },
  ]

  return (
    <Page>
      <PageHeader
        title="Invoices"
        description="Every invoice carries a unit tag. An issued invoice is never edited — a reduction is a credit note, money going back is a refund, and cancelling is a void that credits rather than erases. Open a row for all three."
        tabs={FINANCE_TABS}
        activeTab="invoices"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by invoice reference or student"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setOverdueOnly(false)
                setPage(1)
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
                { key: 'amount', label: 'Amount', options: AMOUNT_BANDS.map((b) => ({ value: b.value, label: b.label })) },
              ]}
            >
              <Checkbox
                label="Overdue only"
                checked={overdueOnly}
                onChange={(event) => {
                  setOverdueOnly(event.target.checked)
                  setPage(1)
                }}
              />
            </FilterBar>
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => routerNavigate(`/finance/invoices/${row.id}`)}
            density="compact"
            minWidth={1760}
            bordered={false}
            caption="Invoices with unit, branch, totals, balance and status"
            empty={
              rows.length === 0 && (search || Object.values(filters).some(Boolean) || overdueOnly) ? (
                <EmptyState
                  variant="search"
                  title="No invoices match these filters"
                  message="Widen the status, unit or amount filter, or clear the search term."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                        setOverdueOnly(false)
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No invoices yet"
                  message="Invoices are raised from an admission once a discount, if any, has been approved. Until one exists, nothing is billed and nothing is owed."
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="invoices" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

    </Page>
  )
}
