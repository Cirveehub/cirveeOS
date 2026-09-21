/**
 * §3.3 — Referrer profile.
 *
 * Regenerating a code does not break the old one: it moves into
 * `supersededCodes` and keeps resolving, and the change is written to the audit
 * log with the before and after values.
 */

import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Copy,
  MessageSquare,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  SquarePen,
  UserX,
} from 'lucide-react'

import {
  CURRENT_USER_ID,
  TODAY,
  activitiesCollection,
  admissionsCollection,
  auditEventsCollection,
  commissionDisputesCollection,
  commissionsCollection,
  leadsCollection,
  payoutBatchesCollection,
  peopleCollection,
  referralsCollection,
  referrerProfilesCollection,
  rolesCollection,
  useCollection,
  useRecord,
  usersCollection,
} from '@/mocks'
import { auditId, referralId as asReferralId } from '@/mocks/types'
import type { Commission, CommissionDispute, PayoutBatch, Referral } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  ProgressBar,
  Select,
  StatusBadge,
  Textarea,
  Timeline,
} from '@/ui'
import type { Column, TimelineItem } from '@/ui'
import { formatDate, formatDateTime, formatNaira, formatNumber, formatPercent, humanize } from '@/lib/format'

import {
  BASIS_LABEL,
  BENEFICIARY_LABEL,
  COMMISSION_STATES,
  STATE_LABEL,
  courseTitle,
  findRule,
  personName,
  userName,
} from './lib'
import { RoleBadge, RuleChip, Screen, StateBadge } from './parts'
import { QrModal } from './Referrers'

