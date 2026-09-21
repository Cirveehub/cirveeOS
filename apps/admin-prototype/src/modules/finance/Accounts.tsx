import { useMemo, useState } from 'react'
import { Wallet } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Button,
  BUSINESS_UNITS,
  Card,
  CardBody,
  ColumnPicker,
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
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import { accountsCollection, coursesCollection, invoicesCollection, useCollection } from '@/mocks'
import type { CustomerAccount } from '@/mocks'

import { FINANCE_TABS, Page, ScreenError, branchName, personName, unitKey, useModuleNav, useScreenState } from './shared'

const STATUSES = ['current', 'overdue', 'in_credit', 'settled', 'written_off'] as const
const PAGE_SIZE = 25

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'student', label: 'Student', defaultVisible: true, locked: true },
  { key: 'ref', label: 'Account reference', defaultVisible: true },
  { key: 'course', label: 'Course', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'originalFee', label: 'Original fee', defaultVisible: false },
  { key: 'discount', label: 'Approved discount', defaultVisible: false },
  { key: 'netFee', label: 'Net fee', defaultVisible: true },
  { key: 'invoiced', label: 'Invoiced', defaultVisible: false },
  { key: 'paid', label: 'Paid', defaultVisible: true },
  { key: 'credits', label: 'Credits', defaultVisible: false },
  { key: 'refunded', label: 'Refunded', defaultVisible: false },
  { key: 'balance', label: 'Balance', defaultVisible: true },
  { key: 'nextDue', label: 'Next instalment due', defaultVisible: false },
  { key: 'daysOverdue', label: 'Days overdue', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
]

export default function Accounts() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const accounts = useCollection(accountsCollection)
  const invoices = useCollection(invoicesCollection)
  const courses = useCollection(coursesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const derived = useMemo(() => {
    const map = new Map<string, { course: string; nextDue: string | null }>()
    for (const account of accounts) {
      const mine = invoices.filter((i) => i.accountId === account.id)
      const line = mine.flatMap((i) => i.lines).find((l) => l.courseId)
      const course = line?.courseId ? courses.find((c) => c.id === line.courseId)?.title ?? '—' : '—'
      const nextDue = mine
        .filter((i) => i.balance > 0 && i.status !== 'cancelled')
        .map((i) => i.dueDate)
        .sort()[0] ?? null
      map.set(account.id, { course, nextDue })
    }
    return map
  }, [accounts, invoices, courses])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return accounts
      .filter((account) => {
        if (filters.status && account.status !== filters.status) return false
        if (filters.unit && unitKey(account.unitId) !== filters.unit) return false
        if (filters.balance === 'owing' && account.balance <= 0) return false
        if (filters.balance === 'clear' && account.balance > 0) return false
        if (!term) return true
        return account.ref.toLowerCase().includes(term) || personName(account.personId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.balance - a.balance)
  }, [accounts, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const allColumns: Record<string, Column<CustomerAccount>> = Object.fromEntries(
    ([
    {
      key: 'student',
      header: 'Student',
      pinned: true,
      minWidth: 180,
      accessor: (row) => (row.organisationId ? 'Corporate account' : personName(row.personId)),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    { key: 'ref', header: 'Account', width: 132, accessor: (row) => <span className="font-mono text-body-13">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    { key: 'course', header: 'Course', minWidth: 190, accessor: (row) => derived.get(row.id)?.course ?? '—', sortValue: (row) => derived.get(row.id)?.course ?? '' },
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
    { key: 'branch', header: 'Branch', width: 124, accessor: (row) => branchName(row.branchId), sortValue: (row) => branchName(row.branchId) },
    { key: 'originalFee', header: 'Original fee', align: 'right', cell: (row) => <MoneyCell kobo={row.originalFee} tone="muted" />, sortValue: (row) => row.originalFee, sortable: true },
    {
      key: 'discount',
      header: 'Approved discount',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.approvedDiscount} tone={row.approvedDiscount > 0 ? 'negative' : 'muted'} />,
      sortValue: (row) => row.approvedDiscount,
      sortable: true,
    },
    { key: 'netFee', header: 'Net fee', align: 'right', cell: (row) => <MoneyCell kobo={row.netFee} strong />, sortValue: (row) => row.netFee, sortable: true },
    { key: 'invoiced', header: 'Invoiced', align: 'right', cell: (row) => <MoneyCell kobo={row.invoicedTotal} />, sortValue: (row) => row.invoicedTotal, sortable: true },
    { key: 'paid', header: 'Paid', align: 'right', cell: (row) => <MoneyCell kobo={row.paidTotal} tone="positive" />, sortValue: (row) => row.paidTotal, sortable: true },
    { key: 'credits', header: 'Credits', align: 'right', cell: (row) => <MoneyCell kobo={row.creditTotal} tone="muted" />, sortValue: (row) => row.creditTotal, sortable: true },
    { key: 'refunded', header: 'Refunded', align: 'right', cell: (row) => <MoneyCell kobo={row.refundedTotal} tone="muted" />, sortValue: (row) => row.refundedTotal, sortable: true },
    { key: 'balance', header: 'Balance', align: 'right', cell: (row) => <MoneyCell kobo={row.balance} strong tone={row.balance > 0 ? 'negative' : 'positive'} />, sortValue: (row) => row.balance, sortable: true },
    {
      key: 'nextDue',
      header: 'Next instalment due',
      width: 156,
      accessor: (row) => {
        const next = derived.get(row.id)?.nextDue
        return next ? formatDate(next) : <span className="text-text-secondary">Nothing outstanding</span>
      },
      sortValue: (row) => derived.get(row.id)?.nextDue ?? '',
      sortable: true,
    },
    {
      key: 'daysOverdue',
      header: 'Days overdue',
      align: 'right',
      width: 120,
      accessor: (row) => (
        <span className={`tabular-nums ${row.daysOverdue > 30 ? 'text-danger-text font-semibold' : ''}`}>
          {row.daysOverdue > 0 ? formatNumber(row.daysOverdue) : '—'}
        </span>
      ),
      sortValue: (row) => row.daysOverdue,
      sortable: true,
    },
    { key: 'status', header: 'Status', width: 128, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    ] as Array<Column<CustomerAccount>>).map((column) => [column.key, column]),
  )

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)
  const tableWidth = columns.reduce((sum, column) => {
    const declared = typeof column.width === 'number' ? column.width : typeof column.minWidth === 'number' ? column.minWidth : undefined
    return sum + (declared ?? 140)
  }, 0)

  return (
    <Page>
      <PageHeader
        title="Student accounts"
        description="Original fee, the discount that was approved, and what is actually left to collect. The discount is shown as its own column rather than folded quietly into the fee."
        tabs={FINANCE_TABS}
        activeTab="accounts"
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
              searchPlaceholder="Search by student or account reference"
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
                {
                  key: 'balance',
                  label: 'Balance',
                  options: [
                    { value: 'owing', label: 'Carrying a balance' },
                    { value: 'clear', label: 'Nothing outstanding' },
                  ],
                },
              ]}
            />
            <ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={tableWidth}
            bordered={false}
            caption="Student accounts with fee, approved discount, invoiced, paid, credits, refunds and balance"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No accounts match these filters"
                  message="Try a different status or unit, or clear the search term."
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
                  icon={Wallet}
                  title="No student accounts yet"
                  message="An account is created the moment an admission is confirmed. Until then there is nothing to bill against."
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="accounts" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>
    </Page>
  )
}
