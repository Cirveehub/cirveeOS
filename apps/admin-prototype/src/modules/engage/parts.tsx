import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Alert, Button, PageHeader, ProgressBar, SkeletonCard, SkeletonTable } from '@/ui'
import { demo, peopleCollection, useCollection, usersCollection, type Channel } from '@/mocks'

export const MODULE_ID = 'engage'

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-app',
}

export interface EmailDesign {
  id: string
  name: string
  description: string
  headerClass: string
  footerClass: string
}

/**
 * A content template holds the words; a design decides what the email looks
 * like around them — a logo, a colour bar, a footer. Without this, every
 * email a campaign sends is unstyled body text regardless of channel, which
 * is not what an email from a real organisation looks like. These three are
 * fixed presets rather than a records collection because nothing here is a
 * business record — nobody reports on a design or approves one.
 */
export const EMAIL_DESIGNS: EmailDesign[] = [
  {
    id: 'plain',
    name: 'Plain text',
    description: 'No header or footer — reads like a personal email, not a broadcast.',
    headerClass: 'bg-surface-sunken',
    footerClass: 'bg-surface-sunken',
  },
  {
    id: 'branded-header',
    name: 'Branded header',
    description: 'A logo bar above the message and an unsubscribe line below.',
    headerClass: 'bg-accent',
    footerClass: 'bg-surface-sunken',
  },
  {
    id: 'announcement',
    name: 'Announcement banner',
    description: 'The subject becomes a full-width headline — built for one big update.',
    headerClass: 'bg-info-600',
    footerClass: 'bg-surface-sunken',
  },
]

export function emailDesign(id: string | null | undefined): EmailDesign {
  return EMAIL_DESIGNS.find((d) => d.id === id) ?? EMAIL_DESIGNS[0]
}

function DesignSwatch({ design }: { design: EmailDesign }) {
  return (
    <div className="w-full overflow-hidden rounded-md border border-border" aria-hidden="true">
      <div className={cn('h-2.5', design.headerClass)} />
      <div className="h-6 bg-surface" />
      <div className={cn('h-1.5', design.footerClass)} />
    </div>
  )
}

export function EmailDesignPicker({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (id: string) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label="Email design">
      {EMAIL_DESIGNS.map((design) => {
        const selected = value === design.id
        return (
          <button
            key={design.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(design.id)}
            className={cn(
              'flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              selected ? 'border-accent bg-accent-subtle' : 'border-border hover:border-border-strong',
            )}
          >
            <DesignSwatch design={design} />
            <span>
              <span className="block text-body-13 font-semibold text-text">{design.name}</span>
              <span className="block text-body-12 text-text-secondary">{design.description}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function EmailPreviewChrome({
  design,
  subject,
  body,
}: {
  design: EmailDesign
  subject: string | null
  body: string
}) {
  if (design.id === 'plain') {
    return (
      <div className="px-4 py-3">
        {subject && <p className="text-body-14 font-semibold text-text">{subject}</p>}
        <p className="mt-1 whitespace-pre-line text-body-13 text-text-secondary">{body}</p>
      </div>
    )
  }

  if (design.id === 'announcement') {
    return (
      <>
        <div className={cn('px-4 py-6 text-center', design.headerClass)}>
          <p className="text-label-11 uppercase tracking-wide text-on-accent">Cirvee</p>
          {subject && <p className="mt-1 text-heading-20 font-bold text-on-accent">{subject}</p>}
        </div>
        <div className="px-4 py-3">
          <p className="whitespace-pre-line text-body-13 text-text-secondary">{body}</p>
        </div>
        <div className="border-t border-border px-4 py-2 text-center text-body-12 text-text-muted">
          You are receiving this because you are on a Cirvee mailing list. Unsubscribe
        </div>
      </>
    )
  }

  return (
    <>
      <div className={cn('flex items-center gap-2 px-4 py-2.5', design.headerClass)}>
        <span className="grid size-6 shrink-0 place-items-center rounded bg-surface text-body-12 font-bold text-accent">
          C
        </span>
        <span className="text-body-13 font-semibold text-on-accent">Cirvee</span>
      </div>
      <div className="px-4 py-3">
        {subject && <p className="text-body-14 font-semibold text-text">{subject}</p>}
        <p className="mt-1 whitespace-pre-line text-body-13 text-text-secondary">{body}</p>
      </div>
      <div className="border-t border-border px-4 py-2 text-center text-body-12 text-text-muted">
        You are receiving this because you are on a Cirvee mailing list. Unsubscribe
      </div>
    </>
  )
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1560px] px-6 py-6">{children}</div>
}

export function ModuleHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return <PageHeader title={title} description={description} actions={actions} meta={meta} />
}

export function useModuleData<T>(rows: T[], scope: string): {
  loading: boolean
  error: boolean
  rows: T[]
  retry: () => void
} {
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setLoading(true)
    const timer = window.setTimeout(() => setLoading(false), 400 + demo.latency())
    return () => window.clearTimeout(timer)
  }, [attempt])

  return {
    loading,
    error: demo.isErrored(scope),
    rows: demo.isEmpty(MODULE_ID) ? [] : rows,
    retry: () => setAttempt((n) => n + 1),
  }
}

export function ErrorPanel({ onRetry, what }: { onRetry: () => void; what: string }) {
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
      The request failed before any rows came back. Nothing has been changed.
    </Alert>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <SkeletonCard key={i} variant="stat" />
        ))}
      </div>
      <SkeletonTable rows={6} columns={4} />
    </div>
  )
}

export function usePersonName(): (id: string | null | undefined) => string {
  const people = useCollection(peopleCollection)
  const byId = useMemo(
    () => new Map(people.map((p) => [p.id as string, `${p.firstName} ${p.lastName}`])),
    [people],
  )
  return (id) => (id ? (byId.get(id) ?? 'Unknown person') : '—')
}

export function useUserName(): (id: string | null | undefined) => string {
  const users = useCollection(usersCollection)
  const people = useCollection(peopleCollection)
  const byId = useMemo(() => {
    const names = new Map(people.map((p) => [p.id as string, `${p.firstName} ${p.lastName}`]))
    return new Map(users.map((u) => [u.id as string, names.get(u.personId) ?? u.email]))
  }, [users, people])
  return (id) => (id ? (byId.get(id) ?? 'Unknown user') : 'Unassigned')
}

export interface BarRow {
  key: string
  label: ReactNode
  value: number
  valueLabel: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
  note?: ReactNode
}

export function BarList({
  rows,
  max,
  emptyMessage = 'Nothing to plot yet.',
  className,
}: {
  rows: BarRow[]
  max?: number
  emptyMessage?: string
  className?: string
}) {
  const ceiling = max ?? Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) {
    return <p className="text-body-13 text-text-secondary">{emptyMessage}</p>
  }
  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((row) => (
        <li key={row.key}>
          <ProgressBar
            value={row.value}
            max={ceiling}
            tone={row.tone ?? 'accent'}
            size="sm"
            label={row.label}
            valueLabel={row.valueLabel}
          />
          {row.note && <p className="mt-1 text-body-12 text-text-secondary">{row.note}</p>}
        </li>
      ))}
    </ul>
  )
}

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1))
}
