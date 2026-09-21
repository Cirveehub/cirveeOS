/**
 * §3.7 — Payouts.
 *
 * The PRD is explicit: a referral scheme that pays late dies within one cohort.
 * So this is the payout *workflow*, not a payout report — a batch is built from
 * payable commissions, submitted, marked paid against a bank reference, and a
 * failed line stays visible with its reason rather than disappearing.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  CheckCheck,
  Clock,
  Download,
  HandCoins,
  Plus,
  SendHorizonal,
  Trash2,
} from 'lucide-react'

import {
  CURRENT_USER_ID,
  TODAY,
  averageDaysEarnedToPaid,
  commissionsCollection,
  payoutBatchesCollection,
  referrerProfilesCollection,
  useCollection,
  useRecord,
} from '@/mocks'
import { payoutId as asPayoutId } from '@/mocks/types'
import type { Commission, Kobo, PayoutBatch, PayoutLine, PersonId } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  PersonChip,
  Select,
  SkeletonTable,
  StatCard,
  StatusBadge,
  Tooltip,
} from '@/ui'
import type { Column } from '@/ui'
import { formatDate, formatNaira, formatNumber, humanize } from '@/lib/format'

import { BENEFICIARY_LABEL, courseTitle, daysSinceEarned, findRule, personName, unpaidAgeing, userName } from './lib'
import { LoadFailed, ModulePage, RuleChip, Screen, StateBadge, useScreenState } from './parts'

const stamp = () => `${TODAY}T10:00:00+01:00`

/* -------------------------------------------------------------------------- */
/* List                                                                       */
/* -------------------------------------------------------------------------- */

