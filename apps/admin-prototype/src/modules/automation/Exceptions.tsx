import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, EyeOff, RefreshCw, UserPlus } from 'lucide-react'

import {
  automationExceptionsCollection,
  automationsCollection,
  usersCollection,
  useCollection,
} from '@/mocks'
import type { AutomationException, UserId } from '@/mocks/types'
import {
  Badge,
  Button,
  Card,
  ColumnPicker,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  Select,
  SkeletonTable,
  TableToolbar,
  Textarea,
  useColumnVisibility,
} from '@/ui'
import type { Column, ColumnCatalogueEntry, FilterValues } from '@/ui'
import { daysSince, formatDateTime, formatNumber } from '@/lib/format'

import { EXCEPTION_STATUS_LABEL, errorClassLabel, userName } from './lib'
import { ExceptionStatusBadge, LoadFailed, ModulePage, Screen, useScreenState } from './parts'
import { assignException, ignoreException, isPermanentFailure, markRetrying, settleRetry } from './writes'

const RETRY_SETTLE_MS = 900

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'id', label: 'Exception ID', defaultVisible: true, locked: true },
  { key: 'automation', label: 'Automation', defaultVisible: true },
  { key: 'subject', label: 'Subject', defaultVisible: true },
  { key: 'node', label: 'Node that failed', defaultVisible: false },
  { key: 'class', label: 'Error class', defaultVisible: true },
  { key: 'message', label: 'Error message', defaultVisible: true },
  { key: 'firstFailed', label: 'First failed', defaultVisible: false },
  { key: 'attempts', label: 'Retry attempts', defaultVisible: false },
  { key: 'lastAttempt', label: 'Last attempt', defaultVisible: false },
  { key: 'age', label: 'Age', defaultVisible: true },
  { key: 'assignee', label: 'Assignee', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'row-actions', label: 'Row actions', defaultVisible: true, locked: true },
]

