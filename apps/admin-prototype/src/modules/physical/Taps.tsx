/**
 * §14 — the tap log.
 *
 * Two columns carry the module's argument. **Synced at** differs from the tap
 * time on a buffered row, which is how attendance survives a dropped network.
 * **Denial reason** shows that almost every denial is an operational fact —
 * an unpaid balance, a withdrawn enrolment — not an intrusion attempt.
 */
import { useMemo, useState } from 'react'
import { DoorOpen } from 'lucide-react'

import { formatDateTime, formatNumber, humanize } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  PersonChip,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  branchesCollection,
  cardsCollection,
  readersCollection,
  tapEventsCollection,
  useCollection,
  type TapEvent,
} from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, useModuleData, usePersonName, useUserName } from './parts'

const PAGE_SIZE = 50

const DENIAL_REASONS: Array<NonNullable<TapEvent['denialReason']>> = [
  'card_deactivated',
  'outside_access_hours',
  'status_withdrawn',
  'unpaid_balance',
  'not_authorised_for_area',
]

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'at', label: 'Timestamp', defaultVisible: true, locked: true },
  { key: 'holder', label: 'Holder', defaultVisible: true },
  { key: 'card', label: 'Card', defaultVisible: false },
  { key: 'reader', label: 'Reader', defaultVisible: true },
  { key: 'readerType', label: 'Reader type', defaultVisible: false },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'result', label: 'Result', defaultVisible: true },
  { key: 'reason', label: 'Denial reason', defaultVisible: true },
  { key: 'synced', label: 'Synced at', defaultVisible: true },
  { key: 'override', label: 'Override', defaultVisible: false },
]

