/**
 * The Assignments tab of the student's course hub.
 *
 * Straight from the legacy portal: one card, one table, the status pill and
 * the due date, a single "View" per row. Two columns the legacy did not have
 * are here because Cirvee OS holds the data and a learner cares about it
 * more than anything else on the screen — the score they got, and whether the
 * tutor has returned the work for revision.
 *
 * No create, no grade. That split is the entire reason `CohortHub` takes its
 * tab content from the caller rather than knowing what a gradebook is.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { formatDate } from '@/lib/format'
import { Badge, Button, DataTable, type Column } from '@/ui'
import {
  assignmentsCollection,
  submissionsCollection,
  useCollection,
  TODAY,
  type Enrollment,
} from '@/mocks'

import { assignmentsFor, WORK_LABEL, WORK_TONE, type AssignmentState } from '../common'

export function AssignmentsTab({ enrolment }: { enrolment: Enrollment }) {
  const assignments = useCollection(assignmentsCollection)
  const submissions = useCollection(submissionsCollection)

  const rows = useMemo(
    () => assignmentsFor(enrolment, assignments, submissions),
    [enrolment, assignments, submissions],
  )

  const columns: Array<Column<AssignmentState>> = [
    {
      key: 'title',
      header: 'Assignment',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-semibold">{row.assignment.title}</p>
          <p className="truncate text-body-12 text-text-muted">{row.assignment.brief}</p>
        </div>
      ),
      sortValue: (row) => row.assignment.title,
      minWidth: 320,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (row) => (
        <Badge tone={WORK_TONE[row.state]} variant="subtle" size="sm" dot>
          {WORK_LABEL[row.state]}
        </Badge>
      ),
      sortValue: (row) => row.state,
      width: 180,
    },
    {
      key: 'due',
      header: 'Due date',
      align: 'right',
      cell: (row) => (
        <span
          className={
            row.state === 'overdue' ? 'text-body-13 font-medium text-danger-text' : 'text-body-13'
          }
        >
          {row.dueDate ? formatDate(row.dueDate) : 'No fixed date'}
        </span>
      ),
      sortValue: (row) => row.dueDate ?? '',
      width: 140,
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      cell: (row) =>
        row.submission?.totalScore !== null && row.submission?.totalScore !== undefined ? (
          <span className="text-body-14 font-bold">
            {row.submission.totalScore}
            <span className="text-body-12 font-normal text-text-muted">
              {' '}
              / {row.assignment.maxScore}
            </span>
          </span>
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        ),
      sortValue: (row) => row.submission?.totalScore ?? -1,
      width: 110,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (row) => (
        <Button size="sm" variant="secondary" asChild>
          <Link to={`/my-learning/assignments/${row.assignment.id}`}>View</Link>
        </Button>
      ),
      width: 90,
    },
  ]

  const outstanding = rows.filter((r) => r.state === 'pending' || r.state === 'overdue' || r.state === 'returned')

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
        <div>
          <p className="text-body-15 font-bold">Course assignments</p>
          <p className="text-body-12 text-text-muted">
            {rows.length} assignment{rows.length === 1 ? '' : 's'}
            {outstanding.length > 0 && ` · ${outstanding.length} outstanding`}
          </p>
        </div>
        {outstanding.length === 0 && rows.length > 0 && (
          <Badge tone="success" variant="subtle" size="sm">
            Nothing outstanding
          </Badge>
        )}
      </div>

      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.assignment.id}
        defaultSort={{ key: 'due', direction: 'asc' }}
        emptyTitle="No assignments yet"
        emptyMessage={`Nothing has been set for this cohort as of ${formatDate(TODAY)}.`}
      />
    </div>
  )
}
