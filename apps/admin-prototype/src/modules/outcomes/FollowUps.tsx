/**
 * The follow-up queue — one row per checkpoint, not per graduate.
 *
 * Each outcome record carries three checkpoints, scheduled automatically at 3,
 * 6 and 12 months when the certificate is issued. This screen flattens them so
 * the work is a queue rather than a hunt through records.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Send } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  Pagination,
  Select,
  StatCard,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { TODAY, outcomeRecordsCollection, useCollection } from '@/mocks'
import type { Channel, OutcomeCheckpoint, OutcomeRecord } from '@/mocks'

import { recordCheckpointAttempt } from './writes'

import {
  CHANNEL_LABEL,
  CHECKPOINT_STATUS_LABEL,
  CHECKPOINT_STATUS_TONE,
  ErrorPanel,
  ModuleHeader,
  Screen,
  daysOverdue,
  useCohortCode,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'

const PAGE_SIZE = 25

interface QueueRow {
  id: string
  record: OutcomeRecord
  checkpoint: OutcomeCheckpoint
}

export default function FollowUps() {
  const navigate = useNavigate()

  const allRecords = useCollection(outcomeRecordsCollection)
  const { loading, error, rows: records, retry } = useModuleData(allRecords, 'outcomes.followUps')

  const personName = usePersonName()
  const cohortCode = useCohortCode()
  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({ state: 'outstanding' })
  const [page, setPage] = useState(1)
  const [contacting, setContacting] = useState<QueueRow | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const queue = useMemo<QueueRow[]>(
    () =>
      records.flatMap((record) =>
        record.checkpoints.map((checkpoint) => ({
          id: `${record.id}-${checkpoint.month}`,
          record,
          checkpoint,
        })),
      ),
    [records],
  )

  const figures = useMemo(() => {
    const overdue = queue.filter(
      (row) => row.checkpoint.dueDate < TODAY && row.checkpoint.status !== 'responded',
    )
    const dueToday = queue.filter((row) => row.checkpoint.dueDate === TODAY)
    const noResponse = queue.filter((row) => row.checkpoint.status === 'no_response')
    const threeAttempts = queue.filter((row) => row.checkpoint.attempts >= 3 && row.checkpoint.status !== 'responded')
    return { overdue: overdue.length, dueToday: dueToday.length, noResponse: noResponse.length, threeAttempts: threeAttempts.length }
  }, [queue])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return queue
      .filter(({ record, checkpoint }) => {
        if (filters.state === 'outstanding' && (checkpoint.status === 'responded' || checkpoint.dueDate > TODAY)) {
          return false
        }
        if (filters.state === 'overdue' && !(checkpoint.dueDate < TODAY && checkpoint.status !== 'responded')) {
          return false
        }
        if (filters.state === 'upcoming' && checkpoint.dueDate <= TODAY) return false
        if (filters.month && String(checkpoint.month) !== filters.month) return false
        if (filters.status && checkpoint.status !== filters.status) return false
        if (!term) return true
        return (
          personName(record.personId).toLowerCase().includes(term) ||
          cohortCode(record.cohortId).toLowerCase().includes(term)
        )
      })
      .sort((a, b) => a.checkpoint.dueDate.localeCompare(b.checkpoint.dueDate))
  }, [queue, filters, search, personName, cohortCode])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.entries(filters).some(([, value]) => Boolean(value))
  const clear = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const columns: Array<Column<QueueRow>> = [
    {
      key: 'graduate',
      header: 'Graduate',
      pinned: true,
      minWidth: 200,
      accessor: (row) => personName(row.record.personId),
      sortValue: (row) => personName(row.record.personId),
      sortable: true,
    },
    {
      key: 'cohort',
      header: 'Cohort',
      width: 110,
      accessor: (row) => cohortCode(row.record.cohortId),
      sortValue: (row) => cohortCode(row.record.cohortId),
      sortable: true,
    },
    {
      key: 'checkpoint',
      header: 'Checkpoint',
      width: 130,
      cell: (row) => (
        <Badge tone="neutral" size="sm">
          {row.checkpoint.month} month
        </Badge>
      ),
      sortValue: (row) => row.checkpoint.month,
      sortable: true,
    },
    {
      key: 'due',
      header: 'Due date',
      width: 124,
      accessor: (row) => formatDate(row.checkpoint.dueDate),
      sortValue: (row) => row.checkpoint.dueDate,
      sortable: true,
    },
    {
      key: 'overdue',
      header: 'Days overdue',
      align: 'right',
      width: 146,
      cell: (row) => {
        if (row.checkpoint.status === 'responded') return <span className="text-text-secondary">Closed</span>
        const days = daysOverdue(row.checkpoint.dueDate)
        if (days === 0) return <span className="text-text-secondary">Not yet due</span>
        return <span className={`tabular-nums ${days > 30 ? 'text-danger-text' : 'text-warning-text'}`}>{formatNumber(days)}</span>
      },
      sortValue: (row) => (row.checkpoint.status === 'responded' ? -1 : daysOverdue(row.checkpoint.dueDate)),
      sortable: true,
    },
    {
      key: 'attempts',
      header: 'Attempts',
      align: 'right',
      width: 110,
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.checkpoint.attempts)}</span>,
      sortValue: (row) => row.checkpoint.attempts,
      sortable: true,
    },
    {
      key: 'channel',
      header: 'Last channel',
      width: 140,
      accessor: (row) =>
        row.checkpoint.lastChannel ? (
          CHANNEL_LABEL[row.checkpoint.lastChannel]
        ) : (
          <span className="text-text-secondary">Not contacted</span>
        ),
      sortValue: (row) => row.checkpoint.lastChannel ?? '',
      sortable: true,
    },
    {
      key: 'lastAttempt',
      header: 'Last attempt',
      width: 190,
      accessor: (row) =>
        row.checkpoint.respondedAt ? (
          formatDateTime(row.checkpoint.respondedAt)
        ) : row.checkpoint.attempts > 0 ? (
          `On or after ${formatDate(row.checkpoint.dueDate)}`
        ) : (
          <span className="text-text-secondary">None</span>
        ),
      sortValue: (row) => row.checkpoint.respondedAt ?? row.checkpoint.dueDate,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 146,
      cell: (row) => (
        <Badge tone={CHECKPOINT_STATUS_TONE[row.checkpoint.status]} size="sm">
          {CHECKPOINT_STATUS_LABEL[row.checkpoint.status]}
        </Badge>
      ),
      sortValue: (row) => row.checkpoint.status,
      sortable: true,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      minWidth: 170,
      accessor: (row) =>
        row.record.verifiedByUserId ? (
          userName(row.record.verifiedByUserId)
        ) : (
          <span className="text-text-secondary">Unassigned</span>
        ),
      sortValue: (row) => (row.record.verifiedByUserId ? userName(row.record.verifiedByUserId) : ''),
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 140,
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Send size={16} aria-hidden="true" />}
          onClick={(event) => {
            event.stopPropagation()
            setContacting(row)
          }}
        >
          Contact
        </Button>
      ),
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Follow-up queue"
        description="Three checkpoints per graduate, scheduled at certification. This is the work that keeps the placement rate honest."
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="The follow-up queue" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Overdue"
              value={loading ? '—' : formatNumber(figures.overdue)}
              icon={CalendarClock}
              variant={figures.overdue > 0 ? 'warning' : 'default'}
              caption="Past the due date with no answer"
              loading={loading}
            />
            <StatCard
              label="Due today"
              value={loading ? '—' : formatNumber(figures.dueToday)}
              icon={CalendarClock}
              caption={`Checkpoints dated ${formatDate(TODAY)}`}
              loading={loading}
            />
            <StatCard
              label="Marked no response"
              value={loading ? '—' : formatNumber(figures.noResponse)}
              icon={Send}
              variant={figures.noResponse > 0 ? 'warning' : 'default'}
              caption="Chased and closed without an answer"
              loading={loading}
            />
            <StatCard
              label="Three attempts or more"
              value={loading ? '—' : formatNumber(figures.threeAttempts)}
              icon={Send}
              caption="Still open after three tries"
              loading={loading}
            />
          </div>

          <Alert className="mt-6" tone="info" title="A silent graduate is still a tracked graduate">
            Chasing stops after three attempts and the checkpoint is marked no response. The record
            stays in the denominator of the placement rate — dropping it would flatter the number.
          </Alert>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={(value) => {
                    setSearch(value)
                    setPage(1)
                  }}
                  searchPlaceholder="Search by graduate or cohort"
                  values={filters}
                  onFilterChange={(key, value) => {
                    setFilters((prev) => ({ ...prev, [key]: value }))
                    setPage(1)
                  }}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'state',
                      label: 'Queue',
                      options: [
                        { value: 'outstanding', label: 'Outstanding' },
                        { value: 'overdue', label: 'Overdue' },
                        { value: 'upcoming', label: 'Not yet due' },
                      ],
                    },
                    {
                      key: 'month',
                      label: 'Checkpoint',
                      options: [
                        { value: '3', label: '3 month' },
                        { value: '6', label: '6 month' },
                        { value: '12', label: '12 month' },
                      ],
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      options: (
                        ['scheduled', 'sent', 'responded', 'no_response'] as OutcomeCheckpoint['status'][]
                      ).map((status) => ({ value: status, label: CHECKPOINT_STATUS_LABEL[status] })),
                    },
                  ]}
                />
              </TableToolbar>

              <DataTable
                data={pageRows}
                columns={columns}
                rowKey={(row) => row.id}
                loading={loading}
                onRowClick={(row) => navigate(`/outcomes/records/${row.record.id}`)}
                density="compact"
                minWidth={1900}
                bordered={false}
                caption="Follow-up checkpoints with graduate, cohort, due date, days overdue, attempts, channel, status and assignee"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No follow-ups match these filters"
                      message="Try a different checkpoint or status, or clear the search to see the whole queue."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={CalendarClock}
                      title="Nothing to follow up"
                      message="Checkpoints are scheduled automatically at 3, 6 and 12 months when a certificate is issued. An empty queue means every one of them has been answered or closed."
                    />
                  )
                }
              />

              {rows.length > 0 && (
                <div className="px-4 py-3">
                  <Pagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    total={rows.length}
                    onPageChange={setPage}
                    itemNoun="follow-ups"
                    divided={false}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <ContactModal
        row={contacting}
        personName={personName}
        onClose={() => setContacting(null)}
        onDone={(message) => {
          setContacting(null)
          setNotice(message)
        }}
      />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Record a follow-up attempt                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The attempt is recorded whether or not the graduate answers. "No response"
 * is a real outcome and stays in the denominator — a checkpoint is never
 * quietly dropped because nobody picked up.
 */
