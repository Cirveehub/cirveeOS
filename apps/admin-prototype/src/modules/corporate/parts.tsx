import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { Alert, Button, PageHeader } from '@/ui'
import {
  CURRENT_USER_ID,
  TODAY,
  auditEventsCollection,
  demo,
  peopleCollection,
  rolesCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import { auditId } from '@/mocks/types'

export const MODULE_ID = 'corporate'

export function Screen({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1560px] px-6 py-6">{children}</div>
}

export function ModuleHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return <PageHeader title={title} description={description} actions={actions} />
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

let auditSequence = 0

export function emitCorporateAudit(input: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): void {
  auditSequence += 1
  const actor = usersCollection.find(CURRENT_USER_ID)
  const person = actor ? peopleCollection.find(actor.personId) : undefined
  auditEventsCollection.insert({
    id: auditId(`aud-corp-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: `${TODAY}T09:00:00+01:00`,
    actorUserId: CURRENT_USER_ID,
    actorName: person ? `${person.firstName} ${person.lastName}` : 'Super Admin',
    actorRole: actor?.roleIds[0] ? (rolesCollection.find(actor.roleIds[0])?.name ?? 'Super Admin') : 'Super Admin',
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: 'ui',
    ip: '102.89.34.17',
  })
}

export function corporateStamp(): { createdAt: string; createdBy: typeof CURRENT_USER_ID; updatedAt: string; updatedBy: typeof CURRENT_USER_ID } {
  const at = `${TODAY}T09:00:00+01:00`
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
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
