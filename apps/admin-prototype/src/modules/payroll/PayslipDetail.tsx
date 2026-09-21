/**
 * A rendered payslip.
 *
 * Earnings, adjustments, deductions, net and year-to-date — and **every
 * adjustment line names the event that produced it**, because a payslip that
 * cannot explain a number is how pay disputes start.
 */
import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, Download, Receipt } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  KeyValue,
  KeyValueList,
  PageHeader,
  SectionHeader,
  Separator,
  StatusBadge,
  UnitTag,
} from '@/ui'
import {
  commissionsCollection,
  employeesCollection,
  payrollAdjustmentsCollection,
  payrollItemsCollection,
  payrollPeriodsCollection,
  payslipsCollection,
  policyVersionsCollection,
  useCollection,
} from '@/mocks'
import type { PayrollAdjustment } from '@/mocks'

import {
  Caption,
  PAYROLL_TABS,
  Page,
  ScreenError,
  branchName,
  personName,
  unitKey,
  unitName,
  useModuleNav,
  useScreenState,
} from './shared'

const TYPE_LABEL: Record<PayrollAdjustment['type'], string> = {
  attendance: 'Attendance',
  commission: 'Commission',
  performance_bonus: 'Performance bonus',
  advance_repayment: 'Advance repayment',
  manual_correction: 'Manual correction',
  statutory: 'Statutory',
}

function Line({ label, detail, amount }: { label: string; detail?: React.ReactNode; amount: number }) {
  return (
    <li className="flex items-baseline justify-between gap-6 py-2">
      <span className="min-w-0">
        <span className="block text-body-14 text-text">{label}</span>
        {detail && <span className="block text-body-12 text-text-secondary">{detail}</span>}
      </span>
      <span className="shrink-0 text-body-14 tabular-nums text-text">{formatNaira(amount)}</span>
    </li>
  )
}

