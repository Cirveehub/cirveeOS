import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Banknote,
  BadgeCheck,
  GraduationCap,
  MailOpen,
  MessageSquare,
  MousePointerClick,
  Reply,
  Send,
  UserMinus,
} from 'lucide-react'

import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { Alert, Badge, Button, Card, CardBody, CardHeader, StatCard } from '@/ui'
import { LAST_30D, TODAY, addDays, type Campaign, type Message, type MessageTemplate } from '@/mocks'

import { BarList, CHANNEL_LABEL, percent } from './parts'

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
        label: CHANNEL_LABEL[channel as keyof typeof CHANNEL_LABEL] ?? channel,
        value: count,
        valueLabel: formatNumber(count),
        tone: 'accent' as const,
      })),
  }
}

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

export function useMarketingFigures(campaigns: Campaign[], messages: Message[], templates: MessageTemplate[]) {
  const results = useMemo(() => resultBand(campaigns), [campaigns])
  const engagement = useMemo(() => engagementBand(campaigns, messages), [campaigns, messages])
  const discipline = useMemo(() => disciplineBand(messages, templates), [messages, templates])
  return { results, engagement, discipline }
}

type Figures = ReturnType<typeof useMarketingFigures>

export function ResultsBand({ figures, loading }: { figures: Figures; loading: boolean }) {
  const { results, engagement } = figures
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Revenue attributed"
        value={formatNaira(results.revenue)}
        variant="success"
        icon={Banknote}
        caption="Across every campaign"
        loading={loading}
      />
      <StatCard
        label="Enrolments attributed"
        value={formatNumber(results.enrolments)}
        icon={GraduationCap}
        caption="What the money figure is built from"
        loading={loading}
      />
      <StatCard
        label="Active campaigns"
        value={formatNumber(results.activeCampaigns)}
        icon={Send}
        caption={`${formatNumber(results.total)} in total`}
        loading={loading}
      />
      <StatCard
        label="Messages sent, 30 days"
        value={formatNumber(engagement.messagesSent30d)}
        icon={MessageSquare}
        caption="Outbound, every channel"
        loading={loading}
      />
    </div>
  )
}

export function NeedsAttention({ figures }: { figures: Figures }) {
  const { discipline, engagement } = figures
  return (
    <div className="space-y-3">
      {discipline.rejectedTemplates.length > 0 && (
        <Alert
          tone="danger"
          title={`${formatNumber(discipline.rejectedTemplates.length)} WhatsApp ${discipline.rejectedTemplates.length === 1 ? 'template was' : 'templates were'} rejected`}
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link to="/engage/campaigns/templates">Open templates</Link>
            </Button>
          }
        >
          {discipline.rejectedTemplates.map((t) => t.name).join(', ')}. A rejected template cannot send until it is
          revised and resubmitted.
        </Alert>
      )}
      {discipline.pendingTemplates.length > 0 && (
        <Alert
          tone="warning"
          title={`${formatNumber(discipline.pendingTemplates.length)} WhatsApp ${discipline.pendingTemplates.length === 1 ? 'template is' : 'templates are'} awaiting approval`}
          action={
            <Button size="sm" variant="secondary" asChild>
              <Link to="/engage/campaigns/templates">Open templates</Link>
            </Button>
          }
        >
          {discipline.pendingTemplates.map((t) => t.name).join(', ')}. Campaigns built on them stay in Scheduled until
          Meta approves.
        </Alert>
      )}
      <Alert
        tone="warning"
        title="No send-frequency policy is active"
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link to="/settings/policies">Open policies</Link>
          </Button>
        }
      >
        Nothing caps daily volume or messages per person right now. The figures under Performance are observation, not
        enforcement.
      </Alert>
      {engagement.unsubscribeRate > 1 && (
        <Alert tone="warning" title={`Unsubscribe rate is ${formatPercent(engagement.unsubscribeRate)}`}>
          An unsubscribe is held on the Person record, so it applies across every channel and every future campaign.
        </Alert>
      )}
    </div>
  )
}

export function PerformancePanel({ figures, templateCount }: { figures: Figures; templateCount: number }) {
  const { results, engagement, discipline } = figures
  return (
    <div className="space-y-6">
      <Card padding="none">
        <CardHeader
          title="Results — revenue by campaign"
          description="Sorted by money, not by opens. A campaign that is read and ignored is not a good campaign."
          actions={<Badge tone="success">{formatNaira(results.revenue)}</Badge>}
        />
        <CardBody>
          <BarList rows={results.byRevenue} emptyMessage="No campaign has produced attributed revenue yet." />
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader
          title="Diagnostics — how messages performed"
          description={`${formatPercent(engagement.deliveryRate)} of what left the queue in the last thirty days was delivered, and ${formatPercent(engagement.openRate)} of delivered messages were opened. These explain the revenue figure; they are not results in themselves.`}
        />
        <CardBody className="space-y-6">
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

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-label-11 text-text-muted">Open rate by campaign</p>
              <BarList rows={engagement.byOpenRate} max={100} emptyMessage="Nothing delivered yet." />
            </div>
            <div>
              <p className="mb-3 text-label-11 text-text-muted">Outbound messages by channel</p>
              <BarList rows={engagement.channelMix} emptyMessage="No outbound messages yet." />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader
          title="Volume — how much we are sending"
          description="Over-sending gets a WhatsApp business number blocked."
        />
        <CardBody className="space-y-6">
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

      <Card padding="none">
        <CardHeader
          title="WhatsApp template approval"
          description="An unapproved template cannot send, whatever the schedule says."
          actions={
            <Button asChild size="sm" variant="secondary">
              <Link to="/engage/campaigns/templates">Open templates</Link>
            </Button>
          }
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatCard
              label="Pending approval"
              value={formatNumber(discipline.pendingTemplates.length)}
              icon={BadgeCheck}
              variant={discipline.pendingTemplates.length > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Rejected"
              value={formatNumber(discipline.rejectedTemplates.length)}
              icon={BadgeCheck}
              variant={discipline.rejectedTemplates.length > 0 ? 'danger' : 'default'}
            />
            <StatCard label="Templates in total" value={formatNumber(templateCount)} icon={MessageSquare} />
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
