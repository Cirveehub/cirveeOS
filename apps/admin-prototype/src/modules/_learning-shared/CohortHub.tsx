import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber } from '@/lib/format'
import { Tabs, TabPanel, type TabItem } from '@/ui'
import { useQueryState } from '@/lib/view-state'
import type { Cohort, Course } from '@/mocks'

export interface CohortHubTab {
  id: string
  label: string
  badge?: number
  content: ReactNode
}

export interface CohortHubProps {
  cohort: Cohort
  course: Course
  facilitatorName?: string
  tabs: CohortHubTab[]
  backTo: string
  backLabel: string
  defaultTab?: string
}

export function CohortHub({
  cohort,
  course,
  facilitatorName,
  tabs,
  backTo,
  backLabel,
  defaultTab,
}: CohortHubProps) {
  const query = useQueryState()
  const active = query.get('tab') ?? defaultTab ?? tabs[0]?.id

  const tabItems: TabItem[] = tabs.map((t) => ({ id: t.id, label: t.label, badge: t.badge }))

  return (
    <div>
      <Link
        to={backTo}
        className="mb-4 inline-flex items-center gap-1.5 text-body-13 font-medium text-text-secondary transition-colors hover:text-text"
      >
        <ArrowLeft size={14} />
        {backLabel}
      </Link>

      {/* The hero. One focal point before any navigation — matches both
          legacy apps' cohort-detail screen exactly: identity first, tabs
          second, data third. */}
      <div className="relative overflow-hidden rounded-3xl bg-accent p-8 text-on-accent sm:p-10">
        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <span className="inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-label-10 capitalize tracking-wide">
              {course.level}
            </span>
            <h1 className="mt-3 text-display-32 leading-tight">{cohort.code}</h1>
            <p className="mt-1 text-body-15 opacity-90">{course.title}</p>

            <div className="mt-5 flex flex-wrap items-center gap-5 text-body-14">
              <span className="inline-flex items-center gap-1.5">
                <Users size={15} />
                {formatNumber(cohort.enrolledCount)} enrolled
              </span>
              <span className="opacity-80">{cohort.scheduleSummary}</span>
            </div>
          </div>

          {facilitatorName && (
            <div className="shrink-0 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-label-10 opacity-80">Facilitator</p>
              <p className="mt-1 text-body-14 font-semibold">{facilitatorName}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          tabs={tabItems}
          value={active}
          onChange={(id) => query.set('tab', id === (defaultTab ?? tabs[0]?.id) ? undefined : id)}
          aria-label={`${cohort.code} sections`}
          className="mb-5"
        />

        {tabs.map((t) => (
          <TabPanel key={t.id} id={`panel-${t.id}`} tabId={t.id} active={active === t.id}>
            {t.content}
          </TabPanel>
        ))}
      </div>
    </div>
  )
}
