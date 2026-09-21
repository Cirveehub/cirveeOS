import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import { Badge, Button, DataTable, EmptyState, type Column } from '@/ui'
import {
  TODAY,
  submissionsCollection,
  useCollection,
  type Assignment,
  type Cohort,
  type Enrollment,
} from '@/mocks'

import { TeachingCard } from '../shared'

interface AssignmentRow {
  assignment: Assignment
  submitted: number
  awaiting: number
  graded: number
}

export default function AssignmentsTab({
  cohort,
  assignments,
  enrolments,
  onCreate,
}: {
  cohort: Cohort
  assignments: Assignment[]
  enrolments: Enrollment[]
  onCreate: () => void
}) {
  const submissions = useCollection(submissionsCollection)

  const rows = useMemo<AssignmentRow[]>(() => {
    const enrolmentIds = new Set(enrolments.map((e) => e.id))
    return assignments
      .map((assignment) => {
        const mine = submissions.filter(
          (s) => s.assignmentId === assignment.id && enrolmentIds.has(s.enrollmentId),
        )
        return {
          assignment,
          submitted: mine.length,
          awaiting: mine.filter((s) => s.status === 'awaiting_grading').length,
          graded: mine.filter((s) => s.status === 'graded').length,
        } satisfies AssignmentRow
      })
      .sort((a, b) => (a.assignment.dueDate ?? '9999').localeCompare(b.assignment.dueDate ?? '9999'))
  }, [assignments, submissions, enrolments])

  const totalAwaiting = rows.reduce((acc, r) => acc + r.awaiting, 0)

  const columns: Array<Column<AssignmentRow>> = [
    {
      key: 'assignment',
      header: 'Assignment',
      pinned: true,
      minWidth: 300,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-semibold text-text">{row.assignment.title}</p>
          <p className="truncate text-body-12 text-text-muted">{row.assignment.brief || 'No brief given.'}</p>
        </div>
      ),
      sortValue: (row) => row.assignment.title,
      sortable: true,
    },
    {
      key: 'scope',
      header: 'Scope',
      width: 136,
      cell: (row) => (
        <Badge tone={row.assignment.cohortId ? 'accent' : 'neutral'} variant="subtle" size="sm">
          {row.assignment.cohortId ? 'This cohort' : 'Course-wide'}
        </Badge>
      ),
      sortValue: (row) => (row.assignment.cohortId ? 0 : 1),
      sortable: true,
    },
    {
      key: 'marks',
      header: 'Marks',
      width: 88,
      align: 'right',
      accessor: (row) => formatNumber(row.assignment.maxScore),
      sortValue: (row) => row.assignment.maxScore,
      sortable: true,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 112,
      align: 'right',
      accessor: (row) => `${formatNumber(row.submitted)} of ${formatNumber(enrolments.length)}`,
      sortValue: (row) => row.submitted,
      sortable: true,
    },
    {
      key: 'awaiting',
      header: 'To mark',
      width: 100,
      align: 'right',
      cell: (row) =>
        row.awaiting > 0 ? (
          <Badge tone="warning" size="sm">
            {formatNumber(row.awaiting)}
          </Badge>
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        ),
      sortValue: (row) => row.awaiting,
      sortable: true,
    },
    {
      key: 'due',
      header: 'Due date',
      width: 140,
      align: 'right',
      cell: (row) => {
        if (!row.assignment.dueDate) {
          return (
            <span className="text-body-13 text-text-muted">
              {row.assignment.dueOffsetDays !== null
                ? `${row.assignment.dueOffsetDays} days after release`
                : 'No due date'}
            </span>
          )
        }
        const overdue = row.assignment.dueDate < TODAY
        return (
          <span className={overdue ? 'text-body-13 font-medium text-danger-text' : 'text-body-13 text-text-secondary'}>
            {formatDate(row.assignment.dueDate)}
          </span>
        )
      },
      sortValue: (row) => row.assignment.dueDate ?? '',
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 160,
      align: 'right',
      cell: (row) => (
        <Button size="sm" variant={row.awaiting > 0 ? 'primary' : 'secondary'} asChild>
          <Link to={`/teaching/assignments/${row.assignment.id}?cohort=${cohort.id}`}>
            {row.awaiting > 0 ? 'Mark work' : 'Submissions'}
          </Link>
        </Button>
      ),
    },
  ]

  return (
    <TeachingCard
      title="Assignments"
      description={
        totalAwaiting > 0
          ? `${formatNumber(rows.length)} set · ${formatNumber(totalAwaiting)} waiting to be marked`
          : `${formatNumber(rows.length)} set · nothing waiting`
      }
      action={
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={onCreate}>
          Create assignment
        </Button>
      }
    >
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.assignment.id}
        bordered={false}
        minWidth={1180}
        density="compact"
        caption="Assignments on this cohort, with submission and marking counts"
        empty={
          <EmptyState
            icon={ClipboardList}
            title="No assignments on this cohort yet"
            message="Set one and every enrolled student sees it with the due date and the accepted formats."
            action={
              <Button size="sm" leftIcon={<Plus size={14} />} onClick={onCreate}>
                Create assignment
              </Button>
            }
          />
        }
      />
    </TeachingCard>
  )
}
