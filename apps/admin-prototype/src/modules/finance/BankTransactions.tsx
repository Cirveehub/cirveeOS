import { useMemo, useState } from 'react'
import { Landmark } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
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
  type Column,
  type FilterValues,
} from '@/ui'
import { bankTransactionsCollection, paymentsCollection, useCollection } from '@/mocks'
import type { BankTransaction } from '@/mocks'

import { FINANCE_TABS, Page, ScreenError, useModuleNav, useScreenState } from './shared'

const BANKS = ['Zenith', 'GTBank', 'Providus'] as const
const MATCH_STATUSES = ['unmatched', 'possible_match', 'matched', 'ignored'] as const
const PAGE_SIZE = 30

export default function BankTransactions() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const transactions = useCollection(bankTransactionsCollection)
  const payments = useCollection(paymentsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return transactions
      .filter((txn) => {
        if (filters.bank && txn.bank !== filters.bank) return false
        if (filters.match && txn.matchStatus !== filters.match) return false
        if (filters.direction === 'credit' && txn.credit === null) return false
        if (filters.direction === 'debit' && txn.debit === null) return false
        if (!term) return true
        return txn.narration.toLowerCase().includes(term) || txn.reference.toLowerCase().includes(term)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [transactions, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const awaiting = transactions.filter((t) => t.matchStatus === 'unmatched' || t.matchStatus === 'possible_match').length

  const columns: Array<Column<BankTransaction>> = [
    { key: 'date', header: 'Date', pinned: true, width: 112, accessor: (row) => formatDate(row.date), sortValue: (row) => row.date, sortable: true },
    { key: 'bank', header: 'Bank', width: 104, accessor: (row) => row.bank, sortValue: (row) => row.bank, sortable: true },
    { key: 'account', header: 'Account', width: 96, accessor: (row) => <span className="font-mono text-body-12">···{row.accountLast4}</span>, sortValue: (row) => row.accountLast4 },
    {
      key: 'narration',
      header: 'Narration',
      minWidth: 360,
      accessor: (row) => <span className="font-mono text-body-12 text-text">{row.narration}</span>,
      sortValue: (row) => row.narration,
      sortable: true,
    },
    {
      key: 'credit',
      header: 'Credit',
      align: 'right',
      cell: (row) => (row.credit === null ? <span className="text-text-secondary">—</span> : <MoneyCell kobo={row.credit} tone="positive" />),
      sortValue: (row) => row.credit ?? 0,
      sortable: true,
    },
    {
      key: 'debit',
      header: 'Debit',
      align: 'right',
      cell: (row) => (row.debit === null ? <span className="text-text-secondary">—</span> : <MoneyCell kobo={row.debit} tone="negative" />),
      sortValue: (row) => row.debit ?? 0,
      sortable: true,
    },
    { key: 'balance', header: 'Running balance', align: 'right', cell: (row) => <MoneyCell kobo={row.runningBalance} tone="muted" />, sortValue: (row) => row.runningBalance, sortable: true },
    { key: 'reference', header: 'Reference', minWidth: 170, accessor: (row) => <span className="font-mono text-body-12 text-text-secondary">{row.reference}</span>, sortValue: (row) => row.reference },
    { key: 'match', header: 'Match status', width: 140, cell: (row) => <StatusBadge status={row.matchStatus} />, sortValue: (row) => row.matchStatus, sortable: true },
    {
      key: 'payment',
      header: 'Matched payment',
      width: 156,
      cell: (row) => {
        if (!row.paymentId) return <span className="text-text-secondary">—</span>
        const payment = payments.find((p) => p.id === row.paymentId)
        return <span className="font-mono text-body-12">{payment?.ref ?? row.paymentId}</span>
      },
      sortValue: (row) => row.paymentId ?? '',
    },
    {
      key: 'days',
      header: 'Days unmatched',
      align: 'right',
      width: 128,
      accessor: (row) => (
        <span className={`tabular-nums ${row.daysUnmatched >= 7 ? 'text-danger-text font-semibold' : ''}`}>
          {row.daysUnmatched > 0 ? formatNumber(row.daysUnmatched) : '—'}
        </span>
      ),
      sortValue: (row) => row.daysUnmatched,
      sortable: true,
    },
    {
      key: 'candidates',
      header: 'Candidates',
      align: 'right',
      width: 108,
      cell: (row) =>
        row.candidates.length === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <Badge tone="neutral" size="sm">{formatNumber(row.candidates.length)}</Badge>
        ),
      sortValue: (row) => row.candidates.length,
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Bank feed"
        description="The raw statement lines, narration untouched. Matching is hard precisely because this text is what the payer typed."
        tabs={FINANCE_TABS}
        activeTab="bank-transactions"
        onTabChange={navigate}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate('reconciliation')}>
            Reconcile {formatNumber(awaiting)} open
          </Button>
        }
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
              searchPlaceholder="Search the narration or reference"
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
                { key: 'bank', label: 'Bank', options: BANKS.map((b) => ({ value: b, label: b })) },
                { key: 'match', label: 'Match status', options: MATCH_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                {
                  key: 'direction',
                  label: 'Direction',
                  options: [
                    { value: 'credit', label: 'Money in' },
                    { value: 'debit', label: 'Money out' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={1920}
            bordered={false}
            caption="Raw bank statement lines with narration, amounts, match status and matched payment"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No statement lines match these filters"
                  message="Try another bank or match status, or clear the search."
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
                  icon={Landmark}
                  title="No bank transactions imported"
                  message="Without a statement feed there is nothing to reconcile against, and payments have to be entered by hand."
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="transactions" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>
    </Page>
  )
}
