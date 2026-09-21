/**
 * Seed plumbing: the fixed clock, a seeded PRNG, and the small helpers every
 * seed file uses.
 *
 * **Determinism is non-negotiable.** There is no `Math.random()` and no
 * `new Date()` anywhere in the seed. "Today" is 20 September 2026 and every
 * relative date is derived from it, so the prototype produces byte-identical
 * data on every load and does not rot as the real calendar moves.
 */

import type { ISODate, ISODateTime, UserId, Auditable, Kobo } from '@/mocks/types'
import { uid } from '@/mocks/types'

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

/** Seed "today", per spec §B.11. Everything relative is derived from this. */
export const TODAY: ISODate = '2026-09-20'

/** Africa/Lagos is UTC+1 year-round — no DST, which keeps the seed simple. */
export const LAGOS_OFFSET = '+01:00'

const TODAY_MS = Date.UTC(2026, 8, 20)
const DAY_MS = 86_400_000

function toISODate(ms: number): ISODate {
  const d = new Date(ms)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** `daysAgo(30)` → "2026-08-21". */
export function daysAgo(n: number): ISODate {
  return toISODate(TODAY_MS - n * DAY_MS)
}

/** `daysAhead(15)` → "2026-10-05". */
export function daysAhead(n: number): ISODate {
  return toISODate(TODAY_MS + n * DAY_MS)
}

/** Whole days between an ISO date and seed-today. Positive means in the past. */
export function daysBetweenTodayAnd(date: ISODate): number {
  return Math.round((TODAY_MS - Date.parse(`${date}T00:00:00Z`)) / DAY_MS)
}

/** Attaches a Lagos wall-clock time to a date: `at('2026-09-20', 14, 43)`. */
export function at(date: ISODate, hour = 9, minute = 0): ISODateTime {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${date}T${hh}:${mm}:00${LAGOS_OFFSET}`
}

/** `dtAgo(3, 14, 30)` → 3 days before today at 14:30 Lagos. */
export function dtAgo(days: number, hour = 9, minute = 0): ISODateTime {
  return at(daysAgo(days), hour, minute)
}

/** `dtAhead(2, 10, 0)` → 2 days after today at 10:00 Lagos. */
export function dtAhead(days: number, hour = 9, minute = 0): ISODateTime {
  return at(daysAhead(days), hour, minute)
}

/** Seed-today at a given wall-clock time. */
export function today(hour = 9, minute = 0): ISODateTime {
  return at(TODAY, hour, minute)
}

/** Hours between an ISO datetime and seed-today 09:00. */
export function hoursSince(dt: ISODateTime): number {
  return Math.max(0, Math.round((Date.parse(today(9, 0)) - Date.parse(dt)) / 3_600_000))
}

/** Adds calendar days to an ISO date. */
export function addDays(date: ISODate, n: number): ISODate {
  return toISODate(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS)
}

/** Day of week, 0 = Sunday. Used to keep class timetables off weekends. */
export function dayOfWeek(date: ISODate): number {
  return new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay()
}

/** First day of the month containing `date`. */
export function startOfMonth(date: ISODate): ISODate {
  return `${date.slice(0, 7)}-01`
}

/** True when `date` falls inside `[from, to]` inclusive. */
export function inRange(date: ISODate, from: ISODate, to: ISODate): boolean {
  return date >= from && date <= to
}

/** The current month-to-date window: 1 Sep 2026 → 20 Sep 2026. */
export const MTD = { from: '2026-09-01', to: TODAY } as const
/** Previous full month: August 2026. */
export const LAST_MONTH = { from: '2026-08-01', to: '2026-08-31' } as const
/** Trailing 30 days. */
export const LAST_30D = { from: daysAgo(30), to: TODAY } as const
/** Trailing 90 days — the window the seed's lead and admission volumes fill. */
export const LAST_90D = { from: daysAgo(90), to: TODAY } as const

/* -------------------------------------------------------------------------- */
/* Seeded PRNG                                                                */
/* -------------------------------------------------------------------------- */

/**
 * mulberry32. Small, fast, and — the only property that matters here —
 * identical on every run for a given seed.
 */
export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer in [min, max] inclusive. */
export function int(r: () => number, min: number, max: number): number {
  return min + Math.floor(r() * (max - min + 1))
}

/** Uniform pick. */
export function pick<T>(r: () => number, items: readonly T[]): T {
  return items[Math.floor(r() * items.length)] as T
}

/** Weighted pick: `weighted(r, [['new', 40], ['contacted', 25]])`. */
export function weighted<T>(r: () => number, table: ReadonlyArray<readonly [T, number]>): T {
  const total = table.reduce((acc, [, w]) => acc + w, 0)
  let roll = r() * total
  for (const [value, w] of table) {
    roll -= w
    if (roll <= 0) return value
  }
  return table[table.length - 1][0]
}

/** True with probability `p`. */
export function chance(r: () => number, p: number): boolean {
  return r() < p
}

/** `n` sequential numbers starting at `from`, as an array. */
export function series(count: number, from = 0): number[] {
  return Array.from({ length: count }, (_, i) => from + i)
}

/** Zero-padded sequence number: `pad(42, 4)` → "0042". */
export function pad(n: number, width = 4): string {
  return String(n).padStart(width, '0')
}

/* -------------------------------------------------------------------------- */
/* Auditable                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The author of record for seeded rows where no one more specific fits:
 * `usr-0001`, Adebayo Ogunlana, the Super Admin. Deliberately a real user so
 * every `createdBy` resolves — `validateSeed()` would otherwise flag it.
 */
export const SYSTEM_USER: UserId = uid('usr-0001')

/**
 * Spread into every record: `...audit(dtAgo(14, 10, 12), U.chidinma)`.
 * `updatedAt` defaults to `createdAt` — untouched since creation.
 */
export function audit(createdAt: ISODateTime, by: UserId = SYSTEM_USER, updatedAt?: ISODateTime): Auditable {
  return { createdAt, createdBy: by, updatedAt: updatedAt ?? createdAt, updatedBy: by }
}

/* -------------------------------------------------------------------------- */
/* Money                                                                      */
/* -------------------------------------------------------------------------- */

/** Sums a kobo column and keeps the brand. */
export function sumKobo<T>(items: readonly T[], of: (item: T) => Kobo): Kobo {
  return items.reduce((acc, i) => acc + of(i), 0) as Kobo
}

/** Percentage of a kobo amount, rounded to the nearest kobo. */
export function percentOf(amount: Kobo, rate: number): Kobo {
  return Math.round((amount * rate) / 100) as Kobo
}

/** Splits an amount into `n` instalments; the first absorbs any remainder. */
export function splitInstalments(amount: Kobo, n: number): Kobo[] {
  const base = Math.floor(amount / n)
  const parts = Array.from({ length: n }, () => base as Kobo)
  parts[0] = (base + (amount - base * n)) as Kobo
  return parts
}

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

export function initialsOf(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

/** "+234 803 412 7781" — the shape every seeded Nigerian number takes. */
export function phone(r: () => number): string {
  const prefixes = ['803', '806', '805', '807', '808', '810', '813', '814', '816', '703', '706', '905', '901']
  const p = pick(r, prefixes)
  return `+234 ${p} ${pad(int(r, 100, 999), 3)} ${pad(int(r, 1000, 9999), 4)}`
}

const EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com']

export function personalEmail(r: () => number, first: string, last: string, n: number): string {
  const d = pick(r, EMAIL_DOMAINS)
  return `${first.toLowerCase()}.${last.toLowerCase()}${n % 7 === 0 ? n : ''}@${d}`
}
