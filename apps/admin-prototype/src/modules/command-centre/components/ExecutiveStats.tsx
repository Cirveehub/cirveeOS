/**
 * The PRD's four executive questions, one component per question, plus a
 * headline set for the Overview tab.
 *
 * This used to be one component rendering all four `StatBand`s in a single
 * flat scroll — ~16 cards, six more chart panels below them, and nothing to
 * defer any of it. `ExecutiveHome.tsx` now puts one question per tab; this
 * file is split to match, so each tab computes only the metrics it shows
 * rather than the whole page computing everything up front. Every value is
 * still a selector call — nothing here is a constant, with the one
 * documented exception (cash position) that already said so on its face.
 */

import {
  AlertOctagon,
  Banknote,
  CalendarCheck,
  CheckCheck,
  Clock3,
  FileText,
  GraduationCap,
  LineChart,
  Percent,
  PiggyBank,
  Timer,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Workflow,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import {
  LAST_90D,
  TODAY,
  activeLearners,
  admissionsCreated,
  automationHealth,
  collectedRevenue,
  collectionRate,
  enrolledStudents,
  executiveSummary,
  gradingBacklog,
  invoicedRevenue,
  leadConversionRate,
  medianApprovalDays,
  medianFirstResponseMinutes,
  medianGradingTurnaroundDays,
  newLeads,
  outstandingCorporate,
  outstandingTuition,
  respondedWithinSlaRate,
  staffAttendanceRate,
  studentAttendanceRate,
  studentsWithBalance,
} from '@/mocks'
import type { DateRange, UnitId } from '@/mocks'
import { formatNaira, formatNumber, formatPercent, pluralize } from '@/lib/format'
import { StatCard } from '@/ui'

import { deltaPercent, deltaPoints, previousWindow, shiftDays, sliceWindows } from '../lib/series'
import { StatBand } from './StatBand'
import { TriValueCard } from './TriValueCard'

/** The response-time target the seed holds on every lead. */
const RESPONSE_TARGET_MINUTES = 120

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return 'No responses yet'
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  return hours ? `${hours}h ${String(rest).padStart(2, '0')}m` : `${rest}m`
}

/**
 * The pipeline window.
 *
 * Money follows the date range the user picks. The pipeline does not: the
 * seed's lead volumes, the conversion rate and the funnel are all measured
 * over the trailing ninety days — which is also what `executiveSummary()`
 * does — so a "this month" range would report a conversion rate against a
 * denominator that had not had time to convert. The cards say so on their
 * face rather than leaving it implied.
 */
const PIPELINE_WINDOW: DateRange = LAST_90D
const PIPELINE_LABEL = 'Trailing 90 days'

export interface QuestionBandProps {
  range: DateRange
  unitId: UnitId | undefined
}

/* -------------------------------------------------------------------------- */
/* Are we making money?                                                       */
/* -------------------------------------------------------------------------- */

