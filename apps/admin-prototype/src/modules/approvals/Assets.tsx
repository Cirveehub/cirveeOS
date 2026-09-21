import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  Skeleton,
  StatusBadge,
  type Column,
} from '@/ui'
import { branchesCollection, companyAssetsCollection, useCollection, TODAY } from '@/mocks'
import type { CompanyAsset } from '@/mocks'
import { formatDate, formatNaira, humanize } from '@/lib/format'
import { branchName, personName, useScreenState } from './shared'

const NOT_BUILT = 'Not built in this prototype — this would write an asset movement record.'

export default function Assets() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')

  const assets = useCollection(companyAssetsCollection)
  const branches = useCollection(branchesCollection)

  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const status = params.get('status') ?? ''
  const branch = params.get('branch') ?? ''
  const condition = params.get('condition') ?? ''
  const drawerId = params.get('drawer')
  const open = assets.find((a) => a.id === drawerId)

  const categories = useMemo(() => [...new Set(assets.map((a) => a.category))].sort(), [assets])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return assets
      .filter((a) => !needle || a.assetId.toLowerCase().includes(needle) || a.name.toLowerCase().includes(needle) || a.serial.toLowerCase().includes(needle))
      .filter((a) => !category || a.category === category)
      .filter((a) => !status || a.status === status)
      .filter((a) => !branch || a.branchId === branch)
      .filter((a) => !condition || a.condition === condition)
      .sort((a, b) => a.assetId.localeCompare(b.assetId))
  }, [assets, q, category, status, branch, condition])

  const columns: Array<Column<CompanyAsset>> = [
    { key: 'assetId', header: 'Asset', width: 120, accessor: (a) => a.assetId, sortable: true, pinned: true },
    { key: 'category', header: 'Category', width: 130, accessor: (a) => a.category, sortable: true },
    { key: 'name', header: 'Model', minWidth: 200, accessor: (a) => a.name, sortable: true },
    { key: 'serial', header: 'Serial', width: 170, accessor: (a) => a.serial, sortable: true },
    { key: 'purchased', header: 'Purchased', width: 120, accessor: (a) => formatDate(a.purchaseDate), sortValue: (a) => a.purchaseDate, sortable: true },
    { key: 'purchaseValue', header: 'Purchase value', align: 'right', width: 140, accessor: (a) => formatNaira(a.purchaseValue), sortValue: (a) => a.purchaseValue, sortable: true },
    { key: 'currentValue', header: 'Current value', align: 'right', width: 140, accessor: (a) => formatNaira(a.currentValue), sortValue: (a) => a.currentValue, sortable: true },
    { key: 'branch', header: 'Branch', width: 120, accessor: (a) => branchName(a.branchId), sortable: true },
    { key: 'assignedTo', header: 'Assigned to', width: 170, accessor: (a) => (a.assignedToPersonId ? personName(a.assignedToPersonId) : '—'), sortable: true },
    { key: 'assignedAt', header: 'Assigned', width: 120, accessor: (a) => (a.assignedAt ? formatDate(a.assignedAt) : '—'), sortValue: (a) => a.assignedAt ?? '', sortable: true },
    {
      key: 'condition',
      header: 'Condition',
      width: 130,
      cell: (a) => <Badge tone={a.condition === 'needs_repair' ? 'warning' : a.condition === 'retired' ? 'neutral' : 'success'} size="sm">{humanize(a.condition)}</Badge>,
      sortValue: (a) => a.condition,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      cell: (a) => <StatusBadge status={a.status} label={humanize(a.status)} size="sm" />,
      sortValue: (a) => a.status,
      sortable: true,
    },
    { key: 'lastService', header: 'Last service', width: 130, accessor: (a) => (a.lastServiceDate ? formatDate(a.lastServiceDate) : '—'), sortValue: (a) => a.lastServiceDate ?? '', sortable: true },
    {
      key: 'returnDue',
      header: 'Return due',
      width: 130,
      cell: (a) =>
        !a.returnDueDate ? (
          <span className="text-text-secondary">—</span>
        ) : a.returnDueDate < TODAY ? (
          <span className="text-body-13 text-danger-text">{formatDate(a.returnDueDate)} · overdue</span>
        ) : (
          formatDate(a.returnDueDate)
        ),
      sortValue: (a) => a.returnDueDate ?? '',
      sortable: true,
    },
  ]

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Assets"
        description="The company asset register — what we own, where it is, who has it and what it is worth now."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Assets' }]}
      />

      <FilterBar
        className="mt-6"
        search={q}
        onSearchChange={(v) => set('q', v)}
        searchPlaceholder="Search by id, model or serial"
        values={{ category, status, branch, condition }}
        onFilterChange={set}
        onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
        filters={[
          { key: 'category', label: 'Category', options: categories.map((c) => ({ value: c, label: c })) },
          {
            key: 'status',
            label: 'Status',
            options: ['in_store', 'assigned', 'on_loan', 'in_repair', 'lost', 'retired'].map((s) => ({ value: s, label: humanize(s) })),
          },
          { key: 'branch', label: 'Branch', options: branches.map((b) => ({ value: b.id as string, label: b.name })) },
          {
            key: 'condition',
            label: 'Condition',
            options: ['new', 'good', 'fair', 'needs_repair', 'retired'].map((c) => ({ value: c, label: humanize(c) })),
          },
        ]}
      />

      {loading ? (
        <Card className="mt-4">
          <CardBody className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} height={40} rounded="lg" />
            ))}
          </CardBody>
        </Card>
      ) : error ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState variant="error" title="Could not load the asset register" message={error} action={<Button onClick={retry}>Retry</Button>} />
          </CardBody>
        </Card>
      ) : (
        <Card className="mt-4">
          <CardBody padding="none">
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(a) => a.id as string}
              caption="Company assets with value, location, holder and condition"
              density="compact"
              minWidth={1900}
              activeRowKey={drawerId ?? undefined}
              onRowClick={(a) => set('drawer', a.id as string)}
              emptyTitle="No assets match these filters."
              emptyMessage="Clear the filters to see the whole register."
              emptyAction={
                <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                  Clear filters
                </Button>
              }
            />
          </CardBody>
        </Card>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => set('drawer', undefined)}
        title={open ? `${open.assetId} · ${open.name}` : 'Asset'}
        description={open?.serial}
        size="md"
        footer={
          open && (
            <>
              <Button variant="secondary" onClick={() => toast(NOT_BUILT)}>
                {open.assignedToPersonId ? 'Return' : 'Assign'}
              </Button>
              <Button variant="secondary" onClick={() => toast(NOT_BUILT)}>
                Log service
              </Button>
              <Button variant="ghost" onClick={() => toast(NOT_BUILT)}>
                Retire
              </Button>
            </>
          )
        }
      >
        {open && (
          <div className="space-y-5">
            <KeyValueList columns={2}>
              <KeyValue label="Category">{open.category}</KeyValue>
              <KeyValue label="Status">{humanize(open.status)}</KeyValue>
              <KeyValue label="Condition">{humanize(open.condition)}</KeyValue>
              <KeyValue label="Branch">{branchName(open.branchId)}</KeyValue>
              <KeyValue label="Assigned to">{open.assignedToPersonId ? personName(open.assignedToPersonId) : 'Nobody'}</KeyValue>
              <KeyValue label="Purchase value">{formatNaira(open.purchaseValue)}</KeyValue>
              <KeyValue label="Current value">{formatNaira(open.currentValue)}</KeyValue>
              <KeyValue label="Return due">{open.returnDueDate ? formatDate(open.returnDueDate) : 'Not on loan'}</KeyValue>
            </KeyValueList>

            <div>
              <p className="text-label-11 text-text-label">Service history</p>
              {open.serviceHistory.length === 0 ? (
                <p className="mt-1.5 text-body-13 text-text-secondary">
                  Never serviced. That is not necessarily a problem — it is a fact worth knowing before it is.
                </p>
              ) : (
                <ul className="mt-1.5 space-y-1.5">
                  {open.serviceHistory.map((entry, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-body-13">
                      <span className="text-text">{entry.note}</span>
                      <span className="text-text-secondary">
                        {formatDate(entry.date)} · {formatNaira(entry.cost)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
