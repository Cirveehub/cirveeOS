/**
 * My workspace — `/my-workspace`.
 *
 * The landing page for the half of every staff member that is simply an
 * employee. Deliberately short: four numbers and a list of things actually
 * waiting on this person. Everything else is one click away on its own page,
 * which is the point of the pages existing.
 *
 * "What needs you" is the only section that earns its space unconditionally —
 * if it is empty it says so, which is a useful thing to know at 9am.
 */

import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  CalendarOff,
  CircleAlert,
  ClipboardList,
  Receipt,
  Wallet,
} from 'lucide-react'

import {
  TODAY,
  attendanceEventsCollection,
  leaveRequestsCollection,
  payrollItemsCollection,
  payslipsCollection,
  tasksCollection,
  useCollection,
} from '@/mocks'
import { formatDate, formatNaira, formatNumber, formatPercent, pluralize } from '@/lib/format'
import { Button, Card, CardBody, CardHeader, EmptyState, StatCard } from '@/ui'

import { MyPageHeader, NoEmploymentRecord, Page, useMe } from './shared'
import { myAttendance, myLeave, myPayslips, needsExplaining } from './writes'

const OPEN_STATES = ['open', 'in_progress', 'blocked']

export default function MyWorkspace() {
  const me = useMe()
  useCollection(attendanceEventsCollection)
  useCollection(leaveRequestsCollection)
  useCollection(payslipsCollection)
  const tasks = useCollection(tasksCollection)
  const items = useCollection(payrollItemsCollection)

  const employeeId = me.employee?.id as string | undefined

  const attendance = useMemo(() => (employeeId ? myAttendance(employeeId) : []), [employeeId])
  const leave = useMemo(() => (employeeId ? myLeave(employeeId) : []), [employeeId])
  const payslips = useMemo(() => (employeeId ? myPayslips(employeeId) : []), [employeeId])

  const month = TODAY.slice(0, 7)
  const thisMonth = attendance.filter((a) => a.date.startsWith(month))
  const counted = thisMonth.filter((a) =>
    ['present', 'late', 'absent', 'remote_approved', 'early_departure', 'missing_clock_out'].includes(a.state),
  )
  const presentish = counted.filter((a) => ['present', 'late', 'remote_approved'].includes(a.state))
  const rate = counted.length === 0 ? null : (presentish.length / counted.length) * 100

  const flagged = thisMonth.filter(needsExplaining)
  const pendingLeave = leave.filter((l) => l.status === 'requested')
  const annual = me.employee?.leaveBalances.find((b) => b.type === 'annual')
  const myTasks = me.userId ? tasks.filter((t) => t.ownerUserId === me.userId) : []
  const openTasks = myTasks.filter((t) => OPEN_STATES.includes(t.status))
  const overdueTasks = openTasks.filter((t) => t.dueAt !== null && t.dueAt.slice(0, 10) < TODAY)
  const latest = payslips[0]
  const latestNet = latest ? items.find((i) => i.id === latest.payrollItemId)?.net : undefined
  const unopened = payslips.filter((p) => !p.viewedAt)

  if (!me.employee) {
    return (
      <Page>
        <MyPageHeader title={`Hello, ${me.displayName.split(' ')[0]}`} description="Your own corner of Cirvee OS." />
        <NoEmploymentRecord what="Attendance, leave and pay" />
      </Page>
    )
  }

  const waiting = [
    flagged.length > 0 && {
      key: 'attendance',
      text: `${pluralize(flagged.length, 'day')} on your attendance ${flagged.length === 1 ? 'is' : 'are'} flagged and unexplained`,
      detail: 'A note from you is all it takes. Nothing here affects your pay.',
      to: '/my-workspace/attendance',
      action: 'Open attendance',
    },
    overdueTasks.length > 0 && {
      key: 'tasks',
      text: `${pluralize(overdueTasks.length, 'task')} past ${overdueTasks.length === 1 ? 'its' : 'their'} due date`,
      detail: 'Someone is probably waiting on one of these.',
      to: '/my-workspace/tasks',
      action: 'Open tasks',
    },
    unopened.length > 0 && {
      key: 'payslips',
      text: `${pluralize(unopened.length, 'payslip')} you have never opened`,
      detail: 'Worth checking the figures match what you expected.',
      to: '/my-workspace/payslips',
      action: 'Open payslips',
    },
    pendingLeave.length > 0 && {
      key: 'leave',
      text: `${pluralize(pendingLeave.length, 'leave request')} awaiting a decision`,
      detail: 'Nothing for you to do — this is just so you know where it stands.',
      to: '/my-workspace/leave',
      action: 'Open leave',
    },
  ].filter(Boolean) as Array<{ key: string; text: string; detail: string; to: string; action: string }>

  return (
    <Page>
      <MyPageHeader
        title={`Hello, ${me.displayName.split(' ')[0]}`}
        description={`${me.employee.jobTitle} · your attendance, leave, pay and tasks in one place.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance this month"
          value={rate === null ? '—' : formatPercent(rate)}
          icon={CalendarCheck}
          variant={rate === null ? 'default' : rate >= 85 ? 'success' : 'warning'}
          caption={`${formatNumber(presentish.length)} of ${formatNumber(counted.length)} working days`}
        />
        <StatCard
          label="Annual leave left"
          value={annual ? `${formatNumber(annual.remaining)} days` : '—'}
          icon={CalendarOff}
          caption={annual ? `${formatNumber(annual.taken)} of ${formatNumber(annual.entitled)} taken` : 'No entitlement on record'}
        />
        <StatCard
          label="Open tasks"
          value={formatNumber(openTasks.length)}
          icon={ClipboardList}
          variant={overdueTasks.length > 0 ? 'warning' : 'default'}
          caption={
            overdueTasks.length > 0 ? `${formatNumber(overdueTasks.length)} past due` : 'Nothing overdue'
          }
        />
        <StatCard
          label="Last payslip"
          value={latestNet === undefined ? '—' : formatNaira(latestNet)}
          icon={Wallet}
          caption={latest ? formatDate(latest.issuedAt) : 'None issued yet'}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="What needs you"
          description="Only things you can actually do something about."
        />
        <CardBody>
          {waiting.length === 0 ? (
            <EmptyState
              size="sm"
              bordered
              title="Nothing is waiting on you"
              message="No flagged attendance, no overdue tasks, no unread payslip and no leave in limbo. Go and do the actual job."
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {waiting.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block text-body-14 text-text">{row.text}</span>
                    <span className="mt-1 block text-body-12 text-text-secondary">{row.detail}</span>
                  </span>
                  <Button variant="link" size="sm" className="shrink-0" asChild>
                    <Link to={row.to}>{row.action}</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent days"
            description="The last week the readers recorded against your name."
            actions={
              <Button variant="link" size="sm" asChild>
                <Link to="/my-workspace/attendance">See all</Link>
              </Button>
            }
          />
          <CardBody>
            {attendance.length === 0 ? (
              <EmptyState size="sm" bordered icon={CircleAlert} title="No attendance on record" message="Your first tap will show up here." />
            ) : (
              <ul className="flex flex-col gap-2">
                {attendance.slice(0, 5).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                  >
                    <span className="text-body-13 text-text">{formatDate(row.date)}</span>
                    <span className="text-body-12 text-text-secondary">{row.state.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent payslips"
            description="What you were paid, and when."
            actions={
              <Button variant="link" size="sm" asChild>
                <Link to="/my-workspace/payslips">See all</Link>
              </Button>
            }
          />
          <CardBody>
            {payslips.length === 0 ? (
              <EmptyState size="sm" bordered icon={Receipt} title="No payslip issued yet" message="One appears when a period you are on is paid." />
            ) : (
              <ul className="flex flex-col gap-2">
                {payslips.slice(0, 5).map((row) => {
                  const net = items.find((i) => i.id === row.payrollItemId)?.net
                  return (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2"
                    >
                      <span className="text-body-13 text-text">{formatDate(row.issuedAt)}</span>
                      <span className="text-body-13 tabular-nums text-text-secondary">
                        {net === undefined ? '—' : formatNaira(net)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </Page>
  )
}
