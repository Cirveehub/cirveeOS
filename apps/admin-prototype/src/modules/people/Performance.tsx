import { useMemo, useState } from 'react'
import { ClipboardCheck, Star } from 'lucide-react'

import { formatDate, formatNaira } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  StatusBadge,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { employeesCollection, performanceReviewsCollection, useCollection } from '@/mocks'
import type { PerformanceReview } from '@/mocks'

import { Page, PeopleGroupTabs, ScreenError, personName, useScreenState, userName } from './shared'
import { acknowledgePerformanceReview, submitPerformanceReview } from './writes'

const STATUS_LABEL: Record<PerformanceReview['status'], string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  acknowledged: 'Acknowledged',
}

function overallScore(review: PerformanceReview): number {
  if (review.competencies.length === 0) return 0
  return review.competencies.reduce((acc, c) => acc + c.score, 0) / review.competencies.length
}

export default function Performance() {
  const state = useScreenState()

  const reviews = useCollection(performanceReviewsCollection)
  const employees = useCollection(employeesCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const nameOf = (review: PerformanceReview) => {
    const employee = employees.find((e) => e.id === review.employeeId)
    return employee ? personName(employee.personId) : 'Former employee'
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return reviews
      .filter((review) => {
        if (filters.status && review.status !== filters.status) return false
        if (!term) return true
        return nameOf(review).toLowerCase().includes(term) || review.periodLabel.toLowerCase().includes(term)
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviews, filters, search, employees])

  const open = openId ? (reviews.find((r) => r.id === openId) ?? null) : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<PerformanceReview>> = [
    { key: 'employee', header: 'Employee', minWidth: 190, accessor: (row) => nameOf(row), sortValue: (row) => nameOf(row), sortable: true },
    { key: 'reviewer', header: 'Reviewer', width: 170, accessor: (row) => userName(row.reviewerUserId), sortable: true },
    { key: 'period', header: 'Period', width: 130, accessor: (row) => row.periodLabel, sortValue: (row) => row.periodLabel, sortable: true },
    {
      key: 'score',
      header: 'Overall',
      width: 130,
      cell: (row) => (
        <span className="inline-flex items-center gap-1 text-body-13 font-semibold tabular-nums">
          <Star size={13} className="text-warning-500" aria-hidden="true" />
          {overallScore(row).toFixed(1)} / 5
        </span>
      ),
      sortValue: (row) => overallScore(row),
      sortable: true,
    },
    {
      key: 'bonus',
      header: 'Recommended bonus',
      align: 'right',
      width: 170,
      accessor: (row) => (row.recommendedBonus ? formatNaira(row.recommendedBonus) : '—'),
      sortValue: (row) => row.recommendedBonus ?? -1,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      cell: (row) => <StatusBadge status={row.status} label={STATUS_LABEL[row.status]} />,
      sortValue: (row) => row.status,
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Performance"
        description="One review per calibration cycle — competencies scored, an overall note, and a recommended bonus where one applies."
      />

      <PeopleGroupTabs group="workforce" active="performance" />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by employee or period"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'status',
                  label: 'Status',
                  options: Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => setOpenId(row.id)}
            activeRowKey={open?.id}
            density="compact"
            caption="Performance reviews with overall score, recommended bonus and status"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No reviews match these filters"
                  message="Try another status, or clear the search."
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
                  icon={ClipboardCheck}
                  title="No reviews on record"
                  message="A review appears here once a manager opens one for the current calibration cycle."
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? nameOf(open) : 'Performance review'}
        description={open ? `${open.periodLabel} · reviewed by ${userName(open.reviewerUserId)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} label={STATUS_LABEL[open.status]} />
              </KeyValue>
              <KeyValue label="Overall score">{overallScore(open).toFixed(1)} / 5</KeyValue>
              <KeyValue label="Submitted">{open.submittedAt ? formatDate(open.submittedAt) : 'Not yet'}</KeyValue>
              <KeyValue label="Acknowledged">{open.acknowledgedAt ? formatDate(open.acknowledgedAt) : 'Not yet'}</KeyValue>
              <KeyValue label="Recommended bonus">
                {open.recommendedBonus ? formatNaira(open.recommendedBonus) : 'None recommended'}
              </KeyValue>
            </KeyValueList>

            <div>
              <h3 className="mb-3 text-heading-18">Competencies</h3>
              <ul className="flex flex-col gap-2">
                {open.competencies.map((c) => (
                  <li key={c.name} className="rounded-xl border border-border px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-body-14 text-text">{c.name}</span>
                      <Badge tone="neutral" size="sm">
                        {c.score} / 5
                      </Badge>
                    </div>
                    {c.note && <p className="mt-1 text-body-13 text-text-secondary">{c.note}</p>}
                  </li>
                ))}
              </ul>
            </div>

            {open.overallNote && (
              <div>
                <h3 className="mb-2 text-heading-18">Overall note</h3>
                <p className="text-body-14 text-text-secondary">{open.overallNote}</p>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              {open.status === 'draft' && (
                <Button onClick={() => submitPerformanceReview(open.id)}>Submit review</Button>
              )}
              {open.status === 'submitted' && (
                <Button onClick={() => acknowledgePerformanceReview(open.id)}>Mark acknowledged</Button>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  )
}
