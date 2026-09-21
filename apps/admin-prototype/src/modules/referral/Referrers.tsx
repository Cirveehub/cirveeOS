import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote, Check, Copy, HandCoins, QrCode, UserPlus, UserRoundPlus, UserX, Users } from 'lucide-react'
import QRCode from 'qrcode'

import {
  TODAY,
  CURRENT_USER_ID,
  commissionsCollection,
  peopleCollection,
  referralsCollection,
  referrerProfilesCollection,
  useCollection,
} from '@/mocks'
import { referrerId as asReferrerId } from '@/mocks/types'
import type { Kobo, PersonId, ReferrerProfile, ReferrerType } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  IconButton,
  Input,
  Modal,
  PersonChip,
  Select,
  SkeletonTable,
  StatCard,
  StatusBadge,
  Textarea,
  Tooltip,
} from '@/ui'
import type { Column, FilterValues } from '@/ui'
import { formatNaira, formatNumber } from '@/lib/format'

import { BENEFICIARY_LABEL, OWED_STATES, REFERRER_TYPES, personName } from './lib'
import { LoadFailed, ModulePage, ReferrerTypeBadge, Screen, useScreenState } from './parts'

interface Row {
  profile: ReferrerProfile
  name: string
  brought: number
  paidCount: number
  earned: Kobo
  paid: Kobo
  owed: Kobo
}

