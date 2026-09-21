/**
 * The Daily Executive Brief (screen-spec §1.1, band 2 left).
 *
 * Seven lines, each a number and a link. The figures come from
 * `buildDailyBrief()`, which reads the store — there is no written summary
 * anywhere, so the brief cannot go stale.
 */

import { ArrowRight, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import { formatDate, formatTime } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Button, Card, CardHeader } from '@/ui'
import { useCurrentUserId } from '@/auth'

import { briefAsText, buildDailyBrief, type BriefTone } from '../lib/brief'
import { downloadText } from '../lib/download'

const VALUE_TONE: Record<BriefTone, string> = {
  neutral: 'text-text',
  positive: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
}

export interface BriefPanelProps {
  rangeLabel: string
  /** Full page mode drops the card chrome and lets the lines breathe. */
  expanded?: boolean
  className?: string
}

export function BriefPanel({ rangeLabel, expanded = false, className }: BriefPanelProps) {
  const userId = useCurrentUserId()
  const brief = buildDailyBrief(userId)

  const onExport = () => {
    downloadText(`cirvee-daily-brief-${brief.forDate}.txt`, briefAsText(brief, rangeLabel))
    toast.success('Brief exported as a text file.')
  }

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title="Daily executive brief"
        description={`Covering ${formatDate(brief.forDate)} · assembled ${formatTime(brief.generatedAt)} from live records`}
        actions={
          <div className="flex items-center gap-2">
            {!expanded && (
              <Button size="sm" variant="ghost" asChild>
                <Link to="/home/brief">Full page</Link>
              </Button>
            )}
            <Button size="sm" variant="secondary" leftIcon={<Download size={16} />} onClick={onExport}>
              Export brief
            </Button>
          </div>
        }
      />

      <ol className={cn('divide-y divide-border', expanded && 'text-body-15')}>
        {brief.lines.map((line) => (
          <li key={line.id} className="px-6 py-3.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-body-13 text-text-secondary">{line.label}</span>
              <span
                className={cn(
                  'text-body-15 font-bold tabular-nums',
                  line.quiet ? 'text-text-secondary' : VALUE_TONE[line.tone],
                )}
              >
                {line.value}
              </span>
              <Link
                to={line.to}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
              >
                {line.linkLabel}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-1 max-w-2xl text-body-13 text-text-secondary">{line.detail}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
