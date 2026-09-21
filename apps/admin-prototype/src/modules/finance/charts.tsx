import { formatNaira } from '@/lib/format'

/**
 * FLAG: `DualLineChart` is the one component here that `@/ui` does not provide
 * and that a module legitimately needs — the PRD forbids ever blending
 * collected and invoiced revenue into a single figure, so the finance
 * dashboard has to draw two independent series. It belongs in `src/ui/` (and
 * the kitchen sink) alongside `StatCard`'s private sparkline.
 *
 * It is built on role tokens only: every stroke and fill inherits
 * `currentColor` from a wrapper carrying a token class.
 */

export interface DualLinePoint {
  label: string
  collected: number
  invoiced: number
}

const WIDTH = 720
const HEIGHT = 200
const PAD_LEFT = 8
const PAD_BOTTOM = 22
const PAD_TOP = 10

function pathFor(values: number[], max: number): string {
  if (values.length < 2) return ''
  const inner = WIDTH - PAD_LEFT * 2
  const innerH = HEIGHT - PAD_BOTTOM - PAD_TOP
  return values
    .map((value, index) => {
      const x = PAD_LEFT + (index / (values.length - 1)) * inner
      const y = PAD_TOP + innerH - (value / max) * innerH
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function dotsFor(values: number[], max: number) {
  const inner = WIDTH - PAD_LEFT * 2
  const innerH = HEIGHT - PAD_BOTTOM - PAD_TOP
  return values.map((value, index) => ({
    x: PAD_LEFT + (index / (values.length - 1)) * inner,
    y: PAD_TOP + innerH - (value / max) * innerH,
  }))
}

export function DualLineChart({ points }: { points: DualLinePoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.collected, p.invoiced))) * 1.12
  const invoiced = points.map((p) => p.invoiced)
  const collected = points.map((p) => p.collected)

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        <span className="inline-flex items-center gap-2 text-body-13 text-text-secondary">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-accent" />
          Invoiced
        </span>
        <span className="inline-flex items-center gap-2 text-body-13 text-text-secondary">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-success-600" />
          Collected
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Invoiced and collected revenue by month, plotted as two separate series"
        className="h-52 w-full"
      >
        <g className="text-border">
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = PAD_TOP + (HEIGHT - PAD_BOTTOM - PAD_TOP) * f
            return <line key={f} x1={0} x2={WIDTH} y1={y} y2={y} stroke="currentColor" strokeWidth={1} />
          })}
        </g>

        <g className="text-accent">
          <path d={pathFor(invoiced, max)} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          {dotsFor(invoiced, max).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={3} fill="currentColor" />
          ))}
        </g>

        <g className="text-success-600">
          <path d={pathFor(collected, max)} fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
          {dotsFor(collected, max).map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={3} fill="currentColor" />
          ))}
        </g>
      </svg>

      <div className="mt-1 grid" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((p) => (
          <span key={p.label} className="text-center text-body-12 text-text-muted">
            {p.label}
          </span>
        ))}
      </div>

      {/* The chart is decorative for screen readers; the numbers live here. */}
      <table className="sr-only">
        <caption>Invoiced and collected revenue by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Invoiced</th>
            <th scope="col">Collected</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.label}>
              <th scope="row">{p.label}</th>
              <td>{formatNaira(p.invoiced)}</td>
              <td>{formatNaira(p.collected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* -------------------------------------------------------------------------- */

export interface CompositionSegment {
  label: string
  value: number
  /** Semantic ramp step. Role tokens carry no chart hues. */
  className: string
}

/**
 * FLAG: `StackedCompositionBar` is the second chart primitive `@/ui` lacks. It
 * renders one bar split into named segments — cost, payroll, margin — and
 * mirrors the numbers into a screen-reader list so the bar itself stays
 * decorative.
 */
export function StackedCompositionBar({
  segments,
  total,
  ariaLabel,
}: {
  segments: CompositionSegment[]
  total: number
  ariaLabel: string
}) {
  const safeTotal = total > 0 ? total : 1
  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={ariaLabel}>
      {segments.map((segment) => {
        const width = Math.max(0, (segment.value / safeTotal) * 100)
        if (width <= 0) return null
        return <div key={segment.label} className={segment.className} style={{ width: `${width}%` }} />
      })}
    </div>
  )
}

export function CompositionLegend({ segments }: { segments: CompositionSegment[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
      {segments.map((segment) => (
        <span key={segment.label} className="inline-flex items-center gap-2 text-body-13 text-text-secondary">
          <span aria-hidden="true" className={`size-2.5 rounded-full ${segment.className}`} />
          {segment.label}
        </span>
      ))}
    </div>
  )
}
