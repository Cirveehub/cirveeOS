/**
 * §11 — Engage dashboard.
 *
 * Ten flat stat cards and five stacked panels became an Overview that leads
 * with money — the PRD is explicit that revenue attributed matters more than
 * open rate — plus a tab each for engagement, deliverability discipline and
 * journeys. Nothing was removed; the diagnostics simply stopped competing with
 * the result for the top of the page.
 *
 * Metric computation is split one function per theme, so the engagement band's
 * arithmetic does not run to render the Overview.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  BadgeCheck,
  GraduationCap,
  MessageSquare,
  MousePointerClick,
  Reply,
  Send,
  UserMinus,
  MailOpen,
  Plus,
  Workflow,
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
  EmptyState,
  StatCard,
  TabPanel,
  Tabs,
  type TabItem,
} from '@/ui'
import {
  campaignsCollection,
  LAST_30D,
  messagesCollection,
  messageTemplatesCollection,
  segmentsCollection,
  TODAY,
  addDays,
  useCollection,
  type Campaign,
  type Message,
  type MessageTemplate,
} from '@/mocks'

import { ModuleHeader, BarList, DashboardSkeleton, ErrorPanel, Screen, percent, useModuleData } from './parts'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-app',
}

/* -------------------------------------------------------------------------- */
/* One computation per theme                                                  */
/* -------------------------------------------------------------------------- */

/** What the campaigns produced. The number the module exists to move. */
function resultBand(campaigns: Campaign[]) {
  return {
    revenue: campaigns.reduce((acc, c) => acc + c.stats.revenueAttributed, 0),
    enrolments: campaigns.reduce((acc, c) => acc + c.stats.enrolments, 0),
    activeCampaigns: campaigns.filter((c) => c.status !== 'draft').length,
    total: campaigns.length,
    byRevenue: campaigns
      .filter((c) => c.stats.revenueAttributed > 0)
      .sort((a, b) => b.stats.revenueAttributed - a.stats.revenueAttributed)
      .map((c) => ({
        key: c.id as string,
        label: c.name,
        value: c.stats.revenueAttributed,
        valueLabel: formatNaira(c.stats.revenueAttributed),
        tone: 'success' as const,
        note: `${formatNumber(c.stats.enrolments)} enrolment${c.stats.enrolments === 1 ? '' : 's'} · ${formatNumber(c.stats.sent)} sent`,
      })),
  }
}

/** How the sends behaved. Diagnostics, deliberately below the result. */
function engagementBand(campaigns: Campaign[], messages: Message[]) {
  const totals = campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + c.stats.sent,
      delivered: acc.delivered + c.stats.delivered,
      opened: acc.opened + c.stats.opened,
      clicked: acc.clicked + c.stats.clicked,
      replied: acc.replied + c.stats.replied,
      unsubscribed: acc.unsubscribed + c.stats.unsubscribed,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0, replied: 0, unsubscribed: 0 },
  )

  const outbound30d = messages.filter((m) => m.direction === 'outbound' && m.sentAt.slice(0, 10) >= LAST_30D.from)
  const reached = outbound30d.filter((m) => m.status !== 'queued').length
  const landed = outbound30d.filter((m) => m.status === 'delivered' || m.status === 'read').length

  const byChannel = new Map<string, number>()
  for (const message of messages) {
    if (message.direction !== 'outbound') continue
    byChannel.set(message.channel, (byChannel.get(message.channel) ?? 0) + 1)
  }

  return {
    ...totals,
    messagesSent30d: outbound30d.length,
    deliveryRate: percent(landed, reached),
    openRate: percent(totals.opened, totals.delivered),
    clickRate: percent(totals.clicked, totals.delivered),
    replyRate: percent(totals.replied, totals.delivered),
    unsubscribeRate: percent(totals.unsubscribed, totals.delivered),
    byOpenRate: campaigns
      .filter((c) => c.stats.delivered > 0)
      .sort((a, b) => percent(b.stats.opened, b.stats.delivered) - percent(a.stats.opened, a.stats.delivered))
      .map((c) => ({
        key: c.id as string,
        label: c.name,
        value: percent(c.stats.opened, c.stats.delivered),
        valueLabel: formatPercent(percent(c.stats.opened, c.stats.delivered)),
      })),
    channelMix: [...byChannel.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([channel, count]) => ({
        key: channel,
        label: CHANNEL_LABEL[channel] ?? channel,
        value: count,
        valueLabel: formatNumber(count),
        tone: 'accent' as const,
      })),
  }
}

