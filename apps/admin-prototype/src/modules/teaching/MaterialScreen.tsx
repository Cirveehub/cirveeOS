/**
 * The material viewer — one page whose body branches by format inside one
 * header/back/download shell, exactly as both legacy portals do rather than a
 * route per file type.
 *
 * The shell is `MaterialViewer` and `FormatSwitcher` from `_learning-shared`,
 * shared with the student module so a tutor previewing a lesson sees precisely
 * what a student sees. The tutor-only addition is the row of dashed slots for
 * the formats this lesson does not carry yet, which opens the same upload
 * dialog the coverage table uses.
 */
import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'

import { Alert, Badge, Button, EmptyState } from '@/ui'
import { FormatSwitcher, MaterialViewer } from '@/modules/_learning-shared/MaterialViewer'
import { useCurrentUserId } from '@/auth'
import {
  contentAssetsCollection,
  courseModulesCollection,
  coursesCollection,
  lessonsCollection,
  useCollection,
  type ContentFormat,
} from '@/mocks'

import { Page, cohortIdsOf, useTutorScope } from './shared'
import MaterialModal from './MaterialModal'

const FORMATS: ContentFormat[] = ['video', 'audio', 'podcast', 'pdf', 'transcript']

const FORMAT_LABEL: Record<ContentFormat, string> = {
  video: 'Video',
  audio: 'Audio',
  podcast: 'Podcast',
  pdf: 'Slides / PDF',
  transcript: 'Transcript',
}

export default function MaterialScreen() {
  const { lessonId = '' } = useParams<{ lessonId: string }>()
  const [params, setParams] = useSearchParams()
  const actorUserId = useCurrentUserId()
  const scope = useTutorScope()

  const lessons = useCollection(lessonsCollection)
  const assets = useCollection(contentAssetsCollection)
  const modules = useCollection(courseModulesCollection)
  const courses = useCollection(coursesCollection)

  const [uploadFormat, setUploadFormat] = useState<ContentFormat | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const lesson = lessons.find((l) => l.id === lessonId)
  const course = lesson ? courses.find((c) => c.id === lesson.courseId) : undefined
  const parentModule = lesson ? modules.find((m) => m.id === lesson.moduleId) : undefined

  const present = useMemo(
    () => (lesson ? FORMATS.filter((f) => lesson.formats[f] !== undefined) : []),
    [lesson],
  )

  const requested = params.get('format') as ContentFormat | null
  const active = requested && present.includes(requested) ? requested : present[0]
  const asset = active && lesson ? assets.find((a) => a.id === lesson.formats[active]) : undefined

  /* Back to the cohort this tutor is teaching on this course, if they have one. */
  const backCohortId = useMemo(() => {
    if (!lesson) return undefined
    const mine = cohortIdsOf(scope)
    return scope.assignments.find((a) => mine.includes(a.cohortId))?.cohortId
  }, [lesson, scope])

  if (!lesson || !course) {
    return (
      <Page>
        <EmptyState
          title="That lesson is not in the outline"
          message="It may have been removed, or the link is out of date."
          action={
            <Button variant="secondary" asChild>
              <Link to="/teaching/classes">Back to my classes</Link>
            </Button>
          }
        />
      </Page>
    )
  }

  const missing = FORMATS.filter((f) => lesson.formats[f] === undefined)

  return (
    <Page>
      <Link
        to={backCohortId ? `/teaching/classes/${backCohortId}?tab=materials` : '/teaching/classes'}
        className="mb-4 inline-flex items-center gap-1.5 text-body-13 font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft size={14} />
        Materials
      </Link>

      <div className="mb-6">
        <h1 className="text-heading-24 text-text">{lesson.title}</h1>
        <p className="mt-1.5 text-body-14 text-text-secondary">
          {course.title}
          {parentModule ? ` · ${parentModule.sequence}. ${parentModule.title}` : ''} ·{' '}
          {lesson.durationMinutes} min · {present.length} of {FORMATS.length} formats
        </p>
      </div>

      {notice && (
        <Alert tone="success" title="Uploaded" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {present.length === 0 ? (
        <EmptyState
          title="This lesson carries no content yet"
          message="Upload the first format and students can start on it."
          bordered
          action={
            <Button leftIcon={<Plus size={16} />} onClick={() => setUploadFormat('video')}>
              Upload material
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          <FormatSwitcher
            lesson={lesson}
            active={active as ContentFormat}
            onChange={(format) => setParams({ format }, { replace: true })}
          />
          <MaterialViewer lesson={lesson} format={active} asset={asset} />
        </div>
      )}

      {missing.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-sunken p-4">
          <span className="text-body-13 text-text-secondary">Not available in:</span>
          {missing.map((format) => (
            <Button
              key={format}
              size="sm"
              variant="secondary"
              leftIcon={<Plus size={14} />}
              onClick={() => setUploadFormat(format)}
            >
              {FORMAT_LABEL[format]}
            </Button>
          ))}
          <Badge tone="neutral" variant="subtle" size="sm" className="ml-auto">
            {present.length}/{FORMATS.length} covered
          </Badge>
        </div>
      )}

      <MaterialModal
        open={uploadFormat !== null}
        onClose={() => setUploadFormat(null)}
        course={course}
        initialLessonId={lesson.id}
        initialFormat={uploadFormat}
        actorUserId={actorUserId}
        onUploaded={(result) => {
          setNotice(`${result.asset.fileName} added to "${result.lesson.title}".`)
          setParams({ format: result.asset.format }, { replace: true })
        }}
      />
    </Page>
  )
}
