/**
 * Unit P&L — the report that answers the most valuable unanswered question in
 * the business: which of the six units actually makes money.
 *
 * Every figure comes from `unitPnl(range)`. The table is the report; the
 * charts exist to make the ranking and the cost shape legible at a glance.
 *
 * Two bases are offered because they answer different questions. Accrual
 * (invoiced) says whether the unit is *earning*. Cash (collected) says
 * whether it is *funding itself*. The PRD forbids netting the two into one
 * number, so the toggle switches basis explicitly and the table carries both
 * columns either way.
 */

import { Scale } from 'lucide-react'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { expensesCollection, invoicesCollection, unitPnl } from '@/mocks'
import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { Alert, Card, CardHeader, DataTable, EmptyState, MoneyCell, Tabs, UnitTag } from '@/ui'
import type { Column } from '@/ui'

import { csvNaira } from '../lib/csv'
import { unitTagKey } from '../lib/scope'
import type { ReportDefinition, ReportScope } from '../lib/types'
import { AXIS, ChartCard, ChartTooltip, NEGATIVE, POSITIVE, SERIES_COLOUR, UNIT_COLOUR } from '../components/report-kit'

type PnlRow = ReturnType<typeof unitPnl>[number]
type Basis = 'accrual' | 'cash'

function rowsFor(scope: ReportScope): PnlRow[] {
  const rows = unitPnl(scope.range)
  return scope.unitId ? rows.filter((row) => row.unitId === scope.unitId) : rows
}

function cashMargin(row: PnlRow): number {
  return row.collected - row.directCost - row.payroll
}

function totals(rows: PnlRow[]) {
  return rows.reduce(
    (acc, row) => ({
      invoiced: acc.invoiced + row.invoiced,
      collected: acc.collected + row.collected,
      directCost: acc.directCost + row.directCost,
      payroll: acc.payroll + row.payroll,
      grossMargin: acc.grossMargin + row.grossMargin,
      cashMargin: acc.cashMargin + cashMargin(row),
      headcount: acc.headcount + row.headcount,
    }),
    { invoiced: 0, collected: 0, directCost: 0, payroll: 0, grossMargin: 0, cashMargin: 0, headcount: 0 },
  )
}

