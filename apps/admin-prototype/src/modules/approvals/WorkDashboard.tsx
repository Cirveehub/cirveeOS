import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckSquare,
  ClipboardList,
  Clock,
  FileSignature,
  FileText,
  Laptop,
  PackageSearch,
  Plus,
  Timer,
  TriangleAlert,
  UserCheck,
} from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  PageHeader,
  Skeleton,
  StatCard,
  type Column,
} from '@/ui'
import {
  approvalRequestsCollection,
  approvalsByType,
  approvalsPendingOn,
  companyAssetsCollection,
  departmentsCollection,
  generatedDocumentsCollection,
  medianApprovalDays,
  procurementRequestsCollection,
  tasksCollection,
  useCollection,
  TODAY,
} from '@/mocks'
import type { ApprovalRequest, Task } from '@/mocks'
import { ActingUserSwitch } from './components'
import { BucketBars, ChartLegend, StackedBars, type Series, type StackedRow } from './charts'
import { APPROVAL_TYPE_META, useActingUser, useScreenState, userName, userRoleName } from './shared'

const STATUS_SERIES: Series[] = [
  { key: 'pending', label: 'Pending', className: 'bg-warning-500' },
  { key: 'approved', label: 'Approved', className: 'bg-success-600' },
  { key: 'rejected', label: 'Rejected or withdrawn', className: 'bg-danger-500' },
]

interface ApproverRow {
  userId: string
  name: string
  role: string
  pending: number
  medianDays: number
  breaching: number
}

