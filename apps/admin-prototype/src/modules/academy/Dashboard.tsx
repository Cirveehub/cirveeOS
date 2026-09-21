import { useMemo } from 'react'
import { AlertTriangle, CalendarDays, GraduationCap, Layers, Presentation, TicketPercent, UserCheck, Users } from 'lucide-react'

import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  ProgressBar,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  TabPanel,
  Tabs,
  UnitTag,
  type Column,
} from '@/ui'
import {
  TODAY,
  addDays,
  classSessionsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  needsAttentionStudents,
  studentAttendanceCollection,
  studentAttendanceRate,
  tutorAssignmentsCollection,
  useCollection,
  type Cohort,
} from '@/mocks'

import { ACADEMY_TABS, Caption, Page, ScreenError, personName, unitKey, useModuleNav, useScreenState } from './shared'

interface TutorLoad {
  personId: string
  name: string
  activeCohorts: number
  sessionsDelivered: number
  sessionsUpcoming: number
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'enrolment', label: 'Enrolment' },
  { id: 'delivery', label: 'Delivery' },
  { id: 'tutors', label: 'Tutors' },
]

export default function AcademyDashboard() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const sessions = useCollection(classSessionsCollection)
  const assignments = useCollection(tutorAssignmentsCollection)
  const attendance = useCollection(studentAttendanceCollection)

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? id

  const activeCohorts = useMemo(
    () => cohorts.filter((c) => c.status === 'running' || c.status === 'open'),
    [cohorts],
  )

  const attendanceBand = useMemo(() => {
    const rate = studentAttendanceRate(7)
    const flagged = needsAttentionStudents()
    const struggling = activeCohorts.filter((c) => c.attendanceRate < 70).sort((a, b) => a.attendanceRate - b.attendanceRate)
    return {
      rate,
      flagged,
      struggling,
      answer:
        struggling.length === 0
          ? 'No running cohort is under 70 per cent. Nothing here needs a conversation this week.'
          : `${struggling.length} running ${struggling.length === 1 ? 'cohort is' : 'cohorts are'} under 70 per cent attendance. That is the week's conversation list.`,
    }
  }, [activeCohorts, attendance])

  const enrolmentBand = useMemo(() => {
    const byCourse = new Map<string, number>()
    for (const enrollment of enrollments) {
      if (enrollment.status !== 'active') continue
      byCourse.set(enrollment.courseId, (byCourse.get(enrollment.courseId) ?? 0) + 1)
    }
    const seatsUnsold = cohorts
      .filter((c) => c.status === 'planned' || c.status === 'open' || c.status === 'running')
      .reduce((acc, c) => acc + Math.max(0, c.seats - c.enrolledCount), 0)
    const waitlisted = cohorts.reduce((acc, c) => acc + c.waitlistCount, 0)

    return {
      enrolledStudents: enrollments.filter((e) => e.status === 'active').length,
      seatsUnsold,
      waitlisted,
      rows: [...byCourse.entries()]
        .map(([courseId, count]) => ({ courseId, title: courseTitle(courseId), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
      answer:
        seatsUnsold > 0
          ? `${formatNumber(seatsUnsold)} seats are unsold across planned, open and running cohorts, with ${formatNumber(waitlisted)} people waitlisted elsewhere.`
          : 'Every planned, open and running cohort is full.',
    }
  }, [cohorts, enrollments, courses])

  const deliveryBand = useMemo(() => {
    const weekEnd = addDays(TODAY, 7)
    const thisWeek = sessions.filter((s) => s.date >= TODAY && s.date <= weekEnd)
    const startingSoon = cohorts.filter((c) => c.startDate >= TODAY && c.startDate <= addDays(TODAY, 30))
    const untimetabled = activeCohorts.filter((c) => !sessions.some((s) => s.cohortId === c.id))
    return {
      thisWeek,
      startingSoon,
      untimetabled,
      answer:
        untimetabled.length > 0
          ? `${untimetabled.length} running ${untimetabled.length === 1 ? 'cohort has' : 'cohorts have'} no timetable at all, so no attendance can be recorded against them.`
          : `${formatNumber(thisWeek.length)} classes in the next seven days, and ${startingSoon.length} cohorts start within thirty days.`,
    }
  }, [sessions, cohorts, activeCohorts])

  const tutorBand = useMemo(() => {
    const loads = new Map<string, TutorLoad>()
    for (const assignment of assignments) {
      if (assignment.status !== 'active') continue
      const entry = loads.get(assignment.tutorPersonId) ?? {
        personId: assignment.tutorPersonId,
        name: personName(assignment.tutorPersonId),
        activeCohorts: 0,
        sessionsDelivered: 0,
        sessionsUpcoming: 0,
      }
      entry.activeCohorts += 1
      entry.sessionsDelivered += assignment.sessionsDelivered
      loads.set(assignment.tutorPersonId, entry)
    }
    for (const session of sessions) {
      const entry = loads.get(session.tutorPersonId)
      if (entry && session.status === 'scheduled' && session.date >= TODAY) entry.sessionsUpcoming += 1
    }
    const rows = [...loads.values()].sort((a, b) => b.activeCohorts - a.activeCohorts)
    const unstaffed = activeCohorts.filter(
      (c) => !assignments.some((a) => a.cohortId === c.id && a.status === 'active'),
    )
    return {
      rows,
      unstaffed,
      assigned: rows.length,
      overloaded: rows.filter((r) => r.activeCohorts >= 3).length,
      answer:
        unstaffed.length > 0
          ? `${unstaffed.length} running ${unstaffed.length === 1 ? 'cohort has' : 'cohorts have'} nobody assigned — nobody responsible for delivery and nobody to credit sessions to.`
          : `${rows.length} tutors hold an active assignment; ${rows.filter((r) => r.activeCohorts >= 3).length} are on three cohorts or more.`,
    }
  }, [assignments, sessions, activeCohorts])

  const maxEnrolment = Math.max(1, ...enrolmentBand.rows.map((c) => c.count))

  const weeks = useMemo(() => {
    const start = new Date(`${TODAY}T00:00:00Z`)
    const offset = (start.getUTCDay() + 6) % 7
    start.setUTCDate(start.getUTCDate() - offset)
    return Array.from({ length: 8 }, (_, i) => {
      const from = new Date(start)
      from.setUTCDate(from.getUTCDate() + i * 7)
      const to = new Date(from)
      to.setUTCDate(to.getUTCDate() + 6)
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
    })
  }, [])

  const calendarCohorts = activeCohorts.slice(0, 10)

  const tutorColumns: Array<Column<TutorLoad>> = [
    { key: 'name', header: 'Tutor', minWidth: 180, accessor: (row) => row.name, sortValue: (row) => row.name, sortable: true },
    { key: 'cohorts', header: 'Active cohorts', align: 'right', accessor: (row) => formatNumber(row.activeCohorts), sortValue: (row) => row.activeCohorts, sortable: true },
    { key: 'delivered', header: 'Sessions delivered', align: 'right', accessor: (row) => formatNumber(row.sessionsDelivered), sortValue: (row) => row.sessionsDelivered, sortable: true },
    { key: 'upcoming', header: 'Sessions upcoming', align: 'right', accessor: (row) => formatNumber(row.sessionsUpcoming), sortValue: (row) => row.sessionsUpcoming, sortable: true },
    {
      key: 'load',
      header: 'Load',
      width: 132,
      cell: (row) =>
        row.activeCohorts >= 3 ? (
          <Badge tone="warning">Heavily loaded</Badge>
        ) : row.activeCohorts === 0 ? (
          <Badge tone="neutral">Unassigned</Badge>
        ) : (
          <Badge tone="success">Balanced</Badge>
        ),
      sortValue: (row) => row.activeCohorts,
      sortable: true,
    },
  ]

  const attendanceChart = (rows: Cohort[]) => (
    <CardBody className="space-y-4">
      {state.loading ? (
        <SkeletonTable rows={6} columns={2} showHeader={false} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          size="sm"
          bordered
          title="No cohorts are running"
          message="Attendance is measured against delivered sessions. With nothing running there is nothing to measure."
        />
      ) : (
        rows.map((cohort) => (
          <ProgressBar
            key={cohort.id}
            value={cohort.attendanceRate}
            max={100}
            tone={cohort.attendanceRate < 70 ? 'danger' : cohort.attendanceRate < 85 ? 'warning' : 'success'}
            label={`${cohort.code} · ${courseTitle(cohort.courseId)}`}
            valueLabel={formatPercent(cohort.attendanceRate)}
          />
        ))
      )}
    </CardBody>
  )

  return (
    <Page>
      <PageHeader
        title="Academy operations"
        description="Delivery health across every cohort: who is teaching, who is turning up, and which seats are still unsold."
        tabs={ACADEMY_TABS}
        activeTab="overview"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Tabs
        tabs={SECTIONS}
        value={tab}
        onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
        variant="pill"
        size="sm"
        aria-label="Dashboard sections"
        className="mb-6 w-fit"
      />

      {/* ---- Overview: one headline per theme, plus the week's conversation list ---- */}
      <TabPanel id="academy-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {state.loading ? (
            Array.from({ length: 5 }, (_, i) => <SkeletonCard key={i} variant="stat" />)
          ) : (
            <>
              <StatCard
                label="Active cohorts"
                value={formatNumber(activeCohorts.length)}
                icon={Layers}
                caption="Open or running"
                onClick={() => navigate('cohorts')}
              />
              <StatCard
                label="Enrolled students"
                value={formatNumber(enrolmentBand.enrolledStudents)}
                icon={GraduationCap}
                caption="Active enrolments"
                onClick={() => navigate('students')}
              />
              <StatCard
                label="Student attendance, 7 days"
                value={formatPercent(attendanceBand.rate)}
                icon={UserCheck}
                variant={attendanceBand.rate >= 80 ? 'success' : attendanceBand.rate >= 70 ? 'warning' : 'danger'}
                caption="Delivered sessions only"
                onClick={() => navigate('attendance')}
              />
              <StatCard
                label="Classes this week"
                value={formatNumber(deliveryBand.thisWeek.length)}
                icon={CalendarDays}
                caption="Next seven days"
                onClick={() => navigate('classes')}
              />
              <StatCard
                label="Attention-flagged students"
                value={formatNumber(attendanceBand.flagged.length)}
                icon={AlertTriangle}
                variant={attendanceBand.flagged.length > 0 ? 'warning' : 'success'}
                caption="Advisory only — never a financial consequence"
                onClick={() => navigate('students')}
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader
            title="Cohorts under 70 per cent attendance"
            description="The one rail worth seeing whatever you opened this page for. Everything else is a tab away."
          />
          <CardBody className="space-y-4">
            {state.loading ? (
              <SkeletonTable rows={4} columns={2} showHeader={false} />
            ) : attendanceBand.struggling.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                size="sm"
                bordered
                title="Nothing is under 70 per cent"
                message="Every running cohort is turning up. The attendance tab has the full distribution."
              />
            ) : (
              attendanceBand.struggling.slice(0, 6).map((cohort) => (
                <ProgressBar
                  key={cohort.id}
                  value={cohort.attendanceRate}
                  max={100}
                  tone="danger"
                  label={`${cohort.code} · ${courseTitle(cohort.courseId)}`}
                  valueLabel={formatPercent(cohort.attendanceRate)}
                />
              ))
            )}
          </CardBody>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Answer label="Attendance" text={attendanceBand.answer} />
          <Answer label="Enrolment" text={enrolmentBand.answer} />
          <Answer label="Delivery" text={deliveryBand.answer} />
          <Answer label="Tutors" text={tutorBand.answer} />
        </div>
      </TabPanel>

      {/* ---- Attendance ------------------------------------------------- */}
      <TabPanel id="academy-attendance" tabId="attendance" active={tab === 'attendance'} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Student attendance, 7 days"
            value={formatPercent(attendanceBand.rate)}
            icon={UserCheck}
            variant={attendanceBand.rate >= 80 ? 'success' : attendanceBand.rate >= 70 ? 'warning' : 'danger'}
            caption="Delivered sessions only"
            onClick={() => navigate('attendance')}
          />
          <StatCard
            label="Cohorts under 70 per cent"
            value={formatNumber(attendanceBand.struggling.length)}
            icon={AlertTriangle}
            variant={attendanceBand.struggling.length > 0 ? 'danger' : 'success'}
            caption="Running or open"
          />
          <StatCard
            label="Attention-flagged students"
            value={formatNumber(attendanceBand.flagged.length)}
            icon={AlertTriangle}
            variant={attendanceBand.flagged.length > 0 ? 'warning' : 'success'}
            caption="Advisory only — never a financial consequence"
            onClick={() => navigate('students')}
          />
        </div>

        <Card>
          <CardHeader
            title="Attendance by cohort"
            description="Anything under 70 per cent is drawn in red and needs a conversation this week."
          />
          {attendanceChart(activeCohorts.slice(0, 12))}
        </Card>
      </TabPanel>

      {/* ---- Enrolment -------------------------------------------------- */}
      <TabPanel id="academy-enrolment" tabId="enrolment" active={tab === 'enrolment'} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Enrolled students"
            value={formatNumber(enrolmentBand.enrolledStudents)}
            icon={GraduationCap}
            caption="Active enrolments"
            onClick={() => navigate('students')}
          />
          <StatCard
            label="Seats unsold"
            value={formatNumber(enrolmentBand.seatsUnsold)}
            icon={TicketPercent}
            variant={enrolmentBand.seatsUnsold > 50 ? 'warning' : 'default'}
            caption="Across planned, open and running cohorts"
            onClick={() => navigate('cohorts')}
          />
          <StatCard
            label="On a waitlist"
            value={formatNumber(enrolmentBand.waitlisted)}
            icon={Users}
            caption="Waiting on a seat somewhere"
            onClick={() => navigate('cohorts')}
          />
        </div>

        <Card>
          <CardHeader
            title="Enrolment by course"
            description="Active enrolments only, across every cohort of the course."
          />
          <CardBody className="space-y-4">
            {state.loading ? (
              <SkeletonTable rows={6} columns={2} showHeader={false} />
            ) : enrolmentBand.rows.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                size="sm"
                bordered
                title="Nobody is enrolled"
                message="Enrolments are created when an admission is confirmed, or directly from a cohort profile with a stated reason."
              />
            ) : (
              enrolmentBand.rows.map((course) => (
                <ProgressBar
                  key={course.courseId}
                  value={course.count}
                  max={maxEnrolment}
                  tone="accent"
                  label={course.title}
                  valueLabel={formatNumber(course.count)}
                />
              ))
            )}
          </CardBody>
        </Card>
      </TabPanel>

      {/* ---- Delivery --------------------------------------------------- */}
      <TabPanel id="academy-delivery" tabId="delivery" active={tab === 'delivery'} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Classes this week"
            value={formatNumber(deliveryBand.thisWeek.length)}
            icon={CalendarDays}
            caption="Next seven days"
            onClick={() => navigate('classes')}
          />
          <StatCard
            label="Cohorts starting in 30 days"
            value={formatNumber(deliveryBand.startingSoon.length)}
            icon={CalendarDays}
            caption="Rooms, tutors and materials needed"
            onClick={() => navigate('cohorts')}
          />
          <StatCard
            label="Running with no timetable"
            value={formatNumber(deliveryBand.untimetabled.length)}
            icon={AlertTriangle}
            variant={deliveryBand.untimetabled.length > 0 ? 'danger' : 'success'}
            caption="No sessions means no attendance and no delivery credit"
            onClick={() => navigate('cohorts')}
          />
        </div>

        <Card>
          <CardHeader
            title="Next eight weeks"
            description="Which cohorts are in delivery, week by week. A cohort ends where its bar ends."
          />
          <CardBody>
            {calendarCohorts.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                size="sm"
                bordered
                title="Nothing scheduled"
                message="Cohorts appear on this strip once they have a start and end date."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-separate border-spacing-y-1.5">
                  <caption className="sr-only">Cohorts in delivery over the next eight weeks</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="w-56 pb-2 text-left text-label-11 text-text-muted">
                        Cohort
                      </th>
                      {weeks.map((week) => (
                        <th key={week.from} scope="col" className="pb-2 text-center text-label-11 text-text-muted">
                          {formatDate(week.from).slice(0, 6)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {calendarCohorts.map((cohort) => {
                      const key = unitKey(cohort.unitId)
                      return (
                        <tr key={cohort.id}>
                          <th scope="row" className="py-1 pr-4 text-left">
                            <div className="flex items-center gap-2">
                              <span className="text-body-13 font-semibold text-text">{cohort.code}</span>
                              {key && <UnitTag unit={key} size="sm" />}
                            </div>
                          </th>
                          {weeks.map((week) => {
                            const running = cohort.startDate <= week.to && cohort.endDate >= week.from
                            return (
                              <td key={week.from} className="px-1 py-1">
                                <div
                                  className={`h-2.5 rounded-full ${running ? 'bg-accent' : 'bg-surface-sunken'}`}
                                  aria-label={
                                    running ? `${cohort.code} runs the week of ${formatDate(week.from)}` : undefined
                                  }
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      {/* ---- Tutors ----------------------------------------------------- */}
      <TabPanel id="academy-tutors" tabId="tutors" active={tab === 'tutors'} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Tutors assigned"
            value={formatNumber(tutorBand.assigned)}
            icon={Presentation}
            caption="Holding an active assignment"
            onClick={() => navigate('tutors')}
          />
          <StatCard
            label="On three cohorts or more"
            value={formatNumber(tutorBand.overloaded)}
            icon={AlertTriangle}
            variant={tutorBand.overloaded > 0 ? 'warning' : 'default'}
            caption="Heavily loaded"
            onClick={() => navigate('tutors')}
          />
          <StatCard
            label="Cohorts with no tutor"
            value={formatNumber(tutorBand.unstaffed.length)}
            icon={AlertTriangle}
            variant={tutorBand.unstaffed.length > 0 ? 'danger' : 'success'}
            caption="Running or open, nobody assigned"
            onClick={() => navigate('cohorts')}
          />
        </div>

        <Card>
          <CardHeader
            title="Tutor load"
            description="Active assignments and delivered sessions. A tutor on three or more cohorts is flagged. Replacing one ends their assignment rather than reassigning it, so these counts stay with the person who earned them."
          />
          <CardBody padding="none">
            <DataTable
              data={tutorBand.rows}
              columns={tutorColumns}
              rowKey={(row) => row.personId}
              loading={state.loading}
              density="compact"
              bordered={false}
              defaultSort={{ key: 'cohorts', direction: 'desc' }}
              caption="Tutors with their active cohorts and session counts"
              empty={
                <EmptyState
                  icon={Users}
                  title="No tutor is assigned to anything"
                  message="A cohort without a tutor assignment cannot deliver a session, and nobody will be credited for the teaching."
                />
              }
            />
          </CardBody>
        </Card>
      </TabPanel>
    </Page>
  )
}

function Answer({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-label-11 text-text-label">{label}</div>
      <Caption>{text}</Caption>
    </div>
  )
}
