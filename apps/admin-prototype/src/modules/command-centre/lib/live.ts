/**
 * Liveness.
 *
 * Home reads through the store's selectors, and a selector is a plain function
 * — it does not subscribe. These hooks subscribe the screen to every
 * collection its selectors touch, so a payment matched in Finance or a
 * commission approved in Referral re-renders the Command Centre on its own.
 *
 * This is the whole point of the screen: complete Flow 1 in another module and
 * the collected-revenue figure here has to move without a reload.
 */

import {
  admissionsCollection,
  approvalRequestsCollection,
  attendanceEventsCollection,
  automationRunsCollection,
  automationsCollection,
  branchesCollection,
  classSessionsCollection,
  cohortsCollection,
  employeesCollection,
  enrollmentsCollection,
  expensesCollection,
  invoicesCollection,
  leadsCollection,
  leaveRequestsCollection,
  notificationsCollection,
  paymentsCollection,
  payrollItemsCollection,
  peopleCollection,
  studentAttendanceCollection,
  submissionsCollection,
  tasksCollection,
  ticketsCollection,
  unitsCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type { Branch, Unit } from '@/mocks'

/**
 * Subscribes to everything the executive view derives from. Returns the two
 * reference collections the page needs by hand (units and branches); the rest
 * are subscribed for their re-render only, and read back through selectors.
 */
export function useExecutiveLive(): { units: Unit[]; branches: Branch[] } {
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  /* Money */
  useCollection(paymentsCollection)
  useCollection(invoicesCollection)
  useCollection(expensesCollection)
  useCollection(payrollItemsCollection)

  /* Growth */
  useCollection(leadsCollection)
  useCollection(admissionsCollection)

  /* Students */
  useCollection(enrollmentsCollection)
  useCollection(cohortsCollection)
  useCollection(classSessionsCollection)
  useCollection(studentAttendanceCollection)
  useCollection(submissionsCollection)

  /* The organisation */
  useCollection(approvalRequestsCollection)
  useCollection(ticketsCollection)
  useCollection(attendanceEventsCollection)
  useCollection(automationsCollection)
  useCollection(automationRunsCollection)
  useCollection(peopleCollection)

  return { units, branches }
}

/** The employee view's narrower footprint. */
export function useEmployeeLive(): void {
  useCollection(tasksCollection)
  useCollection(approvalRequestsCollection)
  useCollection(attendanceEventsCollection)
  useCollection(leaveRequestsCollection)
  useCollection(notificationsCollection)
  useCollection(employeesCollection)
  useCollection(usersCollection)
  useCollection(peopleCollection)
}
