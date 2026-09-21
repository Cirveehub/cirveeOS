import { useMemo, useState } from 'react'
import { Radio, WifiOff } from 'lucide-react'

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
  TableToolbar,
  type BadgeTone,
  type Column,
  type FilterValues,
} from '@/ui'
import {
  branchesCollection,
  readersCollection,
  tapEventsCollection,
  useCollection,
  type Reader,
} from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, useModuleData } from './parts'

const STATUS_TONE: Record<Reader['status'], BadgeTone> = {
  online: 'success',
  offline: 'danger',
  buffering: 'warning',
  fault: 'danger',
}

const READER_TYPES: Array<Reader['type']> = [
  'gate',
  'door',
  'classroom',
  'staff_entry',
  'restricted_area',
  'kiosk',
  'equipment_desk',
  'event_gate',
  'meeting_room',
]

export default function PhysicalReaders() {
  const allReaders = useCollection(readersCollection)
  const branches = useCollection(branchesCollection)
  const taps = useCollection(tapEventsCollection)

  const { loading, error, rows: readers, retry } = useModuleData(allReaders, 'physical.readers')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})

  const branchName = (id: string) => branches.find((b) => (b.id as string) === id)?.name ?? 'Unknown branch'

  const tapsByReader = useMemo(() => {
    const map = new Map<string, number>()
    for (const tap of taps) map.set(tap.readerId as string, (map.get(tap.readerId as string) ?? 0) + 1)
    return map
  }, [taps])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return readers
      .filter((reader) => {
        if (filters.status && reader.status !== filters.status) return false
        if (filters.type && reader.type !== filters.type) return false
        if (filters.branch && (reader.branchId as string) !== filters.branch) return false
        if (!term) return true
        return (
          reader.name.toLowerCase().includes(term) ||
          reader.readerId.toLowerCase().includes(term) ||
          reader.location.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.bufferedEventCount - a.bufferedEventCount || a.readerId.localeCompare(b.readerId))
  }, [readers, filters, search])

  const buffering = readers.filter((r) => r.bufferedEventCount > 0)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const columns: Array<Column<Reader>> = [
    {
      key: 'reader',
      header: 'Reader',
      pinned: true,
      minWidth: 220,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-14 text-text">{row.name}</span>
          <span className="font-mono text-body-12 text-text-secondary">{row.readerId}</span>
        </span>
      ),
      sortValue: (row) => row.readerId,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 150,
      accessor: (row) => humanize(row.type),
      sortValue: (row) => row.type,
      sortable: true,
    },
    {
      key: 'branch',
      header: 'Branch',
      width: 150,
      accessor: (row) => branchName(row.branchId as string),
      sortValue: (row) => branchName(row.branchId as string),
      sortable: true,
    },
    {
      key: 'location',
      header: 'Location',
      minWidth: 200,
      accessor: (row) => row.location,
      sortValue: (row) => row.location,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      cell: (row) => (
        <Badge tone={STATUS_TONE[row.status]} size="sm">
          {humanize(row.status)}
        </Badge>
      ),
      sortValue: (row) => row.status,
      sortable: true,
    },
    {
      key: 'heartbeat',
      header: 'Last heartbeat',
      width: 180,
      accessor: (row) => formatDateTime(row.lastHeartbeatAt),
      sortValue: (row) => row.lastHeartbeatAt,
      sortable: true,
    },
    {
      key: 'buffered',
      header: 'Buffered events pending sync',
      align: 'right',
      width: 240,
      cell: (row) =>
        row.bufferedEventCount === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <Badge tone="warning" size="sm">
            {formatNumber(row.bufferedEventCount)} waiting
          </Badge>
        ),
      sortValue: (row) => row.bufferedEventCount,
      sortable: true,
    },
    {
      key: 'firmware',
      header: 'Firmware',
      width: 120,
      accessor: (row) => <span className="font-mono text-body-12">{row.firmware}</span>,
      sortValue: (row) => row.firmware,
      sortable: true,
    },
    {
      key: 'taps',
      header: 'Taps on record',
      align: 'right',
      width: 150,
      accessor: (row) => formatNumber(tapsByReader.get(row.id as string) ?? 0),
      sortValue: (row) => tapsByReader.get(row.id as string) ?? 0,
      sortable: true,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Readers"
        description="Every reader on every site, and what each one is holding while it waits for the network."
      />

      {error ? (
        <ErrorPanel what="Readers" onRetry={retry} />
      ) : (
        <>
          {buffering.length > 0 && (
            <Alert tone="warning" icon={WifiOff} title="Readers are buffering" className="mb-6">
              {buffering.map((r) => `${r.readerId} holds ${formatNumber(r.bufferedEventCount)} events`).join('; ')}.
              They keep accepting taps offline and sync on reconnect, arriving with their original timestamp
              rather than the time they reached the server. The tap log shows both.
            </Alert>
          )}

          <Card>
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by reader, id or location"
                  values={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'status',
                      label: 'Status',
                      options: (['online', 'offline', 'buffering', 'fault'] as const).map((status) => ({
                        value: status,
                        label: humanize(status),
                      })),
                    },
                    {
                      key: 'type',
                      label: 'Type',
                      options: READER_TYPES.map((type) => ({ value: type, label: humanize(type) })),
                      width: 170,
                    },
                    {
                      key: 'branch',
                      label: 'Branch',
                      options: branches.map((branch) => ({ value: branch.id as string, label: branch.name })),
                    },
                  ]}
                />
              </TableToolbar>

              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.id as string}
                loading={loading}
                density="compact"
                bordered={false}
                caption="Readers with type, branch, location, status, heartbeat, buffered events and firmware"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No readers match these filters"
                      message="Try another status or branch, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Radio}
                      title="No readers installed"
                      message="Without a reader nothing taps, so attendance is taken by hand and the tap log stays empty. Readers are provisioned by the installer, not from this screen."
                    />
                  )
                }
              />
            </CardBody>
          </Card>
        </>
      )}
    </Screen>
  )
}
