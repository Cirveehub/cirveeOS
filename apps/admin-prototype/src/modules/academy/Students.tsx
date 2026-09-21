import { useMemo, useState } from 'react'
import { GraduationCap, Lock } from 'lucide-react'

import { formatDate, formatPercent } from '@/lib/format'
import {
  Alert,
  Badge,
  BUSINESS_UNITS,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  MoneyCell,
  PageHeader,
  Pagination,
  StatusBadge,
  TableToolbar,
  UNIT_META,
  UnitTag,
  type Column,
  type FilterValues,
} from '@/ui'
import {
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  invoicesCollection,
  studentAttendanceCollection,
  useCollection,
} from '@/mocks'
import type { Enrollment } from '@/mocks'

import { ACADEMY_TABS, Page, ScreenError, branchName, personName, unitKey, userName, useModuleNav, useScreenState } from './shared'

const STATUSES = ['active', 'completed', 'withdrawn', 'deferred', 'suspended'] as const
const PAGE_SIZE = 25

export default function Students() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const enrollments = useCollection(enrollmentsCollection)
  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)
  const attendance = useCollection(studentAttendanceCollection)
  const invoices = useCollection(invoicesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)

  const derived = useMemo(() => {
    const map = new Map<string, { attendance: number | null; balance: number }>()
    const balanceByPerson = new Map<string, number>()
    for (const invoice of invoices) {
      if (!invoice.personId || invoice.status === 'cancelled') continue
      balanceByPerson.set(invoice.personId, (balanceByPerson.get(invoice.personId) ?? 0) + invoice.balance)
    }
    for (const enrollment of enrollments) {
      const mine = attendance.filter((a) => a.enrollmentId === enrollment.id)
      const rate = mine.length === 0 ? null : (mine.filter((a) => a.state === 'present' || a.state === 'late').length / mine.length) * 100
      map.set(enrollment.id, { attendance: rate, balance: balanceByPerson.get(enrollment.personId) ?? 0 })
    }
    return map
  }, [enrollments, attendance, invoices])

  const cohortCode = (cohortId: string) => cohorts.find((c) => c.id === cohortId)?.code ?? cohortId
  const courseTitle = (courseId: string) => courses.find((c) => c.id === courseId)?.title ?? courseId
  const branchOf = (cohortId: string) => branchName(cohorts.find((c) => c.id === cohortId)?.branchId)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return enrollments
      .filter((enrollment) => {
        if (filters.status && enrollment.status !== filters.status) return false
        if (filters.unit && unitKey(enrollment.unitId) !== filters.unit) return false
        if (filters.flags === 'flagged' && enrollment.attentionFlags.length === 0) return false
        if (filters.flags === 'clear' && enrollment.attentionFlags.length > 0) return false
        if (!term) return true
        return personName(enrollment.personId).toLowerCase().includes(term) || cohortCode(enrollment.cohortId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt))
  }, [enrollments, cohorts, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<Enrollment>> = [
    { key: 'name', header: 'Student', pinned: true, minWidth: 190, accessor: (row) => personName(row.personId), sortValue: (row) => personName(row.personId), sortable: true },
    { key: 'cohort', header: 'Cohort', width: 116, accessor: (row) => <span className="font-mono text-body-13">{cohortCode(row.cohortId)}</span>, sortValue: (row) => cohortCode(row.cohortId), sortable: true },
    { key: 'course', header: 'Course', minWidth: 210, accessor: (row) => courseTitle(row.courseId), sortValue: (row) => courseTitle(row.courseId), sortable: true },
    { key: 'branch', header: 'Branch', width: 124, accessor: (row) => branchOf(row.cohortId), sortValue: (row) => branchOf(row.cohortId) },
    {
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
    { key: 'enrolled', header: 'Enrolled', width: 120, accessor: (row) => formatDate(row.enrolledAt), sortValue: (row) => row.enrolledAt, sortable: true },
    {
      key: 'attendance',
      header: 'Attendance',
      align: 'right',
      width: 116,
      accessor: (row) => {
        const rate = derived.get(row.id)?.attendance
        if (rate === null || rate === undefined) return <span className="text-text-secondary">No sessions</span>
        return <span className={`tabular-nums ${rate < 70 ? 'text-danger-text font-semibold' : ''}`}>{formatPercent(rate)}</span>
      },
      sortValue: (row) => derived.get(row.id)?.attendance ?? -1,
      sortable: true,
    },
    {
      key: 'flags',
      header: 'Attention flags',
      minWidth: 230,
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
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      width: 140,
      cell: (row) => {
        const balance = derived.get(row.id)?.balance ?? 0
        return <MoneyCell kobo={balance} tone={balance > 0 ? 'negative' : 'muted'} />
      },
      sortValue: (row) => derived.get(row.id)?.balance ?? 0,
      sortable: true,
    },
    { key: 'advisor', header: 'Advisor', minWidth: 160, accessor: (row) => userName(row.advisorUserId), sortValue: (row) => userName(row.advisorUserId) },
    { key: 'status', header: 'Status', width: 120, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
  ]

  return (
    <Page>
      <PageHeader
        title="Students"
        description="Everyone currently enrolled, with their cohort, attendance and advisory flags."
        tabs={ACADEMY_TABS}
        activeTab="students"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Alert tone="info" icon={Lock} title="The balance column is not part of the tutor view" className="mb-6">
        Finance and administration see it here. Tutors see the same students inside a cohort without any financial column, so
        teaching decisions are never coloured by what somebody owes. Attention flags are advisory and carry no financial
        consequence of their own.
      </Alert>

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by student or cohort code"
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
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s })) },
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
                {
                  key: 'flags',
                  label: 'Flags',
                  options: [
                    { value: 'flagged', label: 'Flagged for attention' },
                    { value: 'clear', label: 'No flags' },
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
            minWidth={1860}
            bordered={false}
            caption="Enrolled students with cohort, course, attendance, attention flags and balance"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No students match these filters"
                  message="Try another status or unit, or clear the search term."
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
                  icon={GraduationCap}
                  title="Nobody is enrolled"
                  message="Enrolments are created when an admission is confirmed in CRM. Until one is, no cohort has anyone in it."
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="students" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>
    </Page>
  )
}
