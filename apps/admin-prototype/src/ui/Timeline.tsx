import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { formatDateTime, formatRelative } from '@/lib/format'
import { Avatar } from './Avatar'

export type TimelineTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info'

export interface TimelineItem {
  id: string
  title: ReactNode
  description?: ReactNode
  /** Rendered under the description — a before/after diff, a note, a chip row. */
  detail?: ReactNode
  timestamp?: Date | string
  icon?: LucideIcon
  tone?: TimelineTone
  /** Who did it. Shows an avatar in place of the icon when no icon is given. */
  actor?: { name: string; src?: string | null }
}

export interface TimelineProps {
  items: TimelineItem[]
  /** `relative` reads better in activity feeds, `absolute` in audit trails. */
  timeFormat?: 'relative' | 'absolute'
  dense?: boolean
  className?: string
}

const TONES: Record<TimelineTone, string> = {
  neutral: 'bg-surface-sunken text-text-secondary ring-border',
  accent: 'bg-accent-subtle text-accent ring-accent-subtle',
  success: 'bg-success-fill text-success-ink ring-success-line',
  warning: 'bg-warning-fill text-warning-ink ring-warning-line',
  danger: 'bg-danger-fill text-danger-ink ring-danger-line',
  info: 'bg-info-fill text-info-ink ring-info-line',
}

export function Timeline({ items, timeFormat = 'relative', dense = false, className }: TimelineProps) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((item, index) => {
        const Icon = item.icon
        const isLast = index === items.length - 1

        return (
          <li key={item.id} className="relative flex gap-3">
            {/* The rail stops at the last marker rather than running past it. */}
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
              />
            )}

            <span className="relative z-[1] shrink-0 pt-0.5">
              {Icon ? (
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full ring-1',
                    TONES[item.tone ?? 'neutral'],
                  )}
                >
                  <Icon size={15} aria-hidden="true" />
                </span>
              ) : item.actor ? (
                <Avatar name={item.actor.name} src={item.actor.src} size="md" ring />
              ) : (
                <span
                  className={cn(
                    'grid size-8 place-items-center rounded-full ring-1',
                    TONES[item.tone ?? 'neutral'],
                  )}
                >
                  <span aria-hidden="true" className="size-2 rounded-full bg-current" />
                </span>
              )}
            </span>

            <div className={cn('min-w-0 flex-1', dense ? 'pb-3' : 'pb-5', isLast && 'pb-0')}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className="text-body-14 text-text">{item.title}</p>
                {item.timestamp && (
                  <time
                    dateTime={new Date(item.timestamp).toISOString()}
                    title={formatDateTime(item.timestamp)}
                    className="shrink-0 text-body-12 text-text-muted tabular-nums"
                  >
                    {timeFormat === 'relative'
                      ? formatRelative(item.timestamp)
                      : formatDateTime(item.timestamp)}
                  </time>
                )}
              </div>
              {item.description && (
                <p className="mt-0.5 text-body-13 text-text-secondary">{item.description}</p>
              )}
              {item.detail && <div className="mt-2">{item.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
