import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  FlaskConical,
  GitBranch,
  Hand,
  MousePointerClick,
  Plus,
  Save,
  SlidersHorizontal,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react'

import {
  approvalRoutesCollection,
  automationRunsCollection,
  automationsCollection,
  branchesCollection,
  cohortsCollection,
  commissionRulesCollection,
  documentTemplatesCollection,
  messageTemplatesCollection,
  useCollection,
} from '@/mocks'
import type {
  Automation,
  AutomationActionType,
  AutomationNode,
  AutomationTriggerType,
  ConditionGroup,
} from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Field,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  PageHeader,
  Popover,
  PopoverItem,
  PopoverLabel,
  Radio,
  RadioGroup,
  SectionHeader,
  Select,
  SkeletonCard,
  Switch,
  Textarea,
} from '@/ui'
import { formatDateTime } from '@/lib/format'

import { ConditionEditor } from './ConditionEditor'
import { TestRunModal } from './TestRun'
import {
  ACTIONS,
  ACTION_GROUPS,
  ACTION_ORDER,
  CHANNEL_LABEL,
  IDEMPOTENCY_FIELDS,
  NODE_LABEL,
  NODE_STYLE,
  ON_FAILURE_LABEL,
  RECIPIENT_OPTIONS,
  TRIGGERS,
  TRIGGER_CATEGORIES,
  actionSummary,
  branchName,
  conditionCount,
  delaySummary,
  emptyGroup,
  fieldsForTrigger,
  groupText,
  idempotencyPreview,
  laneChildIds,
  nextNodeId,
  nodeSummary,
  nodeTitle,
  planEnglishSummary,
  slugify,
  userName,
  validate,
  versionsOf,
  type FieldMeta,
  type Issue,
} from './lib'
import { AutomationStatusBadge, KeyChip, LoadFailed, NodeKindBadge, Screen, VersionBadge, useScreenState } from './parts'
import { renderTemplatePreview, testSubjects } from './simulate'
import { activate, createAutomation, saveDraft, setAutomationStatus, type DraftShape } from './writes'

const BLANK_TRIGGER: AutomationNode = {
  id: 'n1',
  kind: 'trigger',
  triggerType: 'lead_created',
  params: {},
  summary: '',
}

function blankDraft(): DraftShape {
  return {
    name: '',
    description: '',
    automationKey: '',
    nodes: [BLANK_TRIGGER],
    reliability: {
      idempotencyKeyFields: ['person.id'],
      retryAttempts: 3,
      retryBackoff: 'exponential',
      onFailure: 'retry_then_exception',
      maxRunsPerPersonPerPeriod: null,
    },
  }
}

function draftFrom(a: Automation): DraftShape {
  return {
    name: a.name,
    description: a.description,
    automationKey: a.automationKey,
    nodes: a.nodes,
    reliability: a.reliability,
  }
}

