import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Bookmark, CheckCheck, CornerUpLeft, Inbox, PanelRightClose, PanelRightOpen, Plus, X } from 'lucide-react'
import {
  Alert,
  Badge,
  BulkActionBar,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Skeleton,
  StatusBadge,
  Tooltip,
  UnitTag,
  type Column,
} from '@/ui'
import { approvalRequestsCollection, canDecide, useCollection, unitsCollection, branchesCollection } from '@/mocks'
import type { ApprovalRequest, ApprovalType, Kobo } from '@/mocks'
import { formatDate, formatNaira } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  ALL_APPROVAL_TYPES,
  APPROVAL_STATUSES,
  APPROVAL_TYPE_META,
  SLA_LABEL,
  SLA_TONE,
  STATUS_LABEL,
  ageLabel,
  branchName,
  slaIsPaused,
  unitKey,
  useActingUser,
  useScreenState,
  userName,
  userOptions,
  WorkGroupTabs,
} from './shared'
import { AmountCell, ApproverCell, EscalationCell, ImpactPreview, RouteChain, RouteVisualiser } from './components'
import { DecisionDialog } from './DecisionDialog'
import { decide, type DecisionOutcome } from './engine'
import { impactForRequest } from './impact'
import { escalationLabel } from './shared'

const PAGE_SIZE = 20

const AMOUNT_BANDS: Array<{ value: string; label: string; min: number; max: number }> = [
  { value: 'under-100k', label: 'Under ₦100,000', min: 0, max: 10_000_000 },
  { value: '100k-500k', label: '₦100,000 – ₦500,000', min: 10_000_000, max: 50_000_000 },
  { value: '500k-2m', label: '₦500,000 – ₦2,000,000', min: 50_000_000, max: 200_000_000 },
  { value: 'over-2m', label: 'Over ₦2,000,000', min: 200_000_000, max: Number.POSITIVE_INFINITY },
]

interface SavedView {
  id: string
  label: string
  params: Record<string, string>
}

const SAVED_VIEWS: SavedView[] = [
  { id: 'pending-on-me', label: 'Pending on me', params: { pendingOnMe: '1', status: 'pending' } },
  { id: 'breaching', label: 'Breaching SLA', params: { sla: 'breached', status: 'pending' } },
  { id: 'financial-500k', label: 'Financial over ₦500k', params: { band: '500k-2m', status: 'pending' } },
  { id: 'returned', label: 'Returned for information', params: { status: 'returned_for_information' } },
]

