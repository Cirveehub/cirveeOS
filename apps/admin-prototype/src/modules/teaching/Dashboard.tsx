/**
 * The tutor's home.
 *
 * Legacy shape, exactly: three stacked sections and nothing else — a four-tile
 * stat row, an upcoming-classes table, an activity list. The legacy portal's
 * Dashboard.tsx is literally `<QuickStats /><UpcomingClasses /><Announcements />`,
 * and the restraint is the point: a tutor has ten minutes before a class.
 *
 * What is different is underneath. Every number here is computed live from the
 * real collections — the tutor's active assignments, the sessions on those
 * cohorts, the submissions awaiting grading on those cohorts' assignments —
 * rather than read from a stats endpoint. The third card is "recent activity"
 * instead of "announcements" because Cirvee OS has no announcement entity and
 * inventing one would be worse than showing the real events a tutor cares
 * about: work arriving, registers taken, students flagged for attention.
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Layers,
  Users,
  Video,
} from 'lucide-react'

import { formatDate, formatNumber, formatRelative } from '@/lib/format'
import { useScreenLoad } from '@/lib/view-state'
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  type Column,
} from '@/ui'
import {
  TODAY,
  assignmentsCollection,
  classSessionsCollection,
  cohortsCollection,
  enrollmentsCollection,
  studentAttendanceCollection,
  submissionsCollection,
  useCollection,
  type ClassSession,
} from '@/mocks'

import { Page, TeachingCard, cohortIdsOf, courseTitle, personName, useTutorScope } from './shared'

const UPCOMING_LIMIT = 6
const ACTIVITY_LIMIT = 8

interface ActivityRow {
  id: string
  at: string
  icon: typeof FileCheck2
  tone: 'accent' | 'success' | 'warning'
  title: string
  detail: string
  to: string
}

export default function Dashboard() {
  const load = useScreenLoad('teaching.dashboard')
  const scope = useTutorScope()

  const cohorts = useCollection(cohortsCollection)
  const sessions = useCollection(classSessionsCollection)
  const enrolments = useCollection(enrollmentsCollection)
  const submissions = useCollection(submissionsCollection)
  const assignments = useCollection(assignmentsCollection)
  const attendance = useCollection(studentAttendanceCollection)

  const myCohortIds = useMemo(() => cohortIdsOf(scope), [scope])
  const myCohorts = useMemo(
    () => cohorts.filter((c) => myCohortIds.includes(c.id)),
    [cohorts, myCohortIds],
  )

  const myEnrolments = useMemo(
    () => enrolments.filter((e) => myCohortIds.includes(e.cohortId) && e.status === 'active'),
    [enrolments, myCohortIds],
  )

  const mySessions = useMemo(
    () => sessions.filter((s) => myCohortIds.includes(s.cohortId)),
    [sessions, myCohortIds],
  )

  /* An assignment reaches this tutor either because it is pinned to one of
     their cohorts or because it is course-wide on a course they teach. */
  const myAssignmentIds = useMemo(() => {
    const courseIds = new Set(myCohorts.map((c) => c.courseId))
    return new Set(
      assignments
        .filter((a) => (a.cohortId ? myCohortIds.includes(a.cohortId) : courseIds.has(a.courseId)))
        .map((a) => a.id),
    )
  }, [assignments, myCohorts, myCohortIds])

  const myEnrolmentIds = useMemo(() => new Set(myEnrolments.map((e) => e.id)), [myEnrolments])

  const pendingGrading = useMemo(
    () =>
      submissions.filter(
        (s) =>
          s.status === 'awaiting_grading' &&
          myAssignmentIds.has(s.assignmentId) &&
          myEnrolmentIds.has(s.enrollmentId),
      ),
    [submissions, myAssignmentIds, myEnrolmentIds],
  )

  const todaysClasses = useMemo(
    () => mySessions.filter((s) => s.date === TODAY && s.status !== 'cancelled'),
    [mySessions],
  )

  const upcoming = useMemo(
    () =>
      mySessions
        .filter((s) => s.date >= TODAY && s.status !== 'cancelled')
        .sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)))
        .slice(0, UPCOMING_LIMIT),
    [mySessions],
  )

  const activity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = []

    for (const s of pendingGrading) {
      const assignment = assignments.find((a) => a.id === s.assignmentId)
      rows.push({
        id: `sub-${s.id}`,
        at: s.submittedAt,
        icon: FileCheck2,
        tone: s.daysWaiting > 5 ? 'warning' : 'accent',
        title: `${personName(s.personId)} submitted work`,
        detail: `${assignment?.title ?? 'Assignment'} · waiting ${s.daysWaiting} day${s.daysWaiting === 1 ? '' : 's'}`,
        to: assignment ? `/teaching/assignments/${assignment.id}` : '/teaching/classes',
      })
    }

    for (const s of mySessions.filter((x) => x.status === 'delivered')) {
      const taken = attendance.some((a) => a.sessionId === s.id)
      if (!taken) continue
      rows.push({
        id: `ses-${s.id}`,
        at: `${s.date}T${s.endTime}:00+01:00`,
        icon: ClipboardCheck,
        tone: 'success',
        title: `Register taken for ${cohorts.find((c) => c.id === s.cohortId)?.code ?? 'class'}`,
        detail: `${s.sequence}. ${s.topic} · ${s.presentCount} of ${s.expectedCount} present`,
        to: `/teaching/classes/${s.cohortId}?tab=attendance`,
      })
    }

    for (const e of myEnrolments.filter((x) => x.attentionFlags.length > 0)) {
      rows.push({
        id: `flag-${e.id}`,
        at: e.flaggedAt ?? e.updatedAt,
        icon: AlertTriangle,
        tone: 'warning',
        title: `${personName(e.personId)} needs attention`,
        detail: e.attentionFlags.map((f) => f.replace(/_/g, ' ')).join(', '),
        to: `/teaching/classes/${e.cohortId}?tab=roster`,
      })
    }

    return rows.sort((a, b) => b.at.localeCompare(a.at)).slice(0, ACTIVITY_LIMIT)
  }, [pendingGrading, assignments, mySessions, attendance, cohorts, myEnrolments])

  const columns: Array<Column<ClassSession>> = [
    {
      key: 'course',
      header: 'Course',
      pinned: true,
      minWidth: 260,
      cell: (row) => {
        const cohort = cohorts.find((c) => c.id === row.cohortId)
        return (
          <div className="min-w-0">
            <p className="truncate text-body-14 font-semibold text-text">{courseTitle(cohort?.courseId)}</p>
            <p className="text-body-12 text-text-muted">
              {cohort?.code ?? '—'} · {row.sequence}. {row.topic}
            </p>
          </div>
        )
      },
      sortValue: (row) => cohorts.find((c) => c.id === row.cohortId)?.code ?? '',
      sortable: true,
    },
    {
      key: 'date',
      header: 'Day',
      width: 130,
      accessor: (row) => (row.date === TODAY ? 'Today' : formatDate(row.date)),
      sortValue: (row) => row.date,
      sortable: true,
    },
    { key: 'time', header: 'Time', width: 120, accessor: (row) => `${row.startTime}–${row.endTime}` },
    {
      key: 'where',
      header: 'Where',
      minWidth: 160,
      accessor: (row) => row.room ?? (row.meetingUrl ? 'Online' : '—'),
    },
    {
      key: 'expected',
      header: 'Expected',
      width: 96,
      align: 'right',
      accessor: (row) => formatNumber(row.expectedCount),
      sortValue: (row) => row.expectedCount,
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 150,
      align: 'right',
      cell: (row) =>
        row.meetingUrl ? (
          <Button size="sm" leftIcon={<Video size={14} />} asChild>
            <a href={row.meetingUrl} target="_blank" rel="noopener noreferrer">
              Join class
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" asChild>
            <Link to={`/teaching/classes/${row.cohortId}?tab=timetable`}>Open class</Link>
          </Button>
        ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title={`Welcome back, ${scope.tutorName.split(' ')[0]}`}
        description="Your cohorts, today's classes and what is waiting to be marked."
        actions={
          <Button variant="secondary" asChild rightIcon={<ArrowRight size={16} />}>
            <Link to="/teaching/classes">My classes</Link>
          </Button>
        }
      />

      {load.error && (
        <Alert
          tone="danger"
          title="This view could not load"
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" onClick={load.retry}>
              Retry
            </Button>
          }
        >
          {load.error}
        </Alert>
      )}

      {scope.borrowed && scope.tutorPersonId && (
        <Alert tone="info" title="You are not the tutor on any cohort" className="mb-6">
          This module is scoped to a tutor's own assignments. You are seeing{' '}
          {scope.tutorName}'s teaching load so the screens are not empty.
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        {/* 1 — the stat row. Four tiles, the legacy's exact count. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Assigned cohorts"
            value={formatNumber(myCohorts.length)}
            caption="Active assignments only"
            icon={Layers}
            loading={load.loading}
          />
          <StatCard
            label="Students"
            value={formatNumber(myEnrolments.length)}
            caption="Enrolled across your cohorts"
            icon={Users}
            loading={load.loading}
          />
          <StatCard
            label="Waiting to be marked"
            value={formatNumber(pendingGrading.length)}
            caption={
              pendingGrading.length === 0
                ? 'Nothing outstanding'
                : `Longest wait ${Math.max(...pendingGrading.map((s) => s.daysWaiting))} days`
            }
            icon={FileCheck2}
            variant={pendingGrading.some((s) => s.daysWaiting > 5) ? 'warning' : 'default'}
            loading={load.loading}
          />
          <StatCard
            label="Classes today"
            value={formatNumber(todaysClasses.length)}
            caption={todaysClasses[0] ? `Next at ${todaysClasses[0].startTime}` : 'No class scheduled'}
            icon={CalendarDays}
            loading={load.loading}
          />
        </div>

        {/* 2 — upcoming classes. */}
        <TeachingCard
          title="Upcoming classes"
          description="The next sessions on the cohorts you teach"
          action={
            <Button variant="link" size="sm" asChild rightIcon={<ArrowRight size={14} />}>
              <Link to="/teaching/classes">Full timetable</Link>
            </Button>
          }
        >
          <DataTable
            data={upcoming}
            columns={columns}
            rowKey={(row) => row.id}
            loading={load.loading}
            bordered={false}
            minWidth={980}
            caption="Upcoming class sessions on your cohorts"
            empty={
              <EmptyState
                icon={CalendarDays}
                title="No classes scheduled"
                message="Nothing is on the timetable for your cohorts from today onwards."
              />
            }
          />
        </TeachingCard>

        {/* 3 — recent activity, in place of the legacy's announcements feed. */}
        <TeachingCard
          title="Recent activity"
          description="Work arriving, registers taken and students the advisor has flagged"
          count={activity.length}
        >
          {activity.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nothing has happened yet"
              message="Submissions, registers and attention flags on your cohorts appear here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((row) => {
                const Icon = row.icon
                return (
                  <li key={row.id}>
                    <Link
                      to={row.to}
                      className="flex items-start gap-3 px-6 py-3.5 transition-colors hover:bg-surface-hover"
                    >
                      <span
                        className={
                          row.tone === 'success'
                            ? 'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-success-fill text-success-ink'
                            : row.tone === 'warning'
                              ? 'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-warning-fill text-warning-ink'
                              : 'mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent'
                        }
                      >
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-body-14 font-medium text-text">{row.title}</p>
                        <p className="mt-0.5 text-body-13 text-text-secondary">{row.detail}</p>
                      </div>
                      <Badge tone="neutral" variant="subtle" size="sm" className="mt-1 shrink-0">
                        {formatRelative(row.at)}
                      </Badge>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </TeachingCard>
      </div>
    </Page>
  )
}
