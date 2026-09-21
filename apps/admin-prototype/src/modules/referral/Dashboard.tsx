/**
 * §3.1 — Referral dashboard.
 *
 * Every number on this page is a selector call. Approve a commission in the
 * ledger and the funnel, the ageing buckets and the payable total all move
 * without a reload — which is the only way a dashboard in a prototype stops
 * feeling like a screenshot.
 *
 * It used to prove that by showing everything at once: eight stat cards in one
 * flat grid, then the state funnel, the ageing chart, the by-rule chart and
 * the top-referrers table — four more panels with no way to defer any of them.
 * It now opens on an **Overview** tab carrying the four numbers that answer
 * "is this scheme working", with the rest behind their own tabs. Nothing was
 * cut, and the two alarms — no rule in force, commission earned and unpaid
 * past thirty days — stay above the tab strip, because an alarm you have to
 * click to find is not an alarm.
 *
 * Two figures are here because the PRD insists on them, not because they are
 * pretty: referral conversion against the overall rate (the business case for
 * the module existing), and average days from Earned to Paid (a referral
 * scheme that pays late dies within one cohort).
 */

import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Clock,
  Coins,
  HandCoins,
  LayoutGrid,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react'

import {
  commissionByRule,
  commissionCountsByState,
  commissionRulesCollection,
  commissionTotalsByState,
  commissionsCollection,
  topReferrers,
  useCollection,
} from '@/mocks'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  SkeletonCard,
  SkeletonTable,
  TabPanel,
  Tabs,
  type TabItem,
} from '@/ui'
import type { Column } from '@/ui'
import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'

import {
  BENEFICIARY_LABEL,
  FUNNEL_STATES,
  SIDE_STATES,
  STATE_LABEL,
  STATE_TONE,
  unpaidAgeing,
} from './lib'
import { OverviewHeadlines, PaymentBand, ReferrersBand } from './DashboardStats'
import { BarChart, LoadFailed, ModulePage, Screen, StateBadge, useScreenState } from './parts'
import type { BarRow } from './parts'

type TopReferrer = ReturnType<typeof topReferrers>[number]

