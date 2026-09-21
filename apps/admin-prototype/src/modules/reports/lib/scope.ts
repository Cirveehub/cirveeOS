/**
 * The report filter bar's state, held in the query string so a filtered
 * report is a link somebody can paste into a meeting invite.
 *
 * Modules are self-contained, so this is deliberately a second, smaller copy
 * of the Command Centre's scope rather than a cross-module import. If a third
 * module needs one, it belongs in `src/lib/`.
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { TODAY } from '@/mocks'
import type { DateRange, ISODate, Unit, UnitCode, UnitId } from '@/mocks'
import type { BusinessUnit } from '@/app/module-registry'

export type PresetKey = 'mtd' | 'last_month' | 'last_90' | 'ytd' | 'custom'

const MONTH_START: ISODate = `${TODAY.slice(0, 7)}-01`
const YEAR_START: ISODate = `${TODAY.slice(0, 4)}-01-01`

function daysBefore(date: ISODate, n: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
}

function previousMonth(): DateRange {
  const year = Number(TODAY.slice(0, 4))
  const month = Number(TODAY.slice(5, 7))
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const last = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
  const mm = String(prevMonth).padStart(2, '0')
  return { from: `${prevYear}-${mm}-01`, to: `${prevYear}-${mm}-${String(last).padStart(2, '0')}` }
}

export const PRESETS: Record<Exclude<PresetKey, 'custom'>, { label: string; range: DateRange }> = {
  mtd: { label: 'This month', range: { from: MONTH_START, to: TODAY } },
  last_month: { label: 'Last month', range: previousMonth() },
  last_90: { label: 'Last 90 days', range: { from: daysBefore(TODAY, 90), to: TODAY } },
  ytd: { label: 'This year', range: { from: YEAR_START, to: TODAY } },
}

export const PRESET_OPTIONS = [
  ...Object.entries(PRESETS).map(([value, meta]) => ({ value, label: meta.label })),
  { value: 'custom', label: 'Custom range' },
]

const TAG_KEY: Record<UnitCode, BusinessUnit> = {
  ACADEMY: 'academy',
  TEENS: 'teens',
  CORPORATE: 'corporate',
  DEXURB: 'dexurb',
  AFRICA: 'africa',
  TCF: 'tcf',
}

export function unitTagKey(code: UnitCode): BusinessUnit {
  return TAG_KEY[code]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function describeRange(range: DateRange): string {
  const day = (d: ISODate) => Number(d.slice(8, 10))
  const monthYear = (d: ISODate) => `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`
  if (range.from.slice(0, 7) === range.to.slice(0, 7)) {
    return `${day(range.from)} – ${day(range.to)} ${monthYear(range.to)}`
  }
  return `${day(range.from)} ${monthYear(range.from)} – ${day(range.to)} ${monthYear(range.to)}`
}

export interface ReportScopeState {
  preset: PresetKey
  range: DateRange
  rangeLabel: string
  unitId: UnitId | undefined
  setPreset: (key: PresetKey) => void
  setUnit: (value: string) => void
  setCustom: (edge: 'from' | 'to', value: string) => void
}

export function useReportScope(units: Unit[]): ReportScopeState {
  const [params, setParams] = useSearchParams()

  const preset = (params.get('preset') as PresetKey | null) ?? 'mtd'
  const unitId = units.find((u) => u.id === (params.get('unit') ?? ''))?.id

  const range = useMemo<DateRange>(() => {
    if (preset === 'custom') {
      const from = params.get('from') ?? MONTH_START
      const to = params.get('to') ?? TODAY
      return from <= to ? { from, to } : { from: to, to: from }
    }
    return PRESETS[preset as Exclude<PresetKey, 'custom'>]?.range ?? PRESETS.mtd.range
  }, [preset, params])

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params)
      mutate(next)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  return {
    preset,
    range,
    rangeLabel: describeRange(range),
    unitId,
    setPreset: (key) =>
      write((next) => {
        next.set('preset', key)
        if (key === 'custom') {
          if (!next.get('from')) next.set('from', range.from)
          if (!next.get('to')) next.set('to', range.to)
        } else {
          next.delete('from')
          next.delete('to')
        }
      }),
    setUnit: (value) =>
      write((next) => {
        if (value) next.set('unit', value)
        else next.delete('unit')
      }),
    setCustom: (edge, value) =>
      write((next) => {
        next.set('preset', 'custom')
        next.set(edge, value)
        const other = edge === 'from' ? 'to' : 'from'
        if (!next.get(other)) next.set(other, edge === 'from' ? range.to : range.from)
      }),
  }
}
