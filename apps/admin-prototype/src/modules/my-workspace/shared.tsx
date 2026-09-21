import type { ReactNode } from 'react'

import { useSession } from '@/auth'
import {
  employeesCollection,
  peopleCollection,
  useCollection,
  usersCollection,
  type Employee,
  type LeaveType,
  type PersonId,
  type UserId,
} from '@/mocks'
import { humanize } from '@/lib/format'
import { Alert, PageHeader } from '@/ui'

export function personName(personId: string | null | undefined): string {
  if (!personId) return '—'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

export function userName(userId: string | null | undefined): string {
  if (!userId) return 'Unassigned'
  if (userId === 'system') return 'Cirvee OS'
  const user = usersCollection.find(userId)
  if (!user) return 'Unknown'
  return personName(user.personId)
}

export function leaveLabel(type: string): string {
  return (LEAVE_TYPE_LABEL as Record<string, string>)[type] ?? humanize(type)
}

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual',
  sick: 'Sick',
  compassionate: 'Compassionate',
  maternity: 'Maternity',
  paternity: 'Paternity',
  study: 'Study',
  unpaid: 'Unpaid',
}

export interface Me {
  personId: PersonId | undefined
  userId: UserId | undefined
  displayName: string
  employee: Employee | undefined
}

export function useMe(): Me {
  const session = useSession()
  const employees = useCollection(employeesCollection)

  const personId = session?.personId
  const employee = personId ? employees.find((e) => e.personId === personId) : undefined

  return {
    personId,
    userId: session?.userId,
    displayName: session?.displayName ?? 'You',
    employee,
  }
}

export function workingDays(from: string, to: string): number {
  if (!from || !to || to < from) return 0
  let count = 0
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) count++
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 py-6">{children}</div>
}

export function NoEmploymentRecord({ what }: { what: string }) {
  return (
    <Alert tone="info" title="No employment record behind this sign-in">
      {what} is held against an employment record, and this account does not have one. Someone in HR
      creates it when a person resumes, and everything here appears from that point on.
    </Alert>
  )
}

export function MyPageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description: string
  actions?: ReactNode
}) {
  return <PageHeader title={title} description={description} actions={actions} />
}
