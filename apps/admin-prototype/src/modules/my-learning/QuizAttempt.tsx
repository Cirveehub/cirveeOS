import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Clock3, FileQuestion, RotateCcw, XCircle } from 'lucide-react'

import { formatDateTime } from '@/lib/format'
import { Alert, Button, Checkbox, EmptyState, Input, KeyValue, KeyValueList, Radio, RadioGroup } from '@/ui'
import {
  quizAttemptsCollection,
  quizzesCollection,
  useCollection,
  type EnrollmentId,
  type PersonId,
  type QuizAttempt as QuizAttemptRecord,
  type QuizQuestion,
} from '@/mocks'

import { Screen, studentToast, useStudent } from './common'
import { submitQuizAttempt, type QuizAnswerInput } from './writes'

export default function QuizAttempt() {
  const { quizId } = useParams<{ quizId: string }>()
  const navigate = useNavigate()
  const { personId, enrolments } = useStudent()

  const quizzes = useCollection(quizzesCollection)
  const attempts = useCollection(quizAttemptsCollection)

  const quiz = quizzes.find((q) => q.id === quizId)
  const enrolment = enrolments.find((e) => e.courseId === quiz?.courseId)

  if (!quiz || !enrolment || !personId) {
    return (
      <Screen>
        <EmptyState
          icon={FileQuestion}
          title="Quiz not found"
          message="This quiz is not on any course you are enrolled on."
          action={
            <Button variant="secondary" onClick={() => navigate('/my-learning/course')}>
              Back to your course
            </Button>
          }
          bordered
        />
      </Screen>
    )
  }

  const mine = attempts
    .filter((a) => a.quizId === quiz.id && a.enrollmentId === enrolment.id)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)

  return (
    <Screen>
      <Attempt quizId={quiz.id} enrollmentId={enrolment.id} personId={personId} attempts={mine} />
    </Screen>
  )
}

