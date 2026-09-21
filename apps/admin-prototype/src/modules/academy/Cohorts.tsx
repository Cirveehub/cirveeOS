import { useMemo, useState } from 'react'
import { CalendarClock, EyeOff, Layers, UserPlus } from 'lucide-react'

import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  ProgressBar,
  StatusBadge,
  Tabs,
  TabPanel,
  TableToolbar,
  UNIT_META,
  BUSINESS_UNITS,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  classSessionsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  studentAttendanceCollection,
  tutorAssignmentsCollection,
  useCollection,
} from '@/mocks'
import type { ClassSession, Cohort, Enrollment, TutorAssignment } from '@/mocks'

import { ACADEMY_TABS, Page, ScreenError, branchName, personName, unitKey, useModuleNav, useScreenState } from './shared'
import {
  AttendanceModal,
  EnrolStudentModal,
  ScheduleSessionModal,
  TutorAssignmentModal,
  type TutorDialogMode,
} from './actions'

const STATUSES = ['planned', 'open', 'running', 'completed', 'cancelled'] as const
const MODES = ['on_campus', 'virtual', 'hybrid'] as const

/**
 * Fourteen columns is a catalogue, not a default view. These eight answer
 * "what is this cohort and does it need me this week"; the rest are one click
 * away and the URL carries the choice, so a curated view is still a link.
 */
const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'code', label: 'Cohort', defaultVisible: true, locked: true },
  { key: 'course', label: 'Course', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'mode', label: 'Mode', defaultVisible: false },
  { key: 'start', label: 'Start', defaultVisible: true },
  { key: 'end', label: 'End', defaultVisible: false },
  { key: 'tutors', label: 'Tutors', defaultVisible: true },
  { key: 'seats', label: 'Seats', defaultVisible: false },
  { key: 'enrolled', label: 'Enrolled', defaultVisible: true },
  { key: 'waitlist', label: 'Waitlist', defaultVisible: false },
  { key: 'attendance', label: 'Attendance', defaultVisible: true },
  { key: 'completion', label: 'Completion', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: true },
]

