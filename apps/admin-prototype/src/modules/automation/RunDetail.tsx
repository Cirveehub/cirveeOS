import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  RefreshCw,
  Workflow,
} from 'lucide-react'

import { automationRunsCollection, useCollection } from '@/mocks'
import type { AutomationRun, AutomationRunStep } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
  KeyValueList,
  PageHeader,
  SectionHeader,
  SkeletonCard,
  SkeletonText,
} from '@/ui'
import { formatDateTime, formatNumber } from '@/lib/format'

import {
  NODE_LABEL,
  NODE_STYLE,
  RUN_STATUS_LABEL,
  TRIGGERS,
  automationForRun,
  errorClassLabel,
  hasTrace,
  runDuration,
  versionDrift,
  type NodeKind,
} from './lib'
import { KeyChip, LoadFailed, RunStatusBadge, Screen, VersionBadge, useScreenState } from './parts'
import { retryRun } from './writes'

function outputHref(output: AutomationRunStep['outputs'][number]): string {
  switch (output.type) {
    case 'Commission':
      return `/referral/commissions?q=${encodeURIComponent(output.ref)}`
    case 'Message':
      return '/engage/messages'
    case 'Cohort':
      return '/learn/progress'
    case 'Branch':
      return '/physical'
    case 'AutomationRun':
      return `/automation/runs/${output.id}`
    case 'Task':
      return '/work/tasks'
    case 'Document':
      return '/work/documents'
    default:
      return '/automation/runs'
  }
}

