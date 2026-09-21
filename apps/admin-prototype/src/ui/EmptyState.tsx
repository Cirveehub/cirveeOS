import { Inbox, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type EmptyStateVariant = 'default' | 'search' | 'error'

export interface EmptyStateProps {
  icon?: LucideIcon
  title: ReactNode
  /**
   * Set in `text-secondary` (ui-600, 7.6:1 on surface). The source's EmptyState
   * put this in ui-400 at 2.4:1 — below the floor for prose.
   */
  message?: ReactNode
  action?: ReactNode
  secondaryAction?: ReactNode
  variant?: EmptyStateVariant
  size?: 'sm' | 'md' | 'lg'
  /** Wrap in a hairline panel. Off when it already sits inside a Card or table. */
  bordered?: boolean
  className?: string
}

const CHIP: Record<EmptyStateVariant, string> = {
  default: 'bg-surface-sunken text-text-secondary',
  search: 'bg-accent-subtle text-accent',
  error: 'bg-danger-fill text-danger-ink',
}

const PADDING = { sm: 'px-6 py-8', md: 'px-6 py-12', lg: 'px-6 py-16' } as const

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  secondaryAction,
  variant = 'default',
  size = 'md',
  bordered = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        PADDING[size],
        bordered && 'rounded-xl border border-border bg-surface',
        className,
      )}
    >
      <span className={cn('grid size-11 place-items-center rounded-full', CHIP[variant])}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-body-15 font-bold text-text">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-body-14 text-text-secondary">{message}</p>}
      {(action || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
