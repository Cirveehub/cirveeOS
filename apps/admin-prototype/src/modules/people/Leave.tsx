import { useMemo, useState } from 'react'
import { CalendarOff } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColumnPicker,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  Pagination,
  StatusBadge,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  addDays,
  approvalRequestsCollection,
  employeesCollection,
  leaveRequestsCollection,
  useCollection,
} from '@/mocks'
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/mocks'

import { DecisionDialog } from '@/modules/approvals/DecisionDialog'
import { useActingUser } from '@/modules/approvals/shared'

import {
  LEAVE_TYPE_LABEL,
  PeopleGroupTabs,
  Page,
  ScreenError,
  personName,
  useScreenState,
} from './shared'

const PAGE_SIZE = 25
const STRIP_DAYS = 21

const TYPES: LeaveType[] = ['annual', 'sick', 'compassionate', 'maternity', 'paternity', 'study', 'unpaid']
const STATUSES: LeaveStatus[] = ['requested', 'approved', 'rejected', 'cancelled']

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Reference', defaultVisible: true, locked: true },
  { key: 'employee', label: 'Employee', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'from', label: 'From', defaultVisible: true },
  { key: 'to', label: 'To', defaultVisible: true },
  { key: 'days', label: 'Days', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'balance', label: 'Balance before and after', defaultVisible: false },
  { key: 'reason', label: 'Reason', defaultVisible: false },
  { key: 'approval', label: 'Approval', defaultVisible: false },
  { key: 'decided', label: 'Decided', defaultVisible: false },
]

