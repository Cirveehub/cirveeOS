import { useMemo, useState } from 'react'
import { CalendarClock, Plus } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  PageHeader,
  Pagination,
  StatusBadge,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { TODAY, addDays, classSessionsCollection, cohortsCollection, coursesCollection, useCollection } from '@/mocks'
import type { ClassSession } from '@/mocks'

import { ACADEMY_TABS, Page, ScreenError, personName, useModuleNav, useScreenState } from './shared'
import { AttendanceModal, ScheduleSessionModal } from './actions'

const STATUSES = ['scheduled', 'in_progress', 'delivered', 'cancelled', 'rescheduled'] as const
const PAGE_SIZE = 30

export default function Classes() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const sessions = useCollection(classSessionsCollection)
  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [scheduling, setScheduling] = useState(false)
  const [register, setRegister] = useState<ClassSession | null>(null)
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null)

  const cohortOf = (cohortId: string) => cohorts.find((c) => c.id === cohortId)
  const cohortCode = (cohortId: string) => cohortOf(cohortId)?.code ?? cohortId
  const courseTitle = (cohortId: string) => {
    const cohort = cohortOf(cohortId)
    return cohort ? courses.find((c) => c.id === cohort.courseId)?.title ?? '—' : '—'
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const weekEnd = addDays(TODAY, 7)
    return sessions
      .filter((session) => {
        if (filters.status && session.status !== filters.status) return false
        if (filters.window === 'week' && (session.date < TODAY || session.date > weekEnd)) return false
        if (filters.window === 'past' && session.date >= TODAY) return false
        if (!term) return true
        return session.topic.toLowerCase().includes(term) || cohortCode(session.cohortId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime))
  }, [sessions, cohorts, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<ClassSession>> = [
    { key: 'session', header: 'Session', pinned: true, minWidth: 220, accessor: (row) => `${cohortCode(row.cohortId)} · ${row.sequence}. ${row.topic}`, sortValue: (row) => row.topic, sortable: true },
    { key: 'cohort', header: 'Cohort', width: 112, accessor: (row) => <span className="font-mono text-body-13">{cohortCode(row.cohortId)}</span>, sortValue: (row) => cohortCode(row.cohortId), sortable: true },
    { key: 'course', header: 'Course', minWidth: 200, accessor: (row) => courseTitle(row.cohortId), sortValue: (row) => courseTitle(row.cohortId), sortable: true },
    { key: 'date', header: 'Date', width: 116, accessor: (row) => formatDate(row.date), sortValue: (row) => row.date, sortable: true },
    { key: 'time', header: 'Time', width: 128, accessor: (row) => `${row.startTime}–${row.endTime}`, sortValue: (row) => row.startTime, sortable: true },
    {
      key: 'room',
      header: 'Room or link',
      minWidth: 170,
      cell: (row) => (row.room ? <span>{row.room}</span> : row.meetingUrl ? <Badge tone="info" size="sm">Virtual</Badge> : <span className="text-text-secondary">Not set</span>),
      sortValue: (row) => row.room ?? 'virtual',
      sortable: true,
    },
    { key: 'tutor', header: 'Tutor', minWidth: 170, accessor: (row) => personName(row.tutorPersonId), sortValue: (row) => personName(row.tutorPersonId), sortable: true },
    { key: 'expected', header: 'Expected', align: 'right', width: 100, accessor: (row) => formatNumber(row.expectedCount), sortValue: (row) => row.expectedCount, sortable: true },
    {
      key: 'present',
      header: 'Present',
      align: 'right',
      width: 100,
      accessor: (row) => {
        if (row.status !== 'delivered') return <span className="text-text-secondary">—</span>
        const short = row.expectedCount > 0 && row.presentCount / row.expectedCount < 0.7
        return <span className={`tabular-nums ${short ? 'text-danger-text font-semibold' : ''}`}>{formatNumber(row.presentCount)}</span>
      },
      sortValue: (row) => row.presentCount,
      sortable: true,
    },
    { key: 'status', header: 'Status', width: 132, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    {
      key: 'register',
      header: 'Register',
      width: 140,
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

  return (
    <Page>
      <PageHeader
        title="Classes"
        description="The timetable. Every delivered session is what attendance and tutor credit are measured against."
        tabs={ACADEMY_TABS}
        activeTab="classes"
        onTabChange={navigate}
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setScheduling(true)}>
            Schedule a class
          </Button>
        }
      />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title={notice.title} className="mb-6" onDismiss={() => setNotice(null)}>
          {notice.detail}
        </Alert>
      )}

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by topic or cohort code"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setPage(1)
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                {
                  key: 'window',
                  label: 'When',
                  options: [
                    { value: 'week', label: 'Next seven days' },
                    { value: 'past', label: 'Already happened' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={1760}
            bordered={false}
            caption="Class sessions with cohort, date, time, room, tutor and attendance counts"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No classes match these filters"
                  message="Try a different status or time window, or clear the search."
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
                  icon={CalendarClock}
                  title="Nothing is timetabled"
                  message="Without a timetable attendance cannot be recorded and no tutor can be credited for delivery."
                  action={
                    <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setScheduling(true)}>
                      Schedule a class
                    </Button>
                  }
                  secondaryAction={
                    <Button size="sm" variant="secondary" onClick={() => navigate('cohorts')}>
                      Open cohorts
                    </Button>
                  }
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="sessions" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <ScheduleSessionModal
        cohort={null}
        open={scheduling}
        onClose={() => setScheduling(false)}
        onScheduled={(session) =>
          setNotice({
            title: `${cohortCode(session.cohortId)} · session ${session.sequence} scheduled`,
            detail: `${session.topic} on ${formatDate(session.date)}, ${session.startTime}–${session.endTime}, expecting ${formatNumber(session.expectedCount)} students.`,
          })
        }
      />

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
                  ? `${result.created} recorded, ${result.overridden} overridden. Every override carries its reason and an audit entry naming both states.`
                  : `${result.created} recorded. The session is now delivered, and the cohort's attendance rate has moved.`,
            })
          }
        />
      )}
    </Page>
  )
}
