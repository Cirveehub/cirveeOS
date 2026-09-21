import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, History, Play, RefreshCw, ShieldCheck } from 'lucide-react'

import { automationRunsCollection, automationsCollection, useCollection } from '@/mocks'
import type { Automation, AutomationRun, AutomationRunStatus } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Pagination,
  Select,
  SkeletonTable,
  TableToolbar,
} from '@/ui'
import type { Column, FilterValues } from '@/ui'
import { formatDateTime, formatNumber } from '@/lib/format'

import { RUN_STATUS_LABEL, RUN_STATUS_ORDER, TRIGGERS, hasTrace, runDuration } from './lib'
import { KeyChip, LoadFailed, ModulePage, RunStatusBadge, Screen, VersionBadge, useScreenState } from './parts'
import { testSubjects } from './simulate'
import { fireAutomation, retryRun } from './writes'

const PAGE_SIZES = [25, 50, 100]

export default function Runs() {
  const runs = useCollection(automationRunsCollection)
  const automations = useCollection(automationsCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('automation:runs')
  const [fired, setFired] = useState<{ run: AutomationRun; duplicate: boolean } | null>(null)

  const values: FilterValues = {
    automation: params.get('automation') ?? undefined,
    status: params.get('status') ?? undefined,
    error: params.get('error') ?? undefined,
  }
  const search = params.get('q') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const page = Math.max(1, Number(params.get('page') ?? 1))
  const pageSize = PAGE_SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : 25

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const automationOptions = useMemo(
    () =>
      [...new Map(automations.map((a) => [a.automationKey, a])).values()]
        .map((a) => ({ value: a.automationKey, label: a.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [automations],
  )

  const source = forcedEmpty ? [] : runs
  const filtered = useMemo(() => {
    return source
      .filter((r) => {
        if (values.automation && r.automationKey !== values.automation) return false
        if (values.status && r.status !== values.status) return false
        if (values.error === 'yes' && !r.errorSummary) return false
        if (from && r.startedAt.slice(0, 10) < from) return false
        if (to && r.startedAt.slice(0, 10) > to) return false
        if (search) {
          const haystack = `${r.subjectLabel} ${r.id} ${r.idempotencyKey}`.toLowerCase()
          if (!haystack.includes(search.toLowerCase())) return false
        }
        return true
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  }, [source, values.automation, values.status, values.error, from, to, search])

  const filtersActive = Boolean(search || from || to) || Object.values(values).some((v) => v !== undefined)
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const automationFor = (run: AutomationRun): Automation | undefined =>
    automations.find((a) => a.id === run.automationId)

  const exportCsv = () => {
    const header = ['Run', 'Automation', 'Version', 'Trigger', 'Subject', 'Started', 'Status', 'Actions', 'Key', 'Error']
    const lines = filtered.map((r) =>
      [
        r.id,
        automationFor(r)?.name ?? r.automationKey,
        `v${r.automationVersion}`,
        TRIGGERS[r.triggerType]?.label ?? r.triggerType,
        r.subjectLabel,
        r.startedAt,
        RUN_STATUS_LABEL[r.status],
        `${r.actionsExecuted}/${r.actionsTotal}`,
        r.idempotencyKey,
        r.errorSummary ?? '',
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(','),
    )
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `automation-runs-${filtered.length}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const columns: Array<Column<AutomationRun>> = [
    {
      key: 'id',
      header: 'Run',
      width: 140,
      pinned: true,
      sortValue: (r) => r.id,
      cell: (r) => (
        <span className="font-mono text-body-12 text-text">
          {r.id}
          {!hasTrace(r) && <span className="sr-only"> — summary only, no step trace</span>}
        </span>
      ),
    },
    {
      key: 'automation',
      header: 'Automation',
      minWidth: 240,
      sortValue: (r) => automationFor(r)?.name ?? r.automationKey,
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body-13 text-text">{automationFor(r)?.name ?? r.automationKey}</span>
          <VersionBadge version={r.automationVersion} />
        </div>
      ),
    },
    {
      key: 'trigger',
      header: 'Trigger event',
      width: 190,
      sortValue: (r) => TRIGGERS[r.triggerType]?.label ?? r.triggerType,
      accessor: (r) => TRIGGERS[r.triggerType]?.label ?? r.triggerType,
    },
    {
      key: 'subject',
      header: 'Subject',
      minWidth: 180,
      sortValue: (r) => r.subjectLabel,
      accessor: (r) => r.subjectLabel,
    },
    {
      key: 'started',
      header: 'Started',
      width: 170,
      sortValue: (r) => r.startedAt,
      accessor: (r) => formatDateTime(r.startedAt),
    },
    {
      key: 'duration',
      header: 'Duration',
      width: 110,
      align: 'right',
      sortValue: (r) => r.durationMs ?? -1,
      accessor: (r) => runDuration(r),
    },
    {
      key: 'status',
      header: 'Status',
      width: 200,
      sortValue: (r) => r.status,
      cell: (r) => <RunStatusBadge status={r.status} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 100,
      align: 'right',
      sortValue: (r) => r.actionsExecuted,
      cell: (r) => (
        <span className="tabular-nums text-body-13 text-text">
          {r.actionsExecuted}/{r.actionsTotal}
        </span>
      ),
    },
    {
      key: 'error',
      header: 'Error summary',
      minWidth: 260,
      sortValue: (r) => r.errorSummary ?? '',
      cell: (r) =>
        r.errorSummary ? (
          <span className={`text-body-12 ${r.status === 'failed' ? 'text-danger-text' : 'text-text-secondary'}`}>
            {r.errorSummary}
          </span>
        ) : (
          <span className="text-body-12 text-text-secondary">—</span>
        ),
    },
    {
      key: 'key',
      header: 'Idempotency key',
      minWidth: 240,
      sortValue: (r) => r.idempotencyKey,
      cell: (r) => <KeyChip value={r.idempotencyKey} />,
    },
    {
      key: 'retry',
      header: '',
      width: 100,
      align: 'right',
      cell: (r) =>
        r.status === 'failed' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              const next = retryRun(r, false)
              navigate(`/automation/runs/${next.id}`)
            }}
            leftIcon={<RefreshCw size={14} />}
          >
            Retry
          </Button>
        ) : null,
    },
  ]

  return (
    <>
      <ModulePage
        tab="runs"
        title="Run history"
        description="Every run, with the version that executed and the key that kept it unique."
        actions={
          <Button variant="secondary" onClick={exportCsv} leftIcon={<Download size={16} />}>
            Export {formatNumber(filtered.length)} rows
          </Button>
        }
      />

      <Screen>
        <div className="flex flex-col gap-4">
          {errored && <LoadFailed what="Run history" onRetry={retry} />}

          <FireTriggerPanel onFired={setFired} />

          {fired && (
            <Alert
              tone={fired.duplicate ? 'info' : 'success'}
              title={
                fired.duplicate
                  ? 'Refused — this trigger has already been processed'
                  : `Run ${fired.run.id} recorded`
              }
              icon={fired.duplicate ? ShieldCheck : undefined}
              onDismiss={() => setFired(null)}
              action={
                <Button size="sm" variant="secondary" onClick={() => navigate(`/automation/runs/${fired.run.id}`)}>
                  Open the run
                </Button>
              }
            >
              {fired.duplicate ? (
                <>
                  The idempotency guard fired. Nothing downstream happened twice: no second message, no second
                  commission, no second card. The refusal is still recorded as a run so it can be counted —{' '}
                  <span className="font-mono">{fired.run.idempotencyKey}</span>.
                </>
              ) : (
                <>
                  {fired.run.actionsExecuted} of {fired.run.actionsTotal} actions executed for{' '}
                  {fired.run.subjectLabel}. Open the run to follow the trace and the records it created.
                </>
              )}
            </Alert>
          )}

          <Card padding="none">
            <TableToolbar>
              <FilterBar
                search={search}
                onSearchChange={(v) => setParam('q', v || undefined)}
                searchPlaceholder="Search by subject, run id or key"
                values={values}
                onFilterChange={setParam}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  { key: 'automation', label: 'Automation', options: automationOptions, width: 220 },
                  {
                    key: 'status',
                    label: 'Status',
                    options: RUN_STATUS_ORDER.map((s) => ({ value: s, label: RUN_STATUS_LABEL[s] })),
                    width: 200,
                  },
                  { key: 'error', label: 'Errors', options: [{ value: 'yes', label: 'Has an error' }] },
                ]}
              >
                <Field label="From" layout="inline" className="items-center">
                  <Input
                    type="date"
                    inputSize="sm"
                    value={from}
                    onChange={(e) => setParam('from', e.target.value || undefined)}
                  />
                </Field>
                <Field label="To" layout="inline" className="items-center">
                  <Input
                    type="date"
                    inputSize="sm"
                    value={to}
                    onChange={(e) => setParam('to', e.target.value || undefined)}
                  />
                </Field>
              </FilterBar>
            </TableToolbar>

            {loading ? (
              <div className="p-4">
                <SkeletonTable rows={10} columns={8} />
              </div>
            ) : (
              <>
                <DataTable
                  data={pageRows}
                  columns={columns}
                  rowKey={(r) => r.id}
                  density="compact"
                  onRowClick={(r) => navigate(`/automation/runs/${r.id}`)}
                  empty={
                    filtersActive ? (
                      <EmptyState
                        variant="search"
                        title="No runs match these filters"
                        message="Nothing ran under this combination of automation, status and date range."
                        action={
                          <Button
                            variant="secondary"
                            onClick={() => setParams(new URLSearchParams(), { replace: true })}
                          >
                            Clear filters
                          </Button>
                        }
                      />
                    ) : (
                      <EmptyState
                        icon={History}
                        title="No runs yet"
                        message="Nothing has triggered. Either no automation is active, or no matching event has happened since the last reset."
                        action={
                          <Button variant="secondary" onClick={() => navigate('/automation/workflows')}>
                            Open workflows
                          </Button>
                        }
                      />
                    )
                  }
                />
                {filtered.length > 0 && (
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={filtered.length}
                    itemNoun="run"
                    pageSizeOptions={PAGE_SIZES}
                    onPageChange={(p) => setParam('page', String(p))}
                    onPageSizeChange={(s) => setParam('size', String(s))}
                    divided
                  />
                )}
              </>
            )}
          </Card>

          <p className="text-body-12 text-text-secondary">
            Step-level traces are retained for the most recent runs. Older runs keep their summary — status, timing,
            actions executed and error — and say so on the run detail rather than showing an empty trace.
          </p>
        </div>
      </Screen>
    </>
  )
}

function FireTriggerPanel({ onFired }: { onFired: (result: { run: AutomationRun; duplicate: boolean }) => void }) {
  const automations = useCollection(automationsCollection)
  const subjects = useMemo(() => testSubjects(12), [])
  const active = automations.filter((a) => a.status === 'active')
  const [automationId, setAutomationId] = useState<string>(() => active[0]?.id ?? '')
  const [subjectId, setSubjectId] = useState(() => subjects[0]?.id ?? '')

  const automation = active.find((a) => a.id === automationId) ?? active[0]
  const subject = subjects.find((s) => s.id === subjectId)

  const fire = () => {
    if (!automation || !subject) return
    onFired(fireAutomation(automation, subject))
  }

  return (
    <Card padding="none">
      <CardHeader
        title="Fire a trigger"
        description="Runs an active automation for real against a seeded record, so the guard can be seen refusing the second attempt."
      />
      <CardBody className="flex flex-wrap items-end gap-3">
        <Field label="Automation" className="min-w-[280px] flex-1">
          <Select
            value={automation?.id ?? ''}
            onChange={(e) => setAutomationId(e.target.value)}
            options={active.map((a) => ({ value: a.id, label: `${a.name} (v${a.version})` }))}
            placeholder={active.length ? undefined : 'No active automations'}
          />
        </Field>
        <Field label="Record" className="min-w-[320px] flex-1">
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: s.label }))}
          />
        </Field>
        <Button onClick={fire} disabled={!automation || !subject} leftIcon={<Play size={16} />}>
          Fire trigger
        </Button>
        <Badge tone="neutral" variant="outline" size="sm">
          Fire the same pair twice to see the guard
        </Badge>
      </CardBody>
    </Card>
  )
}
