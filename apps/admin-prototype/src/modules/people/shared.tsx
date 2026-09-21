import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import type { BusinessUnit } from '@/app/module-registry'
import type { BadgeTone, TabItem } from '@/ui'
import { Alert, Button, ProgressBar, Tabs } from '@/ui'
import {
  branchesCollection,
  departmentsCollection,
  peopleCollection,
  rolesCollection,
  unitsCollection,
  usersCollection,
} from '@/mocks'
import type { CandidateStage, UnitCode } from '@/mocks'

/* -------------------------------------------------------------------------- */
/* Reference lookups                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The store keys units by `UnitId` and carries a `UnitCode`; `UnitTag` keys off
 * the registry's lowercase `BusinessUnit`. This bridges the two.
 *
 * FLAG: belongs in `src/ui/UnitTag.tsx` — every module that renders a unit-
 * tagged row needs it, so this bridge is duplicated in four module folders.
 */
const UNIT_KEY: Record<UnitCode, BusinessUnit> = {
  ACADEMY: 'academy',
  TEENS: 'teens',
  CORPORATE: 'corporate',
  DEXURB: 'dexurb',
  AFRICA: 'africa',
  TCF: 'tcf',
}

export function unitKey(unitId: string | null | undefined): BusinessUnit | null {
  if (!unitId) return null
  const code = unitsCollection.find(unitId)?.code
  return code ? UNIT_KEY[code] : null
}

export function unitName(unitId: string | null | undefined): string {
  if (!unitId) return 'Unassigned'
  return unitsCollection.find(unitId)?.name ?? 'Unassigned'
}

export function branchName(branchId: string | null | undefined): string {
  if (!branchId) return '—'
  return branchesCollection.find(branchId)?.name ?? '—'
}

export function departmentName(departmentId: string | null | undefined): string {
  if (!departmentId) return '—'
  return departmentsCollection.find(departmentId)?.name ?? '—'
}

export function personName(personId: string | null | undefined): string {
  if (!personId) return '—'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

export function userName(userId: string | null | undefined): string {
  if (!userId) return '—'
  const user = usersCollection.find(userId)
  return user ? personName(user.personId) : '—'
}

export function userRoleName(userId: string | null | undefined): string {
  if (!userId) return 'Unknown'
  const user = usersCollection.find(userId)
  const roleId = user?.roleIds[0]
  if (!roleId) return 'No role assigned'
  return rolesCollection.find(roleId)?.name ?? 'No role assigned'
}

/* -------------------------------------------------------------------------- */
/* The hiring pipeline, as one shared vocabulary                              */
/* -------------------------------------------------------------------------- */

/** The forward pipeline, in order. Progress is measured against this list. */
export const PIPELINE_STAGES: CandidateStage[] = [
  'applied',
  'screening',
  'shortlisted',
  'interview',
  'assessment',
  'final_review',
  'offer',
  'hired',
]

/** Ways out of the pipeline. None of them is a deletion. */
export const EXIT_STAGES: CandidateStage[] = ['rejected', 'withdrawn', 'talent_pool', 'no_show']

export const ALL_STAGES: CandidateStage[] = [...PIPELINE_STAGES, ...EXIT_STAGES]

export const STAGE_LABEL: Record<CandidateStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  assessment: 'Assessment',
  final_review: 'Final review',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  talent_pool: 'Talent pool',
  no_show: 'No show',
}

export const STAGE_TONE: Record<CandidateStage, BadgeTone> = {
  applied: 'neutral',
  screening: 'info',
  shortlisted: 'info',
  interview: 'info',
  assessment: 'info',
  final_review: 'warning',
  offer: 'accent',
  hired: 'success',
  rejected: 'danger',
  withdrawn: 'danger',
  talent_pool: 'neutral',
  no_show: 'danger',
}

export function isClosedStage(stage: CandidateStage): boolean {
  return stage === 'hired' || EXIT_STAGES.includes(stage)
}

