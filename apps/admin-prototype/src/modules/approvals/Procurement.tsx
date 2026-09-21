import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowRight,
  Ban,
  Boxes,
  CircleDollarSign,
  FileText,
  PackageSearch,
  ReceiptText,
  Truck,
  type LucideIcon,
} from 'lucide-react'

import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  ConfirmDialog,
  CurrencyInput,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  TableToolbar,
  Textarea,
  Timeline,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type TimelineItem,
} from '@/ui'
import {
  TODAY,
  approvalRequestsCollection,
  atTime,
  branchesCollection,
  companyAssetsCollection,
  expensesCollection,
  procurementRequestsCollection,
  unitsCollection,
  useCollection,
} from '@/mocks'
import {
  asKobo,
  companyAssetId as asCompanyAssetId,
  expenseId as asExpenseId,
  type ApprovalRequestId,
  type CompanyAssetId,
  type ExpenseId,
  type Kobo,
  type ProcurementRequest,
  type ProcurementStage,
} from '@/mocks/types'
import { formatDate, formatNaira, formatNumber } from '@/lib/format'

import { writeAudit } from './engine'
import { branchName, currentActingUser, unitName, userName, useScreenState } from './shared'
import {
  PHASES,
  STAGE_LABEL,
  canAdvance,
  isRejectable,
  producesAsset,
  variance,
} from './procurement-flow'

const STAGE_TONE: Record<ProcurementStage, 'neutral' | 'info' | 'accent' | 'warning' | 'success' | 'danger'> = {
  requested: 'neutral',
  approved: 'info',
  quoting: 'warning',
  ordered: 'accent',
  received: 'accent',
  paid: 'success',
  closed: 'success',
  rejected: 'danger',
}

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Request ref', defaultVisible: true, locked: true },
  { key: 'item', label: 'Item', defaultVisible: true },
  { key: 'category', label: 'Category', defaultVisible: false },
  { key: 'quantity', label: 'Quantity', defaultVisible: false },
  { key: 'estimatedCost', label: 'Estimated cost', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'requester', label: 'Requester', defaultVisible: false },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'approval', label: 'Approval ref', defaultVisible: false },
  { key: 'vendor', label: 'Vendor', defaultVisible: true },
  { key: 'actualCost', label: 'Actual cost', defaultVisible: true },
  { key: 'variance', label: 'Variance', defaultVisible: true },
  { key: 'raised', label: 'Raised', defaultVisible: false },
  { key: 'expected', label: 'Expected delivery', defaultVisible: false },
  { key: 'record', label: 'Asset or expense', defaultVisible: false },
]

const VENDORS = [
  'Slot Systems Limited',
  'Computer Village Traders',
  'Mikano International',
  'Bodija Furniture Works',
  'Lagos Office Supplies',
]

