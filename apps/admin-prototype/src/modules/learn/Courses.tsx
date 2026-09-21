/**
 * Course list — `/learn/courses`.
 *
 * The way into the builder. Carries the format-coverage pills on every row so
 * the catalogue's readiness is legible before anyone opens a course.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, Plus } from 'lucide-react'

import { formatNaira, formatNumber, humanize } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  CurrencyInput,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Select,
  SkeletonTable,
  StatusBadge,
  Textarea,
  UnitTag,
  type Column,
} from '@/ui'
import {
  contentCoverageMatrix,
  coursesCollection,
  lessonsCollection,
  unitsCollection,
  useCollection,
  type Course,
  type CourseLevel,
  type Kobo,
  type Mode,
  type UnitId,
} from '@/mocks'

import {
  FORMATS,
  Screen,
  ScreenError,
  learnToast,
  unitTagOf,
  useScreenError,
  useScreenLoading,
} from './common'
import { courseCodeTaken, createCourse, suggestCourseCode } from './writes'

export default function Courses() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:courses')
  const { errored, retry } = useScreenError()
  const courses = useCollection(coursesCollection)
  useCollection(lessonsCollection)

  const [creating, setCreating] = useState(false)

  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const status = params.get('status') ?? undefined
  const level = params.get('level') ?? undefined
  const coverage = params.get('coverage') ?? undefined

  const matrix = useMemo(() => contentCoverageMatrix(), [])
  const coverageById = useMemo(() => new Map(matrix.map((m) => [m.courseId as string, m])), [matrix])

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return courses.filter((c) => {
      if (status && c.status !== status) return false
      if (level && c.level !== level) return false
      if (coverage) {
        const row = coverageById.get(c.id)
        const complete = row?.complete ?? false
        if (coverage === 'complete' && !complete) return false
        if (coverage === 'incomplete' && complete) return false
      }
      if (q && !`${c.title} ${c.code} ${c.tags.join(' ')}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [courses, search, status, level, coverage, coverageById])

  const hasFilters = Boolean(search || status || level || coverage)

  const columns: Array<Column<Course>> = [
    {
      key: 'title',
      header: 'Course',
      minWidth: 260,
      pinned: true,
      cell: (c) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 font-medium text-text">{c.title}</div>
          <div className="truncate text-body-12 text-text-muted">{c.summary}</div>
        </div>
      ),
      sortValue: (c) => c.title,
    },
    { key: 'code', header: 'Code', width: 92, accessor: (c) => <span className="font-mono text-body-12">{c.code}</span>, sortValue: (c) => c.code },
    {
      key: 'unit',
      header: 'Unit',
      width: 110,
      cell: (c) => {
        const unit = unitTagOf(c.unitId)
        return unit ? <UnitTag unit={unit} size="sm" /> : <span className="text-text-muted">—</span>
      },
      sortValue: (c) => c.unitId,
    },
    { key: 'level', header: 'Level', width: 110, accessor: (c) => humanize(c.level), sortValue: (c) => c.level },
    {
      key: 'lessons',
      header: 'Lessons',
      align: 'right',
      width: 90,
      accessor: (c) => formatNumber(lessonsCollection.count((l) => l.courseId === c.id)),
      sortValue: (c) => lessonsCollection.count((l) => l.courseId === c.id),
    },
    {
      key: 'coverage',
      header: 'Format coverage',
      width: 210,
      cell: (c) => {
        const row = coverageById.get(c.id)
        if (!row) return <span className="text-text-muted">—</span>
        return (
          <div className="flex items-center gap-1.5">
            {FORMATS.map((meta) => {
              const cell = row.formats.find((f) => f.format === meta.format)
              const complete = cell ? cell.total > 0 && cell.have === cell.total : false
              return (
                <span
                  key={meta.format}
                  title={`${meta.label}: ${cell?.have ?? 0}/${cell?.total ?? 0}`}
                  className={
                    complete
                      ? 'rounded-sm bg-accent-subtle px-1 text-[10px] font-bold leading-4 text-accent'
                      : 'rounded-sm border border-dashed border-border-strong px-1 text-[10px] font-bold leading-4 text-text-muted'
                  }
                >
                  {meta.letter}
                </span>
              )
            })}
            {row.complete && (
              <Badge tone="success" size="sm">
                Complete
              </Badge>
            )}
          </div>
        )
      },
      sortValue: (c) => {
        const row = coverageById.get(c.id)
        if (!row) return 0
        return row.formats.reduce((acc, f) => acc + (f.total ? f.have / f.total : 0), 0)
      },
    },
    {
      key: 'enrolled',
      header: 'Enrolled',
      align: 'right',
      width: 90,
      accessor: (c) => formatNumber(c.stats.totalEnrolled),
      sortValue: (c) => c.stats.totalEnrolled,
    },
    {
      key: 'completion',
      header: 'Completion',
      align: 'right',
      width: 100,
      accessor: (c) => `${c.stats.completionRate}%`,
      sortValue: (c) => c.stats.completionRate,
    },
    {
      key: 'price',
      header: 'List price',
      align: 'right',
      width: 120,
      accessor: (c) => formatNaira(c.listPrice),
      sortValue: (c) => c.listPrice,
    },
    {
      key: 'status',
      header: 'Status',
      width: 110,
      cell: (c) => <StatusBadge status={c.status} />,
      sortValue: (c) => c.status,
    },
  ]

  return (
    <Screen wide>
      <PageHeader
        title="Courses"
        description="Fifteen courses. Two are genuinely multi-format; the rest still need audio, podcast, slides or transcripts."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            New course
          </Button>
        }
      />

      {errored ? (
        <ScreenError what="The course list" onRetry={retry} />
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <div className="px-4 pt-4">
              <FilterBar
                search={search}
                onSearchChange={(v) => setParam('q', v || undefined)}
                searchPlaceholder="Search courses, codes and tags"
                values={{ status, level, coverage }}
                onFilterChange={(key, value) => setParam(key, value)}
                onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    options: [
                      { value: 'published', label: 'Published' },
                      { value: 'draft', label: 'Draft' },
                      { value: 'archived', label: 'Archived' },
                    ],
                  },
                  {
                    key: 'level',
                    label: 'Level',
                    options: [
                      { value: 'beginner', label: 'Beginner' },
                      { value: 'intermediate', label: 'Intermediate' },
                      { value: 'advanced', label: 'Advanced' },
                    ],
                  },
                  {
                    key: 'coverage',
                    label: 'Format coverage',
                    options: [
                      { value: 'complete', label: 'All five formats' },
                      { value: 'incomplete', label: 'Has gaps' },
                    ],
                  },
                ]}
              />
            </div>

            {loading ? (
              <div className="p-4">
                <SkeletonTable rows={10} columns={8} />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6">
                {hasFilters ? (
                  <EmptyState
                    variant="search"
                    title="No courses match these filters"
                    message="Loosen a filter or clear them all."
                    action={
                      <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={BookOpen}
                    title="No courses yet"
                    message="Nothing can be enrolled, taught or certified until a course exists."
                    action={
                      <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
                        New course
                      </Button>
                    }
                  />
                )}
              </div>
            ) : (
              <DataTable
                data={filtered}
                columns={columns}
                rowKey={(c) => c.id}
                density="compact"
                stickyHeader
                caption="Course catalogue"
                onRowClick={(c) => navigate(`/learn/courses/${c.id}/builder`)}
                defaultSort={{ key: 'title', direction: 'asc' }}
              />
            )}
          </CardBody>
        </Card>
      )}

      <NewCourseModal open={creating} onClose={() => setCreating(false)} />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* New course                                                                 */
