/**
 * Assignments — `/learn/assignments`.
 *
 * The teaching-side view of the grading operation: how many submitted against
 * how many enrolled, how many of those are graded, and who is responsible.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, ClipboardList } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
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
  Input,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonTable,
  Textarea,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  assignmentsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  lessonsCollection,
  submissionsCollection,
  tutorAssignmentsCollection,
  useCollection,
  type Assignment,
} from '@/mocks'

import {
  Screen,
  ScreenError,
  learnToast,
  nowIso,
  personName,
  useScreenError,
  useScreenLoading,
} from './common'

interface AssignmentRow {
  assignment: Assignment
  courseTitle: string
  moduleTitle: string
  cohortCode: string
  dueDate: string | null
  enrolled: number
  submitted: number
  graded: number
  averageScore: number | null
  lateCount: number
  tutor: string
}

export default function Assignments() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:assignments')
  const { errored, retry } = useScreenError()

  const assignments = useCollection(assignmentsCollection)
  const submissions = useCollection(submissionsCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const lessons = useCollection(lessonsCollection)
  const tutorAssignments = useCollection(tutorAssignmentsCollection)

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const course = params.get('course') ?? undefined
  const state = params.get('state') ?? undefined

  const [extending, setExtending] = useState<Assignment | null>(null)

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const rows = useMemo<AssignmentRow[]>(() => {
    return assignments.map((assignment) => {
      const mine = submissions.filter((s) => s.assignmentId === assignment.id)
      const graded = mine.filter((s) => s.status === 'graded')
      const cohort = assignment.cohortId ? cohorts.find((c) => c.id === assignment.cohortId) : undefined
      const lesson = lessons.find((l) => l.id === assignment.lessonId)
      const enrolled = enrollments.filter(
        (e) => e.courseId === assignment.courseId && e.status !== 'withdrawn',
      ).length
      const tutor = tutorAssignments.find(
        (t) => t.cohortId === cohort?.id && t.status === 'active' && t.role === 'lead',
      )
      const fallbackTutor = tutorAssignments.find(
        (t) => cohorts.find((c) => c.id === t.cohortId)?.courseId === assignment.courseId && t.status === 'active',
      )
      const scores = graded.map((s) => s.totalScore ?? 0)
      return {
        assignment,
        courseTitle: courses.find((c) => c.id === assignment.courseId)?.title ?? '—',
        moduleTitle: lesson?.title ?? '—',
        cohortCode: cohort?.code ?? 'All cohorts',
        dueDate:
          assignment.dueDate ??
          (cohort && assignment.dueOffsetDays !== null
            ? addDays(cohort.startDate, assignment.dueOffsetDays)
            : null),
        enrolled,
        submitted: mine.length,
        graded: graded.length,
        averageScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        lateCount: mine.filter((s) => s.isLate).length,
        tutor: personName((tutor ?? fallbackTutor)?.tutorPersonId ?? null),
      }
    })
  }, [assignments, submissions, enrollments, courses, cohorts, lessons, tutorAssignments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (course && row.assignment.courseId !== course) return false
      if (state === 'ungraded' && row.submitted - row.graded === 0) return false
      if (state === 'complete' && row.submitted !== row.graded) return false
      if (q && !`${row.assignment.title} ${row.courseTitle}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, course, state])

  const hasFilters = Boolean(search || course || state)
  const totalUngraded = rows.reduce((acc, r) => acc + (r.submitted - r.graded), 0)

  const columns: Array<Column<AssignmentRow>> = [
    {
      key: 'title',
      header: 'Assignment',
      minWidth: 240,
      pinned: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 font-medium text-text">{r.assignment.title}</div>
          <div className="truncate text-body-12 text-text-muted">{r.moduleTitle}</div>
        </div>
      ),
      sortValue: (r) => r.assignment.title,
    },
    { key: 'course', header: 'Course', width: 170, accessor: (r) => r.courseTitle, sortValue: (r) => r.courseTitle },
    { key: 'cohort', header: 'Cohort', width: 120, accessor: (r) => r.cohortCode, sortValue: (r) => r.cohortCode },
    {
      key: 'due',
      header: 'Due',
      width: 130,
      accessor: (r) => (r.dueDate ? formatDate(r.dueDate) : `${r.assignment.dueOffsetDays ?? 0} days in`),
      sortValue: (r) => r.dueDate ?? '',
    },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 150,
      cell: (r) => (
        <div>
          <div className="text-body-12 tabular-nums text-text">
            {formatNumber(r.submitted)}/{formatNumber(r.enrolled)}
          </div>
          <ProgressBar value={r.submitted} max={Math.max(1, r.enrolled)} size="sm" tone="accent" />
        </div>
      ),
      sortValue: (r) => (r.enrolled ? r.submitted / r.enrolled : 0),
    },
    {
      key: 'graded',
      header: 'Graded',
      width: 150,
      cell: (r) => (
        <div>
          <div className="text-body-12 tabular-nums text-text">
            {formatNumber(r.graded)}/{formatNumber(r.submitted)}
          </div>
          <ProgressBar
            value={r.graded}
            max={Math.max(1, r.submitted)}
            size="sm"
            tone={r.graded === r.submitted ? 'success' : 'warning'}
          />
        </div>
      ),
      sortValue: (r) => (r.submitted ? r.graded / r.submitted : 1),
    },
    {
      key: 'average',
      header: 'Average',
      align: 'right',
      width: 96,
      accessor: (r) => (r.averageScore === null ? '—' : `${r.averageScore}%`),
      sortValue: (r) => r.averageScore ?? -1,
    },
    {
      key: 'late',
      header: 'Late',
      align: 'right',
      width: 80,
      cell: (r) =>
        r.lateCount === 0 ? (
          <span className="text-text-muted">0</span>
        ) : (
          <Badge tone="warning" size="sm">
            {r.lateCount}
          </Badge>
        ),
      sortValue: (r) => r.lateCount,
    },
    { key: 'tutor', header: 'Tutor', width: 150, accessor: (r) => r.tutor, sortValue: (r) => r.tutor },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 220,
      cell: (r) => (
        <div className="flex justify-end gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/learn/submissions?assignment=${r.assignment.id}`)
            }}
          >
            Queue
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<CalendarClock size={14} />}
            onClick={(e) => {
              e.stopPropagation()
              setExtending(r.assignment)
            }}
          >
            Extend
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Screen wide>
      <PageHeader
        title="Assignments"
        description={`${formatNumber(assignments.length)} assignments across the catalogue · ${formatNumber(totalUngraded)} submissions still to mark.`}
      />

      {errored ? (
        <div className="mt-4">
          <ScreenError what="Assignments" onRetry={retry} />
        </div>
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <div className="px-4 pt-4">
              <FilterBar
                search={search}
                onSearchChange={(v) => setParam('q', v || undefined)}
                searchPlaceholder="Search assignments"
                values={{ course, state }}
                onFilterChange={(key, value) => setParam(key, value)}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  {
                    key: 'course',
                    label: 'Course',
                    width: 200,
                    options: courses.map((c) => ({ value: c.id, label: c.title })),
                  },
                  {
                    key: 'state',
                    label: 'Grading',
                    options: [
                      { value: 'ungraded', label: 'Has ungraded work' },
                      { value: 'complete', label: 'Fully graded' },
                    ],
                  },
                ]}
              />
            </div>

            {loading ? (
              <div className="p-4">
                <SkeletonTable rows={10} columns={9} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                {hasFilters ? (
                  <EmptyState
                    variant="search"
                    title="No assignments match these filters"
                    message="Nothing in the catalogue fits that combination."
                    action={
                      <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={ClipboardList}
                    title="No assignments yet"
                    message="Without an assignment there is nothing to grade, and no project grade to certify against."
                  />
                )}
              </div>
            ) : (
              <DataTable
                data={filtered}
                columns={columns}
                rowKey={(r) => r.assignment.id}
                density="compact"
                stickyHeader
                maxHeight={640}
                caption="Assignments and their grading state"
                onRowClick={(r) => navigate(`/learn/submissions?assignment=${r.assignment.id}`)}
                defaultSort={{ key: 'graded', direction: 'asc' }}
              />
            )}
          </CardBody>
        </Card>
      )}

      <ExtendDueDateModal assignment={extending} onClose={() => setExtending(null)} />
    </Screen>
  )
}

function ExtendDueDateModal({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const [days, setDays] = useState('7')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!assignment) return null

  return (
    <Modal
      open
      onClose={onClose}
      title="Extend the due date"
      description={assignment.title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!reason.trim()) {
                setError('A reason is required — the cohort is told why.')
                return
              }
              assignmentsCollection.update(assignment.id, {
                dueOffsetDays: (assignment.dueOffsetDays ?? 0) + Number(days || 0),
                updatedAt: nowIso(),
                updatedBy: CURRENT_USER_ID,
              })
              learnToast.success(
                'Due date extended',
                `Everyone on this assignment gets ${days} more days and a notification.`,
              )
              setReason('')
              setError(null)
              onClose()
            }}
          >
            Extend and notify
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Extend by" id="extend-days" required>
          <Input
            id="extend-days"
            type="number"
            min={1}
            max={60}
            suffix="days"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </Field>
        <Field label="Reason" id="extend-reason" required error={error}>
          <Textarea
            id="extend-reason"
            rows={3}
            invalid={Boolean(error)}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
            placeholder="Power outages across Ibadan for three days last week."
          />
        </Field>
        <Alert tone="info" title="The cohort is notified">
          Extending sends a message to every enrolled learner on this assignment with the new date and the
          reason given above.
        </Alert>
      </div>
    </Modal>
  )
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
