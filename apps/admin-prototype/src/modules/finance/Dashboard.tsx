import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Landmark,
  Link2Off,
  Percent,
  ReceiptText,
  Scale,
  TrendingDown,
  Undo2,
  Wallet,
} from 'lucide-react'

import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  MoneyCell,
  PageHeader,
  ProgressBar,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  TabPanel,
  Tabs,
  UnitTag,
  type Column,
  type TabItem,
} from '@/ui'
import {
  CASH_POSITION,
  MTD,
  TODAY,
  collectedRevenue,
  collectionRate,
  expensesCollection,
  invoicedRevenue,
  invoicesCollection,
  outstandingTuition,
  overdueBuckets,
  paymentsCollection,
  refundsCollection,
  revenueByUnit,
  studentsWithBalance,
  unitPnl,
  unmatchedPayments,
  useCollection,
} from '@/mocks'
import type { Expense } from '@/mocks'

import { DualLineChart, type DualLinePoint } from './charts'
import { FINANCE_TABS, Page, ScreenError, StatGrid, unitKey, useModuleNav, useScreenState } from './shared'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function monthWindows(count: number) {
  const year = Number(TODAY.slice(0, 4))
  const month = Number(TODAY.slice(5, 7))
  const out: Array<{ label: string; from: string; to: string }> = []
  for (let back = count - 1; back >= 0; back--) {
    const total = year * 12 + (month - 1) - back
    const y = Math.floor(total / 12)
    const m = (total % 12) + 1
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    out.push({
      label: MONTH_LABELS[m - 1],
      from: `${y}-${String(m).padStart(2, '0')}-01`,
      to: `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`,
    })
  }
  return out
}

type PnlRow = ReturnType<typeof unitPnl>[number]

function collectionBand() {
  const collected = collectedRevenue(MTD)
  const invoiced = invoicedRevenue(MTD)
  const buckets = overdueBuckets()
  return {
    collected,
    invoiced,
    rate: collectionRate(MTD),
    outstanding: outstandingTuition(),
    studentsWithBalance: studentsWithBalance(),
    overdue30Plus: buckets
      .filter((b) => b.label !== 'Current' && b.label !== '1–30 days')
      .reduce((acc, b) => acc + b.amount, 0),
    buckets,
    byUnit: revenueByUnit(MTD),
    series: monthWindows(6).map<DualLinePoint>((w) => ({
      label: w.label,
      collected: collectedRevenue({ from: w.from, to: w.to }),
      invoiced: invoicedRevenue({ from: w.from, to: w.to }),
    })),
  }
}

function costBand(expenses: Expense[]) {
  const inWindow = expenses.filter((e) => e.status !== 'rejected' && e.date >= MTD.from && e.date <= MTD.to)
  const expensesMtd = inWindow.reduce((acc, e) => acc + e.amount, 0)
  const byCategory = new Map<string, number>()
  for (const expense of inWindow) {
    byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount)
  }
  return {
    expensesMtd,
    netPosition: collectedRevenue(MTD) - expensesMtd,
    cashPosition: CASH_POSITION,
    untagged: expenses.filter((e) => !e.unitId).length,
    awaitingApproval: expenses.filter((e) => e.status === 'pending_approval').length,
    categories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
  }
}

function attentionBand(refundsPending: number) {
  const unmatched = unmatchedPayments()
  return {
    unmatched,
    unmatchedValue: unmatched.reduce((acc, p) => acc + p.amount, 0),
    refundsPending,
  }
}

