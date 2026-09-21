import type {
  ClientOrg,
  Cohort,
  Course,
  Enrollment,
  Invoice,
  Kobo,
  Progress,
  StudentAttendance,
  Submission,
} from '@/mocks'

export interface Participant {
  id: string
  personId: string
  organisationId: string
  organisationName: string
  enrollmentId: string
  cohortCode: string
  courseTitle: string
  invoiceRef: string
  seatPrice: Kobo
  attendancePercent: number | null
  progressPercent: number
  preScore: number | null
  postScore: number | null
  gain: number | null
  certificateIssued: boolean
}

export interface ParticipantInputs {
  clientOrgs: ClientOrg[]
  invoices: Invoice[]
  enrollments: Enrollment[]
  cohorts: Cohort[]
  courses: Course[]
  progress: Progress[]
  submissions: Submission[]
  attendance: StudentAttendance[]
  certificatedEnrollmentIds: Set<string>
}

export function deriveParticipants(input: ParticipantInputs): Participant[] {
  const orgById = new Map(input.clientOrgs.map((o) => [o.id as string, o]))
  const enrolmentById = new Map(input.enrollments.map((e) => [e.id as string, e]))
  const cohortById = new Map(input.cohorts.map((c) => [c.id as string, c]))
  const courseById = new Map(input.courses.map((c) => [c.id as string, c]))
  const progressByEnrolment = new Map(input.progress.map((p) => [p.enrollmentId as string, p]))

  const submissionsByEnrolment = new Map<string, Submission[]>()
  for (const s of input.submissions) {
    const key = s.enrollmentId as string
    const list = submissionsByEnrolment.get(key) ?? []
    list.push(s)
    submissionsByEnrolment.set(key, list)
  }

  const attendanceByEnrolment = new Map<string, StudentAttendance[]>()
  for (const a of input.attendance) {
    const key = a.enrollmentId as string
    const list = attendanceByEnrolment.get(key) ?? []
    list.push(a)
    attendanceByEnrolment.set(key, list)
  }

  const out: Participant[] = []

  for (const invoice of input.invoices) {
    if (!invoice.organisationId || invoice.status === 'cancelled') continue
    const org = orgById.get(invoice.organisationId as string)
    if (!org) continue

    for (const line of invoice.lines) {
      if (!line.enrollmentId) continue
      const enrolment = enrolmentById.get(line.enrollmentId as string)
      if (!enrolment) continue

      const graded = (submissionsByEnrolment.get(enrolment.id as string) ?? [])
        .filter((s) => s.status === 'graded' && s.totalScore !== null)
        .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))

      const preScore = graded.length > 0 ? graded[0].totalScore : null
      const postScore = graded.length > 1 ? graded[graded.length - 1].totalScore : null

      const marks = attendanceByEnrolment.get(enrolment.id as string) ?? []
      const present = marks.filter(
        (m) => m.state === 'present' || m.state === 'late' || m.state === 'excused',
      ).length

      out.push({
        id: `${invoice.id}:${line.id}`,
        personId: enrolment.personId as string,
        organisationId: org.id as string,
        organisationName: org.name,
        enrollmentId: enrolment.id as string,
        cohortCode: cohortById.get(enrolment.cohortId as string)?.code ?? '—',
        courseTitle: courseById.get(enrolment.courseId as string)?.title ?? '—',
        invoiceRef: invoice.ref,
        seatPrice: line.amount,
        attendancePercent:
          marks.length > 0
            ? Math.round((present / marks.length) * 100)
            : (cohortById.get(enrolment.cohortId as string)?.attendanceRate ?? null),
        progressPercent: progressByEnrolment.get(enrolment.id as string)?.percentComplete ?? 0,
        preScore,
        postScore,
        gain: preScore !== null && postScore !== null ? postScore - preScore : null,
        certificateIssued: input.certificatedEnrollmentIds.has(enrolment.id as string),
      })
    }
  }

  return out
}
