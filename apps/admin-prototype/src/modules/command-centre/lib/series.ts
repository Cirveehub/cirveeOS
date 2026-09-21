import type { DateRange, ISODate } from '@/mocks'

const DAY = 86_400_000

function iso(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10)
}

function ms(date: ISODate): number {
  return Date.parse(`${date}T00:00:00Z`)
}

export function rangeDays(range: DateRange): number {
  return Math.round((ms(range.to) - ms(range.from)) / DAY) + 1
}

export function previousWindow(range: DateRange): DateRange {
  const length = rangeDays(range)
  const to = iso(ms(range.from) - DAY)
  const from = iso(ms(range.from) - length * DAY)
  return { from, to }
}

export function deltaPercent(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1))
}

export function deltaPoints(current: number, previous: number): number {
  return Number((current - previous).toFixed(1))
}

export interface Window {
  key: string
  label: string
  range: DateRange
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function monthWindows(count: number, endingOn: ISODate): Window[] {
  const year = Number(endingOn.slice(0, 4))
  const month = Number(endingOn.slice(5, 7))
  const out: Window[] = []

  for (let back = count - 1; back >= 0; back--) {
    const date = new Date(Date.UTC(year, month - 1 - back, 1))
    const y = date.getUTCFullYear()
    const m = date.getUTCMonth() + 1
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const mm = String(m).padStart(2, '0')
    out.push({
      key: `${y}-${mm}`,
      label: MONTHS[m - 1],
      range: { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, '0')}` },
    })
  }
  return out
}

export function sliceWindows(range: DateRange, slices: number): Window[] {
  const total = rangeDays(range)
  const size = Math.max(1, Math.ceil(total / slices))
  const out: Window[] = []

  for (let start = 0; start < total; start += size) {
    const from = iso(ms(range.from) + start * DAY)
    const to = iso(Math.min(ms(range.from) + (start + size - 1) * DAY, ms(range.to)))
    out.push({ key: from, label: from, range: { from, to } })
  }
  return out
}

export function dayWindow(date: ISODate): DateRange {
  return { from: date, to: date }
}

export function shiftDays(date: ISODate, days: number): ISODate {
  return iso(ms(date) + days * DAY)
}