export default function PayslipDetail() {
  const { id = '' } = useParams()
  const state = useScreenState()
  const navigate = useModuleNav()

  const payslips = useCollection(payslipsCollection)
  const items = useCollection(payrollItemsCollection)
  const periods = useCollection(payrollPeriodsCollection)
  const adjustments = useCollection(payrollAdjustmentsCollection)
  const employees = useCollection(employeesCollection)
  const commissions = useCollection(commissionsCollection)
  const policies = useCollection(policyVersionsCollection)

  const payslip = payslips.find((p) => p.id === id) ?? null
  const item = payslip ? items.find((i) => i.id === payslip.payrollItemId) ?? null : null
  const period = payslip ? periods.find((p) => p.id === payslip.periodId) ?? null : null
  const employee = payslip ? employees.find((e) => e.id === payslip.employeeId) ?? null : null

  const applied = useMemo(
    () => (item ? adjustments.filter((a) => item.adjustmentIds.includes(a.id)) : []),
    [adjustments, item],
  )

  const header = (
    <PageHeader
      title={payslip ? `Payslip · ${personName(payslip.employeeId)}` : 'Payslip'}
      description={period ? `${period.label} · issued ${formatDate(payslip?.issuedAt ?? period.openedAt)}` : undefined}
      breadcrumbs={[
        { label: 'Payroll', to: '/payroll' },
        { label: 'Payslips', to: '/payroll/payslips' },
        { label: payslip ? personName(payslip.employeeId) : 'Payslip' },
      ]}
      tabs={PAYROLL_TABS}
      activeTab="payslips"
      onTabChange={navigate}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('payslips')}>
            All payslips
          </Button>
          <Button
            size="sm"
            leftIcon={<Download size={16} />}
            onClick={() => toast('Not built in this prototype — this would render the PDF and record the download.')}
          >
            Download
          </Button>
        </div>
      }
    />
  )

  if (!payslip || !item) {
    return (
      <Page>
        {header}
        <ScreenError state={state} />
        {!state.loading && (
          <EmptyState
            icon={Receipt}
            title="That payslip does not exist"
            message="Payslips are issued when a period closes, and are never removed once issued. Check the payslip list for the period you meant."
            action={
              <Button size="sm" variant="secondary" onClick={() => navigate('payslips')}>
                Back to payslips
              </Button>
            }
          />
        )}
      </Page>
    )
  }

  const earningsTotal =
    item.base +
    item.allowanceLines.reduce((acc, l) => acc + l.amount, 0) +
    item.commissionLines.reduce((acc, l) => acc + l.amount, 0) +
    item.bonusLines.reduce((acc, l) => acc + l.amount, 0)

  return (
    <Page>
      {header}
      <ScreenError state={state} />

      <Card className="mx-auto max-w-3xl">
        <SectionHeader
          as="h2"
          title={personName(payslip.employeeId)}
          description={employee ? `${employee.jobTitle} · ${employee.employeeId}` : undefined}
          actions={period && <StatusBadge status={period.status} />}
        />

        <Separator className="my-4" />

        <KeyValueList columns={2}>
          <KeyValue label="Period">{period?.label ?? 'Unknown period'}</KeyValue>
          <KeyValue label="Issued">{formatDateTime(payslip.issuedAt)}</KeyValue>
          <KeyValue label="Unit" hint="Where this cost is allocated">
            {(() => {
              const key = unitKey(item.unitId)
              return key ? <UnitTag unit={key} size="sm" /> : unitName(item.unitId)
            })()}
          </KeyValue>
          <KeyValue label="Branch">{employee ? branchName(employee.branchId) : '—'}</KeyValue>
        </KeyValueList>

        <Separator className="my-6" />

        <section>
          <h3 className="mb-1 text-heading-18 text-text">Earnings</h3>
          <ul className="divide-y divide-border">
            <Line label="Base salary" detail="The compensation version in force for this period" amount={item.base} />
            {item.allowanceLines.map((line) => (
              <Line key={line.label} label={line.label} amount={line.amount} />
            ))}
            {item.commissionLines.map((line) => {
              const commission = commissions.find((c) => c.id === line.commissionId)
              return (
                <Line
                  key={line.commissionId}
                  label={`Commission ${line.ref}`}
                  detail={
                    <>
                      {commission
                        ? `Computed under ${commission.ruleKey} v${commission.ruleVersion}, as ${commission.roleOnDeal.replace(/_/g, ' ')}. `
                        : 'Source commission not found in the ledger. '}
                      <Link to="/referral/commissions" className="text-accent hover:underline">
                        Open the ledger
                      </Link>
                    </>
                  }
                  amount={line.amount}
                />
              )
            })}
            {item.bonusLines.map((line) => (
              <Line
                key={line.label}
                label={line.label}
                detail={line.sourceRef ? `Source ${line.sourceRef}` : undefined}
                amount={line.amount}
              />
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-6 border-t border-border-strong py-2">
            <span className="text-body-14 text-text-label">Total earnings</span>
            <span className="text-body-14 tabular-nums text-text">{formatNaira(earningsTotal)}</span>
          </div>
        </section>

        <Separator className="my-6" />

        <section>
          <h3 className="mb-1 text-heading-18 text-text">Adjustments</h3>
          {applied.length === 0 ? (
            <p className="py-2 text-body-13 text-text-secondary">
              None on this payslip. Base plus allowances is the whole of the earnings side.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {applied.map((adjustment) => {
                const policy = adjustment.policyVersionId
                  ? policies.find((p) => p.id === adjustment.policyVersionId)
                  : null
                return (
                  <li key={adjustment.id} className="py-3">
                    <div className="flex items-baseline justify-between gap-6">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <Link to="/payroll/adjustments" className="font-mono text-body-13 text-accent hover:underline">
                            {adjustment.ref}
                          </Link>
                          <Badge tone="neutral" size="sm">
                            {TYPE_LABEL[adjustment.type]}
                          </Badge>
                          <StatusBadge status={adjustment.status} size="sm" />
                        </span>
                        <span className="mt-0.5 block text-body-12 text-text-secondary">
                          Source: {adjustment.sourceEventRef ?? 'not recorded'}
                          {adjustment.sourceEventType ? ` (${adjustment.sourceEventType})` : ''} ·{' '}
                          {policy ? `${policy.kind} v${policy.version}` : 'no policy version'} ·{' '}
                          <span className="font-mono">{adjustment.formulaUsed ?? 'formula not recorded'}</span>
                        </span>
                        {adjustment.voidedReason && (
                          <span className="mt-0.5 block text-body-12 text-text-secondary">{adjustment.voidedReason}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-body-14 tabular-nums text-text">
                        {adjustment.status === 'voided' ? 'No effect' : formatNaira(adjustment.amount)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <Separator className="my-6" />

        <section>
          <h3 className="mb-1 text-heading-18 text-text">Deductions</h3>
          <ul className="divide-y divide-border">
            {item.statutoryLines.map((line) => (
              <Line
                key={line.label}
                label={line.label}
                detail={
                  line.label === 'PAYE'
                    ? 'Pay As You Earn, computed on gross'
                    : line.label === 'Pension'
                      ? 'Employee contribution, computed on base salary'
                      : 'National Housing Fund, computed on base salary'
                }
                amount={line.amount}
              />
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-6 border-t border-border-strong py-2">
            <span className="text-body-14 text-text-label">Total deductions</span>
            <span className="text-body-14 tabular-nums text-text">{formatNaira(item.deductions)}</span>
          </div>
        </section>

        <div className="mt-6 flex items-baseline justify-between gap-6 rounded-xl bg-accent-wash px-4 py-3">
          <span className="text-body-15 text-text">Net pay</span>
          <span className="text-heading-24 tabular-nums text-text">{formatNaira(item.net)}</span>
        </div>

        <Separator className="my-6" />

        <section>
          <h3 className="mb-3 text-heading-18 text-text">Year to date</h3>
          <KeyValueList columns={2}>
            <KeyValue label="Gross">{formatNaira(payslip.ytdGross)}</KeyValue>
            <KeyValue label="Deductions">{formatNaira(payslip.ytdDeductions)}</KeyValue>
            <KeyValue label="Net">{formatNaira(payslip.ytdNet)}</KeyValue>
          </KeyValueList>
        </section>

        <Alert tone="info" className="mt-6" title="Every adjustment above links to the event that produced it">
          Nothing on this payslip is an unexplained number. If a figure is disputed, the source event, the policy version and
          the formula are all one click away — and a correction is raised as a new adjustment in the next period, never as an
          edit to this one.
        </Alert>

        <Caption>
          Viewed {payslip.viewedAt ? formatDateTime(payslip.viewedAt) : 'never'} · downloaded{' '}
          {payslip.downloadedAt ? formatDateTime(payslip.downloadedAt) : 'never'}.
        </Caption>
      </Card>
    </Page>
  )
}
