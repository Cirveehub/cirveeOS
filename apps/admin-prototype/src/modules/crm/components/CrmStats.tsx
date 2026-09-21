/**
 * The CRM dashboard's numbers, one component per theme.
 *
 * `CrmDashboard.tsx` used to compute all eight stat cards plus the funnel, the
 * source bars, the ageing strip, the owner table and the loss donut on every
 * render, and show them in one flat scroll. The page is now tabbed, and this
 * file is split to match: each band calls only the selectors it needs, so a
 * tab nobody opens costs nothing.
 *
 * Every figure is a selector call against the live store — create a lead in the
 * wizard and the pipeline card moves on the next render. None of these are
 * constants.
 */

import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Flame, Target, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react'

import { StatCard } from '@/ui'
import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { admissionsCollection, leadsCollection, select, useCollection } from '@/mocks'
import type { DateRange, LeadFilters } from '@/mocks/types'

import { formatMinutes } from '../lib/lookups'

export interface CrmScope {
  range: DateRange
  rangeLabel: string
  filters: LeadFilters
  /** Builds a deep link into `/crm/leads` carrying the dashboard's own scope. */
  leadsLink: (extra: Record<string, string>) => string
}

/* -------------------------------------------------------------------------- */
/* The band shell                                                             */
/* -------------------------------------------------------------------------- */

/**
 * A question, its one-sentence answer in plain English, and the cards that
 * support it. The grouping is the point: eight cards in an undifferentiated
 * grid is a wall of numbers; the same cards under a question is a briefing.
 */
