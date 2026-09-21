/**
 * Assignment detail — `/my-learning/assignments/:assignmentId`.
 *
 * The legacy portal's two-thirds / one-third layout, kept exactly: the brief
 * and the learner's own submission on the left, a slim metadata sidebar on
 * the right. The same four status words appear here as in the list, in the
 * same colours, which is the legacy app's single best discipline and the one
 * it broke itself (its table paints "Submitted" purple and its detail page
 * paints it green — here it is one vocabulary, declared once, in `common`).
 *
 * What Cirvee OS adds underneath: the real rubric the tutor grades against,
 * the real late policy and its penalty, the per-criterion scores that came
 * back, and the tutor's voice note. A learner who only ever sees a number is
 * being told less than the system knows.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Link as LinkIcon,
  Mic,
  Upload,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
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
  Textarea,
  type Column,
} from '@/ui'
import {
  assignmentsCollection,
  cohortsCollection,
  coursesCollection,
  lessonsCollection,
  submissionsCollection,
  useCollection,
  TODAY,
  type Assignment,
  type Enrollment,
  type RubricRow,
  type Submission,
} from '@/mocks'

import {
  assignmentStateOf,
  formatBytes,
  personName,
  Screen,
  studentToast,
  useStudent,
  WORK_LABEL,
  WORK_TONE,
} from './common'
import { canSubmit, SubmissionRejected, splitNote, submitAssignment } from './writes'

export default function AssignmentDetail() {
  const { assignmentId } = useParams<{ assignmentId: string }>()
  const navigate = useNavigate()
  const { enrolments } = useStudent()

  const assignments = useCollection(assignmentsCollection)
  const submissions = useCollection(submissionsCollection)

  const assignment = assignments.find((a) => a.id === assignmentId)
  const enrolment = enrolments.find((e) => e.courseId === assignment?.courseId)

  if (!assignment || !enrolment) {
    return (
      <Screen>
        <EmptyState
          title="Assignment not found"
          message="This assignment is not on any course you are enrolled on."
          action={
            <Button variant="secondary" onClick={() => navigate('/my-learning/course?tab=assignments')}>
              Back to assignments
            </Button>
          }
          bordered
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <Detail assignment={assignment} enrolment={enrolment} submissions={submissions} />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */

