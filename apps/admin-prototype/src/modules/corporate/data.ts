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

/** One hook so every corporate screen reads the same derived participant set. */
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

  // Referenced so the participant set re-derives when sessions change too.
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
