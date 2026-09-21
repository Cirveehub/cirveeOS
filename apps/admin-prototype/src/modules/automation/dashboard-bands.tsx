/**
 * The automation dashboard, one theme at a time.
 *
 * The screen used to render all ten stat cards plus five chart panels in one
 * flat scroll, with every figure computed on every render whether or not
 * anyone was looking at it. Following `command-centre/components/
 * ExecutiveStats.tsx`, each band below computes only its own slice and lives
 * inside its own `TabPanel`, so the work happens when the tab is opened rather
 * than on mount.
 *
 * Nothing was cut. Every card and every chart the dashboard carried is still
 * here — `OverviewHeadlines` repeats four of them as the ten-second read, and
 * the rest sit one click away under the theme they belong to.
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, CheckCircle2, Pause, Send, ShieldCheck, Workflow, Zap } from 'lucide-react'

import {
  TODAY,
  automationExceptionsCollection,
  automationHealth,
  automationRunsCollection,
  automationsCollection,
  daysAgo,
  useCollection,
} from '@/mocks'
import { Card, CardBody, CardHeader, EmptyState, SkeletonCard, StatCard } from '@/ui'
import { formatNumber, formatPercent } from '@/lib/format'

import { RUN_STATUS_LABEL, TRIGGERS, errorClassLabel, triggerOf } from './lib'
import { BarChart, ChartLegend, StackedDays } from './parts'

const BAND_GRID = 'grid grid-cols-2 gap-4 xl:grid-cols-4'

function BandSkeleton({ cards }: { cards: number }) {
  return (
    <div className={BAND_GRID}>
      {Array.from({ length: cards }, (_, i) => (
        <SkeletonCard key={i} variant="stat" />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Overview — the ten-second read                                             */
/* -------------------------------------------------------------------------- */