function Detail({
  assignment,
  enrolment,
  submissions,
}: {
  assignment: Assignment
  enrolment: Enrollment
  submissions: Submission[]
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const lessons = useCollection(lessonsCollection)

  const cohort = cohortsCollection.find(enrolment.cohortId)
  const course = coursesCollection.find(enrolment.courseId)
  const lesson = lessons.find((l) => l.id === assignment.lessonId)

  const row = useMemo(
    () => assignmentStateOf(assignment, enrolment, cohort, submissions),
    [assignment, enrolment, cohort, submissions],
  )
  const { submission, dueDate, state } = row
  const overdue = state === 'overdue'
  const note = splitNote(submission?.note ?? null)

  /* Whether the learner may still put something in. A graded submission is
     final unless the tutor returned it; an assignment whose late policy is
     `reject` closes at the due date. */
  const closed = dueDate !== null && dueDate < TODAY && assignment.latePolicy === 'reject'
  const canAct = !closed && (!submission || submission.status === 'returned_for_revision')

  const rubricColumns: Array<Column<RubricRow>> = [
    { key: 'criterion', header: 'Criterion', accessor: (r) => r.criterion, minWidth: 160 },
    {
      key: 'description',
      header: 'What the tutor looks for',
      accessor: (r) => r.description,
      minWidth: 320,
    },
    { key: 'weight', header: 'Weight', align: 'right', accessor: (r) => `${r.weight}%`, width: 90 },
    {
      key: 'score',
      header: 'Your score',
      align: 'right',
      cell: (r) => {
        const scored = submission?.rubricScores.find((s) => s.criterion === r.criterion)
        return scored ? (
          <span className="text-body-14 font-bold">
            {scored.score}
            <span className="text-body-12 font-normal text-text-muted"> / {r.weight}</span>
          </span>
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        )
      },
      width: 110,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <Link
        to="/my-learning/course?tab=assignments"
        className="inline-flex w-fit items-center gap-1.5 text-body-13 font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft size={14} />
        Back to assignments
      </Link>

      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {/* ---- Left, two thirds ------------------------------------------ */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* Instructions */}
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="border-b border-border px-7 pb-6 pt-7">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-label-10 text-text-label">Assignment</p>
                  <h1 className="mt-1 text-heading-24 font-bold leading-snug">{assignment.title}</h1>
                </div>
                {canAct && (
                  <Button
                    onClick={() => setModalOpen(true)}
                    leftIcon={<Upload size={15} />}
                    className="shrink-0"
                  >
                    {submission ? 'Resubmit work' : 'Submit work'}
                  </Button>
                )}
              </div>

              {/* Three pills, as the legacy detail header has: state, due, marks. */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={WORK_TONE[state]} variant="subtle" size="sm" dot>
                  {WORK_LABEL[state]}
                </Badge>
                <Badge
                  tone={overdue ? 'danger' : 'neutral'}
                  variant="subtle"
                  size="sm"
                  icon={<Clock size={11} />}
                >
                  {dueDate ? `Due ${formatDate(dueDate)}` : 'No fixed due date'}
                </Badge>
                <Badge tone="neutral" variant="subtle" size="sm">
                  {assignment.maxScore} marks
                </Badge>
              </div>
            </header>

            <div className="px-7 py-7">
              <p className="whitespace-pre-wrap text-body-15 leading-relaxed text-text-secondary">
                {assignment.brief || 'No specific instructions provided.'}
              </p>

              <div className="mt-7 border-t border-border pt-7">
                <p className="mb-3 text-label-10 text-text-label">
                  How this is marked
                </p>
                <DataTable
                  data={assignment.rubric}
                  columns={rubricColumns}
                  rowKey={(r) => r.criterion}
                  density="compact"
                  emptyTitle="No rubric published"
                  emptyMessage="Your tutor marks this one holistically."
                />
              </div>

              {lesson && (
                <p className="mt-6 text-body-13 text-text-muted">
                  Set in{' '}
                  <Link to="/my-learning/course?tab=content" className="font-medium text-accent hover:underline">
                    {lesson.title}
                  </Link>
                  .
                </p>
              )}
            </div>
          </section>

          {/* Your submission */}
          {submission ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-surface">
              <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface-sunken px-7 py-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-success-fill text-success-ink">
                    <CheckCircle2 size={16} />
                  </span>
                  <div>
                    <p className="text-body-14 font-bold">Your submission</p>
                    <p className="text-body-12 text-text-secondary">
                      Attempt {submission.attempt} · submitted {formatDateTime(submission.submittedAt)}
                      {submission.isLate && ' · late'}
                    </p>
                  </div>
                </div>
                {submission.totalScore !== null && (
                  <div className="rounded-xl bg-success-600 px-4 py-2 text-center text-success-25">
                    <p className="text-label-10 uppercase tracking-wide opacity-80">Score</p>
                    <p className="text-heading-18 font-bold leading-tight">
                      {submission.totalScore} / {assignment.maxScore}
                    </p>
                  </div>
                )}
              </header>

              <div className="flex flex-col gap-5 px-7 py-7">
                {submission.files.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {submission.files.map((file) => (
                      <li
                        key={file.url}
                        className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
                          <FileText size={14} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-13 font-semibold">
                            {file.fileName}
                          </span>
                          <span className="text-body-12 text-text-muted">
                            {formatBytes(file.sizeBytes)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {note.link && (
                  <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
                      <LinkIcon size={14} />
                    </span>
                    <a
                      href={note.link}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-body-13 font-semibold text-accent hover:underline"
                    >
                      {note.link}
                    </a>
                  </div>
                )}

                {note.comment && (
                  <div>
                    <p className="mb-2 text-label-10 text-text-label">
                      Your note
                    </p>
                    <p className="whitespace-pre-wrap rounded-xl border border-border bg-surface-sunken px-5 py-4 text-body-14 italic leading-relaxed text-text-secondary">
                      {note.comment}
                    </p>
                  </div>
                )}

                {submission.feedback && (
                  <div>
                    <p className="mb-2 text-label-10 text-success-text">
                      Tutor feedback
                      {submission.gradedByPersonId && ` — ${personName(submission.gradedByPersonId)}`}
                    </p>
                    <p className="whitespace-pre-wrap rounded-xl border border-success-line bg-success-fill px-5 py-4 text-body-14 leading-relaxed text-success-ink">
                      {submission.feedback}
                    </p>
                  </div>
                )}

                {submission.voiceNote && (
                  <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
                      <Mic size={14} />
                    </span>
                    <span className="text-body-13 font-semibold">
                      Voice note from your tutor
                      <span className="ml-1 font-normal text-text-muted">
                        {Math.floor(submission.voiceNote.durationSeconds / 60)}:
                        {String(submission.voiceNote.durationSeconds % 60).padStart(2, '0')}
                      </span>
                    </span>
                  </div>
                )}

                {submission.status === 'awaiting_grading' && (
                  <p className="text-body-13 text-text-muted">
                    Waiting to be graded. Your tutor usually returns work within a few days.
                  </p>
                )}

                {submission.status === 'returned_for_revision' && (
                  <Alert tone="warning" title="Returned for revision">
                    Your tutor has asked for changes. Read the feedback above, then resubmit — your
                    previous attempt is kept.
                  </Alert>
                )}
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-border bg-surface px-7 py-7">
              <EmptyState
                icon={Upload}
                title="You have not submitted this yet"
                message={
                  closed
                    ? 'This assignment stopped accepting submissions after its due date. Speak to your tutor.'
                    : `Accepted formats: ${assignment.acceptedFormats.join(', ')}. Up to ${assignment.maxFileSizeMb} MB.`
                }
                action={
                  canAct ? (
                    <Button onClick={() => setModalOpen(true)} leftIcon={<Upload size={15} />}>
                      Submit work
                    </Button>
                  ) : undefined
                }
                size="sm"
              />
            </section>
          )}
        </div>

        {/* ---- Right, one third ------------------------------------------ */}
        <aside className="flex flex-col gap-5">
          <section className="overflow-hidden rounded-2xl border border-border bg-surface">
            <header className="border-b border-border px-6 py-5">
              <p className="text-body-14 font-bold">Details</p>
            </header>
            <div className="px-6 py-2">
              <KeyValueList>
                <KeyValue label="Course">{course?.title ?? '—'}</KeyValue>
                <KeyValue label="Cohort">{cohort?.code ?? '—'}</KeyValue>
                <KeyValue label="Max marks">{assignment.maxScore}</KeyValue>
                <KeyValue label="Due date">
                  <span className={cn(overdue && 'font-medium text-danger-text')}>
                    {dueDate ? formatDate(dueDate) : 'No fixed date'}
                  </span>
                </KeyValue>
                <KeyValue label="Status">
                  <Badge tone={WORK_TONE[state]} variant="subtle" size="sm" dot>
                    {WORK_LABEL[state]}
                  </Badge>
                </KeyValue>
              </KeyValueList>
            </div>
          </section>

          {/* The legacy's "Important note" card, made true rather than generic:
              this states the assignment's own configured late policy. */}
          <section className="rounded-2xl border border-border bg-surface px-6 py-5">
            <div className="mb-2 flex items-center gap-2 text-accent">
              <AlertCircle size={14} />
              <p className="text-body-13 font-bold">Before you submit</p>
            </div>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body-13 leading-relaxed text-text-secondary">
              <li>Accepted formats: {assignment.acceptedFormats.join(', ')}.</li>
              <li>Maximum {assignment.maxFileSizeMb} MB — combine several files into one archive.</li>
              <li>{latePolicyLine(assignment)}</li>
            </ul>
          </section>
        </aside>
      </div>

      <SubmitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        assignment={assignment}
        enrolment={enrolment}
        resubmission={Boolean(submission)}
      />
    </div>
  )
}

function latePolicyLine(assignment: Assignment): string {
  switch (assignment.latePolicy) {
    case 'reject':
      return 'Late submissions are not accepted after the due date.'
    case 'accept_with_penalty':
      return `Late submissions are accepted with a ${assignment.latePenaltyPercent ?? 0}% penalty.`
    default:
      return 'Late submissions are accepted without a penalty.'
  }
}

/* -------------------------------------------------------------------------- */
/* The submission modal                                                       */
/* -------------------------------------------------------------------------- */

/**
 * File, link and comment — all three at once, which is what the legacy modal
 * actually sends. The only rule it enforces is the one worth enforcing: at
 * least one of file or link, because a comment on its own is not a
 * submission. Everything else is the tutor's judgement, not the form's.
 */
function SubmitModal({
  open,
  onClose,
  assignment,
  enrolment,
  resubmission,
}: {
  open: boolean
  onClose: () => void
  assignment: Assignment
  enrolment: Enrollment
  resubmission: boolean
}) {
  const [file, setFile] = useState<{ fileName: string; sizeBytes: number } | null>(null)
  const [link, setLink] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const ready = canSubmit({ file, link })
  const tooBig = file !== null && file.sizeBytes > assignment.maxFileSizeMb * 1024 * 1024

  function reset() {
    setFile(null)
    setLink('')
    setComment('')
    setBusy(false)
  }

  function close() {
    reset()
    onClose()
  }

  function submit() {
    setBusy(true)
    try {
      submitAssignment({
        assignmentId: assignment.id,
        enrollmentId: enrolment.id,
        file,
        link,
        comment,
      })
      studentToast.success(resubmission ? 'Resubmitted. Your tutor has been notified.' : 'Submitted.')
      close()
    } catch (error) {
      setBusy(false)
      studentToast.error(
        error instanceof SubmissionRejected ? error.message : 'Could not submit. Nothing was saved.',
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={resubmission ? 'Resubmit your work' : 'Submit your work'}
      description={assignment.title}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!ready || tooBig}
            loading={busy}
            leftIcon={<CheckCircle2 size={15} />}
          >
            Complete submission
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field
          label="Upload file"
          hint={`Accepted: ${assignment.acceptedFormats.join(', ')}. Up to ${assignment.maxFileSizeMb} MB.`}
          error={tooBig ? `This file is over the ${assignment.maxFileSizeMb} MB limit.` : undefined}
        >
          <label
            className={cn(
              'relative flex h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors',
              file
                ? 'border-accent bg-accent-subtle'
                : 'border-border-strong bg-surface-sunken hover:border-accent',
            )}
          >
            <input
              type="file"
              className="absolute inset-0 cursor-pointer opacity-0"
              accept={assignment.acceptedFormats.map((f) => `.${f}`).join(',')}
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                setFile(chosen ? { fileName: chosen.name, sizeBytes: chosen.size } : null)
              }}
            />
            <span
              className={cn(
                'grid size-10 place-items-center rounded-xl border border-border bg-surface',
                file ? 'text-accent' : 'text-text-muted',
              )}
            >
              {file ? <FileText size={20} /> : <Upload size={20} />}
            </span>
            {file ? (
              <>
                <span className="max-w-full truncate px-6 text-body-14 font-bold">
                  {file.fileName}
                </span>
                <span className="text-body-12 text-text-muted">
                  {formatBytes(file.sizeBytes)} · ready
                </span>
              </>
            ) : (
              <>
                <span className="text-body-14 font-bold">Choose a file</span>
                <span className="text-body-12 text-text-muted">
                  Or paste a link below instead
                </span>
              </>
            )}
          </label>
        </Field>

        <Field label="External link" optional hint="Figma, GitHub, Google Drive — whatever holds the work.">
          <Input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://"
            leftIcon={<LinkIcon size={15} />}
          />
        </Field>

        <Field label="Note for your tutor" optional>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={600}
            showCount
            placeholder="Anything your tutor should know before marking this."
          />
        </Field>

        {!ready && (
          <p className="text-body-13 text-text-muted">
            Attach a file or paste a link to continue. A note on its own is not a submission.
          </p>
        )}
      </div>
    </Modal>
  )
}