export default function Builder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const automations = useCollection(automationsCollection)
  const runs = useCollection(automationRunsCollection)
  const { loading, errored, retry } = useScreenState('automation:builder')

  const record = id ? automations.find((a) => a.id === id) : undefined

  const [draft, setDraft] = useState<DraftShape>(() => (record ? draftFrom(record) : blankDraft()))
  const [selectedId, setSelectedId] = useState<string>('n1')
  const [dirty, setDirty] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [activateOpen, setActivateOpen] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [showIssues, setShowIssues] = useState(false)
  const loadedFor = useRef<string | null>(record?.id ?? null)

  useEffect(() => {
    if (record && loadedFor.current !== record.id) {
      loadedFor.current = record.id
      setDraft(draftFrom(record))
      setSelectedId(record.nodes[0]?.id ?? 'n1')
      setDirty(false)
    }
  }, [record])

  const runCount = useMemo(
    () => (record ? runs.filter((r) => r.automationId === record.id).length : 0),
    [runs, record],
  )
  const versions = record ? versionsOf(record.automationKey) : []
  const issues = validate(draft.name, draft.nodes)
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')

  const patch = (next: Partial<DraftShape>) => {
    setDraft((d) => ({ ...d, ...next }))
    setDirty(true)
    setSaveNote(null)
  }

  const setNodes = (nodes: AutomationNode[]) => patch({ nodes })

  const updateNode = (nodeId: string, updater: (node: AutomationNode) => AutomationNode) =>
    setNodes(draft.nodes.map((n) => (n.id === nodeId ? updater(n) : n)))

  const addNode = (kind: AutomationNode['kind'], actionType?: AutomationActionType, laneOf?: { branchId: string; lane: number }) => {
    const nodeId = nextNodeId(draft.nodes)
    let node: AutomationNode
    switch (kind) {
      case 'condition':
        node = { id: nodeId, kind: 'condition', group: emptyGroup('and'), summary: '' }
        break
      case 'delay':
        node = {
          id: nodeId,
          kind: 'delay',
          wait: { amount: 1, unit: 'days' },
          workingHoursOnly: false,
          summary: '',
        }
        break
      case 'branch':
        node = {
          id: nodeId,
          kind: 'branch',
          label: 'Which way does this record go?',
          lanes: [
            { label: 'If this is true', condition: emptyGroup('and'), nodeIds: [] },
            { label: 'Otherwise', condition: null, nodeIds: [] },
          ],
        }
        break
      case 'stop':
        node = { id: nodeId, kind: 'stop', condition: emptyGroup('or'), summary: '' }
        break
      case 'trigger':
        node = { ...BLANK_TRIGGER, id: nodeId }
        break
      default:
        node = {
          id: nodeId,
          kind: 'action',
          actionType: actionType ?? 'send_message',
          params: actionType === 'calculate_commission' ? { scope: 'all_rules_in_force' } : {},
          summary: '',
        }
    }

    let nodes = [...draft.nodes, node]
    if (laneOf) {
      nodes = nodes.map((n) =>
        n.id === laneOf.branchId && n.kind === 'branch'
          ? {
              ...n,
              lanes: n.lanes.map((lane, i) =>
                i === laneOf.lane ? { ...lane, nodeIds: [...lane.nodeIds, nodeId] } : lane,
              ),
            }
          : n,
      )
    }
    setNodes(nodes)
    setSelectedId(nodeId)
  }

  const removeNode = (nodeId: string) => {
    const nodes = draft.nodes
      .filter((n) => n.id !== nodeId)
      .map((n) =>
        n.kind === 'branch'
          ? { ...n, lanes: n.lanes.map((lane) => ({ ...lane, nodeIds: lane.nodeIds.filter((x) => x !== nodeId) })) }
          : n,
      )
    setNodes(nodes)
    if (selectedId === nodeId) setSelectedId(nodes[0]?.id ?? '')
  }

  const duplicateNode = (nodeId: string) => {
    const source = draft.nodes.find((n) => n.id === nodeId)
    if (!source) return
    const newId = nextNodeId(draft.nodes)
    const copy = JSON.parse(JSON.stringify({ ...source, id: newId })) as AutomationNode
    const index = draft.nodes.findIndex((n) => n.id === nodeId)
    const nodes = [...draft.nodes.slice(0, index + 1), copy, ...draft.nodes.slice(index + 1)]
    setNodes(nodes)
    setSelectedId(newId)
  }

  const moveNode = (nodeId: string, delta: -1 | 1) => {
    const nested = laneChildIds(draft.nodes)
    const order = draft.nodes.map((n) => n.id)
    const index = order.indexOf(nodeId)
    let target = index + delta
    while (target >= 0 && target < order.length && nested.has(order[target])) target += delta
    if (target < 0 || target >= order.length) return
    const nodes = [...draft.nodes]
    const [moved] = nodes.splice(index, 1)
    nodes.splice(target, 0, moved)
    setNodes(nodes)
  }

  const onSave = () => {
    if (errors.length) {
      setShowIssues(true)
      return
    }
    const key = draft.automationKey || slugify(draft.name)
    if (!record) {
      const created = createAutomation({ ...draft, automationKey: key })
      setDirty(false)
      setSaveNote(`Saved as ${created.name} v1, draft.`)
      navigate(`/automation/workflows/${created.id}/builder`, { replace: true })
      return
    }
    const { automation, newVersion } = saveDraft(record, { ...draft, automationKey: key })
    setDirty(false)
    setSaveNote(
      newVersion
        ? `v${record.version} was left exactly as it ran. Your edits are saved as v${automation.version}, draft.`
        : `Saved. Still v${automation.version}, draft.`,
    )
    if (newVersion) navigate(`/automation/workflows/${automation.id}/builder`, { replace: true })
  }

  const onActivate = () => {
    if (!record) return
    activate(record)
    setActivateOpen(false)
    setSaveNote(`v${record.version} is live. Nothing that already ran was touched.`)
  }

  const selected = draft.nodes.find((n) => n.id === selectedId)
  const subjects = useMemo(() => testSubjects(6), [])
  const sampleSubject = subjects[0]
  const triggerNode = draft.nodes.find((n): n is Extract<AutomationNode, { kind: 'trigger' }> => n.kind === 'trigger')
  const scopedFields = useMemo(
    () => fieldsForTrigger(triggerNode?.summary ? triggerNode.triggerType : undefined),
    [triggerNode?.summary, triggerNode?.triggerType],
  )

  if (errored) {
    return (
      <>
        <PageHeader title="Automation builder" breadcrumbs={BREADCRUMBS} />
        <Screen>
          <LoadFailed what="The automation" onRetry={retry} />
        </Screen>
      </>
    )
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Automation builder" breadcrumbs={BREADCRUMBS} />
        <Screen wide>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[220px_minmax(0,1fr)_380px]">
            <SkeletonCard />
            <div className="flex flex-col gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            <SkeletonCard />
          </div>
        </Screen>
      </>
    )
  }

  if (id && !record) {
    return (
      <>
        <PageHeader title="Automation builder" breadcrumbs={BREADCRUMBS} />
        <Screen>
          <Alert
            tone="warning"
            title="That automation version no longer exists"
            action={
              <Button size="sm" variant="secondary" onClick={() => navigate('/automation/workflows')}>
                Back to workflows
              </Button>
            }
          >
            Versions are never deleted, so this is usually a stale link. Open the workflow list and pick the current
            version.
          </Alert>
        </Screen>
      </>
    )
  }

  const editingLive = Boolean(record && record.status !== 'draft')

  return (
    <>
      <PageHeader
        breadcrumbs={BREADCRUMBS}
        title={
          <Input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value })}
            aria-label="Automation name"
            placeholder="Name this automation"
            inputSize="lg"
            containerClassName="max-w-[560px]"
          />
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {!record && (
              <Badge tone="neutral" variant="subtle" size="sm">
                Not saved yet
              </Badge>
            )}
            {record && dirty && (
              <Badge tone="warning" variant="subtle" size="sm">
                Unsaved changes
              </Badge>
            )}
            {record && !dirty && <AutomationStatusBadge status={record.status} />}
            {record && <VersionBadge version={record.version} />}
            {record && (
              <span className="text-body-12 text-text-secondary">
                Last edited {formatDateTime(record.updatedAt)} by {userName(record.updatedBy)}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              {record && record.status !== 'draft' && (
                <Button
                  variant="secondary"
                  onClick={() => setAutomationStatus(record, record.status === 'active' ? 'paused' : 'active')}
                  leftIcon={<Hand size={16} />}
                >
                  {record.status === 'active' ? 'Pause' : 'Resume'}
                </Button>
              )}
              <Button variant="secondary" onClick={() => setTestOpen(true)} leftIcon={<FlaskConical size={16} />}>
                Test run
              </Button>
              <Button variant="secondary" onClick={onSave} leftIcon={<Save size={16} />}>
                Save draft
              </Button>
              <Button
                onClick={() => setActivateOpen(true)}
                disabled={!record || record.status === 'active' || errors.length > 0}
                leftIcon={<Zap size={16} />}
              >
                Activate
              </Button>
            </div>
            {errors.length > 0 && (
              <p className="max-w-[360px] text-right text-body-12 text-text-secondary">
                Before this can go live: {errors.map((issue) => issue.message).join(' ')}
              </p>
            )}
          </div>
        }
      />

      <Screen wide>
        <div className="flex flex-col gap-4">
          <Card padding="tight" className="bg-accent-subtle">
            <p className="text-body-14 text-text">
              <span className="font-semibold">In plain terms — </span>
              {planEnglishSummary(draft.nodes)}
            </p>
          </Card>

          {saveNote && (
            <Alert tone="success" title="Saved" onDismiss={() => setSaveNote(null)}>
              {saveNote}
            </Alert>
          )}

          {editingLive && (
            <Alert tone="info" title={`This is v${record?.version}, which has ${runCount} run(s) against it`}>
              Editing does not rewrite it. Saving creates v{(record?.version ?? 1) + 1} as a draft, and every run
              already recorded keeps pointing at the version that produced it.
            </Alert>
          )}

          {showIssues && errors.length > 0 && (
            <Alert tone="danger" title="This automation cannot be saved yet" onDismiss={() => setShowIssues(false)}>
              <ul className="mt-1 flex list-disc flex-col gap-1 pl-4">
                {errors.map((issue) => (
                  <li key={issue.id}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[210px_minmax(0,1fr)_380px]">
            <Palette onAdd={addNode} />

            <Canvas
              nodes={draft.nodes}
              selectedId={selectedId}
              issues={issues}
              onSelect={setSelectedId}
              onAdd={addNode}
              onRemove={removeNode}
              onDuplicate={duplicateNode}
              onMove={moveNode}
              onTriggerChange={(triggerType) =>
                updateNode(triggerNode?.id ?? 'n1', (n) =>
                  n.kind === 'trigger' ? { ...n, triggerType, summary: TRIGGERS[triggerType].runsWhen } : n,
                )
              }
            />

            <div className="flex flex-col gap-4 xl:sticky xl:top-6">
              <Inspector node={selected} onChange={updateNode} sampleSubjectId={sampleSubject?.id} fields={scopedFields} />
              <ReliabilityPanel
                draft={draft}
                onChange={(reliability) => patch({ reliability })}
                automationKey={draft.automationKey || slugify(draft.name)}
              />
              {warnings.length > 0 && (
                <Card padding="tight">
                  <SectionHeader title="Warnings" size="sm" count={warnings.length} />
                  <ul className="mt-2 flex flex-col gap-2">
                    {warnings.map((issue) => (
                      <li key={issue.id} className="flex gap-2 text-body-12 text-text-secondary">
                        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning-500" aria-hidden="true" />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {versions.length > 1 && (
                <Card padding="tight">
                  <SectionHeader title="Versions" size="sm" count={versions.length} />
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => navigate(`/automation/workflows/${v.id}/builder`)}
                          className="rounded-lg text-body-13 text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          v{v.version}
                        </button>
                        <AutomationStatusBadge status={v.status} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-body-12 text-text-secondary">
                    Nothing is deleted. A superseded version stays readable so its runs can still be explained.
                  </p>
                </Card>
              )}
            </div>
          </div>
        </div>
      </Screen>

      <TestRunModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        name={draft.name}
        automationKey={draft.automationKey || slugify(draft.name)}
        nodes={draft.nodes}
        reliability={draft.reliability}
      />

      <ConfirmDialog
        open={activateOpen}
        onClose={() => setActivateOpen(false)}
        onConfirm={onActivate}
        title={`Activating creates v${record?.version ?? 1}`}
        confirmLabel="Activate"
        icon={Zap}
      >
        <p className="text-body-14 text-text">
          Runs already in flight continue on v{Math.max(1, (record?.version ?? 1) - 1)}. Historical runs are never
          rewritten — a run recorded against an earlier version keeps that version and its trace forever.
        </p>
        <p className="mt-2 text-body-13 text-text-secondary">
          New triggers from this moment on will execute v{record?.version ?? 1}.
        </p>
      </ConfirmDialog>
    </>
  )
}

const BREADCRUMBS = [
  { label: 'Automation', to: '/automation' },
  { label: 'Workflows', to: '/automation/workflows' },
  { label: 'Builder' },
]

const STEP_CAPTION: Record<'condition' | 'delay' | 'branch' | 'stop', string> = {
  condition: 'Skip the rest below for anyone who doesn’t match',
  delay: 'Pause before continuing',
  branch: 'Send different people down different paths',
  stop: 'End the automation entirely for anyone who matches',
}

function Palette({
  onAdd,
}: {
  onAdd: (kind: AutomationNode['kind'], actionType?: AutomationActionType) => void
}) {
  return (
    <Card padding="tight">
      <SectionHeader title="Add a step" size="sm" />
      <ul className="mt-3 flex flex-col gap-1.5">
        {(
          [
            ['condition', 'Only if', SlidersHorizontal],
            ['delay', 'Wait', Timer],
            ['branch', 'Split into paths', GitBranch],
            ['stop', 'Stop when', Hand],
          ] as const
        ).map(([kind, label, Icon]) => (
          <li key={kind}>
            <button
              type="button"
              onClick={() => onAdd(kind)}
              className="flex w-full items-start gap-2 rounded-lg border border-border px-2.5 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md ${NODE_STYLE[kind].chip}`}>
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-body-13 text-text">{label}</span>
                <span className="block text-body-12 text-text-secondary">{STEP_CAPTION[kind]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {ACTION_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mt-4 text-label-11 uppercase tracking-wide text-text-label">{group.label}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {group.actions.map((type) => (
              <li key={type}>
                <button
                  type="button"
                  onClick={() => onAdd('action', type)}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-body-13 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Plus size={14} aria-hidden="true" />
                  {ACTIONS[type].label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Card>
  )
}

interface CanvasProps {
  nodes: AutomationNode[]
  selectedId: string
  issues: Issue[]
  onSelect: (id: string) => void
  onAdd: (
    kind: AutomationNode['kind'],
    actionType?: AutomationActionType,
    laneOf?: { branchId: string; lane: number },
  ) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onMove: (id: string, delta: -1 | 1) => void
  onTriggerChange: (triggerType: AutomationTriggerType) => void
}

function Canvas({ nodes, selectedId, issues, onSelect, onAdd, onRemove, onDuplicate, onMove, onTriggerChange }: CanvasProps) {
  const nested = laneChildIds(nodes)
  const top = nodes.filter((n) => !nested.has(n.id))
  const byId = new Map(nodes.map((n) => [n.id, n]))

  return (
    <div className="flex flex-col">
      <ol className="flex flex-col">
        {top.map((node, index) => (
          <li key={node.id} className="flex flex-col">
            <NodeCard
              node={node}
              selected={node.id === selectedId}
              issues={issues.filter((i) => i.nodeId === node.id)}
              onSelect={() => onSelect(node.id)}
              onRemove={node.kind === 'trigger' ? undefined : () => onRemove(node.id)}
              onDuplicate={node.kind === 'trigger' ? undefined : () => onDuplicate(node.id)}
              onMoveUp={index > 0 ? () => onMove(node.id, -1) : undefined}
              onMoveDown={index < top.length - 1 ? () => onMove(node.id, 1) : undefined}
              onTriggerChange={node.kind === 'trigger' ? onTriggerChange : undefined}
            />

            {node.kind === 'branch' && (
              <div className="ml-6 grid grid-cols-1 gap-4 border-l-2 border-info-line pl-6 md:grid-cols-2">
                {node.lanes.map((lane, laneIndex) => (
                  <div key={lane.label + laneIndex} className="rounded-xl border border-border bg-surface-sunken p-3">
                    <p className="text-label-11 uppercase tracking-wide text-text-label">Lane {laneIndex + 1}</p>
                    <p className="mt-0.5 text-body-13 font-semibold text-text">{lane.label}</p>
                    <p className="mt-1 text-body-12 text-text-secondary">
                      {lane.condition ? groupText(lane.condition) : 'Everything that did not take the first lane'}
                    </p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {lane.nodeIds.map((childId) => {
                        const child = byId.get(childId)
                        if (!child) return null
                        return (
                          <li key={childId}>
                            <NodeCard
                              compact
                              node={child}
                              selected={child.id === selectedId}
                              issues={issues.filter((i) => i.nodeId === child.id)}
                              onSelect={() => onSelect(child.id)}
                              onRemove={() => onRemove(child.id)}
                            />
                          </li>
                        )
                      })}
                    </ul>
                    <AddInLane branchId={node.id} lane={laneIndex} onAdd={onAdd} />
                  </div>
                ))}
              </div>
            )}

            <Connector onAdd={onAdd} last={index === top.length - 1} />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Connector({
  onAdd,
  last,
}: {
  onAdd: (kind: AutomationNode['kind'], actionType?: AutomationActionType) => void
  last: boolean
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-center py-1">
      <span className={`w-px ${last ? 'h-3' : 'h-3'} bg-border-strong`} aria-hidden="true" />
      <Popover
        role="menu"
        open={open}
        onOpenChange={setOpen}
        content={
          <>
            <PopoverLabel>Insert a step here</PopoverLabel>
            {(
              [
                ['condition', 'Only if'],
                ['delay', 'Wait'],
                ['branch', 'Split into paths'],
                ['stop', 'Stop when'],
              ] as const
            ).map(([kind, label]) => (
              <PopoverItem
                key={kind}
                onClick={() => {
                  onAdd(kind)
                  setOpen(false)
                }}
              >
                {label}
              </PopoverItem>
            ))}
            <PopoverLabel>Actions</PopoverLabel>
            {ACTION_ORDER.slice(0, 6).map((type) => (
              <PopoverItem
                key={type}
                onClick={() => {
                  onAdd('action', type)
                  setOpen(false)
                }}
              >
                {ACTIONS[type].label}
              </PopoverItem>
            ))}
          </>
        }
      >
        <button
          type="button"
          aria-label="Insert a step here"
          className="flex size-6 items-center justify-center rounded-full border border-border-strong bg-surface text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus size={14} aria-hidden="true" />
        </button>
      </Popover>
      <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
    </div>
  )
}

function AddInLane({
  branchId,
  lane,
  onAdd,
}: {
  branchId: string
  lane: number
  onAdd: (
    kind: AutomationNode['kind'],
    actionType?: AutomationActionType,
    laneOf?: { branchId: string; lane: number },
  ) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3">
      <Popover
        role="menu"
        open={open}
        onOpenChange={setOpen}
        content={
          <>
            <PopoverLabel>Add an action to this lane</PopoverLabel>
            {ACTION_ORDER.slice(0, 8).map((type) => (
              <PopoverItem
                key={type}
                onClick={() => {
                  onAdd('action', type, { branchId, lane })
                  setOpen(false)
                }}
              >
                {ACTIONS[type].label}
              </PopoverItem>
            ))}
          </>
        }
      >
        <Button size="sm" variant="ghost" leftIcon={<Plus size={14} />}>
          Add to this lane
        </Button>
      </Popover>
    </div>
  )
}

function NodeCard({
  node,
  selected,
  issues,
  compact,
  onSelect,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onTriggerChange,
}: {
  node: AutomationNode
  selected: boolean
  issues: Issue[]
  compact?: boolean
  onSelect: () => void
  onRemove?: () => void
  onDuplicate?: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onTriggerChange?: (triggerType: AutomationTriggerType) => void
}) {
  const style = NODE_STYLE[node.kind]
  const unchosen = node.kind === 'trigger' && !node.summary
  const hasError = issues.some((i) => i.severity === 'error')

  return (
    <div
      className={`relative flex flex-col gap-3 overflow-hidden rounded-xl border bg-surface p-4 transition-colors ${
        selected ? 'border-accent shadow-sm' : 'border-border hover:border-border-strong'
      } ${compact ? 'p-3' : ''}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.rail}`} aria-hidden="true" />

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex flex-wrap items-center gap-2">
            <NodeKindBadge kind={node.kind} />
            <span className="text-body-14 font-semibold text-text">
              {unchosen ? 'Choose what starts this automation' : nodeTitle(node)}
            </span>
            {hasError && (
              <Badge tone="danger" variant="subtle" size="sm">
                Needs attention
              </Badge>
            )}
          </span>
          {!unchosen && <span className="mt-1 block text-body-13 text-text-secondary">{nodeSummary(node)}</span>}
        </button>

        <div className="flex shrink-0 items-center gap-0.5">
          {onMoveUp && <IconButton icon={ArrowUp} label={`Move ${NODE_LABEL[node.kind]} up`} variant="ghost" size="sm" onClick={onMoveUp} />}
          {onMoveDown && <IconButton icon={ArrowDown} label={`Move ${NODE_LABEL[node.kind]} down`} variant="ghost" size="sm" onClick={onMoveDown} />}
          {onDuplicate && <IconButton icon={Copy} label={`Duplicate ${NODE_LABEL[node.kind]}`} variant="ghost" size="sm" onClick={onDuplicate} />}
          {onRemove && <IconButton icon={Trash2} label={`Remove ${NODE_LABEL[node.kind]}`} variant="ghost" size="sm" onClick={onRemove} />}
        </div>
      </div>

      {node.kind === 'trigger' && onTriggerChange && (
        <Select
          selectSize="sm"
          value={node.summary ? node.triggerType : ''}
          placeholder="Choose an event"
          aria-label="What starts this automation"
          onChange={(e) => onTriggerChange(e.target.value as AutomationTriggerType)}
        >
          {TRIGGER_CATEGORIES.map((category) => (
            <optgroup key={category} label={category}>
              {(Object.keys(TRIGGERS) as AutomationTriggerType[])
                .filter((t) => TRIGGERS[t].category === category)
                .map((t) => (
                  <option key={t} value={t}>
                    {TRIGGERS[t].label}
                  </option>
                ))}
            </optgroup>
          ))}
        </Select>
      )}
    </div>
  )
}

function Inspector({
  node,
  onChange,
  sampleSubjectId,
  fields,
}: {
  node: AutomationNode | undefined
  onChange: (id: string, updater: (node: AutomationNode) => AutomationNode) => void
  sampleSubjectId: string | undefined
  fields: FieldMeta[]
}) {
  if (!node) {
    return (
      <Card padding="tight">
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <MousePointerClick size={20} className="text-text-secondary" aria-hidden="true" />
          <p className="text-body-13 text-text-secondary">Select a node on the canvas to configure it.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card padding="none">
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <NodeKindBadge kind={node.kind} />
            {nodeTitle(node)}
          </span>
        }
        description={NODE_LABEL[node.kind]}
      />
      <CardBody>
        {node.kind === 'trigger' && <TriggerInspector node={node} onChange={onChange} />}
        {node.kind === 'condition' && (
          <ConditionEditor
            group={node.group}
            fields={fields}
            onChange={(group) =>
              onChange(node.id, (n) => (n.kind === 'condition' ? { ...n, group, summary: groupText(group) } : n))
            }
          />
        )}
        {node.kind === 'delay' && <DelayInspector node={node} onChange={onChange} fields={fields} />}
        {node.kind === 'branch' && <BranchInspector node={node} onChange={onChange} fields={fields} />}
        {node.kind === 'action' && (
          <ActionInspector node={node} onChange={onChange} sampleSubjectId={sampleSubjectId} />
        )}
        {node.kind === 'stop' && <StopInspector node={node} onChange={onChange} fields={fields} />}
      </CardBody>
    </Card>
  )
}

type Updater = (id: string, updater: (node: AutomationNode) => AutomationNode) => void

function TriggerInspector({
  node,
  onChange,
}: {
  node: Extract<AutomationNode, { kind: 'trigger' }>
  onChange: Updater
}) {
  const meta = TRIGGERS[node.triggerType]
  const setParam = (key: string, value: unknown) =>
    onChange(node.id, (n) => (n.kind === 'trigger' ? { ...n, params: { ...n.params, [key]: value } } : n))

  return (
    <div className="flex flex-col gap-4">
      {node.summary ? (
        <div className="rounded-xl border border-accent-subtle bg-accent-subtle px-3 py-2">
          <p className="text-label-11 uppercase tracking-wide text-accent">Runs when</p>
          <p className="mt-0.5 text-body-13 text-text">{meta.runsWhen}</p>
        </div>
      ) : (
        <p className="text-body-13 text-text-secondary">Choose what starts this automation on the card above.</p>
      )}

      {node.triggerType === 'scheduled' && (
        <>
          <Field label="Frequency">
            <Select
              value={String(node.params.frequency ?? 'daily')}
              onChange={(e) => setParam('frequency', e.target.value)}
              options={[
                { value: 'daily', label: 'Daily at' },
                { value: 'weekly', label: 'Weekly on' },
                { value: 'monthly', label: 'Monthly on' },
              ]}
            />
          </Field>
          <Field label="Time of day">
            <Input
              type="time"
              value={String(node.params.time ?? '08:00')}
              onChange={(e) => setParam('time', e.target.value)}
            />
          </Field>
        </>
      )}

      {node.triggerType === 'tuition_fully_paid' && (
        <Field label="Scope" hint="What counts as fully paid.">
          <Select
            value={String(node.params.scope ?? 'invoice')}
            onChange={(e) => setParam('scope', e.target.value)}
            options={[
              { value: 'invoice', label: 'A single invoice reaches zero' },
              { value: 'admission', label: 'Every invoice on the admission reaches zero' },
            ]}
          />
        </Field>
      )}

      {node.triggerType === 'lead_stage_changed' && (
        <Field label="Changed to stage">
          <Select
            value={String(node.params.toStage ?? '')}
            placeholder="Any stage"
            onChange={(e) => setParam('toStage', e.target.value)}
            options={[
              { value: 'contacted', label: 'Contacted' },
              { value: 'qualified', label: 'Qualified' },
              { value: 'proposal', label: 'Proposal' },
              { value: 'enrolled', label: 'Enrolled' },
              { value: 'lost', label: 'Lost' },
            ]}
          />
        </Field>
      )}

      {node.triggerType === 'invoice_overdue' && (
        <Field label="Days past due" hint="Fires once, this many days after the due date.">
          <Input
            type="number"
            min={0}
            value={String(node.params.daysPastDue ?? 3)}
            onChange={(e) => setParam('daysPastDue', Number(e.target.value))}
          />
        </Field>
      )}
    </div>
  )
}

function DelayInspector({
  node,
  onChange,
  fields,
}: {
  node: Extract<AutomationNode, { kind: 'delay' }>
  onChange: Updater
  fields: FieldMeta[]
}) {
  const mode = 'amount' in node.wait ? 'amount' : 'untilField' in node.wait ? 'field' : 'condition'

  const setWait = (wait: Extract<AutomationNode, { kind: 'delay' }>['wait']) =>
    onChange(node.id, (n) => (n.kind === 'delay' ? { ...n, wait, summary: '' } : n))

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup legend="Wait for">
        <Radio
          name={`delay-${node.id}`}
          label="A fixed amount of time"
          checked={mode === 'amount'}
          onChange={() => setWait({ amount: 1, unit: 'days' })}
        />
        <Radio
          name={`delay-${node.id}`}
          label="A date on the record"
          checked={mode === 'field'}
          onChange={() => setWait({ untilField: 'invoice.dueDate' })}
        />
        <Radio
          name={`delay-${node.id}`}
          label="A condition to become true"
          checked={mode === 'condition'}
          onChange={() => setWait({ untilCondition: emptyGroup('and'), giveUpAfterHours: 48 })}
        />
      </RadioGroup>

      {'amount' in node.wait && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount">
            <Input
              type="number"
              min={1}
              value={String(node.wait.amount)}
              onChange={(e) =>
                setWait({ amount: Number(e.target.value) || 1, unit: (node.wait as { unit: 'minutes' | 'hours' | 'days' }).unit })
              }
            />
          </Field>
          <Field label="Unit">
            <Select
              value={node.wait.unit}
              onChange={(e) =>
                setWait({
                  amount: (node.wait as { amount: number }).amount,
                  unit: e.target.value as 'minutes' | 'hours' | 'days',
                })
              }
              options={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
              ]}
            />
          </Field>
        </div>
      )}

      {'untilField' in node.wait && (
        <Field label="Wait until this date">
          <Select
            value={node.wait.untilField}
            onChange={(e) => setWait({ untilField: e.target.value })}
            options={[
              { value: 'invoice.dueDate', label: 'Invoice due date' },
              { value: 'cohort.startDate', label: 'Cohort start date' },
              { value: 'admission.expectedStartDate', label: 'Expected start date' },
            ]}
          />
        </Field>
      )}

      {'untilCondition' in node.wait && (
        <>
          <ConditionEditor
            group={node.wait.untilCondition}
            fields={fields}
            onChange={(group) =>
              setWait({
                untilCondition: group,
                giveUpAfterHours: (node.wait as { giveUpAfterHours: number }).giveUpAfterHours,
              })
            }
            emptyHint="Without a row here the automation would wait forever. Add at least one."
          />
          <Field label="Give up after (hours)" hint="A wait that never ends is a silent failure, so it always has a timeout.">
            <Input
              type="number"
              min={1}
              value={String(node.wait.giveUpAfterHours)}
              onChange={(e) =>
                setWait({
                  untilCondition: (node.wait as { untilCondition: ConditionGroup }).untilCondition,
                  giveUpAfterHours: Number(e.target.value) || 1,
                })
              }
            />
          </Field>
        </>
      )}

      <Switch
        checked={node.workingHoursOnly}
        onChange={(checked) =>
          onChange(node.id, (n) => (n.kind === 'delay' ? { ...n, workingHoursOnly: checked } : n))
        }
        label="Count working hours only"
        description="08:00 to 17:00, Monday to Friday, Africa/Lagos."
      />

      <p className="rounded-xl border border-border bg-surface-sunken px-3 py-2 text-body-13 text-text">
        {delaySummary(node)}
      </p>
    </div>
  )
}

function BranchInspector({
  node,
  onChange,
  fields,
}: {
  node: Extract<AutomationNode, { kind: 'branch' }>
  onChange: Updater
  fields: FieldMeta[]
}) {
  const setLane = (index: number, patch: Partial<(typeof node.lanes)[number]>) =>
    onChange(node.id, (n) =>
      n.kind === 'branch' ? { ...n, lanes: n.lanes.map((lane, i) => (i === index ? { ...lane, ...patch } : lane)) } : n,
    )

  return (
    <div className="flex flex-col gap-5">
      <Field label="Branch question" hint="Shown on the canvas above the two lanes.">
        <Input value={node.label} onChange={(e) => onChange(node.id, (n) => (n.kind === 'branch' ? { ...n, label: e.target.value } : n))} />
      </Field>

      {node.lanes.map((lane, index) => (
        <div key={index} className="rounded-xl border border-border p-3">
          <Field label={`Lane ${index + 1} label`}>
            <Input value={lane.label} onChange={(e) => setLane(index, { label: e.target.value })} />
          </Field>
          <div className="mt-3">
            {lane.condition ? (
              <ConditionEditor group={lane.condition} fields={fields} onChange={(group) => setLane(index, { condition: group })} />
            ) : (
              <p className="text-body-13 text-text-secondary">
                This is the fallback lane. Anything that did not match an earlier lane comes here.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function StopInspector({
  node,
  onChange,
  fields,
}: {
  node: Extract<AutomationNode, { kind: 'stop' }>
  onChange: Updater
  fields: FieldMeta[]
}) {
  const presets: Array<{ field: string; op: string; value: unknown; label: string }> = [
    { field: 'admission.status', op: 'is', value: 'withdrawn', label: 'Admission withdrawn' },
    { field: 'person.optedOut', op: 'is', value: true, label: 'Contact opted out' },
    { field: 'enrolment.status', op: 'is', value: 'completed', label: 'Enrolment completed' },
    { field: 'invoice.balance', op: 'is', value: 0, label: 'Payment received in full' },
  ]

  const has = (preset: (typeof presets)[number]) =>
    node.condition.rules.some((r) => !('operator' in r) && r.field === preset.field && String(r.value) === String(preset.value))

  const toggle = (preset: (typeof presets)[number]) =>
    onChange(node.id, (n) => {
      if (n.kind !== 'stop') return n
      const on = has(preset)
      const rules = on
        ? n.condition.rules.filter((r) => 'operator' in r || r.field !== preset.field || String(r.value) !== String(preset.value))
        : [...n.condition.rules, { field: preset.field, op: preset.op, value: preset.value }]
      const condition = { ...n.condition, rules }
      return { ...n, condition, summary: groupText(condition) }
    })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-label-11 uppercase tracking-wide text-text-label">Stop when</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {presets.map((preset) => (
            <li key={preset.label}>
              <Checkbox label={preset.label} checked={has(preset)} onChange={() => toggle(preset)} />
            </li>
          ))}
        </ul>
      </div>

      <ConditionEditor
        group={node.condition}
        fields={fields}
        onChange={(condition) =>
          onChange(node.id, (n) => (n.kind === 'stop' ? { ...n, condition, summary: groupText(condition) } : n))
        }
        emptyHint="No stop condition. The automation will keep running for a person until it reaches the end."
      />

      <p className="rounded-xl border border-danger-line bg-danger-fill px-3 py-2 text-body-13 text-danger-ink">
        This automation stops for a person as soon as: {groupText(node.condition)}.
      </p>
    </div>
  )
}

function ActionInspector({
  node,
  onChange,
  sampleSubjectId,
}: {
  node: Extract<AutomationNode, { kind: 'action' }>
  onChange: Updater
  sampleSubjectId: string | undefined
}) {
  const templates = useCollection(messageTemplatesCollection)
  const rules = useCollection(commissionRulesCollection)
  const docTemplates = useCollection(documentTemplatesCollection)
  const routes = useCollection(approvalRoutesCollection)
  const cohorts = useCollection(cohortsCollection)
  const branches = useCollection(branchesCollection)
  const subjects = useMemo(() => testSubjects(6), [])
  const sample = subjects.find((s) => s.id === sampleSubjectId) ?? subjects[0]

  const setParam = (key: string, value: unknown) =>
    onChange(node.id, (n) =>
      n.kind === 'action' ? { ...n, params: { ...n.params, [key]: value }, summary: '' } : n,
    )

  const setType = (actionType: AutomationActionType) =>
    onChange(node.id, (n) =>
      n.kind === 'action'
        ? {
            ...n,
            actionType,
            params: actionType === 'calculate_commission' ? { scope: 'all_rules_in_force' } : {},
            summary: '',
          }
        : n,
    )

  const template = templates.find((t) => t.id === node.params.templateId)
  const preview = template ? renderTemplatePreview(template.body, sample) : null

  return (
    <div className="flex flex-col gap-4">
      <Field label="Action type">
        <Select value={node.actionType} onChange={(e) => setType(e.target.value as AutomationActionType)}>
          {ACTION_ORDER.map((type) => (
            <option key={type} value={type}>
              {ACTIONS[type].label}
            </option>
          ))}
        </Select>
      </Field>

      <p className="text-body-12 text-text-secondary">{ACTIONS[node.actionType].blurb}</p>

      {node.actionType === 'send_message' && (
        <>
          <Field label="Channel" required>
            <Select
              value={String(node.params.channel ?? '')}
              placeholder="Choose a channel"
              onChange={(e) => setParam('channel', e.target.value)}
              options={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </Field>
          <Field label="Template" required>
            <Select
              value={String(node.params.templateId ?? '')}
              placeholder="Choose a template"
              onChange={(e) => setParam('templateId', e.target.value)}
              options={templates
                .filter((t) => !node.params.channel || t.channel === node.params.channel)
                .map((t) => ({ value: t.id, label: `${t.name} — ${t.category}` }))}
            />
          </Field>
          {template && preview && (
            <div className="rounded-xl border border-border bg-surface-sunken p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-11 uppercase tracking-wide text-text-label">
                  Preview against {sample?.label.split(' · ')[0] ?? 'a sample record'}
                </p>
                {template.whatsappApprovalStatus === 'pending' && (
                  <Badge tone="warning" variant="subtle" size="sm">
                    Template not approved
                  </Badge>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-body-13 text-text">{preview.text}</p>
              {preview.unresolved.length > 0 && (
                <p className="mt-2 text-body-12 text-warning-text">
                  {preview.unresolved.length} merge field(s) did not resolve against this record:{' '}
                  {preview.unresolved.join(', ')}. A blank here is how a message ships broken.
                </p>
              )}
            </div>
          )}
          <Field label="Recipient" required>
            <Select
              value={String(node.params.recipient ?? '')}
              placeholder="Choose a recipient"
              onChange={(e) => setParam('recipient', e.target.value)}
              options={RECIPIENT_OPTIONS}
            />
          </Field>
        </>
      )}

      {node.actionType === 'calculate_commission' && (
        <>
          <RadioGroup legend="Which rules to evaluate">
            <Radio
              name={`comm-${node.id}`}
              label="Evaluate all rules in force"
              description="Referrer, lead owner and closer are evaluated independently. One deal can produce three rows, one, or none."
              checked={node.params.scope !== 'named_rule'}
              onChange={() => setParam('scope', 'all_rules_in_force')}
            />
            <Radio
              name={`comm-${node.id}`}
              label="One named rule"
              checked={node.params.scope === 'named_rule'}
              onChange={() => setParam('scope', 'named_rule')}
            />
          </RadioGroup>
          {node.params.scope === 'named_rule' && (
            <Field label="Rule" hint="The rule version in force on the run date is the one that applies.">
              <Select
                value={String(node.params.ruleId ?? '')}
                placeholder="Choose a rule"
                onChange={(e) => setParam('ruleId', e.target.value)}
                options={rules
                  .filter((r) => r.status === 'active')
                  .map((r) => ({ value: r.id, label: `${r.name} v${r.version}` }))}
              />
            </Field>
          )}
        </>
      )}

      {node.actionType === 'create_task' && (
        <>
          <Field label="Task title" hint="Merge fields are allowed, for example {{person.firstName}}.">
            <Input value={String(node.params.title ?? '')} onChange={(e) => setParam('title', e.target.value)} />
          </Field>
          <Field label="Owner">
            <Select
              value={String(node.params.owner ?? 'lead.owner')}
              onChange={(e) => setParam('owner', e.target.value)}
              options={RECIPIENT_OPTIONS}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Due in (days)">
              <Input
                type="number"
                min={0}
                value={String(node.params.dueOffsetDays ?? 1)}
                onChange={(e) => setParam('dueOffsetDays', Number(e.target.value))}
              />
            </Field>
            <Field label="Priority">
              <Select
                value={String(node.params.priority ?? 'normal')}
                onChange={(e) => setParam('priority', e.target.value)}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />
            </Field>
          </div>
        </>
      )}

      {node.actionType === 'assign_owner' && (
        <Field label="Assign to">
          <Select
            value={String(node.params.owner ?? 'round_robin')}
            onChange={(e) => setParam('owner', e.target.value)}
            options={[
              { value: 'round_robin', label: 'Round robin across the sales team' },
              { value: 'branch_default', label: 'The default owner for the branch' },
              ...RECIPIENT_OPTIONS,
            ]}
          />
        </Field>
      )}

      {node.actionType === 'change_status' && (
        <div className="grid grid-cols-1 gap-3">
          <Field label="Entity">
            <Select
              value={String(node.params.entity ?? 'lead')}
              onChange={(e) => setParam('entity', e.target.value)}
              options={[
                { value: 'lead', label: 'Lead' },
                { value: 'admission', label: 'Admission' },
                { value: 'enrolment', label: 'Enrolment' },
                { value: 'invoice', label: 'Invoice' },
              ]}
            />
          </Field>
          <Field label="Field">
            <Input value={String(node.params.field ?? 'status')} onChange={(e) => setParam('field', e.target.value)} />
          </Field>
          <Field label="New value">
            <Input value={String(node.params.value ?? '')} onChange={(e) => setParam('value', e.target.value)} />
          </Field>
        </div>
      )}

      {node.actionType === 'generate_document' && (
        <>
          <Field label="Document template">
            <Select
              value={String(node.params.documentTemplateId ?? '')}
              placeholder="Choose a template"
              onChange={(e) => setParam('documentTemplateId', e.target.value)}
              options={docTemplates
                .filter((t) => t.status === 'active')
                .map((t) => ({ value: t.id, label: `${t.name} v${t.version}` }))}
            />
          </Field>
          <Switch
            checked={node.params.attach === true}
            onChange={(checked) => setParam('attach', checked)}
            label="Attach to the record"
          />
          <Switch
            checked={node.params.sendForSignature === true}
            onChange={(checked) => setParam('sendForSignature', checked)}
            label="Send for signature"
          />
        </>
      )}

      {node.actionType === 'request_approval' && (
        <>
          <Field label="Approval type">
            <Select
              value={String(node.params.approvalType ?? '')}
              placeholder="Choose a type"
              onChange={(e) => setParam('approvalType', e.target.value)}
              options={[...new Set(routes.map((r) => r.type))].map((t) => ({
                value: t,
                label: t.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()),
              }))}
            />
          </Field>
          <p className="text-body-12 text-text-secondary">
            The route in force decides the approvers. An approver can never approve their own request.
          </p>
        </>
      )}

      {node.actionType === 'issue_card' && (
        <>
          <Field label="Card type">
            <Select
              value={String(node.params.holderType ?? 'student')}
              onChange={(e) => setParam('holderType', e.target.value)}
              options={[
                { value: 'student', label: 'Student card' },
                { value: 'staff', label: 'Staff card' },
                { value: 'visitor', label: 'Visitor card' },
              ]}
            />
          </Field>
          <Field label="Branch">
            <Select
              value={String(node.params.branchId ?? 'from_admission')}
              onChange={(e) => setParam('branchId', e.target.value)}
              options={[
                { value: 'from_admission', label: 'The branch on the admission' },
                ...branches.map((b) => ({ value: b.id, label: branchName(b.id) })),
              ]}
            />
          </Field>
        </>
      )}

      {node.actionType === 'grant_lms_access' && (
        <Field label="Cohort">
          <Select
            value={String(node.params.cohortFrom ?? 'admission.cohortId')}
            onChange={(e) => setParam('cohortFrom', e.target.value)}
            options={[
              { value: 'admission.cohortId', label: 'The cohort on the admission' },
              ...cohorts.slice(0, 20).map((c) => ({ value: c.id, label: c.code })),
            ]}
          />
        </Field>
      )}

      {node.actionType === 'add_tag' && (
        <Field label="Tag">
          <Input value={String(node.params.tag ?? '')} onChange={(e) => setParam('tag', e.target.value)} />
        </Field>
      )}

      {node.actionType === 'update_field' && (
        <div className="grid grid-cols-1 gap-3">
          <Field label="Field">
            <Input value={String(node.params.field ?? '')} onChange={(e) => setParam('field', e.target.value)} />
          </Field>
          <Field label="Value">
            <Input value={String(node.params.value ?? '')} onChange={(e) => setParam('value', e.target.value)} />
          </Field>
        </div>
      )}

      {node.actionType === 'webhook' && (
        <>
          <Field label="Endpoint URL">
            <Input
              value={String(node.params.url ?? '')}
              onChange={(e) => setParam('url', e.target.value)}
              placeholder="https://"
              disabled
            />
          </Field>
          <Alert tone="warning" title="Webhooks do not fire in this prototype">
            There is no backend to post to. The node still records in the trace as skipped, with this reason, rather
            than pretending to have succeeded.
          </Alert>
        </>
      )}

      <Textarea
        rows={2}
        value={node.summary || actionSummary(node)}
        onChange={(e) =>
          onChange(node.id, (n) => (n.kind === 'action' ? { ...n, summary: e.target.value } : n))
        }
        aria-label="Node summary shown on the canvas"
      />
      <p className="text-body-12 text-text-secondary">
        This sentence is what the canvas shows. Leave it alone and it stays in step with the settings above.
      </p>
    </div>
  )
}

function ReliabilityPanel({
  draft,
  onChange,
  automationKey,
}: {
  draft: DraftShape
  onChange: (reliability: Automation['reliability']) => void
  automationKey: string
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const r = draft.reliability
  const toggleField = (path: string) => {
    const on = r.idempotencyKeyFields.includes(path)
    onChange({
      ...r,
      idempotencyKeyFields: on
        ? r.idempotencyKeyFields.filter((f) => f !== path)
        : [...r.idempotencyKeyFields, path],
    })
  }

  return (
    <Card padding="none">
      <CardHeader
        title="Duplicate protection and failure handling"
        description="What happens when the same trigger fires twice, and what happens when a step fails."
      />
      <CardBody className="flex flex-col gap-5">
        <div>
          <p className="text-label-11 uppercase tracking-wide text-text-label">Treat these as the same person</p>
          <p className="mt-1 text-body-12 text-text-secondary">
            If two triggers match on everything checked here, the second one is skipped instead of running again.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {IDEMPOTENCY_FIELDS.map((f) => (
              <li key={f.path}>
                <Checkbox
                  size="sm"
                  label={f.label}
                  checked={r.idempotencyKeyFields.includes(f.path)}
                  onChange={() => toggleField(f.path)}
                />
              </li>
            ))}
          </ul>
          {r.idempotencyKeyFields.length === 0 && (
            <p className="mt-2 text-body-12 text-danger-text">
              With nothing checked, every trigger runs again. Duplicate messages and duplicate commissions follow.
            </p>
          )}
        </div>

        <Field label="If a step keeps failing">
          <Select
            selectSize="sm"
            value={r.onFailure}
            onChange={(e) => onChange({ ...r, onFailure: e.target.value as Automation['reliability']['onFailure'] })}
            options={(Object.keys(ON_FAILURE_LABEL) as Array<Automation['reliability']['onFailure']>).map((k) => ({
              value: k,
              label: ON_FAILURE_LABEL[k],
            }))}
          />
        </Field>

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1.5 self-start text-body-13 font-medium text-text-secondary transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {advancedOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Advanced settings
        </button>

        {advancedOpen && (
          <div className="flex flex-col gap-5 border-t border-border pt-4">
            <div>
              <p className="text-label-11 uppercase tracking-wide text-text-label">Key preview</p>
              <p className="mt-1 text-body-12 text-text-secondary">
                What the fields above resolve to for one real run.
              </p>
              <KeyChip value={idempotencyPreview(automationKey, r.idempotencyKeyFields)} className="mt-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Number of tries">
                <Input
                  type="number"
                  min={0}
                  max={10}
                  inputSize="sm"
                  value={String(r.retryAttempts)}
                  onChange={(e) => onChange({ ...r, retryAttempts: Number(e.target.value) })}
                />
              </Field>
              <Field label="Wait between tries">
                <Select
                  selectSize="sm"
                  value={r.retryBackoff}
                  onChange={(e) => onChange({ ...r, retryBackoff: e.target.value as 'fixed' | 'exponential' })}
                  options={[
                    { value: 'exponential', label: 'Increasing each time' },
                    { value: 'fixed', label: 'Same each time' },
                  ]}
                />
              </Field>
            </div>

            <Field
              label="Maximum runs per person per month"
              hint="Leave empty for no cap. A cap stops one person being messaged on a loop."
            >
              <Input
                type="number"
                min={1}
                inputSize="sm"
                value={r.maxRunsPerPersonPerPeriod === null ? '' : String(r.maxRunsPerPersonPerPeriod)}
                onChange={(e) =>
                  onChange({ ...r, maxRunsPerPersonPerPeriod: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </Field>

            <KeyValueList>
              <KeyValue label="Conditions configured">{conditionCount(draft.nodes)}</KeyValue>
              <KeyValue label="Actions configured">{draft.nodes.filter((n) => n.kind === 'action').length}</KeyValue>
            </KeyValueList>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