export default function Exceptions() {
  const exceptions = useCollection(automationExceptionsCollection)
  const automations = useCollection(automationsCollection)
  const users = useCollection(usersCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('automation:exceptions')

  const [selected, setSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState<AutomationException[] | null>(null)
  const [assignee, setAssignee] = useState<string>('')
  const [ignoring, setIgnoring] = useState<AutomationException | null>(null)
  const [ignoreReason, setIgnoreReason] = useState('')
  const [ignoreError, setIgnoreError] = useState<string | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const values: FilterValues = {
    errorClass: params.get('errorClass') ?? undefined,
    status: params.get('status') ?? undefined,
    automation: params.get('automation') ?? undefined,
    assignee: params.get('assignee') ?? undefined,
  }
  const search = params.get('q') ?? ''

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const source = forcedEmpty ? [] : exceptions
  const classes = useMemo(() => {
    const map = new Map<string, { open: number; total: number }>()
    for (const e of source) {
      const held = map.get(e.errorClass) ?? { open: 0, total: 0 }
      held.total += 1
      if (e.status === 'open') held.open += 1
      map.set(e.errorClass, held)
    }
    return [...map.entries()].sort((a, b) => b[1].open - a[1].open)
  }, [source])

  const filtered = source.filter((e) => {
    if (values.errorClass && e.errorClass !== values.errorClass) return false
    if (values.status && e.status !== values.status) return false
    if (values.automation && e.automationId !== values.automation) return false
    if (values.assignee === 'unassigned' && e.assigneeUserId) return false
    if (values.assignee && values.assignee !== 'unassigned' && e.assigneeUserId !== values.assignee) return false
    if (search && !`${e.id} ${e.subjectLabel} ${e.errorMessage}`.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  const filtersActive = Boolean(search) || Object.values(values).some((v) => v !== undefined)

  const automationName = (id: string) => automations.find((a) => a.id === id)?.name ?? id

  const runRetry = (rows: AutomationException[]) => {
    const retryable = rows.filter((e) => e.status === 'open' || e.status === 'retrying')
    retryable.forEach(markRetrying)
    window.setTimeout(() => retryable.forEach(settleRetry), RETRY_SETTLE_MS)
    setSelected([])
  }

  const retryClass = (errorClass: string) => {
    runRetry(source.filter((e) => e.errorClass === errorClass && e.status === 'open'))
  }

  const confirmIgnore = () => {
    if (!ignoring) return
    if (!ignoreReason.trim()) {
      setIgnoreError('Say why this is being ignored. An unexplained ignore is indistinguishable from a bug.')
      return
    }
    ignoreException(ignoring, ignoreReason.trim())
    setIgnoring(null)
    setIgnoreReason('')
    setIgnoreError(null)
  }

  const allColumns: Array<Column<AutomationException>> = [
    {
      key: 'id',
      header: 'Exception',
      width: 130,
      pinned: true,
      sortValue: (e) => e.id,
      cell: (e) => <span className="font-mono text-body-12 text-text">{e.id}</span>,
    },
    {
      key: 'automation',
      header: 'Automation',
      minWidth: 230,
      sortValue: (e) => automationName(e.automationId),
      accessor: (e) => automationName(e.automationId),
    },
    {
      key: 'subject',
      header: 'Subject',
      minWidth: 170,
      sortValue: (e) => e.subjectLabel,
      accessor: (e) => e.subjectLabel,
    },
    {
      key: 'node',
      header: 'Failed node',
      minWidth: 200,
      sortValue: (e) => e.failedNodeLabel,
      cell: (e) => (
        <span className="text-body-13 text-text">
          {e.failedNodeLabel} <span className="font-mono text-body-12 text-text-secondary">{e.failedNodeId}</span>
        </span>
      ),
    },
    {
      key: 'class',
      header: 'Error class',
      width: 180,
      sortValue: (e) => e.errorClass,
      cell: (e) => (
        <Badge tone="danger" variant="subtle" size="sm">
          {errorClassLabel(e.errorClass)}
        </Badge>
      ),
    },
    {
      key: 'message',
      header: 'Error message',
      minWidth: 290,
      sortValue: (e) => e.errorMessage,
      cell: (e) => (
        <span className="text-body-12 text-text">
          {e.errorMessage}
          {isPermanentFailure(e) && (
            <span className="ml-1 text-text-secondary">— a retry cannot fix this; the record needs a number.</span>
          )}
        </span>
      ),
    },
    {
      key: 'firstFailed',
      header: 'First failed',
      width: 165,
      sortValue: (e) => e.firstFailedAt,
      accessor: (e) => formatDateTime(e.firstFailedAt),
    },
    {
      key: 'attempts',
      header: 'Retries',
      width: 90,
      align: 'right',
      sortValue: (e) => e.retryAttempts,
      accessor: (e) => formatNumber(e.retryAttempts),
    },
    {
      key: 'lastAttempt',
      header: 'Last attempt',
      width: 165,
      sortValue: (e) => e.lastAttemptAt,
      accessor: (e) => formatDateTime(e.lastAttemptAt),
    },
    {
      key: 'age',
      header: 'Age',
      width: 90,
      align: 'right',
      sortValue: (e) => daysSince(e.firstFailedAt),
      cell: (e) => {
        const days = daysSince(e.firstFailedAt)
        return (
          <span className={`tabular-nums text-body-13 ${days >= 5 ? 'text-warning-text' : 'text-text'}`}>
            {days === 0 ? 'Today' : `${days}d`}
          </span>
        )
      },
    },
    {
      key: 'assignee',
      header: 'Assignee',
      width: 160,
      sortValue: (e) => (e.assigneeUserId ? userName(e.assigneeUserId) : ''),
      cell: (e) =>
        e.assigneeUserId ? (
          <span className="text-body-13 text-text">{userName(e.assigneeUserId)}</span>
        ) : (
          <span className="text-body-13 text-text-secondary">Unassigned</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      sortValue: (e) => e.status,
      cell: (e) => <ExceptionStatusBadge status={e.status} />,
    },
    {
      key: 'row-actions',
      header: '',
      width: 200,
      align: 'right',
      cell: (e) => (
        <div className="flex justify-end gap-1">
          {(e.status === 'open' || e.status === 'retrying') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                runRetry([e])
              }}
              leftIcon={<RefreshCw size={14} />}
            >
              Retry
            </Button>
          )}
          {e.status !== 'ignored' && e.status !== 'resolved' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setIgnoring(e)
                setIgnoreReason('')
                setIgnoreError(null)
              }}
              leftIcon={<EyeOff size={14} />}
            >
              Ignore
            </Button>
          )}
        </div>
      ),
    },
  ]

  const columnsByKey = new Map(allColumns.map((c) => [c.key, c]))
  const columns = visible
    .map((key) => columnsByKey.get(key))
    .filter((c): c is Column<AutomationException> => Boolean(c))

  const selectedRows = filtered.filter((e) => selected.includes(e.id))
  const openCount = source.filter((e) => e.status === 'open').length

  return (
    <>
      <ModulePage
        tab="exceptions"
        title="Exception queue"
        description="What the retry policy could not fix, waiting on a human."
        meta={
          <span className="text-body-12 text-text-secondary">
            {formatNumber(openCount)} open across {classes.length} error class(es)
          </span>
        }
      />

      <Screen>
        <div className="flex flex-col gap-4">
          {errored && <LoadFailed what="The exception queue" onRetry={retry} />}

          {!loading && classes.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {classes.map(([cls, counts]) => (
                <li key={cls}>
                  <Card padding="tight" className="h-full">
                    <p className="text-body-13 font-semibold text-text">{errorClassLabel(cls)}</p>
                    <p className="mt-1 text-heading-24 tabular-nums text-text">{counts.open}</p>
                    <p className="text-body-12 text-text-secondary">
                      open of {counts.total} recorded
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setParam('errorClass', cls)}>
                        Filter
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={counts.open === 0}
                        onClick={() => retryClass(cls)}
                        leftIcon={<RefreshCw size={14} />}
                      >
                        Retry all
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <Card padding="none">
            <TableToolbar
              selectedCount={selectedRows.length}
              onClearSelection={() => setSelected([])}
              itemNoun="exception"
              actions={
                <ColumnPicker
                  catalogue={COLUMN_CATALOGUE}
                  visible={visible}
                  defaultKeys={defaultKeys}
                  onChange={setVisible}
                />
              }
              bulkActions={
                <>
                  <Button size="sm" variant="secondary" onClick={() => runRetry(selectedRows)} leftIcon={<RefreshCw size={14} />}>
                    Retry selected
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAssigning(selectedRows)
                      setAssignee('')
                    }}
                    leftIcon={<UserPlus size={14} />}
                  >
                    Assign
                  </Button>
                </>
              }
            >
              <FilterBar
                search={search}
                onSearchChange={(v) => setParam('q', v || undefined)}
                searchPlaceholder="Search by subject, message or id"
                values={values}
                onFilterChange={setParam}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  {
                    key: 'errorClass',
                    label: 'Error class',
                    width: 220,
                    options: classes.map(([cls]) => ({ value: cls, label: errorClassLabel(cls) })),
                  },
                  {
                    key: 'status',
                    label: 'Status',
                    options: (['open', 'retrying', 'resolved', 'ignored'] as const).map((s) => ({
                      value: s,
                      label: EXCEPTION_STATUS_LABEL[s],
                    })),
                  },
                  {
                    key: 'automation',
                    label: 'Automation',
                    width: 220,
                    options: [...new Set(source.map((e) => e.automationId))].map((id) => ({
                      value: id,
                      label: automationName(id),
                    })),
                  },
                  {
                    key: 'assignee',
                    label: 'Assignee',
                    options: [
                      { value: 'unassigned', label: 'Unassigned' },
                      ...[...new Set(source.map((e) => e.assigneeUserId).filter(Boolean))].map((id) => ({
                        value: String(id),
                        label: userName(id as UserId),
                      })),
                    ],
                  },
                ]}
              />
            </TableToolbar>

            {loading ? (
              <div className="p-4">
                <SkeletonTable rows={8} columns={7} />
              </div>
            ) : (
              <DataTable
                data={filtered}
                columns={columns}
                rowKey={(e) => e.id}
                density="compact"
                selectable
                selectedKeys={selected}
                onSelectionChange={setSelected}
                defaultSort={{ key: 'firstFailed', direction: 'desc' }}
                onRowClick={(e) => navigate(`/automation/runs/${e.runId}`)}
                empty={
                  filtersActive ? (
                    <EmptyState
                      variant="search"
                      title="No exceptions match these filters"
                      message="Nothing in the queue fits this error class, status, automation or assignee."
                      action={
                        <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={CheckCircle2}
                      title="No exceptions. All automations are running clean."
                      message="Every action that failed was recovered by the retry policy. Nothing is waiting on a person."
                      action={
                        <Button variant="secondary" onClick={() => navigate('/automation/runs')}>
                          Open run history
                        </Button>
                      }
                    />
                  )
                }
              />
            )}
          </Card>
        </div>
      </Screen>

      <Modal
        open={assigning !== null}
        onClose={() => setAssigning(null)}
        title="Assign these exceptions"
        description="An exception with no owner is an exception nobody is fixing."
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAssigning(null)}>
              Cancel
            </Button>
            <Button
              disabled={!assignee}
              onClick={() => {
                assigning?.forEach((e) => assignException(e, assignee as UserId))
                setAssigning(null)
                setSelected([])
              }}
            >
              Assign {assigning?.length ?? 0}
            </Button>
          </div>
        }
      >
        <Field label="Assignee" required>
          <Select
            value={assignee}
            placeholder="Choose a person"
            onChange={(e) => setAssignee(e.target.value)}
            options={users.slice(0, 30).map((u) => ({ value: u.id, label: userName(u.id) }))}
          />
        </Field>
      </Modal>

      <Modal
        open={ignoring !== null}
        onClose={() => {
          setIgnoring(null)
          setIgnoreError(null)
        }}
        title="Ignore this exception"
        description="It stays in the queue with an Ignored status and the reason attached. Nothing is deleted."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIgnoring(null)
                setIgnoreError(null)
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmIgnore}>Ignore it</Button>
          </div>
        }
      >
        <Field label="Reason" required error={ignoreError}>
          <Textarea
            rows={3}
            value={ignoreReason}
            onChange={(e) => {
              setIgnoreReason(e.target.value)
              if (ignoreError) setIgnoreError(null)
            }}
            placeholder="For example: duplicate of exc-0003, same subject and same node."
          />
        </Field>
      </Modal>
    </>
  )
}
