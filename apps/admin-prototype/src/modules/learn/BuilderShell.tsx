/**
 * The course-builder shell — three panes, shared by `/learn/courses/:id/builder`
 * and the lesson editor beneath it.
 *
 * Left: the outline tree, where every lesson carries five format pills so
 * incompleteness is visible without clicking. Centre: whatever node is
 * selected. Right: the readiness checklist, live-computed, where each unmet
 * item links to the offending lesson.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileQuestion,
  FileText,
  FolderPlus,
  MonitorPlay,
  Pencil,
  Plus,
  Presentation,
  ArrowDown,
  ArrowUp,
  X,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  ConfirmDialog,
  IconButton,
  Input,
  Tooltip,
} from '@/ui'
import {
  CURRENT_USER_ID,
  assignmentsCollection,
  courseModulesCollection,
  coursesCollection,
  lessonsCollection,
  quizzesCollection,
  useCollection,
  useRecord,
  type ContentFormat,
  type Course,
  type CourseModule,
  type Lesson,
  type LessonType,
} from '@/mocks'
import { lessonId as asLessonId, moduleId as asModuleId } from '@/mocks/types'

import { FORMATS, FormatPills, learnToast, nowIso } from './common'

const LESSON_TYPE_ICON: Record<LessonType, typeof FileText> = {
  content: FileText,
  quiz: FileQuestion,
  assignment: ClipboardList,
  project: Presentation,
  live_session: MonitorPlay,
}

const LESSON_TYPE_LABEL: Record<LessonType, string> = {
  content: 'Content',
  quiz: 'Quiz',
  assignment: 'Assignment',
  project: 'Project',
  live_session: 'Live session',
}

export { LESSON_TYPE_ICON, LESSON_TYPE_LABEL }

export interface BuilderShellProps {
  courseId: string
  /** The lesson currently open in the centre pane, if any. */
  selectedLessonId?: string
  children: ReactNode
}

