import { useMemo, useState } from 'react'
import { BadgeCheck, Send, Star, Target } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
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
import { reviewRequestsCollection, useCollection } from '@/mocks'
import type { Channel, ReviewRequest } from '@/mocks'

import { sendReviewRequest, triggerEvents, type TriggerEvent } from './writes'
import {
  CHANNEL_LABEL,
  ErrorPanel,
  MOMENT_LABEL,
  MOMENTS,
  agoLabel,
  average,
  daysAgo,
  isThisMonth,
  isWithin30Days,
  useBranchName,
  useCohortCode,
  useModuleData,
  usePersonName,
} from './parts'

const PAGE_SIZE = 25
const CHANNELS: Channel[] = ['whatsapp', 'email', 'sms', 'in_app']

function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1))
}

export default function Requests() {
  const allRequests = useCollection(reviewRequestsCollection)
  const { loading, error, rows: requests, retry } = useModuleData(allRequests, 'reputation.requests')

  const personName = usePersonName()
  const branchName = useBranchName()
  const cohortCode = useCohortCode()

  const [search, setSearch] = useState('')
  const initial = useQueryState()
  const [filters, setFilters] = useState<FilterValues>(() => ({
    moment: initial.get('moment') ?? initial.get('trigger'),
    channel: initial.get('channel'),
    outcome: initial.get('outcome'),
  }))
  const [page, setPage] = useState(1)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const waiting = useMemo(() => triggerEvents().length, [allRequests])

  const occurredAt = useMemo(() => {
    const map = new Map<string, string>()
    for (const event of triggerEvents({ excludeAlreadyRequested: false })) {
      map.set(`${event.sourceEventType}:${event.sourceEventId}`, event.occurredAt)
    }
    return map
  }, [allRequests])

  const figures = useMemo(() => {
    const reviewed = requests.filter((r) => r.reviewed)
    const ratings = reviewed.map((r) => r.rating).filter((v): v is number => v !== null)
    return {
      sent: requests.length,
      askedThisMonth: requests.filter((r) => isThisMonth(r.sentAt)).length,
      asked30d: requests.filter((r) => isWithin30Days(r.sentAt)).length,
      reviewed: reviewed.length,
      reviewed30d: reviewed.filter((r) => isWithin30Days(r.sentAt)).length,
      ratings: ratings.length,
      averageRating: average(ratings),
    }
  }, [requests])
  const conversion = percent(figures.reviewed, figures.sent)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return requests
      .filter((request) => {
        if (filters.moment && request.triggerMoment !== filters.moment) return false
        if (filters.channel && request.channel !== filters.channel) return false
        if (filters.outcome === 'reviewed' && !request.reviewed) return false
        if (filters.outcome === 'not_reviewed' && request.reviewed) return false
        if (filters.outcome === 'unopened' && request.openedAt !== null) return false
        if (!term) return true
        return (
          personName(request.personId).toLowerCase().includes(term) ||
          MOMENT_LABEL[request.triggerMoment].toLowerCase().includes(term) ||
          cohortCode(request.cohortId).toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  }, [requests, filters, search, personName, cohortCode])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const momentWhen = (row: ReviewRequest): string => {
    const at = occurredAt.get(`${row.sourceEventType}:${row.sourceEventId}`)
    return at ? agoLabel(at) : `asked ${agoLabel(row.sentAt)}`
  }

  const columns: Array<Column<ReviewRequest>> = [
    {
      key: 'person',
      header: 'Person',
      pinned: true,
      minWidth: 200,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    {
      key: 'moment',
      header: 'The moment',
      minWidth: 240,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block text-body-13 text-text">{MOMENT_LABEL[row.triggerMoment]}</span>
          <span className="block text-body-12 text-text-secondary">{momentWhen(row)}</span>
        </span>
      ),
      sortValue: (row) => MOMENT_LABEL[row.triggerMoment],
      sortable: true,
    },
    {
      key: 'sent',
      header: 'Asked',
      width: 180,
      accessor: (row) => formatDateTime(row.sentAt),
      sortValue: (row) => row.sentAt,
      sortable: true,
    },
    {
      key: 'channel',
      header: 'Channel',
      width: 124,
      accessor: (row) => CHANNEL_LABEL[row.channel],
      sortValue: (row) => CHANNEL_LABEL[row.channel],
      sortable: true,
    },
    {
      key: 'opened',
      header: 'Opened',
      width: 140,
      cell: (row) =>
        row.openedAt ? (
          <span className="text-body-13">{formatDate(row.openedAt)}</span>
        ) : (
          <Badge tone="neutral" size="sm">
            Not opened
          </Badge>
        ),
      sortValue: (row) => row.openedAt ?? '',
      sortable: true,
    },
    {
      key: 'clicked',
      header: 'Clicked',
      width: 140,
      cell: (row) =>
        row.clickedAt ? (
          <span className="text-body-13">{formatDate(row.clickedAt)}</span>
        ) : (
          <Badge tone="neutral" size="sm">
            No click
          </Badge>
        ),
      sortValue: (row) => row.clickedAt ?? '',
      sortable: true,
    },
    {
      key: 'reviewed',
      header: 'Left a review',
      width: 136,
      cell: (row) => (
        <Badge tone={row.reviewed ? 'success' : 'neutral'} size="sm">
          {row.reviewed ? 'Yes' : 'Not yet'}
        </Badge>
      ),
      sortValue: (row) => (row.reviewed ? 1 : 0),
      sortable: true,
    },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      width: 132,
      cell: (row) =>
        row.rating === null ? (
          <span className="text-text-secondary">—</span>
        ) : (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Star size={14} aria-hidden="true" />
            {row.rating.toFixed(1)}
          </span>
        ),
      sortValue: (row) => row.rating ?? -1,
      sortable: true,
    },
    {
      key: 'branch',
      header: 'Branch',
      width: 140,
      accessor: (row) => branchName(row.branchId),
      sortValue: (row) => branchName(row.branchId),
      sortable: true,
    },
    {
      key: 'cohort',
      header: 'Cohort',
      width: 120,
      accessor: (row) => cohortCode(row.cohortId),
      sortValue: (row) => cohortCode(row.cohortId),
      sortable: true,
    },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-13 text-text-secondary">
          {waiting === 0
            ? 'Nobody is waiting to be asked right now.'
            : `${formatNumber(waiting)} ${waiting === 1 ? 'person has' : 'people have'} just had a good moment and not been asked yet.`}
        </p>
        <Button size="sm" leftIcon={<Send size={16} aria-hidden="true" />} onClick={() => setSending(true)}>
          Send a request
        </Button>
      </div>

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="Review requests" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Average rating"
              value={figures.averageRating === null ? 'No ratings yet' : `${figures.averageRating.toFixed(1)} of 5`}
              icon={Star}
              variant={(figures.averageRating ?? 0) >= 4.5 ? 'success' : 'default'}
              caption={`Across ${formatNumber(figures.ratings)} rated reviews`}
              loading={loading}
            />
            <StatCard
              label="Reviews left"
              value={formatNumber(figures.reviewed)}
              icon={BadgeCheck}
              caption={`${formatNumber(figures.reviewed30d)} in the last 30 days`}
              loading={loading}
            />
            <StatCard
              label="Asked this month"
              value={formatNumber(figures.askedThisMonth)}
              icon={Send}
              caption={`${formatNumber(figures.asked30d)} in the last 30 days`}
              loading={loading}
            />
            <StatCard
              label="Turned into a review"
              value={formatPercent(conversion)}
              icon={Target}
              variant={conversion >= 20 ? 'success' : 'default'}
              caption={`${formatNumber(figures.reviewed)} of ${formatNumber(figures.sent)} asked`}
              loading={loading}
            />
          </div>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={(value) => {
                    setSearch(value)
                    setPage(1)
                  }}
                  searchPlaceholder="Search by person, moment or cohort"
                  values={filters}
                  onFilterChange={(key, value) => {
                    setFilters((prev) => ({ ...prev, [key]: value }))
                    setPage(1)
                  }}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'moment',
                      label: 'Moment',
                      options: MOMENTS.map((moment) => ({ value: moment, label: MOMENT_LABEL[moment] })),
                    },
                    {
                      key: 'channel',
                      label: 'Channel',
                      options: CHANNELS.map((channel) => ({ value: channel, label: CHANNEL_LABEL[channel] })),
                    },
                    {
                      key: 'outcome',
                      label: 'Outcome',
                      options: [
                        { value: 'reviewed', label: 'Left a review' },
                        { value: 'not_reviewed', label: 'No review yet' },
                        { value: 'unopened', label: 'Never opened' },
                      ],
                    },
                  ]}
                />
              </TableToolbar>

              <DataTable
                data={pageRows}
                columns={columns}
                rowKey={(row) => row.id}
                loading={loading}
                density="compact"
                minWidth={1800}
                bordered={false}
                caption="Review requests, the moment each one was asked on, channel, open, click, review and rating"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No requests match these filters"
                      message="Try another moment or channel, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Send}
                      title="Nobody has been asked for a review yet"
                      message="A request is sent after something good happened: a certificate, a strong grade, a placement. Pick one of those moments to ask on."
                      action={
                        <Button size="sm" onClick={() => setSending(true)}>
                          Send the first request
                        </Button>
                      }
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
                    itemNoun="requests"
                    divided={false}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <SendRequestModal
        open={sending}
        onClose={() => setSending(false)}
        onSent={(message) => {
          setSending(false)
          setNotice(message)
        }}
      />
    </>
  )
}