function ContactModal({
  row,
  personName,
  onClose,
  onDone,
}: {
  row: QueueRow | null
  personName: (id: string | null | undefined) => string
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [outcome, setOutcome] = useState<'sent' | 'responded' | 'no_response'>('sent')

  const submit = () => {
    if (!row) return
    recordCheckpointAttempt(row.record, row.checkpoint.month, channel, outcome)
    onDone(
      outcome === 'responded'
        ? `${personName(row.record.personId)} answered the ${row.checkpoint.month} month checkpoint. Update their outcome from the record.`
        : `Attempt ${row.checkpoint.attempts + 1} recorded against ${personName(row.record.personId)}'s ${row.checkpoint.month} month checkpoint.`,
    )
  }

  return (
    <Modal
      open={row !== null}
      onClose={onClose}
      size="sm"
      title="Record a follow-up"
      description={
        row
          ? `${personName(row.record.personId)} · ${row.checkpoint.month} month checkpoint, ${formatNumber(row.checkpoint.attempts)} attempts so far.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Record attempt</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Channel" required>
          <Select
            value={channel}
            options={(['whatsapp', 'email', 'sms', 'in_app'] as const).map((c) => ({
              value: c,
              label: CHANNEL_LABEL[c],
            }))}
            onChange={(e) => setChannel(e.target.value as Channel)}
          />
        </Field>
        <Field
          label="What happened"
          required
          hint="No response is a real result. It keeps the graduate in the denominator rather than dropping them."
        >
          <Select
            value={outcome}
            options={[
              { value: 'sent', label: 'Sent — waiting on a reply' },
              { value: 'responded', label: 'They answered' },
              { value: 'no_response', label: 'No response — closing this checkpoint' },
            ]}
            onChange={(e) => setOutcome(e.target.value as typeof outcome)}
          />
        </Field>
      </div>
    </Modal>
  )
}