export function MoneyBand({ range, unitId }: QuestionBandProps) {
  const navigate = useNavigate()
  const previous = previousWindow(range)
  const slices = sliceWindows(range, 8)

  const collected = collectedRevenue(range, unitId)
  const collectedBefore = collectedRevenue(previous, unitId)
  const invoiced = invoicedRevenue(range, unitId)
  const invoicedBefore = invoicedRevenue(previous, unitId)
  const rate = collectionRate(range, unitId)
  const rateBefore = collectionRate(previous, unitId)
  const outstanding = outstandingTuition(unitId)
  const corporate = outstandingCorporate()
  const withBalance = studentsWithBalance()

  return (
    <StatBand
      question="Are we making money?"
      answer={
        <>
          {formatNaira(collected)} collected of {formatNaira(invoiced)} invoiced. Collections and
          billings are shown side by side and never netted against each other.
        </>
      }
    >
      <StatCard
        label="Collected revenue"
        value={formatNaira(collected)}
        icon={Banknote}
        variant="success"
        sparkline={slices.map((slice) => collectedRevenue(slice.range, unitId))}
        delta={{ value: deltaPercent(collected, collectedBefore), label: 'vs previous period' }}
        onClick={() => navigate('/finance/payments?status=matched')}
      />
      <StatCard
        label="Invoiced revenue"
        value={formatNaira(invoiced)}
        icon={FileText}
        sparkline={slices.map((slice) => invoicedRevenue(slice.range, unitId))}
        delta={{ value: deltaPercent(invoiced, invoicedBefore), label: 'vs previous period' }}
        onClick={() => navigate('/finance/invoices')}
      />
      <StatCard
        label="Collection rate"
        value={formatPercent(rate)}
        icon={Percent}
        variant={rate >= 80 ? 'success' : rate >= 65 ? 'warning' : 'danger'}
        delta={{
          value: deltaPoints(rate, rateBefore),
          label: 'points vs previous period',
          tone: rate >= rateBefore ? 'positive' : 'negative',
        }}
        caption={`${formatNaira(collected, { compact: true })} of ${formatNaira(invoiced, { compact: true })}`}
        onClick={() => navigate('/finance/invoices?status=partially-paid,overdue')}
      />
      <StatCard
        label="Outstanding tuition"
        value={formatNaira(outstanding)}
        icon={Wallet}
        variant={outstanding > 0 ? 'warning' : 'success'}
        caption={
          outstanding > 0
            ? `Across ${pluralize(withBalance, 'student')} · ${formatNaira(corporate, { compact: true })} corporate, counted separately`
            : 'Every student invoice is settled'
        }
        onClick={() => navigate('/finance/invoices?status=overdue,partially-paid')}
      />
    </StatBand>
  )
}

/* -------------------------------------------------------------------------- */
/* Are we growing?                                                            */
/* -------------------------------------------------------------------------- */

export function GrowthBand({ range: _range }: QuestionBandProps) {
  const navigate = useNavigate()
  const pipelinePrevious = previousWindow(PIPELINE_WINDOW)
  const pipelineSlices = sliceWindows(PIPELINE_WINDOW, 9)
  const leads = newLeads(PIPELINE_WINDOW)
  const leadsBefore = newLeads(pipelinePrevious)
  const conversion = leadConversionRate(PIPELINE_WINDOW)
  const conversionBefore = leadConversionRate(pipelinePrevious)
  const admissions = admissionsCreated(PIPELINE_WINDOW)
  const admissionsBefore = admissionsCreated(pipelinePrevious)
  const response = medianFirstResponseMinutes(PIPELINE_WINDOW)
  const responseBefore = medianFirstResponseMinutes(pipelinePrevious)
  const withinSla = respondedWithinSlaRate(PIPELINE_WINDOW)

  return (
    <StatBand
      question="Are we growing?"
      answer={
        <>
          {pluralize(leads, 'lead')} in and {pluralize(admissions.enrolled, 'enrolment')} out over the
          trailing ninety days — the window the pipeline is measured over, whatever date range is set
          above.
        </>
      }
    >
      <StatCard
        label="New leads"
        value={formatNumber(leads)}
        icon={UserPlus}
        sparkline={pipelineSlices.map((slice) => newLeads(slice.range))}
        delta={{ value: deltaPercent(leads, leadsBefore), label: 'vs previous 90 days' }}
        caption={PIPELINE_LABEL}
        onClick={() => navigate('/crm/leads?created=90d')}
      />
      <StatCard
        label="Lead to enrolment conversion"
        value={formatPercent(conversion)}
        icon={LineChart}
        variant={conversion >= 12 ? 'success' : 'warning'}
        delta={{
          value: deltaPoints(conversion, conversionBefore),
          label: 'points vs previous 90 days',
          tone: conversion >= conversionBefore ? 'positive' : 'negative',
        }}
        caption={`${formatNumber(admissions.enrolled)} enrolled of ${formatNumber(leads)} leads`}
        onClick={() => navigate('/crm')}
      />
      <StatCard
        label="Enrolments"
        value={formatNumber(admissions.enrolled)}
        icon={GraduationCap}
        variant="success"
        delta={{
          value: deltaPercent(admissions.enrolled, admissionsBefore.enrolled),
          label: 'vs previous 90 days',
        }}
        caption={`${PIPELINE_LABEL} · of ${pluralize(admissions.total, 'admission')} raised, ${formatNumber(admissions.pendingDiscount)} awaiting a discount decision`}
        onClick={() => navigate('/crm/admissions?status=enrolled')}
      />
      <StatCard
        label="Median first response"
        value={formatMinutes(response)}
        icon={Timer}
        variant={
          response === null ? 'default' : response <= RESPONSE_TARGET_MINUTES ? 'success' : 'warning'
        }
        delta={
          response !== null && responseBefore !== null
            ? {
                value: deltaPercent(response, responseBefore),
                label: 'vs previous 90 days',
                tone: response <= responseBefore ? 'positive' : 'negative',
              }
            : undefined
        }
        caption={`Target ${formatMinutes(RESPONSE_TARGET_MINUTES)} · ${formatPercent(withinSla)} answered inside it`}
        onClick={() => navigate('/crm/leads')}
      />
    </StatBand>
  )
}

