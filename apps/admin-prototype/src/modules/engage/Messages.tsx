import { useMemo, useState } from 'react'

import { formatDateTime, humanize } from '@/lib/format'
import {
  Badge,
  Card,
  DataTable,
  FilterBar,
  Pagination,
  PersonChip,
  StatusBadge,
  type Column,
  type FilterValues,
} from '@/ui'
import {
  campaignsCollection,
  messagesCollection,
  messageTemplatesCollection,
  useCollection,
  type Message,
} from '@/mocks'

import { ModuleHeader, ErrorPanel, Screen, useModuleData, usePersonName } from './parts'

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-app',
}

export default function EngageMessages() {
  const messages = useCollection(messagesCollection)
  const campaigns = useCollection(campaignsCollection)
  const templates = useCollection(messageTemplatesCollection)
  const personName = usePersonName()

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  const { loading, error, rows, retry } = useModuleData(messages, 'engage.messages')

  const sourceLabel = (m: Message): string => {
    if (m.sourceType === 'campaign' && m.sourceId) {
      return campaigns.find((c) => (c.id as string) === m.sourceId)?.name ?? `Campaign ${m.sourceId}`
    }
    if (m.sourceType === 'automation' && m.sourceId) return `Automation run ${m.sourceId}`
    return humanize(m.sourceType)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((m) => {
        if (filters.channel && m.channel !== filters.channel) return false
        if (filters.status && m.status !== filters.status) return false
        if (filters.direction && m.direction !== filters.direction) return false
        if (filters.source && m.sourceType !== filters.source) return false
        if (q && !personName(m.personId).toLowerCase().includes(q) && !m.preview.toLowerCase().includes(q))
          return false
        return true
      })
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  }, [rows, filters, search, personName])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const hasFilters = search.length > 0 || Object.values(filters).some(Boolean)

  const columns: Array<Column<Message>> = [
    {
      key: 'sentAt',
      header: 'Timestamp',
      sortable: true,
      sortValue: (m) => m.sentAt,
      accessor: (m) => formatDateTime(m.sentAt),
      width: 170,
    },
    {
      key: 'person',
      header: 'Person',
      sortable: true,
      sortValue: (m) => personName(m.personId),
      cell: (m) => <PersonChip name={personName(m.personId)} size="sm" />,
      minWidth: 200,
    },
    {
      key: 'channel',
      header: 'Channel',
      sortable: true,
      sortValue: (m) => m.channel,
      accessor: (m) => CHANNEL_LABEL[m.channel] ?? m.channel,
      width: 110,
    },
    {
      key: 'direction',
      header: 'Direction',
      sortable: true,
      sortValue: (m) => m.direction,
      cell: (m) => (
        <Badge tone={m.direction === 'inbound' ? 'info' : 'neutral'} size="sm">
          {m.direction === 'inbound' ? 'Inbound' : 'Outbound'}
        </Badge>
      ),
      width: 110,
    },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      sortValue: sourceLabel,
      accessor: sourceLabel,
      minWidth: 220,
      className: 'text-text-secondary',
    },
    {
      key: 'template',
      header: 'Template',
      sortable: true,
      sortValue: (m) => (m.templateId ? (templates.find((t) => t.id === m.templateId)?.name ?? '') : ''),
      accessor: (m) =>
        m.templateId ? (templates.find((t) => t.id === m.templateId)?.name ?? 'Unknown') : 'Ad hoc',
      minWidth: 180,
      className: 'text-text-secondary',
    },
    {
      key: 'preview',
      header: 'Subject or preview',
      accessor: (m) => m.subject ?? m.preview,
      minWidth: 320,
      className: 'text-text-secondary',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (m) => m.status,
      cell: (m) => <StatusBadge status={m.status} />,
      width: 130,
    },
    {
      key: 'failure',
      header: 'Failure reason',
      accessor: (m) => m.failureReason ?? '—',
      minWidth: 260,
      cell: (m) =>
        m.failureReason ? (
          <span className="text-danger-text">{m.failureReason}</span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
    },
    {
      key: 'retries',
      header: 'Retries',
      align: 'right',
      sortable: true,
      sortValue: (m) => m.retryCount,
      accessor: (m) => String(m.retryCount),
      width: 90,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Message history"
        description="Every message the system has sent or received, with the campaign or automation that caused it."
      />

      {error ? (
        <ErrorPanel what="Message history" onRetry={retry} />
      ) : (
        <Card padding="none">
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v)
              setPage(1)
            }}
            searchPlaceholder="Search person or message"
            values={filters}
            onFilterChange={(key, value) => {
              setFilters((f) => ({ ...f, [key]: value }))
              setPage(1)
            }}
            onClearAll={() => {
              setFilters({})
              setSearch('')
              setPage(1)
            }}
            filters={[
              {
                key: 'channel',
                label: 'Channel',
                options: Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label })),
              },
              {
                key: 'status',
                label: 'Status',
                options: [
                  'queued',
                  'sent',
                  'delivered',
                  'read',
                  'failed',
                  'bounced',
                  'unsubscribed',
                ].map((s) => ({ value: s, label: humanize(s) })),
              },
              {
                key: 'direction',
                label: 'Direction',
                options: [
                  { value: 'outbound', label: 'Outbound' },
                  { value: 'inbound', label: 'Inbound' },
                ],
              },
              {
                key: 'source',
                label: 'Source',
                options: [
                  { value: 'campaign', label: 'Campaign' },
                  { value: 'automation', label: 'Automation' },
                  { value: 'manual', label: 'Manual' },
                  { value: 'system', label: 'System' },
                ],
              },
            ]}
            className="px-4 py-3"
          />
          <DataTable
            data={paged}
            columns={columns}
            rowKey={(m) => m.id as string}
            loading={loading}
            density="compact"
            minWidth={1900}
            caption="Message history"
            emptyTitle={hasFilters ? 'No messages match these filters' : 'No messages yet'}
            emptyMessage={
              hasFilters
                ? 'Clear the filters to see the full history.'
                : 'Nothing has been sent or received. Campaigns and automations both write here.'
            }
          />
          {filtered.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size)
                setPage(1)
              }}
              itemNoun="message"
              className="px-4 py-3"
            />
          )}
        </Card>
      )}
    </Screen>
  )
}
