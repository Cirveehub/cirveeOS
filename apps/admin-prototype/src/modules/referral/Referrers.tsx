/**
 * §3.2 — Referrers.
 *
 * A referrer is suspended, never deleted: their commissions and their referral
 * history stay attached to the ledger, and their superseded codes keep
 * resolving.
 */

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, QrCode, UserPlus, UserX, Users } from 'lucide-react'

import {
  TODAY,
  CURRENT_USER_ID,
  branchesCollection,
  commissionsCollection,
  peopleCollection,
  referralsCollection,
  referrerProfilesCollection,
  topReferrers,
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
  StatusBadge,
  Textarea,
  Tooltip,
} from '@/ui'
import type { Column, FilterValues } from '@/ui'
import { formatDate, formatNaira, formatNumber, formatPercent } from '@/lib/format'

import { BENEFICIARY_LABEL, branchName, personName } from './lib'
import { LoadFailed, ModulePage, Screen, useScreenState } from './parts'

const REFERRER_TYPES: ReferrerType[] = [
  'student',
  'alumnus',
  'parent',
  'employee',
  'tutor',
  'influencer',
  'partner',
  'external_agent',
  'corporate_partner',
]

interface Row {
  profile: ReferrerProfile
  name: string
  referrals: number
  converted: number
  conversion: number
  earned: Kobo
  paid: Kobo
  outstanding: Kobo
}

