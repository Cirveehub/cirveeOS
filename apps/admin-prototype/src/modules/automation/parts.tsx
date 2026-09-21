/**
 * Thin compositions over `@/ui` shared across the automation screens.
 *
 * Nothing here is a new primitive. Each one renders a library component with
 * the module's vocabulary applied, so a run status looks identical on the
 * dashboard, the run list, the run trace and the exception queue.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { demo } from '@/mocks'
import type { AutomationExceptionStatus, AutomationRunStatus, AutomationStatus } from '@/mocks/types'
import { Alert, Badge, Button, PageHeader, ProgressBar } from '@/ui'
import type { Breadcrumb, TabItem } from '@/ui'

import {
  AUTOMATION_STATUS_LABEL,
  AUTOMATION_STATUS_TONE,
  EXCEPTION_STATUS_LABEL,
  EXCEPTION_STATUS_TONE,
  NODE_LABEL,
  NODE_STYLE,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  type NodeKind,
} from './lib'

/* -------------------------------------------------------------------------- */
/* Module navigation                                                          */
/* -------------------------------------------------------------------------- */

export const MODULE_TABS: Array<{ id: string; label: string; to: string }> = [
  { id: 'dashboard', label: 'Dashboard', to: '/automation' },
  { id: 'workflows', label: 'Workflows', to: '/automation/workflows' },
  { id: 'runs', label: 'Run history', to: '/automation/runs' },
  { id: 'exceptions', label: 'Exceptions', to: '/automation/exceptions' },
]

export interface ModulePageProps {
  tab: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  breadcrumbs?: Breadcrumb[]
}

/** The page header every top-level automation screen wears, with in-module tabs. */
export function ModulePage({ tab, title, description, actions, meta, breadcrumbs }: ModulePageProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const tabs: TabItem[] = MODULE_TABS.map((t) => ({ id: t.id, label: t.label }))

  return (
    <PageHeader
      title={title}
      description={description}
      actions={actions}
      meta={meta}
      breadcrumbs={breadcrumbs}
      tabs={tabs}
      activeTab={tab}
      onTabChange={(id) => {
        const target = MODULE_TABS.find((t) => t.id === id)
        if (target && target.to !== location.pathname) navigate(target.to)
      }}
    />
  )
}

/** The content column every automation screen sits in. */
export function Screen({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'w-full px-8 py-7' : 'mx-auto w-full max-w-[1400px] px-8 py-7'}>{children}</div>
  )
}

/* -------------------------------------------------------------------------- */
/* The four standard states                                                   */
/* -------------------------------------------------------------------------- */

const booted = new Set<string>()

/**
 * - **Loading**: 400ms on the first visit to a screen in this tab, so the
 *   skeleton is visible in a demo rather than a flash.
 * - **Error**: `demo.forceError('automation')`, or `?demo=error` on any
 *   automation URL, so the state is reachable and linkable.
 * - **Empty**: `demo.forceEmpty('automation')`, or `?demo=empty`.
 */
