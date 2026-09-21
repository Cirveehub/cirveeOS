import { cn } from '@/lib/cn'
import { formatNaira } from '@/lib/format'

export type MoneyTone = 'auto' | 'default' | 'positive' | 'negative' | 'muted'

export interface MoneyCellProps {
  /** Amount in KOBO. */
  kobo: number
  tone?: MoneyTone
  /** ₦1.2m instead of ₦1,200,000 — for stat cards and narrow columns. */
  compact?: boolean
  decimals?: boolean
  /** Always show a leading + on positive amounts — for ledger movements. */
  signed?: boolean
  /** Secondary line under the amount, e.g. "of ₦450,000". */
  sub?: string
  strong?: boolean
  className?: string
}

const TONES: Record<Exclude<MoneyTone, 'auto'>, string> = {
  default: 'text-text',
  positive: 'text-success-text',
  negative: 'text-danger-text',
  muted: 'text-text-muted',
}

export function MoneyCell({
  kobo,
  tone = 'auto',
  compact = false,
  decimals = false,
  signed = false,
  sub,
  strong = false,
  className,
}: MoneyCellProps) {
  const resolved =
    tone === 'auto' ? (kobo < 0 ? 'negative' : kobo === 0 ? 'muted' : 'default') : tone

  const formatted = formatNaira(Math.abs(kobo), { compact, decimals })
  const sign = kobo < 0 ? '−' : signed && kobo > 0 ? '+' : ''

  return (
    <span className={cn('block w-full text-right tabular-nums', className)}>
      <span className={cn('block', strong ? 'font-bold' : 'font-medium', TONES[resolved])}>
        {sign}
        {formatted}
      </span>
      {sub && <span className="block text-body-12 font-normal text-text-muted">{sub}</span>}
    </span>
  )
}
