/**
 * The action register.
 *
 * Two things make this screen worth having: every item names the meeting it was
 * raised in and links back to it, and every item carries the number of agendas
 * it has rolled through. An item that has been carried forward five times is
 * not a task — it is a decision nobody is taking.
 */
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ListChecks, Plus, Repeat2 } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  StatCard,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { actionItemsCollection, meetingsCollection, useCollection } from '@/mocks'
import type { ActionItem, ActionItemStatus } from '@/mocks'

import {
  ACTION_STATUS_LABEL,
  ACTION_STATUS_TONE,
  ErrorPanel,
  ModuleHeader,
  Screen,
  daysOverdue,
  isOpenAction,
  useModuleData,
  useUserName,
} from './parts'
import { NewActionModal } from './modals'

const STATUS_ORDER: ActionItemStatus[] = ['open', 'in_progress', 'blocked', 'carried_forward', 'done']

export default function ActionRegister() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const allActions = useCollection(actionItemsCollection)
  const meetings = useCollection(meetingsCollection)
  const { loading, error, rows: actions, retry } = useModuleData(allActions, 'meetings.actions')

  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const meetingById = useMemo(
    () => new Map(meetings.map((m) => [m.id as string, m])),
    [meetings],
  )

  const figures = useMemo(() => {
    const open = actions.filter(isOpenAction)
    return {
      open: open.length,
      overdue: open.filter((a) => daysOverdue(a.deadline) > 0).length,
      blocked: actions.filter((a) => a.status === 'blocked').length,
      carried: actions.filter((a) => a.carriedForwardCount > 0).length,
      worstCarry: actions.reduce((worst, a) => Math.max(worst, a.carriedForwardCount), 0),
    }
  }, [actions])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return actions
      .filter((item) => {
        if (filters.status && item.status !== filters.status) return false
        if (filters.state === 'open' && !isOpenAction(item)) return false
        if (filters.state === 'overdue' && !(isOpenAction(item) && daysOverdue(item.deadline) > 0)) return false
        if (filters.carried === 'carried' && item.carriedForwardCount === 0) return false
        if (filters.carried === 'never' && item.carriedForwardCount > 0) return false
        if (filters.owner && (item.ownerUserId as string) !== filters.owner) return false
        if (!term) return true
        const meeting = meetingById.get(item.meetingId as string)
        return (
          item.title.toLowerCase().includes(term) ||
          item.lastUpdateNote.toLowerCase().includes(term) ||
          userName(item.ownerUserId).toLowerCase().includes(term) ||
          (meeting?.title ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => {
        const carry = b.carriedForwardCount - a.carriedForwardCount
        return carry !== 0 ? carry : a.deadline.localeCompare(b.deadline)
      })
  }, [actions, filters, search, meetingById, userName])

  const owners = useMemo(() => {
    const ids = [...new Set(allActions.map((a) => a.ownerUserId as string))]
    return ids
      .map((id) => ({ value: id, label: userName(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [allActions, userName])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const columns: Array<Column<ActionItem>> = [
    {
      key: 'title',
      header: 'Action',
      pinned: true,
      minWidth: 340,
      accessor: (row) => row.title,
      sortValue: (row) => row.title,
      sortable: true,
    },
    {
      key: 'meeting',
      header: 'Raised in',
      minWidth: 250,
      cell: (row) => {
        const meeting = meetingById.get(row.meetingId as string)
        if (!meeting) return <span className="text-text-secondary">Meeting not found</span>
        return (
          <Link
            to={`/meetings/${meeting.id}`}
            onClick={(event) => event.stopPropagation()}
            className="text-accent underline-offset-2 hover:underline"
          >
            {meeting.title} · {formatDate(meeting.startAt)}
          </Link>
        )
      },
      sortValue: (row) => meetingById.get(row.meetingId as string)?.startAt ?? '',
      sortable: true,
    },
    {
      key: 'owner',
      header: 'Owner',
      minWidth: 180,
      accessor: (row) => userName(row.ownerUserId),
      sortValue: (row) => userName(row.ownerUserId),
      sortable: true,
    },
    {
      key: 'deadline',
      header: 'Deadline',
      width: 124,
      accessor: (row) => formatDate(row.deadline),
      sortValue: (row) => row.deadline,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 160,
      cell: (row) => (
        <Badge tone={ACTION_STATUS_TONE[row.status]} size="sm">
          {ACTION_STATUS_LABEL[row.status]}
        </Badge>
      ),
      sortValue: (row) => ACTION_STATUS_LABEL[row.status],
      sortable: true,
    },
    {
      key: 'overdue',
      header: 'Days overdue',
      align: 'right',
      width: 146,
      cell: (row) => {
        if (!isOpenAction(row)) return <span className="text-text-secondary">Closed</span>
        const days = daysOverdue(row.deadline)
        if (days === 0) return <span className="text-text-secondary">On time</span>
        return (
          <span className={`tabular-nums ${days > 14 ? 'text-danger-text' : 'text-warning-text'}`}>
            {formatNumber(days)}
          </span>
        )
      },
      sortValue: (row) => (isOpenAction(row) ? daysOverdue(row.deadline) : -1),
      sortable: true,
    },
    {
      key: 'carried',
      header: 'Carried forward',
      align: 'right',
      width: 164,
      cell: (row) =>
        row.carriedForwardCount === 0 ? (
          <span className="text-text-secondary">Never carried</span>
        ) : (
          <Badge tone={row.carriedForwardCount >= 3 ? 'danger' : 'warning'} size="sm" icon={<Repeat2 size={12} />}>
            {formatNumber(row.carriedForwardCount)}{' '}
            {row.carriedForwardCount === 1 ? 'agenda' : 'agendas'}
          </Badge>
        ),
      sortValue: (row) => row.carriedForwardCount,
      sortable: true,
    },
    {
      key: 'update',
      header: 'Last update',
      minWidth: 300,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block text-body-13 text-text">{row.lastUpdateNote}</span>
          <span className="block text-body-12 text-text-secondary">{formatDateTime(row.lastUpdateAt)}</span>
        </span>
      ),
      sortValue: (row) => row.lastUpdateAt,
      sortable: true,
    },
    {
      key: 'related',
      header: 'Related record',
      minWidth: 170,
      accessor: (row) =>
        row.relatedEntityType ? (
          <span className="font-mono text-body-12">
            {row.relatedEntityType}
            {row.relatedEntityId ? ` ${row.relatedEntityId}` : ''}
          </span>
        ) : (
          <span className="text-text-secondary">None linked</span>
        ),
      sortValue: (row) => row.relatedEntityType ?? '',
      sortable: true,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Action register"
        description="Every action raised in a meeting, who owns it, and how many agendas it has already rolled through."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Add an action item
          </Button>
        }
      />

      {error ? (
        <ErrorPanel onRetry={retry} what="The action register" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Open actions"
              value={formatNumber(figures.open)}
              icon={ListChecks}
              variant={figures.open > 0 ? 'warning' : 'default'}
              caption="Not yet done"
              loading={loading}
            />
            <StatCard
              label="Overdue"
              value={formatNumber(figures.overdue)}
              icon={ListChecks}
              variant={figures.overdue > 0 ? 'danger' : 'default'}
              caption="Past their deadline and still open"
              loading={loading}
            />
            <StatCard
              label="Blocked"
              value={formatNumber(figures.blocked)}
              icon={ListChecks}
              variant={figures.blocked > 0 ? 'warning' : 'default'}
              caption="Waiting on something outside the owner's control"
              loading={loading}
            />
            <StatCard
              label="Carried forward"
              value={formatNumber(figures.carried)}
              icon={Repeat2}
              variant={figures.carried > 0 ? 'warning' : 'default'}
              caption={`Worst offender has rolled through ${formatNumber(figures.worstCarry)} agendas`}
              loading={loading}
            />
          </div>

          <Alert className="mt-6" tone="info" icon={Repeat2} title="Carrying forward is automatic, and that is the point">
            An action that is not done when the next meeting of its type comes round is added to that
            agenda by itself and its carry count goes up by one. Nobody has to remember, and nobody can
            quietly drop it.
          </Alert>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by action, owner, meeting or last update"
                  values={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'status',
                      label: 'Status',
                      options: STATUS_ORDER.map((status) => ({
                        value: status,
                        label: ACTION_STATUS_LABEL[status],
                      })),
                    },
                    {
                      key: 'state',
                      label: 'Queue',
                      options: [
                        { value: 'open', label: 'Open' },
                        { value: 'overdue', label: 'Overdue' },
                      ],
                    },
                    {
                      key: 'carried',
                      label: 'Carry',
                      options: [
                        { value: 'carried', label: 'Has been carried' },
                        { value: 'never', label: 'Never carried' },
                      ],
                    },
                    { key: 'owner', label: 'Owner', options: owners },
                  ]}
                />
              </TableToolbar>

              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.id}
                loading={loading}
                onRowClick={(row) => navigate(`/meetings/${row.meetingId}?tab=actions`)}
                density="compact"
                minWidth={2200}
                bordered={false}
                defaultSort={{ key: 'carried', direction: 'desc' }}
                caption="Action items with the meeting that raised them, owner, deadline, status, days overdue, carry count and last update"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No actions match these filters"
                      message="Try another owner or status, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={ListChecks}
                      title="No actions on the register"
                      message="Actions are raised inside a meeting and carried forward automatically until they close. An empty register means either a very good week or a meeting that decided nothing."
                      action={
                        <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
                          Add the first action
                        </Button>
                      }
                    />
                  )
                }
              />
            </CardBody>
          </Card>
        </>
      )}

      <NewActionModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(title) =>
          toast.success(`"${title}" added to the register. It carries forward until it is done.`)
        }
      />
    </Screen>
  )
}
