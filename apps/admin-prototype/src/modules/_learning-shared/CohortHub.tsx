/**
 * The cohort hub shell — shared by `teaching` (Tutor) and `my-learning`
 * (Student), because both legacy apps this pass is modelled on independently
 * arrived at the exact same shape for "the page you land on after picking a
 * class": a hero banner naming the cohort and its facilitator, then a tab
 * strip bundling roster/attendance/materials/assignments/timetable behind
 * one page rather than five separate routes.
 *
 * This component is chrome only — it does not know what a roster or a
 * gradebook looks like. Each caller supplies its own tab content, so the
 * tutor's "Assignments" tab (create, grade) and the student's (submit, view
 * feedback) can differ completely while sharing the same hero and tab-strip
 * shell. That split is why this lives outside either module's own folder —
 * two sibling modules sharing one presentational shell is the deliberate
 * exception to "a module owns its own folder," not a breach of it.
 */
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
  /** Shown as a count pill on the tab, e.g. pending submissions. */
  badge?: number
  content: ReactNode
}

export interface CohortHubProps {
  cohort: Cohort
  course: Course
  /** "Facilitator" card on the banner — the tutor's name, from the caller's own lookup. */
  facilitatorName?: string
  tabs: CohortHubTab[]
  backTo: string
  backLabel: string
  /** Defaults to the first tab. */
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
