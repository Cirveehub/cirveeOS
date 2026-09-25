import { useMemo } from 'react'

import { formatDate } from '@/lib/format'
import { Badge, Button, DataTable, type Column } from '@/ui'
import { Clock, PlayCircle } from 'lucide-react'
import { classSessionsCollection, useCollection, type ClassSession, type Enrollment } from '@/mocks'

import { personName } from '../common'

export function RecordingsTab({ enrolment }: { enrolment: Enrollment }) {
  const sessions = useCollection(classSessionsCollection)

  const rows = useMemo(
    () =>
      sessions
        .filter((s) => s.cohortId === enrolment.cohortId && s.status === 'delivered')
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)),
    [sessions, enrolment.cohortId],
  )

  const available = rows.filter((s) => s.recordingUrl).length

  const columns: Array<Column<ClassSession>> = [
    {
      key: 'session',
      header: 'Session',
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
      key: 'date',
      header: 'Date',
      cell: (row) => <span className="text-body-13">{formatDate(row.date)}</span>,
      sortValue: (row) => row.date,
      width: 130,
    },
    {
      key: 'action',
      header: 'Recording',
      align: 'right',
      cell: (row) =>
        row.recordingUrl ? (
          <Button size="sm" leftIcon={<PlayCircle size={14} />} asChild>
            <a href={row.recordingUrl} target="_blank" rel="noopener noreferrer">
              Watch recording
            </a>
          </Button>
        ) : (
          <Badge tone="neutral" variant="subtle" size="sm" icon={<Clock size={12} />}>
            Not yet available
          </Badge>
        ),
      width: 190,
    },
  ]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border px-6 py-5">
        <p className="text-body-15 font-bold">Recordings</p>
        <p className="text-body-12 text-text-muted">
          {available} of {rows.length} delivered session{rows.length === 1 ? '' : 's'} have a recording so far
        </p>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        defaultSort={{ key: 'date', direction: 'desc' }}
        emptyTitle="No sessions delivered yet"
        emptyMessage="Recordings appear here once your cohort's classes start running. Your tutor adds each one after the session."
      />
    </div>
  )
}
