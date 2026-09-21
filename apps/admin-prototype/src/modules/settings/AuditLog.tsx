/**
 * The audit log, in full.
 *
 * Immutable and append-only. This is **not** the activity feed: no notes, no
 * calls, no edit affordance, nothing that a person authored. Every row is
 * actor, timestamp, entity, field, before and after — the shape you need to
 * settle an argument about what happened eight months ago.
 */
import { useMemo, useState } from 'react'
import { Lock, ScrollText } from 'lucide-react'

import { formatDateTime, formatNumber, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  Input,
  Pagination,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { TODAY, auditEventsCollection, useCollection } from '@/mocks'
import type { AuditEvent } from '@/mocks'

import { DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, useModuleData } from './parts'

const PAGE_SIZE = 50

const SOURCE_TONE: Record<AuditEvent['source'], 'neutral' | 'accent' | 'info' | 'warning'> = {
  ui: 'neutral',
  api: 'info',
  automation: 'accent',
  import: 'warning',
}

export default function AuditLog() {
  const events = useCollection(auditEventsCollection)
  const state = useModuleData(events, 'settings.audit')

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  const actors = useMemo(
    () => [...new Set(state.rows.map((e) => e.actorName))].sort(),
    [state.rows],
  )
  const entityTypes = useMemo(
    () => [...new Set(state.rows.map((e) => e.entityType))].sort(),
    [state.rows],
  )
  const actions = useMemo(
    () => [...new Set(state.rows.map((e) => e.action))].sort(),
    [state.rows],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return state.rows
      .filter((event) => {
        if (filters.actor && event.actorName !== filters.actor) return false
        if (filters.entityType && event.entityType !== filters.entityType) return false
        if (filters.action && event.action !== filters.action) return false
        if (filters.source && event.source !== filters.source) return false
        if (from && event.at.slice(0, 10) < from) return false
        if (to && event.at.slice(0, 10) > to) return false
        if (!term) return true
        return (
          event.entityRef.toLowerCase().includes(term) ||
          event.entityId.toLowerCase().includes(term) ||
          (event.field ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [state.rows, filters, search, from, to])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Boolean(from) || Boolean(to) || Object.values(filters).some(Boolean)

  const columns: Array<Column<AuditEvent>> = [
    {
      key: 'at',
      header: 'Timestamp',
      pinned: true,
      width: 188,
      accessor: (event) => <span className="font-mono text-body-12">{formatDateTime(event.at)}</span>,
      sortValue: (event) => event.at,
      sortable: true,
    },
    {
      key: 'actor',
      header: 'Actor',
      minWidth: 200,
      cell: (event) => (
        <div className="min-w-0">
          <div className="truncate font-mono text-body-12 text-text">{event.actorName}</div>
          <div className="truncate text-body-12 text-text-secondary">{event.actorRole}</div>
        </div>
      ),
      sortValue: (event) => event.actorName,
      sortable: true,
    },
    {
      key: 'action',
      header: 'Action',
      width: 200,
      accessor: (event) => <span className="font-mono text-body-12">{event.action}</span>,
      sortValue: (event) => event.action,
      sortable: true,
    },
    {
      key: 'entityType',
      header: 'Entity type',
      width: 148,
      accessor: (event) => <span className="font-mono text-body-12">{event.entityType}</span>,
      sortValue: (event) => event.entityType,
      sortable: true,
    },
    {
      key: 'entityRef',
      header: 'Entity ref',
      width: 168,
      accessor: (event) => <span className="font-mono text-body-12 text-text">{event.entityRef}</span>,
      sortValue: (event) => event.entityRef,
      sortable: true,
    },
    {
      key: 'field',
      header: 'Field',
      width: 168,
      accessor: (event) =>
        event.field ? (
          <span className="font-mono text-body-12">{event.field}</span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (event) => event.field ?? '',
      sortable: true,
    },
    {
      key: 'before',
      header: 'Before',
      minWidth: 200,
      accessor: (event) =>
        event.before === null ? (
          <span className="text-text-secondary">Not set</span>
        ) : (
          <span className="font-mono text-body-12 text-text-secondary">{event.before}</span>
        ),
      sortValue: (event) => event.before ?? '',
    },
    {
      key: 'after',
      header: 'After',
      minWidth: 200,
      accessor: (event) =>
        event.after === null ? (
          <span className="text-text-secondary">Cleared</span>
        ) : (
          <span className="font-mono text-body-12 text-text">{event.after}</span>
        ),
      sortValue: (event) => event.after ?? '',
    },
    {
      key: 'source',
      header: 'Source',
      width: 128,
      cell: (event) => (
        <Badge tone={SOURCE_TONE[event.source]} size="sm">
          {humanize(event.source)}
        </Badge>
      ),
      sortValue: (event) => event.source,
      sortable: true,
    },
    {
      key: 'ip',
      header: 'IP',
      width: 148,
      accessor: (event) => <span className="font-mono text-body-12 text-text-secondary">{event.ip}</span>,
      sortValue: (event) => event.ip,
      sortable: true,
    },
  ]

  const header = (
    <ModuleHeader
      title="Audit log"
      description={`${formatNumber(events.length)} entries. There is no edit, no delete and no bulk action on this screen, by design — an audit log you can change is not an audit log.`}
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="The audit log" onRetry={state.retry} />
      </Screen>
    )
  }

  if (state.loading) {
    return (
      <Screen>
        {header}
        <DashboardSkeleton />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      <Alert tone="info" icon={Lock} className="mb-4" title="Append-only, and separate from the activity feed">
        Notes, calls and messages live on each record's Activity tab and can be edited by the person who wrote them. Nothing
        on this screen can be edited by anyone, including a Super Admin.
      </Alert>

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by entity reference, id or field"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setFrom('')
                setTo('')
                setPage(1)
              }}
              filters={[
                { key: 'actor', label: 'Actor', options: actors.map((a) => ({ value: a, label: a })) },
                { key: 'entityType', label: 'Entity type', options: entityTypes.map((t) => ({ value: t, label: t })) },
                { key: 'action', label: 'Action', options: actions.map((a) => ({ value: a, label: a })) },
                {
                  key: 'source',
                  label: 'Source',
                  options: (['ui', 'api', 'automation', 'import'] as const).map((s) => ({
                    value: s,
                    label: humanize(s),
                  })),
                },
              ]}
            >
              <label className="flex items-center gap-2 text-body-13 text-text-label">
                <span>From</span>
                <Input
                  type="date"
                  inputSize="sm"
                  max={to || TODAY}
                  value={from}
                  onChange={(event) => {
                    setFrom(event.target.value)
                    setPage(1)
                  }}
                  containerClassName="w-[168px]"
                />
              </label>
              <label className="flex items-center gap-2 text-body-13 text-text-label">
                <span>To</span>
                <Input
                  type="date"
                  inputSize="sm"
                  min={from || undefined}
                  value={to}
                  onChange={(event) => {
                    setTo(event.target.value)
                    setPage(1)
                  }}
                  containerClassName="w-[168px]"
                />
              </label>
            </FilterBar>
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(event) => event.id}
            density="compact"
            bordered={false}
            minWidth={1960}
            caption="Audit entries with timestamp, actor, action, entity, field, previous value, new value, source and IP"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No audit entries match these filters"
                  message="Try a wider date range, another actor or entity type, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                        setFrom('')
                        setTo('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ScrollText}
                  title="The audit log is empty"
                  message="Nothing has been recorded yet. An empty audit log on a system in use is alarming, not reassuring — it means writes are not being captured."
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
                itemNoun="entries"
                divided={false}
              />
            </div>
          )}
        </CardBody>
      </Card>
    </Screen>
  )
}
