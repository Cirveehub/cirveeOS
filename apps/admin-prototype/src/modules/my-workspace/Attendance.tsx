import { useMemo, useState } from 'react'
import { CalendarCheck, CircleAlert, Lock, MessageSquarePlus } from 'lucide-react'
import toast from 'react-hot-toast'

import { TODAY, useCollection, attendanceEventsCollection, type AttendanceEvent } from '@/mocks'
import { formatDate, formatNumber, formatPercent, formatTime } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  StatCard,
  StatusBadge,
  TableToolbar,
  Textarea,
  type Column,
  type FilterValues,
} from '@/ui'
import { ATTENDANCE_STATE_LABEL, CONSEQUENCE_LABEL } from '@/modules/people/shared'

import { MyPageHeader, NoEmploymentRecord, Page, useMe, userName } from './shared'
import { explainAttendance, myAttendance, needsExplaining } from './writes'

const COUNTED: AttendanceEvent['state'][] = [
  'present',
  'late',
  'absent',
  'remote_approved',
  'early_departure',
  'missing_clock_out',
]

const STATES: AttendanceEvent['state'][] = [
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

export default function MyAttendance() {
  const me = useMe()
  useCollection(attendanceEventsCollection)

  const [explaining, setExplaining] = useState<AttendanceEvent | null>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const allRows = useMemo(
    () => (me.employee ? myAttendance(me.employee.id as string) : []),
    [me.employee],
  )

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (filters.state && row.state !== filters.state) return false
      if (search && !ATTENDANCE_STATE_LABEL[row.state]?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [allRows, filters, search])

  const month = TODAY.slice(0, 7)
  const thisMonth = allRows.filter((r) => r.date.startsWith(month))
  const counted = thisMonth.filter((r) => COUNTED.includes(r.state))
  const presentish = counted.filter((r) => ['present', 'late', 'remote_approved'].includes(r.state))
  const rate = counted.length === 0 ? null : (presentish.length / counted.length) * 100
  const lateDays = thisMonth.filter((r) => r.state === 'late').length
  const flagged = allRows.filter(needsExplaining)
  const explained = allRows.filter((r) => r.overrideReason && !r.overriddenByUserId)

  const submit = () => {
    setTouched(true)
    if (!explaining || !note.trim() || !me.userId) return
    const result = explainAttendance(explaining.id as string, note, me.userId)
    if (!result.ok) {
      toast.error(result.reason ?? 'That could not be saved.')
      return
    }
    toast.success('Sent. HR sees your note against that day and decides whether it stands.')
    setExplaining(null)
    setNote('')
    setTouched(false)
  }

  const columns: Array<Column<AttendanceEvent>> = [
    {
      key: 'date',
      header: 'Date',
      width: 130,
      accessor: (row) => (
        <span>
          {formatDate(row.date)}
          {row.date === TODAY && <span className="ml-1.5 text-body-12 text-text-muted">today</span>}
        </span>
      ),
      sortValue: (row) => row.date,
      sortable: true,
    },
    {
      key: 'state',
      header: 'State',
      width: 158,
      cell: (row) => <StatusBadge status={row.state} label={ATTENDANCE_STATE_LABEL[row.state] ?? row.state} />,
      sortValue: (row) => row.state,
      sortable: true,
    },
    {
      key: 'clockIn',
      header: 'Clock-in',
      width: 110,
      accessor: (row) => (row.clockInAt ? formatTime(row.clockInAt) : <span className="text-text-secondary">—</span>),
      sortValue: (row) => row.clockInAt ?? '',
      sortable: true,
    },
    {
      key: 'clockOut',
      header: 'Clock-out',
      width: 116,
      accessor: (row) =>
        row.clockOutAt ? (
          formatTime(row.clockOutAt)
        ) : row.state === 'missing_clock_out' ? (
          <Badge tone="warning" size="sm">
            Missing
          </Badge>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (row) => row.clockOutAt ?? '',
      sortable: true,
    },
    {
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
    {
      key: 'consequence',
      header: 'Consequence',
      minWidth: 190,
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
    {
      key: 'note',
      header: 'Your note',
      minWidth: 240,
      cell: (row) => {
        if (row.overrideReason) {
          return (
            <span className="text-body-12">
              {row.overrideReason}
              {row.overriddenByUserId ? (
                <span className="ml-1.5 text-text-secondary">— accepted by {userName(row.overriddenByUserId)}</span>
              ) : (
                <span className="ml-1.5 text-text-secondary">— waiting on HR</span>
              )}
            </span>
          )
        }
        if (needsExplaining(row)) {
          return (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setExplaining(row)
                setNote('')
                setTouched(false)
              }}
            >
              Explain
            </Button>
          )
        }
        return <span className="text-text-secondary">—</span>
      },
    },
  ]

  if (!me.employee) {
    return (
      <Page>
        <MyPageHeader
          title="My attendance"
          description="What the readers recorded against your name, and the days you can account for."
        />
        <NoEmploymentRecord what="Attendance" />
      </Page>
    )
  }

  return (
    <Page>
      <MyPageHeader
        title="My attendance"
        description="Your attendance ledger — clock-in, clock-out and what it did about any breach."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance this month"
          value={rate === null ? '—' : formatPercent(rate)}
          icon={CalendarCheck}
          variant={rate === null ? 'default' : rate >= 85 ? 'success' : 'warning'}
          caption={`${formatNumber(presentish.length)} of ${formatNumber(counted.length)} working days`}
        />
        <StatCard
          label="Days needing a word"
          value={formatNumber(flagged.length)}
          icon={CircleAlert}
          variant={flagged.length > 0 ? 'warning' : 'success'}
          caption="Flagged, and you have not explained them"
        />
        <StatCard
          label="Waiting on HR"
          value={formatNumber(explained.length)}
          icon={MessageSquarePlus}
          caption="Explained by you, not yet accepted"
        />
        <StatCard
          label="Late arrivals"
          value={formatNumber(lateDays)}
          icon={CalendarCheck}
          variant={lateDays > 2 ? 'warning' : 'default'}
          caption="This month"
        />
      </div>

      <Card className="mt-6">
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by state"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'state', label: 'State', options: STATES.map((s) => ({ value: s, label: ATTENDANCE_STATE_LABEL[s] })) },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            density="compact"
            minWidth={1200}
            bordered={false}
            defaultSort={{ key: 'date', direction: 'desc' }}
            caption="Your attendance with state, clock-in, clock-out, late minutes and consequence"
            empty={
              <EmptyState
                icon={CalendarCheck}
                title={allRows.length === 0 ? 'No attendance recorded yet' : 'Nothing matches these filters'}
                message={
                  allRows.length === 0
                    ? 'Your first tap will appear here.'
                    : 'Try another state, or clear the search.'
                }
              />
            }
          />
        </CardBody>
      </Card>

      <Modal
        open={explaining !== null}
        onClose={() => setExplaining(null)}
        title={explaining ? `${ATTENDANCE_STATE_LABEL[explaining.state] ?? explaining.state} — ${formatDate(explaining.date)}` : 'Explain this day'}
        description="Your note goes to HR with the day attached. It does not change the record by itself."
        footer={
          <>
            <Button variant="ghost" onClick={() => setExplaining(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>Send to HR</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {explaining?.state === 'missing_clock_out' && (
            <Alert tone="info" title="You clocked in but never clocked out">
              Usually this is a forgotten tap on the way out. Say roughly when you left and HR can
              close the day off.
            </Alert>
          )}
          <Field
            label="What happened"
            required
            hint="Plain words are fine. Whoever reads this was not there."
            error={touched && !note.trim() ? 'Say what happened — an empty note tells the reviewer nothing.' : undefined}
          >
            <Textarea
              rows={3}
              value={note}
              invalid={touched && !note.trim()}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Left at about 6pm after the Lagos cohort's evening session — forgot to tap out at the door."
            />
          </Field>
        </div>
      </Modal>
    </Page>
  )
}
