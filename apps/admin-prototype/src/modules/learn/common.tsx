import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { NavLink, useSearchParams } from 'react-router-dom'
import toast, { Toaster } from 'react-hot-toast'
import {
  CheckCircle2,
  FileText,
  Headphones,
  Mic,
  Play,
  Type,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import {
  Alert,
  Badge,
  BUSINESS_UNITS,
  Button,
  Tooltip,
  type BadgeTone,
} from '@/ui'
import type { BusinessUnit as ShellBusinessUnit } from '@/app/module-registry'
import {
  demo,
  gradingBacklog,
  peopleCollection,
  unitsCollection,
  usersCollection,
  type ContentFormat,
  type PersonId,
} from '@/mocks'

export interface FormatMeta {
  format: ContentFormat
  label: string
  letter: string
  icon: LucideIcon
  missingConsequence: string
}

export const FORMATS: readonly FormatMeta[] = [
  {
    format: 'video',
    label: 'Video',
    letter: 'V',
    icon: Play,
    missingConsequence: 'No video version for this lesson.',
  },
  {
    format: 'audio',
    label: 'Audio',
    letter: 'A',
    icon: Headphones,
    missingConsequence: 'No audio version for this lesson.',
  },
  {
    format: 'podcast',
    label: 'Podcast',
    letter: 'P',
    icon: Mic,
    missingConsequence: 'This lesson is not on the podcast feed.',
  },
  {
    format: 'pdf',
    label: 'PDF / slides',
    letter: 'D',
    icon: FileText,
    missingConsequence: 'No slide deck or PDF for this lesson.',
  },
  {
    format: 'transcript',
    label: 'Transcript',
    letter: 'T',
    icon: Type,
    missingConsequence: 'No transcript for this lesson — it is not searchable.',
  },
] as const

export const FORMAT_ORDER: readonly ContentFormat[] = FORMATS.map((f) => f.format)

export function formatMeta(format: ContentFormat): FormatMeta {
  return FORMATS.find((f) => f.format === format) ?? FORMATS[0]
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '—'
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

export function formatDuration(seconds: number | undefined): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
  return `${m}m ${String(s).padStart(2, '0')}s`
}

export function formatMinutes(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${minutes}m`
}

export function personName(id: PersonId | string | null | undefined): string {
  if (!id) return 'Unassigned'
  const p = peopleCollection.find(id)
  return p ? `${p.firstName} ${p.lastName}` : String(id)
}

export function userName(id: string | null | undefined): string {
  if (!id) return 'System'
  const user = usersCollection.find(id)
  if (user) return personName(user.personId)
  return personName(id)
}

export function unitTagOf(unitId: string | null | undefined): ShellBusinessUnit | null {
  if (!unitId) return null
  const code = unitsCollection.find(unitId)?.code
  if (!code) return null
  const lower = code.toLowerCase()
  return (BUSINESS_UNITS as readonly string[]).includes(lower) ? (lower as ShellBusinessUnit) : null
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
}

const alreadyMounted = new Set<string>()

export function useScreenLoading(key: string): boolean {
  const [loading, setLoading] = useState(() => !alreadyMounted.has(key))
  useEffect(() => {
    if (alreadyMounted.has(key)) return
    const t = window.setTimeout(() => {
      alreadyMounted.add(key)
      setLoading(false)
    }, 400)
    return () => window.clearTimeout(t)
  }, [key])
  return loading
}

export function useScreenError(scope = 'learn'): { errored: boolean; retry: () => void } {
  const [params, setParams] = useSearchParams()
  const [dismissed, setDismissed] = useState(false)
  const forced = params.get('error') === '1' || demo.isErrored(scope)
  return {
    errored: forced && !dismissed,
    retry: () => {
      demo.clearError(scope)
      if (params.get('error') === '1') {
        const next = new URLSearchParams(params)
        next.delete('error')
        setParams(next, { replace: true })
      }
      setDismissed(true)
    },
  }
}

export function ScreenError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <Alert
      tone="danger"
      title={`${what} could not be loaded`}
      action={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      The request timed out. Nothing has been changed — retrying is safe.
    </Alert>
  )
}

interface LearnNavItem {
  label: string
  to: string
  badge?: () => number
}

export const LEARN_NAV: LearnNavItem[] = [
  { label: 'Dashboard', to: '/learn' },
  { label: 'Courses', to: '/learn/courses' },
  { label: 'Content library', to: '/learn/library' },
  { label: 'Assignments', to: '/learn/assignments' },
  { label: 'Grading', to: '/learn/submissions', badge: () => gradingBacklog().length },
  { label: 'Quizzes', to: '/learn/quizzes' },
  { label: 'Progress', to: '/learn/progress' },
  { label: 'Certificates', to: '/learn/certificates' },
]

export function Screen({
  children,
  nav = true,
  wide = false,
  bare = false,
}: {
  children: ReactNode
  nav?: boolean
  wide?: boolean
  bare?: boolean
}) {
  if (bare) {
    return (
      <div className="min-h-full bg-canvas">
        {children}
        <LearnToaster />
      </div>
    )
  }
  return (
    <div className="min-h-full bg-canvas">
      {nav && <LearnSubnav />}
      <div className={cn('mx-auto px-6 py-6', wide ? 'max-w-[1600px]' : 'max-w-[1400px]')}>{children}</div>
      <LearnToaster />
    </div>
  )
}

function LearnSubnav() {
  return (
    <nav
      aria-label="Cirvee Learn sections"
      className="sticky top-0 z-10 border-b border-border bg-surface/95 px-6 backdrop-blur"
    >
      <ul className="flex items-center gap-1 overflow-x-auto">
        {LEARN_NAV.map((item) => {
          const count = item.badge?.()
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/learn'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-body-13 font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface',
                    isActive
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text',
                  )
                }
              >
                {item.label}
                {count ? (
                  <Badge tone="neutral" size="sm">
                    {count}
                  </Badge>
                ) : null}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function LearnToaster() {
  return (
    <Toaster
      position="bottom-right"
      gutter={8}
      containerClassName="!bottom-6 !right-6"
      toastOptions={{ duration: 4000 }}
    />
  )
}

export const learnToast = {
  success(message: string, detail?: string) {
    toast.custom((t) => <ToastShell visible={t.visible} tone="success" message={message} detail={detail} />)
  },
  info(message: string, detail?: string) {
    toast.custom((t) => <ToastShell visible={t.visible} tone="info" message={message} detail={detail} />)
  },
  error(message: string, detail?: string) {
    toast.custom((t) => <ToastShell visible={t.visible} tone="danger" message={message} detail={detail} />)
  },
}

function ToastShell({
  visible,
  tone,
  message,
  detail,
}: {
  visible: boolean
  tone: 'success' | 'info' | 'danger'
  message: string
  detail?: string
}) {
  const ink =
    tone === 'success' ? 'text-success-ink' : tone === 'danger' ? 'text-danger-ink' : 'text-info-ink'
  const fill =
    tone === 'success'
      ? 'bg-success-fill border-success-line'
      : tone === 'danger'
        ? 'bg-danger-fill border-danger-line'
        : 'bg-info-fill border-info-line'
  const Icon = tone === 'danger' ? XCircle : CheckCircle2
  return (
    <div
      role="status"
      className={cn(
        'flex max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-md transition-opacity',
        fill,
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <Icon size={16} className={cn('mt-0.5 shrink-0', ink)} />
      <div className="min-w-0">
        <div className={cn('text-body-13 font-semibold', ink)}>{message}</div>
        {detail && <div className={cn('mt-0.5 text-body-12', ink)}>{detail}</div>}
      </div>
    </div>
  )
}

export function FormatPills({
  formats,
  size = 'sm',
  label,
}: {
  formats: Partial<Record<ContentFormat, string>>
  size?: 'sm' | 'md'
  label?: string
}) {
  const have = FORMAT_ORDER.filter((f) => formats[f] !== undefined)
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${label ? `${label}: ` : ''}${have.length} of 5 formats — ${
        have.length ? have.map((f) => formatMeta(f).label).join(', ') : 'none'
      }`}
    >
      {FORMATS.map((meta) => {
        const present = formats[meta.format] !== undefined
        return (
          <Tooltip
            key={meta.format}
            content={present ? `${meta.label} — present` : `${meta.label} — missing`}
          >
            <span
              aria-hidden
              className={cn(
                'grid place-items-center rounded-sm font-bold leading-none',
                size === 'sm' ? 'size-4 text-[9px]' : 'size-5 text-[10px]',
                present
                  ? 'bg-accent-subtle text-accent'
                  : 'border border-dashed border-border-strong text-text-muted',
              )}
            >
              {meta.letter}
            </span>
          </Tooltip>
        )
      })}
    </span>
  )
}