export default function Procurement() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')

  const requests = useCollection(procurementRequestsCollection)
  const approvals = useCollection(approvalRequestsCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  const [quoting, setQuoting] = useState<ProcurementRequest | null>(null)
  const [rejecting, setRejecting] = useState<ProcurementRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTouched, setRejectTouched] = useState(false)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const q = params.get('q') ?? ''
  const phaseFilter = params.get('phase') ?? ''
  const stage = params.get('stage') ?? ''
  const category = params.get('category') ?? ''
  const unit = params.get('unit') ?? ''
  const branch = params.get('branch') ?? ''
  const drawerId = params.get('drawer')
  const open = requests.find((r) => r.id === drawerId) ?? null

  const categories = useMemo(
    () => [...new Set(requests.map((r) => r.category))].sort((a, b) => a.localeCompare(b)),
    [requests],
  )

  const approvalFor = useMemo(() => {
    const byId = new Map(approvals.map((a) => [a.id as string, a]))
    const byEntity = new Map(
      approvals
        .filter((a) => a.relatedEntityType === 'ProcurementRequest')
        .map((a) => [a.relatedEntityId, a]),
    )
    return (request: ProcurementRequest) =>
      (request.approvalRequestId ? byId.get(request.approvalRequestId as string) : undefined) ??
      byEntity.get(request.id as string) ??
      null
  }, [approvals])

  const phaseFigures = useMemo(
    () =>
      PHASES.map((phase) => {
        const rows = requests.filter((r) => phase.stages.includes(r.stage))
        return {
          phase,
          count: rows.length,
          value: rows.reduce((total, r) => total + (r.actualCost ?? r.estimatedCost), 0),
        }
      }),
    [requests],
  )

  const figures = useMemo(() => {
    const live = requests.filter((r) => r.stage !== 'closed' && r.stage !== 'rejected')
    const settled = requests.filter((r) => r.actualCost !== null)
    const overspend = settled.reduce((total, r) => total + Math.max(0, variance(r) ?? 0), 0)
    return {
      open: live.length,
      committed: live.reduce((total, r) => total + (r.actualCost ?? r.estimatedCost), 0),
      awaitingQuote: requests.filter((r) => r.stage === 'quoting').length,
      unpaid: requests.filter((r) => r.stage === 'received').length,
      overspend,
    }
  }, [requests])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const phaseStages = phaseFilter ? (PHASES.find((p) => p.id === phaseFilter)?.stages ?? []) : []
    return requests
      .filter(
        (r) =>
          !needle ||
          r.ref.toLowerCase().includes(needle) ||
          r.item.toLowerCase().includes(needle) ||
          (r.vendor ?? '').toLowerCase().includes(needle),
      )
      .filter((r) => phaseStages.length === 0 || phaseStages.includes(r.stage))
      .filter((r) => !stage || r.stage === stage)
      .filter((r) => !category || r.category === category)
      .filter((r) => !unit || (r.unitId as string) === unit)
      .filter((r) => !branch || (r.branchId as string) === branch)
      .sort((a, b) => a.ref.localeCompare(b.ref))
  }, [requests, q, phaseFilter, stage, category, unit, branch])

  const filtersActive = Boolean(q || phaseFilter || stage || category || unit || branch)

  const stamp = atTime(TODAY, 10, 0)
  const actor = currentActingUser()

  const advance = (request: ProcurementRequest) => {
    const check = canAdvance(request, approvalFor(request)?.status ?? null)
    if (!check.allowed || !check.to) {
      toast.error(check.reason ?? 'This request cannot advance.')
      return
    }
    procurementRequestsCollection.update(request.id, {
      stage: check.to,
      updatedAt: stamp,
      updatedBy: actor,
      ...(check.to === 'ordered' && !request.expectedDelivery
        ? { expectedDelivery: addBusinessDays(TODAY, 10) }
        : {}),
    })
    writeAudit({
      actorUserId: actor,
      action: 'procurement.stage.advance',
      entityType: 'ProcurementRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: 'stage',
      before: STAGE_LABEL[request.stage],
      after: STAGE_LABEL[check.to],
    })
    toast.success(`${request.ref} moved to ${STAGE_LABEL[check.to].toLowerCase()}.`)
  }

  const saveQuote = (request: ProcurementRequest, vendor: string, cost: Kobo, delivery: string) => {
    procurementRequestsCollection.update(request.id, {
      vendor,
      actualCost: cost,
      expectedDelivery: delivery || null,
      updatedAt: stamp,
      updatedBy: actor,
    })
    writeAudit({
      actorUserId: actor,
      action: 'procurement.quote.attach',
      entityType: 'ProcurementRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: 'vendor',
      before: request.vendor,
      after: `${vendor} · ${formatNaira(cost)}`,
    })
    toast.success(`Quote from ${vendor} attached to ${request.ref}.`)
  }

  const createRecord = (request: ProcurementRequest) => {
    const cost = request.actualCost ?? request.estimatedCost
    if (producesAsset(request)) {
      const seq = companyAssetsCollection.count() + 1
      const id = asCompanyAssetId(`ast-p-${request.ref.toLowerCase()}`) as CompanyAssetId
      companyAssetsCollection.insert({
        id,
        assetId: `AST-${String(2000 + seq).padStart(4, '0')}`,
        category: request.category,
        name: request.item,
        serial: `${request.ref}-01`,
        purchaseDate: TODAY,
        purchaseValue: cost,
        currentValue: cost,
        branchId: request.branchId,
        assignedToPersonId: null,
        assignedAt: null,
        condition: 'new',
        status: 'in_store',
        lastServiceDate: null,
        returnDueDate: null,
        serviceHistory: [],
        createdAt: stamp,
        createdBy: actor,
        updatedAt: stamp,
        updatedBy: actor,
      })
      procurementRequestsCollection.update(request.id, {
        resultingAssetId: id,
        updatedAt: stamp,
        updatedBy: actor,
      })
      writeAudit({
        actorUserId: actor,
        action: 'procurement.asset.create',
        entityType: 'ProcurementRequest',
        entityId: request.id as string,
        entityRef: request.ref,
        field: 'resultingAssetId',
        before: null,
        after: id as string,
      })
      toast.success(`Asset record created for ${request.ref}. It is on the register, in store.`)
      return
    }

    const seq = expensesCollection.count() + 1
    const id = asExpenseId(`exp-p-${request.ref.toLowerCase()}`) as ExpenseId
    expensesCollection.insert({
      id,
      ref: `EXP-2026-${String(seq).padStart(4, '0')}`,
      date: TODAY,
      category: request.category,
      vendor: request.vendor ?? 'Vendor not recorded',
      amount: cost,
      unitId: request.unitId,
      branchId: request.branchId,
      requesterUserId: request.requesterUserId,
      approvalRequestId: (approvalFor(request)?.id ?? null) as ApprovalRequestId | null,
      status: 'paid',
      paidDate: TODAY,
      receiptUrl: null,
      budgetLine: request.category,
      createdAt: stamp,
      createdBy: actor,
      updatedAt: stamp,
      updatedBy: actor,
    })
    procurementRequestsCollection.update(request.id, {
      resultingExpenseId: id,
      updatedAt: stamp,
      updatedBy: actor,
    })
    writeAudit({
      actorUserId: actor,
      action: 'procurement.expense.create',
      entityType: 'ProcurementRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: 'resultingExpenseId',
      before: null,
      after: id as string,
    })
    toast.success(`Expense record created for ${request.ref}.`)
  }

  const reject = (request: ProcurementRequest, reason: string) => {
    procurementRequestsCollection.update(request.id, {
      stage: 'rejected',
      updatedAt: stamp,
      updatedBy: actor,
      archivedReason: reason,
    })
    writeAudit({
      actorUserId: actor,
      action: 'procurement.reject',
      entityType: 'ProcurementRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: 'stage',
      before: STAGE_LABEL[request.stage],
      after: `Rejected — ${reason}`,
    })
    toast.success(`${request.ref} rejected. The row stays on the register with the reason.`)
  }

  const allColumns: Record<string, Column<ProcurementRequest>> = {
    ref: {
      key: 'ref',
      header: 'Request ref',
      width: 148,
      pinned: true,
      accessor: (r) => <span className="font-mono text-body-13">{r.ref}</span>,
      sortValue: (r) => r.ref,
      sortable: true,
    },
    item: { key: 'item', header: 'Item', minWidth: 220, accessor: (r) => r.item, sortable: true },
    category: { key: 'category', header: 'Category', width: 150, accessor: (r) => r.category, sortable: true },
    quantity: {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      width: 100,
      accessor: (r) => <span className="tabular-nums">{formatNumber(r.quantity)}</span>,
      sortValue: (r) => r.quantity,
      sortable: true,
    },
    estimatedCost: {
      key: 'estimatedCost',
      header: 'Estimated cost',
      align: 'right',
      width: 150,
      accessor: (r) => <span className="tabular-nums">{formatNaira(r.estimatedCost)}</span>,
      sortValue: (r) => r.estimatedCost,
      sortable: true,
    },
    unit: { key: 'unit', header: 'Unit', width: 150, accessor: (r) => unitName(r.unitId), sortable: true },
    branch: { key: 'branch', header: 'Branch', width: 130, accessor: (r) => branchName(r.branchId), sortable: true },
    requester: {
      key: 'requester',
      header: 'Requester',
      width: 170,
      accessor: (r) => userName(r.requesterUserId),
      sortValue: (r) => userName(r.requesterUserId),
      sortable: true,
    },
    stage: {
      key: 'stage',
      header: 'Stage',
      width: 140,
      cell: (r) => (
        <Badge tone={STAGE_TONE[r.stage]} size="sm">
          {STAGE_LABEL[r.stage]}
        </Badge>
      ),
      sortValue: (r) => STAGE_LABEL[r.stage],
      sortable: true,
    },
    approval: {
      key: 'approval',
      header: 'Approval ref',
      width: 160,
      cell: (r) => {
        const approval = approvalFor(r)
        if (!approval) return <span className="text-text-secondary">Not linked</span>
        return (
          <Link
            to={`/work/approvals/${approval.id}`}
            onClick={(event) => event.stopPropagation()}
            className="font-mono text-body-12 text-accent underline-offset-2 hover:underline"
          >
            {approval.ref}
          </Link>
        )
      },
      sortValue: (r) => approvalFor(r)?.ref ?? '',
      sortable: true,
    },
    vendor: {
      key: 'vendor',
      header: 'Vendor',
      minWidth: 190,
      accessor: (r) => r.vendor ?? <span className="text-text-secondary">Not chosen</span>,
      sortValue: (r) => r.vendor ?? '',
      sortable: true,
    },
    actualCost: {
      key: 'actualCost',
      header: 'Actual cost',
      align: 'right',
      width: 140,
      cell: (r) =>
        r.actualCost === null ? (
          <span className="text-text-secondary">Not yet known</span>
        ) : (
          <span className="tabular-nums">{formatNaira(r.actualCost)}</span>
        ),
      sortValue: (r) => r.actualCost ?? -1,
      sortable: true,
    },
    variance: {
      key: 'variance',
      header: 'Variance',
      align: 'right',
      width: 140,
      cell: (r) => {
        const delta = variance(r)
        if (delta === null) return <span className="text-text-secondary">—</span>
        if (delta === 0) return <span className="tabular-nums text-text-secondary">On estimate</span>
        return (
          <span className={`tabular-nums ${delta > 0 ? 'text-danger-text' : 'text-success-text'}`}>
            {delta > 0 ? '+' : '−'}
            {formatNaira(Math.abs(delta))}
          </span>
        )
      },
      sortValue: (r) => variance(r) ?? 0,
      sortable: true,
    },
    raised: {
      key: 'raised',
      header: 'Raised',
      width: 124,
      accessor: (r) => formatDate(r.createdAt),
      sortValue: (r) => r.createdAt,
      sortable: true,
    },
    expected: {
      key: 'expected',
      header: 'Expected delivery',
      width: 160,
      cell: (r) =>
        !r.expectedDelivery ? (
          <span className="text-text-secondary">—</span>
        ) : r.expectedDelivery < TODAY && r.stage === 'ordered' ? (
          <span className="text-body-13 text-danger-text">{formatDate(r.expectedDelivery)} · late</span>
        ) : (
          formatDate(r.expectedDelivery)
        ),
      sortValue: (r) => r.expectedDelivery ?? '',
      sortable: true,
    },
    record: {
      key: 'record',
      header: 'Asset or expense',
      width: 180,
      cell: (r) =>
        r.resultingAssetId ? (
          <Badge tone="success" size="sm" icon={<Boxes size={12} />}>
            Asset recorded
          </Badge>
        ) : r.resultingExpenseId ? (
          <Badge tone="success" size="sm" icon={<ReceiptText size={12} />}>
            Expense recorded
          </Badge>
        ) : (
          <span className="text-text-secondary">Nothing yet</span>
        ),
      sortValue: (r) => (r.resultingAssetId ?? r.resultingExpenseId ?? '') as string,
      sortable: true,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  const drawerApproval = open ? approvalFor(open) : null
  const drawerCheck = open ? canAdvance(open, drawerApproval?.status ?? null) : null
  const needsRecord =
    open !== null && open.stage === 'paid' && !open.resultingAssetId && !open.resultingExpenseId

  const timeline: TimelineItem[] = open
    ? PHASES.map((phase) => {
        const reached = phase.stages.some(
          (s) =>
            STAGE_ORDER_INDEX[s] <= (STAGE_ORDER_INDEX[open.stage] ?? -1) && open.stage !== 'rejected',
        )
        const current = phase.stages.includes(open.stage)
        return {
          id: phase.id,
          title: phase.label,
          description: phase.blurb,
          detail: current ? (
            <Badge tone="accent" size="sm">
              Where this request sits now
            </Badge>
          ) : undefined,
          icon: PHASE_ICON[phase.id],
          tone: current ? 'accent' : reached ? 'success' : 'neutral',
        }
      })
    : []

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Procurement"
        description="Every purchase from the request that started it to the asset or expense record that closes it."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Procurement' }]}
        actions={
          <Button
            leftIcon={<PackageSearch size={16} />}
            onClick={() => navigate('/work/approvals/new?type=procurement')}
          >
            Raise a procurement request
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Open requests"
          value={formatNumber(figures.open)}
          icon={PackageSearch}
          variant={figures.open > 0 ? 'warning' : 'default'}
          caption="Neither closed nor rejected"
          loading={loading}
        />
        <StatCard
          label="Committed value"
          value={formatNaira(figures.committed, { compact: true })}
          icon={CircleDollarSign}
          caption="Actual where quoted, estimate where not"
          loading={loading}
        />
        <StatCard
          label="Awaiting a quote"
          value={formatNumber(figures.awaitingQuote)}
          icon={FileText}
          variant={figures.awaitingQuote > 0 ? 'warning' : 'default'}
          caption="Approved, with no vendor chosen"
          loading={loading}
        />
        <StatCard
          label="Delivered, unpaid"
          value={formatNumber(figures.unpaid)}
          icon={Truck}
          variant={figures.unpaid > 0 ? 'warning' : 'default'}
          caption="Goods received, vendor still owed"
          loading={loading}
        />
      </div>

      <Card className="mt-4">
        <CardBody>
          <p className="text-label-11 text-text-label">The procurement flow</p>
          <ol className="mt-3 flex flex-wrap items-stretch gap-2">
            {phaseFigures.map(({ phase, count, value }, index) => (
              <li key={phase.id} className="flex items-stretch gap-2">
                <button
                  type="button"
                  onClick={() => set('phase', phaseFilter === phase.id ? undefined : phase.id)}
                  aria-pressed={phaseFilter === phase.id}
                  className={`min-w-[170px] rounded-xl border px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    phaseFilter === phase.id
                      ? 'border-accent bg-accent-subtle'
                      : 'border-border bg-surface hover:bg-surface-sunken'
                  }`}
                >
                  <span className="block text-label-11 text-text-label">{phase.label}</span>
                  <span className="mt-0.5 block text-heading-18 tabular-nums text-text">
                    {formatNumber(count)}
                  </span>
                  <span className="block text-body-12 text-text-secondary">
                    {formatNaira(value, { compact: true })}
                  </span>
                </button>
                {index < phaseFigures.length - 1 && (
                  <span className="flex items-center text-text-secondary" aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                )}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-body-12 text-text-secondary">
            A request only moves right when the data behind the next stage exists — an order needs a
            vendor and a quoted cost, a closure needs the asset or expense it produced.
          </p>
        </CardBody>
      </Card>

      {figures.overspend > 0 && (
        <Alert className="mt-4" tone="warning" title="Actual cost has run over estimate">
          {formatNaira(figures.overspend)} more has been spent than was estimated across every request
          with an actual cost recorded. The estimate is never rewritten to match — the variance column
          is what makes the next estimate better.
        </Alert>
      )}

      <Card className="mt-4">
        <CardBody padding="none">
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
              search={q}
              onSearchChange={(v) => set('q', v)}
              searchPlaceholder="Search by ref, item or vendor"
              values={{ stage, category, unit, branch }}
              onFilterChange={set}
              onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
              filters={[
                {
                  key: 'stage',
                  label: 'Stage',
                  options: (Object.keys(STAGE_LABEL) as ProcurementStage[]).map((s) => ({
                    value: s,
                    label: STAGE_LABEL[s],
                  })),
                },
                {
                  key: 'category',
                  label: 'Category',
                  options: categories.map((c) => ({ value: c, label: c })),
                },
                { key: 'unit', label: 'Unit', options: units.map((u) => ({ value: u.id as string, label: u.name })) },
                {
                  key: 'branch',
                  label: 'Branch',
                  options: branches.map((b) => ({ value: b.id as string, label: b.name })),
                },
              ]}
            />
          </TableToolbar>

          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} height={40} rounded="lg" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <EmptyState
                variant="error"
                title="Could not load the procurement register"
                message={error}
                action={<Button onClick={retry}>Retry</Button>}
              />
            </div>
          ) : (
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(r) => r.id as string}
              caption="Procurement requests with stage, vendor, estimated and actual cost, variance and the record that closed them"
              density="compact"
              minWidth={1500}
              activeRowKey={drawerId ?? undefined}
              onRowClick={(r) => set('drawer', r.id as string)}
              empty={
                filtersActive ? (
                  <EmptyState
                    variant="search"
                    title="No requests match these filters"
                    message="Try another stage or category, or clear the search."
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
                    icon={PackageSearch}
                    title="Nothing has been procured"
                    message="Until a request exists, purchases happen in WhatsApp and arrive as receipts nobody can match to an approval."
                    action={
                      <Button onClick={() => navigate('/work/approvals/new?type=procurement')}>
                        Raise a procurement request
                      </Button>
                    }
                  />
                )
              }
            />
          )}
        </CardBody>
      </Card>

      <Drawer
        open={open !== null}
        onClose={() => set('drawer', undefined)}
        title={open ? `${open.ref} · ${open.item}` : 'Procurement request'}
        description={open ? `${STAGE_LABEL[open.stage]} · ${open.category}` : undefined}
        size="md"
        footer={
          open && (
            <>
              {isRejectable(open.stage) && (
                <Button
                  variant="ghost"
                  leftIcon={<Ban size={16} />}
                  onClick={() => {
                    setRejecting(open)
                    setRejectReason('')
                    setRejectTouched(false)
                  }}
                >
                  Reject
                </Button>
              )}
              {open.stage === 'quoting' && (
                <Button variant="secondary" onClick={() => setQuoting(open)}>
                  Attach a quote
                </Button>
              )}
              {needsRecord && (
                <Button variant="secondary" onClick={() => createRecord(open)}>
                  {producesAsset(open) ? 'Create the asset record' : 'Create the expense record'}
                </Button>
              )}
              {drawerCheck?.to && (
                <Button
                  disabled={!drawerCheck.allowed}
                  rightIcon={<ArrowRight size={16} />}
                  onClick={() => advance(open)}
                >
                  Advance to {STAGE_LABEL[drawerCheck.to].toLowerCase()}
                </Button>
              )}
            </>
          )
        }
      >
        {open && (
          <div className="space-y-5">
            {drawerCheck && !drawerCheck.allowed && drawerCheck.reason && (
              <Alert tone={open.stage === 'rejected' ? 'danger' : 'warning'} title="This request cannot move yet">
                {drawerCheck.reason}
              </Alert>
            )}

            <KeyValueList columns={2}>
              <KeyValue label="Item">
                {open.item} × {formatNumber(open.quantity)}
              </KeyValue>
              <KeyValue label="Category">{open.category}</KeyValue>
              <KeyValue label="Estimated cost">{formatNaira(open.estimatedCost)}</KeyValue>
              <KeyValue label="Actual cost">
                {open.actualCost === null ? 'Not yet known' : formatNaira(open.actualCost)}
              </KeyValue>
              <KeyValue label="Unit">{unitName(open.unitId)}</KeyValue>
              <KeyValue label="Branch">{branchName(open.branchId)}</KeyValue>
              <KeyValue label="Requester">{userName(open.requesterUserId)}</KeyValue>
              <KeyValue label="Vendor">{open.vendor ?? 'Not chosen'}</KeyValue>
              <KeyValue label="Approval">
                {drawerApproval ? (
                  <Link
                    to={`/work/approvals/${drawerApproval.id}`}
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    {drawerApproval.ref} · {drawerApproval.status.replace(/_/g, ' ')}
                  </Link>
                ) : (
                  <Link
                    to="/work/approvals/new?type=procurement"
                    className="text-accent underline-offset-2 hover:underline"
                  >
                    Raise one
                  </Link>
                )}
              </KeyValue>
              <KeyValue label="Expected delivery">
                {open.expectedDelivery ? formatDate(open.expectedDelivery) : 'Not scheduled'}
              </KeyValue>
            </KeyValueList>

            {open.stage === 'rejected' && open.archivedReason && (
              <Alert tone="danger" title="Rejected">
                {open.archivedReason}
              </Alert>
            )}

            <div>
              <p className="text-label-11 text-text-label">Stage timeline</p>
              <Timeline className="mt-3" items={timeline} dense />
            </div>

            <div>
              <p className="text-label-11 text-text-label">What closes this request</p>
              <p className="mt-1.5 text-body-13 text-text-secondary">
                {producesAsset(open)
                  ? 'This category produces a durable company asset, so closing it creates an asset record on the register rather than an expense.'
                  : 'This category is consumed rather than held, so closing it creates an expense against the unit rather than an asset.'}
              </p>
              {(open.resultingAssetId || open.resultingExpenseId) && (
                <p className="mt-2 text-body-13 text-text">
                  Recorded as{' '}
                  <span className="font-mono">
                    {(open.resultingAssetId ?? open.resultingExpenseId) as string}
                  </span>
                  .
                </p>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <QuoteModal
        request={quoting}
        onClose={() => setQuoting(null)}
        onSave={(vendor, cost, delivery) => {
          if (!quoting) return
          saveQuote(quoting, vendor, cost, delivery)
          setQuoting(null)
        }}
      />

      <ConfirmDialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        onConfirm={() => {
          setRejectTouched(true)
          if (!rejecting || rejectReason.trim() === '') return
          reject(rejecting, rejectReason.trim())
          setRejecting(null)
        }}
        title={rejecting ? `Reject ${rejecting.ref}?` : ''}
        confirmLabel="Reject this request"
        destructive
        icon={Ban}
      >
        <div className="flex flex-col gap-3 text-body-14 text-text-secondary">
          <p>
            The request stays on the register with a Rejected badge and the reason you give. Nothing is
            removed, and the requester can raise a fresh request rather than reopening this one.
          </p>
          <Field
            label="Reason"
            required
            error={rejectTouched && rejectReason.trim() === '' ? 'A rejection has to say why.' : undefined}
          >
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Budget for the quarter is already committed. Re-raise in January."
            />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  )
}

function QuoteModal({
  request,
  onClose,
  onSave,
}: {
  request: ProcurementRequest | null
  onClose: () => void
  onSave: (vendor: string, cost: Kobo, delivery: string) => void
}) {
  const [vendor, setVendor] = useState('')
  const [cost, setCost] = useState(0)
  const [delivery, setDelivery] = useState('')
  const [touched, setTouched] = useState(false)

  const vendorError = touched && vendor === '' ? 'Choose the vendor the quote came from.' : undefined
  const costError = touched && cost <= 0 ? 'A quote has to carry a price.' : undefined

  const submit = () => {
    setTouched(true)
    if (!request || vendor === '' || cost <= 0) return
    onSave(vendor, asKobo(cost), delivery)
    setVendor('')
    setCost(0)
    setDelivery('')
    setTouched(false)
  }

  const delta = request && cost > 0 ? cost - request.estimatedCost : null

  return (
    <Modal
      open={request !== null}
      onClose={onClose}
      title={request ? `Attach a quote to ${request.ref}` : ''}
      description="The estimate stays as it was raised. The quote is recorded beside it so the variance is visible."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Attach quote</Button>
        </>
      }
    >
      {request && (
        <div className="flex flex-col gap-4">
          <Field label="Vendor" required error={vendorError}>
            <Select
              value={vendor}
              placeholder="Choose a vendor"
              options={VENDORS.map((v) => ({ value: v, label: v }))}
              onChange={(e) => setVendor(e.target.value)}
            />
          </Field>

          <Field
            label="Quoted cost"
            required
            error={costError}
            hint={`Estimated at ${formatNaira(request.estimatedCost)} when the request was raised.`}
          >
            <CurrencyInput
              value={cost === 0 ? null : cost}
              onChange={(kobo) => setCost(kobo ?? 0)}
              invalid={Boolean(costError)}
            />
          </Field>

          {delta !== null && delta !== 0 && (
            <Alert tone={delta > 0 ? 'warning' : 'success'} title="Variance against the estimate">
              {delta > 0
                ? `${formatNaira(delta)} over the estimate. The estimate is not rewritten — the register carries both.`
                : `${formatNaira(Math.abs(delta))} under the estimate.`}
            </Alert>
          )}

          <Field label="Expected delivery" optional>
            <Input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
          </Field>
        </div>
      )}
    </Modal>
  )
}

const STAGE_ORDER_INDEX: Record<ProcurementStage, number> = {
  requested: 0,
  approved: 1,
  quoting: 2,
  ordered: 3,
  received: 4,
  paid: 5,
  closed: 6,
  rejected: -1,
}

const PHASE_ICON: Record<string, LucideIcon> = {
  request: PackageSearch,
  approval: FileText,
  quote: CircleDollarSign,
  purchase: Truck,
  payment: ReceiptText,
  record: Boxes,
}

function addBusinessDays(from: string, days: number): string {
  const date = new Date(`${from}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