function UnitPnlBody({ range, unitId }: ReportScope) {
  const [basis, setBasis] = useState<Basis>('accrual')
  const rows = rowsFor({ range, unitId })
  const total = totals(rows)
  const accrual = basis === 'accrual'

  const ranked = [...rows].sort((a, b) =>
    accrual ? b.grossMargin - a.grossMargin : cashMargin(b) - cashMargin(a),
  )
  const best = ranked[0]
  const worst = ranked[ranked.length - 1]

  const marginData = ranked.map((row) => ({
    name: row.name,
    margin: accrual ? row.grossMargin : cashMargin(row),
    code: row.code,
  }))

  const compositionData = ranked.map((row) => ({
    name: row.name,
    'Direct cost': row.directCost,
    'Payroll allocation': row.payroll,
    'Gross margin': Math.max(0, accrual ? row.grossMargin : cashMargin(row)),
  }))

  const columns: Array<Column<PnlRow>> = [
    {
      key: 'unit',
      header: 'Unit',
      cell: (row) => <UnitTag unit={unitTagKey(row.code)} size="sm" />,
      sortValue: (row) => row.name,
      minWidth: 140,
      pinned: true,
    },
    {
      key: 'invoiced',
      header: 'Invoiced',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.invoiced} />,
      sortValue: (row) => row.invoiced,
    },
    {
      key: 'collected',
      header: 'Collected',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.collected} />,
      sortValue: (row) => row.collected,
    },
    {
      key: 'directCost',
      header: 'Direct cost',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.directCost} tone="muted" />,
      sortValue: (row) => row.directCost,
    },
    {
      key: 'payroll',
      header: 'Payroll allocation',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.payroll} tone="muted" />,
      sortValue: (row) => row.payroll,
    },
    {
      key: 'margin',
      header: accrual ? 'Gross margin' : 'Cash margin',
      align: 'right',
      cell: (row) => <MoneyCell kobo={accrual ? row.grossMargin : cashMargin(row)} strong />,
      sortValue: (row) => (accrual ? row.grossMargin : cashMargin(row)),
    },
    {
      key: 'marginPercent',
      header: 'Margin %',
      align: 'right',
      cell: (row) => {
        const base = accrual ? row.invoiced : row.collected
        const value = accrual
          ? row.marginPercent
          : base === 0
            ? 0
            : Number(((cashMargin(row) / base) * 100).toFixed(1))
        return (
          <span
            className={
              value >= 0
                ? 'font-semibold text-success-text tabular-nums'
                : 'font-semibold text-danger-text tabular-nums'
            }
          >
            {formatPercent(value)}
          </span>
        )
      },
      sortValue: (row) =>
        accrual
          ? row.marginPercent
          : row.collected === 0
            ? 0
            : (cashMargin(row) / row.collected) * 100,
    },
    {
      key: 'headcount',
      header: 'Headcount',
      align: 'right',
      accessor: (row) => formatNumber(row.headcount),
      sortValue: (row) => row.headcount,
    },
    {
      key: 'revenuePerHead',
      header: 'Revenue per head',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.revenuePerHead} compact tone="muted" />,
      sortValue: (row) => row.revenuePerHead,
    },
  ]

  if (rows.length === 0 || total.invoiced + total.collected === 0) {
    return (
      <EmptyState
        bordered
        title="No unit activity in this period"
        message="Unit P&L needs invoices, expenses and an open payroll period. Nothing was billed or spent against a unit in this window."
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          variant="pill"
          size="sm"
          aria-label="Margin basis"
          value={basis}
          onChange={(id) => setBasis(id as Basis)}
          tabs={[
            { id: 'accrual', label: 'Accrual basis' },
            { id: 'cash', label: 'Cash basis' },
          ]}
        />
        <p className="text-body-13 text-text-secondary">
          {accrual
            ? 'Margin against what was invoiced — whether the unit is earning.'
            : 'Margin against what was collected — whether the unit is funding itself.'}
        </p>
      </div>

      {best && worst && best.unitId !== worst.unitId && (
        <Alert tone={cashMargin(worst) < 0 || worst.grossMargin < 0 ? 'warning' : 'info'} icon={Scale}>
          <strong className="font-bold">{best.name}</strong> carries the business on this basis at{' '}
          {formatNaira(accrual ? best.grossMargin : cashMargin(best))} of margin.{' '}
          <strong className="font-bold">{worst.name}</strong> is last at{' '}
          {formatNaira(accrual ? worst.grossMargin : cashMargin(worst))}. Payroll is allocated from the
          open period, so a unit with no open payroll items shows cost only where it spent.
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          title={accrual ? 'Gross margin by unit' : 'Cash margin by unit'}
          description="Ranked. Bars below the line are units spending more than they bill."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={marginData} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke={AXIS.stroke} />
              <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: AXIS.stroke }} tick={AXIS.tick} interval={0} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={62}
                tick={AXIS.tick}
                tickFormatter={(value: number) => formatNaira(value, { compact: true })}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-sunken)' }}
                content={<ChartTooltip format={(value) => formatNaira(value)} />}
              />
              <Bar dataKey="margin" name="Margin" radius={[4, 4, 0, 0]} maxBarSize={52}>
                {marginData.map((row) => (
                  <Cell key={row.code} fill={row.margin >= 0 ? POSITIVE : NEGATIVE} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Where the money goes"
          description="Direct cost, allocated payroll and what is left, stacked per unit."
          footer={
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              {['Direct cost', 'Payroll allocation', 'Gross margin'].map((label, index) => (
                <li key={label} className="flex items-center gap-1.5 text-body-12 text-text-secondary">
                  <span
                    aria-hidden="true"
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: SERIES_COLOUR[index] }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          }
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={compositionData} margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke={AXIS.stroke} />
              <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: AXIS.stroke }} tick={AXIS.tick} interval={0} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={62}
                tick={AXIS.tick}
                tickFormatter={(value: number) => formatNaira(value, { compact: true })}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-surface-sunken)' }}
                content={<ChartTooltip format={(value) => formatNaira(value)} />}
              />
              <Bar dataKey="Direct cost" stackId="cost" fill={SERIES_COLOUR[0]} maxBarSize={52} />
              <Bar dataKey="Payroll allocation" stackId="cost" fill={SERIES_COLOUR[1]} maxBarSize={52} />
              <Bar
                dataKey="Gross margin"
                stackId="cost"
                fill={SERIES_COLOUR[2]}
                radius={[4, 4, 0, 0]}
                maxBarSize={52}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card>
        <CardHeader
          title="Unit profit and loss"
          description="Invoiced and collected are shown side by side and never netted against each other."
        />
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.unitId}
          minWidth={1080}
          bordered={false}
          caption="Profit and loss by business unit for the selected period"
          defaultSort={{ key: 'margin', direction: 'desc' }}
          footer={
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-body-13">
              <span className="font-bold text-text">
                All {formatNumber(rows.length)} units
              </span>
              <span className="text-text-secondary">
                Invoiced {formatNaira(total.invoiced)} · Collected {formatNaira(total.collected)} ·
                Direct cost {formatNaira(total.directCost)} · Payroll {formatNaira(total.payroll)}
              </span>
              <span className="font-bold text-text">
                {accrual ? 'Gross margin' : 'Cash margin'}{' '}
                {formatNaira(accrual ? total.grossMargin : total.cashMargin)} (
                {formatPercent(
                  (accrual ? total.invoiced : total.collected) === 0
                    ? 0
                    : ((accrual ? total.grossMargin : total.cashMargin) /
                        (accrual ? total.invoiced : total.collected)) *
                        100,
                )}
                )
              </span>
            </div>
          }
        />
      </Card>

      <p className="text-body-13 text-text-secondary">
        Direct cost is every non-rejected expense tagged to the unit inside the window. Payroll
        allocation is the gross of the payroll items tagged to the unit in the currently open period,
        which is why it does not move with the date range. Both are configuration, not code — change
        an expense&rsquo;s unit tag and this table changes with it.
      </p>
    </div>
  )
}

