import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, Flag, Grid3x3, MessageSquare, Rows3, Users } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatNumber, humanize } from '@/lib/format'
import { downloadCsv } from '@/lib/view-state'
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
  PageHeader,
  ProgressBar,
  Select,
  SkeletonTable,
  Textarea,
  Tooltip,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  cohortsCollection,
  coursesCollection,
  courseModulesCollection,
  enrollmentsCollection,
  lessonsCollection,
  progressCollection,
  quizzesCollection,
  studentAttendanceCollection,
  submissionsCollection,
  tasksCollection,
  useCollection,
  type AttentionFlag,
  type CourseModule,
  type Enrollment,
  type Lesson,
  type Progress,
} from '@/mocks'
import { taskId as asTaskId } from '@/mocks/types'

import {
  Screen,
  ScreenError,
  learnToast,
  nowIso,
  personName,
  userName,
  useScreenError,
  useScreenLoading,
} from './common'

interface ProgressRow {
  progress: Progress
  enrolment: Enrollment
  studentName: string
  cohortCode: string
  courseTitle: string
  assignmentsSubmitted: number
  assignmentsGraded: number
  averageGrade: number | null
  quizPassRate: number | null
  attendance: number
  advisor: string
}

const FLAG_LABEL: Record<AttentionFlag, string> = {
  repeated_absence: 'Repeated absence',
  low_attendance: 'Low attendance',
  missing_assignments: 'Missing assignments',
  low_lms_activity: 'Low LMS activity',
  overdue_balance: 'Overdue balance',
}

