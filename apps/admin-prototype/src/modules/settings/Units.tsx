import { useMemo } from 'react'
import { Layers } from 'lucide-react'

import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import {
  Card,
  CardBody,
  DataTable,
  EmptyState,
  MoneyCell,
  SectionHeader,
  StatusBadge,
  UnitTag,
  type Column,
} from '@/ui'
import {
  TODAY,
  organisationsCollection,
  select,
  unitsCollection,
  useCollection,
  useQuery,
} from '@/mocks'
import type { Unit } from '@/mocks'

import {
  BarList,
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  Screen,
  unitKeyFromCode,
  useEmployeeName,
  useModuleData,
} from './parts'

function financialYearStart(startMonth: number): string {
  const year = Number(TODAY.slice(0, 4))
  const month = Number(TODAY.slice(5, 7))
  const beginning = month >= startMonth ? year : year - 1
  return `${beginning}-${String(startMonth).padStart(2, '0')}-01`
}

export default function Units() {
  const units = useCollection(unitsCollection)
  const organisations = useCollection(organisationsCollection)
  const employeeName = useEmployeeName()
  const state = useModuleData(units, 'settings.units')

  const startMonth = organisations[0]?.financialYearStartMonth ?? 1
  const range = useMemo(() => ({ from: financialYearStart(startMonth), to: TODAY }), [startMonth])

  const pnl = useQuery(unitsCollection, () => select.unitPnl(range))
  const pnlByUnit = useMemo(() => new Map(pnl.map((row) => [row.unitId as string, row])), [pnl])

  const rows = state.rows

  const columns: Array<Column<Unit>> = [
    {
      key: 'unit',
      header: 'Unit',
      pinned: true,
      minWidth: 200,
      cell: (unit) => (
        <div className="flex items-center gap-2">
          <UnitTag unit={unitKeyFromCode(unit.code)} size="sm" />
          <span className="truncate text-body-13">{unit.name}</span>
        </div>
      ),
      sortValue: (unit) => unit.name,
      sortable: true,
    },
    {
      key: 'code',
      header: 'Code',
      width: 116,
      accessor: (unit) => <span className="font-mono text-body-13">{unit.code}</span>,
      sortValue: (unit) => unit.code,
      sortable: true,
    },
    {
      key: 'description',
      header: 'Description',
      minWidth: 300,
      accessor: (unit) => unit.description,
      sortValue: (unit) => unit.description,
    },
    {
      key: 'head',
      header: 'Head',
      minWidth: 180,
      accessor: (unit) => employeeName(unit.headId),
      sortValue: (unit) => employeeName(unit.headId),
      sortable: true,
    },
    {
      key: 'headcount',
      header: 'Headcount',
      align: 'right',
      width: 118,
      accessor: (unit) => <span className="tabular-nums">{formatNumber(pnlByUnit.get(unit.id)?.headcount ?? 0)}</span>,
      sortValue: (unit) => pnlByUnit.get(unit.id)?.headcount ?? 0,
      sortable: true,
    },
    {
      key: 'revenue',
      header: 'Revenue, year to date',
      align: 'right',
      width: 184,
      cell: (unit) => <MoneyCell kobo={pnlByUnit.get(unit.id)?.invoiced ?? 0} />,
      sortValue: (unit) => pnlByUnit.get(unit.id)?.invoiced ?? 0,
      sortable: true,
    },
    {
      key: 'cost',
      header: 'Cost, year to date',
      align: 'right',
      width: 176,
      cell: (unit) => {
        const row = pnlByUnit.get(unit.id)
        return <MoneyCell kobo={(row?.directCost ?? 0) + (row?.payroll ?? 0)} />
      },
      sortValue: (unit) => {
        const row = pnlByUnit.get(unit.id)
        return (row?.directCost ?? 0) + (row?.payroll ?? 0)
      },
      sortable: true,
    },
    {
      key: 'margin',
      header: 'Gross margin',
      align: 'right',
      width: 168,
      cell: (unit) => {
        const value = pnlByUnit.get(unit.id)?.grossMargin ?? 0
        return <MoneyCell kobo={value} strong tone={value < 0 ? 'negative' : 'default'} />
      },
      sortValue: (unit) => pnlByUnit.get(unit.id)?.grossMargin ?? 0,
      sortable: true,
    },
    {
      key: 'marginPercent',
      header: 'Margin',
      align: 'right',
      width: 108,
      accessor: (unit) => {
        const value = pnlByUnit.get(unit.id)?.marginPercent ?? 0
        return <span className={`tabular-nums ${value < 0 ? 'text-danger-text' : ''}`}>{formatPercent(value)}</span>
      },
      sortValue: (unit) => pnlByUnit.get(unit.id)?.marginPercent ?? 0,
      sortable: true,
    },
    {
      key: 'activeFrom',
      header: 'Active from',
      width: 132,
      accessor: (unit) => formatDate(unit.activeFrom),
      sortValue: (unit) => unit.activeFrom,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 112,
      cell: (unit) => <StatusBadge status={unit.status} />,
      sortValue: (unit) => unit.status,
      sortable: true,
    },
  ]

  const header = (
    <ModuleHeader
      title="Business units"
      description={`Every naira of revenue and cost is allocated to one of these. The figures are year to date from ${formatDate(range.from)}, the start of the declared financial year.`}
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Business units" onRetry={state.retry} />
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card padding="none" className="xl:order-1">
          <CardBody padding="none">
            <DataTable
              data={rows}
              columns={columns}
              rowKey={(unit) => unit.id}
              density="compact"
              bordered={false}
              minWidth={1720}
              caption="Business units with head, headcount, year-to-date revenue, cost and margin"
              empty={
                <EmptyState
                  icon={Layers}
                  title="No business units"
                  message="Without a unit, revenue and cost cannot be allocated and no unit P&L can be produced. Every invoice and every payroll line needs one."
                />
              }
            />
          </CardBody>
        </Card>

        <Card className="xl:order-2">
          <SectionHeader
            as="h2"
            size="sm"
            title="Revenue by unit"
            description="Invoiced, year to date. Collected is reported separately and never netted against it."
            className="mb-4"
          />
          <BarList
            rows={[...pnl]
              .sort((a, b) => b.invoiced - a.invoiced)
              .map((row) => ({
                key: row.unitId,
                label: row.name,
                value: row.invoiced,
                valueLabel: <MoneyCell kobo={row.invoiced} compact />,
                note: `${formatNumber(row.headcount)} on strength · margin ${formatPercent(row.marginPercent)}`,
              }))}
            emptyMessage="No invoices have been raised against any unit this financial year."
          />
        </Card>
      </div>
    </Screen>
  )
}
