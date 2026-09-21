/**
 * Create assignment — the legacy `UploadAssignmentModal`, two steps, same
 * fields in the same order.
 *
 * Step 1 is the legacy's six: course, cohort, title, due date, total marks,
 * description. Course and cohort are pre-filled from the hub and shown
 * read-only, because the tutor is standing inside one cohort — the legacy had
 * them as dropdowns only because its modal could also be opened from a page
 * with no cohort context.
 *
 * Step 2 is the legacy's optional attachment, plus the two rules Cirvee OS's
 * `Assignment` actually enforces and a student's submit screen reads back:
 * which formats are accepted and what happens to late work. Four controls, not
 * a settings page.
 *
 * There is no rubric builder. The legacy graded against one "total marks"
 * number and a feedback box, so an assignment created here is written with an
 * empty `rubric` and grades holistically. Seeded assignments that *do* carry
 * rubric rows still grade per criterion — the grading modal branches on it.
 */
import { useEffect, useMemo, useState } from 'react'
import { Calendar, FileText, Target, Upload } from 'lucide-react'

import { Alert, Button, Field, Input, KeyValue, KeyValueList, Modal, Select, Textarea } from '@/ui'
import {
  TODAY,
  lessonsCollection,
  useCollection,
  type Assignment,
  type Cohort,
  type Course,
  type LessonId,
  type UserId,
} from '@/mocks'

import { createAssignment } from './writes'

const MARK_OPTIONS = ['10', '20', '50', '100'].map((v) => ({ value: v, label: `${v} marks` }))

const LATE_OPTIONS: Array<{ value: Assignment['latePolicy']; label: string }> = [
  { value: 'accept', label: 'Accept late work in full' },
  { value: 'accept_with_penalty', label: 'Accept with a penalty' },
  { value: 'reject', label: 'Reject after the due date' },
]

