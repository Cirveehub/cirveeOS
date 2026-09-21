/**
 * CRM dashboard — §2.1.
 *
 * Is the pipeline healthy, and is anyone letting leads rot.
 *
 * This screen used to answer both questions by showing everything at once:
 * eight stat cards in one flat grid, then the funnel, the source bars, the
 * ageing heat strip, the owner table and the loss reasons — five sections, no
 * way to defer any of it. It now opens on an **Overview** tab carrying four
 * headline numbers and the two panels that matter regardless of theme (the
 * funnel and the ageing strip, because "where are leads stuck" is the question
 * this dashboard exists for), with every other number moved behind its own
 * tab. Nothing was deleted.
 *
 * Tab state lives in the query string through `useQueryState`, so a tab is a
 * link — the same discipline as every other piece of view state in the app.
 * Every chart row is still a deep link into `/crm/leads` carrying the
 * dashboard's own range, unit and branch.
 */

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Activity,
  GraduationCap,
  LayoutGrid,
  Radio,
  Target,
} from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Select,
  SkeletonCard,
  SkeletonTable,
  TabPanel,
  Tabs,
  type Column,
  type TabItem,
} from '@/ui'
import { formatNumber, formatPercent } from '@/lib/format'
import {
  LAST_30D,
  LAST_90D,
  TODAY,
  admissionsCollection,
  leadsCollection,
  select,
  useCollection,
} from '@/mocks'
import type { BranchId, DateRange, Lead, LeadFilters, LossReason, UnitId, UserId } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { BarList, type BarRow } from '../components/BarList'
import {
  AdmissionsBand,
  OverviewHeadlines,
  PipelineBand,
  ResponseBand,
  type CrmScope,
} from '../components/CrmStats'
import {
  AGE_BUCKETS,
  CLOSED_STAGES,
  LOSS_REASON_LABELS,
  OPEN_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  useDirectory,
} from '../lib/lookups'
import { useQueryState, useScreenLoad } from '../lib/view-state'

const RANGE_OPTIONS: Array<{ value: string; label: string; range: DateRange }> = [
  { value: '30d', label: 'Last 30 days', range: LAST_30D },
  { value: '90d', label: 'Last 90 days', range: LAST_90D },
]

const DASHBOARD_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'pipeline', label: 'Pipeline', icon: Target },
  { id: 'response', label: 'Response', icon: Activity },
  { id: 'sources', label: 'Sources', icon: Radio },
  { id: 'admissions', label: 'Admissions', icon: GraduationCap },
]

interface OwnerRow {
  userId: UserId
  name: string
  open: number
  avgDaysInStage: number
  withinSla: number
  enrolledThisMonth: number
  conversion: number
}

