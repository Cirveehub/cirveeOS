import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Check, ExternalLink, Lock, Wallet } from 'lucide-react'

import { cn } from '@/lib/cn'
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
  KeyValue,
  KeyValueList,
  MoneyCell,
  PageHeader,
  SectionHeader,
  StatCard,
  StatusBadge,
  UnitTag,
  type Column,
} from '@/ui'
import {
  commissionsCollection,
  payrollAdjustmentsCollection,
  payrollItemsCollection,
  payrollPeriodsCollection,
  payslipsCollection,
  policyVersionsCollection,
  useCollection,
} from '@/mocks'
import type { PayrollAdjustment, PayrollItem, PayrollPeriod } from '@/mocks'

import {
  Caption,
  PAYROLL_TABS,
  Page,
  ScreenError,
  StatGrid,
  personName,
  unitKey,
  unitName,
  useModuleNav,
  useScreenState,
  userName,
} from './shared'

const ADJUSTMENT_LABEL: Record<PayrollAdjustment['type'], string> = {
  attendance: 'Attendance',
  commission: 'Commission',
  performance_bonus: 'Performance bonus',
  advance_repayment: 'Advance repayment',
  manual_correction: 'Manual correction',
  statutory: 'Statutory',
}

interface Stage {
  id: string
  label: string
  done: boolean
  note: string
}

function buildStages(
  period: PayrollPeriod,
  items: PayrollItem[],
  adjustments: PayrollAdjustment[],
  payslipCount: number,
): Stage[] {
  const commissionLines = items.flatMap((i) => i.commissionLines).length
  const bonusLines = items.flatMap((i) => i.bonusLines).length
  const advances = adjustments.filter((a) => a.type === 'advance_repayment').length
  const unresolved = adjustments.filter((a) => a.status === 'proposed' || a.status === 'disputed').length
  const financeReviewed = adjustments.filter((a) => a.status === 'finance_reviewed' || a.status === 'applied').length

  return [
    { id: 'open', label: 'Open', done: true, note: `Opened ${formatDate(period.openedAt)}` },
    {
      id: 'adjustments',
      label: 'Import adjustments',
      done: adjustments.length > 0,
      note: `${formatNumber(adjustments.length)} imported`,
    },
    {
      id: 'commission',
      label: 'Add commission',
      done: commissionLines > 0,
      note: `${formatNumber(commissionLines)} lines`,
    },
    { id: 'bonus', label: 'Add bonuses', done: bonusLines > 0, note: `${formatNumber(bonusLines)} lines` },
    {
      id: 'advances',
      label: 'Advances and deductions',
      done: advances > 0,
      note: `${formatNumber(advances)} repayments`,
    },
    {
      id: 'exceptions',
      label: 'Review exceptions',
      done: adjustments.length > 0 && unresolved === 0,
      note: unresolved === 0 ? 'Nothing outstanding' : `${formatNumber(unresolved)} outstanding`,
    },
    {
      id: 'finance',
      label: 'Finance review',
      done: financeReviewed > 0 && unresolved === 0,
      note: `${formatNumber(financeReviewed)} reviewed`,
    },
    {
      id: 'authorisation',
      label: 'Authorisation',
      done: period.approvedByUserId !== null,
      note: period.approvedByUserId ? userName(period.approvedByUserId) : 'Not yet authorised',
    },
    {
      id: 'payment',
      label: 'Payment',
      done: period.status === 'paid' || period.status === 'closed',
      note: period.status === 'paid' || period.status === 'closed' ? 'Paid' : 'Not paid',
    },
    {
      id: 'payslips',
      label: 'Payslips',
      done: payslipCount > 0,
      note: `${formatNumber(payslipCount)} issued`,
    },
    {
      id: 'close',
      label: 'Close',
      done: period.status === 'closed',
      note: period.closedAt ? formatDate(period.closedAt) : 'Still open',
    },
  ]
}

