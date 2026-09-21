import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Copy, Eye, Archive, Plus, Trash2 } from 'lucide-react'

import { formatNaira } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  CurrencyInput,
  Field,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  Select,
  SkeletonCard,
  StatusBadge,
  Textarea,
  UnitTag,
} from '@/ui'
import {
  CURRENT_USER_ID,
  coursesCollection,
  enrollmentsCollection,
  lessonsCollection,
  unitsCollection,
  useCollection,
  useRecord,
  type Course,
  type CourseLevel,
  type CourseStatus,
  type Mode,
} from '@/mocks'

import { BuilderShell } from './BuilderShell'
import {
  Screen,
  ScreenError,
  learnToast,
  nowIso,
  unitTagOf,
  useAutosaveStamp,
  useScreenError,
  useScreenLoading,
} from './common'

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'on_campus', label: 'On campus' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
]

export default function CourseBuilder() {
  const { courseId = '' } = useParams()
  const loading = useScreenLoading(`learn:builder:${courseId}`)
  const { errored, retry } = useScreenError()

  return (
    <Screen nav={false} bare>
      {errored ? (
        <div className="p-6">
          <ScreenError what="The course builder" onRetry={retry} />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <BuilderShell courseId={courseId}>
          <CourseNodeEditor courseId={courseId} />
        </BuilderShell>
      )}
    </Screen>
  )
}

