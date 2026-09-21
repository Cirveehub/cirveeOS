/**
 * My attendance — `/my-workspace/attendance`.
 *
 * The employee's side of a record somebody else's hardware produced. The
 * readers, taps and office network decide what it says; this screen exists so
 * the person it describes can *see* it and account for the days it flags,
 * rather than finding out at the end of the month that a Friday they worked is
 * on file as a missing clock-out.
 *
 * So there is no "clock in" button here, and that is deliberate. Self-service
 * attendance would make the whole physical layer pointless. What an employee
 * can do is explain a flagged day; HR accepts or leaves it, on their own
 * screen.
 */

import { useMemo, useState } from 'react'
import { CalendarCheck, CircleAlert, MessageSquarePlus } from 'lucide-react'
import toast from 'react-hot-toast'

import { TODAY, useCollection, attendanceEventsCollection, type AttendanceEvent } from '@/mocks'
import { formatDate, formatNumber, formatPercent, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Modal,
  StatCard,
  StatusBadge,
  Textarea,
  Tooltip,
} from '@/ui'

import {
  MyPageHeader,
  NoEmploymentRecord,
  Page,
  daysOfCurrentMonth,
  isWeekend,
  timeOfDay,
  useMe,
  userName,
} from './shared'
import { explainAttendance, myAttendance, needsExplaining } from './writes'

/** Only the states that count towards "did you turn up". */
const COUNTED: AttendanceEvent['state'][] = [
  'present',
  'late',
  'absent',
  'remote_approved',
  'early_departure',
  'missing_clock_out',
]

const STATE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = {
  present: 'success',
  remote_approved: 'success',
  late: 'warning',
  early_departure: 'warning',
  missing_clock_out: 'warning',
  absent: 'danger',
  approved_leave: 'info',
  excused: 'info',
  holiday: 'neutral',
  off_day: 'neutral',
}