/* -------------------------------------------------------------------------- */
/* Are students succeeding?                                                   */
/* -------------------------------------------------------------------------- */

export function StudentsBand({ range }: QuestionBandProps) {
  const navigate = useNavigate()
  const summary = executiveSummary(range)
  const studentAttendance = studentAttendanceRate(7)
  const learners = activeLearners()
  const everEnrolled = enrolledStudents()
  const backlog = gradingBacklog()
  const turnaround = medianGradingTurnaroundDays()

  return (
    <StatBand
      question="Are students succeeding?"
      answer={
        <>
          {pluralize(learners, 'active learner')} · {formatPercent(studentAttendance)} attendance
          across the last seven days of delivered sessions.
        </>
      }
    >
      <StatCard
        label="Student attendance, 7 days"
        value={formatPercent(studentAttendance)}
        icon={CalendarCheck}
        variant={studentAttendance >= 85 ? 'success' : studentAttendance >= 70 ? 'warning' : 'danger'}
        caption="Present or late, across delivered sessions"
        onClick={() => navigate('/academy/attendance')}
      />
      <StatCard
        label="Active learners"
        value={formatNumber(learners)}
        icon={Users}
        caption={`${formatNumber(everEnrolled)} enrolled lifetime · ${formatNumber(summary.attentionFlags)} carrying an attention flag`}
        onClick={() => navigate('/learn')}
      />
      <StatCard
        label="Awaiting grading"
        value={formatNumber(backlog.length)}
        icon={CheckCheck}
        variant={backlog.length > 20 ? 'warning' : 'default'}
        caption={
          backlog.length
            ? `Oldest waiting ${pluralize(backlog[0].daysWaiting, 'day')}`
            : 'Nothing is waiting on a tutor'
        }
        onClick={() => navigate('/learn/submissions')}
      />
      <StatCard
        label="Median grading turnaround"
        value={turnaround > 0 ? pluralize(turnaround, 'day') : 'No graded work yet'}
        icon={Clock3}
        variant={turnaround <= 3 ? 'success' : 'warning'}
        caption="From submission to grade, on work already graded"
        onClick={() => navigate('/learn/submissions')}
      />
    </StatBand>
  )
}

/* -------------------------------------------------------------------------- */
/* Is the organisation functioning?                                          */
/* -------------------------------------------------------------------------- */

