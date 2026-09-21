/**
 * Grading — the legacy `Submission.tsx`: back link, one card, one table
 * (student, submitted at, status, grade, action), and a small modal with two
 * fields. No rubric builder, no bulk tools, no second page.
 *
 * Three things Cirvee OS's data makes better without adding a screen:
 *
 *  1. **The cohort, not just the submissions.** The legacy table listed only
 *     rows that existed, so a tutor could not tell who had not handed in. The
 *     enrolment list is the source here, and a student with nothing against
 *     this assignment appears as "Not submitted".
 *  2. **The assignment's own rules are shown**, because they are real fields:
 *     due date, maximum, accepted formats, and what the late policy does. The
 *     penalty is stated as applied by the policy rather than by the tutor.
 *  3. **Rubric-aware grading.** The modal is the legacy's two fields when the
 *     assignment has no rubric — which is every assignment created in this
 *     module. A seeded assignment that publishes rubric rows gets one compact
 *     score box per criterion, feeding `Submission.rubricScores`, and the
 *     total is the sum rather than a number typed twice.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, FileCheck2, FileText } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  StatusBadge,
  Textarea,
  type Column,
} from '@/ui'
import { useCurrentUserId, useSession } from '@/auth'
import {
  TODAY,
  assignmentsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  submissionsCollection,
  useCollection,
  type Enrollment,
  type Submission,
} from '@/mocks'

import { VoiceNoteRecorder } from '../_learning-shared/VoiceNoteRecorder'
import { Page, TeachingCard, personName } from './shared'
import { gradeSubmission, passPercentFor, returnForRevision } from './writes'

interface GradeRow {
  key: string
  name: string
  enrolment: Enrollment
  submission: Submission | undefined
}

export default function Grading() {
  const { assignmentId = '' } = useParams<{ assignmentId: string }>()
  const [params] = useSearchParams()
  const actorUserId = useCurrentUserId()
  const session = useSession()

  const assignments = useCollection(assignmentsCollection)
  const submissions = useCollection(submissionsCollection)
  const enrolments = useCollection(enrollmentsCollection)
  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)

  const [grading, setGrading] = useState<Submission | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const assignment = assignments.find((a) => a.id === assignmentId)
  const cohortId = params.get('cohort') ?? assignment?.cohortId ?? ''
  const cohort = cohorts.find((c) => c.id === cohortId)
  const course = assignment ? courses.find((c) => c.id === assignment.courseId) : undefined

  const rows = useMemo<GradeRow[]>(() => {
    if (!assignment) return []

    /* Scope to one cohort when we know which, otherwise every enrolment on the
       course — a course-wide assignment opened without a cohort in the URL. */
    const relevant = enrolments.filter((e) =>
      cohortId ? e.cohortId === cohortId : e.courseId === assignment.courseId,
    )

    return relevant
      .filter((e) => e.status !== 'withdrawn')
      .map((enrolment) => ({
        key: enrolment.id,
        name: personName(enrolment.personId),
        enrolment,
        submission: submissions.find(
          (s) => s.assignmentId === assignment.id && s.enrollmentId === enrolment.id,
        ),
      }))
      .sort((a, b) => {
        const rank = (row: GradeRow) =>
          row.submission?.status === 'awaiting_grading' ? 0 : row.submission ? 1 : 2
        return rank(a) - rank(b) || a.name.localeCompare(b.name)
      })
  }, [assignment, enrolments, submissions, cohortId])

  const awaiting = rows.filter((r) => r.submission?.status === 'awaiting_grading').length
  const passMark = passPercentFor(assignment?.courseId)

  if (!assignment) {
    return (
      <Page>
        <EmptyState
          title="That assignment no longer exists"
          message="It may have been removed from the course outline."
          action={
            <Button variant="secondary" asChild>
              <Link to="/teaching/classes">Back to my classes</Link>
            </Button>
          }
        />
      </Page>
    )
  }

  const columns: Array<Column<GradeRow>> = [
    {
      key: 'student',
      header: 'Student',
      pinned: true,
      minWidth: 220,
      accessor: (row) => row.name,
      sortValue: (row) => row.name,
      sortable: true,
    },
    {
      key: 'submitted',
      header: 'Submitted at',
      minWidth: 190,
      cell: (row) =>
        row.submission ? (
          <span className="flex items-center gap-2">
            <span className="text-body-13">{formatDateTime(row.submission.submittedAt)}</span>
            {row.submission.isLate && (
              <Badge tone="warning" variant="outline" size="sm">
                Late
              </Badge>
            )}
          </span>
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        ),
      sortValue: (row) => row.submission?.submittedAt ?? '',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 170,
      cell: (row) =>
        row.submission ? (
          <StatusBadge
            status={row.submission.status}
            label={
              row.submission.status === 'awaiting_grading'
                ? 'Pending'
                : row.submission.status === 'returned_for_revision'
                  ? 'Returned'
                  : undefined
            }
          />
        ) : (
          <Badge tone="neutral" variant="outline" size="sm">
            Not submitted
          </Badge>
        ),
      sortValue: (row) => row.submission?.status ?? 'missing',
      sortable: true,
    },
    {
      key: 'waiting',
      header: 'Waiting',
      width: 100,
      align: 'right',
      cell: (row) =>
        row.submission?.status === 'awaiting_grading' ? (
          <span className={row.submission.daysWaiting > 5 ? 'text-body-13 text-danger-text' : 'text-body-13'}>
            {row.submission.daysWaiting}d
          </span>
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        ),
      sortValue: (row) => row.submission?.daysWaiting ?? -1,
      sortable: true,
    },
    {
      key: 'grade',
      header: 'Grade',
      width: 120,
      align: 'right',
      cell: (row) => {
        const score = row.submission?.totalScore
        if (score === null || score === undefined) return <span className="text-body-13 text-text-muted">—</span>
        return (
          <Badge tone={row.submission?.passed ? 'success' : 'danger'} size="sm">
            {score}/{assignment.maxScore}
          </Badge>
        )
      },
      sortValue: (row) => row.submission?.totalScore ?? -1,
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 130,
      align: 'right',
      cell: (row) =>
        row.submission ? (
          <Button
            size="sm"
            variant={row.submission.status === 'awaiting_grading' ? 'primary' : 'secondary'}
            onClick={() => setGrading(row.submission ?? null)}
          >
            {row.submission.status === 'graded' ? 'Edit grade' : 'Grade'}
          </Button>
        ) : (
          <span className="text-body-13 text-text-muted">Nothing to mark</span>
        ),
    },
  ]

  return (
    <Page>
      <Link
        to={cohort ? `/teaching/classes/${cohort.id}?tab=assignments` : '/teaching/classes'}
        className="mb-4 inline-flex items-center gap-1.5 text-body-13 font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft size={14} />
        {cohort ? cohort.code : 'My classes'}
      </Link>

      <div className="mb-6">
        <h1 className="text-heading-24 text-text">{assignment.title}</h1>
        <p className="mt-1.5 text-body-14 text-text-secondary">
          {course?.title ?? 'Course'}
          {cohort ? ` · ${cohort.code}` : ' · every cohort on this course'} · view and grade student work.
        </p>
      </div>

      {notice && (
        <Alert tone="success" title="Saved" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <TeachingCard title="The brief" description={assignment.brief || 'No brief was written for this one.'}>
          <KeyValueList columns={2} className="px-6 py-2">
            <KeyValue label="Due">
              {assignment.dueDate ? (
                <span className={assignment.dueDate < TODAY ? 'text-danger-text' : undefined}>
                  {formatDate(assignment.dueDate)}
                </span>
              ) : assignment.dueOffsetDays !== null ? (
                `${assignment.dueOffsetDays} days after release`
              ) : (
                'No due date'
              )}
            </KeyValue>
            <KeyValue label="Maximum">{formatNumber(assignment.maxScore)} marks</KeyValue>
            <KeyValue label="Pass mark">{passMark}%</KeyValue>
            <KeyValue label="Accepted formats">
              {assignment.acceptedFormats.join(', ') || 'Any'} · up to {assignment.maxFileSizeMb} MB
            </KeyValue>
            <KeyValue label="Late work">
              {assignment.latePolicy === 'accept'
                ? 'Accepted in full'
                : assignment.latePolicy === 'reject'
                  ? 'Rejected after the due date'
                  : `Accepted with a ${assignment.latePenaltyPercent ?? 10}% penalty, applied by the policy`}
            </KeyValue>
            <KeyValue label="Grading">
              {assignment.rubric.length > 0
                ? `${assignment.rubric.length} rubric criteria`
                : 'Holistic — one score and written feedback'}
            </KeyValue>
          </KeyValueList>
          {assignment.tutorGuidance && (
            <p className="border-t border-border px-6 py-3 text-body-13 text-text-secondary">
              {assignment.tutorGuidance}
            </p>
          )}
        </TeachingCard>

        <TeachingCard
          title="Submissions"
          description={
            awaiting > 0
              ? `${formatNumber(awaiting)} waiting to be marked, out of ${formatNumber(rows.length)} students`
              : `Nothing waiting · ${formatNumber(rows.length)} students`
          }
        >
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.key}
            bordered={false}
            minWidth={1060}
            caption="Students on this assignment, with submission status and grade"
            empty={
              <EmptyState
                icon={FileCheck2}
                title="Nobody is enrolled against this assignment"
                message="Submissions appear once students are enrolled on a cohort taking this course."
              />
            }
          />
        </TeachingCard>
      </div>

      <GradeModal
        submission={grading}
        maxScore={assignment.maxScore}
        rubric={assignment.rubric}
        passMark={passMark}
        latePolicy={assignment.latePolicy}
        latePenaltyPercent={assignment.latePenaltyPercent}
        graderPersonId={session?.personId ?? null}
        actorUserId={actorUserId}
        onClose={() => setGrading(null)}
        onDone={(message) => setNotice(message)}
      />
    </Page>
  )
}

