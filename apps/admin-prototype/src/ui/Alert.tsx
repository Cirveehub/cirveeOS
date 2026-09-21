import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type AlertTone = 'info' | 'success' | 'warning' | 'danger'

export interface AlertProps {
  tone?: AlertTone
  title?: ReactNode
  children?: ReactNode
  /** Buttons under the body. */
  action?: ReactNode
  icon?: LucideIcon | null
  onDismiss?: () => void
  dismissLabel?: string
  className?: string
}

/*
 * Tinted fills are fixed ramp steps that do not invert with the theme, so the
 * ink on them is fixed too: `ui-800` for body copy (13.4:1 on every tint here)
 * and the tone's own 700 for the title.
 */
const TONES: Record<AlertTone, { shell: string; icon: string; title: string }> = {
  info: { shell: 'bg-info-fill border-info-line', icon: 'text-info-ink', title: 'text-info-ink' },
  success: { shell: 'bg-success-fill border-success-line', icon: 'text-success-ink', title: 'text-success-ink' },
  warning: { shell: 'bg-warning-fill border-warning-line', icon: 'text-warning-ink', title: 'text-warning-ink' },
  danger: { shell: 'bg-danger-fill border-danger-line', icon: 'text-danger-ink', title: 'text-danger-ink' },
}

const ICONS: Record<AlertTone, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  icon,
  onDismiss,
  dismissLabel = 'Dismiss',
  className,
}: AlertProps) {
  const palette = TONES[tone]
  const Icon = icon === null ? null : (icon ?? ICONS[tone])
  // Warnings and failures interrupt; confirmations and notices do not.
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status'

  return (
    <div role={role} className={cn('flex gap-3 rounded-xl border p-4', palette.shell, className)}>
      {Icon && <Icon size={18} aria-hidden="true" className={cn('mt-px shrink-0', palette.icon)} />}
      <div className="min-w-0 flex-1">
        {title && <p className={cn('text-body-14 font-bold', palette.title)}>{title}</p>}
        {children && (
          <div className={cn('text-body-13 text-ui-800', title && 'mt-1')}>{children}</div>
        )}
        {action && <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-md transition-colors hover:bg-ui-900/10',
            palette.icon,
          )}
        >
          <X size={15} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
