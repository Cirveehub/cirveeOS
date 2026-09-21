import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Gavel, MessageSquareWarning, ShieldQuestion } from 'lucide-react'

import {
  CURRENT_USER_ID,
  TODAY,
  commissionDisputesCollection,
  commissionsCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import { commissionId as asCommissionId } from '@/mocks/types'
import type { CommissionDispute, Kobo } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CurrencyInput,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  KeyValue,
  KeyValueList,
  PersonChip,
  Select,
  SkeletonTable,
  StatusBadge,
  Textarea,
  Timeline,
} from '@/ui'
import type { Column, FilterValues, TimelineItem } from '@/ui'
import { formatDate, formatDateTime, formatNaira, formatNumber, humanize } from '@/lib/format'

import { BASIS_LABEL, STATE_LABEL, courseTitle, findRule, personName, userName } from './lib'
import { LoadFailed, ModulePage, RoleBadge, RuleChip, Screen, SimpleStateBadge, useScreenState } from './parts'

const CATEGORIES: CommissionDispute['category'][] = [
  'wrong_beneficiary',
  'wrong_amount',
  'not_paid',
  'eligibility_contested',
  'attribution_contested',
]

const STATUSES: CommissionDispute['status'][] = ['open', 'under_review', 'upheld', 'rejected', 'withdrawn']

const stamp = () => `${TODAY}T11:00:00+01:00`