export const INTERVIEW_TYPE_LABEL: Record<string, string> = {
  screening: 'Screening',
  technical: 'Technical',
  panel: 'Panel',
  final: 'Final',
}

export const RECOMMENDATION_LABEL: Record<string, string> = {
  strong_hire: 'Strong hire',
  hire: 'Hire',
  no_decision: 'No decision',
  no_hire: 'No hire',
  strong_no_hire: 'Strong no hire',
}

export const RECOMMENDATION_TONE: Record<string, BadgeTone> = {
  strong_hire: 'success',
  hire: 'success',
  no_decision: 'neutral',
  no_hire: 'danger',
  strong_no_hire: 'danger',
}

export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  intern: 'Intern',
}

export const LEAVE_TYPE_LABEL: Record<string, string> = {
  annual: 'Annual',
  sick: 'Sick',
  compassionate: 'Compassionate',
  maternity: 'Maternity',
  paternity: 'Paternity',
  study: 'Study',
  unpaid: 'Unpaid',
}

export const ATTENDANCE_STATE_LABEL: Record<string, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  approved_leave: 'Approved leave',
  remote_approved: 'Remote approved',
  holiday: 'Holiday',
  off_day: 'Off day',
  early_departure: 'Early departure',
  missing_clock_out: 'Missing clock-out',
  excused: 'Excused',
}

export const ATTENDANCE_SOURCE_LABEL: Record<string, string> = {
  nfc_tap: 'NFC tap',
  qr: 'QR',
  approved_device: 'Approved device',
  office_network: 'Office network',
  manual: 'Manual',
}

/** The PRD's own §6 sequence — `advanceExitCase` in `writes.ts` walks this list. */
export const EXIT_STAGE_ORDER = [
  'notice_review',
  'handover',
  'asset_return',
  'access_review',
  'finance_reconciliation',
  'commission_reconciliation',
  'hr_documentation',
  'exit_interview',
  'department_clearance',
  'final_approval',
  'final_payment',
  'closed',
] as const

export const EXIT_STAGE_LABEL: Record<string, string> = {
  notice_review: 'Notice review',
  handover: 'Handover',
  asset_return: 'Asset return',
  access_review: 'Access review',
  finance_reconciliation: 'Finance reconciliation',
  commission_reconciliation: 'Commission reconciliation',
  hr_documentation: 'HR documentation',
  exit_interview: 'Exit interview',
  department_clearance: 'Department clearance',
  final_approval: 'Final approval',
  final_payment: 'Final payment',
  closed: 'Closed',
}

/* -------------------------------------------------------------------------- */
/* Screen state                                                               */
/* -------------------------------------------------------------------------- */

const FORCE_ERROR_KEY = 'cirvee-os:force-error'

function consumeForcedError(): boolean {
  try {
    if (sessionStorage.getItem(FORCE_ERROR_KEY) !== '1') return false
    sessionStorage.removeItem(FORCE_ERROR_KEY)
    return true
  } catch {
    return false
  }
}

export interface ScreenState {
  loading: boolean
  error: string | null
  retry: () => void
}

/**
 * The spec's §0.5 loading contract: a short delay on mount so the skeleton is
 * visible in a demo, and a failure path reachable from Settings → Demo controls
 * → "Force error on next load".
 */
export function useScreenState(delayMs = 400): ScreenState {
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      setLoading(false)
      if (consumeForcedError()) setError('Could not load the people records. Nothing was changed.')
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [attempt, delayMs])

  return { loading, error, retry: () => setAttempt((n) => n + 1) }
}

export function ScreenError({ state }: { state: ScreenState }) {
  if (!state.error) return null
  return (
    <Alert
      tone="danger"
      title="This view could not load"
      className="mb-6"
      action={
        <Button size="sm" variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={state.retry}>
          Retry
        </Button>
      }
    >
      {state.error}
    </Alert>
  )
}

/* -------------------------------------------------------------------------- */
/* Module navigation                                                          */
/* -------------------------------------------------------------------------- */

