/**
 * §3.6 — Commission ledger.
 *
 * The rules this screen exists to make visible:
 *
 *  - Every row names the **rule version** it was computed under, and the chip
 *    opens that version read-only. A commission created in March still says v1.
 *  - Corrections are **records, not edits**. Adjust and Reverse both insert a
 *    new commission that points back at the original; the original keeps its
 *    amount, its state and its payout batch.
 *  - Nothing is hard-deleted.
 *  - An approver cannot approve their own commission. The button is disabled
 *    with a reason, not hidden.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Ban, CheckCheck, Download, MessageSquareWarning, Receipt, Scale, Undo2 } from 'lucide-react'

import {
  CURRENT_USER_ID,
  commissionDisputesCollection,
  commissionRulesCollection,
  commissionsCollection,
  invoicesCollection,
  paymentsCollection,
  TODAY,
  useCollection,
  usersCollection,
} from '@/mocks'
import { commissionId as asCommissionId, disputeId as asDisputeId } from '@/mocks/types'
import type {
  Commission,
  CommissionDispute,
  CommissionState,
  CommissionStateChange,
  Kobo,
} from '@/mocks/types'
import {
  Alert,
  Badge,
  BulkActionBar,
  Button,
  Card,
  CardBody,
  CardHeader,
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
  PersonChip,
  Select,
  SkeletonTable,
  Textarea,
  Timeline,
  Tooltip,
  UnitTag,
  useColumnVisibility,
} from '@/ui'
import type { Column, ColumnCatalogueEntry, FilterValues, TimelineItem } from '@/ui'
import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'

import {
  BASIS_LABEL,
  COMMISSION_STATES,
  ROLE_LABEL,
  ROLE_ON_DEAL,
  STATE_LABEL,
  STATE_TONE,
  branchName,
  courseTitle,
  daysSinceEarned,
  effectiveRange,
  findRule,
  personName,
  ruleCode,
  unitKey,
  unitName,
  userName,
} from './lib'
import { LoadFailed, ModulePage, RoleBadge, RuleChip, Screen, StateBadge, useScreenState } from './parts'

const now = () => `${TODAY}T09:30:00+01:00`

/**
 * Sixteen columns is the full trace, and the full trace is the point of this
 * screen — but not all at once. The eight defaults answer "what is this row,
 * whose is it, and is anything holding it up"; the rest, including the full
 * calculation workings, are one click away in the picker and stay in the URL,
 * so a colleague opens the same view rather than a reset one.
 */
const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Commission', defaultVisible: true, locked: true },
  { key: 'beneficiary', label: 'Beneficiary', defaultVisible: true },
  { key: 'roleOnDeal', label: 'Role on deal', defaultVisible: true },
  { key: 'admission', label: 'Admission', defaultVisible: false },
  { key: 'course', label: 'Course', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'rule', label: 'Rule + version', defaultVisible: true },
  { key: 'basis', label: 'Basis', defaultVisible: false },
  { key: 'basisAmount', label: 'Basis amount', defaultVisible: false },
  { key: 'rate', label: 'Rate', defaultVisible: false },
  { key: 'amount', label: 'Amount', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'eligibilityNote', label: 'Eligibility note', defaultVisible: true },
  { key: 'earnedAt', label: 'Earned date', defaultVisible: true },
  { key: 'approvedBy', label: 'Approved by', defaultVisible: false },
  { key: 'payoutBatch', label: 'Payout batch', defaultVisible: false },
]

function nextCommissionRef(): { id: string; ref: string } {
  const numbers = commissionsCollection
    .all()
    .map((c) => Number(c.ref.split('-').at(-1) ?? 0))
    .filter((n) => Number.isFinite(n))
  const next = Math.max(0, ...numbers) + 1
  const padded = String(next).padStart(4, '0')
  return { id: `com-${padded}`, ref: `COM-2026-${padded}` }
}

