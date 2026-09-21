import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Undo2 } from 'lucide-react'

import { formatDate, formatNaira } from '@/lib/format'
import {
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  MoneyCell,
  PageHeader,
  StatusBadge,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { commissionsCollection, invoicesCollection, refundsCollection, useCollection } from '@/mocks'
import type { Refund } from '@/mocks'

import { FINANCE_TABS, Page, ScreenError, personName, userName, useModuleNav, useScreenState } from './shared'

const STATUSES = ['requested', 'approved', 'processed', 'rejected'] as const

export default function Refunds() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()
  const refunds = useCollection(refundsCollection)
  const invoices = useCollection(invoicesCollection)
  const commissions = useCollection(commissionsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return refunds
      .filter((refund) => {
        if (filters.status && refund.status !== filters.status) return false
        if (!term) return true
        return refund.ref.toLowerCase().includes(term) || personName(refund.personId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [refunds, filters, search])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  function commissionImpact(refund: Refund): string {
    if (refund.affectedCommissionIds.length === 0) return 'No commission affected'
    return refund.affectedCommissionIds
      .map((id) => {
        const commission = commissions.find((c) => c.id === id)
        return commission ? `Reverses ${commission.ref} ${formatNaira(commission.amount)}` : `Reverses ${id}`
      })
      .join(' · ')
  }

  const columns: Array<Column<Refund>> = [
    { key: 'ref', header: 'Refund', pinned: true, width: 140, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    { key: 'student', header: 'Student', minWidth: 180, accessor: (row) => personName(row.personId), sortValue: (row) => personName(row.personId), sortable: true },
    {
      key: 'invoice',
      header: 'Invoice',
      width: 148,
      accessor: (row) => <span className="font-mono text-body-12">{invoices.find((i) => i.id === row.invoiceId)?.ref ?? row.invoiceId}</span>,
      sortValue: (row) => row.invoiceId,
    },
    { key: 'original', header: 'Original amount', align: 'right', cell: (row) => <MoneyCell kobo={row.originalAmount} tone="muted" />, sortValue: (row) => row.originalAmount, sortable: true },
    { key: 'amount', header: 'Refund amount', align: 'right', cell: (row) => <MoneyCell kobo={row.refundAmount} strong tone="negative" />, sortValue: (row) => row.refundAmount, sortable: true },
    { key: 'reason', header: 'Reason', minWidth: 240, accessor: (row) => row.reason, sortValue: (row) => row.reason },
    { key: 'requestedBy', header: 'Requested by', minWidth: 160, accessor: (row) => userName(row.requestedByUserId), sortValue: (row) => userName(row.requestedByUserId) },
    { key: 'approval', header: 'Approval', width: 140, accessor: (row) => <span className="font-mono text-body-12">{row.approvalRequestId}</span>, sortValue: (row) => row.approvalRequestId },
    {
      key: 'commission',
      header: 'Commission impact',
      minWidth: 260,
      accessor: (row) => (
        <span className={row.affectedCommissionIds.length > 0 ? 'text-warning-text' : 'text-text-secondary'}>{commissionImpact(row)}</span>
      ),
      sortValue: (row) => row.affectedCommissionIds.length,
      sortable: true,
    },
    { key: 'status', header: 'Status', width: 128, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    {
      key: 'processed',
      header: 'Processed',
      width: 128,
      accessor: (row) => (row.processedAt ? formatDate(row.processedAt) : <span className="text-text-secondary">Not yet</span>),
      sortValue: (row) => row.processedAt ?? '',
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Refunds"
        description="A refund is its own record. It never edits the invoice it came from, and it names the commission it reverses."
        tabs={FINANCE_TABS}
        activeTab="refunds"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by refund reference or student"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[{ key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s })) }]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => routerNavigate(`/finance/invoices/${row.invoiceId}`)}
            density="compact"
            minWidth={1900}
            bordered={false}
            caption="Refund requests with the invoice, amount, approval reference and commission impact"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No refunds match these filters"
                  message="Try another status, or clear the search term."
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
                  icon={Undo2}
                  title="No refunds requested"
                  message="Refunds are raised from an invoice and routed as approval requests. Nothing leaves the account without one."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('invoices')}>
                      Open invoices
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>
    </Page>
  )
}