const TABS = [
  { id: 'referrals', label: 'Referrals' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'payouts', label: 'Payouts' },
  { id: 'disputes', label: 'Disputes' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit', label: 'Audit' },
]

export default function ReferrerProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const profile = useRecord(referrerProfilesCollection, id)
  const commissions = useCollection(commissionsCollection)
  const referrals = useCollection(referralsCollection)
  const batches = useCollection(payoutBatchesCollection)
  const disputes = useCollection(commissionDisputesCollection)
  const activities = useCollection(activitiesCollection)
  const audit = useCollection(auditEventsCollection)

  const [qrOpen, setQrOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [suspending, setSuspending] = useState(false)
  const [editing, setEditing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const tab = params.get('tab') ?? 'referrals'
  const setTab = (next: string) => {
    const p = new URLSearchParams(params)
    p.set('tab', next)
    setParams(p, { replace: true })
  }

  if (!profile) {
    return (
      <Screen>
        <PageHeader
          breadcrumbs={[
            { label: 'Referral & commission', to: '/referral' },
            { label: 'Referrers', to: '/referral/referrers' },
            { label: 'Not found' },
          ]}
          title="Referrer not found"
        />
        <Card padding="none">
          <EmptyState
            variant="error"
            title="No referrer with that id"
            message="Referrers are suspended rather than deleted, so a missing one means the link is stale."
            action={
              <Button variant="secondary" onClick={() => navigate('/referral/referrers')}>
                Back to referrers
              </Button>
            }
          />
        </Card>
      </Screen>
    )
  }

  const person = peopleCollection.find(profile.personId)
  const mine = commissions.filter((c) => c.beneficiaryPersonId === profile.personId)
  const myReferrals = referrals.filter((r) => r.referrerProfileId === profile.id)
  const myDisputes = disputes.filter((d) => mine.some((c) => c.id === d.commissionId))
  const myBatches = batches.filter((b) => b.lines.some((l) => l.beneficiaryPersonId === profile.personId))
  const myActivity = activities.filter((a) => a.subjectType === 'person' && a.subjectId === profile.personId)
  const myAudit = audit
    .filter((e) => e.entityId === profile.id || e.entityRef === profile.ref)
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))

  const earned = mine.filter((c) => c.state !== 'cancelled').reduce((acc, c) => acc + c.amount, 0)
  const paid = mine.filter((c) => c.state === 'paid').reduce((acc, c) => acc + c.amount, 0)
  const outstanding = earned - paid
  const converted = myReferrals.filter((r) => r.admissionId !== null).length
  const signups = profile.stats.signups || myReferrals.length
  const clicks = profile.stats.clicks

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    } catch {
      setNotice(`Copy is blocked in this browser. The value is ${text}`)
    }
  }

  function regenerate() {
    const code = newCode.trim().toUpperCase()
    if (!code || code === profile!.code) return
    const stamp = `${TODAY}T09:00:00+01:00`
    const actor = usersCollection.find(CURRENT_USER_ID)
    referrerProfilesCollection.update(profile!.id, {
      code,
      supersededCodes: [...profile!.supersededCodes, profile!.code],
      trackedUrl: `https://cirvee.com/r/${code}`,
      qrPayload: `https://cirvee.com/r/${code}`,
      updatedAt: stamp,
      updatedBy: CURRENT_USER_ID,
    })
    auditEventsCollection.insert({
      id: auditId(`audit-ref-${profile!.id}-${Date.now()}`),
      at: stamp,
      actorUserId: CURRENT_USER_ID,
      actorName: actor ? personName(actor.personId) : 'Super Admin',
      actorRole: actor?.roleIds[0] ? (rolesCollection.find(actor.roleIds[0])?.name ?? 'Super Admin') : 'Super Admin',
      action: 'referrer.code.regenerated',
      entityType: 'ReferrerProfile',
      entityId: profile!.id,
      entityRef: profile!.ref,
      field: 'code',
      before: profile!.code,
      after: code,
      source: 'ui',
      ip: '102.89.34.17',
    })
    setNotice(`Code regenerated. ${profile!.code} is superseded but still resolves, so printed flyers keep working.`)
    setRegenerating(false)
    setNewCode('')
  }

  const commissionColumns: Array<Column<Commission>> = [
    { key: 'ref', header: 'Commission', accessor: (c) => c.ref, sortValue: (c) => c.ref },
    { key: 'admission', header: 'Admission', accessor: (c) => c.admissionId, sortValue: (c) => c.admissionId },
    {
      key: 'rule',
      header: 'Rule + version',
      minWidth: 170,
      cell: (c) => <RuleChip rule={findRule(c.ruleId)} onOpen={() => navigate(`/referral/rules/${c.ruleId}`)} />,
      sortValue: (c) => `${c.ruleKey}${c.ruleVersion}`,
    },
    { key: 'basis', header: 'Basis', accessor: (c) => BASIS_LABEL[c.basis], sortValue: (c) => BASIS_LABEL[c.basis] },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (c) => (
        <span className={`tabular-nums ${c.amount < 0 ? 'text-danger-text' : 'text-text'}`}>{formatNaira(c.amount)}</span>
      ),
      sortValue: (c) => c.amount,
    },
    { key: 'state', header: 'State', cell: (c) => <StateBadge state={c.state} />, sortValue: (c) => COMMISSION_STATES.indexOf(c.state) },
    { key: 'earnedAt', header: 'Earned', accessor: (c) => (c.earnedAt ? formatDate(c.earnedAt) : '—'), sortValue: (c) => c.earnedAt ?? '' },
    {
      key: 'approvedBy',
      header: 'Approved by',
      accessor: (c) => (c.approvedByUserId ? userName(c.approvedByUserId) : '—'),
      sortValue: (c) => (c.approvedByUserId ? userName(c.approvedByUserId) : ''),
    },
    { key: 'paidAt', header: 'Paid', accessor: (c) => (c.paidAt ? formatDate(c.paidAt) : '—'), sortValue: (c) => c.paidAt ?? '' },
    { key: 'batch', header: 'Payout batch', accessor: (c) => c.payoutBatchId ?? '—', sortValue: (c) => c.payoutBatchId ?? '' },
  ]

  const referralColumns: Array<Column<Referral>> = [
    {
      key: 'person',
      header: 'Person',
      accessor: (r) => personName(r.referredPersonId),
      sortValue: (r) => personName(r.referredPersonId),
      minWidth: 170,
    },
    { key: 'capturedAt', header: 'Captured', accessor: (r) => formatDate(r.capturedAt), sortValue: (r) => r.capturedAt },
    {
      key: 'capturedVia',
      header: 'Source',
      cell: (r) => (
        <Badge tone="neutral" variant="subtle" size="sm">
          {humanize(r.capturedVia)}
        </Badge>
      ),
      sortValue: (r) => r.capturedVia,
    },
    { key: 'stage', header: 'Current stage', accessor: (r) => humanize(r.currentStage), sortValue: (r) => r.currentStage },
    {
      key: 'admission',
      header: 'Admission',
      accessor: (r) => (r.admissionId ? (admissionsCollection.find(r.admissionId)?.ref ?? r.admissionId) : '—'),
      sortValue: (r) => r.admissionId ?? '',
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{r.value === null ? '—' : formatNaira(r.value)}</span>,
      sortValue: (r) => r.value ?? 0,
    },
    {
      key: 'commissionState',
      header: 'Commission',
      cell: (r) => {
        const c = mine.find((x) => x.admissionId === r.admissionId)
        return c ? <StateBadge state={c.state} /> : <span className="text-text-secondary">None</span>
      },
      sortValue: (r) => mine.find((x) => x.admissionId === r.admissionId)?.state ?? '',
    },
  ]

  const batchColumns: Array<Column<PayoutBatch>> = [
    { key: 'ref', header: 'Batch', accessor: (b) => b.ref, sortValue: (b) => b.ref },
    { key: 'scheduledDate', header: 'Scheduled', accessor: (b) => formatDate(b.scheduledDate), sortValue: (b) => b.scheduledDate },
    { key: 'method', header: 'Method', accessor: (b) => humanize(b.method), sortValue: (b) => b.method },
    {
      key: 'amount',
      header: 'Their line',
      align: 'right',
      accessor: (b) => (
        <span className="tabular-nums">
          {formatNaira(b.lines.filter((l) => l.beneficiaryPersonId === profile.personId).reduce((a, l) => a + l.amount, 0))}
        </span>
      ),
      sortValue: (b) => b.lines.filter((l) => l.beneficiaryPersonId === profile.personId).reduce((a, l) => a + l.amount, 0),
    },
    {
      key: 'lineStatus',
      header: 'Line status',
      cell: (b) => {
        const line = b.lines.find((l) => l.beneficiaryPersonId === profile.personId)
        return line ? <StatusBadge status={line.status} size="sm" /> : <span className="text-text-secondary">—</span>
      },
      sortValue: (b) => b.lines.find((l) => l.beneficiaryPersonId === profile.personId)?.status ?? '',
    },
    {
      key: 'reference',
      header: 'Bank reference',
      accessor: (b) => b.lines.find((l) => l.beneficiaryPersonId === profile.personId)?.bankReference ?? '—',
      sortValue: (b) => b.lines.find((l) => l.beneficiaryPersonId === profile.personId)?.bankReference ?? '',
    },
    { key: 'status', header: 'Batch status', cell: (b) => <StatusBadge status={b.status} size="sm" />, sortValue: (b) => b.status },
  ]

  const disputeColumns: Array<Column<CommissionDispute>> = [
    { key: 'ref', header: 'Dispute', accessor: (d) => d.ref, sortValue: (d) => d.ref },
    {
      key: 'commission',
      header: 'Commission',
      accessor: (d) => commissionsCollection.find(d.commissionId)?.ref ?? d.commissionId,
      sortValue: (d) => d.commissionId,
    },
    { key: 'category', header: 'Category', accessor: (d) => humanize(d.category), sortValue: (d) => d.category },
    {
      key: 'amount',
      header: 'In dispute',
      align: 'right',
      accessor: (d) => <span className="tabular-nums">{formatNaira(d.amountInDispute)}</span>,
      sortValue: (d) => d.amountInDispute,
    },
    { key: 'status', header: 'Status', cell: (d) => <StatusBadge status={d.status} size="sm" />, sortValue: (d) => d.status },
    { key: 'raisedAt', header: 'Raised', accessor: (d) => formatDate(d.raisedAt), sortValue: (d) => d.raisedAt },
  ]

  const activityItems: TimelineItem[] = myActivity.map((a) => ({
    id: a.id,
    title: humanize(a.type),
    description: a.body,
    timestamp: a.createdAt,
    tone: a.isSystemGenerated ? 'neutral' : 'accent',
    actor: { name: userName(a.createdBy) },
  }))

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referral & commission', to: '/referral' },
          { label: 'Referrers', to: '/referral/referrers' },
          { label: personName(profile.personId) },
        ]}
        title={personName(profile.personId)}
        description={person?.email ?? undefined}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral" variant="subtle" size="md">
              {BENEFICIARY_LABEL[profile.type]}
            </Badge>
            <StatusBadge status={profile.status} size="md" />
            <Badge tone="neutral" variant="outline" size="md">
              {profile.ref}
            </Badge>
            <span className="text-body-13 text-text-secondary">Joined {formatDate(profile.joinedAt)}</span>
          </div>
        }
        actions={
          <>
            <Button variant="ghost" leftIcon={<MessageSquare size={16} />} onClick={() => setNotice('Not built in this prototype — this would open a WhatsApp thread with the referrer.')}>
              Message
            </Button>
            <Button variant="ghost" leftIcon={<Plus size={16} />} onClick={() => setRecording(true)}>
              Record manual referral
            </Button>
            <Button variant="secondary" leftIcon={<SquarePen size={16} />} onClick={() => setEditing(true)}>
              Edit profile
            </Button>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={16} />}
              onClick={() => {
                setNewCode(profile.code)
                setRegenerating(true)
              }}
            >
              Regenerate code
            </Button>
            <Button
              variant="danger"
              leftIcon={<UserX size={16} />}
              disabled={profile.status !== 'active'}
              onClick={() => setSuspending(true)}
            >
              Suspend
            </Button>
          </>
        }
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
      />

      {notice && (
        <Alert tone="info" className="mb-5" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* ---- left rail ---- */}
        <div className="flex flex-col gap-5">
          <Card padding="none">
            <CardHeader title="Code and link" />
            <CardBody>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-body-15 text-text">{profile.code}</span>
                  <IconButton
                    icon={copied === 'code' ? Check : Copy}
                    label="Copy the referral code"
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy(profile.code, 'code')}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-body-13 text-text-secondary">{profile.trackedUrl}</span>
                  <IconButton
                    icon={copied === 'url' ? Check : Copy}
                    label="Copy the tracked URL"
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy(profile.trackedUrl, 'url')}
                  />
                </div>
                {profile.supersededCodes.length > 0 && (
                  <p className="text-body-12 text-text-secondary">
                    Superseded: {profile.supersededCodes.join(', ')} — these still resolve, so printed material keeps
                    working.
                  </p>
                )}
                <Button variant="secondary" size="sm" leftIcon={<QrCode size={16} />} onClick={() => setQrOpen(true)}>
                  Show QR
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Link performance" />
            <CardBody>
              <div className="flex flex-col gap-4">
                <KeyValueList>
                  <KeyValue label="Clicks" divided>
                    <span className="tabular-nums">{formatNumber(clicks)}</span>
                  </KeyValue>
                  <KeyValue label="Signups" divided>
                    <span className="tabular-nums">{formatNumber(signups)}</span>
                  </KeyValue>
                  <KeyValue label="Converted" divided>
                    <span className="tabular-nums">{formatNumber(converted)}</span>
                  </KeyValue>
                </KeyValueList>
                <div>
                  <ProgressBar
                    value={clicks ? (signups / clicks) * 100 : 0}
                    label="Click to signup"
                    valueLabel={formatPercent(clicks ? (signups / clicks) * 100 : 0)}
                    size="sm"
                  />
                </div>
                <div>
                  <ProgressBar
                    value={signups ? (converted / signups) * 100 : 0}
                    label="Signup to enrolment"
                    valueLabel={formatPercent(signups ? (converted / signups) * 100 : 0)}
                    tone="success"
                    size="sm"
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Money" />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Lifetime earned" divided>
                  <span className="tabular-nums">{formatNaira(earned)}</span>
                </KeyValue>
                <KeyValue label="Paid" divided>
                  <span className="tabular-nums">{formatNaira(paid)}</span>
                </KeyValue>
                <KeyValue label="Outstanding" divided>
                  <span className={outstanding > 0 ? 'tabular-nums text-warning-text' : 'tabular-nums text-text-secondary'}>
                    {formatNaira(outstanding)}
                  </span>
                </KeyValue>
              </KeyValueList>
              <p className="mt-3 text-body-12 text-text-secondary">
                Earned minus paid reconciles exactly: {formatNaira(earned)} − {formatNaira(paid)} ={' '}
                {formatNaira(outstanding)}.
              </p>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Payout method" />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Method" divided>
                  {humanize(profile.payoutMethod.kind)}
                </KeyValue>
                {profile.payoutMethod.bankName && (
                  <KeyValue label="Bank" divided>
                    {profile.payoutMethod.bankName}
                  </KeyValue>
                )}
                {profile.payoutMethod.accountLast4 && (
                  <KeyValue label="Account" divided>
                    <span className="font-mono">••••{profile.payoutMethod.accountLast4}</span>
                  </KeyValue>
                )}
                <KeyValue label="Verified" divided>
                  {profile.payoutMethod.verified ? (
                    <Badge tone="success" variant="subtle" size="sm" icon={<ShieldCheck size={12} />}>
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="warning" variant="subtle" size="sm">
                      Not verified
                    </Badge>
                  )}
                </KeyValue>
              </KeyValueList>
              {profile.taxNote && <p className="mt-3 text-body-13 text-text-secondary">{profile.taxNote}</p>}
            </CardBody>
          </Card>
        </div>

        {/* ---- tab panels ---- */}
        <div>
          {tab === 'referrals' && (
            <Card padding="none">
              <DataTable
                data={myReferrals}
                columns={referralColumns}
                rowKey={(r) => r.id}
                density="compact"
                caption={`Referrals captured by ${personName(profile.personId)}`}
                defaultSort={{ key: 'capturedAt', direction: 'desc' }}
                onRowClick={(r) => r.leadId && leadsCollection.find(r.leadId) && navigate(`/crm/leads/${r.leadId}`)}
                empty={
                  <EmptyState
                    title="No referrals captured yet"
                    message="Referrals appear when someone arrives through the tracked link, the code, the QR, or is recorded here by hand."
                    action={
                      <Button variant="secondary" onClick={() => setRecording(true)}>
                        Record a manual referral
                      </Button>
                    }
                  />
                }
              />
            </Card>
          )}

          {tab === 'commissions' && (
            <Card padding="none">
              <DataTable
                data={mine}
                columns={commissionColumns}
                rowKey={(c) => c.id}
                density="compact"
                caption={`Commissions earned by ${personName(profile.personId)}`}
                defaultSort={{ key: 'earnedAt', direction: 'desc' }}
                onRowClick={(c) => navigate(`/referral/commissions?drawer=${c.id}`)}
                empty={
                  <EmptyState
                    title="No commission computed for this referrer yet"
                    message="A referral only produces a commission when a rule version in force covers their referrer type, unit and role on the deal."
                  />
                }
              />
            </Card>
          )}

          {tab === 'payouts' && (
            <Card padding="none">
              <DataTable
                data={myBatches}
                columns={batchColumns}
                rowKey={(b) => b.id}
                density="compact"
                caption={`Payout batches including ${personName(profile.personId)}`}
                defaultSort={{ key: 'scheduledDate', direction: 'desc' }}
                onRowClick={(b) => navigate(`/referral/payouts/${b.id}`)}
                empty={
                  <EmptyState
                    title="Not in any payout batch yet"
                    message="Approved and payable commissions are gathered into a batch on the payout run."
                    action={
                      <Button variant="secondary" onClick={() => navigate('/referral/payouts/new')}>
                        Run a payout
                      </Button>
                    }
                  />
                }
              />
            </Card>
          )}

          {tab === 'disputes' && (
            <Card padding="none">
              <DataTable
                data={myDisputes}
                columns={disputeColumns}
                rowKey={(d) => d.id}
                density="compact"
                caption={`Disputes raised by or about ${personName(profile.personId)}`}
                defaultSort={{ key: 'raisedAt', direction: 'desc' }}
                onRowClick={(d) => navigate(`/referral/disputes?drawer=${d.id}`)}
                empty={<EmptyState title="No disputes" message="Nothing about this referrer's commission has been contested." />}
              />
            </Card>
          )}

          {tab === 'activity' && (
            <Card padding="none">
              <CardHeader title="Activity" description="Human, editable, and separate from the audit log." />
              <CardBody>
                {activityItems.length ? (
                  <Timeline items={activityItems} timeFormat="absolute" />
                ) : (
                  <EmptyState
                    size="sm"
                    title="No activity recorded"
                    message="Calls, notes and messages about this referrer appear here."
                  />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'audit' && (
            <Card padding="none">
              <CardHeader
                title="Audit"
                description="Immutable. Actor, timestamp, field, before and after. Never merged with the activity feed."
              />
              <CardBody padding="none">
                {myAudit.length ? (
                  <ul className="divide-y divide-border">
                    {myAudit.map((event) => (
                      <li key={event.id} className="px-6 py-3 font-mono text-body-12 text-text-secondary">
                        <span className="text-text">{formatDateTime(event.at)}</span>
                        <span className="px-2">·</span>
                        {event.actorName} ({event.actorRole})
                        <span className="px-2">·</span>
                        <span className="text-text">{event.action}</span>
                        {event.field && (
                          <>
                            <span className="px-2">·</span>
                            {event.field}: <span className="text-danger-text">{event.before ?? '—'}</span>
                            <span aria-hidden="true" className="px-1.5">
                              →
                            </span>
                            <span className="text-success-text">{event.after ?? '—'}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    size="sm"
                    title="No audited change yet"
                    message="Code regenerations, suspensions and payout-method changes are recorded here."
                  />
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/referral/referrers')}>
          Back to referrers
        </Button>
      </div>

      <QrModal profile={qrOpen ? profile : null} onClose={() => setQrOpen(false)} />

      {/* ---- regenerate code ---- */}
      <Modal
        open={regenerating}
        onClose={() => setRegenerating(false)}
        title="Regenerate referral code"
        description="The old code is not withdrawn. It moves to the superseded list and keeps resolving, so flyers and posters already in circulation still attribute correctly."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRegenerating(false)}>
              Cancel
            </Button>
            <Button onClick={regenerate} disabled={!newCode.trim() || newCode.trim().toUpperCase() === profile.code}>
              Regenerate and audit
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <KeyValueList>
            <KeyValue label="Current code" divided>
              <span className="font-mono">{profile.code}</span>
            </KeyValue>
            <KeyValue label="Already superseded" divided>
              {profile.supersededCodes.length ? profile.supersededCodes.join(', ') : 'None'}
            </KeyValue>
          </KeyValueList>
          <Field label="New code" required hint="Uppercase letters and digits.">
            <Input value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} />
          </Field>
        </div>
      </Modal>

      {/* ---- suspend ---- */}
      <ConfirmDialog
        open={suspending}
        onClose={() => setSuspending(false)}
        onConfirm={() => {
          referrerProfilesCollection.update(profile.id, {
            status: 'suspended',
            updatedAt: `${TODAY}T09:00:00+01:00`,
            updatedBy: CURRENT_USER_ID,
          })
          setNotice('Suspended. Nothing was deleted and nothing outstanding was cancelled.')
          setSuspending(false)
        }}
        title={`Suspend ${personName(profile.personId)}?`}
        confirmLabel="Suspend"
        destructive
        icon={UserX}
      >
        <p className="text-body-14 text-text-secondary">
          New referrals stop being attributed to {profile.code}. The {formatNumber(mine.length)} commissions already
          computed for them, and the {formatNaira(outstanding)} outstanding, are unaffected.
        </p>
      </ConfirmDialog>

      <EditProfileModal open={editing} onClose={() => setEditing(false)} profileId={profile.id} onSaved={() => setNotice('Profile updated.')} />

      <ManualReferralModal
        open={recording}
        onClose={() => setRecording(false)}
        profileId={profile.id}
        onSaved={(name) => setNotice(`${name} recorded as a manual referral. It is marked as captured by hand, not by the link.`)}
      />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */

function EditProfileModal({
  open,
  onClose,
  profileId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  profileId: string
  onSaved: () => void
}) {
  const profile = useRecord(referrerProfilesCollection, profileId)
  const [taxNote, setTaxNote] = useState(profile?.taxNote ?? '')
  const [bankName, setBankName] = useState(profile?.payoutMethod.bankName ?? 'GTBank')

  if (!profile) return <Modal open={false} onClose={onClose} />

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit referrer profile"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              referrerProfilesCollection.update(profile.id, {
                taxNote: taxNote.trim() || null,
                payoutMethod: { ...profile.payoutMethod, bankName },
                updatedAt: `${TODAY}T09:00:00+01:00`,
                updatedBy: CURRENT_USER_ID,
              })
              onSaved()
              onClose()
            }}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Bank" hint="Changing the bank clears verification until the next payout confirms it.">
          <Select
            value={bankName}
            options={['GTBank', 'Zenith Bank', 'Providus Bank', 'Access Bank', 'First Bank', 'Sterling Bank'].map((b) => ({
              value: b,
              label: b,
            }))}
            onChange={(e) => setBankName(e.target.value)}
          />
        </Field>
        <Field label="Tax note" optional>
          <Textarea value={taxNote} onChange={(e) => setTaxNote(e.target.value)} rows={3} maxLength={240} showCount />
        </Field>
      </div>
    </Modal>
  )
}

function ManualReferralModal({
  open,
  onClose,
  profileId,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  profileId: string
  onSaved: (name: string) => void
}) {
  const people = useCollection(peopleCollection)
  const [personId, setPersonId] = useState('')
  const [touched, setTouched] = useState(false)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record a manual referral"
      description="For introductions made in person, where no link was clicked. It is stored as captured by hand, so attribution reporting stays honest."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!personId) return
              const stamp = `${TODAY}T09:00:00+01:00`
              referralsCollection.insert({
                id: asReferralId(`rfl-manual-${Date.now()}`),
                referrerProfileId: profileId as Referral['referrerProfileId'],
                referredPersonId: personId as Referral['referredPersonId'],
                leadId: null,
                admissionId: null,
                capturedVia: 'manual',
                capturedAt: stamp,
                currentStage: 'new',
                value: null,
                createdAt: stamp,
                createdBy: CURRENT_USER_ID,
                updatedAt: stamp,
                updatedBy: CURRENT_USER_ID,
              })
              onSaved(personName(personId as Referral['referredPersonId']))
              setPersonId('')
              setTouched(false)
              onClose()
            }}
          >
            Record referral
          </Button>
        </>
      }
    >
      <Field label="Person referred" required error={touched && !personId ? 'Choose who was referred.' : undefined}>
        <Select
          value={personId}
          placeholder="Choose a person"
          options={people.slice(0, 200).map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}` }))}
          onChange={(e) => setPersonId(e.target.value)}
        />
      </Field>
    </Modal>
  )
}
