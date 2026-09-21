/**
 * Attendance — `/people/attendance` (screen-spec §9).
 *
 * The consequence column is the point of this screen. Every row reads
 * "No financial impact", because the attendance policy's financial switch is
 * off: a breach notifies the employee and their manager and can open a
 * performance record, but it never touches pay. The engine exists and the
 * policy version that governed each day is named on the row, so the rule is
 * auditable rather than implied.
 */

import { useMemo, useState } from 'react'
import { Lock, MessageSquareQuote, ScanLine } from 'lucide-react'
import toast from 'react-hot-toast'

import { formatDate, formatNumber, formatPercent, formatTime } from '@/lib/format'
import { useCurrentUserId } from '@/auth'
import { acceptAttendanceExplanation } from '@/modules/my-workspace/writes'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColumnPicker,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  StatCard,
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
  attendanceEventsCollection,
  employeesCollection,
  policyVersionsCollection,
  staffAttendanceRate,
  useCollection,
} from '@/mocks'
import type { AttendanceEvent, AttendanceState } from '@/mocks'

import {
  ATTENDANCE_SOURCE_LABEL,
  ATTENDANCE_STATE_LABEL,
  PeopleGroupTabs,
  Page,
  ScreenError,
  personName,
  useScreenState,
  userName,
} from './shared'

const PAGE_SIZE = 50

const STATES: AttendanceState[] = [
  'present',
  'late',
  'absent',
  'approved_leave',
  'remote_approved',
  'holiday',
  'off_day',
  'early_departure',
  'missing_clock_out',
  'excused',
]

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'employee', label: 'Employee', defaultVisible: true, locked: true },
  { key: 'date', label: 'Date', defaultVisible: true },
  { key: 'state', label: 'State', defaultVisible: true },
  { key: 'clockIn', label: 'Clock-in', defaultVisible: true },
  { key: 'clockOut', label: 'Clock-out', defaultVisible: true },
  { key: 'hours', label: 'Hours', defaultVisible: false },
  { key: 'lateBy', label: 'Late by', defaultVisible: true },
  { key: 'consequence', label: 'Consequence', defaultVisible: true },
  { key: 'source', label: 'Source', defaultVisible: false },
  { key: 'policy', label: 'Policy version applied', defaultVisible: false },
  { key: 'override', label: 'Override reason', defaultVisible: false },
]

const CONSEQUENCE_LABEL: Record<string, string> = {
  none: 'No financial impact',
  notify_employee: 'Employee notified',
  notify_manager: 'Manager notified',
  warning_record: 'Warning recorded',
  escalate_performance: 'Escalated to performance',
  propose_adjustment: 'Payroll adjustment proposed',
}

