/**
 * The pipeline funnel (screen-spec §1.1, band 3).
 *
 * A bar chart would give this seven bars and no conversion figures; the
 * conversion between two stages is the number the founder actually reads, so
 * this is a dense list with the step-to-step percentage on the join.
 */

import { ArrowDown } from 'lucide-react'
import { Link } from 'react-router-dom'

import { pipelineFunnel } from '@/mocks'
import type { DateRange, UnitId } from '@/mocks'
import { formatNumber, formatPercent, humanize } from '@/lib/format'
import { Badge, Card, CardHeader, EmptyState, ProgressBar } from '@/ui'

export interface FunnelPanelProps {
  range: DateRange
  unitId: UnitId | undefined
}

export function FunnelPanel({ range, unitId }: FunnelPanelProps) {
  const steps = pipelineFunnel({ range, unitId })
  const top = steps[0]?.count ?? 0
  const bottom = steps[steps.length - 1]?.count ?? 0
  const endToEnd = top === 0 ? 0 : Number(((bottom / top) * 100).toFixed(1))

  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Pipeline funnel"
        description="Leads at or beyond each stage over the trailing 90 days, with the conversion between them."
        actions={
          top > 0 ? (
            <Badge tone="accent" variant="subtle">
              {formatPercent(endToEnd)} end to end
            </Badge>
          ) : undefined
        }
      />

      {top === 0 ? (
        <EmptyState
          size="sm"
          title="No leads in this window"
          message="Clear the unit filter to see the whole pipeline. Leads arrive from the website form, WhatsApp, the kiosk and the referral links."
          action={
            <Link
              to="/crm/leads"
              className="rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
            >
              Open leads
            </Link>
          }
        />
      ) : (
        <ol className="px-6 py-5">
          {steps.map((step, index) => (
            <li key={step.stage}>
              {index > 0 && (
                <div className="flex items-center gap-2 py-1.5 pl-1">
                  <ArrowDown size={14} aria-hidden="true" className="text-text-muted" />
                  <span className="text-body-12 text-text-secondary">
                    {step.conversionFromPrevious === null
                      ? 'No previous stage'
                      : `${formatPercent(step.conversionFromPrevious)} carried through from ${humanize(steps[index - 1].stage).toLowerCase()}`}
                  </span>
                </div>
              )}
              <Link
                to={`/crm/leads?stage=${step.stage}`}
                className="block rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-surface-hover"
              >
                <ProgressBar
                  value={step.count}
                  max={top}
                  tone={index === steps.length - 1 ? 'success' : 'accent'}
                  label={humanize(step.stage)}
                  valueLabel={formatNumber(step.count)}
                />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
