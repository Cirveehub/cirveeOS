import { useMemo, useState } from 'react'
import { CheckCircle2, CircleSlash, FlaskConical, MinusCircle, Play, Timer } from 'lucide-react'

import type { Automation, AutomationNode } from '@/mocks/types'
import { Alert, Badge, Button, Field, KeyValue, KeyValueList, Modal, Select } from '@/ui'

import { NODE_LABEL, NODE_STYLE } from './lib'
import { KeyChip, NodeKindBadge } from './parts'
import { simulate, testSubjects, type SimResult, type SimStep, type TestSubject } from './simulate'

const VERDICT_META: Record<SimStep['verdict'], { label: string; tone: 'success' | 'neutral' | 'warning' | 'danger' | 'info' }> = {
  evaluated: { label: 'Evaluated', tone: 'info' },
  would_execute: { label: 'Would run', tone: 'success' },
  skipped: { label: 'Skipped', tone: 'neutral' },
  stopped: { label: 'Stops here', tone: 'danger' },
  waiting: { label: 'Would wait', tone: 'warning' },
}

export interface TestRunModalProps {
  open: boolean
  onClose: () => void
  name: string
  automationKey: string
  nodes: AutomationNode[]
  reliability: Automation['reliability']
}

export function TestRunModal({ open, onClose, name, automationKey, nodes, reliability }: TestRunModalProps) {
  const subjects = useMemo(() => testSubjects(), [])
  const [subjectId, setSubjectId] = useState(() => subjects[0]?.id ?? '')
  const [result, setResult] = useState<SimResult | null>(null)

  const subject: TestSubject | undefined = subjects.find((s) => s.id === subjectId)

  const run = () => {
    if (!subject) return
    setResult(simulate(nodes, automationKey, reliability.idempotencyKeyFields, subject))
  }

  const reset = () => setResult(null)

  const unchanged =
    result !== null &&
    result.before.runs === result.after.runs &&
    result.before.messages === result.after.messages &&
    result.before.commissions === result.after.commissions

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Test run — ${name || 'Untitled automation'}`}
      description="Step through every node against one seeded record. Nothing is written."
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <p className="text-body-12 text-text-secondary">
            A test run never appears in the run history, because no run happened.
          </p>
          <div className="flex gap-2">
            {result && (
              <Button variant="secondary" onClick={reset}>
                Pick another record
              </Button>
            )}
            <Button variant={result ? 'primary' : 'secondary'} onClick={onClose}>
              Close
            </Button>
            {!result && (
              <Button onClick={run} disabled={!subject} leftIcon={<Play size={16} />}>
                Run test
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {!result ? (
          <>
            <Alert tone="info" title="A test run writes nothing" icon={FlaskConical}>
              No message is sent, no commission is calculated, no card is issued, no LMS access is granted and no row
              is added to the run history. The automation is evaluated against the record you pick and the result is
              described, not performed.
            </Alert>

            <Field
              label="Record to test against"
              hint="Fully-paid invoices appear first — that is the reference journey's trigger."
            >
              <Select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                options={subjects.map((s) => ({ value: s.id, label: s.label }))}
                placeholder={subjects.length ? undefined : 'No seeded invoices available'}
              />
            </Field>

            {subject && (
              <KeyValueList columns={2}>
                <KeyValue label="Subject">{subject.label.split(' · ')[0]}</KeyValue>
                <KeyValue label="Invoice">{subject.label.split(' · ')[1] ?? '—'}</KeyValue>
                <KeyValue label="Nodes to evaluate">{nodes.length}</KeyValue>
                <KeyValue label="Idempotency key this record would produce">
                  <KeyChip
                    value={simulate(nodes, automationKey, reliability.idempotencyKeyFields, subject).idempotencyKey}
                  />
                </KeyValue>
              </KeyValueList>
            )}
          </>
        ) : (
          <>
            <Alert
              tone={unchanged ? 'success' : 'danger'}
              title={unchanged ? 'Nothing was written' : 'The store changed — that is a bug'}
              icon={unchanged ? CheckCircle2 : undefined}
            >
              {unchanged ? (
                <>
                  The test evaluated {result.steps.length} node(s) and described {result.actionsWouldRun} of{' '}
                  {result.actionsTotal} action(s) it would have taken. Collection sizes were captured either side of
                  the run and are identical: run history {result.before.runs} → {result.after.runs}, messages{' '}
                  {result.before.messages} → {result.after.messages}, commissions {result.before.commissions} →{' '}
                  {result.after.commissions}.
                </>
              ) : (
                <>A test run must not mutate the store. Report this.</>
              )}
            </Alert>

            <KeyValueList columns={2}>
              <KeyValue label="Record">{subject?.label ?? '—'}</KeyValue>
              <KeyValue label="Idempotency key">
                <KeyChip value={result.idempotencyKey} />
              </KeyValue>
              <KeyValue label="Outcome">
                {result.reached === 'end'
                  ? 'Reached the end of the automation'
                  : result.reached === 'stopped'
                    ? 'Halted at the stop condition'
                    : 'Halted — conditions not met'}
              </KeyValue>
              <KeyValue label="Actions that would run">
                {result.actionsWouldRun} of {result.actionsTotal}
              </KeyValue>
            </KeyValueList>

            <ol className="flex flex-col gap-3">
              {result.steps.map((step, i) => (
                <TraceStep key={`${step.nodeId}-${i}`} step={step} index={i + 1} />
              ))}
            </ol>
          </>
        )}
      </div>
    </Modal>
  )
}

function TraceStep({ step, index }: { step: SimStep; index: number }) {
  const meta = VERDICT_META[step.verdict]
  const dimmed = step.verdict === 'skipped'
  const Icon =
    step.verdict === 'would_execute'
      ? CheckCircle2
      : step.verdict === 'skipped'
        ? MinusCircle
        : step.verdict === 'stopped'
          ? CircleSlash
          : step.verdict === 'waiting'
            ? Timer
            : CheckCircle2

  return (
    <li className={`rounded-xl border border-border bg-surface p-4 ${dimmed ? 'opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`flex size-7 items-center justify-center rounded-lg ${NODE_STYLE[step.kind].chip}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
        <span className="text-body-14 font-semibold text-text">
          {index}. {step.title}
        </span>
        <NodeKindBadge kind={step.kind} />
        <Badge tone={meta.tone} variant="subtle" size="sm">
          {meta.label}
        </Badge>
        <span className="sr-only">
          {NODE_LABEL[step.kind]} {meta.label}
        </span>
      </div>

      <p className="mt-2 text-body-13 text-text">{step.outcome}</p>

      {step.inputs.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
          {step.inputs.map((input) => (
            <div key={input.label} className="flex items-baseline justify-between gap-3 border-b border-border py-1">
              <dt className="text-body-12 text-text-secondary">{input.label}</dt>
              <dd className="text-body-12 text-text">{input.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {step.detail.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {step.detail.map((line, i) => (
            <li
              key={i}
              className={`text-body-12 ${line.passed ? 'text-success-text' : 'text-danger-text'}`}
            >
              {line.passed ? '✓' : '✕'} {line.text}
            </li>
          ))}
        </ul>
      )}

      {step.wouldProduce.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-surface-sunken px-3 py-2">
          {step.wouldProduce.map((w, i) => (
            <li key={i} className="text-body-12 text-text-secondary">
              {w}
            </li>
          ))}
        </ul>
      )}

      {step.skippedReason && <p className="mt-2 text-body-12 text-text-secondary">{step.skippedReason}</p>}
    </li>
  )
}
