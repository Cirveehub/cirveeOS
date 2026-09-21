/**
 * Which unit is actually making money — the question the founder cannot
 * answer today. The full answer is the Unit P&L report; this is the headline
 * of it, on the screen the laptop opens on.
 */

import { Link } from 'react-router-dom'

import { unitPnl } from '@/mocks'
import type { DateRange } from '@/mocks'
import { formatPercent } from '@/lib/format'
import { Card, CardHeader, DataTable, EmptyState, MoneyCell, UnitTag } from '@/ui'
import type { Column } from '@/ui'

import { unitTagKey } from '../lib/scope'

type Row = ReturnType<typeof unitPnl>[number]

export function UnitMarginPanel({ range }: { range: DateRange }) {
  const rows = [...unitPnl(range)].sort((a, b) => b.grossMargin - a.grossMargin)
  const invoicedTotal = rows.reduce((acc, row) => acc + row.invoiced, 0)
  const marginTotal = rows.reduce((acc, row) => acc + row.grossMargin, 0)

  const columns: Array<Column<Row>> = [
    {
      key: 'unit',
      header: 'Unit',
      cell: (row) => <UnitTag unit={unitTagKey(row.code)} size="sm" />,
      sortValue: (row) => row.name,
      minWidth: 120,
    },
    {
      key: 'invoiced',
      header: 'Invoiced',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.invoiced} compact />,
      sortValue: (row) => row.invoiced,
    },
    {
      key: 'margin',
      header: 'Gross margin',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.grossMargin} compact />,
      sortValue: (row) => row.grossMargin,
    },
    {
      key: 'marginPercent',
      header: 'Margin %',
      align: 'right',
      cell: (row) => (
        <span
          className={
            row.marginPercent >= 0
              ? 'font-medium text-success-text tabular-nums'
              : 'font-medium text-danger-text tabular-nums'
          }
        >
          {formatPercent(row.marginPercent)}
        </span>
      ),
      sortValue: (row) => row.marginPercent,
    },
  ]

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Margin by unit"
        description="Invoiced less direct cost and the payroll allocated to the unit."
        actions={
          <Link
            to="/reports/unit-pnl"
            className="rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
          >
            Open unit P&amp;L
          </Link>
        }
      />
      {invoicedTotal === 0 ? (
        <EmptyState
          size="sm"
          title="Nothing invoiced in this period"
          message="Unit margin is computed from invoices, expenses and the open payroll period. None of the six units billed in this window."
        />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.unitId}
          density="compact"
          bordered={false}
          caption="Gross margin by business unit for the selected period"
          defaultSort={{ key: 'margin', direction: 'desc' }}
          footer={
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-body-13">
              <span className="font-bold text-text">All six units</span>
              <span className="text-text-secondary tabular-nums">
                <MoneyCell kobo={invoicedTotal} compact strong className="inline w-auto" /> invoiced ·{' '}
                <MoneyCell kobo={marginTotal} compact strong className="inline w-auto" /> margin ·{' '}
                {formatPercent(invoicedTotal === 0 ? 0 : (marginTotal / invoicedTotal) * 100)}
              </span>
            </div>
          }
        />
      )}
    </Card>
  )
}