function SendRequestModal({
  open,
  onClose,
  onSent,
}: {
  open: boolean
  onClose: () => void
  onSent: (message: string) => void
}) {
  const requests = useCollection(reviewRequestsCollection)
  const [momentFilter, setMomentFilter] = useState('')
  const [eventKey, setEventKey] = useState('')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [touched, setTouched] = useState(false)

  const events = useMemo(() => triggerEvents(), [requests])
  const available = momentFilter ? events.filter((event) => event.triggerMoment === momentFilter) : events
  const chosen: TriggerEvent | undefined = available.find((event) => event.key === eventKey)

  const eventError = touched && !chosen ? 'Pick who to ask, and the moment that earned it.' : undefined
  const stale = chosen ? daysAgo(chosen.occurredAt) : 0

  const submit = () => {
    setTouched(true)
    if (!chosen) return
    sendReviewRequest(chosen, channel)
    onSent(
      `Asked ${chosen.personName} for a review on ${CHANNEL_LABEL[channel]} — ${MOMENT_LABEL[chosen.triggerMoment].toLowerCase()}, ${agoLabel(chosen.occurredAt)}.`,
    )
    setEventKey('')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Ask for a review"
      description="Pick a real moment that just went well. Each one can be asked on once."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={available.length === 0}>
            Send request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Moment" optional hint="Narrows the list below.">
          <Select
            value={momentFilter}
            placeholder="Any moment"
            options={MOMENTS.map((moment) => ({
              value: moment,
              label: `${MOMENT_LABEL[moment]} · ${formatNumber(events.filter((e) => e.triggerMoment === moment).length)} waiting`,
            }))}
            onChange={(e) => {
              setMomentFilter(e.target.value)
              setEventKey('')
            }}
          />
        </Field>

        <Field
          label="Who, and what happened"
          required
          error={eventError}
          hint={
            available.length === 0
              ? 'Nobody with this moment is waiting to be asked.'
              : `${formatNumber(available.length)} ${available.length === 1 ? 'person has' : 'people have'} not been asked yet.`
          }
        >
          <Select
            value={eventKey}
            placeholder={available.length === 0 ? 'Nobody waiting' : 'Choose a person'}
            disabled={available.length === 0}
            options={available.slice(0, 200).map((event) => ({
              value: event.key,
              label: `${event.personName} — ${event.summary} · ${agoLabel(event.occurredAt)}`,
            }))}
            onChange={(e) => setEventKey(e.target.value)}
          />
        </Field>

        {chosen && (
          <div className="rounded-xl border border-border bg-surface-sunken px-4 py-3">
            <p className="text-body-14 text-text">
              {chosen.personName} · {MOMENT_LABEL[chosen.triggerMoment]} {agoLabel(chosen.occurredAt)}
            </p>
            <p className="mt-0.5 text-body-13 text-text-secondary">{chosen.summary}</p>
            {stale > 30 && (
              <p className="mt-2 text-body-12 text-warning-text">
                This was {formatNumber(stale)} days ago. A late ask converts poorly and reads as a campaign rather than a
                thank-you.
              </p>
            )}
          </div>
        )}

        <Field label="Channel" required hint="Whichever channel this person already answers on.">
          <Select
            value={channel}
            options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
            onChange={(e) => setChannel(e.target.value as Channel)}
          />
        </Field>
      </div>
    </Modal>
  )
}
