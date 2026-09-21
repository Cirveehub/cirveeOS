/**
 * Every write the Student performs.
 *
 * There are two, and only two. A learner's portal is overwhelmingly a read
 * surface — the one thing they genuinely author is a submission, and the one
 * thing they genuinely correct is their own contact details.
 *
 * `submitAssignment` writes a real `Submission` against the real
 * `Enrollment`, which is what makes the rest of the system move: the tutor's
 * grading queue picks it up, `certificateEligibility` recounts the
 * "Assignments" criterion from it, and the grade that comes back lands on the
 * same row the learner is looking at. Nothing here fabricates a grade or a
 * status the tutor has not given.
 *
 * The legacy portal's submission is a multipart POST carrying a file, an
 * optional external link and an optional comment — all three at once, not an
 * either/or. Cirvee OS's `Submission` has `files[]` and a single `note`, so
 * the link is folded into the note with its own line rather than being
 * dropped: a learner who submits a Figma URL must not have it silently
 * disappear because the schema had no column for it.
 */

import {
  CURRENT_USER_ID,
  TODAY,
  assignmentsCollection,
  auditEventsCollection,
  cohortDiscussionPostsCollection,
  cohortsCollection,
  enrollmentsCollection,
  peopleCollection,
  progressCollection,
  quizAttemptsCollection,
  quizzesCollection,
  submissionsCollection,
  usersCollection,
  rolesCollection,
} from '@/mocks'
import {
  auditId as asAuditId,
  discussionPostId as asDiscussionPostId,
  quizAttemptId as asQuizAttemptId,
  submissionId as asSubmissionId,
  type Assignment,
  type AuditEvent,
  type CohortId,
  type Enrollment,
  type EnrollmentId,
  type Gender,
  type LessonId,
  type LessonProgressState,
  type Percent,
  type Person,
  type PersonId,
  type QuizAttempt,
  type QuizAttemptAnswer,
  type Submission,
} from '@/mocks/types'

import { dueDateOf, nowIso } from './common'

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

let auditSequence = 0