export default function RunDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const runs = useCollection(automationRunsCollection)
  const { loading, errored, retry } = useScreenState('automation:run-detail')
  const [payloadOpen, setPayloadOpen] = useState(false)

  const run = runs.find((r) => r.id === id)

  if (errored) {
    return (
      <>
        <PageHeader title="Run" breadcrumbs={crumbs(id)} />
        <Screen>
          <LoadFailed what="This run" onRetry={retry} />
        </Screen>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Run" breadcrumbs={crumbs(id)} />
        <Screen>
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonText lines={4} />
          </div>
        </Screen>
      </>
    )
  }

  if (!run) {
    return (
      <>
        <PageHeader title="Run" breadcrumbs={crumbs(id)} />
        <Screen>
          <EmptyState
            icon={FileText}
            title="That run is not in the history"
            message="Runs are never deleted, so this is usually a stale link or a run from a demo reset."
            action={
              <Button onClick={() => navigate('/automation/runs')}>Back to run history</Button>
            }
          />
        </Screen>
      </>
    )
  }

  const automation = automationForRun(run)
  const drift = versionDrift(run)
  const failedStep = run.steps.find((s) => s.error !== null)

  return (
    <>
      <PageHeader
        breadcrumbs={crumbs(run.id)}
        title={<span className="font-mono">{run.id}</span>}
        description={automation?.name ?? run.automationKey}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <RunStatusBadge status={run.status} size="md" />
            <VersionBadge version={run.automationVersion} />
            <span className="text-body-12 text-text-secondary">
              {run.subjectLabel} · started {formatDateTime(run.startedAt)}
            </span>
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {automation && (
              <Button
                variant="secondary"
                onClick={() => navigate(`/automation/workflows/${automation.id}/builder`)}
                leftIcon={<Workflow size={16} />}
              >
                Open v{run.automationVersion}
              </Button>
            )}
            <Button variant="secondary" onClick={() => navigate('/crm/leads')} leftIcon={<ExternalLink size={16} />}>
              Open the subject
            </Button>
            {run.status === 'failed' && (
              <>
                {failedStep && (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/automation/runs/${retryRun(run, true).id}`)}
                    leftIcon={<RefreshCw size={16} />}
                  >
                    Retry from the failed node
                  </Button>
                )}
                <Button
                  onClick={() => navigate(`/automation/runs/${retryRun(run, false).id}`)}
                  leftIcon={<RefreshCw size={16} />}
                >
                  Retry the whole run
                </Button>
              </>
            )}
          </div>
        }
      />

      <Screen>
        <div className="flex flex-col gap-4">
          {drift && (
            <Alert tone="info" title={`This automation is now v${drift.current}. This run executed v${run.automationVersion}.`}>
              The trace below is exactly what happened, under the definition in force at the time. Editing an
              automation creates a new version; it never rewrites a run.
            </Alert>
          )}

          {run.status === 'skipped_duplicate' && (
            <Alert tone="info" title="The idempotency guard refused this trigger">
              {run.errorSummary ?? 'A run with this key had already been processed.'} Nothing downstream ran twice —
              no duplicate message, no duplicate commission, no duplicate card.
            </Alert>
          )}

          {run.status === 'failed' && run.errorSummary && (
            <Alert tone="danger" title="This run failed">
              {run.errorSummary}
            </Alert>
          )}

          <Card padding="none">
            <CardHeader title="Run" description="Everything recorded at execution time." />
            <CardBody>
              <KeyValueList columns={2}>
                <KeyValue label="Run id">
                  <span className="font-mono">{run.id}</span>
                </KeyValue>
                <KeyValue label="Status">
                  <RunStatusBadge status={run.status} />
                </KeyValue>
                <KeyValue label="Automation">
                  {automation ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/automation/workflows/${automation.id}/builder`)}
                      className="rounded text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                    >
                      {automation.name} v{run.automationVersion}
                    </button>
                  ) : (
                    `${run.automationKey} v${run.automationVersion}`
                  )}
                </KeyValue>
                <KeyValue label="Trigger">{TRIGGERS[run.triggerType]?.label ?? run.triggerType}</KeyValue>
                <KeyValue label="Subject">{run.subjectLabel}</KeyValue>
                <KeyValue label="Actions executed">
                  {run.actionsExecuted} of {run.actionsTotal}
                </KeyValue>
                <KeyValue label="Started">{formatDateTime(run.startedAt)}</KeyValue>
                <KeyValue label="Ended">{run.endedAt ? formatDateTime(run.endedAt) : 'Still open'}</KeyValue>
                <KeyValue label="Duration">{runDuration(run)}</KeyValue>
                <KeyValue label="Idempotency key" hint="What made this run unique.">
                  <KeyChip value={run.idempotencyKey} />
                </KeyValue>
              </KeyValueList>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setPayloadOpen((o) => !o)}
                  aria-expanded={payloadOpen}
                  className="flex items-center gap-1.5 rounded-lg text-body-13 text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {payloadOpen ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                  Trigger payload
                </button>
                {payloadOpen && (
                  <pre className="mt-2 overflow-x-auto rounded-xl bg-surface-sunken p-3 font-mono text-body-12 text-text-secondary">
                    {JSON.stringify(run.triggerPayload, null, 2)}
                  </pre>
                )}
              </div>
            </CardBody>
          </Card>

          <SectionHeader
            title="Execution trace"
            description="One card per node, in the order they ran."
            count={run.steps.length || undefined}
          />

          {hasTrace(run) ? (
            <ol className="flex flex-col gap-3">
              {run.steps.map((step, i) => (
                <li key={`${step.nodeId}-${i}`}>
                  <TraceCard step={step} index={i + 1} onOpen={(href) => navigate(href)} />
                </li>
              ))}
            </ol>
          ) : (
            <Card>
              <EmptyState
                icon={FileText}
                title="This run kept its summary, not its step trace"
                message={`Step-level traces are retained for the most recent runs. Everything recorded at the time is above: status ${RUN_STATUS_LABEL[
                  run.status
                ].toLowerCase()}, ${run.actionsExecuted} of ${run.actionsTotal} actions executed, ${
                  run.errorSummary ? `error "${run.errorSummary}"` : 'no error'
                }. Nothing has been reconstructed or guessed.`}
                action={
                  <Button variant="secondary" onClick={() => navigate('/automation/runs?error=yes')}>
                    Show runs that kept a trace
                  </Button>
                }
                bordered={false}
              />
            </Card>
          )}

          <p className="text-body-12 text-text-secondary">
            Recorded {formatNumber(run.steps.length)} step(s). A retry never edits this run — it records a new one, so
            the original failure stays on the record.
          </p>
        </div>
      </Screen>
    </>
  )
}

