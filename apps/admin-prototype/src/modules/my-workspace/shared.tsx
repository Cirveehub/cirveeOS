/**
 * Shared plumbing for the personal staff module.
 *
 * Every staff persona is also an employee. The PRD's role table lists Employee
 * — "own profile, attendance, leave, payslips, tasks, requests" — as its own
 * row precisely because a Finance Manager or a Tutor is *also* somebody with a
 * leave balance and a payslip, not only whatever their specialist role grants.
 * Until this module there was nowhere for that half of a person to live: the
 * admin modules show everybody's records, which is a different question from
 * "what about mine".
 *
 * Everything here is scoped to the signed-in person's own employment record.
 * There is no permission gate on the module for the same reason `my-referral`
 * has none — eligibility is not a role question, and every query is already
 * narrowed to one person.
 */
import type { ReactNode } from 'react'

import { useSession } from '@/auth'
import {
  TODAY,
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

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

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

/**
 * `leaveBalances[].type` is a plain string on the record, so reading a label
 * from a balance needs a lookup that tolerates one — `LEAVE_TYPE_LABEL` stays
 * keyed by `LeaveType` so the form's own list still fails to compile if a
 * leave type is ever added and left unlabelled.
 */
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

/* -------------------------------------------------------------------------- */
/* Who is signed in                                                           */
/* -------------------------------------------------------------------------- */

export interface Me {
  personId: PersonId | undefined
  userId: UserId | undefined
  displayName: string
  /** The employment record every screen here reads from. */
  employee: Employee | undefined
}

/**
 * The signed-in person's own employment record.
 *
 * Deliberately no fallback to "some other employee so the screen looks full".
 * A payslip or a leave balance belonging to somebody else is the one thing
 * this module must never show, so when there is no record the screens say so
 * instead of borrowing one.
 */
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

/* -------------------------------------------------------------------------- */
/* Dates                                                                      */
/* -------------------------------------------------------------------------- */

export function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 || day === 6
}

/** Working days in an inclusive range, weekends excluded. 0 when inverted. */
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

/** Every date in the month `TODAY` falls in, oldest first. */
export function daysOfCurrentMonth(): string[] {
  const [year, month] = TODAY.split('-').map(Number)
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return Array.from(
    { length: last },
    (_, i) => `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
  )
}

export function timeOfDay(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
}

/* -------------------------------------------------------------------------- */
/* Screen shell                                                               */
/* -------------------------------------------------------------------------- */

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 py-6">{children}</div>
}

/**
 * Shown in place of a screen's content when the signed-in persona has no
 * employment record — a consultant, or a persona the seed never hired.
 */
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
