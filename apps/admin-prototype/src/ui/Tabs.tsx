import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'

export interface TabItem {
  id: string
  label: ReactNode
  icon?: LucideIcon
  /** Count pill after the label. */
  badge?: number
  disabled?: boolean
  /** id of the panel this tab controls, if there is one. */
  panelId?: string
}

export interface TabsProps {
  tabs: TabItem[]
  value: string
  onChange: (id: string) => void
  variant?: 'line' | 'pill'
  size?: 'sm' | 'md'
  /** Accessible name for the tablist. */
  'aria-label'?: string
  className?: string
}

/**
 * Roving tabindex with the WAI-ARIA arrow-key pattern: only the selected tab is
 * in the tab order, arrows move between tabs and activate on move.
 */
export function Tabs({
  tabs,
  value,
  onChange,
  variant = 'line',
  size = 'md',
  className,
  ...rest
}: TabsProps) {
  const listRef = useRef<HTMLDivElement | null>(null)

  const focusTab = (index: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
    buttons?.[index]?.focus()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = tabs.filter((tab) => !tab.disabled)
    const current = enabled.findIndex((tab) => tab.id === value)
    if (current === -1) return

    let next = current
    if (event.key === 'ArrowRight') next = (current + 1) % enabled.length
    else if (event.key === 'ArrowLeft') next = (current - 1 + enabled.length) % enabled.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = enabled.length - 1
    else return

    event.preventDefault()
    onChange(enabled[next].id)
    focusTab(next)
  }

  const isLine = variant === 'line'

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={rest['aria-label']}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-center overflow-x-auto',
        isLine ? 'gap-6 border-b border-border' : 'gap-1 rounded-xl bg-surface-sunken p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value
        const Icon = tab.icon

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={tab.panelId}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150',
              'disabled:cursor-not-allowed disabled:opacity-55',
              size === 'sm' ? 'text-body-13' : 'text-body-14',
              isLine
                ? cn(
                    '-mb-px border-b-2 pb-2.5 pt-1',
                    selected
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:border-border-interactive hover:text-text',
                  )
                : cn(
                    'rounded-lg px-3',
                    size === 'sm' ? 'h-7' : 'h-8',
                    selected
                      ? 'bg-surface text-text shadow-sm'
                      : 'text-text-secondary hover:text-text',
                  ),
            )}
          >
            {Icon && <Icon size={16} aria-hidden="true" />}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-body-12 font-semibold tabular-nums',
                  selected ? 'bg-accent-subtle text-accent' : 'bg-surface-sunken text-text-secondary',
                )}
              >
                {formatNumber(tab.badge)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface TabPanelProps {
  id: string
  tabId: string
  active: boolean
  children: ReactNode
  className?: string
}

export function TabPanel({ id, tabId, active, children, className }: TabPanelProps) {
  if (!active) return null
  return (
    <div id={id} role="tabpanel" aria-labelledby={`tab-${tabId}`} tabIndex={0} className={className}>
      {children}
    </div>
  )
}
