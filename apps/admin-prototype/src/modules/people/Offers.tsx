import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FileSignature, Lock, Plus, TriangleAlert } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  PageHeader,
  Select,
  StatusBadge,
  TableToolbar,
  Textarea,
  Tooltip,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  approvalRequestsCollection,
  employeesCollection,
  offersCollection,
  useCollection,
} from '@/mocks'
import type { EmploymentType, Offer, OfferId, OfferStatus, UserId } from '@/mocks'

import {
  EMPLOYMENT_TYPE_LABEL,
  PeopleGroupTabs,
  Page,
  ScreenError,
  branchName,
  departmentName,
  personName,
  unitKey,
  useScreenState,
  userName,
} from './shared'
import {
  employeeForOffer,
  issueOffer,
  lapseOffer,
  offerGross,
  offerIsOverdueToResume,
  recordOfferResponse,
  recordResumption,
  staffOptions,
  withdrawOffer,
} from './writes'

const STATUSES: OfferStatus[] = ['draft', 'pending_approval', 'issued', 'accepted', 'declined', 'lapsed', 'withdrawn']

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Reference', defaultVisible: true, locked: true },
  { key: 'candidate', label: 'Candidate', defaultVisible: true },
  { key: 'role', label: 'Role', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'startDate', label: 'Start date', defaultVisible: true },
  { key: 'expiry', label: 'Expiry', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'salary', label: 'Gross (restricted)', defaultVisible: false },
  { key: 'probation', label: 'Probation months', defaultVisible: false },
  { key: 'manager', label: 'Manager', defaultVisible: false },
  { key: 'approval', label: 'Approval', defaultVisible: false },
  { key: 'issued', label: 'Issued', defaultVisible: false },
]