export function CoverageCell({
  have,
  total,
  onClick,
  formatLabel,
  courseTitle,
}: {
  have: number
  total: number
  onClick?: () => void
  formatLabel: string
  courseTitle: string
}) {
  const ratio = total === 0 ? 0 : have / total
  const tone = total === 0 ? 'empty' : ratio === 1 ? 'full' : ratio >= 0.5 ? 'partial' : 'thin'
  const bar =
    tone === 'full'
      ? 'bg-success-600'
      : tone === 'partial'
        ? 'bg-warning-500'
        : tone === 'thin'
          ? 'bg-danger-600'
          : 'bg-border-strong'
  const text =
    tone === 'full' ? 'text-success-text' : tone === 'thin' ? 'text-danger-text' : 'text-text'

  const body = (
    <>
      <span className={cn('text-body-12 font-semibold tabular-nums', text)}>
        {total === 0 ? 'No lessons' : `${have}/${total}`}
      </span>
      <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
        <span className={cn('block h-full rounded-full', bar)} style={{ width: `${ratio * 100}%` }} />
      </span>
    </>
  )

  if (!onClick || total === 0) {
    return <div className="w-full px-2 py-1.5">{body}</div>
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${courseTitle}: ${have} of ${total} lessons have ${formatLabel}. Open the gap.`}
      className="w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {body}
    </button>
  )
}

export function CriterionRow({
  criterion,
  required,
  actual,
  met,
  note,
}: {
  criterion: string
  required: string
  actual: string
  met: boolean
  note?: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
      <span
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
          met ? 'bg-success-fill text-success-ink' : 'bg-danger-fill text-danger-ink',
        )}
        aria-hidden
      >
        {met ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-body-13 font-medium text-text">{criterion}</span>
          <Badge tone={met ? 'success' : 'danger'} size="sm">
            {met ? 'Met' : 'Not met'}
          </Badge>
        </div>
        <div className="mt-0.5 text-body-12 text-text-secondary">
          <span className={cn('font-semibold', met ? 'text-text' : 'text-danger-text')}>{actual}</span>
          <span className="mx-1.5 text-text-muted">against</span>
          <span>{required}</span>
        </div>
        {note && <div className="mt-1 text-body-12 text-text-secondary">{note}</div>}
      </div>
    </div>
  )
}

export function statusTone(status: string): BadgeTone {
  switch (status) {
    case 'published':
    case 'uploaded':
    case 'graded':
    case 'issued':
    case 'complete':
      return 'success'
    case 'processing':
    case 'draft':
    case 'awaiting_grading':
    case 'eligible_not_issued':
      return 'warning'
    case 'missing':
    case 'revoked':
    case 'failed':
      return 'danger'
    default:
      return 'neutral'
  }
}

export function useSimulatedUpload() {
  const [progress, setProgress] = useState<number | null>(null)
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'processing'>('idle')
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  function start(onDone: () => void) {
    setPhase('uploading')
    setProgress(0)
    const steps = [12, 28, 47, 63, 81, 94, 100]
    steps.forEach((value, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setProgress(value)
          if (value === 100) {
            setPhase('processing')
            timers.current.push(
              window.setTimeout(() => {
                setPhase('idle')
                setProgress(null)
                onDone()
              }, 2000),
            )
          }
        }, 120 * (i + 1)),
      )
    })
  }

  return { progress, phase, start, busy: phase !== 'idle' }
}

export function nowIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${demo.effectiveToday()}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}+01:00`
}

export function useAutosaveStamp(): [string | null, () => void] {
  const [stamp, setStamp] = useState<string | null>(null)
  const mark = useMemo(
    () => () => {
      const d = new Date()
      setStamp(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
    },
    [],
  )
  return [stamp, mark]
}