export function Band({
  question,
  answer,
  children,
}: {
  question: string
  answer: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3" aria-label={question}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-heading-18 text-text">{question}</h2>
        <p className="text-body-13 text-text-secondary">{answer}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Overview — the four-number read                                            */
/* -------------------------------------------------------------------------- */

/**
 * What a growth head needs before deciding which tab to open: how much came
 * in, whether anyone answered it, what it is worth and how much of it closes.
 */
export function OverviewHeadlines({ scope }: { scope: CrmScope }) {
  const navigate = useNavigate()
  useCollection(leadsCollection)

  const newLeadCount = select.newLeads(scope.range)
  const slaRate = select.respondedWithinSlaRate(scope.range)
  const pipelineValue = select.pipelineValue(scope.filters)
  const conversion = select.leadConversionRate(scope.range)

  return (
    <Band
      question="Is the pipeline healthy?"
      answer={
        <>
          {formatNumber(newLeadCount)} leads in, {formatPercent(slaRate)} answered inside the SLA,{' '}
          {formatNaira(pipelineValue)} still open.
        </>
      }
    >
      <StatCard
        label="New leads"
        value={formatNumber(newLeadCount)}
        caption={scope.rangeLabel}
        icon={Users}
        onClick={() => navigate(scope.leadsLink({}))}
      />
      <StatCard
        label="Contacted within SLA"
        value={formatPercent(slaRate)}
        caption="First contact inside 120 minutes"
        icon={slaRate >= 70 ? TrendingUp : TrendingDown}
        variant={slaRate >= 70 ? 'success' : 'warning'}
      />
      <StatCard
        label="Pipeline value"
        value={formatNaira(pipelineValue)}
        caption="Quoted fees on leads still open"
        icon={Wallet}
      />
      <StatCard
        label="Lead to enrolment conversion"
        value={formatPercent(conversion)}
        caption="Enrolled admissions over leads created"
        icon={TrendingUp}
      />
    </Band>
  )
}

/* -------------------------------------------------------------------------- */
/* Pipeline                                                                   */
/* -------------------------------------------------------------------------- */

export function PipelineBand({ scope }: { scope: CrmScope }) {
  const navigate = useNavigate()
  const leads = useCollection(leadsCollection)

  const newLeadCount = select.newLeads(scope.range)
  const pipelineValue = select.pipelineValue(scope.filters)
  const qualified = leads.filter((l) => !l.archivedAt && l.stage === 'qualified').length
  const stalled = select.stalledLeads(14).length

  return (
    <Band
      question="Where is the pipeline sitting?"
      answer={
        stalled
          ? `${formatNumber(stalled)} leads have not moved in a fortnight. That is the number to act on.`
          : 'Nothing has been sitting in a stage for more than a fortnight.'
      }
    >
      <StatCard
        label="New leads"
        value={formatNumber(newLeadCount)}
        caption={scope.rangeLabel}
        icon={Users}
        onClick={() => navigate(scope.leadsLink({}))}
      />
      <StatCard
        label="Qualified"
        value={formatNumber(qualified)}
        caption="Sitting at the qualified stage now"
        icon={Target}
        onClick={() => navigate(scope.leadsLink({ stage: 'qualified' }))}
      />
      <StatCard
        label="Stalled 15 days or more"
        value={formatNumber(stalled)}
        caption="Nobody has touched these"
        variant={stalled > 0 ? 'warning' : 'success'}
        icon={Clock}
        onClick={() => navigate(scope.leadsLink({ days: '15' }))}
      />
      <StatCard
        label="Pipeline value"
        value={formatNaira(pipelineValue)}
        caption="Quoted fees on leads still open"
        icon={Wallet}
      />
    </Band>
  )
}

/* -------------------------------------------------------------------------- */
/* Response                                                                   */
/* -------------------------------------------------------------------------- */

export function ResponseBand({ scope }: { scope: CrmScope }) {
  useCollection(leadsCollection)

  const slaRate = select.respondedWithinSlaRate(scope.range)
  const median = select.medianFirstResponseMinutes(scope.range)
  const leads = leadsCollection.all().filter((l) => !l.archivedAt)
  const unanswered = leads.filter((l) => l.firstResponseAt === null && l.stage === 'new').length
  const noNextAction = leads.filter((l) => !l.nextAction && l.stage !== 'enrolled').length

  return (
    <Band
      question="Is anyone answering?"
      answer={
        <>
          {median === null
            ? 'Nothing has been responded to yet.'
            : `Half of all leads get a first response inside ${formatMinutes(median)}.`}{' '}
          {unanswered > 0 && `${formatNumber(unanswered)} have never been contacted at all.`}
        </>
      }
    >
      <StatCard
        label="Contacted within SLA"
        value={formatPercent(slaRate)}
        caption="First contact inside 120 minutes"
        icon={slaRate >= 70 ? TrendingUp : TrendingDown}
        variant={slaRate >= 70 ? 'success' : 'warning'}
      />
      <StatCard
        label="Median first response"
        value={median === null ? 'No responses yet' : formatMinutes(median)}
        caption="Clock starts at lead creation and never restarts"
        icon={Clock}
      />
      <StatCard
        label="Never contacted"
        value={formatNumber(unanswered)}
        caption="Still at the new stage with no first response"
        variant={unanswered > 0 ? 'danger' : 'success'}
        icon={TrendingDown}
      />
      <StatCard
        label="No next action set"
        value={formatNumber(noNextAction)}
        caption="A lead nobody has scheduled is a lead nobody is chasing"
        variant={noNextAction > 0 ? 'warning' : 'success'}
        icon={Target}
      />
    </Band>
  )
}

/* -------------------------------------------------------------------------- */
/* Admissions                                                                 */
/* -------------------------------------------------------------------------- */

export function AdmissionsBand({ scope }: { scope: CrmScope }) {
  const navigate = useNavigate()
  const admissions = useCollection(admissionsCollection)

  const inWindow = (iso: string) => {
    const day = iso.slice(0, 10)
    return day >= scope.range.from && day <= scope.range.to
  }
  const created = admissions.filter((a) => inWindow(a.createdAt))
  const enrolled = created.filter((a) => a.status === 'enrolled').length
  const pendingDiscount = admissions.filter((a) => a.status === 'pending_discount_approval').length
  const conversion = select.leadConversionRate(scope.range)

  return (
    <Band
      question="What is turning into money?"
      answer={
        <>
          {formatNumber(created.length)} admissions created, {formatNumber(enrolled)} reached
          enrolment.
          {pendingDiscount > 0 &&
            ` ${formatNumber(pendingDiscount)} are holding an invoice behind a discount approval.`}
        </>
      }
    >
      <StatCard
        label="Admissions created"
        value={formatNumber(created.length)}
        caption={scope.rangeLabel}
        icon={Flame}
        onClick={() => navigate('/crm/admissions')}
      />
      <StatCard
        label="Enrolled"
        value={formatNumber(enrolled)}
        caption="Admissions that reached enrolment"
        icon={Users}
        onClick={() => navigate('/crm/admissions?status=enrolled')}
      />
      <StatCard
        label="Awaiting discount approval"
        value={formatNumber(pendingDiscount)}
        caption="The invoice does not issue until these are decided"
        variant={pendingDiscount > 0 ? 'warning' : 'default'}
        icon={Clock}
        onClick={() => navigate('/crm/admissions?discount=pending')}
      />
      <StatCard
        label="Lead to enrolment conversion"
        value={formatPercent(conversion)}
        caption="Enrolled admissions over leads created"
        icon={TrendingUp}
      />
    </Band>
  )
}
