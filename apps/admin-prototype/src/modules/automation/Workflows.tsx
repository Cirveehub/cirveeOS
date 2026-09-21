import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Archive, Copy, History, MoreHorizontal, Pause, Play, Plus, SquarePen, Workflow } from 'lucide-react'

import { automationExceptionsCollection, automationRunsCollection, automationsCollection, useCollection } from '@/mocks'
import type { Automation } from '@/mocks/types'
import {
  Badge,
  Button,
  Card,
  ColumnPicker,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  Popover,
  PopoverItem,
  SkeletonTable,
  TableToolbar,
  useColumnVisibility,
} from '@/ui'
import type { Column, ColumnCatalogueEntry, FilterValues } from '@/ui'
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format'

import {
  ACTIONS,
  AUTOMATION_STATUS_LABEL,
  TRIGGERS,
  actionCount,
  conditionCount,
  retrySentence,
  triggerOf,
  userName,
  versionsOf,
} from './lib'
import { AutomationStatusBadge, LoadFailed, ModulePage, Screen, VersionBadge, useScreenState } from './parts'
import { createAutomation, setAutomationStatus } from './writes'

const ALL_MODULES = [...new Set(Object.values(ACTIONS).map((a) => a.module))].sort()

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Name', defaultVisible: true, locked: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'version', label: 'Version', defaultVisible: true },
  { key: 'trigger', label: 'Trigger', defaultVisible: true },
  { key: 'conditions', label: 'Conditions', defaultVisible: false },
  { key: 'actions', label: 'Actions', defaultVisible: false },
  { key: 'runs', label: 'Runs (7d)', defaultVisible: true },
  { key: 'success', label: 'Success rate', defaultVisible: true },
  { key: 'exceptions', label: 'Open exceptions', defaultVisible: true },
  { key: 'lastRun', label: 'Last run', defaultVisible: false },
  { key: 'editedBy', label: 'Last edited by', defaultVisible: false },
  { key: 'owner', label: 'Owner', defaultVisible: false },
  { key: 'modules', label: 'Modules touched', defaultVisible: false },
  { key: 'row-actions', label: 'Row actions', defaultVisible: true, locked: true },
]