export default function Disputes() {
  const disputes = useCollection(commissionDisputesCollection)
  const commissions = useCollection(commissionsCollection)
  const users = useCollection(usersCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:disputes')
  const [notice, setNotice] = useState<string | null>(null)

  const drawerId = params.get('drawer')
  const search = params.get('q') ?? ''
  const values: FilterValues = {
    status: params.get('status') ?? undefined,
    category: params.get('category') ?? undefined,
    assignee: params.get('assignee') ?? undefined,
  }
  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const rows = (forcedEmpty ? [] : disputes).filter((d) => {
    if (values.status && d.status !== values.status) return false
    if (values.category && d.category !== values.category) return false
    if (values.assignee && d.assigneeUserId !== values.assignee) return false
    if (search) {
      const commission = commissionsCollection.find(d.commissionId)
      const haystack = `${d.ref} ${commission?.ref ?? ''} ${personName(d.raisedByPersonId)} ${d.narrative}`.toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  })

  const ageInDays = (d: CommissionDispute) =>
    Math.max(0, Math.floor((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(d.raisedAt)) / 86_400_000))

  const columns: Array<Column<CommissionDispute>> = [
    { key: 'ref', header: 'Dispute', accessor: (d) => d.ref, sortValue: (d) => d.ref, pinned: true },
    {
      key: 'commission',
      header: 'Commission',
      accessor: (d) => commissionsCollection.find(d.commissionId)?.ref ?? d.commissionId,
      sortValue: (d) => commissionsCollection.find(d.commissionId)?.ref ?? '',
    },
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      minWidth: 170,
      cell: (d) => {
        const commission = commissionsCollection.find(d.commissionId)
        return commission ? (
          <PersonChip name={personName(commission.beneficiaryPersonId)} size="sm" />
        ) : (
          <span className="text-text-secondary">—</span>
        )
      },
      sortValue: (d) => personName(commissionsCollection.find(d.commissionId)?.beneficiaryPersonId ?? null),
    },
    {
      key: 'raisedBy',
      header: 'Raised by',
      accessor: (d) => personName(d.raisedByPersonId),
      sortValue: (d) => personName(d.raisedByPersonId),
    },
    { key: 'raisedAt', header: 'Raised', accessor: (d) => formatDate(d.raisedAt), sortValue: (d) => d.raisedAt },
    {
      key: 'category',
      header: 'Reason',
      cell: (d) => (
        <Badge tone="neutral" variant="subtle" size="sm">
          {humanize(d.category)}
        </Badge>
      ),
      sortValue: (d) => d.category,
    },
    {
      key: 'amount',
      header: 'In dispute',
      align: 'right',
      accessor: (d) => <span className="tabular-nums">{formatNaira(d.amountInDispute)}</span>,
      sortValue: (d) => d.amountInDispute,
    },
    { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} size="sm" />, sortValue: (d) => d.status },
    {
      key: 'assignee',
      header: 'Assignee',
      accessor: (d) => (d.assigneeUserId ? userName(d.assigneeUserId) : 'Unassigned'),
      sortValue: (d) => (d.assigneeUserId ? userName(d.assigneeUserId) : ''),
    },
    {
      key: 'age',
      header: 'Age',
      align: 'right',
      cell: (d) => {
        const days = ageInDays(d)
        const openStill = d.status === 'open' || d.status === 'under_review'
        return (
          <span className={openStill && days > 14 ? 'tabular-nums text-danger-text' : 'tabular-nums'}>
            {formatNumber(days)} d
          </span>
        )
      },
      sortValue: (d) => ageInDays(d),
    },
  ]

  const open = drawerId ? disputes.find((d) => d.id === drawerId) : undefined
  const openCount = disputes.filter((d) => d.status === 'open' || d.status === 'under_review').length

  return (
    <Screen>
      <ModulePage
        title="Disputes"
        description="Contested commission. Upholding one produces an adjustment record — the disputed commission is never rewritten."
        meta={
          openCount > 0 ? (
            <Badge tone="warning" variant="subtle" size="md">
              {formatNumber(openCount)} open
            </Badge>
          ) : undefined
        }
      />

      {errored && <LoadFailed what="Disputes" onRetry={retry} />}

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
            searchPlaceholder="Search by dispute, commission or narrative"
            filters={[
              { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: humanize(s) })) },
              { key: 'category', label: 'Reason', options: CATEGORIES.map((c) => ({ value: c, label: humanize(c) })) },
              {
                key: 'assignee',
                label: 'Assignee',
                options: users.slice(0, 30).map((u) => ({ value: u.id, label: personName(u.personId) })),
              },
            ]}
            values={values}
            onFilterChange={setParam}
            onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
          />

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={6} columns={8} />
            </Card>
          ) : (
            <Card padding="none">
              <DataTable
                data={rows}
                columns={columns}
                rowKey={(d) => d.id}
                density="compact"
                stickyHeader
                caption="Commission disputes"
                defaultSort={{ key: 'raisedAt', direction: 'desc' }}
                onRowClick={(d) => setParam('drawer', d.id)}
                activeRowKey={drawerId ?? undefined}
                empty={
                  disputes.length === 0 || forcedEmpty ? (
                    <EmptyState
                      icon={ShieldQuestion}
                      title="No disputes raised"
                      message="Referrers contest a commission from their profile, or an admin raises one from the ledger. A quiet dispute queue usually means the rules are legible."
                      action={
                        <Button variant="secondary" onClick={() => navigate('/referral/commissions')}>
                          Open the ledger
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      variant="search"
                      title="No disputes match these filters."
                      message="Clear the filters to see every dispute, including resolved ones."
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

      <DisputeDrawer
        dispute={open}
        onClose={() => setParam('drawer', undefined)}
        onOpenCommission={(commissionId) => navigate(`/referral/commissions?drawer=${commissionId}`)}
        onResolved={setNotice}
      />
      {/* Keeps the ledger subscription honest when a dispute changes a state. */}
      <span className="sr-only">{formatNumber(commissions.length)} commissions in the ledger</span>
    </Screen>
  )
}

function DisputeDrawer({
  dispute,
  onClose,
  onOpenCommission,
  onResolved,
}: {
  dispute: CommissionDispute | undefined
  onClose: () => void
  onOpenCommission: (commissionId: string) => void
  onResolved: (message: string) => void
}) {
  const users = useCollection(usersCollection)
  const [resolution, setResolution] = useState('')
  const [correctedAmount, setCorrectedAmount] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [comments, setComments] = useState<Array<{ at: string; by: string; body: string }>>([])

  if (!dispute) return <Drawer open={false} onClose={onClose} />

  const commission = commissionsCollection.find(dispute.commissionId)
  const rule = commission ? findRule(commission.ruleId) : undefined
  const resolved = dispute.status === 'upheld' || dispute.status === 'rejected' || dispute.status === 'withdrawn'
  const target = correctedAmount ?? commission?.amount ?? 0
  const delta = commission ? target - commission.amount : 0

  const items: TimelineItem[] = [
    {
      id: 'raised',
      title: `Raised by ${personName(dispute.raisedByPersonId)}`,
      description: dispute.narrative,
      timestamp: dispute.raisedAt,
      tone: 'warning',
    },
    ...comments.map((c, i) => ({
      id: `comment-${i}`,
      title: c.by,
      description: c.body,
      timestamp: c.at,
      tone: 'neutral' as const,
    })),
    ...(dispute.resolutionNote
      ? [
          {
            id: 'resolution',
            title: `Resolved — ${humanize(dispute.status)}`,
            description: dispute.resolutionNote,
            timestamp: dispute.updatedAt,
            tone: dispute.status === 'upheld' ? ('success' as const) : ('danger' as const),
          },
        ]
      : []),
  ]

  function resolve(outcome: 'upheld' | 'rejected') {
    if (!commission) return
    let resultingCommissionId: CommissionDispute['resultingCommissionId'] = null

    if (outcome === 'upheld' && delta !== 0) {
      const numbers = commissionsCollection.all().map((c) => Number(c.ref.split('-').at(-1) ?? 0))
      const next = Math.max(0, ...numbers) + 1
      const padded = String(next).padStart(4, '0')
      resultingCommissionId = asCommissionId(`com-${padded}`)
      commissionsCollection.insert({
        ...commission,
        id: resultingCommissionId,
        ref: `COM-2026-${padded}`,
        amount: delta as Kobo,
        eligibilityNote: `Adjustment from dispute ${dispute!.ref}. ${resolution}`,
        adjustmentOfCommissionId: commission.id,
        reversalOfCommissionId: null,
        reversedByCommissionId: null,
        payoutBatchId: null,
        paidAt: null,
        approvalRequestId: null,
        approvedByUserId: null,
        approvedAt: null,
        stateHistory: [
          {
            from: commission.state,
            to: commission.state,
            at: stamp(),
            byUserId: CURRENT_USER_ID,
            note: `Adjustment created from dispute ${dispute!.ref}.`,
          },
        ],
        createdAt: stamp(),
        createdBy: CURRENT_USER_ID,
        updatedAt: stamp(),
        updatedBy: CURRENT_USER_ID,
      })
    }

    commissionDisputesCollection.update(dispute!.id, {
      status: outcome,
      resolutionNote: resolution,
      resultingCommissionId,
      updatedAt: stamp(),
      updatedBy: CURRENT_USER_ID,
    })

    const previous = commission.stateHistory.filter((h) => h.to !== 'disputed').at(-1)?.to ?? 'earned'
    commissionsCollection.update(commission.id, {
      state: previous,
      stateHistory: [
        ...commission.stateHistory,
        {
          from: 'disputed',
          to: previous,
          at: stamp(),
          byUserId: CURRENT_USER_ID,
          note: `Dispute ${dispute!.ref} ${outcome}. ${resolution}`,
        },
      ],
      updatedAt: stamp(),
      updatedBy: CURRENT_USER_ID,
    })

    onResolved(
      outcome === 'upheld' && delta !== 0
        ? `${dispute!.ref} upheld. An adjustment of ${delta >= 0 ? '+' : '−'}${formatNaira(Math.abs(delta))} was created against ${commission.ref}, which keeps its original amount.`
        : `${dispute!.ref} ${outcome}. ${commission.ref} is unchanged.`,
    )
    setResolution('')
    setCorrectedAmount(null)
    onClose()
  }

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={dispute.ref}
      description={`${humanize(dispute.category)} · ${formatNaira(dispute.amountInDispute)} in dispute`}
      footer={
        resolved ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" disabled={resolution.trim().length < 10} onClick={() => resolve('rejected')}>
              Reject with reason
            </Button>
            <Button leftIcon={<Gavel size={16} />} disabled={resolution.trim().length < 10} onClick={() => resolve('upheld')}>
              Uphold and adjust
            </Button>
          </div>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={dispute.status} size="md" />
          {commission && <SimpleStateBadge commission={commission} size="md" />}
          {commission && <RoleBadge role={commission.roleOnDeal} size="md" />}
          <RuleChip rule={rule} onOpen={() => commission && onOpenCommission(commission.id)} />
        </div>

        {commission ? (
          <Card padding="none">
            <CardHeader
              title="The commission under dispute"
              description="Shown exactly as computed. Nothing on this record changes as a result of the dispute."
              actions={
                <Button size="sm" variant="ghost" onClick={() => onOpenCommission(commission.id)}>
                  Open full trace
                </Button>
              }
            />
            <CardBody>
              <p className="font-mono text-body-15 tabular-nums text-text">
                {formatNaira(commission.basisAmount)}
                {commission.rateApplied !== null ? ` × ${commission.rateApplied}%` : ' → flat amount'} ={' '}
                <strong>{formatNaira(commission.amount)}</strong>
              </p>
              <KeyValueList className="mt-4" columns={2}>
                <KeyValue label="Commission" divided>
                  {commission.ref}
                </KeyValue>
                <KeyValue label="Beneficiary" divided>
                  {personName(commission.beneficiaryPersonId)}
                </KeyValue>
                <KeyValue label="Rule version" divided>
                  {rule ? `${rule.name} v${rule.version}` : `v${commission.ruleVersion}`}
                </KeyValue>
                <KeyValue label="Basis" divided>
                  {BASIS_LABEL[commission.basis]}
                </KeyValue>
                <KeyValue label="Course" divided>
                  {courseTitle(commission.courseId)}
                </KeyValue>
                <KeyValue label="State" divided>
                  {STATE_LABEL[commission.state]}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>
        ) : (
          <Alert tone="danger" title="The disputed commission is missing">
            The dispute references a commission that is not in the ledger. That is a broken link, not a deletion —
            commissions are never removed.
          </Alert>
        )}

        <Card padding="none">
          <CardHeader title="Narrative and comments" />
          <CardBody>
            <Timeline items={items} timeFormat="absolute" dense />
            {!resolved && (
              <div className="mt-4 flex flex-col gap-2">
                <Field label="Add a comment">
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    maxLength={300}
                    placeholder="Checked the payment log — the transfer bounced on 14 Aug and was never re-queued."
                  />
                </Field>
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={comment.trim().length < 4}
                    onClick={() => {
                      setComments((list) => [
                        ...list,
                        { at: stamp(), by: userName(CURRENT_USER_ID), body: comment.trim() },
                      ])
                      setComment('')
                    }}
                  >
                    Comment
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card padding="none">
          <CardHeader title="Assignment and resolution" />
          <CardBody>
            <div className="flex flex-col gap-4">
              <Field label="Assignee">
                <Select
                  value={dispute.assigneeUserId ?? ''}
                  placeholder="Unassigned"
                  disabled={resolved}
                  options={users.slice(0, 30).map((u) => ({ value: u.id, label: personName(u.personId) }))}
                  onChange={(e) =>
                    commissionDisputesCollection.update(dispute.id, {
                      assigneeUserId: (e.target.value || null) as CommissionDispute['assigneeUserId'],
                      status: dispute.status === 'open' ? 'under_review' : dispute.status,
                      updatedAt: stamp(),
                      updatedBy: CURRENT_USER_ID,
                    })
                  }
                />
              </Field>

              {resolved ? (
                <Alert
                  tone={dispute.status === 'upheld' ? 'success' : 'info'}
                  icon={MessageSquareWarning}
                  title={`Resolved — ${humanize(dispute.status)}`}
                >
                  {dispute.resolutionNote ?? 'No note recorded.'}
                  {dispute.resultingCommissionId && (
                    <>
                      {' '}
                      Adjustment {commissionsCollection.find(dispute.resultingCommissionId)?.ref} was created.
                    </>
                  )}
                </Alert>
              ) : (
                <>
                  {commission && (
                    <Field
                      label="Corrected total, if upheld"
                      hint={`An adjustment record of ${delta >= 0 ? '+' : '−'}${formatNaira(Math.abs(delta))} will be created. ${commission.ref} keeps its ${formatNaira(commission.amount)}.`}
                    >
                      <CurrencyInput value={correctedAmount ?? commission.amount} onChange={setCorrectedAmount} />
                    </Field>
                  )}
                  <Field
                    label="Resolution note"
                    required
                    hint="Written into the dispute and the commission's state history. Ten characters minimum."
                  >
                    <Textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={3}
                      maxLength={400}
                      showCount
                      placeholder="Rule CR-004 v3, effective 1 Jul 2026, requires full payment before the commission is earned. The rule in force at the time of the referral is the one that applies."
                    />
                  </Field>
                </>
              )}

              <p className="text-body-12 text-text-secondary">
                Raised {formatDateTime(dispute.raisedAt)} by {personName(dispute.raisedByPersonId)}.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </Drawer>
  )
}
