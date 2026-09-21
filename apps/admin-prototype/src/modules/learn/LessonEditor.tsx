/**
 * Module & lesson editor — `/learn/courses/:courseId/modules/:moduleId/lessons/:lessonId`.
 *
 * The screen that makes multi-format real. Five format slots per lesson; the
 * Missing state is the most important empty state in the module, so it is
 * designed rather than left to look broken. There is no real media anywhere —
 * every player is a shell with honest metadata.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  Link2,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Smartphone,
  Trash2,
  Upload,
  WifiOff,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  ProgressBar,
  Select,
  Separator,
  SkeletonCard,
  StatusBadge,
  Switch,
  Tabs,
  TabPanel,
  Textarea,
  Tooltip,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  assignmentsCollection,
  auditEventsCollection,
  contentAssetsCollection,
  courseModulesCollection,
  lessonsCollection,
  quizzesCollection,
  useCollection,
  useRecord,
  type ContentAsset,
  type ContentFormat,
  type Lesson,
  type LessonType,
} from '@/mocks'
import { assetId as asAssetId } from '@/mocks/types'

import { BuilderShell, LESSON_TYPE_LABEL } from './BuilderShell'
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
  useAutosaveStamp,
  useScreenError,
  useScreenLoading,
  useSimulatedUpload,
} from './common'

type VideoVariant = NonNullable<ContentAsset['variants']>[number]

const LOW_DATA = '240p_low_data'

const VARIANT_LABEL: Record<VideoVariant['label'], string> = {
  '1080p': '1080p',
  '720p': '720p',
  '480p': '480p',
  '240p_low_data': '240p · Low data',
}

export default function LessonEditor() {
  const { courseId = '', lessonId = '' } = useParams()
  const loading = useScreenLoading(`learn:lesson:${lessonId}`)
  const { errored, retry } = useScreenError()

  return (
    <Screen nav={false} bare>
      {errored ? (
        <div className="p-6">
          <ScreenError what="This lesson" onRetry={retry} />
        </div>
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <BuilderShell courseId={courseId} selectedLessonId={lessonId}>
          <LessonPane courseId={courseId} lessonId={lessonId} />
        </BuilderShell>
      )}
    </Screen>
  )
}

function LessonPane({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const lesson = useRecord(lessonsCollection, lessonId)
  const modules = useCollection(courseModulesCollection).filter((m) => m.courseId === courseId)
  const lessons = useCollection(lessonsCollection).filter((l) => l.courseId === courseId)
  const assets = useCollection(contentAssetsCollection).filter((a) => a.lessonId === lessonId)
  const [stamp, markSaved] = useAutosaveStamp()
  const [confirmArchive, setConfirmArchive] = useState(false)

  const tab = params.get('tab') ?? 'content'
  function setTab(id: string) {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!lesson) return
    if (tab === 'quiz' && lesson.type !== 'quiz') setTab('content')
    if (tab === 'assignment' && lesson.type !== 'assignment' && lesson.type !== 'project') setTab('content')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.type])

  if (!lesson) {
    return (
      <div className="p-6">
        <Alert tone="danger" title="Lesson not found">
          This lesson has been moved or archived.{' '}
          <Button variant="link" onClick={() => navigate(`/learn/courses/${courseId}/builder`)}>
            Back to the course
          </Button>
        </Alert>
      </div>
    )
  }

  const mod = modules.find((m) => m.id === lesson.moduleId)
  const siblings = lessons.filter((l) => l.moduleId === lesson.moduleId).sort((a, b) => a.sequence - b.sequence)
  const position = siblings.findIndex((l) => l.id === lesson.id) + 1

  function patchLesson(delta: Partial<Lesson>) {
    lessonsCollection.update(lesson!.id, { ...delta, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
    markSaved()
  }

  const tabs = [
    { id: 'content', label: 'Content' },
    { id: 'resources', label: 'Resources', badge: lesson.resources.length || undefined },
    ...(lesson.type === 'quiz' ? [{ id: 'quiz', label: 'Quiz' }] : []),
    ...(lesson.type === 'assignment' || lesson.type === 'project'
      ? [{ id: 'assignment', label: 'Assignment' }]
      : []),
    { id: 'discussion', label: 'Discussion' },
    { id: 'audit', label: 'Audit' },
  ]

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <header className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-body-12 text-text-muted">
              Module {mod ? mod.sequence : '—'} · Lesson {position} of {siblings.length}
            </div>
            <h1 className="mt-0.5 text-heading-20">{lesson.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge tone="neutral">{LESSON_TYPE_LABEL[lesson.type]}</Badge>
              <span className="text-body-12 text-text-secondary">{lesson.durationMinutes} min</span>
              <StatusBadge status={lesson.status} />
              {stamp && <span className="text-body-12 text-text-muted">Saved {stamp}</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                patchLesson({ status: lesson.status === 'published' ? 'draft' : 'published' })
              }
            >
              {lesson.status === 'published' ? 'Unpublish lesson' : 'Publish lesson'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Copy size={14} />}
              onClick={() =>
                learnToast.info(
                  'Duplicate is not wired in this prototype',
                  'It would copy the lesson with empty format slots.',
                )
              }
            >
              Duplicate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirmArchive(true)}>
              Archive
            </Button>
          </div>
        </div>
      </header>

      <Card className="mb-4">
        <CardBody padding="tight" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Lesson title" id="lesson-title" required>
              <Input
                id="lesson-title"
                value={lesson.title}
                onChange={(e) => patchLesson({ title: e.target.value })}
              />
            </Field>
            <Field label="Type" id="lesson-type">
              <Select
                id="lesson-type"
                value={lesson.type}
                onChange={(e) => patchLesson({ type: e.target.value as LessonType })}
                options={[
                  { value: 'content', label: 'Content' },
                  { value: 'quiz', label: 'Quiz' },
                  { value: 'assignment', label: 'Assignment' },
                  { value: 'project', label: 'Project' },
                  { value: 'live_session', label: 'Live session' },
                ]}
              />
            </Field>
            <Field label="Duration (minutes)" id="lesson-duration">
              <Input
                id="lesson-duration"
                type="number"
                min={1}
                value={lesson.durationMinutes}
                onChange={(e) => patchLesson({ durationMinutes: Number(e.target.value) || 1 })}
              />
            </Field>
          </div>
          <Field label="Move to another module" id="lesson-module">
            <Select
              id="lesson-module"
              value={lesson.moduleId}
              onChange={(e) => {
                const target = e.target.value as Lesson['moduleId']
                const count = lessons.filter((l) => l.moduleId === target).length
                patchLesson({ moduleId: target, sequence: count + 1 })
                navigate(`/learn/courses/${courseId}/modules/${target}/lessons/${lesson.id}`, { replace: true })
              }}
              options={modules
                .sort((a, b) => a.sequence - b.sequence)
                .map((m) => ({ value: m.id, label: `${m.sequence}. ${m.title}` }))}
            />
          </Field>
        </CardBody>
      </Card>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />

      <div className="mt-4">
        <TabPanel id="lesson-content" tabId="content" active={tab === 'content'}>
          <ContentTab lesson={lesson} assets={assets} onPatch={patchLesson} />
        </TabPanel>

        <TabPanel id="lesson-resources" tabId="resources" active={tab === 'resources'}>
          <ResourcesTab lesson={lesson} onPatch={patchLesson} />
        </TabPanel>

        {lesson.type === 'quiz' && (
          <TabPanel id="lesson-quiz" tabId="quiz" active={tab === 'quiz'}>
            <QuizTab lesson={lesson} />
          </TabPanel>
        )}

        {(lesson.type === 'assignment' || lesson.type === 'project') && (
          <TabPanel id="lesson-assignment" tabId="assignment" active={tab === 'assignment'}>
            <AssignmentTab lesson={lesson} />
          </TabPanel>
        )}

        <TabPanel id="lesson-discussion" tabId="discussion" active={tab === 'discussion'}>
          <DiscussionTab lesson={lesson} />
        </TabPanel>

        <TabPanel id="lesson-audit" tabId="audit" active={tab === 'audit'}>
          <AuditTab lessonId={lesson.id} />
        </TabPanel>
      </div>

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this lesson?"
        confirmLabel="Archive lesson"
        destructive
        onConfirm={() => {
          patchLesson({
            status: 'draft',
            archivedAt: nowIso(),
            archivedReason: 'Archived from the lesson editor',
          })
          setConfirmArchive(false)
          learnToast.success('Lesson archived', 'It stays in the outline with an Archived badge.')
        }}
      >
        <p className="text-body-13 text-text-secondary">
          “{lesson.title}” is removed from the learner outline. Its {assets.length} content assets, any
          progress records against it and the audit trail all remain. Nothing is deleted.
        </p>
      </ConfirmDialog>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Content tab — the five format slots                                        */
