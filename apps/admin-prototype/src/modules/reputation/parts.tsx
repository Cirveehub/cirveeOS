/**
 * Reputation — module-local scaffolding.
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
  branchesCollection,
  cohortsCollection,
  coursesCollection,
  demo,
  peopleCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type {
  Channel,
  ProofAsset,
  ProofAssetType,
  ReviewTriggerMoment,
  Testimonial,
} from '@/mocks'

export const MODULE_ID = 'reputation'
const BASE = '/reputation'

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
  { id: 'requests', label: 'Review requests' },
  { id: 'testimonials', label: 'Testimonials' },
  { id: 'proof', label: 'Proof queue' },
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
/* The compliance rule this module exists under                               */
/* -------------------------------------------------------------------------- */

/**
 * Google's policy forbids offering anything of value in exchange for a review,
 * and breaching it risks the listing. Nothing in this module may offer a
 * reward, a discount or an incentive — a review request is a well-timed ask
 * and nothing more. The note is rendered permanently on the dashboard.
 */
export const REVIEW_COMPLIANCE_NOTE =
  'Never offer rewards, discounts or incentives for Google reviews. Ask at the right moment instead.'

/* -------------------------------------------------------------------------- */
/* Reputation vocabulary and lookups                                          */
/* -------------------------------------------------------------------------- */

/**
 * The five moments a request may fire on. A request is never sent at random —
 * it hangs off an event that already went well.
 */
export const TRIGGER_LABEL: Record<ReviewTriggerMoment, string> = {
  certificate_issued: 'Certificate issued',
  strong_grade: 'Strong grade returned',
  placement_confirmed: 'Placement confirmed',
  corporate_engagement_completed: 'Corporate engagement completed',
  exit_kiosk_tap: 'Exit kiosk tap',
}

export const TRIGGER_ORDER: ReviewTriggerMoment[] = [
  'certificate_issued',
  'strong_grade',
  'placement_confirmed',
  'corporate_engagement_completed',
  'exit_kiosk_tap',
]

export const CHANNEL_LABEL: Record<Channel, string> = {
  in_app: 'In app',
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
}

export const TESTIMONIAL_STATUS_LABEL: Record<Testimonial['status'], string> = {
  new: 'New',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
}

export const TESTIMONIAL_STATUS_TONE: Record<Testimonial['status'], BadgeTone> = {
  new: 'info',
  approved: 'accent',
  published: 'success',
  archived: 'neutral',
}

export const PROOF_TYPE_LABEL: Record<ProofAssetType, string> = {
  graduation: 'Graduation',
  placement: 'Placement',
  standout_project: 'Standout project',
  cohort_milestone: 'Cohort milestone',
}

export const PROOF_STATUS_LABEL: Record<ProofAsset['status'], string> = {
  drafted: 'Drafted',
  in_production: 'In production',
  approved: 'Approved',
  published: 'Published',
  discarded: 'Discarded',
}

export const PROOF_STATUS_TONE: Record<ProofAsset['status'], BadgeTone> = {
  drafted: 'neutral',
  in_production: 'warning',
  approved: 'accent',
  published: 'success',
  discarded: 'neutral',
}

export const CONSENT_LABEL: Record<ProofAsset['consentStatus'], string> = {
  granted: 'Granted',
  pending: 'Pending',
  declined: 'Declined',
}

export const CONSENT_TONE: Record<ProofAsset['consentStatus'], BadgeTone> = {
  granted: 'success',
  pending: 'warning',
  declined: 'danger',
}

export function useCourseTitle(): (id: string | null | undefined) => string {
  const courses = useCollection(coursesCollection)
  const byId = useMemo(() => new Map(courses.map((c) => [c.id as string, c.title])), [courses])
  return (id) => (id ? (byId.get(id) ?? 'Unknown course') : '—')
}

export function useCohortCode(): (id: string | null | undefined) => string {
  const cohorts = useCollection(cohortsCollection)
  const byId = useMemo(() => new Map(cohorts.map((c) => [c.id as string, c.code])), [cohorts])
  return (id) => (id ? (byId.get(id) ?? 'Unknown cohort') : 'No cohort')
}

export function useBranchName(): (id: string | null | undefined) => string {
  const branches = useCollection(branchesCollection)
  const byId = useMemo(() => new Map(branches.map((b) => [b.id as string, b.name])), [branches])
  return (id) => (id ? (byId.get(id) ?? 'Unknown branch') : '—')
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

/** Within the trailing 30 days of the seeded today. */
export function isWithin30Days(isoDateTime: string): boolean {
  const days = daysBetween(isoDateTime, TODAY)
  return days >= 0 && days <= 30
}

const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Aug 2026" from an ISO timestamp, for grouping a trend by month. */
export function monthLabel(isoDateTime: string): string {
  const month = Number(isoDateTime.slice(5, 7)) - 1
  return `${MONTH_LABEL[month] ?? '—'} ${isoDateTime.slice(0, 4)}`
}

/** The last `count` months ending with the seeded today, oldest first. */
export function recentMonths(count: number): Array<{ key: string; label: string }> {
  const year = Number(TODAY.slice(0, 4))
  const month = Number(TODAY.slice(5, 7)) - 1
  return Array.from({ length: count }, (_, i) => {
    const offset = month - (count - 1 - i)
    const y = year + Math.floor(offset / 12)
    const m = ((offset % 12) + 12) % 12
    return { key: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${MONTH_LABEL[m]} ${y}` }
  })
}

export function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((acc, v) => acc + v, 0) / values.length
}