export default function Payouts() {
  const batches = useCollection(payoutBatchesCollection)
  const commissions = useCollection(commissionsCollection)
  const navigate = useNavigate()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:payouts')

  const payable = commissions.filter((c) => c.state === 'payable')
  const payableTotal = payable.reduce((acc, c) => acc + c.amount, 0)
  const avgDays = averageDaysEarnedToPaid()
  const ageing = unpaidAgeing()
  const overdue = ageing.find((b) => b.alarming)

  const columns: Array<Column<PayoutBatch>> = [
    { key: 'ref', header: 'Batch', accessor: (b) => b.ref, sortValue: (b) => b.ref, pinned: true },
    { key: 'createdAt', header: 'Created', accessor: (b) => formatDate(b.createdAt), sortValue: (b) => b.createdAt },
    {
      key: 'scheduledDate',
      header: 'Scheduled',
      accessor: (b) => <span className="tabular-nums">{formatDate(b.scheduledDate)}</span>,
      sortValue: (b) => b.scheduledDate,
    },
    { key: 'method', header: 'Method', accessor: (b) => humanize(b.method), sortValue: (b) => b.method },
    {
      key: 'beneficiaryCount',
      header: 'Beneficiaries',
      align: 'right',
      accessor: (b) => <span className="tabular-nums">{formatNumber(b.lines.length)}</span>,
      sortValue: (b) => b.lines.length,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      accessor: (b) => <span className="tabular-nums font-medium">{formatNaira(b.totalAmount)}</span>,
      sortValue: (b) => b.totalAmount,
    },
    {
      key: 'failed',
      header: 'Failed lines',
      align: 'right',
      cell: (b) => {
        const failed = b.lines.filter((l) => l.status === 'failed').length
        return failed ? (
          <span className="tabular-nums text-danger-text">{formatNumber(failed)}</span>
        ) : (
          <span className="text-text-secondary">—</span>
        )
      },
      sortValue: (b) => b.lines.filter((l) => l.status === 'failed').length,
    },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} size="sm" />, sortValue: (b) => b.status },
    { key: 'createdBy', header: 'Created by', accessor: (b) => userName(b.createdBy), sortValue: (b) => userName(b.createdBy) },
    {
      key: 'approval',
      header: 'Approval',
      accessor: (b) => b.approvalRequestId ?? 'Not submitted',
      sortValue: (b) => b.approvalRequestId ?? '',
    },
  ]

  return (
    <Screen>
      <ModulePage
        tab="payouts"
        title="Payouts"
        description="Approved commission leaves the business in a batch. Nothing is paid outside one, and a failed line stays on the batch with its reason."
        actions={
          <Button leftIcon={<HandCoins size={16} />} onClick={() => navigate('/referral/payouts/new')}>
            New payout run
          </Button>
        }
      />

      {errored && <LoadFailed what="Payout batches" onRetry={retry} />}

      {!errored && (
        <>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Payable, waiting for a batch"
              value={formatNaira(payableTotal)}
              caption={`${formatNumber(payable.length)} commissions approved and eligible`}
              icon={Banknote}
              variant={payable.length ? 'warning' : 'default'}
              onClick={() => navigate('/referral/commissions?state=payable')}
            />
            <StatCard
              label="Average days, earned to paid"
              value={avgDays.toFixed(1)}
              caption="The metric the PRD puts on the dashboard"
              icon={Clock}
              variant={avgDays > 14 ? 'danger' : avgDays > 10 ? 'warning' : 'success'}
            />
            <StatCard
              label="Unpaid over 30 days"
              value={formatNaira(overdue?.amount ?? 0)}
              caption={`${formatNumber(overdue?.count ?? 0)} commissions past thirty days since earned`}
              icon={Clock}
              variant={overdue && overdue.count > 0 ? 'danger' : 'success'}
            />
            <StatCard
              label="Batches"
              value={formatNumber(batches.length)}
              caption={`${formatNumber(batches.filter((b) => b.status === 'draft').length)} open as drafts`}
              icon={HandCoins}
            />
          </div>

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={6} columns={7} />
            </Card>
          ) : (
            <Card padding="none">
              <DataTable
                data={forcedEmpty ? [] : batches}
                columns={columns}
                rowKey={(b) => b.id}
                density="compact"
                caption="Payout batches"
                defaultSort={{ key: 'scheduledDate', direction: 'desc' }}
                onRowClick={(b) => navigate(`/referral/payouts/${b.id}`)}
                empty={
                  <EmptyState
                    icon={HandCoins}
                    title="No payout batch has ever been run"
                    message={
                      payable.length
                        ? `${formatNaira(payableTotal)} is already approved and payable to ${formatNumber(payable.length)} commissions. Nobody has been paid it.`
                        : 'Batches appear once approved commissions are gathered into a run.'
                    }
                    action={
                      <Button leftIcon={<HandCoins size={16} />} onClick={() => navigate('/referral/payouts/new')}>
                        Run the first payout
                      </Button>
                    }
                  />
                }
              />
            </Card>
          )}
        </>
      )}
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

