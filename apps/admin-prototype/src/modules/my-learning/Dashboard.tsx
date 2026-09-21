import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Award,
  CalendarX,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  GraduationCap,
  MessageSquareQuote,
  UserCheck,
  Video,
  type LucideIcon,
} from 'lucide-react'

import { formatDate, formatNaira, formatRelative } from '@/lib/format'
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  SectionHeader,
  SkeletonTable,
  StatCard,
  type Column,
} from '@/ui'
import { useScreenLoad } from '@/lib/view-state'
import {
  assignmentsCollection,
  classSessionsCollection,
  cohortsCollection,
  coursesCollection,
  invoicesCollection,
  paymentsCollection,
  studentAttendanceCollection,
  submissionsCollection,
  useCollection,
  TODAY,
  type ClassSession,
} from '@/mocks'

import {
  assignmentsFor,
  certificateProgress,
  moneyFor,
  personName,
  Screen,
  useStudent,
  weekdayOf,
} from './common'

interface ClassRow {
  session: ClassSession
  courseTitle: string
  cohortCode: string
  mode: string
  tutorName: string
}

interface ActivityRow {
  id: string
  icon: LucideIcon
  title: string
  detail: string
  at: string
  to: string | null
}

const MODE_LABEL: Record<string, string> = {
  on_campus: 'On campus',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
}

