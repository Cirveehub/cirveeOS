/**
 * §14 — the visitor log.
 *
 * Signing a visitor in is done at the kiosk; this screen is the record, plus
 * the one action the desk needs — signing somebody out when they leave, which
 * is what turns "on site" into a number worth trusting in a fire drill.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserCheck } from 'lucide-react'

import { formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  PersonChip,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { branchesCollection, useCollection, visitorsCollection, type Visitor } from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, useModuleData, usePersonName } from './parts'
import { signOutVisitor } from './writes'

function durationLabel(visitor: Visitor): string {
  const end = visitor.checkedOutAt ?? null
  if (!end) return 'Still on site'
  const minutes = Math.max(0, Math.round((Date.parse(end) - Date.parse(visitor.checkedInAt)) / 60_000))
  if (minutes < 60) return `${minutes} minutes`
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`
}

export default function PhysicalVisitors() {
  const allVisitors = useCollection(visitorsCollection)
  const branches = useCollection(branchesCollection)
  const personName = usePersonName()

  const { loading, error, rows: visitors, retry } = useModuleData(allVisitors, 'physical.visitors')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [notice, setNotice] = useState<string | null>(null)

  const branchName = (id: string) => branches.find((b) => (b.id as string) === id)?.name ?? 'Unknown branch'

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return visitors
      .filter((visitor) => {
        if (filters.onSite === 'yes' && visitor.checkedOutAt !== null) return false
        if (filters.onSite === 'no' && visitor.checkedOutAt === null) return false
        if (filters.branch && (visitor.branchId as string) !== filters.branch) return false
        if (!term) return true
        return (
          visitor.name.toLowerCase().includes(term) ||
          (visitor.organisation ?? '').toLowerCase().includes(term) ||
          visitor.badgeNumber.toLowerCase().includes(term) ||
          personName(visitor.hostPersonId).toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.checkedInAt.localeCompare(a.checkedInAt))
  }, [visitors, filters, search, personName])

  const onSite = visitors.filter((v) => v.checkedOutAt === null)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const columns: Array<Column<Visitor>> = [
    {
      key: 'name',
      header: 'Visitor',
      pinned: true,
      minWidth: 200,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-body-14 text-text">{row.name}</span>
          <span className="font-mono text-body-12 text-text-secondary">{row.badgeNumber}</span>
        </span>
      ),
      sortValue: (row) => row.name,
      sortable: true,
    },
    {
      key: 'organisation',
      header: 'Organisation',
      minWidth: 180,
      accessor: (row) => row.organisation ?? <span className="text-text-secondary">Not given</span>,
      sortValue: (row) => row.organisation ?? '',
      sortable: true,
    },
    {
      key: 'host',
      header: 'Host',
      minWidth: 190,
      cell: (row) => <PersonChip name={personName(row.hostPersonId)} size="sm" short />,
      sortValue: (row) => personName(row.hostPersonId),
      sortable: true,
    },
    {
      key: 'purpose',
      header: 'Purpose',
      minWidth: 220,
      accessor: (row) => row.purpose,
      sortValue: (row) => row.purpose,
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
      key: 'phone',
      header: 'Phone',
      width: 150,
      accessor: (row) => row.phone || <span className="text-text-secondary">Not given</span>,
      sortValue: (row) => row.phone,
      sortable: true,
    },
    {
      key: 'in',
      header: 'Checked in',
      width: 190,
      accessor: (row) => formatDateTime(row.checkedInAt),
      sortValue: (row) => row.checkedInAt,
      sortable: true,
    },
    {
      key: 'out',
      header: 'Checked out',
      width: 190,
      cell: (row) =>
        row.checkedOutAt ? (
          <span className="text-body-13">{formatDateTime(row.checkedOutAt)}</span>
        ) : (
          <Badge tone="warning" size="sm">
            On site
          </Badge>
        ),
      sortValue: (row) => row.checkedOutAt ?? '',
      sortable: true,
    },
    {
      key: 'duration',
      header: 'Duration',
      width: 140,
      accessor: (row) => durationLabel(row),
      sortValue: (row) =>
        row.checkedOutAt ? Date.parse(row.checkedOutAt) - Date.parse(row.checkedInAt) : Number.MAX_SAFE_INTEGER,
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 140,
      cell: (row) =>
        row.checkedOutAt ? (
          <span className="text-text-secondary">—</span>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              signOutVisitor(row)
              setNotice(`${row.name} signed out. Badge ${row.badgeNumber} is free again.`)
            }}
          >
            Sign out
          </Button>
        ),
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Visitors"
        description="Who is on site right now, who they are here to see, and when they left."
        actions={
          <Button size="sm" variant="secondary" asChild>
            <Link to="/physical/kiosk">Open the kiosk</Link>
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel what="The visitor log" onRetry={retry} />
      ) : (
        <>
          <Alert
            tone={onSite.length > 0 ? 'info' : 'success'}
            icon={UserCheck}
            title={
              onSite.length === 0
                ? 'Nobody is signed in as a visitor'
                : `${formatNumber(onSite.length)} ${onSite.length === 1 ? 'visitor is' : 'visitors are'} on site`
            }
            className="mb-6"
          >
            {onSite.length === 0
              ? 'Every visitor who signed in has signed out again.'
              : 'This is the list a fire warden reads. A visitor who forgets to sign out stays on it, which is why the desk signs people out here.'}
          </Alert>

          <Card>
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by visitor, organisation, badge or host"
                  values={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'onSite',
                      label: 'On site',
                      options: [
                        { value: 'yes', label: 'Still on site' },
                        { value: 'no', label: 'Signed out' },
                      ],
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
                caption="Visitors with organisation, host, purpose, badge, check-in and check-out times"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No visitors match these filters"
                      message="Try another branch, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={UserCheck}
                      title="No visitors signed in"
                      message="Visitors sign themselves in at the kiosk. An empty log means nobody has been through reception, not that the log is broken."
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