/* -------------------------------------------------------------------------- */
/* The grading modal                                                          */
/* -------------------------------------------------------------------------- */

function GradeModal({
  submission,
  maxScore,
  rubric,
  passMark,
  latePolicy,
  latePenaltyPercent,
  graderPersonId,
  actorUserId,
  onClose,
  onDone,
}: {
  submission: Submission | null
  maxScore: number
  rubric: Array<{ criterion: string; weight: number; description: string }>
  passMark: number
  latePolicy: 'accept' | 'accept_with_penalty' | 'reject'
  latePenaltyPercent: number | null
  graderPersonId: string | null
  actorUserId: ReturnType<typeof useCurrentUserId>
  onClose: () => void
  onDone: (message: string) => void
}) {
  const hasRubric = rubric.length > 0

  const [score, setScore] = useState('')
  const [criterionScores, setCriterionScores] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const [voiceNote, setVoiceNote] = useState<Submission['voiceNote']>(null)
  const [returning, setReturning] = useState(false)
  const [touched, setTouched] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (!submission) return
    setScore(submission.totalScore === null ? '' : String(submission.totalScore))
    setCriterionScores(
      Object.fromEntries(
        rubric.map((row) => [
          row.criterion,
          String(submission.rubricScores.find((s) => s.criterion === row.criterion)?.score ?? ''),
        ]),
      ),
    )
    setFeedback(submission.feedback ?? '')
    setVoiceNote(submission.voiceNote)
    setReturning(false)
    setTouched(false)
    setFailure(null)
  }, [submission, rubric])

  const criterionMax = (weight: number) => Math.round((weight * maxScore) / 100)

  const rubricTotal = rubric.reduce((acc, row) => {
    const value = Number(criterionScores[row.criterion])
    return acc + (Number.isFinite(value) ? value : 0)
  }, 0)

  const total = hasRubric ? rubricTotal : Number(score)
  const complete = hasRubric
    ? rubric.every((row) => (criterionScores[row.criterion] ?? '') !== '')
    : score !== ''

  const scoreError =
    touched && !complete
      ? hasRubric
        ? 'Score every criterion before saving.'
        : 'Enter a score.'
      : touched && (!Number.isFinite(total) || total < 0 || total > maxScore)
        ? `A score must be between 0 and ${maxScore}.`
        : undefined

  function save() {
    setTouched(true)
    setFailure(null)
    if (!submission || !complete || scoreError) return

    try {
      gradeSubmission({
        submissionId: submission.id,
        totalScore: total,
        feedback,
        voiceNote,
        rubricScores: hasRubric
          ? rubric.map((row) => ({
              criterion: row.criterion,
              score: Number(criterionScores[row.criterion]),
              comment: '',
            }))
          : undefined,
        graderPersonId: (graderPersonId ?? null) as Submission['gradedByPersonId'],
        actorUserId,
      })
      const passed = (total / maxScore) * 100 >= passMark
      onDone(
        `${personName(submission.personId)} graded ${total}/${maxScore} — ${passed ? 'passed' : `below the ${passMark}% pass mark`}.`,
      )
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The grade was not saved.')
    }
  }

  function sendBack() {
    setTouched(true)
    setFailure(null)
    if (!submission) return
    try {
      returnForRevision({ submissionId: submission.id, reason: feedback, actorUserId })
      onDone(`${personName(submission.personId)}'s work was returned for revision.`)
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The submission was not returned.')
    }
  }

  return (
    <Modal
      open={submission !== null}
      onClose={onClose}
      size="md"
      title={submission ? `Grade ${personName(submission.personId)}` : ''}
      description={
        submission
          ? `Submitted ${formatDateTime(submission.submittedAt)}${submission.isLate ? ' — late' : ''}. Out of ${maxScore}.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={() => (returning ? sendBack() : setReturning(true))}>
            {returning ? 'Confirm return' : 'Return for revision'}
          </Button>
          <Button onClick={save}>Save grade</Button>
        </>
      }
    >
      {submission && (
        <div className="flex flex-col gap-4">
          {failure && (
            <Alert tone="danger" title="Not saved">
              {failure}
            </Alert>
          )}

          {submission.status === 'graded' && (
            <Alert tone="info" title={`Already graded ${submission.totalScore}/${maxScore}`}>
              Saving again writes a new score over this one and records both in the audit log. The
              submitted file is never replaced.
            </Alert>
          )}

          {submission.isLate && latePolicy === 'accept_with_penalty' && (
            <Alert tone="warning" title="Late submission">
              The policy deducts {latePenaltyPercent ?? 10}%. Mark the work on its merits — the penalty is
              applied by the policy, not by you.
            </Alert>
          )}

          {returning && (
            <Alert tone="warning" title="Returning instead of grading">
              The feedback below is sent to the student as the reason. Nothing is deleted; the status
              becomes "returned for revision" and they can submit again.
            </Alert>
          )}

          <div>
            <p className="mb-1.5 text-body-13 font-semibold text-text">Submitted files</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {submission.files.length === 0 && (
                <li className="px-3 py-2 text-body-13 text-text-muted">No file was attached.</li>
              )}
              {submission.files.map((file) => (
                <li key={file.fileName} className="flex items-center gap-2 px-3 py-2">
                  <FileText size={14} className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate text-body-13">{file.fileName}</span>
                  <span className="shrink-0 text-body-12 text-text-muted">
                    {Math.round(file.sizeBytes / 1024)} KB
                  </span>
                </li>
              ))}
            </ul>
            {submission.note && (
              <p className="mt-2 rounded-xl border border-border bg-surface-sunken p-3 text-body-13 text-text-secondary">
                {submission.note}
              </p>
            )}
          </div>

          {hasRubric ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-13 font-semibold text-text">Rubric</p>
              {rubric.map((row) => (
                <div key={row.criterion} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-body-13" title={row.description}>
                    {row.criterion}
                  </span>
                  <Input
                    inputSize="sm"
                    type="number"
                    min={0}
                    max={criterionMax(row.weight)}
                    aria-label={`${row.criterion} score out of ${criterionMax(row.weight)}`}
                    value={criterionScores[row.criterion] ?? ''}
                    suffix={`/ ${criterionMax(row.weight)}`}
                    containerClassName="w-32 shrink-0"
                    onChange={(e) =>
                      setCriterionScores((prev) => ({ ...prev, [row.criterion]: e.target.value }))
                    }
                  />
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-body-13 text-text-secondary">Total</span>
                <span className="text-body-14 font-bold tabular-nums">
                  {rubricTotal}/{maxScore}
                </span>
              </div>
              {scoreError && <p className="text-body-12 text-danger-text">{scoreError}</p>}
            </div>
          ) : (
            <Field label={`Grade (out of ${maxScore})`} required error={scoreError} id="grade-score">
              <Input
                id="grade-score"
                type="number"
                min={0}
                max={maxScore}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder={`0–${maxScore}`}
              />
            </Field>
          )}

          <Field
            label="Feedback"
            hint={returning ? 'Required when returning — eight characters minimum.' : undefined}
            id="grade-feedback"
          >
            <Textarea
              id="grade-feedback"
              rows={4}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Strong cleaning step. The chart on slide 3 needs axis labels."
            />
          </Field>

          <VoiceNoteRecorder value={voiceNote} onChange={setVoiceNote} />
        </div>
      )}
    </Modal>
  )
}