export default function Dashboard() {
  const { loading } = useScreenLoad('my-learning')
  const student = useStudent()

  const attendance = useCollection(studentAttendanceCollection)
  const submissions = useCollection(submissionsCollection)
  const assignments = useCollection(assignmentsCollection)
  const sessions = useCollection(classSessionsCollection)
  const payments = useCollection(paymentsCollection)
  const invoices = useCollection(invoicesCollection)

  const { enrolments, primary, personId } = student

  const myAttendance = useMemo(
    () => attendance.filter((a) => enrolments.some((e) => e.id === a.enrollmentId)),
    [attendance, enrolments],
  )
  const attended = myAttendance.filter((a) => a.state !== 'absent').length
  const attendanceRate = myAttendance.length ? Math.round((attended / myAttendance.length) * 100) : 0

  const outstanding = useMemo(
    () =>
      enrolments.flatMap((e) =>
        assignmentsFor(e, assignments, submissions).filter(
          (row) => row.state === 'pending' || row.state === 'overdue' || row.state === 'returned',
        ),
      ),
    [enrolments, assignments, submissions],
  )
  const overdueCount = outstanding.filter((row) => row.state === 'overdue').length

  const certificate = useMemo(
    () => certificateProgress(enrolments),
    [enrolments, submissions, attendance, invoices],
  )
  const money = useMemo(() => moneyFor(personId), [personId, invoices])

  const upcoming = useMemo<ClassRow[]>(() => {
    const cohortIds = new Set(enrolments.map((e) => e.cohortId))
    return sessions
      .filter((s) => cohortIds.has(s.cohortId) && s.date >= TODAY && s.status !== 'cancelled')
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 3)
      .map((session) => {
        const cohort = cohortsCollection.find(session.cohortId)
        const course = cohort ? coursesCollection.find(cohort.courseId) : undefined
        return {
          session,
          courseTitle: course?.title ?? 'Course',
          cohortCode: cohort?.code ?? '',
          mode: cohort ? (MODE_LABEL[cohort.mode] ?? cohort.mode) : '',
          tutorName: personName(session.tutorPersonId),
        }
      })
  }, [sessions, enrolments])

  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = []
    const cohortIds = new Set(enrolments.map((e) => e.cohortId))

    for (const submission of submissions.filter((s) => s.personId === personId)) {
      const assignment = assignmentsCollection.find(submission.assignmentId)
      const to = `/my-learning/assignments/${submission.assignmentId}`
      if (submission.status === 'graded' && submission.gradedAt) {
        rows.push({
          id: `${submission.id}-graded`,
          icon: MessageSquareQuote,
          title: `${assignment?.title ?? 'Assignment'} was graded`,
          detail: `${submission.totalScore ?? 0} of ${assignment?.maxScore ?? 100} — feedback from ${personName(submission.gradedByPersonId)}`,
          at: submission.gradedAt,
          to,
        })
      }
      rows.push({
        id: `${submission.id}-submitted`,
        icon: FileCheck2,
        title: `You submitted ${assignment?.title ?? 'an assignment'}`,
        detail: submission.isLate ? 'Submitted after the due date' : `Attempt ${submission.attempt}`,
        at: submission.submittedAt,
        to,
      })
    }

    for (const payment of payments.filter((p) => p.personId === personId && p.reversedAt === null)) {
      rows.push({
        id: payment.id,
        icon: CreditCard,
        title: `Payment received — ${formatNaira(payment.amount)}`,
        detail: `${payment.ref} · receipt ${payment.receiptSentAt ? 'sent' : 'pending'}`,
        at: payment.receivedAt,
        to: '/my-learning/payment',
      })
    }

    for (const session of sessions.filter((s) => cohortIds.has(s.cohortId) && s.status === 'cancelled')) {
      rows.push({
        id: session.id,
        icon: CalendarX,
        title: `Class cancelled — ${session.topic}`,
        detail: `${formatDate(session.date)} · ${session.startTime}–${session.endTime}`,
        at: `${session.date}T${session.startTime}:00`,
        to: '/my-learning/course?tab=timetable',
      })
    }

    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4)
  }, [submissions, payments, sessions, personId, enrolments])

  const classColumns: Array<Column<ClassRow>> = [
    {
      key: 'course',
      header: 'Class',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-bold">{row.session.topic}</p>
          <p className="truncate text-body-12 text-text-muted">
            {row.courseTitle} · {row.cohortCode}
          </p>
        </div>
      ),
      minWidth: 260,
    },
    {
      key: 'time',
      header: 'Time',
      accessor: (row) =>
        `${weekdayOf(row.session.date)}, ${row.session.startTime}–${row.session.endTime}`,
    },
    { key: 'type', header: 'Type', accessor: (row) => row.mode },
    { key: 'tutor', header: 'Tutor', accessor: (row) => row.tutorName },
    {
      key: 'action',
      header: '',
      align: 'right',
      cell: (row) =>
        row.session.meetingUrl ? (
          <Button size="sm" variant="secondary" leftIcon={<Video size={14} />}>
            Join class
          </Button>
        ) : (
          <span className="text-body-13 text-text-muted">{row.session.room ?? '—'}</span>
        ),
      width: 160,
    },
  ]

  return (
    <Screen>
      <PageHeader
        title={`Welcome, ${student.person?.preferredName ?? student.person?.firstName ?? 'there'}`}
        description={
          primary
            ? `${coursesCollection.find(primary.courseId)?.title ?? 'Your course'} · ${cohortsCollection.find(primary.cohortId)?.code ?? ''}`
            : 'Your course, your assignments, your grades and your certificate.'
        }
      />

      {!primary && !loading ? (
        <EmptyState
          icon={GraduationCap}
          title="No enrolment on your record"
          message="You are not enrolled on a course yet. Your admissions contact can help."
          bordered
        />
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {/* 1 — the stat row. Four, because the legacy portal is right that a
              learner's dashboard is not an operations console. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Attendance"
              value={`${attendanceRate}%`}
              caption={`${attended} of ${myAttendance.length} classes attended`}
              icon={UserCheck}
              variant={attendanceRate >= 75 ? 'success' : 'warning'}
              loading={loading}
            />
            <StatCard
              label="Assignments outstanding"
              value={outstanding.length}
              caption={
                outstanding.length === 0
                  ? 'Everything is submitted'
                  : overdueCount > 0
                    ? `${overdueCount} past the due date`
                    : 'Awaiting your submission'
              }
              icon={ClipboardCheck}
              variant={overdueCount > 0 ? 'danger' : outstanding.length ? 'warning' : 'success'}
              loading={loading}
            />
            <StatCard
              label="Certificate progress"
              value={`${certificate.met}/${certificate.total}`}
              caption={
                certificate.met === certificate.total
                  ? 'Every criterion met'
                  : `${certificate.total - certificate.met} left before you are certified`
              }
              icon={Award}
              variant={certificate.met === certificate.total ? 'success' : 'default'}
              loading={loading}
            />
            <StatCard
              label="Balance"
              value={formatNaira(money.balance)}
              caption={
                money.balance === 0
                  ? 'Your fees are up to date'
                  : money.nextDueDate
                    ? `Due ${formatDate(money.nextDueDate)}`
                    : 'Outstanding'
              }
              icon={CreditCard}
              variant={money.balance === 0 ? 'success' : money.overdue ? 'danger' : 'warning'}
              loading={loading}
            />
          </div>

          {/* 2 — upcoming classes. Three rows, then the timetable tab. */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <SectionHeader
              title="Upcoming classes"
              actions={
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={14} />} asChild>
                  <Link to="/my-learning/course?tab=timetable">View full timetable</Link>
                </Button>
              }
              className="mb-4"
            />
            {loading ? (
              <SkeletonTable rows={3} />
            ) : (
              <DataTable
                data={upcoming}
                columns={classColumns}
                rowKey={(row) => row.session.id}
                emptyTitle="No upcoming classes scheduled"
                emptyMessage="Your next session will appear here as soon as it is timetabled."
              />
            )}
          </section>

          {/* 3 — the activity list. */}
          <section className="rounded-2xl border border-border bg-surface p-6">
            <SectionHeader title="Recent activity" className="mb-4" />
            {loading ? (
              <SkeletonTable rows={4} />
            ) : activity.length === 0 ? (
              <EmptyState
                title="Nothing has happened yet"
                message="Grades, submissions and payments will show up here."
                size="sm"
              />
            ) : (
              <ul className="flex flex-col">
                {activity.map((row) => {
                  const Icon = row.icon
                  const body = (
                    <div className="flex items-start gap-3 py-3.5">
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent">
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-14 font-semibold">{row.title}</p>
                        <p className="truncate text-body-13 text-text-secondary">{row.detail}</p>
                      </div>
                      <span className="shrink-0 text-body-12 text-text-muted">
                        {formatRelative(row.at)}
                      </span>
                    </div>
                  )
                  return (
                    <li key={row.id} className="border-b border-border last:border-b-0">
                      {row.to ? (
                        <Link to={row.to} className="block rounded-lg transition-colors hover:bg-surface-hover">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {outstanding.length > 0 && !loading && (
            <p className="text-body-13 text-text-muted">
              <Badge tone="warning" variant="subtle" size="sm">
                {outstanding.length} outstanding
              </Badge>{' '}
              Open your course to see what is due —{' '}
              <Link to="/my-learning/course?tab=assignments" className="font-medium text-accent hover:underline">
                assignments
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </Screen>
  )
}
