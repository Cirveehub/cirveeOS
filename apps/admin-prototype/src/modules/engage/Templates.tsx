import { useMemo, useState } from 'react'

import { formatDate, formatNumber } from '@/lib/format'
import { Badge, Card, DataTable, SearchInput, TableToolbar, type BadgeTone, type Column } from '@/ui'
import { messageTemplatesCollection, useCollection, type MessageTemplate } from '@/mocks'

import { CHANNEL_LABEL, ErrorPanel, useModuleData } from './parts'

const APPROVAL: Record<MessageTemplate['whatsappApprovalStatus'], { label: string; tone: BadgeTone }> = {
  approved: { label: 'Approved', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
  n_a: { label: 'Not applicable', tone: 'neutral' },
}

export default function EngageTemplates() {
  const templates = useCollection(messageTemplatesCollection)
  const [search, setSearch] = useState('')

  const { loading, error, rows, retry } = useModuleData(templates, 'engage.templates')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.preview.toLowerCase().includes(q),
    )
  }, [rows, search])

  const columns: Array<Column<MessageTemplate>> = [
    {
      key: 'name',
      header: 'Template',
      sortable: true,
      sortValue: (t) => t.name,
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{t.name}</p>
          <p className="truncate text-body-12 text-text-secondary">{t.preview}</p>
        </div>
      ),
      minWidth: 320,
    },
    {
      key: 'channel',
      header: 'Channel',
      sortable: true,
      sortValue: (t) => t.channel,
      accessor: (t) => CHANNEL_LABEL[t.channel] ?? t.channel,
      width: 110,
    },
    {
      key: 'category',
      header: 'Category',
      sortable: true,
      sortValue: (t) => t.category,
      accessor: (t) => t.category,
      width: 130,
    },
    {
      key: 'subject',
      header: 'Subject',
      accessor: (t) => t.subject ?? '—',
      minWidth: 200,
      className: 'text-text-secondary',
    },
    {
      key: 'merge',
      header: 'Merge fields',
      sortable: true,
      sortValue: (t) => t.mergeFields.length,
      cell: (t) => (
        <div className="flex flex-wrap gap-1">
          {t.mergeFields.slice(0, 3).map((f) => (
            <Badge key={f} size="sm" tone="neutral">
              {f}
            </Badge>
          ))}
          {t.mergeFields.length > 3 && (
            <Badge size="sm" tone="neutral">
              +{t.mergeFields.length - 3}
            </Badge>
          )}
        </div>
      ),
      minWidth: 220,
    },
    {
      key: 'approval',
      header: 'WhatsApp approval',
      sortable: true,
      sortValue: (t) => t.whatsappApprovalStatus,
      cell: (t) => (
        <Badge tone={APPROVAL[t.whatsappApprovalStatus].tone}>{APPROVAL[t.whatsappApprovalStatus].label}</Badge>
      ),
      width: 165,
    },
    {
      key: 'language',
      header: 'Language',
      accessor: () => 'English',
      width: 100,
    },
    {
      key: 'version',
      header: 'Version',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.version,
      accessor: (t) => `v${t.version}`,
      width: 90,
    },
    {
      key: 'edited',
      header: 'Last edited',
      sortable: true,
      sortValue: (t) => t.updatedAt,
      accessor: (t) => formatDate(t.updatedAt),
      width: 140,
    },
    {
      key: 'used',
      header: 'Used by',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.usedByCount,
      accessor: (t) => formatNumber(t.usedByCount),
      width: 100,
    },
  ]

  if (error) return <ErrorPanel what="Templates" onRetry={retry} />

  return (
    <Card padding="none">
      <TableToolbar
        lead={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search templates"
            inputSize="sm"
            containerClassName="w-72"
          />
        }
      />
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(t) => t.id as string}
        loading={loading}
        density="compact"
        minWidth={1500}
        caption="Message templates and their approval state"
        emptyTitle={search ? 'No templates match this search' : 'No templates yet'}
        emptyMessage={
          search
            ? 'Clear the search to see every template.'
            : 'Nothing can be sent until a template exists and, on WhatsApp, has been approved.'
        }
      />
    </Card>
  )
}
