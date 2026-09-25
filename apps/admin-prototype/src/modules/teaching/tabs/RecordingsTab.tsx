import { useMemo, useState } from 'react'
import { Check, Link2, PlayCircle, X } from 'lucide-react'

import { formatDate } from '@/lib/format'
import { Alert, Badge, Button, DataTable, IconButton, Input, type Column } from '@/ui'
import { type ClassSession, type UserId } from '@/mocks'

import { TeachingCard, personName } from '../shared'
import { setSessionRecording } from '../writes'

export default function RecordingsTab({
  sessions,
  actorUserId,
}: {
  sessions: ClassSession[]
  actorUserId: UserId
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  const delivered = useMemo(
    () =>
      sessions
        .filter((s) => s.status === 'delivered')
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)),
    [sessions],
  )

  const available = delivered.filter((s) => s.recordingUrl).length

  function startEdit(session: ClassSession) {
    setEditingId(session.id)
    setDraft(session.recordingUrl ?? '')
    setError(null)
  }

  function save(session: ClassSession) {
    try {
      setSessionRecording(session.id, draft, actorUserId)
      setEditingId(null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save that link.')
    }
  }

  const columns: Array<Column<ClassSession>> = [
    {
      key: 'session',
      header: 'Session',
      pinned: true,
      minWidth: 280,
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
      cell: (row) => <span className="text-body-13">{formatDate(row.date)}</span>,
      sortValue: (row) => row.date,
      sortable: true,
    },
    {
      key: 'recording',
      header: 'Recording',
      minWidth: 340,
      cell: (row) => {
        if (editingId === row.id) {
          return (
            <div className="flex items-center gap-1.5">
              <Input
                inputSize="sm"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="https://recordings.cirvee.com/…"
                autoFocus
                className="min-w-0 flex-1"
              />
              <IconButton icon={Check} label="Save recording link" size="sm" onClick={() => save(row)} />
              <IconButton icon={X} label="Cancel" variant="ghost" size="sm" onClick={() => setEditingId(null)} />
            </div>
          )
        }
        return (
          <div className="flex items-center gap-2">
            {row.recordingUrl ? (
              <Button size="sm" variant="secondary" leftIcon={<PlayCircle size={14} />} asChild>
                <a href={row.recordingUrl} target="_blank" rel="noopener noreferrer">
                  Watch
                </a>
              </Button>
            ) : (
              <Badge tone="neutral" variant="subtle" size="sm">
                Not added yet
              </Badge>
            )}
            <IconButton
              icon={Link2}
              label={row.recordingUrl ? 'Edit recording link' : 'Add recording link'}
              variant="ghost"
              size="sm"
              onClick={() => startEdit(row)}
            />
          </div>
        )
      },
    },
  ]

  return (
    <TeachingCard
      title="Recordings"
      description={`${available} of ${delivered.length} delivered session${delivered.length === 1 ? '' : 's'} have a recording linked`}
    >
      {error && (
        <Alert tone="danger" title="Could not save" onDismiss={() => setError(null)} className="mx-6 mt-4">
          {error}
        </Alert>
      )}
      <DataTable
        data={delivered}
        columns={columns}
        rowKey={(row) => row.id}
        bordered={false}
        minWidth={900}
        density="compact"
        caption="Recording links for this cohort's delivered sessions"
        emptyTitle="No sessions delivered yet"
        emptyMessage="Once a session's status is Delivered, its recording link can be added here."
      />
    </TeachingCard>
  )
}