export function BuilderShell({ courseId, selectedLessonId, children }: BuilderShellProps) {
  const course = useRecord(coursesCollection, courseId)
  const modules = useCollection(courseModulesCollection).filter((m) => m.courseId === courseId)
  const lessons = useCollection(lessonsCollection).filter((l) => l.courseId === courseId)

  if (!course) {
    return (
      <div className="p-6">
        <Alert tone="danger" title="Course not found">
          No course with the id <span className="font-mono">{courseId}</span> exists. It may have been archived.
        </Alert>
      </div>
    )
  }

  return (
    <div className="grid min-h-[calc(100vh-7rem)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
      <OutlineTree
        course={course}
        modules={modules}
        lessons={lessons}
        selectedLessonId={selectedLessonId}
      />
      <div className="min-w-0 border-x border-border bg-canvas">{children}</div>
      <ReadinessPanel course={course} lessons={lessons} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Left — outline tree                                                        */
/* -------------------------------------------------------------------------- */

function OutlineTree({
  course,
  modules,
  lessons,
  selectedLessonId,
}: {
  course: Course
  modules: CourseModule[]
  lessons: Lesson[]
  selectedLessonId?: string
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const missingFilter = params.get('missing') as ContentFormat | null
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const ordered = useMemo(() => [...modules].sort((a, b) => a.sequence - b.sequence), [modules])

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startRename(id: string, current: string) {
    setRenaming(id)
    setDraft(current)
  }

  function commitRename(kind: 'module' | 'lesson', id: string) {
    const title = draft.trim()
    if (!title) {
      setRenaming(null)
      return
    }
    if (kind === 'module') courseModulesCollection.update(id, { title, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
    else lessonsCollection.update(id, { title, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
    setRenaming(null)
    learnToast.success('Renamed')
  }

  function moveModule(mod: CourseModule, direction: -1 | 1) {
    const idx = ordered.findIndex((m) => m.id === mod.id)
    const swap = ordered[idx + direction]
    if (!swap) return
    courseModulesCollection.update(mod.id, { sequence: swap.sequence })
    courseModulesCollection.update(swap.id, { sequence: mod.sequence })
  }

  function moveLesson(lesson: Lesson, siblings: Lesson[], direction: -1 | 1) {
    const idx = siblings.findIndex((l) => l.id === lesson.id)
    const swap = siblings[idx + direction]
    if (!swap) return
    lessonsCollection.update(lesson.id, { sequence: swap.sequence })
    lessonsCollection.update(swap.id, { sequence: lesson.sequence })
  }

  function addModule() {
    const sequence = ordered.length + 1
    const id = `mod-${course.id}-${Date.now().toString(36)}`
    courseModulesCollection.insert({
      id: asModuleId(id),
      courseId: course.id,
      sequence,
      title: `Module ${sequence}`,
      summary: '',
      status: 'draft',
      createdAt: nowIso(),
      createdBy: CURRENT_USER_ID,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    })
    learnToast.success('Module added', 'It is a draft until it has lessons.')
  }

  function addLesson(mod: CourseModule) {
    const siblings = lessons.filter((l) => l.moduleId === mod.id)
    const id = `les-${mod.id}-${Date.now().toString(36)}`
    lessonsCollection.insert({
      id: asLessonId(id),
      moduleId: mod.id,
      courseId: course.id,
      sequence: siblings.length + 1,
      title: 'Untitled lesson',
      type: 'content',
      durationMinutes: 30,
      status: 'draft',
      formats: {},
      offlineEnabled: true,
      androidCheck: { passes: false, issues: ['No content uploaded yet'] },
      resources: [],
      quizId: null,
      assignmentId: null,
      createdAt: nowIso(),
      createdBy: CURRENT_USER_ID,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    })
    learnToast.success('Lesson added', 'All five format slots are empty.')
    navigate(`/learn/courses/${course.id}/modules/${mod.id}/lessons/${id}`)
  }

  return (
    <aside className="min-w-0 bg-surface" aria-label="Course outline">
      <div className="sticky top-0 border-b border-border bg-surface px-4 py-3">
        <button
          type="button"
          onClick={() => navigate(`/learn/courses/${course.id}/builder`)}
          className={cn(
            'w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            !selectedLessonId && 'bg-accent-subtle',
          )}
        >
          <div className="truncate text-body-13 font-semibold text-text">{course.title}</div>
          <div className="mt-0.5 font-mono text-body-12 text-text-muted">{course.code}</div>
        </button>
        {missingFilter && (
          <div className="mt-2">
            <Badge tone="danger" size="sm">
              Highlighting lessons missing {FORMATS.find((f) => f.format === missingFilter)?.label}
            </Badge>
          </div>
        )}
      </div>

      <div className="px-2 py-2">
        {ordered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong p-4 text-center">
            <p className="text-body-13 font-medium text-text">Add your first module</p>
            <p className="mt-1 text-body-12 text-text-secondary">
              A course needs at least one module before a lesson can exist.
            </p>
            <Button size="sm" className="mt-3" leftIcon={<FolderPlus size={14} />} onClick={addModule}>
              Add module
            </Button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {ordered.map((mod, mi) => {
              const siblings = lessons
                .filter((l) => l.moduleId === mod.id)
                .sort((a, b) => a.sequence - b.sequence)
              const open = !collapsed.has(mod.id)
              return (
                <li key={mod.id}>
                  <div className="group flex items-center gap-1 rounded-lg px-1 py-1 hover:bg-surface-hover">
                    <button
                      type="button"
                      onClick={() => toggle(mod.id)}
                      aria-expanded={open}
                      aria-label={open ? `Collapse ${mod.title}` : `Expand ${mod.title}`}
                      className="grid size-5 shrink-0 place-items-center rounded text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {renaming === mod.id ? (
                      <RenameField
                        value={draft}
                        onChange={setDraft}
                        onCommit={() => commitRename('module', mod.id)}
                        onCancel={() => setRenaming(null)}
                        label={`Rename ${mod.title}`}
                      />
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-body-13 font-medium text-text">
                          {mi + 1}. {mod.title}
                        </span>
                        <span className="shrink-0 text-body-12 text-text-muted">{siblings.length}</span>
                        <span className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <IconButton
                            icon={ArrowUp}
                            label={`Move ${mod.title} up`}
                            size="sm"
                            variant="ghost"
                            disabled={mi === 0}
                            onClick={() => moveModule(mod, -1)}
                          />
                          <IconButton
                            icon={ArrowDown}
                            label={`Move ${mod.title} down`}
                            size="sm"
                            variant="ghost"
                            disabled={mi === ordered.length - 1}
                            onClick={() => moveModule(mod, 1)}
                          />
                          <IconButton
                            icon={Pencil}
                            label={`Rename ${mod.title}`}
                            size="sm"
                            variant="ghost"
                            onClick={() => startRename(mod.id, mod.title)}
                          />
                        </span>
                      </>
                    )}
                  </div>

                  {open && (
                    <ul className="ml-4 border-l border-border pl-1">
                      {siblings.map((lesson, li) => {
                        const Icon = LESSON_TYPE_ICON[lesson.type]
                        const flagged =
                          missingFilter !== null &&
                          lesson.type === 'content' &&
                          lesson.formats[missingFilter] === undefined
                        const active = lesson.id === selectedLessonId
                        return (
                          <li key={lesson.id} className="group/lesson">
                            <div
                              className={cn(
                                'flex items-center gap-1 rounded-lg px-1.5 py-1',
                                active ? 'bg-accent-subtle' : 'hover:bg-surface-hover',
                                flagged && !active && 'bg-danger-fill',
                              )}
                            >
                              {renaming === lesson.id ? (
                                <RenameField
                                  value={draft}
                                  onChange={setDraft}
                                  onCommit={() => commitRename('lesson', lesson.id)}
                                  onCancel={() => setRenaming(null)}
                                  label={`Rename ${lesson.title}`}
                                />
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(
                                        `/learn/courses/${course.id}/modules/${mod.id}/lessons/${lesson.id}`,
                                      )
                                    }
                                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                                  >
                                    <Icon
                                      size={13}
                                      className={cn(
                                        'shrink-0',
                                        flagged ? 'text-danger-ink' : active ? 'text-accent' : 'text-text-muted',
                                      )}
                                    />
                                    <span
                                      className={cn(
                                        'min-w-0 flex-1 truncate text-body-12',
                                        flagged ? 'text-danger-ink' : active ? 'text-accent' : 'text-text-secondary',
                                      )}
                                    >
                                      {lesson.title}
                                    </span>
                                  </button>
                                  {lesson.type === 'content' ? (
                                    <FormatPills formats={lesson.formats} label={lesson.title} />
                                  ) : (
                                    <Badge tone="neutral" size="sm">
                                      {LESSON_TYPE_LABEL[lesson.type]}
                                    </Badge>
                                  )}
                                  <span className="flex shrink-0 opacity-0 transition-opacity group-hover/lesson:opacity-100 focus-within:opacity-100">
                                    <IconButton
                                      icon={ArrowUp}
                                      label={`Move ${lesson.title} up`}
                                      size="sm"
                                      variant="ghost"
                                      disabled={li === 0}
                                      onClick={() => moveLesson(lesson, siblings, -1)}
                                    />
                                    <IconButton
                                      icon={ArrowDown}
                                      label={`Move ${lesson.title} down`}
                                      size="sm"
                                      variant="ghost"
                                      disabled={li === siblings.length - 1}
                                      onClick={() => moveLesson(lesson, siblings, 1)}
                                    />
                                    <IconButton
                                      icon={Pencil}
                                      label={`Rename ${lesson.title}`}
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => startRename(lesson.id, lesson.title)}
                                    />
                                  </span>
                                </>
                              )}
                            </div>
                          </li>
                        )
                      })}
                      <li>
                        <button
                          type="button"
                          onClick={() => addLesson(mod)}
                          className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-body-12 text-text-muted transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Plus size={13} /> Add lesson
                        </button>
                      </li>
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {ordered.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            className="mt-2 justify-start"
            leftIcon={<FolderPlus size={14} />}
            onClick={addModule}
          >
            Add module
          </Button>
        )}
      </div>
    </aside>
  )
}

function RenameField({
  value,
  onChange,
  onCommit,
  onCancel,
  label,
}: {
  value: string
  onChange: (v: string) => void
  onCommit: () => void
  onCancel: () => void
  label: string
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1">
      <Input
        aria-label={label}
        autoFocus
        inputSize="sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCommit()
          if (e.key === 'Escape') onCancel()
        }}
        containerClassName="min-w-0 flex-1"
      />
      <IconButton icon={Check} label="Save name" size="sm" variant="ghost" onClick={onCommit} />
      <IconButton icon={X} label="Cancel rename" size="sm" variant="ghost" onClick={onCancel} />
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Right — readiness checklist                                                */
/* -------------------------------------------------------------------------- */

export interface ReadinessItem {
  key: string
  label: string
  met: boolean
  /** The first lesson that fails this item, so the row can link to it. */
  offender?: Lesson
  count?: number
}

export function courseReadiness(course: Course, lessons: Lesson[]): ReadinessItem[] {
  const contentLessons = lessons.filter((l) => l.type === 'content')
  const items: ReadinessItem[] = []

  items.push({
    key: 'lessons',
    label: `${formatNumber(lessons.length)} lessons across the outline`,
    met: lessons.length > 0,
    count: lessons.length,
  })

  for (const meta of FORMATS) {
    const have = contentLessons.filter((l) => l.formats[meta.format] !== undefined)
    const missing = contentLessons.filter((l) => l.formats[meta.format] === undefined)
    items.push({
      key: meta.format,
      label:
        missing.length === 0
          ? `All ${formatNumber(contentLessons.length)} lessons have ${meta.label.toLowerCase()}`
          : `${formatNumber(missing.length)} lesson${missing.length === 1 ? '' : 's'} missing ${meta.label.toLowerCase()}`,
      met: contentLessons.length > 0 && have.length === contentLessons.length,
      offender: missing[0],
      count: missing.length,
    })
  }

  const assignmentCount = assignmentsCollection.count((a) => a.courseId === course.id)
  items.push({
    key: 'assignments',
    label: `${formatNumber(assignmentCount)} assignment${assignmentCount === 1 ? '' : 's'} configured`,
    met: assignmentCount > 0,
  })

  const quizCount = quizzesCollection.count((q) => q.courseId === course.id)
  items.push({
    key: 'quizzes',
    label: `${formatNumber(quizCount)} quiz${quizCount === 1 ? '' : 'zes'} configured`,
    met: quizCount > 0,
  })

  const rules = course.certificateRules
  items.push({
    key: 'certificate',
    label: rules.financialClearanceRequired
      ? 'Certificate rules set, financial clearance required'
      : 'Certificate rules set',
    met: rules.attendanceThreshold !== null || rules.contentCompletionThreshold !== null,
  })

  items.push({
    key: 'price',
    label: course.listPrice > 0 ? 'List price set' : 'List price not set',
    met: course.listPrice > 0,
  })

  return items
}

function ReadinessPanel({ course, lessons }: { course: Course; lessons: Lesson[] }) {
  const navigate = useNavigate()
  const [confirmPublish, setConfirmPublish] = useState(false)
  const items = courseReadiness(course, lessons)
  const unmet = items.filter((i) => !i.met)
  const missingAudio = items.find((i) => i.key === 'audio')

  return (
    <aside className="min-w-0 bg-surface" aria-label="Course readiness">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-body-14 font-semibold text-text">Readiness</h2>
        <p className="mt-0.5 text-body-12 text-text-secondary">
          Recomputed from the outline. Every unmet row opens the lesson responsible.
        </p>
      </div>

      <ul className="divide-y divide-border">
        {items.map((item) => (
          <li key={item.key}>
            {item.offender && !item.met ? (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/learn/courses/${course.id}/modules/${item.offender?.moduleId}/lessons/${item.offender?.id}?missing=${item.key}`,
                  )
                }
                className="flex w-full items-start gap-2 px-4 py-2.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <ReadinessMark met={item.met} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body-12 text-text">{item.label}</span>
                  <span className="mt-0.5 block text-body-12 text-accent">
                    Open “{item.offender.title}”
                  </span>
                </span>
              </button>
            ) : (
              <div className="flex items-start gap-2 px-4 py-2.5">
                <ReadinessMark met={item.met} />
                <span className="min-w-0 flex-1 text-body-12 text-text">{item.label}</span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-2 border-t border-border p-4">
        {unmet.length > 0 && (
          <Alert tone="warning" title={`${unmet.length} item${unmet.length === 1 ? '' : 's'} outstanding`}>
            {missingAudio && !missingAudio.met
              ? `Publishing with ${missingAudio.count} lessons missing audio. Learners on low-data plans will have no alternative for those lessons.`
              : 'This course can still be published, but the gaps above will reach learners.'}
          </Alert>
        )}
        <Button
          fullWidth
          variant={course.status === 'published' ? 'secondary' : 'primary'}
          onClick={() => setConfirmPublish(true)}
        >
          {course.status === 'published' ? 'Unpublish course' : 'Publish course'}
        </Button>
        <Button
          fullWidth
          variant="ghost"
          onClick={() => navigate(`/learn/courses/${course.id}/certificate`)}
        >
          Certificate eligibility
        </Button>
      </div>

      <ConfirmDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title={course.status === 'published' ? 'Unpublish this course?' : 'Publish this course?'}
        confirmLabel={course.status === 'published' ? 'Unpublish' : 'Publish'}
        destructive={course.status === 'published'}
        onConfirm={() => {
          const next = course.status === 'published' ? 'draft' : 'published'
          coursesCollection.update(course.id, {
            status: next,
            updatedAt: nowIso(),
            updatedBy: CURRENT_USER_ID,
          })
          setConfirmPublish(false)
          learnToast.success(
            next === 'published' ? 'Course published' : 'Course unpublished',
            next === 'published'
              ? 'It is now visible to enrolled learners.'
              : 'Enrolled learners keep access; it leaves the catalogue.',
          )
        }}
      >
        {course.status === 'published' ? (
          <p className="text-body-13 text-text-secondary">
            Learners already enrolled keep their access. The course leaves the public catalogue and no new
            enrolments can be taken against it.
          </p>
        ) : (
          <div className="space-y-2 text-body-13 text-text-secondary">
            <p>
              Publishing makes every published lesson visible to enrolled learners on {course.code}.
            </p>
            {unmet.length > 0 && (
              <ul className="list-inside list-disc space-y-0.5 text-danger-text">
                {unmet.map((i) => (
                  <li key={i.key}>{i.label}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </ConfirmDialog>
    </aside>
  )
}

function ReadinessMark({ met }: { met: boolean }) {
  return (
    <Tooltip content={met ? 'Met' : 'Outstanding'}>
      <span
        className={cn(
          'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
          met ? 'bg-success-fill text-success-ink' : 'bg-warning-fill text-warning-ink',
        )}
      >
        <span className="sr-only">{met ? 'Met' : 'Outstanding'}</span>
        {met ? <Check size={11} aria-hidden /> : <span aria-hidden className="text-[10px] font-bold">!</span>}
      </span>
    </Tooltip>
  )
}
