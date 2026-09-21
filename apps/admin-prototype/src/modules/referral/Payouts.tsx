import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Banknote, CheckCheck, Clock, Download, HandCoins, Layers, Plus, SendHorizonal, Trash2 } from 'lucide-react'

import {
  CURRENT_USER_ID,
  TODAY,
  commissionsCollection,
  payoutBatchesCollection,
  referrerProfilesCollection,
  useCollection,
  useRecord,
} from '@/mocks'
import type { Commission, Kobo, PayoutBatch, PayoutLine, PersonId, ReferrerProfile } from '@/mocks/types'
import { useCan } from '@/auth'
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
import { downloadCsv } from '@/lib/view-state'

import {
  BENEFICIARY_LABEL,
  OWED_STATES,
  courseTitle,
  daysBetween,
  daysSinceEarned,
  findRule,
  personName,
  userName,
  waitingTone,
} from './lib'
import { LoadFailed, ModulePage, PayoutsTabs, ReferrerTypeBadge, RuleChip, Screen, SimpleStateBadge, useScreenState } from './parts'
import { approvalBlock, createPayoutBatch, markBatchPaid, payNow, stamp, writeBatchLines } from './writes'
import type { PayNowResult } from './writes'

interface OwedRow {
  personId: PersonId
  name: string
  profile: ReferrerProfile | undefined
  commissions: Commission[]
  payable: Commission[]
  queued: Commission[]
  queuedBatchRef: string | null
  enrolments: number
  owed: Kobo
  oldestEarnedAt: string | null
  waitingDays: number
  needsApproval: boolean
  approvalBlocked: string | null
}

function buildOwedRows(commissions: Commission[], batches: PayoutBatch[], profiles: ReferrerProfile[]): OwedRow[] {
  const byPerson = new Map<PersonId, Commission[]>()
  for (const c of commissions) {
    if (!OWED_STATES.includes(c.state)) continue
    const list = byPerson.get(c.beneficiaryPersonId) ?? []
    list.push(c)
    byPerson.set(c.beneficiaryPersonId, list)
  }
  return [...byPerson.entries()]
    .map(([personId, list]): OwedRow => {
      const queued = list.filter((c) => {
        if (!c.payoutBatchId) return false
        const batch = batches.find((b) => b.id === c.payoutBatchId)
        return batch !== undefined && batch.status !== 'paid'
      })
      const payable = list.filter((c) => !queued.includes(c))
      const earnedDates = list.map((c) => c.earnedAt).filter((d): d is string => Boolean(d)).sort()
      const oldest = earnedDates[0] ?? null
      const blocked = payable.filter((c) => c.state === 'earned').map(approvalBlock).find((b) => b !== null) ?? null
      return {
        personId,
        name: personName(personId),
        profile: profiles.find((p) => p.personId === personId),
        commissions: list,
        payable,
        queued,
        queuedBatchRef: queued.length ? (batches.find((b) => b.id === queued[0].payoutBatchId)?.ref ?? null) : null,
        enrolments: new Set(list.map((c) => c.admissionId)).size,
        owed: list.reduce((acc, c) => acc + c.amount, 0) as Kobo,
        oldestEarnedAt: oldest,
        waitingDays: oldest ? daysBetween(oldest) : 0,
        needsApproval: payable.some((c) => c.state === 'earned'),
        approvalBlocked: blocked,
      }
    })
    .filter((row) => row.owed > 0)
    .sort((a, b) => b.waitingDays - a.waitingDays)
}

function payoutMethodLabel(profile: ReferrerProfile | undefined): string {
  if (!profile) return 'Through payroll'
  const m = profile.payoutMethod
  if (m.kind === 'payroll') return 'Through payroll'
  if (m.kind === 'wallet') return 'Wallet'
  return `${m.bankName ?? 'Bank'}${m.accountLast4 ? ` ••••${m.accountLast4}` : ''}`
}

