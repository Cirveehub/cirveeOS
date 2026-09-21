/**
 * Thin compositions over `@/ui` used across the referral screens.
 *
 * Nothing here is a new primitive — every one of these renders a library
 * component with the module's vocabulary applied, so a commission state or a
 * role on the deal looks identical on the dashboard, the ledger, a payout line
 * and the simulator.
 */

import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

import { demo } from '@/mocks'
import type { CommissionRoleOnDeal, CommissionRule, CommissionState } from '@/mocks/types'
import { Alert, Badge, Button, PageHeader, ProgressBar, Tooltip } from '@/ui'
import type { Breadcrumb, TabItem } from '@/ui'
import { formatNaira } from '@/lib/format'

import {
  ROLE_LABEL,
  ROLE_TONE,
  RULE_STATUS_LABEL,
  RULE_STATUS_TONE,
  STATE_LABEL,
  STATE_TONE,
  effectiveRange,
  ruleCode,
} from './lib'

/* -------------------------------------------------------------------------- */
/* Module navigation                                                          */
/* -------------------------------------------------------------------------- */

export const MODULE_TABS: Array<{ id: string; label: string; to: string }> = [
  { id: 'dashboard', label: 'Dashboard', to: '/referral' },
  { id: 'referrers', label: 'Referrers', to: '/referral/referrers' },
  { id: 'rules', label: 'Commission rules', to: '/referral/rules' },
  { id: 'commissions', label: 'Ledger', to: '/referral/commissions' },
  { id: 'payouts', label: 'Payouts', to: '/referral/payouts' },
  { id: 'disputes', label: 'Disputes', to: '/referral/disputes' },
  { id: 'attribution', label: 'Attribution', to: '/referral/attribution' },
]

export interface ModulePageProps {
  tab: string
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  breadcrumbs?: Breadcrumb[]
}

/** The page header every top-level referral screen wears, with in-module tabs. */
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

/** The content column every referral screen sits in. */
export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] px-8 py-7">{children}</div>
}

/* -------------------------------------------------------------------------- */
/* Loading and error, as states rather than accidents                         */
/* -------------------------------------------------------------------------- */

const booted = new Set<string>()

/**
 * The four standard states, wired to the demo controls.
 *
 * - **Loading**: 400ms on the first visit to a screen in this tab, so the
 *   skeleton is actually visible in a demo rather than a flash.
 * - **Error**: `demo.forceError('referral')`, or `?demo=error` on any referral
 *   URL so the state is reachable and linkable without leaving the module.
 * - **Empty**: `demo.forceEmpty('referral')`, or `?demo=empty`.
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
  const [errored, setErrored] = useState(() => mode === 'error' || demo.isErrored('referral'))

  useEffect(() => {
    if (booted.has(scope)) return
    const timer = window.setTimeout(() => {
      booted.add(scope)
      setLoading(false)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [scope])

  useEffect(() => {
    setErrored(mode === 'error' || demo.isErrored('referral'))
  }, [mode])

  return {
    loading,
    errored,
    forcedEmpty: mode === 'empty' || demo.isEmpty('referral'),
    retry: () => {
      demo.clearError('referral')
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
      The request failed before any rows came back. Nothing has been changed. Retry, and if it keeps failing the
      commission engine is the thing to check first — no rule evaluates while this is down.
    </Alert>
  )
}

/* -------------------------------------------------------------------------- */
/* Vocabulary badges                                                          */
/* -------------------------------------------------------------------------- */

export function RoleBadge({ role, size = 'sm' }: { role: CommissionRoleOnDeal; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={ROLE_TONE[role]} variant="subtle" size={size}>
      {ROLE_LABEL[role]}
    </Badge>
  )
}

export function StateBadge({ state, size = 'sm' }: { state: CommissionState; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={STATE_TONE[state]} variant="subtle" size={size} dot>
      {STATE_LABEL[state]}
    </Badge>
  )
}

export function RuleStatusBadge({ status, size = 'sm' }: { status: CommissionRule['status']; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={RULE_STATUS_TONE[status]} variant="subtle" size={size} dot>
      {RULE_STATUS_LABEL[status]}
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

/**
 * The rule chip that appears on every commission row. It names the version, and
 * it links to that version read-only — the §3.6 requirement that a historical
 * commission can always be traced to the rule it was computed under.
 */
export function RuleChip({ rule, onOpen }: { rule: CommissionRule | undefined; onOpen?: () => void }) {
  if (!rule) {
    return (
      <Badge tone="danger" variant="subtle" size="sm" icon={<AlertTriangle size={12} />}>
        Rule version missing
      </Badge>
    )
  }
  const label = `${rule.name} v${rule.version}`
  const chip = (
    <Badge tone="neutral" variant="outline" size="sm">
      {label}
    </Badge>
  )
  const tooltip = `${ruleCode(rule)} · ${effectiveRange(rule)}`

  if (!onOpen) return <Tooltip content={tooltip}>{chip}</Tooltip>

  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface"
        aria-label={`Open ${label}, effective ${effectiveRange(rule)}`}
      >
        {chip}
      </button>
    </Tooltip>
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

/** Money as plain text where a `MoneyCell` would be too heavy (inside a sentence). */
export function money(kobo: number): string {
  return formatNaira(kobo)
}
