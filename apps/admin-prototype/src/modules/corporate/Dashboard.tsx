/**
 * Corporate dashboard.
 *
 * It used to open on ten flat `StatCard`s followed by three panels — the
 * template the density audit found on fifteen of seventeen module dashboards.
 * Nothing has been removed: every figure that was here is still here, and the
 * four themes it was mixing (pipeline, clients, renewals, outcomes) each got a
 * tab. **Overview** shows the four numbers that answer "is corporate working"
 * plus the two panels that matter whichever theme you came for.
 *
 * The metric computation is split the same way — one function per theme, each
 * deriving only its own slice — rather than one function computing all ten
 * cards whether or not they are on screen.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  Briefcase,
  Building2,
  CalendarClock,
  Coins,
  FileWarning,
  GraduationCap,
  Handshake,
  LayoutGrid,
  Receipt,
  Scale,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'

import { formatDate, formatNaira, formatNumber, formatPercent, humanize } from '@/lib/format'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatCard,
  TabPanel,
  Tabs,
  type TabItem,
} from '@/ui'
import { useQueryState } from '@/lib/view-state'
import {
  TODAY,
  addDays,
  clientOrgsCollection,
  corporateDealsCollection,
  useCollection,
  type ClientOrg,
  type CorporateDeal,
} from '@/mocks'

import { useParticipants } from './data'
import type { Participant } from './participant-model'
import { Band, BarList, DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, useModuleData } from './parts'

/** The PRD's nine stages, in pipeline order. */
const STAGE_ORDER: Array<CorporateDeal['stage']> = [
  'prospect',
  'discovery',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'delivery',
  'completed',
  'renewal',
]
const OPEN_STAGES: Array<CorporateDeal['stage']> = [
  'prospect',
  'discovery',
  'qualified',
  'proposal',
  'negotiation',
  'renewal',
]
const WON_STAGES: Array<CorporateDeal['stage']> = ['won', 'delivery', 'completed']

/** A deal sitting this long in one stage is stalled, not progressing. */
const STALLED_DAYS = 45

const DASHBOARD_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'pipeline', label: 'Pipeline', icon: Briefcase },
  { id: 'clients', label: 'Clients', icon: Building2 },
  { id: 'renewals', label: 'Renewals', icon: CalendarClock },
  { id: 'outcomes', label: 'Outcomes', icon: Award },
]