export default function MyAttendance() {
  const me = useMe()
  useCollection(attendanceEventsCollection)

  const [explaining, setExplaining] = useState<AttendanceEvent | null>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  const rows = useMemo(
    () => (me.employee ? myAttendance(me.employee.id as string) : []),
    [me.employee],
  )

  const month = TODAY.slice(0, 7)
  const thisMonth = rows.filter((r) => r.date.startsWith(month))
  const byDate = new Map(thisMonth.map((r) => [r.date, r]))

  const counted = thisMonth.filter((r) => COUNTED.includes(r.state))
  const presentish = counted.filter((r) => ['present', 'late', 'remote_approved'].includes(r.state))
  const rate = counted.length === 0 ? null : (presentish.length / counted.length) * 100
  const lateDays = thisMonth.filter((r) => r.state === 'late').length
  const flagged = thisMonth.filter(needsExplaining)
  const explained = thisMonth.filter((r) => r.overrideReason && !r.overriddenByUserId)

  const submit = () => {
    setTouched(true)
    if (!explaining || !note.trim() || !me.userId) return
    const result = explainAttendance(explaining.id as string, note, me.userId)
    if (!result.ok) {
      toast.error(result.reason ?? 'That could not be saved.')
      return
    }
    toast.success('Sent. HR sees your note against that day and decides whether it stands.')
    setExplaining(null)
    setNote('')
    setTouched(false)
  }

  if (!me.employee) {
    return (
      <Page>
        <MyPageHeader
          title="My attendance"
          description="What the readers recorded against your name, and the days you can account for."
        />
        <NoEmploymentRecord what="Attendance" />
      </Page>
    )
  }

  return (
    <Page>
      <MyPageHeader
        title="My attendance"
        description="What the readers recorded against your name this month. Tap a flagged day to say what happened."
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
          label="Days needing a word"
          value={formatNumber(flagged.length)}
          icon={CircleAlert}
          variant={flagged.length > 0 ? 'warning' : 'success'}
          caption="Flagged, and you have not explained them"
        />
        <StatCard
          label="Waiting on HR"
          value={formatNumber(explained.length)}
          icon={MessageSquarePlus}
          caption="Explained by you, not yet accepted"
        />
        <StatCard
          label="Late arrivals"
          value={formatNumber(lateDays)}
          icon={CalendarCheck}
          variant={lateDays > 2 ? 'warning' : 'default'}
          caption="This month"
        />
      </div>

      {flagged.length > 0 && (
        <Alert
          tone="warning"
          className="mt-6"
          title={`${formatNumber(flagged.length)} ${flagged.length === 1 ? 'day is' : 'days are'} flagged against you`}
        >
          A flagged day is not a penalty — attendance consequences are switched off by policy and
          nothing here touches your pay. It is on your record though, so it is worth saying what
          happened while you still remember.
        </Alert>
      )}

      <Card className="mt-6">
        <CardHeader
          title={`${formatDate(`${month}-01`).replace(/^\d+\s/, '')} so far`}
          description="Every day this month. Weekends and rest days are shown but never counted against you."
        />
        <CardBody>
          {thisMonth.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              size="sm"
              bordered
              title="Nothing recorded this month yet"
              message="Your first tap of the month will appear here."
            />
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {daysOfCurrentMonth()
                .filter((date) => date <= TODAY)
                .reverse()
                .map((date) => {
                  const row = byDate.get(date)
                  const weekend = isWeekend(date)
                  return (
                    <li
                      key={date}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-body-13 font-medium text-text">
                          {formatDate(date)}
                          {date === TODAY && <span className="ml-1.5 text-body-12 text-text-muted">today</span>}
                        </span>
                        <span className="block truncate text-body-12 text-text-secondary">
                          {row
                            ? row.clockInAt
                              ? `In ${timeOfDay(row.clockInAt)} · out ${row.clockOutAt ? timeOfDay(row.clockOutAt) : 'not recorded'}`
                              : humanize(row.state)
                            : weekend
                              ? 'Rest day'
                              : 'No record'}
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-2">
                        {row ? (
                          <>
                            <StatusBadge status={row.state} label={humanize(row.state)} />
                            {row.overrideReason && (
                              <Tooltip
                                content={
                                  row.overriddenByUserId
                                    ? `Accepted by ${userName(row.overriddenByUserId)} — ${row.overrideReason}`
                                    : `Waiting on HR — ${row.overrideReason}`
                                }
                              >
                                <Badge tone={row.overriddenByUserId ? 'success' : 'info'} size="sm">
                                  {row.overriddenByUserId ? 'Accepted' : 'Explained'}
                                </Badge>
                              </Tooltip>
                            )}
                            {needsExplaining(row) && (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  setExplaining(row)
                                  setNote('')
                                  setTouched(false)
                                }}
                              >
                                Explain
                              </Button>
                            )}
                          </>
                        ) : (
                          <Badge tone="neutral" size="sm">
                            {weekend ? 'Rest day' : 'Nothing'}
                          </Badge>
                        )}
                      </span>
                    </li>
                  )
                })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={explaining !== null}
        onClose={() => setExplaining(null)}
        title={explaining ? `${humanize(explaining.state)} — ${formatDate(explaining.date)}` : 'Explain this day'}
        description="Your note goes to HR with the day attached. It does not change the record by itself."
        footer={
          <>
            <Button variant="ghost" onClick={() => setExplaining(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>Send to HR</Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {explaining?.state === 'missing_clock_out' && (
            <Alert tone="info" title="You clocked in but never clocked out">
              Usually this is a forgotten tap on the way out. Say roughly when you left and HR can
              close the day off.
            </Alert>
          )}
          <Field
            label="What happened"
            required
            hint="Plain words are fine. Whoever reads this was not there."
            error={touched && !note.trim() ? 'Say what happened — an empty note tells the reviewer nothing.' : undefined}
          >
            <Textarea
              rows={3}
              value={note}
              invalid={touched && !note.trim()}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Left at about 6pm after the Lagos cohort's evening session — forgot to tap out at the door."
            />
          </Field>
        </div>
      </Modal>
    </Page>
  )
}
