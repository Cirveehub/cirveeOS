import { useMemo, useState } from 'react'
import { CheckCircle2, ClipboardList, Gift } from 'lucide-react'
import toast from 'react-hot-toast'

import { TODAY, tasksCollection, useCollection, type Task, type TaskStatus } from '@/mocks'
import { formatDate, formatNaira, formatNumber, humanize } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  StatusBadge,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { setTaskStatus } from '@/modules/people/writes'

import { MyPageHeader, Page, useMe } from './shared'

const OPEN_STATES: TaskStatus[] = ['open', 'in_progress', 'blocked']

const PRIORITY_TONE: Record<string, 'danger' | 'warning' | 'neutral'> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'neutral',
  low: 'neutral',
}

function isOverdue(task: Task): boolean {
  return task.dueAt !== null && task.dueAt.slice(0, 10) < TODAY && OPEN_STATES.includes(task.status)
}

export default function MyTasks() {
  const me = useMe()
  const tasks = useCollection(tasksCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const mine = useMemo(
    () => (me.userId ? tasks.filter((t) => t.ownerUserId === me.userId) : []),
    [tasks, me.userId],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return mine
      .filter((task) => {
        if (filters.status === 'open' && !OPEN_STATES.includes(task.status)) return false
        if (filters.status === 'done' && task.status !== 'done') return false
        if (filters.status === 'overdue' && !isOverdue(task)) return false
        if (filters.priority && task.priority !== filters.priority) return false
        if (!term) return true
        return task.title.toLowerCase().includes(term)
      })
      .sort((a, b) => {
        const aOpen = OPEN_STATES.includes(a.status)
        const bOpen = OPEN_STATES.includes(b.status)
        if (aOpen !== bOpen) return aOpen ? -1 : 1
        return (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')
      })
  }, [mine, filters, search])

  const open = mine.filter((t) => OPEN_STATES.includes(t.status))
  const overdue = mine.filter(isOverdue)
  const doneThisMonth = mine.filter(
    (t) => t.status === 'done' && t.completedAt !== null && t.completedAt.slice(0, 7) === TODAY.slice(0, 7),
  )

  const move = (task: Task, status: TaskStatus, message: string) => {
    const adjustment = setTaskStatus(task.id as string, status)
    toast.success(adjustment ? `${message} ${formatNaira(adjustment.amount)} is on its way to your payslip.` : message)
  }

  const columns: Array<Column<Task>> = [
    {
      key: 'title',
      header: 'Task',
      minWidth: 320,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block truncate text-body-14 text-text">{row.title}</span>
          {row.relatedEntityRef && (
            <span className="block truncate text-body-12 text-text-secondary">
              {row.relatedEntityType} · {row.relatedEntityRef}
            </span>
          )}
          {row.incentive && (
            <span className="mt-0.5 flex items-center gap-1 text-body-12 text-accent">
              <Gift size={12} />
              {row.incentive.type === 'money'
                ? `${formatNaira(row.incentive.amount ?? 0)}${row.incentivePayrollAdjustmentId ? ' — on your payslip' : ' on completion'}`
                : row.incentive.note}
            </span>
          )}
        </span>
      ),
      sortValue: (row) => row.title,
      sortable: true,
    },
    {
      key: 'priority',
      header: 'Priority',
      width: 120,
      cell: (row) => (
        <Badge tone={PRIORITY_TONE[row.priority] ?? 'neutral'} size="sm">
          {humanize(row.priority)}
        </Badge>
      ),
      sortValue: (row) => row.priority,
      sortable: true,
    },
    {
      key: 'due',
      header: 'Due',
      width: 150,
      cell: (row) =>
        row.dueAt === null ? (
          <span className="text-text-secondary">No date</span>
        ) : (
          <span className={isOverdue(row) ? 'text-danger-text' : undefined}>{formatDate(row.dueAt)}</span>
        ),
      sortValue: (row) => row.dueAt ?? '9999',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      cell: (row) => <StatusBadge status={row.status} label={humanize(row.status)} />,
      sortValue: (row) => row.status,
      sortable: true,
    },
    {
      key: 'act',
      header: '',
      width: 210,
      align: 'right',
      cell: (row) => {
        if (row.status === 'done' || row.status === 'cancelled') return null
        return (
          <span className="flex w-full items-center justify-end gap-1.5">
            {row.status === 'open' && (
              <Button size="sm" variant="secondary" onClick={() => move(row, 'in_progress', 'Marked as started.')}>
                Start
              </Button>
            )}
            {row.status === 'in_progress' && (
              <Button size="sm" variant="ghost" onClick={() => move(row, 'blocked', 'Flagged as blocked.')}>
                Blocked
              </Button>
            )}
            {row.status === 'blocked' && (
              <Button size="sm" variant="ghost" onClick={() => move(row, 'in_progress', 'Unblocked.')}>
                Unblock
              </Button>
            )}
            <Button size="sm" onClick={() => move(row, 'done', 'Done.')}>
              Done
            </Button>
          </span>
        )
      },
    },
  ]

  return (
    <Page>
      <MyPageHeader
        title="My tasks"
        description="What is assigned to you, across every part of the business. Closing one here closes it everywhere."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Open"
          value={formatNumber(open.length)}
          icon={ClipboardList}
          caption="Not started, in progress or blocked"
        />
        <StatCard
          label="Overdue"
          value={formatNumber(overdue.length)}
          icon={ClipboardList}
          variant={overdue.length > 0 ? 'warning' : 'success'}
          caption="Past their due date"
        />
        <StatCard
          label="Finished this month"
          value={formatNumber(doneThisMonth.length)}
          icon={CheckCircle2}
          variant="success"
          caption="Closed by you"
        />
      </div>

      <Card className="mt-6">
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search your tasks"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'status',
                  label: 'Show',
                  options: [
                    { value: 'open', label: 'Still open' },
                    { value: 'overdue', label: 'Overdue' },
                    { value: 'done', label: 'Finished' },
                  ],
                },
                {
                  key: 'priority',
                  label: 'Priority',
                  options: ['urgent', 'high', 'normal', 'low'].map((p) => ({ value: p, label: humanize(p) })),
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            density="compact"
            minWidth={1100}
            bordered={false}
            caption="Your tasks with priority, due date and status"
            empty={
              <EmptyState
                icon={CheckCircle2}
                title={mine.length === 0 ? 'Nothing is assigned to you' : 'Nothing matches these filters'}
                message={
                  mine.length === 0
                    ? 'Tasks reach you from onboarding checklists, approvals and whoever is running a piece of work. An empty list here is a good day.'
                    : 'Try another status or priority, or clear the search.'
                }
              />
            }
          />
        </CardBody>
      </Card>
    </Page>
  )
}
