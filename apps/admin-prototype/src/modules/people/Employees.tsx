import { useMemo, useState } from 'react'
import { History, Lock, ShieldAlert, Users } from 'lucide-react'
import toast from 'react-hot-toast'

import { formatDate, formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { useCan } from '@/auth'
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
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  MoneyCell,
  PageHeader,
  Pagination,
  StatusBadge,
  TableToolbar,
  UNIT_META,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import { TODAY, addDays, attendanceEventsCollection, departmentsCollection, employeesCollection, useCollection } from '@/mocks'
import type { CompensationVersion, Employee } from '@/mocks'

import { setProbationOutcome } from './writes'
import {
  EMPLOYMENT_TYPE_LABEL,
  PeopleGroupTabs,
  Page,
  ScreenError,
  branchName,
  departmentName,
  personName,
  unitKey,
  useModuleNav,
  useScreenState,
  userName,
} from './shared'

const STATUSES = ['active', 'probation', 'on_leave', 'notice', 'exited', 'suspended'] as const
const TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const
const PAGE_SIZE = 25

/**
 * Fourteen possible columns, eight shown. The density audit flagged this table
 * by name; the fix is the checklist's A.4 pattern — a curated default that
 * answers "who is this and does anything need doing", with the rest one click
 * away behind `ColumnPicker` and linkable through `?cols=`.
 */
const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'employeeId', label: 'Employee ID', defaultVisible: true, locked: true },
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'title', label: 'Job title', defaultVisible: true },
  { key: 'department', label: 'Department', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'attendance', label: 'Attendance, 30 days', defaultVisible: true },
  { key: 'tenure', label: 'Tenure', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'manager', label: 'Manager', defaultVisible: false },
  { key: 'type', label: 'Employment type', defaultVisible: false },
  { key: 'start', label: 'Start date', defaultVisible: false },
  { key: 'leave', label: 'Leave balance', defaultVisible: false },
  { key: 'compensation', label: 'Compensation versions', defaultVisible: false },
]

