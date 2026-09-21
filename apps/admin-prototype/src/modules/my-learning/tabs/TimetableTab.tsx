/**
 * The Timetable tab of the student's course hub.
 *
 * The legacy portal shows a weekly schedule derived from a recurring pattern
 * — day, type, time. Cirvee OS timetables actual `ClassSession` rows with a
 * topic, a room, a tutor and a status, so this lists the real sessions: what
 * is next, what it is about, and — the thing a recurring pattern can never
 * say — which one has been cancelled or rescheduled.
 */

import { useMemo } from 'react'

import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { Badge, Button, DataTable, StatusBadge, type Column } from '@/ui'
import { Video } from 'lucide-react'
import {
  classSessionsCollection,
  useCollection,
  TODAY,
  type ClassSession,
  type Enrollment,
} from '@/mocks'

import { personName, weekdayOf } from '../common'

export function TimetableTab({ enrolment }: { enrolment: Enrollment }) {
  const sessions = useCollection(classSessionsCollection)

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => s.cohortId === enrolment.cohortId)
        .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
    [sessions, enrolment.cohortId],
  )

  const upcoming = rows.filter((s) => s.date >= TODAY && s.status !== 'cancelled').length

  const columns: Array<Column<ClassSession>> = [
    {
      key: 'day',
      header: 'Day',
      cell: (row) => (
        <div>
          <p
            className={cn(
              'text-body-14 font-semibold',
              row.status === 'cancelled' && 'text-text-muted line-through',
            )}
          >
            {weekdayOf(row.date)}
          </p>
          <p className="text-body-12 text-text-muted">{formatDate(row.date)}</p>
        </div>
      ),
      sortValue: (row) => row.date,
      width: 150,
    },
    {
      key: 'topic',
      header: 'Topic',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 font-medium">{row.topic}</p>
          <p className="text-body-12 text-text-muted">
            Session {row.sequence} · {personName(row.tutorPersonId)}
          </p>
        </div>
      ),
      sortValue: (row) => row.sequence,
      minWidth: 300,
    },
    {
      key: 'time',
      header: 'Time',
      cell: (row) => (
        <Badge tone="accent" variant="subtle" size="sm">
          {row.startTime}–{row.endTime}
        </Badge>
      ),
      sortValue: (row) => row.startTime,
      width: 140,
    },
    {
      key: 'where',
      header: 'Where',
      cell: (row) =>
        row.meetingUrl ? (
          <Button size="sm" variant="secondary" leftIcon={<Video size={14} />}>
            Join class
          </Button>
        ) : (
          <span className="text-body-13 text-text-secondary">{row.room ?? 'To be confirmed'}</span>
        ),
      width: 180,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'right',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
      sortValue: (row) => row.status,
      width: 130,
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-6 py-5">
        <p className="text-body-15 font-bold">Class schedule</p>
        <p className="text-body-12 text-text-muted">
          {rows.length} session{rows.length === 1 ? '' : 's'} in this cohort · {upcoming} still to come
        </p>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        defaultSort={{ key: 'day', direction: 'asc' }}
        rowClassName={(row) => (row.status === 'cancelled' ? 'opacity-60' : undefined)}
        emptyTitle="No sessions timetabled"
        emptyMessage="Your cohort's schedule will appear here once it is published."
      />
    </div>
  )
}