export default function AssignmentModal({
  open,
  onClose,
  cohort,
  course,
  actorUserId,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  cohort: Cohort
  course: Course
  actorUserId: UserId
  onCreated: (assignment: Assignment) => void
}) {
  const lessons = useCollection(lessonsCollection)

  /* Every assignment hangs off a lesson in the outline. A tutor should not
     have to think about that, so the default is the course's own assignment
     or project lesson and the select is there only if they disagree. */
  const lessonOptions = useMemo(() => {
    const mine = lessons
      .filter((l) => l.courseId === course.id)
      .sort((a, b) => a.sequence - b.sequence)
    const preferred = mine.filter((l) => l.type === 'assignment' || l.type === 'project')
    return [...preferred, ...mine.filter((l) => !preferred.includes(l))]
  }, [lessons, course.id])

  const [step, setStep] = useState<1 | 2>(1)
  const [lessonId, setLessonId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [brief, setBrief] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [maxScore, setMaxScore] = useState('100')
  const [acceptedFormats, setAcceptedFormats] = useState('pdf, docx, zip')
  const [maxFileSizeMb, setMaxFileSizeMb] = useState('25')
  const [latePolicy, setLatePolicy] = useState<Assignment['latePolicy']>('accept')
  const [latePenalty, setLatePenalty] = useState('10')
  const [attachment, setAttachment] = useState('')
  const [touched, setTouched] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setLessonId(lessonOptions[0]?.id ?? '')
    setTitle('')
    setBrief('')
    setDueDate('')
    setMaxScore('100')
    setAcceptedFormats('pdf, docx, zip')
    setMaxFileSizeMb('25')
    setLatePolicy('accept')
    setLatePenalty('10')
    setAttachment('')
    setTouched(false)
    setFailure(null)
  }, [open, lessonOptions])

  const titleError = touched && !title.trim() ? 'An assignment needs a title.' : undefined
  const dueError = touched && !dueDate ? 'Pick the day it is due.' : undefined
  const lessonError = touched && !lessonId ? 'Pick the lesson this belongs to.' : undefined
  const step1Valid = Boolean(title.trim() && dueDate && lessonId)

  function next() {
    setTouched(true)
    if (!step1Valid) return
    setTouched(false)
    setStep(2)
  }

  function create() {
    setFailure(null)
    try {
      const assignment = createAssignment({
        courseId: course.id,
        cohortId: cohort.id,
        lessonId: lessonId as LessonId,
        title,
        brief,
        dueDate,
        maxScore: Number(maxScore),
        acceptedFormats: acceptedFormats.split(',').map((f) => f.trim().replace(/^\./, '')),
        maxFileSizeMb: Number(maxFileSizeMb) || 25,
        latePolicy,
        latePenaltyPercent: latePolicy === 'accept_with_penalty' ? Number(latePenalty) || 10 : null,
        attachmentFileName: attachment.trim() || null,
        actorUserId,
      })
      onCreated(assignment)
      onClose()
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The assignment was not created.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={step === 1 ? 'Create assignment' : 'Attachment and submission rules'}
      description={
        step === 1
          ? `For ${cohort.code} — every enrolled student sees it with the due date.`
          : 'Optional brief attachment, and what students are allowed to hand in.'
      }
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={next}>Continue</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={create}>Create assignment</Button>
          </>
        )
      }
    >
      {failure && (
        <Alert tone="danger" title="Not created" className="mb-4">
          {failure}
        </Alert>
      )}

      {step === 1 ? (
        <div className="flex flex-col gap-4">
          <KeyValueList columns={2} className="rounded-xl border border-border bg-surface-sunken px-4">
            <KeyValue label="Course">{course.title}</KeyValue>
            <KeyValue label="Cohort">
              <span className="font-mono">{cohort.code}</span>
            </KeyValue>
          </KeyValueList>

          <Field label="Title" required error={titleError} id="asg-title">
            <Input
              id="asg-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Regression mini-project"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Due date" required error={dueError} id="asg-due">
              <Input
                id="asg-due"
                type="date"
                min={TODAY}
                value={dueDate}
                leftIcon={<Calendar size={14} />}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </Field>
            <Field label="Total marks" required id="asg-marks">
              <Select
                id="asg-marks"
                value={maxScore}
                options={MARK_OPTIONS}
                leftIcon={<Target size={14} />}
                onChange={(e) => setMaxScore(e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Lesson"
            required
            error={lessonError}
            hint="An assignment hangs off a lesson in the course outline, so students find it where they are working."
            id="asg-lesson"
          >
            <Select
              id="asg-lesson"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              options={lessonOptions.map((l) => ({
                value: l.id,
                label: `${l.sequence}. ${l.title}${l.type === 'content' ? '' : ` (${l.type})`}`,
              }))}
            />
          </Field>

          <Field label="Description" hint="What the student has to do, and what good looks like." id="asg-brief">
            <Textarea
              id="asg-brief"
              rows={4}
              maxLength={800}
              showCount
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Take the supplied sales dataset, fit a regression and explain in one page what the owner should do differently."
            />
          </Field>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            label="Brief attachment"
            optional
            hint="No files are stored in this prototype — the name is recorded on the assignment."
            id="asg-file"
          >
            <Input
              id="asg-file"
              value={attachment}
              leftIcon={<FileText size={14} />}
              onChange={(e) => setAttachment(e.target.value)}
              placeholder="regression-brief.pdf"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Accepted formats"
              required
              hint="Comma separated. Anything else is refused at submission."
              id="asg-formats"
            >
              <Input
                id="asg-formats"
                value={acceptedFormats}
                onChange={(e) => setAcceptedFormats(e.target.value)}
                placeholder="pdf, xlsx, csv"
              />
            </Field>
            <Field label="Maximum file size" required id="asg-size">
              <Input
                id="asg-size"
                type="number"
                min={1}
                max={200}
                value={maxFileSizeMb}
                suffix="MB"
                onChange={(e) => setMaxFileSizeMb(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Late work" required id="asg-late">
            <Select
              id="asg-late"
              value={latePolicy}
              onChange={(e) => setLatePolicy(e.target.value as Assignment['latePolicy'])}
              options={LATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </Field>

          {latePolicy === 'accept_with_penalty' && (
            <Field
              label="Penalty"
              required
              hint="Applied by the policy, not by you — mark the work on its merits."
              id="asg-penalty"
            >
              <Input
                id="asg-penalty"
                type="number"
                min={1}
                max={100}
                value={latePenalty}
                suffix="%"
                onChange={(e) => setLatePenalty(e.target.value)}
              />
            </Field>
          )}

          <p className="flex items-start gap-2 rounded-xl border border-border bg-surface-sunken p-3 text-body-12 text-text-secondary">
            <Upload size={14} className="mt-0.5 shrink-0" />
            Grading is holistic: one score out of {maxScore} and written feedback, matching how this
            assignment is being set. Courses that publish a rubric grade per criterion instead.
          </p>
        </div>
      )}
    </Modal>
  )
}