export default function Referrers() {
  const profiles = useCollection(referrerProfilesCollection)
  useCollection(commissionsCollection)
  useCollection(referralsCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:referrers')

  const [qrFor, setQrFor] = useState<ReferrerProfile | null>(null)
  const [suspending, setSuspending] = useState<ReferrerProfile | null>(null)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const search = params.get('q') ?? ''
  const values: FilterValues = {
    type: params.get('type') ?? undefined,
    status: params.get('status') ?? undefined,
    branch: params.get('branch') ?? undefined,
    outstanding: params.get('outstanding') ?? undefined,
  }
  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const stats = new Map(topReferrers(profiles.length + 1).map((r) => [r.profileId, r]))

  const rows: Row[] = (forcedEmpty ? [] : profiles)
    .map((profile) => {
      const s = stats.get(profile.id)
      return {
        profile,
        name: personName(profile.personId),
        referrals: s?.referrals ?? 0,
        converted: s?.converted ?? 0,
        conversion: s?.conversion ?? 0,
        earned: (s?.earned ?? 0) as Kobo,
        paid: (s?.paid ?? 0) as Kobo,
        outstanding: (s?.outstanding ?? 0) as Kobo,
      }
    })
    .filter((row) => {
      if (values.type && row.profile.type !== values.type) return false
      if (values.status && row.profile.status !== values.status) return false
      if (values.branch) {
        const person = peopleCollection.find(row.profile.personId)
        if (person?.primaryBranchId !== values.branch) return false
      }
      if (values.outstanding === 'yes' && row.outstanding <= 0) return false
      if (values.outstanding === 'no' && row.outstanding > 0) return false
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
      setNotice(`Copy is blocked in this browser. The link is ${text}`)
    }
  }

  const branches = useCollection(branchesCollection)

  const columns: Array<Column<Row>> = [
    {
      key: 'name',
      header: 'Referrer',
      pinned: true,
      minWidth: 190,
      cell: (row) => <PersonChip name={row.name} size="sm" role={row.profile.ref} />,
      sortValue: (row) => row.name,
    },
    {
      key: 'type',
      header: 'Type',
      cell: (row) => (
        <Badge tone="neutral" variant="subtle" size="sm">
          {BENEFICIARY_LABEL[row.profile.type]}
        </Badge>
      ),
      sortValue: (row) => BENEFICIARY_LABEL[row.profile.type],
    },
    { key: 'ref', header: 'Referral ID', accessor: (row) => row.profile.ref, sortValue: (row) => row.profile.ref },
    {
      key: 'code',
      header: 'Code',
      cell: (row) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-mono text-body-13 text-text">{row.profile.code}</span>
          {row.profile.supersededCodes.length > 0 && (
            <span className="text-body-12 text-text-muted">
              was {row.profile.supersededCodes.join(', ')} — still resolves
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.profile.code,
    },
    {
      key: 'trackedUrl',
      header: 'Tracked URL',
      minWidth: 220,
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body-13 text-text-secondary">{row.profile.trackedUrl}</span>
          <IconButton
            icon={copied === row.profile.id ? Check : Copy}
            label={`Copy the tracked URL for ${row.name}`}
            variant="ghost"
            size="sm"
            onClick={(event) => {
              event.stopPropagation()
              void copy(row.profile.trackedUrl, row.profile.id)
            }}
          />
        </span>
      ),
      sortValue: (row) => row.profile.trackedUrl,
    },
    {
      key: 'qr',
      header: 'QR',
      align: 'center',
      width: 56,
      cell: (row) => (
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
      ),
    },
    {
      key: 'referrals',
      header: 'Referrals',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.referrals)}</span>,
      sortValue: (row) => row.referrals,
    },
    {
      key: 'converted',
      header: 'Converted',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.converted)}</span>,
      sortValue: (row) => row.converted,
    },
    {
      key: 'conversion',
      header: 'Conversion',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatPercent(row.conversion)}</span>,
      sortValue: (row) => row.conversion,
    },
    {
      key: 'earned',
      header: 'Earned',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNaira(row.earned)}</span>,
      sortValue: (row) => row.earned,
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      accessor: (row) => <span className="tabular-nums">{formatNaira(row.paid)}</span>,
      sortValue: (row) => row.paid,
    },
    {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      cell: (row) => (
        <span className={`tabular-nums ${row.outstanding > 0 ? 'text-warning-text' : 'text-text-secondary'}`}>
          {formatNaira(row.outstanding)}
        </span>
      ),
      sortValue: (row) => row.outstanding,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => <StatusBadge status={row.profile.status} size="sm" />,
      sortValue: (row) => row.profile.status,
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      accessor: (row) => <span className="tabular-nums">{formatDate(row.profile.joinedAt)}</span>,
      sortValue: (row) => row.profile.joinedAt,
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
        tab="referrers"
        title="Referrers"
        description="Every person with a referral code. Suspending stops new attribution; it never removes what they have already earned."
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
            <Alert tone="info" className="mb-5" onDismiss={() => setNotice(null)}>
              {notice}
            </Alert>
          )}

          <FilterBar
            search={search}
            onSearchChange={(value) => setParam('q', value || undefined)}
            searchPlaceholder="Search by name, referral ID or code"
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
              { key: 'branch', label: 'Branch', options: branches.map((b) => ({ value: b.id, label: b.name })) },
              {
                key: 'outstanding',
                label: 'Outstanding',
                options: [
                  { value: 'yes', label: 'Has outstanding' },
                  { value: 'no', label: 'Nothing outstanding' },
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
                defaultSort={{ key: 'earned', direction: 'desc' }}
                onRowClick={(row) => navigate(`/referral/referrers/${row.profile.id}`)}
                empty={
                  profiles.length === 0 || forcedEmpty ? (
                    <EmptyState
                      icon={Users}
                      title="No referrers yet"
                      message="A referrer is a person with a code and a tracked link. Without one, referrals arrive unattributed and no commission can name a beneficiary."
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
          setNotice(`${personName(suspending.personId)} is suspended. Their existing commissions are untouched.`)
          setSuspending(null)
        }}
        title={suspending ? `Suspend ${personName(suspending.personId)}?` : ''}
        confirmLabel="Suspend this referrer"
        destructive
        icon={UserX}
      >
        {suspending && (
          <div className="flex flex-col gap-2 text-body-14 text-text-secondary">
            <p>
              The code {suspending.code} stops attributing new referrals. Nothing is deleted: the referrer stays in this
              list with a Suspended badge, and every commission already computed against them keeps its amount and its
              place in the payout queue.
            </p>
            <p className="text-warning-text">
              {formatNaira(suspending.stats.outstanding)} is currently outstanding to them. Suspending does not cancel
              it.
            </p>
          </div>
        )}
      </ConfirmDialog>

      <NewReferrerModal open={creating} onClose={() => setCreating(false)} onCreated={(name) => setNotice(`${name} added as a referrer.`)} />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* QR                                                                         */
/* -------------------------------------------------------------------------- */

export function QrModal({ profile, onClose }: { profile: ReferrerProfile | null; onClose: () => void }) {
  return (
    <Modal
      open={profile !== null}
      onClose={onClose}
      size="sm"
      title={profile ? `${profile.code} — QR` : ''}
      description={profile ? `Encodes ${profile.qrPayload}` : undefined}
    >
      {profile && (
        <div className="flex flex-col items-center gap-4">
          <QrPattern payload={profile.qrPayload} />
          <p className="text-center font-mono text-body-13 text-text">{profile.trackedUrl}</p>
          <p className="text-center text-body-12 text-text-secondary">
            Printed on flyers and the campus stand. The pattern above is generated from the payload in the browser; the
            production system renders the scannable code at print time.
          </p>
        </div>
      )}
    </Modal>
  )
}

/** A deterministic square pattern derived from the payload, with finder marks. */
function QrPattern({ payload }: { payload: string }) {
  const size = 21
  let hash = 2166136261
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7
    return inBox(0, 0) || inBox(0, size - 7) || inBox(size - 7, 0)
  }
  const finderOn = (r: number, c: number) => {
    const lr = r < 7 ? r : r - (size - 7)
    const lc = c < 7 ? c : c - (size - 7)
    const ring = Math.max(Math.abs(lr - 3), Math.abs(lc - 3))
    return ring === 3 || ring <= 1
  }
  const cells: boolean[] = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) {
        cells.push(finderOn(r, c))
      } else {
        const v = Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0
        cells.push((v & 0x40) !== 0)
      }
    }
  }
  return (
    <div
      role="img"
      aria-label={`QR pattern encoding ${payload}`}
      className="grid gap-px rounded-xl border border-border bg-surface p-3"
      style={{ gridTemplateColumns: `repeat(${size}, 8px)` }}
    >
      {cells.map((on, i) => (
        <span key={i} className={on ? 'size-2 bg-text' : 'size-2 bg-surface'} />
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* New referrer                                                               */
/* -------------------------------------------------------------------------- */

function suggestCode(name: string, taken: Set<string>): string {
  const stem = (name.split(/\s+/)[0] ?? 'CIRVEE').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'CIRVEE'
  for (let n = 1; n < 100; n++) {
    const candidate = `${stem}${String(n).padStart(2, '0')}`
    if (!taken.has(candidate)) return candidate
  }
  return `${stem}${Date.now() % 100}`
}

function NewReferrerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
}) {
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
  const personError = touched && !personId ? 'Choose the person this code belongs to.' : undefined
  const codeError = codeTaken ? `${effectiveCode} is already in use. Codes never collide, including retired ones.` : undefined

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
      description="A referrer is a person plus a code. The code is what attributes a lead, so it has to be unique across live and retired codes."
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
            options={withoutProfile
              .slice(0, 200)
              .map((p) => ({ value: p.id, label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ''}` }))}
            onChange={(e) => {
              setPersonId(e.target.value)
              setCode('')
            }}
          />
        </Field>

        <Field label="Referrer type" required>
          <Select
            value={type}
            options={REFERRER_TYPES.map((t) => ({ value: t, label: BENEFICIARY_LABEL[t] }))}
            onChange={(e) => setType(e.target.value as ReferrerType)}
          />
        </Field>

        <Field
          label="Referral code"
          required
          error={codeError}
          hint={suggested && !code ? `Suggested from their name: ${suggested}` : 'Checked against every live and retired code.'}
        >
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

        <Field label="Payout method" required>
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
          <Field label="Bank" required hint="Account details are verified before the first payout.">
            <Select
              value={bankName}
              options={['GTBank', 'Zenith Bank', 'Providus Bank', 'Access Bank', 'First Bank', 'Sterling Bank'].map((b) => ({
                value: b,
                label: b,
              }))}
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
        )}

        <Field label="Tax note" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={200}
            showCount
            placeholder="Individual referrer. No WHT applied below ₦1,000,000 per annum."
          />
        </Field>
      </div>
    </Modal>
  )
}