function tenureYears(startDate: string): number {
  return (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / (365.25 * 86_400_000)
}

export default function Employees() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const employees = useCollection(employeesCollection)
  useCollection(departmentsCollection)
  const attendance = useCollection(attendanceEventsCollection)
  const can = useCan()
  const seesSensitive = can('people.compensation.view.organisation')

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [probationOutcomeDraft, setProbationOutcomeDraft] = useState<'confirmed' | 'extended' | 'ended' | null>(null)
  const [probationNote, setProbationNote] = useState('')
  const [probationNewDate, setProbationNewDate] = useState('')

  const attendance30d = useMemo(() => {
    const from = addDays(TODAY, -30)
    const map = new Map<string, number | null>()
    for (const employee of employees) {
      const rows = attendance.filter((a) => a.employeeId === employee.id && a.date >= from && a.date <= TODAY)
      const counted = rows.filter((a) => a.state !== 'holiday' && a.state !== 'off_day')
      map.set(
        employee.id,
        counted.length === 0
          ? null
          : (counted.filter((a) => ['present', 'late', 'remote_approved'].includes(a.state)).length / counted.length) * 100,
      )
    }
    return map
  }, [employees, attendance])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees
      .filter((employee) => {
        if (filters.status && employee.status !== filters.status) return false
        if (filters.type && employee.employmentType !== filters.type) return false
        if (filters.unit && unitKey(employee.unitId) !== filters.unit) return false
        if (!term) return true
        return (
          personName(employee.personId).toLowerCase().includes(term) ||
          employee.employeeId.toLowerCase().includes(term) ||
          employee.jobTitle.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => personName(a.personId).localeCompare(personName(b.personId)))
  }, [employees, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const open = openId ? employees.find((e) => e.id === openId) ?? null : null

  const annualLeaveRemaining = (employee: Employee) =>
    employee.leaveBalances.find((b) => b.type === 'annual')?.remaining ?? employee.leaveBalances.reduce((acc, b) => acc + b.remaining, 0)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const allColumns: Record<string, Column<Employee>> = Object.fromEntries(
    ([
    { key: 'employeeId', header: 'Employee ID', pinned: true, width: 128, accessor: (row) => <span className="font-mono text-body-13">{row.employeeId}</span>, sortValue: (row) => row.employeeId, sortable: true },
    { key: 'name', header: 'Name', minWidth: 190, accessor: (row) => personName(row.personId), sortValue: (row) => personName(row.personId), sortable: true },
    { key: 'title', header: 'Job title', minWidth: 200, accessor: (row) => row.jobTitle, sortValue: (row) => row.jobTitle, sortable: true },
    { key: 'department', header: 'Department', minWidth: 170, accessor: (row) => departmentName(row.departmentId), sortValue: (row) => departmentName(row.departmentId), sortable: true },
    {
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
    { key: 'branch', header: 'Branch', width: 132, accessor: (row) => branchName(row.branchId), sortValue: (row) => branchName(row.branchId), sortable: true },
    { key: 'manager', header: 'Manager', minWidth: 170, accessor: (row) => userName(row.managerUserId), sortValue: (row) => userName(row.managerUserId) },
    { key: 'type', header: 'Employment type', width: 156, accessor: (row) => EMPLOYMENT_TYPE_LABEL[row.employmentType] ?? row.employmentType, sortValue: (row) => row.employmentType, sortable: true },
    { key: 'start', header: 'Start date', width: 124, accessor: (row) => formatDate(row.startDate), sortValue: (row) => row.startDate, sortable: true },
    { key: 'tenure', header: 'Tenure', align: 'right', width: 104, accessor: (row) => `${tenureYears(row.startDate).toFixed(1)} yrs`, sortValue: (row) => tenureYears(row.startDate), sortable: true },
    { key: 'status', header: 'Status', width: 124, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    {
      key: 'attendance',
      header: 'Attendance, 30 days',
      align: 'right',
      width: 168,
      accessor: (row) => {
        const rate = attendance30d.get(row.id)
        if (rate === null || rate === undefined) return <span className="text-text-secondary">No records</span>
        return <span className={`tabular-nums ${rate < 80 ? 'text-warning-text' : ''}`}>{formatPercent(rate)}</span>
      },
      sortValue: (row) => attendance30d.get(row.id) ?? -1,
      sortable: true,
    },
    {
      key: 'leave',
      header: 'Leave balance',
      align: 'right',
      width: 136,
      accessor: (row) => `${formatNumber(annualLeaveRemaining(row))} days`,
      sortValue: (row) => annualLeaveRemaining(row),
      sortable: true,
    },
    {
      key: 'compensation',
      header: 'Compensation versions',
      align: 'right',
      width: 184,
      cell: (row) => <Badge tone="neutral" size="sm">{formatNumber(row.compensationVersions.length)} on record</Badge>,
      sortValue: (row) => row.compensationVersions.length,
      sortable: true,
    },
  ] as Array<Column<Employee>>).map((column) => [column.key, column]),
  )

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  const compensationColumns: Array<Column<CompensationVersion>> = [
    { key: 'from', header: 'Effective from', width: 140, accessor: (row) => formatDate(row.effectiveFrom), sortValue: (row) => row.effectiveFrom, sortable: true },
    {
      key: 'to',
      header: 'Effective to',
      width: 140,
      accessor: (row) => (row.effectiveTo ? formatDate(row.effectiveTo) : <Badge tone="success" size="sm">Current</Badge>),
      sortValue: (row) => row.effectiveTo ?? '9999',
      sortable: true,
    },
    { key: 'base', header: 'Base salary', align: 'right', cell: (row) => <MoneyCell kobo={row.baseSalary} />, sortValue: (row) => row.baseSalary, sortable: true },
    {
      key: 'allowances',
      header: 'Allowances',
      minWidth: 220,
      cell: (row) =>
        row.allowances.length === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <span className="text-body-13">{row.allowances.map((a) => `${a.label} ${formatNaira(a.amount, { compact: true })}`).join(' · ')}</span>
        ),
      sortValue: (row) => row.allowances.reduce((acc, a) => acc + a.amount, 0),
      sortable: true,
    },
    { key: 'gross', header: 'Gross', align: 'right', cell: (row) => <MoneyCell kobo={row.gross} strong />, sortValue: (row) => row.gross, sortable: true },
    { key: 'reason', header: 'Reason', minWidth: 200, accessor: (row) => row.reason, sortValue: (row) => row.reason },
    { key: 'approvedBy', header: 'Approved by', minWidth: 160, accessor: (row) => userName(row.approvedByUserId), sortValue: (row) => userName(row.approvedByUserId) },
    {
      key: 'approval',
      header: 'Approval',
      width: 140,
      accessor: (row) => (row.approvalRequestId ? <span className="font-mono text-body-12">{row.approvalRequestId}</span> : <span className="text-text-secondary">—</span>),
      sortValue: (row) => row.approvalRequestId ?? '',
    },
  ]

  const openVersions = open ? [...open.compensationVersions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom)) : []
  const current = openVersions.find((v) => v.effectiveTo === null) ?? openVersions[0]

  return (
    <Page>
      <PageHeader
        title="Employees"
        description="Everyone on the payroll, with the unit their cost is allocated to and the full history of what they have been paid."
      />

      <PeopleGroupTabs group="workforce" active="employees" />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by name, employee ID or job title"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setPage(1)
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                { key: 'type', label: 'Employment type', options: TYPES.map((t) => ({ value: t, label: t.replace(/_/g, ' ') })) },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
              ]}
              right={<ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => setOpenId(row.id)}
            activeRowKey={open?.id}
            density="compact"
            minWidth={1500}
            bordered={false}
            caption="Employees with job title, department, unit, branch, manager, tenure, status and attendance"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No employees match these filters"
                  message="Try another status, employment type or unit, or clear the search."
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
                  icon={Users}
                  title="No employee records"
                  message="An employee record is created when an offer is accepted and the person actually resumes. Until then there is nothing to pay or allocate to a unit."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('candidates')}>
                      Open the candidate pipeline
                    </Button>
                  }
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="employees" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="xl"
        title={open ? personName(open.personId) : 'Employee'}
        description={open ? `${open.jobTitle} · ${departmentName(open.departmentId)} · ${branchName(open.branchId)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Employee ID">
                <span className="font-mono text-body-13">{open.employeeId}</span>
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Unit">
                {(() => {
                  const key = unitKey(open.unitId)
                  return key ? <UnitTag unit={key} /> : '—'
                })()}
              </KeyValue>
              <KeyValue label="Manager">{userName(open.managerUserId)}</KeyValue>
              <KeyValue label="Started" hint={`${tenureYears(open.startDate).toFixed(1)} years ago`}>
                {formatDate(open.startDate)}
              </KeyValue>
              <KeyValue label="Probation">
                {open.probationEndsAt
                  ? `${formatDate(open.probationEndsAt)}${open.probationOutcome ? ` · ${open.probationOutcome}` : ' · outcome not recorded'}`
                  : 'Not on probation'}
              </KeyValue>
            </KeyValueList>

            {open.status === 'probation' && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-sunken px-3 py-2.5">
                <span className="text-body-13 text-text-secondary">Probation outcome:</span>
                <Button size="sm" onClick={() => setProbationOutcomeDraft('confirmed')}>
                  Confirm
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setProbationOutcomeDraft('extended')}>
                  Extend
                </Button>
                <Button size="sm" variant="danger" onClick={() => setProbationOutcomeDraft('ended')}>
                  End
                </Button>
              </div>
            )}

            {seesSensitive ? (
              <>
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-3">
                    <h3 className="text-heading-18">Compensation history</h3>
                    <Badge tone="warning" variant="subtle" icon={<Lock size={12} aria-hidden="true" />}>
                      Restricted
                    </Badge>
                  </div>

                  <Alert tone="info" icon={History} title="Every row here is immutable" className="mb-4">
                    A pay change appends a new version and end-dates the previous one. Nothing is overwritten, so a payslip from two
                    years ago can still be explained by the figures that were in force on the day it was issued.
                  </Alert>

                  {current && (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-sunken px-4 py-3">
                      <span className="text-body-13 text-text-secondary">
                        Currently on {formatNaira(current.gross)} gross, effective {formatDate(current.effectiveFrom)}
                      </span>
                      <Badge tone="neutral">{formatNumber(openVersions.length)} versions on record</Badge>
                    </div>
                  )}

                  <DataTable
                    data={openVersions}
                    columns={compensationColumns}
                    rowKey={(row) => row.id}
                    density="compact"
                    minWidth={1280}
                    defaultSort={{ key: 'from', direction: 'desc' }}
                    caption={`Compensation versions for ${personName(open.personId)}`}
                    empty={
                      <EmptyState
                        size="sm"
                        title="No compensation version recorded"
                        message="Without a version, payroll has no base salary to calculate from and this employee cannot be paid."
                      />
                    }
                  />
                </div>

                <div>
                  <h3 className="mb-3 text-heading-18">Bank details</h3>
                  {open.bankDetails ? (
                    <KeyValueList columns={2}>
                      <KeyValue label="Bank">{open.bankDetails.bankName}</KeyValue>
                      <KeyValue label="Account">{`•••• ${open.bankDetails.accountLast4}`}</KeyValue>
                    </KeyValueList>
                  ) : (
                    <p className="text-body-13 text-text-secondary">No bank details on file yet.</p>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-heading-18">Disciplinary records</h3>
                  {open.disciplinaryRecords.length === 0 ? (
                    <p className="text-body-13 text-text-secondary">Nothing on record.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {open.disciplinaryRecords.map((rec) => (
                        <li key={rec.id} className="rounded-xl border border-border px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-body-13 font-medium text-text">{rec.category}</span>
                            <span className="text-body-12 text-text-muted">{formatDate(rec.date)}</span>
                          </div>
                          <p className="mt-1 text-body-13 text-text-secondary">{rec.summary}</p>
                          <p className="mt-1 text-body-12 text-text-muted">Issued by {userName(rec.issuedByUserId)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-10 text-center">
                <div className="grid size-11 place-items-center rounded-full bg-surface-sunken text-text-muted">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <p className="text-body-15 font-semibold text-text">Compensation, bank details and disciplinary records are restricted</p>
                  <p className="mt-1 text-body-13 text-text-secondary">
                    These sit behind a narrower permission than the rest of this record. Ask whoever configures roles if you need access.
                  </p>
                </div>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-heading-18">Leave balances</h3>
              {open.leaveBalances.length === 0 ? (
                <p className="text-body-13 text-text-secondary">No entitlement recorded against this employee.</p>
              ) : (
                <KeyValueList columns={2}>
                  {open.leaveBalances.map((balance) => (
                    <KeyValue key={balance.type} label={balance.type} hint={`${formatNumber(balance.taken)} of ${formatNumber(balance.entitled)} days taken`}>
                      {`${formatNumber(balance.remaining)} days remaining`}
                    </KeyValue>
                  ))}
                </KeyValueList>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        open={probationOutcomeDraft !== null}
        onClose={() => setProbationOutcomeDraft(null)}
        title={
          probationOutcomeDraft === 'confirmed'
            ? 'Confirm probation'
            : probationOutcomeDraft === 'extended'
              ? 'Extend probation'
              : 'End probation'
        }
        description={open ? personName(open.personId) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setProbationOutcomeDraft(null)}>
              Cancel
            </Button>
            <Button
              variant={probationOutcomeDraft === 'ended' ? 'danger' : 'primary'}
              onClick={() => {
                if (!open || !probationOutcomeDraft) return
                setProbationOutcome(open.id, probationOutcomeDraft, probationNote, probationNewDate || undefined)
                toast.success(
                  probationOutcomeDraft === 'confirmed'
                    ? `${personName(open.personId)} is confirmed.`
                    : probationOutcomeDraft === 'extended'
                      ? `${personName(open.personId)}'s probation is extended.`
                      : `${personName(open.personId)}'s employment is ending — an exit case has been opened.`,
                )
                setProbationOutcomeDraft(null)
                setProbationNote('')
                setProbationNewDate('')
              }}
            >
              {probationOutcomeDraft === 'confirmed' ? 'Confirm' : probationOutcomeDraft === 'extended' ? 'Extend' : 'End probation'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {probationOutcomeDraft === 'extended' && (
            <Field label="New probation end date">
              <Input type="date" value={probationNewDate} onChange={(e) => setProbationNewDate(e.target.value)} />
            </Field>
          )}
          {probationOutcomeDraft === 'ended' && (
            <Alert tone="warning" title="This opens an exit case">
              Ending probation never deletes the employment record — it opens an exit case (notice review through to
              final settlement), the same as any other exit.
            </Alert>
          )}
          <Field label="Note" optional>
            <Input value={probationNote} onChange={(e) => setProbationNote(e.target.value)} placeholder="Why, for the record" />
          </Field>
        </div>
      </Modal>
    </Page>
  )
}