export default function Workflows() {
  const automations = useCollection(automationsCollection)
  const runs = useCollection(automationRunsCollection)
  const exceptions = useCollection(automationExceptionsCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('automation:workflows')

  const [historyKey, setHistoryKey] = useState<string | null>(null)
  const [archiving, setArchiving] = useState<Automation | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const values: FilterValues = {
    status: params.get('status') ?? undefined,
    trigger: params.get('trigger') ?? undefined,
    module: params.get('module') ?? undefined,
    owner: params.get('owner') ?? undefined,
    failures: params.get('failures') ?? undefined,
  }
  const search = params.get('q') ?? ''

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const current = useMemo(() => {
    const byKey = new Map<string, Automation>()
    for (const a of automations) {
      const held = byKey.get(a.automationKey)
      if (!held || a.version > held.version) byKey.set(a.automationKey, a)
    }
    return [...byKey.values()]
  }, [automations])

  const failureCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of exceptions) {
      if (e.status !== 'open') continue
      map.set(e.automationId, (map.get(e.automationId) ?? 0) + 1)
    }
    return map
  }, [exceptions])

  const runCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of runs) map.set(r.automationKey, (map.get(r.automationKey) ?? 0) + 1)
    return map
  }, [runs])

  const owners = useMemo(
    () => [...new Set(current.map((a) => a.ownerUserId))].map((id) => ({ value: id, label: userName(id) })),
    [current],
  )

  const source = forcedEmpty ? [] : current
  const filtered = source.filter((a) => {
    if (values.status && a.status !== values.status) return false
    if (values.trigger && triggerOf(a) !== values.trigger) return false
    if (values.module && !a.modulesTouched.includes(values.module)) return false
    if (values.owner && a.ownerUserId !== values.owner) return false
    if (values.failures === 'yes' && !(failureCounts.get(a.id) ?? 0)) return false
    if (search && !`${a.name} ${a.description} ${a.automationKey}`.toLowerCase().includes(search.toLowerCase()))
      return false
    return true
  })

  const filtersActive = Boolean(search) || Object.values(values).some((v) => v !== undefined)

  const newAutomation = () => navigate('/automation/workflows/new')

  const duplicate = (a: Automation) => {
    const copy = createAutomation({
      name: `${a.name} (copy)`,
      description: a.description,
      automationKey: `${a.automationKey}-copy-${Math.random().toString(36).slice(2, 5)}`,
      nodes: a.nodes,
      reliability: a.reliability,
    })
    navigate(`/automation/workflows/${copy.id}/builder`)
  }

  const allColumns: Array<Column<Automation>> = [
    {
      key: 'name',
      header: 'Name',
      minWidth: 260,
      pinned: true,
      sortValue: (a) => a.name,
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate text-body-13 font-semibold text-text">{a.name}</p>
          <p className="truncate text-body-12 text-text-secondary">{a.description}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      sortValue: (a) => a.status,
      cell: (a) => <AutomationStatusBadge status={a.status} />,
    },
    {
      key: 'version',
      header: 'Version',
      width: 90,
      align: 'center',
      sortValue: (a) => a.version,
      cell: (a) => <VersionBadge version={a.version} />,
    },
    {
      key: 'trigger',
      header: 'Trigger',
      minWidth: 240,
      sortValue: (a) => TRIGGERS[triggerOf(a)].label,
      cell: (a) => (
        <div className="min-w-0">
          <p className="truncate text-body-13 text-text">{TRIGGERS[triggerOf(a)].label}</p>
          <p className="truncate text-body-12 text-text-secondary">{TRIGGERS[triggerOf(a)].runsWhen}</p>
        </div>
      ),
    },
    {
      key: 'conditions',
      header: 'Conditions',
      width: 100,
      align: 'right',
      sortValue: (a) => conditionCount(a.nodes),
      accessor: (a) => formatNumber(conditionCount(a.nodes)),
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 90,
      align: 'right',
      sortValue: (a) => actionCount(a.nodes),
      accessor: (a) => formatNumber(actionCount(a.nodes)),
    },
    {
      key: 'runs',
      header: 'Runs (7d)',
      width: 110,
      align: 'right',
      sortValue: (a) => a.stats.runs7d,
      accessor: (a) => formatNumber(a.stats.runs7d),
    },
    {
      key: 'success',
      header: 'Success rate',
      width: 130,
      align: 'right',
      sortValue: (a) => a.stats.successRate,
      cell: (a) =>
        a.stats.runs7d === 0 ? (
          <span className="text-body-13 text-text-secondary">No runs</span>
        ) : (
          <span className={`tabular-nums ${a.stats.successRate < 95 ? 'text-warning-text' : 'text-text'}`}>
            {formatPercent(a.stats.successRate)}
          </span>
        ),
    },
    {
      key: 'exceptions',
      header: 'Open exceptions',
      width: 140,
      align: 'right',
      sortValue: (a) => failureCounts.get(a.id) ?? 0,
      cell: (a) => {
        const n = failureCounts.get(a.id) ?? 0
        return n === 0 ? (
          <span className="text-body-13 text-text-secondary">None</span>
        ) : (
          <Badge tone="danger" variant="subtle" size="sm">
            {n} open
          </Badge>
        )
      },
    },
    {
      key: 'lastRun',
      header: 'Last run',
      width: 170,
      sortValue: (a) => a.stats.lastRunAt ?? '',
      accessor: (a) => (a.stats.lastRunAt ? formatDateTime(a.stats.lastRunAt) : 'Never'),
    },
    {
      key: 'editedBy',
      header: 'Last edited by',
      width: 160,
      sortValue: (a) => userName(a.updatedBy),
      accessor: (a) => userName(a.updatedBy),
    },
    {
      key: 'owner',
      header: 'Owner',
      width: 160,
      sortValue: (a) => userName(a.ownerUserId),
      accessor: (a) => userName(a.ownerUserId),
    },
    {
      key: 'modules',
      header: 'Modules touched',
      minWidth: 200,
      sortValue: (a) => a.modulesTouched.join(', '),
      cell: (a) => (
        <div className="flex flex-wrap gap-1">
          {a.modulesTouched.map((m) => (
            <Badge key={m} tone="neutral" variant="outline" size="sm">
              {m}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: 'row-actions',
      header: '',
      width: 56,
      align: 'right',
      cell: (a) => (
        <Popover
          role="menu"
          content={
            <>
              <PopoverItem icon={<SquarePen size={16} />} onClick={() => navigate(`/automation/workflows/${a.id}/builder`)}>
                Edit
              </PopoverItem>
              {a.status === 'active' && (
                <PopoverItem icon={<Pause size={16} />} onClick={() => setAutomationStatus(a, 'paused')}>
                  Pause
                </PopoverItem>
              )}
              {a.status === 'paused' && (
                <PopoverItem icon={<Play size={16} />} onClick={() => setAutomationStatus(a, 'active')}>
                  Resume
                </PopoverItem>
              )}
              <PopoverItem icon={<Copy size={16} />} onClick={() => duplicate(a)}>
                Duplicate
              </PopoverItem>
              <PopoverItem icon={<History size={16} />} onClick={() => setHistoryKey(a.automationKey)}>
                Version history
              </PopoverItem>
              <PopoverItem icon={<Archive size={16} />} destructive onClick={() => setArchiving(a)}>
                Disable
              </PopoverItem>
            </>
          }
        >
          <button
            type="button"
            aria-label={`Actions for ${a.name}`}
            onClick={(e) => e.stopPropagation()}
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <MoreHorizontal size={16} aria-hidden="true" />
          </button>
        </Popover>
      ),
    },
  ]

  const columnsByKey = new Map(allColumns.map((c) => [c.key, c]))
  const columns = visible.map((key) => columnsByKey.get(key)).filter((c): c is Column<Automation> => Boolean(c))

  const historyVersions = historyKey ? versionsOf(historyKey) : []

  return (
    <>
      <ModulePage
        tab="workflows"
        title="Workflows"
        description="Every automation, at its current version. Pause and resume take effect immediately."
        actions={
          <Button onClick={newAutomation} leftIcon={<Plus size={16} />}>
            New automation
          </Button>
        }
      />

      <Screen>
        <div className="flex flex-col gap-4">
          {errored && <LoadFailed what="Workflows" onRetry={retry} />}

          <Card padding="none">
            <TableToolbar
              actions={
                <ColumnPicker
                  catalogue={COLUMN_CATALOGUE}
                  visible={visible}
                  defaultKeys={defaultKeys}
                  onChange={setVisible}
                />
              }
            >
              <FilterBar
                search={search}
                onSearchChange={(v) => setParam('q', v || undefined)}
                searchPlaceholder="Search by name or description"
                values={values}
                onFilterChange={setParam}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    options: (['active', 'paused', 'draft', 'archived'] as const).map((s) => ({
                      value: s,
                      label: AUTOMATION_STATUS_LABEL[s],
                    })),
                  },
                  {
                    key: 'trigger',
                    label: 'Trigger',
                    options: Object.entries(TRIGGERS).map(([value, meta]) => ({ value, label: meta.label })),
                  },
                  { key: 'module', label: 'Module', options: ALL_MODULES.map((m) => ({ value: m, label: m })) },
                  { key: 'owner', label: 'Owner', options: owners },
                  {
                    key: 'failures',
                    label: 'Failures',
                    options: [{ value: 'yes', label: 'Has open exceptions' }],
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
                rowKey={(a) => a.id}
                aria-label="Automations"
                defaultSort={{ key: 'runs', direction: 'desc' }}
                onRowClick={(a) => navigate(`/automation/workflows/${a.id}/builder`)}
                empty={
                  filtersActive ? (
                    <EmptyState
                      variant="search"
                      title="No automations match these filters"
                      message="Nothing here fits the current status, trigger, module or owner."
                      action={
                        <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Workflow}
                      title="No automations yet"
                      message="Nothing happens on its own until one exists. Every receipt, every commission calculation and every welcome message would have to be done by hand."
                      action={
                        <Button onClick={newAutomation} leftIcon={<Plus size={16} />}>
                          New automation
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

      <Drawer
        open={historyKey !== null}
        onClose={() => setHistoryKey(null)}
        size="lg"
        title="Version history"
        description="Every version ever activated. None is deleted, because runs point at them."
      >
        <ul className="flex flex-col gap-3">
          {historyVersions.map((v) => (
            <li key={v.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <VersionBadge version={v.version} size="md" />
                  <AutomationStatusBadge status={v.status} />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setHistoryKey(null)
                    navigate(`/automation/workflows/${v.id}/builder`)
                  }}
                >
                  Open v{v.version}
                </Button>
              </div>
              <KeyValueList columns={2} className="mt-3">
                <KeyValue label="Nodes">{v.nodes.length}</KeyValue>
                <KeyValue label="Runs recorded">{formatNumber(runCounts.get(v.automationKey) ?? 0)}</KeyValue>
                <KeyValue label="Edited">{formatDateTime(v.updatedAt)}</KeyValue>
                <KeyValue label="By">{userName(v.updatedBy)}</KeyValue>
                <KeyValue label="Supersedes">
                  {v.supersedesVersionId ? `v${v.version - 1}` : 'Nothing — this was the first version'}
                </KeyValue>
                <KeyValue label="Retry policy">{retrySentence(v.reliability)}</KeyValue>
              </KeyValueList>
            </li>
          ))}
        </ul>
      </Drawer>

      <ConfirmDialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        onConfirm={() => {
          if (archiving) setAutomationStatus(archiving, 'archived')
          setArchiving(null)
        }}
        destructive
        title="Disable this automation"
        confirmLabel="Disable"
      >
        <p className="text-body-14 text-text">
          {archiving?.name} stops creating runs from now on. It is not deleted: the definition stays readable and
          every run it already produced keeps its trace, so nothing in the history becomes unexplainable.
        </p>
      </ConfirmDialog>
    </>
  )
}
