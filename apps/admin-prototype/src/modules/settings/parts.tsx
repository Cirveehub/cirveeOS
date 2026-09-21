/**
 * Settings — module-local scaffolding.
 *
 * `Screen`, `useModuleData` and `BarList` are composed entirely from `@/ui`
 * primitives and layout markup; they exist here because the library has no
 * page shell, no first-load hook and no chart. All three belong in `src/ui/`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import type { BusinessUnit } from '@/app/module-registry'
import { cn } from '@/lib/cn'
import { Alert, Button, PageHeader, ProgressBar, SkeletonCard, SkeletonTable } from '@/ui'
import {
  demo,
  employeesCollection,
  peopleCollection,
  unitsCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type { UnitCode } from '@/mocks'

export const MODULE_ID = 'settings'
const BASE = '/settings'

/** The content well has no padding of its own — every screen supplies it. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1560px] px-6 py-6">{children}</div>
}

/**
 * The shell renders module `subnav` only in the command palette, so every
 * module carries its own in-page navigation. This belongs in the shell.
 */
const NAV = [
  { id: '', label: 'Overview' },
  { id: 'organisation', label: 'Organisation' },
  { id: 'branches', label: 'Branches' },
  { id: 'units', label: 'Business units' },
  { id: 'departments', label: 'Departments' },
  { id: 'users', label: 'Users' },
  { id: 'roles', label: 'Roles and permissions' },
  { id: 'policies', label: 'Policies' },
  { id: 'audit', label: 'Audit log' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'numbering', label: 'Numbering' },
  { id: 'demo', label: 'Demo controls' },
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
/* Unit bridge                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The store keys units by `UnitId` and carries an uppercase `UnitCode`; the
 * `UnitTag` component keys off the registry's lowercase `BusinessUnit`.
 *
 * FLAG: this bridge is duplicated in five module folders. It belongs in
 * `src/ui/UnitTag.tsx`.
 */
const UNIT_KEY: Record<UnitCode, BusinessUnit> = {
  ACADEMY: 'academy',
  TEENS: 'teens',
  CORPORATE: 'corporate',
  DEXURB: 'dexurb',
  AFRICA: 'africa',
  TCF: 'tcf',
}

export function unitKey(unitId: string | null | undefined): BusinessUnit | null {
  if (!unitId) return null
  const code = unitsCollection.find(unitId)?.code
  return code ? UNIT_KEY[code] : null
}

export function unitKeyFromCode(code: UnitCode): BusinessUnit {
  return UNIT_KEY[code]
}

/** The employee behind a branch manager, unit head, department head or team lead. */
export function useEmployeeName(): (id: string | null | undefined) => string {
  const employees = useCollection(employeesCollection)
  const people = useCollection(peopleCollection)
  const byId = useMemo(() => {
    const names = new Map(people.map((p) => [p.id as string, `${p.firstName} ${p.lastName}`]))
    return new Map(employees.map((e) => [e.id as string, names.get(e.personId) ?? e.employeeId]))
  }, [employees, people])
  return (id) => (id ? (byId.get(id) ?? 'Unknown employee') : 'Not appointed')
}
