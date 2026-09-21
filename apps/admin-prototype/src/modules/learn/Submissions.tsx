import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, Download, FileText, Send } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  Skeleton,
  SkeletonTable,
  StatusBadge,
  Textarea,
} from '@/ui'
import {
  CURRENT_USER_ID,
  assignmentsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  submissionsCollection,
  usersCollection,
  useCollection,
  type Submission,
} from '@/mocks'

import { VoiceNoteRecorder } from '../_learning-shared/VoiceNoteRecorder'
import {
  Screen,
  ScreenError,
  formatBytes,
  learnToast,
  nowIso,
  personName,
  useScreenError,
  useScreenLoading,
} from './common'

const PASS_LINE = 60

export default function Submissions() {
  const loading = useScreenLoading('learn:submissions')
  const { errored, retry } = useScreenError()

  const submissions = useCollection(submissionsCollection)
  const assignments = useCollection(assignmentsCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const courseFilter = params.get('course') ?? undefined
  const statusFilter = params.get('status') ?? 'awaiting_grading'
  const assignmentFilter = params.get('assignment') ?? undefined
  const activeId = params.get('submission') ?? undefined

  const listRef = useRef<HTMLUListElement>(null)

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const queue = useMemo(() => {
    const q = search.trim().toLowerCase()
    return submissions
      .filter((s) => {
        const enrolment = enrollments.find((e) => e.id === s.enrollmentId)
        if (statusFilter && s.status !== statusFilter) return false
        if (assignmentFilter && s.assignmentId !== assignmentFilter) return false
        if (courseFilter && enrolment?.courseId !== courseFilter) return false
        if (q && !personName(s.personId).toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => b.daysWaiting - a.daysWaiting)
  }, [submissions, enrollments, search, statusFilter, courseFilter, assignmentFilter])

  const activeIndex = Math.max(0, queue.findIndex((s) => s.id === activeId))
  const active = queue.find((s) => s.id === activeId) ?? queue[0]

  const select = useCallback(
    (submission: Submission | undefined) => {
      if (!submission) return
      setParam('submission', submission.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (target?.isContentEditable) return
      if (e.key === 'j') {
        e.preventDefault()
        select(queue[Math.min(queue.length - 1, activeIndex + 1)])
      }
      if (e.key === 'k') {
        e.preventDefault()
        select(queue[Math.max(0, activeIndex - 1)])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [queue, activeIndex, select])

  function advance(from: Submission) {
    const idx = queue.findIndex((s) => s.id === from.id)
    const next = queue[idx + 1] ?? queue[idx - 1]
    if (next && next.id !== from.id) setParam('submission', next.id)
    else setParam('submission', undefined)
  }

  const hasFilters = Boolean(search || courseFilter || assignmentFilter) || statusFilter !== 'awaiting_grading'

  return (
    <Screen wide>
      <PageHeader
        title="Submissions and grading"
        description={`${formatNumber(queue.length)} in this queue. Press j and k to move through it without leaving the grading pane.`}
      />

      {errored ? (
        <div className="mt-4">
          <ScreenError what="The grading queue" onRetry={retry} />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardBody padding="none">
              <div className="px-4 pt-4">
                <FilterBar
                  size="sm"
                  search={search}
                  onSearchChange={(v) => setParam('q', v || undefined)}
                  searchPlaceholder="Find a student"
                  values={{ course: courseFilter, status: statusFilter, assignment: assignmentFilter }}
                  onFilterChange={(key, value) => setParam(key, value)}
                  onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                  filters={[
                    {
                      key: 'course',
                      label: 'Course',
                      width: 170,
                      options: courses.map((c) => ({ value: c.id, label: c.title })),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      options: [
                        { value: 'awaiting_grading', label: 'Awaiting grading' },
                        { value: 'graded', label: 'Graded' },
                        { value: 'returned_for_revision', label: 'Returned for revision' },
                        { value: 'missing', label: 'Missing' },
                      ],
                    },
                    {
                      key: 'assignment',
                      label: 'Assignment',
                      width: 180,
                      options: assignments.map((a) => ({ value: a.id, label: a.title })),
                    },
                  ]}
                />
              </div>

              {loading ? (
                <div className="p-4">
                  <SkeletonTable rows={8} columns={3} showHeader={false} />
                </div>
              ) : queue.length === 0 ? (
                <div className="p-6">
                  {hasFilters ? (
                    <EmptyState
                      variant="search"
                      size="sm"
                      title="No submissions match these filters"
                      message="Try a different status or clear the filters."
                      action={
                        <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      size="sm"
                      icon={CheckCircle2}
                      title="Nothing awaiting grading"
                      message="Every submission has been marked. Learners are not waiting on anyone."
                    />
                  )}
                </div>
              ) : (
                <ul ref={listRef} className="max-h-[640px] divide-y divide-border overflow-y-auto" aria-label="Submission queue">
                  {queue.map((s) => {
                    const enrolment = enrollments.find((e) => e.id === s.enrollmentId)
                    const cohort = cohorts.find((c) => c.id === enrolment?.cohortId)
                    const assignment = assignments.find((a) => a.id === s.assignmentId)
                    const isActive = active?.id === s.id
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          aria-current={isActive}
                          onClick={() => select(s)}
                          className={cn(
                            'w-full px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                            isActive ? 'bg-accent-wash' : 'hover:bg-surface-hover',
                          )}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-body-13 font-medium text-text">
                              {personName(s.personId)}
                            </span>
                            <span
                              className={cn(
                                'shrink-0 text-body-12 font-semibold tabular-nums',
                                s.daysWaiting >= 5 ? 'text-danger-text' : 'text-text-secondary',
                              )}
                            >
                              {s.status === 'graded' ? 'Graded' : `${s.daysWaiting}d waiting`}
                            </span>
                          </div>
                          <div className="truncate text-body-12 text-text-secondary">
                            {assignment?.title ?? 'Unknown assignment'}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <Badge tone="neutral" size="sm">
                              {cohort?.code ?? '—'}
                            </Badge>
                            <span className="text-body-12 text-text-muted">
                              {formatDate(s.submittedAt)} · attempt {s.attempt}
                            </span>
                            {s.isLate && (
                              <Badge tone="warning" size="sm">
                                Late
                              </Badge>
                            )}
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          {loading ? (
            <Card>
              <CardBody className="space-y-3">
                <Skeleton height={24} width="40%" />
                <Skeleton height={120} />
                <Skeleton height={200} />
              </CardBody>
            </Card>
          ) : !active ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={CheckCircle2}
                  title="Nothing selected"
                  message="Pick a submission from the queue, or press j to start at the top."
                />
              </CardBody>
            </Card>
          ) : (
            <GradingPane key={active.id} submission={active} onGraded={() => advance(active)} />
          )}
        </div>
      )}
    </Screen>
  )
}

function GradingPane({ submission, onGraded }: { submission: Submission; onGraded: () => void }) {
  const assignment = useCollection(assignmentsCollection).find((a) => a.id === submission.assignmentId)
  const enrolment = useCollection(enrollmentsCollection).find((e) => e.id === submission.enrollmentId)
  const cohort = useCollection(cohortsCollection).find((c) => c.id === enrolment?.cohortId)
  const users = useCollection(usersCollection)

  const rubric = assignment?.rubric ?? []
  const maxScore = assignment?.maxScore ?? 100

  const [scores, setScores] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const row of rubric) {
      const existing = submission.rubricScores.find((s) => s.criterion === row.criterion)
      initial[row.criterion] = existing ? String(existing.score) : ''
    }
    return initial
  })
  const [comments, setComments] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const row of rubric) {
      initial[row.criterion] = submission.rubricScores.find((s) => s.criterion === row.criterion)?.comment ?? ''
    }
    return initial
  })
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [voiceNote, setVoiceNote] = useState(submission.voiceNote)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnComment, setReturnComment] = useState('')
  const [returnError, setReturnError] = useState<string | null>(null)

  const criterionMax = (weight: number) => Math.round((weight * maxScore) / 100)

  const total = rubric.reduce((acc, row) => {
    const value = Number(scores[row.criterion])
    return acc + (Number.isFinite(value) ? value : 0)
  }, 0)
  const complete = rubric.every((row) => scores[row.criterion] !== '')
  const passed = total >= PASS_LINE

  function validate(): boolean {
    const next: Record<string, string> = {}
    for (const row of rubric) {
      const raw = scores[row.criterion]
      if (raw === '') next[row.criterion] = 'Score this criterion before submitting.'
      else {
        const value = Number(raw)
        if (!Number.isFinite(value) || value < 0) next[row.criterion] = 'Enter a number of zero or more.'
        else if (value > criterionMax(row.weight))
          next[row.criterion] = `Maximum is ${criterionMax(row.weight)}.`
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submitGrade() {
    if (!validate()) return
    const graderPersonId = users.find((u) => u.id === CURRENT_USER_ID)?.personId ?? null
    submissionsCollection.update(submission.id, {
      status: 'graded',
      rubricScores: rubric.map((row) => ({
        criterion: row.criterion,
        score: Number(scores[row.criterion]),
        comment: comments[row.criterion] ?? '',
      })),
      totalScore: total,
      passed,
      feedback,
      voiceNote,
      gradedByPersonId: graderPersonId,
      gradedAt: nowIso(),
      daysWaiting: 0,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    })
    learnToast.success(
      `Graded ${total}/${maxScore}`,
      `${personName(submission.personId)} · ${passed ? 'passed' : 'below the pass line'}. Queue advanced.`,
    )
    onGraded()
  }

  return (
    <Card>
      <CardHeader
        title={personName(submission.personId)}
        description={`${assignment?.title ?? 'Assignment'} · ${cohort?.code ?? '—'} · submitted ${formatDateTime(submission.submittedAt)}`}
        actions={<StatusBadge status={submission.status} />}
      />
      <CardBody className="space-y-4">
        {submission.status === 'graded' && (
          <Alert tone="success" title={`Already graded ${submission.totalScore}/${maxScore}`}>
            Regrading writes a new score over this one and keeps the audit trail. The original submission file
            is never replaced.
          </Alert>
        )}

        {submission.isLate && assignment?.latePolicy === 'accept_with_penalty' && (
          <Alert tone="warning" title="Late submission">
            The late policy on this assignment deducts {assignment.latePenaltyPercent}%. Score the work on its
            merits — the penalty is applied by the policy, not by you.
          </Alert>
        )}

        <div>
          <h3 className="mb-2 text-body-13 font-semibold text-text">Submitted files</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {submission.files.map((file) => (
              <li key={file.fileName} className="flex items-center gap-3 px-3 py-2">
                <FileText size={16} className="shrink-0 text-text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-13 text-text">{file.fileName}</div>
                  <div className="text-body-12 text-text-muted">{formatBytes(file.sizeBytes)}</div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Download size={14} />}
                  onClick={() => learnToast.info('Download started', file.fileName)}
                >
                  Download
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-body-12 text-text-muted">
            Inline preview is not available in this prototype — no real files are stored.
          </p>
        </div>

        {submission.note && (
          <div className="rounded-xl border border-border bg-surface-sunken p-3">
            <div className="text-label-11 text-text-label">Submission note</div>
            <p className="mt-1 text-body-13 text-text-secondary">{submission.note}</p>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-body-13 font-semibold text-text">Rubric</h3>
            <span className="text-body-12 text-text-muted">Pass line {PASS_LINE}</span>
          </div>
          {rubric.length === 0 ? (
            <EmptyState
              size="sm"
              title="This assignment has no rubric"
              message="Grading without criteria is how two tutors give the same work different marks. Add a rubric in the lesson editor."
            />
          ) : (
            <div className="space-y-2">
              {rubric.map((row) => (
                <div key={row.criterion} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-body-13 font-medium text-text">{row.criterion}</div>
                      <div className="text-body-12 text-text-secondary">{row.description}</div>
                    </div>
                    <Field
                      label={`Score (max ${criterionMax(row.weight)})`}
                      id={`score-${submission.id}-${row.criterion}`}
                      error={errors[row.criterion]}
                      className="w-40 shrink-0"
                    >
                      <Input
                        id={`score-${submission.id}-${row.criterion}`}
                        inputSize="sm"
                        type="number"
                        min={0}
                        max={criterionMax(row.weight)}
                        invalid={Boolean(errors[row.criterion])}
                        value={scores[row.criterion] ?? ''}
                        suffix={`/ ${criterionMax(row.weight)}`}
                        onChange={(e) => {
                          setScores((prev) => ({ ...prev, [row.criterion]: e.target.value }))
                          setErrors((prev) => ({ ...prev, [row.criterion]: '' }))
                        }}
                      />
                    </Field>
                  </div>
                  <Input
                    aria-label={`Comment on ${row.criterion}`}
                    inputSize="sm"
                    className="mt-2"
                    placeholder="Optional comment on this criterion"
                    value={comments[row.criterion] ?? ''}
                    onChange={(e) => setComments((prev) => ({ ...prev, [row.criterion]: e.target.value }))}
                  />
                </div>
              ))}

              <div
                className={cn(
                  'flex items-center justify-between rounded-xl border p-3',
                  complete && passed
                    ? 'border-success-line bg-success-fill'
                    : complete
                      ? 'border-danger-line bg-danger-fill'
                      : 'border-border bg-surface-sunken',
                )}
              >
                <span
                  className={cn(
                    'text-body-13 font-semibold',
                    complete ? (passed ? 'text-success-ink' : 'text-danger-ink') : 'text-text',
                  )}
                >
                  Total
                </span>
                <span
                  className={cn(
                    'text-heading-20 tabular-nums',
                    complete ? (passed ? 'text-success-ink' : 'text-danger-ink') : 'text-text',
                  )}
                >
                  {total}/{maxScore}
                  <span className="ml-2 text-body-13">
                    {complete ? (passed ? 'Pass' : `Below the ${PASS_LINE} pass line`) : 'Incomplete'}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        <Field label="Overall feedback" id={`feedback-${submission.id}`}>
          <Textarea
            id={`feedback-${submission.id}`}
            rows={4}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What was good, what to fix, and what to do next."
          />
        </Field>

        <VoiceNoteRecorder
          value={voiceNote}
          onChange={setVoiceNote}
          onRecorded={() => learnToast.success('Voice note attached')}
        />

        {assignment?.tutorGuidance && (
          <Alert tone="info" title="Tutor guidance">
            {assignment.tutorGuidance}
          </Alert>
        )}

        <KeyValueList columns={2}>
          <KeyValue label="Attempt">{submission.attempt}</KeyValue>
          <KeyValue label="Days waiting">{submission.daysWaiting}</KeyValue>
          <KeyValue label="Graded by">
            {submission.gradedByPersonId ? personName(submission.gradedByPersonId) : 'Not graded yet'}
          </KeyValue>
          <KeyValue label="Graded at">
            {submission.gradedAt ? formatDateTime(submission.gradedAt) : '—'}
          </KeyValue>
        </KeyValueList>
      </CardBody>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
        <Button
          variant="ghost"
          onClick={() => learnToast.info('Extension requested', 'The learner and their advisor are notified.')}
        >
          Request extension
        </Button>
        <Button variant="secondary" onClick={() => setReturnOpen(true)}>
          Return for revision
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            submissionsCollection.update(submission.id, {
              rubricScores: rubric.map((row) => ({
                criterion: row.criterion,
                score: Number(scores[row.criterion]) || 0,
                comment: comments[row.criterion] ?? '',
              })),
              feedback,
              updatedAt: nowIso(),
              updatedBy: CURRENT_USER_ID,
            })
            learnToast.success('Draft saved', 'The submission stays in the queue.')
          }}
        >
          Save draft
        </Button>
        <Button leftIcon={<Send size={16} />} onClick={submitGrade}>
          Submit grade
        </Button>
      </div>

      <Modal
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title="Return for revision"
        description={`${personName(submission.personId)} will be asked to resubmit.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!returnComment.trim()) {
                  setReturnError('Say what needs to change. A bare return is not actionable.')
                  return
                }
                submissionsCollection.update(submission.id, {
                  status: 'returned_for_revision',
                  feedback: returnComment,
                  updatedAt: nowIso(),
                  updatedBy: CURRENT_USER_ID,
                })
                learnToast.success('Returned for revision', 'The learner keeps their attempt and resubmits.')
                setReturnOpen(false)
                setReturnComment('')
                setReturnError(null)
                onGraded()
              }}
            >
              Return
            </Button>
          </>
        }
      >
        <Field label="What needs to change" id="return-comment" required error={returnError}>
          <Textarea
            id="return-comment"
            rows={4}
            invalid={Boolean(returnError)}
            value={returnComment}
            onChange={(e) => {
              setReturnComment(e.target.value)
              setReturnError(null)
            }}
          />
        </Field>
      </Modal>
    </Card>
  )
}
