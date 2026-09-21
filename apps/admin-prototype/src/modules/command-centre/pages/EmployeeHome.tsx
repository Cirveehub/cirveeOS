import { useState } from 'react'
import {
  CalendarPlus,
  ClipboardList,
  Coins,
  NotebookPen,
  RotateCcw,
  Users,
  type LucideIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

import {
  TODAY,
  activitiesCollection,
  approvalRequestsCollection,
  approvalsPendingOn,
  attendanceEventsCollection,
  leadsCollection,
  leaveRequestsCollection,
  notificationsCollection,
  tasksCollection,
  useCollection,
} from '@/mocks'
import type {
  Activity,
  ActivityType,
  ApprovalRequest,
  AttendanceState,
  CallOutcome,
  Employee,
  LeaveType,
  Task,
  UserId,
} from '@/mocks'
import { activityId } from '@/mocks/types'
import { formatDate, formatNumber, formatRelative, humanize, pluralize } from '@/lib/format'
import { useCurrentUserId } from '@/auth'
import { requestLeave } from '@/modules/my-workspace/writes'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  MoneyCell,
  ProgressBar,
  Select,
  StatusBadge,
  Textarea,
} from '@/ui'
import type { Column } from '@/ui'

import { AttendanceStrip } from '../components/AttendanceStrip'
import { EmployeeHomeSkeleton } from '../components/HomeSkeleton'
import { HomeHeader } from '../components/HomeHeader'
import { useEmployeeLive } from '../lib/live'
import { employeeForUser, personName, userName } from '../lib/names'
import { useScreenState } from '../lib/screen-state'

const OPEN_TASKS = ['open', 'in_progress', 'blocked']
const MONTH_START = `${TODAY.slice(0, 7)}-01`

const PRIORITY_TONE = {
  urgent: 'danger',
  high: 'warning',
  normal: 'neutral',
  low: 'neutral',
} as const

const STUB_ACTIONS: Record<'expense' | 'room', { label: string; icon: LucideIcon; would: string }> = {
  expense: {
    label: 'Raise expense',
    icon: Coins,
    would:
      'open the expense claim form, attach a receipt and resolve its approval chain before Finance sees it',
  },
  room: {
    label: 'Book meeting room',
    icon: Users,
    would: 'check room availability and hold a slot — nothing in this prototype models a bookable room',
  },
}

const LEAVE_TYPES: LeaveType[] = [
  'annual',
  'sick',
  'compassionate',
  'maternity',
  'paternity',
  'study',
  'unpaid',
]

const ACTIVITY_TYPES: ActivityType[] = ['note', 'call', 'whatsapp', 'email', 'meeting', 'sms']

const CALL_OUTCOMES: CallOutcome[] = ['connected', 'no_answer', 'busy', 'wrong_number']