export default function WorkDashboard() {
  const [params] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const navigate = useNavigate()
  const acting = useActingUser()

  const approvals = useCollection(approvalRequestsCollection)
  const tasks = useCollection(tasksCollection)
  const assets = useCollection(companyAssetsCollection)
  const procurement = useCollection(procurementRequestsCollection)
  const documents = useCollection(generatedDocumentsCollection)
  const departments = useCollection(departmentsCollection)

  const pending = approvals.filter((a) => a.status === 'pending')
  const pendingOnMe = approvalsPendingOn(acting)
  const breaching = pending.filter((a) => a.slaState === 'breached')
  const openTasks = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress' || t.status === 'blocked')
  const overdueTasks = openTasks.filter((t) => t.dueAt !== null && t.dueAt.slice(0, 10) < TODAY)
  const openProcurement = procurement.filter(
    (p) => p.stage !== 'closed' && p.stage !== 'rejected' && p.stage !== 'paid',
  )
  const assetsOnLoan = assets.filter((a) => a.status === 'on_loan')
  const documentsMtd = documents.filter((d) => d.generatedAt.slice(0, 7) === TODAY.slice(0, 7))
  const signaturesOutstanding = documents.filter((d) => d.signatureStatus === 'awaiting')

  const byType: StackedRow[] = useMemo(() => {
    const summary = approvalsByType()
    return summary
      .map((entry) => {
        const rows = approvals.filter((a) => a.type === entry.type)
        const values = {
          pending: rows.filter((a) => a.status === 'pending' || a.status === 'returned_for_information').length,
          approved: rows.filter((a) => a.status === 'approved').length,
          rejected: rows.filter((a) => a.status === 'rejected' || a.status === 'withdrawn' || a.status === 'expired').length,
        }
        return {
          label: APPROVAL_TYPE_META[entry.type].label,
          values,
          total: rows.length,
          href: `/work/approvals?type=${entry.type}`,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [approvals])

  const ageing = useMemo(() => {
    const buckets = [
      { label: '0–1 day', min: 0, max: 24 },
      { label: '1–3 days', min: 24, max: 72 },
      { label: '3–7 days', min: 72, max: 168 },
      { label: '7–14 days', min: 168, max: 336 },
      { label: 'Over 14 days', min: 336, max: Number.POSITIVE_INFINITY },
    ]
    return buckets.map((b) => ({
      label: b.label,
      value: pending.filter((a) => a.ageHours >= b.min && a.ageHours < b.max).length,
      alarming: b.min >= 168,
    }))
  }, [pending])

  const approverRows: ApproverRow[] = useMemo(() => {
    const map = new Map<string, ApprovalRequest[]>()
    for (const request of pending) {
      const key = request.currentApproverUserId
      if (!key) continue
      map.set(key, [...(map.get(key) ?? []), request])
    }
    return [...map.entries()]
      .map(([userId, rows]) => {
        const decided = approvals.filter((a) => a.decidedAt !== null && a.steps.some((s) => s.approverUserId === userId))
        const days = decided
          .map((a) => (Date.parse(a.decidedAt as string) - Date.parse(a.raisedAt)) / 86_400_000)
          .sort((a, b) => a - b)
        return {
          userId,
          name: userName(userId),
          role: userRoleName(userId),
          pending: rows.length,
          medianDays: days.length ? Number(days[Math.floor(days.length / 2)].toFixed(1)) : 0,
          breaching: rows.filter((r) => r.slaState === 'breached').length,
        }
      })
      .sort((a, b) => b.pending - a.pending)
  }, [pending, approvals])

  const taskLoad: StackedRow[] = useMemo(() => {
    const byDept = new Map<string, Task[]>()
    for (const task of openTasks) {
      const key = task.departmentId ?? 'unassigned'
      byDept.set(key, [...(byDept.get(key) ?? []), task])
    }
    return [...byDept.entries()]
      .map(([deptId, rows]) => {
        const overdue = rows.filter((t) => t.dueAt !== null && t.dueAt.slice(0, 10) < TODAY).length
        return {
          label: departments.find((d) => d.id === deptId)?.name ?? 'No department',
          values: { pending: rows.length - overdue, rejected: overdue, approved: 0 },
          total: rows.length,
        }
      })
      .sort((a, b) => b.total - a.total)
  }, [openTasks, departments])

  const approverColumns: Array<Column<ApproverRow>> = [
    { key: 'name', header: 'Approver', accessor: (r) => r.name, sortable: true },
    { key: 'role', header: 'Role', accessor: (r) => r.role, sortable: true },
    { key: 'pending', header: 'Pending', align: 'right', accessor: (r) => r.pending, sortable: true },
    {
      key: 'median',
      header: 'Median time',
      align: 'right',
      accessor: (r) => (r.medianDays > 0 ? `${r.medianDays} days` : '—'),
      sortValue: (r) => r.medianDays,
      sortable: true,
    },
    {
      key: 'breaching',
      header: 'Breaching',
      align: 'right',
      cell: (r) =>
        r.breaching > 0 ? (
          <span className="text-body-13 font-semibold text-danger-text">{r.breaching}</span>
        ) : (
          <span className="text-text-secondary">0</span>
        ),
      sortValue: (r) => r.breaching,
      sortable: true,
    },
  ]

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Work, documents and approvals"
        description="One approval engine for nine request types, plus the tasks, documents, assets and procurement that hang off it."
        breadcrumbs={[{ label: 'Work' }]}
        meta={<ActingUserSwitch />}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/work/approvals/new')}>
            Raise request
          </Button>
        }
      />

      {error && (
        <Alert tone="danger" title="Could not load the work dashboard" className="mt-6" action={<Button size="sm" variant="secondary" onClick={retry}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} height={96} rounded="xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton height={260} rounded="xl" />
            <Skeleton height={260} rounded="xl" />
          </div>
        </div>
      ) : (
        !error && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard
                label="Approvals pending"
                value={pending.length}
                icon={CheckSquare}
                caption="Across every request type"
                onClick={() => navigate('/work/approvals?status=pending')}
              />
              <StatCard
                label="Pending on me"
                value={pendingOnMe.length}
                icon={UserCheck}
                caption={userName(acting)}
                onClick={() => navigate('/work/approvals?pendingOnMe=1')}
              />
              <StatCard
                label="Breaching SLA"
                value={breaching.length}
                variant={breaching.length > 0 ? 'danger' : 'success'}
                icon={TriangleAlert}
                caption="Past the configured hours"
                onClick={() => navigate('/work/approvals?sla=breached')}
              />
              <StatCard
                label="Median approval time"
                value={`${medianApprovalDays()} days`}
                icon={Timer}
                caption="Raised to decided"
              />
              <StatCard
                label="Open tasks"
                value={openTasks.length}
                icon={ClipboardList}
                onClick={() => navigate('/work/tasks?status=open')}
              />
              <StatCard
                label="Overdue tasks"
                value={overdueTasks.length}
                variant={overdueTasks.length > 0 ? 'warning' : 'default'}
                icon={Clock}
                onClick={() => navigate('/work/tasks?overdue=1')}
              />
              <StatCard
                label="Open procurement"
                value={openProcurement.length}
                icon={PackageSearch}
                onClick={() => navigate('/work/procurement')}
              />
              <StatCard
                label="Assets on loan"
                value={assetsOnLoan.length}
                icon={Laptop}
                onClick={() => navigate('/work/assets?status=on_loan')}
              />
              <StatCard
                label="Documents generated"
                value={documentsMtd.length}
                icon={FileText}
                caption="Month to date"
                onClick={() => navigate('/work/documents')}
              />
              <StatCard
                label="Signatures outstanding"
                value={signaturesOutstanding.length}
                variant={signaturesOutstanding.length > 0 ? 'warning' : 'default'}
                icon={FileSignature}
                onClick={() => navigate('/work/documents?signature=awaiting')}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader
                  title="Approvals by type"
                  description="One engine, nine request types. The mix is what proves it is reusable."
                />
                <CardBody>
                  <ChartLegend series={STATUS_SERIES} className="mb-4" />
                  <StackedBars
                    rows={byType}
                    series={STATUS_SERIES}
                    emptyMessage="No approval requests have ever been raised."
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Approval ageing"
                  description="How long the pending queue has been waiting."
                  actions={
                    <Link
                      to="/work/approvals?sla=breached"
                      className="rounded-sm text-body-13 text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover"
                    >
                      Breaching SLA
                    </Link>
                  }
                />
                <CardBody>
                  <BucketBars buckets={ageing} caption="Pending approvals by age bucket" />
                  <p className="mt-4 text-body-12 text-text-secondary">
                    Buckets over seven days are shown in the danger tone and labelled, never colour alone.
                  </p>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Approvals by approver"
                  description="Where the queue is actually sitting."
                />
                <CardBody padding="none">
                  <DataTable
                    data={approverRows}
                    columns={approverColumns}
                    rowKey={(r) => r.userId}
                    caption="Pending approvals grouped by the approver holding them"
                    density="compact"
                    emptyTitle="Nothing is pending"
                    emptyMessage="No approver is holding a request right now."
                    onRowClick={(r) => navigate(`/work/approvals?approver=${r.userId}`)}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Task load by department"
                  description="Open tasks, with the overdue share called out."
                />
                <CardBody>
                  <ChartLegend
                    series={[
                      { key: 'pending', label: 'On time', className: 'bg-warning-500' },
                      { key: 'rejected', label: 'Overdue', className: 'bg-danger-500' },
                    ]}
                    className="mb-4"
                  />
                  <StackedBars
                    rows={taskLoad}
                    series={STATUS_SERIES}
                    emptyMessage="No open tasks. Nothing is waiting on anyone."
                  />
                </CardBody>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  )
}