const DASHBOARD_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'flow', label: 'Commission flow', icon: Workflow },
  { id: 'referrers', label: 'Referrers', icon: Users },
  { id: 'payment', label: 'Payment health', icon: Wallet },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const query = useQueryState()
  /* Subscribe so a mutation anywhere in the module re-derives every figure. */
  const commissions = useCollection(commissionsCollection)
  const rules = useCollection(commissionRulesCollection)
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:dashboard')

  const tab = DASHBOARD_TABS.some((t) => t.id === query.get('tab'))
    ? (query.get('tab') as string)
    : 'overview'

  const totals = commissionTotalsByState()
  const counts = commissionCountsByState()
  const ageing = unpaidAgeing()
  const byRule = commissionByRule().filter((r) => r.count > 0)
  const leaders = topReferrers(8)

  const overdue = ageing.find((b) => b.alarming)
  const activeRules = rules.filter((r) => r.status === 'active')

  const goToLedger = (state: string) => navigate(`/referral/commissions?state=${state}`)

  if (errored) {
    return (
      <Screen>
        <ModulePage tab="dashboard" title="Referral & commission" />
        <LoadFailed what="The referral dashboard" onRetry={retry} />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <ModulePage tab="dashboard" title="Referral & commission" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </div>
        <Card padding="none" className="mt-6">
          <SkeletonTable rows={6} columns={6} />
        </Card>
      </Screen>
    )
  }

  if (forcedEmpty || commissions.length === 0) {
    return (
      <Screen>
        <ModulePage tab="dashboard" title="Referral & commission" />
        <Card padding="none">
          <EmptyState
            icon={Coins}
            variant="error"
            title="Nothing has been calculated yet"
            message="No commission exists in this workspace. Referrals may be arriving, but until a rule version is in force nobody is earning anything."
            action={<Button onClick={() => navigate('/referral/rules')}>Open commission rules</Button>}
            secondaryAction={
              <Button variant="secondary" onClick={() => navigate('/referral/referrers')}>
                See referrers
              </Button>
            }
          />
        </Card>
      </Screen>
    )
  }

  const funnelRows: BarRow[] = FUNNEL_STATES.map((state) => ({
    key: state,
    label: STATE_LABEL[state],
    caption: `${formatNumber(counts[state])} commission${counts[state] === 1 ? '' : 's'}`,
    value: Math.abs(totals[state]),
    valueLabel: formatNaira(totals[state]),
    tone: state === 'paid' ? 'accent' : state === 'tracked' || state === 'pending' ? 'neutral' : 'success',
  }))

  const sideRows: BarRow[] = SIDE_STATES.map((state) => ({
    key: state,
    label: STATE_LABEL[state],
    caption: `${formatNumber(counts[state])} commission${counts[state] === 1 ? '' : 's'}`,
    value: Math.abs(totals[state]),
    valueLabel: formatNaira(totals[state]),
    tone: state === 'disputed' ? 'warning' : 'danger',
  }))

  const ruleRows: BarRow[] = byRule
    .slice()
    .sort((a, b) => b.total - a.total)
    .map((row) => ({
      key: row.ruleId,
      label: `${row.ruleName} v${row.version}`,
      caption: `${formatNumber(row.count)} commission${row.count === 1 ? '' : 's'}`,
      value: Math.abs(row.total),
      valueLabel: formatNaira(row.total),
    }))

  const ageingRows: BarRow[] = ageing.map((bucket) => ({
    key: bucket.label,
    label: bucket.label,
    caption: `${formatNumber(bucket.count)} commission${bucket.count === 1 ? '' : 's'} earned, not yet paid`,
    value: bucket.amount,
    valueLabel: formatNaira(bucket.amount),
    tone: bucket.alarming ? 'danger' : bucket.label === '15–30 days' ? 'warning' : 'neutral',
  }))

  const leaderColumns: Array<Column<TopReferrer>> = [
    { key: 'name', header: 'Referrer', accessor: (r) => r.name, sortValue: (r) => r.name, minWidth: 170 },
    {
      key: 'type',
      header: 'Type',
      cell: (r) => (
        <Badge tone="neutral" variant="subtle" size="sm">
          {BENEFICIARY_LABEL[r.type]}
        </Badge>
      ),
      sortValue: (r) => BENEFICIARY_LABEL[r.type],
    },
    {
      key: 'referrals',
      header: 'Referrals',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{formatNumber(r.referrals)}</span>,
      sortValue: (r) => r.referrals,
    },
    {
      key: 'converted',
      header: 'Converted',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{formatNumber(r.converted)}</span>,
      sortValue: (r) => r.converted,
    },
    {
      key: 'conversion',
      header: 'Conversion',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{formatPercent(r.conversion)}</span>,
      sortValue: (r) => r.conversion,
    },
    {
      key: 'earned',
      header: 'Earned',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{formatNaira(r.earned)}</span>,
      sortValue: (r) => r.earned,
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{formatNaira(r.paid)}</span>,
      sortValue: (r) => r.paid,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (r) => (
        <span className={`tabular-nums ${r.outstanding > 0 ? 'text-warning-text' : 'text-text-secondary'}`}>
          {formatNaira(r.outstanding)}
        </span>
      ),
      sortValue: (r) => r.outstanding,
    },
  ]

  const funnelPanel = (
    <Card padding="none">
      <CardHeader
        title="Commission state funnel"
        description="Tracked through to Paid, with the side branch below."
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('/referral/commissions')}>
            Open the ledger
          </Button>
        }
      />
      <CardBody>
        <BarChart rows={funnelRows} ariaLabel="Commission value by state" />
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-label-10 text-text-muted">Side branch</p>
          <BarChart rows={sideRows} ariaLabel="Disputed, reversed and cancelled commission" />
        </div>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {[...FUNNEL_STATES, ...SIDE_STATES].map((state) => (
            <button
              key={state}
              type="button"
              onClick={() => goToLedger(state)}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              aria-label={`Filter the ledger to ${STATE_LABEL[state]}`}
            >
              <Badge tone={STATE_TONE[state]} variant="subtle" size="sm" className="tabular-nums">
                {STATE_LABEL[state]} {formatNumber(counts[state])}
              </Badge>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  )

  return (
    <Screen>
      <ModulePage
        tab="dashboard"
        title="Referral & commission"
        description="A financial subsystem, not a spreadsheet. Everything here is derived from the ledger."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/referral/rules')}>
              Commission rules
            </Button>
            <Button leftIcon={<HandCoins size={16} />} onClick={() => navigate('/referral/payouts/new')}>
              Run payout
            </Button>
          </>
        }
      />

      {activeRules.length === 0 && (
        <Alert tone="danger" icon={AlertTriangle} title="No commission rule is in force" className="mb-5">
          Nothing new will be calculated until one is active. Existing commissions keep their amounts, but no admission
          created today will produce a commission.
        </Alert>
      )}

      {overdue && overdue.count > 0 && (
        <Alert
          tone="warning"
          icon={Clock}
          title={`${formatNumber(overdue.count)} commissions have been earned for more than 30 days without being paid`}
          className="mb-5"
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('/referral/payouts/new')}>
              Run a payout
            </Button>
          }
        >
          {formatNaira(overdue.amount)} is owed to referrers who have already met every eligibility condition. A referral
          scheme that pays late dies within one cohort.
        </Alert>
      )}

      <Tabs
        aria-label="Dashboard sections"
        tabs={DASHBOARD_TABS}
        value={tab}
        onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
        className="mb-5"
      />

      <TabPanel
        id="referral-panel-overview"
        tabId="overview"
        active={tab === 'overview'}
        className="flex flex-col gap-6"
      >
        <OverviewHeadlines />
        {funnelPanel}
      </TabPanel>

      <TabPanel
        id="referral-panel-flow"
        tabId="flow"
        active={tab === 'flow'}
        className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
      >
        {funnelPanel}
        <Card padding="none">
          <CardHeader
            title="Commission by rule version"
            description="Which configuration is actually producing the money."
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('/referral/rules')}>
                Rules
              </Button>
            }
          />
          <CardBody>
            {ruleRows.length ? (
              <BarChart rows={ruleRows} ariaLabel="Commission total by rule version" />
            ) : (
              <EmptyState
                size="sm"
                title="No rule has produced a commission yet"
                message="Check the effective dates — a rule with no version in force calculates nothing."
              />
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel
        id="referral-panel-referrers"
        tabId="referrers"
        active={tab === 'referrers'}
        className="flex flex-col gap-6"
      >
        <ReferrersBand />
        <Card padding="none">
          <CardHeader
            title="Top referrers"
            description="By lifetime earned. Outstanding is earned minus paid."
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('/referral/referrers')}>
                All referrers
              </Button>
            }
          />
          <DataTable
            data={leaders}
            columns={leaderColumns}
            rowKey={(r) => r.profileId}
            density="compact"
            caption="Top referrers by lifetime commission earned"
            defaultSort={{ key: 'earned', direction: 'desc' }}
            onRowClick={(r) => navigate(`/referral/referrers/${r.profileId}`)}
            empty={
              <EmptyState
                title="No referrer has earned anything yet"
                message="Referrers appear here once a commission has been computed against them."
              />
            }
          />
        </Card>
      </TabPanel>

      <TabPanel
        id="referral-panel-payment"
        tabId="payment"
        active={tab === 'payment'}
        className="flex flex-col gap-6"
      >
        <PaymentBand />
        <Card padding="none">
          <CardHeader
            title="Ageing of unpaid commission"
            description="Days since the commission was earned. Red past thirty."
            actions={
              <Button size="sm" variant="ghost" onClick={() => navigate('/referral/payouts')}>
                Payouts
              </Button>
            }
          />
          <CardBody>
            <BarChart rows={ageingRows} ariaLabel="Unpaid commission by age" />
          </CardBody>
        </Card>
      </TabPanel>

      <p className="mt-4 text-body-13 text-text-secondary">
        Ledger totals: {formatNumber(commissions.length)} commission records ·{' '}
        <StateBadge state="paid" /> {formatNaira(totals.paid)} paid ·{' '}
        <StateBadge state="reversed" /> {formatNaira(totals.reversed)} reversed. Reversals are separate negative records;
        the originals still carry their full amounts.
      </p>
    </Screen>
  )
}
