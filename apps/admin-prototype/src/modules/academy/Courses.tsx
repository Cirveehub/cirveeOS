import { useMemo, useState } from 'react'
import { BookOpen } from 'lucide-react'

import { formatNumber, formatPercent } from '@/lib/format'
import {
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
  StatusBadge,
  TableToolbar,
  UNIT_META,
  UnitTag,
  type Column,
  type FilterValues,
} from '@/ui'
import { cohortsCollection, coursesCollection, enrollmentsCollection, useCollection } from '@/mocks'
import type { Course } from '@/mocks'

import { ACADEMY_TABS, Page, ScreenError, unitKey, useModuleNav, useScreenState } from './shared'

const LEVELS = ['beginner', 'intermediate', 'advanced'] as const
const MODES = ['on_campus', 'virtual', 'hybrid'] as const
const STATUSES = ['draft', 'published', 'archived'] as const

export default function Courses() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const enrollments = useCollection(enrollmentsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const live = useMemo(() => {
    const map = new Map<string, { activeCohorts: number; enrolled: number }>()
    for (const course of courses) map.set(course.id, { activeCohorts: 0, enrolled: 0 })
    for (const cohort of cohorts) {
      if (cohort.status !== 'open' && cohort.status !== 'running') continue
      const entry = map.get(cohort.courseId)
      if (entry) entry.activeCohorts += 1
    }
    for (const enrollment of enrollments) {
      const entry = map.get(enrollment.courseId)
      if (entry && enrollment.status === 'active') entry.enrolled += 1
    }
    return map
  }, [courses, cohorts, enrollments])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return courses
      .filter((course) => {
        if (filters.level && course.level !== filters.level) return false
        if (filters.status && course.status !== filters.status) return false
        if (filters.mode && !course.modes.includes(filters.mode as Course['modes'][number])) return false
        if (filters.unit && unitKey(course.unitId) !== filters.unit) return false
        if (!term) return true
        return course.title.toLowerCase().includes(term) || course.code.toLowerCase().includes(term)
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [courses, filters, search])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<Course>> = [
    { key: 'code', header: 'Code', pinned: true, width: 108, accessor: (row) => <span className="font-mono text-body-13 font-semibold">{row.code}</span>, sortValue: (row) => row.code, sortable: true },
    { key: 'title', header: 'Title', minWidth: 260, accessor: (row) => row.title, sortValue: (row) => row.title, sortable: true },
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
    { key: 'level', header: 'Level', width: 124, accessor: (row) => <span className="capitalize">{row.level}</span>, sortValue: (row) => row.level, sortable: true },
    { key: 'weeks', header: 'Weeks', align: 'right', width: 84, accessor: (row) => formatNumber(row.durationWeeks), sortValue: (row) => row.durationWeeks, sortable: true },
    {
      key: 'modes',
      header: 'Modes',
      minWidth: 200,
      cell: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.modes.map((mode) => (
            <Badge key={mode} tone="neutral" size="sm" variant="outline">
              {mode.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      ),
      sortValue: (row) => row.modes.join(','),
      sortable: true,
    },
    { key: 'price', header: 'List price', align: 'right', cell: (row) => <MoneyCell kobo={row.listPrice} strong />, sortValue: (row) => row.listPrice, sortable: true },
    {
      key: 'cohorts',
      header: 'Active cohorts',
      align: 'right',
      width: 132,
      accessor: (row) => formatNumber(live.get(row.id)?.activeCohorts ?? 0),
      sortValue: (row) => live.get(row.id)?.activeCohorts ?? 0,
      sortable: true,
    },
    {
      key: 'enrolled',
      header: 'Total enrolled',
      align: 'right',
      width: 132,
      accessor: (row) => formatNumber(live.get(row.id)?.enrolled ?? 0),
      sortValue: (row) => live.get(row.id)?.enrolled ?? 0,
      sortable: true,
    },
    {
      key: 'completion',
      header: 'Completion rate',
      align: 'right',
      width: 140,
      accessor: (row) => (
        <span className={`tabular-nums ${row.stats.completionRate < 60 ? 'text-warning-text' : ''}`}>{formatPercent(row.stats.completionRate)}</span>
      ),
      sortValue: (row) => row.stats.completionRate,
      sortable: true,
    },
    { key: 'status', header: 'Status', width: 124, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
  ]

  return (
    <Page>
      <PageHeader
        title="Courses"
        description="The catalogue. A course is what is sold; a cohort is what is delivered."
        tabs={ACADEMY_TABS}
        activeTab="courses"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by course title or code"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'unit', label: 'Unit', options: BUSINESS_UNITS.map((u) => ({ value: u, label: UNIT_META[u].label })) },
                { key: 'level', label: 'Level', options: LEVELS.map((l) => ({ value: l, label: l })) },
                { key: 'mode', label: 'Mode', options: MODES.map((m) => ({ value: m, label: m.replace(/_/g, ' ') })) },
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s })) },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={1720}
            bordered={false}
            caption="Courses with unit, level, duration, modes, price, active cohorts and completion rate"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No courses match these filters"
                  message="Try a different level, mode or unit, or clear the search."
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
                  icon={BookOpen}
                  title="The catalogue is empty"
                  message="Nothing can be quoted, enrolled or timetabled until there is at least one published course with a list price."
                />
              )
            }
          />
        </CardBody>
      </Card>
    </Page>
  )
}