export default function ApprovalsList() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const navigate = useNavigate()
  const acting = useActingUser()

  const approvals = useCollection(approvalRequestsCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  const [selected, setSelected] = useState<string[]>([])
  const [previewOpen, setPreviewOpen] = useState(true)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ id: string; outcome: DecisionOutcome } | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value === undefined || value === '') next.delete(key)
    else next.set(key, value)
    next.delete('page')
    setParams(next, { replace: true })
  }

  const applyView = (view: SavedView) => {
    const next = new URLSearchParams()
    Object.entries(view.params).forEach(([k, v]) => next.set(k, v))
    setParams(next, { replace: true })
  }

  const q = params.get('q') ?? ''
  const status = params.get('status') ?? ''
  const type = params.get('type') ?? ''
  const requester = params.get('requester') ?? ''
  const approver = params.get('approver') ?? ''
  const unit = params.get('unit') ?? ''
  const branch = params.get('branch') ?? ''
  const band = params.get('band') ?? ''
  const sla = params.get('sla') ?? ''
  const pendingOnMe = params.get('pendingOnMe') === '1'
  const page = Number(params.get('page') ?? '1')

  const filtersActive = Boolean(q || status || type || requester || approver || unit || branch || band || sla || pendingOnMe)

  const filtered = useMemo(() => {
    const bandDef = AMOUNT_BANDS.find((b) => b.value === band)
    const needle = q.trim().toLowerCase()
    return approvals
      .filter((a) => !needle || a.ref.toLowerCase().includes(needle) || a.title.toLowerCase().includes(needle))
      .filter((a) => !status || a.status === status)
      .filter((a) => !type || a.type === type)
      .filter((a) => !requester || a.requesterUserId === requester)
      .filter((a) => !approver || a.currentApproverUserId === approver)
      .filter((a) => !unit || a.unitId === unit)
      .filter((a) => !branch || a.branchId === branch)
      .filter((a) => !sla || (a.status === 'pending' && a.slaState === sla))
      .filter((a) => !pendingOnMe || (a.status === 'pending' && a.currentApproverUserId === acting))
      .filter((a) => {
        if (!bandDef) return true
        if (a.amount === null) return false
        return a.amount >= bandDef.min && a.amount < bandDef.max
      })
      .sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt))
  }, [approvals, q, status, type, requester, approver, unit, branch, band, sla, pendingOnMe, acting])

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const previewRequest = previewId ? approvals.find((a) => a.id === previewId) : undefined
  const decidedThisWeek = approvals.filter(
    (a) => a.decidedAt !== null && Date.parse(a.decidedAt) > Date.now() - 7 * 86_400_000,
  ).length

  const openDecision = (request: ApprovalRequest, outcome: DecisionOutcome) => {
    const gate = canDecide(request, acting)
    if (!gate.allowed) {
      setBlocked(`${request.ref}: ${gate.reason}`)
      toast.error(gate.reason ?? 'Blocked')
      return
    }
    setBlocked(null)
    setDialog({ id: request.id as string, outcome })
  }

  const bulkApprove = () => {
    const rows = selected.map((id) => approvals.find((a) => a.id === id)).filter(Boolean) as ApprovalRequest[]
    const types = new Set(rows.map((r) => r.type))
    if (types.size > 1) {
      setBlocked('Bulk approve works on one request type at a time. Narrow the selection.')
      return
    }
    let approved = 0
    const refused: string[] = []
    for (const row of rows) {
      const result = decide(row.id as string, acting, 'approve', 'Bulk approved from the queue.')
      if (result.ok) approved += 1
      else refused.push(`${row.ref}: ${result.reason}`)
    }
    setSelected([])
    if (approved > 0) toast.success(`${approved} request${approved === 1 ? '' : 's'} approved. Each wrote its own audit row.`)
    setBlocked(refused.length ? refused.join(' · ') : null)
  }

  const columns: Array<Column<ApprovalRequest>> = [
    {
      key: 'ref',
      header: 'Ref',
      pinned: true,
      width: 138,
      cell: (r) => <span className="font-medium text-text">{r.ref}</span>,
      sortValue: (r) => r.ref,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 150,
      cell: (r) => <Badge tone="neutral" size="sm">{APPROVAL_TYPE_META[r.type].label}</Badge>,
      sortValue: (r) => APPROVAL_TYPE_META[r.type].label,
      sortable: true,
    },
    {
      key: 'title',
      header: 'Title',
      minWidth: 260,
      cell: (r) => <span className="text-text">{r.title}</span>,
      sortValue: (r) => r.title,
      sortable: true,
    },
    {
      key: 'requester',
      header: 'Requester',
      width: 160,
      accessor: (r) => userName(r.requesterUserId),
      sortable: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: 140,
      cell: (r) => <AmountCell amount={r.amount} />,
      sortValue: (r) => r.amount ?? -1,
      sortable: true,
    },
    {
      key: 'unit',
      header: 'Unit',
      width: 120,
      cell: (r) => {
        const key = unitKey(r.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : <span className="text-text-secondary">—</span>
      },
      sortValue: (r) => unitKey(r.unitId) ?? '',
      sortable: true,
    },
    { key: 'branch', header: 'Branch', width: 120, accessor: (r) => branchName(r.branchId), sortable: true },
    {
      key: 'route',
      header: 'Route',
      minWidth: 260,
      cell: (r) => <RouteChain request={r} />,
      sortValue: (r) => r.steps.length,
      sortable: true,
    },
    {
      key: 'approver',
      header: 'Current approver',
      width: 170,
      cell: (r) => <ApproverCell userId={r.currentApproverUserId} />,
      sortValue: (r) => userName(r.currentApproverUserId),
      sortable: true,
    },
    {
      key: 'raised',
      header: 'Raised',
      width: 120,
      accessor: (r) => formatDate(r.raisedAt),
      sortValue: (r) => r.raisedAt,
      sortable: true,
    },
    { key: 'age', header: 'Age', align: 'right', width: 80, accessor: (r) => ageLabel(r), sortValue: (r) => r.ageHours, sortable: true },
    {
      key: 'sla',
      header: 'SLA',
      width: 130,
      cell: (r) =>
        slaIsPaused(r) ? (
          <Badge tone="info" size="sm">Paused</Badge>
        ) : r.status !== 'pending' ? (
          <span className="text-text-secondary">—</span>
        ) : (
          <Badge tone={SLA_TONE[r.slaState]} size="sm">{SLA_LABEL[r.slaState]}</Badge>
        ),
      sortValue: (r) => r.slaState,
      sortable: true,
    },
    {
      key: 'escalation',
      header: 'Escalation',
      minWidth: 200,
      cell: (r) => <EscalationCell request={r} />,
      sortValue: (r) => r.escalatesAt ?? '',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 170,
      cell: (r) => <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} size="sm" />,
      sortValue: (r) => r.status,
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Decide',
      width: 230,
      cell: (r) => {
        const gate = canDecide(r, acting)
        if (!gate.allowed && r.status !== 'pending') {
          return <span className="text-body-12 text-text-secondary">Decided</span>
        }
        const buttons = (
          <span className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="secondary"
              disabled={!gate.allowed}
              aria-disabled={!gate.allowed}
              onClick={(event) => {
                event.stopPropagation()
                openDecision(r, 'approve')
              }}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!gate.allowed}
              aria-disabled={!gate.allowed}
              onClick={(event) => {
                event.stopPropagation()
                openDecision(r, 'reject')
              }}
            >
              Reject
            </Button>
            <Tooltip content="Return for information — pauses the SLA clock">
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                aria-label={`Return ${r.ref} for information`}
                disabled={!gate.allowed}
                aria-disabled={!gate.allowed}
                onClick={(event) => {
                  event.stopPropagation()
                  openDecision(r, 'return')
                }}
              >
                <CornerUpLeft size={16} />
              </Button>
            </Tooltip>
          </span>
        )
        if (gate.allowed) return buttons
        return (
          <Tooltip content={gate.reason ?? 'You cannot decide this request.'}>
            <span className="inline-flex">{buttons}</span>
          </Tooltip>
        )
      },
    },
  ]

  const selectedRows = selected.map((id) => approvals.find((a) => a.id === id)).filter(Boolean) as ApprovalRequest[]
  const selectedBlocked = selectedRows.filter((r) => !canDecide(r, acting).allowed)

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Approvals"
        description="The engine's queue. Every request type routes through the same bands, the same SLA and the same block on approving your own."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Approvals' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={previewOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              onClick={() => setPreviewOpen((v) => !v)}
            >
              {previewOpen ? 'Hide preview' : 'Show preview'}
            </Button>
            <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/work/approvals/new')}>
              Raise request
            </Button>
          </div>
        }
      />

      <WorkGroupTabs group="approvals" active="approvals" />

      {error && (
        <Alert
          tone="danger"
          title="Could not load the approvals queue"
          className="mt-6"
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {blocked && (
        <Alert tone="danger" title="Decision blocked" className="mt-6" onDismiss={() => setBlocked(null)}>
          {blocked}
        </Alert>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-body-12 text-text-secondary">
          <Bookmark size={14} /> Saved views
        </span>
        {SAVED_VIEWS.map((view) => (
          <Button key={view.id} size="sm" variant="secondary" onClick={() => applyView(view)}>
            {view.label}
          </Button>
        ))}
        {filtersActive && (
          <Button size="sm" variant="ghost" leftIcon={<X size={14} />} onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>

      <div
        className={cn(
          'mt-4 grid gap-4',
          previewOpen ? 'grid-cols-1 xl:grid-cols-[15rem_minmax(0,1fr)_22rem]' : 'grid-cols-1 xl:grid-cols-[15rem_minmax(0,1fr)]',
        )}
      >
        {/* Filter rail */}
        <Card className="h-fit">
          <CardHeader title="Filters" bare />
          <CardBody className="space-y-3.5">
            <Field label="Search">
              <SearchInput value={q} onChange={(v) => set('q', v)} placeholder="Ref or title" inputSize="sm" />
            </Field>
            <Field label="Status">
              <Select
                selectSize="sm"
                placeholder="All statuses"
                value={status}
                onChange={(e) => set('status', e.target.value)}
                options={APPROVAL_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              />
            </Field>
            <Field label="Type">
              <Select
                selectSize="sm"
                placeholder="All types"
                value={type}
                onChange={(e) => set('type', e.target.value)}
                options={ALL_APPROVAL_TYPES.map((t) => ({ value: t, label: APPROVAL_TYPE_META[t].label }))}
              />
            </Field>
            <Checkbox
              label="Pending on me"
              description={userName(acting)}
              checked={pendingOnMe}
              onChange={(e) => set('pendingOnMe', e.target.checked ? '1' : undefined)}
            />
            <Checkbox
              label="Breaching SLA only"
              checked={sla === 'breached'}
              onChange={(e) => set('sla', e.target.checked ? 'breached' : undefined)}
            />
            <Field label="Requester">
              <Select
                selectSize="sm"
                placeholder="Anyone"
                value={requester}
                onChange={(e) => set('requester', e.target.value)}
                options={userOptions()}
              />
            </Field>
            <Field label="Approver">
              <Select
                selectSize="sm"
                placeholder="Anyone"
                value={approver}
                onChange={(e) => set('approver', e.target.value)}
                options={userOptions()}
              />
            </Field>
            <Field label="Amount band">
              <Select
                selectSize="sm"
                placeholder="Any amount"
                value={band}
                onChange={(e) => set('band', e.target.value)}
                options={AMOUNT_BANDS.map((b) => ({ value: b.value, label: b.label }))}
              />
            </Field>
            <Field label="Unit">
              <Select
                selectSize="sm"
                placeholder="All units"
                value={unit}
                onChange={(e) => set('unit', e.target.value)}
                options={units.map((u) => ({ value: u.id as string, label: u.name }))}
              />
            </Field>
            <Field label="Branch">
              <Select
                selectSize="sm"
                placeholder="All branches"
                value={branch}
                onChange={(e) => set('branch', e.target.value)}
                options={branches.map((b) => ({ value: b.id as string, label: b.name }))}
              />
            </Field>
          </CardBody>
        </Card>

        {/* Queue */}
        <div className="min-w-0">
          {selected.length > 0 && (
            <BulkActionBar
              count={selected.length}
              itemNoun="request"
              onClearSelection={() => setSelected([])}
              className="mb-3"
            >
              <Button size="sm" leftIcon={<CheckCheck size={15} />} onClick={bulkApprove} disabled={selectedBlocked.length === selected.length}>
                Approve selected
              </Button>
              {selectedBlocked.length > 0 && (
                <span className="text-body-12 text-danger-text">
                  {selectedBlocked.length} cannot be approved by you and will be refused with a reason.
                </span>
              )}
            </BulkActionBar>
          )}

          {loading ? (
            <Card>
              <CardBody className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} height={40} rounded="lg" />
                ))}
              </CardBody>
            </Card>
          ) : error ? null : filtered.length === 0 ? (
            <Card>
              <CardBody>
                {filtersActive ? (
                  <EmptyState
                    variant="search"
                    title="No approvals match these filters."
                    message="Widen the filters, or clear them to see the whole queue."
                    action={
                      <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Inbox}
                    title="No approvals pending."
                    message={`${decidedThisWeek} request${decidedThisWeek === 1 ? ' was' : 's were'} decided in the last seven days. Nothing is waiting on anyone.`}
                    action={
                      <Button onClick={() => navigate('/work/approvals/new')} leftIcon={<Plus size={16} />}>
                        Raise request
                      </Button>
                    }
                  />
                )}
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody padding="none">
                <DataTable
                  data={paged}
                  columns={columns}
                  rowKey={(r) => r.id as string}
                  caption="Approval requests with their route, SLA state and escalation"
                  density="compact"
                  minWidth={2100}
                  stickyHeader
                  maxHeight={620}
                  selectable
                  selectedKeys={selected}
                  onSelectionChange={setSelected}
                  activeRowKey={previewId ?? undefined}
                  onRowClick={(r) => {
                    if (previewOpen) setPreviewId(r.id as string)
                    else navigate(`/work/approvals/${r.id}`)
                  }}
                  defaultSort={{ key: 'raised', direction: 'desc' }}
                />
              </CardBody>
              <Pagination
                page={page}
                pageSize={PAGE_SIZE}
                total={filtered.length}
                itemNoun="request"
                onPageChange={(p) => set('page', String(p))}
                divided
              />
            </Card>
          )}
        </div>

        {/* Preview pane */}
        {previewOpen && (
          <div className="min-w-0 space-y-4">
            {previewRequest ? (
              <>
                <Card>
                  <CardHeader
                    title={previewRequest.ref}
                    description={previewRequest.title}
                    actions={
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/work/approvals/${previewRequest.id}`)}>
                        Open
                      </Button>
                    }
                  />
                  <CardBody className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral" size="sm">{APPROVAL_TYPE_META[previewRequest.type].label}</Badge>
                      <StatusBadge status={previewRequest.status} label={STATUS_LABEL[previewRequest.status]} size="sm" />
                      {previewRequest.amount !== null && (
                        <span className="text-body-14 tabular-nums text-text">{formatNaira(previewRequest.amount)}</span>
                      )}
                    </div>
                    <RouteVisualiser
                      steps={previewRequest.steps}
                      currentStepIndex={previewRequest.currentStepIndex}
                      escalation={escalationLabel(previewRequest)}
                      compact
                    />
                  </CardBody>
                </Card>
                <ImpactPreview {...impactForRequest(previewRequest)} title="Impact" />
              </>
            ) : (
              <Card>
                <CardBody>
                  <EmptyState
                    size="sm"
                    title="Pick a request"
                    message="The preview shows the route and the downstream impact without leaving the queue."
                  />
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </div>

      <DecisionDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        requestId={dialog?.id ?? null}
        outcome={dialog?.outcome ?? 'approve'}
        actorUserId={acting}
      />
    </div>
  )
}

/** Amount bands are exported so the route configuration screen can reuse them. */
export { AMOUNT_BANDS }
export type { ApprovalType, Kobo }
