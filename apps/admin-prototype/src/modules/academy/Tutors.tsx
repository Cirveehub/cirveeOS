import { useMemo, useState } from 'react'
import { Presentation } from 'lucide-react'

import { formatNumber, formatPercent } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  classSessionsCollection,
  cohortsCollection,
  employeesCollection,
  studentAttendanceCollection,
  tutorAssignmentsCollection,
  useCollection,
} from '@/mocks'

import { ACADEMY_TABS, Page, ScreenError, branchName, personName, useModuleNav, useScreenState } from './shared'

interface TutorRow {
  personId: string
  name: string
  employmentType: string
  coursesQualified: number
  activeCohorts: number
  endedCohorts: number
  sessionsDelivered: number
  sessionsUpcoming: number
  attendanceRate: number | null
  branch: string
}

export default function Tutors() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const assignments = useCollection(tutorAssignmentsCollection)
  const sessions = useCollection(classSessionsCollection)
  const cohorts = useCollection(cohortsCollection)
  const employees = useCollection(employeesCollection)
  const attendance = useCollection(studentAttendanceCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const rows = useMemo<TutorRow[]>(() => {
    const byTutor = new Map<string, TutorRow>()
    const courseIds = new Map<string, Set<string>>()
    const deliveredSessionIds = new Map<string, Set<string>>()

    for (const assignment of assignments) {
      const employee = employees.find((e) => e.personId === assignment.tutorPersonId)
      const cohort = cohorts.find((c) => c.id === assignment.cohortId)
      const entry =
        byTutor.get(assignment.tutorPersonId) ??
        ({
          personId: assignment.tutorPersonId,
          name: personName(assignment.tutorPersonId),
          employmentType: employee ? employee.employmentType.replace(/_/g, ' ') : 'guest',
          coursesQualified: 0,
          activeCohorts: 0,
          endedCohorts: 0,
          sessionsDelivered: 0,
          sessionsUpcoming: 0,
          attendanceRate: null,
          branch: employee ? branchName(employee.branchId) : cohort ? branchName(cohort.branchId) : '—',
        } satisfies TutorRow)

      if (assignment.status === 'active') entry.activeCohorts += 1
      else entry.endedCohorts += 1
      entry.sessionsDelivered += assignment.sessionsDelivered
      byTutor.set(assignment.tutorPersonId, entry)

      if (cohort) {
        const set = courseIds.get(assignment.tutorPersonId) ?? new Set<string>()
        set.add(cohort.courseId)
        courseIds.set(assignment.tutorPersonId, set)
      }
    }

    for (const session of sessions) {
      const entry = byTutor.get(session.tutorPersonId)
      if (!entry) continue
      if (session.status === 'scheduled' && session.date >= TODAY) entry.sessionsUpcoming += 1
      if (session.status === 'delivered') {
        const set = deliveredSessionIds.get(session.tutorPersonId) ?? new Set<string>()
        set.add(session.id)
        deliveredSessionIds.set(session.tutorPersonId, set)
      }
    }

    for (const entry of byTutor.values()) {
      entry.coursesQualified = courseIds.get(entry.personId)?.size ?? 0
      const ids = deliveredSessionIds.get(entry.personId)
      if (ids && ids.size > 0) {
        const marks = attendance.filter((a) => ids.has(a.sessionId))
        entry.attendanceRate = marks.length === 0 ? null : (marks.filter((a) => a.state === 'present' || a.state === 'late').length / marks.length) * 100
      }
    }

    return [...byTutor.values()]
  }, [assignments, sessions, cohorts, employees, attendance])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (filters.type && row.employmentType !== filters.type) return false
        if (filters.load === 'active' && row.activeCohorts === 0) return false
        if (filters.load === 'idle' && row.activeCohorts > 0) return false
        if (!term) return true
        return row.name.toLowerCase().includes(term)
      })
      .sort((a, b) => b.activeCohorts - a.activeCohorts || a.name.localeCompare(b.name))
  }, [rows, filters, search])

  const employmentTypes = useMemo(() => [...new Set(rows.map((r) => r.employmentType))].sort(), [rows])
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<TutorRow>> = [
    { key: 'name', header: 'Tutor', pinned: true, minWidth: 190, accessor: (row) => row.name, sortValue: (row) => row.name, sortable: true },
    { key: 'type', header: 'Employment type', width: 160, accessor: (row) => <span className="capitalize">{row.employmentType}</span>, sortValue: (row) => row.employmentType, sortable: true },
    { key: 'branch', header: 'Branch', width: 140, accessor: (row) => row.branch, sortValue: (row) => row.branch, sortable: true },
    { key: 'courses', header: 'Courses qualified', align: 'right', width: 148, accessor: (row) => formatNumber(row.coursesQualified), sortValue: (row) => row.coursesQualified, sortable: true },
    {
      key: 'active',
      header: 'Active cohorts',
      align: 'right',
      width: 132,
      cell: (row) =>
        row.activeCohorts === 0 ? <Badge tone="neutral" size="sm">None</Badge> : <span className="tabular-nums">{formatNumber(row.activeCohorts)}</span>,
      sortValue: (row) => row.activeCohorts,
      sortable: true,
    },
    { key: 'ended', header: 'Ended assignments', align: 'right', width: 156, accessor: (row) => formatNumber(row.endedCohorts), sortValue: (row) => row.endedCohorts, sortable: true },
    { key: 'delivered', header: 'Sessions delivered', align: 'right', width: 156, accessor: (row) => formatNumber(row.sessionsDelivered), sortValue: (row) => row.sessionsDelivered, sortable: true },
    { key: 'upcoming', header: 'Sessions upcoming', align: 'right', width: 156, accessor: (row) => formatNumber(row.sessionsUpcoming), sortValue: (row) => row.sessionsUpcoming, sortable: true },
    {
      key: 'attendance',
      header: 'Attendance in their classes',
      align: 'right',
      width: 196,
      accessor: (row) =>
        row.attendanceRate === null ? (
          <span className="text-text-secondary">No delivered sessions</span>
        ) : (
          <span className={`tabular-nums ${row.attendanceRate < 70 ? 'text-danger-text font-semibold' : ''}`}>{formatPercent(row.attendanceRate)}</span>
        ),
      sortValue: (row) => row.attendanceRate ?? -1,
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Tutors"
        description="Everyone who has ever been assigned to a cohort, including assignments that have since ended."
        tabs={ACADEMY_TABS}
        activeTab="tutors"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by tutor name"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'type', label: 'Employment type', options: employmentTypes.map((t) => ({ value: t, label: t })) },
                {
                  key: 'load',
                  label: 'Load',
                  options: [
                    { value: 'active', label: 'Currently teaching' },
                    { value: 'idle', label: 'Not currently assigned' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={visible}
            columns={columns}
            rowKey={(row) => row.personId}
            loading={state.loading}
            density="compact"
            minWidth={1640}
            bordered={false}
            caption="Tutors with employment type, qualified courses, cohort load and delivered sessions"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No tutors match these filters"
                  message="Try another employment type, or clear the search."
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
                  icon={Presentation}
                  title="Nobody has been assigned to teach"
                  message="Tutors appear here through cohort assignments. A cohort without one cannot deliver a session."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('cohorts')}>
                      Open cohorts
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>
    </Page>
  )
}
