import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart3, CalendarClock, Coins, LayoutGrid, Lock, Receipt, ShieldCheck, TrendingDown, Users, Wallet } from 'lucide-react'

import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  MoneyCell,
  PageHeader,
  SectionHeader,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  StatusBadge,
  TabPanel,
  Tabs,
  UnitTag,
  type TabItem,
} from '@/ui'
import {
  employeesCollection,
  payrollAdjustmentsCollection,
  payrollItemsCollection,
  payrollPeriodsCollection,
  payslipsCollection,
  select,
  useCollection,
} from '@/mocks'

import { useQueryState } from '@/lib/view-state'

import {
  BarList,
  Caption,
  DASHBOARD_TAB,
  PAYROLL_TABS,
  Page,
  ScreenError,
  branchName,
  unitKey,
  unitName,
  useModuleNav,
  useScreenState,
} from './shared'

const DASHBOARD_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'cost', label: 'Cost allocation', icon: BarChart3 },
  { id: 'adjustments', label: 'Adjustments', icon: ShieldCheck },
]

function StatBand({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

const ADJUSTMENT_LABEL: Record<string, string> = {
  attendance: 'Attendance',
  commission: 'Commission',
  performance_bonus: 'Performance bonus',
  advance_repayment: 'Advance repayment',
  manual_correction: 'Manual correction',
  statutory: 'Statutory',
}

export default function Dashboard() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()
  const query = useQueryState()
  const tab = query.get('view') ?? 'overview'

  const periods = useCollection(payrollPeriodsCollection)
  const items = useCollection(payrollItemsCollection)
  const adjustments = useCollection(payrollAdjustmentsCollection)
  const payslips = useCollection(payslipsCollection)
  const employees = useCollection(employeesCollection)

  const totals = useMemo(() => select.payrollTotals(), [items, periods, adjustments]) // eslint-disable-line react-hooks/exhaustive-deps

  const openPeriod = periods.find((p) => p.status === 'open') ?? null
  const lastClosed = useMemo(
    () =>
      [...periods]
        .filter((p) => p.status === 'closed')
        .sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0] ?? null,
    [periods],
  )

  const periodItems = useMemo(
    () => (openPeriod ? items.filter((i) => i.periodId === openPeriod.id) : []),
    [items, openPeriod],
  )
  const periodAdjustments = useMemo(
    () => (openPeriod ? adjustments.filter((a) => a.periodId === openPeriod.id) : []),
    [adjustments, openPeriod],
  )

  const pendingReview = periodAdjustments.filter(
    (a) => a.status === 'proposed' || a.status === 'disputed' || a.status === 'hr_reviewed',
  ).length

  const attendanceDerived = totals?.attendanceDerivedAdjustments ?? 0
  const voidedAttendance = periodAdjustments.filter((a) => a.type === 'attendance' && a.status === 'voided').length

  const byUnit = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of periodItems) map.set(item.unitId, (map.get(item.unitId) ?? 0) + item.gross)
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [periodItems])

  const byBranch = useMemo(() => {
    const employeeBranch = new Map(employees.map((e) => [e.id as string, e.branchId as string]))
    const map = new Map<string, number>()
    for (const item of periodItems) {
      const branch = employeeBranch.get(item.employeeId) ?? 'unassigned'
      map.set(branch, (map.get(branch) ?? 0) + item.gross)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [periodItems, employees])

  const trend = useMemo(
    () =>
      [...periods]
        .sort((a, b) => a.year - b.year || a.month - b.month)
        .map((period) => ({ period, gross: period.grossTotal })),
    [periods],
  )

  const bySource = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const adjustment of periodAdjustments) {
      const current = map.get(adjustment.type) ?? { count: 0, total: 0 }
      map.set(adjustment.type, { count: current.count + 1, total: current.total + Math.abs(adjustment.amount) })
    }
    if (!map.has('attendance')) map.set('attendance', { count: 0, total: 0 })
    return [...map.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [periodAdjustments])

  const header = (
    <PageHeader
      title="Payroll"
      description="Assemble, review, approve and pay. Every component of every payslip traces back to the event that produced it."
      tabs={PAYROLL_TABS}
      activeTab={DASHBOARD_TAB}
      onTabChange={navigate}
      actions={
        openPeriod && (
          <Button size="sm" onClick={() => routerNavigate(`/payroll/periods/${openPeriod.id}`)}>
            Open {openPeriod.label}
          </Button>
        )
      }
    />
  )

  if (state.loading) {
    return (
      <Page>
        {header}
        <StatBand>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </StatBand>
        <div className="mt-6">
          <SkeletonTable rows={6} columns={4} />
        </div>
      </Page>
    )
  }

  if (!openPeriod || !totals) {
    return (
      <Page>
        {header}
        <ScreenError state={state} />
        <EmptyState
          icon={Wallet}
          title="No payroll period is open"
          message="Nobody can be paid until a period is opened for the month. Opening one draws in every active employee's current compensation version, then commission, bonuses and adjustments are added on top."
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('periods')}>
              See all periods
            </Button>
          }
        />
      </Page>
    )
  }

  return (
    <Page>
      {header}
      <ScreenError state={state} />

      <Tabs
        tabs={DASHBOARD_TABS}
        value={tab}
        onChange={(id) => query.set('view', id === 'overview' ? undefined : id)}
        aria-label="Payroll dashboard sections"
        className="mb-6"
      />

      <TabPanel id="panel-payroll-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
        <StatBand>
          <StatCard
            label="Current period"
            value={openPeriod.label}
            caption={<StatusBadge status={openPeriod.status} size="sm" />}
            icon={CalendarClock}
            onClick={() => routerNavigate(`/payroll/periods/${openPeriod.id}`)}
          />
          <StatCard
            label="Employees in the run"
            value={formatNumber(totals.employeeCount)}
            caption={`${formatNumber(employees.filter((e) => e.status !== 'exited').length)} on strength`}
            icon={Users}
          />
          <StatCard
            label="Net to pay"
            value={formatNaira(totals.net, { compact: true })}
            caption={`${formatNaira(totals.gross, { compact: true })} gross less ${formatNaira(totals.deductions, { compact: true })} deductions`}
            icon={Wallet}
            variant="success"
          />
          <StatCard
            label="Adjustments pending review"
            value={formatNumber(pendingReview)}
            caption={`${formatNumber(periodAdjustments.length)} adjustments on this period`}
            icon={ShieldCheck}
            variant={pendingReview > 0 ? 'warning' : 'default'}
            onClick={() => navigate('adjustments')}
          />
        </StatBand>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="The run, assembled"
            description="Payroll is built from upstream inputs — the compensation version in force, approved commission and approved adjustments. Nothing here is typed by hand."
            className="mb-4"
          />
          <BarList
            rows={[
              {
                key: 'gross',
                label: 'Gross',
                value: totals.gross,
                valueLabel: <MoneyCell kobo={totals.gross} compact />,
                note: 'Base and allowances, plus commission, bonuses and adjustments',
              },
              {
                key: 'deductions',
                label: 'Deductions',
                value: totals.deductions,
                valueLabel: <MoneyCell kobo={totals.deductions} compact />,
                tone: 'warning',
                note: 'PAYE, pension and NHF',
              },
              {
                key: 'net',
                label: 'Net',
                value: totals.net,
                valueLabel: <MoneyCell kobo={totals.net} compact />,
                tone: 'success',
                note: 'What actually leaves the account',
              },
              {
                key: 'commission',
                label: 'Commission lines',
                value: totals.commissionTotal,
                valueLabel: <MoneyCell kobo={totals.commissionTotal} compact />,
                note: `${formatNumber(totals.commissionLineCount)} lines, each linked back to the commission that earned it`,
              },
            ]}
            emptyMessage="This period has no lines on it yet."
          />
          <Caption>
            {`${formatNumber(payslips.length)} payslips on record. None are issued for ${openPeriod.label} until the period closes.`}
            {lastClosed ? ` Last closed period: ${lastClosed.label}, ${formatDate(lastClosed.closedAt ?? lastClosed.openedAt)}.` : ''}
          </Caption>
        </Card>
      </TabPanel>

      <TabPanel id="panel-payroll-cost" tabId="cost" active={tab === 'cost'} className="space-y-6">
        <StatBand>
          <StatCard label="Gross" value={formatNaira(totals.gross, { compact: true })} caption={formatNaira(totals.gross)} icon={Coins} />
          <StatCard
            label="Deductions"
            value={formatNaira(totals.deductions, { compact: true })}
            caption="PAYE, pension and NHF"
            icon={TrendingDown}
          />
          <StatCard label="Net" value={formatNaira(totals.net, { compact: true })} caption={formatNaira(totals.net)} icon={Wallet} variant="success" />
          <StatCard
            label="Payslips issued"
            value={formatNumber(payslips.length)}
            caption={`None yet for ${openPeriod.label} — issued at close`}
            icon={Receipt}
            onClick={() => navigate('payslips')}
          />
        </StatBand>

        <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Payroll cost by unit"
            description={`Gross for ${openPeriod.label}. Every payroll line carries the unit its cost is allocated to.`}
            className="mb-4"
          />
          <BarList
            rows={byUnit.map(([unitId, gross]) => {
              const key = unitKey(unitId)
              return {
                key: unitId,
                label: (
                  <span className="inline-flex items-center gap-2">
                    {key && <UnitTag unit={key} size="sm" />}
                    {unitName(unitId)}
                  </span>
                ),
                value: gross,
                valueLabel: <MoneyCell kobo={gross} compact />,
              }
            })}
            emptyMessage="No payroll lines have been allocated to a unit yet, so no unit P&L can be produced."
          />
        </Card>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Payroll cost by branch"
            description="Where the cost physically sits, which is not always where the revenue is recognised."
            className="mb-4"
          />
          <BarList
            rows={byBranch.map(([branchId, gross]) => ({
              key: branchId,
              label: branchName(branchId),
              value: gross,
              valueLabel: <MoneyCell kobo={gross} compact />,
            }))}
            emptyMessage="No employee on this run is attached to a branch."
          />
        </Card>
        </div>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Gross by period"
            description="Every period held in the store, oldest first. Closed periods cannot move."
            className="mb-4"
          />
          <BarList
            rows={trend.map(({ period, gross }) => ({
              key: period.id,
              label: (
                <span className="inline-flex items-center gap-2">
                  {period.label}
                  <StatusBadge status={period.status} size="sm" />
                </span>
              ),
              value: gross,
              valueLabel: <MoneyCell kobo={gross} compact />,
              tone: period.status === 'closed' ? 'neutral' : 'accent',
              note: `${formatNumber(period.employeeCount)} employees · net ${formatNaira(period.netTotal, { compact: true })}`,
            }))}
            emptyMessage="No payroll period has ever been run."
          />
          <Caption>
            A twelve-month trend needs twelve periods. Three exist in the seed, so the chart shows what there is rather than
            padding it out.
          </Caption>
        </Card>
      </TabPanel>

      <TabPanel id="panel-payroll-adjustments" tabId="adjustments" active={tab === 'adjustments'} className="space-y-6">
        <StatBand>
          <StatCard
            label="Adjustments on this period"
            value={formatNumber(periodAdjustments.length)}
            caption="Every one carries the event that produced it"
            icon={ShieldCheck}
            onClick={() => navigate('adjustments')}
          />
          <StatCard
            label="Pending review"
            value={formatNumber(pendingReview)}
            caption="Proposed, disputed or HR reviewed"
            icon={ShieldCheck}
            variant={pendingReview > 0 ? 'warning' : 'default'}
            onClick={() => navigate('adjustments')}
          />
          <StatCard
            label="Attendance-derived adjustments"
            value={formatNumber(attendanceDerived)}
            caption="Attendance deductions are disabled by policy"
            icon={Lock}
          />
          <StatCard
            label="Commission lines"
            value={formatNumber(totals.commissionLineCount)}
            caption={formatNaira(totals.commissionTotal)}
            icon={Receipt}
            onClick={() => routerNavigate('/referral/commissions')}
          />
        </StatBand>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Adjustment sources"
            description="Where every adjustment on this period came from. Attendance is listed at zero deliberately."
            className="mb-4"
          />
          <BarList
            rows={bySource.map(([type, { count, total }]) => ({
              key: type,
              label: (
                <span className="inline-flex items-center gap-2">
                  {ADJUSTMENT_LABEL[type] ?? type}
                  {type === 'attendance' && count === 0 && (
                    <Badge tone="neutral" size="sm">
                      Disabled by policy
                    </Badge>
                  )}
                </span>
              ),
              value: total,
              valueLabel: <MoneyCell kobo={total} compact />,
              tone: type === 'attendance' ? 'neutral' : 'accent',
              note: `${formatNumber(count)} ${count === 1 ? 'adjustment' : 'adjustments'}`,
            }))}
            emptyMessage="No adjustments have been raised against this period."
          />
        </Card>
      </TabPanel>
    </Page>
  )
}
