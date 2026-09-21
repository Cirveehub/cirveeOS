import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

import { demo } from '@/mocks'
import type { Commission, CommissionRoleOnDeal, CommissionRule, ReferrerType } from '@/mocks/types'
import { Alert, Badge, Button, PageHeader, Tabs, Tooltip } from '@/ui'
import type { Breadcrumb } from '@/ui'

import {
  BENEFICIARY_LABEL,
  ROLE_LABEL,
  ROLE_TONE,
  RULE_STATUS_LABEL,
  RULE_STATUS_TONE,
  SIDE_FLAG_LABEL,
  SIMPLE_STATE_LABEL,
  SIMPLE_STATE_TONE,
  effectiveRange,
  needsApproval,
  presentState,
  ruleCode,
} from './lib'

export interface ModulePageProps {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
  breadcrumbs?: Breadcrumb[]
}

export function ModulePage({ title, description, actions, meta, breadcrumbs }: ModulePageProps) {
  return <PageHeader title={title} description={description} actions={actions} meta={meta} breadcrumbs={breadcrumbs} />
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1400px] px-8 py-7">{children}</div>
}

export const PAYOUT_VIEWS = [
  { id: 'owed', label: 'Owed now', to: '/referral/payouts' },
  { id: 'history', label: 'History', to: '/referral/payouts/history' },
]

export function PayoutsTabs({ active }: { active: 'owed' | 'history' }) {
  const navigate = useNavigate()
  return (
    <Tabs
      tabs={PAYOUT_VIEWS.map((v) => ({ id: v.id, label: v.label }))}
      value={active}
      onChange={(id) => {
        const target = PAYOUT_VIEWS.find((v) => v.id === id)
        if (target) navigate(target.to)
      }}
      size="sm"
      aria-label="Payout views"
      className="mb-6"
    />
  )
}

const booted = new Set<string>()

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
      Nothing has been changed. Retry, and if it keeps failing tell IT.
    </Alert>
  )
}

export function RoleBadge({ role, size = 'sm' }: { role: CommissionRoleOnDeal; size?: 'sm' | 'md' }) {
  return (
    <Badge tone={ROLE_TONE[role]} variant="subtle" size={size}>
      {ROLE_LABEL[role]}
    </Badge>
  )
}

export function ReferrerTypeBadge({ type, size = 'sm' }: { type: ReferrerType | 'staff'; size?: 'sm' | 'md' }) {
  return (
    <Badge tone="neutral" variant="subtle" size={size}>
      {BENEFICIARY_LABEL[type]}
    </Badge>
  )
}

export function SimpleStateBadge({
  commission,
  size = 'sm',
  subtitle = false,
}: {
  commission: Commission
  size?: 'sm' | 'md'
  subtitle?: boolean
}) {
  const { simple, flag } = presentState(commission)
  const waitingNote = simple === 'waiting' && subtitle ? commission.eligibilityNote : null
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="flex flex-wrap items-center gap-1.5">
        {simple && (
          <Badge tone={SIMPLE_STATE_TONE[simple]} variant="subtle" size={size} dot>
            {SIMPLE_STATE_LABEL[simple]}
          </Badge>
        )}
        {simple === 'earned' && needsApproval(commission) && (
          <Badge tone="neutral" variant="outline" size="sm">
            needs approval
          </Badge>
        )}
        {flag && (
          <Badge tone="neutral" variant="subtle" size={size}>
            {SIDE_FLAG_LABEL[flag]}
          </Badge>
        )}
      </span>
      {waitingNote && <span className="text-body-12 text-text-secondary">{waitingNote}</span>}
    </div>
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

export function RuleChip({ rule, onOpen }: { rule: CommissionRule | undefined; onOpen?: () => void }) {
  if (!rule) {
    return (
      <Badge tone="danger" variant="subtle" size="sm" icon={<AlertTriangle size={12} />}>
        Rate version missing
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
        aria-label={`Open ${label}, in force ${effectiveRange(rule)}`}
      >
        {chip}
      </button>
    </Tooltip>
  )
}
