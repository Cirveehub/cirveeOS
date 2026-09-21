import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Inbox, Plus } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Skeleton,
  StatusBadge,
  Textarea,
  type Column,
} from '@/ui'
import { approvalRequestsCollection, useCollection } from '@/mocks'
import type { ApprovalRequest } from '@/mocks'
import { formatDate } from '@/lib/format'
import {
  ALL_APPROVAL_TYPES,
  APPROVAL_TYPE_META,
  STATUS_LABEL,
  ageLabel,
  slaIsPaused,
  useActingUser,
  useScreenState,
  userName,
  WorkGroupTabs,
} from './shared'
import { AmountCell } from './components'
import { resubmit, withdraw } from './engine'

export default function Requests() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const navigate = useNavigate()
  const acting = useActingUser()

  const approvals = useCollection(approvalRequestsCollection)
  const [resubmitTarget, setResubmitTarget] = useState<ApprovalRequest | null>(null)
  const [note, setNote] = useState('')
  const [noteError, setNoteError] = useState<string | null>(null)

  const status = params.get('status') ?? ''
  const type = params.get('type') ?? ''

  const mine = useMemo(
    () =>
      approvals
        .filter((a) => a.requesterUserId === acting)
        .filter((a) => !status || a.status === status)
        .filter((a) => !type || a.type === type)
        .sort((a, b) => Date.parse(b.raisedAt) - Date.parse(a.raisedAt)),
    [approvals, acting, status, type],
  )

  const columns: Array<Column<ApprovalRequest>> = [
    { key: 'ref', header: 'Ref', width: 140, accessor: (r) => r.ref, sortable: true, pinned: true },
    {
      key: 'type',
      header: 'Type',
      width: 150,
      cell: (r) => <Badge tone="neutral" size="sm">{APPROVAL_TYPE_META[r.type].label}</Badge>,
      sortValue: (r) => r.type,
      sortable: true,
    },
    { key: 'title', header: 'Title', minWidth: 260, accessor: (r) => r.title, sortable: true },
    { key: 'amount', header: 'Amount', align: 'right', width: 140, cell: (r) => <AmountCell amount={r.amount} />, sortValue: (r) => r.amount ?? -1, sortable: true },
    { key: 'raised', header: 'Raised', width: 120, accessor: (r) => formatDate(r.raisedAt), sortValue: (r) => r.raisedAt, sortable: true },
    { key: 'approver', header: 'Current approver', width: 170, accessor: (r) => userName(r.currentApproverUserId), sortable: true },
    {
      key: 'status',
      header: 'Status',
      width: 180,
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          <StatusBadge status={r.status} label={STATUS_LABEL[r.status]} size="sm" />
          {slaIsPaused(r) && <Badge tone="info" size="sm">SLA paused</Badge>}
        </span>
      ),
      sortValue: (r) => r.status,
      sortable: true,
    },
    { key: 'age', header: 'Age', align: 'right', width: 80, accessor: (r) => ageLabel(r), sortValue: (r) => r.ageHours, sortable: true },
    {
      key: 'lastComment',
      header: 'Last comment',
      minWidth: 280,
      accessor: (r) => r.thread[r.thread.length - 1]?.body ?? '—',
      sortable: false,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 210,
      cell: (r) => (
        <span className="flex items-center gap-1.5">
          {r.status === 'returned_for_information' && (
            <Button
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                setResubmitTarget(r)
                setNote('')
                setNoteError(null)
              }}
            >
              Resubmit
            </Button>
          )}
          {(r.status === 'pending' || r.status === 'returned_for_information') && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                const result = withdraw(r.id as string, acting, 'Withdrawn from my requests.')
                if (result.ok) toast.success(`${r.ref} withdrawn. The row stays visible.`)
                else toast.error(result.reason ?? 'Could not withdraw.')
              }}
            >
              Withdraw
            </Button>
          )}
          {r.status !== 'pending' && r.status !== 'returned_for_information' && (
            <span className="text-body-12 text-text-secondary">Closed</span>
          )}
        </span>
      ),
    },
  ]

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="My requests"
        description={`Everything ${userName(acting)} has raised, on either side of a decision.`}
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'My requests' }]}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/work/approvals/new')}>
            Raise request
          </Button>
        }
      />

      <WorkGroupTabs group="approvals" active="requests" />

      <FilterBar
        className="mt-6"
        values={{ status, type }}
        onFilterChange={(key, value) => {
          const next = new URLSearchParams(params)
          if (!value) next.delete(key)
          else next.set(key, value)
          setParams(next, { replace: true })
        }}
        onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
        filters={[
          {
            key: 'status',
            label: 'Status',
            options: (Object.keys(STATUS_LABEL) as Array<ApprovalRequest['status']>).map((s) => ({
              value: s,
              label: STATUS_LABEL[s],
            })),
          },
          { key: 'type', label: 'Type', options: ALL_APPROVAL_TYPES.map((t) => ({ value: t, label: APPROVAL_TYPE_META[t].label })) },
        ]}
      />

      {loading ? (
        <Card className="mt-4">
          <CardBody className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} height={40} rounded="lg" />
            ))}
          </CardBody>
        </Card>
      ) : error ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState variant="error" title="Could not load your requests" message={error} action={<Button onClick={retry}>Retry</Button>} />
          </CardBody>
        </Card>
      ) : mine.length === 0 ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState
              icon={Inbox}
              title="You have not raised anything."
              message="Expenses, refunds, discounts, leave and procurement all start here. Anything you raise stays in this list, decided or not."
              action={
                <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/work/approvals/new')}>
                  Raise request
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <DataTable
              data={mine}
              columns={columns}
              rowKey={(r) => r.id as string}
              caption="Requests raised by the acting user"
              density="compact"
              minWidth={1500}
              onRowClick={(r) => navigate(`/work/approvals/${r.id}`)}
            />
          </CardBody>
        </Card>
      )}

      <Modal
        open={resubmitTarget !== null}
        onClose={() => setResubmitTarget(null)}
        title="Resubmit this request"
        description={
          resubmitTarget
            ? `${resubmitTarget.ref} goes back to step 1 of its route and the SLA clock resumes from where it paused.`
            : undefined
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setResubmitTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!resubmitTarget) return
                if (!note.trim()) {
                  setNoteError('Say what changed, or the approver is back where they started.')
                  return
                }
                const result = resubmit(resubmitTarget.id as string, acting, note)
                if (!result.ok) {
                  setNoteError(result.reason)
                  return
                }
                setResubmitTarget(null)
                toast.success(`${resubmitTarget.ref} resubmitted. SLA clock resumed.`)
              }}
            >
              Resubmit
            </Button>
          </>
        }
      >
        {resubmitTarget && (
          <p className="mb-3 text-body-13 text-text-secondary">
            Returned with: &ldquo;{resubmitTarget.steps.find((s) => s.state === 'returned')?.comment ?? 'no comment'}&rdquo;
          </p>
        )}
        <Field label="What changed" required error={noteError}>
          <Textarea
            rows={3}
            value={note}
            onChange={(event) => {
              setNote(event.target.value)
              setNoteError(null)
            }}
            invalid={Boolean(noteError)}
            placeholder="Pro-rata recomputed against the attendance record — 2 of 8 sessions attended."
          />
        </Field>
      </Modal>
    </div>
  )
}
