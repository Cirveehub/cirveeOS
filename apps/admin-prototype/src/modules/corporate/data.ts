import { useMemo } from 'react'

import {
  certificatesCollection,
  classSessionsCollection,
  clientOrgsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  invoicesCollection,
  progressCollection,
  studentAttendanceCollection,
  submissionsCollection,
  useCollection,
} from '@/mocks'

import { deriveParticipants, type Participant } from './participant-model'

export function useParticipants(): Participant[] {
  const clientOrgs = useCollection(clientOrgsCollection)
  const invoices = useCollection(invoicesCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)
  const progress = useCollection(progressCollection)
  const submissions = useCollection(submissionsCollection)
  const attendance = useCollection(studentAttendanceCollection)
  const certificates = useCollection(certificatesCollection)

  useCollection(classSessionsCollection)

  return useMemo(
    () =>
      deriveParticipants({
        clientOrgs,
        invoices,
        enrollments,
        cohorts,
        courses,
        progress,
        submissions,
        attendance,
        certificatedEnrollmentIds: new Set(
          certificates.filter((c) => c.status === 'issued').map((c) => c.enrollmentId as string),
        ),
      }),
    [clientOrgs, invoices, enrollments, cohorts, courses, progress, submissions, attendance, certificates],
  )
}
