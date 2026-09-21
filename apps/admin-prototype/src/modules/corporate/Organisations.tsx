import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Monitor, Plus } from 'lucide-react'

import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColumnPicker,
  DataTable,
  Drawer,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  MoneyCell,
  PersonChip,
  SearchInput,
  Select,
  Switch,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
} from '@/ui'
import {
  TODAY,
  clientOrgsCollection,
  corporateDealsCollection,
  invoicesCollection,
  peopleCollection,
  useCollection,
  usersCollection,
  type ClientOrg,
} from '@/mocks'
import { asKobo, clientOrgId, type PersonId, type UserId } from '@/mocks/types'

import { useParticipants } from './data'
import {
  ErrorPanel,
  ModuleHeader,
  Screen,
  corporateStamp,
  emitCorporateAudit,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'

/**
 * Fourteen columns exist; eight answer "what is this client, and does it need
 * my attention". The rest are one click away rather than always on screen.
 */
const ORG_COLUMNS: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Organisation', defaultVisible: true, locked: true },
  { key: 'industry', label: 'Industry', defaultVisible: false },
  { key: 'size', label: 'Size', defaultVisible: false },
  { key: 'contact', label: 'Primary contact', defaultVisible: true },
  { key: 'owner', label: 'Account owner', defaultVisible: true },
  { key: 'deals', label: 'Deals', defaultVisible: true },
  { key: 'trained', label: 'Trained', defaultVisible: false },
  { key: 'lifetime', label: 'Lifetime revenue', defaultVisible: true },
  { key: 'outstanding', label: 'Outstanding', defaultVisible: true },
  { key: 'contract', label: 'Contract', defaultVisible: true },
  { key: 'renewal', label: 'Renewal date', defaultVisible: true },
  { key: 'invoices', label: 'Invoices', defaultVisible: false },
  { key: 'portal', label: 'Portal access', defaultVisible: false },
  { key: 'added', label: 'Added', defaultVisible: false },
]