export default function CrmDashboard() {
  const query = useQueryState()
  const navigate = useNavigate()
  const { loading, error, retry } = useScreenLoad('crm.dashboard')
  const { userNameOf, unitOptions, branchOptions } = useDirectory()

  const leads = useCollection(leadsCollection)
  const admissions = useCollection(admissionsCollection)

  const rangeKey = query.get('range') ?? '90d'
  const rangeOption = RANGE_OPTIONS.find((r) => r.value === rangeKey) ?? RANGE_OPTIONS[1]
  const range = rangeOption.range
  const unitId = query.get('unit')
  const branchId = query.get('branch')
  const tab = DASHBOARD_TABS.some((t) => t.id === query.get('tab'))
    ? (query.get('tab') as string)
    : 'overview'

  const scopedLeads = useMemo(
    () =>
      leads.filter((lead) => {
        if (lead.archivedAt) return false
        const created = lead.createdAt.slice(0, 10)
        if (created < range.from || created > range.to) return false
        if (unitId && lead.unitId !== unitId) return false
        if (branchId && lead.branchId !== branchId) return false
        return true
      }),
    [leads, range, unitId, branchId],
  )

  const filters: LeadFilters = useMemo(
    () => ({
      range,
      unitId: unitId ? (unitId as UnitId) : undefined,
      branchId: branchId ? (branchId as BranchId) : undefined,
    }),
    [range, unitId, branchId],
  )

  const leadsLink = useMemo(
    () => (extra: Record<string, string>) => {
      const parts = new URLSearchParams()
      if (unitId) parts.set('unit', unitId)
      if (branchId) parts.set('branch', branchId)
      parts.set('created', rangeKey)
      for (const [key, value] of Object.entries(extra)) parts.set(key, value)
      return `/crm/leads?${parts.toString()}`
    },
    [unitId, branchId, rangeKey],
  )

  const scope: CrmScope = useMemo(
    () => ({ range, rangeLabel: rangeOption.label, filters, leadsLink }),
    [range, rangeOption.label, filters, leadsLink],
  )

  /* ---- panels (each computed only where it is rendered) ---------------- */

  const funnelRows: BarRow[] = select.pipelineFunnel(filters).map((step) => ({
    key: step.stage,
    label: STAGE_LABELS[step.stage],
    value: step.count,
    secondary: step.conversionFromPrevious,
    secondaryLabel: 'from previous',
    to: leadsLink({ stage: step.stage }),
  }))

  const heat = useMemo(
    () =>
      OPEN_STAGES.map((stage) => ({
        stage,
        cells: AGE_BUCKETS.map((bucket) => ({
          bucket,
          count: scopedLeads.filter(
            (l) => l.stage === stage && l.daysInStage >= bucket.min && l.daysInStage <= bucket.max,
          ).length,
        })),
      })),
    [scopedLeads],
  )
  const heatMax = Math.max(1, ...heat.flatMap((r) => r.cells.map((c) => c.count)))

  const sourceRows: BarRow[] = select.leadsBySource(filters).map((row) => ({
    key: row.source,
    label: SOURCE_LABELS[row.source],
    value: row.count,
    secondary: row.conversion,
    to: leadsLink({ source: row.source }),
  }))

  const lossRows: BarRow[] = useMemo(() => {
    const counts = new Map<LossReason, number>()
    for (const lead of scopedLeads) {
      if (!lead.lossReason) continue
      counts.set(lead.lossReason, (counts.get(lead.lossReason) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({
        key: reason,
        label: LOSS_REASON_LABELS[reason],
        value: count,
        secondary: null,
        tone: 'danger' as const,
        to: leadsLink({ stage: 'lost,not_interested,invalid,unresponsive' }),
      }))
  }, [scopedLeads, leadsLink])

  const ownerRows: OwnerRow[] = useMemo(() => {
    const byOwner = new Map<string, Lead[]>()
    for (const lead of scopedLeads) {
      const key = lead.ownerUserId as string
      byOwner.set(key, [...(byOwner.get(key) ?? []), lead])
    }
    const monthStart = `${TODAY.slice(0, 7)}-01`

    return [...byOwner.entries()]
      .map(([userId, rows]) => {
        const open = rows.filter((l) => !CLOSED_STAGES.includes(l.stage))
        const responded = rows.filter((l) => l.firstResponseMinutes !== null)
        const withinSla = responded.filter(
          (l) => (l.firstResponseMinutes ?? 0) <= l.responseSlaMinutes,
        ).length
        const enrolledThisMonth = admissions.filter(
          (a) => (a.leadOwnerUserId as string) === userId && a.createdAt.slice(0, 10) >= monthStart,
        ).length
        return {
          userId: userId as UserId,
          name: userNameOf(userId as UserId),
          open: open.length,
          avgDaysInStage: open.length
            ? Number((open.reduce((acc, l) => acc + l.daysInStage, 0) / open.length).toFixed(1))
            : 0,
          withinSla: rows.length ? Number(((withinSla / rows.length) * 100).toFixed(1)) : 0,
          enrolledThisMonth,
          conversion: rows.length
            ? Number(
                ((rows.filter((l) => l.stage === 'enrolled').length / rows.length) * 100).toFixed(1),
              )
            : 0,
        }
      })
      .sort((a, b) => b.open - a.open)
  }, [scopedLeads, admissions, userNameOf])

  const ownerColumns: Column<OwnerRow>[] = [
    { key: 'name', header: 'Owner', accessor: (row) => row.name, sortable: true, minWidth: 180 },
    {
      key: 'open',
      header: 'Open leads',
      align: 'right',
      accessor: (row) => formatNumber(row.open),
      sortValue: (row) => row.open,
      sortable: true,
    },
    {
      key: 'age',
      header: 'Avg days in stage',
      align: 'right',
      accessor: (row) => row.avgDaysInStage.toFixed(1),
      sortValue: (row) => row.avgDaysInStage,
      sortable: true,
    },
    {
      key: 'sla',
      header: 'Within SLA',
      align: 'right',
      cell: (row) => (
        <span className={row.withinSla < 60 ? 'text-danger-text' : undefined}>
          {formatPercent(row.withinSla)}
        </span>
      ),
      sortValue: (row) => row.withinSla,
      sortable: true,
    },
    {
      key: 'enrolled',
      header: 'Enrolled this month',
      align: 'right',
      accessor: (row) => formatNumber(row.enrolledThisMonth),
      sortValue: (row) => row.enrolledThisMonth,
      sortable: true,
    },
    {
      key: 'conversion',
      header: 'Conversion',
      align: 'right',
      accessor: (row) => formatPercent(row.conversion),
      sortValue: (row) => row.conversion,
      sortable: true,
    },
  ]

  const funnelPanel = (
    <Card>
      <CardHeader
        title="Pipeline funnel"
        description="Each step counts everyone at or beyond it, with conversion from the step above."
      />
      <CardBody>
        <BarList
          rows={funnelRows}
          max={funnelRows[0]?.value ?? 1}
          emptyMessage="No leads in this window."
        />
      </CardBody>
    </Card>
  )

  const ageingPanel = (
    <Card>
      <CardHeader
        title="Stage ageing"
        description="Counts by stage and days in stage. Anything in the 15+ column has stopped moving."
      />
      <CardBody>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0">
            <caption className="sr-only">Lead counts by stage and days in stage</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="border-b border-border px-3 py-2 text-left text-label-11 text-text-label"
                >
                  Stage
                </th>
                {AGE_BUCKETS.map((bucket) => (
                  <th
                    key={bucket.key}
                    scope="col"
                    className="border-b border-border px-3 py-2 text-right text-label-11 text-text-label"
                  >
                    {bucket.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heat.map((row) => (
                <tr key={row.stage}>
                  <th
                    scope="row"
                    className="border-b border-border px-3 py-1.5 text-left text-body-13 font-medium text-text"
                  >
                    {STAGE_LABELS[row.stage]}
                  </th>
                  {row.cells.map((cell) => (
                    <td key={cell.bucket.key} className="border-b border-border px-3 py-1.5 text-right">
                      <HeatCell
                        count={cell.count}
                        max={heatMax}
                        alarming={cell.bucket.key === '15+'}
                        to={leadsLink({ stage: row.stage, days: String(cell.bucket.min) })}
                        label={`${STAGE_LABELS[row.stage]}, ${cell.bucket.label}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  )

  return (
    <CrmPage
      title="CRM dashboard"
      description="Pipeline health, response times and where leads are going cold."
      breadcrumbs={[{ label: 'CRM & admissions' }]}
      error={error}
      onRetry={retry}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Date range"
            selectSize="sm"
            containerClassName="w-auto min-w-36"
            value={rangeKey}
            onChange={(event) => query.set('range', event.target.value)}
            options={RANGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <Select
            aria-label="Unit"
            selectSize="sm"
            containerClassName="w-auto min-w-36"
            value={unitId ?? ''}
            onChange={(event) => query.set('unit', event.target.value || undefined)}
            options={[{ value: '', label: 'All units' }, ...unitOptions]}
          />
          <Select
            aria-label="Branch"
            selectSize="sm"
            containerClassName="w-auto min-w-36"
            value={branchId ?? ''}
            onChange={(event) => query.set('branch', event.target.value || undefined)}
            options={[{ value: '', label: 'All branches' }, ...branchOptions]}
          />
          <Button variant="secondary" size="sm" asChild>
            <Link to="/crm/leads/new">New lead</Link>
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonCard key={i} variant="stat" />
            ))}
          </div>
          <SkeletonTable rows={6} columns={6} />
        </div>
      ) : scopedLeads.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No leads in this window"
          message="Nothing was created in the selected range, unit and branch. The pipeline is not empty — this view is."
          action={
            <Button variant="secondary" onClick={() => query.clear()}>
              Clear filters
            </Button>
          }
          bordered
        />
      ) : (
        <div>
          <Tabs
            aria-label="Dashboard sections"
            tabs={DASHBOARD_TABS}
            value={tab}
            onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
            className="mb-5"
          />

          <TabPanel
            id="crm-panel-overview"
            tabId="overview"
            active={tab === 'overview'}
            className="flex flex-col gap-5"
          >
            <OverviewHeadlines scope={scope} />
            <div className="grid gap-4 xl:grid-cols-2">
              {funnelPanel}
              {ageingPanel}
            </div>
          </TabPanel>

          <TabPanel
            id="crm-panel-pipeline"
            tabId="pipeline"
            active={tab === 'pipeline'}
            className="flex flex-col gap-5"
          >
            <PipelineBand scope={scope} />
            <div className="grid gap-4 xl:grid-cols-2">
              {funnelPanel}
              {ageingPanel}
            </div>
          </TabPanel>

          <TabPanel
            id="crm-panel-response"
            tabId="response"
            active={tab === 'response'}
            className="flex flex-col gap-5"
          >
            <ResponseBand scope={scope} />
            <Card>
              <CardHeader
                title="Leads by owner"
                description="Who is carrying the pipeline, and whose leads are ageing."
              />
              <CardBody>
                <DataTable
                  data={ownerRows}
                  columns={ownerColumns}
                  rowKey={(row) => row.userId}
                  caption="Lead performance by owner"
                  density="compact"
                  defaultSort={{ key: 'open', direction: 'desc' }}
                  emptyTitle="No owners to show"
                  emptyMessage="No leads in this window carry an owner. Every lead must have one."
                  onRowClick={(row) => navigate(leadsLink({ owner: row.userId }))}
                />
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel
            id="crm-panel-sources"
            tabId="sources"
            active={tab === 'sources'}
            className="grid gap-4 xl:grid-cols-[2fr_1fr]"
          >
            <Card>
              <CardHeader
                title="Leads by source"
                description="Volume and conversion together — a big channel that never converts is a cost, not a win."
              />
              <CardBody>
                <BarList rows={sourceRows} emptyMessage="No sources recorded in this window." />
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Loss reasons"
                description="Why leads left the pipeline. Recorded on exit, never optional."
              />
              <CardBody>
                <BarList
                  rows={lossRows}
                  emptyMessage="No leads have been marked lost in this window. Either that is good news, or nobody is closing them out."
                />
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel
            id="crm-panel-admissions"
            tabId="admissions"
            active={tab === 'admissions'}
            className="flex flex-col gap-5"
          >
            <AdmissionsBand scope={scope} />
            <Card>
              <CardHeader
                title="From lead to enrolment"
                description="The funnel again, ending where admissions begin."
                actions={
                  <Button size="sm" variant="ghost" asChild>
                    <Link to="/crm/admissions">Open admissions</Link>
                  </Button>
                }
              />
              <CardBody>
                <BarList
                  rows={funnelRows}
                  max={funnelRows[0]?.value ?? 1}
                  emptyMessage="No leads in this window."
                />
              </CardBody>
            </Card>
          </TabPanel>
        </div>
      )}
    </CrmPage>
  )
}

function HeatCell({
  count,
  max,
  alarming,
  to,
  label,
}: {
  count: number
  max: number
  alarming: boolean
  to: string
  label: string
}) {
  if (count === 0) return <span className="text-body-13 text-text-muted">—</span>

  const intensity = count / max
  const tone = alarming
    ? 'border-danger-line bg-danger-fill text-danger-ink'
    : intensity > 0.6
      ? 'border-warning-line bg-warning-fill text-warning-ink'
      : 'border-transparent bg-accent-subtle text-accent'

  return (
    <Link
      to={to}
      aria-label={`${count} leads — ${label}`}
      className={`inline-flex min-w-9 justify-center rounded-lg border px-2 py-0.5 text-body-13 font-semibold tabular-nums ${tone}`}
    >
      {formatNumber(count)}
    </Link>
  )
}