export default function Cohorts() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)
  const assignments = useCollection(tutorAssignmentsCollection)
  const sessions = useCollection(classSessionsCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const attendance = useCollection(studentAttendanceCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [tab, setTab] = useState('students')
  const [enrolling, setEnrolling] = useState(false)
  const [tutorDialog, setTutorDialog] = useState<{ mode: TutorDialogMode; assignment: TutorAssignment | null } | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [register, setRegister] = useState<ClassSession | null>(null)
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const courseTitle = (courseId: string) => courses.find((c) => c.id === courseId)?.title ?? courseId

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return cohorts
      .filter((cohort) => {
        if (filters.status && cohort.status !== filters.status) return false
        if (filters.mode && cohort.mode !== filters.mode) return false
        if (filters.unit && unitKey(cohort.unitId) !== filters.unit) return false
        if (!term) return true
        return cohort.code.toLowerCase().includes(term) || courseTitle(cohort.courseId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  }, [cohorts, courses, filters, search])

  const open = openId ? cohorts.find((c) => c.id === openId) ?? null : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const openAssignments = useMemo(
    () =>
      open
        ? assignments
            .filter((a) => a.cohortId === open.id)
            .sort((a, b) => b.startDate.localeCompare(a.startDate))
        : [],
    [open, assignments],
  )
  const openSessions = useMemo(
    () => (open ? sessions.filter((s) => s.cohortId === open.id).sort((a, b) => a.sequence - b.sequence) : []),
    [open, sessions],
  )
  const openEnrollments = useMemo(() => (open ? enrollments.filter((e) => e.cohortId === open.id) : []), [open, enrollments])

  const attendanceFor = (enrollmentId: string) => {
    const mine = attendance.filter((a) => a.enrollmentId === enrollmentId)
    if (mine.length === 0) return null
    return (mine.filter((a) => a.state === 'present' || a.state === 'late').length / mine.length) * 100
  }

  const activeTutors = (cohortId: string) =>
    assignments.filter((a) => a.cohortId === cohortId && a.status === 'active').map((a) => personName(a.tutorPersonId))

  const allColumns: Record<string, Column<Cohort>> = {
    code: { key: 'code', header: 'Cohort', pinned: true, width: 116, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.code}</span>, sortValue: (row) => row.code, sortable: true },
    course: { key: 'course', header: 'Course', minWidth: 220, accessor: (row) => courseTitle(row.courseId), sortValue: (row) => courseTitle(row.courseId), sortable: true },
    branch: { key: 'branch', header: 'Branch', width: 124, accessor: (row) => branchName(row.branchId), sortValue: (row) => branchName(row.branchId), sortable: true },
    mode: { key: 'mode', header: 'Mode', width: 116, accessor: (row) => <span className="capitalize">{row.mode.replace(/_/g, ' ')}</span>, sortValue: (row) => row.mode, sortable: true },
    start: { key: 'start', header: 'Start', width: 116, accessor: (row) => formatDate(row.startDate), sortValue: (row) => row.startDate, sortable: true },
    end: { key: 'end', header: 'End', width: 116, accessor: (row) => formatDate(row.endDate), sortValue: (row) => row.endDate, sortable: true },
    tutors: {
      key: 'tutors',
      header: 'Tutors',
      minWidth: 180,
      cell: (row) => {
        const names = activeTutors(row.id)
        return names.length === 0 ? <Badge tone="warning" size="sm">Not assigned</Badge> : <span>{names.join(', ')}</span>
      },
      sortValue: (row) => activeTutors(row.id).join(', '),
      sortable: true,
    },
    seats: { key: 'seats', header: 'Seats', align: 'right', width: 80, accessor: (row) => formatNumber(row.seats), sortValue: (row) => row.seats, sortable: true },
    enrolled: {
      key: 'enrolled',
      header: 'Enrolled',
      width: 148,
      cell: (row) => (
        <ProgressBar
          value={row.enrolledCount}
          max={row.seats}
          size="sm"
          tone={row.enrolledCount >= row.seats ? 'success' : 'accent'}
          valueLabel={`${formatNumber(row.enrolledCount)}/${formatNumber(row.seats)}`}
          aria-label={`${row.code} enrolment`}
        />
      ),
      sortValue: (row) => row.enrolledCount,
      sortable: true,
    },
    waitlist: { key: 'waitlist', header: 'Waitlist', align: 'right', width: 88, accessor: (row) => formatNumber(row.waitlistCount), sortValue: (row) => row.waitlistCount, sortable: true },
    attendance: {
      key: 'attendance',
      header: 'Attendance',
      align: 'right',
      width: 116,
      accessor: (row) => (
        <span className={`tabular-nums ${row.attendanceRate < 70 ? 'text-danger-text font-semibold' : ''}`}>{formatPercent(row.attendanceRate)}</span>
      ),
      sortValue: (row) => row.attendanceRate,
      sortable: true,
    },
    completion: { key: 'completion', header: 'Completion', align: 'right', width: 116, accessor: (row) => <span className="tabular-nums">{formatPercent(row.completionRate)}</span>, sortValue: (row) => row.completionRate, sortable: true },
    status: { key: 'status', header: 'Status', width: 124, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    unit: {
      key: 'unit',
      header: 'Unit',
      width: 132,
      cell: (row) => {
        const key = unitKey(row.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : null
      },
      sortValue: (row) => unitKey(row.unitId) ?? '',
      sortable: true,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  const assignmentColumns: Array<Column<TutorAssignment>> = [
    { key: 'tutor', header: 'Tutor', minWidth: 170, accessor: (row) => personName(row.tutorPersonId), sortValue: (row) => personName(row.tutorPersonId) },
    { key: 'role', header: 'Role', width: 110, accessor: (row) => <span className="capitalize">{row.role}</span>, sortValue: (row) => row.role },
    { key: 'from', header: 'From', width: 116, accessor: (row) => formatDate(row.startDate), sortValue: (row) => row.startDate, sortable: true },
    {
      key: 'to',
      header: 'To',
      width: 128,
      accessor: (row) => (row.endDate ? formatDate(row.endDate) : <span className="text-text-secondary">Still assigned</span>),
      sortValue: (row) => row.endDate ?? '9999',
      sortable: true,
    },
    { key: 'delivered', header: 'Sessions delivered', align: 'right', width: 148, accessor: (row) => formatNumber(row.sessionsDelivered), sortValue: (row) => row.sessionsDelivered, sortable: true },
    { key: 'status', header: 'Status', width: 116, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
    { key: 'reason', header: 'End reason', minWidth: 200, accessor: (row) => row.endReason ?? <span className="text-text-secondary">—</span>, sortValue: (row) => row.endReason ?? '' },
    {
      key: 'actions',
      header: 'Actions',
      width: 168,
      cell: (row) =>
        row.status === 'active' ? (
          <div className="flex gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setTutorDialog({ mode: 'replace', assignment: row })}>
              Replace
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setTutorDialog({ mode: 'end', assignment: row })}>
              End
            </Button>
          </div>
        ) : (
          <span className="text-body-12 text-text-secondary">Closed</span>
        ),
    },
  ]

  const sessionColumns: Array<Column<ClassSession>> = [
    { key: 'seq', header: '#', width: 56, align: 'right', accessor: (row) => row.sequence, sortValue: (row) => row.sequence, sortable: true },
    { key: 'date', header: 'Date', width: 116, accessor: (row) => formatDate(row.date), sortValue: (row) => row.date, sortable: true },
    { key: 'time', header: 'Time', width: 128, accessor: (row) => `${row.startTime}–${row.endTime}` },
    { key: 'topic', header: 'Topic', minWidth: 220, accessor: (row) => row.topic, sortValue: (row) => row.topic },
    { key: 'tutor', header: 'Tutor', minWidth: 160, accessor: (row) => personName(row.tutorPersonId), sortValue: (row) => personName(row.tutorPersonId) },
    { key: 'room', header: 'Room or link', minWidth: 160, accessor: (row) => row.room ?? (row.meetingUrl ? 'Virtual' : '—') },
    { key: 'status', header: 'Status', width: 128, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
    {
      key: 'present',
      header: 'Present',
      align: 'right',
      width: 96,
      accessor: (row) =>
        row.status === 'delivered' ? (
          <span className="tabular-nums">{`${formatNumber(row.presentCount)}/${formatNumber(row.expectedCount)}`}</span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (row) => row.presentCount,
      sortable: true,
    },
    {
      key: 'register',
      header: 'Register',
      width: 132,
      cell: (row) =>
        row.status === 'cancelled' ? (
          <span className="text-body-12 text-text-secondary">Cancelled</span>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setRegister(row)}>
            {row.status === 'delivered' ? 'Amend' : 'Take register'}
          </Button>
        ),
    },
  ]

  const studentColumns: Array<Column<Enrollment>> = [
    { key: 'name', header: 'Student', minWidth: 190, accessor: (row) => personName(row.personId), sortValue: (row) => personName(row.personId), sortable: true },
    { key: 'enrolled', header: 'Enrolled', width: 124, accessor: (row) => formatDate(row.enrolledAt), sortValue: (row) => row.enrolledAt, sortable: true },
    {
      key: 'attendance',
      header: 'Attendance',
      align: 'right',
      width: 118,
      accessor: (row) => {
        const rate = attendanceFor(row.id)
        return rate === null ? <span className="text-text-secondary">No sessions</span> : <span className="tabular-nums">{formatPercent(rate)}</span>
      },
      sortValue: (row) => attendanceFor(row.id) ?? -1,
      sortable: true,
    },
    {
      key: 'flags',
      header: 'Flags',
      minWidth: 220,
      cell: (row) =>
        row.attentionFlags.length === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {row.attentionFlags.map((flag) => (
              <Badge key={flag} tone="warning" size="sm">
                {flag.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        ),
      sortValue: (row) => row.attentionFlags.length,
      sortable: true,
    },
    { key: 'status', header: 'Status', width: 120, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status },
  ]

  return (
    <Page>
      <PageHeader
        title="Cohorts"
        description="Every delivery instance, its seats, its attendance and the tutors who taught it."
        tabs={ACADEMY_TABS}
        activeTab="cohorts"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar
            actions={
              <ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />
            }
          >
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by cohort code or course"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s })) },
                { key: 'mode', label: 'Mode', options: MODES.map((m) => ({ value: m, label: m.replace(/_/g, ' ') })) },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => {
              setOpenId(row.id)
              setTab('students')
            }}
            activeRowKey={open?.id}
            density="compact"
            minWidth={Math.max(960, visible.length * 150)}
            bordered={false}
            caption="Cohorts with course, branch, mode, dates, tutors, seats, attendance and status"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No cohorts match these filters"
                  message="Try another status, mode or unit, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Layers}
                  title="No cohorts yet"
                  message="A course is a catalogue entry; a cohort is the thing students actually join. Nothing can be enrolled or timetabled until one exists."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('courses')}>
                      Open the course catalogue
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="xl"
        title={open ? `${open.code} — ${courseTitle(open.courseId)}` : 'Cohort'}
        description={open ? `${formatDate(open.startDate)} to ${formatDate(open.endDate)} · ${branchName(open.branchId)} · ${open.scheduleSummary}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            {notice && (
              <Alert tone="success" title={notice.title} onDismiss={() => setNotice(null)}>
                {notice.detail}
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button size="sm" leftIcon={<UserPlus size={16} />} onClick={() => setEnrolling(true)}>
                Enrol a student
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<UserPlus size={16} />}
                onClick={() => setTutorDialog({ mode: 'assign', assignment: null })}
              >
                Assign a tutor
              </Button>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<CalendarClock size={16} />}
                onClick={() => setScheduling(true)}
              >
                Schedule a class
              </Button>
            </div>

            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Unit">
                {(() => {
                  const key = unitKey(open.unitId)
                  return key ? <UnitTag unit={key} /> : '—'
                })()}
              </KeyValue>
              <KeyValue label="Seats" hint={`${formatNumber(open.waitlistCount)} on the waitlist`}>
                {`${formatNumber(open.enrolledCount)} of ${formatNumber(open.seats)} taken`}
              </KeyValue>
              <KeyValue label="Attendance">{formatPercent(open.attendanceRate)}</KeyValue>
            </KeyValueList>

            <ProgressBar
              value={open.enrolledCount}
              max={open.seats}
              tone={open.enrolledCount >= open.seats ? 'success' : 'accent'}
              label="Seats taken"
              valueLabel={`${formatNumber(open.enrolledCount)} of ${formatNumber(open.seats)}`}
            />

            <Tabs
              tabs={[
                { id: 'students', label: 'Students', badge: openEnrollments.length },
                { id: 'schedule', label: 'Schedule', badge: openSessions.length },
                { id: 'tutors', label: 'Tutor assignments', badge: openAssignments.length },
              ]}
              value={tab}
              onChange={setTab}
              aria-label="Cohort sections"
            />

            <TabPanel id="cohort-students" tabId="students" active={tab === 'students'}>
              <Alert tone="info" icon={EyeOff} title="This is the list a tutor sees" className="mb-4">
                No balance, no invoice, no payment status. Tutors cannot see a student's financial standing, so a student who owes
                money is never treated differently in class. Finance sees the same people under Student accounts.
              </Alert>
              <DataTable
                data={openEnrollments}
                columns={studentColumns}
                rowKey={(row) => row.id}
                density="compact"
                caption={`Students enrolled on cohort ${open.code}`}
                empty={
                  <EmptyState
                    icon={UserPlus}
                    size="sm"
                    title="Nobody is enrolled on this cohort yet"
                    message="Enrolments arrive from a confirmed admission. Until one does, the cohort will run to an empty room."
                    action={
                      <Button size="sm" leftIcon={<UserPlus size={16} />} onClick={() => setEnrolling(true)}>
                        Enrol a student
                      </Button>
                    }
                  />
                }
              />
            </TabPanel>

            <TabPanel id="cohort-schedule" tabId="schedule" active={tab === 'schedule'}>
              <DataTable
                data={openSessions}
                columns={sessionColumns}
                rowKey={(row) => row.id}
                density="compact"
                minWidth={960}
                caption={`Class schedule for cohort ${open.code}`}
                empty={
                  <EmptyState
                    icon={CalendarClock}
                    size="sm"
                    title="No sessions scheduled"
                    message="A cohort with no timetable cannot record attendance and no tutor can be credited for delivery."
                    action={
                      <Button size="sm" leftIcon={<CalendarClock size={16} />} onClick={() => setScheduling(true)}>
                        Schedule a class
                      </Button>
                    }
                  />
                }
              />
            </TabPanel>

            <TabPanel id="cohort-tutors" tabId="tutors" active={tab === 'tutors'}>
              <Alert tone="info" title="A tutor change ends one assignment and starts another" className="mb-4">
                Nobody is swapped in place. The outgoing tutor keeps the sessions they delivered, with the date their assignment
                ended and why — which is what makes historical delivery credit and pay reconcilable months later.
              </Alert>
              <DataTable
                data={openAssignments}
                columns={assignmentColumns}
                rowKey={(row) => row.id}
                density="compact"
                minWidth={1040}
                caption={`Tutor assignment history for cohort ${open.code}`}
                empty={
                  <EmptyState
                    icon={UserPlus}
                    size="sm"
                    title="No tutor has ever been assigned"
                    message="Without an assignment there is nobody responsible for delivery, and no record to credit sessions against."
                    action={
                      <Button
                        size="sm"
                        leftIcon={<UserPlus size={16} />}
                        onClick={() => setTutorDialog({ mode: 'assign', assignment: null })}
                      >
                        Assign a tutor
                      </Button>
                    }
                  />
                }
              />
            </TabPanel>
          </div>
        )}
      </Drawer>

      {open && (
        <>
          <EnrolStudentModal
            cohort={open}
            open={enrolling}
            onClose={() => setEnrolling(false)}
            onEnrolled={(name) => {
              setTab('students')
              setNotice({
                title: `${name} enrolled on ${open.code}`,
                detail:
                  'The enrolment is live in Cirvee Learn straight away — progress, grading and certificate eligibility all read this record.',
              })
            }}
          />

          <TutorAssignmentModal
            cohort={open}
            mode={tutorDialog?.mode ?? 'assign'}
            assignment={tutorDialog?.assignment ?? null}
            open={tutorDialog !== null}
            onClose={() => setTutorDialog(null)}
            onDone={(title, detail) => {
              setTab('tutors')
              setNotice({ title, detail })
            }}
          />

          <ScheduleSessionModal
            cohort={open}
            open={scheduling}
            onClose={() => setScheduling(false)}
            onScheduled={(session) => {
              setTab('schedule')
              setNotice({
                title: `Session ${session.sequence} scheduled`,
                detail: `${session.topic} on ${formatDate(session.date)}, expecting ${formatNumber(session.expectedCount)} students.`,
              })
            }}
          />
        </>
      )}

      {register && (
        <AttendanceModal
          session={register}
          open={register !== null}
          onClose={() => setRegister(null)}
          onRecorded={(result) =>
            setNotice({
              title: 'Register saved',
              detail:
                result.overridden > 0
                  ? `${result.created} recorded, ${result.overridden} overridden. Each override carries its reason and an audit entry naming both states.`
                  : `${result.created} recorded. The cohort's attendance rate and the tutor's delivered-session count both moved.`,
            })
          }
        />
      )}
    </Page>
  )
}