/* -------------------------------------------------------------------------- */

function ContentTab({
  lesson,
  assets,
  onPatch,
}: {
  lesson: Lesson
  assets: ContentAsset[]
  onPatch: (delta: Partial<Lesson>) => void
}) {
  const video = assets.find((a) => a.format === 'video')
  const lowDataMissing =
    video !== undefined && !(video.variants ?? []).some((v) => v.label === LOW_DATA && v.status !== 'missing')

  const pdf = assets.find((a) => a.format === 'pdf')
  const androidIssues: string[] = []
  if (lowDataMissing) androidIssues.push('No 240p low-data video variant')
  const topBitrate = Math.max(0, ...(video?.variants ?? []).map((v) => v.bitrateKbps))
  const lowest = (video?.variants ?? []).reduce<number | null>(
    (acc, v) => (acc === null ? v.bitrateKbps : Math.min(acc, v.bitrateKbps)),
    null,
  )
  if (lowest !== null && lowest > 600) androidIssues.push(`Lowest video bitrate is ${lowest} kbps — too high for 3G`)
  if (pdf && pdf.fileSizeBytes > 10_000_000) androidIssues.push('PDF is over 10 MB')
  const androidPasses = androidIssues.length === 0

  const present = FORMATS.filter((f) => lesson.formats[f.format] !== undefined).length

  if (lesson.type !== 'content') {
    return (
      <Alert tone="info" title={`${LESSON_TYPE_LABEL[lesson.type]} lessons carry no content formats`}>
        Format slots exist on content lessons. A {LESSON_TYPE_LABEL[lesson.type].toLowerCase()} lesson is
        configured on its own tab, and the coverage matrix excludes it.
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody padding="tight">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <WifiOff size={16} className="text-text-secondary" />
              <Switch
                checked={lesson.offlineEnabled}
                onChange={(on) => onPatch({ offlineEnabled: on })}
                size="sm"
                label={lesson.offlineEnabled ? 'Offline download: enabled for all formats' : 'Offline download: disabled'}
              />
            </div>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-2">
              <Smartphone size={16} className={androidPasses ? 'text-success-ink' : 'text-danger-ink'} />
              <div>
                <div className="text-body-13 font-medium text-text">
                  Mid-range Android check: {androidPasses ? 'passes' : 'fails'}
                </div>
                {!androidPasses && (
                  <ul className="mt-0.5 list-inside list-disc text-body-12 text-danger-text">
                    {androidIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Badge tone={present === 5 ? 'success' : present >= 3 ? 'warning' : 'danger'} className="ml-auto">
              {present} of 5 formats
            </Badge>
          </div>
        </CardBody>
      </Card>

      {FORMATS.map((meta) => (
        <FormatCard
          key={meta.format}
          lesson={lesson}
          format={meta.format}
          asset={assets.find((a) => a.format === meta.format)}
          onPatch={onPatch}
          topBitrate={topBitrate}
        />
      ))}
    </div>
  )
}

function FormatCard({
  lesson,
  format,
  asset,
  onPatch,
  topBitrate,
}: {
  lesson: Lesson
  format: ContentFormat
  asset: ContentAsset | undefined
  onPatch: (delta: Partial<Lesson>) => void
  topBitrate: number
}) {
  const meta = formatMeta(format)
  const Icon = meta.icon
  const upload = useSimulatedUpload()
  const [dragOver, setDragOver] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  const status = asset?.status ?? 'missing'

  function createAsset() {
    const id = `asset-${lesson.id}-${format}-${Date.now().toString(36)}`
    const minutes = lesson.durationMinutes
    const slug = lesson.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
    const base: ContentAsset = {
      id: asAssetId(id),
      lessonId: lesson.id,
      format,
      fileName: `${slug}.${extensionFor(format)}`,
      fileSizeBytes: 0,
      language: 'en',
      status: 'uploaded',
      downloadCount: 0,
      offlineEnabled: lesson.offlineEnabled,
      createdAt: nowIso(),
      createdBy: CURRENT_USER_ID,
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    }
    if (format === 'video') {
      base.fileSizeBytes = minutes * 11_500_000
      base.durationSeconds = minutes * 60
      base.variants = [
        { label: '1080p', fileSizeBytes: minutes * 11_500_000, bitrateKbps: 4200, status: 'ready' },
        { label: '720p', fileSizeBytes: minutes * 6_200_000, bitrateKbps: 2200, status: 'ready' },
        { label: '480p', fileSizeBytes: minutes * 3_100_000, bitrateKbps: 1100, status: 'ready' },
        { label: '240p_low_data', fileSizeBytes: minutes * 900_000, bitrateKbps: 320, status: 'ready' },
      ]
    } else if (format === 'audio') {
      base.fileSizeBytes = minutes * 900_000
      base.durationSeconds = minutes * 60
      base.audioOrigin = 'generated_from_video'
      base.voice = 'Cirvee Narrator (en-NG)'
    } else if (format === 'podcast') {
      base.fileSizeBytes = minutes * 950_000
      base.durationSeconds = minutes * 60
      base.podcast = {
        feedName: 'Cirvee Data Clinic',
        episodeNumber: contentAssetsCollection.count((a) => a.format === 'podcast') + 1,
        episodeTitle: lesson.title,
        publishedAt: nowIso().slice(0, 10),
        publicFeedUrl: 'https://feeds.cirvee.com/data-clinic.xml',
      }
    } else if (format === 'pdf') {
      base.fileSizeBytes = 1_800_000
      base.pageCount = Math.max(6, Math.round(minutes / 2))
    } else {
      base.fileSizeBytes = 1_200
      base.transcriptBody = ''
      base.transcriptOrigin = 'human_reviewed'
    }

    contentAssetsCollection.insert(base)
    onPatch({ formats: { ...lesson.formats, [format]: base.id } })
    learnToast.success(`${meta.label} uploaded`, `“${lesson.title}” now has ${countFormats(lesson) + 1} of 5 formats.`)
  }

  function patchAsset(delta: Partial<ContentAsset>) {
    if (!asset) return
    contentAssetsCollection.update(asset.id, { ...delta, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
  }

  function removeAsset() {
    if (!asset) return
    patchAsset({ status: 'missing', archivedAt: nowIso(), archivedReason: 'Removed from the lesson editor' })
    const next = { ...lesson.formats }
    delete next[format]
    onPatch({ formats: next })
    setConfirmRemove(false)
    learnToast.info(`${meta.label} removed`, 'The asset row is retained with a Missing status — nothing was deleted.')
  }

  return (
    <Card>
      <CardHeader
        bare
        title={
          <span className="flex items-center gap-2">
            <Icon size={16} className="text-text-secondary" />
            {meta.label}
          </span>
        }
        description={asset ? asset.fileName : meta.missingConsequence}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge status={upload.busy ? (upload.phase === 'processing' ? 'processing' : 'uploading') : status} />
            {asset && status !== 'missing' ? (
              <>
                <Button size="sm" variant="secondary" leftIcon={<Upload size={14} />} onClick={() => upload.start(() => patchAsset({ status: 'published', updatedAt: nowIso() }))} loading={upload.busy}>
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  leftIcon={<Download size={14} />}
                  onClick={() => {
                    patchAsset({ downloadCount: asset.downloadCount + 1 })
                    learnToast.info('Download started', `${asset.fileName} · ${formatBytes(asset.fileSizeBytes)}`)
                  }}
                >
                  Download
                </Button>
                <IconButton icon={Trash2} label={`Remove ${meta.label}`} variant="ghost" onClick={() => setConfirmRemove(true)} />
              </>
            ) : null}
          </div>
        }
      />
      <CardBody className="pt-0">
        {upload.busy ? (
          <div className="rounded-xl border border-border bg-surface-sunken p-4">
            <ProgressBar
              value={upload.progress ?? 100}
              label={upload.phase === 'processing' ? 'Processing — transcoding and generating variants' : 'Uploading'}
              showValue={upload.phase === 'uploading'}
              tone="accent"
            />
          </div>
        ) : !asset || status === 'missing' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              upload.start(createAsset)
            }}
            className={cn(
              'rounded-xl border border-dashed p-5 text-center transition-colors',
              dragOver ? 'border-accent bg-accent-wash' : 'border-border-strong bg-surface-sunken',
            )}
          >
            <div className="mx-auto mb-2 grid size-9 place-items-center rounded-full bg-surface text-text-muted">
              <Icon size={18} />
            </div>
            <p className="text-body-13 font-medium text-text">No {meta.label.toLowerCase()} for this lesson</p>
            <p className="mx-auto mt-1 max-w-sm text-body-12 text-text-secondary">
              {meta.missingConsequence} Learners who prefer this format have no way through this lesson.
            </p>
            <Button size="sm" className="mt-3" leftIcon={<Upload size={14} />} onClick={() => upload.start(createAsset)}>
              Upload {meta.label.toLowerCase()}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <KeyValueList columns={2}>
              <KeyValue label="File">{asset.fileName}</KeyValue>
              <KeyValue label="Size">{formatBytes(asset.fileSizeBytes)}</KeyValue>
              {asset.durationSeconds !== undefined && (
                <KeyValue label="Duration">{formatDuration(asset.durationSeconds)}</KeyValue>
              )}
              {asset.pageCount !== undefined && <KeyValue label="Pages">{asset.pageCount}</KeyValue>}
              <KeyValue label="Uploaded by">{userName(asset.createdBy)}</KeyValue>
              <KeyValue label="Uploaded">{formatDate(asset.createdAt)}</KeyValue>
              <KeyValue label="Downloads">{formatNumber(asset.downloadCount)}</KeyValue>
              <KeyValue label="Offline">
                <Switch
                  checked={asset.offlineEnabled}
                  onChange={(on) => patchAsset({ offlineEnabled: on })}
                  size="sm"
                  label={asset.offlineEnabled ? 'Downloadable' : 'Streaming only'}
                />
              </KeyValue>
            </KeyValueList>

            {format === 'video' && <VideoVariants asset={asset} onPatch={patchAsset} />}
            {format === 'audio' && <AudioFields asset={asset} onPatch={patchAsset} />}
            {format === 'podcast' && <PodcastFields asset={asset} onPatch={patchAsset} />}
            {format === 'pdf' && <PdfFields asset={asset} onPatch={patchAsset} />}
            {format === 'transcript' && <TranscriptFields asset={asset} onPatch={patchAsset} />}

            {format === 'video' && topBitrate > 0 && (
              <p className="text-body-12 text-text-muted">
                Top variant runs at {formatNumber(topBitrate)} kbps. Nothing is embedded — this is a player
                shell over seeded metadata.
              </p>
            )}
          </div>
        )}
      </CardBody>

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title={`Remove the ${meta.label.toLowerCase()} from this lesson?`}
        confirmLabel="Remove format"
        destructive
        onConfirm={removeAsset}
      >
        <p className="text-body-13 text-text-secondary">
          The asset is not deleted — its row stays in the content library with a Missing status and can be
          restored. The lesson drops to {countFormats(lesson) - 1} of 5 formats and the coverage matrix moves.
        </p>
      </ConfirmDialog>
    </Card>
  )
}

function VideoVariants({ asset, onPatch }: { asset: ContentAsset; onPatch: (d: Partial<ContentAsset>) => void }) {
  const variants = asset.variants ?? []
  const lowData = variants.find((v) => v.label === LOW_DATA)
  const [confirmDelete, setConfirmDelete] = useState<VideoVariant['label'] | null>(null)

  const columns: Array<Column<VideoVariant>> = [
    {
      key: 'label',
      header: 'Quality',
      cell: (v) => (
        <span className="flex items-center gap-1.5">
          <span className="text-body-13 text-text">{VARIANT_LABEL[v.label]}</span>
          {v.label === LOW_DATA && (
            <Badge tone="accent" size="sm">
              Required
            </Badge>
          )}
        </span>
      ),
      sortValue: (v) => v.bitrateKbps,
    },
    { key: 'size', header: 'Size', align: 'right', accessor: (v) => formatBytes(v.fileSizeBytes), sortValue: (v) => v.fileSizeBytes },
    { key: 'bitrate', header: 'Bitrate', align: 'right', accessor: (v) => `${formatNumber(v.bitrateKbps)} kbps`, sortValue: (v) => v.bitrateKbps },
    { key: 'status', header: 'Status', cell: (v) => <StatusBadge status={v.status} />, sortValue: (v) => v.status },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 56,
      cell: (v) => (
        <IconButton
          icon={Trash2}
          label={`Delete the ${VARIANT_LABEL[v.label]} variant`}
          size="sm"
          variant="ghost"
          onClick={() => setConfirmDelete(v.label)}
        />
      ),
    },
  ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-body-13 font-semibold text-text">Quality variants</h3>
        <span className="flex items-center gap-2 text-body-12 text-text-muted">
          <Play size={13} /> Player shell only — no media is embedded
        </span>
      </div>

      {!lowData && (
        <Alert tone="danger" title="Low-data option required" icon={AlertTriangle}>
          Every video needs a 240p low-data variant. Without it, a learner on a metered Nigerian data plan
          has no affordable way through this lesson, and the mid-range Android check fails.
          <div className="mt-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<RotateCcw size={14} />}
              onClick={() => {
                const minutes = Math.round((asset.durationSeconds ?? 1800) / 60)
                onPatch({
                  variants: [
                    ...variants,
                    { label: '240p_low_data', fileSizeBytes: minutes * 900_000, bitrateKbps: 320, status: 'ready' },
                  ],
                })
                learnToast.success('240p low-data variant restored')
              }}
            >
              Restore 240p low-data
            </Button>
          </div>
        </Alert>
      )}

      <DataTable
        data={variants}
        columns={columns}
        rowKey={(v) => v.label}
        density="compact"
        caption="Video quality variants"
        emptyTitle="No variants encoded"
        emptyMessage="The source file uploaded but transcoding has not produced any renditions."
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `Delete the ${VARIANT_LABEL[confirmDelete]} variant?` : ''}
        confirmLabel="Delete variant"
        destructive
        onConfirm={() => {
          onPatch({ variants: variants.filter((v) => v.label !== confirmDelete) })
          if (confirmDelete === LOW_DATA) {
            learnToast.error(
              'Low-data option removed',
              'The lesson now fails the mid-range Android check.',
            )
          } else {
            learnToast.info('Variant deleted')
          }
          setConfirmDelete(null)
        }}
      >
        <p className="text-body-13 text-text-secondary">
          {confirmDelete === LOW_DATA
            ? 'This is the variant learners on metered data rely on. Deleting it will flag this lesson red and fail the mid-range Android check.'
            : 'Learners on this quality setting will fall back to the next rendition down.'}
        </p>
      </ConfirmDialog>
    </div>
  )
}

