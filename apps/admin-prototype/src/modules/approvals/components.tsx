/**
 * Pieces shared by more than one approvals screen.
 *
 * The route visualiser and the impact preview both appear on the detail screen
 * and inside the raise-request wizard, where the route has to re-render as the
 * amount crosses a band. Keeping them here is what makes that possible without
 * two implementations drifting apart.
 */

import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  Check,
  CircleDashed,
  Clock,
  CornerUpLeft,
  ShieldAlert,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Card, CardBody, CardHeader, Select, Tooltip } from '@/ui'
import { cn } from '@/lib/cn'
import { formatNaira } from '@/lib/format'
import type { ApprovalImpactLine, ApprovalRequest, ApprovalStep, Kobo } from '@/mocks'
import {
  STEP_STATE_LABEL,
  STEP_STATE_TONE,
  escalationLabel,
  setActingUser,
  useActingUser,
  userName,
  userOptions,
  userRoleName,
} from './shared'

/* -------------------------------------------------------------------------- */
/* Route visualiser                                                           */
/* -------------------------------------------------------------------------- */

const STEP_ICON = {
  approved: Check,
  pending: Clock,
  rejected: X,
  returned: CornerUpLeft,
  not_reached: CircleDashed,
  skipped: CircleDashed,
} as const

export interface RouteVisualiserProps {
  steps: ApprovalStep[]
  currentStepIndex: number
  /** Plain-words escalation policy for the live step. */
  escalation?: string | null
  /** Highlights steps that only just appeared as the amount crossed a band. */
  addedStepIds?: number[]
  compact?: boolean
}

