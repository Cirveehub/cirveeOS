import { useMemo, useState } from 'react'
import { Download, Info } from 'lucide-react'

import { formatDelta, formatNaira, formatNumber, formatPercent } from '@/lib/format'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  Label,
  MoneyCell,
  PageHeader,
  Select,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  Switch,
  UnitTag,
  type Column,
} from '@/ui'
import {
  TODAY,
  employeesCollection,
  expensesCollection,
  invoicesCollection,
  payrollItemsCollection,
  paymentsCollection,
  unitPnl,
  useCollection,
} from '@/mocks'
import type { DateRange } from '@/mocks'

import { CompositionLegend, StackedCompositionBar, type CompositionSegment } from './charts'
import { FINANCE_TABS, Page, ScreenError, StatGrid, unitKey, useModuleNav, useScreenState } from './shared'

/* -------------------------------------------------------------------------- */
/* Periods                                                                    */
/* -------------------------------------------------------------------------- */

function shift(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function monthOffset(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDate()
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

interface PeriodDef {
  id: string
  label: string
  range: DateRange
  previous: DateRange
  previousLabel: string
}

function buildPeriods(): PeriodDef[] {
  const monthStart = `${TODAY.slice(0, 7)}-01`
  const lastMonthStart = monthOffset(monthStart, -1)
  const lastMonthEnd = shift(monthStart, -1)
  const twoMonthsAgoStart = monthOffset(monthStart, -2)
  const twoMonthsAgoEnd = shift(lastMonthStart, -1)

  return [
    {
      id: 'mtd',
      label: 'This month to date',
      range: { from: monthStart, to: TODAY },
      previous: { from: lastMonthStart, to: monthOffset(TODAY, -1) },
      previousLabel: 'same days last month',
    },
    {
      id: 'last-month',
      label: 'Last full month',
      range: { from: lastMonthStart, to: lastMonthEnd },
      previous: { from: twoMonthsAgoStart, to: twoMonthsAgoEnd },
      previousLabel: 'the month before',
    },
    {
      id: 'last-30',
      label: 'Last 30 days',
      range: { from: shift(TODAY, -30), to: TODAY },
      previous: { from: shift(TODAY, -60), to: shift(TODAY, -31) },
      previousLabel: 'the preceding 30 days',
    },
    {
      id: 'last-90',
      label: 'Last 90 days',
      range: { from: shift(TODAY, -90), to: TODAY },
      previous: { from: shift(TODAY, -180), to: shift(TODAY, -91) },
      previousLabel: 'the preceding 90 days',
    },
  ]
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

interface PnlRow {
  unitId: string
  name: string
  invoiced: number
  collected: number
  directCost: number
  marketing: number
  payroll: number
  grossMargin: number
  marginPercent: number
  headcount: number
  revenuePerHead: number
  isTotal: boolean
}

function marketingByUnit(range: DateRange): Map<string, number> {
  const map = new Map<string, number>()
  for (const expense of expensesCollection.all()) {
    if (expense.status === 'rejected') continue
    if (expense.category !== 'Marketing') continue
    if (expense.date < range.from || expense.date > range.to) continue
    map.set(expense.unitId, (map.get(expense.unitId) ?? 0) + expense.amount)
  }
  return map
}

function discountByUnit(range: DateRange): Map<string, { discount: number; gross: number }> {
  const map = new Map<string, { discount: number; gross: number }>()
  for (const invoice of invoicesCollection.all()) {
    if (invoice.status === 'cancelled') continue
    if (invoice.issueDate < range.from || invoice.issueDate > range.to) continue
    const current = map.get(invoice.unitId) ?? { discount: 0, gross: 0 }
    current.discount += invoice.discountAmount
    current.gross += invoice.subtotal
    map.set(invoice.unitId, current)
  }
  return map
}

function buildRows(range: DateRange): PnlRow[] {
  const marketing = marketingByUnit(range)
  const rows: PnlRow[] = unitPnl(range).map((unit) => {
    const mkt = marketing.get(unit.unitId) ?? 0
    return {
      unitId: unit.unitId,
      name: unit.name,
      invoiced: unit.invoiced,
      collected: unit.collected,
      // `unitPnl` folds marketing into direct cost. Pull it out so the two
      // columns the spec names do not double-count against gross margin.
      directCost: unit.directCost - mkt,
      marketing: mkt,
      payroll: unit.payroll,
      grossMargin: unit.grossMargin,
      marginPercent: unit.marginPercent,
      headcount: unit.headcount,
      revenuePerHead: unit.revenuePerHead,
      isTotal: false,
    }
  })

  const sum = (pick: (row: PnlRow) => number) => rows.reduce((acc, row) => acc + pick(row), 0)
  const invoiced = sum((r) => r.invoiced)
  const headcount = sum((r) => r.headcount)
  const grossMargin = sum((r) => r.grossMargin)

  rows.push({
    unitId: '__total',
    name: 'All units',
    invoiced,
    collected: sum((r) => r.collected),
    directCost: sum((r) => r.directCost),
    marketing: sum((r) => r.marketing),
    payroll: sum((r) => r.payroll),
    grossMargin,
    marginPercent: invoiced === 0 ? 0 : Number(((grossMargin / invoiced) * 100).toFixed(1)),
    headcount,
    revenuePerHead: headcount === 0 ? 0 : Math.round(invoiced / headcount),
    isTotal: true,
  })

  return rows
}

function delta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function DeltaCell({ value }: { value: number | null }) {
  if (value === null) return <span className="text-body-13 text-text-muted">No base</span>
  const tone = value > 0 ? 'text-success-text' : value < 0 ? 'text-danger-text' : 'text-text-secondary'
  return <span className={`text-body-13 font-semibold tabular-nums ${tone}`}>{formatDelta(value)}</span>
}

/* -------------------------------------------------------------------------- */

export default function UnitPnl() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const periods = useMemo(buildPeriods, [])
  const [periodId, setPeriodId] = useState(periods[0].id)
  const [compare, setCompare] = useState(false)

  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const expenses = useCollection(expensesCollection)
  const payrollItems = useCollection(payrollItemsCollection)
  const employees = useCollection(employeesCollection)

  const period = periods.find((p) => p.id === periodId) ?? periods[0]

  const { rows, previousRows, discounts } = useMemo(
    () => ({
      rows: buildRows(period.range),
      previousRows: buildRows(period.previous),
      discounts: discountByUnit(period.range),
    }),
    // Every collection this table reads is a dependency, so a payment matched
    // on the reconciliation screen moves these numbers immediately.
    [period, invoices, payments, expenses, payrollItems, employees],
  )

  const previousById = useMemo(() => new Map(previousRows.map((r) => [r.unitId, r])), [previousRows])
  const total = rows[rows.length - 1]
  const unitRows = rows.filter((r) => !r.isTotal)
  const totalDiscount = [...discounts.values()].reduce((acc, d) => acc + d.discount, 0)
  const totalGross = [...discounts.values()].reduce((acc, d) => acc + d.gross, 0)

  function exportCsv() {
    const header = [
      'Unit',
      'Invoiced',
      'Collected',
      'Direct cost',
      'Payroll allocation',
      'Marketing spend',
      'Gross margin',
      'Margin %',
      'Headcount',
      'Revenue per head',
    ]
    const body = rows.map((row) =>
      [
        row.name,
        row.invoiced / 100,
        row.collected / 100,
        row.directCost / 100,
        row.payroll / 100,
        row.marketing / 100,
        row.grossMargin / 100,
        row.marginPercent,
        row.headcount,
        row.revenuePerHead / 100,
      ].join(','),
    )
    const csv = [header.join(','), ...body].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `unit-pnl-${period.id}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const columns: Array<Column<PnlRow>> = [
    {
      key: 'unit',
      header: 'Unit',
      pinned: true,
      minWidth: 170,
      cell: (row) => {
        if (row.isTotal) return <span className="font-semibold text-text">All units</span>
        const key = unitKey(row.unitId)
        return (
          <div className="flex items-center gap-2">
            {key && <UnitTag unit={key} size="sm" />}
            <span className="text-body-13 text-text-secondary">{row.name}</span>
          </div>
        )
      },
      sortValue: (row) => (row.isTotal ? 'zzz' : row.name),
      sortable: true,
    },
    {
      key: 'invoiced',
      header: 'Invoiced',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.invoiced} strong={row.isTotal} />,
      sortValue: (row) => row.invoiced,
      sortable: true,
    },
    ...(compare
      ? [
          {
            key: 'invoicedDelta',
            header: 'Invoiced Δ',
            align: 'right' as const,
            cell: (row: PnlRow) => <DeltaCell value={delta(row.invoiced, previousById.get(row.unitId)?.invoiced ?? 0)} />,
            sortValue: (row: PnlRow) => delta(row.invoiced, previousById.get(row.unitId)?.invoiced ?? 0) ?? -Infinity,
            sortable: true,
          },
        ]
      : []),
    {
      key: 'collected',
      header: 'Collected',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.collected} tone="positive" strong={row.isTotal} />,
      sortValue: (row) => row.collected,
      sortable: true,
    },
    ...(compare
      ? [
          {
            key: 'collectedDelta',
            header: 'Collected Δ',
            align: 'right' as const,
            cell: (row: PnlRow) => <DeltaCell value={delta(row.collected, previousById.get(row.unitId)?.collected ?? 0)} />,
            sortValue: (row: PnlRow) => delta(row.collected, previousById.get(row.unitId)?.collected ?? 0) ?? -Infinity,
            sortable: true,
          },
        ]
      : []),
    {
      key: 'directCost',
      header: 'Direct cost',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.directCost} tone="muted" strong={row.isTotal} />,
      sortValue: (row) => row.directCost,
      sortable: true,
    },
    {
      key: 'payroll',
      header: 'Payroll allocation',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.payroll} tone="muted" strong={row.isTotal} />,
      sortValue: (row) => row.payroll,
      sortable: true,
    },
    {
      key: 'marketing',
      header: 'Marketing spend',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.marketing} tone="muted" strong={row.isTotal} />,
      sortValue: (row) => row.marketing,
      sortable: true,
    },
    {
      key: 'grossMargin',
      header: 'Gross margin',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.grossMargin} signed strong={row.isTotal} />,
      sortValue: (row) => row.grossMargin,
      sortable: true,
    },
    ...(compare
      ? [
          {
            key: 'marginDelta',
            header: 'Margin Δ',
            align: 'right' as const,
            cell: (row: PnlRow) => <DeltaCell value={delta(row.grossMargin, previousById.get(row.unitId)?.grossMargin ?? 0)} />,
            sortValue: (row: PnlRow) => delta(row.grossMargin, previousById.get(row.unitId)?.grossMargin ?? 0) ?? -Infinity,
            sortable: true,
          },
        ]
      : []),
    {
      key: 'marginPercent',
      header: 'Margin %',
      align: 'right',
      accessor: (row) => (
        <span className={`tabular-nums ${row.marginPercent < 0 ? 'text-danger-text' : 'text-text'}`}>
          {formatPercent(row.marginPercent)}
        </span>
      ),
      sortValue: (row) => row.marginPercent,
      sortable: true,
    },
    {
      key: 'headcount',
      header: 'Headcount',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.headcount)}</span>,
      sortValue: (row) => row.headcount,
      sortable: true,
    },
    {
      key: 'revenuePerHead',
      header: 'Revenue per head',
      align: 'right',
      cell: (row) => <MoneyCell kobo={row.revenuePerHead} compact strong={row.isTotal} />,
      sortValue: (row) => row.revenuePerHead,
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Unit profit and loss"
        description="What each business unit invoiced, what it actually collected, what it cost to run, and what was left. The one question the old spreadsheets could never answer."
        tabs={FINANCE_TABS}
        activeTab="unit-pl"
        onTabChange={navigate}
        actions={
          <Button size="sm" variant="secondary" leftIcon={<Download size={16} />} onClick={exportCsv} disabled={state.loading}>
            Export CSV
          </Button>
        }
      />

      <ScreenError state={state} />

      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-end gap-6">
          <div className="min-w-56">
            <Label htmlFor="pnl-period">Period</Label>
            <Select
              id="pnl-period"
              selectSize="sm"
              value={periodId}
              onChange={(event) => setPeriodId(event.target.value)}
              options={periods.map((p) => ({ value: p.id, label: p.label }))}
            />
          </div>
          <div className="flex items-center gap-3 pb-1">
            <Switch
              id="pnl-compare"
              checked={compare}
              onChange={setCompare}
              label="Compare with previous period"
              description={`Adds change columns against ${period.previousLabel}.`}
            />
          </div>
          <p className="ml-auto pb-1 text-body-13 text-text-secondary">
            {period.range.from} to {period.range.to}
          </p>
        </CardBody>
      </Card>

      <StatGrid>
        {state.loading ? (
          Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} variant="stat" />)
        ) : (
          <>
            <StatCard label="Invoiced, all units" value={formatNaira(total.invoiced)} caption="Billed in the period" />
            <StatCard label="Collected, all units" value={formatNaira(total.collected)} variant="success" caption="Received and matched in the period" />
            <StatCard
              label="Gross margin"
              value={formatNaira(total.grossMargin)}
              variant={total.grossMargin >= 0 ? 'success' : 'danger'}
              caption={`${formatPercent(total.marginPercent)} of invoiced`}
            />
            <StatCard label="Headcount in scope" value={formatNumber(total.headcount)} caption="Employees not exited" />
            <StatCard label="Revenue per head" value={formatNaira(total.revenuePerHead, { compact: true })} caption="Invoiced ÷ headcount" />
          </>
        )}
      </StatGrid>

      <Card className="mt-6">
        <CardHeader
          title="Profit and loss by unit"
          description="Direct cost excludes marketing, which is broken out into its own column. Gross margin is invoiced less direct cost, payroll allocation and marketing."
        />
        <CardBody padding="none">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.unitId}
            loading={state.loading}
            density="compact"
            minWidth={compare ? 1320 : 1080}
            bordered={false}
            defaultSort={{ key: 'invoiced', direction: 'desc' }}
            rowClassName={(row) => (row.isTotal ? 'bg-surface-sunken' : undefined)}
            caption="Invoiced, collected, cost, margin, headcount and revenue per head for each business unit"
            emptyTitle="No units configured"
            emptyMessage="Unit P&L needs at least one business unit before it can report anything."
          />
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Where the invoiced money went"
            description="Each bar is one unit's invoiced revenue, split into direct cost, payroll allocation, marketing and what was left."
          />
          <CardBody className="space-y-5">
            {state.loading ? (
              <SkeletonTable rows={6} columns={2} showHeader={false} />
            ) : (
              <>
                <CompositionLegend
                  segments={[
                    { label: 'Direct cost', value: 0, className: 'bg-warning-500' },
                    { label: 'Payroll allocation', value: 0, className: 'bg-info-500' },
                    { label: 'Marketing', value: 0, className: 'bg-ui-400' },
                    { label: 'Gross margin', value: 0, className: 'bg-success-600' },
                  ]}
                />
                {unitRows.map((row) => {
                  const key = unitKey(row.unitId)
                  const segments: CompositionSegment[] = [
                    { label: 'Direct cost', value: row.directCost, className: 'bg-warning-500' },
                    { label: 'Payroll allocation', value: row.payroll, className: 'bg-info-500' },
                    { label: 'Marketing', value: row.marketing, className: 'bg-ui-400' },
                    { label: 'Gross margin', value: Math.max(0, row.grossMargin), className: 'bg-success-600' },
                  ]
                  const base = Math.max(row.invoiced, row.directCost + row.payroll + row.marketing)
                  return (
                    <div key={row.unitId}>
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        {key ? <UnitTag unit={key} size="sm" /> : <span className="text-body-13">{row.name}</span>}
                        <span className="text-body-12 text-text-secondary tabular-nums">
                          {formatNaira(row.grossMargin, { compact: true })} margin on {formatNaira(row.invoiced, { compact: true })} invoiced
                        </span>
                      </div>
                      <StackedCompositionBar
                        segments={segments}
                        total={base}
                        ariaLabel={`${row.name}: ${formatNaira(row.directCost)} direct cost, ${formatNaira(row.payroll)} payroll, ${formatNaira(row.marketing)} marketing, ${formatNaira(row.grossMargin)} gross margin`}
                      />
                      {row.grossMargin < 0 && (
                        <p className="mt-1.5 text-body-12 text-danger-text">
                          Costs exceeded invoiced revenue by {formatNaira(Math.abs(row.grossMargin))} in this period.
                        </p>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Discounts and scholarships"
            description="Recorded as a visible cost of winning the student, not quietly deducted from revenue."
          />
          <CardBody className="space-y-4">
            <Alert tone="info" icon={Info} title="Why this is not in the margin table">
              The invoiced column above is already net of discount. This panel keeps the amount given away visible, so a unit cannot
              look efficient simply because it discounted heavily.
            </Alert>
            {unitRows.map((row) => {
              const entry = discounts.get(row.unitId)
              const key = unitKey(row.unitId)
              return (
                <div key={row.unitId} className="flex items-center justify-between gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    {key && <UnitTag unit={key} size="sm" />}
                    <span className="text-body-13 text-text-secondary">
                      {entry && entry.gross > 0 ? `${formatPercent((entry.discount / entry.gross) * 100)} of gross billed` : 'Nothing billed this period'}
                    </span>
                  </div>
                  <MoneyCell kobo={entry?.discount ?? 0} tone="negative" />
                </div>
              )
            })}
            <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-sunken px-3 py-2.5">
              <span className="text-body-13 font-semibold text-text">Given away, all units</span>
              <MoneyCell
                kobo={totalDiscount}
                tone="negative"
                strong
                sub={totalGross > 0 ? `of ${formatNaira(totalGross, { compact: true })} gross billed` : undefined}
              />
            </div>
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