function CourseNodeEditor({ courseId }: { courseId: string }) {
  const navigate = useNavigate()
  const course = useRecord(coursesCollection, courseId)
  const courses = useCollection(coursesCollection)
  const units = useCollection(unitsCollection)
  const lessons = useCollection(lessonsCollection).filter((l) => l.courseId === courseId)
  const enrollments = useCollection(enrollmentsCollection).filter((e) => e.courseId === courseId)
  const [stamp, markSaved] = useAutosaveStamp()
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [titleError, setTitleError] = useState<string | null>(null)

  const [outcomeDraft, setOutcomeDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')

  useEffect(() => {
    setTitleError(null)
  }, [courseId])

  if (!course) return null

  function patch(delta: Partial<Course>) {
    coursesCollection.update(courseId, { ...delta, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
    markSaved()
  }

  const previewEnrolment = enrollments.find((e) => e.status === 'active') ?? enrollments[0]

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-heading-20">Course</h1>
          <StatusBadge status={course.status} />
          {stamp && <span className="text-body-12 text-text-muted">Saved {stamp}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Eye size={14} />}
            disabled={!previewEnrolment}
            onClick={() => previewEnrolment && navigate(`/learn/student/${previewEnrolment.id}`)}
          >
            Preview as learner
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Copy size={14} />}
            onClick={() =>
              learnToast.info(
                'Duplicate is not wired in this prototype',
                'It would copy the outline and leave every content asset unattached.',
              )
            }
          >
            Duplicate
          </Button>
          <Button
            size="sm"
            variant="secondary"
            leftIcon={<Archive size={14} />}
            onClick={() => setConfirmArchive(true)}
          >
            Archive
          </Button>
        </div>
      </div>

      {course.status === 'archived' && (
        <Alert tone="warning" title="This course is archived" className="mb-4">
          Archived courses keep every enrolment, certificate and content asset. Nothing was deleted.
        </Alert>
      )}

      <Card>
        <CardHeader title="Identity" />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
            <Field label="Title" required error={titleError} id="course-title">
              <Input
                id="course-title"
                value={course.title}
                invalid={Boolean(titleError)}
                onChange={(e) => {
                  const value = e.target.value
                  setTitleError(value.trim() ? null : 'A course needs a title.')
                  if (value.trim()) patch({ title: value })
                  else coursesCollection.update(courseId, { title: value })
                }}
              />
            </Field>
            <Field label="Code" required id="course-code" hint="Shown on certificates">
              <Input
                id="course-code"
                value={course.code}
                className="font-mono"
                onChange={(e) => patch({ code: e.target.value.toUpperCase() })}
              />
            </Field>
          </div>

          <Field label="Summary" id="course-summary" hint="One line. Appears in the catalogue and the command palette.">
            <Input id="course-summary" value={course.summary} onChange={(e) => patch({ summary: e.target.value })} />
          </Field>

          <Field label="Long description" id="course-description">
            <Textarea
              id="course-description"
              rows={5}
              value={course.description}
              showCount
              maxLength={1200}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Unit" required id="course-unit">
              <Select
                id="course-unit"
                value={course.unitId}
                onChange={(e) => patch({ unitId: e.target.value as Course['unitId'] })}
                options={units.map((u) => ({ value: u.id, label: u.name }))}
              />
            </Field>
            <Field label="Level" id="course-level">
              <Select
                id="course-level"
                value={course.level}
                onChange={(e) => patch({ level: e.target.value as CourseLevel })}
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                  { value: 'advanced', label: 'Advanced' },
                ]}
              />
            </Field>
            <Field label="Duration (weeks)" id="course-weeks">
              <Input
                id="course-weeks"
                type="number"
                min={1}
                max={104}
                value={course.durationWeeks}
                onChange={(e) => patch({ durationWeeks: Number(e.target.value) || 1 })}
              />
            </Field>
          </div>

          <Field label="Delivery modes" hint="At least one. Learners see this in the catalogue.">
            <div className="flex flex-wrap gap-4">
              {MODES.map((mode) => (
                <Checkbox
                  key={mode.value}
                  label={mode.label}
                  checked={course.modes.includes(mode.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...course.modes, mode.value]
                      : course.modes.filter((m) => m !== mode.value)
                    patch({ modes: next.length ? next : course.modes })
                  }}
                />
              ))}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="List price" required id="course-price" hint={`Currently ${formatNaira(course.listPrice, { decimals: true })}`}>
              <CurrencyInput
                id="course-price"
                value={course.listPrice}
                onChange={(kobo) => patch({ listPrice: (kobo ?? 0) as Course['listPrice'] })}
              />
            </Field>
            <Field label="Cover image" id="course-cover" hint="No real media in this prototype — the path is stored, nothing is uploaded.">
              <Input
                id="course-cover"
                value={course.coverImageUrl}
                onChange={(e) => patch({ coverImageUrl: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Status" id="course-status">
            <Select
              id="course-status"
              value={course.status}
              onChange={(e) => patch({ status: e.target.value as CourseStatus })}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </Field>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Learning outcomes" description="What a graduate can do that they could not do before." />
        <CardBody className="space-y-2">
          {course.learningOutcomes.length === 0 && (
            <p className="text-body-13 text-text-secondary">
              No outcomes yet. Without them the course page has nothing to promise.
            </p>
          )}
          <ul className="space-y-2">
            {course.learningOutcomes.map((outcome, i) => (
              <li key={`${outcome}-${i}`} className="flex items-center gap-2">
                <Input
                  aria-label={`Learning outcome ${i + 1}`}
                  value={outcome}
                  containerClassName="flex-1"
                  onChange={(e) => {
                    const next = [...course.learningOutcomes]
                    next[i] = e.target.value
                    patch({ learningOutcomes: next })
                  }}
                />
                <IconButton
                  icon={Trash2}
                  label={`Remove outcome ${i + 1}`}
                  variant="ghost"
                  onClick={() =>
                    patch({ learningOutcomes: course.learningOutcomes.filter((_, idx) => idx !== i) })
                  }
                />
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <Input
              aria-label="New learning outcome"
              placeholder="Add an outcome"
              value={outcomeDraft}
              containerClassName="flex-1"
              onChange={(e) => setOutcomeDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && outcomeDraft.trim()) {
                  patch({ learningOutcomes: [...course.learningOutcomes, outcomeDraft.trim()] })
                  setOutcomeDraft('')
                }
              }}
            />
            <Button
              variant="secondary"
              leftIcon={<Plus size={14} />}
              disabled={!outcomeDraft.trim()}
              onClick={() => {
                patch({ learningOutcomes: [...course.learningOutcomes, outcomeDraft.trim()] })
                setOutcomeDraft('')
              }}
            >
              Add
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="Prerequisites and tags" />
        <CardBody className="space-y-4">
          <Field label="Prerequisite courses" hint="A learner cannot enrol without these.">
            <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-xl border border-border p-3">
              {courses
                .filter((c) => c.id !== course.id)
                .map((c) => (
                  <Checkbox
                    key={c.id}
                    label={`${c.code} — ${c.title}`}
                    checked={course.prerequisiteCourseIds.includes(c.id)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...course.prerequisiteCourseIds, c.id]
                        : course.prerequisiteCourseIds.filter((id) => id !== c.id)
                      patch({ prerequisiteCourseIds: next })
                    }}
                  />
                ))}
            </div>
          </Field>

          <Field label="Tags">
            <div className="flex flex-wrap items-center gap-1.5">
              {course.tags.map((tag) => (
                <Badge key={tag} tone="neutral" size="md">
                  <span className="flex items-center gap-1">
                    {tag}
                    <button
                      type="button"
                      aria-label={`Remove tag ${tag}`}
                      className="rounded-full px-0.5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      onClick={() => patch({ tags: course.tags.filter((t) => t !== tag) })}
                    >
                      ×
                    </button>
                  </span>
                </Badge>
              ))}
              <Input
                aria-label="Add tag"
                inputSize="sm"
                placeholder="Add tag"
                value={tagDraft}
                containerClassName="w-40"
                onChange={(e) => setTagDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tagDraft.trim()) {
                    patch({ tags: [...new Set([...course.tags, tagDraft.trim().toLowerCase()])] })
                    setTagDraft('')
                  }
                }}
              />
            </div>
          </Field>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Certificate eligibility"
          description="Configured as data, never in code. Edit the full rule set and test it against a real student."
          actions={
            <Button size="sm" variant="secondary" onClick={() => navigate(`/learn/courses/${course.id}/certificate`)}>
              Edit rules
            </Button>
          }
        />
        <CardBody>
          <KeyValueList columns={2}>
            <KeyValue label="Attendance threshold">
              {course.certificateRules.attendanceThreshold === null
                ? 'Not required'
                : `${course.certificateRules.attendanceThreshold}%`}
            </KeyValue>
            <KeyValue label="Content completion">
              {course.certificateRules.contentCompletionThreshold === null
                ? 'Not required'
                : `${course.certificateRules.contentCompletionThreshold}%`}
            </KeyValue>
            <KeyValue label="Project">
              {course.certificateRules.projectRequired
                ? `Required · minimum ${course.certificateRules.projectMinimumGrade ?? 60}%`
                : 'Not required'}
            </KeyValue>
            <KeyValue label="Final assessment">
              {course.certificateRules.finalAssessmentRequired
                ? `Required · pass mark ${course.certificateRules.finalAssessmentPassMark ?? 60}%`
                : 'Not required'}
            </KeyValue>
            <KeyValue label="Financial clearance">
              {course.certificateRules.financialClearanceRequired ? (
                <Badge tone="warning" size="sm">
                  Required
                </Badge>
              ) : (
                'Not required'
              )}
            </KeyValue>
            <KeyValue label="Issue mode">
              {course.certificateRules.autoIssue ? 'Auto-issue on eligibility' : 'Manual issue'}
            </KeyValue>
          </KeyValueList>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader title="At a glance" />
        <CardBody>
          <KeyValueList columns={2}>
            <KeyValue label="Unit">
              {unitTagOf(course.unitId) ? <UnitTag unit={unitTagOf(course.unitId)!} size="sm" /> : '—'}
            </KeyValue>
            <KeyValue label="Lessons">{lessons.length}</KeyValue>
            <KeyValue label="Enrolments">{enrollments.length}</KeyValue>
            <KeyValue label="Completion rate">{course.stats.completionRate}%</KeyValue>
          </KeyValueList>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this course?"
        confirmLabel="Archive course"
        destructive
        onConfirm={() => {
          patch({ status: 'archived', archivedAt: nowIso(), archivedReason: 'Archived from the course builder' })
          setConfirmArchive(false)
          learnToast.success('Course archived', 'Nothing was deleted. Enrolments and certificates are intact.')
        }}
      >
        <p className="text-body-13 text-text-secondary">
          {course.title} leaves the catalogue and no new enrolments can be taken. The {enrollments.length}{' '}
          existing enrolments, their progress, their submissions and any issued certificates all remain. This
          is a status change, not a deletion — the course stays visible with an Archived badge.
        </p>
      </ConfirmDialog>
    </div>
  )
}