export default function Leave() {
  const state = useScreenState()

  const leave = useCollection(leaveRequestsCollection)
  const employees = useCollection(employeesCollection)
  const approvals = useCollection(approvalRequestsCollection)
  const actorUserId = useActingUser()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [decisionOutcome, setDecisionOutcome] = useState<'approve' | 'reject' | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const nameOf = (request: LeaveRequest) => {
    const employee = employees.find((e) => e.id === request.employeeId)
    return employee ? personName(employee.personId) : 'Former employee'
  }

  const approvalRef = (request: LeaveRequest) =>
    request.approvalRequestId ? (approvals.find((a) => a.id === request.approvalRequestId)?.ref ?? null) : null

  const open = openId ? (leave.find((r) => r.id === openId) ?? null) : null

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return leave
      .filter((request) => {
        if (filters.type && request.type !== filters.type) return false
        if (filters.status && request.status !== filters.status) return false
        if (!term) return true
        return nameOf(request).toLowerCase().includes(term) || request.ref.toLowerCase().includes(term)
      })
      .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
  }, [leave, filters, search, employees]) // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const strip = useMemo(
    () =>
      Array.from({ length: STRIP_DAYS }, (_, i) => {
        const date = addDays(TODAY, i)
        return {
          date,
          people: leave.filter((l) => l.status === 'approved' && l.fromDate <= date && l.toDate >= date),
        }
      }),
    [leave],
  )
  const maxStrip = Math.max(1, ...strip.map((d) => d.people.length))

  const allColumns: Record<string, Column<LeaveRequest>> = {
    ref: { key: 'ref', header: 'Reference', pinned: true, width: 140, accessor: (row) => <span className="font-mono text-body-13">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    employee: { key: 'employee', header: 'Employee', minWidth: 190, accessor: (row) => nameOf(row), sortValue: (row) => nameOf(row), sortable: true },
    type: { key: 'type', header: 'Type', width: 150, accessor: (row) => LEAVE_TYPE_LABEL[row.type] ?? row.type, sortValue: (row) => row.type, sortable: true },
    from: { key: 'from', header: 'From', width: 126, accessor: (row) => formatDate(row.fromDate), sortValue: (row) => row.fromDate, sortable: true },
    to: { key: 'to', header: 'To', width: 126, accessor: (row) => formatDate(row.toDate), sortValue: (row) => row.toDate, sortable: true },
    days: { key: 'days', header: 'Days', align: 'right', width: 92, accessor: (row) => formatNumber(row.days), sortValue: (row) => row.days, sortable: true },
    status: { key: 'status', header: 'Status', width: 126, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    balance: {
      key: 'balance',
      header: 'Balance before and after',
      align: 'right',
      minWidth: 210,
      accessor: (row) => (
        <span className="tabular-nums">
          {formatNumber(row.balanceBefore)} → {formatNumber(row.balanceAfter)} days
        </span>
      ),
      sortValue: (row) => row.balanceAfter,
      sortable: true,
    },
    reason: { key: 'reason', header: 'Reason', minWidth: 260, accessor: (row) => row.reason, sortValue: (row) => row.reason },
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
    decided: {
      key: 'decided',
      header: 'Decided',
      width: 140,
      accessor: (row) => (row.decidedAt ? formatDate(row.decidedAt) : <span className="text-text-secondary">Not decided</span>),
      sortValue: (row) => row.decidedAt ?? '',
      sortable: true,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  return (
    <Page>
      <PageHeader
        title="Leave"
        description="Every request with the balance it moved, and who is away over the next three weeks."
      />

      <PeopleGroupTabs group="time" active="leave" />

      <ScreenError state={state} />

      <Card className="mb-6">
        <CardHeader title="Who is away, next three weeks" description="Approved leave only. A tall bar is a day when cover needs arranging." />
        <CardBody>
          {strip.every((day) => day.people.length === 0) ? (
            <EmptyState
              icon={CalendarOff}
              size="sm"
              bordered
              title="No approved leave in the next three weeks"
              message="Requests appear here once an approver has decided on them. A request that nobody decides is not cover."
            />
          ) : (
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${STRIP_DAYS}, minmax(0, 1fr))` }}>
              {strip.map((day) => (
                <div key={day.date} className="flex flex-col items-center gap-1.5">
                  <div className="flex h-20 w-full items-end">
                    <div
                      className={`w-full rounded-t-md ${day.people.length === 0 ? 'bg-surface-sunken' : 'bg-warning-500'}`}
                      style={{ height: `${Math.max(6, (day.people.length / maxStrip) * 100)}%` }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-body-12 text-text-muted">{formatDate(day.date).slice(0, 2)}</span>
                  <Badge tone={day.people.length === 0 ? 'neutral' : 'warning'} size="sm">
                    {formatNumber(day.people.length)}
                  </Badge>
                  <span className="sr-only">
                    {day.people.length === 0
                      ? `Nobody on leave on ${formatDate(day.date)}`
                      : `${day.people.map((l) => nameOf(l)).join(', ')} on leave on ${formatDate(day.date)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by employee or reference"
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
                { key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABEL[t] })) },
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s })) },
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
            minWidth={1200}
            bordered={false}
            caption="Leave requests with type, dates, days, balance movement and approval"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No leave requests match these filters"
                  message="Try another type or status, or clear the search."
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
                  icon={CalendarOff}
                  title="No leave has been requested"
                  message="Entitlement that is never taken is a liability that keeps growing. Requests arrive from the employee's own view and are decided through the approval engine."
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="requests" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? nameOf(open) : 'Leave request'}
        description={open ? `${open.ref} · ${LEAVE_TYPE_LABEL[open.type] ?? open.type} · ${formatDate(open.fromDate)} to ${formatDate(open.toDate)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Days">{formatNumber(open.days)}</KeyValue>
              <KeyValue label="Balance before → after">
                {formatNumber(open.balanceBefore)} → {formatNumber(open.balanceAfter)} days
              </KeyValue>
              <KeyValue label="Approval reference">{approvalRef(open) ?? 'None raised'}</KeyValue>
              <KeyValue label="Decided">{open.decidedAt ? formatDateTime(open.decidedAt) : 'Not decided'}</KeyValue>
            </KeyValueList>

            <div>
              <h3 className="mb-2 text-heading-18">Reason</h3>
              <p className="text-body-14 text-text-secondary">{open.reason || 'No reason given.'}</p>
            </div>

            {open.status === 'requested' && open.approvalRequestId && (
              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="secondary" onClick={() => setDecisionOutcome('reject')}>
                  Reject
                </Button>
                <Button onClick={() => setDecisionOutcome('approve')}>Approve</Button>
              </div>
            )}
            {open.status === 'requested' && !open.approvalRequestId && (
              <p className="border-t border-border pt-4 text-body-13 text-text-secondary">
                This request predates the approval linkage and cannot be decided here.
              </p>
            )}
          </div>
        )}
      </Drawer>

      <DecisionDialog
        open={decisionOutcome !== null}
        onClose={() => setDecisionOutcome(null)}
        requestId={open?.approvalRequestId ?? null}
        outcome={decisionOutcome ?? 'approve'}
        actorUserId={actorUserId}
      />
    </Page>
  )
}