export default function ProgressScreen() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:progress')
  const { errored, retry } = useScreenError()

  const progressRows = useCollection(progressCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)
  const submissions = useCollection(submissionsCollection)
  const attendance = useCollection(studentAttendanceCollection)
  const quizzes = useCollection(quizzesCollection)
  const lessons = useCollection(lessonsCollection)
  const modules = useCollection(courseModulesCollection)

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const course = params.get('course') ?? undefined
  const cohortFilter = params.get('cohort') ?? undefined
  const flagFilter = params.get('flag') ?? undefined
  const view = params.get('view') === 'matrix' ? 'matrix' : 'list'

  const [flagging, setFlagging] = useState<ProgressRow | null>(null)

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const rows = useMemo<ProgressRow[]>(() => {
    return progressRows
      .map((progress) => {
        const enrolment = enrollments.find((e) => e.id === progress.enrollmentId)
        if (!enrolment) return null
        const mine = submissions.filter((s) => s.enrollmentId === enrolment.id)
        const graded = mine.filter((s) => s.status === 'graded')
        const scores = graded.map((s) => s.totalScore ?? 0)
        const myAttendance = attendance.filter((a) => a.enrollmentId === enrolment.id)
        const present = myAttendance.filter((a) => a.state !== 'absent').length
        const cohort = cohorts.find((c) => c.id === enrolment.cohortId)
        const courseQuizzes = quizzes.filter((q) => q.courseId === enrolment.courseId)
        return {
          progress,
          enrolment,
          studentName: personName(enrolment.personId),
          cohortCode: cohort?.code ?? '—',
          courseTitle: courses.find((c) => c.id === enrolment.courseId)?.title ?? '—',
          assignmentsSubmitted: mine.length,
          assignmentsGraded: graded.length,
          averageGrade: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
          quizPassRate: courseQuizzes.length
            ? Math.round(courseQuizzes.reduce((a, q) => a + q.stats.passRate, 0) / courseQuizzes.length)
            : null,
          attendance: myAttendance.length
            ? Math.round((present / myAttendance.length) * 100)
            : (cohort?.attendanceRate ?? 0),
          advisor: userName(enrolment.advisorUserId),
        }
      })
      .filter((r): r is ProgressRow => r !== null)
  }, [progressRows, enrollments, submissions, attendance, cohorts, courses, quizzes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (course && row.enrolment.courseId !== course) return false
      if (cohortFilter && row.enrolment.cohortId !== cohortFilter) return false
      if (flagFilter && !row.enrolment.attentionFlags.includes(flagFilter as AttentionFlag)) return false
      if (q && !row.studentName.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, search, course, cohortFilter, flagFilter])

  const hasFilters = Boolean(search || course || cohortFilter || flagFilter)

  function exportCsv() {
    downloadCsv(
      `cirvee-learn-progress-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Student',
        'Cohort',
        'Course',
        'Lessons completed',
        'Lessons total',
        'Modules completed',
        'Assignments submitted',
        'Assignments graded',
        'Average grade',
        'Quiz pass rate',
        'Last activity',
        'Days inactive',
        'Attendance %',
        'Attention flags',
        'Advisor',
      ],
      filtered.map((r) => [
        r.studentName,
        r.cohortCode,
        r.courseTitle,
        String(r.progress.lessonsCompleted),
        String(r.progress.lessonsTotal),
        String(r.progress.modulesCompleted),
        String(r.assignmentsSubmitted),
        String(r.assignmentsGraded),
        r.averageGrade === null ? '' : String(r.averageGrade),
        r.quizPassRate === null ? '' : String(r.quizPassRate),
        r.progress.lastActivityAt.slice(0, 10),
        String(r.progress.daysInactive),
        String(r.attendance),
        r.enrolment.attentionFlags.map((f) => FLAG_LABEL[f]).join('; '),
        r.advisor,
      ]),
    )
    learnToast.success(
      `${filtered.length} rows exported`,
      'The export matches the filters on screen, not the whole collection.',
    )
  }

  const columns: Array<Column<ProgressRow>> = [
    {
      key: 'student',
      header: 'Student',
      minWidth: 180,
      pinned: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 font-medium text-text">{r.studentName}</div>
          <div className="truncate text-body-12 text-text-muted">{r.courseTitle}</div>
        </div>
      ),
      sortValue: (r) => r.studentName,
    },
    { key: 'cohort', header: 'Cohort', width: 100, accessor: (r) => r.cohortCode, sortValue: (r) => r.cohortCode },
    {
      key: 'lessons',
      header: 'Lessons',
      width: 150,
      cell: (r) => (
        <div>
          <div className="text-body-12 tabular-nums text-text">
            {r.progress.lessonsCompleted}/{r.progress.lessonsTotal}
          </div>
          <ProgressBar
            value={r.progress.lessonsCompleted}
            max={Math.max(1, r.progress.lessonsTotal)}
            size="sm"
            tone={r.progress.percentComplete >= 80 ? 'success' : r.progress.percentComplete < 30 ? 'danger' : 'accent'}
          />
        </div>
      ),
      sortValue: (r) => r.progress.percentComplete,
    },
    {
      key: 'modules',
      header: 'Modules',
      align: 'right',
      width: 96,
      accessor: (r) => `${r.progress.modulesCompleted}/${r.progress.modulesTotal}`,
      sortValue: (r) => r.progress.modulesCompleted,
    },
    {
      key: 'assignments',
      header: 'Assignments',
      align: 'right',
      width: 120,
      accessor: (r) => `${r.assignmentsGraded}/${r.assignmentsSubmitted}`,
      sortValue: (r) => r.assignmentsGraded,
    },
    {
      key: 'grade',
      header: 'Average grade',
      align: 'right',
      width: 120,
      cell: (r) =>
        r.averageGrade === null ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className={cn('tabular-nums', r.averageGrade < 60 ? 'text-danger-text' : 'text-text')}>
            {r.averageGrade}%
          </span>
        ),
      sortValue: (r) => r.averageGrade ?? -1,
    },
    {
      key: 'quiz',
      header: 'Quiz pass rate',
      align: 'right',
      width: 120,
      cell: (r) => (
        <Tooltip content="Course-level quiz pass rate. Per-learner quiz attempts are not in this prototype's seed.">
          <span className="tabular-nums text-text-secondary">
            {r.quizPassRate === null ? '—' : `${r.quizPassRate}%`}
          </span>
        </Tooltip>
      ),
      sortValue: (r) => r.quizPassRate ?? -1,
    },
    {
      key: 'lastActivity',
      header: 'Last activity',
      width: 120,
      accessor: (r) => formatDate(r.progress.lastActivityAt),
      sortValue: (r) => r.progress.lastActivityAt,
    },
    {
      key: 'inactive',
      header: 'Days inactive',
      align: 'right',
      width: 110,
      cell: (r) => (
        <span
          className={cn(
            'tabular-nums',
            r.progress.daysInactive >= 21 ? 'text-danger-text' : r.progress.daysInactive >= 10 ? 'text-warning-text' : 'text-text',
          )}
        >
          {r.progress.daysInactive}
        </span>
      ),
      sortValue: (r) => r.progress.daysInactive,
    },
    {
      key: 'attendance',
      header: 'Attendance',
      align: 'right',
      width: 110,
      cell: (r) => (
        <span className={cn('tabular-nums', r.attendance < 75 ? 'text-danger-text' : 'text-text')}>
          {r.attendance}%
        </span>
      ),
      sortValue: (r) => r.attendance,
    },
    {
      key: 'flags',
      header: 'Attention flags',
      minWidth: 200,
      cell: (r) =>
        r.enrolment.attentionFlags.length === 0 ? (
          <span className="text-body-12 text-text-muted">None</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {r.enrolment.attentionFlags.map((flag) => (
              <Badge key={flag} tone={flag === 'overdue_balance' ? 'danger' : 'warning'} size="sm">
                {FLAG_LABEL[flag]}
              </Badge>
            ))}
          </span>
        ),
      sortValue: (r) => r.enrolment.attentionFlags.length,
    },
    { key: 'advisor', header: 'Advisor', width: 150, accessor: (r) => r.advisor, sortValue: (r) => r.advisor },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 260,
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Flag size={14} />}
            onClick={(e) => {
              e.stopPropagation()
              setFlagging(r)
            }}
          >
            Flag
          </Button>
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<MessageSquare size={14} />}
            onClick={(e) => {
              e.stopPropagation()
              learnToast.info('Message composer not built in this prototype', `It would open a WhatsApp thread with ${r.studentName}.`)
            }}
          >
            Message
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/crm/leads`)
            }}
          >
            Person 360
          </Button>
        </div>
      ),
    },
  ]

  return (
    <Screen wide>
      <PageHeader
        title="Progress"
        description={`${formatNumber(rows.length)} enrolments. Flags are advisory — nothing here suspends, charges or withdraws anyone.`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leftIcon={view === 'list' ? <Grid3x3 size={16} /> : <Rows3 size={16} />}
              onClick={() => setParam('view', view === 'list' ? 'matrix' : undefined)}
            >
              {view === 'list' ? 'Matrix view' : 'List view'}
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download size={16} />}
              disabled={filtered.length === 0}
              onClick={exportCsv}
            >
              Export
            </Button>
          </div>
        }
      />

      {errored ? (
        <div className="mt-4">
          <ScreenError what="Progress" onRetry={retry} />
        </div>
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <div className="px-4 pt-4">
              <FilterBar
                search={search}
                onSearchChange={(v) => setParam('q', v || undefined)}
                searchPlaceholder="Find a student"
                values={{ course, cohort: cohortFilter, flag: flagFilter }}
                onFilterChange={(key, value) => setParam(key, value)}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  { key: 'course', label: 'Course', width: 190, options: courses.map((c) => ({ value: c.id, label: c.title })) },
                  {
                    key: 'cohort',
                    label: 'Cohort',
                    width: 150,
                    options: cohorts.map((c) => ({ value: c.id, label: c.code })),
                  },
                  {
                    key: 'flag',
                    label: 'Attention flag',
                    width: 180,
                    options: (Object.keys(FLAG_LABEL) as AttentionFlag[]).map((f) => ({
                      value: f,
                      label: FLAG_LABEL[f],
                    })),
                  },
                ]}
              />
            </div>

            {loading ? (
              <div className="p-4">
                <SkeletonTable rows={12} columns={10} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                {hasFilters ? (
                  <EmptyState
                    variant="search"
                    title="No learners match these filters"
                    message="Nobody on the roster fits that combination."
                    action={
                      <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Users}
                    title="Nobody is enrolled yet"
                    message="Progress appears as soon as the first admission becomes an enrolment."
                  />
                )}
              </div>
            ) : view === 'matrix' ? (
              <ProgressMatrix rows={filtered.slice(0, 40)} lessons={lessons} modules={modules} />
            ) : (
              <DataTable
                data={filtered}
                columns={columns}
                rowKey={(r) => r.progress.id}
                density="compact"
                stickyHeader
                maxHeight={640}
                caption="Learner progress"
                onRowClick={(r) => navigate(`/learn/student/${r.enrolment.id}`)}
                defaultSort={{ key: 'inactive', direction: 'desc' }}
              />
            )}
          </CardBody>
        </Card>
      )}

      <FlagModal row={flagging} onClose={() => setFlagging(null)} />
    </Screen>
  )
}