export function useScreenState(scope: string): {
  loading: boolean
  errored: boolean
  forcedEmpty: boolean
  retry: () => void
} {
  const [params, setParams] = useSearchParams()
  const mode = params.get('demo')
  const [loading, setLoading] = useState(() => !booted.has(scope))
  const [errored, setErrored] = useState(() => mode === 'error' || demo.isErrored('automation'))

  useEffect(() => {
    if (booted.has(scope)) return
    const timer = window.setTimeout(() => {
      booted.add(scope)
      setLoading(false)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [scope])

  useEffect(() => {
    setErrored(mode === 'error' || demo.isErrored('automation'))
  }, [mode])

  return {
    loading,
    errored,
    forcedEmpty: mode === 'empty' || demo.isEmpty('automation'),
    retry: () => {
      demo.clearError('automation')
      if (mode === 'error') {
        params.delete('demo')
        setParams(params, { replace: true })
      }
      setErrored(false)
    },
  }
}

export function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
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
      The request failed before any rows came back. Nothing has been changed and no automation was triggered while
      this was down — runs queue rather than drop. Retry, and if it keeps failing the automation engine is the thing
      to check first.
    </Alert>
  )
}

/* -------------------------------------------------------------------------- */
/* Vocabulary badges                                                          */
/* -------------------------------------------------------------------------- */

export function AutomationStatusBadge({ status, size = 'sm' }: { status: AutomationStatus; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={AUTOMATION_STATUS_TONE[status]} variant="subtle" size={size} dot>
      {AUTOMATION_STATUS_LABEL[status]}
    </Badge>
  )
}

export function RunStatusBadge({ status, size = 'sm' }: { status: AutomationRunStatus; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={RUN_STATUS_TONE[status]} variant="subtle" size={size} dot>
      {RUN_STATUS_LABEL[status]}
    </Badge>
  )
}

export function ExceptionStatusBadge({
  status,
  size = 'sm',
}: {
  status: AutomationExceptionStatus
  size?: 'sm' | 'md'
}) {
  return (
    <Badge tone={EXCEPTION_STATUS_TONE[status]} variant="subtle" size={size} dot>
      {EXCEPTION_STATUS_LABEL[status]}
    </Badge>
  )
}

export function VersionBadge({ version, size = 'sm' }: { version: number; size?: 'sm' | 'md' }) {
  return (
    <Badge tone="neutral" variant="outline" size={size} className="tabular-nums">
      v{version}
    </Badge>
  )
}

export function NodeKindBadge({ kind, size = 'sm' }: { kind: NodeKind; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={NODE_STYLE[kind].tone} variant="subtle" size={size}>
      {NODE_LABEL[kind]}
    </Badge>
  )
}

/** A monospace chip for an idempotency key — staff read these out loud. */
export function KeyChip({ value, className }: { value: string; className?: string }) {
  return (
    <code
      className={`inline-block max-w-full truncate rounded-lg bg-surface-sunken px-2 py-1 font-mono text-body-12 text-text-secondary ${className ?? ''}`}
      title={value}
    >
      {value}
    </code>
  )
}

/* -------------------------------------------------------------------------- */
/* Small charts, built from ProgressBar rather than a charting dependency     */
/* -------------------------------------------------------------------------- */

export interface BarRow {
  key: string
  label: ReactNode
  caption?: ReactNode
  value: number
  valueLabel: string
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
}

export function BarChart({ rows, max, ariaLabel }: { rows: BarRow[]; max?: number; ariaLabel: string }) {
  const ceiling = max ?? Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-3.5" aria-label={ariaLabel}>
      {rows.map((row) => (
        <li key={row.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body-13 text-text">{row.label}</span>
            <span className="shrink-0 text-body-13 font-semibold tabular-nums text-text">{row.valueLabel}</span>
          </div>
          <ProgressBar value={row.value} max={ceiling} tone={row.tone ?? 'accent'} size="sm" />
          {row.caption && <p className="mt-1 text-body-12 text-text-secondary">{row.caption}</p>}
        </li>
      ))}
    </ul>
  )
}

/**
 * Seven-day stacked column chart. Success, failure and waiting per day, drawn
 * from divs rather than a charting dependency so it inherits the role tokens.
 */
export function StackedDays({
  days,
  ariaLabel,
}: {
  days: Array<{ key: string; label: string; succeeded: number; failed: number; other: number }>
  ariaLabel: string
}) {
  const ceiling = Math.max(1, ...days.map((d) => d.succeeded + d.failed + d.other))
  return (
    <div className="flex items-end gap-3" role="img" aria-label={ariaLabel}>
      {days.map((d) => {
        const total = d.succeeded + d.failed + d.other
        const h = (n: number) => `${Math.round((n / ceiling) * 140)}px`
        return (
          <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <span className="text-body-12 tabular-nums text-text-secondary">{total}</span>
            <div className="flex w-full flex-col justify-end gap-0.5" style={{ height: 140 }}>
              {d.other > 0 && <div className="w-full rounded-t-sm bg-warning-500" style={{ height: h(d.other) }} />}
              {d.failed > 0 && <div className="w-full bg-danger-600" style={{ height: h(d.failed) }} />}
              <div className="w-full rounded-b-sm bg-accent" style={{ height: h(d.succeeded) }} />
            </div>
            <span className="truncate text-body-12 text-text-secondary">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function ChartLegend({ items }: { items: Array<{ key: string; label: string; swatch: string }> }) {
  return (
    <ul className="flex flex-wrap items-center gap-4">
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-2 text-body-12 text-text-secondary">
          <span className={`size-2.5 rounded-sm ${i.swatch}`} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  )
}
