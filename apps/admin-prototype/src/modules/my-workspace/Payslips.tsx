/**
 * My payslips — `/my-workspace/payslips`.
 *
 * Opening one is a recorded act, not just a render: Payroll reports on who has
 * and has not looked at theirs, and that figure is only honest if reading a
 * payslip writes the fact down. Both timestamps here were already on the
 * record with nothing in the app setting them.
 *
 * The figures come from the payroll item behind the payslip, so what an
 * employee sees is the same row Finance processed — not a second calculation
 * that could drift from it.
 */

import { useMemo, useState } from 'react'
import { Download, FileText, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'

import {
  payrollItemsCollection,
  payrollPeriodsCollection,
  payslipsCollection,
  useCollection,
  type Payslip,
} from '@/mocks'
import { formatDate, formatDateTime, formatNaira } from '@/lib/format'
import {
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
  type Column,
} from '@/ui'

import { MyPageHeader, NoEmploymentRecord, Page, useMe } from './shared'
import { markPayslipDownloaded, markPayslipViewed, myPayslips } from './writes'

function PayLine({ label, amount }: { label: string; amount: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
      <span className="text-body-14 text-text">{label}</span>
      <MoneyCell kobo={amount} />
    </li>
  )
}

export default function MyPayslips() {
  const me = useMe()
  useCollection(payslipsCollection)
  const items = useCollection(payrollItemsCollection)
  const periods = useCollection(payrollPeriodsCollection)

  const [openId, setOpenId] = useState<string | null>(null)

  const rows = useMemo(
    () => (me.employee ? myPayslips(me.employee.id as string) : []),
    [me.employee],
  )

  const itemFor = (payslip: Payslip) => items.find((i) => i.id === payslip.payrollItemId)
  const periodLabel = (payslip: Payslip) =>
    periods.find((p) => p.id === payslip.periodId)?.label ?? 'Unknown period'

  const open = openId ? (rows.find((r) => r.id === openId) ?? null) : null
  const openItem = open ? itemFor(open) : undefined

  const view = (payslip: Payslip) => {
    setOpenId(payslip.id as string)
    if (me.userId) markPayslipViewed(payslip.id as string, me.userId)
  }

  const download = (payslip: Payslip) => {
    if (!me.userId) return
    markPayslipDownloaded(payslip.id as string, me.userId)
    // No file is produced in the prototype; what is real is the record that
    // it was asked for, which is what payroll reports on.
    toast.success(`${periodLabel(payslip)} payslip downloaded. The request is on your record.`)
  }

  const columns: Array<Column<Payslip>> = [
    {
      key: 'period',
      header: 'Period',
      minWidth: 180,
      accessor: (row) => periodLabel(row),
      sortValue: (row) => periodLabel(row),
      sortable: true,
    },
    {
      key: 'issued',
      header: 'Issued',
      width: 140,
      accessor: (row) => formatDate(row.issuedAt),
      sortValue: (row) => row.issuedAt,
      sortable: true,
    },
    {
      key: 'net',
      header: 'Net pay',
      align: 'right',
      width: 150,
      cell: (row) => {
        const item = itemFor(row)
        return item ? <MoneyCell kobo={item.net} strong /> : <span className="text-text-secondary">—</span>
      },
      sortValue: (row) => itemFor(row)?.net ?? 0,
      sortable: true,
    },
    {
      key: 'ytd',
      header: 'Year to date',
      align: 'right',
      width: 160,
      cell: (row) => <MoneyCell kobo={row.ytdNet} />,
      sortValue: (row) => row.ytdNet,
      sortable: true,
    },
    {
      key: 'seen',
      header: 'Opened',
      width: 130,
      cell: (row) =>
        row.viewedAt ? (
          <Badge tone="neutral" size="sm">
            {formatDate(row.viewedAt)}
          </Badge>
        ) : (
          <Badge tone="info" size="sm">
            New
          </Badge>
        ),
      sortValue: (row) => row.viewedAt ?? '',
      sortable: true,
    },
    {
      key: 'act',
      header: '',
      width: 130,
      cell: (row) => (
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Download size={14} aria-hidden="true" />}
          onClick={(e) => {
            e.stopPropagation()
            download(row)
          }}
        >
          Download
        </Button>
      ),
    },
  ]

  if (!me.employee) {
    return (
      <Page>
        <MyPageHeader title="My payslips" description="Every payslip issued to you, and what it was made of." />
        <NoEmploymentRecord what="Pay" />
      </Page>
    )
  }

  return (
    <Page>
      <MyPageHeader
        title="My payslips"
        description="Every payslip issued to you. Open one to see exactly how the figure was reached."
      />

      <Card>
        <CardBody padding="none">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            onRowClick={view}
            activeRowKey={open?.id}
            density="compact"
            minWidth={1000}
            bordered={false}
            caption="Your payslips with period, net pay and year-to-date totals"
            empty={
              <EmptyState
                icon={Receipt}
                title="No payslip has been issued to you"
                message="One appears here the first time a payroll period you are on is closed and paid."
              />
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? periodLabel(open) : 'Payslip'}
        description={open ? `Issued ${formatDate(open.issuedAt)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            {!openItem ? (
              <EmptyState
                size="sm"
                bordered
                title="The payroll line behind this payslip is missing"
                message="Nothing can be shown without it. Payroll can say why it is not on file."
              />
            ) : (
              <>
                <div className="rounded-2xl bg-surface-sunken px-5 py-4">
                  <p className="text-body-12 text-text-secondary">Net pay</p>
                  <p className="mt-1 text-heading-28 tabular-nums">{formatNaira(openItem.net)}</p>
                  <p className="mt-1 text-body-12 text-text-secondary">
                    {`${formatNaira(openItem.gross)} gross less ${formatNaira(openItem.deductions)} in deductions`}
                  </p>
                </div>

                <div>
                  <h3 className="mb-3 text-heading-18">What you earned</h3>
                  <ul className="flex flex-col gap-2">
                    <PayLine label="Basic salary" amount={openItem.base} />
                    {openItem.allowanceLines.map((line, i) => (
                      <PayLine key={`a-${line.label}-${i}`} label={line.label} amount={line.amount} />
                    ))}
                    {openItem.bonusLines.map((line, i) => (
                      <PayLine key={`b-${line.label}-${i}`} label={line.label} amount={line.amount} />
                    ))}
                    {openItem.commissionLines.map((line, i) => (
                      <PayLine key={`c-${line.ref}-${i}`} label={`Commission ${line.ref}`} amount={line.amount} />
                    ))}
                    <li className="flex items-center justify-between gap-3 rounded-xl bg-surface-sunken px-3 py-2.5">
                      <span className="text-body-14 font-semibold text-text">Gross</span>
                      <MoneyCell kobo={openItem.gross} strong />
                    </li>
                  </ul>
                </div>

                {openItem.statutoryLines.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-heading-18">What was deducted</h3>
                    <ul className="flex flex-col gap-2">
                      {openItem.statutoryLines.map((line, i) => (
                        <li
                          key={`${line.label}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                        >
                          <span className="text-body-14 text-text">{line.label}</span>
                          <MoneyCell kobo={line.amount} tone="negative" />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <h3 className="mb-3 text-heading-18">Year to date</h3>
                  <KeyValueList columns={2}>
                    <KeyValue label="Gross">{formatNaira(open.ytdGross)}</KeyValue>
                    <KeyValue label="Deductions">{formatNaira(open.ytdDeductions)}</KeyValue>
                    <KeyValue label="Net">{formatNaira(open.ytdNet)}</KeyValue>
                  </KeyValueList>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <span className="text-body-12 text-text-secondary">
                    {open.downloadedAt
                      ? `Last downloaded ${formatDateTime(open.downloadedAt)}`
                      : 'Not downloaded yet'}
                  </span>
                  <Button
                    variant="secondary"
                    leftIcon={<FileText size={16} aria-hidden="true" />}
                    onClick={() => download(open)}
                  >
                    Download payslip
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Drawer>
    </Page>
  )
}
