import { useMemo, useState } from 'react'
import { Check, DoorOpen, Lock, Minus, X } from 'lucide-react'
import toast from 'react-hot-toast'

import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  Drawer,
  EmptyState,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  MoneyCell,
  PageHeader,
  StatusBadge,
  TableToolbar,
  Tooltip,
  type Column,
  type FilterValues,
} from '@/ui'
import { companyAssetsCollection, employeesCollection, exitCasesCollection, useCollection } from '@/mocks'
import type { ExitCase } from '@/mocks'

import {
  EXIT_STAGE_LABEL,
  EXIT_STAGE_ORDER,
  Page,
  ScreenError,
  branchName,
  personName,
  useScreenState,
  userName,
} from './shared'
import { advanceExitCase, clearExitDepartment } from './writes'

const TYPE_LABEL: Record<string, string> = {
  resignation: 'Resignation',
  termination: 'Termination',
  contract_end: 'Contract end',
}

const RECONCILIATION_LABEL: Record<string, string> = {
  pending: 'Pending',
  clear: 'Clear',
  receivable: 'Receivable',
}

export default function Exits() {
  const state = useScreenState()

  const exits = useCollection(exitCasesCollection)
  const employees = useCollection(employeesCollection)
  const assets = useCollection(companyAssetsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [clearanceNotes, setClearanceNotes] = useState<Record<string, string>>({})
  const [advancing, setAdvancing] = useState(false)

  const nameOf = (exitCase: ExitCase) => {
    const employee = employees.find((e) => e.id === exitCase.employeeId)
    return employee ? personName(employee.personId) : 'Former employee'
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return exits
      .filter((exitCase) => {
        if (filters.type && exitCase.type !== filters.type) return false
        if (filters.stage === 'open' && exitCase.stage === 'closed') return false
        if (filters.stage === 'closed' && exitCase.stage !== 'closed') return false
        if (!term) return true
        return nameOf(exitCase).toLowerCase().includes(term) || exitCase.ref.toLowerCase().includes(term)
      })
      .sort((a, b) => b.lastWorkingDay.localeCompare(a.lastWorkingDay))
  }, [exits, filters, search, employees]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = openId ? (exits.find((e) => e.id === openId) ?? null) : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const clearedCount = (exitCase: ExitCase) => exitCase.clearances.filter((c) => c.clearedAt !== null).length
  const nextStageOf = (exitCase: ExitCase) => {
    const index = EXIT_STAGE_ORDER.indexOf(exitCase.stage)
    return index === -1 || index === EXIT_STAGE_ORDER.length - 1 ? null : EXIT_STAGE_ORDER[index + 1]
  }

  const columns: Array<Column<ExitCase>> = [
    { key: 'ref', header: 'Case reference', pinned: true, width: 150, accessor: (row) => <span className="font-mono text-body-13">{row.ref}</span>, sortValue: (row) => row.ref, sortable: true },
    { key: 'employee', header: 'Employee', minWidth: 190, accessor: (row) => nameOf(row), sortValue: (row) => nameOf(row), sortable: true },
    { key: 'type', header: 'Type', width: 140, accessor: (row) => TYPE_LABEL[row.type] ?? row.type, sortValue: (row) => row.type, sortable: true },
    { key: 'notice', header: 'Notice date', width: 130, accessor: (row) => formatDate(row.noticeDate), sortValue: (row) => row.noticeDate, sortable: true },
    { key: 'lastDay', header: 'Last working day', width: 162, accessor: (row) => formatDate(row.lastWorkingDay), sortValue: (row) => row.lastWorkingDay, sortable: true },
    { key: 'stage', header: 'Stage', width: 190, cell: (row) => <StatusBadge status={row.stage} label={EXIT_STAGE_LABEL[row.stage] ?? row.stage} />, sortValue: (row) => row.stage, sortable: true },
    {
      key: 'clearance',
      header: 'Department clearance',
      minWidth: 220,
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {row.clearances.map((clearance) => (
            <Tooltip
              key={clearance.department}
              content={
                clearance.clearedAt
                  ? `${clearance.department} cleared ${formatDate(clearance.clearedAt)} by ${userName(clearance.clearedByUserId)}`
                  : `${clearance.department} has not cleared${clearance.note ? ` — ${clearance.note}` : ''}`
              }
            >
              <span
                className={
                  clearance.clearedAt
                    ? 'inline-flex items-center gap-1 rounded-full bg-success-fill px-2 py-0.5 text-label-10 text-success-ink'
                    : 'inline-flex items-center gap-1 rounded-full bg-warning-fill px-2 py-0.5 text-label-10 text-warning-ink'
                }
              >
                {clearance.clearedAt ? <Check size={11} aria-hidden="true" /> : <X size={11} aria-hidden="true" />}
                {clearance.department}
              </span>
            </Tooltip>
          ))}
        </span>
      ),
      sortValue: (row) => clearedCount(row) - row.clearances.length,
      sortable: true,
    },
    {
      key: 'assets',
      header: 'Outstanding assets',
      align: 'right',
      width: 168,
      accessor: (row) => (
        <span className={`tabular-nums ${row.outstandingAssetIds.length > 0 ? 'text-warning-text' : ''}`}>
          {formatNumber(row.outstandingAssetIds.length)}
        </span>
      ),
      sortValue: (row) => row.outstandingAssetIds.length,
      sortable: true,
    },
    {
      key: 'finance',
      header: 'Outstanding finance',
      align: 'right',
      width: 180,
      cell: (row) => <MoneyCell kobo={row.outstandingFinanceAmount} tone={row.outstandingFinanceAmount > 0 ? 'negative' : 'muted'} />,
      sortValue: (row) => row.outstandingFinanceAmount,
      sortable: true,
    },
    {
      key: 'commission',
      header: 'Commission reconciliation',
      width: 206,
      cell: (row) => (
        <Badge tone={row.commissionReconciliationStatus === 'clear' ? 'success' : row.commissionReconciliationStatus === 'receivable' ? 'danger' : 'warning'} size="sm">
          {RECONCILIATION_LABEL[row.commissionReconciliationStatus] ?? row.commissionReconciliationStatus}
        </Badge>
      ),
      sortValue: (row) => row.commissionReconciliationStatus,
      sortable: true,
    },
    {
      key: 'settlement',
      header: 'Final settlement',
      align: 'right',
      width: 166,
      cell: (row) =>
        row.finalSettlement === null ? (
          <span className="inline-flex items-center gap-1.5 text-body-13 text-text-secondary">
            <Lock size={12} aria-hidden="true" />
            Not calculated
          </span>
        ) : (
          <MoneyCell kobo={row.finalSettlement} />
        ),
      sortValue: (row) => row.finalSettlement ?? -1,
      sortable: true,
    },
    {
      key: 'access',
      header: 'Access revoked',
      width: 170,
      cell: (row) =>
        row.accessRevokedAt ? (
          <Badge tone="success" size="sm">
            {formatDate(row.accessRevokedAt)}
          </Badge>
        ) : (
          <Badge tone="danger" size="sm">
            Still active
          </Badge>
        ),
      sortValue: (row) => row.accessRevokedAt ?? '',
      sortable: true,
    },
    {
      key: 'interview',
      header: 'Exit interview',
      width: 150,
      cell: (row) => <Badge tone={row.exitInterviewDone ? 'success' : 'neutral'} size="sm">{row.exitInterviewDone ? 'Done' : 'Not done'}</Badge>,
      sortValue: (row) => (row.exitInterviewDone ? 1 : 0),
      sortable: true,
    },
  ]

  const openAssets = open ? assets.filter((a) => open.outstandingAssetIds.includes(a.id)) : []

  return (
    <Page>
      <PageHeader
        title="Exit cases"
        description="Notice through to final settlement, with the department clearance matrix that has to be complete before anything is paid out."
      />

      <ScreenError state={state} />

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by employee or case reference"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'type', label: 'Type', options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })) },
                {
                  key: 'stage',
                  label: 'Case',
                  options: [
                    { value: 'open', label: 'Still open' },
                    { value: 'closed', label: 'Closed' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => setOpenId(row.id)}
            activeRowKey={open?.id}
            density="compact"
            minWidth={2100}
            bordered={false}
            caption="Exit cases with stage, department clearance, outstanding assets and finance, and access revocation"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No exit cases match these filters"
                  message="Try another type, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={DoorOpen}
                  title="No exit is in progress"
                  message="Nobody is currently working a notice period. A case opens the moment notice is given, and it is what holds the clearance matrix together."
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? nameOf(open) : 'Exit case'}
        description={open ? `${open.ref} · ${TYPE_LABEL[open.type] ?? open.type} · last working day ${formatDate(open.lastWorkingDay)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Stage">
                <StatusBadge status={open.stage} label={EXIT_STAGE_LABEL[open.stage] ?? open.stage} />
              </KeyValue>
              <KeyValue label="Notice given">{formatDate(open.noticeDate)}</KeyValue>
              <KeyValue label="Branch">{branchName(employees.find((e) => e.id === open.employeeId)?.branchId)}</KeyValue>
              <KeyValue label="Exit interview">{open.exitInterviewDone ? 'Done' : 'Not done'}</KeyValue>
              <KeyValue label="Access revoked">{open.accessRevokedAt ? formatDateTime(open.accessRevokedAt) : 'Still active'}</KeyValue>
              <KeyValue label="Card deactivated">{open.cardDeactivatedAt ? formatDateTime(open.cardDeactivatedAt) : 'Still active'}</KeyValue>
              <KeyValue label="Outstanding finance">{formatNaira(open.outstandingFinanceAmount)}</KeyValue>
              <KeyValue label="Commission reconciliation">
                {RECONCILIATION_LABEL[open.commissionReconciliationStatus] ?? open.commissionReconciliationStatus}
              </KeyValue>
              <KeyValue label="Final settlement">
                {open.finalSettlement === null ? 'Not calculated yet' : formatNaira(open.finalSettlement)}
              </KeyValue>
            </KeyValueList>

            {open.stage !== 'closed' && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-sunken px-3 py-2.5">
                <span className="text-body-13 text-text-secondary">
                  Next: <span className="font-medium text-text">{EXIT_STAGE_LABEL[nextStageOf(open) ?? ''] ?? '—'}</span>
                </span>
                <Button
                  size="sm"
                  loading={advancing}
                  onClick={() => {
                    setAdvancing(true)
                    const result = advanceExitCase(open.id)
                    setAdvancing(false)
                    if (!result.ok) toast.error(result.reason ?? 'Could not advance this case.')
                  }}
                >
                  Advance stage
                </Button>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-heading-18">Department clearance</h3>
              <ul className="flex flex-col gap-2">
                {open.clearances.map((clearance) => (
                  <li
                    key={clearance.department}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          clearance.clearedAt
                            ? 'grid size-5 place-items-center rounded-full bg-success-fill text-success-ink'
                            : 'grid size-5 place-items-center rounded-full bg-warning-fill text-warning-ink'
                        }
                        aria-hidden="true"
                      >
                        {clearance.clearedAt ? <Check size={12} /> : <Minus size={12} />}
                      </span>
                      <span className="text-body-14 text-text">{clearance.department}</span>
                    </span>
                    {clearance.clearedAt ? (
                      <span className="text-body-12 text-text-secondary">
                        {`Cleared ${formatDate(clearance.clearedAt)} by ${userName(clearance.clearedByUserId)}`}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Input
                          inputSize="sm"
                          placeholder="Note (optional)"
                          containerClassName="w-44"
                          value={clearanceNotes[clearance.department] ?? ''}
                          onChange={(e) =>
                            setClearanceNotes((prev) => ({ ...prev, [clearance.department]: e.target.value }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => clearExitDepartment(open.id, clearance.department, clearanceNotes[clearance.department] ?? '')}
                        >
                          Clear
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {clearedCount(open) < open.clearances.length && (
                <Alert tone="warning" className="mt-3" title="The matrix is incomplete">
                  {`${formatNumber(open.clearances.length - clearedCount(open))} of ${formatNumber(open.clearances.length)} departments have not signed off. The final settlement cannot be paid until every one of them has.`}
                </Alert>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-heading-18">Outstanding assets</h3>
              {openAssets.length === 0 ? (
                <p className="text-body-13 text-text-secondary">Everything issued to them has been returned.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {openAssets.map((asset) => (
                    <li key={asset.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
                      <span className="text-body-14 text-text">
                        {asset.name} <span className="font-mono text-body-12 text-text-secondary">{asset.assetId}</span>
                      </span>
                      <MoneyCell kobo={asset.currentValue} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </Page>
  )
}
