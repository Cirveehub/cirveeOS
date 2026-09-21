import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, Plus, SlidersHorizontal } from 'lucide-react'

import { formatDateTime, formatNaira, formatNumber, formatPercent, humanize } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColumnPicker,
  DataTable,
  Drawer,
  FilterBar,
  KeyValue,
  KeyValueList,
  MoneyCell,
  ProgressBar,
  StatusBadge,
  TableToolbar,
  Tabs,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
  type TabItem,
} from '@/ui'
import type { BusinessUnit } from '@/app/module-registry'
import {
  campaignsCollection,
  messageTemplatesCollection,
  messagesCollection,
  segmentsCollection,
  unitsCollection,
  useCollection,
  type Campaign,
} from '@/mocks'

import { CHANNEL_LABEL, ErrorPanel, ModuleHeader, Screen, percent, useModuleData, useUserName } from './parts'
import { NeedsAttention, PerformancePanel, ResultsBand, useMarketingFigures } from './Performance'
import EngageTemplates from './Templates'

export type CampaignsView = 'campaigns' | 'performance' | 'templates'

const TABS: TabItem[] = [
  { id: 'campaigns', label: 'Campaigns' },
  { id: 'performance', label: 'Performance' },
  { id: 'templates', label: 'Templates' },
]

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Campaign', defaultVisible: true, locked: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'channel', label: 'Channel', defaultVisible: true },
  { key: 'segment', label: 'Audience', defaultVisible: true },
  { key: 'audience', label: 'People reached', defaultVisible: true },
  { key: 'template', label: 'Template', defaultVisible: false },
  { key: 'schedule', label: 'Schedule', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'budget', label: 'Budget', defaultVisible: false },
  { key: 'sent', label: 'Sent', defaultVisible: false },
  { key: 'delivered', label: 'Delivered', defaultVisible: false },
  { key: 'opened', label: 'Opened', defaultVisible: false },
  { key: 'clicked', label: 'Clicked', defaultVisible: false },
  { key: 'replied', label: 'Replied', defaultVisible: false },
  { key: 'enrolments', label: 'Enrolments', defaultVisible: true },
  { key: 'revenue', label: 'Revenue attributed', defaultVisible: true },
  { key: 'utm', label: 'Tracking code (UTM)', defaultVisible: false },
  { key: 'owner', label: 'Owner', defaultVisible: false },
]

export default function EngageCampaigns({ view }: { view: CampaignsView }) {
  const campaigns = useCollection(campaignsCollection)
  const messages = useCollection(messagesCollection)
  const templates = useCollection(messageTemplatesCollection)
  const navigate = useNavigate()

  const { loading, error, rows, retry } = useModuleData(campaigns, 'engage.campaigns')
  const figures = useMarketingFigures(rows, messages, templates)

  return (
    <Screen>
      <ModuleHeader
        title="Campaigns"
        description="Broadcasts to an audience, with the enrolments and revenue each one brought in."
        actions={
          <>
            <Button variant="ghost" size="sm" rightIcon={<ArrowUpRight size={16} />} asChild>
              <Link to="/automation">Journeys run in Automation</Link>
            </Button>
            <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => navigate('/engage/campaigns/new')}>
              New campaign
            </Button>
          </>
        }
      />

      {error ? (
        <ErrorPanel what="Campaigns" onRetry={retry} />
      ) : (
        <>
          <ResultsBand figures={figures} loading={loading} />

          <div className="mt-6">
            <NeedsAttention figures={figures} />
          </div>

          <Tabs
            tabs={TABS}
            value={view}
            onChange={(id) => navigate(id === 'campaigns' ? '/engage/campaigns' : `/engage/campaigns/${id}`)}
            size="sm"
            aria-label="Campaign sections"
            className="mt-6 mb-6"
          />

          {view === 'campaigns' && <CampaignsTable rows={rows} loading={loading} />}
          {view === 'performance' && <PerformancePanel figures={figures} templateCount={templates.length} />}
          {view === 'templates' && <EngageTemplates />}
        </>
      )}
    </Screen>
  )
}

