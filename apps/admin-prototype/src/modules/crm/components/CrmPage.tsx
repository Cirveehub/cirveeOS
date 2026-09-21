/**
 * The shell every CRM screen sits in: module navigation, page header, the
 * error banner and the toast stack. The app shell does not render a module
 * subnav, so the module renders its own from `@/ui`'s `Tabs`.
 */

import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Alert, Button, PageHeader, Tabs, type Breadcrumb, type TabItem } from '@/ui'
import { ToastHost } from './Toasts'

/**
 * Only the sections that have a route in `index.tsx`. Pipeline, Follow-ups,
 * Contacts and Organisations were listed here before they existed and sent
 * every click to the global 404 — a section returns to this list the day its
 * route does.
 */
const SECTIONS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Dashboard' },
  { id: 'leads', label: 'Leads' },
  { id: 'admissions', label: 'Admissions' },
  { id: 'duplicates', label: 'Duplicates' },
]

export interface CrmPageProps {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
  meta?: ReactNode
  /** Detail-screen tabs, driven by `?tab=`. */
  tabs?: TabItem[]
  activeTab?: string
  onTabChange?: (id: string) => void
  /** Recoverable load failure, shown above the content with a retry. */
  error?: string | null
  onRetry?: () => void
  /** Suppress the module nav on nested screens such as the wizards. */
  hideSectionNav?: boolean
  /** Full-bleed content — the pipeline board manages its own scrolling. */
  bleed?: boolean
  children: ReactNode
}

export function CrmPage({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  tabs,
  activeTab,
  onTabChange,
  error,
  onRetry,
  hideSectionNav = false,
  bleed = false,
  children,
}: CrmPageProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const current =
    SECTIONS.slice(1).find((s) => location.pathname.startsWith(`/crm/${s.id}`))?.id ?? ''

  return (
    <div className="flex min-h-full flex-col">
      {!hideSectionNav && (
        <div className="border-b border-border bg-surface px-6 pt-3">
          <Tabs
            aria-label="CRM sections"
            variant="pill"
            size="sm"
            tabs={SECTIONS.map((s) => ({ id: s.id, label: s.label }))}
            value={current}
            onChange={(id) => navigate(id ? `/crm/${id}` : '/crm')}
            className="pb-3"
          />
        </div>
      )}

      <div className={bleed ? 'flex min-h-0 flex-1 flex-col' : 'px-6 py-5'}>
        <div className={bleed ? 'px-6 pt-5' : undefined}>
          <PageHeader
            title={title}
            description={description}
            breadcrumbs={breadcrumbs}
            actions={actions}
            meta={meta}
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />

          {error && (
            <Alert
              tone="danger"
              title="This view could not load"
              className="mb-4"
              action={
                onRetry ? (
                  <Button size="sm" variant="secondary" onClick={onRetry}>
                    Retry
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          )}
        </div>

        {!error && children}
      </div>

      <ToastHost />
    </div>
  )
}
