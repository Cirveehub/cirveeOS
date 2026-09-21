/**
 * Content library — `/learn/library`.
 *
 * Two jobs. One: an inventory of every content asset, filterable by the things
 * a content operation actually asks ("what is over 40 MB", "what has no
 * transcript", "what is not downloadable"). Two: **full-text search across
 * transcripts** — the payoff for insisting every lesson has one.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, FileSearch, LayoutGrid, Rows3, Upload } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  BulkActionBar,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  SkeletonTable,
  StatusBadge,
  Switch,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  contentAssetsCollection,
  courseModulesCollection,
  coursesCollection,
  lessonsCollection,
  searchTranscripts,
  useCollection,
  type ContentAsset,
  type ContentFormat,
} from '@/mocks'
import { assetId as asAssetId } from '@/mocks/types'

import {
  FORMATS,
  Screen,
  ScreenError,
  formatBytes,
  formatDuration,
  formatMeta,
  learnToast,
  nowIso,
  personName,
  userName,
  useScreenError,
  useScreenLoading,
} from './common'

export default function ContentLibrary() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:library')
  const { errored, retry } = useScreenError()

  const assets = useCollection(contentAssetsCollection)
  const lessons = useCollection(lessonsCollection)
  const modules = useCollection(courseModulesCollection)
  const courses = useCollection(coursesCollection)

  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<'list' | 'gallery'>('list')
  const [selected, setSelected] = useState<string[]>([])
  const [uploadOpen, setUploadOpen] = useState(false)

  const search = params.get('q') ?? ''
  const transcriptQuery = params.get('transcript') ?? ''
  const format = params.get('format') ?? undefined
  const course = params.get('course') ?? undefined
  const status = params.get('status') ?? undefined
  const minSize = params.get('size') ?? undefined
  const offline = params.get('offline') ?? undefined

  function setParam(key: string, value: string | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const lessonById = useMemo(() => new Map(lessons.map((l) => [l.id as string, l])), [lessons])
  const moduleById = useMemo(() => new Map(modules.map((m) => [m.id as string, m])), [modules])
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id as string, c])), [courses])

  const transcriptHits = useMemo(
    () => (transcriptQuery.trim() ? searchTranscripts(transcriptQuery) : []),
    // `assets` is in the dependency list so a transcript saved in the lesson
    // editor turns up here without a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transcriptQuery, assets],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return assets.filter((a) => {
      const lesson = lessonById.get(a.lessonId)
      if (format && a.format !== format) return false
      if (status && a.status !== status) return false
      if (course && lesson?.courseId !== course) return false
      if (minSize && a.fileSizeBytes < Number(minSize)) return false
      if (offline === 'yes' && !a.offlineEnabled) return false
      if (offline === 'no' && a.offlineEnabled) return false
      if (q && !`${a.fileName} ${lesson?.title ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [assets, lessonById, search, format, status, course, minSize, offline])

  const hasFilters = Boolean(search || format || course || status || minSize || offline)

  const columns: Array<Column<ContentAsset>> = [
    {
      key: 'fileName',
      header: 'Asset',
      minWidth: 240,
      pinned: true,
      cell: (a) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 font-medium text-text">{a.fileName}</div>
          <div className="truncate text-body-12 text-text-muted">
            {lessonById.get(a.lessonId)?.title ?? 'Detached asset'}
          </div>
        </div>
      ),
      sortValue: (a) => a.fileName,
    },
    {
      key: 'format',
      header: 'Format',
      width: 120,
      cell: (a) => <Badge tone="accent" size="sm">{formatMeta(a.format).label}</Badge>,
      sortValue: (a) => a.format,
    },
    {
      key: 'course',
      header: 'Course',
      width: 170,
      accessor: (a) => courseById.get(lessonById.get(a.lessonId)?.courseId ?? '')?.title ?? '—',
      sortValue: (a) => courseById.get(lessonById.get(a.lessonId)?.courseId ?? '')?.title ?? '',
    },
    {
      key: 'module',
      header: 'Module',
      width: 150,
      accessor: (a) => moduleById.get(lessonById.get(a.lessonId)?.moduleId ?? '')?.title ?? '—',
      sortValue: (a) => moduleById.get(lessonById.get(a.lessonId)?.moduleId ?? '')?.title ?? '',
    },
    {
      key: 'length',
      header: 'Duration / pages',
      align: 'right',
      width: 130,
      accessor: (a) =>
        a.durationSeconds !== undefined
          ? formatDuration(a.durationSeconds)
          : a.pageCount !== undefined
            ? `${a.pageCount} pages`
            : '—',
      sortValue: (a) => a.durationSeconds ?? a.pageCount ?? 0,
    },
    {
      key: 'size',
      header: 'Size',
      align: 'right',
      width: 96,
      accessor: (a) => formatBytes(a.fileSizeBytes),
      sortValue: (a) => a.fileSizeBytes,
    },
    { key: 'language', header: 'Language', width: 96, accessor: () => 'English' },
    { key: 'status', header: 'Status', width: 110, cell: (a) => <StatusBadge status={a.status} />, sortValue: (a) => a.status },
    { key: 'uploadedBy', header: 'Uploaded by', width: 150, accessor: (a) => userName(a.createdBy), sortValue: (a) => userName(a.createdBy) },
    { key: 'uploaded', header: 'Uploaded', width: 120, accessor: (a) => formatDate(a.createdAt), sortValue: (a) => a.createdAt },
    {
      key: 'downloads',
      header: 'Downloads',
      align: 'right',
      width: 100,
      accessor: (a) => formatNumber(a.downloadCount),
      sortValue: (a) => a.downloadCount,
    },
    {
      key: 'offline',
      header: 'Offline',
      width: 100,
      cell: (a) => (
        <Badge tone={a.offlineEnabled ? 'success' : 'neutral'} size="sm">
          {a.offlineEnabled ? 'Enabled' : 'Streaming'}
        </Badge>
      ),
      sortValue: (a) => a.offlineEnabled,
    },
  ]

  function openAsset(asset: ContentAsset) {
    const lesson = lessonById.get(asset.lessonId)
    if (!lesson) return
    navigate(`/learn/courses/${lesson.courseId}/modules/${lesson.moduleId}/lessons/${lesson.id}`)
  }

  return (
    <Screen wide>
      <PageHeader
        title="Content library"
        description={`${formatNumber(assets.length)} assets across every course. Transcripts are searchable by what was said in the lesson.`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              leftIcon={view === 'list' ? <LayoutGrid size={16} /> : <Rows3 size={16} />}
              onClick={() => setView(view === 'list' ? 'gallery' : 'list')}
            >
              {view === 'list' ? 'Gallery view' : 'List view'}
            </Button>
            <Button leftIcon={<Upload size={16} />} onClick={() => setUploadOpen(true)}>
              Upload asset
            </Button>
          </div>
        }
      />

      {errored ? (
        <div className="mt-4">
          <ScreenError what="The content library" onRetry={retry} />
        </div>
      ) : (
        <>
          <Card className="mt-4">
            <CardHeader
              title="Search transcripts"
              description="Full text across every transcript in the catalogue. This is why transcripts are required."
            />
            <CardBody className="space-y-3">
              <SearchInput
                value={transcriptQuery}
                onChange={(v) => setParam('transcript', v || undefined)}
                placeholder="Search what was said — try “regression”"
                aria-label="Search transcripts"
              />
              {transcriptQuery.trim() === '' ? (
                <p className="text-body-12 text-text-secondary">
                  Type a word or phrase. Lessons whose transcript contains it come back with the matching
                  passage.
                </p>
              ) : transcriptHits.length === 0 ? (
                <EmptyState
                  size="sm"
                  variant="search"
                  icon={FileSearch}
                  title={`No transcript contains “${transcriptQuery}”`}
                  message="Either nobody said it, or the lessons that cover it have no transcript yet."
                  action={
                    <Button variant="secondary" onClick={() => setParam('format', 'transcript')}>
                      Show transcript coverage
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {transcriptHits.map((hit) => {
                    const lesson = lessonById.get(hit.lessonId)
                    const courseTitle = courseById.get(hit.courseId)?.title ?? '—'
                    return (
                      <li key={hit.lessonId}>
                        <button
                          type="button"
                          onClick={() =>
                            lesson &&
                            navigate(
                              `/learn/courses/${lesson.courseId}/modules/${lesson.moduleId}/lessons/${lesson.id}`,
                            )
                          }
                          className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-body-13 font-medium text-text">{hit.lessonTitle}</span>
                            <span className="text-body-12 text-text-muted">{courseTitle}</span>
                          </div>
                          <p className="mt-1 text-body-12 text-text-secondary">
                            {highlight(hit.snippet, transcriptQuery)}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="mt-4">
            <CardBody padding="none">
              <div className="px-4 pt-4">
                <FilterBar
                  search={search}
                  onSearchChange={(v) => setParam('q', v || undefined)}
                  searchPlaceholder="Search file names and lessons"
                  values={{ format, course, status, size: minSize, offline }}
                  onFilterChange={(key, value) => setParam(key, value)}
                  onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                  filters={[
                    {
                      key: 'format',
                      label: 'Format',
                      options: FORMATS.map((f) => ({ value: f.format, label: f.label })),
                    },
                    {
                      key: 'course',
                      label: 'Course',
                      options: courses.map((c) => ({ value: c.id, label: c.title })),
                      width: 200,
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      options: [
                        { value: 'published', label: 'Published' },
                        { value: 'uploaded', label: 'Uploaded' },
                        { value: 'processing', label: 'Processing' },
                        { value: 'missing', label: 'Missing' },
                      ],
                    },
                    {
                      key: 'size',
                      label: 'Larger than',
                      options: [
                        { value: '10000000', label: '10 MB' },
                        { value: '40000000', label: '40 MB' },
                        { value: '200000000', label: '200 MB' },
                      ],
                    },
                    {
                      key: 'offline',
                      label: 'Offline',
                      options: [
                        { value: 'yes', label: 'Downloadable' },
                        { value: 'no', label: 'Streaming only' },
                      ],
                    },
                  ]}
                />
              </div>

              {selected.length > 0 && (
                <div className="px-4 pt-3">
                  <BulkActionBar count={selected.length} itemNoun="asset" onClearSelection={() => setSelected([])}>
                    <Button
                      size="sm"
                      variant="secondary"
                      leftIcon={<Download size={14} />}
                      onClick={() => {
                        selected.forEach((id) => {
                          const a = contentAssetsCollection.find(id)
                          if (a) contentAssetsCollection.update(id, { downloadCount: a.downloadCount + 1 })
                        })
                        learnToast.success(`${selected.length} assets queued for download`)
                      }}
                    >
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        contentAssetsCollection.updateWhere((a) => selected.includes(a.id), {
                          offlineEnabled: true,
                        })
                        learnToast.success(`Offline download enabled for ${selected.length} assets`)
                      }}
                    >
                      Enable offline
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        contentAssetsCollection.updateWhere((a) => selected.includes(a.id), {
                          archivedAt: nowIso(),
                          archivedReason: 'Archived in bulk from the content library',
                        })
                        learnToast.info(
                          `${selected.length} assets archived`,
                          'They stay in the library with an archived marker — nothing was deleted.',
                        )
                        setSelected([])
                      }}
                    >
                      Archive
                    </Button>
                  </BulkActionBar>
                </div>
              )}

              {loading ? (
                <div className="p-4">
                  <SkeletonTable rows={12} columns={9} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6">
                  {hasFilters ? (
                    <EmptyState
                      variant="search"
                      title="No assets match these filters"
                      message="Nothing in the library fits that combination."
                      action={
                        <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Upload}
                      title="The library is empty"
                      message="Until an asset exists, every lesson is a title with nothing behind it."
                      action={<Button onClick={() => setUploadOpen(true)}>Upload asset</Button>}
                    />
                  )}
                </div>
              ) : view === 'gallery' ? (
                <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                  {filtered.slice(0, 60).map((a) => {
                    const meta = formatMeta(a.format)
                    const Icon = meta.icon
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          onClick={() => openAsset(a)}
                          className="w-full rounded-xl border border-border p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <div className="mb-2 grid h-20 place-items-center rounded-lg bg-surface-sunken text-text-muted">
                            <Icon size={22} />
                          </div>
                          <div className="truncate text-body-13 font-medium text-text">{a.fileName}</div>
                          <div className="truncate text-body-12 text-text-muted">
                            {lessonById.get(a.lessonId)?.title ?? 'Detached'}
                          </div>
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <Badge tone="accent" size="sm">{meta.label}</Badge>
                            <span className="text-body-12 text-text-muted">{formatBytes(a.fileSizeBytes)}</span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <DataTable
                  data={filtered}
                  columns={columns}
                  rowKey={(a) => a.id}
                  density="compact"
                  stickyHeader
                  maxHeight={620}
                  caption="Content assets"
                  selectable
                  selectedKeys={selected}
                  onSelectionChange={setSelected}
                  onRowClick={openAsset}
                  defaultSort={{ key: 'uploaded', direction: 'desc' }}
                />
              )}
            </CardBody>
          </Card>
        </>
      )}

      <UploadAssetModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </Screen>
  )
}

function UploadAssetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const lessons = useCollection(lessonsCollection)
  const [format, setFormat] = useState<ContentFormat>('audio')
  const [lessonId, setLessonId] = useState('')
  const [fileName, setFileName] = useState('')
  const [offline, setOffline] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const contentLessons = lessons.filter((l) => l.type === 'content')

  function submit() {
    if (!lessonId) {
      setError('Choose the lesson this asset belongs to.')
      return
    }
    const lesson = lessonsCollection.find(lessonId)
    if (!lesson) return
    if (lesson.formats[format] !== undefined) {
      setError('That lesson already has this format. Replace it from the lesson editor instead.')
      return
    }
    const id = asAssetId(`asset-${lessonId}-${format}-${Date.now().toString(36)}`)
    contentAssetsCollection.insert({
      id,
      lessonId: lesson.id,
      format,
      fileName: fileName.trim() || `${lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.dat`,
      fileSizeBytes: 2_400_000,
      language: 'en',
      status: 'uploaded',
      downloadCount: 0,
      offlineEnabled: offline,
      createdAt: nowIso(),
      createdBy: CURRENT_USER_ID,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
      ...(format === 'transcript' ? { transcriptBody: '', transcriptOrigin: 'human_reviewed' as const } : {}),
    })
    lessonsCollection.update(lesson.id, { formats: { ...lesson.formats, [format]: id } })
    learnToast.success('Asset uploaded', `${formatMeta(format).label} attached to “${lesson.title}”.`)
    setError(null)
    setFileName('')
    setLessonId('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Upload asset"
      description="Attach a new format to an existing lesson. No file is transferred in this prototype."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Upload</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Format" id="upload-format" required>
          <Select
            id="upload-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as ContentFormat)}
            options={FORMATS.map((f) => ({ value: f.format, label: f.label }))}
          />
        </Field>
        <Field label="Lesson" id="upload-lesson" required error={error}>
          <Select
            id="upload-lesson"
            value={lessonId}
            invalid={Boolean(error)}
            onChange={(e) => {
              setLessonId(e.target.value)
              setError(null)
            }}
            placeholder="Choose a lesson"
            options={contentLessons.map((l) => ({
              value: l.id,
              label: `${l.title}${l.formats[format] !== undefined ? ' — already has this format' : ''}`,
            }))}
          />
        </Field>
        <Field label="File name" id="upload-filename" optional>
          <Input id="upload-filename" value={fileName} onChange={(e) => setFileName(e.target.value)} />
        </Field>
        <Switch
          checked={offline}
          onChange={setOffline}
          label="Available for offline download"
          description="Learners on metered data rely on this."
        />
        <Alert tone="info" title="No real media">
          This prototype stores metadata only. Duration, size and quality variants are generated to look
          right; nothing is transferred or played.
        </Alert>
      </div>
    </Modal>
  )
}

/** Bold the matched term inside a snippet without dangerouslySetInnerHTML. */
function highlight(snippet: string, query: string) {
  const q = query.trim()
  if (!q) return snippet
  const lower = snippet.toLowerCase()
  const idx = lower.indexOf(q.toLowerCase())
  if (idx === -1) return snippet
  return (
    <>
      {snippet.slice(0, idx)}
      <mark className={cn('rounded-sm bg-accent-subtle px-0.5 text-accent')}>
        {snippet.slice(idx, idx + q.length)}
      </mark>
      {snippet.slice(idx + q.length)}
    </>
  )
}
