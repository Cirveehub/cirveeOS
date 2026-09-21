import { useState } from 'react'
import { Check, Copy, Gift, Landmark, ShieldCheck, Users } from 'lucide-react'

import { useSession } from '@/auth'
import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  StatCard,
  type Column,
} from '@/ui'
import type { Commission, Referral } from '@/mocks'

import { STATE_LABEL, courseTitle, personName } from '../referral/lib'
import { SimpleStateBadge } from '../referral/parts'
import { referralToast, referrerTypeForPersona, Screen, useMyReferral } from './common'
import { generateMyReferralCode, updateMyPayoutDetails } from './writes'

export default function Page() {
  const session = useSession()
  const state = useMyReferral()
  const [generating, setGenerating] = useState(false)

  function generate() {
    if (!state.personId) return
    setGenerating(true)
    generateMyReferralCode(state.personId, state.displayName, referrerTypeForPersona(session?.persona.id))
    setGenerating(false)
    referralToast.success('Your referral link is ready.')
  }

  return (
    <Screen>
      <PageHeader
        title="My referral"
        description="Your link, who you've referred, and what you've earned."
      />

      {!state.profile ? (
        <div className="mt-6">
          <EmptyState
            icon={Gift}
            title="You don't have a referral link yet"
            message="Generate one to start earning when people you refer enrol at Cirvee."
            bordered
            action={
              <Button onClick={generate} loading={generating} disabled={!state.personId}>
                Generate my referral link
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="People referred" value={formatNumber(state.signups)} icon={Users} />
            <StatCard label="Converted" value={formatNumber(state.converted)} icon={ShieldCheck} />
            <StatCard label="Total earned" value={formatNaira(state.earned)} icon={Gift} variant="success" />
            <StatCard
              label="Outstanding"
              value={formatNaira(state.outstanding)}
              icon={Landmark}
              variant={state.outstanding > 0 ? 'warning' : 'default'}
              caption={`${formatNaira(state.paid)} paid out so far`}
            />
          </div>

          <LinkCard code={state.profile.code} url={state.profile.trackedUrl} superseded={state.profile.supersededCodes} />

          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-5">
              <p className="text-body-15 font-bold">Your referrals</p>
              <p className="text-body-12 text-text-muted">
                {state.referrals.length} {state.referrals.length === 1 ? 'person' : 'people'} signed up with your link
              </p>
            </div>
            <DataTable
              data={state.referrals}
              columns={referralColumns}
              rowKey={(row) => row.id}
              defaultSort={{ key: 'captured', direction: 'desc' }}
              emptyTitle="No referrals yet"
              emptyMessage="Once someone signs up with your link, they'll show up here."
              minWidth={720}
            />
          </section>

          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border px-6 py-5">
              <p className="text-body-15 font-bold">Your commissions</p>
              <p className="text-body-12 text-text-muted">
                Paid out by the finance team on their regular payout run — nothing to request here.
              </p>
            </div>
            <DataTable
              data={state.commissions}
              columns={commissionColumns}
              rowKey={(row) => row.id}
              defaultSort={{ key: 'earned', direction: 'desc' }}
              emptyTitle="No commissions yet"
              emptyMessage="A commission appears here once one of your referrals enrols."
              minWidth={720}
            />
          </section>

          <PayoutDetailsCard profileId={state.profile.id} bankName={state.profile.payoutMethod.bankName} verified={state.profile.payoutMethod.verified} />
        </div>
      )}
    </Screen>
  )
}

const referralColumns: Array<Column<Referral>> = [
  {
    key: 'person',
    header: 'Referred person',
    accessor: (row) => personName(row.referredPersonId),
    sortValue: (row) => personName(row.referredPersonId),
    minWidth: 200,
  },
  {
    key: 'captured',
    header: 'Signed up',
    accessor: (row) => formatDate(row.capturedAt),
    sortValue: (row) => row.capturedAt,
    width: 140,
  },
  {
    key: 'stage',
    header: 'Stage',
    cell: (row) => <Badge tone="neutral" variant="subtle">{row.currentStage.replace(/_/g, ' ')}</Badge>,
    width: 160,
  },
  {
    key: 'value',
    header: 'Value',
    align: 'right',
    accessor: (row) => (row.value ? formatNaira(row.value) : '—'),
    sortValue: (row) => row.value ?? 0,
    width: 140,
  },
]

const commissionColumns: Array<Column<Commission>> = [
  {
    key: 'ref',
    header: 'Reference',
    accessor: (row) => row.ref,
    sortValue: (row) => row.ref,
    minWidth: 160,
  },
  {
    key: 'course',
    header: 'Course',
    accessor: (row) => courseTitle(row.courseId),
    minWidth: 180,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    accessor: (row) => formatNaira(row.amount),
    sortValue: (row) => row.amount,
    width: 140,
  },
  {
    key: 'earned',
    header: 'Earned',
    accessor: (row) => formatDate(row.earnedAt ?? row.createdAt),
    sortValue: (row) => row.earnedAt ?? row.createdAt,
    width: 130,
  },
  {
    key: 'state',
    header: 'Status',
    align: 'right',
    cell: (row) => <SimpleStateBadge commission={row} />,
    sortValue: (row) => STATE_LABEL[row.state],
    width: 130,
  },
]

function LinkCard({ code, url, superseded }: { code: string; url: string; superseded: string[] }) {
  const [copied, setCopied] = useState<'code' | 'url' | null>(null)

  async function copy(text: string, key: 'code' | 'url') {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    } catch {
      referralToast.error(`Copy is blocked in this browser. The value is ${text}`)
    }
  }

  return (
    <Card padding="none">
      <CardHeader title="Your referral link" />
      <CardBody>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-body-15 text-text">{code}</span>
            <IconButton
              icon={copied === 'code' ? Check : Copy}
              label="Copy the referral code"
              variant="ghost"
              size="sm"
              onClick={() => void copy(code, 'code')}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-body-13 text-text-secondary">{url}</span>
            <IconButton
              icon={copied === 'url' ? Check : Copy}
              label="Copy the tracked link"
              variant="ghost"
              size="sm"
              onClick={() => void copy(url, 'url')}
            />
          </div>
          {superseded.length > 0 && (
            <p className="text-body-12 text-text-secondary">
              Superseded: {superseded.join(', ')} — these still resolve.
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

function PayoutDetailsCard({
  profileId,
  bankName,
  verified,
}: {
  profileId: string
  bankName: string | undefined
  verified: boolean
}) {
  const [bank, setBank] = useState(bankName ?? '')
  const [account, setAccount] = useState('')
  const [saving, setSaving] = useState(false)

  const dirty = bank.trim() !== (bankName ?? '') || account.trim().length > 0

  function save() {
    if (!bank.trim() || account.trim().length < 4) return
    setSaving(true)
    updateMyPayoutDetails(profileId, { bankName: bank, accountNumber: account })
    setSaving(false)
    setAccount('')
    referralToast.success('Your payout details have been updated.')
  }

  return (
    <Card padding="none">
      <CardHeader
        title="Payout details"
        actions={
          <Badge tone={verified ? 'success' : 'warning'} variant="subtle">
            {verified ? 'Verified' : 'Unverified'}
          </Badge>
        }
      />
      <CardBody>
        <div className="grid max-w-xl gap-x-6 gap-y-5 sm:grid-cols-2">
          <Field label="Bank name">
            <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="e.g. GTBank" />
          </Field>
          <Field label="Account number" hint="Only the last 4 digits are kept on file.">
            <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="0123456789" />
          </Field>
        </div>
        <div className="mt-5 flex justify-end border-t border-border pt-4">
          <Button onClick={save} loading={saving} disabled={!dirty}>
            Save payout details
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