export default function PhysicalTaps() {
  const allTaps = useCollection(tapEventsCollection)
  const cards = useCollection(cardsCollection)
  const readers = useCollection(readersCollection)
  const branches = useCollection(branchesCollection)

  const personName = usePersonName()
  const userName = useUserName()
  const { loading, error, rows: taps, retry } = useModuleData(allTaps, 'physical.taps')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const [search, setSearch] = useState('')
  /* Seeded from the query string — the dashboard links here with ?result=denied. */
  const initial = useQueryState()
  const [filters, setFilters] = useState<FilterValues>(() => ({
    result: initial.get('result'),
    reason: initial.get('reason'),
    buffered: initial.get('buffered'),
    reader: initial.get('reader'),
  }))
  const [page, setPage] = useState(1)

  const readerById = useMemo(() => new Map(readers.map((r) => [r.id as string, r])), [readers])
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id as string, c])), [cards])
  const branchName = (id: string | undefined) =>
    id ? (branches.find((b) => (b.id as string) === id)?.name ?? 'Unknown branch') : '—'

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return taps
      .filter((tap) => {
        if (filters.result && tap.result !== filters.result) return false
        if (filters.reason && tap.denialReason !== filters.reason) return false
        if (filters.buffered === 'buffered' && !tap.wasBuffered) return false
        if (filters.buffered === 'live' && tap.wasBuffered) return false
        if (filters.reader && (tap.readerId as string) !== filters.reader) return false
        if (!term) return true
        const card = cardById.get(tap.cardId as string)
        return (
          personName(tap.personId).toLowerCase().includes(term) ||
          (card?.cardId ?? '').toLowerCase().includes(term) ||
          (readerById.get(tap.readerId as string)?.name ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.at.localeCompare(a.at))
  }, [taps, filters, search, personName, cardById, readerById])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const catalogue: Array<Column<TapEvent>> = [
    {
      key: 'at',
      header: 'Timestamp',
      pinned: true,
      width: 190,
      accessor: (row) => formatDateTime(row.at),
      sortValue: (row) => row.at,
      sortable: true,
    },
    {
      key: 'holder',
      header: 'Holder',
      minWidth: 200,
      cell: (row) => <PersonChip name={personName(row.personId)} size="sm" short />,
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    {
      key: 'card',
      header: 'Card',
      width: 140,
      accessor: (row) => (
        <span className="font-mono text-body-12">{cardById.get(row.cardId as string)?.cardId ?? '—'}</span>
      ),
      sortValue: (row) => cardById.get(row.cardId as string)?.cardId ?? '',
      sortable: true,
    },
    {
      key: 'reader',
      header: 'Reader',
      minWidth: 200,
      accessor: (row) => readerById.get(row.readerId as string)?.name ?? 'Unknown reader',
      sortValue: (row) => readerById.get(row.readerId as string)?.name ?? '',
      sortable: true,
    },
    {
      key: 'readerType',
      header: 'Reader type',
      width: 150,
      accessor: (row) => humanize(readerById.get(row.readerId as string)?.type ?? 'unknown'),
      sortValue: (row) => readerById.get(row.readerId as string)?.type ?? '',
      sortable: true,
    },
    {
      key: 'branch',
      header: 'Branch',
      width: 150,
      accessor: (row) => branchName(readerById.get(row.readerId as string)?.branchId as string | undefined),
      sortValue: (row) => branchName(readerById.get(row.readerId as string)?.branchId as string | undefined),
      sortable: true,
    },
    {
      key: 'result',
      header: 'Result',
      width: 170,
      cell: (row) => (
        <span className="flex items-center gap-1.5">
          <Badge tone={row.result === 'granted' ? 'success' : 'danger'} size="sm">
            {humanize(row.result)}
          </Badge>
          {row.wasBuffered && (
            <Badge tone="warning" size="sm">
              Buffered
            </Badge>
          )}
        </span>
      ),
      sortValue: (row) => row.result,
      sortable: true,
    },
    {
      key: 'reason',
      header: 'Denial reason',
      minWidth: 200,
      accessor: (row) =>
        row.denialReason ? humanize(row.denialReason) : <span className="text-text-secondary">—</span>,
      sortValue: (row) => row.denialReason ?? '',
      sortable: true,
    },
    {
      key: 'synced',
      header: 'Synced at',
      width: 200,
      cell: (row) =>
        row.syncedAt === row.at ? (
          <span className="text-text-secondary">Same as the tap</span>
        ) : (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body-13">{formatDateTime(row.syncedAt)}</span>
            <span className="text-body-12 text-warning-text">Arrived after the tap</span>
          </span>
        ),
      sortValue: (row) => row.syncedAt,
      sortable: true,
    },
    {
      key: 'override',
      header: 'Override',
      minWidth: 230,
      cell: (row) =>
        row.overrideByUserId ? (
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-body-13">{userName(row.overrideByUserId)}</span>
            <span className="truncate text-body-12 text-text-secondary">{row.overrideReason}</span>
          </span>
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (row) => (row.overrideByUserId ? userName(row.overrideByUserId) : ''),
      sortable: true,
    },
  ]

  const byKey = new Map(catalogue.map((column) => [column.key, column]))
  const columns = visible
    .map((key) => byKey.get(key))
    .filter((column): column is Column<TapEvent> => Boolean(column))

  return (
    <Screen>
      <ModuleHeader
        title="Tap log"
        description="Every tap, granted or denied, with the reason and the time it actually reached the server."
      />

      {error ? (
        <ErrorPanel what="The tap log" onRetry={retry} />
      ) : (
        <Card>
          <CardBody padding="none">
            <TableToolbar
              actions={
                <ColumnPicker
                  catalogue={COLUMN_CATALOGUE}
                  visible={visible}
                  defaultKeys={defaultKeys}
                  onChange={setVisible}
                />
              }
            >
              <FilterBar
                search={search}
                onSearchChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                searchPlaceholder="Search by holder, card or reader"
                values={filters}
                onFilterChange={(key, value) => {
                  setFilters((prev) => ({ ...prev, [key]: value }))
                  setPage(1)
                }}
                onClearAll={clear}
                filters={[
                  {
                    key: 'result',
                    label: 'Result',
                    options: [
                      { value: 'granted', label: 'Granted' },
                      { value: 'denied', label: 'Denied' },
                    ],
                  },
                  {
                    key: 'reason',
                    label: 'Denial reason',
                    options: DENIAL_REASONS.map((reason) => ({ value: reason, label: humanize(reason) })),
                    width: 210,
                  },
                  {
                    key: 'buffered',
                    label: 'Sync',
                    options: [
                      { value: 'live', label: 'Arrived live' },
                      { value: 'buffered', label: 'Buffered then synced' },
                    ],
                    width: 200,
                  },
                  {
                    key: 'reader',
                    label: 'Reader',
                    options: readers.map((reader) => ({ value: reader.id as string, label: reader.name })),
                    width: 200,
                  },
                ]}
              />
            </TableToolbar>

            <DataTable
              data={pageRows}
              columns={columns}
              rowKey={(row) => row.id as string}
              loading={loading}
              density="compact"
              bordered={false}
              caption="Tap events with holder, card, reader, result, denial reason, sync time and override"
              empty={
                filtered ? (
                  <EmptyState
                    variant="search"
                    title="No taps match these filters"
                    message="Try another result or reader, or clear the search."
                    action={
                      <Button size="sm" variant="secondary" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={DoorOpen}
                    title="No taps recorded"
                    message="Nobody has tapped in yet. Attendance for today will have to come from the register rather than the door."
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
                  itemNoun="taps"
                  divided={false}
                />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {rows.length > 0 && (
        <p className="mt-3 text-body-12 text-text-secondary">
          {formatNumber(rows.filter((t) => t.wasBuffered).length)} of {formatNumber(rows.length)} taps in
          this view arrived after a period offline, and each one kept the timestamp it was taken at.
        </p>
      )}
    </Screen>
  )
}