export default function CorporateOrganisations() {
  const orgs = useCollection(clientOrgsCollection)
  const deals = useCollection(corporateDealsCollection)
  const invoices = useCollection(invoicesCollection)
  const participants = useParticipants()
  const personName = usePersonName()
  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [portalPreview, setPortalPreview] = useState(false)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { loading, error, rows, retry } = useModuleData(orgs, 'corporate.organisations')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(ORG_COLUMNS)

  const dealCount = (id: string) => deals.filter((d) => (d.organisationId as string) === id).length
  const invoicesFor = (id: string) => invoices.filter((i) => (i.organisationId as string | null) === id)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((o) => o.name.toLowerCase().includes(q) || o.industry.toLowerCase().includes(q))
  }, [rows, search])

  const open = openId ? orgs.find((o) => (o.id as string) === openId) : undefined
  const openParticipants = openParticipantsFor(participants, openId)
  const openInvoices = openId ? invoicesFor(openId) : []

  const contractStatus = (o: ClientOrg): string => {
    if (o.renewalDate === null) return 'No contract on file'
    if (o.renewalDate < TODAY) return 'Expired'
    return 'Active'
  }

  const allColumns: Record<string, Column<ClientOrg>> = {
    name: {
      key: 'name',
      header: 'Organisation',
      sortable: true,
      sortValue: (o) => o.name,
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{o.name}</p>
          <p className="truncate text-body-12 text-text-secondary">
            {o.industry} · {o.size} staff
          </p>
        </div>
      ),
      minWidth: 280,
    },
    industry: {
      key: 'industry',
      header: 'Industry',
      sortable: true,
      sortValue: (o) => o.industry,
      accessor: (o) => o.industry,
      minWidth: 150,
    },
    size: {
      key: 'size',
      header: 'Size',
      sortable: true,
      sortValue: (o) => o.size,
      accessor: (o) => `${o.size} staff`,
      width: 130,
    },
    contact: {
      key: 'contact',
      header: 'Primary contact',
      sortable: true,
      sortValue: (o) => personName(o.primaryContactPersonId),
      cell: (o) => <PersonChip name={personName(o.primaryContactPersonId)} size="sm" short />,
      minWidth: 190,
    },
    owner: {
      key: 'owner',
      header: 'Account owner',
      sortable: true,
      sortValue: (o) => userName(o.accountOwnerUserId),
      accessor: (o) => userName(o.accountOwnerUserId),
      minWidth: 180,
    },
    deals: {
      key: 'deals',
      header: 'Deals',
      align: 'right',
      sortable: true,
      sortValue: (o) => dealCount(o.id as string),
      accessor: (o) => formatNumber(dealCount(o.id as string)),
      width: 90,
    },
    trained: {
      key: 'trained',
      header: 'Trained',
      align: 'right',
      sortable: true,
      sortValue: (o) => o.participantsTrained,
      accessor: (o) => formatNumber(o.participantsTrained),
      width: 100,
    },
    lifetime: {
      key: 'lifetime',
      header: 'Lifetime revenue',
      align: 'right',
      sortable: true,
      sortValue: (o) => o.lifetimeRevenue,
      cell: (o) => <MoneyCell kobo={o.lifetimeRevenue} strong />,
      width: 160,
    },
    outstanding: {
      key: 'outstanding',
      header: 'Outstanding',
      align: 'right',
      sortable: true,
      sortValue: (o) => o.outstandingBalance,
      cell: (o) => (
        <MoneyCell kobo={o.outstandingBalance} tone={o.outstandingBalance > 0 ? 'negative' : 'muted'} />
      ),
      width: 150,
    },
    contract: {
      key: 'contract',
      header: 'Contract',
      sortable: true,
      sortValue: contractStatus,
      cell: (o) => (
        <Badge tone={contractStatus(o) === 'Active' ? 'success' : 'neutral'}>{contractStatus(o)}</Badge>
      ),
      width: 160,
    },
    renewal: {
      key: 'renewal',
      header: 'Renewal date',
      sortable: true,
      sortValue: (o) => o.renewalDate ?? '',
      accessor: (o) => (o.renewalDate ? formatDate(o.renewalDate) : '—'),
      width: 140,
    },
    invoices: {
      key: 'invoices',
      header: 'Invoices',
      sortable: true,
      sortValue: (o) => invoicesFor(o.id as string).length,
      cell: (o) => {
        const mine = invoicesFor(o.id as string)
        const allocated = mine.reduce(
          (acc, i) => acc + i.lines.filter((l) => l.enrollmentId !== null).length,
          0,
        )
        if (mine.length === 0) return <span className="text-text-secondary">None raised</span>
        return (
          <span className="text-body-12 text-text-secondary">
            {formatNumber(mine.length)} invoice{mine.length === 1 ? '' : 's'} ·{' '}
            {formatNumber(allocated)} seat{allocated === 1 ? '' : 's'} allocated
          </span>
        )
      },
      minWidth: 210,
    },
    portal: {
      key: 'portal',
      header: 'Portal access',
      sortable: true,
      sortValue: (o) => (o.portalAccessEnabled ? 1 : 0),
      cell: (o) => (
        <Badge tone={o.portalAccessEnabled ? 'accent' : 'neutral'}>
          {o.portalAccessEnabled ? 'Enabled' : 'Not enabled'}
        </Badge>
      ),
      width: 140,
    },
    added: {
      key: 'added',
      header: 'Added',
      sortable: true,
      sortValue: (o) => o.createdAt,
      accessor: (o) => formatDate(o.createdAt.slice(0, 10)),
      width: 130,
    },
  }

  const resolved = visible.map((key) => allColumns[key]).filter(Boolean)
  /* A hand-edited ?cols= that names nothing real would otherwise blank the table. */
  const columns = resolved.length > 0 ? resolved : defaultKeys.map((key) => allColumns[key]).filter(Boolean)

  return (
    <Screen>
      <ModuleHeader
        title="Organisations"
        description="Client organisations, their participants and what they owe."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Add organisation
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-5" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel what="Organisations" onRetry={retry} />
      ) : (
        <Card padding="none">
          <TableToolbar
            className="px-4 py-3"
            lead={
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search organisations"
                inputSize="sm"
                containerClassName="w-72"
              />
            }
            actions={
              <ColumnPicker
                catalogue={ORG_COLUMNS}
                visible={visible}
                defaultKeys={defaultKeys}
                onChange={setVisible}
              />
            }
          />
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(o) => o.id as string}
            loading={loading}
            density="compact"
            minWidth={Math.max(900, columns.length * 155)}
            caption="Client organisations"
            onRowClick={(o) => setOpenId(o.id as string)}
            activeRowKey={openId ?? undefined}
            emptyTitle={search ? 'No organisations match this search' : 'No client organisations yet'}
            emptyMessage={
              search
                ? 'Clear the search to see every client.'
                : 'Corporate work is invoiced to an organisation. Nothing is tracked here until one exists.'
            }
          />
        </Card>
      )}

      <Drawer
        open={open !== undefined}
        onClose={() => {
          setOpenId(null)
          setPortalPreview(false)
        }}
        title={open?.name ?? 'Organisation'}
        description={open ? `${open.industry} · ${open.size} staff` : undefined}
        size="xl"
      >
        {open && (
          <div className="space-y-6">
            {portalPreview && (
              <Alert
                tone="info"
                title={`Previewing the client portal for ${open.name}`}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setPortalPreview(false)}>
                    Back to internal view
                  </Button>
                }
              >
                This is what the client sees: their own participants' attendance, progress and assessment
                results, plus their invoices. No other client's data, no internal notes, no pipeline.
              </Alert>
            )}

            {!portalPreview && (
              <KeyValueList columns={2}>
                <KeyValue label="Primary contact">{personName(open.primaryContactPersonId)}</KeyValue>
                <KeyValue label="Account owner">{userName(open.accountOwnerUserId)}</KeyValue>
                <KeyValue label="Lifetime revenue">{formatNaira(open.lifetimeRevenue)}</KeyValue>
                <KeyValue label="Outstanding balance">{formatNaira(open.outstandingBalance)}</KeyValue>
                <KeyValue label="Participants trained">{formatNumber(open.participantsTrained)}</KeyValue>
                <KeyValue label="Renewal date">
                  {open.renewalDate ? formatDate(open.renewalDate) : 'No contract on file'}
                </KeyValue>
                <KeyValue label="Other contacts">
                  {open.contactPersonIds.length > 1
                    ? open.contactPersonIds
                        .filter((id) => id !== open.primaryContactPersonId)
                        .map((id) => personName(id))
                        .join(', ')
                    : 'Only the primary contact so far'}
                </KeyValue>
                <KeyValue label="Client portal">
                  {open.portalAccessEnabled ? 'Enabled' : 'Not enabled'}
                </KeyValue>
              </KeyValueList>
            )}

            {!portalPreview && open.portalAccessEnabled && (
              <Button variant="secondary" size="sm" leftIcon={<Monitor size={16} />} onClick={() => setPortalPreview(true)}>
                Preview the client portal
              </Button>
            )}

            <Card padding="none">
              <CardHeader
                title="Participants"
                description="Derived from the invoice lines that bought each seat."
              />
              <CardBody>
                {openParticipants.length === 0 ? (
                  <p className="text-body-13 text-text-secondary">
                    No invoice line for this client names an enrolment yet, so no participant can be traced
                    to a paid seat.
                  </p>
                ) : (
                  <table className="w-full text-body-13">
                    <caption className="sr-only">Participants sponsored by {open.name}</caption>
                    <thead>
                      <tr className="border-b border-border text-left text-label-10 text-text-muted">
                        <th scope="col" className="py-2 pr-3 font-semibold">Participant</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Cohort</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Attendance</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Progress</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Pre</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Post</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Gain</th>
                        <th scope="col" className="py-2 font-semibold">Certificate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {openParticipants.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 pr-3 text-text">{personName(p.personId)}</td>
                          <td className="py-2 pr-3 text-text-secondary">{p.cohortCode}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {p.attendancePercent === null ? '—' : `${p.attendancePercent}%`}
                          </td>
                          <td className="py-2 pr-3 text-right tabular-nums">{p.progressPercent}%</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{p.preScore ?? '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">{p.postScore ?? '—'}</td>
                          <td className="py-2 pr-3 text-right tabular-nums">
                            {p.gain === null ? (
                              '—'
                            ) : (
                              <span className={p.gain >= 0 ? 'text-success-text' : 'text-danger-text'}>
                                {p.gain >= 0 ? `+${p.gain}` : p.gain}
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            <Badge tone={p.certificateIssued ? 'success' : 'neutral'} size="sm">
                              {p.certificateIssued ? 'Issued' : 'Not yet'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-3 text-body-12 text-text-secondary">
                  Pre and post scores are the participant's first and latest graded submission. A dedicated
                  assessment instrument is not part of the prototype seed.
                </p>
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader
                title="Invoices"
                description="One organisation invoice allocates across many participant enrolments."
              />
              <CardBody>
                {openInvoices.length === 0 ? (
                  <p className="text-body-13 text-text-secondary">No invoice has been raised yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {openInvoices.map((inv) => {
                      const allocated = inv.lines.filter((l) => l.enrollmentId !== null)
                      return (
                        <li key={inv.id as string} className="rounded-xl border border-border p-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <Link
                              to="/finance/invoices"
                              className="font-mono text-body-13 text-accent hover:underline"
                            >
                              {inv.ref}
                            </Link>
                            <span className="text-body-13 text-text">
                              {formatNaira(inv.total)} · {formatNaira(inv.balance)} outstanding
                            </span>
                          </div>
                          <p className="mt-1 text-body-12 text-text-secondary">
                            Issued {formatDate(inv.issueDate)} · due {formatDate(inv.dueDate)} ·{' '}
                            {formatNumber(inv.lines.length)} line
                            {inv.lines.length === 1 ? '' : 's'},{' '}
                            {formatNumber(allocated.length)} allocated to an enrolment
                          </p>
                          {allocated.length > 0 && (
                            <ul className="mt-2 space-y-1 border-t border-border pt-2">
                              {allocated.map((line) => {
                                const seat = openParticipants.find(
                                  (p) => p.enrollmentId === (line.enrollmentId as string | null),
                                )
                                return (
                                  <li
                                    key={line.id}
                                    className="flex items-baseline justify-between gap-3 text-body-12"
                                  >
                                    <span className="min-w-0 truncate text-text-secondary">
                                      {seat ? personName(seat.personId) : line.description}
                                      {seat ? ` · ${seat.cohortCode}` : ''}
                                    </span>
                                    <span className="shrink-0 tabular-nums text-text">
                                      {formatNaira(line.amount)}
                                    </span>
                                  </li>
                                )
                              })}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-3 text-body-12 text-text-secondary">
                  A payment against one of these invoices carries its own allocations, so a part payment is
                  never guessed against a person — it is split across the seats it actually settled.
                </p>
              </CardBody>
            </Card>

            {!portalPreview && (
              <Card padding="none">
                <CardHeader title="Deals" />
                <CardBody>
                  {dealCount(open.id as string) === 0 ? (
                    <p className="text-body-13 text-text-secondary">No deal is open for this client.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {deals
                        .filter((d) => (d.organisationId as string) === (open.id as string))
                        .map((d) => (
                          <li key={d.id as string} className="flex items-center justify-between gap-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-body-13 text-text">{d.title}</p>
                              <p className="font-mono text-body-12 text-text-secondary">{d.ref}</p>
                            </div>
                            <span className="shrink-0 text-body-13 text-text">{formatNaira(d.value)}</span>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            )}
          </div>
        )}
      </Drawer>

      <NewOrganisationModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(name) =>
          setNotice(
            `${name} is now a client organisation. It starts at zero lifetime revenue, zero outstanding and no participants trained — those figures only move when an invoice does.`,
          )
        }
      />
    </Screen>
  )
}

function openParticipantsFor(
  participants: ReturnType<typeof useParticipants>,
  orgId: string | null,
): ReturnType<typeof useParticipants> {
  if (!orgId) return []
  return participants.filter((p) => p.organisationId === orgId)
}

/* -------------------------------------------------------------------------- */
/* Add an organisation                                                        */
/* -------------------------------------------------------------------------- */

/** Sectors the seed already uses, plus the rest of the corporate book. */
const INDUSTRIES = [
  'Banking',
  'Fintech',
  'Energy',
  'Telecoms',
  'Manufacturing',
  'Utilities',
  'Insurance',
  'Oil and gas',
  'Consumer goods',
  'Healthcare',
  'Logistics',
  'Public sector',
  'Professional services',
  'Education',
  'Agriculture',
  'Construction',
  'Media',
  'Retail',
]

const SIZES = ['1–50', '50–200', '200–500', '500–1,000', '1,000+']

/** `cli-sterling`, `cli-interswitch` — the slug convention the seed uses. */
function slugFor(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .split('-')
      .filter((part) => !['plc', 'ltd', 'limited', 'nigeria', 'the'].includes(part))
      .slice(0, 2)
      .join('-') || 'client'
  if (!taken.has(`cli-${base}`)) return `cli-${base}`
  for (let n = 2; n < 100; n++) {
    if (!taken.has(`cli-${base}-${n}`)) return `cli-${base}-${n}`
  }
  return `cli-${base}-${Date.now().toString(36)}`
}

function NewOrganisationModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const orgs = useCollection(clientOrgsCollection)
  const people = useCollection(peopleCollection)
  const users = useCollection(usersCollection)
  const personName = usePersonName()
  const userName = useUserName()

  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState('')
  const [contactQuery, setContactQuery] = useState('')
  const [contactId, setContactId] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [renewalDate, setRenewalDate] = useState('')
  const [portalAccess, setPortalAccess] = useState(false)
  const [touched, setTouched] = useState(false)

  const trimmed = name.trim()
  const takenNames = new Set(orgs.map((o) => o.name.trim().toLowerCase()))
  const duplicate = trimmed !== '' && takenNames.has(trimmed.toLowerCase())

  const contactOptions = useMemo(() => {
    const q = contactQuery.trim().toLowerCase()
    const pool = q
      ? people.filter((p) =>
          `${p.firstName} ${p.lastName} ${p.email ?? ''}`.toLowerCase().includes(q),
        )
      : people
    return pool.slice(0, 60).map((p) => ({
      value: p.id as string,
      label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ''}`,
    }))
  }, [people, contactQuery])

  const ownerOptions = useMemo(
    () =>
      users
        .filter((u) => u.status === 'active')
        .map((u) => ({ value: u.id as string, label: `${userName(u.id)} · ${u.email}` })),
    [users, userName],
  )

  const nameError = touched && trimmed === '' ? 'Give the organisation its registered name.' : undefined
  const duplicateError = duplicate
    ? `${trimmed} is already a client. Open the existing record rather than creating a second one — revenue and outstanding balance are tracked per organisation.`
    : undefined
  const industryError = touched && industry === '' ? 'Choose a sector. Pipeline is reported by it.' : undefined
  const sizeError = touched && size === '' ? 'Choose a headcount band.' : undefined
  const contactError =
    touched && contactId === ''
      ? 'Every organisation needs a named person to invoice and to chase. Search above to find them.'
      : undefined
  const ownerError =
    touched && ownerId === ''
      ? 'An unowned account is an account nobody renews. Name the account owner.'
      : undefined
  const renewalError =
    renewalDate !== '' && renewalDate < TODAY
      ? 'A renewal date in the past cannot be the next renewal. Leave it empty until a contract is signed.'
      : undefined

  const invalid =
    trimmed === '' ||
    duplicate ||
    industry === '' ||
    size === '' ||
    contactId === '' ||
    ownerId === '' ||
    renewalError !== undefined

  const reset = () => {
    setName('')
    setIndustry('')
    setSize('')
    setContactQuery('')
    setContactId('')
    setOwnerId('')
    setRenewalDate('')
    setPortalAccess(false)
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (invalid) return

    const id = clientOrgId(slugFor(trimmed, new Set(orgs.map((o) => o.id as string))))
    clientOrgsCollection.insert({
      id,
      name: trimmed,
      industry,
      size,
      primaryContactPersonId: contactId as PersonId,
      accountOwnerUserId: ownerId as UserId,
      contactPersonIds: [contactId as PersonId],
      lifetimeRevenue: asKobo(0),
      outstandingBalance: asKobo(0),
      participantsTrained: 0,
      renewalDate: renewalDate === '' ? null : renewalDate,
      portalAccessEnabled: portalAccess,
      ...corporateStamp(),
    })
    emitCorporateAudit({
      action: 'client_org.created',
      entityType: 'ClientOrg',
      entityId: id as string,
      entityRef: trimmed,
      field: 'accountOwnerUserId',
      before: null,
      after: userName(ownerId),
    })

    onCreated(trimmed)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      size="lg"
      title="Add an organisation"
      description="A client organisation is who the invoice is addressed to. Its participants, deals and revenue all hang off this one record, so the name has to be unique."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button leftIcon={<Building2 size={16} />} onClick={submit}>
            Add organisation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Organisation name"
          required
          error={nameError ?? duplicateError}
          hint="Checked against every client already on the book."
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={Boolean(nameError ?? duplicateError)}
            placeholder="Stanbic IBTC Holdings"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry" required error={industryError}>
            <Select
              value={industry}
              placeholder="Choose a sector"
              invalid={Boolean(industryError)}
              options={INDUSTRIES.map((i) => ({ value: i, label: i }))}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </Field>

          <Field label="Headcount" required error={sizeError}>
            <Select
              value={size}
              placeholder="Choose a band"
              invalid={Boolean(sizeError)}
              options={SIZES.map((s) => ({ value: s, label: `${s} staff` }))}
              onChange={(e) => setSize(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Search people"
          optional
          hint="The primary contact is an existing person record, so their emails, tickets and timeline stay in one place."
        >
          <Input
            value={contactQuery}
            onChange={(e) => setContactQuery(e.target.value)}
            placeholder="Name or email"
          />
        </Field>

        <Field
          label="Primary contact"
          required
          error={contactError}
          hint={
            contactOptions.length === 0
              ? undefined
              : `${formatNumber(contactOptions.length)} shown${contactQuery.trim() === '' ? ' — search to narrow the list' : ''}`
          }
        >
          <Select
            value={contactId}
            placeholder={contactOptions.length === 0 ? 'No person matches that search' : 'Choose a person'}
            invalid={Boolean(contactError)}
            options={contactOptions}
            onChange={(e) => setContactId(e.target.value)}
          />
        </Field>

        <Field label="Account owner" required error={ownerError}>
          <Select
            value={ownerId}
            placeholder="Choose a user"
            invalid={Boolean(ownerError)}
            options={ownerOptions}
            onChange={(e) => setOwnerId(e.target.value)}
          />
        </Field>

        <Field
          label="Renewal date"
          optional
          error={renewalError}
          hint="Leave empty until a contract is signed. Empty reads as 'no contract on file', not 'expired'."
        >
          <Input
            type="date"
            value={renewalDate}
            min={TODAY}
            invalid={Boolean(renewalError)}
            onChange={(e) => setRenewalDate(e.target.value)}
          />
        </Field>

        <Switch
          checked={portalAccess}
          onChange={setPortalAccess}
          label="Client portal access"
          description="Lets this client see their own participants' attendance, progress and assessment results, plus their invoices. Nothing else."
        />

        {contactId !== '' && (
          <p className="text-body-12 text-text-secondary">
            {personName(contactId)} will be the only contact on the record until more are added.
          </p>
        )}
      </div>
    </Modal>
  )
}
