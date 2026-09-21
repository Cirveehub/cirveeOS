import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

import { PageHeader, Badge, EmptyState } from '@/ui'
import { useCollection, unitsCollection } from '@/mocks'
import { cn } from '@/lib/cn'

import { REPORTS } from './registry'
import { useReportScope } from './lib/scope'
import { ScopeBar } from './components/ScopeBar'

/**
 * The report index.
 *
 * Each card shows the report's own three headline figures, computed from the
 * same definition the detail screen uses — so a card can never drift from the
 * report it opens. The scope bar applies to every card at once.
 */
export default function ReportsIndex() {
  const units = useCollection(unitsCollection)
  const scope = useReportScope(units)

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Reports"
        description="The four executive questions: are we making money, are we growing, are students succeeding, is the organisation functioning."
      />

      <ScopeBar scope={scope} units={units} />

      {REPORTS.length === 0 ? (
        <EmptyState title="No reports" message="Nothing is defined yet." />
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {REPORTS.map((report) => {
            const Icon = report.icon
            const headline = report.headline({ range: scope.range, unitId: scope.unitId })
            const asOf = report.asOf()

            return (
              <Link
                key={report.key}
                to={`/reports/${report.key}${window.location.search}`}
                className={cn(
                  'group flex flex-col rounded-2xl border border-border bg-surface p-5 transition-shadow hover:shadow-md',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-body-15 font-bold">{report.title}</span>
                      {report.depth === 'outline' && (
                        <Badge tone="neutral" size="sm">
                          Outline
                        </Badge>
                      )}
                    </span>
                    <span className="mt-0.5 block text-body-13 text-text-secondary">
                      {report.description}
                    </span>
                  </span>
                  <ArrowRight
                    size={16}
                    className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                  />
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                  {headline.slice(0, 3).map((item) => (
                    <div key={item.label}>
                      <dt className="text-label-10 text-text-muted">{item.label}</dt>
                      <dd className="mt-1 truncate text-body-15 font-bold tabular-nums">
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {asOf && (
                  <p className="mt-3 text-body-12 text-text-muted">Data as of {asOf}</p>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