export function OverviewHeadlines({ loading }: { loading: boolean }) {
  const navigate = useNavigate()
  useCollection(automationsCollection)
  useCollection(automationRunsCollection)
  useCollection(automationExceptionsCollection)
  const health = automationHealth()

  if (loading) return <BandSkeleton cards={4} />

  return (
    <section aria-label="Is automation carrying the load?">
      <div className={BAND_GRID}>
        <StatCard
          label="Active automations"
          value={formatNumber(health.active)}
          icon={Zap}
          variant="success"
          caption="Running without anyone asking"
          onClick={() => navigate('/automation/workflows?status=active')}
        />
        <StatCard
          label="Runs (7 days)"
          value={formatNumber(health.runs7d)}
          icon={Activity}
          caption="Work that happened by itself"
          onClick={() => navigate('/automation/runs')}
        />
        <StatCard
          label="Success rate"
          value={formatPercent(health.successRate)}
          icon={CheckCircle2}
          variant={health.successRate >= 95 ? 'success' : 'warning'}
          caption={`${formatPercent(health.completionSuccessRate)} of runs that finished`}
        />
        <StatCard
          label="In exception queue"
          value={formatNumber(health.exceptionsOpen)}
          icon={AlertTriangle}
          variant={health.exceptionsOpen > 0 ? 'danger' : 'success'}
          caption="Failures waiting on a person"
          onClick={() => navigate('/automation/exceptions?status=open')}
        />
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Fleet — what exists, and what state it is in                               */
/* -------------------------------------------------------------------------- */

export function FleetBand({ loading }: { loading: boolean }) {
  const navigate = useNavigate()
  useCollection(automationsCollection)
  const health = automationHealth()

  if (loading) return <BandSkeleton cards={3} />

  return (
    <section aria-label="What is configured, and what state is it in?">
      <div className={BAND_GRID}>
        <StatCard
          label="Active automations"
          value={formatNumber(health.active)}
          icon={Zap}
          variant="success"
          onClick={() => navigate('/automation/workflows?status=active')}
        />
        <StatCard
          label="Paused"
          value={formatNumber(health.paused)}
          icon={Pause}
          variant="warning"
          caption="Creating no new runs"
          onClick={() => navigate('/automation/workflows?status=paused')}
        />
        <StatCard
          label="Draft"
          value={formatNumber(health.draft)}
          icon={Workflow}
          caption="Never triggered"
          onClick={() => navigate('/automation/workflows?status=draft')}
        />
      </div>
    </section>
  )
}

export function TriggerMixChart({ loading }: { loading: boolean }) {
  const automations = useCollection(automationsCollection)

  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of automations) {
      if (a.status === 'archived') continue
      const trigger = triggerOf(a)
      counts.set(trigger, (counts.get(trigger) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [automations])

  return (
    <Card padding="none">
      <CardHeader title="Automations by trigger type" description="Where the work starts." />
      <CardBody>
        {loading ? (
          <SkeletonCard />
        ) : (
          <BarChart
            ariaLabel="Automations by trigger type"
            rows={rows.map(([trigger, count]) => ({
              key: trigger,
              label: TRIGGERS[trigger as keyof typeof TRIGGERS]?.label ?? trigger,
              value: count,
              valueLabel: formatNumber(count),
              tone: 'neutral',
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Runs — volume and what it produced                                         */
/* -------------------------------------------------------------------------- */

export function RunsBand({ loading }: { loading: boolean }) {
  const navigate = useNavigate()
  useCollection(automationRunsCollection)
  const health = automationHealth()

  if (loading) return <BandSkeleton cards={3} />

  return (
    <section aria-label="How much ran, and what did it produce?">
      <div className={BAND_GRID}>
        <StatCard
          label="Runs (7 days)"
          value={formatNumber(health.runs7d)}
          icon={Activity}
          onClick={() => navigate('/automation/runs')}
        />
        <StatCard
          label="Actions executed (7 days)"
          value={formatNumber(health.actionsExecuted7d)}
          icon={Zap}
          caption="Individual steps the engine carried out"
        />
        <StatCard
          label="Messages sent (7 days)"
          value={formatNumber(health.messagesSent7d)}
          icon={Send}
          caption="Email, WhatsApp, SMS and in-app"
        />
      </div>
    </section>
  )
}

export function RunsOverTimeChart({ loading }: { loading: boolean }) {
  const runs = useCollection(automationRunsCollection)

  const days = useMemo(() => {
    const window = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i))
    return window.map((date) => {
      const onDay = runs.filter((r) => r.startedAt.slice(0, 10) === date)
      return {
        key: date,
        label: date === TODAY ? 'Today' : date.slice(5),
        succeeded: onDay.filter((r) => r.status === 'succeeded').length,
        failed: onDay.filter((r) => r.status === 'failed').length,
        other: onDay.filter((r) => r.status !== 'succeeded' && r.status !== 'failed').length,
      }
    })
  }, [runs])

  return (
    <Card padding="none">
      <CardHeader
        title="Runs over the last seven days"
        description="Succeeded, failed, and everything still waiting."
      />
      <CardBody>
        {loading ? (
          <SkeletonCard />
        ) : (
          <>
            <StackedDays days={days} ariaLabel="Runs per day over the last seven days" />
            <div className="mt-4">
              <ChartLegend
                items={[
                  { key: 'ok', label: 'Succeeded', swatch: 'bg-accent' },
                  { key: 'failed', label: 'Failed', swatch: 'bg-danger-600' },
                  { key: 'other', label: 'Waiting, skipped or stopped', swatch: 'bg-warning-500' },
                ]}
              />
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

export function TopAutomationsChart({ loading }: { loading: boolean }) {
  const navigate = useNavigate()
  const runs = useCollection(automationRunsCollection)
  const automations = useCollection(automationsCollection)

  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of runs) counts.set(r.automationId, (counts.get(r.automationId) ?? 0) + 1)
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, automation: automations.find((a) => a.id === id) }))
      .filter((row) => row.automation)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
  }, [runs, automations])

  return (
    <Card padding="none">
      <CardHeader title="Top automations by run volume" description="Click through to the runs." />
      <CardBody>
        {loading ? (
          <SkeletonCard />
        ) : (
          <BarChart
            ariaLabel="Automations by run volume"
            rows={rows.map((row) => ({
              key: row.id,
              label: (
                <button
                  type="button"
                  onClick={() => navigate(`/automation/runs?automation=${row.automation?.automationKey ?? ''}`)}
                  className="rounded text-left text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {row.automation?.name}
                </button>
              ),
              value: row.count,
              valueLabel: formatNumber(row.count),
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}

export function RunOutcomesChart({ loading }: { loading: boolean }) {
  const runs = useCollection(automationRunsCollection)

  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of runs) counts.set(r.status, (counts.get(r.status) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [runs])

  return (
    <Card padding="none">
      <CardHeader
        title="Run outcomes"
        description="Every status the engine can record, and how often it did."
      />
      <CardBody>
        {loading ? (
          <SkeletonCard />
        ) : (
          <BarChart
            ariaLabel="Runs by outcome"
            rows={rows.map(([status, count]) => ({
              key: status,
              label: RUN_STATUS_LABEL[status as keyof typeof RUN_STATUS_LABEL] ?? status,
              value: count,
              valueLabel: formatNumber(count),
              tone:
                status === 'failed'
                  ? 'danger'
                  : status === 'succeeded'
                    ? 'success'
                    : status === 'skipped_duplicate'
                      ? 'accent'
                      : 'neutral',
              caption:
                status === 'skipped_duplicate'
                  ? 'The duplicate guard refused these. Each one is work that would otherwise have happened twice.'
                  : undefined,
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Reliability — what broke, and what was prevented                           */
/* -------------------------------------------------------------------------- */

export function ReliabilityBand({ loading }: { loading: boolean }) {
  const navigate = useNavigate()
  useCollection(automationRunsCollection)
  useCollection(automationExceptionsCollection)
  const health = automationHealth()

  if (loading) return <BandSkeleton cards={4} />

  return (
    <section aria-label="What broke, and what was prevented?">
      <div className={BAND_GRID}>
        <StatCard
          label="Success rate"
          value={formatPercent(health.successRate)}
          icon={CheckCircle2}
          variant={health.successRate >= 95 ? 'success' : 'warning'}
          caption={`${formatPercent(health.completionSuccessRate)} of runs that finished`}
        />
        <StatCard
          label="Failed"
          value={formatNumber(health.failed)}
          icon={AlertTriangle}
          variant="danger"
          caption="Runs that ended in an error"
          onClick={() => navigate('/automation/runs?status=failed')}
        />
        <StatCard
          label="In exception queue"
          value={formatNumber(health.exceptionsOpen)}
          icon={AlertTriangle}
          variant={health.exceptionsOpen > 0 ? 'danger' : 'success'}
          caption="Open, waiting on a person"
          onClick={() => navigate('/automation/exceptions?status=open')}
        />
        <StatCard
          label="Idempotency collisions prevented"
          value={formatNumber(health.idempotencyCollisionsPrevented)}
          icon={ShieldCheck}
          variant="success"
          caption="Duplicate triggers refused"
          onClick={() => navigate('/automation/runs?status=skipped_duplicate')}
        />
      </div>
    </section>
  )
}

export function FailureReasonsChart({ loading }: { loading: boolean }) {
  const runs = useCollection(automationRunsCollection)
  const exceptions = useCollection(automationExceptionsCollection)

  const rows = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of exceptions) counts.set(e.errorClass, (counts.get(e.errorClass) ?? 0) + 1)
    for (const r of runs) {
      if (r.status !== 'failed' || !r.errorSummary) continue
      const cls = r.errorSummary.split(':')[0]
      counts.set(cls, (counts.get(cls) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [runs, exceptions])

  return (
    <Card padding="none">
      <CardHeader title="Failure reasons" description="What actually goes wrong, grouped by error class." />
      <CardBody>
        {loading ? (
          <SkeletonCard />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing has failed"
            message="No run in the window recorded an error."
            size="sm"
            bordered={false}
          />
        ) : (
          <BarChart
            ariaLabel="Failure reasons by count"
            rows={rows.map(([cls, count]) => ({
              key: cls,
              label: errorClassLabel(cls),
              value: count,
              valueLabel: formatNumber(count),
              tone: 'danger',
            }))}
          />
        )}
      </CardBody>
    </Card>
  )
}