export const unitPnlReport: ReportDefinition = {
  key: 'unit-pnl',
  title: 'Unit P&L',
  description: 'Invoiced, collected, cost and margin for each of the six business units.',
  icon: Scale,
  depth: 'full',
  headline: (scope) => {
    const rows = rowsFor(scope)
    const total = totals(rows)
    const ranked = [...rows].sort((a, b) => b.marginPercent - a.marginPercent)
    const best = ranked[0]
    return [
      {
        label: 'Invoiced',
        value: formatNaira(total.invoiced, { compact: true }),
        hint: `${formatNaira(total.collected, { compact: true })} collected`,
      },
      {
        label: 'Gross margin',
        value: formatNaira(total.grossMargin, { compact: true }),
        hint: `${formatPercent(total.invoiced === 0 ? 0 : (total.grossMargin / total.invoiced) * 100)} of invoiced`,
      },
      {
        label: 'Strongest unit',
        value: best ? best.name : 'No data',
        hint: best ? `${formatPercent(best.marginPercent)} margin` : undefined,
      },
    ]
  },
  asOf: () => {
    const dates = [
      ...invoicesCollection.all().map((i) => i.updatedAt),
      ...expensesCollection.all().map((e) => e.updatedAt),
    ].sort()
    return dates.length ? dates[dates.length - 1] : null
  },
  csv: (scope) => {
    const rows = rowsFor(scope)
    const total = totals(rows)
    return {
      filename: `unit-pnl-${scope.range.from}-to-${scope.range.to}`,
      columns: [
        'Unit',
        'Invoiced (NGN)',
        'Collected (NGN)',
        'Direct cost (NGN)',
        'Payroll allocation (NGN)',
        'Gross margin (NGN)',
        'Margin %',
        'Headcount',
        'Revenue per head (NGN)',
      ],
      rows: [
        ...rows.map((row) => [
          row.name,
          csvNaira(row.invoiced),
          csvNaira(row.collected),
          csvNaira(row.directCost),
          csvNaira(row.payroll),
          csvNaira(row.grossMargin),
          row.marginPercent,
          row.headcount,
          csvNaira(row.revenuePerHead),
        ]),
        [
          'Total',
          csvNaira(total.invoiced),
          csvNaira(total.collected),
          csvNaira(total.directCost),
          csvNaira(total.payroll),
          csvNaira(total.grossMargin),
          total.invoiced === 0 ? 0 : Number(((total.grossMargin / total.invoiced) * 100).toFixed(1)),
          total.headcount,
          '',
        ],
      ],
    }
  },
  Body: UnitPnlBody,
}

export { UNIT_COLOUR }
