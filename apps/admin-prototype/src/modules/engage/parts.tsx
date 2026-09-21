import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Alert, Button, PageHeader, ProgressBar, SkeletonCard, SkeletonTable } from '@/ui'
import { demo, peopleCollection, useCollection, usersCollection, type Channel } from '@/mocks'

export const MODULE_ID = 'engage'

export const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-app',
}

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1560px] px-6 py-6">{children}</div>
}

export function ModuleHeader({
  title,
  description,
  actions,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  meta?: ReactNode
}) {
  return <PageHeader title={title} description={description} actions={actions} meta={meta} />
}

export function useModuleData<T>(rows: T[], scope: string): {
  loading: boolean
  error: boolean
  rows: T[]
  retry: () => void
} {
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setLoading(true)
    const timer = window.setTimeout(() => setLoading(false), 400 + demo.latency())
    return () => window.clearTimeout(timer)
  }, [attempt])

  return {
    loading,
    error: demo.isErrored(scope),
    rows: demo.isEmpty(MODULE_ID) ? [] : rows,
    retry: () => setAttempt((n) => n + 1),
  }
}

export function ErrorPanel({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <Alert
      tone="danger"
      title={`${what} could not be loaded`}
      action={
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      }
    >
      The request failed before any rows came back. Nothing has been changed.
    </Alert>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 10 }, (_, i) => (
          <SkeletonCard key={i} variant="stat" />
        ))}
      </div>
      <SkeletonTable rows={6} columns={4} />
    </div>
  )
}

export function usePersonName(): (id: string | null | undefined) => string {
  const people = useCollection(peopleCollection)
  const byId = useMemo(
    () => new Map(people.map((p) => [p.id as string, `${p.firstName} ${p.lastName}`])),
    [people],
  )
  return (id) => (id ? (byId.get(id) ?? 'Unknown person') : '—')
}

export function useUserName(): (id: string | null | undefined) => string {
  const users = useCollection(usersCollection)
  const people = useCollection(peopleCollection)
  const byId = useMemo(() => {
    const names = new Map(people.map((p) => [p.id as string, `${p.firstName} ${p.lastName}`]))
    return new Map(users.map((u) => [u.id as string, names.get(u.personId) ?? u.email]))
  }, [users, people])
  return (id) => (id ? (byId.get(id) ?? 'Unknown user') : 'Unassigned')
}

export interface BarRow {
  key: string
  label: ReactNode
  value: number
  valueLabel: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
  note?: ReactNode
}

export function BarList({
  rows,
  max,
  emptyMessage = 'Nothing to plot yet.',
  className,
}: {
  rows: BarRow[]
  max?: number
  emptyMessage?: string
  className?: string
}) {
  const ceiling = max ?? Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) {
    return <p className="text-body-13 text-text-secondary">{emptyMessage}</p>
  }
  return (
    <ul className={cn('space-y-3', className)}>
      {rows.map((row) => (
        <li key={row.key}>
          <ProgressBar
            value={row.value}
            max={ceiling}
            tone={row.tone ?? 'accent'}
            size="sm"
            label={row.label}
            valueLabel={row.valueLabel}
          />
          {row.note && <p className="mt-1 text-body-12 text-text-secondary">{row.note}</p>}
        </li>
      ))}
    </ul>
  )
}

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1))
}
