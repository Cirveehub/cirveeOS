/**
 * Adjustment review.
 *
 * Every adjustment names three things: the **source event** that produced it,
 * the **policy version** it was computed under, and the **formula** — never a
 * bare number. An adjustment that cannot answer all three is not reviewable.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ShieldCheck, SlidersHorizontal } from 'lucide-react'

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
  KeyValue,
  KeyValueList,
  MoneyCell,
  PageHeader,
  StatCard,
  StatusBadge,
  TableToolbar,
  type Column,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  payrollAdjustmentsCollection,
  payrollPeriodsCollection,
  policyVersionsCollection,
  useCollection,
} from '@/mocks'
import type { PayrollAdjustment } from '@/mocks'

import {
  PAYROLL_TABS,
  Page,
  ScreenError,
  StatGrid,
  personName,
  useModuleNav,
  useScreenState,
  userName,
} from './shared'

const TYPES: Array<PayrollAdjustment['type']> = [
  'attendance',
  'commission',
  'performance_bonus',
  'advance_repayment',
  'manual_correction',
  'statutory',
]

const TYPE_LABEL: Record<PayrollAdjustment['type'], string> = {
  attendance: 'Attendance',
  commission: 'Commission',
  performance_bonus: 'Performance bonus',
  advance_repayment: 'Advance repayment',
  manual_correction: 'Manual correction',
  statutory: 'Statutory',
}

const STATUSES: Array<PayrollAdjustment['status']> = [
  'proposed',
  'disputed',
  'hr_reviewed',
  'finance_reviewed',
  'applied',
  'voided',
]

/** Where a source event can be opened, by the type the adjustment records. */
const SOURCE_LINK: Record<string, string> = {
  Commission: '/referral/commissions',
  AttendanceEvent: '/people/attendance',
  PerformanceReview: '/people/employees',
  SalaryAdvance: '/finance/expenses',
}