function daysUntil(date: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${TODAY}T00:00:00Z`)) / 86_400_000)
}

function daysInStage(deal: CorporateDeal): number {
  return Math.max(0, Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(deal.stageEnteredAt)) / 86_400_000))
}

/* -------------------------------------------------------------------------- */
/* One derivation per theme                                                   */
/* -------------------------------------------------------------------------- */

interface PipelineFigures {
  openDeals: number
  pipelineValue: number
  weightedPipeline: number
  averageDeal: number
  wonValue: number
  wonCount: number
  stalled: CorporateDeal[]
  byStage: Array<{ stage: CorporateDeal['stage']; count: number; value: number }>
}

function pipelineFigures(deals: CorporateDeal[]): PipelineFigures {
  const open = deals.filter((d) => OPEN_STAGES.includes(d.stage))
  const won = deals.filter((d) => WON_STAGES.includes(d.stage))
  const stages = STAGE_ORDER.filter((stage) => deals.some((d) => d.stage === stage))

  return {
    openDeals: open.length,
    pipelineValue: open.reduce((acc, d) => acc + d.value, 0),
    weightedPipeline: open.reduce((acc, d) => acc + d.weightedValue, 0),
    averageDeal: deals.length === 0 ? 0 : Math.round(deals.reduce((acc, d) => acc + d.value, 0) / deals.length),
    wonValue: won.reduce((acc, d) => acc + d.value, 0),
    wonCount: won.length,
    stalled: open.filter((d) => daysInStage(d) > STALLED_DAYS).sort((a, b) => daysInStage(b) - daysInStage(a)),
    byStage: stages.map((stage) => {
      const mine = deals.filter((d) => d.stage === stage)
      return { stage, count: mine.length, value: mine.reduce((acc, d) => acc + d.value, 0) }
    }),
  }
}

interface ClientFigures {
  organisations: number
  participantsTrained: number
  lifetimeRevenue: number
  outstanding: number
  owing: ClientOrg[]
  portalEnabled: number
}

function clientFigures(orgs: ClientOrg[]): ClientFigures {
  return {
    organisations: orgs.length,
    participantsTrained: orgs.reduce((acc, o) => acc + o.participantsTrained, 0),
    lifetimeRevenue: orgs.reduce((acc, o) => acc + o.lifetimeRevenue, 0),
    outstanding: orgs.reduce((acc, o) => acc + o.outstandingBalance, 0),
    owing: orgs.filter((o) => o.outstandingBalance > 0).sort((a, b) => b.outstandingBalance - a.outstandingBalance),
    portalEnabled: orgs.filter((o) => o.portalAccessEnabled).length,
  }
}

interface RenewalFigures {
  within30: number
  within90: number
  expired: number
  noContract: number
  calendar: Array<{ org: ClientOrg; days: number }>
}

function renewalFigures(orgs: ClientOrg[]): RenewalFigures {
  const horizon90 = addDays(TODAY, 90)
  const horizon30 = addDays(TODAY, 30)
  const dated = orgs.filter((o): o is ClientOrg & { renewalDate: string } => o.renewalDate !== null)

  return {
    within30: dated.filter((o) => o.renewalDate >= TODAY && o.renewalDate <= horizon30).length,
    within90: dated.filter((o) => o.renewalDate >= TODAY && o.renewalDate <= horizon90).length,
    expired: dated.filter((o) => o.renewalDate < TODAY).length,
    noContract: orgs.length - dated.length,
    calendar: dated
      .slice()
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate))
      .map((org) => ({ org, days: daysUntil(org.renewalDate) })),
  }
}

interface OutcomeFigures {
  tracked: number
  averageGain: number | null
  gainSample: number
  certificatesIssued: number
  averageAttendance: number | null
  byOrganisation: Array<{ name: string; gain: number; sample: number }>
}

function outcomeFigures(participants: Participant[]): OutcomeFigures {
  const withGain = participants.filter((p) => p.gain !== null)
  const withAttendance = participants.filter((p) => p.attendancePercent !== null)
  const names = [...new Set(withGain.map((p) => p.organisationName))]

  return {
    tracked: participants.length,
    averageGain:
      withGain.length === 0
        ? null
        : Number((withGain.reduce((acc, p) => acc + (p.gain ?? 0), 0) / withGain.length).toFixed(1)),
    gainSample: withGain.length,
    certificatesIssued: participants.filter((p) => p.certificateIssued).length,
    averageAttendance:
      withAttendance.length === 0
        ? null
        : Number(
            (
              withAttendance.reduce((acc, p) => acc + (p.attendancePercent ?? 0), 0) / withAttendance.length
            ).toFixed(1),
          ),
    byOrganisation: names
      .map((name) => {
        const mine = withGain.filter((p) => p.organisationName === name)
        return {
          name,
          gain: Number((mine.reduce((acc, p) => acc + (p.gain ?? 0), 0) / mine.length).toFixed(1)),
          sample: mine.length,
        }
      })
      .sort((a, b) => b.gain - a.gain),
  }
}

/* -------------------------------------------------------------------------- */

export default function CorporateDashboard() {
  const allOrgs = useCollection(clientOrgsCollection)
  const allDeals = useCollection(corporateDealsCollection)
  const allParticipants = useParticipants()

  const { loading, error, rows, retry } = useModuleData(allDeals, 'corporate.dashboard')
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  /* The demo's empty switch blanks the module, not just one collection. */
  const emptied = rows.length === 0 && allDeals.length > 0
  const orgs = emptied ? [] : allOrgs
  const participants = emptied ? [] : allParticipants

  const pipeline = useMemo(() => pipelineFigures(rows), [rows])
  const clients = useMemo(() => clientFigures(orgs), [orgs])
  const renewals = useMemo(() => renewalFigures(orgs), [orgs])
  const outcomes = useMemo(() => outcomeFigures(participants), [participants])

  const attention =
    renewals.within90 + clients.owing.length + pipeline.stalled.length

  return (
    <Screen>
      <ModuleHeader
        title="Corporate"
        description="Client organisations, deals and the participants they sponsor."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/corporate/deals">View deals</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorPanel what="The Corporate dashboard" onRetry={retry} />
      ) : loading ? (
        <DashboardSkeleton />
      ) : rows.length === 0 && orgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No client organisations yet"
          message="Corporate revenue is invoiced to an organisation, not to a participant. Nothing appears here until the first client exists."
          action={
            <Button asChild>
              <Link to="/corporate/organisations">Add the first organisation</Link>
            </Button>
          }
        />
      ) : (
        <div>
          <Tabs
            tabs={DASHBOARD_TABS}
            value={tab}
            onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
            aria-label="Corporate dashboard sections"
            className="mb-6"
          />

          {/* ---------------------------------------------------------- */}
          <TabPanel id="panel-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                label="Weighted pipeline"
                value={formatNaira(pipeline.weightedPipeline, { compact: true })}
                icon={Scale}
                caption={`Of ${formatNaira(pipeline.pipelineValue, { compact: true })} open across ${formatNumber(pipeline.openDeals)} deals`}
              />
              <StatCard
                label="Won"
                value={formatNaira(pipeline.wonValue, { compact: true })}
                icon={Handshake}
                variant="success"
                caption={`${formatNumber(pipeline.wonCount)} deals in delivery or closed`}
              />
              <StatCard
                label="Client organisations"
                value={formatNumber(clients.organisations)}
                icon={Building2}
                caption={`${formatNumber(clients.participantsTrained)} participants trained between them`}
              />
              <StatCard
                label="Average pre to post gain"
                value={outcomes.averageGain === null ? 'No data' : `+${outcomes.averageGain} pts`}
                icon={TrendingUp}
                variant={outcomes.averageGain === null ? 'default' : 'success'}
                caption={`From ${formatNumber(outcomes.gainSample)} participants with two graded pieces`}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card padding="none" className="xl:col-span-2">
                <CardHeader
                  title="Needs attention"
                  description={
                    attention === 0
                      ? 'Nothing is overdue, stalled or unpaid.'
                      : `${formatNumber(attention)} things to look at before anything else.`
                  }
                />
                <CardBody>
                  {attention === 0 ? (
                    <p className="text-body-13 text-text-secondary">
                      No renewal falls inside ninety days, no client carries a balance, and no open deal has
                      sat in one stage for more than {STALLED_DAYS} days.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {renewals.calendar
                        .filter((entry) => entry.days >= 0 && entry.days <= 90)
                        .map(({ org, days }) => (
                          <AttentionRow
                            key={`renewal-${org.id as string}`}
                            icon={CalendarClock}
                            title={org.name}
                            detail={`Contract renews ${formatDate(org.renewalDate ?? TODAY)}`}
                            note={`in ${formatNumber(days)} days`}
                            tone="warning"
                          />
                        ))}
                      {clients.owing.map((org) => (
                        <AttentionRow
                          key={`owing-${org.id as string}`}
                          icon={Receipt}
                          title={org.name}
                          detail="Outstanding on invoices already raised"
                          note={formatNaira(org.outstandingBalance)}
                          tone="danger"
                        />
                      ))}
                      {pipeline.stalled.map((deal) => (
                        <AttentionRow
                          key={`stalled-${deal.id as string}`}
                          icon={Timer}
                          title={deal.title}
                          detail={`${humanize(deal.stage)} · ${deal.nextAction ?? 'No next action recorded'}`}
                          note={`${formatNumber(daysInStage(deal))} days in stage`}
                          tone="warning"
                        />
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card padding="none">
                <CardHeader title="Pipeline by stage" description="Total deal value in each stage." />
                <CardBody>
                  <BarList
                    rows={pipeline.byStage.map((entry) => ({
                      key: entry.stage,
                      label: humanize(entry.stage),
                      value: entry.value,
                      valueLabel: formatNaira(entry.value, { compact: true }),
                      tone: WON_STAGES.includes(entry.stage) ? ('success' as const) : ('accent' as const),
                      note: `${formatNumber(entry.count)} deal${entry.count === 1 ? '' : 's'}`,
                    }))}
                    emptyMessage="No deals in the pipeline."
                  />
                </CardBody>
              </Card>
            </div>

            <Alert tone="info" title="One invoice, many participants">
              A corporate invoice allocates across the enrolments it paid for — one line per seat — so every
              participant can be traced to the invoice that bought their place, and a part payment never has
              to be guessed against a person.
            </Alert>
          </TabPanel>

          {/* ---------------------------------------------------------- */}
          <TabPanel id="panel-pipeline" tabId="pipeline" active={tab === 'pipeline'} className="space-y-6">
            <Band
              question="What is in the pipeline?"
              answer={
                <>
                  {formatNaira(pipeline.pipelineValue)} open across {formatNumber(pipeline.openDeals)} deals,
                  worth {formatNaira(pipeline.weightedPipeline)} once each is discounted by its own
                  probability. Weighted value is always derived, never typed.
                </>
              }
            >
              <StatCard label="Open deals" value={formatNumber(pipeline.openDeals)} icon={Briefcase} />
              <StatCard
                label="Pipeline value"
                value={formatNaira(pipeline.pipelineValue, { compact: true })}
                icon={Coins}
                caption="Open stages only"
              />
              <StatCard
                label="Weighted pipeline"
                value={formatNaira(pipeline.weightedPipeline, { compact: true })}
                icon={Scale}
                caption="Value × probability"
              />
              <StatCard
                label="Average deal size"
                value={formatNaira(pipeline.averageDeal, { compact: true })}
                icon={TrendingUp}
                caption="Across every deal, open and closed"
              />
            </Band>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="none">
                <CardHeader title="Pipeline by stage" description="Total deal value in each stage." />
                <CardBody>
                  <BarList
                    rows={pipeline.byStage.map((entry) => ({
                      key: entry.stage,
                      label: humanize(entry.stage),
                      value: entry.value,
                      valueLabel: formatNaira(entry.value),
                      tone: WON_STAGES.includes(entry.stage) ? ('success' as const) : ('accent' as const),
                      note: `${formatNumber(entry.count)} deal${entry.count === 1 ? '' : 's'}`,
                    }))}
                    emptyMessage="No deals in the pipeline."
                  />
                </CardBody>
              </Card>

              <Card padding="none">
                <CardHeader
                  title="Stalled deals"
                  description={`Open more than ${STALLED_DAYS} days in the same stage.`}
                />
                <CardBody>
                  {pipeline.stalled.length === 0 ? (
                    <p className="text-body-13 text-text-secondary">
                      Nothing has sat in one stage for more than {STALLED_DAYS} days. A stalled deal is not a
                      lost deal, but it is the one nobody is working.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {pipeline.stalled.map((deal) => (
                        <li key={deal.id as string} className="flex items-start justify-between gap-4 py-2.5">
                          <div className="min-w-0">
                            <p className="truncate text-body-14 font-medium text-text">{deal.title}</p>
                            <p className="text-body-12 text-text-secondary">
                              {humanize(deal.stage)} · {formatPercent(deal.probability, 0)} ·{' '}
                              {deal.nextAction ?? 'No next action recorded'}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-body-13 tabular-nums text-text">
                              {formatNaira(deal.value, { compact: true })}
                            </p>
                            <p className="text-body-12 text-warning-text">
                              {formatNumber(daysInStage(deal))} days in stage
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </TabPanel>

          {/* ---------------------------------------------------------- */}
          <TabPanel id="panel-clients" tabId="clients" active={tab === 'clients'} className="space-y-6">
            <Band
              question="Who are the clients?"
              answer={
                <>
                  {formatNumber(clients.organisations)} organisations have paid{' '}
                  {formatNaira(clients.lifetimeRevenue)} between them and still owe{' '}
                  {formatNaira(clients.outstanding)}. Billings and collections are shown side by side and
                  never netted against each other.
                </>
              }
            >
              <StatCard
                label="Client organisations"
                value={formatNumber(clients.organisations)}
                icon={Building2}
                caption={`${formatNumber(clients.portalEnabled)} with client portal access`}
              />
              <StatCard
                label="Participants trained"
                value={formatNumber(clients.participantsTrained)}
                icon={Users}
                caption={`${formatNumber(outcomes.tracked)} currently traceable to an invoice line`}
              />
              <StatCard
                label="Lifetime revenue"
                value={formatNaira(clients.lifetimeRevenue, { compact: true })}
                icon={Coins}
                caption="Across every engagement"
              />
              <StatCard
                label="Outstanding balance"
                value={formatNaira(clients.outstanding, { compact: true })}
                icon={Receipt}
                variant={clients.outstanding > 0 ? 'warning' : 'default'}
                caption={`Owed by ${formatNumber(clients.owing.length)} client${clients.owing.length === 1 ? '' : 's'}`}
              />
            </Band>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card padding="none">
                <CardHeader title="Revenue by client" description="Lifetime, across every engagement." />
                <CardBody>
                  <BarList
                    rows={[...orgs]
                      .sort((a, b) => b.lifetimeRevenue - a.lifetimeRevenue)
                      .map((o) => ({
                        key: o.id as string,
                        label: o.name,
                        value: o.lifetimeRevenue,
                        valueLabel: formatNaira(o.lifetimeRevenue),
                        tone: 'accent' as const,
                        note:
                          o.outstandingBalance > 0
                            ? `${formatNaira(o.outstandingBalance)} outstanding · ${formatNumber(o.participantsTrained)} trained`
                            : `${formatNumber(o.participantsTrained)} trained`,
                      }))}
                    emptyMessage="No client revenue recorded."
                  />
                </CardBody>
              </Card>

              <Card padding="none">
                <CardHeader
                  title="Outstanding by client"
                  description="Invoiced and not yet collected."
                />
                <CardBody>
                  <BarList
                    rows={clients.owing.map((o) => ({
                      key: o.id as string,
                      label: o.name,
                      value: o.outstandingBalance,
                      valueLabel: formatNaira(o.outstandingBalance),
                      tone: 'warning' as const,
                      note: `${formatNaira(o.lifetimeRevenue, { compact: true })} lifetime`,
                    }))}
                    emptyMessage="No client carries a balance. Everything invoiced has been collected."
                  />
                </CardBody>
              </Card>
            </div>
          </TabPanel>

          {/* ---------------------------------------------------------- */}
          <TabPanel id="panel-renewals" tabId="renewals" active={tab === 'renewals'} className="space-y-6">
            <Band
              question="What is up for renewal?"
              answer={
                <>
                  {formatNumber(renewals.within90)} contract{renewals.within90 === 1 ? '' : 's'} fall due
                  inside ninety days. A client with no renewal date has no contract on file — that is not the
                  same as an expired one, and the two are counted separately.
                </>
              }
            >
              <StatCard
                label="Renewals within 30 days"
                value={formatNumber(renewals.within30)}
                icon={CalendarClock}
                variant={renewals.within30 > 0 ? 'warning' : 'default'}
              />
              <StatCard
                label="Renewals within 90 days"
                value={formatNumber(renewals.within90)}
                icon={CalendarClock}
                variant={renewals.within90 > 0 ? 'warning' : 'default'}
              />
              <StatCard
                label="Expired contracts"
                value={formatNumber(renewals.expired)}
                icon={FileWarning}
                variant={renewals.expired > 0 ? 'danger' : 'default'}
                caption="Renewal date already past"
              />
              <StatCard
                label="No contract on file"
                value={formatNumber(renewals.noContract)}
                icon={Building2}
                caption="Clients with no renewal date recorded"
              />
            </Band>

            <Card padding="none">
              <CardHeader title="Renewals calendar" description="Contract renewal dates, soonest first." />
              <CardBody>
                {renewals.calendar.length === 0 ? (
                  <p className="text-body-13 text-text-secondary">
                    No client currently carries a renewal date. Nothing will prompt a renewal conversation
                    until one does.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {renewals.calendar.map(({ org, days }) => (
                      <li key={org.id as string} className="flex items-center justify-between gap-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-body-14 font-medium text-text">{org.name}</p>
                          <p className="text-body-12 text-text-secondary">
                            {formatNumber(org.participantsTrained)} trained ·{' '}
                            {formatNaira(org.lifetimeRevenue, { compact: true })} lifetime
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-body-13 text-text">{formatDate(org.renewalDate ?? TODAY)}</p>
                          <p
                            className={
                              days <= 90 ? 'text-body-12 text-warning-text' : 'text-body-12 text-text-secondary'
                            }
                          >
                            {days < 0 ? `${formatNumber(Math.abs(days))} days overdue` : `in ${formatNumber(days)} days`}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          {/* ---------------------------------------------------------- */}
          <TabPanel id="panel-outcomes" tabId="outcomes" active={tab === 'outcomes'} className="space-y-6">
            <Band
              question="Are the participants actually improving?"
              answer={
                outcomes.averageGain === null ? (
                  <>
                    No participant has two graded pieces of work yet, so no gain can be reported. A single
                    score is not a gain.
                  </>
                ) : (
                  <>
                    Average gain is {outcomes.averageGain >= 0 ? '+' : ''}
                    {outcomes.averageGain} points across {formatNumber(outcomes.gainSample)} participants with
                    two graded pieces. This is the number a corporate buyer renews on.
                  </>
                )
              }
            >
              <StatCard
                label="Average pre to post gain"
                value={outcomes.averageGain === null ? 'No data' : `+${outcomes.averageGain} pts`}
                icon={TrendingUp}
                variant={outcomes.averageGain === null ? 'default' : 'success'}
                caption={`From ${formatNumber(outcomes.gainSample)} participants with two graded pieces`}
              />
              <StatCard
                label="Participants tracked"
                value={formatNumber(outcomes.tracked)}
                icon={Users}
                caption="Traceable to the invoice line that paid for the seat"
              />
              <StatCard
                label="Certificates issued"
                value={formatNumber(outcomes.certificatesIssued)}
                icon={GraduationCap}
                caption={
                  outcomes.tracked === 0
                    ? 'No tracked seats yet'
                    : `${formatPercent((outcomes.certificatesIssued / outcomes.tracked) * 100, 0)} of tracked seats`
                }
              />
              <StatCard
                label="Average attendance"
                value={outcomes.averageAttendance === null ? 'No data' : `${outcomes.averageAttendance}%`}
                icon={Award}
                variant={
                  outcomes.averageAttendance === null
                    ? 'default'
                    : outcomes.averageAttendance >= 85
                      ? 'success'
                      : outcomes.averageAttendance >= 70
                        ? 'warning'
                        : 'danger'
                }
                caption="Across sponsored seats with a register"
              />
            </Band>

            <Card padding="none">
              <CardHeader
                title="Gain by organisation"
                description="Average pre to post movement, by client."
              />
              <CardBody>
                <BarList
                  rows={outcomes.byOrganisation.map((entry) => ({
                    key: entry.name,
                    label: entry.name,
                    value: Math.max(0, entry.gain),
                    valueLabel: `${entry.gain >= 0 ? '+' : ''}${entry.gain} pts`,
                    tone: entry.gain >= 0 ? ('success' as const) : ('danger' as const),
                    note: `${formatNumber(entry.sample)} participant${entry.sample === 1 ? '' : 's'} with two graded pieces`,
                  }))}
                  emptyMessage="No organisation has a participant with two graded pieces of work yet."
                />
                <p className="mt-3 text-body-12 text-text-secondary">
                  Pre and post are the participant's first and latest graded submission. The seed carries no
                  dedicated assessment instrument, so the figures are labelled for what they actually are.
                </p>
              </CardBody>
            </Card>
          </TabPanel>
        </div>
      )}
    </Screen>
  )
}

function AttentionRow({
  icon: Icon,
  title,
  detail,
  note,
  tone,
}: {
  icon: typeof CalendarClock
  title: string
  detail: string
  note: string
  tone: 'warning' | 'danger'
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-2.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-text-secondary" />
        <div className="min-w-0">
          <p className="truncate text-body-14 font-medium text-text">{title}</p>
          <p className="truncate text-body-12 text-text-secondary">{detail}</p>
        </div>
      </div>
      <span
        className={
          tone === 'danger'
            ? 'shrink-0 text-body-13 tabular-nums text-danger-text'
            : 'shrink-0 text-body-13 tabular-nums text-warning-text'
        }
      >
        {note}
      </span>
    </li>
  )
}