/** What stops a send going out, or gets a number blocked for trying. */
function disciplineBand(messages: Message[], templates: MessageTemplate[]) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(TODAY, i - 13))
  const counts = days.map((day) => ({
    day,
    count: messages.filter((m) => m.direction === 'outbound' && m.sentAt.slice(0, 10) === day).length,
  }))

  const from = addDays(TODAY, -7)
  const perPerson = new Map<string, number>()
  for (const message of messages) {
    if (message.direction !== 'outbound') continue
    if (message.sentAt.slice(0, 10) < from) continue
    perPerson.set(message.personId as string, (perPerson.get(message.personId as string) ?? 0) + 1)
  }
  const values = [...perPerson.values()]
  const buckets = [
    { key: '1', label: '1 message', test: (n: number) => n === 1 },
    { key: '2', label: '2 messages', test: (n: number) => n === 2 },
    { key: '3', label: '3 messages', test: (n: number) => n === 3 },
    { key: '4', label: '4 or more messages', test: (n: number) => n >= 4 },
  ]

  return {
    counts,
    busiest: Math.max(0, ...counts.map((c) => c.count)),
    people: perPerson.size,
    heaviest: Math.max(0, ...values),
    frequencyRows: buckets.map((b) => {
      const count = values.filter(b.test).length
      return {
        key: b.key,
        label: b.label,
        value: count,
        valueLabel: `${formatNumber(count)} ${count === 1 ? 'person' : 'people'}`,
        tone: (b.key === '4' ? 'danger' : b.key === '3' ? 'warning' : 'accent') as 'danger' | 'warning' | 'accent',
      }
    }),
    pendingTemplates: templates.filter((t) => t.whatsappApprovalStatus === 'pending'),
    rejectedTemplates: templates.filter((t) => t.whatsappApprovalStatus === 'rejected'),
  }
}