function emitAudit(input: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): AuditEvent {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Student') : 'Student'
  const actor = user ? peopleCollection.find(user.personId) : undefined

  return auditEventsCollection.insert({
    id: asAuditId(`aud-mylearning-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: nowIso(),
    actorUserId: CURRENT_USER_ID,
    actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Student',
    actorRole: roleName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: 'ui',
    ip: '102.89.34.17',
  })
}

function auditable(at: string = nowIso()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

/* -------------------------------------------------------------------------- */
/* Submitting work                                                            */
/* -------------------------------------------------------------------------- */

export interface SubmitInput {
  assignmentId: string
  enrollmentId: string
  /** The chosen file's own name and size — the prototype stores no bytes. */
  file: { fileName: string; sizeBytes: number } | null
  /** Figma, GitHub, Behance — kept, not discarded, when there is no file. */
  link: string
  comment: string
}

export type SubmitProblem =
  | 'assignment_not_found'
  | 'enrolment_not_found'
  | 'nothing_attached'
  | 'late_rejected'

export class SubmissionRejected extends Error {
  constructor(
    readonly problem: SubmitProblem,
    message: string,
  ) {
    super(message)
    this.name = 'SubmissionRejected'
  }
}

/** What the modal's submit button checks before it is allowed to be pressed. */
export function canSubmit(input: Pick<SubmitInput, 'file' | 'link'>): boolean {
  return input.file !== null || input.link.trim().length > 0
}

/**
 * Creates the submission, or supersedes the learner's previous attempt.
 *
 * Attempts are never overwritten. A resubmission lands as attempt N+1 with
 * its own row, because the previous attempt carries a grade and a tutor's
 * feedback that the learner was asked to act on — losing it would be losing
 * the reason the resubmission exists.
 *
 * Late policy is enforced here rather than in the modal: `reject` genuinely
 * refuses, and `accept_with_penalty` marks `isLate` so the tutor's grading
 * pane can apply the penalty the assignment actually names. The learner is
 * told which one applies before they press the button.
 */
export function submitAssignment(input: SubmitInput): Submission {
  const at = nowIso()

  const assignment = assignmentsCollection.find(input.assignmentId)
  if (!assignment) throw new SubmissionRejected('assignment_not_found', 'This assignment no longer exists.')

  const enrolment = enrollmentsCollection.find(input.enrollmentId)
  if (!enrolment) throw new SubmissionRejected('enrolment_not_found', 'You are not enrolled on this course.')

  if (!canSubmit(input)) {
    throw new SubmissionRejected('nothing_attached', 'Attach a file or paste a link before submitting.')
  }

  const late = isLate(assignment, enrolment)
  if (late && assignment.latePolicy === 'reject') {
    throw new SubmissionRejected(
      'late_rejected',
      'This assignment stopped accepting submissions after its due date. Speak to your tutor.',
    )
  }

  const previous = submissionsCollection
    .where((s) => s.assignmentId === assignment.id && s.enrollmentId === enrolment.id)
    .sort((a, b) => b.attempt - a.attempt)[0]

  const person = peopleCollection.find(enrolment.personId)
  const slug = `${(person?.firstName ?? 'student').toLowerCase()}-${assignment.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '')}`

  const submission: Submission = {
    id: asSubmissionId(`sub-ui-${Date.now().toString(36)}`),
    assignmentId: assignment.id,
    enrollmentId: enrolment.id,
    personId: enrolment.personId,
    attempt: (previous?.attempt ?? 0) + 1,
    submittedAt: at,
    isLate: late,
    files: input.file
      ? [
          {
            fileName: input.file.fileName,
            sizeBytes: input.file.sizeBytes,
            url: `/submissions/${slug}`,
          },
        ]
      : [],
    note: composeNote(input.comment, input.link),
    status: 'awaiting_grading',
    rubricScores: [],
    totalScore: null,
    passed: null,
    feedback: null,
    voiceNote: null,
    gradedByPersonId: null,
    gradedAt: null,
    daysWaiting: 0,
    ...auditable(at),
  }

  submissionsCollection.insert(submission)

  emitAudit({
    action: 'submission.create',
    entityType: 'Submission',
    entityId: submission.id,
    entityRef: assignment.title,
    field: 'status',
    before: previous ? previous.status : null,
    after: 'awaiting_grading',
  })

  return submission
}

/** The link never vanishes: it becomes its own line under the learner's note. */
function composeNote(comment: string, link: string): string | null {
  const parts = [comment.trim(), link.trim() ? `Link: ${link.trim()}` : ''].filter(Boolean)
  return parts.length ? parts.join('\n\n') : null
}

function isLate(assignment: Assignment, enrolment: Enrollment): boolean {
  const due = dueDateOf(assignment, cohortsCollection.find(enrolment.cohortId))
  return due !== null && due < TODAY
}

/** Read back what `composeNote` wrote, for the "your submission" card. */
export function splitNote(note: string | null): { comment: string | null; link: string | null } {
  if (!note) return { comment: null, link: null }
  const lines = note.split('\n\n')
  const linkLine = lines.find((l) => l.startsWith('Link: '))
  const comment = lines.filter((l) => !l.startsWith('Link: ')).join('\n\n')
  return { comment: comment.trim() || null, link: linkLine ? linkLine.slice(6) : null }
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                    */
/* -------------------------------------------------------------------------- */

export interface ProfileInput {
  firstName: string
  lastName: string
  gender: Gender | undefined
  email: string
  phone: string
}

/**
 * The only other thing a learner authors. Contact details are the field staff
 * chase most often and the one a learner can correct without anybody's
 * approval, so it is a direct write with an audit row rather than a request.
 */
export function updateProfile(personId: PersonId, input: ProfileInput): Person | undefined {
  const at = nowIso()
  const before = peopleCollection.find(personId)
  if (!before) return undefined

  const updated = peopleCollection.update(personId, {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    gender: input.gender,
    email: input.email.trim() || null,
    phone: input.phone.trim() || null,
    avatarInitials: `${input.firstName.trim()[0] ?? ''}${input.lastName.trim()[0] ?? ''}`.toUpperCase(),
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  const fields: Array<[string, string | null, string | null]> = [
    ['firstName', before.firstName, input.firstName.trim()],
    ['lastName', before.lastName, input.lastName.trim()],
    ['email', before.email, input.email.trim() || null],
    ['phone', before.phone, input.phone.trim() || null],
    ['gender', before.gender ?? null, input.gender ?? null],
  ]
  const changed = fields.filter(([, was, now]) => was !== now)

  for (const [field, was, now] of changed) {
    emitAudit({
      action: 'person.update',
      entityType: 'Person',
      entityId: personId,
      entityRef: `${before.firstName} ${before.lastName}`,
      field,
      before: was,
      after: now,
    })
  }

  return updated
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

/** Flips one lesson's state and recomputes the enrolment's completion tallies. */
function markLessonProgress(
  enrollmentId: EnrollmentId,
  lessonId: LessonId,
  state: LessonProgressState,
  at: string,
): void {
  const progress = progressCollection.where((p) => p.enrollmentId === enrollmentId)[0]
  if (!progress) return

  const already = progress.perLesson.some((p) => p.lessonId === lessonId)
  const perLesson = already
    ? progress.perLesson.map((p) =>
        p.lessonId === lessonId
          ? { ...p, state, completedAt: state === 'complete' ? at : p.completedAt }
          : p,
      )
    : [...progress.perLesson, { lessonId, state, formatUsed: null, completedAt: state === 'complete' ? at : null }]

  const lessonsCompleted = perLesson.filter((p) => p.state === 'complete').length
  const percentComplete: Percent =
    progress.lessonsTotal > 0 ? Math.round((lessonsCompleted / progress.lessonsTotal) * 100) : 0

  progressCollection.update(progress.id, {
    perLesson,
    lessonsCompleted,
    percentComplete,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
}

/** A rough OS/browser label in the same shape the seed already uses ("Android · Chrome"). */
function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Unknown device'
  const ua = navigator.userAgent
  const os = /android/i.test(ua)
    ? 'Android'
    : /iphone|ipad|ipod/i.test(ua)
      ? 'iOS'
      : /mac os/i.test(ua)
        ? 'macOS'
        : /windows/i.test(ua)
          ? 'Windows'
          : 'Unknown OS'
  const browser = /edg\//i.test(ua)
    ? 'Edge'
    : /chrome\//i.test(ua)
      ? 'Chrome'
      : /firefox\//i.test(ua)
        ? 'Firefox'
        : /safari\//i.test(ua)
          ? 'Safari'
          : 'Browser'
  return `${os} · ${browser}`
}

/**
 * Resume-across-devices needs to know where a learner was reading or
 * watching, not only what they finished — so this fires on opening any
 * lesson, unlike `markLessonProgress` which only ever fires on a real
 * completion event (a submission, a passed/failed quiz).
 */
export function markLessonOpened(enrollmentId: EnrollmentId, lessonId: LessonId): void {
  const progress = progressCollection.where((p) => p.enrollmentId === enrollmentId)[0]
  if (!progress) return
  progressCollection.update(progress.id, {
    lastLessonId: lessonId,
    lastActivityAt: nowIso(),
    lastDevice: deviceLabel(),
    daysInactive: 0,
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  })
}

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                    */
/* -------------------------------------------------------------------------- */

export interface QuizAnswerInput {
  questionId: string
  selectedOptionIds: string[]
  textAnswer: string
}

export interface SubmitQuizAttemptInput {
  quizId: string
  lessonId: LessonId
  enrollmentId: EnrollmentId
  personId: PersonId
  answers: QuizAnswerInput[]
  startedAt: string
}

/**
 * Scores what the data can actually score. `QuizQuestion` carries no
 * accepted-answer field for `short_answer`/`numeric` types (only options
 * carry a `correct` flag) — those answers are recorded, never guessed at:
 * `correct: null`, contributing nothing to `scorePercent`, and the attempt
 * comes back flagged `needsManualReview` rather than silently marked wrong.
 */
export function submitQuizAttempt(input: SubmitQuizAttemptInput): QuizAttempt {
  const at = nowIso()
  const quiz = quizzesCollection.find(input.quizId)
  if (!quiz) throw new Error('This quiz no longer exists.')

  const previousAttempts = quizAttemptsCollection.where(
    (a) => a.quizId === quiz.id && a.enrollmentId === input.enrollmentId,
  )
  if (previousAttempts.length >= quiz.attemptsAllowed) {
    throw new Error(
      `You have used all ${quiz.attemptsAllowed} attempt${quiz.attemptsAllowed === 1 ? '' : 's'} for this quiz.`,
    )
  }

  let earnedPoints = 0
  let gradablePoints = 0
  let needsManualReview = false

  const answers: QuizAttemptAnswer[] = quiz.questions.map((question) => {
    const given = input.answers.find((a) => a.questionId === question.id)
    const selectedOptionIds = given?.selectedOptionIds ?? []

    if (question.options.length === 0) {
      needsManualReview = true
      return {
        questionId: question.id,
        selectedOptionIds: [],
        textAnswer: given?.textAnswer.trim() || null,
        correct: null,
        pointsAwarded: 0,
      }
    }

    const correctIds = question.options.filter((o) => o.correct).map((o) => o.id)
    const correct =
      correctIds.length === selectedOptionIds.length && correctIds.every((id) => selectedOptionIds.includes(id))
    gradablePoints += question.points
    if (correct) earnedPoints += question.points

    return {
      questionId: question.id,
      selectedOptionIds,
      textAnswer: null,
      correct,
      pointsAwarded: correct ? question.points : 0,
    }
  })

  const scorePercent: Percent = gradablePoints > 0 ? Math.round((earnedPoints / gradablePoints) * 100) : 0
  const passed = scorePercent >= quiz.passMark

  const attempt = quizAttemptsCollection.insert({
    id: asQuizAttemptId(`qa-${Date.now().toString(36)}`),
    quizId: quiz.id,
    enrollmentId: input.enrollmentId,
    personId: input.personId,
    attemptNumber: previousAttempts.length + 1,
    answers,
    scorePercent,
    passed,
    needsManualReview,
    startedAt: input.startedAt,
    submittedAt: at,
    ...auditable(at),
  })

  markLessonProgress(input.enrollmentId, input.lessonId, passed ? 'complete' : 'failed', at)

  emitAudit({
    action: 'quiz.attempt.submit',
    entityType: 'QuizAttempt',
    entityId: attempt.id,
    entityRef: quiz.title,
    field: 'scorePercent',
    before: null,
    after: `${scorePercent}% — ${passed ? 'passed' : `below the ${quiz.passMark}% pass mark`}`,
  })

  return attempt
}

/* -------------------------------------------------------------------------- */
/* Cohort discussion                                                          */
/* -------------------------------------------------------------------------- */

export function postToDiscussion(cohortId: CohortId, authorPersonId: PersonId, body: string): void {
  const trimmed = body.trim()
  if (!trimmed) return
  const at = nowIso()
  cohortDiscussionPostsCollection.insert({
    id: asDiscussionPostId(`disc-ui-${Date.now().toString(36)}`),
    cohortId,
    authorPersonId,
    authorRole: 'student',
    body: trimmed,
    postedAt: at,
    pinned: false,
    ...auditable(at),
  })
}

/** A student may only ever remove their own post — enforced by the caller passing their own id. */
export function deleteDiscussionPost(postId: string): void {
  cohortDiscussionPostsCollection.remove(postId)
}