/**
 * `PageHeader` only renders its tab strip when `activeTab` is truthy, so the
 * dashboard's id cannot be the empty string — that is why the module's tab
 * strip never appeared before this pass. `useModuleNav` maps the id back to
 * the module-relative route.
 */
export const DASHBOARD_TAB = 'dashboard'

/**
 * Dashboard, Hiring, Workforce, Time and leave and Exit cases are each their
 * own real sidebar row now (`expandSubnavInSidebar` on `index.tsx`) — eleven
 * flat tabs were one screen's worth too many for a single row, and a tab was
 * never where a founder looks for a page. Hiring/Workforce/Time and leave
 * still cover more than one screen each, so `PEOPLE_GROUP_CHILDREN` holds
 * what each expands to, and every screen inside one renders `PeopleGroupTabs`
 * as its own second-row navigation between siblings. `exits` and the
 * dashboard are one screen each and need no second row at all.
 */
export type PeopleGroup = 'hiring' | 'workforce' | 'time'

export const PEOPLE_GROUP_CHILDREN: Record<PeopleGroup, TabItem[]> = {
  hiring: [
    { id: 'openings', label: 'Job openings' },
    { id: 'candidates', label: 'Candidates' },
    { id: 'interviews', label: 'Interviews' },
    { id: 'offers', label: 'Offers' },
  ],
  workforce: [
    { id: 'employees', label: 'Employees' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'performance', label: 'Performance' },
  ],
  time: [
    { id: 'attendance', label: 'Attendance' },
    { id: 'leave', label: 'Leave' },
  ],
}

export function useModuleNav() {
  const navigate = useNavigate()
  return (id: string) => navigate(`/people/${id === DASHBOARD_TAB ? '' : id}`.replace(/\/$/, ''))
}

/**
 * The second tab row for a multi-screen group — same `Tabs` primitive and
 * styling `Dashboard.tsx` already uses for its own internal content switcher,
 * just wired to a real route instead of a `?view=` query param.
 */
export function PeopleGroupTabs({ group, active }: { group: PeopleGroup; active: string }) {
  const navigate = useModuleNav()
  return (
    <Tabs
      tabs={PEOPLE_GROUP_CHILDREN[group]}
      value={active}
      onChange={navigate}
      size="sm"
      aria-label={`${group} sections`}
      className="mb-6"
    />
  )
}

/* -------------------------------------------------------------------------- */
/* Small layout helpers                                                       */
/* -------------------------------------------------------------------------- */

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 pb-16">{children}</div>
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{children}</div>
}

/** Matches `text-label-11` headings used above dense sub-lists. */
export function Caption({ children }: { children: ReactNode }) {
  return <p className="text-body-13 text-text-secondary">{children}</p>
}

/* -------------------------------------------------------------------------- */
/* Bar list — the stand-in for a chart component                              */
/* -------------------------------------------------------------------------- */

export interface BarRow {
  key: string
  label: ReactNode
  value: number
  valueLabel: ReactNode
  tone?: 'accent' | 'success' | 'warning' | 'danger' | 'neutral'
  note?: ReactNode
}

/**
 * FLAG: the same component exists in five other module folders. It belongs in
 * `src/ui/` — the library has no chart primitive at all.
 */
export function BarList({
  rows,
  max,
  emptyMessage = 'Nothing to plot yet.',
}: {
  rows: BarRow[]
  max?: number
  emptyMessage?: string
}) {
  const ceiling = max ?? Math.max(1, ...rows.map((r) => r.value))
  if (rows.length === 0) {
    return <p className="text-body-13 text-text-secondary">{emptyMessage}</p>
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <ProgressBar
            value={row.value}
            max={ceiling}
            tone={row.tone ?? 'accent'}
            size="sm"
            label={row.label}
            valueLabel={row.valueLabel}
          />
          {row.note && <p className="mt-1 text-body-12 text-text-secondary">{row.note}</p>}
        </li>
      ))}
    </ul>
  )
}
