import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ClipboardList, FileQuestion, Link2, Presentation, Radio, Smartphone } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatRelative } from '@/lib/format'
import { Badge, EmptyState, KeyValue, KeyValueList, ProgressBar, Select } from '@/ui'
import { FormatSwitcher, MaterialViewer } from '@/modules/_learning-shared/MaterialViewer'
import {
  contentAssetsCollection,
  courseModulesCollection,
  lessonsCollection,
  progressCollection,
  useCollection,
  type ContentFormat,
  type Enrollment,
  type Lesson,
  type LessonId,
  type LessonProgressState,
} from '@/mocks'

import { markLessonOpened } from '../writes'
import { formatBytes, studentToast } from '../common'

const TYPE_LABEL: Record<Lesson['type'], string> = {
  content: 'Lesson',
  quiz: 'Quiz',
  assignment: 'Assignment',
  project: 'Project',
  live_session: 'Live session',
}

const TYPE_ICON = {
  quiz: FileQuestion,
  assignment: ClipboardList,
  project: Presentation,
  live_session: Radio,
} as const

export function ContentTab({ enrolment }: { enrolment: Enrollment }) {
  const modules = useCollection(courseModulesCollection)
  const lessons = useCollection(lessonsCollection)
  const assets = useCollection(contentAssetsCollection)
  const progressRows = useCollection(progressCollection)

  const outline = useMemo(() => {
    return modules
      .filter((m) => m.courseId === enrolment.courseId)
      .sort((a, b) => a.sequence - b.sequence)
      .map((module) => ({
        module,
        lessons: lessons
          .filter((l) => l.moduleId === module.id)
          .sort((a, b) => a.sequence - b.sequence),
      }))
  }, [modules, lessons, enrolment.courseId])

  const progress = progressRows.find((p) => p.enrollmentId === enrolment.id)
  const stateOf = (lessonId: string): LessonProgressState =>
    progress?.perLesson.find((p) => p.lessonId === lessonId)?.state ?? 'not_started'

  const firstPlayable = outline.flatMap((m) => m.lessons).find((l) => Object.keys(l.formats).length > 0)
  const resumedLesson = progress?.lastLessonId ? lessons.find((l) => l.id === progress.lastLessonId) : undefined
  const initialLesson = resumedLesson ?? firstPlayable

  const [openLessonId, setOpenLessonId] = useState<LessonId | undefined>(initialLesson?.id)
  const [format, setFormat] = useState<ContentFormat | undefined>(
    initialLesson ? (Object.keys(initialLesson.formats)[0] as ContentFormat) : undefined,
  )
  const [quality, setQuality] = useState<string>('240p_low_data')

  const openLesson = lessons.find((l) => l.id === openLessonId)
  const availableFormats = openLesson ? (Object.keys(openLesson.formats) as ContentFormat[]) : []
  const activeFormat = format && availableFormats.includes(format) ? format : availableFormats[0]
  const asset = openLesson && activeFormat ? assets.find((a) => a.id === openLesson.formats[activeFormat]) : undefined

  function openAt(lesson: Lesson) {
    setOpenLessonId(lesson.id)
    const first = Object.keys(lesson.formats)[0] as ContentFormat | undefined
    setFormat(first)
  }

  useEffect(() => {
    if (openLessonId) markLessonOpened(enrolment.id, openLessonId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLessonId])

  if (outline.length === 0) {
    return (
      <EmptyState
        title="No content published yet"
        message="Your tutor has not published any lessons for this course."
        bordered
      />
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:items-start">
      {/* The outline. One card, the whole course, in order. */}
      <div className="rounded-2xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <p className="text-body-15 font-bold">Course content</p>
          <p className="text-body-12 text-text-muted">
            {outline.reduce((n, m) => n + m.lessons.length, 0)} lessons across {outline.length} modules
          </p>
          {progress && (
            <ProgressBar
              value={progress.percentComplete}
              valueLabel={`${progress.lessonsCompleted} of ${progress.lessonsTotal} complete`}
              showValue
              tone={progress.percentComplete === 100 ? 'success' : 'accent'}
              size="sm"
              className="mt-3"
              aria-label="Course progress"
            />
          )}
          {progress?.lastLessonId && progress.lastLessonId !== openLessonId && (
            <p className="mt-2 text-body-12 text-text-secondary">
              Resume where you left off — {lessonLabel(lessons, modules, progress.lastLessonId)} (device:{' '}
              {progress.lastDevice}, {formatRelative(progress.lastActivityAt)})
            </p>
          )}
        </div>

        <div className="max-h-[36rem] overflow-y-auto">
          {outline.map(({ module, lessons: moduleLessons }) => (
            <div key={module.id} className="border-b border-border last:border-b-0">
              <div className="bg-surface-sunken px-5 py-2.5">
                <p className="text-label-10 text-text-label">
                  Module {module.sequence}
                </p>
                <p className="text-body-13 font-semibold">{module.title}</p>
              </div>
              <ul>
                {moduleLessons.map((lesson) => {
                  const done = stateOf(lesson.id) === 'complete'
                  const playable = Object.keys(lesson.formats).length > 0
                  const Icon = lesson.type === 'content' ? undefined : TYPE_ICON[lesson.type]
                  return (
                    <li key={lesson.id}>
                      <button
                        type="button"
                        onClick={() => openAt(lesson)}
                        className={cn(
                          'flex w-full items-start gap-3 px-5 py-3 text-left transition-colors',
                          lesson.id === openLessonId ? 'bg-accent-subtle' : 'hover:bg-surface-hover',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border',
                            done
                              ? 'border-success-600 bg-success-600 text-success-25'
                              : 'border-border-strong text-text-muted',
                          )}
                          aria-hidden="true"
                        >
                          {done && <Check size={12} />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-body-13 font-medium">{lesson.title}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-body-12 text-text-muted">
                            {Icon && <Icon size={12} />}
                            {lesson.type === 'content'
                              ? `${lesson.durationMinutes} min`
                              : `${TYPE_LABEL[lesson.type]} · ${lesson.durationMinutes} min`}
                            {!playable && lesson.type === 'content' && ' · no content yet'}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* The viewer, with the format switcher as its first control — the PRD's
          §4.9 rule that choosing how to take a lesson comes before the lesson. */}
      <div className="flex flex-col gap-4">
        {openLesson ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FormatSwitcher
                lesson={openLesson}
                active={activeFormat ?? 'video'}
                onChange={setFormat}
              />
              {openLesson.offlineEnabled && (
                <Badge tone="info" variant="subtle" size="sm">
                  Downloadable for offline
                </Badge>
              )}
            </div>

            {availableFormats.length > 0 ? (
              <>
                <MaterialViewer lesson={openLesson} format={activeFormat} asset={asset} />

                {activeFormat === 'video' && (asset?.variants?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4">
                    <Select
                      aria-label="Video quality"
                      selectSize="sm"
                      value={quality}
                      onChange={(e) => setQuality(e.target.value)}
                      containerClassName="w-56"
                      options={(asset?.variants ?? []).map((v) => ({
                        value: v.label,
                        label:
                          v.label === '240p_low_data'
                            ? `240p · Low data — ${formatBytes(v.fileSizeBytes)}`
                            : `${v.label} — ${formatBytes(v.fileSizeBytes)}`,
                      }))}
                    />
                    <span className="flex items-center gap-1.5 text-body-12 text-text-secondary">
                      <Smartphone size={13} />
                      Low data uses about{' '}
                      {formatBytes((asset?.variants ?? []).find((v) => v.label === '240p_low_data')?.fileSizeBytes ?? 0)}{' '}
                      for this lesson.
                    </span>
                  </div>
                )}

                {activeFormat === 'podcast' && asset?.podcast && (
                  <div className="rounded-2xl border border-border bg-surface px-5 py-4">
                    <KeyValueList columns={2}>
                      <KeyValue label="Feed">{asset.podcast.feedName}</KeyValue>
                      <KeyValue label="Episode">#{asset.podcast.episodeNumber}</KeyValue>
                      <KeyValue label="Published">{formatDate(asset.podcast.publishedAt)}</KeyValue>
                      <KeyValue label="Public feed">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard?.writeText(asset.podcast!.publicFeedUrl)
                            studentToast.success('Feed URL copied')
                          }}
                          className="inline-flex items-center gap-1 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Link2 size={13} />
                          {asset.podcast.publicFeedUrl}
                        </button>
                      </KeyValue>
                    </KeyValueList>
                  </div>
                )}
              </>
            ) : (
              <NonContentLesson lesson={openLesson} />
            )}

            {openLesson.resources.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface px-5 py-4">
                <p className="mb-3 text-label-10 text-text-label">
                  Resources ({openLesson.resources.length})
                </p>
                <ul className="flex flex-col gap-2">
                  {openLesson.resources.map((resource) => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-body-13 font-medium text-accent hover:underline"
                      >
                        {resource.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <EmptyState title="Pick a lesson" message="Choose a lesson from the outline to start." bordered />
        )}
      </div>
    </div>
  )
}

function NonContentLesson({ lesson }: { lesson: Lesson }) {
  if (lesson.assignmentId) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={lesson.title}
        message="This lesson is assessed rather than watched. Open it to read the brief and submit your work."
        action={
          <Link
            to={`/my-learning/assignments/${lesson.assignmentId}`}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-body-13 font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            Open assignment
          </Link>
        }
        bordered
      />
    )
  }

  if (lesson.type === 'quiz' && lesson.quizId) {
    return (
      <EmptyState
        icon={FileQuestion}
        title={lesson.title}
        message="This lesson is a quiz. Take it whenever you're ready — you can see your result immediately."
        action={
          <Link
            to={`/my-learning/quizzes/${lesson.quizId}`}
            className="inline-flex h-9 items-center rounded-lg bg-accent px-4 text-body-13 font-semibold text-on-accent transition-opacity hover:opacity-90"
          >
            Take quiz
          </Link>
        }
        bordered
      />
    )
  }

  return (
    <EmptyState
      icon={lesson.type === 'quiz' ? FileQuestion : Radio}
      title={lesson.title}
      message={
        lesson.type === 'quiz'
          ? 'This quiz is not open yet — check back once your tutor publishes it.'
          : lesson.type === 'live_session'
            ? 'This is a live session — check your timetable for when it runs.'
            : 'No recorded content for this lesson yet.'
      }
      bordered
    />
  )
}

function lessonLabel(
  lessons: Lesson[],
  modules: Array<{ id: string; sequence: number }>,
  lessonId: string | null,
): string {
  const lesson = lessons.find((l) => l.id === lessonId)
  if (!lesson) return 'the beginning of the course'
  const mod = modules.find((m) => m.id === lesson.moduleId)
  return `Module ${mod?.sequence ?? 1}, ${lesson.title}`
}
