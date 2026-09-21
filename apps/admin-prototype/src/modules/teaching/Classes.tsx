/**
 * My classes — the legacy `MyCoursesTab`, one card and one table.
 *
 * Columns follow the legacy exactly (course, cohort, students, one action) and
 * add two things it could not show: the cohort's real attendance rate, and how
 * much of this cohort's work is still unmarked. Both are computed live.
 *
 * The filter that matters here is not a dropdown: `tutorAssignmentsCollection`
 * is filtered to `status === 'active'`, because the PRD's rule is that a tutor
 * replaced mid-cohort has their assignment **ended** and a new row created.
 * Showing an ended assignment as "my class" would put a tutor back in a room
 * they no longer teach.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import { useScreenLoad } from '@/lib/view-state'
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
  type Column,
} from '@/ui'
import {
  assignmentsCollection,
  cohortsCollection,
  enrollmentsCollection,
  submissionsCollection,
  useCollection,
  type Cohort,
  type TutorAssignment,
} from '@/mocks'

import { Page, TeachingCard, courseTitle, useTutorScope } from './shared'

interface ClassRow {
  cohort: Cohort
  assignment: TutorAssignment
  enrolled: number
  awaitingGrading: number
}

export default function Classes() {
  const load = useScreenLoad('teaching.classes')
  const scope = useTutorScope()

  const cohorts = useCollection(cohortsCollection)
  const enrolments = useCollection(enrollmentsCollection)
  const submissions = useCollection(submissionsCollection)
  const assignments = useCollection(assignmentsCollection)

  const rows = useMemo<ClassRow[]>(() => {
    return scope.assignments
      .map((assignment) => {
        const cohort = cohorts.find((c) => c.id === assignment.cohortId)
        if (!cohort) return null

        const cohortEnrolments = enrolments.filter(
          (e) => e.cohortId === cohort.id && e.status === 'active',
        )
        const enrolmentIds = new Set(cohortEnrolments.map((e) => e.id))
        const assignmentIds = new Set(
          assignments
            .filter((a) => a.cohortId === cohort.id || (a.cohortId === null && a.courseId === cohort.courseId))
            .map((a) => a.id),
        )

        return {
          cohort,
          assignment,
          enrolled: cohortEnrolments.length,
          awaitingGrading: submissions.filter(
            (s) =>
              s.status === 'awaiting_grading' &&
              assignmentIds.has(s.assignmentId) &&
              enrolmentIds.has(s.enrollmentId),
          ).length,
        } satisfies ClassRow
      })
      .filter((row): row is ClassRow => row !== null)
      .sort((a, b) => a.cohort.startDate.localeCompare(b.cohort.startDate))
  }, [scope.assignments, cohorts, enrolments, submissions, assignments])

  const columns: Array<Column<ClassRow>> = [
    {
      key: 'course',
      header: 'Course',
      pinned: true,
      minWidth: 240,
      accessor: (row) => courseTitle(row.cohort.courseId),
      sortValue: (row) => courseTitle(row.cohort.courseId),
      sortable: true,
    },
    {
      key: 'cohort',
      header: 'Cohort',
      width: 140,
      cell: (row) => <span className="font-mono text-body-13">{row.cohort.code}</span>,
      sortValue: (row) => row.cohort.code,
      sortable: true,
    },
    {
      key: 'role',
      header: 'Your role',
      width: 116,
      cell: (row) => (
        <Badge tone={row.assignment.role === 'lead' ? 'accent' : 'neutral'} variant="subtle" size="sm">
          {row.assignment.role === 'lead' ? 'Lead' : row.assignment.role === 'assistant' ? 'Assistant' : 'Guest'}
        </Badge>
      ),
      sortValue: (row) => row.assignment.role,
      sortable: true,
    },
    {
      key: 'schedule',
      header: 'Runs',
      minWidth: 220,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-13 text-text">{row.cohort.scheduleSummary}</p>
          <p className="text-body-12 text-text-muted">
            {formatDate(row.cohort.startDate)} – {formatDate(row.cohort.endDate)}
          </p>
        </div>
      ),
      sortValue: (row) => row.cohort.startDate,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      cell: (row) => <StatusBadge status={row.cohort.status} />,
      sortValue: (row) => row.cohort.status,
      sortable: true,
    },
    {
      key: 'students',
      header: 'Students',
      width: 96,
      align: 'right',
      accessor: (row) => formatNumber(row.enrolled),
      sortValue: (row) => row.enrolled,
      sortable: true,
    },
    {
      key: 'attendance',
      header: 'Attendance',
      width: 150,
      cell: (row) => (
        <ProgressBar
          value={row.cohort.attendanceRate}
          showValue
          size="sm"
          tone={row.cohort.attendanceRate >= 80 ? 'success' : row.cohort.attendanceRate >= 60 ? 'warning' : 'danger'}
          aria-label={`${row.cohort.code} attendance rate`}
        />
      ),
      sortValue: (row) => row.cohort.attendanceRate,
      sortable: true,
    },
    {
      key: 'marking',
      header: 'To mark',
      width: 100,
      align: 'right',
      cell: (row) =>
        row.awaitingGrading > 0 ? (
          <Badge tone="warning" size="sm">
            {formatNumber(row.awaitingGrading)}
          </Badge>
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        ),
      sortValue: (row) => row.awaitingGrading,
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 96,
      align: 'right',
      cell: (row) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`/teaching/classes/${row.cohort.id}`}>Open</Link>
        </Button>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="My classes"
        description="Every cohort you are currently assigned to. Ended assignments stay on the record but are not listed here."
      />

      {load.error && (
        <Alert
          tone="danger"
          title="This view could not load"
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" onClick={load.retry}>
              Retry
            </Button>
          }
        >
          {load.error}
        </Alert>
      )}

      <TeachingCard
        title="Assigned cohorts"
        description={`${formatNumber(rows.length)} active assignment${rows.length === 1 ? '' : 's'}`}
      >
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.assignment.id}
          loading={load.loading}
          bordered={false}
          minWidth={1280}
          caption="Cohorts you are assigned to, with enrolment, attendance and marking load"
          empty={
            <EmptyState
              icon={GraduationCap}
              title="You have no active cohort assignments"
              message="A cohort appears here once Academy operations assigns you to it. Assignments that have ended are kept on the record but are not classes you teach."
            />
          }
        />
      </TeachingCard>
    </Page>
  )
}
