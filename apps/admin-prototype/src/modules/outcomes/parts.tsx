/**
 * Employment and outcomes — module-local scaffolding.
 *
 * `Screen`, `useModuleData` and `BarList` are composed entirely from `@/ui`
 * primitives and layout markup; they exist here because the library has no
 * page shell, no first-load hook and no chart. All three belong in `src/ui/`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { cn } from '@/lib/cn'
import { Alert, Button, PageHeader, ProgressBar, SkeletonCard, SkeletonTable, type BadgeTone } from '@/ui'
import {
  TODAY,
  certificatesCollection,
  cohortsCollection,
  coursesCollection,
  demo,
  employersCollection,
  peopleCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type { Channel, OutcomeCheckpoint, OutcomeRecord, OutcomeType } from '@/mocks'

export const MODULE_ID = 'outcomes'
const BASE = '/outcomes'

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
  { id: 'graduates', label: 'Graduates' },
  { id: 'placements', label: 'Placements' },
  { id: 'employers', label: 'Employers' },
  { id: 'follow-ups', label: 'Follow-up queue' },
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
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <SkeletonCard key={i} variant="stat" />
        ))}
      </div>
      <SkeletonTable rows={6} columns={4} />
    </div>
  )
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

/* -------------------------------------------------------------------------- */
/* Outcome vocabulary and lookups                                             */
/* -------------------------------------------------------------------------- */

/** Sentence-case labels for the seven outcome types the PRD recognises. */
export const OUTCOME_TYPE_LABEL: Record<OutcomeType, string> = {
  full_time: 'Full-time',
  contract: 'Contract',
  freelance: 'Freelance',
  internship: 'Internship',
  self_employed: 'Self-employed',
  further_study: 'Further study',
  not_yet_placed: 'Not yet placed',
}

export const OUTCOME_TYPE_ORDER: OutcomeType[] = [
  'full_time',
  'contract',
  'internship',
  'freelance',
  'self_employed',
  'further_study',
  'not_yet_placed',
]

export function outcomeTypeTone(type: OutcomeType): BadgeTone {
  if (type === 'not_yet_placed') return 'warning'
  if (type === 'full_time') return 'success'
  if (type === 'further_study') return 'info'
  return 'accent'
}

/** Everything except `not_yet_placed` counts as an outcome, per the PRD. */
export function isPlaced(record: OutcomeRecord): boolean {
  return record.outcomeType !== 'not_yet_placed'
}

export const RELEVANCE_LABEL: Record<'direct' | 'adjacent' | 'unrelated', string> = {
  direct: 'Direct',
  adjacent: 'Adjacent',
  unrelated: 'Unrelated',
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: 'In app',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
}

export const CHECKPOINT_STATUS_TONE: Record<OutcomeCheckpoint['status'], BadgeTone> = {
  scheduled: 'neutral',
  sent: 'info',
  responded: 'success',
  no_response: 'danger',
}

export const CHECKPOINT_STATUS_LABEL: Record<OutcomeCheckpoint['status'], string> = {
  scheduled: 'Scheduled',
  sent: 'Sent',
  responded: 'Responded',
  no_response: 'No response',
}

export function useCourseTitle(): (id: string | null | undefined) => string {
  const courses = useCollection(coursesCollection)
  const byId = useMemo(() => new Map(courses.map((c) => [c.id as string, c.title])), [courses])
  return (id) => (id ? (byId.get(id) ?? 'Unknown course') : '—')
}

export function useCohortCode(): (id: string | null | undefined) => string {
  const cohorts = useCollection(cohortsCollection)
  const byId = useMemo(() => new Map(cohorts.map((c) => [c.id as string, c.code])), [cohorts])
  return (id) => (id ? (byId.get(id) ?? 'Unknown cohort') : '—')
}

export function useEmployerName(): (id: string | null | undefined) => string {
  const employers = useCollection(employersCollection)
  const byId = useMemo(() => new Map(employers.map((e) => [e.id as string, e.name])), [employers])
  return (id) => (id ? (byId.get(id) ?? 'Unknown employer') : 'No employer recorded')
}

/** The public certificate reference — "CIR-CERT-2026-0418", not the internal id. */
export function useCertificateRef(): (id: string | null | undefined) => string {
  const certificates = useCollection(certificatesCollection)
  const byId = useMemo(
    () => new Map(certificates.map((c) => [c.id as string, c.certificateId])),
    [certificates],
  )
  return (id) => (id ? (byId.get(id) ?? '—') : '—')
}

/* -------------------------------------------------------------------------- */
/* Dates — all arithmetic hangs off the seed's fixed clock, never Date.now()  */
/* -------------------------------------------------------------------------- */

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (Date.parse(`${to.slice(0, 10)}T00:00:00Z`) - Date.parse(`${from.slice(0, 10)}T00:00:00Z`)) /
      86_400_000,
  )
}

export function monthsBetween(from: string, to: string): number {
  return daysBetween(from, to) / 30.44
}

/** Days past a due date as of the seeded today. Zero when not yet due. */
export function daysOverdue(dueDate: string): number {
  return Math.max(0, daysBetween(dueDate, TODAY))
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * The checkpoint a graduate is next expected to answer — the earliest one that
 * has not come back yet. `null` once all three have closed.
 */
export function nextCheckpoint(record: OutcomeRecord): OutcomeCheckpoint | null {
  return (
    [...record.checkpoints]
      .sort((a, b) => a.month - b.month)
      .find((c) => c.status === 'scheduled' || c.status === 'sent') ?? null
  )
}

/** The most recent contact attempt across all three checkpoints. */
export function lastContacted(record: OutcomeRecord): OutcomeCheckpoint | null {
  const touched = record.checkpoints.filter((c) => c.attempts > 0)
  if (touched.length === 0) return null
  return touched.reduce((latest, c) => (c.dueDate > latest.dueDate ? c : latest))
}