function crumbs(id: string | undefined) {
  return [
    { label: 'Automation', to: '/automation' },
    { label: 'Run history', to: '/automation/runs' },
    { label: id ?? 'Run' },
  ]
}

function TraceCard({
  step,
  index,
  onOpen,
}: {
  step: AutomationRunStep
  index: number
  onOpen: (href: string) => void
}) {
  const kind = (['trigger', 'condition', 'delay', 'branch', 'action', 'stop'] as NodeKind[]).includes(
    step.kind as NodeKind,
  )
    ? (step.kind as NodeKind)
    : 'action'
  const skipped = step.skippedReason !== null
  const inputs = Object.entries(step.inputs)

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-surface p-4 ${
        step.error ? 'border-danger-line' : 'border-border'
      } ${skipped ? 'opacity-70' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${NODE_STYLE[kind].rail}`} aria-hidden="true" />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-14 font-semibold text-text">
            {index}. {NODE_LABEL[kind]}
          </span>
          <Badge tone={NODE_STYLE[kind].tone} variant="subtle" size="sm">
            {step.nodeId}
          </Badge>
          {skipped && (
            <Badge tone="neutral" variant="subtle" size="sm">
              Skipped
            </Badge>
          )}
          {step.error && (
            <Badge tone="danger" variant="subtle" size="sm" icon={<AlertTriangle size={12} />}>
              Failed
            </Badge>
          )}
        </div>
        <span className="text-body-12 tabular-nums text-text-secondary">
          {formatDateTime(step.at)} · {step.durationMs} ms
        </span>
      </div>

      <p className="mt-1 text-body-13 text-text">{step.label}</p>

      {inputs.length > 0 && (
        <div className="mt-3">
          <p className="text-label-11 uppercase tracking-wide text-text-label">Inputs</p>
          <dl className="mt-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {inputs.map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-3 border-b border-border py-1">
                <dt className="text-body-12 text-text-secondary">{key}</dt>
                <dd className="min-w-0 truncate text-body-12 text-text" title={String(value)}>
                  {typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mt-3">
        <p className="text-label-11 uppercase tracking-wide text-text-label">Outcome</p>
        <p className="mt-0.5 text-body-13 text-text">{step.outcome}</p>
      </div>

      {step.outputs.length > 0 && (
        <div className="mt-3">
          <p className="text-label-11 uppercase tracking-wide text-text-label">Outputs</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {step.outputs.map((output) => (
              <li key={`${output.type}-${output.id}`}>
                <button
                  type="button"
                  onClick={() => onOpen(outputHref(output))}
                  className="flex items-center gap-1.5 rounded-lg border border-border-strong px-2 py-1 text-body-12 text-accent transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {output.type} {output.ref}
                  <ArrowRight size={12} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step.error && (
        <div className="mt-3 rounded-xl border border-danger-line bg-danger-fill p-3">
          <p className="text-body-13 font-semibold text-danger-ink">{errorClassLabel(step.error.class)}</p>
          <p className="mt-0.5 text-body-13 text-danger-ink">{step.error.message}</p>
          <p className="mt-1 text-body-12 text-danger-ink">
            {step.error.attempts} attempt(s) made under the retry policy before this landed in the exception queue.
          </p>
        </div>
      )}

      {step.skippedReason && <p className="mt-2 text-body-12 text-text-secondary">{step.skippedReason}</p>}
    </div>
  )
}