export function PayoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const batch = useRecord(payoutBatchesCollection, id)
  const commissions = useCollection(commissionsCollection)

  const [adding, setAdding] = useState(false)
  const [marking, setMarking] = useState(false)
  const [bankReference, setBankReference] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [removing, setRemoving] = useState<PayoutLine | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (!batch) {
    return (
      <Screen>
        <PageHeader
          breadcrumbs={[
            { label: 'Referral & commission', to: '/referral' },
            { label: 'Payouts', to: '/referral/payouts' },
            { label: 'Not found' },
          ]}
          title="Payout batch not found"
        />
        <Card padding="none">
          <EmptyState
            variant="error"
            title="No batch with that reference"
            message="Batches are never deleted; a missing one means the link is stale."
            action={
              <Button variant="secondary" onClick={() => navigate('/referral/payouts')}>
                Back to payouts
              </Button>
            }
          />
        </Card>
      </Screen>
    )
  }

  const editable = batch.status === 'draft'
  const linesTotal = batch.lines.reduce((acc, l) => acc + l.amount, 0)
  const reconciles = linesTotal === batch.totalAmount

  function writeLines(lines: PayoutLine[], patch: Partial<PayoutBatch> = {}) {
    payoutBatchesCollection.update(batch!.id, {
      lines,
      totalAmount: lines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
      beneficiaryCount: lines.length,
      updatedAt: stamp(),
      updatedBy: CURRENT_USER_ID,
      ...patch,
    })
  }

  function addCommissions(selected: Commission[]) {
    const lines = [...batch!.lines]
    for (const commission of selected) {
      const profile = referrerProfilesCollection.all().find((p) => p.personId === commission.beneficiaryPersonId)
      const existing = lines.findIndex((l) => l.beneficiaryPersonId === commission.beneficiaryPersonId)
      if (existing >= 0) {
        lines[existing] = {
          ...lines[existing],
          commissionIds: [...lines[existing].commissionIds, commission.id],
          amount: (lines[existing].amount + commission.amount) as Kobo,
        }
      } else {
        lines.push({
          beneficiaryPersonId: commission.beneficiaryPersonId,
          commissionIds: [commission.id],
          amount: commission.amount,
          bankName: profile?.payoutMethod.bankName ?? 'GTBank',
          accountLast4: profile?.payoutMethod.accountLast4 ?? '0000',
          status: 'pending',
          failureReason: null,
          bankReference: null,
        })
      }
      commissionsCollection.update(commission.id, {
        payoutBatchId: batch!.id,
        updatedAt: stamp(),
        updatedBy: CURRENT_USER_ID,
      })
    }
    writeLines(lines)
    setAdding(false)
    setNotice(`${formatNumber(selected.length)} commissions added to ${batch!.ref}.`)
  }

  function removeLine(line: PayoutLine) {
    for (const commissionId of line.commissionIds) {
      commissionsCollection.update(commissionId, { payoutBatchId: null, updatedAt: stamp(), updatedBy: CURRENT_USER_ID })
    }
    writeLines(batch!.lines.filter((l) => l.beneficiaryPersonId !== line.beneficiaryPersonId))
    setRemoving(null)
    setNotice(
      `${personName(line.beneficiaryPersonId)} removed from ${batch!.ref}. Their commissions return to Payable — nothing was cancelled.`,
    )
  }

  function markPaid() {
    const lines = batch!.lines.map((line, index) =>
      line.status === 'failed'
        ? line
        : { ...line, status: 'paid' as const, bankReference: `${bankReference}/${String(index + 1).padStart(2, '0')}` },
    )
    for (const line of lines) {
      if (line.status !== 'paid') continue
      for (const commissionId of line.commissionIds) {
        const commission = commissionsCollection.find(commissionId)
        if (!commission) continue
        commissionsCollection.update(commissionId, {
          state: 'paid',
          paidAt: stamp(),
          stateHistory: [
            ...commission.stateHistory,
            {
              from: commission.state,
              to: 'paid',
              at: stamp(),
              byUserId: CURRENT_USER_ID,
              note: `Paid in ${batch!.ref}, bank reference ${line.bankReference}.`,
            },
          ],
          updatedAt: stamp(),
          updatedBy: CURRENT_USER_ID,
        })
      }
    }
    writeLines(lines, { status: lines.some((l) => l.status === 'failed') ? 'partially_failed' : 'paid' })
    setMarking(false)
    setNotice(`${batch!.ref} marked paid. Every commission in it now names the batch and the bank reference.`)
  }

  const lineColumns: Array<Column<PayoutLine>> = [
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      minWidth: 190,
      cell: (line) => <PersonChip name={personName(line.beneficiaryPersonId)} size="sm" />,
      sortValue: (line) => personName(line.beneficiaryPersonId),
    },
    { key: 'bank', header: 'Bank', accessor: (line) => line.bankName, sortValue: (line) => line.bankName },
    {
      key: 'account',
      header: 'Account',
      accessor: (line) => <span className="font-mono">••••{line.accountLast4}</span>,
      sortValue: (line) => line.accountLast4,
    },
    {
      key: 'commissions',
      header: 'Commissions',
      align: 'right',
      accessor: (line) => <span className="tabular-nums">{formatNumber(line.commissionIds.length)}</span>,
      sortValue: (line) => line.commissionIds.length,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (line) => <span className="tabular-nums font-medium">{formatNaira(line.amount)}</span>,
      sortValue: (line) => line.amount,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (line) => <StatusBadge status={line.status} size="sm" />,
      sortValue: (line) => line.status,
    },
    {
      key: 'reason',
      header: 'Failure reason',
      minWidth: 220,
      cell: (line) =>
        line.failureReason ? (
          <span className="text-danger-text">{line.failureReason}</span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (line) => line.failureReason ?? '',
    },
    {
      key: 'reference',
      header: 'Bank reference',
      accessor: (line) => line.bankReference ?? '—',
      sortValue: (line) => line.bankReference ?? '',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      cell: (line) =>
        editable ? (
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            aria-label={`Remove ${personName(line.beneficiaryPersonId)} from this batch`}
            onClick={() => setRemoving(line)}
          >
            <Trash2 size={16} />
          </Button>
        ) : null,
    },
  ]

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referral & commission', to: '/referral' },
          { label: 'Payouts', to: '/referral/payouts' },
          { label: batch.ref },
        ]}
        title={batch.ref}
        description={`Scheduled ${formatDate(batch.scheduledDate)} · ${humanize(batch.method)}`}
        meta={<StatusBadge status={batch.status} size="md" />}
        actions={
          <>
            <Button
              variant="ghost"
              leftIcon={<Download size={16} />}
              onClick={() => setNotice('Not built in this prototype — this would download a Nigerian bank bulk-transfer CSV.')}
            >
              Export bank file
            </Button>
            {editable && (
              <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
                Add eligible commissions
              </Button>
            )}
            {editable && (
              <Button
                variant="secondary"
                leftIcon={<SendHorizonal size={16} />}
                disabled={batch.lines.length === 0}
                onClick={() => setSubmitting(true)}
              >
                Submit for approval
              </Button>
            )}
            {(batch.status === 'approved' || batch.status === 'processing' || batch.status === 'partially_failed') && (
              <Button leftIcon={<CheckCheck size={16} />} onClick={() => setMarking(true)}>
                Mark paid
              </Button>
            )}
          </>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-5" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {batch.lines.some((l) => l.status === 'failed') && (
        <Alert tone="danger" title="Some lines failed at the bank" className="mb-5">
          Failed lines stay on the batch with the bank's reason. They are not silently retried and not removed — the
          commission stays payable until a later batch clears it.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={formatNaira(batch.totalAmount)} caption={`${formatNumber(batch.lines.length)} beneficiaries`} icon={Banknote} />
        <StatCard
          label="Lines reconcile"
          value={formatNaira(linesTotal)}
          caption={reconciles ? 'Lines sum exactly to the batch total' : 'Lines do not sum to the batch total'}
          variant={reconciles ? 'success' : 'danger'}
        />
        <StatCard
          label="Paid"
          value={formatNaira(batch.lines.filter((l) => l.status === 'paid').reduce((a, l) => a + l.amount, 0))}
          caption={`${formatNumber(batch.lines.filter((l) => l.status === 'paid').length)} lines settled`}
          variant="success"
        />
        <StatCard
          label="Failed"
          value={formatNaira(batch.lines.filter((l) => l.status === 'failed').reduce((a, l) => a + l.amount, 0))}
          caption={`${formatNumber(batch.lines.filter((l) => l.status === 'failed').length)} lines returned`}
          variant={batch.lines.some((l) => l.status === 'failed') ? 'danger' : 'default'}
        />
      </div>

      <Card padding="none">
        <CardHeader
          title="Lines"
          description="One line per beneficiary, aggregating their commissions in this batch."
          actions={
            <span className="text-body-13 text-text-secondary">
              {formatNumber(batch.lines.reduce((a, l) => a + l.commissionIds.length, 0))} commissions
            </span>
          }
        />
        <DataTable
          data={batch.lines}
          columns={lineColumns}
          rowKey={(line) => line.beneficiaryPersonId}
          density="compact"
          caption={`Payout lines in ${batch.ref}`}
          defaultSort={{ key: 'amount', direction: 'desc' }}
          empty={
            <EmptyState
              title="This batch has no lines yet"
              message="Add the approved and payable commissions this run should clear."
              action={
                editable ? (
                  <Button leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
                    Add eligible commissions
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <div className="mt-6">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/referral/payouts')}>
          Back to payouts
        </Button>
      </div>

      <AddCommissionsModal open={adding} onClose={() => setAdding(false)} onAdd={addCommissions} batchRef={batch.ref} />

      <ConfirmDialog
        open={submitting}
        onClose={() => setSubmitting(false)}
        onConfirm={() => {
          payoutBatchesCollection.update(batch.id, {
            status: 'approved',
            approvalRequestId: null,
            updatedAt: stamp(),
            updatedBy: CURRENT_USER_ID,
          })
          setSubmitting(false)
          setNotice(`${batch.ref} submitted and approved for payment. It can no longer be edited.`)
        }}
        title={`Submit ${batch.ref} for approval?`}
        confirmLabel="Submit for approval"
        icon={SendHorizonal}
      >
        <p className="text-body-14 text-text-secondary">
          {formatNaira(batch.totalAmount)} across {formatNumber(batch.lines.length)} beneficiaries goes to Finance. Once
          submitted, lines can no longer be added or removed — a correction after that point is a new batch.
        </p>
      </ConfirmDialog>

      <Modal
        open={marking}
        onClose={() => setMarking(false)}
        title={`Mark ${batch.ref} paid`}
        description="Every non-failed line is stamped with the bank reference and its commissions move to Paid."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMarking(false)}>
              Cancel
            </Button>
            <Button disabled={bankReference.trim().length < 4} onClick={markPaid}>
              Mark paid
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <KeyValueList>
            <KeyValue label="Lines to settle" divided>
              <span className="tabular-nums">{formatNumber(batch.lines.filter((l) => l.status !== 'failed').length)}</span>
            </KeyValue>
            <KeyValue label="Amount" divided>
              <span className="tabular-nums">
                {formatNaira(batch.lines.filter((l) => l.status !== 'failed').reduce((a, l) => a + l.amount, 0))}
              </span>
            </KeyValue>
          </KeyValueList>
          <Field
            label="Bank reference"
            required
            hint="The reference the bank returned for the bulk transfer. Each line gets it with a suffix."
          >
            <Input
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value.toUpperCase())}
              placeholder="ZEN/TRF/48211"
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) removeLine(removing)
        }}
        title={removing ? `Remove ${personName(removing.beneficiaryPersonId)} from this batch?` : ''}
        confirmLabel="Remove the line"
        destructive
        icon={Trash2}
      >
        {removing && (
          <p className="text-body-14 text-text-secondary">
            {formatNumber(removing.commissionIds.length)} commissions worth {formatNaira(removing.amount)} return to
            Payable. Nothing is cancelled and no commission is edited — they simply leave this batch.
          </p>
        )}
      </ConfirmDialog>
    </Screen>
  )
}

