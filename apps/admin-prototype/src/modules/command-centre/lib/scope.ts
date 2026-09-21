/**
 * The Command Centre's scope: a date range and a business unit, both held in
 * the query string so any view of Home is linkable and shareable.
 *
 * Per screen-spec §1.1 the date-range selector "rewrites `?from=&to=` and
 * re-derives every number from the store" — so nothing here caches a figure.
 * The scope is an input to the selectors, never a source of numbers.
 */

import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { TODAY } from '@/mocks'
import type { DateRange, ISODate, Unit, UnitCode, UnitId } from '@/mocks'
import type { BusinessUnit } from '@/app/module-registry'

export type PresetKey = 'mtd' | 'last_month' | 'last_90' | 'ytd' | 'custom'

/** Year-to-date runs from 1 January of the seed's year to seed-today. */
const YEAR_START: ISODate = `${TODAY.slice(0, 4)}-01-01`

const MONTH_START: ISODate = `${TODAY.slice(0, 7)}-01`

function previousMonthWindow(): DateRange {
  const year = Number(TODAY.slice(0, 4))
  const month = Number(TODAY.slice(5, 7))
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const lastDay = new Date(Date.UTC(prevYear, prevMonth, 0)).getUTCDate()
  const mm = String(prevMonth).padStart(2, '0')
  return { from: `${prevYear}-${mm}-01`, to: `${prevYear}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

function daysBefore(date: ISODate, n: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) - n * 86_400_000).toISOString().slice(0, 10)
}

export const PRESETS: Array<{ key: Exclude<PresetKey, 'custom'>; label: string; range: DateRange }> = [
  { key: 'mtd', label: 'This month', range: { from: MONTH_START, to: TODAY } },
  { key: 'last_month', label: 'Last month', range: previousMonthWindow() },
  { key: 'last_90', label: 'Last 90 days', range: { from: daysBefore(TODAY, 90), to: TODAY } },
  { key: 'ytd', label: 'This year', range: { from: YEAR_START, to: TODAY } },
]

export const PRESET_OPTIONS = [
  ...PRESETS.map((p) => ({ value: p.key, label: p.label })),
  { value: 'custom', label: 'Custom range' },
]

/** Lowercase keys the `UnitTag` component and the chart palette use. */
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

export interface Scope {
  preset: PresetKey
  range: DateRange
  /** "1 – 20 Sep 2026", for the header and the exported brief. */
  rangeLabel: string
  unitId: UnitId | undefined
  setPreset: (key: PresetKey) => void
  setUnit: (unitId: string) => void
  setCustom: (edge: 'from' | 'to', value: string) => void
  /** Serialised scope, for links that should carry it into another module. */
  query: string
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function short(date: ISODate): string {
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
}

export function describeRange(range: DateRange): string {
  if (range.from.slice(0, 7) === range.to.slice(0, 7)) {
    return `${Number(range.from.slice(8, 10))} – ${short(range.to)}`
  }
  return `${short(range.from)} – ${short(range.to)}`
}

export function useScope(units: Unit[]): Scope {
  const [params, setParams] = useSearchParams()

  const preset = (params.get('preset') as PresetKey | null) ?? 'mtd'
  const unitParam = params.get('unit') ?? ''
  const unitId = units.find((u) => u.id === unitParam)?.id

  const range = useMemo<DateRange>(() => {
    if (preset === 'custom') {
      const from = params.get('from') ?? MONTH_START
      const to = params.get('to') ?? TODAY
      return from <= to ? { from, to } : { from: to, to: from }
    }
    return PRESETS.find((p) => p.key === preset)?.range ?? PRESETS[0].range
  }, [preset, params])

  const write = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(params)
      mutate(next)
      setParams(next, { replace: true })
    },
    [params, setParams],
  )

  const setPreset = useCallback(
    (key: PresetKey) => {
      write((next) => {
        next.set('preset', key)
        if (key === 'custom') {
          if (!next.get('from')) next.set('from', range.from)
          if (!next.get('to')) next.set('to', range.to)
        } else {
          next.delete('from')
          next.delete('to')
        }
      })
    },
    [write, range.from, range.to],
  )

  const setUnit = useCallback(
    (value: string) => {
      write((next) => {
        if (value) next.set('unit', value)
        else next.delete('unit')
      })
    },
    [write],
  )

  const setCustom = useCallback(
    (edge: 'from' | 'to', value: string) => {
      write((next) => {
        next.set('preset', 'custom')
        next.set(edge, value)
        if (!next.get(edge === 'from' ? 'to' : 'from')) {
          next.set(edge === 'from' ? 'to' : 'from', edge === 'from' ? range.to : range.from)
        }
      })
    },
    [write, range.from, range.to],
  )

  return {
    preset,
    range,
    rangeLabel: describeRange(range),
    unitId,
    setPreset,
    setUnit,
    setCustom,
    query: params.toString(),
  }
}
