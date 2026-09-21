/**
 * Quizzes — `/learn/quizzes` and `/learn/quizzes/:quizId`.
 *
 * List, then a three-pane builder: question list, question editor, settings.
 * Preview renders the quiz exactly as a learner meets it.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  FileQuestion,
  Plus,
  Trash2,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  IconButton,
  Input,
  Modal,
  PageHeader,
  Radio,
  RadioGroup,
  Select,
  SkeletonTable,
  StatusBadge,
  Switch,
  Textarea,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  coursesCollection,
  courseModulesCollection,
  lessonsCollection,
  quizzesCollection,
  useCollection,
  useRecord,
  type Quiz,
} from '@/mocks'

import { Screen, ScreenError, learnToast, nowIso, useScreenError, useScreenLoading } from './common'
import { createQuiz, modulesOf } from './writes'
import type { CourseModuleId } from '@/mocks'

type Question = Quiz['questions'][number]

export default function Quizzes() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:quizzes')
  const { errored, retry } = useScreenError()
  const quizzes = useCollection(quizzesCollection)
  const courses = useCollection(coursesCollection)
  const lessons = useCollection(lessonsCollection)
  const modules = useCollection(courseModulesCollection)

  const [creating, setCreating] = useState(false)

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const course = params.get('course') ?? undefined

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return quizzes.filter((quiz) => {
      if (course && quiz.courseId !== course) return false
      if (q && !quiz.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [quizzes, search, course])

  const columns: Array<Column<Quiz>> = [
    {
      key: 'title',
      header: 'Quiz',
      minWidth: 220,
      pinned: true,
      cell: (q) => <span className="text-body-13 font-medium text-text">{q.title}</span>,
      sortValue: (q) => q.title,
    },
    {
      key: 'course',
      header: 'Course',
      width: 180,
      accessor: (q) => courses.find((c) => c.id === q.courseId)?.title ?? '—',
      sortValue: (q) => q.courseId,
    },
    {
      key: 'module',
      header: 'Module',
      width: 160,
      accessor: (q) => {
        const lesson = lessons.find((l) => l.id === q.lessonId)
        return modules.find((m) => m.id === lesson?.moduleId)?.title ?? '—'
      },
    },
    {
      key: 'questions',
      header: 'Questions',
      align: 'right',
      width: 100,
      accessor: (q) => q.questions.length,
      sortValue: (q) => q.questions.length,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      width: 100,
      accessor: (q) => formatNumber(q.stats.attempts),
      sortValue: (q) => q.stats.attempts,
    },
    { key: 'passMark', header: 'Pass mark', align: 'right', width: 100, accessor: (q) => `${q.passMark}%`, sortValue: (q) => q.passMark },
    {
      key: 'passRate',
      header: 'Pass rate',
      align: 'right',
      width: 100,
      cell: (q) => (
        <span className={cn('tabular-nums', q.stats.passRate < q.passMark ? 'text-danger-text' : 'text-text')}>
          {q.stats.passRate}%
        </span>
      ),
      sortValue: (q) => q.stats.passRate,
    },
    { key: 'averageScore', header: 'Average', align: 'right', width: 96, accessor: (q) => `${q.stats.averageScore}%`, sortValue: (q) => q.stats.averageScore },
    { key: 'averageMinutes', header: 'Average time', align: 'right', width: 120, accessor: (q) => `${q.stats.averageMinutes} min`, sortValue: (q) => q.stats.averageMinutes },
    { key: 'status', header: 'Status', width: 110, cell: (q) => <StatusBadge status={q.status} />, sortValue: (q) => q.status },
  ]

  return (
    <Screen wide>
      <PageHeader
        title="Quizzes"
        description="Knowledge checks inside the course outline. Each one sits on a lesson."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New quiz
          </Button>
        }
      />

      {errored ? (
        <div className="mt-4">
          <ScreenError what="Quizzes" onRetry={retry} />
        </div>
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <div className="px-4 pt-4">
              <FilterBar
                search={search}
                onSearchChange={(v) => {
                  const next = new URLSearchParams(params)
                  if (v) next.set('q', v)
                  else next.delete('q')
                  setParams(next, { replace: true })
                }}
                searchPlaceholder="Search quizzes"
                values={{ course }}
                onFilterChange={(key, value) => {
                  const next = new URLSearchParams(params)
                  if (value) next.set(key, value)
                  else next.delete(key)
                  setParams(next, { replace: true })
                }}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  {
                    key: 'course',
                    label: 'Course',
                    width: 200,
                    options: courses.map((c) => ({ value: c.id, label: c.title })),
                  },
                ]}
              />
            </div>

            {loading ? (
              <div className="p-4">
                <SkeletonTable rows={6} columns={8} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={FileQuestion}
                  title={search || course ? 'No quizzes match these filters' : 'No quizzes yet'}
                  variant={search || course ? 'search' : 'default'}
                  message={
                    search || course
                      ? 'Try a different course or clear the search.'
                      : 'Without a knowledge check there is no signal that a module landed before the assignment is due.'
                  }
                  action={
                    search || course ? (
                      <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                        Clear filters
                      </Button>
                    ) : (
                      <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
                        New quiz
                      </Button>
                    )
                  }
                />
              </div>
            ) : (
              <DataTable
                data={filtered}
                columns={columns}
                rowKey={(q) => q.id}
                density="compact"
                caption="Quizzes"
                onRowClick={(q) => navigate(`/learn/quizzes/${q.id}`)}
                defaultSort={{ key: 'title', direction: 'asc' }}
              />
            )}
          </CardBody>
        </Card>
      )}

      <NewQuizModal open={creating} onClose={() => setCreating(false)} />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* New quiz                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * A quiz is not a free-floating record in this model — it is a `quiz`-type
 * lesson plus a `Quiz`. So the modal asks where in the outline it goes, then
 * writes both and drops the caller into the question editor, because a quiz
 * with no questions passes everybody.
 */
function NewQuizModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const courses = useCollection(coursesCollection)
  useCollection(courseModulesCollection)

  const [courseId, setCourseId] = useState('')
  const [moduleId, setModuleId] = useState('')
  const [title, setTitle] = useState('')
  const [passMark, setPassMark] = useState(70)
  const [attempts, setAttempts] = useState(2)
  const [timeLimit, setTimeLimit] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)

  const modules = courseId ? modulesOf(courseId) : []
  const courseHasNoModules = Boolean(courseId) && modules.length === 0

  const courseError = touched && !courseId ? 'Choose the course this quiz belongs to.' : undefined
  const moduleError =
    touched && courseId && !moduleId && !courseHasNoModules ? 'Choose the module it sits in.' : undefined
  const titleError = touched && !title.trim() ? 'Name the quiz — learners see this.' : undefined

  function reset() {
    setCourseId('')
    setModuleId('')
    setTitle('')
    setPassMark(70)
    setAttempts(2)
    setTimeLimit(null)
    setTouched(false)
  }

  function submit() {
    setTouched(true)
    if (!courseId || !moduleId || !title.trim()) return

    const { quiz } = createQuiz({
      courseId,
      moduleId: moduleId as CourseModuleId,
      title,
      passMark,
      attemptsAllowed: attempts,
      timeLimitMinutes: timeLimit,
    })

    learnToast.success(
      `${quiz.title} created as a draft`,
      'It now appears in the course outline as a quiz lesson. Add questions before publishing.',
    )
    reset()
    onClose()
    navigate(`/learn/quizzes/${quiz.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New quiz"
      description="Quizzes live inside the outline, so this also creates the lesson that holds it."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={courseHasNoModules}>
            Create and add questions
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Course" required error={courseError} id="quiz-course">
          <Select
            id="quiz-course"
            value={courseId}
            invalid={Boolean(courseError)}
            placeholder="Choose a course"
            options={courses.map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
            onChange={(e) => {
              setCourseId(e.target.value)
              setModuleId('')
            }}
          />
        </Field>

        {courseHasNoModules ? (
          <Alert tone="warning" title="This course has no modules yet">
            A quiz needs somewhere in the outline to live.{' '}
            <Button variant="link" onClick={() => navigate(`/learn/courses/${courseId}/builder`)}>
              Add the first module in the builder
            </Button>
          </Alert>
        ) : (
          <Field label="Module" required error={moduleError} id="quiz-module">
            <Select
              id="quiz-module"
              value={moduleId}
              invalid={Boolean(moduleError)}
              disabled={!courseId}
              placeholder={courseId ? 'Choose a module' : 'Choose a course first'}
              options={modules.map((m) => ({ value: m.id, label: `${m.sequence}. ${m.title}` }))}
              onChange={(e) => setModuleId(e.target.value)}
            />
          </Field>
        )}

        <Field label="Title" required error={titleError} id="quiz-title">
          <Input
            id="quiz-title"
            value={title}
            invalid={Boolean(titleError)}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Joins and aggregation check"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Pass mark" id="quiz-new-pass">
            <Input
              id="quiz-new-pass"
              type="number"
              min={0}
              max={100}
              suffix="%"
              value={passMark}
              onChange={(e) => setPassMark(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            />
          </Field>
          <Field label="Attempts allowed" id="quiz-new-attempts">
            <Input
              id="quiz-new-attempts"
              type="number"
              min={1}
              value={attempts}
              onChange={(e) => setAttempts(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="Time limit" hint="Blank means untimed." id="quiz-new-time">
            <Input
              id="quiz-new-time"
              type="number"
              min={0}
              suffix="min"
              value={timeLimit ?? ''}
              onChange={(e) => setTimeLimit(e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

export function QuizBuilder() {
  const { quizId = '' } = useParams()
  const navigate = useNavigate()
  const loading = useScreenLoading(`learn:quiz:${quizId}`)
  const { errored, retry } = useScreenError()
  const quiz = useRecord(quizzesCollection, quizId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (errored) {
    return (
      <Screen>
        <ScreenError what="This quiz" onRetry={retry} />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <SkeletonTable rows={8} columns={3} />
      </Screen>
    )
  }

  if (!quiz) {
    return (
      <Screen>
        <Alert tone="danger" title="Quiz not found">
          This quiz has been archived or never existed.{' '}
          <Button variant="link" onClick={() => navigate('/learn/quizzes')}>
            Back to quizzes
          </Button>
        </Alert>
      </Screen>
    )
  }

  const questions = [...quiz.questions].sort((a, b) => a.sequence - b.sequence)
  const selected = questions.find((q) => q.id === selectedId) ?? questions[0]

  function patchQuiz(delta: Partial<Quiz>) {
    quizzesCollection.update(quiz!.id, { ...delta, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
  }

  function patchQuestion(id: string, delta: Partial<Question>) {
    patchQuiz({ questions: quiz!.questions.map((q) => (q.id === id ? { ...q, ...delta } : q)) })
  }

  function addQuestion() {
    const id = `q-${Date.now().toString(36)}`
    patchQuiz({
      questions: [
        ...quiz!.questions,
        {
          id,
          sequence: questions.length + 1,
          type: 'multiple_choice',
          stem: 'New question',
          points: 5,
          explanation: '',
          options: [
            { id: 'a', text: 'Option A', correct: true },
            { id: 'b', text: 'Option B', correct: false },
          ],
        },
      ],
    })
    setSelectedId(id)
  }

  function move(question: Question, direction: -1 | 1) {
    const idx = questions.findIndex((q) => q.id === question.id)
    const swap = questions[idx + direction]
    if (!swap) return
    patchQuiz({
      questions: quiz!.questions.map((q) =>
        q.id === question.id ? { ...q, sequence: swap.sequence } : q.id === swap.id ? { ...q, sequence: question.sequence } : q,
      ),
    })
  }

  const totalPoints = questions.reduce((acc, q) => acc + q.points, 0)

  return (
    <Screen wide>
      <PageHeader
        title={quiz.title}
        description={`${questions.length} questions · ${totalPoints} points · pass mark ${quiz.passMark}%`}
        breadcrumbs={[
          { label: 'Cirvee Learn', to: '/learn' },
          { label: 'Quizzes', to: '/learn/quizzes' },
          { label: quiz.title },
        ]}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Eye size={16} />} onClick={() => setPreviewOpen(true)}>
              Preview
            </Button>
            <Button
              onClick={() => {
                patchQuiz({ status: quiz.status === 'published' ? 'draft' : 'published' })
                learnToast.success(quiz.status === 'published' ? 'Quiz unpublished' : 'Quiz published')
              }}
            >
              {quiz.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <Card className="h-fit">
          <CardHeader bare title="Questions" />
          <CardBody padding="none">
            <ul className="divide-y divide-border">
              {questions.map((q, i) => (
                <li key={q.id} className="group flex items-center gap-1 px-2 py-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedId(q.id)}
                    className={cn(
                      'min-w-0 flex-1 rounded-lg px-2 py-1 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      selected?.id === q.id ? 'bg-accent-subtle text-accent' : 'hover:bg-surface-hover',
                    )}
                  >
                    <span className="block truncate text-body-12">
                      {i + 1}. {q.stem}
                    </span>
                    <span className="block text-body-12 text-text-muted">
                      {humanize(q.type)} · {q.points} pts
                    </span>
                  </button>
                  <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    <IconButton icon={ArrowUp} label={`Move question ${i + 1} up`} size="sm" variant="ghost" disabled={i === 0} onClick={() => move(q, -1)} />
                    <IconButton icon={ArrowDown} label={`Move question ${i + 1} down`} size="sm" variant="ghost" disabled={i === questions.length - 1} onClick={() => move(q, 1)} />
                  </span>
                </li>
              ))}
            </ul>
            <div className="p-2">
              <Button size="sm" variant="ghost" fullWidth className="justify-start" leftIcon={<Plus size={14} />} onClick={addQuestion}>
                Add question
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card>
          {!selected ? (
            <CardBody>
              <EmptyState
                icon={FileQuestion}
                title="This quiz has no questions"
                message="A published quiz with no questions passes everyone. Add the first one."
                action={<Button onClick={addQuestion}>Add question</Button>}
              />
            </CardBody>
          ) : (
            <>
              <CardHeader
                title="Question"
                actions={
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<Copy size={14} />}
                      onClick={() => {
                        const id = `q-${Date.now().toString(36)}`
                        patchQuiz({
                          questions: [...quiz.questions, { ...selected, id, sequence: questions.length + 1 }],
                        })
                        setSelectedId(id)
                      }}
                    >
                      Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" leftIcon={<Trash2 size={14} />} onClick={() => setConfirmDelete(selected.id)}>
                      Archive
                    </Button>
                  </div>
                }
              />
              <CardBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <Field label="Type" id="question-type">
                    <Select
                      id="question-type"
                      value={selected.type}
                      onChange={(e) => patchQuestion(selected.id, { type: e.target.value as Question['type'] })}
                      options={[
                        { value: 'multiple_choice', label: 'Multiple choice' },
                        { value: 'multiple_select', label: 'Multiple select' },
                        { value: 'true_false', label: 'True / false' },
                        { value: 'short_answer', label: 'Short answer' },
                        { value: 'numeric', label: 'Numeric' },
                      ]}
                    />
                  </Field>
                  <Field label="Points" id="question-points">
                    <Input
                      id="question-points"
                      type="number"
                      min={1}
                      value={selected.points}
                      onChange={(e) => patchQuestion(selected.id, { points: Number(e.target.value) || 1 })}
                    />
                  </Field>
                </div>

                <Field label="Stem" id="question-stem" required>
                  <Textarea
                    id="question-stem"
                    rows={3}
                    value={selected.stem}
                    onChange={(e) => patchQuestion(selected.id, { stem: e.target.value })}
                  />
                </Field>

                {selected.options.length > 0 && (
                  <Field label="Options" hint="Mark the correct answer.">
                    <ul className="space-y-2">
                      {selected.options.map((option, i) => (
                        <li key={option.id} className="flex items-center gap-2">
                          <input
                            type={selected.type === 'multiple_select' ? 'checkbox' : 'radio'}
                            name={`correct-${selected.id}`}
                            checked={option.correct}
                            aria-label={`Mark option ${i + 1} correct`}
                            className="size-4 accent-[currentColor] text-accent"
                            onChange={(e) =>
                              patchQuestion(selected.id, {
                                options: selected.options.map((o) =>
                                  o.id === option.id
                                    ? { ...o, correct: e.target.checked }
                                    : selected.type === 'multiple_select'
                                      ? o
                                      : { ...o, correct: false },
                                ),
                              })
                            }
                          />
                          <Input
                            aria-label={`Option ${i + 1} text`}
                            value={option.text}
                            containerClassName="flex-1"
                            onChange={(e) =>
                              patchQuestion(selected.id, {
                                options: selected.options.map((o) =>
                                  o.id === option.id ? { ...o, text: e.target.value } : o,
                                ),
                              })
                            }
                          />
                          <IconButton
                            icon={Trash2}
                            label={`Remove option ${i + 1}`}
                            variant="ghost"
                            onClick={() =>
                              patchQuestion(selected.id, {
                                options: selected.options.filter((o) => o.id !== option.id),
                              })
                            }
                          />
                        </li>
                      ))}
                    </ul>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2"
                      leftIcon={<Plus size={14} />}
                      onClick={() =>
                        patchQuestion(selected.id, {
                          options: [
                            ...selected.options,
                            { id: `o-${Date.now().toString(36)}`, text: 'New option', correct: false },
                          ],
                        })
                      }
                    >
                      Add option
                    </Button>
                  </Field>
                )}

                <Field label="Explanation" id="question-explanation" hint="Shown after answering, when the settings allow it.">
                  <Textarea
                    id="question-explanation"
                    rows={2}
                    value={selected.explanation}
                    onChange={(e) => patchQuestion(selected.id, { explanation: e.target.value })}
                  />
                </Field>

                <Alert tone="info" title="Optional media">
                  Questions can carry an image or a clip. No media is stored in this prototype.
                </Alert>
              </CardBody>
            </>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader bare title="Settings" />
          <CardBody className="space-y-3">
            <Field label="Pass mark" id="quiz-pass">
              <Input
                id="quiz-pass"
                type="number"
                min={0}
                max={100}
                suffix="%"
                value={quiz.passMark}
                onChange={(e) => patchQuiz({ passMark: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Time limit" id="quiz-time" hint="Blank means untimed.">
              <Input
                id="quiz-time"
                type="number"
                min={0}
                suffix="min"
                value={quiz.timeLimitMinutes ?? ''}
                onChange={(e) => patchQuiz({ timeLimitMinutes: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </Field>
            <Field label="Attempts allowed" id="quiz-attempts">
              <Input
                id="quiz-attempts"
                type="number"
                min={1}
                value={quiz.attemptsAllowed}
                onChange={(e) => patchQuiz({ attemptsAllowed: Number(e.target.value) || 1 })}
              />
            </Field>
            <Switch
              checked={quiz.randomiseQuestions}
              onChange={(on) => patchQuiz({ randomiseQuestions: on })}
              label="Randomise questions"
            />
            <Switch
              checked={quiz.randomiseAnswers}
              onChange={(on) => patchQuiz({ randomiseAnswers: on })}
              label="Randomise answers"
            />
            <Field label="Show answers" id="quiz-answers">
              <Select
                id="quiz-answers"
                value={quiz.showAnswersAfter}
                onChange={(e) => patchQuiz({ showAnswersAfter: e.target.value as Quiz['showAnswersAfter'] })}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'after_submission', label: 'After submission' },
                  { value: 'after_due_date', label: 'After the due date' },
                ]}
              />
            </Field>
            <div className="rounded-xl border border-border bg-surface-sunken p-3">
              <div className="text-label-11 text-text-label">Live stats</div>
              <dl className="mt-1.5 space-y-1 text-body-12">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Attempts</dt>
                  <dd className="tabular-nums text-text">{formatNumber(quiz.stats.attempts)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Pass rate</dt>
                  <dd className="tabular-nums text-text">{quiz.stats.passRate}%</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Average time</dt>
                  <dd className="tabular-nums text-text">{quiz.stats.averageMinutes} min</dd>
                </div>
              </dl>
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={`Preview — ${quiz.title}`}
        description="Exactly what the learner sees. Answers are not recorded."
        size="lg"
        footer={<Button onClick={() => setPreviewOpen(false)}>Close preview</Button>}
      >
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{questions.length} questions</Badge>
            <Badge tone="neutral">{totalPoints} points</Badge>
            <Badge tone="neutral">Pass mark {quiz.passMark}%</Badge>
            {quiz.timeLimitMinutes && <Badge tone="warning">{quiz.timeLimitMinutes} minute limit</Badge>}
          </div>
          {questions.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-border p-4">
              <div className="text-body-12 text-text-muted">
                Question {i + 1} of {questions.length} · {q.points} points
              </div>
              <p className="mt-1 text-body-15 text-text">{q.stem}</p>
              <div className="mt-3">
                {q.options.length > 0 ? (
                  <RadioGroup legend="Choose one">
                    {q.options.map((o) => (
                      <Radio key={o.id} name={`preview-${q.id}`} value={o.id} label={o.text} defaultChecked={false} />
                    ))}
                  </RadioGroup>
                ) : (
                  <Input aria-label={`Answer to question ${i + 1}`} placeholder="Type your answer" readOnly />
                )}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Archive this question?"
        confirmLabel="Archive question"
        destructive
        onConfirm={() => {
          patchQuiz({ questions: quiz.questions.filter((q) => q.id !== confirmDelete) })
          setConfirmDelete(null)
          setSelectedId(null)
          learnToast.info('Question archived', 'Attempts already recorded against it keep their scores.')
        }}
      >
        <p className="text-body-13 text-text-secondary">
          Learners who already answered this question keep their result. The question leaves future attempts
          and the quiz total drops by {selected?.points ?? 0} points.
        </p>
      </ConfirmDialog>
    </Screen>
  )
}