export default function Ledger() {
  const commissions = useCollection(commissionsCollection)
  useCollection(commissionRulesCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:ledger')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const [selected, setSelected] = useState<string[]>([])
  const [approving, setApproving] = useState<Commission[] | null>(null)
  const [adjusting, setAdjusting] = useState<Commission | null>(null)
  const [reversing, setReversing] = useState<Commission | null>(null)
  const [disputing, setDisputing] = useState<Commission | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const currentPersonId = usersCollection.find(CURRENT_USER_ID)?.personId ?? null

  const drawerId = params.get('drawer')
  const search = params.get('q') ?? ''
  const values: FilterValues = {
    state: params.get('state') ?? undefined,
    roleOnDeal: params.get('roleOnDeal') ?? undefined,
    ruleKey: params.get('ruleKey') ?? undefined,
    unit: params.get('unit') ?? undefined,
    branch: params.get('branch') ?? undefined,
  }
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const source = forcedEmpty ? [] : commissions

  const rows = useMemo(() => {
    return source.filter((c) => {
      if (values.state && c.state !== values.state) return false
      if (values.roleOnDeal && c.roleOnDeal !== values.roleOnDeal) return false
      if (values.ruleKey && c.ruleKey !== values.ruleKey) return false
      if (values.unit && c.unitId !== values.unit) return false
      if (values.branch && c.branchId !== values.branch) return false
      const day = c.createdAt.slice(0, 10)
      if (from && day < from) return false
      if (to && day > to) return false
      if (search) {
        const haystack = `${c.ref} ${personName(c.beneficiaryPersonId)} ${courseTitle(c.courseId)}`.toLowerCase()
        if (!haystack.includes(search.toLowerCase())) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, values.state, values.roleOnDeal, values.ruleKey, values.unit, values.branch, from, to, search])

  /* The summary strip totals the *current filter*, so it moves as filters move. */
  const totals = COMMISSION_STATES.map((state) => ({
    state,
    count: rows.filter((c) => c.state === state).length,
    amount: rows.filter((c) => c.state === state).reduce((acc, c) => acc + c.amount, 0),
  })).filter((t) => t.count > 0)
  const grandTotal = rows.reduce((acc, c) => acc + c.amount, 0)

  const ruleKeys = [...new Set(commissions.map((c) => c.ruleKey))]
  const units = [...new Set(commissions.map((c) => c.unitId))]
  const branches = [...new Set(commissions.map((c) => c.branchId))]

  const canApprove = (c: Commission): { allowed: boolean; reason: string | null } => {
    if (c.beneficiaryPersonId === currentPersonId) {
      return { allowed: false, reason: 'You are the beneficiary of this commission. A requester cannot approve their own.' }
    }
    if (c.state !== 'earned') {
      return { allowed: false, reason: `Only Earned commissions can be approved. This one is ${STATE_LABEL[c.state]}.` }
    }
    return { allowed: true, reason: null }
  }

  function approve(list: Commission[]) {
    for (const c of list) {
      if (!canApprove(c).allowed) continue
      const change: CommissionStateChange = {
        from: c.state,
        to: 'approved',
        at: now(),
        byUserId: CURRENT_USER_ID,
        note: 'Approved in the commission ledger. An approval request was routed to Finance.',
      }
      commissionsCollection.update(c.id, {
        state: 'approved',
        approvedByUserId: CURRENT_USER_ID,
        approvedAt: now(),
        stateHistory: [...c.stateHistory, change],
        updatedAt: now(),
        updatedBy: CURRENT_USER_ID,
      })
    }
    setSelected([])
    setApproving(null)
    setNotice(`${formatNumber(list.length)} commission${list.length === 1 ? '' : 's'} approved. Amounts were not changed.`)
  }

  function adjust(original: Commission, newAmount: Kobo, reason: string) {
    const delta = (newAmount - original.amount) as Kobo
    const { id, ref } = nextCommissionRef()
    commissionsCollection.insert({
      ...original,
      id: asCommissionId(id),
      ref,
      amount: delta,
      state: original.state,
      eligibilityNote: `Adjustment against ${original.ref}. ${reason}`,
      adjustmentOfCommissionId: original.id,
      reversalOfCommissionId: null,
      reversedByCommissionId: null,
      payoutBatchId: null,
      paidAt: null,
      approvalRequestId: null,
      approvedByUserId: null,
      approvedAt: null,
      stateHistory: [
        {
          from: original.state,
          to: original.state,
          at: now(),
          byUserId: CURRENT_USER_ID,
          note: `Adjustment record created against ${original.ref}: ${reason}`,
        },
      ],
      createdAt: now(),
      createdBy: CURRENT_USER_ID,
      updatedAt: now(),
      updatedBy: CURRENT_USER_ID,
    })
    setAdjusting(null)
    setNotice(
      `${ref} created as an adjustment of ${delta >= 0 ? '+' : '−'}${formatNaira(Math.abs(delta))} against ${original.ref}. ${original.ref} is unchanged.`,
    )
  }

  function reverse(original: Commission, reason: string) {
    const { id, ref } = nextCommissionRef()
    const reversalId = asCommissionId(id)
    commissionsCollection.insert({
      ...original,
      id: reversalId,
      ref,
      amount: -original.amount as Kobo,
      state: 'reversed',
      eligibilityNote: 'Correction record. The original commission is unchanged.',
      reversalOfCommissionId: original.id,
      adjustmentOfCommissionId: null,
      reversedByCommissionId: null,
      reversalReason: reason,
      payoutBatchId: null,
      paidAt: null,
      stateHistory: [
        {
          from: original.state,
          to: 'reversed',
          at: now(),
          byUserId: CURRENT_USER_ID,
          note: `Reversal of ${original.ref}: ${reason}`,
        },
      ],
      createdAt: now(),
      createdBy: CURRENT_USER_ID,
      updatedAt: now(),
      updatedBy: CURRENT_USER_ID,
    })
    commissionsCollection.update(original.id, { reversedByCommissionId: reversalId, updatedAt: now(), updatedBy: CURRENT_USER_ID })
    setReversing(null)
    setNotice(`${ref} created as a reversal of ${original.ref}. ${original.ref} keeps its ${formatNaira(original.amount)} and its state.`)
  }

  function raiseDispute(commission: Commission, category: CommissionDispute['category'], narrative: string) {
    const count = commissionDisputesCollection.all().length + 1
    const ref = `DSP-2026-${String(count).padStart(4, '0')}`
    commissionDisputesCollection.insert({
      id: asDisputeId(`dsp-${String(count).padStart(4, '0')}-${Date.now()}`),
      ref,
      commissionId: commission.id,
      raisedByPersonId: commission.beneficiaryPersonId,
      raisedAt: now(),
      category,
      amountInDispute: commission.amount,
      narrative,
      status: 'open',
      assigneeUserId: CURRENT_USER_ID,
      resolutionNote: null,
      resultingCommissionId: null,
      createdAt: now(),
      createdBy: CURRENT_USER_ID,
      updatedAt: now(),
      updatedBy: CURRENT_USER_ID,
    })
    commissionsCollection.update(commission.id, {
      state: 'disputed',
      stateHistory: [
        ...commission.stateHistory,
        { from: commission.state, to: 'disputed', at: now(), byUserId: CURRENT_USER_ID, note: `Dispute ${ref} raised.` },
      ],
      updatedAt: now(),
      updatedBy: CURRENT_USER_ID,
    })
    setDisputing(null)
    setNotice(`${ref} raised against ${commission.ref}. The commission amount was not changed.`)
  }

  const columns: Array<Column<Commission>> = [
    {
      key: 'ref',
      header: 'Commission',
      pinned: true,
      minWidth: 150,
      cell: (c) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-text">{c.ref}</span>
          {c.reversalOfCommissionId && (
            <span className="text-body-12 text-danger-text">Reversal of {refOf(c.reversalOfCommissionId)}</span>
          )}
          {c.adjustmentOfCommissionId && (
            <span className="text-body-12 text-warning-text">Adjustment of {refOf(c.adjustmentOfCommissionId)}</span>
          )}
        </div>
      ),
      sortValue: (c) => c.ref,
    },
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      minWidth: 170,
      cell: (c) => <PersonChip name={personName(c.beneficiaryPersonId)} size="sm" />,
      sortValue: (c) => personName(c.beneficiaryPersonId),
    },
    {
      key: 'roleOnDeal',
      header: 'Role on deal',
      cell: (c) => <RoleBadge role={c.roleOnDeal} />,
      sortValue: (c) => ROLE_LABEL[c.roleOnDeal],
    },
    { key: 'admission', header: 'Admission', accessor: (c) => c.admissionId, sortValue: (c) => c.admissionId },
    {
      key: 'course',
      header: 'Course',
      minWidth: 160,
      accessor: (c) => courseTitle(c.courseId),
      sortValue: (c) => courseTitle(c.courseId),
    },
    {
      key: 'unit',
      header: 'Unit',
      cell: (c) => {
        const key = unitKey(c.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : <span className="text-text-secondary">{unitName(c.unitId)}</span>
      },
      sortValue: (c) => unitName(c.unitId),
    },
    {
      key: 'rule',
      header: 'Rule + version',
      minWidth: 170,
      cell: (c) => <RuleChip rule={findRule(c.ruleId)} onOpen={() => navigate(`/referral/rules/${c.ruleId}`)} />,
      sortValue: (c) => `${c.ruleKey} ${String(c.ruleVersion).padStart(3, '0')}`,
    },
    {
      key: 'basis',
      header: 'Basis',
      accessor: (c) => BASIS_LABEL[c.basis],
      sortValue: (c) => BASIS_LABEL[c.basis],
    },
    {
      key: 'basisAmount',
      header: 'Basis amount',
      align: 'right',
      accessor: (c) => <span className="tabular-nums">{formatNaira(c.basisAmount)}</span>,
      sortValue: (c) => c.basisAmount,
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      accessor: (c) => (c.rateApplied === null ? 'Flat' : `${c.rateApplied}%`),
      sortValue: (c) => c.rateApplied ?? -1,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (c) => (
        <span className={`tabular-nums font-medium ${c.amount < 0 ? 'text-danger-text' : 'text-text'}`}>
          {formatNaira(c.amount)}
        </span>
      ),
      sortValue: (c) => c.amount,
    },
    {
      key: 'state',
      header: 'State',
      cell: (c) => <StateBadge state={c.state} />,
      sortValue: (c) => COMMISSION_STATES.indexOf(c.state),
    },
    {
      key: 'eligibilityNote',
      header: 'Eligibility note',
      minWidth: 240,
      cell: (c) =>
        c.eligibilityNote ? (
          <span className={c.state === 'pending' || c.state === 'tracked' ? 'text-warning-text' : 'text-text-secondary'}>
            {c.eligibilityNote}
          </span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (c) => c.eligibilityNote ?? '',
    },
    {
      key: 'earnedAt',
      header: 'Earned',
      accessor: (c) => (c.earnedAt ? formatDate(c.earnedAt) : '—'),
      sortValue: (c) => c.earnedAt ?? '',
    },
    {
      key: 'approvedBy',
      header: 'Approved by',
      accessor: (c) => (c.approvedByUserId ? userName(c.approvedByUserId) : '—'),
      sortValue: (c) => (c.approvedByUserId ? userName(c.approvedByUserId) : ''),
    },
    {
      key: 'payoutBatch',
      header: 'Payout batch',
      accessor: (c) => c.payoutBatchId ?? '—',
      sortValue: (c) => c.payoutBatchId ?? '',
    },
  ]

  const visibleColumns = columns.filter((column) => visible.includes(column.key))

  const open = drawerId ? commissionsCollection.find(drawerId) : undefined
  const selectedRows = rows.filter((c) => selected.includes(c.id))
  const approvable = selectedRows.filter((c) => canApprove(c).allowed)

  return (
    <Screen>
      <ModulePage
        tab="commissions"
        title="Commission ledger"
        description="Every commission traces back to the payments that triggered it, the rule version it was computed under, its beneficiary and its approval."
        actions={
          <>
            <ColumnPicker
              catalogue={COLUMN_CATALOGUE}
              visible={visible}
              defaultKeys={defaultKeys}
              onChange={setVisible}
            />
            <Button
              variant="secondary"
              leftIcon={<Download size={16} />}
              onClick={() => setNotice('Not built in this prototype — this would export the filtered ledger as CSV.')}
            >
              Export
            </Button>
          </>
        }
      />

      {errored && <LoadFailed what="The commission ledger" onRetry={retry} />}

      {!errored && (
        <>
          {notice && (
            <Alert tone="success" className="mb-5" onDismiss={() => setNotice(null)}>
              {notice}
            </Alert>
          )}

          <FilterBar
            search={search}
            onSearchChange={(value) => setParam('q', value || undefined)}
            searchPlaceholder="Search by reference, beneficiary or course"
            filters={[
              { key: 'state', label: 'State', options: COMMISSION_STATES.map((s) => ({ value: s, label: STATE_LABEL[s] })) },
              { key: 'roleOnDeal', label: 'Role on deal', options: ROLE_ON_DEAL.map((r) => ({ value: r, label: ROLE_LABEL[r] })) },
              { key: 'ruleKey', label: 'Rule', options: ruleKeys.map((k) => ({ value: k, label: k })) },
              { key: 'unit', label: 'Unit', options: units.map((u) => ({ value: u, label: unitName(u) })) },
              { key: 'branch', label: 'Branch', options: branches.map((b) => ({ value: b, label: branchName(b) })) },
            ]}
            values={values}
            onFilterChange={setParam}
            onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
          >
            <Field label="Created from" layout="inline" className="items-center">
              <Input
                type="date"
                inputSize="sm"
                value={from}
                containerClassName="w-[160px]"
                onChange={(e) => setParam('from', e.target.value || undefined)}
              />
            </Field>
            <Field label="to" layout="inline" className="items-center">
              <Input
                type="date"
                inputSize="sm"
                value={to}
                containerClassName="w-[160px]"
                onChange={(e) => setParam('to', e.target.value || undefined)}
              />
            </Field>
          </FilterBar>

          {/* ---- summary strip, totalled over the current filter ---- */}
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3">
            <span className="text-label-10 text-text-muted">This filter</span>
            <span className="text-body-14 font-semibold tabular-nums text-text">
              {formatNumber(rows.length)} commissions · {formatNaira(grandTotal)}
            </span>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
            {totals.map((t) => (
              <Badge key={t.state} tone={STATE_TONE[t.state]} variant="subtle" size="md" className="tabular-nums">
                {STATE_LABEL[t.state]} {formatNumber(t.count)} · {formatNaira(t.amount, { compact: true })}
              </Badge>
            ))}
          </div>

          {selected.length > 0 && (
            <BulkActionBar count={selected.length} itemNoun="commission" onClearSelection={() => setSelected([])} className="mb-4">
              <Tooltip
                content={
                  approvable.length === selectedRows.length
                    ? 'Route an approval request for each selected commission'
                    : `${selectedRows.length - approvable.length} of these cannot be approved — either they are not Earned, or you are the beneficiary.`
                }
              >
                <Button
                  size="sm"
                  leftIcon={<CheckCheck size={16} />}
                  disabled={approvable.length === 0}
                  onClick={() => setApproving(approvable)}
                >
                  Approve {formatNumber(approvable.length)}
                </Button>
              </Tooltip>
            </BulkActionBar>
          )}

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={10} columns={9} />
            </Card>
          ) : (
            <Card padding="none">
              <DataTable
                data={rows}
                columns={visibleColumns}
                rowKey={(c) => c.id}
                density="compact"
                stickyHeader
                selectable
                selectedKeys={selected}
                onSelectionChange={setSelected}
                caption="Commission ledger"
                defaultSort={{ key: 'earnedAt', direction: 'desc' }}
                onRowClick={(c) => setParam('drawer', c.id)}
                activeRowKey={drawerId ?? undefined}
                empty={
                  commissions.length === 0 || forcedEmpty ? (
                    <EmptyState
                      icon={Receipt}
                      title="No commissions yet"
                      message="Commissions appear when an admission matches a rule version in force on the day it was created. If the rules list is empty, nothing will ever land here."
                      action={
                        <Button variant="secondary" onClick={() => navigate('/referral/rules')}>
                          Open commission rules
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      variant="search"
                      title="No commissions match these filters."
                      message="Widen the state or date range, or clear the filters to see the whole ledger."
                      action={
                        <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                          Clear filters
                        </Button>
                      }
                    />
                  )
                }
              />
            </Card>
          )}
        </>
      )}

      {/* ---------------- the trace drawer ---------------- */}
      <CommissionDrawer
        commission={open}
        onClose={() => setParam('drawer', undefined)}
        onOpenRule={(ruleId) => navigate(`/referral/rules/${ruleId}`)}
        onApprove={(c) => setApproving([c])}
        onAdjust={setAdjusting}
        onReverse={setReversing}
        onDispute={setDisputing}
        canApprove={canApprove}
      />

      {/* ---------------- approve ---------------- */}
      <ConfirmDialog
        open={approving !== null}
        onClose={() => setApproving(null)}
        onConfirm={() => {
          if (approving) approve(approving)
        }}
        title={approving ? `Approve ${formatNumber(approving.length)} commission${approving.length === 1 ? '' : 's'}?` : ''}
        confirmLabel="Approve"
        icon={CheckCheck}
      >
        {approving && (
          <div className="flex flex-col gap-2 text-body-14 text-text-secondary">
            <p>
              {formatNaira(approving.reduce((acc, c) => acc + c.amount, 0))} moves from Earned to Approved and becomes
              eligible for a payout batch.
            </p>
            <p>No amount changes. Approval is recorded against your name and the timestamp.</p>
          </div>
        )}
      </ConfirmDialog>

      <AdjustModal commission={adjusting} onClose={() => setAdjusting(null)} onSubmit={adjust} />
      <ReverseModal commission={reversing} onClose={() => setReversing(null)} onSubmit={reverse} />
      <DisputeModal commission={disputing} onClose={() => setDisputing(null)} onSubmit={raiseDispute} />
    </Screen>
  )
}

function refOf(id: string): string {
  return commissionsCollection.find(id)?.ref ?? id
}

/* -------------------------------------------------------------------------- */
/* The trace drawer                                                           */
/* -------------------------------------------------------------------------- */

function CommissionDrawer({
  commission,
  onClose,
  onOpenRule,
  onApprove,
  onAdjust,
  onReverse,
  onDispute,
  canApprove,
}: {
  commission: Commission | undefined
  onClose: () => void
  onOpenRule: (ruleId: string) => void
  onApprove: (c: Commission) => void
  onAdjust: (c: Commission) => void
  onReverse: (c: Commission) => void
  onDispute: (c: Commission) => void
  canApprove: (c: Commission) => { allowed: boolean; reason: string | null }
}) {
  if (!commission) return <Drawer open={false} onClose={onClose} />

  const rule = findRule(commission.ruleId)
  const invoice = invoicesCollection.find(commission.invoiceId)
  const payments = commission.triggeringPaymentIds
    .map((id) => paymentsCollection.find(id))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
  const approval = canApprove(commission)
  const ageing = daysSinceEarned(commission)
  const reversal = commission.reversedByCommissionId ? commissionsCollection.find(commission.reversedByCommissionId) : undefined

  const timeline: TimelineItem[] = commission.stateHistory.map((change, index) => ({
    id: `${commission.id}-${index}`,
    title: `${STATE_LABEL[change.from]} → ${STATE_LABEL[change.to]}`,
    description: change.note,
    timestamp: change.at,
    tone: toneFor(change.to),
    actor: { name: userName(change.byUserId) },
  }))

  return (
    <Drawer
      open
      onClose={onClose}
      size="xl"
      title={commission.ref}
      description={`${personName(commission.beneficiaryPersonId)} · ${ROLE_LABEL[commission.roleOnDeal]} on ${commission.admissionId}`}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" leftIcon={<MessageSquareWarning size={16} />} onClick={() => onDispute(commission)}>
            Dispute
          </Button>
          <Button variant="secondary" leftIcon={<Scale size={16} />} onClick={() => onAdjust(commission)}>
            Adjust
          </Button>
          <Button
            variant="secondary"
            leftIcon={<Undo2 size={16} />}
            disabled={commission.amount < 0 || commission.reversedByCommissionId !== null}
            onClick={() => onReverse(commission)}
          >
            Reverse
          </Button>
          <Tooltip content={approval.reason ?? 'Approve this commission'} disabled={approval.allowed}>
            <Button leftIcon={<CheckCheck size={16} />} disabled={!approval.allowed} onClick={() => onApprove(commission)}>
              Approve
            </Button>
          </Tooltip>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={commission.state} size="md" />
          <RoleBadge role={commission.roleOnDeal} size="md" />
          <RuleChip rule={rule} onOpen={() => rule && onOpenRule(rule.id)} />
          {ageing !== null && !commission.paidAt && (
            <Badge tone={ageing > 30 ? 'danger' : ageing > 14 ? 'warning' : 'neutral'} variant="subtle" size="md">
              {formatNumber(ageing)} days since earned, unpaid
            </Badge>
          )}
        </div>

        {commission.eligibilityNote && (
          <Alert tone={commission.state === 'pending' || commission.state === 'tracked' ? 'warning' : 'info'} title="Eligibility">
            {commission.eligibilityNote}
          </Alert>
        )}

        {commission.reversalOfCommissionId && (
          <Alert tone="danger" icon={Undo2} title="This is a correction record">
            It reverses {refOf(commission.reversalOfCommissionId)}, which keeps its original amount and its state.{' '}
            {commission.reversalReason}
          </Alert>
        )}

        {reversal && (
          <Alert tone="warning" icon={Undo2} title="This commission has been reversed">
            {reversal.ref} carries {formatNaira(reversal.amount)} against it. This row is unchanged — the reversal is a
            separate record.
          </Alert>
        )}

        {/* ---- the arithmetic ---- */}
        <Card padding="none">
          <CardHeader title="The calculation" description="Shown as arithmetic, from the version in force when it was created." />
          <CardBody>
            <p className="font-mono text-body-15 tabular-nums text-text">
              {formatNaira(commission.basisAmount)}
              {commission.rateApplied !== null ? ` × ${commission.rateApplied}%` : ' → flat amount'} ={' '}
              <strong>{formatNaira(commission.amount)}</strong>
            </p>
            {commission.tierLabel && (
              <p className="mt-1.5 text-body-13 text-text-secondary">Band applied: {commission.tierLabel}</p>
            )}
            <KeyValueList className="mt-4" columns={2}>
              <KeyValue label="Basis" divided>
                {BASIS_LABEL[commission.basis]}
              </KeyValue>
              <KeyValue label="Rule version" divided>
                {rule ? (
                  <button
                    type="button"
                    onClick={() => onOpenRule(rule.id)}
                    className="rounded-sm text-accent underline-offset-2 hover:underline"
                  >
                    {rule.name} v{rule.version} · {effectiveRange(rule)}
                  </button>
                ) : (
                  <span className="text-danger-text">Version {commission.ruleVersion} not found</span>
                )}
              </KeyValue>
              <KeyValue label="Rule reference" divided>
                {rule ? ruleCode(rule) : commission.ruleKey}
              </KeyValue>
              <KeyValue label="Course" divided>
                {courseTitle(commission.courseId)}
              </KeyValue>
              <KeyValue label="Unit" divided>
                {unitName(commission.unitId)}
              </KeyValue>
              <KeyValue label="Branch" divided>
                {branchName(commission.branchId)}
              </KeyValue>
            </KeyValueList>
          </CardBody>
        </Card>

        {/* ---- the money that triggered it ---- */}
        <Card padding="none">
          <CardHeader
            title="The money behind it"
            description="Every commission traces back to real payments. Nothing is earned on a number nobody received."
          />
          <CardBody>
            {invoice && (
              <KeyValueList columns={2}>
                <KeyValue label="Invoice" divided>
                  {invoice.ref}
                </KeyValue>
                <KeyValue label="Invoice total" divided>
                  <span className="tabular-nums">{formatNaira(invoice.total)}</span>
                </KeyValue>
                <KeyValue label="Paid" divided>
                  <span className="tabular-nums">{formatNaira(invoice.paidAmount)}</span>
                </KeyValue>
                <KeyValue label="Balance" divided>
                  <span className={invoice.balance > 0 ? 'tabular-nums text-warning-text' : 'tabular-nums text-success-text'}>
                    {formatNaira(invoice.balance)}
                  </span>
                </KeyValue>
              </KeyValueList>
            )}
            {payments.length > 0 ? (
              <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span className="text-body-13 text-text">
                      {payment.ref} · {formatDateTime(payment.receivedAt)}
                    </span>
                    <span className="flex items-center gap-2">
                      <Badge tone="neutral" variant="subtle" size="sm">
                        {payment.method.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-body-13 font-medium tabular-nums text-text">{formatNaira(payment.amount)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-body-13 text-warning-text">
                No matched payment is linked yet. This commission cannot become payable until money arrives.
              </p>
            )}
          </CardBody>
        </Card>

        {/* ---- approval ---- */}
        <Card padding="none">
          <CardHeader title="Approval" />
          <CardBody>
            <KeyValueList columns={2}>
              <KeyValue label="Approval request" divided>
                {commission.approvalRequestId ?? 'None routed'}
              </KeyValue>
              <KeyValue label="Approved by" divided>
                {commission.approvedByUserId ? userName(commission.approvedByUserId) : 'Not approved'}
              </KeyValue>
              <KeyValue label="Approved at" divided>
                {commission.approvedAt ? formatDateTime(commission.approvedAt) : '—'}
              </KeyValue>
              <KeyValue label="Payout batch" divided>
                {commission.payoutBatchId ?? 'Not in a batch'}
              </KeyValue>
              <KeyValue label="Paid at" divided>
                {commission.paidAt ? formatDateTime(commission.paidAt) : '—'}
              </KeyValue>
              <KeyValue label="Beneficiary" divided>
                <PersonChip name={personName(commission.beneficiaryPersonId)} size="sm" role={ROLE_LABEL[commission.roleOnDeal]} />
              </KeyValue>
            </KeyValueList>
            {!approval.allowed && approval.reason && (
              <Alert tone="warning" icon={Ban} title="Approval blocked" className="mt-4">
                {approval.reason}
              </Alert>
            )}
          </CardBody>
        </Card>

        {/* ---- state history ---- */}
        <Card padding="none">
          <CardHeader title="State history" description="Every transition, with the actor and the timestamp." />
          <CardBody>
            {timeline.length ? (
              <Timeline items={timeline} timeFormat="absolute" dense />
            ) : (
              <p className="text-body-13 text-text-secondary">Created in its current state; no transitions yet.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </Drawer>
  )
}

function toneFor(state: CommissionState): TimelineItem['tone'] {
  if (state === 'paid' || state === 'approved' || state === 'payable') return 'success'
  if (state === 'reversed' || state === 'cancelled') return 'danger'
  if (state === 'pending' || state === 'disputed') return 'warning'
  if (state === 'earned') return 'info'
  return 'neutral'
}

/* -------------------------------------------------------------------------- */
/* Correction modals — every one of these writes a NEW record                  */
/* -------------------------------------------------------------------------- */

function AdjustModal({
  commission,
  onClose,
  onSubmit,
}: {
  commission: Commission | null
  onClose: () => void
  onSubmit: (c: Commission, amount: Kobo, reason: string) => void
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const target = amount ?? commission?.amount ?? 0
  const delta = commission ? target - commission.amount : 0
  const invalidReason = reason.trim().length < 8 ? 'Give a reason of at least eight characters. It is written into the record.' : null

  return (
    <Modal
      open={commission !== null}
      onClose={onClose}
      title={commission ? `Adjust ${commission.ref}` : ''}
      description="The original commission is never edited. An adjustment is a separate record that carries the difference."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!commission || invalidReason !== null || delta === 0}
            onClick={() => commission && onSubmit(commission, target as Kobo, reason.trim())}
          >
            Create adjustment record
          </Button>
        </>
      }
    >
      {commission && (
        <div className="flex flex-col gap-4">
          <KeyValueList>
            <KeyValue label="Original amount" divided>
              <span className="tabular-nums">{formatNaira(commission.amount)}</span>
            </KeyValue>
            <KeyValue label="Adjustment record will carry" divided>
              <span className={`tabular-nums ${delta < 0 ? 'text-danger-text' : 'text-success-text'}`}>
                {delta >= 0 ? '+' : '−'}
                {formatNaira(Math.abs(delta))}
              </span>
            </KeyValue>
            <KeyValue label="Combined" divided>
              <span className="tabular-nums font-semibold">{formatNaira(commission.amount + delta)}</span>
            </KeyValue>
          </KeyValueList>

          <Field label="Corrected total amount" required>
            <CurrencyInput value={amount ?? commission.amount} onChange={setAmount} />
          </Field>
          <Field label="Reason" required error={reason.length > 0 ? (invalidReason ?? undefined) : undefined}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={240}
              showCount
              placeholder="Basis amount was taken before the ₦50,000 discount was applied to the invoice."
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

function ReverseModal({
  commission,
  onClose,
  onSubmit,
}: {
  commission: Commission | null
  onClose: () => void
  onSubmit: (c: Commission, reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const invalid = reason.trim().length < 8 ? 'Give a reason of at least eight characters.' : null

  return (
    <Modal
      open={commission !== null}
      onClose={onClose}
      title={commission ? `Reverse ${commission.ref}` : ''}
      description="A reversal is a new negative record pointing back at the original. Nothing is deleted or rewritten."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!commission || invalid !== null}
            onClick={() => commission && onSubmit(commission, reason.trim())}
          >
            Create reversal record
          </Button>
        </>
      }
    >
      {commission && (
        <div className="flex flex-col gap-4">
          <Alert tone="warning" title="What this will do">
            A new commission of {formatNaira(-commission.amount)} is created against{' '}
            {personName(commission.beneficiaryPersonId)}. {commission.ref} keeps its {formatNaira(commission.amount)},
            its state and its payout batch.
          </Alert>
          <Field label="Reason" required error={reason.length > 0 ? (invalid ?? undefined) : undefined}>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={240}
              showCount
              placeholder="Student withdrew in week two and the fee was refunded in full."
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

const DISPUTE_CATEGORIES: Array<{ value: CommissionDispute['category']; label: string }> = [
  { value: 'wrong_beneficiary', label: 'Wrong beneficiary' },
  { value: 'wrong_amount', label: 'Wrong amount' },
  { value: 'not_paid', label: 'Not paid' },
  { value: 'eligibility_contested', label: 'Eligibility contested' },
  { value: 'attribution_contested', label: 'Attribution contested' },
]

function DisputeModal({
  commission,
  onClose,
  onSubmit,
}: {
  commission: Commission | null
  onClose: () => void
  onSubmit: (c: Commission, category: CommissionDispute['category'], narrative: string) => void
}) {
  const [category, setCategory] = useState<CommissionDispute['category']>('wrong_amount')
  const [narrative, setNarrative] = useState('')
  const invalid = narrative.trim().length < 12 ? 'Describe the dispute in at least twelve characters.' : null

  return (
    <Modal
      open={commission !== null}
      onClose={onClose}
      title={commission ? `Raise a dispute against ${commission.ref}` : ''}
      description="The commission moves to Disputed. Its amount is not changed — a dispute that is upheld produces an adjustment record."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!commission || invalid !== null}
            onClick={() => commission && onSubmit(commission, category, narrative.trim())}
          >
            Raise dispute
          </Button>
        </>
      }
    >
      {commission && (
        <div className="flex flex-col gap-4">
          <Field label="Reason category" required>
            <Select
              value={category}
              options={DISPUTE_CATEGORIES}
              onChange={(e) => setCategory(e.target.value as CommissionDispute['category'])}
            />
          </Field>
          <Field label="What is being disputed" required error={narrative.length > 0 ? (invalid ?? undefined) : undefined}>
            <Textarea
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              rows={4}
              maxLength={400}
              showCount
              placeholder="I introduced this student at the June open day. The referral code on the record is not mine."
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}
