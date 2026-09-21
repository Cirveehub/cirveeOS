/**
 * Corporate — module-local scaffolding.
 *
 * `Screen`, `useModuleData` and `BarList` are composed entirely from `@/ui`
 * primitives and layout markup; they exist here because the library has no
 * page shell, no first-load hook and no chart. All three belong in `src/ui/`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { Alert, Button, PageHeader, ProgressBar, SkeletonCard, SkeletonTable } from '@/ui'
import {
  CURRENT_USER_ID,
  TODAY,
  auditEventsCollection,
  demo,
  peopleCollection,
  rolesCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import { auditId } from '@/mocks/types'

export const MODULE_ID = 'corporate'
const BASE = '/corporate'

/** The content well has no padding of its own — every screen supplies it. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1560px] px-6 py-6">{children}</div>
}

/**
 * The shell renders module `subnav` only in the command palette, so every
 * module carries its own in-page navigation. This belongs in the shell.
 */
const NAV = [
  { id: '', label: 'Dashboard' },
  { id: 'organisations', label: 'Organisations' },
  { id: 'deals', label: 'Deals' },
  { id: 'participants', label: 'Participants' },
]

export function ModuleHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const relative = pathname.startsWith(BASE) ? pathname.slice(BASE.length).replace(/^\//, '') : ''
  const active =
    [...NAV]
      .sort((a, b) => b.id.length - a.id.length)
      .find((item) =>
        item.id === '' ? relative === '' : relative === item.id || relative.startsWith(`${item.id}/`),
      )?.id ?? ''

  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      tabs={NAV.map((item) => ({ id: item.id || 'overview', label: item.label }))}
      activeTab={active || 'overview'}
      onTabChange={(id) => navigate(id === 'overview' ? BASE : `${BASE}/${id}`)}
    />
  )
}

/**
 * First-mount delay so the skeleton is actually visible in a demo, plus the
 * two demo-control switches the spec wires into Settings → Demo controls.
 */
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
      <div className="flex gap-6 border-b border-border pb-3">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="h-4 w-20 animate-pulse rounded-lg bg-surface-sunken" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} variant="stat" />
        ))}
      </div>
      <SkeletonTable rows={6} columns={4} />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Stat band — one theme's question, its one-sentence answer, its cards       */
/* -------------------------------------------------------------------------- */

/**
 * The tabbed-dashboard unit: a theme states its question, answers it in one
 * sentence, and only then shows numbers. Mirrors the command centre's
 * `StatBand`, which lives in that module rather than in `@/ui`; both belong in
 * the library.
 */
export function Band({
  question,
  answer,
  children,
  className,
}: {
  question: string
  answer: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)} aria-label={question}>
      <div className="space-y-0.5">
        <h2 className="text-heading-18 text-text">{question}</h2>
        <p className="text-body-13 text-text-secondary">{answer}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

let auditSequence = 0

/**
 * Append-only. Creating a client organisation or a deal assigns an account
 * owner, and ownership changes are on the PRD's audited-actions list, so both
 * creation flows land an event here rather than only in the activity feed.
 */
export function emitCorporateAudit(input: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): void {
  auditSequence += 1
  const actor = usersCollection.find(CURRENT_USER_ID)
  const person = actor ? peopleCollection.find(actor.personId) : undefined
  auditEventsCollection.insert({
    id: auditId(`aud-corp-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: `${TODAY}T09:00:00+01:00`,
    actorUserId: CURRENT_USER_ID,
    actorName: person ? `${person.firstName} ${person.lastName}` : 'Super Admin',
    actorRole: actor?.roleIds[0] ? (rolesCollection.find(actor.roleIds[0])?.name ?? 'Super Admin') : 'Super Admin',
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: 'ui',
    ip: '102.89.34.17',
  })
}

/** The audit stamp every corporate write shares. */
export function corporateStamp(): { createdAt: string; createdBy: typeof CURRENT_USER_ID; updatedAt: string; updatedBy: typeof CURRENT_USER_ID } {
  const at = `${TODAY}T09:00:00+01:00`
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

/* -------------------------------------------------------------------------- */
/* Name lookups                                                               */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Bar list — the stand-in for a chart component                              */
/* -------------------------------------------------------------------------- */

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

/** A right-aligned percentage, one decimal at most. */
export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1))
}