export default function PeriodDetail() {
  const { id = '' } = useParams()
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()

  const periods = useCollection(payrollPeriodsCollection)
  const allItems = useCollection(payrollItemsCollection)
  const allAdjustments = useCollection(payrollAdjustmentsCollection)
  const payslips = useCollection(payslipsCollection)
  const commissions = useCollection(commissionsCollection)
  const policies = useCollection(policyVersionsCollection)

  const [openId, setOpenId] = useState<string | null>(null)

  const period = periods.find((p) => p.id === id) ?? null
  const items = useMemo(() => allItems.filter((i) => i.periodId === id), [allItems, id])
  const adjustments = useMemo(() => allAdjustments.filter((a) => a.periodId === id), [allAdjustments, id])
  const periodPayslips = useMemo(() => payslips.filter((p) => p.periodId === id), [payslips, id])

  const adjustmentById = useMemo(
    () => new Map(adjustments.map((a) => [a.id as string, a])),
    [adjustments],
  )
  const commissionById = useMemo(
    () => new Map(commissions.map((c) => [c.id as string, c])),
    [commissions],
  )

  const locked = period?.status === 'closed'

  const sums = useMemo(() => {
    const allowances = items.flatMap((i) => i.allowanceLines).reduce((acc, l) => acc + l.amount, 0)
    const commission = items.flatMap((i) => i.commissionLines).reduce((acc, l) => acc + l.amount, 0)
    const bonus = items.flatMap((i) => i.bonusLines).reduce((acc, l) => acc + l.amount, 0)
    const base = items.reduce((acc, i) => acc + i.base, 0)
    return { allowances, commission, bonus, base }
  }, [items])

  const appliedAdjustments = (item: PayrollItem) =>
    item.adjustmentIds.map((adjId) => adjustmentById.get(adjId)).filter((a): a is PayrollAdjustment => Boolean(a))

  const advanceRepayment = (item: PayrollItem) =>
    appliedAdjustments(item)
      .filter((a) => a.type === 'advance_repayment' && a.status === 'applied')
      .reduce((acc, a) => acc + a.amount, 0)

  const header = (
    <PageHeader
      title={period ? `${period.label} payroll` : 'Payroll period'}
      description={
        period
          ? 'Every component below other than base salary opens the record that produced it. Click a row for the full breakdown.'
          : undefined
      }
      breadcrumbs={[
        { label: 'Payroll', to: '/payroll' },
        { label: 'Periods', to: '/payroll/periods' },
        { label: period?.label ?? 'Period' },
      ]}
      tabs={PAYROLL_TABS}
      activeTab="periods"
      onTabChange={navigate}
      actions={
        <Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('periods')}>
          All periods
        </Button>
      }
    />
  )

  if (!period && !state.loading) {
    return (
      <Page>
        {header}
        <EmptyState
          icon={Wallet}
          title="That payroll period does not exist"
          message="It may never have been opened. Periods are never deleted, so anything that has ever run is still on the list."
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('periods')}>
              Back to periods
            </Button>
          }
        />
      </Page>
    )
  }

  const stages = period ? buildStages(period, items, adjustments, periodPayslips.length) : []
  const open = openId ? items.find((i) => i.id === openId) ?? null : null

  const columns: Array<Column<PayrollItem>> = [
    {
      key: 'employee',
      header: 'Employee',
      pinned: true,
      minWidth: 200,
      accessor: (item) => personName(item.employeeId),
      sortValue: (item) => personName(item.employeeId),
      sortable: true,
    },
    {
      key: 'unit',
      header: 'Unit',
      width: 136,
      cell: (item) => {
        const key = unitKey(item.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : <span className="text-text-secondary">Unassigned</span>
      },
      sortValue: (item) => unitName(item.unitId),
      sortable: true,
    },
    {
      key: 'base',
      header: 'Base',
      align: 'right',
      width: 152,
      cell: (item) => <MoneyCell kobo={item.base} />,
      sortValue: (item) => item.base,
      sortable: true,
    },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      width: 172,
      cell: (item) => {
        const total = item.commissionLines.reduce((acc, l) => acc + l.amount, 0)
        if (total === 0) return <span className="text-body-13 text-text-secondary">—</span>
        return (
          <Link
            to="/referral/commissions"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 hover:underline"
          >
            <MoneyCell kobo={total} />
            <ExternalLink size={12} aria-hidden="true" className="text-text-secondary" />
            <span className="sr-only">Open the commission ledger</span>
          </Link>
        )
      },
      sortValue: (item) => item.commissionLines.reduce((acc, l) => acc + l.amount, 0),
      sortable: true,
    },
    {
      key: 'bonus',
      header: 'Bonus',
      align: 'right',
      width: 152,
      cell: (item) => {
        const total = item.bonusLines.reduce((acc, l) => acc + l.amount, 0)
        return total === 0 ? <span className="text-body-13 text-text-secondary">—</span> : <MoneyCell kobo={total} />
      },
      sortValue: (item) => item.bonusLines.reduce((acc, l) => acc + l.amount, 0),
      sortable: true,
    },
    {
      key: 'allowances',
      header: 'Allowances',
      align: 'right',
      width: 164,
      cell: (item) => <MoneyCell kobo={item.allowanceLines.reduce((acc, l) => acc + l.amount, 0)} />,
      sortValue: (item) => item.allowanceLines.reduce((acc, l) => acc + l.amount, 0),
      sortable: true,
    },
    {
      key: 'advance',
      header: 'Advance repayment',
      align: 'right',
      width: 184,
      cell: (item) => {
        const total = advanceRepayment(item)
        return total === 0 ? <span className="text-body-13 text-text-secondary">—</span> : <MoneyCell kobo={total} signed />
      },
      sortValue: (item) => advanceRepayment(item),
      sortable: true,
    },
    {
      key: 'statutory',
      header: 'Statutory',
      align: 'right',
      width: 164,
      cell: (item) => <MoneyCell kobo={item.statutoryLines.reduce((acc, l) => acc + l.amount, 0)} />,
      sortValue: (item) => item.statutoryLines.reduce((acc, l) => acc + l.amount, 0),
      sortable: true,
    },
    {
      key: 'adjustments',
      header: 'Adjustments',
      minWidth: 240,
      cell: (item) => {
        const rows = appliedAdjustments(item)
        if (rows.length === 0) return <span className="text-body-13 text-text-secondary">None</span>
        return (
          <div className="flex flex-wrap gap-1">
            {rows.map((adjustment) => (
              <Badge
                key={adjustment.id}
                tone={adjustment.status === 'voided' ? 'neutral' : adjustment.amount < 0 ? 'warning' : 'accent'}
                size="sm"
              >
                {ADJUSTMENT_LABEL[adjustment.type]}
                {adjustment.status === 'voided' ? ' · voided' : ''}
              </Badge>
            ))}
          </div>
        )
      },
      sortValue: (item) => item.adjustmentIds.length,
      sortable: true,
    },
    {
      key: 'gross',
      header: 'Gross',
      align: 'right',
      width: 168,
      cell: (item) => <MoneyCell kobo={item.gross} />,
      sortValue: (item) => item.gross,
      sortable: true,
    },
    {
      key: 'deductions',
      header: 'Deductions',
      align: 'right',
      width: 164,
      cell: (item) => <MoneyCell kobo={item.deductions} />,
      sortValue: (item) => item.deductions,
      sortable: true,
    },
    {
      key: 'net',
      header: 'Net',
      align: 'right',
      width: 172,
      cell: (item) => <MoneyCell kobo={item.net} strong />,
      sortValue: (item) => item.net,
      sortable: true,
    },
  ]

  return (
    <Page>
      {header}
      <ScreenError state={state} />

      {period && (
        <>
          {locked && (
            <Alert tone="info" icon={Lock} className="mb-4" title={`${period.label} is closed and cannot be edited`}>
              Payslips have been issued against these figures and people have been paid on them. A correction to this period
              is raised as an adjustment on the open period, naming this one as its source.
            </Alert>
          )}

          <StatGrid>
            <StatCard label="Status" value={period.label} caption={<StatusBadge status={period.status} size="sm" />} />
            <StatCard label="Employees" value={formatNumber(items.length)} caption="Drawn from active compensation versions" />
            <StatCard label="Gross" value={formatNaira(period.grossTotal, { compact: true })} caption={formatNaira(period.grossTotal)} />
            <StatCard
              label="Deductions"
              value={formatNaira(period.deductionTotal, { compact: true })}
              caption="PAYE, pension and NHF"
            />
            <StatCard
              label="Net"
              value={formatNaira(period.netTotal, { compact: true })}
              caption={formatNaira(period.netTotal)}
              variant="success"
            />
          </StatGrid>

          {/* Lifecycle */}
          <Card className="mt-6">
            <SectionHeader
              as="h2"
              size="sm"
              title="Lifecycle"
              description="Each step is marked from what is actually in the store, not from a status field somebody remembered to set."
              className="mb-4"
            />
            <ol className="flex flex-wrap gap-2">
              {stages.map((stage, index) => (
                <li
                  key={stage.id}
                  className={cn(
                    'flex min-w-[148px] flex-1 items-start gap-2 rounded-xl border px-3 py-2',
                    stage.done ? 'border-success-line bg-success-fill' : 'border-border bg-surface-sunken',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full text-label-10',
                      stage.done ? 'bg-success-line text-success-ink' : 'bg-border text-text-secondary',
                    )}
                  >
                    {stage.done ? <Check size={12} /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn('block text-body-13', stage.done ? 'text-success-ink' : 'text-text')}
                    >
                      {stage.label}
                    </span>
                    <span className="block text-body-12 text-text-secondary">{stage.note}</span>
                    <span className="sr-only">{stage.done ? 'Complete' : 'Not complete'}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card>

          {/* Per-employee */}
          <Card className="mt-6" padding="none">
            <div className="border-b border-border px-4 py-3">
              <SectionHeader
                as="h2"
                size="sm"
                title="Per employee"
                description="Base is the compensation version in force. Everything else came from somewhere and says where."
                count={items.length}
              />
            </div>
            <CardBody padding="none">
              <DataTable
                data={items}
                columns={columns}
                rowKey={(item) => item.id}
                loading={state.loading}
                onRowClick={(item) => setOpenId(item.id)}
                activeRowKey={open?.id}
                density="compact"
                bordered={false}
                minWidth={2120}
                caption={`${period.label} payroll by employee, with base, commission, bonus, allowances, advances, statutory deductions, adjustments and net`}
                empty={
                  <EmptyState
                    icon={Wallet}
                    title="No payroll lines on this period"
                    message="The period is open but nobody has been drawn into it, so nothing will be paid. A line is created per active employee from their current compensation version."
                  />
                }
              />
            </CardBody>
            <div className="border-t border-border px-4 py-3">
              <Caption>
                Base {formatNaira(sums.base)} · allowances {formatNaira(sums.allowances)} · commission{' '}
                {formatNaira(sums.commission)} · bonus {formatNaira(sums.bonus)}. Gross {formatNaira(period.grossTotal)} less
                deductions {formatNaira(period.deductionTotal)} is net {formatNaira(period.netTotal)}.
              </Caption>
            </div>
          </Card>
        </>
      )}

      {/* Breakdown */}
      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        size="xl"
        title={open ? personName(open.employeeId) : 'Payroll line'}
        description={open ? `${period?.label} · every component traced to its source` : undefined}
        footer={
          open && (
            <Button
              variant="secondary"
              onClick={() => {
                const payslip = periodPayslips.find((p) => p.payrollItemId === open.id)
                if (payslip) routerNavigate(`/payroll/payslips/${payslip.id}`)
                else toast('No payslip yet — payslips are issued when the period closes.')
              }}
            >
              Open the payslip
            </Button>
          )
        }
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Unit" hint="Where this cost is allocated">
                {unitName(open.unitId)}
              </KeyValue>
              <KeyValue label="Period">
                <span className="inline-flex items-center gap-2">
                  {period?.label}
                  {period && <StatusBadge status={period.status} size="sm" />}
                </span>
              </KeyValue>
              <KeyValue label="Gross">{formatNaira(open.gross)}</KeyValue>
              <KeyValue label="Net">{formatNaira(open.net)}</KeyValue>
            </KeyValueList>

            <section>
              <h3 className="mb-2 text-heading-18">Earnings</h3>
              <ul className="divide-y divide-border">
                <li className="flex items-baseline justify-between gap-4 py-2">
                  <span className="text-body-14">Base salary</span>
                  <span className="text-body-14 tabular-nums">{formatNaira(open.base)}</span>
                </li>
                {open.allowanceLines.map((line) => (
                  <li key={line.label} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-body-14">{line.label}</span>
                    <span className="text-body-14 tabular-nums">{formatNaira(line.amount)}</span>
                  </li>
                ))}
                {open.commissionLines.map((line) => {
                  const commission = commissionById.get(line.commissionId)
                  return (
                    <li key={line.commissionId} className="flex items-baseline justify-between gap-4 py-2">
                      <span className="min-w-0 text-body-14">
                        Commission{' '}
                        <Link to="/referral/commissions" className="font-mono text-body-13 text-accent hover:underline">
                          {line.ref}
                        </Link>
                        {commission && (
                          <span className="block text-body-12 text-text-secondary">
                            Computed under {commission.ruleKey} v{commission.ruleVersion} · {commission.roleOnDeal.replace(/_/g, ' ')}
                          </span>
                        )}
                      </span>
                      <span className="text-body-14 tabular-nums">{formatNaira(line.amount)}</span>
                    </li>
                  )
                })}
                {open.bonusLines.map((line) => (
                  <li key={line.label} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="min-w-0 text-body-14">
                      {line.label}
                      {line.sourceRef && (
                        <span className="block font-mono text-body-12 text-text-secondary">Source {line.sourceRef}</span>
                      )}
                    </span>
                    <span className="text-body-14 tabular-nums">{formatNaira(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-heading-18">Adjustments</h3>
              {appliedAdjustments(open).length === 0 ? (
                <p className="text-body-13 text-text-secondary">
                  No adjustments on this line. Base plus allowances is the whole of the earnings side.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {appliedAdjustments(open).map((adjustment) => {
                    const policy = adjustment.policyVersionId
                      ? policies.find((p) => p.id === adjustment.policyVersionId)
                      : null
                    return (
                      <li key={adjustment.id} className="py-3">
                        <div className="flex items-baseline justify-between gap-4">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <Link to="/payroll/adjustments" className="font-mono text-body-13 text-accent hover:underline">
                              {adjustment.ref}
                            </Link>
                            <Badge tone="neutral" size="sm">
                              {ADJUSTMENT_LABEL[adjustment.type]}
                            </Badge>
                            <StatusBadge status={adjustment.status} size="sm" />
                          </span>
                          <span className="text-body-14 tabular-nums">
                            {adjustment.status === 'voided' ? 'No effect' : formatNaira(adjustment.amount)}
                          </span>
                        </div>
                        <dl className="mt-1 space-y-0.5 text-body-12 text-text-secondary">
                          <div>
                            <dt className="inline">Source event: </dt>
                            <dd className="inline">
                              {adjustment.sourceEventRef ?? 'Not recorded'}
                              {adjustment.sourceEventType ? ` (${adjustment.sourceEventType})` : ''}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline">Policy version: </dt>
                            <dd className="inline">
                              {policy ? `${policy.kind} v${policy.version}` : 'None — agreed outside policy'}
                            </dd>
                          </div>
                          <div>
                            <dt className="inline">Computed by: </dt>
                            <dd className="inline font-mono">{adjustment.formulaUsed ?? 'Not recorded'}</dd>
                          </div>
                          {adjustment.voidedReason && (
                            <div>
                              <dt className="inline">Voided: </dt>
                              <dd className="inline">{adjustment.voidedReason}</dd>
                            </div>
                          )}
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-heading-18">Deductions</h3>
              <ul className="divide-y divide-border">
                {open.statutoryLines.map((line) => (
                  <li key={line.label} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="text-body-14">
                      {line.label}
                      <span className="block text-body-12 text-text-secondary">
                        {line.label === 'PAYE'
                          ? 'Computed on gross'
                          : line.label === 'Pension'
                            ? 'Computed on base salary'
                            : 'National Housing Fund, computed on base salary'}
                      </span>
                    </span>
                    <span className="text-body-14 tabular-nums">{formatNaira(line.amount)}</span>
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex items-baseline justify-between gap-4 rounded-xl bg-surface-sunken px-4 py-3">
              <span className="text-body-14 text-text">Net pay</span>
              <span className="text-heading-18 tabular-nums text-text">{formatNaira(open.net)}</span>
            </div>

            <Caption>
              Line recorded {formatDateTime(open.createdAt)} by {userName(open.createdBy)}.
            </Caption>
          </div>
        )}
      </Drawer>
    </Page>
  )
}
