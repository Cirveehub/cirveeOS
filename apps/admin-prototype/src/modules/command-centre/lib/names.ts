/**
 * Name lookups.
 *
 * The store's selectors return ids; the screen shows people. These read
 * through the collections so a merged or renamed Person shows its new name
 * everywhere at once.
 */

import { peopleCollection, usersCollection, employeesCollection } from '@/mocks'
import type { EmployeeId, PersonId, UserId } from '@/mocks'

export function personName(id: PersonId | string | null | undefined): string {
  if (!id) return 'Unassigned'
  const person = peopleCollection.find(id)
  return person ? `${person.firstName} ${person.lastName}` : String(id)
}

export function userName(id: UserId | string | null | undefined): string {
  if (!id) return 'Unassigned'
  const user = usersCollection.find(id)
  return user ? personName(user.personId) : String(id)
}

export function employeeName(id: EmployeeId | string | null | undefined): string {
  if (!id) return 'Unassigned'
  const employee = employeesCollection.find(id)
  return employee ? personName(employee.personId) : String(id)
}

/** The employee record behind the signed-in user, if there is one. */
export function employeeForUser(userId: UserId | string): ReturnType<typeof employeesCollection.find> {
  const user = usersCollection.find(userId)
  if (!user) return undefined
  return employeesCollection.all().find((e) => e.personId === user.personId)
}
