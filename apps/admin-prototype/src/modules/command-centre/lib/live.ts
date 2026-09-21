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

export function useExecutiveLive(): { units: Unit[]; branches: Branch[] } {
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  useCollection(paymentsCollection)
  useCollection(invoicesCollection)
  useCollection(expensesCollection)
  useCollection(payrollItemsCollection)

  useCollection(leadsCollection)
  useCollection(admissionsCollection)

  useCollection(enrollmentsCollection)
  useCollection(cohortsCollection)
  useCollection(classSessionsCollection)
  useCollection(studentAttendanceCollection)
  useCollection(submissionsCollection)

  useCollection(approvalRequestsCollection)
  useCollection(ticketsCollection)
  useCollection(attendanceEventsCollection)
  useCollection(automationsCollection)
  useCollection(automationRunsCollection)
  useCollection(peopleCollection)

  return { units, branches }
}

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