function ProgressMatrix({
  rows,
  lessons,
  modules,
}: {
  rows: ProgressRow[]
  lessons: Lesson[]
  modules: CourseModule[]
}) {
  const courseId = rows[0]?.enrolment.courseId
  const mixedCourses = rows.some((r) => r.enrolment.courseId !== courseId)

  const courseLessons = useMemo(() => {
    const bySeq = new Map(modules.map((m) => [m.id as string, m.sequence]))
    return lessons
      .filter((l) => l.courseId === courseId)
      .sort((a, b) => {
        const ma = bySeq.get(a.moduleId) ?? 0
        const mb = bySeq.get(b.moduleId) ?? 0
        return ma === mb ? a.sequence - b.sequence : ma - mb
      })
  }, [lessons, modules, courseId])

  if (mixedCourses) {
    return (
      <div className="p-6">
        <Alert tone="info" title="Filter to one course first">
          The matrix puts lessons across the top, so it only reads when every row is on the same course.
          Choose a course in the filter bar above.
        </Alert>
      </div>
    )
  }

  return (
    <div className="p-4">
      <p className="mb-3 text-body-12 text-text-secondary">
        Students down, lessons across. Green is complete, amber in progress, grey not started. The first
        column stays put; scroll sideways for the rest of the course.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse" aria-label="Learner progress by lesson">
          <caption className="sr-only">Per-lesson completion for every learner in the current filter</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-48 border-b border-r border-border bg-surface px-3 py-2 text-left text-label-11 text-text-label"
              >
                Student
              </th>
              {courseLessons.map((lesson, i) => (
                <th
                  key={lesson.id}
                  scope="col"
                  title={lesson.title}
                  className="w-8 border-b border-border bg-surface px-0 py-2 text-center text-body-12 text-text-muted"
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.progress.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 border-b border-r border-border bg-surface px-3 py-1.5 text-left text-body-12 font-normal text-text"
                >
                  {row.studentName}
                </th>
                {courseLessons.map((lesson) => {
                  const state = row.progress.perLesson.find((p) => p.lessonId === lesson.id)?.state ?? 'not_started'
                  return (
                    <td key={lesson.id} className="border-b border-border p-0.5 text-center">
                      <Tooltip content={`${lesson.title} — ${humanize(state)}`}>
                        <span
                          className={cn(
                            'mx-auto block size-4 rounded-sm',
                            state === 'complete'
                              ? 'bg-success-600'
                              : state === 'in_progress'
                                ? 'bg-warning-500'
                                : state === 'failed'
                                  ? 'bg-danger-600'
                                  : 'bg-surface-sunken',
                          )}
                        >
                          <span className="sr-only">
                            {row.studentName}, {lesson.title}: {humanize(state)}
                          </span>
                        </span>
                      </Tooltip>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FlagModal({ row, onClose }: { row: ProgressRow | null; onClose: () => void }) {
  const [flag, setFlag] = useState<AttentionFlag>('low_lms_activity')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!row) return null

  return (
    <Modal
      open
      onClose={onClose}
      title="Flag for attention"
      description={`${row.studentName} · ${row.cohortCode}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!note.trim()) {
                setError('Say what the advisor should look at.')
                return
              }
              enrollmentsCollection.update(row.enrolment.id, {
                attentionFlags: [...new Set([...row.enrolment.attentionFlags, flag])],
                flaggedAt: nowIso(),
                updatedAt: nowIso(),
                updatedBy: CURRENT_USER_ID,
              })
              tasksCollection.insert({
                id: asTaskId(`task-flag-${Date.now().toString(36)}`),
                title: `Check in with ${row.studentName} — ${FLAG_LABEL[flag].toLowerCase()}`,
                description: note,
                ownerUserId: row.enrolment.advisorUserId ?? CURRENT_USER_ID,
                departmentId: null,
                relatedEntityType: 'Enrollment',
                relatedEntityId: row.enrolment.id,
                relatedEntityRef: row.cohortCode,
                dueAt: nowIso(),
                priority: 'normal',
                status: 'open',
                completedAt: null,
                createdAt: nowIso(),
                createdBy: CURRENT_USER_ID,
                updatedAt: nowIso(),
                updatedBy: CURRENT_USER_ID,
              })
              learnToast.success(
                'Flagged for attention',
                `A task was created for ${row.advisor}. Nothing else happens automatically.`,
              )
              setNote('')
              setError(null)
              onClose()
            }}
          >
            Flag and create task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Alert tone="info" title="Flags are advisory">
          Flagging creates a task for the advisor and puts a chip on the row. It does not suspend access,
          charge anything, or withdraw the learner. A human decides what happens next.
        </Alert>
        <Field label="Flag" id="flag-type" required>
          <Select
            id="flag-type"
            value={flag}
            onChange={(e) => setFlag(e.target.value as AttentionFlag)}
            options={(Object.keys(FLAG_LABEL) as AttentionFlag[]).map((f) => ({ value: f, label: FLAG_LABEL[f] }))}
          />
        </Field>
        <Field label="Note for the advisor" id="flag-note" required error={error}>
          <Textarea
            id="flag-note"
            rows={3}
            invalid={Boolean(error)}
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setError(null)
            }}
            placeholder="Has not opened a lesson in 19 days and the capstone is due next week."
          />
        </Field>
      </div>
    </Modal>
  )
}
