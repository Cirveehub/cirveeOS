import { useMemo } from 'react'
import { Users } from 'lucide-react'

import { formatNumber, formatPercent } from '@/lib/format'
import { Badge, DataTable, EmptyState, ProgressBar, type Column } from '@/ui'
import {
  classSessionsCollection,
  studentAttendanceCollection,
  submissionsCollection,
  useCollection,
  type Assignment,
  type Cohort,
  type Enrollment,
} from '@/mocks'

import { TeachingCard, personName } from '../shared'

interface RosterRow {
  enrolment: Enrollment
  name: string
  attendancePercent: number | null
  sessionsAttended: number
  sessionsRecorded: number
  submitted: number
  graded: number
  averageScore: number | null
}

export default function RosterTab({
  cohort,
  enrolments,
  assignments,
}: {
  cohort: Cohort
  enrolments: Enrollment[]
  assignments: Assignment[]
}) {
  const attendance = useCollection(studentAttendanceCollection)
  const submissions = useCollection(submissionsCollection)
  const sessions = useCollection(classSessionsCollection)

  const deliveredCount = useMemo(
    () => sessions.filter((s) => s.cohortId === cohort.id && s.status === 'delivered').length,
    [sessions, cohort.id],
  )

  const rows = useMemo<RosterRow[]>(() => {
    const assignmentIds = new Set(assignments.map((a) => a.id))

    return enrolments
      .map((enrolment) => {
        const mine = attendance.filter((a) => a.enrollmentId === enrolment.id)
        const attended = mine.filter(
          (a) => a.state === 'present' || a.state === 'late' || a.state === 'excused',
        ).length

        const mySubmissions = submissions.filter(
          (s) => s.enrollmentId === enrolment.id && assignmentIds.has(s.assignmentId),
        )
        const graded = mySubmissions.filter((s) => s.status === 'graded' && s.totalScore !== null)
        const average = graded.length
          ? Math.round(graded.reduce((acc, s) => acc + (s.totalScore ?? 0), 0) / graded.length)
          : null

        return {
          enrolment,
          name: personName(enrolment.personId),
          attendancePercent: mine.length ? Math.round((attended / mine.length) * 100) : null,
          sessionsAttended: attended,
          sessionsRecorded: mine.length,
          submitted: mySubmissions.length,
          graded: graded.length,
          averageScore: average,
        } satisfies RosterRow
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [enrolments, attendance, submissions, assignments])

  const columns: Array<Column<RosterRow>> = [
    {
      key: 'student',
      header: 'Student',
      pinned: true,
      minWidth: 230,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-semibold text-text">{row.name}</p>
          <p className="text-body-12 text-text-muted">
            {row.enrolment.status === 'active' ? 'Enrolled' : row.enrolment.status}
          </p>
        </div>
      ),
      sortValue: (row) => row.name,
      sortable: true,
    },
    {
      key: 'attendance',
      header: 'Attendance',
      minWidth: 170,
      cell: (row) =>
        row.attendancePercent === null ? (
          <span className="text-body-13 text-text-muted">No register taken</span>
        ) : (
          <ProgressBar
            value={row.attendancePercent}
            showValue
            size="sm"
            tone={row.attendancePercent >= 80 ? 'success' : row.attendancePercent >= 60 ? 'warning' : 'danger'}
            aria-label={`${row.name} attendance`}
          />
        ),
      sortValue: (row) => row.attendancePercent ?? -1,
      sortable: true,
    },
    {
      key: 'sessions',
      header: 'Sessions',
      width: 110,
      align: 'right',
      accessor: (row) => `${row.sessionsAttended}/${row.sessionsRecorded}`,
      sortValue: (row) => row.sessionsAttended,
      sortable: true,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 118,
      align: 'right',
      accessor: (row) => `${formatNumber(row.submitted)} of ${formatNumber(assignments.length)}`,
      sortValue: (row) => row.submitted,
      sortable: true,
    },
    {
      key: 'average',
      header: 'Average',
      width: 108,
      align: 'right',
      cell: (row) =>
        row.averageScore === null ? (
          <span className="text-body-13 text-text-muted">—</span>
        ) : (
          <Badge
            tone={row.averageScore >= 70 ? 'success' : row.averageScore >= 50 ? 'warning' : 'neutral'}
            size="sm"
          >
            {formatPercent(row.averageScore, 0)}
          </Badge>
        ),
      sortValue: (row) => row.averageScore ?? -1,
      sortable: true,
    },
    {
      key: 'flags',
      header: 'Attention',
      minWidth: 220,
      cell: (row) =>
        row.enrolment.attentionFlags.length === 0 ? (
          <span className="text-body-13 text-text-muted">None</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {row.enrolment.attentionFlags.map((flag) => (
              <Badge key={flag} tone="warning" variant="outline" size="sm">
                {flag.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        ),
      sortValue: (row) => row.enrolment.attentionFlags.length,
      sortable: true,
    },
  ]

  return (
    <TeachingCard
      title="Roster"
      description={`${formatNumber(rows.length)} enrolled · ${formatNumber(deliveredCount)} sessions delivered so far`}
    >
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.enrolment.id}
        bordered={false}
        minWidth={1180}
        caption="Students enrolled on this cohort, with attendance, submissions and average grade"
        empty={
          <EmptyState
            icon={Users}
            title="Nobody is enrolled yet"
            message="Students appear here once Academy operations enrols them against a paid admission."
          />
        }
      />
      <p className="border-t border-border px-6 py-3 text-body-12 text-text-muted">
        Attendance is a teaching signal. It never changes what a student owes, and fees are not shown
        to tutors by design.
      </p>
    </TeachingCard>
  )
}