export default function Adjustments() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const adjustments = useCollection(payrollAdjustmentsCollection)
  const periods = useCollection(payrollPeriodsCollection)
  const policies = useCollection(policyVersionsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)

  const periodLabel = (id: string) => periods.find((p) => p.id === id)?.label ?? 'Unknown period'

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return adjustments
      .filter((adjustment) => {
        if (filters.type && adjustment.type !== filters.type) return false
        if (filters.status && adjustment.status !== filters.status) return false
        if (filters.period && adjustment.periodId !== filters.period) return false
        if (filters.direction === 'credit' && adjustment.amount <= 0) return false
        if (filters.direction === 'debit' && adjustment.amount >= 0) return false
        if (!term) return true
        return (
          adjustment.ref.toLowerCase().includes(term) ||
          personName(adjustment.employeeId).toLowerCase().includes(term) ||
          (adjustment.sourceEventRef ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [adjustments, filters, search])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const open = openId ? adjustments.find((a) => a.id === openId) ?? null : null

  /* The counts that carry the argument. All derived. */
  const attendanceApplied = adjustments.filter((a) => a.type === 'attendance' && a.status === 'applied').length
  const attendanceVoided = adjustments.filter((a) => a.type === 'attendance' && a.status === 'voided').length
  const awaitingReview = adjustments.filter((a) => a.status === 'proposed' || a.status === 'disputed').length
  const credits = adjustments.filter((a) => a.amount > 0).reduce((acc, a) => acc + a.amount, 0)
  const debits = adjustments.filter((a) => a.amount < 0).reduce((acc, a) => acc + a.amount, 0)

  const columns: Array<Column<PayrollAdjustment>> = [
    {
      key: 'ref',
      header: 'Reference',
      pinned: true,
      width: 156,
      accessor: (adjustment) => <span className="font-mono text-body-13">{adjustment.ref}</span>,
      sortValue: (adjustment) => adjustment.ref,
      sortable: true,
    },
    {
      key: 'employee',
      header: 'Employee',
      minWidth: 190,
      accessor: (adjustment) => personName(adjustment.employeeId),
      sortValue: (adjustment) => personName(adjustment.employeeId),
      sortable: true,
    },
    {
      key: 'period',
      header: 'Period',
      width: 124,
      accessor: (adjustment) => periodLabel(adjustment.periodId),
      sortValue: (adjustment) => periodLabel(adjustment.periodId),
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 176,
      cell: (adjustment) => (
        <Badge tone={adjustment.type === 'attendance' ? 'neutral' : 'accent'} size="sm">
          {TYPE_LABEL[adjustment.type]}
        </Badge>
      ),
      sortValue: (adjustment) => adjustment.type,
      sortable: true,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      width: 164,
      cell: (adjustment) =>
        adjustment.status === 'voided' ? (
          <span className="text-body-13 text-text-secondary">No effect</span>
        ) : (
          <MoneyCell kobo={adjustment.amount} signed />
        ),
      sortValue: (adjustment) => adjustment.amount,
      sortable: true,
    },
    {
      key: 'source',
      header: 'Source event',
      minWidth: 300,
      cell: (adjustment) => {
        if (!adjustment.sourceEventRef) return <span className="text-body-13 text-text-secondary">Not recorded</span>
        const to = adjustment.sourceEventType ? SOURCE_LINK[adjustment.sourceEventType] : undefined
        const label = `${adjustment.sourceEventRef}${adjustment.sourceEventType ? ` · ${adjustment.sourceEventType}` : ''}`
        return to ? (
          <Link to={to} onClick={(event) => event.stopPropagation()} className="text-body-13 text-accent hover:underline">
            {label}
          </Link>
        ) : (
          <span className="text-body-13">{label}</span>
        )
      },
      sortValue: (adjustment) => adjustment.sourceEventRef ?? '',
      sortable: true,
    },
    {
      key: 'policy',
      header: 'Policy version',
      width: 200,
      cell: (adjustment) => {
        if (!adjustment.policyVersionId) {
          return <span className="text-body-13 text-text-secondary">None — agreed outside policy</span>
        }
        const policy = policies.find((p) => p.id === adjustment.policyVersionId)
        return (
          <Link
            to="/settings/policies"
            onClick={(event) => event.stopPropagation()}
            className="font-mono text-body-12 text-accent hover:underline"
          >
            {policy ? `${policy.kind} v${policy.version}` : adjustment.policyVersionId}
          </Link>
        )
      },
      sortValue: (adjustment) => adjustment.policyVersionId ?? '',
      sortable: true,
    },
    {
      key: 'formula',
      header: 'Computed by',
      minWidth: 280,
      accessor: (adjustment) =>
        adjustment.formulaUsed ? (
          <span className="font-mono text-body-12">{adjustment.formulaUsed}</span>
        ) : (
          <span className="text-text-secondary">Not recorded — a bare number is not reviewable</span>
        ),
      sortValue: (adjustment) => adjustment.formulaUsed ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      width: 154,
      cell: (adjustment) => <StatusBadge status={adjustment.status} />,
      sortValue: (adjustment) => STATUSES.indexOf(adjustment.status),
      sortable: true,
    },
    {
      key: 'dispute',
      header: 'Dispute window ends',
      width: 196,
      accessor: (adjustment) => {
        if (!adjustment.disputeWindowEndsAt) return <span className="text-text-secondary">Not disputable</span>
        const closed = adjustment.disputeWindowEndsAt.slice(0, 10) < TODAY
        return (
          <span className={closed ? 'text-text-secondary' : 'text-warning-text'}>
            {formatDate(adjustment.disputeWindowEndsAt)}
            {closed ? ' · closed' : ' · open'}
          </span>
        )
      },
      sortValue: (adjustment) => adjustment.disputeWindowEndsAt ?? '',
      sortable: true,
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Adjustment review"
        description="Nothing reaches a payslip without a source event, a policy version and the formula it was computed under."
        tabs={PAYROLL_TABS}
        activeTab="adjustments"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      <StatGrid>
        <StatCard label="Adjustments" value={formatNumber(adjustments.length)} caption="Across every period" />
        <StatCard
          label="Awaiting review"
          value={formatNumber(awaitingReview)}
          caption="Proposed or disputed"
          variant={awaitingReview > 0 ? 'warning' : 'default'}
        />
        <StatCard label="Credits" value={formatNaira(credits, { compact: true })} caption="Added to pay" variant="success" />
        <StatCard label="Debits" value={formatNaira(debits, { compact: true })} caption="Taken off pay" />
        <StatCard
          label="Attendance deductions applied"
          value={formatNumber(attendanceApplied)}
          caption="Disabled by policy — the count is derived, not asserted"
          icon={Lock}
        />
      </StatGrid>

      <Alert tone="info" icon={ShieldCheck} className="mt-6 mb-4" title="Attendance breaches default to no financial consequence">
        {attendanceVoided > 0
          ? `The engine proposed ${formatNumber(attendanceVoided)} attendance adjustment and voided it automatically when the underlying record was corrected. Net effect: nothing. That row is kept — a voided adjustment is evidence, not noise.`
          : 'No attendance adjustment has been proposed on any period in the store.'}{' '}
        Enabling a deduction would take a new{' '}
        <Link to="/settings/policies" className="underline">
          attendance policy version
        </Link>{' '}
        and an employment-law review.
      </Alert>

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by reference, employee or source event"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                { key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })) },
                { key: 'status', label: 'Status', options: STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })) },
                { key: 'period', label: 'Period', options: periods.map((p) => ({ value: p.id, label: p.label })) },
                {
                  key: 'direction',
                  label: 'Direction',
                  options: [
                    { value: 'credit', label: 'Adds to pay' },
                    { value: 'debit', label: 'Takes off pay' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(adjustment) => adjustment.id}
            loading={state.loading}
            onRowClick={(adjustment) => setOpenId(adjustment.id)}
            activeRowKey={open?.id}
            rowClassName={(adjustment) => (adjustment.status === 'voided' ? 'bg-surface-sunken' : undefined)}
            density="compact"
            bordered={false}
            minWidth={2180}
            caption="Payroll adjustments with type, amount, source event, policy version, formula, status and dispute window"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No adjustments match these filters"
                  message="Try another type, status or period, or clear the search."
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
                  icon={SlidersHorizontal}
                  title="No adjustments on any period"
                  message="Everyone is being paid exactly their compensation version, with no commission, bonus or correction. On a live payroll that is worth checking rather than trusting."
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? open.ref : 'Adjustment'}
        description={open ? `${TYPE_LABEL[open.type]} · ${personName(open.employeeId)} · ${periodLabel(open.periodId)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            {open.status === 'voided' && (
              <Alert tone="info" icon={Lock} title="This adjustment was voided and had no financial effect">
                {open.voidedReason ?? 'No reason recorded.'}
              </Alert>
            )}

            <KeyValueList columns={2}>
              <KeyValue label="Amount">
                {open.status === 'voided' ? 'No effect' : formatNaira(open.amount)}
              </KeyValue>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Source event" hint={open.sourceEventType ?? undefined}>
                {open.sourceEventRef ?? 'Not recorded'}
              </KeyValue>
              <KeyValue label="Source record id">
                <span className="font-mono text-body-12">{open.sourceEventId ?? '—'}</span>
              </KeyValue>
              <KeyValue label="Policy version" hint="The rule in force when this was computed">
                {open.policyVersionId
                  ? (() => {
                      const policy = policies.find((p) => p.id === open.policyVersionId)
                      return policy ? `${policy.kind} v${policy.version}` : open.policyVersionId
                    })()
                  : 'None — agreed outside policy'}
              </KeyValue>
              <KeyValue label="Computed by">
                <span className="font-mono text-body-12">{open.formulaUsed ?? 'Not recorded'}</span>
              </KeyValue>
              <KeyValue label="Dispute window">
                {open.disputeWindowEndsAt ? formatDateTime(open.disputeWindowEndsAt) : 'Not disputable'}
              </KeyValue>
              <KeyValue label="Raised">
                {formatDateTime(open.createdAt)} by {userName(open.createdBy)}
              </KeyValue>
            </KeyValueList>

            <Alert tone="info" title="A correction is a new adjustment, never an edit">
              If this figure is wrong, the fix is another adjustment that names this one as its source. The row stays exactly
              as it is, so the payslip it produced can still be explained.
            </Alert>
          </div>
        )}
      </Drawer>
    </Page>
  )
}