export function OrganisationBand({ range }: QuestionBandProps) {
  const navigate = useNavigate()
  const summary = executiveSummary(range)
  const yesterday = shiftDays(TODAY, -1)
  const staff = staffAttendanceRate(yesterday)
  const automation = automationHealth()

  return (
    <StatBand
      question="Is the organisation functioning?"
      answer={
        <>
          {formatPercent(staff.rate)} of staff clocked in yesterday and{' '}
          {formatNumber(summary.pendingApprovals)} decisions are waiting on somebody.
        </>
      }
    >
      <StatCard
        label="Staff attendance, yesterday"
        value={formatPercent(staff.rate)}
        icon={UserCheck}
        variant={staff.rate >= 90 ? 'success' : staff.rate >= 75 ? 'warning' : 'danger'}
        caption={`${formatNumber(staff.present)} of ${formatNumber(staff.total)} · breaches carry no financial consequence`}
        onClick={() => navigate('/people')}
      />
      <TriValueCard
        label="Open work"
        icon={AlertOctagon}
        caption={`Each figure is a queue somebody owns. Median approval takes ${pluralize(medianApprovalDays(), 'day')}.`}
        segments={[
          { label: 'Approvals', value: summary.pendingApprovals, to: '/approvals' },
          { label: 'Tickets', value: summary.unresolvedTickets, to: '/support/tickets' },
          {
            label: 'Flags',
            value: summary.attentionFlags,
            to: '/academy/students?flagged=true',
            tone: 'danger',
          },
        ]}
      />
      <StatCard
        label="Automation success rate"
        value={formatPercent(automation.successRate)}
        icon={Workflow}
        variant={
          automation.exceptionsOpen > 0
            ? 'warning'
            : automation.successRate >= 95
              ? 'success'
              : 'default'
        }
        caption={`${formatNumber(automation.runs7d)} runs · ${formatNumber(automation.exceptionsOpen)} open exceptions`}
        onClick={() => navigate('/automation/runs')}
      />
      <StatCard
        label="Cash position"
        value={formatNaira(summary.cashPosition)}
        icon={PiggyBank}
        caption="Seeded opening balance — the prototype has no cash book, so this is the one figure on the page that is not derived."
      />
    </StatBand>
  )
}

/* -------------------------------------------------------------------------- */
/* Overview — one headline card per question, for the tab everyone lands on  */
/* -------------------------------------------------------------------------- */

/**
 * The card a founder reads in the first three seconds: one number per
 * question, the same figures each full band leads with, just not all sixteen
 * cards behind them. Clicking through opens that question's own tab, not a
 * module — the point is to stay on Home until you've decided you need more.
 */
export function OverviewHeadlines({ range, unitId }: QuestionBandProps) {
  const collected = collectedRevenue(range, unitId)
  const invoiced = invoicedRevenue(range, unitId)
  const leads = newLeads(PIPELINE_WINDOW)
  const admissions = admissionsCreated(PIPELINE_WINDOW)
  const studentAttendance = studentAttendanceRate(7)
  const learners = activeLearners()
  const summary = executiveSummary(range)
  const yesterday = shiftDays(TODAY, -1)
  const staff = staffAttendanceRate(yesterday)

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Collected revenue"
        value={formatNaira(collected)}
        icon={Banknote}
        variant="success"
        caption={`of ${formatNaira(invoiced, { compact: true })} invoiced`}
      />
      <StatCard
        label="New leads, 90 days"
        value={formatNumber(leads)}
        icon={UserPlus}
        caption={`${pluralize(admissions.enrolled, 'enrolment')} out the other end`}
      />
      <StatCard
        label="Student attendance, 7 days"
        value={formatPercent(studentAttendance)}
        icon={CalendarCheck}
        variant={studentAttendance >= 85 ? 'success' : studentAttendance >= 70 ? 'warning' : 'danger'}
        caption={`${pluralize(learners, 'active learner')}`}
      />
      <StatCard
        label="Staff attendance, yesterday"
        value={formatPercent(staff.rate)}
        icon={UserCheck}
        variant={staff.rate >= 90 ? 'success' : staff.rate >= 75 ? 'warning' : 'danger'}
        caption={`${formatNumber(summary.pendingApprovals)} approvals waiting`}
      />
    </div>
  )
}
