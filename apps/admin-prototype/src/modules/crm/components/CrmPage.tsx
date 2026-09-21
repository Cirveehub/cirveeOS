import type { ReactNode } from 'react'
import { Alert, Button, PageHeader, type Breadcrumb, type TabItem } from '@/ui'
import { ToastHost } from './Toasts'

export interface CrmPageProps {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: Breadcrumb[]
  actions?: ReactNode
  meta?: ReactNode
  tabs?: TabItem[]
  activeTab?: string
  onTabChange?: (id: string) => void
  error?: string | null
  onRetry?: () => void
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
  bleed = false,
  children,
}: CrmPageProps) {
  return (
    <div className="flex min-h-full flex-col">
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
