import { useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'

import { formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  Drawer,
  KeyValue,
  KeyValueList,
  PersonChip,
  SearchInput,
  TableToolbar,
  type Column,
} from '@/ui'
import {
  campaignsCollection,
  messagesCollection,
  segmentsCollection,
  useCollection,
  type ConditionGroup,
  type Segment,
} from '@/mocks'

import { NewSegmentModal } from './NewSegmentModal'
import { CHANNEL_LABEL, ErrorPanel, ModuleHeader, Screen, useModuleData, usePersonName, useUserName } from './parts'

interface FlatRule {
  field: string
  op: string
  value: unknown
}

function flattenRules(group: ConditionGroup): FlatRule[] {
  return group.rules.flatMap((rule) => ('field' in rule ? [rule as FlatRule] : flattenRules(rule as ConditionGroup)))
}

export default function EngageAudiences() {
  const segments = useCollection(segmentsCollection)
  const campaigns = useCollection(campaignsCollection)
  const messages = useCollection(messagesCollection)
  const userName = useUserName()
  const personName = usePersonName()

  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { loading, error, rows, retry } = useModuleData(segments, 'engage.segments')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.criteriaSummary.toLowerCase().includes(q),
    )
  }, [rows, search])

  const open = openId ? segments.find((s) => s.id === openId) : undefined

  const sample = useMemo(() => {
    if (!open) return []
    const campaignIds = new Set(open.usedByCampaignIds.map((id) => id as string))
    const seen = new Set<string>()
    const out: Array<{ personId: string; channel: string; sentAt: string }> = []
    for (const m of messages) {
      if (m.sourceType !== 'campaign' || !m.sourceId || !campaignIds.has(m.sourceId)) continue
      if (seen.has(m.personId as string)) continue
      seen.add(m.personId as string)
      out.push({ personId: m.personId as string, channel: m.channel, sentAt: m.sentAt })
      if (out.length === 12) break
    }
    return out
  }, [open, messages])

  const columns: Array<Column<Segment>> = [
    {
      key: 'name',
      header: 'Audience',
      sortable: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{s.name}</p>
          <p className="truncate text-body-12 text-text-secondary">{s.description}</p>
        </div>
      ),
      minWidth: 280,
    },
    {
      key: 'criteria',
      header: 'Who is in it',
      accessor: (s) => s.criteriaSummary,
      minWidth: 300,
      className: 'text-text-secondary',
    },
    {
      key: 'members',
      header: 'People',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.memberCount,
      accessor: (s) => formatNumber(s.memberCount),
      width: 110,
    },
    {
      key: 'campaigns',
      header: 'Used by',
      align: 'right',
      sortable: true,
      sortValue: (s) => s.usedByCampaignIds.length,
      cell: (s) =>
        s.usedByCampaignIds.length === 0 ? (
          <span className="text-text-secondary">Not used</span>
        ) : (
          `${formatNumber(s.usedByCampaignIds.length)} campaign${s.usedByCampaignIds.length === 1 ? '' : 's'}`
        ),
      width: 130,
    },
    {
      key: 'refreshed',
      header: 'Last refreshed',
      sortable: true,
      sortValue: (s) => s.lastRefreshedAt,
      accessor: (s) => formatDateTime(s.lastRefreshedAt),
      width: 170,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (s) => userName(s.ownerUserId),
      cell: (s) => <PersonChip name={userName(s.ownerUserId)} size="sm" short />,
      width: 170,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Audiences"
        description="Who a campaign goes to. Each audience is a saved set of rules over Person records, resolved fresh at send time."
        actions={
          <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New audience
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" title="Audience created" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel what="Audiences" onRetry={retry} />
      ) : (
        <Card padding="none">
          <TableToolbar
            lead={
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search audiences"
                inputSize="sm"
                containerClassName="w-72"
              />
            }
          />
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(s) => s.id as string}
            loading={loading}
            caption="Audiences, who is in them and the campaigns using them"
            onRowClick={(s) => setOpenId(s.id as string)}
            activeRowKey={openId ?? undefined}
            emptyTitle={search ? 'No audiences match this search' : 'No audiences yet'}
            emptyMessage={
              search
                ? 'Clear the search to see every audience.'
                : 'A campaign needs an audience to go to. Build one from what you know about people.'
            }
            emptyAction={
              search ? undefined : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  Build the first audience
                </Button>
              )
            }
          />
        </Card>
      )}

      <Drawer
        open={open !== undefined}
        onClose={() => setOpenId(null)}
        title={open?.name ?? 'Audience'}
        description={open?.description}
        size="lg"
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="People">{formatNumber(open.memberCount)}</KeyValue>
              <KeyValue label="Last refreshed">{formatDateTime(open.lastRefreshedAt)}</KeyValue>
              <KeyValue label="Owner">{userName(open.ownerUserId)}</KeyValue>
              <KeyValue label="Used by">
                {open.usedByCampaignIds.length === 0
                  ? 'No campaign yet'
                  : open.usedByCampaignIds
                      .map((id) => campaigns.find((c) => c.id === id)?.name ?? (id as string))
                      .join(', ')}
              </KeyValue>
            </KeyValueList>

            <Card padding="none">
              <CardHeader
                title="Who is in it"
                description={`A person is included when they match ${open.criteria.operator === 'and' ? 'all' : 'any'} of these.`}
              />
              <CardBody>
                <ul className="space-y-2">
                  {flattenRules(open.criteria).map((rule, i) => (
                    <li
                      key={`${rule.field}-${i}`}
                      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-sunken px-3 py-2"
                    >
                      <code className="font-mono text-body-13 text-text">{rule.field}</code>
                      <span className="text-body-13 text-text-secondary">{rule.op.replace(/_/g, ' ')}</span>
                      <code className="font-mono text-body-13 text-text">
                        {Array.isArray(rule.value) ? rule.value.join(', ') : String(rule.value)}
                      </code>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-body-13 text-text-secondary">{open.criteriaSummary}</p>
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader
                title="People reached so far"
                description="People a campaign to this audience has actually messaged. Membership itself resolves at send time."
              />
              <CardBody>
                {sample.length === 0 ? (
                  <div className="flex items-start gap-3 text-body-13 text-text-secondary">
                    <Users size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <p>No campaign has gone to this audience yet. The count above is who matches the rules right now.</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sample.map((s) => (
                      <li key={s.personId} className="flex items-center justify-between gap-3">
                        <PersonChip name={personName(s.personId)} size="sm" />
                        <span className="text-body-12 text-text-secondary">
                          {CHANNEL_LABEL[s.channel as keyof typeof CHANNEL_LABEL] ?? s.channel} · {formatDateTime(s.sentAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </Drawer>

      <NewSegmentModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={setNotice} />
    </Screen>
  )
}
