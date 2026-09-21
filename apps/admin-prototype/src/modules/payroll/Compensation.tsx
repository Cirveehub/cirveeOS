/**
 * Compensation.
 *
 * A pay change **appends a version and end-dates the previous one**. Nothing is
 * ever overwritten, which is why a payslip from two years ago can still be
 * explained by the figures that were in force on the day it was issued.
 */
import { useMemo, useState } from 'react'
import { History, Lock, Users } from 'lucide-react'

import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  BUSINESS_UNITS,
  Button,
  Card,
  CardBody,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  MoneyCell,
  PageHeader,
  StatusBadge,
  TableToolbar,
  Tooltip,
  UNIT_META,
  UnitTag,
  type Column,
  type FilterValues,
} from '@/ui'
import { TODAY, addDays, employeesCollection, useCollection } from '@/mocks'
import type { CompensationVersion, Employee } from '@/mocks'

import {
  PAYROLL_TABS,
  Page,
  ScreenError,
  branchName,
  personName,
  unitKey,
  useModuleNav,
  useScreenState,
  userName,
} from './shared'

/** The version in force today. Never the newest row — the newest may be future-dated. */
function currentVersion(employee: Employee): CompensationVersion | null {
  const inForce = employee.compensationVersions.filter(
    (v) => v.effectiveFrom <= TODAY && (v.effectiveTo === null || v.effectiveTo >= TODAY),
  )
  return (
    inForce.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ??
    employee.compensationVersions[employee.compensationVersions.length - 1] ??
    null
  )
}

/** A version dated ahead of today is an agreed change that has not taken effect. */
function pendingVersion(employee: Employee): CompensationVersion | null {
  return (
    employee.compensationVersions
      .filter((v) => v.effectiveFrom > TODAY)
      .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0] ?? null
  )
}