function AddCommissionsModal({
  open,
  onClose,
  onAdd,
  batchRef,
}: {
  open: boolean
  onClose: () => void
  onAdd: (selected: Commission[]) => void
  batchRef: string
}) {
  const commissions = useCollection(commissionsCollection)
  const [selected, setSelected] = useState<string[]>([])

  const eligible = commissions.filter((c) => c.state === 'payable' && c.payoutBatchId === null)
  const chosen = eligible.filter((c) => selected.includes(c.id))
  const runningTotal = chosen.reduce((acc, c) => acc + c.amount, 0)

  const columns: Array<Column<Commission>> = [
    { key: 'ref', header: 'Commission', accessor: (c) => c.ref, sortValue: (c) => c.ref },
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      accessor: (c) => personName(c.beneficiaryPersonId),
      sortValue: (c) => personName(c.beneficiaryPersonId),
      minWidth: 170,
    },
    {
      key: 'rule',
      header: 'Rule',
      cell: (c) => <RuleChip rule={findRule(c.ruleId)} />,
      sortValue: (c) => `${c.ruleKey}${c.ruleVersion}`,
    },
    { key: 'course', header: 'Course', accessor: (c) => courseTitle(c.courseId), sortValue: (c) => courseTitle(c.courseId) },
    {
      key: 'age',
      header: 'Days since earned',
      align: 'right',
      cell: (c) => {
        const days = daysSinceEarned(c)
        if (days === null) return <span className="text-text-secondary">—</span>
        return <span className={days > 30 ? 'tabular-nums text-danger-text' : 'tabular-nums'}>{formatNumber(days)}</span>
      },
      sortValue: (c) => daysSinceEarned(c) ?? -1,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (c) => <span className="tabular-nums font-medium">{formatNaira(c.amount)}</span>,
      sortValue: (c) => c.amount,
    },
    { key: 'state', header: 'State', cell: (c) => <StateBadge state={c.state} />, sortValue: (c) => c.state },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Add eligible commissions"
      description={`Only Approved and Payable commissions not already in a batch can be added to ${batchRef}.`}
      footer={
        <>
          <span className="mr-auto text-body-14 text-text-secondary">
            {formatNumber(chosen.length)} selected ·{' '}
            <strong className="tabular-nums text-text">{formatNaira(runningTotal)}</strong>
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={chosen.length === 0} onClick={() => onAdd(chosen)}>
            Add {formatNumber(chosen.length)} to the batch
          </Button>
        </>
      }
    >
      <DataTable
        data={eligible}
        columns={columns}
        rowKey={(c) => c.id}
        density="compact"
        selectable
        selectedKeys={selected}
        onSelectionChange={setSelected}
        maxHeight={380}
        stickyHeader
        caption="Payable commissions available for this batch"
        defaultSort={{ key: 'age', direction: 'desc' }}
        empty={
          <EmptyState
            title="Nothing is payable right now"
            message="A commission becomes payable once its eligibility conditions are met and it has been approved."
          />
        }
      />
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* New payout run — the three-step wizard                                     */
/* -------------------------------------------------------------------------- */

const SCHEDULE_FILTERS = [
  { value: 'all', label: 'Every schedule' },
  { value: 'monthly', label: 'Monthly rules only' },
  { value: 'weekly', label: 'Weekly rules only' },
  { value: 'per_payroll', label: 'Per payroll run' },
  { value: 'on_approval', label: 'On approval' },
]

export function NewPayout() {
  const navigate = useNavigate()
  const commissions = useCollection(commissionsCollection)
  const profiles = useCollection(referrerProfilesCollection)
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(1)
  const [schedule, setSchedule] = useState(searchParams.get('schedule') ?? 'all')
  const [upTo, setUpTo] = useState(TODAY)
  const [beneficiaryType, setBeneficiaryType] = useState('all')
  const [method, setMethod] = useState<'bank_transfer' | 'payroll'>('bank_transfer')
  const [scheduledDate, setScheduledDate] = useState(TODAY)
  const [deselected, setDeselected] = useState<string[]>([])

  const candidates = useMemo(() => {
    return commissions.filter((c) => {
      if (c.state !== 'payable' || c.payoutBatchId !== null) return false
      if (c.earnedAt && c.earnedAt.slice(0, 10) > upTo) return false
      const rule = findRule(c.ruleId)
      if (schedule !== 'all' && rule && rule.payoutSchedule !== schedule) return false
      if (beneficiaryType !== 'all') {
        const profile = profiles.find((p) => p.personId === c.beneficiaryPersonId)
        if (!profile || profile.type !== beneficiaryType) return false
      }
      return true
    })
  }, [commissions, profiles, schedule, upTo, beneficiaryType])

  const included = candidates.filter((c) => !deselected.includes(c.id))
  const total = included.reduce((acc, c) => acc + c.amount, 0)
  const beneficiaries = new Set(included.map((c) => c.beneficiaryPersonId))

  function create() {
    const numbers = payoutBatchesCollection.all().map((b) => Number(b.ref.split('-').at(-1) ?? 0))
    const next = Math.max(0, ...numbers) + 1
    const ref = `PAY-B-2026-${String(next).padStart(3, '0')}`
    const id = asPayoutId(`payb-${String(next).padStart(3, '0')}`)

    const byPerson = new Map<PersonId, Commission[]>()
    for (const c of included) {
      const list = byPerson.get(c.beneficiaryPersonId) ?? []
      list.push(c)
      byPerson.set(c.beneficiaryPersonId, list)
    }
    const lines: PayoutLine[] = [...byPerson.entries()].map(([personId, list]) => {
      const profile = profiles.find((p) => p.personId === personId)
      return {
        beneficiaryPersonId: personId,
        commissionIds: list.map((c) => c.id),
        amount: list.reduce((acc, c) => acc + c.amount, 0) as Kobo,
        bankName: profile?.payoutMethod.bankName ?? 'GTBank',
        accountLast4: profile?.payoutMethod.accountLast4 ?? '0000',
        status: 'pending',
        failureReason: null,
        bankReference: null,
      }
    })

    payoutBatchesCollection.insert({
      id,
      ref,
      scheduledDate,
      method,
      status: 'draft',
      totalAmount: lines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
      beneficiaryCount: lines.length,
      approvalRequestId: null,
      lines,
      createdAt: stamp(),
      createdBy: CURRENT_USER_ID,
      updatedAt: stamp(),
      updatedBy: CURRENT_USER_ID,
    })
    for (const c of included) {
      commissionsCollection.update(c.id, { payoutBatchId: id, updatedAt: stamp(), updatedBy: CURRENT_USER_ID })
    }
    navigate(`/referral/payouts/${id}`)
  }

  const columns: Array<Column<Commission>> = [
    {
      key: 'include',
      header: 'Include',
      width: 80,
      cell: (c) => (
        <Checkbox
          label=""
          aria-label={`Include ${c.ref} in this run`}
          checked={!deselected.includes(c.id)}
          onChange={(e) =>
            setDeselected((list) => (e.target.checked ? list.filter((id) => id !== c.id) : [...list, c.id]))
          }
        />
      ),
    },
    { key: 'ref', header: 'Commission', accessor: (c) => c.ref, sortValue: (c) => c.ref },
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      minWidth: 170,
      accessor: (c) => personName(c.beneficiaryPersonId),
      sortValue: (c) => personName(c.beneficiaryPersonId),
    },
    {
      key: 'type',
      header: 'Referrer type',
      cell: (c) => {
        const profile = profiles.find((p) => p.personId === c.beneficiaryPersonId)
        return profile ? (
          <Badge tone="neutral" variant="subtle" size="sm">
            {BENEFICIARY_LABEL[profile.type]}
          </Badge>
        ) : (
          <span className="text-text-secondary">Staff</span>
        )
      },
      sortValue: (c) => profiles.find((p) => p.personId === c.beneficiaryPersonId)?.type ?? 'staff',
    },
    {
      key: 'rule',
      header: 'Rule',
      cell: (c) => <RuleChip rule={findRule(c.ruleId)} />,
      sortValue: (c) => `${c.ruleKey}${c.ruleVersion}`,
    },
    {
      key: 'age',
      header: 'Days since earned',
      align: 'right',
      cell: (c) => {
        const days = daysSinceEarned(c)
        if (days === null) return <span className="text-text-secondary">—</span>
        return <span className={days > 30 ? 'tabular-nums text-danger-text' : 'tabular-nums'}>{formatNumber(days)}</span>
      },
      sortValue: (c) => daysSinceEarned(c) ?? -1,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (c) => <span className="tabular-nums font-medium">{formatNaira(c.amount)}</span>,
      sortValue: (c) => c.amount,
    },
  ]

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referral & commission', to: '/referral' },
          { label: 'Payouts', to: '/referral/payouts' },
          { label: 'New payout run' },
        ]}
        title="New payout run"
        description="Choose the criteria, review what it caught, then create the batch as a draft."
        meta={
          <Badge tone="accent" variant="subtle" size="md">
            Step {step} of 3
          </Badge>
        }
      />

      <ol className="mb-6 flex flex-wrap items-center gap-2">
        {['Criteria', 'Review', 'Confirm'].map((label, index) => (
          <li key={label}>
            <Badge tone={step === index + 1 ? 'accent' : step > index + 1 ? 'success' : 'neutral'} variant="subtle" size="md">
              {index + 1}. {label}
            </Badge>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card padding="none">
          <CardHeader title="Criteria" description="Which payable commissions this run should gather." />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Payout schedule" hint="Matched against the schedule on the rule each commission came from.">
                <Select value={schedule} options={SCHEDULE_FILTERS} onChange={(e) => setSchedule(e.target.value)} />
              </Field>
              <Field label="Earned up to" hint="Commissions earned after this date wait for the next run.">
                <Input type="date" value={upTo} onChange={(e) => setUpTo(e.target.value)} />
              </Field>
              <Field label="Beneficiary type">
                <Select
                  value={beneficiaryType}
                  options={[
                    { value: 'all', label: 'Every type' },
                    ...Object.entries(BENEFICIARY_LABEL).map(([value, label]) => ({ value, label })),
                  ]}
                  onChange={(e) => setBeneficiaryType(e.target.value)}
                />
              </Field>
              <Field label="Method">
                <Select
                  value={method}
                  options={[
                    { value: 'bank_transfer', label: 'Bank transfer' },
                    { value: 'payroll', label: 'Through payroll' },
                  ]}
                  onChange={(e) => setMethod(e.target.value as typeof method)}
                />
              </Field>
              <Field label="Scheduled date" hint="When the transfer is expected to leave.">
                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
              </Field>
            </div>

            <Alert tone={candidates.length ? 'info' : 'warning'} className="mt-5">
              {candidates.length
                ? `${formatNumber(candidates.length)} payable commissions match, worth ${formatNaira(candidates.reduce((a, c) => a + c.amount, 0))}.`
                : 'Nothing payable matches these criteria. Widen the date or the schedule — or approve some earned commissions first.'}
            </Alert>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card padding="none">
          <CardHeader
            title="Review"
            description="Untick anything that should wait. Deselecting never cancels a commission — it stays payable for the next run."
            actions={
              <span className="text-body-14 tabular-nums text-text-secondary">
                {formatNumber(included.length)} of {formatNumber(candidates.length)} · {formatNaira(total)}
              </span>
            }
          />
          <DataTable
            data={candidates}
            columns={columns}
            rowKey={(c) => c.id}
            density="compact"
            stickyHeader
            maxHeight={460}
            caption="Commissions caught by these criteria"
            defaultSort={{ key: 'age', direction: 'desc' }}
            empty={
              <EmptyState
                title="Nothing matched"
                message="Go back and widen the criteria."
                action={
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back to criteria
                  </Button>
                }
              />
            }
          />
        </Card>
      )}

      {step === 3 && (
        <Card padding="none">
          <CardHeader title="Confirm" description="A draft batch is created. Nothing leaves the bank until it is approved and marked paid." />
          <CardBody>
            <KeyValueList columns={2}>
              <KeyValue label="Commissions" divided>
                <span className="tabular-nums">{formatNumber(included.length)}</span>
              </KeyValue>
              <KeyValue label="Beneficiaries" divided>
                <span className="tabular-nums">{formatNumber(beneficiaries.size)}</span>
              </KeyValue>
              <KeyValue label="Total" divided>
                <span className="tabular-nums font-semibold">{formatNaira(total)}</span>
              </KeyValue>
              <KeyValue label="Method" divided>
                {humanize(method)}
              </KeyValue>
              <KeyValue label="Scheduled" divided>
                {formatDate(scheduledDate)}
              </KeyValue>
              <KeyValue label="Status on creation" divided>
                <StatusBadge status="draft" size="sm" />
              </KeyValue>
            </KeyValueList>
            <p className="mt-4 text-body-13 text-text-secondary">
              The {formatNumber(included.length)} commissions keep their amounts. They are stamped with the batch
              reference and move to Paid only when the batch is marked paid against a bank reference.
            </p>
          </CardBody>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => (step === 1 ? navigate('/referral/payouts') : setStep(step - 1))}>
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 3 && (
          <Tooltip content="Nothing matches these criteria" disabled={candidates.length > 0}>
            <Button disabled={candidates.length === 0} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          </Tooltip>
        )}
        {step === 3 && (
          <Button disabled={included.length === 0} onClick={create}>
            Create draft batch
          </Button>
        )}
      </div>
    </Screen>
  )
}
