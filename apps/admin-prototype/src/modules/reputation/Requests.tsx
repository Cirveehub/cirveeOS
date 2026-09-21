/**
 * Review requests.
 *
 * Every row names the moment that fired it. That column is the whole control:
 * a request that cannot name a high-satisfaction event should not have been
 * sent, and a request is never sweetened — no reward, no discount, no
 * incentive, ever.
 */
import { useMemo, useState } from 'react'
import { Send, ShieldAlert, Star } from 'lucide-react'

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

import { daysSince, sendReviewRequest, triggerEvents, type TriggerEvent } from './writes'

import {
  CHANNEL_LABEL,
  ErrorPanel,
  ModuleHeader,
  REVIEW_COMPLIANCE_NOTE,
  Screen,
  TRIGGER_LABEL,
  TRIGGER_ORDER,
  average,
  isWithin30Days,
  percent,
  useBranchName,
  useCohortCode,
  useModuleData,
  usePersonName,
} from './parts'

const PAGE_SIZE = 25

export default function Requests() {
  const allRequests = useCollection(reviewRequestsCollection)
  const { loading, error, rows: requests, retry } = useModuleData(allRequests, 'reputation.requests')

  const personName = usePersonName()
  const branchName = useBranchName()
  const cohortCode = useCohortCode()

  const [search, setSearch] = useState('')
  const initial = useQueryState()
  const [filters, setFilters] = useState<FilterValues>(() => ({
    trigger: initial.get('trigger'),
    channel: initial.get('channel'),
    outcome: initial.get('outcome'),
  }))
  const [page, setPage] = useState(1)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const figures = useMemo(() => {
    const reviewed = requests.filter((r) => r.reviewed)
    const ratings = reviewed.map((r) => r.rating).filter((v): v is number => v !== null)
    return {
      sent: requests.length,
      sent30d: requests.filter((r) => isWithin30Days(r.sentAt)).length,
      opened: requests.filter((r) => r.openedAt !== null).length,
      reviewed: reviewed.length,
      averageRating: average(ratings),
    }
  }, [requests])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return requests
      .filter((request) => {
        if (filters.trigger && request.triggerMoment !== filters.trigger) return false
        if (filters.channel && request.channel !== filters.channel) return false
        if (filters.outcome === 'reviewed' && !request.reviewed) return false
        if (filters.outcome === 'not_reviewed' && request.reviewed) return false
        if (filters.outcome === 'unopened' && request.openedAt !== null) return false
        if (!term) return true
        return (
          personName(request.personId).toLowerCase().includes(term) ||
          TRIGGER_LABEL[request.triggerMoment].toLowerCase().includes(term) ||
          request.sourceEventType.toLowerCase().includes(term) ||
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
      key: 'trigger',
      header: 'Trigger moment',
      minWidth: 220,
      cell: (row) => (
        <Badge tone="accent" size="sm">
          {TRIGGER_LABEL[row.triggerMoment]}
        </Badge>
      ),
      sortValue: (row) => TRIGGER_LABEL[row.triggerMoment],
      sortable: true,
    },
    {
      key: 'source',
      header: 'Source event',
      minWidth: 220,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block text-body-13 text-text">{row.sourceEventType}</span>
          <span className="block font-mono text-body-12 text-text-secondary">{row.sourceEventId}</span>
        </span>
      ),
      sortValue: (row) => `${row.sourceEventType} ${row.sourceEventId}`,
      sortable: true,
    },
    {
      key: 'sent',
      header: 'Sent',
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
      header: 'Reviewed',
      width: 136,
      cell: (row) => (
        <Badge tone={row.reviewed ? 'success' : 'neutral'} size="sm">
          {row.reviewed ? 'Yes' : 'No'}
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
          <span className="text-text-secondary">Not known</span>
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
    <Screen>
      <ModuleHeader
        title="Review requests"
        description="Sent on a high-satisfaction moment, never at random and never sweetened."
        actions={
          <Button size="sm" leftIcon={<Send size={16} aria-hidden="true" />} onClick={() => setSending(true)}>
            Send a request
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="Review requests" />
      ) : (
        <>
          <Alert tone="warning" icon={ShieldAlert} title="Never incentivise a review">
            {REVIEW_COMPLIANCE_NOTE} The trigger column below is the control: every request names the
            event that earned it. Nothing is offered in return, on any channel, for any rating.
          </Alert>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Requests sent"
              value={formatNumber(figures.sent)}
              icon={Send}
              caption={`${formatNumber(figures.sent30d)} in the last 30 days`}
              loading={loading}
            />
            <StatCard
              label="Opened"
              value={formatPercent(percent(figures.opened, figures.sent))}
              icon={Send}
              caption={`${formatNumber(figures.opened)} of ${formatNumber(figures.sent)} requests`}
              loading={loading}
            />
            <StatCard
              label="Conversion to review"
              value={formatPercent(percent(figures.reviewed, figures.sent))}
              icon={Star}
              variant={percent(figures.reviewed, figures.sent) >= 20 ? 'success' : 'default'}
              caption={`${formatNumber(figures.reviewed)} reviews left`}
              loading={loading}
            />
            <StatCard
              label="Average rating"
              value={figures.averageRating === null ? 'No ratings yet' : `${figures.averageRating.toFixed(1)} of 5`}
              icon={Star}
              caption="Where the rating could be matched back"
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
                  searchPlaceholder="Search by person, trigger moment, source event or cohort"
                  values={filters}
                  onFilterChange={(key, value) => {
                    setFilters((prev) => ({ ...prev, [key]: value }))
                    setPage(1)
                  }}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'trigger',
                      label: 'Trigger moment',
                      options: TRIGGER_ORDER.map((trigger) => ({
                        value: trigger,
                        label: TRIGGER_LABEL[trigger],
                      })),
                    },
                    {
                      key: 'channel',
                      label: 'Channel',
                      options: (['whatsapp', 'email', 'sms', 'in_app'] as const).map((channel) => ({
                        value: channel,
                        label: CHANNEL_LABEL[channel],
                      })),
                    },
                    {
                      key: 'outcome',
                      label: 'Outcome',
                      options: [
                        { value: 'reviewed', label: 'Left a review' },
                        { value: 'not_reviewed', label: 'No review' },
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
                minWidth={2200}
                bordered={false}
                caption="Review requests with the trigger moment and source event that fired them, channel, open, click, review and rating"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No requests match these filters"
                      message="Try another trigger moment or channel, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Send}
                      title="No review requests sent"
                      message="Requests fire off a certificate being issued, a strong grade coming back or a placement being confirmed. With no such event, there is no honest moment to ask, and asking anyway is how a listing collects two-star reviews."
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
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Send a request                                                             */
/* -------------------------------------------------------------------------- */

/**
 * The form has no message field and no offer field — deliberately. A request
 * is a well-timed ask against a named event and nothing more; the compliance
 * note sits above the form because this is the screen where somebody would be
 * tempted to sweeten it.
 */
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
  const [triggerFilter, setTriggerFilter] = useState('')
  const [eventKey, setEventKey] = useState('')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [touched, setTouched] = useState(false)

  /* Recomputed whenever a request lands, so an event never appears twice. */
  const events = useMemo(() => triggerEvents(), [requests])
  const available = triggerFilter
    ? events.filter((event) => event.triggerMoment === triggerFilter)
    : events
  const chosen: TriggerEvent | undefined = available.find((event) => event.key === eventKey)

  const eventError = touched && !chosen ? 'Choose the event this request hangs off.' : undefined
  const stale = chosen ? daysSince(chosen.occurredAt) : 0

  const submit = () => {
    setTouched(true)
    if (!chosen) return
    sendReviewRequest(chosen, channel)
    onSent(
      `Request sent to ${chosen.personName} on ${CHANNEL_LABEL[channel]}, tied to ${TRIGGER_LABEL[chosen.triggerMoment].toLowerCase()}.`,
    )
    setEventKey('')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Send a review request"
      description="Pick the event that earned the ask. Only events that already happened appear here, and each one can be asked on once."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Send request</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning" icon={ShieldAlert} title="Never incentivise a review">
          {REVIEW_COMPLIANCE_NOTE} There is no message or offer on this form on purpose — the timing is
          the whole technique.
        </Alert>

        <Field label="Trigger moment" optional hint="Narrows the list below. Leave it empty to see every event.">
          <Select
            value={triggerFilter}
            placeholder="Every trigger moment"
            options={TRIGGER_ORDER.map((trigger) => ({
              value: trigger,
              label: `${TRIGGER_LABEL[trigger]} · ${formatNumber(events.filter((e) => e.triggerMoment === trigger).length)} available`,
            }))}
            onChange={(e) => {
              setTriggerFilter(e.target.value)
              setEventKey('')
            }}
          />
        </Field>

        <Field
          label="Event"
          required
          error={eventError}
          hint={
            available.length === 0
              ? 'No event of this kind is waiting to be asked on. That is not a reason to ask anyway.'
              : `${formatNumber(available.length)} events have not been asked on yet.`
          }
        >
          <Select
            value={eventKey}
            placeholder={available.length === 0 ? 'Nothing available' : 'Choose an event'}
            disabled={available.length === 0}
            options={available.slice(0, 200).map((event) => ({
              value: event.key,
              label: `${event.personName} — ${event.summary} · ${formatDate(event.occurredAt)}`,
            }))}
            onChange={(e) => setEventKey(e.target.value)}
          />
        </Field>

        {chosen && (
          <div className="rounded-xl border border-border bg-surface-sunken px-4 py-3">
            <p className="text-label-11 text-text-label">What the request will record</p>
            <p className="mt-1 text-body-14 text-text">
              {chosen.personName} · {TRIGGER_LABEL[chosen.triggerMoment]}
            </p>
            <p className="mt-0.5 font-mono text-body-12 text-text-secondary">
              {chosen.sourceEventType} {chosen.sourceEventId}
            </p>
            {stale > 30 && (
              <p className="mt-2 text-body-12 text-warning-text">
                This happened {formatNumber(stale)} days ago. A late ask converts poorly and reads as a
                campaign rather than a thank-you.
              </p>
            )}
          </div>
        )}

        <Field label="Channel" required hint="Whichever channel this person already answers on.">
          <Select
            value={channel}
            options={(['whatsapp', 'email', 'sms', 'in_app'] as const).map((c) => ({
              value: c,
              label: CHANNEL_LABEL[c],
            }))}
            onChange={(e) => setChannel(e.target.value as Channel)}
          />
        </Field>
      </div>
    </Modal>
  )
}
