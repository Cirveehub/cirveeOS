export const KOBO = 100

export function formatNaira(kobo: number, opts?: { decimals?: boolean; compact?: boolean }): string {
  const naira = kobo / KOBO

  if (opts?.compact) {
    if (Math.abs(naira) >= 1_000_000_000) return `₦${trimZeros(naira / 1_000_000_000)}b`
    if (Math.abs(naira) >= 1_000_000) return `₦${trimZeros(naira / 1_000_000)}m`
    if (Math.abs(naira) >= 10_000) return `₦${trimZeros(naira / 1_000)}k`
  }

  return `₦${naira.toLocaleString('en-NG', {
    minimumFractionDigits: opts?.decimals ? 2 : 0,
    maximumFractionDigits: opts?.decimals ? 2 : 0,
  })}`
}

function trimZeros(n: number): string {
  return n.toFixed(1).replace(/\.0$/, '')
}

export function naira(amount: number): number {
  return Math.round(amount * KOBO)
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-NG')
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals).replace(/\.0$/, '')}%`
}

export function formatDelta(n: number, decimals = 1): string {
  const sign = n > 0 ? '+' : n < 0 ? '−' : ''
  return `${sign}${Math.abs(n).toFixed(decimals).replace(/\.0$/, '')}%`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${formatDate(date)} ${hh}:${mm}`
}

export function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatRelative(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 0) return formatDate(date)
  if (seconds < 60) return 'just now'

  const units: [number, string][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
  ]

  for (let i = units.length - 1; i >= 0; i--) {
    const [secs, name] = units[i]
    if (seconds >= secs) {
      const n = Math.floor(seconds / secs)
      return `${n} ${name}${n === 1 ? '' : 's'} ago`
    }
  }
  return 'just now'
}

export function daysUntil(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

export function daysSince(d: Date | string): number {
  const date = typeof d === 'string' ? new Date(d) : d
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length < 2) return name
  return `${parts[0]} ${parts[parts.length - 1][0]}.`
}

export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('234') && digits.length === 13) {
    return `+234 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
  }
  return raw
}

export function pluralize(n: number, singular: string, plural?: string): string {
  return `${formatNumber(n)} ${n === 1 ? singular : (plural ?? `${singular}s`)}`
}

export function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`
}

export function humanize(s: string): string {
  const spaced = s.replace(/[_-]/g, ' ').toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