function AudioFields({ asset, onPatch }: { asset: ContentAsset; onPatch: (d: Partial<ContentAsset>) => void }) {
  const [playing, setPlaying] = useState(false)
  return (
    <div className="space-y-3">
      <PlayerShell
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        label={asset.fileName}
        meta={`${formatDuration(asset.durationSeconds)} · ${formatBytes(asset.fileSizeBytes)}`}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Origin" id={`audio-origin-${asset.id}`}>
          <Select
            id={`audio-origin-${asset.id}`}
            value={asset.audioOrigin ?? 'generated_from_video'}
            onChange={(e) => onPatch({ audioOrigin: e.target.value as ContentAsset['audioOrigin'] })}
            options={[
              { value: 'generated_from_video', label: 'Generated from video' },
              { value: 'recorded_separately', label: 'Recorded separately' },
            ]}
          />
        </Field>
        <Field label="Voice" id={`audio-voice-${asset.id}`}>
          <Input
            id={`audio-voice-${asset.id}`}
            value={asset.voice ?? ''}
            onChange={(e) => onPatch({ voice: e.target.value })}
          />
        </Field>
      </div>
    </div>
  )
}

function PodcastFields({ asset, onPatch }: { asset: ContentAsset; onPatch: (d: Partial<ContentAsset>) => void }) {
  const podcast = asset.podcast
  if (!podcast) return null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Episode title" id={`pod-title-${asset.id}`}>
        <Input
          id={`pod-title-${asset.id}`}
          value={podcast.episodeTitle}
          onChange={(e) => onPatch({ podcast: { ...podcast, episodeTitle: e.target.value } })}
        />
      </Field>
      <Field label="Feed" id={`pod-feed-${asset.id}`}>
        <Select
          id={`pod-feed-${asset.id}`}
          value={podcast.feedName}
          onChange={(e) => onPatch({ podcast: { ...podcast, feedName: e.target.value } })}
          options={[
            { value: 'Cirvee Data Clinic', label: 'Cirvee Data Clinic' },
            { value: 'Cirvee Design Room', label: 'Cirvee Design Room' },
            { value: 'Cirvee Engineering Hour', label: 'Cirvee Engineering Hour' },
          ]}
        />
      </Field>
      <Field label="Episode number" id={`pod-num-${asset.id}`}>
        <Input
          id={`pod-num-${asset.id}`}
          type="number"
          min={1}
          value={podcast.episodeNumber}
          onChange={(e) => onPatch({ podcast: { ...podcast, episodeNumber: Number(e.target.value) || 1 } })}
        />
      </Field>
      <Field label="Publish date" id={`pod-date-${asset.id}`}>
        <Input
          id={`pod-date-${asset.id}`}
          type="date"
          value={podcast.publishedAt}
          onChange={(e) => onPatch({ podcast: { ...podcast, publishedAt: e.target.value } })}
        />
      </Field>
      <Field label="Public feed URL" id={`pod-url-${asset.id}`} className="sm:col-span-2">
        <Input
          id={`pod-url-${asset.id}`}
          readOnly
          value={podcast.publicFeedUrl}
          leftIcon={<Link2 size={14} />}
          rightSlot={
            <Tooltip content="Copy feed URL">
              <IconButton
                icon={Copy}
                label="Copy feed URL"
                size="sm"
                variant="ghost"
                onClick={() => {
                  void navigator.clipboard?.writeText(podcast.publicFeedUrl)
                  learnToast.success('Feed URL copied')
                }}
              />
            </Tooltip>
          }
        />
      </Field>
    </div>
  )
}

