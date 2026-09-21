import { useMemo, useState } from 'react'
import { Paperclip, Plus, Receipt } from 'lucide-react'

import { formatDate } from '@/lib/format'
import {
  Alert,
  Badge,
  BUSINESS_UNITS,
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
import { expensesCollection, useCollection } from '@/mocks'
import type { Expense } from '@/mocks'

import { NewExpenseModal } from './modals'
import { FINANCE_TABS, Page, ScreenError, branchName, unitKey, userName, useModuleNav, useScreenState } from './shared'

const STATUSES = ['draft', 'pending_approval', 'approved', 'paid', 'rejected'] as const
const PAGE_SIZE = 25

export default function Expenses() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const expenses = useCollection(expensesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const categories = useMemo(() => [...new Set(expenses.map((e) => e.category))].sort(), [expenses])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return expenses
      .filter((expense) => {
        if (filters.status && expense.status !== filters.status) return false
        if (filters.unit && unitKey(expense.unitId) !== filters.unit) return false
        if (filters.category && expense.category !== filters.category) return false
        if (!term) return true
        return expense.ref.toLowerCase().includes(term) || expense.vendor.toLowerCase().includes(term)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [expenses, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<Expense>> = [
    { key: 'ref', header: 'Expense', pinned: true, width: 140, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    { key: 'date', header: 'Date', width: 112, accessor: (row) => formatDate(row.date), sortValue: (row) => row.date, sortable: true },
    { key: 'category', header: 'Category', minWidth: 160, accessor: (row) => row.category, sortValue: (row) => row.category, sortable: true },
    { key: 'vendor', header: 'Vendor', minWidth: 200, accessor: (row) => row.vendor, sortValue: (row) => row.vendor, sortable: true },
    { key: 'amount', header: 'Amount', align: 'right', cell: (row) => <MoneyCell kobo={row.amount} strong />, sortValue: (row) => row.amount, sortable: true },
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
    { key: 'requester', header: 'Requester', minWidth: 160, accessor: (row) => userName(row.requesterUserId), sortValue: (row) => userName(row.requesterUserId) },
    {
      key: 'approval',
      header: 'Approval',
      width: 140,
      accessor: (row) =>
        row.approvalRequestId ? <span className="font-mono text-body-12">{row.approvalRequestId}</span> : <span className="text-text-secondary">Under threshold</span>,
      sortValue: (row) => row.approvalRequestId ?? '',
    },
    { key: 'status', header: 'Status', width: 148, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    {
      key: 'paidDate',
      header: 'Paid',
      width: 116,
      accessor: (row) => (row.paidDate ? formatDate(row.paidDate) : <span className="text-text-secondary">Not paid</span>),
      sortValue: (row) => row.paidDate ?? '',
      sortable: true,
    },
    {
      key: 'receipt',
      header: 'Receipt',
      width: 112,
      cell: (row) =>
        row.receiptUrl ? (
          <span className="inline-flex items-center gap-1.5 text-body-13 text-text-secondary">
            <Paperclip size={16} aria-hidden="true" />
            Attached
          </span>
        ) : (
          <Badge tone="warning" size="sm">Missing</Badge>
        ),
      sortValue: (row) => Boolean(row.receiptUrl),
      sortable: true,
    },
    { key: 'budget', header: 'Budget line', minWidth: 190, accessor: (row) => row.budgetLine, sortValue: (row) => row.budgetLine },
  ]

  return (
    <Page>
      <PageHeader
        title="Expenses"
        description="Every cost carries the unit it belonged to, which is the only reason unit P&L can be trusted."
        tabs={FINANCE_TABS}
        activeTab="expenses"
        onTabChange={navigate}
        actions={
          <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New expense
          </Button>
        }
      />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title="Expense created" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
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
              searchPlaceholder="Search by expense reference or vendor"
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
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
                { key: 'category', label: 'Category', options: categories.map((c) => ({ value: c, label: c })) },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={1960}
            bordered={false}
            caption="Expenses with category, vendor, amount, unit, approval reference and status"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No expenses match these filters"
                  message="Try another category, unit or status, or clear the search."
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
                  icon={Receipt}
                  title="No expenses recorded"
                  message="With no costs booked, every unit will report a margin equal to its revenue — which is never true."
                  action={
                    <Button size="sm" onClick={() => setCreateOpen(true)}>
                      Record the first expense
                    </Button>
                  }
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="expenses" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <NewExpenseModal
        open={createOpen}
        existing={expenses}
        onClose={() => setCreateOpen(false)}
        onDone={setNotice}
      />
    </Page>
  )
}