function lastChange(employee: Employee): CompensationVersion | null {
  return (
    [...employee.compensationVersions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
}

function allowance(version: CompensationVersion | null, label: string): number {
  return version?.allowances.find((a) => a.label.toLowerCase().includes(label))?.amount ?? 0
}

export default function Compensation() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const employees = useCollection(employeesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employees
      .filter((employee) => {
        if (employee.status === 'exited' && filters.status !== 'exited') return false
        if (filters.status && employee.status !== filters.status) return false
        if (filters.unit && unitKey(employee.unitId) !== filters.unit) return false
        if (filters.pending === 'yes' && !pendingVersion(employee)) return false
        if (!term) return true
        return (
          personName(employee.personId).toLowerCase().includes(term) ||
          employee.employeeId.toLowerCase().includes(term) ||
          employee.jobTitle.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => (currentVersion(b)?.gross ?? 0) - (currentVersion(a)?.gross ?? 0))
  }, [employees, filters, search])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const open = openId ? employees.find((e) => e.id === openId) ?? null : null
  const openVersions = open
    ? [...open.compensationVersions].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
    : []

  const columns: Array<Column<Employee>> = [
    {
      key: 'employee',
      header: 'Employee',
      pinned: true,
      minWidth: 200,
      cell: (employee) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 text-text">{personName(employee.personId)}</div>
          <div className="truncate text-body-12 text-text-secondary">{employee.jobTitle}</div>
        </div>
      ),
      sortValue: (employee) => personName(employee.personId),
      sortable: true,
    },
    {
      key: 'unit',
      header: 'Unit',
      width: 132,
      cell: (employee) => {
        const key = unitKey(employee.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : null
      },
      sortValue: (employee) => unitKey(employee.unitId) ?? '',
      sortable: true,
    },
    {
      key: 'branch',
      header: 'Branch',
      width: 136,
      accessor: (employee) => branchName(employee.branchId),
      sortValue: (employee) => branchName(employee.branchId),
      sortable: true,
    },
    {
      key: 'base',
      header: 'Current base',
      align: 'right',
      width: 160,
      cell: (employee) => <MoneyCell kobo={currentVersion(employee)?.baseSalary ?? 0} />,
      sortValue: (employee) => currentVersion(employee)?.baseSalary ?? 0,
      sortable: true,
    },
    {
      key: 'housing',
      header: 'Housing',
      align: 'right',
      width: 140,
      cell: (employee) => <MoneyCell kobo={allowance(currentVersion(employee), 'housing')} />,
      sortValue: (employee) => allowance(currentVersion(employee), 'housing'),
      sortable: true,
    },
    {
      key: 'transport',
      header: 'Transport',
      align: 'right',
      width: 140,
      cell: (employee) => <MoneyCell kobo={allowance(currentVersion(employee), 'transport')} />,
      sortValue: (employee) => allowance(currentVersion(employee), 'transport'),
      sortable: true,
    },
    {
      key: 'data',
      header: 'Data',
      align: 'right',
      width: 128,
      cell: (employee) => <MoneyCell kobo={allowance(currentVersion(employee), 'data')} />,
      sortValue: (employee) => allowance(currentVersion(employee), 'data'),
      sortable: true,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      width: 168,
      cell: (employee) => <MoneyCell kobo={currentVersion(employee)?.gross ?? 0} strong />,
      sortValue: (employee) => currentVersion(employee)?.gross ?? 0,
      sortable: true,
    },
    {
      key: 'effectiveFrom',
      header: 'Effective from',
      width: 136,
      accessor: (employee) => {
        const version = currentVersion(employee)
        return version ? formatDate(version.effectiveFrom) : <span className="text-text-secondary">No version</span>
      },
      sortValue: (employee) => currentVersion(employee)?.effectiveFrom ?? '',
      sortable: true,
    },
    {
      key: 'nextReview',
      header: 'Next review',
      width: 148,
      accessor: (employee) => {
        const version = currentVersion(employee)
        if (!version) return <span className="text-text-secondary">—</span>
        const due = addDays(version.effectiveFrom, 365)
        return (
          <span className={due < TODAY ? 'text-warning-text' : undefined}>
            {formatDate(due)}
            {due < TODAY && <span className="sr-only"> — overdue</span>}
          </span>
        )
      },
      sortValue: (employee) => {
        const version = currentVersion(employee)
        return version ? addDays(version.effectiveFrom, 365) : ''
      },
      sortable: true,
    },
    {
      key: 'lastChange',
      header: 'Last change',
      width: 140,
      accessor: (employee) => {
        const version = lastChange(employee)
        return version ? formatDate(version.createdAt) : <span className="text-text-secondary">Never changed</span>
      },
      sortValue: (employee) => lastChange(employee)?.createdAt ?? '',
      sortable: true,
    },
    {
      key: 'changedBy',
      header: 'Changed by',
      minWidth: 170,
      accessor: (employee) => {
        const version = lastChange(employee)
        return version ? userName(version.approvedByUserId) : <span className="text-text-secondary">—</span>
      },
      sortValue: (employee) => userName(lastChange(employee)?.approvedByUserId),
      sortable: true,
    },
    {
      key: 'approval',
      header: 'Approval ref',
      width: 160,
      accessor: (employee) => {
        const ref = lastChange(employee)?.approvalRequestId
        return ref ? (
          <span className="font-mono text-body-12">{ref}</span>
        ) : (
          <span className="text-text-secondary">None recorded</span>
        )
      },
      sortValue: (employee) => lastChange(employee)?.approvalRequestId ?? '',
      sortable: true,
    },
    {
      key: 'pending',
      header: 'Pending change',
      width: 176,
      cell: (employee) => {
        const pending = pendingVersion(employee)
        return pending ? (
          <Badge tone="warning" size="sm">
            {formatNaira(pending.gross, { compact: true })} from {formatDate(pending.effectiveFrom)}
          </Badge>
        ) : (
          <span className="text-body-13 text-text-secondary">None</span>
        )
      },
      sortValue: (employee) => (pendingVersion(employee) ? 1 : 0),
      sortable: true,
    },
    {
      key: 'versions',
      header: 'Versions',
      align: 'right',
      width: 116,
      accessor: (employee) => <span className="tabular-nums">{formatNumber(employee.compensationVersions.length)}</span>,
      sortValue: (employee) => employee.compensationVersions.length,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 124,
      cell: (employee) => <StatusBadge status={employee.status} />,
      sortValue: (employee) => employee.status,
      sortable: true,
    },
  ]

  const versionColumns: Array<Column<CompensationVersion>> = [
    {
      key: 'from',
      header: 'Effective from',
      width: 140,
      accessor: (version) => formatDate(version.effectiveFrom),
      sortValue: (version) => version.effectiveFrom,
      sortable: true,
    },
    {
      key: 'to',
      header: 'Effective to',
      width: 148,
      accessor: (version) =>
        version.effectiveTo ? (
          formatDate(version.effectiveTo)
        ) : version.effectiveFrom > TODAY ? (
          <Badge tone="warning" size="sm">
            Takes effect later
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            In force
          </Badge>
        ),
      sortValue: (version) => version.effectiveTo ?? '9999',
      sortable: true,
    },
    {
      key: 'base',
      header: 'Base salary',
      align: 'right',
      cell: (version) => <MoneyCell kobo={version.baseSalary} />,
      sortValue: (version) => version.baseSalary,
      sortable: true,
    },
    {
      key: 'allowances',
      header: 'Allowances',
      minWidth: 240,
      cell: (version) =>
        version.allowances.length === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <span className="text-body-13">
            {version.allowances.map((a) => `${a.label} ${formatNaira(a.amount, { compact: true })}`).join(' · ')}
          </span>
        ),
      sortValue: (version) => version.allowances.reduce((acc, a) => acc + a.amount, 0),
      sortable: true,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      cell: (version) => <MoneyCell kobo={version.gross} strong />,
      sortValue: (version) => version.gross,
      sortable: true,
    },
    { key: 'reason', header: 'Reason', minWidth: 220, accessor: (version) => version.reason, sortValue: (version) => version.reason },
    {
      key: 'approvedBy',
      header: 'Approved by',
      minWidth: 170,
      accessor: (version) => userName(version.approvedByUserId),
      sortValue: (version) => userName(version.approvedByUserId),
    },
    {
      key: 'approval',
      header: 'Approval',
      width: 150,
      accessor: (version) =>
        version.approvalRequestId ? (
          <span className="font-mono text-body-12">{version.approvalRequestId}</span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (version) => version.approvalRequestId ?? '',
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Compensation"
        description="What each person is on today, and every figure they have ever been on. A change appends a version — it never edits one."
        tabs={PAYROLL_TABS}
        activeTab="compensation"
        onTabChange={navigate}
        actions={
          <Tooltip content="In production this whole screen sits behind narrower permissions than the rest of Payroll.">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-fill px-2 py-1 text-label-10 text-warning-ink">
              <Lock size={12} aria-hidden="true" />
              Restricted
            </span>
          </Tooltip>
        }
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name, employee ID or job title"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: ['active', 'probation', 'on_leave', 'notice', 'suspended', 'exited'].map((s) => ({
                    value: s,
                    label: s.replace(/_/g, ' '),
                  })),
                },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
                { key: 'pending', label: 'Pending change', options: [{ value: 'yes', label: 'Has one' }] },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(employee) => employee.id}
            loading={state.loading}
            onRowClick={(employee) => setOpenId(employee.id)}
            activeRowKey={open?.id}
            density="compact"
            bordered={false}
            minWidth={2520}
            caption="Compensation by employee, with base, allowances, gross, effective date, next review, last change and any pending change"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No employees match these filters"
                  message="Try another status or unit, or clear the search."
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
                  title="No compensation on record"
                  message="Payroll has no base salary to calculate from, so nobody can be paid. A compensation version is created when an offer is accepted."
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        size="xl"
        title={open ? personName(open.personId) : 'Compensation'}
        description={open ? `${open.jobTitle} · ${branchName(open.branchId)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <Alert tone="info" icon={History} title="Every row below is immutable">
              A pay change appends a new version and end-dates the previous one. Nothing is overwritten, so a payslip from two
              years ago can still be explained by the figures in force on the day it was issued.
            </Alert>

            <KeyValueList columns={2}>
              <KeyValue label="Employee ID">
                <span className="font-mono text-body-13">{open.employeeId}</span>
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Currently on">
                {currentVersion(open) ? formatNaira(currentVersion(open)!.gross) : 'No version'}
              </KeyValue>
              <KeyValue label="Versions on record">{formatNumber(open.compensationVersions.length)}</KeyValue>
            </KeyValueList>

            {pendingVersion(open) && (
              <Alert
                tone="warning"
                title={`A change to ${formatNaira(pendingVersion(open)!.gross)} takes effect ${formatDate(pendingVersion(open)!.effectiveFrom)}`}
              >
                It is already approved and recorded as its own version. Until the effective date, payroll keeps using the
                current one — the future version does not leak into this month's run.
              </Alert>
            )}

            <DataTable
              data={openVersions}
              columns={versionColumns}
              rowKey={(version) => version.id}
              density="compact"
              minWidth={1400}
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
        )}
      </Drawer>
    </Page>
  )
}
