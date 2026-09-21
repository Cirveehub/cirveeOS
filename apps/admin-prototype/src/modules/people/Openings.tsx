/**
 * Job openings — `/people/openings` (screen-spec §9).
 *
 * A requisition is how a department asks for headcount, so this list answers
 * two questions per row: what is the role, and is anything holding it up. The
 * salary band is deliberately **not** a default column — it sits behind a row
 * click with a restricted chip, because in production this list is visible to
 * far more people than the band is.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, Lock, Plus } from 'lucide-react'

import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  BUSINESS_UNITS,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  Select,
  StatusBadge,
  TableToolbar,
  Textarea,
  Tooltip,
  UNIT_META,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  approvalRequestsCollection,
  candidatesCollection,
  departmentsCollection,
  jobOpeningsCollection,
  useCollection,
} from '@/mocks'
import type { JobOpening, JobOpeningStatus } from '@/mocks'

import {
  EMPLOYMENT_TYPE_LABEL,
  PeopleGroupTabs,
  Page,
  ScreenError,
  branchName,
  departmentName,
  unitKey,
  useModuleNav,
  useScreenState,
  userName,
} from './shared'
import { annualisedCost, setOpeningStatus } from './writes'

const STATUSES: JobOpeningStatus[] = ['draft', 'approved', 'open', 'on_hold', 'filled', 'cancelled']

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Reference', defaultVisible: true, locked: true },
  { key: 'title', label: 'Title', defaultVisible: true },
  { key: 'department', label: 'Department', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'type', label: 'Employment type', defaultVisible: false },
  { key: 'headcount', label: 'Headcount', defaultVisible: true },
  { key: 'salary', label: 'Salary band (restricted)', defaultVisible: false },
  { key: 'manager', label: 'Hiring manager', defaultVisible: false },
  { key: 'approval', label: 'Approval', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'opened', label: 'Opened', defaultVisible: false },
  { key: 'daysOpen', label: 'Days open', defaultVisible: true },
  { key: 'applicants', label: 'Applicants', defaultVisible: true },
  { key: 'pipeline', label: 'In pipeline', defaultVisible: true },
  { key: 'targetStart', label: 'Target start', defaultVisible: false },
]

function daysOpen(opening: JobOpening): number | null {
  if (!opening.openedAt) return null
  return Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${opening.openedAt}T00:00:00Z`)) / 86_400_000)
}

export default function Openings() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const openings = useCollection(jobOpeningsCollection)
  const departments = useCollection(departmentsCollection)
  const candidates = useCollection(candidatesCollection)
  const approvals = useCollection(approvalRequestsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [nextStatus, setNextStatus] = useState<JobOpeningStatus | ''>('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return openings
      .filter((opening) => {
        if (filters.status && opening.status !== filters.status) return false
        if (filters.unit && unitKey(opening.unitId) !== filters.unit) return false
        if (filters.department && opening.departmentId !== filters.department) return false
        if (!term) return true
        return (
          opening.title.toLowerCase().includes(term) ||
          opening.ref.toLowerCase().includes(term) ||
          opening.reason.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.ref.localeCompare(a.ref))
  }, [openings, filters, search])

  const open = openId ? (openings.find((o) => o.id === openId) ?? null) : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const approvalRef = (opening: JobOpening): string | null =>
    opening.approvalRequestId ? (approvals.find((a) => a.id === opening.approvalRequestId)?.ref ?? null) : null

  const allColumns: Record<string, Column<JobOpening>> = {
    ref: {
      key: 'ref',
      header: 'Reference',
      pinned: true,
      width: 140,
      accessor: (row) => <span className="font-mono text-body-13">{row.ref}</span>,
      sortValue: (row) => row.ref,
      sortable: true,
    },
    title: { key: 'title', header: 'Title', minWidth: 210, accessor: (row) => row.title, sortValue: (row) => row.title, sortable: true },
    department: {
      key: 'department',
      header: 'Department',
      minWidth: 170,
      accessor: (row) => departmentName(row.departmentId),
      sortValue: (row) => departmentName(row.departmentId),
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
    type: {
      key: 'type',
      header: 'Employment type',
      width: 156,
      accessor: (row) => EMPLOYMENT_TYPE_LABEL[row.employmentType] ?? row.employmentType,
      sortValue: (row) => row.employmentType,
      sortable: true,
    },
    headcount: { key: 'headcount', header: 'Headcount', align: 'right', width: 112, accessor: (row) => formatNumber(row.headcount), sortValue: (row) => row.headcount, sortable: true },
    salary: {
      key: 'salary',
      header: 'Salary band',
      align: 'right',
      minWidth: 210,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <Lock size={12} aria-hidden="true" className="text-text-secondary" />
          {formatNaira(row.salaryMin, { compact: true })} – {formatNaira(row.salaryMax, { compact: true })}
        </span>
      ),
      sortValue: (row) => row.salaryMax,
      sortable: true,
    },
    manager: { key: 'manager', header: 'Hiring manager', minWidth: 170, accessor: (row) => userName(row.hiringManagerUserId), sortValue: (row) => userName(row.hiringManagerUserId), sortable: true },
    approval: {
      key: 'approval',
      header: 'Approval',
      width: 150,
      accessor: (row) => {
        const ref = approvalRef(row)
        return ref ? <span className="font-mono text-body-12">{ref}</span> : <span className="text-text-secondary">Not raised</span>
      },
      sortValue: (row) => approvalRef(row) ?? '',
    },
    status: { key: 'status', header: 'Status', width: 128, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    opened: {
      key: 'opened',
      header: 'Opened',
      width: 124,
      accessor: (row) => (row.openedAt ? formatDate(row.openedAt) : <span className="text-text-secondary">Not yet</span>),
      sortValue: (row) => row.openedAt ?? '',
      sortable: true,
    },
    daysOpen: {
      key: 'daysOpen',
      header: 'Days open',
      align: 'right',
      width: 118,
      accessor: (row) => {
        const days = daysOpen(row)
        if (days === null) return <span className="text-text-secondary">—</span>
        return <span className={`tabular-nums ${days > 45 && row.status === 'open' ? 'text-warning-text' : ''}`}>{formatNumber(days)}</span>
      },
      sortValue: (row) => daysOpen(row) ?? -1,
      sortable: true,
    },
    applicants: { key: 'applicants', header: 'Applicants', align: 'right', width: 116, accessor: (row) => formatNumber(row.applicantCount), sortValue: (row) => row.applicantCount, sortable: true },
    pipeline: { key: 'pipeline', header: 'In pipeline', align: 'right', width: 116, accessor: (row) => formatNumber(row.inPipelineCount), sortValue: (row) => row.inPipelineCount, sortable: true },
    targetStart: { key: 'targetStart', header: 'Target start', width: 130, accessor: (row) => formatDate(row.targetStartDate), sortValue: (row) => row.targetStartDate, sortable: true },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  const applyStatus = () => {
    setTouched(true)
    if (!open || !nextStatus || reason.trim().length === 0) return
    setOpeningStatus(open.id, nextStatus, reason)
    setNextStatus('')
    setReason('')
    setTouched(false)
  }

  const openCandidates = open ? candidates.filter((c) => c.openingId === open.id) : []

  return (
    <Page>
      <PageHeader
        title="Job openings"
        description="Every requisition raised by a department, with the approval that authorised the headcount and how far the pipeline behind it has got."
        actions={
          <Button asChild leftIcon={<Plus size={16} aria-hidden="true" />}>
            <Link to="/people/openings/new">Add a job opening</Link>
          </Button>
        }
      />

      <PeopleGroupTabs group="hiring" active="openings" />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by title, reference or reason"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
                { key: 'department', label: 'Department', options: departments.map((d) => ({ value: d.id as string, label: d.name })) },
              ]}
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
            minWidth={1400}
            bordered={false}
            defaultSort={{ key: 'daysOpen', direction: 'desc' }}
            caption="Job openings with department, unit, status, days open and pipeline depth"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No openings match these filters"
                  message="Try another status, unit or department, or clear the search."
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
                  icon={BriefcaseBusiness}
                  title="No job openings have been raised"
                  message="Nobody can be hired without a requisition. Raising one is how a department asks for headcount and gets it approved before a single candidate is contacted."
                  action={
                    <Button size="sm" asChild leftIcon={<Plus size={16} aria-hidden="true" />}>
                      <Link to="/people/openings/new">Add a job opening</Link>
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => {
          setOpenId(null)
          setNextStatus('')
          setReason('')
          setTouched(false)
        }}
        size="lg"
        title={open ? open.title : 'Job opening'}
        description={open ? `${open.ref} · ${departmentName(open.departmentId)} · ${branchName(open.branchId)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Headcount">{formatNumber(open.headcount)}</KeyValue>
              <KeyValue label="Employment type">{EMPLOYMENT_TYPE_LABEL[open.employmentType] ?? open.employmentType}</KeyValue>
              <KeyValue label="Hiring manager">{userName(open.hiringManagerUserId)}</KeyValue>
              <KeyValue label="Target start">{formatDate(open.targetStartDate)}</KeyValue>
              <KeyValue label="Opened">{open.openedAt ? formatDate(open.openedAt) : 'Not opened yet'}</KeyValue>
              <KeyValue label="Applicants" hint={`${formatNumber(open.inPipelineCount)} still in the pipeline`}>
                {formatNumber(open.applicantCount)}
              </KeyValue>
              <KeyValue label="Approval">
                {approvalRef(open) && open.approvalRequestId ? (
                  <Link
                    className="font-mono text-body-13 text-accent underline-offset-2 hover:underline"
                    to={`/work/approvals/${open.approvalRequestId}`}
                  >
                    {approvalRef(open)}
                  </Link>
                ) : (
                  'Not raised'
                )}
              </KeyValue>
            </KeyValueList>

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <h3 className="text-heading-18">Salary band</h3>
                <Tooltip content="In production the band on a requisition sits behind narrower permissions than the requisition itself.">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-fill px-2 py-0.5 text-label-10 text-warning-ink">
                    <Lock size={12} aria-hidden="true" />
                    Restricted
                  </span>
                </Tooltip>
              </div>
              <p className="text-body-14 text-text">
                {formatNaira(open.salaryMin)} – {formatNaira(open.salaryMax)} gross per month
              </p>
              <p className="mt-1 text-body-13 text-text-secondary">
                {formatNaira(annualisedCost(open))} a year at the top of the band across {formatNumber(open.headcount)}{' '}
                {open.headcount === 1 ? 'position' : 'positions'} — the figure the approval route was resolved against.
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-heading-18">Why this role exists</h3>
              <p className="text-body-14 text-text-secondary">{open.reason}</p>
              <p className="mt-3 text-body-13 text-text-secondary">{open.jobDescription}</p>
            </div>

            <div>
              <h3 className="mb-2 text-heading-18">Candidates against this opening</h3>
              {openCandidates.length === 0 ? (
                <EmptyState
                  size="sm"
                  bordered
                  title="No applications yet"
                  message="An open role with nobody in the pipeline will not fill itself."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('candidates')}>
                      Open the candidate pipeline
                    </Button>
                  }
                />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {openCandidates.map((candidate) => (
                    <Badge key={candidate.id} tone="neutral">
                      {candidate.stage.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {open.status === 'cancelled' || open.status === 'filled' ? (
              <Alert tone="info" title={`This requisition is ${open.status}`}>
                Nothing is hard-deleted here. A closed requisition keeps its applicants, its approval and its history, so the
                cost of a role that was never filled stays answerable.
              </Alert>
            ) : (
              <div className="rounded-xl border border-border p-4">
                <h3 className="mb-3 text-heading-18">Move this requisition</h3>
                <div className="flex flex-col gap-4">
                  <Field label="New status" required>
                    <Select
                      value={nextStatus}
                      placeholder="Choose a status"
                      options={STATUSES.filter((s) => s !== open.status).map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                      onChange={(e) => setNextStatus(e.target.value as JobOpeningStatus)}
                    />
                  </Field>
                  <Field
                    label="Reason"
                    required
                    hint="Written to the audit log against this requisition."
                    error={touched && reason.trim().length === 0 ? 'Say why the requisition is moving.' : undefined}
                  >
                    <Textarea
                      rows={2}
                      value={reason}
                      invalid={touched && reason.trim().length === 0}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Approved at the board meeting — advertising from Monday."
                    />
                  </Field>
                  <div>
                    <Button onClick={applyStatus} disabled={!nextStatus}>
                      Save status change
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </Page>
  )
}
