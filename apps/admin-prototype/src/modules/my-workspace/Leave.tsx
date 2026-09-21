import { useMemo, useState } from 'react'
import { CalendarOff, CalendarPlus } from 'lucide-react'
import toast from 'react-hot-toast'

import { TODAY, leaveRequestsCollection, useCollection, type LeaveType } from '@/mocks'
import { formatDate, formatNumber, pluralize } from '@/lib/format'
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  ProgressBar,
  Select,
  StatusBadge,
  Textarea,
  type Column,
} from '@/ui'
import type { LeaveRequest } from '@/mocks'

import { LEAVE_TYPE_LABEL, MyPageHeader, NoEmploymentRecord, Page, leaveLabel, useMe, workingDays } from './shared'
import { cancelLeaveRequest, myLeave, remainingFor, requestLeave } from './writes'

const LEAVE_TYPES: LeaveType[] = ['annual', 'sick', 'compassionate', 'maternity', 'paternity', 'study', 'unpaid']

export default function MyLeave() {
  const me = useMe()
  useCollection(leaveRequestsCollection)

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<LeaveType>('annual')
  const [fromDate, setFromDate] = useState(TODAY)
  const [toDate, setToDate] = useState(TODAY)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const requests = useMemo(
    () => (me.employee ? myLeave(me.employee.id as string) : []),
    [me.employee],
  )

  const days = workingDays(fromDate, toDate)
  const remaining = me.employee ? remainingFor(me.employee, type) : 0
  const overdrawn = days > 0 && days > remaining
  const pending = requests.filter((r) => r.status === 'requested')

  const reset = () => {
    setType('annual')
    setFromDate(TODAY)
    setToDate(TODAY)
    setReason('')
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (!me.employee || !me.userId) return
    const result = requestLeave({
      employee: me.employee,
      userId: me.userId,
      type,
      fromDate,
      toDate,
      reason,
    })
    if (!result.ok) {
      toast.error(result.reason ?? 'That request could not be raised.')
      return
    }
    toast.success(
      result.routed
        ? `${pluralize(days, 'day')} requested. It is with your approver now — your balance is untouched until they decide.`
        : `${pluralize(days, 'day')} requested and saved, but no approver chain is configured for leave, so nobody has been asked yet.`,
    )
    setOpen(false)
    reset()
  }

  const columns: Array<Column<LeaveRequest>> = [
    {
      key: 'ref',
      header: 'Reference',
      width: 140,
      accessor: (row) => <span className="font-mono text-body-13">{row.ref}</span>,
      sortValue: (row) => row.ref,
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 140,
      accessor: (row) => LEAVE_TYPE_LABEL[row.type] ?? row.type,
      sortValue: (row) => row.type,
      sortable: true,
    },
    {
      key: 'dates',
      header: 'Dates',
      minWidth: 220,
      accessor: (row) => `${formatDate(row.fromDate)} — ${formatDate(row.toDate)}`,
      sortValue: (row) => row.fromDate,
      sortable: true,
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right',
      width: 90,
      accessor: (row) => formatNumber(row.days),
      sortValue: (row) => row.days,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 130,
      cell: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
      sortable: true,
    },
    {
      key: 'reason',
      header: 'Reason',
      minWidth: 260,
      accessor: (row) => <span className="text-body-13 text-text-secondary">{row.reason}</span>,
      sortValue: (row) => row.reason,
    },
    {
      key: 'act',
      header: '',
      width: 116,
      cell: (row) =>
        row.status === 'requested' ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (!me.userId) return
              const result = cancelLeaveRequest(row.id as string, me.userId)
              if (!result.ok) toast.error(result.reason ?? 'That could not be withdrawn.')
              else toast.success(`${row.ref} withdrawn. The row stays on your record.`)
            }}
          >
            Withdraw
          </Button>
        ) : null,
    },
  ]

  if (!me.employee) {
    return (
      <Page>
        <MyPageHeader title="My leave" description="Your entitlement, what you have taken, and what is pending." />
        <NoEmploymentRecord what="Leave" />
      </Page>
    )
  }

  return (
    <Page>
      <MyPageHeader
        title="My leave"
        description="Your entitlement, what you have taken, and anything waiting on a decision."
        actions={
          <Button leftIcon={<CalendarPlus size={16} aria-hidden="true" />} onClick={() => setOpen(true)}>
            Request leave
          </Button>
        }
      />

      <Card>
        <CardHeader
          title="Your balances"
          description="Days left today. A pending request is not deducted until it is approved."
        />
        <CardBody className="space-y-4">
          {me.employee.leaveBalances.length === 0 ? (
            <EmptyState
              size="sm"
              bordered
              title="No entitlement on record"
              message="Nothing has been allocated against your employment record yet. HR sets this up."
            />
          ) : (
            me.employee.leaveBalances.map((balance) => (
              <div key={balance.type}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-body-13 text-text">
                    {leaveLabel(balance.type)}
                  </span>
                  <span className="text-body-12 tabular-nums text-text-secondary">
                    {`${formatNumber(balance.remaining)} of ${formatNumber(balance.entitled)} left`}
                  </span>
                </div>
                <ProgressBar
                  value={balance.taken}
                  max={Math.max(1, balance.entitled)}
                  tone={balance.remaining === 0 ? 'warning' : 'accent'}
                  size="sm"
                  aria-label={`${balance.type} leave taken`}
                />
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Your requests" description="Everything you have ever asked for, decided or not." />
        <CardBody padding="none">
          <DataTable
            data={requests}
            columns={columns}
            rowKey={(row) => row.id}
            density="compact"
            minWidth={1100}
            bordered={false}
            caption="Your leave requests with type, dates, days and status"
            empty={
              <EmptyState
                icon={CalendarOff}
                title="You have not requested leave"
                message="When you do, it appears here and stays — approved, rejected or withdrawn."
                action={
                  <Button size="sm" onClick={() => setOpen(true)}>
                    Request leave
                  </Button>
                }
              />
            }
          />
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Request leave"
        description="Working days only — a weekend inside the range is not counted against your entitlement."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={overdrawn}>
              Submit request
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Type" required>
            <Select
              value={type}
              options={LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_TYPE_LABEL[t] }))}
              onChange={(e) => setType(e.target.value as LeaveType)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" required>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </Field>
            <Field label="To" required>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </Field>
          </div>

          <div className="rounded-xl bg-surface-sunken px-4 py-3">
            <p className="text-body-13 text-text">
              {days === 0
                ? 'That range has no working days in it.'
                : `${pluralize(days, 'working day')} requested.`}
            </p>
            <p className="mt-1 text-body-12 text-text-secondary">
              {type === 'unpaid'
                ? 'Unpaid leave is not drawn from an entitlement.'
                : `You have ${pluralize(remaining, 'day')} left. Approving this would leave you ${formatNumber(Math.max(0, remaining - days))}.`}
            </p>
          </div>

          {touched && days === 0 && (
            <Alert tone="danger" title="Pick a usable range">
              The range needs at least one working day, ending on or after it starts.
            </Alert>
          )}

          {overdrawn && (
            <Alert tone="danger" title="More than your balance allows">
              {`Only ${pluralize(remaining, 'day')} of ${LEAVE_TYPE_LABEL[type].toLowerCase()} leave remain. Shorten the range, or request unpaid leave instead.`}
            </Alert>
          )}

          <Field
            label="Reason"
            required
            hint="The approver decides on this alone, so a line of context helps."
            error={touched && !reason.trim() ? 'Say why.' : undefined}
          >
            <Textarea
              rows={2}
              value={reason}
              invalid={touched && !reason.trim()}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Travelling to Kano for my sister's wedding — back on the Monday."
            />
          </Field>
        </div>
      </Modal>
    </Page>
  )
}
