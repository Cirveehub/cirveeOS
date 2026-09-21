/**
 * Materials — the one screen that deliberately does **not** reproduce the
 * legacy layout.
 *
 * The legacy portal's Materials tab is a flat list of uploads: title, type,
 * date, delete. It has no idea what a course is made of, so it cannot tell a
 * tutor what is missing — only what happens to exist.
 *
 * Cirvee OS's model is Course → Module → Lesson → one `ContentAsset` per
 * `ContentFormat`, and PRD §4's whole point is that a lesson should carry all
 * five formats because a student on 240p in Bodija needs the audio and the
 * transcript, not the video. **A missing format is the information.** So this
 * is a coverage table: one row per lesson, five slots per row, a present slot
 * opens the viewer and a missing slot opens the upload dialog already pointed
 * at that lesson and that format.
 *
 * The card recipe, the header of title + count + one action, and the density
 * are still the legacy's.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Headphones, Layers, Mic, Plus, Upload, Video } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { Badge, Button, DataTable, EmptyState, ProgressBar, type Column } from '@/ui'
import {
  courseModulesCollection,
  lessonsCollection,
  useCollection,
  type ContentFormat,
  type Course,
  type Lesson,
} from '@/mocks'

import { TeachingCard } from '../shared'
import type { UploadTarget } from '../CohortScreen'

const FORMATS: ContentFormat[] = ['video', 'audio', 'podcast', 'pdf', 'transcript']

const FORMAT_META: Record<ContentFormat, { label: string; short: string; icon: typeof Video }> = {
  video: { label: 'Video', short: 'Vid', icon: Video },
  audio: { label: 'Audio', short: 'Aud', icon: Headphones },
  podcast: { label: 'Podcast', short: 'Pod', icon: Mic },
  pdf: { label: 'Slides / PDF', short: 'PDF', icon: FileText },
  transcript: { label: 'Transcript', short: 'Txt', icon: FileText },
}

interface LessonRow {
  lesson: Lesson
  moduleTitle: string
  moduleSequence: number
  have: number
}

export default function MaterialsTab({
  course,
  onUpload,
}: {
  course: Course
  onUpload: (target: UploadTarget) => void
}) {
  const lessons = useCollection(lessonsCollection)
  const modules = useCollection(courseModulesCollection)

  const rows = useMemo<LessonRow[]>(() => {
    const courseModules = modules.filter((m) => m.courseId === course.id)
    const moduleById = new Map(courseModules.map((m) => [m.id, m]))

    return lessons
      .filter((l) => l.courseId === course.id)
      .map((lesson) => {
        const parent = moduleById.get(lesson.moduleId)
        return {
          lesson,
          moduleTitle: parent?.title ?? 'Unassigned module',
          moduleSequence: parent?.sequence ?? 99,
          have: FORMATS.filter((f) => lesson.formats[f] !== undefined).length,
        } satisfies LessonRow
      })
      .sort((a, b) =>
        a.moduleSequence === b.moduleSequence
          ? a.lesson.sequence - b.lesson.sequence
          : a.moduleSequence - b.moduleSequence,
      )
  }, [lessons, modules, course.id])

  const contentRows = rows.filter((r) => r.lesson.type === 'content')
  const slotsFilled = contentRows.reduce((acc, r) => acc + r.have, 0)
  const slotsTotal = contentRows.length * FORMATS.length
  const coverage = slotsTotal ? Math.round((slotsFilled / slotsTotal) * 100) : 0

  const columns: Array<Column<LessonRow>> = [
    {
      key: 'lesson',
      header: 'Lesson',
      pinned: true,
      minWidth: 300,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-semibold text-text">{row.lesson.title}</p>
          <p className="truncate text-body-12 text-text-muted">
            {row.moduleSequence}.{row.lesson.sequence} · {row.moduleTitle}
          </p>
        </div>
      ),
      sortValue: (row) => `${row.moduleSequence}-${row.lesson.sequence}`,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 118,
      cell: (row) => (
        <Badge tone={row.lesson.type === 'content' ? 'neutral' : 'info'} variant="subtle" size="sm">
          {row.lesson.type.replace(/_/g, ' ')}
        </Badge>
      ),
      sortValue: (row) => row.lesson.type,
      sortable: true,
    },
    {
      key: 'duration',
      header: 'Length',
      width: 92,
      align: 'right',
      accessor: (row) => `${row.lesson.durationMinutes} min`,
      sortValue: (row) => row.lesson.durationMinutes,
      sortable: true,
    },
    {
      key: 'formats',
      header: 'Formats',
      minWidth: 330,
      cell: (row) => {
        if (row.lesson.type !== 'content') {
          return <span className="text-body-13 text-text-muted">Not a content lesson</span>
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {FORMATS.map((format) => {
              const meta = FORMAT_META[format]
              const Icon = meta.icon
              const present = row.lesson.formats[format] !== undefined
              return present ? (
                <Link
                  key={format}
                  to={`/teaching/materials/${row.lesson.id}?format=${format}`}
                  title={`Open the ${meta.label.toLowerCase()} for this lesson`}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border border-success-line bg-success-fill',
                    'px-2 py-1 text-label-10 font-semibold text-success-ink transition-colors hover:bg-success-fill/70',
                  )}
                >
                  <Icon size={12} />
                  {meta.short}
                </Link>
              ) : (
                <button
                  key={format}
                  type="button"
                  onClick={() => onUpload({ lessonId: row.lesson.id, format })}
                  title={`Upload the ${meta.label.toLowerCase()} for this lesson`}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border border-dashed border-border-strong',
                    'px-2 py-1 text-label-10 font-semibold text-text-muted transition-colors',
                    'hover:border-accent hover:bg-accent-subtle hover:text-accent',
                  )}
                >
                  <Plus size={12} />
                  {meta.short}
                </button>
              )
            })}
          </div>
        )
      },
      sortValue: (row) => row.have,
      sortable: true,
    },
    {
      key: 'coverage',
      header: 'Coverage',
      width: 140,
      cell: (row) =>
        row.lesson.type === 'content' ? (
          <ProgressBar
            value={row.have}
            max={FORMATS.length}
            valueLabel={`${row.have}/5`}
            size="sm"
            tone={row.have === FORMATS.length ? 'success' : row.have >= 3 ? 'warning' : 'danger'}
            aria-label={`Format coverage for ${row.lesson.title}`}
          />
        ) : (
          <span className="text-body-13 text-text-muted">—</span>
        ),
      sortValue: (row) => row.have,
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 96,
      align: 'right',
      cell: (row) =>
        row.have > 0 ? (
          <Button size="sm" variant="secondary" asChild>
            <Link to={`/teaching/materials/${row.lesson.id}`}>View</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<Upload size={14} />}
            onClick={() => onUpload({ lessonId: row.lesson.id, format: null })}
          >
            Upload
          </Button>
        ),
    },
  ]

  return (
    <TeachingCard
      title="Materials"
      description={`${formatNumber(contentRows.length)} content lessons · ${formatNumber(slotsFilled)} of ${formatNumber(slotsTotal)} format slots filled (${coverage}%)`}
      action={
        <Button size="sm" leftIcon={<Upload size={14} />} onClick={() => onUpload({ lessonId: null, format: null })}>
          Upload material
        </Button>
      }
    >
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.lesson.id}
        bordered={false}
        minWidth={1180}
        density="compact"
        caption="Lessons on this course with per-format coverage"
        empty={
          <EmptyState
            icon={Layers}
            title="This course has no lessons yet"
            message="A material belongs to a lesson in a module. Curriculum builds the outline; you fill the formats."
          />
        }
      />
      <p className="border-t border-border px-6 py-3 text-body-12 text-text-muted">
        A dashed slot is a format this lesson does not carry. Click one to upload it — a student on a
        240p connection needs the audio and the transcript, not only the video.
      </p>
    </TeachingCard>
  )
}
