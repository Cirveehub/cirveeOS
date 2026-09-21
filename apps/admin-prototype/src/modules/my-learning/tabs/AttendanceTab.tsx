import { useMemo } from 'react'

import { formatDate, formatDateTime } from '@/lib/format'
import { Alert, Badge, DataTable, ProgressBar, type Column } from '@/ui'
import {
  classSessionsCollection,
  coursesCollection,
  studentAttendanceCollection,
  useCollection,
  type ClassSession,
  type Enrollment,
  type StudentAttendance,
  type StudentAttendanceState,
} from '@/mocks'

interface AttendanceRow {
  record: StudentAttendance
  session: ClassSession | undefined
}

const STATE_LABEL: Record<StudentAttendanceState, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  excused: 'Excused',
}

const STATE_TONE = {
  present: 'success',
  late: 'warning',
  absent: 'danger',
  excused: 'info',
} as const

const SOURCE_LABEL = {
  nfc_tap: 'Card tap',
  qr: 'QR code',
  tutor_manual: 'Marked by tutor',
  kiosk: 'Kiosk',
} as const

export function AttendanceTab({ enrolment }: { enrolment: Enrollment }) {
  const attendance = useCollection(studentAttendanceCollection)
  const sessions = useCollection(classSessionsCollection)

  const rows = useMemo<AttendanceRow[]>(
    () =>
      attendance
        .filter((a) => a.enrollmentId === enrolment.id)
        .map((record) => ({ record, session: sessions.find((s) => s.id === record.sessionId) }))
        .sort((a, b) => (b.session?.date ?? '').localeCompare(a.session?.date ?? '')),
    [attendance, sessions, enrolment.id],
  )

  const attended = rows.filter((r) => r.record.state !== 'absent').length
  const rate = rows.length ? Math.round((attended / rows.length) * 100) : 0
  const threshold = coursesCollection.find(enrolment.courseId)?.certificateRules.attendanceThreshold ?? null
  const meetsThreshold = threshold === null || rate >= threshold

  const columns: Array<Column<AttendanceRow>> = [
    {
      key: 'session',
      header: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-semibold">{row.session?.topic ?? 'Class'}</p>
          <p className="text-body-12 text-text-muted">
            {row.session ? `Session ${row.session.sequence} · ${row.session.room ?? 'Online'}` : ''}
          </p>
        </div>
      ),
      sortValue: (row) => row.session?.sequence ?? 0,
      minWidth: 280,
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (row) => (row.session ? formatDate(row.session.date) : '—'),
      sortValue: (row) => row.session?.date ?? '',
      width: 130,
    },
    {
      key: 'state',
      header: 'Attendance',
      cell: (row) => (
        <Badge tone={STATE_TONE[row.record.state]} variant="subtle" size="sm" dot>
          {STATE_LABEL[row.record.state]}
        </Badge>
      ),
      sortValue: (row) => row.record.state,
      width: 130,
    },
    {
      key: 'recorded',
      header: 'Recorded',
      cell: (row) => (
        <div>
          <p className="text-body-13">{SOURCE_LABEL[row.record.source]}</p>
          {row.record.tappedAt && (
            <p className="text-body-12 text-text-muted">{formatDateTime(row.record.tappedAt)}</p>
          )}
        </div>
      ),
      width: 200,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* One card, one concern: where you stand. */}
      <div className="rounded-2xl border border-border bg-surface px-6 py-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-label-10 text-text-label">Your attendance</p>
            <p className="mt-1 text-display-32 leading-none">{rate}%</p>
            <p className="mt-1 text-body-13 text-text-secondary">
              {attended} of {rows.length} classes attended
            </p>
          </div>
          {threshold !== null && (
            <Badge tone={meetsThreshold ? 'success' : 'warning'} variant="subtle">
              {meetsThreshold
                ? `Above this course's ${threshold}% certificate threshold`
                : `This course's certificate threshold is ${threshold}%`}
            </Badge>
          )}
        </div>
        {threshold !== null && (
          <ProgressBar
            value={rate}
            tone={meetsThreshold ? 'success' : 'warning'}
            size="sm"
            className="mt-4"
            aria-label="Attendance against the certificate threshold"
          />
        )}
      </div>

      <Alert tone="info" title="How this record is used">
        Attendance counts towards one of your certificate criteria. It never carries a financial
        consequence, and nothing is ever decided from it automatically — if something is getting in
        the way of getting to class, your tutor or your advisor can help.
      </Alert>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-6 py-5">
          <p className="text-body-15 font-bold">Attendance record</p>
          <p className="text-body-12 text-text-muted">
            {rows.length} class{rows.length === 1 ? '' : 'es'} recorded
          </p>
        </div>
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.record.id}
          defaultSort={{ key: 'date', direction: 'desc' }}
          emptyTitle="No attendance recorded yet"
          emptyMessage="Your record starts with your first class."
        />
      </div>
    </div>
  )
}
