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
import { ModuleHeader, ErrorPanel, Screen, useModuleData, usePersonName, useUserName } from './parts'

interface FlatRule {
  field: string
  op: string
  value: unknown
}

/** Criteria may nest. The read-only view shows every leaf rule in order. */
function flattenRules(group: ConditionGroup): FlatRule[] {
  return group.rules.flatMap((rule) =>
    'field' in rule ? [rule as FlatRule] : flattenRules(rule as ConditionGroup),
  )
}

export default function EngageSegments() {
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

  /**
   * A segment has no membership table of its own — it resolves over Person
   * records. The nearest honest sample is who its campaigns actually reached.
   */
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
      header: 'Segment',
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
      header: 'Criteria, in plain English',
      accessor: (s) => s.criteriaSummary,
      minWidth: 300,
      className: 'text-text-secondary',
    },
    {
      key: 'source',
      header: 'Built from',
      cell: () => <Badge tone="accent">Person records</Badge>,
      sortValue: () => 'Person records',
      width: 150,
    },
    {
      key: 'members',
      header: 'Members',
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
        title="Segments"
        description="Audiences resolved over Person records at send time, not stored lists."
        actions={
          <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            New segment
          </Button>
        }
      />

      <Alert tone="info" title="Segments are built from Person records">
        There is no separate marketing contact list. One person, one record — a lead, a student, a parent
        and an alumnus are the same row with different relationships, so a segment can never disagree with
        the CRM about who someone is or whether they have unsubscribed. Every criterion the builder offers
        is a query over that record or its history: relationship, branch, lead stage, course interest,
        enrolment status, unit and outstanding balance.
      </Alert>

      {notice && (
        <Alert tone="success" title="Segment created" className="mt-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <div className="mt-6">
        {error ? (
          <ErrorPanel what="Segments" onRetry={retry} />
        ) : (
          <Card padding="none">
            <TableToolbar
              lead={
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search segments"
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
              caption="Segments, their criteria and the campaigns using them"
              onRowClick={(s) => setOpenId(s.id as string)}
              activeRowKey={openId ?? undefined}
              emptyTitle={search ? 'No segments match this search' : 'No segments yet'}
              emptyMessage={
                search
                  ? 'Clear the search to see every segment.'
                  : 'A segment is a saved set of rules over Person records. Nothing can be sent until one exists.'
              }
              emptyAction={
                search ? undefined : (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    Build the first segment
                  </Button>
                )
              }
            />
          </Card>
        )}
      </div>

      <Drawer
        open={open !== undefined}
        onClose={() => setOpenId(null)}
        title={open?.name ?? 'Segment'}
        description={open?.description}
        size="lg"
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Members">{formatNumber(open.memberCount)}</KeyValue>
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
                title="Criteria"
                description={`Every rule matches ${open.criteria.operator === 'and' ? 'all' : 'any'} of the following against a Person record.`}
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
                title="Member sample"
                description="People this segment's campaigns have actually reached. Membership itself resolves at send time."
              />
              <CardBody>
                {sample.length === 0 ? (
                  <div className="flex items-start gap-3 text-body-13 text-text-secondary">
                    <Users size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <p>
                      No campaign has used this segment yet, so there is no send history to sample. The
                      member count above comes from resolving the criteria against Person records.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {sample.map((s) => (
                      <li key={s.personId} className="flex items-center justify-between gap-3">
                        <PersonChip name={personName(s.personId)} size="sm" />
                        <span className="text-body-12 text-text-secondary">
                          {s.channel === 'in_app' ? 'In-app' : s.channel} · {formatDateTime(s.sentAt)}
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