export default function Attendance() {
  const state = useScreenState()
  const actingUserId = useCurrentUserId()

  const events = useCollection(attendanceEventsCollection)
  const employees = useCollection(employeesCollection)
  const policies = useCollection(policyVersionsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const yesterday = addDays(TODAY, -1)
  const summary = useMemo(() => {
    const rate = staffAttendanceRate(yesterday)
    const withConsequence = events.filter((e) => e.consequence !== 'none').length
    const late = events.filter((e) => e.state === 'late').length
    const missing = events.filter((e) => e.state === 'missing_clock_out').length
    return { rate, withConsequence, late, missing }
  }, [events, yesterday])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return events
      .filter((event) => {
        if (filters.state && event.state !== filters.state) return false
        if (filters.source && event.source !== filters.source) return false
        if (!term) return true
        return personName(event.personId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || personName(a.personId).localeCompare(personName(b.personId)))
  }, [events, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const policyLabel = (event: AttendanceEvent) => {
    const policy = policies.find((p) => p.id === event.policyVersionId)
    return policy ? `${policy.kind.replace(/_/g, ' ')} v${policy.version}` : (event.policyVersionId as string)
  }

  const allColumns: Record<string, Column<AttendanceEvent>> = {
    employee: {
      key: 'employee',
      header: 'Employee',
      pinned: true,
      minWidth: 190,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    date: { key: 'date', header: 'Date', width: 126, accessor: (row) => formatDate(row.date), sortValue: (row) => row.date, sortable: true },
    state: { key: 'state', header: 'State', width: 158, cell: (row) => <StatusBadge status={row.state} label={ATTENDANCE_STATE_LABEL[row.state] ?? row.state} />, sortValue: (row) => row.state, sortable: true },
    clockIn: {
      key: 'clockIn',
      header: 'Clock-in',
      width: 110,
      accessor: (row) => (row.clockInAt ? formatTime(row.clockInAt) : <span className="text-text-secondary">—</span>),
      sortValue: (row) => row.clockInAt ?? '',
      sortable: true,
    },
    clockOut: {
      key: 'clockOut',
      header: 'Clock-out',
      width: 116,
      accessor: (row) =>
        row.clockOutAt ? (
          formatTime(row.clockOutAt)
        ) : row.state === 'missing_clock_out' ? (
          <Badge tone="warning" size="sm">Missing</Badge>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (row) => row.clockOutAt ?? '',
      sortable: true,
    },
    hours: {
      key: 'hours',
      header: 'Hours',
      align: 'right',
      width: 96,
      accessor: (row) => (row.hours === null ? <span className="text-text-secondary">—</span> : <span className="tabular-nums">{row.hours.toFixed(1)}</span>),
      sortValue: (row) => row.hours ?? -1,
      sortable: true,
    },
    lateBy: {
      key: 'lateBy',
      header: 'Late by',
      align: 'right',
      width: 108,
      accessor: (row) =>
        row.lateByMinutes === null || row.lateByMinutes === 0 ? (
          <span className="text-text-secondary">—</span>
        ) : (
          <span className="tabular-nums text-warning-text">{`${formatNumber(row.lateByMinutes)} min`}</span>
        ),
      sortValue: (row) => row.lateByMinutes ?? -1,
      sortable: true,
    },
    consequence: {
      key: 'consequence',
      header: 'Consequence',
      minWidth: 200,
      cell: (row) => (
        <span className="inline-flex items-center gap-1.5">
          {row.consequence === 'none' && <Lock size={12} aria-hidden="true" className="text-text-secondary" />}
          <span className={row.consequence === 'none' ? 'text-body-13 text-text-secondary' : 'text-body-13 text-warning-text'}>
            {CONSEQUENCE_LABEL[row.consequence] ?? row.consequence}
          </span>
        </span>
      ),
      sortValue: (row) => row.consequence,
      sortable: true,
    },
    source: { key: 'source', header: 'Source', width: 160, accessor: (row) => ATTENDANCE_SOURCE_LABEL[row.source] ?? row.source, sortValue: (row) => row.source, sortable: true },
    policy: {
      key: 'policy',
      header: 'Policy version applied',
      minWidth: 210,
      accessor: (row) => <span className="text-body-12">{policyLabel(row)}</span>,
      sortValue: (row) => policyLabel(row),
      sortable: true,
    },
    override: {
      key: 'override',
      header: 'Override reason',
      minWidth: 240,
      accessor: (row) =>
        row.overrideReason ? (
          <span className="text-body-12">
            {row.overrideReason}
            {row.overriddenByUserId ? ` — ${userName(row.overriddenByUserId)}` : ''}
          </span>
        ) : (
          <span className="text-text-secondary">Not overridden</span>
        ),
      sortValue: (row) => row.overrideReason ?? '',
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  // Explained by the employee on their own screen, not yet accepted here.
  // The `overrideReason` column has existed all along with nothing in the app
  // able to write it; this is the other half of that.
  const awaitingReview = events.filter((r) => r.overrideReason && !r.overriddenByUserId)

  return (
    <Page>
      <PageHeader
        title="Attendance"
        description="The staff attendance ledger, with the policy version that governed each day and what it actually did about a breach."
      />

      <PeopleGroupTabs group="time" active="attendance" />

      <ScreenError state={state} />

      <Alert tone="info" icon={Lock} className="mb-6" title="Attendance has no financial consequence, and that is deliberate">
        The engine calculates a figure so the breach is visible, but the policy's financial switch is off. Nothing on this
        screen deducts pay, and the payroll adjustment count derived from attendance is zero.
      </Alert>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance yesterday"
          value={formatPercent(summary.rate.rate)}
          caption={`${formatNumber(summary.rate.present)} of ${formatNumber(summary.rate.total)} present`}
          variant={summary.rate.rate >= 85 ? 'success' : 'warning'}
        />
        <StatCard label="Late arrivals on record" value={formatNumber(summary.late)} caption="Across the whole ledger" />
        <StatCard label="Missing clock-outs" value={formatNumber(summary.missing)} caption="Need an override before the period closes" variant={summary.missing > 0 ? 'warning' : 'default'} />
        <StatCard
          label="Rows with a financial consequence"
          value={formatNumber(summary.withConsequence)}
          caption="Zero by policy, not by accident"
          icon={Lock}
        />
      </div>

      {awaitingReview.length > 0 && (
        <Card className="mb-6">
          <CardHeader
            title={`${formatNumber(awaitingReview.length)} ${awaitingReview.length === 1 ? 'day has' : 'days have'} an explanation waiting on you`}
            description="Written by the employee against a flagged day. Accepting it marks the day excused and records who accepted."
          />
          <CardBody>
            <ul className="flex flex-col gap-2">
              {awaitingReview.slice(0, 8).map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-body-14 text-text">
                      {personName(employees.find((e) => e.id === row.employeeId)?.personId ?? null)} ·{' '}
                      {formatDate(row.date)} · {ATTENDANCE_STATE_LABEL[row.state] ?? row.state}
                    </span>
                    <span className="mt-1 flex items-start gap-1.5 text-body-12 text-text-secondary">
                      <MessageSquareQuote size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                      {row.overrideReason}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      const result = acceptAttendanceExplanation(row.id as string, 'excused', actingUserId)
                      if (!result.ok) toast.error(result.reason ?? 'That could not be accepted.')
                      else toast.success('Accepted. The day is now excused, with your name against it.')
                    }}
                  >
                    Accept
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by employee name"
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
                { key: 'state', label: 'State', options: STATES.map((s) => ({ value: s, label: ATTENDANCE_STATE_LABEL[s] })) },
                {
                  key: 'source',
                  label: 'Source',
                  options: Object.entries(ATTENDANCE_SOURCE_LABEL).map(([value, label]) => ({ value, label })),
                },
              ]}
              right={<ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={1350}
            bordered={false}
            caption="Attendance events with state, source, policy version applied and consequence"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No attendance rows match these filters"
                  message="Try another state or source, or clear the search."
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
                  icon={ScanLine}
                  title="No attendance has been recorded"
                  message="Attendance arrives from NFC taps, QR scans and approved devices. With no rows, no policy can be evaluated and no absence can be explained."
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="attendance rows" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>
    </Page>
  )
}
