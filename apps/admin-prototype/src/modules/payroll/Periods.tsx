import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Lock, Wallet } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  MoneyCell,
  PageHeader,
  StatusBadge,
  TableToolbar,
  Tooltip,
  type Column,
  type FilterValues,
} from '@/ui'
import { payrollPeriodsCollection, payslipsCollection, useCollection } from '@/mocks'
import type { PayrollPeriod } from '@/mocks'

import { PAYROLL_TABS, Page, ScreenError, useModuleNav, useScreenState, userName } from './shared'

const STATUSES: Array<PayrollPeriod['status']> = ['draft', 'open', 'in_review', 'approved', 'paid', 'closed']

export default function Periods() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()

  const periods = useCollection(payrollPeriodsCollection)
  const payslips = useCollection(payslipsCollection)

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')

  const issued = useMemo(() => {
    const map = new Map<string, number>()
    for (const payslip of payslips) map.set(payslip.periodId, (map.get(payslip.periodId) ?? 0) + 1)
    return map
  }, [payslips])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return periods
      .filter((period) => {
        if (filters.status && period.status !== filters.status) return false
        if (filters.year && String(period.year) !== filters.year) return false
        if (!term) return true
        return period.label.toLowerCase().includes(term)
      })
      .sort((a, b) => b.year - a.year || b.month - a.month)
  }, [periods, filters, search])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const years = [...new Set(periods.map((p) => String(p.year)))].sort().reverse()

  const columns: Array<Column<PayrollPeriod>> = [
    {
      key: 'label',
      header: 'Period',
      pinned: true,
      width: 168,
      cell: (period) => (
        <span className="inline-flex items-center gap-2">
          <span className="text-body-13 text-text">{period.label}</span>
          {period.status === 'closed' && (
            <Tooltip content="Closed. No line on this period can be edited — a correction is a new adjustment in the next period.">
              <span className="inline-flex items-center text-text-secondary">
                <Lock size={14} aria-hidden="true" />
                <span className="sr-only">Locked</span>
              </span>
            </Tooltip>
          )}
        </span>
      ),
      sortValue: (period) => `${period.year}-${String(period.month).padStart(2, '0')}`,
      sortable: true,
    },
    {
      key: 'month',
      header: 'Month',
      width: 112,
      accessor: (period) => `${String(period.month).padStart(2, '0')}/${period.year}`,
      sortValue: (period) => period.year * 100 + period.month,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 136,
      cell: (period) => <StatusBadge status={period.status} />,
      sortValue: (period) => STATUSES.indexOf(period.status),
      sortable: true,
    },
    {
      key: 'employees',
      header: 'Employees',
      align: 'right',
      width: 122,
      accessor: (period) => <span className="tabular-nums">{formatNumber(period.employeeCount)}</span>,
      sortValue: (period) => period.employeeCount,
      sortable: true,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      width: 168,
      cell: (period) => <MoneyCell kobo={period.grossTotal} />,
      sortValue: (period) => period.grossTotal,
      sortable: true,
    },
    {
      key: 'deductions',
      header: 'Deductions',
      align: 'right',
      width: 168,
      cell: (period) => <MoneyCell kobo={period.deductionTotal} />,
      sortValue: (period) => period.deductionTotal,
      sortable: true,
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      width: 168,
      cell: (period) => <MoneyCell kobo={period.netTotal} strong />,
      sortValue: (period) => period.netTotal,
      sortable: true,
    },
    {
      key: 'opened',
      header: 'Opened',
      width: 176,
      accessor: (period) => formatDateTime(period.openedAt),
      sortValue: (period) => period.openedAt,
      sortable: true,
    },
    {
      key: 'closed',
      header: 'Closed',
      width: 176,
      accessor: (period) =>
        period.closedAt ? formatDateTime(period.closedAt) : <span className="text-text-secondary">Still open</span>,
      sortValue: (period) => period.closedAt ?? '',
      sortable: true,
    },
    {
      key: 'approvedBy',
      header: 'Approved by',
      minWidth: 180,
      accessor: (period) =>
        period.approvedByUserId ? (
          userName(period.approvedByUserId)
        ) : (
          <span className="text-text-secondary">Not yet authorised</span>
        ),
      sortValue: (period) => userName(period.approvedByUserId),
      sortable: true,
    },
    {
      key: 'payslips',
      header: 'Payslips issued',
      align: 'right',
      width: 152,
      accessor: (period) => {
        const count = issued.get(period.id) ?? 0
        return count === 0 ? (
          <span className="text-text-secondary">None</span>
        ) : (
          <span className="tabular-nums">{formatNumber(count)}</span>
        )
      },
      sortValue: (period) => issued.get(period.id) ?? 0,
      sortable: true,
    },
    {
      key: 'lock',
      header: 'Editable',
      width: 148,
      cell: (period) =>
        period.status === 'closed' ? (
          <Badge tone="neutral" size="sm" icon={<Lock size={12} />}>
            Locked
          </Badge>
        ) : (
          <Badge tone="success" size="sm">
            Open to change
          </Badge>
        ),
      sortValue: (period) => (period.status === 'closed' ? 1 : 0),
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Payroll periods"
        description="One period per month. A closed period is immutable — corrections become new adjustments in the next one, never edits to this one."
        tabs={PAYROLL_TABS}
        activeTab="periods"
        onTabChange={navigate}
        actions={
          <Button
            size="sm"
            onClick={() =>
              toast('Not built in this prototype — this would open the next period and draw in every active compensation version.')
            }
          >
            Open next period
          </Button>
        }
      />

      <ScreenError state={state} />

      <Alert tone="info" icon={Lock} className="mb-4" title="A closed period is never reopened">
        Reopening would rewrite a payslip somebody has already been paid against and already holds a copy of. When a closed
        period turns out to be wrong, the fix is an adjustment in the open period that names the closed one as its source.
      </Alert>

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search periods"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                { key: 'year', label: 'Year', options: years.map((y) => ({ value: y, label: y })) },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(period) => period.id}
            loading={state.loading}
            onRowClick={(period) => routerNavigate(`/payroll/periods/${period.id}`)}
            rowClassName={(period) => (period.status === 'closed' ? 'bg-surface-sunken' : undefined)}
            density="compact"
            bordered={false}
            minWidth={1960}
            caption="Payroll periods with status, employee count, gross, deductions, net, dates, authoriser and payslip count"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No periods match these filters"
                  message="Try another status or year."
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
                  icon={Wallet}
                  title="No payroll period has ever been run"
                  message="Nobody can be paid and no payslip can be issued until a period is opened. Opening one draws in every active employee's current compensation version."
                />
              )
            }
          />
        </CardBody>
      </Card>

      {rows.some((p) => p.status === 'closed') && (
        <p className="mt-3 text-body-13 text-text-secondary">
          Closed rows are shaded and carry a lock. Opening one still works — it is readable for ever, just not editable. The
          last close was {formatDate(rows.find((p) => p.closedAt)?.closedAt ?? '')}.
        </p>
      )}
    </Page>
  )
}