export default function EngageDashboard() {
  const campaigns = useCollection(campaignsCollection)
  const messages = useCollection(messagesCollection)
  const templates = useCollection(messageTemplatesCollection)
  const segments = useCollection(segmentsCollection)
  const query = useQueryState()

  const { loading, error, rows, retry } = useModuleData(campaigns, 'engage.dashboard')

  const results = useMemo(() => resultBand(rows), [rows])
  const engagement = useMemo(() => engagementBand(rows, messages), [rows, messages])
  const discipline = useMemo(() => disciplineBand(messages, templates), [messages, templates])

  const tabs: TabItem[] = [
    { id: 'overview', label: 'Overview', panelId: 'engage-panel-overview' },
    { id: 'engagement', label: 'Engagement', panelId: 'engage-panel-engagement' },
    { id: 'discipline', label: 'Volume and discipline', panelId: 'engage-panel-discipline' },
    { id: 'journeys', label: 'Journeys', panelId: 'engage-panel-journeys' },
  ]
  const activeTab = query.get('view') ?? 'overview'

  return (
    <Screen>
      <ModuleHeader
        title="Engage"
        description="Segments, campaigns and journeys, built on the same Person records as the rest of the system."
        actions={
          <>
            <Button variant="secondary" size="sm" asChild>
              <Link to="/engage/campaigns">View campaigns</Link>
            </Button>
            <Button size="sm" leftIcon={<Plus size={16} />} asChild>
              <Link to="/engage/campaigns/new">New campaign</Link>
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorPanel what="The Engage dashboard" onRetry={retry} />
      ) : loading ? (
        <DashboardSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Send}
          title="No campaigns yet"
          message="Engage has nothing to report until a campaign has been built over a segment. Segments come from Person records, so the audience already exists."
          action={
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/engage/campaigns/new">Build a campaign</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/engage/segments">Review segments</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <Tabs tabs={tabs} value={activeTab} onChange={(next) => query.set('view', next)} aria-label="Engage themes" className="mb-6" />

          {/* ----------------------------- Overview ---------------------------- */}
          <TabPanel id="engage-panel-overview" tabId="overview" active={activeTab === 'overview'}>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Revenue attributed"
                value={formatNaira(results.revenue)}
                variant="success"
                icon={Banknote}
                caption="Across every campaign in the store"
              />
              <StatCard
                label="Enrolments attributed"
                value={formatNumber(results.enrolments)}
                icon={GraduationCap}
                caption="What the money figure is built from"
              />
              <StatCard
                label="Active campaigns"
                value={formatNumber(results.activeCampaigns)}
                icon={Send}
                caption={`${formatNumber(results.total)} in total`}
              />
              <StatCard
                label="Messages sent, 30 days"
                value={formatNumber(engagement.messagesSent30d)}
                icon={MessageSquare}
                caption="Outbound, every channel"
              />
            </div>

            {/* Revenue first. The PRD is explicit that attribution matters more than open rate. */}
            <Card padding="none" className="mt-6">
              <CardHeader
                title="Revenue attributed by campaign"
                description="Sorted by money, not by opens. A campaign that is read and ignored is not a good campaign."
                actions={<Badge tone="success">Leads this dashboard</Badge>}
              />
              <CardBody>
                <BarList rows={results.byRevenue} emptyMessage="No campaign has produced attributed revenue yet." />
              </CardBody>
            </Card>

            <Card padding="none" className="mt-6">
              <CardHeader
                title="Needs attention"
                description="What would stop the next send, or get a number blocked for trying."
              />
              <CardBody className="space-y-3">
                {discipline.rejectedTemplates.length > 0 && (
                  <Alert tone="danger" title={`${formatNumber(discipline.rejectedTemplates.length)} templates were rejected by WhatsApp`}>
                    {discipline.rejectedTemplates.map((t) => t.name).join(', ')}. A rejected template cannot send at all
                    until it is revised and resubmitted.
                  </Alert>
                )}
                {discipline.pendingTemplates.length > 0 && (
                  <Alert tone="warning" title={`${formatNumber(discipline.pendingTemplates.length)} templates are awaiting WhatsApp approval`}>
                    {discipline.pendingTemplates.map((t) => t.name).join(', ')}. They can be scheduled, but nothing leaves
                    the queue until Meta approves them.
                  </Alert>
                )}
                <Alert tone="warning" title="No send-frequency policy version is active">
                  Nothing currently caps daily volume or per-person frequency. Until a version exists under Settings →
                  Policies, the figures under Volume and discipline are observation rather than enforcement.
                </Alert>
                {engagement.unsubscribeRate > 1 && (
                  <Alert tone="warning" title={`Unsubscribe rate is ${formatPercent(engagement.unsubscribeRate)}`}>
                    An unsubscribe is held on the Person record, so it applies across every channel and every future
                    campaign. A rising rate is the audience asking for fewer sends.
                  </Alert>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          {/* ---------------------------- Engagement ---------------------------- */}
          <TabPanel id="engage-panel-engagement" tabId="engagement" active={activeTab === 'engagement'}>
            <p className="mb-4 text-body-14 text-text-secondary">
              {formatPercent(engagement.deliveryRate)} of what left the queue in the last thirty days was delivered, and{' '}
              {formatPercent(engagement.openRate)} of delivered messages were opened. These are diagnostics for the
              revenue figure on the Overview, not results in themselves.
            </p>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard
                label="Delivered"
                value={formatPercent(engagement.deliveryRate)}
                icon={BadgeCheck}
                caption="Of messages that left the queue"
              />
              <StatCard label="Opened" value={formatPercent(engagement.openRate)} icon={MailOpen} caption="Of delivered" />
              <StatCard label="Clicked" value={formatPercent(engagement.clickRate)} icon={MousePointerClick} caption="Of delivered" />
              <StatCard label="Replied" value={formatPercent(engagement.replyRate)} icon={Reply} caption="Of delivered" />
              <StatCard
                label="Unsubscribed"
                value={formatPercent(engagement.unsubscribeRate)}
                icon={UserMinus}
                variant={engagement.unsubscribeRate > 1 ? 'warning' : 'default'}
                caption="Held on the Person record"
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card padding="none">
                <CardHeader
                  title="Open rate by campaign"
                  description="Kept below revenue deliberately — it is a diagnostic, not a result."
                />
                <CardBody>
                  <BarList rows={engagement.byOpenRate} max={100} emptyMessage="Nothing delivered yet." />
                </CardBody>
              </Card>

              <Card padding="none">
                <CardHeader title="Channel mix" description="Outbound messages by channel, all time in the store." />
                <CardBody>
                  <BarList rows={engagement.channelMix} emptyMessage="No outbound messages yet." />
                </CardBody>
              </Card>
            </div>
          </TabPanel>

          {/* ------------------------ Volume and discipline ---------------------- */}
          <TabPanel id="engage-panel-discipline" tabId="discipline" active={activeTab === 'discipline'}>
            <p className="mb-4 text-body-14 text-text-secondary">
              Over-sending gets a WhatsApp business number blocked. This is a technical constraint, not a style
              preference.
            </p>

            <Card padding="none">
              <CardHeader title="Send volume and frequency" />
              <CardBody className="space-y-5">
                <Alert tone="warning" title="No send-frequency policy version is active">
                  Nothing currently caps daily volume or per-person frequency. Until a version exists under Settings →
                  Policies, the figures below are the only guard, and they are observation rather than enforcement.
                </Alert>

                <div>
                  <p className="mb-3 text-label-11 text-text-muted">Outbound messages per day, last 14 days</p>
                  <BarList
                    rows={discipline.counts.map((c) => ({
                      key: c.day,
                      label: c.day,
                      value: c.count,
                      valueLabel: formatNumber(c.count),
                      tone: c.count === discipline.busiest && c.count > 0 ? ('warning' as const) : ('accent' as const),
                    }))}
                    emptyMessage="No sends in the last fortnight."
                  />
                </div>

                <div>
                  <p className="mb-1 text-label-11 text-text-muted">Messages per person, last 7 days</p>
                  <p className="mb-3 text-body-13 text-text-secondary">
                    {formatNumber(discipline.people)} people were messaged at all. The heaviest recipient received{' '}
                    {formatNumber(discipline.heaviest)}.
                  </p>
                  <BarList rows={discipline.frequencyRows} emptyMessage="Nobody has been messaged this week." />
                </div>
              </CardBody>
            </Card>

            <Card padding="none" className="mt-6">
              <CardHeader
                title="WhatsApp template approval"
                description="A real platform constraint: an unapproved template cannot send, whatever the schedule says."
                actions={
                  <Button asChild size="sm" variant="secondary">
                    <Link to="/engage/templates">Open templates</Link>
                  </Button>
                }
              />
              <CardBody className="space-y-3">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  <StatCard
                    label="Templates pending approval"
                    value={formatNumber(discipline.pendingTemplates.length)}
                    icon={BadgeCheck}
                    variant={discipline.pendingTemplates.length > 0 ? 'warning' : 'default'}
                  />
                  <StatCard
                    label="Templates rejected"
                    value={formatNumber(discipline.rejectedTemplates.length)}
                    icon={BadgeCheck}
                    variant={discipline.rejectedTemplates.length > 0 ? 'danger' : 'default'}
                  />
                  <StatCard label="Templates in total" value={formatNumber(templates.length)} icon={MessageSquare} />
                </div>
              </CardBody>
            </Card>
          </TabPanel>

          {/* ------------------------------ Journeys ----------------------------- */}
          <TabPanel id="engage-panel-journeys" tabId="journeys" active={activeTab === 'journeys'}>
            <Card padding="none">
              <CardHeader
                title="Journeys"
                description="Journeys and automations are one engine. Engage does not carry a second builder."
                actions={
                  <Button variant="secondary" size="sm" asChild>
                    <Link to="/automation">Open Automation</Link>
                  </Button>
                }
              />
              <CardBody>
                <p className="text-body-14 text-text-secondary">
                  A journey is an automation whose trigger is an audience rather than an event. Both are configured,
                  versioned and traced in one place, so a journey that sends a message and an automation that sends a
                  message cannot drift apart.
                </p>
                <p className="mt-3 flex items-center gap-2 text-body-13 text-text-secondary">
                  <Workflow size={16} aria-hidden="true" />
                  {formatNumber(segments.length)} segments are available as journey audiences.
                </p>
                <p className="mt-3 text-body-13 text-text-secondary">
                  Every one of them resolves over Person records. There is no separate marketing contact list for a
                  journey to diverge from either.
                </p>
              </CardBody>
            </Card>
          </TabPanel>
        </>
      )}
    </Screen>
  )
}