function CampaignsTable({ rows, loading }: { rows: Campaign[]; loading: boolean }) {
  const segments = useCollection(segmentsCollection)
  const templates = useCollection(messageTemplatesCollection)
  const units = useCollection(unitsCollection)
  const userName = useUserName()
  const navigate = useNavigate()

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const segmentName = (id: string) => segments.find((s) => s.id === id)?.name ?? 'Unknown audience'
  const templateName = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Unknown template'
  const unitCode = (id: string) =>
    (units.find((u) => u.id === id)?.code.toLowerCase() ?? 'academy') as BusinessUnit

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((c) => {
      if (filters.status && c.status !== filters.status) return false
      if (filters.channel && c.channel !== filters.channel) return false
      if (q && !c.name.toLowerCase().includes(q) && !c.objective.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filters, search])

  const open = openId ? rows.find((c) => c.id === openId) : undefined

  const allColumns: Record<string, Column<Campaign>> = Object.fromEntries(
    (
      [
        {
          key: 'name',
          header: 'Campaign',
          pinned: true,
          sortable: true,
          sortValue: (c) => c.name,
          cell: (c) => (
            <div className="min-w-0">
              <p className="truncate font-medium text-text">{c.name}</p>
              <p className="truncate text-body-12 text-text-secondary">{c.objective}</p>
            </div>
          ),
          minWidth: 280,
        },
        {
          key: 'status',
          header: 'Status',
          sortable: true,
          sortValue: (c) => c.status,
          cell: (c) => <StatusBadge status={c.status} />,
          width: 120,
        },
        {
          key: 'channel',
          header: 'Channel',
          sortable: true,
          sortValue: (c) => c.channel,
          accessor: (c) => CHANNEL_LABEL[c.channel] ?? c.channel,
          width: 110,
        },
        {
          key: 'segment',
          header: 'Audience',
          sortable: true,
          sortValue: (c) => segmentName(c.segmentId as string),
          accessor: (c) => segmentName(c.segmentId as string),
          minWidth: 220,
          className: 'text-text-secondary',
        },
        {
          key: 'audience',
          header: 'People',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.audienceSize,
          accessor: (c) => formatNumber(c.audienceSize),
          width: 100,
        },
        {
          key: 'template',
          header: 'Template',
          sortable: true,
          sortValue: (c) => templateName(c.templateId as string),
          accessor: (c) => templateName(c.templateId as string),
          minWidth: 190,
          className: 'text-text-secondary',
        },
        {
          key: 'schedule',
          header: 'Schedule',
          sortable: true,
          sortValue: (c) => c.scheduledAt ?? '',
          accessor: (c) => (c.scheduledAt ? formatDateTime(c.scheduledAt) : 'Not scheduled'),
          width: 170,
        },
        {
          key: 'unit',
          header: 'Unit',
          sortable: true,
          sortValue: (c) => c.unitId as string,
          cell: (c) => <UnitTag unit={unitCode(c.unitId as string)} size="sm" />,
          width: 110,
        },
        {
          key: 'budget',
          header: 'Budget',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.budget ?? -1,
          cell: (c) =>
            c.budget === null ? <span className="text-text-secondary">No budget</span> : <MoneyCell kobo={c.budget} tone="muted" />,
          width: 130,
        },
        {
          key: 'sent',
          header: 'Sent',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.sent,
          accessor: (c) => formatNumber(c.stats.sent),
          width: 90,
        },
        {
          key: 'delivered',
          header: 'Delivered',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.delivered,
          accessor: (c) => formatNumber(c.stats.delivered),
          width: 100,
        },
        {
          key: 'opened',
          header: 'Opened',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.opened,
          accessor: (c) => formatNumber(c.stats.opened),
          width: 95,
        },
        {
          key: 'clicked',
          header: 'Clicked',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.clicked,
          accessor: (c) => formatNumber(c.stats.clicked),
          width: 95,
        },
        {
          key: 'replied',
          header: 'Replied',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.replied,
          accessor: (c) => formatNumber(c.stats.replied),
          width: 95,
        },
        {
          key: 'enrolments',
          header: 'Enrolments',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.enrolments,
          accessor: (c) => formatNumber(c.stats.enrolments),
          width: 110,
        },
        {
          key: 'revenue',
          header: 'Revenue attributed',
          align: 'right',
          sortable: true,
          sortValue: (c) => c.stats.revenueAttributed,
          cell: (c) => (
            <MoneyCell kobo={c.stats.revenueAttributed} tone={c.stats.revenueAttributed > 0 ? 'positive' : 'muted'} strong />
          ),
          width: 170,
        },
        {
          key: 'utm',
          header: 'Tracking code',
          accessor: (c) => `${c.utm.source} / ${c.utm.medium}`,
          minWidth: 180,
          className: 'font-mono text-body-12 text-text-secondary',
        },
        {
          key: 'owner',
          header: 'Owner',
          sortable: true,
          sortValue: (c) => userName(c.ownerUserId),
          accessor: (c) => userName(c.ownerUserId),
          width: 170,
        },
      ] as Array<Column<Campaign>>
    ).map((column) => [column.key, column]),
  )

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)
  const tableWidth = columns.reduce((sum, column) => {
    const declared =
      typeof column.width === 'number' ? column.width : typeof column.minWidth === 'number' ? column.minWidth : undefined
    return sum + (declared ?? 150)
  }, 0)

  const funnel = open
    ? [
        { label: 'Sent', value: open.stats.sent },
        { label: 'Delivered', value: open.stats.delivered },
        { label: 'Opened', value: open.stats.opened },
        { label: 'Clicked', value: open.stats.clicked },
        { label: 'Replied', value: open.stats.replied },
        { label: 'Converted', value: open.stats.converted },
        { label: 'Enrolled', value: open.stats.enrolments },
      ]
    : []

  const hasFilters = search.length > 0 || Object.values(filters).some(Boolean)
  const editable = open ? open.status === 'draft' || open.status === 'scheduled' || open.status === 'paused' : false

  return (
    <>
      <Card padding="none">
        <TableToolbar>
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search campaigns"
            values={filters}
            onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
            onClearAll={() => {
              setFilters({})
              setSearch('')
            }}
            filters={[
              {
                key: 'status',
                label: 'Status',
                options: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'completed'].map((s) => ({
                  value: s,
                  label: humanize(s),
                })),
              },
              {
                key: 'channel',
                label: 'Channel',
                options: Object.entries(CHANNEL_LABEL).map(([value, label]) => ({ value, label })),
              },
            ]}
          />
          <ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />
        </TableToolbar>
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(c) => c.id as string}
          loading={loading}
          density="compact"
          minWidth={tableWidth}
          caption="Campaigns with delivery, engagement and attribution"
          onRowClick={(c) => setOpenId(c.id as string)}
          activeRowKey={openId ?? undefined}
          emptyTitle={hasFilters ? 'No campaigns match these filters' : 'No campaigns yet'}
          emptyMessage={
            hasFilters
              ? 'Clear the filters to see every campaign.'
              : 'A campaign sends one template to one audience. Nothing is attributed until one runs.'
          }
          emptyAction={
            hasFilters ? undefined : (
              <Button size="sm" onClick={() => navigate('/engage/campaigns/new')}>
                Build the first campaign
              </Button>
            )
          }
        />
      </Card>

      <Drawer
        open={open !== undefined}
        onClose={() => setOpenId(null)}
        title={open?.name ?? 'Campaign'}
        description={open?.objective}
        size="lg"
        footer={
          open ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <p className="text-body-12 text-text-secondary">
                {editable
                  ? 'Audience, template and schedule can still change until it sends.'
                  : 'This campaign has sent. Its figures describe what really happened, so it is not edited.'}
              </p>
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<SlidersHorizontal size={16} />}
                onClick={() => navigate('/engage/campaigns/' + (open.id as string) + '/builder')}
              >
                {editable ? 'Edit in builder' : 'View setup'}
              </Button>
            </div>
          ) : undefined
        }
      >
        {open && (
          <div className="space-y-6">
            <Card padding="none">
              <CardHeader title="Setup" />
              <CardBody>
                <KeyValueList columns={2}>
                  <KeyValue label="Status">
                    <StatusBadge status={open.status} />
                  </KeyValue>
                  <KeyValue label="Channel">{CHANNEL_LABEL[open.channel] ?? open.channel}</KeyValue>
                  <KeyValue label="Audience">
                    <Link to="/engage/audiences" className="text-accent hover:underline">
                      {segmentName(open.segmentId as string)}
                    </Link>
                  </KeyValue>
                  <KeyValue label="People">{formatNumber(open.audienceSize)}</KeyValue>
                  <KeyValue label="Template">
                    <Link to="/engage/campaigns/templates" className="text-accent hover:underline">
                      {templateName(open.templateId as string)}
                    </Link>
                  </KeyValue>
                  <KeyValue label="Scheduled">{open.scheduledAt ? formatDateTime(open.scheduledAt) : 'Not scheduled'}</KeyValue>
                  <KeyValue label="Owner">{userName(open.ownerUserId)}</KeyValue>
                  <KeyValue label="Unit">
                    <UnitTag unit={unitCode(open.unitId as string)} size="sm" />
                  </KeyValue>
                  <KeyValue label="Budget">{open.budget === null ? 'No budget' : formatNaira(open.budget)}</KeyValue>
                  <KeyValue label="Tracking code">
                    <code className="font-mono text-body-12">
                      {open.utm.source} / {open.utm.medium} / {open.utm.campaign}
                    </code>
                  </KeyValue>
                </KeyValueList>
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader
                title="Performance"
                description="The funnel ends in money, because that is the question the campaign was run to answer."
                actions={<Badge tone="success">{formatNaira(open.stats.revenueAttributed)}</Badge>}
              />
              <CardBody className="space-y-3">
                {funnel.map((step, i) => (
                  <ProgressBar
                    key={step.label}
                    value={step.value}
                    max={Math.max(1, open.stats.sent)}
                    size="sm"
                    tone={i >= 5 ? 'success' : 'accent'}
                    label={step.label}
                    valueLabel={`${formatNumber(step.value)}${
                      i > 0 && funnel[i - 1].value > 0
                        ? ` · ${formatPercent(percent(step.value, funnel[i - 1].value))} of previous`
                        : ''
                    }`}
                  />
                ))}
                <div className="mt-4 rounded-xl border border-success-line bg-success-fill px-4 py-3">
                  <p className="text-label-11 text-success-ink">Revenue attributed</p>
                  <p className="mt-1 text-heading-24 text-success-ink tabular-nums">{formatNaira(open.stats.revenueAttributed)}</p>
                  <p className="mt-1 text-body-13 text-success-ink">
                    From {formatNumber(open.stats.enrolments)} enrolment
                    {open.stats.enrolments === 1 ? '' : 's'} traced back to this campaign.
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader title="Unsubscribes" />
              <CardBody>
                <p className="text-body-14 text-text-secondary">
                  {formatNumber(open.stats.unsubscribed)} people opted out of this send
                  {open.stats.delivered > 0
                    ? ` — ${formatPercent(percent(open.stats.unsubscribed, open.stats.delivered))} of those it reached.`
                    : '.'}{' '}
                  An unsubscribe is held on the Person record, so it applies to every channel and every future campaign.
                </p>
              </CardBody>
            </Card>
          </div>
        )}
      </Drawer>
    </>
  )
}