function PdfFields({ asset, onPatch }: { asset: ContentAsset; onPatch: (d: Partial<ContentAsset>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Page count" id={`pdf-pages-${asset.id}`}>
        <Input
          id={`pdf-pages-${asset.id}`}
          type="number"
          min={1}
          value={asset.pageCount ?? 1}
          onChange={(e) => onPatch({ pageCount: Number(e.target.value) || 1 })}
        />
      </Field>
      <Field label="Downloadable" id={`pdf-dl-${asset.id}`}>
        <Switch
          id={`pdf-dl-${asset.id}`}
          checked={asset.offlineEnabled}
          onChange={(on) => onPatch({ offlineEnabled: on })}
          label={asset.offlineEnabled ? 'Learners can download the deck' : 'View in the app only'}
        />
      </Field>
    </div>
  )
}

function TranscriptFields({ asset, onPatch }: { asset: ContentAsset; onPatch: (d: Partial<ContentAsset>) => void }) {
  const [body, setBody] = useState(asset.transcriptBody ?? '')
  const dirty = body !== (asset.transcriptBody ?? '')

  return (
    <div className="space-y-3">
      <Alert tone="info" title="Transcripts are what make the library searchable">
        Everything typed here is indexed by the content library's full-text search. A lesson with no
        transcript cannot be found by what was said in it.
      </Alert>
      <Field label="Transcript" id={`transcript-${asset.id}`} hint={`${body.length} characters`}>
        <Textarea
          id={`transcript-${asset.id}`}
          rows={10}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste or type the spoken content of this lesson."
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Origin" id={`transcript-origin-${asset.id}`}>
          <Select
            id={`transcript-origin-${asset.id}`}
            value={asset.transcriptOrigin ?? 'auto_generated'}
            onChange={(e) => onPatch({ transcriptOrigin: e.target.value as ContentAsset['transcriptOrigin'] })}
            options={[
              { value: 'auto_generated', label: 'Auto-generated' },
              { value: 'human_reviewed', label: 'Human-reviewed' },
            ]}
          />
        </Field>
        <Field label="Language" id={`transcript-lang-${asset.id}`}>
          <Input id={`transcript-lang-${asset.id}`} value="English" readOnly />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <Button
          disabled={!dirty}
          onClick={() => {
            onPatch({
              transcriptBody: body,
              fileSizeBytes: Math.max(1_000, body.length * 2),
              status: 'uploaded',
              transcriptOrigin: 'human_reviewed',
            })
            learnToast.success('Transcript saved', 'Marked human-reviewed and indexed for search.')
          }}
        >
          Save transcript
        </Button>
        {dirty && <span className="text-body-12 text-warning-text">Unsaved changes</span>}
      </div>
    </div>
  )
}

function PlayerShell({
  playing,
  onToggle,
  label,
  meta,
  quality,
}: {
  playing: boolean
  onToggle: () => void
  label: string
  meta: string
  quality?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-sunken p-3">
      <IconButton
        icon={playing ? Pause : Play}
        label={playing ? `Pause ${label}` : `Play ${label}`}
        variant="secondary"
        onClick={onToggle}
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-body-13 font-medium text-text">{label}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-accent" style={{ width: playing ? '38%' : '0%' }} />
        </div>
        <div className="mt-1 flex items-center gap-2 text-body-12 text-text-muted">
          <span>{meta}</span>
          {quality && <Badge tone="neutral" size="sm">{quality}</Badge>}
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Other tabs                                                                 */
/* -------------------------------------------------------------------------- */

function ResourcesTab({ lesson, onPatch }: { lesson: Lesson; onPatch: (d: Partial<Lesson>) => void }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')

  return (
    <Card>
      <CardHeader title="Supplementary resources" description="Workbooks, starter files and links, shown under the player." />
      <CardBody className="space-y-3">
        {lesson.resources.length === 0 ? (
          <EmptyState
            size="sm"
            icon={Link2}
            title="No supplementary resources"
            message="Learners get the lesson content only. Add a workbook or a starter file if the lesson needs one."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {lesson.resources.map((resource, i) => (
              <li key={`${resource.url}-${i}`} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-13 text-text">{resource.label}</div>
                  <div className="truncate font-mono text-body-12 text-text-muted">{resource.url}</div>
                </div>
                <IconButton
                  icon={Trash2}
                  label={`Remove ${resource.label}`}
                  variant="ghost"
                  onClick={() => onPatch({ resources: lesson.resources.filter((_, idx) => idx !== i) })}
                />
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Field label="Label" id="resource-label">
            <Input id="resource-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <Field label="Path" id="resource-url">
            <Input id="resource-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="/library/…" />
          </Field>
          <div className="flex items-end">
            <Button
              leftIcon={<Plus size={14} />}
              disabled={!label.trim() || !url.trim()}
              onClick={() => {
                onPatch({ resources: [...lesson.resources, { label: label.trim(), url: url.trim() }] })
                setLabel('')
                setUrl('')
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

function QuizTab({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate()
  const quiz = useCollection(quizzesCollection).find((q) => q.id === lesson.quizId)
  if (!quiz) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="This quiz lesson has no quiz attached"
        message="Learners would reach a dead end. Build the quiz before publishing the lesson."
        action={<Button onClick={() => navigate('/learn/quizzes')}>Open quizzes</Button>}
      />
    )
  }
  return (
    <Card>
      <CardHeader
        title={quiz.title}
        description={`${quiz.questions.length} questions · pass mark ${quiz.passMark}%`}
        actions={
          <Button size="sm" variant="secondary" onClick={() => navigate(`/learn/quizzes/${quiz.id}`)}>
            Open quiz builder
          </Button>
        }
      />
      <CardBody>
        <KeyValueList columns={2}>
          <KeyValue label="Time limit">{quiz.timeLimitMinutes ? `${quiz.timeLimitMinutes} minutes` : 'None'}</KeyValue>
          <KeyValue label="Attempts allowed">{quiz.attemptsAllowed}</KeyValue>
          <KeyValue label="Attempts recorded">{formatNumber(quiz.stats.attempts)}</KeyValue>
          <KeyValue label="Pass rate">{quiz.stats.passRate}%</KeyValue>
        </KeyValueList>
      </CardBody>
    </Card>
  )
}

function AssignmentTab({ lesson }: { lesson: Lesson }) {
  const navigate = useNavigate()
  const assignment = useCollection(assignmentsCollection).find((a) => a.id === lesson.assignmentId)

  if (!assignment) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No assignment configured"
        message="An assignment lesson with no brief cannot be submitted against. Configure it before publishing."
        action={<Button onClick={() => navigate('/learn/assignments')}>Open assignments</Button>}
      />
    )
  }

  function patch(delta: Partial<typeof assignment>) {
    if (!assignment) return
    assignmentsCollection.update(assignment.id, { ...delta, updatedAt: nowIso(), updatedBy: CURRENT_USER_ID })
  }

  const weightTotal = assignment.rubric.reduce((acc, r) => acc + r.weight, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Brief" />
        <CardBody className="space-y-3">
          <Field label="Title" id="assignment-title">
            <Input id="assignment-title" value={assignment.title} onChange={(e) => patch({ title: e.target.value })} />
          </Field>
          <Field label="Brief" id="assignment-brief">
            <Textarea id="assignment-brief" rows={5} value={assignment.brief} onChange={(e) => patch({ brief: e.target.value })} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Accepted formats" id="assignment-formats" hint="Comma separated">
              <Input
                id="assignment-formats"
                value={assignment.acceptedFormats.join(', ')}
                onChange={(e) =>
                  patch({ acceptedFormats: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
                }
              />
            </Field>
            <Field label="Max file size" id="assignment-size">
              <Input
                id="assignment-size"
                type="number"
                min={1}
                suffix="MB"
                value={assignment.maxFileSizeMb}
                onChange={(e) => patch({ maxFileSizeMb: Number(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Max score" id="assignment-score">
              <Input
                id="assignment-score"
                type="number"
                min={1}
                value={assignment.maxScore}
                onChange={(e) => patch({ maxScore: Number(e.target.value) || 100 })}
              />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Due offset" id="assignment-due" hint="Days from cohort start">
              <Input
                id="assignment-due"
                type="number"
                value={assignment.dueOffsetDays ?? 0}
                onChange={(e) => patch({ dueOffsetDays: Number(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Late policy" id="assignment-late">
              <Select
                id="assignment-late"
                value={assignment.latePolicy}
                onChange={(e) => patch({ latePolicy: e.target.value as typeof assignment.latePolicy })}
                options={[
                  { value: 'accept', label: 'Accept late' },
                  { value: 'accept_with_penalty', label: 'Accept with penalty' },
                  { value: 'reject', label: 'Reject late' },
                ]}
              />
            </Field>
            {assignment.latePolicy === 'accept_with_penalty' && (
              <Field label="Late penalty" id="assignment-penalty">
                <Input
                  id="assignment-penalty"
                  type="number"
                  min={0}
                  max={100}
                  suffix="%"
                  value={assignment.latePenaltyPercent ?? 0}
                  onChange={(e) => patch({ latePenaltyPercent: Number(e.target.value) || 0 })}
                />
              </Field>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Rubric"
          description="Weights must total 100. Graders score against these criteria and nothing else."
          actions={
            <Badge tone={weightTotal === 100 ? 'success' : 'danger'}>Weights total {weightTotal}%</Badge>
          }
        />
        <CardBody padding="none">
          <table className="w-full" aria-label="Assignment rubric">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2 text-label-11 text-text-label">Criterion</th>
                <th scope="col" className="w-24 px-4 py-2 text-label-11 text-text-label">Weight</th>
                <th scope="col" className="px-4 py-2 text-label-11 text-text-label">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assignment.rubric.map((row, i) => (
                <tr key={row.criterion}>
                  <td className="px-4 py-2 text-body-13 text-text">{row.criterion}</td>
                  <td className="px-4 py-2">
                    <Input
                      aria-label={`Weight for ${row.criterion}`}
                      inputSize="sm"
                      type="number"
                      min={0}
                      max={100}
                      value={row.weight}
                      onChange={(e) => {
                        const next = [...assignment.rubric]
                        next[i] = { ...row, weight: Number(e.target.value) || 0 }
                        patch({ rubric: next })
                      }}
                    />
                  </td>
                  <td className="px-4 py-2 text-body-12 text-text-secondary">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tutor guidance" description="Shown to graders only." />
        <CardBody>
          <Textarea
            aria-label="Tutor guidance"
            rows={3}
            value={assignment.tutorGuidance}
            onChange={(e) => patch({ tutorGuidance: e.target.value })}
          />
        </CardBody>
      </Card>
    </div>
  )
}

function DiscussionTab({ lesson }: { lesson: Lesson }) {
  const thread = useMemo(
    () => [
      {
        id: 'd1',
        author: 'Chiamaka Okonkwo',
        at: 'Asked 3 days ago',
        body: 'When you say check the residuals — is that the plot or the summary table? I get different stories from each.',
      },
      {
        id: 'd2',
        author: 'Tunde Bakare',
        at: 'Replied 3 days ago',
        body: 'Plot first, always. The summary table hides the shape. If the residual plot fans out, the model is wrong whatever R² says.',
      },
      {
        id: 'd3',
        author: 'Ibrahim Yusuf',
        at: 'Replied 2 days ago',
        body: 'The low-data video cut off for me around 14 minutes. Downloaded the audio instead and it was fine on the bus.',
      },
    ],
    [],
  )

  return (
    <Card>
      <CardHeader
        title="Cohort discussion"
        description={`Seeded thread on “${lesson.title}”. Read-only in this prototype.`}
      />
      <CardBody>
        <ul className="space-y-3">
          {thread.map((post) => (
            <li key={post.id} className="rounded-xl border border-border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-body-13 font-medium text-text">{post.author}</span>
                <span className="text-body-12 text-text-muted">{post.at}</span>
              </div>
              <p className="mt-1 text-body-13 text-text-secondary">{post.body}</p>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  )
}

function AuditTab({ lessonId }: { lessonId: string }) {
  const events = useCollection(auditEventsCollection)
    .filter((e) => e.entityId === lessonId || e.entityRef === lessonId)
    .slice(0, 50)

  return (
    <Card>
      <CardHeader
        title="Audit"
        description="Immutable. Separate from the discussion thread and never interleaved with it."
      />
      <CardBody padding="none">
        {events.length === 0 ? (
          <div className="p-6">
            <EmptyState
              size="sm"
              icon={CheckCircle2}
              title="No recorded changes to this lesson"
              message="Edits made from here will appear as actor, timestamp, field, previous value and new value."
            />
          </div>
        ) : (
          <table className="w-full font-mono text-body-12" aria-label="Lesson audit trail">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2 text-text-label">When</th>
                <th scope="col" className="px-4 py-2 text-text-label">Actor</th>
                <th scope="col" className="px-4 py-2 text-text-label">Field</th>
                <th scope="col" className="px-4 py-2 text-text-label">Before → after</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-1.5 text-text-secondary">{formatDateTime(e.at)}</td>
                  <td className="px-4 py-1.5 text-text-secondary">{e.actorName}</td>
                  <td className="px-4 py-1.5 text-text">{e.field ?? e.action}</td>
                  <td className="px-4 py-1.5 text-text-secondary">
                    {e.field ? `${e.before ?? '—'} → ${e.after ?? '—'}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */

function countFormats(lesson: Lesson): number {
  return FORMATS.filter((f) => lesson.formats[f.format] !== undefined).length
}

function extensionFor(format: ContentFormat): string {
  switch (format) {
    case 'video':
      return 'mp4'
    case 'audio':
    case 'podcast':
      return 'm4a'
    case 'pdf':
      return 'pdf'
    default:
      return 'txt'
  }
}
