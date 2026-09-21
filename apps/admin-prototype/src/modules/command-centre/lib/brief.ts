import {
  TODAY,
  admissionsCollection,
  approvalsPendingOn,
  attendanceEventsCollection,
  collectedRevenue,
  enrollmentsCollection,
  invoicesCollection,
  leadsCollection,
  paymentsCollection,
  ticketsCollection,
  type UserId,
} from '@/mocks'
import type { ISODate, Kobo, LeadStage } from '@/mocks'
import { formatNaira, formatNumber, pluralize } from '@/lib/format'

import { dayWindow, shiftDays } from './series'

export type BriefTone = 'neutral' | 'positive' | 'warning' | 'danger'

export interface BriefLine {
  id: string
  label: string
  value: string
  detail: string
  to: string
  linkLabel: string
  tone: BriefTone
  quiet: boolean
}

export interface DailyBrief {
  forDate: ISODate
  generatedAt: Date
  lines: BriefLine[]
}

const ADVANCED_STAGES: LeadStage[] = [
  'contacted',
  'qualified',
  'counselling',
  'application',
  'payment_pending',
  'enrolled',
]

const LOST_STAGES: LeadStage[] = ['lost', 'not_interested', 'invalid', 'unresponsive']

const OPEN_TICKETS = ['new', 'open', 'pending_customer', 'escalated', 'reopened']

export function buildDailyBrief(userId: UserId): DailyBrief {
  const yesterday = shiftDays(TODAY, -1)
  const weekAgo = shiftDays(TODAY, -7)

  const yesterdayPayments = paymentsCollection.where(
    (p) => p.status === 'matched' && p.receivedAt.slice(0, 10) === yesterday,
  )
  const collectedYesterday: Kobo = collectedRevenue(dayWindow(yesterday))

  const newEnrolments = enrollmentsCollection.where((e) => e.enrolledAt === yesterday)
  const enrolmentsThisWeek = enrollmentsCollection.where((e) => e.enrolledAt >= weekAgo)

  const crossed = invoicesCollection.where(
    (i) => i.balance > 0 && i.status !== 'cancelled' && i.daysOverdue >= 30 && i.daysOverdue < 37,
  )
  const crossedAmount = crossed.reduce((acc, i) => acc + i.balance, 0)

  const advanced = leadsCollection.where(
    (l) => ADVANCED_STAGES.includes(l.stage) && l.stageEnteredAt.slice(0, 10) >= weekAgo,
  )
  const lost = leadsCollection.where(
    (l) => LOST_STAGES.includes(l.stage) && l.stageEnteredAt.slice(0, 10) >= weekAgo,
  )

  const attendance = attendanceEventsCollection.where((a) => a.date === yesterday)
  const late = attendance.filter((a) => a.state === 'late').length
  const missingClockOut = attendance.filter((a) => a.state === 'missing_clock_out').length

  const breached = ticketsCollection.where(
    (t) => OPEN_TICKETS.includes(t.status) && t.slaState === 'breached',
  )

  const mine = approvalsPendingOn(userId)

  const enrolledAdmissions = admissionsCollection.count((a) => a.status === 'enrolled')

  const lines: BriefLine[] = [
    {
      id: 'collections',
      label: 'Yesterday’s collections',
      value: formatNaira(collectedYesterday, { decimals: true }),
      detail: yesterdayPayments.length
        ? `From ${pluralize(yesterdayPayments.length, 'matched payment')}.`
        : 'No payments were matched yesterday. Unmatched credits sit in reconciliation until someone confirms them.',
      to: '/finance/payments?received=yesterday',
      linkLabel: 'Open payments',
      tone: yesterdayPayments.length ? 'positive' : 'neutral',
      quiet: yesterdayPayments.length === 0,
    },
    {
      id: 'enrolments',
      label: 'New enrolments',
      value: formatNumber(newEnrolments.length),
      detail: newEnrolments.length
        ? `${pluralize(enrolmentsThisWeek.length, 'enrolment')} in the last seven days, ${formatNumber(enrolledAdmissions)} enrolled admissions on the books.`
        : `None yesterday. ${pluralize(enrolmentsThisWeek.length, 'enrolment')} in the last seven days.`,
      to: '/crm/admissions?status=enrolled',
      linkLabel: 'Open admissions',
      tone: newEnrolments.length ? 'positive' : 'neutral',
      quiet: newEnrolments.length === 0,
    },
    {
      id: 'overdue',
      label: 'Overdue tuition movement',
      value: `${crossedAmount > 0 ? '+' : ''}${formatNaira(crossedAmount)}`,
      detail: crossed.length
        ? `Moved into the 30-days-and-over bucket this week, across ${pluralize(crossed.length, 'invoice')}.`
        : 'No balances crossed into 30 days and over this week.',
      to: '/finance/invoices?status=overdue,partially-paid',
      linkLabel: 'Open overdue invoices',
      tone: crossed.length ? 'danger' : 'neutral',
      quiet: crossed.length === 0,
    },
    {
      id: 'pipeline',
      label: 'Pipeline changes',
      value: `${formatNumber(advanced.length)} advanced`,
      detail: `${pluralize(lost.length, 'lead')} closed out as lost, not interested or invalid in the same seven days.`,
      to: '/crm/pipeline',
      linkLabel: 'Open pipeline',
      tone: advanced.length >= lost.length ? 'positive' : 'warning',
      quiet: advanced.length === 0 && lost.length === 0,
    },
    {
      id: 'attendance',
      label: 'Attendance exceptions',
      value: `${formatNumber(late)} late · ${formatNumber(missingClockOut)} missing clock-out`,
      detail:
        late + missingClockOut > 0
          ? 'Flagged for review only. Attendance carries no financial consequence unless a policy enables one.'
          : `All ${formatNumber(attendance.length)} clock-ins yesterday were clean.`,
      to: '/people/attendance?date=yesterday',
      linkLabel: 'Open attendance',
      tone: late + missingClockOut > 0 ? 'warning' : 'neutral',
      quiet: late + missingClockOut === 0,
    },
    {
      id: 'tickets',
      label: 'Unresolved issues',
      value: `${formatNumber(breached.length)} past SLA`,
      detail: breached.length
        ? `Open tickets whose first-response or resolution clock has already breached.`
        : 'Every open ticket is still inside its SLA.',
      to: '/support/tickets?sla=breached',
      linkLabel: 'Open tickets',
      tone: breached.length ? 'danger' : 'positive',
      quiet: breached.length === 0,
    },
    {
      id: 'approvals',
      label: 'Approvals waiting on you',
      value: formatNumber(mine.length),
      detail: mine.length
        ? 'Requests where you are the current approver. You cannot approve a request you raised yourself.'
        : 'Nothing is waiting on your decision.',
      to: '/approvals/mine',
      linkLabel: 'Open my approvals',
      tone: mine.length ? 'warning' : 'positive',
      quiet: mine.length === 0,
    },
  ]

  return { forDate: yesterday, generatedAt: new Date(), lines }
}

export function briefAsText(brief: DailyBrief, rangeLabel: string): string {
  const header = [
    'Cirvee OS — Daily executive brief',
    `Covering ${brief.forDate}`,
    `Scope ${rangeLabel}`,
    `Generated ${brief.generatedAt.toISOString()}`,
    '',
  ]
  const body = brief.lines.map((line) => `${line.label}: ${line.value}\n  ${line.detail}`)
  return [...header, ...body, ''].join('\n')
}