export default function Offers() {
  const state = useScreenState()

  const offers = useCollection(offersCollection)
  const approvals = useCollection(approvalRequestsCollection)
  const employees = useCollection(employeesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [params] = useSearchParams()
  const justCreated = params.get('created')

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return offers
      .filter((offer) => {
        if (filters.status && offer.status !== filters.status) return false
        if (filters.unit && unitKey(offer.unitId) !== filters.unit) return false
        if (!term) return true
        return (
          offer.ref.toLowerCase().includes(term) ||
          offer.jobTitle.toLowerCase().includes(term) ||
          personName(offer.personId).toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.ref.localeCompare(a.ref))
  }, [offers, filters, search])

  const open = openId ? (offers.find((o) => o.id === openId) ?? null) : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const approvalRef = (offer: Offer) =>
    offer.approvalRequestId ? (approvals.find((a) => a.id === offer.approvalRequestId)?.ref ?? null) : null

  const awaitingResumption = offers.filter(offerIsOverdueToResume)

  const allColumns: Record<string, Column<Offer>> = {
    ref: { key: 'ref', header: 'Reference', pinned: true, width: 150, accessor: (row) => <span className="font-mono text-body-13">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    candidate: { key: 'candidate', header: 'Candidate', minWidth: 190, accessor: (row) => personName(row.personId), sortValue: (row) => personName(row.personId), sortable: true },
    role: { key: 'role', header: 'Role', minWidth: 200, accessor: (row) => row.jobTitle, sortValue: (row) => row.jobTitle, sortable: true },
    status: {
      key: 'status',
      header: 'Status',
      width: 150,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={row.status} />
          {offerIsOverdueToResume(row) && (
            <Tooltip content="Accepted, start date passed, nobody has resumed. Close it as lapsed or record the resumption.">
              <TriangleAlert size={14} aria-label="Overdue to resume" className="text-warning-text" />
            </Tooltip>
          )}
        </span>
      ),
      sortValue: (row) => row.status,
      sortable: true,
    },
    startDate: { key: 'startDate', header: 'Start date', width: 130, accessor: (row) => formatDate(row.startDate), sortValue: (row) => row.startDate, sortable: true },
    expiry: {
      key: 'expiry',
      header: 'Expiry',
      width: 130,
      accessor: (row) => {
        if (!row.expiresAt) return <span className="text-text-secondary">No expiry</span>
        const expired = row.expiresAt < TODAY && row.status === 'issued'
        return <span className={expired ? 'text-danger-text' : ''}>{formatDate(row.expiresAt)}</span>
      },
      sortValue: (row) => row.expiresAt ?? '',
      sortable: true,
    },
    unit: {
      key: 'unit',
      header: 'Unit',
      width: 132,
      cell: (row) => {
        const key = unitKey(row.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : null
      },
      sortValue: (row) => unitKey(row.unitId) ?? '',
      sortable: true,
    },
    branch: { key: 'branch', header: 'Branch', width: 130, accessor: (row) => branchName(row.branchId), sortValue: (row) => branchName(row.branchId), sortable: true },
    salary: {
      key: 'salary',
      header: 'Gross',
      align: 'right',
      width: 168,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Lock size={12} aria-hidden="true" className="text-text-secondary" />
          {formatNaira(offerGross(row), { compact: true })}
        </span>
      ),
      sortValue: (row) => offerGross(row),
      sortable: true,
    },
    probation: { key: 'probation', header: 'Probation months', align: 'right', width: 166, accessor: (row) => formatNumber(row.probationMonths), sortValue: (row) => row.probationMonths, sortable: true },
    manager: { key: 'manager', header: 'Manager', minWidth: 170, accessor: (row) => userName(row.managerUserId), sortValue: (row) => userName(row.managerUserId), sortable: true },
    approval: {
      key: 'approval',
      header: 'Approval',
      width: 150,
      accessor: (row) => {
        const ref = approvalRef(row)
        return ref ? <span className="font-mono text-body-12">{ref}</span> : <span className="text-text-secondary">None</span>
      },
      sortValue: (row) => approvalRef(row) ?? '',
    },
    issued: {
      key: 'issued',
      header: 'Issued',
      width: 180,
      accessor: (row) => (row.issuedAt ? formatDateTime(row.issuedAt) : <span className="text-text-secondary">Not issued</span>),
      sortValue: (row) => row.issuedAt ?? '',
      sortable: true,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)
  const openEmployee = open ? employeeForOffer(open) : undefined

  return (
    <Page>
      <PageHeader
        title="Offers"
        description="Generated from the offer-letter template, issued, answered — and, where nobody resumed, closed as lapsed rather than turned into an employee."
        actions={
          <Button asChild leftIcon={<Plus size={16} aria-hidden="true" />}>
            <Link to="/people/offers/new">Generate an offer</Link>
          </Button>
        }
      />

      <PeopleGroupTabs group="hiring" active="offers" />

      <ScreenError state={state} />

      {notice && <Alert tone="success" title={notice} className="mb-6" onDismiss={() => setNotice(null)} />}

      {justCreated && !notice && (
        <Alert tone="success" title={`Offer ${justCreated} generated`} className="mb-6">
          The letter was rendered from the offer-letter template and is on the record. No employment record exists, and none
          will until somebody records that the candidate actually resumed.
        </Alert>
      )}

      {awaitingResumption.length > 0 && !state.loading && (
        <Alert
          tone="warning"
          icon={TriangleAlert}
          className="mb-6"
          title={`${formatNumber(awaitingResumption.length)} accepted ${awaitingResumption.length === 1 ? 'offer has' : 'offers have'} passed their start date with nobody resuming`}
        >
          Acceptance is not employment. Until somebody actually resumes there is no employee record, so nothing has been
          added to payroll. Record the resumption if they turned up late, or close the offer as lapsed.
        </Alert>
      )}

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by reference, candidate or role"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[{ key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) }]}
              right={<ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => setOpenId(row.id)}
            activeRowKey={open?.id}
            density="compact"
            minWidth={1250}
            bordered={false}
            caption="Offers with candidate, role, status, start date and expiry"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No offers match these filters"
                  message="Try another status, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={FileSignature}
                  title="No offer has been generated"
                  message="An offer is what turns a decision into a commitment. Until one is issued the candidate has heard nothing, however far through the pipeline they are."
                  action={
                    <Button size="sm" asChild>
                      <Link to="/people/offers/new">Generate an offer</Link>
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>

      <OfferDrawer
        offer={open}
        onClose={() => setOpenId(null)}
        onAction={(message) => setNotice(message)}
        employeeNumber={openEmployee?.employeeId ?? null}
        approvalRef={open ? approvalRef(open) : null}
      />
    </Page>
  )
}

function OfferDrawer({
  offer,
  onClose,
  onAction,
  employeeNumber,
  approvalRef,
}: {
  offer: Offer | null
  onClose: () => void
  onAction: (message: string) => void
  employeeNumber: string | null
  approvalRef: string | null
}) {
  const [note, setNote] = useState('')
  const [resumedOn, setResumedOn] = useState(TODAY)
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time')
  const [buddyUserId, setBuddyUserId] = useState<string>('')
  const [touched, setTouched] = useState(false)

  const staff = useMemo(() => staffOptions(), [])

  if (!offer) {
    return <Drawer open={false} onClose={onClose} title="Offer" />
  }

  const gross = offerGross(offer)
  const overdue = offerIsOverdueToResume(offer)

  const respond = (response: 'accepted' | 'declined') => {
    setTouched(true)
    if (response === 'declined' && note.trim().length === 0) return
    recordOfferResponse(offer.id as OfferId, response, note)
    setNote('')
    setTouched(false)
    onAction(
      response === 'accepted'
        ? `${offer.ref} accepted. No employment record was created — record the resumption when they actually start.`
        : `${offer.ref} declined.`,
    )
  }

  return (
    <Drawer
      open
      onClose={onClose}
      size="lg"
      title={`${offer.ref} — ${personName(offer.personId)}`}
      description={`${offer.jobTitle} · ${departmentName(offer.departmentId)} · start ${formatDate(offer.startDate)}`}
    >
      <div className="space-y-6">
        <KeyValueList columns={2}>
          <KeyValue label="Status">
            <StatusBadge status={offer.status} />
          </KeyValue>
          <KeyValue label="Unit">
            {(() => {
              const key = unitKey(offer.unitId)
              return key ? <UnitTag unit={key} /> : '—'
            })()}
          </KeyValue>
          <KeyValue label="Branch">{branchName(offer.branchId)}</KeyValue>
          <KeyValue label="Manager">{userName(offer.managerUserId)}</KeyValue>
          <KeyValue label="Probation">{`${formatNumber(offer.probationMonths)} months`}</KeyValue>
          <KeyValue label="Expires">{offer.expiresAt ? formatDate(offer.expiresAt) : 'No expiry'}</KeyValue>
          <KeyValue label="Issued">{offer.issuedAt ? formatDateTime(offer.issuedAt) : 'Not issued'}</KeyValue>
          <KeyValue label="Responded">{offer.respondedAt ? formatDateTime(offer.respondedAt) : 'No response yet'}</KeyValue>
          <KeyValue label="Approval">{approvalRef ?? 'None attached'}</KeyValue>
          <KeyValue label="Offer letter">
            {offer.documentId ? <span className="font-mono text-body-12">{`DOC-${offer.ref}`}</span> : 'Not generated'}
          </KeyValue>
        </KeyValueList>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h3 className="text-heading-18">Terms</h3>
            <Tooltip content="In production the money on an offer sits behind narrower permissions than the offer itself.">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-fill px-2 py-0.5 text-label-10 text-warning-ink">
                <Lock size={12} aria-hidden="true" />
                Restricted
              </span>
            </Tooltip>
          </div>
          <KeyValueList>
            <KeyValue label="Base salary">{formatNaira(offer.baseSalary)}</KeyValue>
            {offer.allowances.map((allowance) => (
              <KeyValue key={allowance.label} label={allowance.label}>
                {formatNaira(allowance.amount)}
              </KeyValue>
            ))}
            <KeyValue label="Gross, per month">
              <span className="font-semibold">{formatNaira(gross)}</span>
            </KeyValue>
          </KeyValueList>
        </div>

        {employeeNumber && (
          <Alert tone="success" title={`Resumed as ${employeeNumber}`}>
            The employment record was created at resumption, not at acceptance, and carries its first immutable compensation
            version from the terms above.
          </Alert>
        )}

        {offer.status === 'lapsed' && (
          <Alert tone="warning" title="Accepted, then never resumed">
            No employment record was created, so there is no payroll line or unit cost allocation to reverse.
          </Alert>
        )}

        {offer.status === 'draft' && (
          <div className="rounded-xl border border-border p-4">
            <h3 className="mb-2 text-heading-18">Issue this offer</h3>
            <p className="mb-3 text-body-13 text-text-secondary">
              Issuing sends the generated letter for signature and starts the expiry clock.
            </p>
            <Button
              onClick={() => {
                issueOffer(offer.id as OfferId)
                onAction(`${offer.ref} issued.`)
              }}
            >
              Issue offer
            </Button>
          </div>
        )}

        {offer.status === 'issued' && (
          <div className="rounded-xl border border-border p-4">
            <h3 className="mb-2 text-heading-18">Record the candidate's response</h3>
            <p className="mb-3 text-body-13 text-text-secondary">
              Accepting records an answer. It does <span className="font-semibold text-text">not</span> create an employee —
              that only happens when they resume.
            </p>
            <Field
              label="Note"
              hint="Required on a decline, so the reason is on file for the next opening."
              error={touched && note.trim().length === 0 ? 'A decline needs a reason.' : undefined}
            >
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Counter-offer from their current employer." />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={() => respond('accepted')}>Record acceptance</Button>
              <Button variant="danger" onClick={() => respond('declined')}>
                Record decline
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  withdrawOffer(offer.id as OfferId, note.trim() || 'Withdrawn before a response')
                  onAction(`${offer.ref} withdrawn.`)
                }}
              >
                Withdraw offer
              </Button>
            </div>
          </div>
        )}

        {offer.status === 'accepted' && !employeeNumber && (
          <div className="rounded-xl border border-border p-4">
            <h3 className="mb-2 text-heading-18">Did they resume?</h3>
            <p className="mb-3 text-body-13 text-text-secondary">
              {overdue
                ? 'The start date has passed and no employment record exists. Either they turned up late, or this offer lapsed.'
                : 'Record the resumption on the day they actually walk in. That is what creates the employment record, the first compensation version and the onboarding checklist.'}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Resumed on" required hint="The day they actually started, which need not be the offered date.">
                <Input type="date" value={resumedOn} onChange={(e) => setResumedOn(e.target.value)} />
              </Field>
              <Field label="Employment type" required>
                <Select
                  value={employmentType}
                  options={(['full_time', 'part_time', 'contract', 'intern'] as EmploymentType[]).map((t) => ({
                    value: t,
                    label: EMPLOYMENT_TYPE_LABEL[t],
                  }))}
                  onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                />
              </Field>
            </div>
            <Field label="Onboarding buddy" optional hint="Assigned on the checklist and recorded in the audit log.">
              <Select
                value={buddyUserId}
                placeholder="No buddy assigned"
                options={staff}
                onChange={(e) => setBuddyUserId(e.target.value)}
              />
            </Field>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  const result = recordResumption({
                    offerId: offer.id as OfferId,
                    resumedOn,
                    employmentType,
                    buddyUserId: buddyUserId ? (buddyUserId as UserId) : null,
                  })
                  onAction(
                    result
                      ? `${personName(offer.personId)} resumed as ${result.employee.employeeId}. ${formatNumber(result.tasks.length)} onboarding tasks created.`
                      : 'Nothing was written — this offer already has an employment record.',
                  )
                }}
              >
                Record resumption
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  lapseOffer(offer.id as OfferId, note.trim() || 'Accepted but never resumed')
                  onAction(`${offer.ref} closed as lapsed. No employment record was created.`)
                }}
              >
                Close as lapsed
              </Button>
            </div>
            <Badge tone="neutral" className="mt-3">
              No employee record exists for this offer yet
            </Badge>
          </div>
        )}
      </div>
    </Drawer>
  )
}
