import { RotateCcw } from 'lucide-react'
import { Link } from 'react-router-dom'

import { TODAY, paymentsCollection } from '@/mocks'
import type { Payment } from '@/mocks'
import { formatDate, formatTime } from '@/lib/format'
import { Alert, Button, Card, CardHeader, DataTable, EmptyState, MoneyCell, StatusBadge } from '@/ui'
import type { Column } from '@/ui'

import { BriefPanel } from '../components/BriefPanel'
import { ExecutiveHomeSkeleton } from '../components/HomeSkeleton'
import { HomeHeader } from '../components/HomeHeader'
import { ScopeBar } from '../components/ScopeBar'
import { useExecutiveLive } from '../lib/live'
import { useScope } from '../lib/scope'
import { useScreenState } from '../lib/screen-state'
import { shiftDays } from '../lib/series'

const columns: Array<Column<Payment>> = [
  { key: 'ref', header: 'Reference', accessor: (row) => row.ref, sortable: true, minWidth: 110 },
  { key: 'payer', header: 'Payer', accessor: (row) => row.payerName, sortable: true, minWidth: 180 },
  {
    key: 'narration',
    header: 'Bank narration',
    cell: (row) => (
      <span className="font-mono text-body-12 text-text-secondary">{row.payerReference}</span>
    ),
    sortValue: (row) => row.payerReference,
    minWidth: 240,
  },
  {
    key: 'received',
    header: 'Received',
    accessor: (row) => formatTime(row.receivedAt),
    sortValue: (row) => row.receivedAt,
    align: 'right',
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} size="sm" />,
    sortValue: (row) => row.status,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    cell: (row) => <MoneyCell kobo={row.amount} decimals />,
    sortValue: (row) => row.amount,
  },
]

export default function BriefPage() {
  const { units } = useExecutiveLive()
  const scope = useScope(units)
  const { status, retry } = useScreenState('home-brief')

  const yesterday = shiftDays(TODAY, -1)
  const rows = paymentsCollection
    .where((p) => p.status === 'matched' && p.receivedAt.slice(0, 10) === yesterday)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))

  return (
    <div className="px-8 py-6">
      <HomeHeader
        active="brief"
        description={`Everything that moved on ${formatDate(yesterday)}, with the records behind each line.`}
      />

      <div className="mb-6">
        <ScopeBar scope={scope} units={units} />
      </div>

      {status === 'error' && (
        <Alert
          tone="danger"
          title="The brief could not be assembled"
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={retry}>
              Retry
            </Button>
          }
        >
          The underlying records are still there — only the summary failed. Retry, or open the modules
          directly from the sidebar.
        </Alert>
      )}

      {status === 'loading' ? (
        <ExecutiveHomeSkeleton />
      ) : (
        <div className="space-y-6">
          <BriefPanel rangeLabel={scope.rangeLabel} expanded />

          <Card>
            <CardHeader
              title="Payments matched yesterday"
              description="The evidence behind the first line of the brief."
            />
            {rows.length === 0 ? (
              <EmptyState
                title="No payments were matched yesterday"
                message="Money that arrived but has not been matched stays in reconciliation and is never auto-assigned to an invoice."
                action={
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/finance/reconciliation">Open reconciliation</Link>
                  </Button>
                }
              />
            ) : (
              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.id}
                density="compact"
                bordered={false}
                caption="Payments matched on the day the brief covers"
                defaultSort={{ key: 'amount', direction: 'desc' }}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