function Attempt({
  quizId,
  enrollmentId,
  personId,
  attempts,
}: {
  quizId: string
  enrollmentId: EnrollmentId
  personId: PersonId
  attempts: QuizAttemptRecord[]
}) {
  const quizzes = useCollection(quizzesCollection)
  const quiz = quizzes.find((q) => q.id === quizId)!
  const latest = attempts[0]

  const [taking, setTaking] = useState(false)
  const [answers, setAnswers] = useState<Record<string, { selected: string[]; text: string }>>({})
  const [startedAt] = useState(() => new Date().toISOString())
  const [result, setResult] = useState<typeof latest | null>(null)

  const remaining = quiz.attemptsAllowed - attempts.length
  const outOfAttempts = remaining <= 0

  function setSingle(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { selected: [optionId], text: '' } }))
  }

  function toggleMulti(questionId: string, optionId: string) {
    setAnswers((prev) => {
      const current = prev[questionId]?.selected ?? []
      const next = current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]
      return { ...prev, [questionId]: { selected: next, text: '' } }
    })
  }

  function setText(questionId: string, text: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: { selected: [], text } }))
  }

  function submit() {
    const payload: QuizAnswerInput[] = quiz.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: answers[q.id]?.selected ?? [],
      textAnswer: answers[q.id]?.text ?? '',
    }))

    try {
      const attempt = submitQuizAttempt({
        quizId: quiz.id,
        lessonId: quiz.lessonId,
        enrollmentId,
        personId,
        answers: payload,
        startedAt,
      })
      setResult(attempt)
      setTaking(false)
      studentToast.success(attempt.passed ? 'Quiz passed.' : `Below the ${quiz.passMark}% pass mark.`)
    } catch (error) {
      studentToast.error(error instanceof Error ? error.message : 'The attempt was not saved.')
    }
  }

  const shown = result ?? (!taking ? latest : undefined)

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <p className="text-label-11 text-text-label">Quiz</p>
        <h1 className="mt-1 text-heading-24 text-text">{quiz.title}</h1>
      </header>

      {!taking && (
        <div className="mb-6 rounded-2xl border border-border bg-surface p-5">
          <KeyValueList columns={2}>
            <KeyValue label="Pass mark">{quiz.passMark}%</KeyValue>
            <KeyValue label="Time limit">{quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : 'None'}</KeyValue>
            <KeyValue label="Attempts">
              {attempts.length} of {quiz.attemptsAllowed} used
            </KeyValue>
            <KeyValue label="Questions">{quiz.questions.length}</KeyValue>
          </KeyValueList>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              disabled={outOfAttempts}
              onClick={() => {
                setAnswers({})
                setResult(null)
                setTaking(true)
              }}
            >
              {latest ? 'Try again' : 'Start attempt'}
            </Button>
            {outOfAttempts && (
              <span className="text-body-13 text-text-secondary">
                You have used every attempt allowed for this quiz.
              </span>
            )}
          </div>
        </div>
      )}

      {shown && (
        <ResultCard
          quiz={quiz}
          attempt={shown}
          onRetake={remaining > 0 ? () => setTaking(true) : undefined}
        />
      )}

      {taking && (
        <div className="flex flex-col gap-5">
          {quiz.questions.map((question, i) => (
            <QuestionCard
              key={question.id}
              index={i}
              question={question}
              selected={answers[question.id]?.selected ?? []}
              text={answers[question.id]?.text ?? ''}
              onSelectSingle={(optionId) => setSingle(question.id, optionId)}
              onToggleMulti={(optionId) => toggleMulti(question.id, optionId)}
              onText={(text) => setText(question.id, text)}
            />
          ))}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setTaking(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Submit quiz</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionCard({
  index,
  question,
  selected,
  text,
  onSelectSingle,
  onToggleMulti,
  onText,
}: {
  index: number
  question: QuizQuestion
  selected: string[]
  text: string
  onSelectSingle: (optionId: string) => void
  onToggleMulti: (optionId: string) => void
  onText: (text: string) => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <p className="mb-3 text-body-14 font-semibold text-text">
        {index + 1}. {question.stem}
      </p>

      {question.options.length === 0 ? (
        <Input
          aria-label={`Answer to question ${index + 1}`}
          placeholder="Type your answer"
          value={text}
          onChange={(e) => onText(e.target.value)}
        />
      ) : question.type === 'multiple_select' ? (
        <div className="flex flex-col gap-2">
          {question.options.map((option) => (
            <Checkbox
              key={option.id}
              label={option.text}
              checked={selected.includes(option.id)}
              onChange={() => onToggleMulti(option.id)}
            />
          ))}
        </div>
      ) : (
        <RadioGroup>
          {question.options.map((option) => (
            <Radio
              key={option.id}
              name={`quiz-${question.id}`}
              value={option.id}
              label={option.text}
              checked={selected[0] === option.id}
              onChange={() => onSelectSingle(option.id)}
            />
          ))}
        </RadioGroup>
      )}
    </div>
  )
}

function ResultCard({
  quiz,
  attempt,
  onRetake,
}: {
  quiz: { passMark: number; showAnswersAfter: string; questions: QuizQuestion[] }
  attempt: { scorePercent: number; passed: boolean; needsManualReview: boolean; submittedAt: string; answers: Array<{ questionId: string; correct: boolean | null }> }
  onRetake?: () => void
}) {
  const showAnswers = quiz.showAnswersAfter === 'after_submission'

  return (
    <div className="mb-6 flex flex-col gap-4">
      <Alert tone={attempt.passed ? 'success' : 'warning'} title={`${attempt.scorePercent}% — ${attempt.passed ? 'Passed' : `Below the ${quiz.passMark}% pass mark`}`}>
        <div className="flex flex-col gap-1">
          <span>Submitted {formatDateTime(attempt.submittedAt)}.</span>
          {attempt.needsManualReview && (
            <span className="flex items-center gap-1.5">
              <Clock3 size={13} /> One or more answers need your tutor's review before this score is final.
            </span>
          )}
        </div>
      </Alert>

      {showAnswers && (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="mb-3 text-body-13 font-semibold text-text">Question by question</p>
          <ul className="flex flex-col gap-3">
            {quiz.questions.map((question, i) => {
              const answer = attempt.answers.find((a) => a.questionId === question.id)
              return (
                <li key={question.id} className="flex items-start gap-2">
                  {answer?.correct === true ? (
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success-text" />
                  ) : answer?.correct === false ? (
                    <XCircle size={16} className="mt-0.5 shrink-0 text-danger-text" />
                  ) : (
                    <Clock3 size={16} className="mt-0.5 shrink-0 text-text-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="text-body-13 text-text">
                      {i + 1}. {question.stem}
                    </p>
                    {question.explanation && (
                      <p className="text-body-12 text-text-secondary">{question.explanation}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {onRetake && (
        <Button variant="secondary" leftIcon={<RotateCcw size={14} />} onClick={onRetake}>
          Try again
        </Button>
      )}
    </div>
  )
}
