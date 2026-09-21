/**
 * Learn dashboard — `/learn`.
 *
 * The PRD's warning about multi-format is that it is a content operation, not
 * a software feature: every lesson needs a video, an audio cut, a deck and a
 * transcript. The **content coverage matrix** is the tool that makes the size
 * of that job visible, which is why it states the backlog in assets rather
 * than percentages.
 *
 * This used to be ten stat cards in a flat grid, the matrix, and three more
 * panels, all in one scroll. Now it opens on one headline per theme plus the
 * five worst coverage gaps — the thing worth seeing whatever you came for —
 * and each theme keeps its full band and its charts behind a named tab. The
 * tab lives in the query string, so a view is a link.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Award, BookOpen, Clock, GraduationCap, Layers, Plus, Users } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber, formatRelative } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  ProgressBar,
  SearchInput,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  Switch,
  TabPanel,
  Tabs,
  type Column,
} from '@/ui'
import {
  MTD,
  activeLearners,
  certificateEligibility,
  certificatesCollection,
  cohortsCollection,
  contentCoverageMatrix,
  coursesCollection,
  coursesWithFullMultiFormat,
  enrollmentsCollection,
  gradingBacklog,
  lessonsCollection,
  medianGradingTurnaroundDays,
  progressCollection,
  quizzesCollection,
  submissionsCollection,
  tutorAssignmentsCollection,
  useCollection,
  videoOnlyCourses,
} from '@/mocks'

import {
  CoverageCell,
  FORMATS,
  Screen,
  ScreenError,
  median,
  personName,
  useScreenError,
  useScreenLoading,
} from './common'

type CoverageRow = ReturnType<typeof contentCoverageMatrix>[number]

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'content', label: 'Content coverage' },
  { id: 'learners', label: 'Learners' },
  { id: 'grading', label: 'Grading' },
  { id: 'certificates', label: 'Certificates' },
]

export default function LearnDashboard() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:dashboard')
  const { errored, retry } = useScreenError()
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  // Subscribing to the collections is what keeps every number below live: fill
  // a format gap in the lesson editor and this screen moves.
  const lessons = useCollection(lessonsCollection)
  const courses = useCollection(coursesCollection)
  useCollection(submissionsCollection)
  useCollection(progressCollection)
  const certificates = useCollection(certificatesCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const quizzes = useCollection(quizzesCollection)
  const tutorAssignments = useCollection(tutorAssignmentsCollection)
  const cohorts = useCollection(cohortsCollection)

  const [matrixQuery, setMatrixQuery] = useState('')
  const [hideComplete, setHideComplete] = useState(false)

  /* ---- Content: the module's signature number --------------------------- */

  const content = useMemo(() => {
    const matrix = contentCoverageMatrix()
    const backlogByFormat = FORMATS.map((meta) => ({
      ...meta,
      missing: matrix.reduce((acc, row) => {
        const cell = row.formats.find((f) => f.format === meta.format)
        return acc + (cell ? cell.total - cell.have : 0)
      }, 0),
    }))
    return {
      matrix,
      backlogByFormat,
      totalMissing: backlogByFormat.reduce((acc, f) => acc + f.missing, 0),
      published: courses.filter((c) => c.status === 'published').length,
      fullMultiFormat: coursesWithFullMultiFormat(),
      videoOnly: videoOnlyCourses(),
      worst: [...matrix].sort((a, b) => gapOf(b) - gapOf(a)).slice(0, 5),
    }
  }, [courses, lessons])

  /* ---- Learners --------------------------------------------------------- */

  const learners = useMemo(() => {
    const rows = progressCollection.all()
    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)
    const buckets = [
      { label: '0–20%', min: 0, max: 20 },
      { label: '21–40%', min: 21, max: 40 },
      { label: '41–60%', min: 41, max: 60 },
      { label: '61–80%', min: 61, max: 80 },
      { label: '81–100%', min: 81, max: 100 },
    ]
    return {
      active: activeLearners(),
      lessonsCompleted7d: rows.reduce(
        (acc, p) => acc + p.perLesson.filter((l) => l.completedAt !== null && l.completedAt.slice(0, 10) >= cutoff).length,
        0,
      ),
      medianProgress: median(
        rows
          .filter((p) => enrollments.find((e) => e.id === p.enrollmentId)?.status === 'active')
          .map((p) => p.percentComplete),
      ),
      histogram: buckets.map((b) => ({
        label: b.label,
        count: rows.filter((p) => p.percentComplete >= b.min && p.percentComplete <= b.max).length,
      })),
      lowActivity: rows
        .map((p) => ({ p, enrolment: enrollments.find((e) => e.id === p.enrollmentId) }))
        .filter((row) => row.enrolment?.status === 'active' && row.p.daysInactive >= 10)
        .sort((a, b) => b.p.daysInactive - a.p.daysInactive)
        .slice(0, 8),
    }
  }, [enrollments])

  /* ---- Grading ---------------------------------------------------------- */

  const grading = useMemo(() => {
    const backlog = gradingBacklog()
    const byTutor = new Map<string, { name: string; count: number; oldest: number }>()
    for (const sub of backlog) {
      const enrolment = enrollments.find((e) => e.id === sub.enrollmentId)
      const assignment = enrolment
        ? tutorAssignments.find((t) => t.cohortId === enrolment.cohortId && t.status === 'active' && t.role === 'lead')
        : undefined
      const key = assignment?.tutorPersonId ?? 'unassigned'
      const row = byTutor.get(key) ?? { name: personName(assignment?.tutorPersonId ?? null), count: 0, oldest: 0 }
      row.count += 1
      row.oldest = Math.max(row.oldest, sub.daysWaiting)
      byTutor.set(key, row)
    }
    return {
      backlog,
      turnaround: medianGradingTurnaroundDays(),
      byTutor: [...byTutor.values()].sort((a, b) => b.count - a.count),
      quizPassRate: (() => {
        const attempts = quizzes.reduce((acc, q) => acc + q.stats.attempts, 0)
        if (!attempts) return 0
        return Math.round(quizzes.reduce((acc, q) => acc + q.stats.passRate * q.stats.attempts, 0) / attempts)
      })(),
    }
  }, [enrollments, tutorAssignments, quizzes])

  /* ---- Certificates: the queue's live state, not the seeded rows -------- */

  const certificateBand = useMemo(() => {
    const issuedMtd = certificates.filter(
      (c) =>
        c.status === 'issued' &&
        (c.issuedAt ?? '').slice(0, 10) >= MTD.from &&
        (c.issuedAt ?? '').slice(0, 10) <= MTD.to,
    ).length

    const waiting = certificates.filter((c) => c.status === 'eligible_not_issued')
    const readyNow = waiting.filter((c) => certificateEligibility(c.enrollmentId).eligible)
    const withCertificate = new Set(certificates.map((c) => c.enrollmentId as string))
    const uncovered = enrollments.filter(
      (e) =>
        !withCertificate.has(e.id) &&
        (e.status === 'completed' || e.status === 'active') &&
        certificateEligibility(e.id).eligible,
    ).length

    return {
      issuedMtd,
      waiting: waiting.length,
      ready: readyNow.length + uncovered,
      blocked: waiting.length - readyNow.length,
      alumni: certificates.filter((c) => c.status === 'issued').length,
    }
  }, [certificates, enrollments])

  const visibleMatrix = useMemo(() => {
    const q = matrixQuery.trim().toLowerCase()
    return content.matrix
      .filter((row) => (hideComplete ? !row.complete : true))
      .filter((row) => !q || row.title.toLowerCase().includes(q) || row.code.toLowerCase().includes(q))
      .sort((a, b) => gapOf(b) - gapOf(a))
  }, [content.matrix, matrixQuery, hideComplete])

  const matrixColumns: Array<Column<CoverageRow>> = [
    {
      key: 'course',
      header: 'Course',
      pinned: true,
      minWidth: 240,
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 font-medium text-text">{row.title}</div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="font-mono text-body-12 text-text-muted">{row.code}</span>
            {row.complete && (
              <Badge tone="success" size="sm">
                Full multi-format
              </Badge>
            )}
          </div>
        </div>
      ),
      sortValue: (row) => row.title,
    },
    ...FORMATS.map<Column<CoverageRow>>((meta) => ({
      key: meta.format,
      header: meta.label,
      align: 'left',
      width: 128,
      cell: (row) => {
        const cell = row.formats.find((f) => f.format === meta.format)
        if (!cell) return null
        return (
          <CoverageCell
            have={cell.have}
            total={cell.total}
            courseTitle={row.title}
            formatLabel={meta.label}
            onClick={
              cell.have === cell.total
                ? undefined
                : () => navigate(`/learn/courses/${row.courseId}/builder?missing=${meta.format}`)
            }
          />
        )
      },
      sortValue: (row) => {
        const cell = row.formats.find((f) => f.format === meta.format)
        return cell && cell.total ? cell.have / cell.total : -1
      },
    })),
    {
      key: 'gap',
      header: 'Assets to produce',
      align: 'right',
      width: 150,
      cell: (row) => {
        const gap = gapOf(row)
        return gap === 0 ? (
          <span className="text-body-13 text-text-muted">None</span>
        ) : (
          <span className="text-body-13 font-semibold tabular-nums text-danger-text">{formatNumber(gap)}</span>
        )
      },
      sortValue: (row) => gapOf(row),
    },
  ]

  return (
    <Screen wide>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-heading-24">Cirvee Learn</h1>
          <p className="mt-1 max-w-2xl text-body-14 text-text-secondary">
            Every lesson should exist as video, audio, podcast, slides and transcript, and the learner picks. This
            screen shows how far the library is from that.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/learn/library')}>
            Content library
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/learn/courses')}>
            New course
          </Button>
        </div>
      </div>

      {errored ? (
        <ScreenError what="The Learn dashboard" onRetry={retry} />
      ) : loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} variant="stat" />
            ))}
          </div>
          <SkeletonTable rows={8} columns={7} />
        </div>
      ) : (
        <>
          <Tabs
            tabs={SECTIONS}
            value={tab}
            onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
            variant="pill"
            size="sm"
            aria-label="Dashboard sections"
            className="mb-5 w-fit"
          />

          {/* ---- Overview ----------------------------------------------- */}
          <TabPanel id="learn-overview" tabId="overview" active={tab === 'overview'} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <StatCard label="Published courses" value={content.published} icon={BookOpen} />
              <StatCard
                label="Courses with full multi-format"
                value={content.fullMultiFormat}
                variant={content.fullMultiFormat < content.published / 2 ? 'warning' : 'success'}
                caption={`${content.videoOnly} courses are video-only`}
                icon={Layers}
                onClick={() => query.set('tab', 'content')}
              />
              <StatCard label="Active learners" value={formatNumber(learners.active)} icon={Users} onClick={() => query.set('tab', 'learners')} />
              <StatCard
                label="Assignments awaiting grading"
                value={grading.backlog.length}
                variant={grading.backlog.length > 20 ? 'warning' : 'default'}
                caption="Open the grading queue"
                icon={Clock}
                onClick={() => navigate('/learn/submissions')}
              />
              <StatCard
                label="Assets still to produce"
                value={formatNumber(content.totalMissing)}
                variant="danger"
                caption="Across every published course"
                onClick={() => query.set('tab', 'content')}
              />
            </div>

            <Card>
              <CardHeader
                title="Where the library is thinnest"
                description="The five courses with the largest production backlog. Every other course, every format and the search are on the content coverage tab."
                actions={
                  <Button size="sm" variant="link" onClick={() => query.set('tab', 'content')}>
                    Open the full matrix
                  </Button>
                }
              />
              <CardBody className="space-y-4">
                {content.worst.filter((row) => gapOf(row) > 0).length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={Layers}
                    title="Every course carries all five formats"
                    message="There is no production backlog. The coverage matrix confirms it course by course."
                  />
                ) : (
                  content.worst
                    .filter((row) => gapOf(row) > 0)
                    .map((row) => {
                      const total = row.formats.reduce((acc, f) => acc + f.total, 0)
                      const have = row.formats.reduce((acc, f) => acc + f.have, 0)
                      return (
                        <ProgressBar
                          key={row.courseId}
                          value={have}
                          max={Math.max(1, total)}
                          tone={have / Math.max(1, total) < 0.4 ? 'danger' : 'warning'}
                          label={`${row.code} · ${row.title}`}
                          valueLabel={`${formatNumber(gapOf(row))} assets to produce`}
                        />
                      )
                    })
                )}
              </CardBody>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Answer
                label="Content"
                text={`${formatNumber(content.totalMissing)} assets to record, cut, design or transcribe before the catalogue is genuinely multi-format.`}
              />
              <Answer
                label="Learners"
                text={`Median course progress is ${learners.medianProgress}%, and ${learners.lowActivity.length} active learners have gone quiet for ten days or more.`}
              />
              <Answer
                label="Grading"
                text={
                  grading.backlog.length === 0
                    ? 'The grading queue is clear.'
                    : `${grading.backlog.length} submissions are waiting, with a median turnaround of ${grading.turnaround} days.`
                }
              />
              <Answer
                label="Certificates"
                text={
                  certificateBand.ready > 0
                    ? `${certificateBand.ready} learners have met every criterion and have not been issued one yet.`
                    : `${certificateBand.issuedMtd} issued this month and nobody is waiting.`
                }
              />
            </div>
          </TabPanel>

          {/* ---- Content coverage --------------------------------------- */}
          <TabPanel id="learn-content" tabId="content" active={tab === 'content'} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Published courses" value={content.published} icon={BookOpen} />
              <StatCard
                label="Courses with full multi-format"
                value={content.fullMultiFormat}
                variant={content.fullMultiFormat < content.published / 2 ? 'warning' : 'success'}
                caption={`${content.videoOnly} courses are video-only`}
                icon={Layers}
              />
              <StatCard label="Lessons in the library" value={formatNumber(lessons.length)} />
              <StatCard
                label="Assets still to produce"
                value={formatNumber(content.totalMissing)}
                variant="danger"
                caption="Across every published course"
              />
            </div>

            <Card>
              <CardHeader
                title="Content coverage matrix"
                description="Courses down, formats across. A cell is the number of content lessons that already have that format. Click a gap to open the course builder on it."
                actions={
                  <div className="flex items-center gap-3">
                    <Switch checked={hideComplete} onChange={setHideComplete} size="sm" label="Only courses with gaps" />
                    <SearchInput
                      value={matrixQuery}
                      onChange={setMatrixQuery}
                      inputSize="sm"
                      placeholder="Find a course"
                      containerClassName="w-56"
                    />
                  </div>
                }
              />
              <CardBody padding="none">
                <div className="flex flex-wrap items-center gap-2 border-b border-border px-6 py-3">
                  <span className="text-body-12 font-semibold uppercase tracking-wide text-text-label">
                    Production backlog
                  </span>
                  {content.backlogByFormat.map((f) => (
                    <Badge key={f.format} tone={f.missing === 0 ? 'success' : 'danger'} variant="subtle">
                      {f.label}: {formatNumber(f.missing)}
                    </Badge>
                  ))}
                  <span className="ml-auto text-body-12 text-text-secondary">
                    {formatNumber(content.totalMissing)} assets to record, cut, design or transcribe before the
                    catalogue is genuinely multi-format.
                  </span>
                </div>

                {visibleMatrix.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      variant="search"
                      title="No courses match this filter"
                      message="Clear the search or show completed courses again."
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setMatrixQuery('')
                            setHideComplete(false)
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <DataTable
                    data={visibleMatrix}
                    columns={matrixColumns}
                    rowKey={(row) => row.courseId}
                    density="compact"
                    stickyHeader
                    caption="Content coverage by course and format"
                    maxHeight={520}
                    bordered={false}
                  />
                )}
              </CardBody>
            </Card>

            <p className="text-body-12 text-text-muted">
              Coverage recalculated {formatRelative(new Date())} from {formatNumber(lessons.length)} lessons.
            </p>
          </TabPanel>

          {/* ---- Learners ------------------------------------------------ */}
          <TabPanel id="learn-learners" tabId="learners" active={tab === 'learners'} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Active learners" value={formatNumber(learners.active)} icon={Users} />
              <StatCard label="Lessons completed (7d)" value={formatNumber(learners.lessonsCompleted7d)} />
              <StatCard label="Median course progress" value={`${learners.medianProgress}%`} />
              <StatCard
                label="Quiet for ten days or more"
                value={formatNumber(learners.lowActivity.length)}
                variant={learners.lowActivity.length > 0 ? 'warning' : 'success'}
                caption="Advisory only — nothing here acts on its own"
                icon={AlertTriangle}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Progress distribution" description="Learners by percentage of the course completed." />
                <CardBody>
                  <div className="space-y-3">
                    {learners.histogram.map((bucket) => {
                      const max = Math.max(...learners.histogram.map((b) => b.count), 1)
                      return (
                        <div key={bucket.label}>
                          <div className="mb-1 flex items-baseline justify-between text-body-12">
                            <span className="text-text-secondary">{bucket.label}</span>
                            <span className="font-semibold tabular-nums text-text">{formatNumber(bucket.count)}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-surface-sunken">
                            <div className="h-full rounded-full bg-accent" style={{ width: `${(bucket.count / max) * 100}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Low-activity learners"
                  description="Advisory only. Nothing here acts on its own."
                  actions={
                    <Button size="sm" variant="link" onClick={() => navigate('/learn/progress')}>
                      Open progress
                    </Button>
                  }
                />
                <CardBody padding="none">
                  {learners.lowActivity.length === 0 ? (
                    <div className="p-6">
                      <EmptyState
                        size="sm"
                        icon={AlertTriangle}
                        title="Everyone has been active in the last ten days"
                        message="No learner has gone quiet long enough to flag."
                      />
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {learners.lowActivity.map(({ p, enrolment }) => {
                        const cohort = cohorts.find((c) => c.id === enrolment?.cohortId)
                        const lastLesson = lessons.find((l) => l.id === p.lastLessonId)
                        return (
                          <li key={p.id} className="flex items-start gap-3 px-6 py-2.5">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-body-13 font-medium text-text">{personName(p.personId)}</div>
                              <div className="truncate text-body-12 text-text-secondary">
                                {cohort?.code ?? '—'} · {lastLesson?.title ?? 'No lesson started'}
                              </div>
                            </div>
                            <span
                              className={cn(
                                'shrink-0 text-body-12 font-semibold tabular-nums',
                                p.daysInactive >= 21 ? 'text-danger-text' : 'text-warning-text',
                              )}
                            >
                              {p.daysInactive}d
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </TabPanel>

          {/* ---- Grading ------------------------------------------------- */}
          <TabPanel id="learn-grading" tabId="grading" active={tab === 'grading'} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Assignments awaiting grading"
                value={grading.backlog.length}
                variant={grading.backlog.length > 20 ? 'warning' : 'default'}
                icon={Clock}
                caption="Open the grading queue"
                onClick={() => navigate('/learn/submissions')}
              />
              <StatCard label="Median grading turnaround" value={`${grading.turnaround} days`} />
              <StatCard
                label="Waiting five days or more"
                value={formatNumber(grading.backlog.filter((s) => s.daysWaiting >= 5).length)}
                variant={grading.backlog.some((s) => s.daysWaiting >= 5) ? 'danger' : 'success'}
              />
              <StatCard label="Quiz pass rate" value={`${grading.quizPassRate}%`} onClick={() => navigate('/learn/quizzes')} />
            </div>

            <Card>
              <CardHeader
                title="Grading backlog by tutor"
                description="Oldest waiting submission per tutor."
                actions={
                  <Button size="sm" variant="link" onClick={() => navigate('/learn/submissions')}>
                    Open queue
                  </Button>
                }
              />
              <CardBody>
                {grading.byTutor.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={Clock}
                    title="Nothing awaiting grading"
                    message="Every submission has been marked. The queue is clear."
                  />
                ) : (
                  <ul className="space-y-3">
                    {grading.byTutor.slice(0, 8).map((row) => (
                      <li key={row.name}>
                        <div className="mb-1 flex items-baseline justify-between gap-2">
                          <span className="truncate text-body-13 text-text">{row.name}</span>
                          <span className="shrink-0 text-body-12 text-text-secondary">
                            {row.count} waiting · oldest {row.oldest}d
                          </span>
                        </div>
                        <ProgressBar
                          value={row.count}
                          max={Math.max(...grading.byTutor.map((t) => t.count))}
                          tone={row.oldest >= 5 ? 'danger' : 'accent'}
                          size="sm"
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </TabPanel>

          {/* ---- Certificates -------------------------------------------- */}
          <TabPanel id="learn-certificates" tabId="certificates" active={tab === 'certificates'} className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Certificates issued (MTD)"
                value={certificateBand.issuedMtd}
                icon={GraduationCap}
                onClick={() => navigate('/learn/certificates')}
              />
              <StatCard
                label="Eligible, not issued"
                value={formatNumber(certificateBand.ready)}
                variant={certificateBand.ready > 0 ? 'warning' : 'success'}
                icon={Award}
                caption="Every criterion met, still waiting on a human"
                onClick={() => navigate('/learn/certificates?filter=eligible_not_issued')}
              />
              <StatCard
                label="Blocked"
                value={formatNumber(certificateBand.blocked)}
                variant={certificateBand.blocked > 0 ? 'danger' : 'default'}
                caption="Mostly financial clearance, which is a course rule"
                onClick={() => navigate('/learn/certificates')}
              />
              <StatCard label="Certificates issued, all time" value={formatNumber(certificateBand.alumni)} />
            </div>

            <Card>
              <CardHeader
                title="What issuing one does"
                description="A certificate is not a row. It is the moment a student becomes an alumnus, and four other records exist because of it."
                actions={
                  <Button size="sm" onClick={() => navigate('/learn/certificates')}>
                    Open the queue
                  </Button>
                }
              />
              <CardBody>
                <ol className="space-y-2">
                  {[
                    'The certificate itself, with a public verification id that survives revocation.',
                    'An alumnus relationship on the Person record, alongside whatever else they already are.',
                    'An outcome record, opened not answered, with 3, 6 and 12-month checkpoints scheduled.',
                    'A review request on the satisfaction moment — a graduation, not a random Tuesday.',
                    'A graduation proof asset, drafted with consent pending. Nothing is published on this alone.',
                  ].map((line, i) => (
                    <li key={line} className="flex gap-3 rounded-xl border border-border px-3 py-2.5">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-subtle text-body-12 font-semibold text-accent">
                        {i + 1}
                      </span>
                      <span className="text-body-13 text-text">{line}</span>
                    </li>
                  ))}
                </ol>
              </CardBody>
            </Card>
          </TabPanel>
        </>
      )}
    </Screen>
  )
}

function gapOf(row: CoverageRow): number {
  return row.formats.reduce((acc, f) => acc + (f.total - f.have), 0)
}

/** One theme's takeaway in a sentence, so the Overview says what it means. */
function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-label-11 text-text-label">{label}</div>
      <p className="mt-1 text-body-13 text-text-secondary">{text}</p>
    </div>
  )
}