export default function FinanceDashboard() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const query = useQueryState()

  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const expenses = useCollection(expensesCollection)
  const refunds = useCollection(refundsCollection)

  const collection = useMemo(collectionBand, [invoices, payments])
  const costs = useMemo(() => costBand(expenses), [expenses, payments])
  const attention = useMemo(
    () => attentionBand(refunds.filter((r) => r.status === 'requested' || r.status === 'approved').length),
    [payments, refunds],
  )
  const pnl = useMemo(() => unitPnl(MTD), [invoices, payments, expenses])

  const maxUnitInvoiced = Math.max(1, ...collection.byUnit.map((u) => u.invoiced))
  const maxCategory = Math.max(1, ...costs.categories.map(([, amount]) => amount))
  const maxBucket = Math.max(1, ...collection.buckets.map((b) => b.amount))

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', panelId: 'finance-panel-overview' },
    { id: 'collection', label: 'Collection', panelId: 'finance-panel-collection' },
    { id: 'costs', label: 'Costs and cash', panelId: 'finance-panel-costs' },
    { id: 'units', label: 'By unit', panelId: 'finance-panel-units' },
  ]
  const activeTab = query.get('view') ?? 'overview'

  const pnlColumns: Array<Column<PnlRow>> = [
    {
      key: 'unit',
      header: 'Unit',
      cell: (row) => {
        const key = unitKey(row.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : <span className="text-text-secondary">{row.name}</span>
      },
      sortValue: (row) => row.name,
      sortable: true,
    },
    { key: 'invoiced', header: 'Invoiced', align: 'right', cell: (row) => <MoneyCell kobo={row.invoiced} compact />, sortValue: (row) => row.invoiced, sortable: true },
    { key: 'collected', header: 'Collected', align: 'right', cell: (row) => <MoneyCell kobo={row.collected} compact tone="positive" />, sortValue: (row) => row.collected, sortable: true },
    { key: 'margin', header: 'Gross margin', align: 'right', cell: (row) => <MoneyCell kobo={row.grossMargin} compact signed tone="auto" />, sortValue: (row) => row.grossMargin, sortable: true },
    {
      key: 'marginPercent',
      header: 'Margin %',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatPercent(row.marginPercent)}</span>,
      sortValue: (row) => row.marginPercent,
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Finance"
        description="Money in, money out, and which unit it belonged to. Collected and invoiced revenue are reported separately, always."
        tabs={FINANCE_TABS}
        activeTab="overview"
        onTabChange={navigate}
        actions={
          <Button asChild variant="secondary" size="sm" rightIcon={<ArrowUpRight size={16} />}>
            <Link to="/finance/unit-pl">Open unit P&amp;L</Link>
          </Button>
        }
      />

      <ScreenError state={state} />

      <Tabs tabs={tabs} value={activeTab} onChange={(next) => query.set('view', next)} aria-label="Finance themes" className="mb-6" />

      {/* ------------------------------ Overview ------------------------------ */}
      <TabPanel id="finance-panel-overview" tabId="overview" active={activeTab === 'overview'}>
        <StatGrid>
          {state.loading ? (
            Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} variant="stat" />)
          ) : (
            <>
              <StatCard
                label="Collected month to date"
                value={formatNaira(collection.collected)}
                icon={Banknote}
                variant="success"
                caption="Matched payments only"
              />
              <StatCard
                label="Collection rate"
                value={formatPercent(collection.rate)}
                icon={Percent}
                variant={collection.rate >= 80 ? 'success' : 'warning'}
                caption={`${formatNaira(collection.collected, { compact: true })} of ${formatNaira(collection.invoiced, { compact: true })} invoiced`}
              />
              <StatCard
                label="Outstanding tuition"
                value={formatNaira(collection.outstanding)}
                icon={Wallet}
                variant="warning"
                caption={`${formatNumber(collection.studentsWithBalance)} students carry a balance`}
              />
              <StatCard
                label="Net position month to date"
                value={formatNaira(costs.netPosition)}
                icon={Scale}
                variant={costs.netPosition >= 0 ? 'success' : 'danger'}
                caption="Collected minus expenses — cash, not accrual"
              />
            </>
          )}
        </StatGrid>

        <div className="mt-6 grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader
              title="Collected against invoiced, by month"
              description="Two series, never one. A month can be heavily invoiced and lightly collected — that gap is the whole point."
            />
            <CardBody>
              {state.loading ? <SkeletonTable rows={4} columns={6} showHeader={false} /> : <DualLineChart points={collection.series} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Needs a decision today"
              description="Money that cannot move until somebody resolves it."
              actions={
                <Badge tone={attention.unmatched.length + attention.refundsPending > 0 ? 'warning' : 'success'}>
                  {formatNumber(attention.unmatched.length + attention.refundsPending)} open
                </Badge>
              }
            />
            <CardBody className="space-y-3">
              <AttentionRow
                icon={Link2Off}
                label="Unmatched payments"
                value={`${formatNumber(attention.unmatched.length)} · ${formatNaira(attention.unmatchedValue, { compact: true })}`}
                note="Held for a human. Nothing is ever auto-assigned on a guess."
                onOpen={() => navigate('reconciliation')}
                tone={attention.unmatched.length > 0 ? 'warning' : 'neutral'}
              />
              <AttentionRow
                icon={Undo2}
                label="Refunds pending"
                value={formatNumber(attention.refundsPending)}
                note="Requested or approved, not yet processed. Each one is a new record, never an edit."
                onOpen={() => navigate('refunds')}
                tone={attention.refundsPending > 0 ? 'warning' : 'neutral'}
              />
              <AttentionRow
                icon={AlertTriangle}
                label="Overdue over 30 days"
                value={formatNaira(collection.overdue30Plus, { compact: true })}
                note="The 31–60, 61–90 and 90+ buckets together."
                onOpen={() => navigate('accounts')}
                tone={collection.overdue30Plus > 0 ? 'danger' : 'neutral'}
              />
              <AttentionRow
                icon={ReceiptText}
                label="Expenses awaiting approval"
                value={formatNumber(costs.awaitingApproval)}
                note="Nothing is paid until an approval clears it."
                onOpen={() => navigate('expenses')}
                tone={costs.awaitingApproval > 0 ? 'warning' : 'neutral'}
              />
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      {/* ----------------------------- Collection ----------------------------- */}
      <TabPanel id="finance-panel-collection" tabId="collection" active={activeTab === 'collection'}>
        <p className="mb-4 text-body-14 text-text-secondary">
          {collection.rate >= 80
            ? `Collection is healthy: ${formatPercent(collection.rate)} of what was invoiced this month has landed.`
            : `${formatPercent(collection.rate)} of this month's invoicing has been collected — the gap is ${formatNaira(collection.invoiced - collection.collected)}.`}
        </p>

        <StatGrid>
          {state.loading ? (
            Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} variant="stat" />)
          ) : (
            <>
              <StatCard label="Collected month to date" value={formatNaira(collection.collected)} icon={Banknote} variant="success" caption="Matched payments only" />
              <StatCard label="Invoiced month to date" value={formatNaira(collection.invoiced)} icon={ReceiptText} caption="Never netted against collections" />
              <StatCard
                label="Collection rate"
                value={formatPercent(collection.rate)}
                icon={Percent}
                variant={collection.rate >= 80 ? 'success' : 'warning'}
              />
              <StatCard
                label="Outstanding tuition"
                value={formatNaira(collection.outstanding)}
                icon={Wallet}
                variant="warning"
                caption={`${formatNumber(collection.studentsWithBalance)} students carry a balance`}
              />
              <StatCard label="Overdue over 30 days" value={formatNaira(collection.overdue30Plus)} icon={AlertTriangle} variant="danger" caption="31–60, 61–90 and 90+ buckets" />
            </>
          )}
        </StatGrid>

        <Card className="mt-6">
          <CardHeader title="Ageing" description="Open invoice balances by days overdue." />
          <CardBody className="space-y-4">
            {collection.buckets.map((bucket) => (
              <ProgressBar
                key={bucket.label}
                value={bucket.amount}
                max={maxBucket}
                tone={bucket.label === 'Current' ? 'success' : bucket.label === '90+ days' ? 'danger' : 'warning'}
                label={`${bucket.label} · ${formatNumber(bucket.count)} invoices`}
                valueLabel={formatNaira(bucket.amount, { compact: true })}
              />
            ))}
          </CardBody>
        </Card>
      </TabPanel>

      {/* ---------------------------- Costs and cash --------------------------- */}
      <TabPanel id="finance-panel-costs" tabId="costs" active={activeTab === 'costs'}>
        <p className="mb-4 text-body-14 text-text-secondary">
          {costs.netPosition >= 0
            ? `Cash is ahead this month: ${formatNaira(costs.netPosition)} collected above what was spent.`
            : `Cash is behind this month by ${formatNaira(Math.abs(costs.netPosition))}.`}{' '}
          Every cost carries a unit tag, which is the only reason unit P&amp;L can be trusted.
        </p>

        <StatGrid>
          {state.loading ? (
            Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} variant="stat" />)
          ) : (
            <>
              <StatCard label="Expenses month to date" value={formatNaira(costs.expensesMtd)} icon={TrendingDown} caption="Excludes rejected claims" />
              <StatCard
                label="Net position month to date"
                value={formatNaira(costs.netPosition)}
                icon={Scale}
                variant={costs.netPosition >= 0 ? 'success' : 'danger'}
                caption="Collected minus expenses — cash, not accrual"
              />
              <StatCard label="Cash position" value={formatNaira(costs.cashPosition)} icon={Landmark} caption="Across Zenith, GTBank and Providus" />
            </>
          )}
        </StatGrid>

        <Card className="mt-6">
          <CardHeader
            title="Expenses by category"
            description="Month to date, approved and paid claims."
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('expenses')}>
                Open expenses
              </Button>
            }
          />
          <CardBody className="space-y-4">
            {costs.untagged > 0 && (
              <Alert tone="danger" title={`${formatNumber(costs.untagged)} expenses carry no unit tag`}>
                Every one of them is invisible to unit P&amp;L, which will overstate margin until they are tagged.
              </Alert>
            )}
            {costs.categories.length === 0 ? (
              <Alert tone="info" title="No expenses recorded this month">
                Costs booked from the first of the month appear here, each carrying its unit tag.
              </Alert>
            ) : (
              costs.categories.map(([category, amount]) => (
                <ProgressBar
                  key={category}
                  value={amount}
                  max={maxCategory}
                  tone="neutral"
                  label={category}
                  valueLabel={formatNaira(amount, { compact: true })}
                />
              ))
            )}
          </CardBody>
        </Card>
      </TabPanel>

      {/* ------------------------------- By unit ------------------------------- */}
      <TabPanel id="finance-panel-units" tabId="units" active={activeTab === 'units'}>
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Revenue by unit"
              description="Invoiced and collected are shown as separate bars for each unit — a stacked total would hide the collection gap."
            />
            <CardBody className="space-y-5">
              {collection.byUnit.map((unit) => {
                const key = unitKey(unit.unitId)
                return (
                  <div key={unit.unitId}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      {key ? <UnitTag unit={key} size="sm" /> : <span className="text-body-13">{unit.name}</span>}
                      <span className="text-body-12 text-text-secondary tabular-nums">
                        {formatNaira(unit.collected, { compact: true })} collected of {formatNaira(unit.invoiced, { compact: true })} invoiced
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <ProgressBar value={unit.invoiced} max={maxUnitInvoiced} tone="accent" size="sm" aria-label={`${unit.name} invoiced`} />
                      <ProgressBar value={unit.collected} max={maxUnitInvoiced} tone="success" size="sm" aria-label={`${unit.name} collected`} />
                    </div>
                  </div>
                )
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Unit profit and loss"
              description="Month to date. The full view carries direct cost, payroll allocation, headcount and revenue per head."
              actions={
                <Button asChild size="sm" variant="ghost" rightIcon={<ArrowUpRight size={16} />}>
                  <Link to="/finance/unit-pl">Full unit P&amp;L</Link>
                </Button>
              }
            />
            <CardBody padding="none">
              <DataTable
                data={pnl}
                columns={pnlColumns}
                rowKey={(row) => row.unitId}
                loading={state.loading}
                density="compact"
                bordered={false}
                caption="Invoiced, collected and gross margin for each business unit, month to date"
                emptyTitle="No units configured"
                emptyMessage="Unit P&L needs at least one business unit. Units are set up in Settings."
              />
            </CardBody>
          </Card>
        </div>
      </TabPanel>
    </Page>
  )
}

function AttentionRow({
  icon: Icon,
  label,
  value,
  note,
  onOpen,
  tone,
}: {
  icon: typeof Link2Off
  label: string
  value: string
  note: string
  onOpen: () => void
  tone: 'warning' | 'danger' | 'neutral'
}) {
  const accent =
    tone === 'danger' ? 'text-danger-text' : tone === 'warning' ? 'text-warning-text' : 'text-text-secondary'
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-xl border border-border px-4 py-3 text-left transition-colors hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon size={16} aria-hidden="true" className={`mt-0.5 shrink-0 ${accent}`} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-body-14 text-text">{label}</span>
          <span className={`text-body-14 font-semibold tabular-nums ${accent}`}>{value}</span>
        </span>
        <span className="mt-0.5 block text-body-12 text-text-secondary">{note}</span>
      </span>
    </button>
  )
}