export default function Payouts() {
  const commissions = useCollection(commissionsCollection)
  const batches = useCollection(payoutBatchesCollection)
  const profiles = useCollection(referrerProfilesCollection)
  const navigate = useNavigate()
  const can = useCan()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:payouts')

  const [paying, setPaying] = useState<OwedRow[] | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)

  const rows = useMemo(() => buildOwedRows(forcedEmpty ? [] : commissions, batches, profiles), [commissions, batches, profiles, forcedEmpty])
  const totalOwed = rows.reduce((acc, r) => acc + r.owed, 0)
  const over30 = rows.filter((r) => r.waitingDays > 30)
  const month = TODAY.slice(0, 7)
  const paidThisMonth = commissions.filter((c) => c.state === 'paid' && c.paidAt?.startsWith(month)).reduce((acc, c) => acc + c.amount, 0)
  const payableRows = rows.filter((r) => r.payable.length > 0 && !r.approvalBlocked)

  const finish = (result: PayNowResult, who: string) => {
    const paidTotal = result.paid.reduce((acc, c) => acc + c.amount, 0)
    if (!result.batch) {
      setNotice({ tone: 'warning', text: `Nothing was paid. ${result.skipped.map((s) => s.reason).join(' ')}` })
      return
    }
    const skipped = result.skipped.length ? ` ${formatNumber(result.skipped.length)} left out: ${[...new Set(result.skipped.map((s) => s.reason))].join(' ')}` : ''
    setNotice({
      tone: result.skipped.length ? 'warning' : 'success',
      text: `Paid ${formatNaira(paidTotal)} to ${who} (${result.batch.ref}).${skipped}`,
    })
  }

  const columns: Array<Column<OwedRow>> = [
    {
      key: 'name',
      header: 'Who',
      pinned: true,
      minWidth: 200,
      cell: (row) => <PersonChip name={row.name} size="sm" />,
      sortValue: (row) => row.name,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <ReferrerTypeBadge type={row.profile?.type ?? 'staff'} />,
      sortValue: (row) => BENEFICIARY_LABEL[row.profile?.type ?? 'staff'],
    },
    {
      key: 'enrolments',
      header: 'For',
      align: 'right',
      accessor: (row) => (
        <span className="tabular-nums">
          {formatNumber(row.enrolments)} enrolment{row.enrolments === 1 ? '' : 's'}
        </span>
      ),
      sortValue: (row) => row.enrolments,
    },
    {
      key: 'owed',
      header: 'Owed',
      align: 'right',
      cell: (row) => <span className="tabular-nums font-semibold text-text">{formatNaira(row.owed)}</span>,
      sortValue: (row) => row.owed,
    },
    {
      key: 'waiting',
      header: 'Waiting',
      minWidth: 160,
      cell: (row) =>
        row.oldestEarnedAt ? (
          <div className="flex flex-col gap-0.5">
            <Badge tone={waitingTone(row.waitingDays)} variant="subtle" size="sm" className="tabular-nums">
              {formatNumber(row.waitingDays)} day{row.waitingDays === 1 ? '' : 's'}
            </Badge>
            <span className="text-body-12 text-text-muted">since {formatDate(row.oldestEarnedAt)}</span>
          </div>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (row) => row.waitingDays,
    },
    {
      key: 'method',
      header: 'Pay by',
      minWidth: 170,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-body-13 text-text">{payoutMethodLabel(row.profile)}</span>
          {row.profile && row.profile.payoutMethod.kind === 'bank_transfer' && !row.profile.payoutMethod.verified && (
            <span className="text-body-12 text-warning-text">account not verified</span>
          )}
        </div>
      ),
      sortValue: (row) => payoutMethodLabel(row.profile),
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      width: 150,
      cell: (row) => {
        if (row.payable.length === 0 && row.queuedBatchRef) {
          return (
            <Link
              to={`/referral/payouts/${row.queued[0].payoutBatchId}`}
              className="text-body-13 text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              In {row.queuedBatchRef}
            </Link>
          )
        }
        const label = row.needsApproval ? 'Approve & pay' : 'Pay'
        return (
          <Tooltip content={row.approvalBlocked ?? ''} disabled={!row.approvalBlocked}>
            <Button
              size="sm"
              variant={row.needsApproval ? 'secondary' : 'primary'}
              disabled={Boolean(row.approvalBlocked)}
              onClick={(e) => {
                e.stopPropagation()
                setPaying([row])
              }}
            >
              {label}
            </Button>
          </Tooltip>
        )
      },
    },
  ]

  return (
    <Screen>
      <ModulePage
        title="Payouts"
        description="Who is owed money right now. Pay one person or everyone, with the bank reference, and it is done."
        actions={
          <>
            {can('referral.payout.view') && (
              <Button variant="ghost" leftIcon={<Layers size={16} />} onClick={() => navigate('/referral/payouts/batches')}>
                Batches
              </Button>
            )}
            <Button
              leftIcon={<HandCoins size={16} />}
              disabled={payableRows.length === 0}
              onClick={() => setPaying(payableRows)}
            >
              Pay all
            </Button>
          </>
        }
      />
      <PayoutsTabs active="owed" />

      {errored && <LoadFailed what="Payouts" onRetry={retry} />}

      {!errored && (
        <>
          {notice && (
            <Alert tone={notice.tone} className="mb-5" onDismiss={() => setNotice(null)}>
              {notice.text}
            </Alert>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label="Owed now"
              value={formatNaira(totalOwed)}
              caption={`to ${formatNumber(rows.length)} ${rows.length === 1 ? 'person' : 'people'}`}
              icon={Banknote}
              variant={totalOwed > 0 ? 'warning' : 'default'}
            />
            <StatCard
              label="Waiting over 30 days"
              value={formatNaira(over30.reduce((acc, r) => acc + r.owed, 0))}
              caption={over30.length ? `${formatNumber(over30.length)} ${over30.length === 1 ? 'person has' : 'people have'} waited too long` : 'Nobody has waited over a month'}
              icon={Clock}
              variant={over30.length ? 'danger' : 'success'}
            />
            <StatCard label="Paid this month" value={formatNaira(paidThisMonth)} caption="Commission paid out since the 1st" icon={CheckCheck} variant="success" />
          </div>

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={6} columns={7} />
            </Card>
          ) : (
            <Card padding="none">
              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.personId}
                density="compact"
                stickyHeader
                caption="People owed commission"
                defaultSort={{ key: 'waiting', direction: 'desc' }}
                onRowClick={(row) => row.profile && navigate(`/referral/referrers/${row.profile.id}?tab=earnings`)}
                empty={
                  <EmptyState
                    icon={HandCoins}
                    title="Nobody is owed anything"
                    message="When a referral pays up, the referrer appears here with the amount and a Pay button."
                    action={
                      <Button variant="secondary" onClick={() => navigate('/referral/payouts/history')}>
                        See history
                      </Button>
                    }
                  />
                }
              />
            </Card>
          )}
        </>
      )}

      <PayModal
        rows={paying}
        onClose={() => setPaying(null)}
        onPaid={(result, who) => {
          finish(result, who)
          setPaying(null)
        }}
      />
    </Screen>
  )
}

