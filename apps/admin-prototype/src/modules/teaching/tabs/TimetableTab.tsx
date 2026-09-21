/**
 * Timetable — this cohort's class sessions, in the legacy's table shape.
 *
 * Read-only on purpose. In the legacy portal a tutor could add and delete
 * rows in the weekly timetable; in Cirvee OS the timetable is Academy
 * operations' record — a session carries an expected count, a delivery status
 * and the tutor credited with it, and a tutor quietly deleting one would break
 * both the attendance rate and the delivery count a tutor is paid against.
 * What a tutor does here is take the register, so that is the row action.
 */
import { CalendarDays, Video } from 'lucide-react'
import { Link } from 'react-router-dom'

import { formatDate, formatNumber } from '@/lib/format'
import { Badge, Button, DataTable, EmptyState, StatusBadge, type Column } from '@/ui'
import { TODAY, type ClassSession, type Cohort } from '@/mocks'

import { TeachingCard, personName } from '../shared'

export default function TimetableTab({
  cohort,
  sessions,
}: {
  cohort: Cohort
  sessions: ClassSession[]
}) {
  const ordered = [...sessions].sort((a, b) => a.sequence - b.sequence)
  const remaining = ordered.filter((s) => s.date >= TODAY && s.status !== 'cancelled').length

  const columns: Array<Column<ClassSession>> = [
    {
      key: 'session',
      header: 'Session',
      pinned: true,
      minWidth: 300,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-semibold text-text">
            {row.sequence}. {row.topic}
          </p>
          <p className="text-body-12 text-text-muted">{personName(row.tutorPersonId)}</p>
        </div>
      ),
      sortValue: (row) => row.sequence,
      sortable: true,
    },
    {
      key: 'date',
      header: 'Date',
      width: 140,
      cell: (row) => (
        <span className={row.date === TODAY ? 'text-body-13 font-semibold text-accent' : 'text-body-13'}>
          {row.date === TODAY ? 'Today' : formatDate(row.date)}
        </span>
      ),
      sortValue: (row) => row.date,
      sortable: true,
    },
    {
      key: 'time',
      header: 'Time',
      width: 120,
      accessor: (row) => `${row.startTime}–${row.endTime}`,
    },
    {
      key: 'where',
      header: 'Where',
      minWidth: 190,
      cell: (row) =>
        row.meetingUrl ? (
          <Badge tone="info" variant="subtle" size="sm" icon={<Video size={12} />}>
            Online
          </Badge>
        ) : (
          <span className="text-body-13">{row.room ?? '—'}</span>
        ),
      sortValue: (row) => row.room ?? 'Online',
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 128,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
      sortValue: (row) => row.status,
      sortable: true,
    },
    {
      key: 'turnout',
      header: 'Turnout',
      width: 110,
      align: 'right',
      accessor: (row) =>
        row.status === 'delivered' ? `${row.presentCount}/${row.expectedCount}` : `— / ${row.expectedCount}`,
      sortValue: (row) => row.presentCount,
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 150,
      align: 'right',
      cell: (row) =>
        row.meetingUrl && row.date >= TODAY ? (
          <Button size="sm" leftIcon={<Video size={14} />} asChild>
            <a href={row.meetingUrl} target="_blank" rel="noopener noreferrer">
              Join class
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="secondary" asChild>
            <Link to={`/teaching/classes/${cohort.id}?tab=attendance`}>Take register</Link>
          </Button>
        ),
    },
  ]

  return (
    <TeachingCard
      title="Timetable"
      description={`${cohort.scheduleSummary} · ${formatNumber(remaining)} session${remaining === 1 ? '' : 's'} still to run`}
    >
      <DataTable
        data={ordered}
        columns={columns}
        rowKey={(row) => row.id}
        bordered={false}
        minWidth={1120}
        density="compact"
        caption="Class sessions scheduled for this cohort"
        empty={
          <EmptyState
            icon={CalendarDays}
            title="Nothing is scheduled"
            message="Academy operations schedules the sessions for a cohort. Attendance is taken against them, so nothing can be marked until one exists."
          />
        }
      />
    </TeachingCard>
  )
}
