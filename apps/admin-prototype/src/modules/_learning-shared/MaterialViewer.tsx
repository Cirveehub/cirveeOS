import { useState } from 'react'
import { Download, FileText, Headphones, Mic, Play, Video } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Badge, Button, EmptyState } from '@/ui'
import type { ContentAsset, ContentFormat, Lesson } from '@/mocks'

const FORMAT_LABEL: Record<ContentFormat, string> = {
  video: 'Video',
  audio: 'Audio',
  podcast: 'Podcast',
  pdf: 'Slides / PDF',
  transcript: 'Transcript',
}

const FORMAT_ICON: Record<ContentFormat, typeof Video> = {
  video: Video,
  audio: Headphones,
  podcast: Mic,
  pdf: FileText,
  transcript: FileText,
}

function formatDuration(seconds?: number): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export interface MaterialViewerProps {
  lesson: Lesson
  format?: ContentFormat
  onFormatChange?: (format: ContentFormat) => void
  asset: ContentAsset | undefined
  className?: string
}

export function FormatSwitcher({
  lesson,
  active,
  onChange,
}: {
  lesson: Lesson
  active: ContentFormat
  onChange: (format: ContentFormat) => void
}) {
  const formats = Object.keys(FORMAT_LABEL) as ContentFormat[]
  return (
    <div className="flex flex-wrap gap-1.5">
      {formats.map((format) => {
        const has = lesson.formats[format] !== undefined
        const Icon = FORMAT_ICON[format]
        return (
          <button
            key={format}
            type="button"
            disabled={!has}
            onClick={() => has && onChange(format)}
            title={has ? undefined : `${FORMAT_LABEL[format]} is not available for this lesson`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-body-13 font-medium transition-colors',
              !has && 'cursor-not-allowed border-border text-text-disabled opacity-60',
              has && format === active && 'border-accent bg-accent-subtle text-accent',
              has && format !== active && 'border-border-strong text-text-secondary hover:bg-surface-hover',
            )}
          >
            <Icon size={14} />
            {FORMAT_LABEL[format]}
          </button>
        )
      })}
    </div>
  )
}

export function MaterialViewer({ lesson, format, asset, className }: MaterialViewerProps) {
  const [playing, setPlaying] = useState(false)

  if (!format || !asset) {
    return (
      <EmptyState
        title="No content in this format"
        message="This lesson does not carry this format yet."
      />
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-surface', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-body-15 font-bold">{lesson.title}</p>
          <p className="text-body-12 text-text-muted">
            {FORMAT_LABEL[format]}
            {asset.durationSeconds ? ` · ${formatDuration(asset.durationSeconds)}` : ''}
            {asset.pageCount ? ` · ${asset.pageCount} pages` : ''}
            {` · ${formatBytes(asset.fileSizeBytes)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {asset.offlineEnabled && (
            <Badge tone="success" variant="subtle" size="sm">
              Available offline
            </Badge>
          )}
          <Button variant="secondary" size="sm" leftIcon={<Download size={14} />}>
            Download
          </Button>
        </div>
      </div>

      <div className="bg-ui-950 p-8">
        {format === 'video' && (
          <button
            onClick={() => setPlaying((p) => !p)}
            className="grid aspect-video w-full place-items-center rounded-xl bg-black/40"
            aria-label={playing ? 'Pause' : 'Play video'}
          >
            <span className="grid size-16 place-items-center rounded-full bg-white/90 text-ui-950">
              <Play size={26} className={cn('ml-1', playing && 'hidden')} />
              {playing && <span className="text-body-12 font-semibold">Playing…</span>}
            </span>
          </button>
        )}

        {(format === 'audio' || format === 'podcast') && (
          <div className="flex items-center gap-4 rounded-xl bg-white/5 p-6">
            <button
              onClick={() => setPlaying((p) => !p)}
              className="grid size-12 shrink-0 place-items-center rounded-full bg-accent text-on-accent"
              aria-label={playing ? 'Pause' : 'Play audio'}
            >
              <Play size={18} className={playing ? 'hidden' : 'ml-0.5'} />
              {playing && <span className="text-[10px] font-bold">II</span>}
            </button>
            <div className="h-1.5 flex-1 rounded-full bg-white/15">
              <div className="h-full w-0 rounded-full bg-accent" />
            </div>
            <span className="shrink-0 text-body-12 text-white/70">
              {formatDuration(asset.durationSeconds)}
            </span>
          </div>
        )}

        {format === 'pdf' && (
          <div className="grid aspect-[4/3] place-items-center rounded-xl bg-white/5 text-white/70">
            <div className="text-center">
              <FileText size={32} className="mx-auto mb-2" />
              <p className="text-body-13">{asset.pageCount ?? '—'} pages · rendered inline in the real product</p>
            </div>
          </div>
        )}

        {format === 'transcript' && (
          <div className="max-h-96 overflow-y-auto rounded-xl bg-white/5 p-5 text-body-14 leading-relaxed text-white/85">
            {asset.transcriptBody ?? 'Transcript text was not seeded for this lesson.'}
          </div>
        )}
      </div>
    </div>
  )
}