/* -------------------------------------------------------------------------- */

const MODES: Array<{ value: Mode; label: string }> = [
  { value: 'on_campus', label: 'On campus' },
  { value: 'virtual', label: 'Virtual' },
  { value: 'hybrid', label: 'Hybrid' },
]

const LEVELS: Array<{ value: CourseLevel; label: string }> = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

/**
 * One modal, one insert, then straight into the builder — a course has no
 * sequencing worth a wizard. Everything past this point (modules, lessons,
 * formats, price changes, certificate rules) is the builder's job, and the
 * builder already does it.
 */
function NewCourseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const units = useCollection(unitsCollection)

  const [title, setTitle] = useState('')
  const [code, setCode] = useState('')
  const [summary, setSummary] = useState('')
  const [unitId, setUnitId] = useState('')
  const [level, setLevel] = useState<CourseLevel>('beginner')
  const [weeks, setWeeks] = useState(12)
  const [modes, setModes] = useState<Mode[]>(['on_campus'])
  const [listPrice, setListPrice] = useState<number | null>(null)
  const [touched, setTouched] = useState(false)

  const suggested = title.trim() ? suggestCourseCode(title) : ''
  const effectiveCode = (code || suggested).toUpperCase()
  const codeClash = effectiveCode !== '' && courseCodeTaken(effectiveCode)

  const titleError = touched && !title.trim() ? 'A course needs a name before anything can reference it.' : undefined
  const codeError = codeClash
    ? `${effectiveCode} already belongs to another course. Codes appear on invoices and certificates, so they never collide.`
    : touched && !effectiveCode
      ? 'Give the course a code.'
      : undefined
  const unitError = touched && !unitId ? 'Every course belongs to a unit — this is what makes per-unit P&L possible.' : undefined
  const modesError = touched && modes.length === 0 ? 'Pick at least one delivery mode.' : undefined

  function reset() {
    setTitle('')
    setCode('')
    setSummary('')
    setUnitId('')
    setLevel('beginner')
    setWeeks(12)
    setModes(['on_campus'])
    setListPrice(null)
    setTouched(false)
  }

  function submit() {
    setTouched(true)
    if (!title.trim() || !effectiveCode || codeClash || !unitId || modes.length === 0) return

    const course = createCourse({
      title,
      code: effectiveCode,
      summary,
      unitId: unitId as UnitId,
      level,
      durationWeeks: weeks,
      modes,
      listPrice: (listPrice ?? 0) as Kobo,
    })

    learnToast.success(
      `${course.code} created as a draft`,
      'Add modules and lessons in the builder. Nothing is published until you say so.',
    )
    reset()
    onClose()
    navigate(`/learn/courses/${course.id}/builder`)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="New course"
      description="A catalogue entry. Cohorts, enrolments and certificates all hang off this record, so the code and the unit matter more than the prose."
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
          <Button onClick={submit}>Create and open the builder</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Title" required error={titleError} id="course-title">
          <Input
            id="course-title"
            value={title}
            invalid={Boolean(titleError)}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Product Design"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Code"
            required
            error={codeError}
            hint={suggested && !code ? `Suggested from the title: ${suggested}` : 'Appears on invoices and certificates.'}
            id="course-code"
          >
            <Input
              id="course-code"
              value={code || suggested}
              invalid={Boolean(codeError)}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
              rightSlot={
                effectiveCode && !codeClash ? (
                  <Badge tone="success" variant="subtle" size="sm">
                    Available
                  </Badge>
                ) : undefined
              }
            />
          </Field>

          <Field label="Unit" required error={unitError} id="course-unit">
            <Select
              id="course-unit"
              value={unitId}
              invalid={Boolean(unitError)}
              placeholder="Choose a unit"
              options={units.map((u) => ({ value: u.id, label: u.name }))}
              onChange={(e) => setUnitId(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Summary" hint="One line. Shown on the catalogue row under the title." id="course-summary">
          <Textarea
            id="course-summary"
            rows={2}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What a learner can do by the end of it."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Level" id="course-level">
            <Select
              id="course-level"
              value={level}
              options={LEVELS}
              onChange={(e) => setLevel(e.target.value as CourseLevel)}
            />
          </Field>
          <Field label="Duration" id="course-weeks">
            <Input
              id="course-weeks"
              type="number"
              min={1}
              max={104}
              suffix="weeks"
              value={weeks}
              onChange={(e) => setWeeks(Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
          <Field label="List price" hint="Held in kobo. A cohort can still quote its own fee." id="course-price">
            <CurrencyInput id="course-price" value={listPrice} onChange={setListPrice} />
          </Field>
        </div>

        <Field label="Delivery modes" required error={modesError}>
          <div className="flex flex-wrap gap-4">
            {MODES.map((mode) => (
              <Checkbox
                key={mode.value}
                checked={modes.includes(mode.value)}
                label={mode.label}
                onChange={(e) =>
                  setModes((prev) =>
                    e.target.checked ? [...prev, mode.value] : prev.filter((m) => m !== mode.value),
                  )
                }
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}
