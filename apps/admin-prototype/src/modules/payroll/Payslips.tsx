import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt } from 'lucide-react'

import { formatDateTime, formatNumber } from '@/lib/format'
import {
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  FilterBar,
  MoneyCell,
  PageHeader,
  Pagination,
  StatCard,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import { payrollItemsCollection, payrollPeriodsCollection, payslipsCollection, useCollection } from '@/mocks'
import type { Payslip } from '@/mocks'

import {
  PAYROLL_TABS,
  Page,
  ScreenError,
  StatGrid,
  personName,
  useModuleNav,
  useScreenState,
} from './shared'

const PAGE_SIZE = 25

export default function Payslips() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()

  const payslips = useCollection(payslipsCollection)
  const periods = useCollection(payrollPeriodsCollection)
  const items = useCollection(payrollItemsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)

  const periodLabel = (id: string) => periods.find((p) => p.id === id)?.label ?? 'Unknown period'
  const itemById = useMemo(() => new Map(items.map((i) => [i.id as string, i])), [items])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return payslips
      .filter((payslip) => {
        if (filters.period && payslip.periodId !== filters.period) return false
        if (filters.viewed === 'yes' && !payslip.viewedAt) return false
        if (filters.viewed === 'no' && payslip.viewedAt) return false
        if (filters.downloaded === 'yes' && !payslip.downloadedAt) return false
        if (!term) return true
        return personName(payslip.employeeId).toLowerCase().includes(term)
      })
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt) || personName(a.employeeId).localeCompare(personName(b.employeeId)))
  }, [payslips, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const viewed = payslips.filter((p) => p.viewedAt).length
  const downloaded = payslips.filter((p) => p.downloadedAt).length

  const columns: Array<Column<Payslip>> = [
    {
      key: 'period',
      header: 'Period',
      pinned: true,
      width: 124,
      accessor: (payslip) => periodLabel(payslip.periodId),
      sortValue: (payslip) => periodLabel(payslip.periodId),
      sortable: true,
    },
    {
      key: 'employee',
      header: 'Employee',
      minWidth: 200,
      accessor: (payslip) => personName(payslip.employeeId),
      sortValue: (payslip) => personName(payslip.employeeId),
      sortable: true,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      width: 164,
      cell: (payslip) => <MoneyCell kobo={itemById.get(payslip.payrollItemId)?.gross ?? 0} />,
      sortValue: (payslip) => itemById.get(payslip.payrollItemId)?.gross ?? 0,
      sortable: true,
    },
    {
      key: 'deductions',
      header: 'Deductions',
      align: 'right',
      width: 164,
      cell: (payslip) => <MoneyCell kobo={itemById.get(payslip.payrollItemId)?.deductions ?? 0} />,
      sortValue: (payslip) => itemById.get(payslip.payrollItemId)?.deductions ?? 0,
      sortable: true,
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      width: 168,
      cell: (payslip) => <MoneyCell kobo={itemById.get(payslip.payrollItemId)?.net ?? 0} strong />,
      sortValue: (payslip) => itemById.get(payslip.payrollItemId)?.net ?? 0,
      sortable: true,
    },
    {
      key: 'ytdNet',
      header: 'Net, year to date',
      align: 'right',
      width: 180,
      cell: (payslip) => <MoneyCell kobo={payslip.ytdNet} />,
      sortValue: (payslip) => payslip.ytdNet,
      sortable: true,
    },
    {
      key: 'issued',
      header: 'Issued',
      width: 180,
      accessor: (payslip) => formatDateTime(payslip.issuedAt),
      sortValue: (payslip) => payslip.issuedAt,
      sortable: true,
    },
    {
      key: 'viewed',
      header: 'Viewed',
      width: 180,
      accessor: (payslip) =>
        payslip.viewedAt ? (
          formatDateTime(payslip.viewedAt)
        ) : (
          <Badge tone="warning" size="sm">
            Not opened
          </Badge>
        ),
      sortValue: (payslip) => payslip.viewedAt ?? '',
      sortable: true,
    },
    {
      key: 'downloaded',
      header: 'Downloaded',
      width: 180,
      accessor: (payslip) =>
        payslip.downloadedAt ? formatDateTime(payslip.downloadedAt) : <span className="text-text-secondary">—</span>,
      sortValue: (payslip) => payslip.downloadedAt ?? '',
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Payslips"
        description="Issued at close, one per payroll line. A payslip is a rendering of the line, not a separate set of figures."
        tabs={PAYROLL_TABS}
        activeTab="payslips"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <StatGrid>
        <StatCard label="Payslips issued" value={formatNumber(payslips.length)} caption="Across every closed period" />
        <StatCard
          label="Opened"
          value={formatNumber(viewed)}
          caption={`${formatNumber(payslips.length - viewed)} never opened`}
          variant={payslips.length - viewed > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Downloaded" value={formatNumber(downloaded)} caption="Saved a copy" />
        <StatCard
          label="Periods with payslips"
          value={formatNumber(new Set(payslips.map((p) => p.periodId)).size)}
          caption={`${formatNumber(periods.length)} periods in total`}
        />
      </StatGrid>

      <Card className="mt-6">
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by employee"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setPage(1)
              }}
              filters={[
                { key: 'period', label: 'Period', options: periods.map((p) => ({ value: p.id, label: p.label })) },
                {
                  key: 'viewed',
                  label: 'Opened',
                  options: [
                    { value: 'yes', label: 'Opened' },
                    { value: 'no', label: 'Never opened' },
                  ],
                },
                { key: 'downloaded', label: 'Downloaded', options: [{ value: 'yes', label: 'Downloaded' }] },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(payslip) => payslip.id}
            loading={state.loading}
            onRowClick={(payslip) => routerNavigate(`/payroll/payslips/${payslip.id}`)}
            density="compact"
            bordered={false}
            minWidth={1740}
            caption="Payslips with period, employee, gross, deductions, net, year-to-date net and delivery state"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No payslips match these filters"
                  message="Try another period, or clear the search."
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
                  icon={Receipt}
                  title="No payslips issued"
                  message="Payslips are issued when a period closes. The open period has none yet, which is expected — nobody has been paid against it."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('periods')}>
                      See the periods
                    </Button>
                  }
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
                itemNoun="payslips"
                divided={false}
              />
            </div>
          )}
        </CardBody>
      </Card>
    </Page>
  )
}
