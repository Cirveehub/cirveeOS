import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDashed,
  Download,
  Eye,
  Link2,
  Pause,
  Play,
  Smartphone,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatRelative } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
  KeyValueList,
  ProgressBar,
  Select,
  Skeleton,
  Tooltip,
} from '@/ui'
import {
  CURRENT_USER_ID,
  assignmentsCollection,
  certificateEligibility,
  cohortsCollection,
  contentAssetsCollection,
  courseModulesCollection,
  coursesCollection,
  enrollmentsCollection,
  lessonsCollection,
  progressCollection,
  submissionsCollection,
  useCollection,
  useRecord,
  type ContentAsset,
  type ContentFormat,
  type EnrollmentId,
  type Lesson,
  type Progress,
} from '@/mocks'

import {
  FORMATS,
  Screen,
  ScreenError,
  formatBytes,
  formatDuration,
  formatMeta,
  formatMinutes,
  learnToast,
  nowIso,
  personName,
  useScreenError,
  useScreenLoading,
} from './common'

export default function StudentView() {
  const { enrollmentId = '' } = useParams()
  const navigate = useNavigate()
  const loading = useScreenLoading(`learn:student-view:${enrollmentId}`)
  const { errored, retry } = useScreenError()

  const enrolment = useRecord(enrollmentsCollection, enrollmentId)
  const course = useRecord(coursesCollection, enrolment?.courseId ?? '')
  const cohort = useRecord(cohortsCollection, enrolment?.cohortId ?? '')
  const modules = useCollection(courseModulesCollection).filter((m) => m.courseId === enrolment?.courseId)
  const lessons = useCollection(lessonsCollection).filter((l) => l.courseId === enrolment?.courseId)
  const assets = useCollection(contentAssetsCollection)
  const progressRows = useCollection(progressCollection)
  const submissions = useCollection(submissionsCollection)
  const assignments = useCollection(assignmentsCollection)

  const [params, setParams] = useSearchParams()
  const lessonParam = params.get('lesson')
  const formatParam = (params.get('format') as ContentFormat | null) ?? null

  const progress = progressRows.find((p) => p.enrollmentId === enrollmentId)

  const ordered = useMemo(() => {
    const byModule = new Map(modules.map((m) => [m.id as string, m.sequence]))
    return [...lessons].sort((a, b) => {
      const ma = byModule.get(a.moduleId) ?? 0
      const mb = byModule.get(b.moduleId) ?? 0
      return ma === mb ? a.sequence - b.sequence : ma - mb
    })
  }, [lessons, modules])

  const resumeLesson = progress?.lastLessonId ?? ordered[0]?.id ?? null
  const current = ordered.find((l) => l.id === (lessonParam ?? resumeLesson)) ?? ordered[0]

  function openLesson(id: string, format?: ContentFormat) {
    const next = new URLSearchParams(params)
    next.set('lesson', id)
    if (format) next.set('format', format)
    else next.delete('format')
    setParams(next, { replace: true })
  }

  if (errored) {
    return (
      <Screen bare>
        <div className="p-6">
          <ScreenError what="The learner preview" onRetry={retry} />
        </div>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen bare>
        <div className="grid gap-4 p-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <Skeleton height={420} rounded="xl" />
          <Skeleton height={420} rounded="xl" />
        </div>
      </Screen>
    )
  }

  if (!enrolment || !course) {
    return (
      <Screen bare>
        <div className="p-6">
          <Alert tone="danger" title="Enrolment not found">
            There is no enrolment with that id, so there is nothing to preview.{' '}
            <Button variant="link" onClick={() => navigate('/learn/progress')}>
              Back to progress
            </Button>
          </Alert>
        </div>
      </Screen>
    )
  }

  const eligibility = certificateEligibility(enrollmentId as EnrollmentId)
  const dueAssignments = assignments
    .filter((a) => a.courseId === course.id)
    .filter((a) => !submissions.some((s) => s.assignmentId === a.id && s.enrollmentId === enrolment.id))
    .slice(0, 3)

  return (
    <Screen bare>
      {/* Deliberately not the admin chrome: this is the learner's surface. */}
      <div className="border-b border-accent bg-accent-wash px-6 py-2.5">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3">
          <Badge tone="accent" icon={<Eye size={12} />}>
            Preview
          </Badge>
          <span className="text-body-13 text-text">
            Previewing as {personName(enrolment.personId)} · {course.title} {cohort ? `Cohort ${cohort.code.replace(/^\D+/, '')}` : ''}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto"
            leftIcon={<ArrowLeft size={14} />}
            onClick={() => navigate(`/learn/courses/${course.id}/builder`)}
          >
            Back to the builder
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-6 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardBody padding="tight">
              <h2 className="text-body-14 font-semibold text-text">{course.title}</h2>
              <p className="mt-0.5 text-body-12 text-text-secondary">{cohort?.scheduleSummary ?? 'Self-paced'}</p>
              <div className="mt-3">
                <ProgressBar
                  value={progress?.percentComplete ?? 0}
                  label="Overall progress"
                  valueLabel={`${progress?.percentComplete ?? 0}% · ${progress?.lessonsCompleted ?? 0} of ${progress?.lessonsTotal ?? ordered.length} lessons`}
                  tone="accent"
                />
              </div>
              {progress && (
                <p className="mt-2 text-body-12 text-text-secondary">
                  Resume where you left off — {lessonLabel(ordered, modules, progress.lastLessonId)} (device:{' '}
                  {progress.lastDevice}, {formatRelative(progress.lastActivityAt)})
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader bare title="Course outline" />
            <CardBody padding="none">
              <ul className="max-h-[520px] overflow-y-auto">
                {modules
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((mod) => (
                    <li key={mod.id}>
                      <div className="sticky top-0 bg-surface-sunken px-4 py-1.5 text-label-11 text-text-label">
                        {mod.sequence}. {mod.title}
                      </div>
                      <ul>
                        {ordered
                          .filter((l) => l.moduleId === mod.id)
                          .map((lesson) => {
                            const state =
                              progress?.perLesson.find((p) => p.lessonId === lesson.id)?.state ?? 'not_started'
                            const isCurrent = lesson.id === current?.id
                            const isResume = lesson.id === resumeLesson
                            return (
                              <li key={lesson.id}>
                                <button
                                  type="button"
                                  onClick={() => openLesson(lesson.id)}
                                  aria-current={isCurrent}
                                  className={cn(
                                    'flex w-full items-start gap-2 px-4 py-2 text-left transition-colors',
                                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent',
                                    isCurrent ? 'bg-accent-wash' : 'hover:bg-surface-hover',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
                                      state === 'complete'
                                        ? 'bg-success-fill text-success-ink'
                                        : state === 'in_progress'
                                          ? 'bg-warning-fill text-warning-ink'
                                          : 'border border-border-strong text-text-muted',
                                    )}
                                  >
                                    <span className="sr-only">
                                      {state === 'complete'
                                        ? 'Complete'
                                        : state === 'in_progress'
                                          ? 'In progress'
                                          : 'Not started'}
                                    </span>
                                    {state === 'complete' ? (
                                      <Check size={10} aria-hidden />
                                    ) : state === 'in_progress' ? (
                                      <CircleDashed size={10} aria-hidden />
                                    ) : null}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span
                                      className={cn(
                                        'block truncate text-body-12',
                                        isCurrent ? 'font-medium text-accent' : 'text-text-secondary',
                                      )}
                                    >
                                      {lesson.title}
                                    </span>
                                    <span className="mt-0.5 flex items-center gap-1.5">
                                      <span className="text-body-12 text-text-muted">
                                        {formatMinutes(lesson.durationMinutes)}
                                      </span>
                                      {isResume && (
                                        <Badge tone="accent" size="sm">
                                          Resume here
                                        </Badge>
                                      )}
                                    </span>
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                      </ul>
                    </li>
                  ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader bare title="Certificate progress" />
            <CardBody padding="tight">
              <ul className="space-y-1.5">
                {eligibility.criteria.map((c) => (
                  <li key={c.criterion} className="flex items-start gap-2">
                    <span
                      className={cn(
                        'mt-0.5 grid size-4 shrink-0 place-items-center rounded-full',
                        c.met ? 'bg-success-fill text-success-ink' : 'bg-warning-fill text-warning-ink',
                      )}
                    >
                      <span className="sr-only">{c.met ? 'Met' : 'Not yet'}</span>
                      {c.met ? <Check size={10} aria-hidden /> : <span aria-hidden className="text-[9px] font-bold">!</span>}
                    </span>
                    <span className="min-w-0 flex-1 text-body-12">
                      <span className="text-text">{c.criterion}</span>
                      <span className="ml-1 text-text-secondary">
                        {c.actual} · needs {c.required.toLowerCase()}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader bare title="Assignments due" />
            <CardBody padding="tight">
              {dueAssignments.length === 0 ? (
                <p className="text-body-12 text-text-secondary">
                  Nothing outstanding. Every assignment on this course has been submitted.
                </p>
              ) : (
                <ul className="space-y-2">
                  {dueAssignments.map((a) => (
                    <li key={a.id} className="rounded-lg border border-border p-2">
                      <div className="text-body-12 font-medium text-text">{a.title}</div>
                      <div className="text-body-12 text-text-muted">
                        {a.dueDate ? `Due ${formatDate(a.dueDate)}` : `Due ${a.dueOffsetDays ?? 0} days into the cohort`}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        {current ? (
          <LessonPlayer
            key={current.id}
            lesson={current}
            assets={assets.filter((a) => a.lessonId === current.id)}
            progress={progress}
            preferredFormat={formatParam}
            onFormatChange={(format) => openLesson(current.id, format)}
            onNavigate={(direction) => {
              const idx = ordered.findIndex((l) => l.id === current.id)
              const next = ordered[idx + direction]
              if (next) openLesson(next.id)
            }}
            hasPrevious={ordered.findIndex((l) => l.id === current.id) > 0}
            hasNext={ordered.findIndex((l) => l.id === current.id) < ordered.length - 1}
          />
        ) : (
          <Card>
            <CardBody>
              <EmptyState
                title="This course has no lessons yet"
                message="There is nothing for a learner to open. Add a module and a lesson in the builder."
                action={<Button onClick={() => navigate(`/learn/courses/${course.id}/builder`)}>Open the builder</Button>}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </Screen>
  )
}

function LessonPlayer({
  lesson,
  assets,
  progress,
  preferredFormat,
  onFormatChange,
  onNavigate,
  hasPrevious,
  hasNext,
}: {
  lesson: Lesson
  assets: ContentAsset[]
  progress: Progress | undefined
  preferredFormat: ContentFormat | null
  onFormatChange: (format: ContentFormat) => void
  onNavigate: (direction: -1 | 1) => void
  hasPrevious: boolean
  hasNext: boolean
}) {
  const available = FORMATS.filter((f) => lesson.formats[f.format] !== undefined)
  const initial = preferredFormat && lesson.formats[preferredFormat] ? preferredFormat : available[0]?.format
  const [format, setFormat] = useState<ContentFormat | undefined>(initial)
  const [playing, setPlaying] = useState(false)
  const [quality, setQuality] = useState<string>('240p_low_data')

  const active = format ? assets.find((a) => a.format === format) : undefined
  const state = progress?.perLesson.find((p) => p.lessonId === lesson.id)?.state ?? 'not_started'

  function markComplete() {
    if (!progress) return
    const perLesson = progress.perLesson.map((p) =>
      p.lessonId === lesson.id
        ? { ...p, state: 'complete' as const, completedAt: nowIso(), formatUsed: format ?? null }
        : p,
    )
    const lessonsCompleted = perLesson.filter((p) => p.state === 'complete').length
    progressCollection.update(progress.id, {
      perLesson,
      lessonsCompleted,
      percentComplete: Math.round((lessonsCompleted / Math.max(1, progress.lessonsTotal)) * 100),
      lastLessonId: lesson.id,
      lastActivityAt: nowIso(),
      daysInactive: 0,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    })
    learnToast.success('Lesson marked complete', `${lessonsCompleted} of ${progress.lessonsTotal} lessons done.`)
  }

  return (
    <Card>
      <CardBody className="space-y-4">
        {/* The format switcher is the first control, deliberately. */}
        <div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Lesson format">
            {FORMATS.map((meta) => {
              const present = lesson.formats[meta.format] !== undefined
              const selected = format === meta.format
              const button = (
                <button
                  key={meta.format}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  disabled={!present}
                  onClick={() => {
                    setFormat(meta.format)
                    onFormatChange(meta.format)
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-body-13 transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    !present
                      ? 'cursor-not-allowed border-border bg-surface-sunken text-text-muted'
                      : selected
                        ? 'border-accent bg-accent-subtle text-accent'
                        : 'border-border text-text-secondary hover:border-border-strong hover:text-text',
                  )}
                >
                  <meta.icon size={14} />
                  {meta.label}
                  {!present && <span className="text-body-12">· unavailable</span>}
                </button>
              )
              return present ? (
                button
              ) : (
                <Tooltip key={meta.format} content={meta.missingConsequence}>
                  <span className="inline-flex">{button}</span>
                </Tooltip>
              )
            })}
          </div>
          {available.length < 5 && (
            <p className="mt-2 text-body-12 text-text-secondary">
              {5 - available.length} of the five formats are missing for this lesson. A learner who needs one
              of them has no way through.
            </p>
          )}
        </div>

        {!active ? (
          <EmptyState
            title="This lesson has no content at all"
            message="Five empty format slots. Nothing here can be watched, listened to, read or downloaded."
          />
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-surface-sunken p-5">
              {format === 'transcript' ? (
                <div className="max-h-96 overflow-y-auto">
                  <h3 className="text-body-13 font-semibold text-text">Transcript</h3>
                  <p className="mt-2 whitespace-pre-wrap text-body-14 leading-7 text-text-secondary">
                    {active.transcriptBody?.trim()
                      ? active.transcriptBody
                      : 'This transcript is empty. Nothing was typed into it, so this lesson cannot be found by search.'}
                  </p>
                  <div className="mt-3">
                    <Badge tone={active.transcriptOrigin === 'human_reviewed' ? 'success' : 'warning'} size="sm">
                      {active.transcriptOrigin === 'human_reviewed' ? 'Human-reviewed' : 'Auto-generated'}
                    </Badge>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setPlaying((p) => !p)}
                      aria-label={playing ? `Pause ${lesson.title}` : `Play ${lesson.title}`}
                      className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      {playing ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-body-14 font-medium text-text">{lesson.title}</div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
                        <div className="h-full rounded-full bg-accent" style={{ width: playing ? '32%' : '0%' }} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-body-12 text-text-muted">
                        <span>{formatDuration(active.durationSeconds) || formatMinutes(lesson.durationMinutes)}</span>
                        <span>·</span>
                        <span>{formatBytes(active.fileSizeBytes)}</span>
                        {active.pageCount !== undefined && (
                          <>
                            <span>·</span>
                            <span>{active.pageCount} pages</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {format === 'video' && (active.variants?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        aria-label="Video quality"
                        selectSize="sm"
                        value={quality}
                        onChange={(e) => setQuality(e.target.value)}
                        containerClassName="w-56"
                        options={(active.variants ?? []).map((v) => ({
                          value: v.label,
                          label:
                            v.label === '240p_low_data'
                              ? `240p · Low data — ${formatBytes(v.fileSizeBytes)}`
                              : `${v.label} — ${formatBytes(v.fileSizeBytes)}`,
                        }))}
                      />
                      <span className="flex items-center gap-1.5 text-body-12 text-text-secondary">
                        <Smartphone size={13} />
                        Low data uses about {formatBytes((active.variants ?? []).find((v) => v.label === '240p_low_data')?.fileSizeBytes ?? 0)} for this lesson.
                      </span>
                    </div>
                  )}

                  {format === 'podcast' && active.podcast && (
                    <div className="rounded-xl border border-border bg-surface p-3">
                      <KeyValueList columns={2}>
                        <KeyValue label="Feed">{active.podcast.feedName}</KeyValue>
                        <KeyValue label="Episode">#{active.podcast.episodeNumber}</KeyValue>
                        <KeyValue label="Published">{formatDate(active.podcast.publishedAt)}</KeyValue>
                        <KeyValue label="Public feed">
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard?.writeText(active.podcast!.publicFeedUrl)
                              learnToast.success('Feed URL copied')
                            }}
                            className="inline-flex items-center gap-1 text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <Link2 size={13} />
                            {active.podcast.publicFeedUrl}
                          </button>
                        </KeyValue>
                      </KeyValueList>
                    </div>
                  )}

                  {format === 'pdf' && (
                    <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border-strong bg-surface text-body-12 text-text-muted">
                      Slide deck preview — {active.pageCount ?? 0} pages. No real file is embedded in this
                      prototype.
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<Download size={16} />}
                disabled={!active.offlineEnabled}
                onClick={() => {
                  contentAssetsCollection.update(active.id, { downloadCount: active.downloadCount + 1 })
                  learnToast.success(
                    `${formatMeta(active.format).label} downloaded for offline use`,
                    `${formatBytes(active.fileSizeBytes)} · available without a connection.`,
                  )
                }}
              >
                Download for offline
              </Button>
              {!active.offlineEnabled && (
                <span className="text-body-12 text-warning-text">
                  Offline download is switched off for this asset.
                </span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} disabled={!hasPrevious} onClick={() => onNavigate(-1)}>
                  Previous
                </Button>
                <Button
                  variant={state === 'complete' ? 'secondary' : 'primary'}
                  disabled={state === 'complete' || !progress}
                  onClick={markComplete}
                >
                  {state === 'complete' ? 'Completed' : 'Mark complete'}
                </Button>
                <Button variant="ghost" rightIcon={<ArrowRight size={16} />} disabled={!hasNext} onClick={() => onNavigate(1)}>
                  Next
                </Button>
              </div>
            </div>

            {format !== 'transcript' && lesson.formats.transcript !== undefined && (
              <details className="rounded-xl border border-border p-3">
                <summary className="cursor-pointer text-body-13 font-medium text-text">
                  Read the transcript alongside
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-body-13 leading-6 text-text-secondary">
                  {assets.find((a) => a.format === 'transcript')?.transcriptBody || 'The transcript is empty.'}
                </p>
              </details>
            )}
          </>
        )}
      </CardBody>
    </Card>
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