function PayModal({
  rows,
  onClose,
  onPaid,
}: {
  rows: OwedRow[] | null
  onClose: () => void
  onPaid: (result: PayNowResult, who: string) => void
}) {
  const [bankReference, setBankReference] = useState('')
  if (!rows) return <Modal open={false} onClose={onClose} />

  const commissions = rows.flatMap((r) => r.payable)
  const total = commissions.reduce((acc, c) => acc + c.amount, 0)
  const toApprove = commissions.filter((c) => c.state === 'earned')
  const single = rows.length === 1
  const who = single ? rows[0].name : `${formatNumber(rows.length)} people`

  return (
    <Modal
      open
      onClose={onClose}
      size={single ? 'md' : 'lg'}
      title={single ? `Pay ${rows[0].name}` : `Pay everyone owed`}
      description={
        toApprove.length
          ? `${formatNumber(toApprove.length)} of these still need approval. Approving and paying happens in one go, against your name.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            leftIcon={<CheckCheck size={16} />}
            disabled={bankReference.trim().length < 4}
            onClick={() => {
              onPaid(payNow(commissions, bankReference.trim().toUpperCase()), who)
              setBankReference('')
            }}
          >
            {toApprove.length ? 'Approve & pay' : 'Pay'} {formatNaira(total)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((row) => (
            <li key={row.personId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
              <span className="flex flex-col">
                <span className="text-body-14 text-text">{row.name}</span>
                <span className="text-body-12 text-text-secondary">
                  {formatNumber(row.enrolments)} enrolment{row.enrolments === 1 ? '' : 's'} · {payoutMethodLabel(row.profile)}
                </span>
              </span>
              <span className="text-body-14 font-semibold tabular-nums text-text">
                {formatNaira(row.payable.reduce((acc, c) => acc + c.amount, 0))}
              </span>
            </li>
          ))}
          {!single && (
            <li className="flex items-center justify-between gap-2 bg-canvas px-4 py-2.5">
              <span className="text-body-14 font-medium text-text">Total</span>
              <span className="text-body-14 font-semibold tabular-nums text-text">{formatNaira(total)}</span>
            </li>
          )}
        </ul>
        <Field label="Bank reference" required hint="The reference from the transfer. It is written on every commission paid.">
          <Input
            value={bankReference}
            onChange={(e) => setBankReference(e.target.value.toUpperCase())}
            placeholder="ZEN/TRF/48211"
            autoFocus
          />
        </Field>
      </div>
    </Modal>
  )
}

export function PayoutBatches() {
  const batches = useCollection(payoutBatchesCollection)
  const commissions = useCollection(commissionsCollection)
  const navigate = useNavigate()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:batches')

  const payable = commissions.filter((c) => c.state === 'payable' && c.payoutBatchId === null)

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
      header: 'People',
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
        return failed ? <span className="tabular-nums text-danger-text">{formatNumber(failed)}</span> : <span className="text-text-secondary">—</span>
      },
      sortValue: (b) => b.lines.filter((l) => l.status === 'failed').length,
    },
    { key: 'status', header: 'Status', cell: (b) => <StatusBadge status={b.status} size="sm" />, sortValue: (b) => b.status },
    { key: 'createdBy', header: 'Created by', accessor: (b) => userName(b.createdBy), sortValue: (b) => userName(b.createdBy) },
  ]

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referrals', to: '/referral' },
          { label: 'Payouts', to: '/referral/payouts' },
          { label: 'Batches' },
        ]}
        title="Payout batches"
        description="Every bank run. Paying from the Owed now screen creates one of these automatically."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/referral/payouts/new')}>
            New batch
          </Button>
        }
      />

      {errored && <LoadFailed what="Payout batches" onRetry={retry} />}

      {!errored &&
        (loading ? (
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
              defaultSort={{ key: 'createdAt', direction: 'desc' }}
              onRowClick={(b) => navigate(`/referral/payouts/${b.id}`)}
              empty={
                <EmptyState
                  icon={HandCoins}
                  title="No batches yet"
                  message={
                    payable.length
                      ? `${formatNaira(payable.reduce((a, c) => a + c.amount, 0))} is ready to pay and not yet in a batch.`
                      : 'A batch appears the first time someone is paid.'
                  }
                  action={
                    <Button variant="secondary" onClick={() => navigate('/referral/payouts')}>
                      Back to owed now
                    </Button>
                  }
                />
              }
            />
          </Card>
        ))}
    </Screen>
  )
}

export function PayoutDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const batch = useRecord(payoutBatchesCollection, id)
  useCollection(commissionsCollection)

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
            { label: 'Referrals', to: '/referral' },
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
      commissionsCollection.update(commission.id, { payoutBatchId: batch!.id, updatedAt: stamp(), updatedBy: CURRENT_USER_ID })
    }
    writeBatchLines(batch!, lines)
    setAdding(false)
    setNotice(`${formatNumber(selected.length)} commissions added to ${batch!.ref}.`)
  }

  function removeLine(line: PayoutLine) {
    for (const commissionId of line.commissionIds) {
      commissionsCollection.update(commissionId, { payoutBatchId: null, updatedAt: stamp(), updatedBy: CURRENT_USER_ID })
    }
    writeBatchLines(batch!, batch!.lines.filter((l) => l.beneficiaryPersonId !== line.beneficiaryPersonId))
    setRemoving(null)
    setNotice(`${personName(line.beneficiaryPersonId)} removed from ${batch!.ref}. Their commissions are still owed.`)
  }

  function exportBankFile() {
    downloadCsv(
      `${batch!.ref}-bank-file.csv`,
      ['Beneficiary name', 'Bank', 'Account number', 'Amount (NGN)', 'Reference'],
      batch!.lines
        .filter((l) => l.status !== 'failed')
        .map((l) => [
          personName(l.beneficiaryPersonId),
          l.bankName,
          `••••${l.accountLast4}`,
          (l.amount / 100).toFixed(2),
          l.bankReference ?? batch!.ref,
        ]),
    )
  }

  const lineColumns: Array<Column<PayoutLine>> = [
    {
      key: 'beneficiary',
      header: 'Who',
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
    { key: 'status', header: 'Status', cell: (line) => <StatusBadge status={line.status} size="sm" />, sortValue: (line) => line.status },
    {
      key: 'reason',
      header: 'Failure reason',
      minWidth: 220,
      cell: (line) => (line.failureReason ? <span className="text-danger-text">{line.failureReason}</span> : <span className="text-text-secondary">—</span>),
      sortValue: (line) => line.failureReason ?? '',
    },
    { key: 'reference', header: 'Bank reference', accessor: (line) => line.bankReference ?? '—', sortValue: (line) => line.bankReference ?? '' },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      cell: (line) =>
        editable ? (
          <Button variant="ghost" size="sm" iconOnly aria-label={`Remove ${personName(line.beneficiaryPersonId)} from this batch`} onClick={() => setRemoving(line)}>
            <Trash2 size={16} />
          </Button>
        ) : null,
    },
  ]

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referrals', to: '/referral' },
          { label: 'Payouts', to: '/referral/payouts' },
          { label: 'Batches', to: '/referral/payouts/batches' },
          { label: batch.ref },
        ]}
        title={batch.ref}
        description={`Scheduled ${formatDate(batch.scheduledDate)} · ${humanize(batch.method)}`}
        meta={<StatusBadge status={batch.status} size="md" />}
        actions={
          <>
            <Button variant="ghost" leftIcon={<Download size={16} />} disabled={batch.lines.length === 0} onClick={exportBankFile}>
              Export bank file
            </Button>
            {editable && (
              <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
                Add commissions
              </Button>
            )}
            {editable && (
              <Button variant="secondary" leftIcon={<SendHorizonal size={16} />} disabled={batch.lines.length === 0} onClick={() => setSubmitting(true)}>
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
          They stay on this batch with the bank's reason. Those commissions are still owed and will be picked up next time.
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total" value={formatNaira(batch.totalAmount)} caption={`${formatNumber(batch.lines.length)} people`} icon={Banknote} />
        <StatCard
          label="Lines add up"
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
          description="One line per person, adding up their commissions in this batch."
          actions={<span className="text-body-13 text-text-secondary">{formatNumber(batch.lines.reduce((a, l) => a + l.commissionIds.length, 0))} commissions</span>}
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
              message="Add the commissions this run should pay."
              action={
                editable ? (
                  <Button leftIcon={<Plus size={16} />} onClick={() => setAdding(true)}>
                    Add commissions
                  </Button>
                ) : undefined
              }
            />
          }
        />
      </Card>

      <div className="mt-6">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/referral/payouts/batches')}>
          Back to batches
        </Button>
      </div>

      <AddCommissionsModal open={adding} onClose={() => setAdding(false)} onAdd={addCommissions} batchRef={batch.ref} />

      <ConfirmDialog
        open={submitting}
        onClose={() => setSubmitting(false)}
        onConfirm={() => {
          payoutBatchesCollection.update(batch.id, { status: 'approved', approvalRequestId: null, updatedAt: stamp(), updatedBy: CURRENT_USER_ID })
          setSubmitting(false)
          setNotice(`${batch.ref} approved for payment. Lines can no longer be changed.`)
        }}
        title={`Submit ${batch.ref} for approval?`}
        confirmLabel="Submit for approval"
        icon={SendHorizonal}
      >
        <p className="text-body-14 text-text-secondary">
          {formatNaira(batch.totalAmount)} across {formatNumber(batch.lines.length)} people goes to Finance. After this, lines cannot be added or removed.
        </p>
      </ConfirmDialog>

      <Modal
        open={marking}
        onClose={() => setMarking(false)}
        title={`Mark ${batch.ref} paid`}
        description="Every line that did not fail is stamped with the bank reference and its commissions become Paid."
        footer={
          <>
            <Button variant="ghost" onClick={() => setMarking(false)}>
              Cancel
            </Button>
            <Button
              disabled={bankReference.trim().length < 4}
              onClick={() => {
                markBatchPaid(batch, bankReference.trim().toUpperCase())
                setMarking(false)
                setNotice(`${batch.ref} marked paid. Every commission in it names the batch and the bank reference.`)
              }}
            >
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
              <span className="tabular-nums">{formatNaira(batch.lines.filter((l) => l.status !== 'failed').reduce((a, l) => a + l.amount, 0))}</span>
            </KeyValue>
          </KeyValueList>
          <Field label="Bank reference" required hint="The reference the bank returned for the bulk transfer. Each line gets it with a suffix.">
            <Input value={bankReference} onChange={(e) => setBankReference(e.target.value.toUpperCase())} placeholder="ZEN/TRF/48211" />
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
            {formatNumber(removing.commissionIds.length)} commissions worth {formatNaira(removing.amount)} leave this batch. They are still owed and nothing is cancelled.
          </p>
        )}
      </ConfirmDialog>
    </Screen>
  )
}

function AddCommissionsModal({ open, onClose, onAdd, batchRef }: { open: boolean; onClose: () => void; onAdd: (selected: Commission[]) => void; batchRef: string }) {
  const commissions = useCollection(commissionsCollection)
  const [selected, setSelected] = useState<string[]>([])

  const eligible = commissions.filter((c) => c.state === 'payable' && c.payoutBatchId === null)
  const chosen = eligible.filter((c) => selected.includes(c.id))
  const runningTotal = chosen.reduce((acc, c) => acc + c.amount, 0)

  const columns: Array<Column<Commission>> = [
    { key: 'ref', header: 'Commission', accessor: (c) => c.ref, sortValue: (c) => c.ref },
    { key: 'beneficiary', header: 'Who', accessor: (c) => personName(c.beneficiaryPersonId), sortValue: (c) => personName(c.beneficiaryPersonId), minWidth: 170 },
    { key: 'rule', header: 'Rate', cell: (c) => <RuleChip rule={findRule(c.ruleId)} />, sortValue: (c) => `${c.ruleKey}${c.ruleVersion}` },
    { key: 'course', header: 'Course', accessor: (c) => courseTitle(c.courseId), sortValue: (c) => courseTitle(c.courseId) },
    {
      key: 'age',
      header: 'Waiting (days)',
      align: 'right',
      cell: (c) => {
        const days = daysSinceEarned(c)
        if (days === null) return <span className="text-text-secondary">—</span>
        return <span className={days > 30 ? 'tabular-nums text-danger-text' : 'tabular-nums'}>{formatNumber(days)}</span>
      },
      sortValue: (c) => daysSinceEarned(c) ?? -1,
    },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (c) => <span className="tabular-nums font-medium">{formatNaira(c.amount)}</span>, sortValue: (c) => c.amount },
    { key: 'state', header: 'State', cell: (c) => <SimpleStateBadge commission={c} />, sortValue: (c) => c.state },
  ]

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Add commissions"
      description={`Approved commissions not already in a batch can be added to ${batchRef}.`}
      footer={
        <>
          <span className="mr-auto text-body-14 text-text-secondary">
            {formatNumber(chosen.length)} selected · <strong className="tabular-nums text-text">{formatNaira(runningTotal)}</strong>
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
        caption="Commissions available for this batch"
        defaultSort={{ key: 'age', direction: 'desc' }}
        empty={<EmptyState title="Nothing is ready to add" message="Approve earned commissions on the Owed now screen first." />}
      />
    </Modal>
  )
}

const SCHEDULE_FILTERS = [
  { value: 'all', label: 'Every schedule' },
  { value: 'monthly', label: 'Monthly rates only' },
  { value: 'weekly', label: 'Weekly rates only' },
  { value: 'per_payroll', label: 'With payroll' },
  { value: 'on_approval', label: 'As approved' },
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
    const batch = createPayoutBatch(included, { method, scheduledDate })
    navigate(`/referral/payouts/${batch.id}`)
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
          onChange={(e) => setDeselected((list) => (e.target.checked ? list.filter((id) => id !== c.id) : [...list, c.id]))}
        />
      ),
    },
    { key: 'ref', header: 'Commission', accessor: (c) => c.ref, sortValue: (c) => c.ref },
    { key: 'beneficiary', header: 'Who', minWidth: 170, accessor: (c) => personName(c.beneficiaryPersonId), sortValue: (c) => personName(c.beneficiaryPersonId) },
    {
      key: 'type',
      header: 'Type',
      cell: (c) => <ReferrerTypeBadge type={profiles.find((p) => p.personId === c.beneficiaryPersonId)?.type ?? 'staff'} />,
      sortValue: (c) => profiles.find((p) => p.personId === c.beneficiaryPersonId)?.type ?? 'staff',
    },
    { key: 'rule', header: 'Rate', cell: (c) => <RuleChip rule={findRule(c.ruleId)} />, sortValue: (c) => `${c.ruleKey}${c.ruleVersion}` },
    {
      key: 'age',
      header: 'Waiting (days)',
      align: 'right',
      cell: (c) => {
        const days = daysSinceEarned(c)
        if (days === null) return <span className="text-text-secondary">—</span>
        return <span className={days > 30 ? 'tabular-nums text-danger-text' : 'tabular-nums'}>{formatNumber(days)}</span>
      },
      sortValue: (c) => daysSinceEarned(c) ?? -1,
    },
    { key: 'amount', header: 'Amount', align: 'right', accessor: (c) => <span className="tabular-nums font-medium">{formatNaira(c.amount)}</span>, sortValue: (c) => c.amount },
  ]

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referrals', to: '/referral' },
          { label: 'Payouts', to: '/referral/payouts' },
          { label: 'Batches', to: '/referral/payouts/batches' },
          { label: 'New batch' },
        ]}
        title="New payout batch"
        description="Choose what to include, check it, then create the batch as a draft."
        meta={
          <Badge tone="accent" variant="subtle" size="md">
            Step {step} of 3
          </Badge>
        }
      />

      <ol className="mb-6 flex flex-wrap items-center gap-2">
        {['Choose', 'Check', 'Confirm'].map((label, index) => (
          <li key={label}>
            <Badge tone={step === index + 1 ? 'accent' : step > index + 1 ? 'success' : 'neutral'} variant="subtle" size="md">
              {index + 1}. {label}
            </Badge>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Card padding="none">
          <CardHeader title="Choose" description="Which approved commissions this batch should include." />
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Payout timing" hint="Matched against the timing on the rate each commission came from.">
                <Select value={schedule} options={SCHEDULE_FILTERS} onChange={(e) => setSchedule(e.target.value)} />
              </Field>
              <Field label="Earned up to" hint="Commissions earned after this date wait for the next batch.">
                <Input type="date" value={upTo} onChange={(e) => setUpTo(e.target.value)} />
              </Field>
              <Field label="Referrer type">
                <Select
                  value={beneficiaryType}
                  options={[{ value: 'all', label: 'Every type' }, ...Object.entries(BENEFICIARY_LABEL).map(([value, label]) => ({ value, label }))]}
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

            <p className={`mt-5 text-body-14 ${candidates.length ? 'text-text-secondary' : 'text-warning-text'}`}>
              {candidates.length
                ? `${formatNumber(candidates.length)} commissions match, worth ${formatNaira(candidates.reduce((a, c) => a + c.amount, 0))}.`
                : 'Nothing matches. Widen the date or timing, or approve some earned commissions first.'}
            </p>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card padding="none">
          <CardHeader
            title="Check"
            description="Untick anything that should wait. It stays owed for the next batch."
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
            caption="Commissions matching these choices"
            defaultSort={{ key: 'age', direction: 'desc' }}
            empty={
              <EmptyState
                title="Nothing matched"
                message="Go back and widen the choices."
                action={
                  <Button variant="secondary" onClick={() => setStep(1)}>
                    Back
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
              <KeyValue label="People" divided>
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
          </CardBody>
        </Card>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => (step === 1 ? navigate('/referral/payouts/batches') : setStep(step - 1))}>
          {step === 1 ? 'Cancel' : 'Back'}
        </Button>
        {step < 3 && (
          <Tooltip content="Nothing matches these choices" disabled={candidates.length > 0}>
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
