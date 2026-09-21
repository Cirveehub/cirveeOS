import { useMemo, type ReactNode } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import { useSession, personaById } from '@/auth'
import type { BadgeTone } from '@/ui'
import {
  addDays,
  certificateEligibility,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  invoicesCollection,
  peopleCollection,
  tutorAssignmentsCollection,
  useCollection,
  TODAY,
  type Assignment,
  type Cohort,
  type Course,
  type Enrollment,
  type Person,
  type PersonId,
  type Submission,
} from '@/mocks'

export interface StudentContext {
  personId: PersonId | undefined
  person: Person | undefined
  displayName: string
  enrolments: Enrollment[]
  primary: Enrollment | undefined
}

export function useStudent(): StudentContext {
  const session = useSession()
  const people = useCollection(peopleCollection)
  const enrolments = useCollection(enrollmentsCollection)

  return useMemo(() => {
    const mine = (id: PersonId | undefined) =>
      id ? enrolments.filter((e) => e.personId === id && e.status !== 'withdrawn') : []

    let personId = session?.personId
    let rows = mine(personId)

    if (rows.length === 0) {
      const fallback = personaById['student']?.personId
      if (fallback) {
        personId = fallback
        rows = mine(fallback)
      }
    }

    const ordered = [...rows].sort((a, b) => {
      const rank = (e: Enrollment) => (e.status === 'active' ? 0 : e.status === 'completed' ? 1 : 2)
      return rank(a) - rank(b) || b.enrolledAt.localeCompare(a.enrolledAt)
    })

    const person = personId ? people.find((p) => p.id === personId) : undefined

    return {
      personId,
      person,
      displayName: person ? `${person.preferredName ?? person.firstName} ${person.lastName}` : 'Student',
      enrolments: ordered,
      primary: ordered[0],
    }
  }, [session?.personId, people, enrolments])
}

export interface EnrolmentDetail {
  enrolment: Enrollment
  cohort: Cohort | undefined
  course: Course | undefined
  tutorName: string | undefined
}

export function detailOf(enrolment: Enrollment): EnrolmentDetail {
  const cohort = cohortsCollection.find(enrolment.cohortId)
  const course = coursesCollection.find(enrolment.courseId)
  const lead = tutorAssignmentsCollection
    .where((t) => t.cohortId === enrolment.cohortId && t.status === 'active')
    .sort((a, b) => (a.role === 'lead' ? -1 : b.role === 'lead' ? 1 : 0))[0]

  return { enrolment, cohort, course, tutorName: lead ? personName(lead.tutorPersonId) : undefined }
}

export function personName(id: PersonId | string | null | undefined): string {
  if (!id) return 'Unassigned'
  const person = peopleCollection.find(id)
  return person ? `${person.firstName} ${person.lastName}` : 'Unassigned'
}

export type WorkState = 'pending' | 'overdue' | 'submitted' | 'graded' | 'returned' | 'missing'

export const WORK_LABEL: Record<WorkState, string> = {
  pending: 'Pending',
  overdue: 'Overdue',
  submitted: 'Submitted',
  graded: 'Graded',
  returned: 'Returned for revision',
  missing: 'Missing',
}

export const WORK_TONE: Record<WorkState, BadgeTone> = {
  pending: 'warning',
  overdue: 'danger',
  submitted: 'accent',
  graded: 'success',
  returned: 'warning',
  missing: 'danger',
}

export interface AssignmentState {
  assignment: Assignment
  submission: Submission | undefined
  dueDate: string | null
  state: WorkState
}

export function dueDateOf(assignment: Assignment, cohort: Cohort | undefined): string | null {
  if (assignment.dueDate) return assignment.dueDate
  if (!cohort || assignment.dueOffsetDays === null) return null
  return addDays(cohort.startDate, assignment.dueOffsetDays)
}

export function assignmentStateOf(
  assignment: Assignment,
  enrolment: Enrollment,
  cohort: Cohort | undefined,
  submissions: Submission[],
): AssignmentState {
  const mine = submissions
    .filter((s) => s.assignmentId === assignment.id && s.enrollmentId === enrolment.id)
    .sort((a, b) => b.attempt - a.attempt)[0]

  const dueDate = dueDateOf(assignment, cohort)

  let state: WorkState
  if (!mine) state = dueDate !== null && dueDate < TODAY ? 'overdue' : 'pending'
  else if (mine.status === 'graded') state = 'graded'
  else if (mine.status === 'returned_for_revision') state = 'returned'
  else if (mine.status === 'missing') state = 'missing'
  else state = 'submitted'

  return { assignment, submission: mine, dueDate, state }
}

export function assignmentsFor(
  enrolment: Enrollment,
  assignments: Assignment[],
  submissions: Submission[],
): AssignmentState[] {
  const cohort = cohortsCollection.find(enrolment.cohortId)
  return assignments
    .filter((a) => a.courseId === enrolment.courseId && (a.cohortId === null || a.cohortId === enrolment.cohortId))
    .map((a) => assignmentStateOf(a, enrolment, cohort, submissions))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '') || a.assignment.title.localeCompare(b.assignment.title))
}

export interface MoneyPosition {
  total: number
  paid: number
  balance: number
  nextDueDate: string | null
  overdue: boolean
}

export function moneyFor(personId: PersonId | undefined): MoneyPosition {
  if (!personId) return { total: 0, paid: 0, balance: 0, nextDueDate: null, overdue: false }

  const invoices = invoicesCollection.where(
    (i) => i.personId === personId && i.status !== 'cancelled' && i.voidedAt === null,
  )
  const outstanding = invoices
    .filter((i) => i.balance > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return {
    total: invoices.reduce((acc, i) => acc + i.total, 0),
    paid: invoices.reduce((acc, i) => acc + i.paidAmount, 0),
    balance: invoices.reduce((acc, i) => acc + i.balance, 0),
    nextDueDate: outstanding[0]?.dueDate ?? null,
    overdue: outstanding.some((i) => i.dueDate < TODAY),
  }
}

export function certificateProgress(enrolments: Enrollment[]): { met: number; total: number } {
  return enrolments.reduce(
    (acc, e) => {
      const result = certificateEligibility(e.id)
      return { met: acc.met + result.criteria.filter((c) => c.met).length, total: acc.total + result.criteria.length }
    },
    { met: 0, total: 0 },
  )
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-300 px-6 py-6">{children}</div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className:
            '!rounded-xl !border !border-border !bg-surface !text-text !text-[13px] !font-medium !shadow-lg',
        }}
      />
    </div>
  )
}

export const studentToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
}

export function weekdayOf(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function nowIso(): string {
  return new Date().toISOString()
}
