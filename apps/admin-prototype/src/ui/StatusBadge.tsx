import { humanize } from '@/lib/format'
import { Badge, type BadgeSize, type BadgeTone, type BadgeVariant } from './Badge'

export interface StatusBadgeProps {
  /** Any enum-ish string — `PAYMENT_PENDING`, `part-paid`, `Active`. */
  status: string
  /** Override the generated label. */
  label?: string
  size?: BadgeSize
  variant?: BadgeVariant
  /** Force a tone when a project-specific status is not in the map. */
  tone?: BadgeTone
  className?: string
}

/**
 * The statuses the OS actually uses, across CRM, admissions, finance,
 * commission and approvals. Anything unmapped falls back to neutral rather
 * than guessing — a wrong colour on a payment state is worse than a grey one.
 */
const STATUS_TONES: Record<string, BadgeTone> = {
  // Lifecycle
  active: 'success',
  enabled: 'success',
  live: 'success',
  published: 'success',
  completed: 'success',
  complete: 'success',
  graduated: 'success',
  approved: 'success',
  verified: 'success',
  reconciled: 'success',
  matched: 'success',
  settled: 'success',
  won: 'success',
  converted: 'success',
  delivered: 'success',
  present: 'success',

  // In flight
  pending: 'warning',
  pending_approval: 'warning',
  awaiting_approval: 'warning',
  in_progress: 'warning',
  processing: 'warning',
  in_review: 'warning',
  review: 'warning',
  partial: 'warning',
  part_paid: 'warning',
  partially_paid: 'warning',
  on_hold: 'warning',
  unmatched: 'warning',
  at_risk: 'warning',
  late: 'warning',
  due_soon: 'warning',
  provisional: 'warning',

  // Failure
  overdue: 'danger',
  failed: 'danger',
  rejected: 'danger',
  declined: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  refunded: 'danger',
  reversed: 'danger',
  suspended: 'danger',
  blocked: 'danger',
  lost: 'danger',
  withdrawn: 'danger',
  churned: 'danger',
  bounced: 'danger',
  absent: 'danger',
  expired: 'danger',
  unpaid: 'danger',

  // Informational
  scheduled: 'info',
  queued: 'info',
  sent: 'info',
  contacted: 'info',
  qualified: 'info',
  new: 'info',
  enrolled: 'info',
  open: 'info',
  escalated: 'info',

  // Brand / paid states
  paid: 'accent',

  // Quiet states
  draft: 'neutral',
  inactive: 'neutral',
  disabled: 'neutral',
  archived: 'neutral',
  closed: 'neutral',
  dormant: 'neutral',
  unknown: 'neutral',
  none: 'neutral',
}

export function normaliseStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function statusTone(status: string): BadgeTone {
  return STATUS_TONES[normaliseStatus(status)] ?? 'neutral'
}

export function StatusBadge({
  status,
  label,
  size = 'md',
  variant = 'subtle',
  tone,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      tone={tone ?? statusTone(status)}
      variant={variant}
      size={size}
      dot
      className={className}
    >
      {label ?? humanize(status)}
    </Badge>
  )
}
