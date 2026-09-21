import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CalendarDays, FileCheck2, Gavel, ListChecks, Plus } from 'lucide-react'

import { formatDate, formatNumber, formatTime } from '@/lib/format'
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
import {
  TODAY,
  actionItemsCollection,
  decisionsCollection,
  meetingsCollection,
  useCollection,
} from '@/mocks'
import type { Meeting } from '@/mocks'

import {
  ErrorPanel,
  MEETING_TYPE_LABEL,
  MEETING_TYPE_ORDER,
  ModuleHeader,
  Screen,
  isOpenAction,
  isPast,
  useModuleData,
  useUserName,
} from './parts'
import { NewMeetingModal } from './modals'

export default function Meetings() {
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)

  const allMeetings = useCollection(meetingsCollection)
  const actions = useCollection(actionItemsCollection)
  const decisions = useCollection(decisionsCollection)
  const { loading, error, rows: meetings, retry } = useModuleData(allMeetings, 'meetings.list')

  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const actionsByMeeting = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of actions) {
      const key = item.meetingId as string
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [actions])

  const decisionsByMeeting = useMemo(() => {
    const map = new Map<string, number>()
    for (const decision of decisions) {
      if (!decision.meetingId) continue
      const key = decision.meetingId as string
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [decisions])

  const figures = useMemo(
    () => ({
      held: meetings.filter((m) => m.status === 'held').length,
      upcoming: meetings.filter((m) => m.status === 'scheduled').length,
      openActions: actions.filter(isOpenAction).length,
      activeDecisions: decisions.filter((d) => d.status === 'active').length,
    }),
    [meetings, actions, decisions],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return meetings
      .filter((meeting) => {
        if (filters.type && meeting.type !== filters.type) return false
        if (filters.status && meeting.status !== filters.status) return false
        if (filters.when === 'past' && !isPast(meeting.startAt)) return false
        if (filters.when === 'upcoming' && isPast(meeting.startAt)) return false
        if (!term) return true
        return (
          meeting.title.toLowerCase().includes(term) ||
          MEETING_TYPE_LABEL[meeting.type].toLowerCase().includes(term) ||
          userName(meeting.chairUserId).toLowerCase().includes(term) ||
          meeting.agendaItems.some((item) => item.title.toLowerCase().includes(term))
        )
      })
      .sort((a, b) => b.startAt.localeCompare(a.startAt))
  }, [meetings, filters, search, userName])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const attended = (meeting: Meeting) =>
    meeting.attendance.filter((a) => a.method !== 'apology').length

  const columns: Array<Column<Meeting>> = [
    {
      key: 'title',
      header: 'Meeting',
      pinned: true,
      minWidth: 250,
      accessor: (row) => row.title,
      sortValue: (row) => row.title,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 220,
      cell: (row) => (
        <Badge tone={row.type === 'ad_hoc' ? 'neutral' : 'accent'} size="sm">
          {MEETING_TYPE_LABEL[row.type]}
        </Badge>
      ),
      sortValue: (row) => MEETING_TYPE_LABEL[row.type],
      sortable: true,
    },
    {
      key: 'when',
      header: 'Date and time',
      width: 180,
      accessor: (row) => `${formatDate(row.startAt)} ${formatTime(row.startAt)}`,
      sortValue: (row) => row.startAt,
      sortable: true,
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'right',
      width: 110,
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.durationMinutes)} min</span>,
      sortValue: (row) => row.durationMinutes,
      sortable: true,
    },
    {
      key: 'chair',
      header: 'Chair',
      minWidth: 170,
      accessor: (row) => userName(row.chairUserId),
      sortValue: (row) => userName(row.chairUserId),
      sortable: true,
    },
    {
      key: 'attendance',
      header: 'Attendees',
      align: 'right',
      width: 120,
      cell: (row) => (
        <span className="tabular-nums">
          {formatNumber(attended(row))} of {formatNumber(row.attendance.length)}
        </span>
      ),
      sortValue: (row) => attended(row),
      sortable: true,
    },
    {
      key: 'where',
      header: 'Location',
      minWidth: 190,
      accessor: (row) => row.location ?? row.meetingUrl ?? <span className="text-text-secondary">Not set</span>,
      sortValue: (row) => row.location ?? row.meetingUrl ?? '',
      sortable: true,
    },
    {
      key: 'agenda',
      header: 'Agenda ready',
      width: 150,
      cell: (row) =>
        row.agendaItems.length > 0 ? (
          <Badge tone="success" size="sm">
            {formatNumber(row.agendaItems.length)} items
          </Badge>
        ) : (
          <Badge tone="warning" size="sm">
            No agenda
          </Badge>
        ),
      sortValue: (row) => row.agendaItems.length,
      sortable: true,
    },
    {
      key: 'minutes',
      header: 'Minutes circulated',
      width: 176,
      cell: (row) =>
        row.minutesCirculatedAt ? (
          <span className="text-body-13">{formatDate(row.minutesCirculatedAt)}</span>
        ) : row.status === 'held' ? (
          <Badge tone="warning" size="sm">
            Not circulated
          </Badge>
        ) : (
          <span className="text-text-secondary">Not yet held</span>
        ),
      sortValue: (row) => row.minutesCirculatedAt ?? '',
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions raised',
      align: 'right',
      width: 148,
      accessor: (row) => (
        <span className="tabular-nums">{formatNumber(actionsByMeeting.get(row.id as string) ?? 0)}</span>
      ),
      sortValue: (row) => actionsByMeeting.get(row.id as string) ?? 0,
      sortable: true,
    },
    {
      key: 'decisions',
      header: 'Decisions logged',
      align: 'right',
      width: 162,
      accessor: (row) => (
        <span className="tabular-nums">{formatNumber(decisionsByMeeting.get(row.id as string) ?? 0)}</span>
      ),
      sortValue: (row) => decisionsByMeeting.get(row.id as string) ?? 0,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 128,
      cell: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
      sortable: true,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Meetings"
        description="The operating rhythm — leadership, admissions, the monthly review and the quarterly reset."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Log a meeting
          </Button>
        }
      />

      {error ? (
        <ErrorPanel onRetry={retry} what="Meetings" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Meetings held"
              value={formatNumber(figures.held)}
              icon={CalendarDays}
              caption={`On or before ${formatDate(TODAY)}`}
              loading={loading}
            />
            <StatCard
              label="Scheduled"
              value={formatNumber(figures.upcoming)}
              icon={CalendarDays}
              caption="Still to sit"
              loading={loading}
            />
            <StatCard
              label="Open actions"
              value={formatNumber(figures.openActions)}
              icon={ListChecks}
              variant={figures.openActions > 0 ? 'warning' : 'default'}
              caption="Raised in a meeting and not yet done"
              onClick={() => navigate('/meetings/actions')}
              loading={loading}
            />
            <StatCard
              label="Active decisions"
              value={formatNumber(figures.activeDecisions)}
              icon={Gavel}
              caption="In force, not superseded or reversed"
              onClick={() => navigate('/meetings/decisions')}
              loading={loading}
            />
          </div>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by meeting, chair or agenda item"
                  values={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'type',
                      label: 'Type',
                      options: MEETING_TYPE_ORDER.map((type) => ({
                        value: type,
                        label: MEETING_TYPE_LABEL[type],
                      })),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      options: [
                        { value: 'scheduled', label: 'Scheduled' },
                        { value: 'in_progress', label: 'In progress' },
                        { value: 'held', label: 'Held' },
                        { value: 'cancelled', label: 'Cancelled' },
                      ],
                    },
                    {
                      key: 'when',
                      label: 'When',
                      options: [
                        { value: 'past', label: 'Past' },
                        { value: 'upcoming', label: 'Upcoming' },
                      ],
                    },
                  ]}
                />
              </TableToolbar>

              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.id}
                loading={loading}
                onRowClick={(row) => navigate(`/meetings/${row.id}`)}
                density="compact"
                minWidth={2200}
                bordered={false}
                caption="Meetings with type, date, chair, attendance, agenda, minutes, actions raised and decisions logged"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No meetings match these filters"
                      message="Try another type or period, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={FileCheck2}
                      title="No meetings scheduled"
                      message="The operating rhythm hangs off this list. With no meeting on it, action items have nowhere to be carried to and decisions have nowhere to be recorded."
                      action={
                        <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
                          Log the first meeting
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

      <NewMeetingModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={({ meeting, carriedForward }) => {
          if (carriedForward.length > 0) {
            toast.success(
              `${meeting.title} logged. ${carriedForward.length} unresolved ${
                carriedForward.length === 1 ? 'action was' : 'actions were'
              } carried forward onto its agenda.`,
            )
          } else {
            toast.success(`${meeting.title} logged.`)
          }
          navigate(`/meetings/${meeting.id}`)
        }}
      />
    </Screen>
  )
}