function nowIso(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+01:00`
}

function workingDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  let days = 0
  for (let t = start; t <= end; t += 86_400_000) {
    const day = new Date(t).getUTCDay()
    if (day !== 0 && day !== 6) days += 1
  }
  return days
}

const taskColumns: Array<Column<Task>> = [
  { key: 'title', header: 'Task', accessor: (row) => row.title, sortable: true, minWidth: 220 },
  {
    key: 'related',
    header: 'Related record',
    cell: (row) =>
      row.relatedEntityRef ? (
        <span className="font-mono text-body-12 text-text-secondary">{row.relatedEntityRef}</span>
      ) : (
        <span className="text-body-13 text-text-secondary">None</span>
      ),
    sortValue: (row) => row.relatedEntityRef ?? '',
    minWidth: 140,
  },
  {
    key: 'due',
    header: 'Due',
    cell: (row) => (row.dueAt ? formatDate(row.dueAt) : 'No date'),
    sortValue: (row) => row.dueAt ?? '',
    align: 'right',
  },
  {
    key: 'priority',
    header: 'Priority',
    cell: (row) => (
      <Badge tone={PRIORITY_TONE[row.priority]} size="sm">
        {humanize(row.priority)}
      </Badge>
    ),
    sortValue: (row) => row.priority,
  },
  {
    key: 'status',
    header: 'Status',
    cell: (row) => <StatusBadge status={row.status} size="sm" />,
    sortValue: (row) => row.status,
  },
]

const approvalColumns: Array<Column<ApprovalRequest>> = [
  {
    key: 'type',
    header: 'Type',
    cell: (row) => <Badge size="sm">{humanize(row.type)}</Badge>,
    sortValue: (row) => row.type,
  },
  { key: 'title', header: 'Request', accessor: (row) => row.title, sortable: true, minWidth: 220 },
  {
    key: 'requester',
    header: 'Requester',
    cell: (row) => userName(row.requesterUserId),
    sortValue: (row) => userName(row.requesterUserId),
    minWidth: 150,
  },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    cell: (row) => (row.amount === null ? '—' : <MoneyCell kobo={row.amount} compact />),
    sortValue: (row) => row.amount ?? 0,
  },
  {
    key: 'age',
    header: 'Age vs SLA',
    align: 'right',
    cell: (row) => (
      <span
        className={
          row.slaState === 'breached'
            ? 'text-body-13 font-semibold text-danger-text tabular-nums'
            : row.slaState === 'due_today'
              ? 'text-body-13 font-semibold text-warning-text tabular-nums'
              : 'text-body-13 text-text-secondary tabular-nums'
        }
      >
        {`${formatNumber(row.ageHours)}h of ${formatNumber(row.slaHours)}h`}
      </span>
    ),
    sortValue: (row) => row.ageHours,
  },
]

export default function EmployeeHome() {
  useEmployeeLive()
  const userId = useCurrentUserId()
  const { status, retry } = useScreenState('home-employee')
  const activities = useCollection(activitiesCollection)

  const [leaveOpen, setLeaveOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)

  const employee = employeeForUser(userId)

  const tasks = tasksCollection
    .where((t) => t.ownerUserId === userId && OPEN_TASKS.includes(t.status))
    .sort((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999'))

  const approvals = approvalsPendingOn(userId)
  const raisedByMe = approvalRequestsCollection.count(
    (a) => a.status === 'pending' && a.requesterUserId === userId,
  )

  const attendance = employee
    ? attendanceEventsCollection
        .where((a) => a.employeeId === employee.id && a.date >= MONTH_START && a.date <= TODAY)
        .sort((a, b) => a.date.localeCompare(b.date))
    : []

  const countOf = (state: AttendanceState) => attendance.filter((a) => a.state === state).length

  const notifications = notificationsCollection
    .where((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const myLeave = employee
    ? leaveRequestsCollection
        .where((r) => r.employeeId === employee.id)
        .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
    : []

  const loggedByMe = activities
    .filter((a) => a.createdBy === userId && !a.isSystemGenerated)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 3)

  const notBuilt = (label: string, would: string) =>
    toast(`Not built in this prototype — ${label} would ${would}.`)

  const quickActions: Array<{ label: string; icon: LucideIcon; onClick: () => void }> = [
    { label: 'Request leave', icon: CalendarPlus, onClick: () => setLeaveOpen(true) },
    {
      label: STUB_ACTIONS.expense.label,
      icon: STUB_ACTIONS.expense.icon,
      onClick: () =>
        notBuilt(STUB_ACTIONS.expense.label.toLowerCase(), STUB_ACTIONS.expense.would),
    },
    { label: 'Log activity', icon: NotebookPen, onClick: () => setActivityOpen(true) },
    {
      label: STUB_ACTIONS.room.label,
      icon: STUB_ACTIONS.room.icon,
      onClick: () => notBuilt(STUB_ACTIONS.room.label.toLowerCase(), STUB_ACTIONS.room.would),
    },
  ]

  return (
    <div className="px-8 py-6">
      <HomeHeader
        active="employee"
        description="What is waiting on you today — tasks, decisions, attendance and leave."
      />

      {status === 'error' && (
        <Alert
          tone="danger"
          title="Your queues could not be loaded"
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={retry}>
              Retry
            </Button>
          }
        >
          Tasks, approvals and attendance all failed to read. Nothing has been lost — retry the load.
        </Alert>
      )}

      {status === 'loading' ? (
        <EmployeeHomeSkeleton />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <CardHeader
              title="My tasks"
              description={`${pluralize(tasks.length, 'open task')} assigned to you.`}
              actions={
                <Link
                  to="/work/tasks"
                  className="rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
                >
                  View all
                </Link>
              }
            />
            {tasks.length === 0 ? (
              <EmptyState
                size="sm"
                title="Nothing waiting on you"
                message="No open task is assigned to you. Tasks are raised from a lead, an invoice, a cohort or a meeting action item."
              />
            ) : (
              <DataTable
                data={tasks.slice(0, 6)}
                columns={taskColumns}
                rowKey={(row) => row.id}
                density="compact"
                bordered={false}
                caption="Open tasks assigned to the signed-in user"
              />
            )}
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title="Approvals waiting on me"
              description="Requests where you are the current approver."
              actions={
                <Link
                  to="/work/approvals?pendingOnMe=1"
                  className="rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
                >
                  View all
                </Link>
              }
            />
            {approvals.length === 0 ? (
              <EmptyState
                size="sm"
                title="Nothing waiting on you"
                message={
                  raisedByMe > 0
                    ? `You raised ${pluralize(raisedByMe, 'request')} that is still pending. An approver can never approve their own request, so those sit with somebody else.`
                    : 'No request has reached your step of an approval route.'
                }
              />
            ) : (
              <DataTable
                data={approvals.slice(0, 5)}
                columns={approvalColumns}
                rowKey={(row) => row.id}
                density="compact"
                bordered={false}
                caption="Approval requests where the signed-in user is the current approver"
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="My attendance this month"
              description={`Since ${formatDate(MONTH_START)}. Breaches are advisory — no deduction is applied.`}
            />
            <div className="px-6 pb-6">
              {attendance.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="No clock-ins recorded this month"
                  message="Attendance is captured by NFC tap, QR, an approved device or the office network."
                />
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-4 gap-3">
                    {(
                      [
                        ['Present', countOf('present')],
                        ['Late', countOf('late')],
                        ['Absent', countOf('absent')],
                        ['Remote', countOf('remote_approved')],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label}>
                        <p className="text-heading-20 text-text tabular-nums">{formatNumber(value)}</p>
                        <p className="text-body-12 text-text-secondary">{label}</p>
                      </div>
                    ))}
                  </div>
                  <AttendanceStrip events={attendance} />
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Leave balance" description="Entitlement, taken and remaining." />
            <div className="px-6 pb-6">
              {!employee || employee.leaveBalances.length === 0 ? (
                <EmptyState
                  size="sm"
                  title="No leave entitlement on record"
                  message="Entitlement is set on the employment record. Without one, no leave request can be costed."
                />
              ) : (
                <div className="space-y-4 pt-2">
                  {employee.leaveBalances.map((balance) => (
                    <ProgressBar
                      key={balance.type}
                      value={balance.remaining}
                      max={balance.entitled}
                      tone={balance.remaining === 0 ? 'warning' : 'accent'}
                      label={humanize(balance.type)}
                      valueLabel={`${formatNumber(balance.remaining)} of ${formatNumber(balance.entitled)} days left`}
                    />
                  ))}
                </div>
              )}

              {myLeave.length > 0 && (
                <div className="mt-5 border-t border-border pt-4">
                  <p className="mb-2 text-label-11 text-text-label">Your requests</p>
                  <ul className="space-y-1.5">
                    {myLeave.slice(0, 4).map((request) => (
                      <li key={request.id} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-body-13">
                          {humanize(request.type)} · {formatDate(request.fromDate)} to{' '}
                          {formatDate(request.toDate)} · {pluralize(request.days, 'day')}
                        </span>
                        <StatusBadge
                          status={request.status}
                          size="sm"
                          tone={request.status === 'requested' ? 'warning' : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Notifications"
              description="The five most recent, across every channel."
              actions={
                <Link
                  to="/home/employee"
                  className="rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
                >
                  Mark all read
                </Link>
              }
            />
            {notifications.length === 0 ? (
              <EmptyState size="sm" title="Inbox zero" message="Nothing new since you last looked." />
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((notification) => (
                  <li key={notification.id} className="flex gap-3 px-6 py-3">
                    <span
                      aria-hidden="true"
                      className={
                        notification.read
                          ? 'mt-1.5 size-2 shrink-0 rounded-full bg-border-interactive'
                          : 'mt-1.5 size-2 shrink-0 rounded-full bg-accent'
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-body-14 font-medium text-text">
                          {notification.title}
                        </p>
                        <span className="shrink-0 text-body-12 text-text-secondary">
                          {formatRelative(notification.createdAt)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-body-13 text-text-secondary">
                        {notification.body}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge size="sm">{humanize(notification.category)}</Badge>
                        <Badge size="sm" tone="info">
                          {humanize(notification.channel)}
                        </Badge>
                        <span className="sr-only">
                          {notification.read ? 'Read' : 'Unread'}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Quick actions"
              description="The four things people start from Home."
            />
            <div className="grid grid-cols-2 gap-2 px-6 pb-4 pt-2">
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="secondary"
                  leftIcon={<action.icon size={16} />}
                  onClick={action.onClick}
                  className="justify-start"
                >
                  {action.label}
                </Button>
              ))}
            </div>
            {loggedByMe.length > 0 && (
              <div className="px-6 pb-4">
                <p className="mb-2 text-label-11 text-text-label">Activity you logged</p>
                <ul className="space-y-1.5">
                  {loggedByMe.map((activity) => (
                    <li key={activity.id} className="flex items-baseline gap-2 text-body-13">
                      <Badge size="sm">{humanize(activity.type)}</Badge>
                      <span className="min-w-0 flex-1 truncate text-text-secondary">
                        {activity.body}
                      </span>
                      <span className="shrink-0 text-body-12 text-text-muted">
                        {formatRelative(activity.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {employee && (
              <div className="border-t border-border px-6 py-4">
                <KeyValueList>
                  <KeyValue label="Role">{employee.jobTitle}</KeyValue>
                  <KeyValue label="Employment">{humanize(employee.employmentType)}</KeyValue>
                  <KeyValue label="Started">{formatDate(employee.startDate)}</KeyValue>
                  <KeyValue label="Current gross">
                    {employee.compensationVersions.length > 0 ? (
                      <MoneyCell
                        kobo={
                          employee.compensationVersions[employee.compensationVersions.length - 1].gross
                        }
                        className="inline w-auto"
                      />
                    ) : (
                      'Not set'
                    )}
                  </KeyValue>
                </KeyValueList>
              </div>
            )}
          </Card>
        </div>
      )}

      <RequestLeaveModal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        employee={employee}
        userId={userId}
      />
      <LogActivityModal
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        userId={userId}
      />
    </div>
  )
}

function RequestLeaveModal({
  open,
  onClose,
  employee,
  userId,
}: {
  open: boolean
  onClose: () => void
  employee: Employee | undefined
  userId: UserId
}) {
  const [type, setType] = useState<LeaveType>('annual')
  const [fromDate, setFromDate] = useState(TODAY)
  const [toDate, setToDate] = useState(TODAY)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const balance = employee?.leaveBalances.find((b) => b.type === type)
  const remaining = type === 'unpaid' ? Number.POSITIVE_INFINITY : (balance?.remaining ?? 0)
  const days = workingDays(fromDate, toDate)

  const rangeError =
    touched && days === 0
      ? 'Pick a range that contains at least one working day, ending on or after it starts.'
      : undefined
  const balanceError =
    days > 0 && days > remaining
      ? `Only ${pluralize(Math.max(0, balance?.remaining ?? 0), 'day')} of ${humanize(type).toLowerCase()} leave remain. Shorten the range, or request unpaid leave instead.`
      : undefined
  const reasonError = touched && !reason.trim() ? 'Say why — the approver decides on this alone.' : undefined

  const reset = () => {
    setType('annual')
    setFromDate(TODAY)
    setToDate(TODAY)
    setReason('')
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (!employee || days === 0 || balanceError || !reason.trim()) return

    const result = requestLeave({ employee, userId, type, fromDate, toDate, reason })
    if (!result.ok) {
      toast.error(result.reason ?? 'That request could not be raised.')
      return
    }
    toast.success(
      `${pluralize(days, 'day')} of ${humanize(type).toLowerCase()} leave requested. Your balance is untouched until it is approved.`,
    )
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Request leave"
      description="Working days only — a weekend inside the range is not counted against your entitlement."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!employee}>
            Submit request
          </Button>
        </>
      }
    >
      {!employee ? (
        <Alert tone="warning" title="No employment record behind this sign-in">
          Leave is counted against an employment record's entitlement. Without one there is no balance
          to draw from and nothing to route to a manager.
        </Alert>
      ) : (
        <div className="flex flex-col gap-4">
          <Field
            label="Leave type"
            required
            hint={
              type === 'unpaid'
                ? 'Unpaid leave is not drawn from an entitlement.'
                : `${pluralize(balance?.remaining ?? 0, 'day')} remaining of ${formatNumber(balance?.entitled ?? 0)}.`
            }
          >
            <Select
              value={type}
              options={LEAVE_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
              onChange={(event) => setType(event.target.value as LeaveType)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="First day" required error={rangeError}>
              <Input
                type="date"
                value={fromDate}
                invalid={Boolean(rangeError)}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  if (event.target.value > toDate) setToDate(event.target.value)
                }}
              />
            </Field>
            <Field
              label="Last day"
              required
              hint={days > 0 ? `${pluralize(days, 'working day')}` : undefined}
            >
              <Input
                type="date"
                value={toDate}
                min={fromDate}
                invalid={Boolean(rangeError)}
                onChange={(event) => setToDate(event.target.value)}
              />
            </Field>
          </div>

          {balanceError && (
            <Alert tone="danger" title="More than the balance allows">
              {balanceError}
            </Alert>
          )}

          <Field label="Reason" required error={reasonError}>
            <Textarea
              value={reason}
              rows={3}
              maxLength={300}
              showCount
              invalid={Boolean(reasonError)}
              placeholder="What the leave is for, and anything your cover needs to know"
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}

function LogActivityModal({
  open,
  onClose,
  userId,
}: {
  open: boolean
  onClose: () => void
  userId: UserId
}) {
  const leads = useCollection(leadsCollection)
  const [subjectId, setSubjectId] = useState('')
  const [type, setType] = useState<ActivityType>('note')
  const [body, setBody] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [minutes, setMinutes] = useState('10')
  const [touched, setTouched] = useState(false)

  const myLeads = leads
    .filter((lead) => lead.ownerUserId === userId)
    .sort((a, b) => personName(a.personId).localeCompare(personName(b.personId)))

  const subjectError = touched && !subjectId ? 'Choose the lead this touch belongs to.' : undefined
  const bodyError = touched && !body.trim() ? 'Write what happened — an empty note tells the next person nothing.' : undefined

  const reset = () => {
    setSubjectId('')
    setType('note')
    setBody('')
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (!subjectId || !body.trim()) return

    const stamp = nowIso()
    const duration = Number(minutes)
    const activity: Activity = {
      id: activityId(`act-ui-${Date.now().toString(36)}`),
      subjectType: 'lead',
      subjectId,
      type,
      body: body.trim(),
      callOutcome: type === 'call' ? outcome : undefined,
      durationMinutes: type === 'call' && Number.isFinite(duration) ? duration : undefined,
      attachmentIds: [],
      isSystemGenerated: false,
      createdAt: stamp,
      createdBy: userId,
      updatedAt: stamp,
      updatedBy: userId,
    }
    activitiesCollection.insert(activity)

    const lead = myLeads.find((l) => l.id === subjectId)
    toast.success(
      `${humanize(type)} logged against ${lead ? personName(lead.personId) : 'the lead'}. It is on their profile now.`,
    )
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log activity"
      description="A note, call or message against a record you own. This is the activity feed, not the audit log — it is yours to write and edit."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={myLeads.length === 0}>
            Log it
          </Button>
        </>
      }
    >
      {myLeads.length === 0 ? (
        <EmptyState
          size="sm"
          icon={ClipboardList}
          title="You own no leads"
          message="Activity is logged against a record. Nothing is currently assigned to you to log against."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Lead" required error={subjectError}>
            <Select
              value={subjectId}
              placeholder="Choose a lead you own"
              invalid={Boolean(subjectError)}
              options={myLeads.slice(0, 200).map((lead) => ({
                value: lead.id,
                label: `${personName(lead.personId)} · ${lead.ref} · ${humanize(lead.stage)}`,
              }))}
              onChange={(event) => setSubjectId(event.target.value)}
            />
          </Field>

          <Field label="Type" required>
            <Select
              value={type}
              options={ACTIVITY_TYPES.map((t) => ({ value: t, label: humanize(t) }))}
              onChange={(event) => setType(event.target.value as ActivityType)}
            />
          </Field>

          {type === 'call' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Outcome" required>
                <Select
                  value={outcome}
                  options={CALL_OUTCOMES.map((o) => ({ value: o, label: humanize(o) }))}
                  onChange={(event) => setOutcome(event.target.value as CallOutcome)}
                />
              </Field>
              <Field label="Duration" required>
                <Input
                  type="number"
                  min={0}
                  value={minutes}
                  suffix="min"
                  onChange={(event) => setMinutes(event.target.value)}
                />
              </Field>
            </div>
          )}

          <Field label="What happened" required error={bodyError}>
            <Textarea
              value={body}
              rows={4}
              maxLength={500}
              showCount
              invalid={Boolean(bodyError)}
              placeholder="What was said, what was agreed, what happens next"
              onChange={(event) => setBody(event.target.value)}
            />
          </Field>
        </div>
      )}
    </Modal>
  )
}