export function RouteVisualiser({
  steps,
  currentStepIndex,
  escalation,
  addedStepIds = [],
  compact = false,
}: RouteVisualiserProps) {
  if (steps.length === 0) {
    return (
      <p className="text-body-13 text-text-secondary">
        No band matches this amount yet. Nothing can be approved until the route configuration covers it.
      </p>
    )
  }

  return (
    <ol className="space-y-0">
      {steps.map((step, index) => {
        const state = step.state
        const Icon = STEP_ICON[state] ?? CircleDashed
        const isCurrent = index === currentStepIndex && state === 'pending'
        const justAdded = addedStepIds.includes(step.sequence)

        return (
          <li key={`${step.sequence}-${step.approverUserId}`} className="relative flex gap-3 pb-4 last:pb-0">
            {index < steps.length - 1 && (
              <span aria-hidden="true" className="absolute top-7 bottom-0 left-[13px] w-px bg-border" />
            )}

            <span
              className={cn(
                'relative z-10 grid size-7 shrink-0 place-items-center rounded-full border',
                state === 'approved' && 'border-success-line bg-success-fill text-success-ink',
                state === 'pending' && 'border-warning-line bg-warning-fill text-warning-ink',
                state === 'rejected' && 'border-danger-line bg-danger-fill text-danger-ink',
                state === 'returned' && 'border-info-line bg-info-fill text-info-ink',
                (state === 'not_reached' || state === 'skipped') && 'border-border bg-surface-sunken text-text-muted',
              )}
            >
              <Icon size={14} />
            </span>

            <div className={cn('min-w-0 flex-1', justAdded && 'rounded-lg bg-accent-wash px-2 py-1.5 -mx-2 -my-1.5')}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={cn('text-body-14 text-text', isCurrent && 'font-semibold')}>
                  Step {step.sequence} · {userName(step.approverUserId)}
                </span>
                <Badge tone={STEP_STATE_TONE[state] ?? 'neutral'} size="sm">
                  {STEP_STATE_LABEL[state] ?? state}
                </Badge>
                {justAdded && (
                  <Badge tone="accent" size="sm">
                    Added by the amount
                  </Badge>
                )}
              </div>

              <p className="mt-0.5 text-body-13 text-text-secondary">{step.approverRole}</p>

              {!compact && (
                <p className="mt-1 text-body-12 text-text-secondary">
                  Put in the route by: <span className="text-text-label">{step.thresholdLabel}</span>
                </p>
              )}

              {step.decidedAt && (
                <p className="mt-1 text-body-12 text-text-secondary">
                  {STEP_STATE_LABEL[state]} {new Date(step.decidedAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              )}

              {step.comment && <p className="mt-1 text-body-13 text-text">&ldquo;{step.comment}&rdquo;</p>}

              {isCurrent && escalation && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-warning-fill px-2 py-1 text-body-12 text-warning-ink">
                  <ShieldAlert size={13} />
                  {escalation}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* -------------------------------------------------------------------------- */
/* Impact preview                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Where an impact line points. These are the spec's own routes; the modules
 * that own them light up as they are built, and until then the shell's
 * not-found screen offers a way back rather than a dead end.
 */
function hrefFor(line: ApprovalImpactLine): string | null {
  switch (line.entityType) {
    case 'Invoice':
      return line.entityId ? `/finance/invoices/${line.entityId}` : null
    case 'Commission':
      return `/referral/commissions?ref=${encodeURIComponent(line.entityRef)}`
    case 'CreditNote':
      return line.entityId ? `/finance/credit-notes/${line.entityId}` : null
    case 'Admission':
      return line.entityId ? `/crm/admissions/${line.entityId}` : null
    case 'Employee':
      return line.entityId ? `/people/employees/${line.entityId}` : null
    case 'Expense':
      return line.entityId ? `/finance/expenses/${line.entityId}` : null
    case 'ProcurementRequest':
      return line.entityId ? `/work/procurement?ref=${encodeURIComponent(line.entityRef)}` : null
    case 'JobOpening':
      return line.entityId ? `/people/openings/${line.entityId}` : null
    case 'Unit':
      return '/finance/units'
    case 'PayoutBatch':
      return '/referral/payouts'
    case 'CommissionDispute':
      return '/referral/disputes'
    case 'DocumentTemplate':
      return '/work/templates'
    default:
      return null
  }
}

export interface ImpactPreviewProps {
  lines: ApprovalImpactLine[]
  live: boolean
  title?: string
  lead?: ReactNode
}

export function ImpactPreview({ lines, live, title = 'Impact preview', lead }: ImpactPreviewProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        description="What a yes does downstream. Read this before deciding — the approver never decides blind."
        actions={
          <Badge tone={live ? 'accent' : 'neutral'} size="sm">
            {live ? 'Computed live' : 'Recorded at raise'}
          </Badge>
        }
      />
      <CardBody>
        {lead}
        {lines.length === 0 ? (
          <p className="text-body-13 text-text-secondary">
            No downstream record is touched by this request. It is a decision only.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {lines.map((line, index) => {
              const href = hrefFor(line)
              return (
                <li key={`${line.entityType}-${index}`} className="flex gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent"
                  />
                  <p className="text-body-14 text-text">
                    Approving will {line.text}
                    {href ? (
                      <>
                        {' '}
                        <Link
                          to={href}
                          className="inline-flex items-center gap-0.5 rounded-sm text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        >
                          {line.entityRef}
                          <ArrowUpRight size={13} />
                        </Link>
                      </>
                    ) : (
                      <span className="text-text-secondary"> ({line.entityRef})</span>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* Acting-user switch                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Prototype scaffolding, and labelled as such on screen. Flow 3 needs the
 * reviewer to become the Finance Manager so the self-approval block can be
 * lifted honestly rather than bypassed.
 */
export function ActingUserSwitch({ className }: { className?: string }) {
  const acting = useActingUser()
  const options = userOptions()

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label htmlFor="acting-user" className="text-body-12 whitespace-nowrap text-text-secondary">
        Acting as
      </label>
      <Tooltip content="Demo scaffolding — stands in for Settings → Demo controls until that screen ships.">
        <Select
          id="acting-user"
          selectSize="sm"
          options={options}
          value={acting}
          onChange={(event) => setActingUser(event.target.value as typeof acting)}
          containerClassName="w-60"
        />
      </Tooltip>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Small shared cells                                                         */
/* -------------------------------------------------------------------------- */

export function RouteChain({ request }: { request: ApprovalRequest }) {
  if (request.steps.length === 0) return <span className="text-text-secondary">No route</span>
  return (
    <span className="flex flex-wrap items-center gap-1 text-body-13">
      {request.steps.map((step, index) => (
        <span key={step.sequence} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden="true" className="text-text-muted">→</span>}
          {step.state === 'approved' && <Check size={12} className="text-success-text" aria-hidden="true" />}
          <span
            className={cn(
              step.state === 'pending' ? 'font-semibold text-text' : 'text-text-secondary',
              step.state === 'rejected' && 'text-danger-text',
            )}
          >
            {userName(step.approverUserId)}
          </span>
        </span>
      ))}
      <span className="sr-only">
        Current step {request.currentStepIndex + 1} of {request.steps.length}
      </span>
    </span>
  )
}

export function EscalationCell({ request }: { request: ApprovalRequest }) {
  const label = escalationLabel(request)
  if (!label) return <span className="text-text-secondary">—</span>
  return <span className="text-body-13 text-warning-text">{label}</span>
}

export function AmountCell({ amount }: { amount: Kobo | null }) {
  if (amount === null) return <span className="text-text-secondary">—</span>
  return <span className="tabular-nums">{formatNaira(amount)}</span>
}

export function ApproverCell({ userId }: { userId: string | null }) {
  if (!userId) return <span className="text-text-secondary">—</span>
  return (
    <span className="flex flex-col">
      <span className="text-body-13 text-text">{userName(userId)}</span>
      <span className="text-body-12 text-text-secondary">{userRoleName(userId)}</span>
    </span>
  )
}
