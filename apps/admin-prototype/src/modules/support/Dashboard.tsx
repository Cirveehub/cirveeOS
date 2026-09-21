import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  CheckCircle2,
  Inbox,
  RotateCcw,
  ShieldAlert,
  Timer,
  UserX,
} from 'lucide-react'

import { formatDateTime, formatNumber, formatPercent, humanize } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatCard,
  TabPanel,
  Tabs,
} from '@/ui'
import { useQueryState } from '@/lib/view-state'
import { TODAY, addDays, ticketsCollection, useCollection, type Ticket } from '@/mocks'

import { BarList, DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, percent, useModuleData, type BarRow } from './parts'

const OPEN_STATUSES: Array<Ticket['status']> = ['new', 'open', 'pending_customer', 'escalated', 'reopened']

const SOURCE_LABEL: Record<Ticket['source'], string> = {
  student_portal: 'Student portal',
  parent_portal: 'Parent portal',
  email: 'Email',
  whatsapp: 'WhatsApp',
  staff: 'Staff',
  automation: 'Automation',
}

function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function formatHours(hours: number | null): string {
  if (hours === null) return 'No data'
  if (hours < 24) {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}h ${String(m).padStart(2, '0')}m`
  }
  return `${(hours / 24).toFixed(1)} days`
}

function headlineFigures(rows: Ticket[]) {
  const sevenDaysAgo = addDays(TODAY, -7)
  return {
    total: rows.length,
    open: rows.filter((t) => OPEN_STATUSES.includes(t.status)).length,
    unassigned: rows.filter((t) => t.ownerUserId === null).length,
    breaching: rows.filter((t) => t.slaState === 'breached' && t.resolvedAt === null).length,
    dueSoon: rows.filter((t) => t.slaState === 'due_soon' && t.resolvedAt === null).length,
    resolved7d: rows.filter((t) => t.resolvedAt !== null && t.resolvedAt.slice(0, 10) >= sevenDaysAgo).length,
  }
}

function workloadBand(rows: Ticket[]) {
  const byCategory = new Map<string, number>()
  const bySource = new Map<string, number>()
  for (const t of rows) {
    byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1)
    bySource.set(t.source, (bySource.get(t.source) ?? 0) + 1)
  }

  const trend = Array.from({ length: 6 }, (_, i) => {
    const to = addDays(TODAY, -7 * (5 - i))
    const from = addDays(to, -6)
    const count = rows.filter((t) => {
      const day = t.createdAtTime.slice(0, 10)
      return day >= from && day <= to
    }).length
    return { key: from, label: `${from} to ${to}`, value: count, valueLabel: formatNumber(count), tone: 'accent' as const }
  })

  const toRows = (map: Map<string, number>, label: (key: string) => string): BarRow[] =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        label: label(key),
        value: count,
        valueLabel: formatNumber(count),
        tone: 'accent' as const,
      }))

  return {
    byCategory: toRows(byCategory, humanize),
    bySource: toRows(bySource, (key) => SOURCE_LABEL[key as Ticket['source']] ?? key),
    trend,
    escalated: rows.filter((t) => t.status === 'escalated').length,
    reopenedRate: percent(rows.filter((t) => t.status === 'reopened').length, rows.length),
  }
}

function timingBand(rows: Ticket[]) {
  const firstResponses = rows
    .filter((t) => t.firstResponseAt !== null)
    .map((t) => hoursBetween(t.createdAtTime, t.firstResponseAt as string))
  const resolutions = rows
    .filter((t) => t.resolvedAt !== null)
    .map((t) => hoursBetween(t.createdAtTime, t.resolvedAt as string))

  const priorities: Array<Ticket['priority']> = ['urgent', 'high', 'normal', 'low']
  const slaByPriority: BarRow[] = priorities
    .map((priority) => ({ priority, mine: rows.filter((t) => t.priority === priority) }))
    .filter((group) => group.mine.length > 0)
    .map(({ priority, mine }) => {
      const rate = percent(mine.filter((t) => t.slaState === 'within').length, mine.length)
      return {
        key: priority,
        label: humanize(priority),
        value: rate,
        valueLabel: `${formatPercent(rate)} of ${formatNumber(mine.length)}`,
        tone: (rate >= 90 ? 'success' : 'warning') as 'success' | 'warning',
      }
    })

  return {
    firstResponse: median(firstResponses),
    resolution: median(resolutions),
    answered: firstResponses.length,
    slaByPriority,
  }
}

export default function SupportDashboard() {
  const tickets = useCollection(ticketsCollection)
  const { loading, error, rows, retry } = useModuleData(tickets, 'support.dashboard')
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  const headline = useMemo(() => headlineFigures(rows), [rows])
  const workload = useMemo(() => (tab === 'workload' ? workloadBand(rows) : null), [rows, tab])
  const timing = useMemo(() => (tab === 'timing' ? timingBand(rows) : null), [rows, tab])

  const attention = useMemo(
    () =>
      rows
        .filter((t) => t.resolvedAt === null && (t.slaState === 'breached' || t.ownerUserId === null))
        .sort((a, b) => a.createdAtTime.localeCompare(b.createdAtTime))
        .slice(0, 8),
    [rows],
  )

  return (
    <Screen>
      <ModuleHeader
        title="Customer experience"
        description="Every inbound question in one queue, with the clock running on each one."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/support/tickets">Open the queue</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorPanel what="The customer experience dashboard" onRetry={retry} />
      ) : loading ? (
        <DashboardSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No tickets yet"
          message="Tickets arrive from the student and parent portals, email, WhatsApp, staff and automations. An empty queue means nothing has been raised, not that nothing is wrong."
          action={
            <Button size="sm" asChild>
              <Link to="/support/tickets">Raise the first ticket</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <Tabs
            aria-label="Dashboard sections"
            value={tab}
            onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'workload', label: 'Workload' },
              { id: 'timing', label: 'Response times' },
            ]}
          />

          <TabPanel id="cx-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Open tickets"
                value={formatNumber(headline.open)}
                icon={Inbox}
                caption={`${formatNumber(headline.total)} raised in total`}
              />
              <StatCard
                label="Unassigned"
                value={formatNumber(headline.unassigned)}
                icon={UserX}
                variant={headline.unassigned > 0 ? 'warning' : 'default'}
                caption="Nobody has picked these up"
              />
              <StatCard
                label="Breaching SLA"
                value={formatNumber(headline.breaching)}
                icon={ShieldAlert}
                variant={headline.breaching > 0 ? 'danger' : 'success'}
                caption={`${formatNumber(headline.dueSoon)} due soon`}
              />
              <StatCard
                label="Resolved, 7 days"
                value={formatNumber(headline.resolved7d)}
                icon={CheckCircle2}
                variant="success"
              />
            </div>

            <Card padding="none">
              <CardHeader
                title="Needs attention now"
                description="Breached or unowned, oldest first. Everything else can wait."
                actions={
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/support/tickets?sla=breached">Open the queue</Link>
                  </Button>
                }
              />
              <CardBody>
                {attention.length === 0 ? (
                  <EmptyState
                    icon={CheckCircle2}
                    size="sm"
                    bordered
                    title="Nothing is breached or unowned"
                    message="Every open ticket has an owner and is inside its first-response target."
                  />
                ) : (
                  <ul className="divide-y divide-border">
                    {attention.map((t) => (
                      <li key={t.id as string} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-14 text-text">{t.subject}</span>
                          <span className="block font-mono text-body-12 text-text-secondary">
                            {t.ref} · raised {formatDateTime(t.createdAtTime)}
                          </span>
                        </span>
                        {t.slaState === 'breached' && <Badge tone="danger" size="sm">Breached</Badge>}
                        {t.ownerUserId === null && <Badge tone="warning" size="sm">Unassigned</Badge>}
                        <Badge tone="neutral" size="sm">{humanize(t.priority)}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          <TabPanel id="cx-workload" tabId="workload" active={tab === 'workload'} className="space-y-6">
            {workload && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard label="Raised in total" value={formatNumber(headline.total)} icon={Inbox} />
                  <StatCard
                    label="Escalated"
                    value={formatNumber(workload.escalated)}
                    icon={ShieldAlert}
                    variant={workload.escalated > 0 ? 'warning' : 'default'}
                    caption="Handed to someone with more authority"
                  />
                  <StatCard
                    label="Reopened rate"
                    value={formatPercent(workload.reopenedRate)}
                    icon={RotateCcw}
                    variant={workload.reopenedRate > 5 ? 'warning' : 'default'}
                    caption="A resolution that did not hold"
                  />
                  <StatCard
                    label="Open right now"
                    value={formatNumber(headline.open)}
                    icon={Inbox}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card padding="none">
                    <CardHeader title="Tickets by category" description="What people actually write in about." />
                    <CardBody>
                      <BarList rows={workload.byCategory} emptyMessage="No tickets to categorise." />
                    </CardBody>
                  </Card>

                  <Card padding="none">
                    <CardHeader title="Tickets by source" description="Which channel they arrived on." />
                    <CardBody>
                      <BarList rows={workload.bySource} emptyMessage="No tickets to attribute." />
                    </CardBody>
                  </Card>
                </div>

                <Card padding="none">
                  <CardHeader title="Volume trend" description="New tickets per week, last six weeks." />
                  <CardBody>
                    <BarList rows={workload.trend} emptyMessage="No tickets in the last six weeks." />
                  </CardBody>
                </Card>
              </>
            )}
          </TabPanel>

          <TabPanel id="cx-timing" tabId="timing" active={tab === 'timing'} className="space-y-6">
            {timing && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="First response, median"
                    value={formatHours(timing.firstResponse)}
                    icon={Timer}
                    caption={`${formatNumber(timing.answered)} tickets have been answered`}
                  />
                  <StatCard label="Resolution, median" value={formatHours(timing.resolution)} icon={AlarmClock} />
                  <StatCard
                    label="Breaching SLA"
                    value={formatNumber(headline.breaching)}
                    icon={ShieldAlert}
                    variant={headline.breaching > 0 ? 'danger' : 'success'}
                  />
                  <StatCard label="Due soon" value={formatNumber(headline.dueSoon)} icon={AlarmClock} />
                </div>

                <Card padding="none">
                  <CardHeader
                    title="SLA compliance by priority"
                    description="Share of tickets still inside their target."
                    actions={
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/support/sla">Full SLA report</Link>
                      </Button>
                    }
                  />
                  <CardBody>
                    <BarList rows={timing.slaByPriority} max={100} emptyMessage="No tickets to measure." />
                  </CardBody>
                </Card>

                <Card padding="none">
                  <CardHeader title="Satisfaction" />
                  <CardBody>
                    <p className="text-body-14 text-text-secondary">
                      CSAT is not captured in this prototype. There is no satisfaction field on a ticket, so
                      rather than show a number nothing computes, this card says so. Marketing carries the
                      ratings that do exist, from review requests fired at high-satisfaction moments.
                    </p>
                    <Button variant="link" size="sm" asChild className="mt-2 px-0">
                      <Link to="/engage/reviews">Open Marketing</Link>
                    </Button>
                  </CardBody>
                </Card>
              </>
            )}
          </TabPanel>
        </div>
      )}
    </Screen>
  )
}
