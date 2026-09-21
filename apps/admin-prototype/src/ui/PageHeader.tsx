import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { Tabs, type TabItem } from './Tabs'

export interface Breadcrumb {
  label: string
  /** Absolute route. Omit for the current page. */
  to?: string
}

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: Breadcrumb[]
  /** Buttons, right aligned, on the title row. */
  actions?: ReactNode
  /** Badges or tags rendered inline after the title. */
  meta?: ReactNode
  tabs?: TabItem[]
  activeTab?: string
  onTabChange?: (id: string) => void
  /** Hairline under the whole header. Suppressed automatically when tabs draw their own. */
  divided?: boolean
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  tabs,
  activeTab,
  onTabChange,
  divided = true,
  className,
}: PageHeaderProps) {
  const hasTabs = Boolean(tabs && tabs.length > 0 && activeTab && onTabChange)

  return (
    <header className={cn('mb-6', !hasTabs && divided && 'border-b border-border pb-5', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex flex-wrap items-center gap-1 text-body-13 text-text-muted">
            {breadcrumbs.map((crumb, index) => {
              const last = index === breadcrumbs.length - 1
              return (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {crumb.to && !last ? (
                    <Link
                      to={crumb.to}
                      className="rounded-sm transition-colors hover:text-text hover:underline underline-offset-2"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span aria-current={last ? 'page' : undefined} className={last ? 'text-text-secondary' : undefined}>
                      {crumb.label}
                    </span>
                  )}
                  {!last && <ChevronRight size={14} aria-hidden="true" className="text-text-muted" />}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading-24 text-text">{title}</h1>
            {meta}
          </div>
          {description && (
            <p className="mt-1.5 max-w-3xl text-body-14 text-text-secondary">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {hasTabs && tabs && activeTab && onTabChange && (
        <Tabs
          tabs={tabs}
          value={activeTab}
          onChange={onTabChange}
          aria-label="Page sections"
          className="mt-5"
        />
      )}
    </header>
  )
}