export default function Referrers() {
  const profiles = useCollection(referrerProfilesCollection)
  const commissions = useCollection(commissionsCollection)
  const referrals = useCollection(referralsCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:referrers')

  const [qrFor, setQrFor] = useState<ReferrerProfile | null>(null)
  const [suspending, setSuspending] = useState<ReferrerProfile | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; text: string } | null>(null)

  const search = params.get('q') ?? ''
  const values: FilterValues = {
    type: params.get('type') ?? undefined,
    status: params.get('status') ?? undefined,
    owed: params.get('owed') ?? params.get('outstanding') ?? undefined,
  }
  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const month = TODAY.slice(0, 7)
  const activeCount = profiles.filter((p) => p.status === 'active').length
  const broughtThisMonth = referrals.filter((r) => r.capturedAt.startsWith(month)).length
  const paidThisMonth = commissions.filter((c) => c.roleOnDeal === 'referrer' && c.state === 'paid' && c.paidAt?.startsWith(month)).reduce((a, c) => a + c.amount, 0)
  const owedNow = commissions.filter((c) => c.roleOnDeal === 'referrer' && OWED_STATES.includes(c.state)).reduce((a, c) => a + c.amount, 0)

  const rows: Row[] = (forcedEmpty ? [] : profiles)
    .map((profile) => {
      const mine = commissions.filter((c) => c.beneficiaryPersonId === profile.personId)
      const theirs = referrals.filter((r) => r.referrerProfileId === profile.id)
      const earned = mine.filter((c) => c.state !== 'cancelled' && c.state !== 'reversed').reduce((a, c) => a + c.amount, 0) as Kobo
      const paid = mine.filter((c) => c.state === 'paid').reduce((a, c) => a + c.amount, 0) as Kobo
      const owed = mine.filter((c) => OWED_STATES.includes(c.state)).reduce((a, c) => a + c.amount, 0) as Kobo
      return {
        profile,
        name: personName(profile.personId),
        brought: theirs.length,
        paidCount: theirs.filter((r) => r.admissionId !== null).length,
        earned,
        paid,
        owed,
      }
    })
    .filter((row) => {
      if (values.type && row.profile.type !== values.type) return false
      if (values.status && row.profile.status !== values.status) return false
      if (values.owed === 'yes' && row.owed <= 0) return false
      if (values.owed === 'no' && row.owed > 0) return false
      if (search) {
        const haystack = `${row.name} ${row.profile.ref} ${row.profile.code} ${row.profile.supersededCodes.join(' ')}`
        if (!haystack.toLowerCase().includes(search.toLowerCase())) return false
      }
      return true
    })

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800)
    } catch {
      setNotice({ tone: 'warning', text: `Copy is blocked in this browser. The link is ${text}` })
    }
  }

  const columns: Array<Column<Row>> = [
    {
      key: 'name',
      header: 'Referrer',
      pinned: true,
      minWidth: 200,
      cell: (row) => <PersonChip name={row.name} size="sm" />,
      sortValue: (row) => row.name,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => <ReferrerTypeBadge type={row.profile.type} />,
      sortValue: (row) => BENEFICIARY_LABEL[row.profile.type],
    },
    {
      key: 'link',
      header: 'Their link',
      minWidth: 260,
      cell: (row) => (
        <span className="flex items-center gap-1">
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-mono text-body-13 text-text">{row.profile.code}</span>
            <span className="truncate text-body-12 text-text-secondary">{row.profile.trackedUrl}</span>
          </span>
          <IconButton
            icon={copied === row.profile.id ? Check : Copy}
            label={`Copy ${row.name}'s link`}
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              void copy(row.profile.trackedUrl, row.profile.id)
            }}
          />
          <IconButton
            icon={QrCode}
            label={`Show the QR code for ${row.name}`}
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              setQrFor(row.profile)
            }}
          />
        </span>
      ),
      sortValue: (row) => row.profile.code,
    },
    {
      key: 'brought',
      header: 'Brought',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.brought)}</span>,
      sortValue: (row) => row.brought,
    },
    {
      key: 'paidCount',
      header: 'Enrolled',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.paidCount)}</span>,
      sortValue: (row) => row.paidCount,
    },
    {
      key: 'earned',
      header: 'Earned',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNaira(row.earned)}</span>,
      sortValue: (row) => row.earned,
    },
    {
      key: 'owed',
      header: 'Owed',
      align: 'right',
      cell: (row) => <span className={`tabular-nums ${row.owed > 0 ? 'font-medium text-warning-text' : 'text-text-secondary'}`}>{formatNaira(row.owed)}</span>,
      sortValue: (row) => row.owed,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.profile.status} size="sm" />,
      sortValue: (row) => row.profile.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 56,
      cell: (row) => (
        <Tooltip content={row.profile.status === 'active' ? 'Suspend this referrer' : 'Already suspended or ended'}>
          <IconButton
            icon={UserX}
            label={`Suspend ${row.name}`}
            variant="ghost"
            size="sm"
            disabled={row.profile.status !== 'active'}
            onClick={(event) => {
              event.stopPropagation()
              setSuspending(row.profile)
            }}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <Screen>
      <ModulePage
        title="Referrers"
        description="Everyone with a referral link, what they have brought in and what they are owed."
        actions={
          <Button leftIcon={<UserPlus size={16} />} onClick={() => setCreating(true)}>
            New referrer
          </Button>
        }
      />

      {errored && <LoadFailed what="Referrers" onRetry={retry} />}

      {!errored && (
        <>
          {notice && (
            <Alert tone={notice.tone} className="mb-5" onDismiss={() => setNotice(null)}>
              {notice.text}
            </Alert>
          )}

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active referrers" value={formatNumber(activeCount)} icon={Users} onClick={() => setParam('status', 'active')} />
            <StatCard label="Brought this month" value={formatNumber(broughtThisMonth)} caption="people referred since the 1st" icon={UserRoundPlus} />
            <StatCard label="Paid this month" value={formatNaira(paidThisMonth)} caption="to referrers since the 1st" icon={Banknote} variant="success" />
            <StatCard
              label="Owed now"
              value={formatNaira(owedNow)}
              caption="earned, not yet paid"
              icon={HandCoins}
              variant={owedNow > 0 ? 'warning' : 'default'}
              onClick={() => navigate('/referral/payouts')}
            />
          </div>

          <FilterBar
            search={search}
            onSearchChange={(value) => setParam('q', value || undefined)}
            searchPlaceholder="Search by name or code"
            filters={[
              { key: 'type', label: 'Type', options: REFERRER_TYPES.map((t) => ({ value: t, label: BENEFICIARY_LABEL[t] })) },
              {
                key: 'status',
                label: 'Status',
                options: [
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'ended', label: 'Ended' },
                ],
              },
              {
                key: 'owed',
                label: 'Owed',
                options: [
                  { value: 'yes', label: 'Owed money' },
                  { value: 'no', label: 'Nothing owed' },
                ],
              },
            ]}
            values={values}
            onFilterChange={setParam}
            onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
          />

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={10} columns={8} />
            </Card>
          ) : (
            <Card padding="none">
              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.profile.id}
                density="compact"
                stickyHeader
                caption="Referrers"
                defaultSort={{ key: 'owed', direction: 'desc' }}
                onRowClick={(row) => navigate(`/referral/referrers/${row.profile.id}`)}
                empty={
                  profiles.length === 0 || forcedEmpty ? (
                    <EmptyState
                      icon={Users}
                      title="No referrers yet"
                      message="A referrer is a person with a link. Add one and share the link with them."
                      action={
                        <Button leftIcon={<UserPlus size={16} />} onClick={() => setCreating(true)}>
                          Add the first referrer
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      variant="search"
                      title="No referrers match these filters."
                      message="Try a different type or status, or clear the filters."
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

      <QrModal profile={qrFor} onClose={() => setQrFor(null)} />

      <ConfirmDialog
        open={suspending !== null}
        onClose={() => setSuspending(null)}
        onConfirm={() => {
          if (!suspending) return
          referrerProfilesCollection.update(suspending.id, {
            status: 'suspended',
            updatedAt: `${TODAY}T09:00:00+01:00`,
            updatedBy: CURRENT_USER_ID,
          })
          setNotice({ tone: 'success', text: `${personName(suspending.personId)} is suspended. What they have already earned is still owed.` })
          setSuspending(null)
        }}
        title={suspending ? `Suspend ${personName(suspending.personId)}?` : ''}
        confirmLabel="Suspend"
        destructive
        icon={UserX}
      >
        {suspending && (
          <div className="flex flex-col gap-2 text-body-14 text-text-secondary">
            <p>The code {suspending.code} stops bringing in new referrals. Nothing is deleted and nothing already earned is cancelled.</p>
            {suspending.stats.outstanding > 0 && <p className="text-warning-text">{formatNaira(suspending.stats.outstanding)} is currently owed to them and stays owed.</p>}
          </div>
        )}
      </ConfirmDialog>

      <NewReferrerModal open={creating} onClose={() => setCreating(false)} onCreated={(name) => setNotice({ tone: 'success', text: `${name} added as a referrer.` })} />
    </Screen>
  )
}

export function QrModal({ profile, onClose }: { profile: ReferrerProfile | null; onClose: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const payload = profile?.qrPayload ?? null

  useEffect(() => {
    if (!payload) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(payload, { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [payload])

  const download = () => {
    if (!dataUrl || !profile) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${profile.code}-qr.png`
    link.click()
  }

  return (
    <Modal open={profile !== null} onClose={onClose} size="sm" title={profile ? `${profile.code} — QR code` : ''} description={profile ? 'Scans to their referral link.' : undefined}>
      {profile && (
        <div className="flex flex-col items-center gap-4">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR code for ${profile.trackedUrl}`} width={240} height={240} className="rounded-xl border border-border bg-white p-2" />
          ) : (
            <div className="size-60 animate-pulse rounded-xl border border-border bg-canvas" aria-hidden="true" />
          )}
          <p className="text-center font-mono text-body-13 text-text">{profile.trackedUrl}</p>
          <Button variant="secondary" size="sm" disabled={!dataUrl} onClick={download}>
            Download PNG
          </Button>
        </div>
      )}
    </Modal>
  )
}

function suggestCode(name: string, taken: Set<string>): string {
  const stem = (name.split(/\s+/)[0] ?? 'CIRVEE').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'CIRVEE'
  for (let n = 1; n < 100; n++) {
    const candidate = `${stem}${String(n).padStart(2, '0')}`
    if (!taken.has(candidate)) return candidate
  }
  return `${stem}${Date.now() % 100}`
}

function NewReferrerModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const people = useCollection(peopleCollection)
  const profiles = useCollection(referrerProfilesCollection)
  const [personId, setPersonId] = useState('')
  const [type, setType] = useState<ReferrerType>('alumnus')
  const [code, setCode] = useState('')
  const [method, setMethod] = useState<'bank_transfer' | 'payroll' | 'wallet'>('bank_transfer')
  const [bankName, setBankName] = useState('GTBank')
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  const taken = new Set(profiles.flatMap((p) => [p.code, ...p.supersededCodes]))
  const withoutProfile = people.filter((p) => !profiles.some((profile) => profile.personId === p.id))
  const name = personId ? personName(personId as PersonId) : ''
  const suggested = name ? suggestCode(name, taken) : ''
  const effectiveCode = (code || suggested).toUpperCase()
  const codeTaken = effectiveCode !== '' && taken.has(effectiveCode)
  const personError = touched && !personId ? 'Choose who this link belongs to.' : undefined
  const codeError = codeTaken ? `${effectiveCode} is already in use.` : undefined

  const submit = () => {
    setTouched(true)
    if (!personId || codeTaken) return
    const numbers = profiles.map((p) => Number(p.ref.split('-')[1] ?? 0))
    const next = Math.max(0, ...numbers) + 1
    const ref = `REF-${String(next).padStart(4, '0')}`
    const stamp = `${TODAY}T09:00:00+01:00`
    referrerProfilesCollection.insert({
      id: asReferrerId(`ref-${String(next).padStart(4, '0')}`),
      ref,
      personId: personId as PersonId,
      type,
      code: effectiveCode,
      supersededCodes: [],
      trackedUrl: `https://cirvee.com/r/${effectiveCode}`,
      qrPayload: `https://cirvee.com/r/${effectiveCode}`,
      status: 'active',
      joinedAt: TODAY,
      payoutMethod: { kind: method, bankName: method === 'bank_transfer' ? bankName : undefined, verified: false },
      taxNote: notes.trim() || null,
      stats: { clicks: 0, signups: 0, converted: 0, earned: 0 as Kobo, paid: 0 as Kobo, outstanding: 0 as Kobo },
      createdAt: stamp,
      createdBy: CURRENT_USER_ID,
      updatedAt: stamp,
      updatedBy: CURRENT_USER_ID,
    })
    onCreated(name)
    setPersonId('')
    setCode('')
    setTouched(false)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New referrer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Create referrer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Person" required error={personError}>
          <Select
            value={personId}
            placeholder="Choose a person"
            options={withoutProfile.slice(0, 200).map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ''}` }))}
            onChange={(e) => {
              setPersonId(e.target.value)
              setCode('')
            }}
          />
        </Field>

        <Field label="Type" required>
          <Select value={type} options={REFERRER_TYPES.map((t) => ({ value: t, label: BENEFICIARY_LABEL[t] }))} onChange={(e) => setType(e.target.value as ReferrerType)} />
        </Field>

        <Field label="Referral code" required error={codeError} hint={suggested && !code ? `Suggested from their name: ${suggested}` : undefined}>
          <Input
            value={code || suggested}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            invalid={Boolean(codeError)}
            rightSlot={
              effectiveCode && !codeTaken ? (
                <Badge tone="success" variant="subtle" size="sm">
                  Available
                </Badge>
              ) : undefined
            }
          />
        </Field>

        <Field label="How they get paid" required>
          <Select
            value={method}
            options={[
              { value: 'bank_transfer', label: 'Bank transfer' },
              { value: 'payroll', label: 'Through payroll' },
              { value: 'wallet', label: 'Wallet' },
            ]}
            onChange={(e) => setMethod(e.target.value as typeof method)}
          />
        </Field>

        {method === 'bank_transfer' && (
          <Field label="Bank" required hint="Account details are checked before the first payout.">
            <Select
              value={bankName}
              options={['GTBank', 'Zenith Bank', 'Providus Bank', 'Access Bank', 'First Bank', 'Sterling Bank'].map((b) => ({ value: b, label: b }))}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
        )}

        <Field label="Tax note" optional>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={200} showCount placeholder="Individual referrer. No WHT applied below ₦1,000,000 per annum." />
        </Field>
      </div>
    </Modal>
  )
}
