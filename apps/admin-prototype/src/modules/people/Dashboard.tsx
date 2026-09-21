/**
 * People dashboard — `/people` (screen-spec §9).
 *
 * This screen was the density audit's worst offender: eleven stat cards, the
 * highest count in the app, plus five more flat `Card` sections — sixteen
 * blocks in one scroll with nothing deferred. Worse, its stat cards linked to
 * five routes that did not exist, so half the page 404'd.
 *
 * The fix is the checklist's tabbed-dashboard pattern, copied from
 * `command-centre/pages/ExecutiveHome.tsx`. Nothing was deleted. **Overview**
 * shows the four numbers that decide whether anything needs doing today, plus
 * the one panel that is true regardless of which theme you care about. Each
 * theme then gets its own tab with its full band and charts. Each band
 * computes only its own slice rather than one function deriving all eleven
 * cards whether or not they are on screen.
 *
 * Every figure is derived from a live collection, and every link now resolves.
 */

import { useMemo, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BriefcaseBusiness,
  CalendarCheck,
  CalendarOff,
  DoorOpen,
  FileSignature,
  Hourglass,
  LayoutGrid,
  TimerReset,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  Users2,
} from 'lucide-react'

import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  ProgressBar,
  SkeletonCard,
  SkeletonTable,
  StatCard,
  TabPanel,
  Tabs,
  UnitTag,
  type TabItem,
} from '@/ui'
import { useQueryState } from '@/lib/view-state'
import {
  TODAY,
  addDays,
  branchesCollection,
  candidatesCollection,
  employeesCollection,
  exitCasesCollection,
  interviewsCollection,
  jobOpeningsCollection,
  leaveRequestsCollection,
  offersCollection,
  staffAttendanceRate,
  tasksCollection,
  unitsCollection,
  useCollection,
} from '@/mocks'

import {
  BarList,
  PIPELINE_STAGES,
  Page,
  STAGE_LABEL,
  ScreenError,
  isClosedStage,
  personName,
  unitKey,
  useModuleNav,
  useScreenState,
} from './shared'
import { offerIsOverdueToResume } from './writes'

const TENURE_BANDS = [
  { label: 'Under 6 months', min: 0, max: 0.5 },
  { label: '6–12 months', min: 0.5, max: 1 },
  { label: '1–2 years', min: 1, max: 2 },
  { label: '2–4 years', min: 2, max: 4 },
  { label: 'Over 4 years', min: 4, max: Infinity },
]

function yearsSince(date: string): number {
  return (Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / (365.25 * 86_400_000)
}

const DASHBOARD_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'hiring', label: 'Hiring', icon: UserPlus },
  { id: 'workforce', label: 'Workforce', icon: Users2 },
  { id: 'time', label: 'Time and leave', icon: CalendarCheck },
  { id: 'exits', label: 'Exits', icon: DoorOpen },
]

function StatBand({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
}

export default function PeopleDashboard() {
  const state = useScreenState()
  const navigate = useModuleNav()
  const routerNavigate = useNavigate()
  const query = useQueryState()
  const tab = query.get('view') ?? 'overview'

  const employees = useCollection(employeesCollection)
  const openings = useCollection(jobOpeningsCollection)
  const candidates = useCollection(candidatesCollection)
  const interviews = useCollection(interviewsCollection)
  const offers = useCollection(offersCollection)
  const leave = useCollection(leaveRequestsCollection)
  const exits = useCollection(exitCasesCollection)
  const tasks = useCollection(tasksCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  const active = useMemo(() => employees.filter((e) => e.status !== 'exited'), [employees])

  /* -- one function per theme, per the checklist's A.2 ------------------- */

  const hiring = useMemo(() => {
    const weekEnd = addDays(TODAY, 7)
    return {
      openRoles: openings.filter((o) => o.status === 'open').length,
      draftRoles: openings.filter((o) => o.status === 'draft' || o.status === 'approved').length,
      pipeline: candidates.filter((c) => !isClosedStage(c.stage)).length,
      interviewsThisWeek: interviews.filter(
        (i) => i.status === 'scheduled' && i.scheduledAt.slice(0, 10) >= TODAY && i.scheduledAt.slice(0, 10) <= weekEnd,
      ).length,
      offersOutstanding: offers.filter((o) => o.status === 'issued').length,
      offersAwaitingResumption: offers.filter(offerIsOverdueToResume).length,
      funnel: PIPELINE_STAGES.map((stage) => ({ stage, count: candidates.filter((c) => c.stage === stage).length })),
      byOpening: openings
        .filter((o) => o.status === 'open')
        .map((opening) => ({
          id: opening.id as string,
          title: opening.title,
          ref: opening.ref,
          count: candidates.filter((c) => c.openingId === opening.id && !isClosedStage(c.stage)).length,
        }))
        .sort((a, b) => b.count - a.count),
      staleCandidates: candidates.filter(
        (c) => !isClosedStage(c.stage) && Date.parse(c.stageEnteredAt) < Date.parse(`${addDays(TODAY, -21)}T00:00:00Z`),
      ).length,
    }
  }, [openings, candidates, interviews, offers])

  const workforce = useMemo(() => {
    const onboardingTaskEmployees = new Set(
      tasks.filter((t) => t.relatedEntityType === 'Employee' && t.status !== 'done').map((t) => t.relatedEntityId),
    )
    return {
      headcount: active.length,
      onboarding: active.filter((e) => onboardingTaskEmployees.has(e.id as string) || e.startDate >= addDays(TODAY, -30)).length,
      probationDue: active.filter(
        (e) => e.probationEndsAt !== null && e.probationOutcome === null && e.probationEndsAt <= addDays(TODAY, 30),
      ).length,
      averageTenure: active.length === 0 ? 0 : active.reduce((acc, e) => acc + yearsSince(e.startDate), 0) / active.length,
      byUnit: units.map((unit) => ({
        unitId: unit.id as string,
        name: unit.name,
        count: active.filter((e) => e.unitId === unit.id).length,
      })),
      byBranch: branches.map((branch) => ({
        branchId: branch.id as string,
        name: branch.name,
        count: active.filter((e) => e.branchId === branch.id).length,
      })),
      tenure: TENURE_BANDS.map((band) => ({
        label: band.label,
        count: active.filter((e) => {
          const years = yearsSince(e.startDate)
          return years >= band.min && years < band.max
        }).length,
      })),
    }
  }, [active, units, branches, tasks])

  const time = useMemo(() => {
    const onLeaveToday = leave.filter((l) => l.status === 'approved' && l.fromDate <= TODAY && l.toDate >= TODAY)
    return {
      attendanceYesterday: staffAttendanceRate(addDays(TODAY, -1)),
      trend: Array.from({ length: 30 }, (_, i) => staffAttendanceRate(addDays(TODAY, -(29 - i))).rate),
      onLeaveToday,
      pendingLeave: leave.filter((l) => l.status === 'requested').length,
      leaveStrip: Array.from({ length: 14 }, (_, i) => {
        const date = addDays(TODAY, i)
        return { date, people: leave.filter((l) => l.status === 'approved' && l.fromDate <= date && l.toDate >= date) }
      }),
    }
  }, [leave])

  const exitFigures = useMemo(
    () => ({
      inProgress: exits.filter((e) => e.stage !== 'closed').length,
      unclearedDepartments: exits
        .filter((e) => e.stage !== 'closed')
        .reduce((acc, e) => acc + e.clearances.filter((c) => c.clearedAt === null).length, 0),
      accessStillActive: exits.filter((e) => e.stage !== 'closed' && e.accessRevokedAt === null).length,
      settlementsPending: exits.filter((e) => e.stage !== 'closed' && e.finalSettlement === null).length,
      rows: exits.map((e) => ({
        id: e.id as string,
        ref: e.ref,
        stage: e.stage,
        cleared: e.clearances.filter((c) => c.clearedAt !== null).length,
        total: e.clearances.length,
        name: personName(employees.find((emp) => emp.id === e.employeeId)?.personId ?? null),
      })),
    }),
    [exits, employees],
  )

  const maxLeave = Math.max(1, ...time.leaveStrip.map((d) => d.people.length))
  const needsAttention =
    hiring.offersAwaitingResumption + workforce.probationDue + exitFigures.accessStillActive + time.pendingLeave

  const header = (
    <PageHeader
      title="People"
      description="Hiring, headcount, attendance and exits — the whole employee lifecycle in one place."
    />
  )

  if (state.loading) {
    return (
      <Page>
        {header}
        <StatBand>
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} variant="stat" />
          ))}
        </StatBand>
        <div className="mt-6">
          <SkeletonTable rows={6} columns={3} />
        </div>
      </Page>
    )
  }

  return (
    <Page>
      {header}
      <ScreenError state={state} />

      <Tabs
        tabs={DASHBOARD_TABS}
        value={tab}
        onChange={(id) => query.set('view', id === 'overview' ? undefined : id)}
        aria-label="People dashboard sections"
        className="mb-6"
      />

      {/* ---- Overview: the four numbers that decide whether to act today -- */}
      <TabPanel id="panel-people-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
        <StatBand>
          <StatCard
            label="Headcount"
            value={formatNumber(workforce.headcount)}
            icon={Users}
            caption={`Average tenure ${workforce.averageTenure.toFixed(1)} years`}
            onClick={() => navigate('employees')}
          />
          <StatCard
            label="Candidates in pipeline"
            value={formatNumber(hiring.pipeline)}
            icon={UserPlus}
            caption={`Across ${formatNumber(hiring.openRoles)} open ${hiring.openRoles === 1 ? 'role' : 'roles'}`}
            onClick={() => navigate('candidates')}
          />
          <StatCard
            label="Attendance yesterday"
            value={formatPercent(time.attendanceYesterday.rate)}
            icon={CalendarCheck}
            variant={time.attendanceYesterday.rate >= 85 ? 'success' : 'warning'}
            sparkline={time.trend}
            caption={`${formatNumber(time.attendanceYesterday.present)} of ${formatNumber(time.attendanceYesterday.total)} present`}
            onClick={() => navigate('attendance')}
          />
          <StatCard
            label="Needs a decision"
            value={formatNumber(needsAttention)}
            icon={TriangleAlert}
            variant={needsAttention > 0 ? 'warning' : 'success'}
            caption="Offers, probations, leave and access, added up"
          />
        </StatBand>

        <Card>
          <CardHeader
            title="What is waiting on somebody"
            description="The four things on this page that go wrong quietly. Everything else is on a tab."
          />
          <CardBody>
            {needsAttention === 0 ? (
              <EmptyState
                size="sm"
                bordered
                title="Nothing is waiting on a decision"
                message="No overdue resumptions, no probation review due inside a month, no undecided leave, and no exit with access still live."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                <AttentionRow
                  count={hiring.offersAwaitingResumption}
                  label="accepted offers past their start date with nobody resumed"
                  detail="Each one is either a late start or a lapsed offer. Neither has an employment record yet."
                  onOpen={() => navigate('offers')}
                  actionLabel="Open offers"
                />
                <AttentionRow
                  count={workforce.probationDue}
                  label="probation reviews due within thirty days"
                  detail="A probation that quietly expires confirms the employee by default."
                  onOpen={() => navigate('employees')}
                  actionLabel="Open employees"
                />
                <AttentionRow
                  count={time.pendingLeave}
                  label="leave requests nobody has decided"
                  detail="An undecided request is not cover — the team still has to plan around it."
                  onOpen={() => navigate('leave')}
                  actionLabel="Open leave"
                />
                <AttentionRow
                  count={exitFigures.accessStillActive}
                  label="open exits where access has not been revoked"
                  detail="The single most expensive thing to forget on an exit."
                  onOpen={() => navigate('exits')}
                  actionLabel="Open exit cases"
                />
              </ul>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      {/* ---- Hiring ------------------------------------------------------ */}
      <TabPanel id="panel-people-hiring" tabId="hiring" active={tab === 'hiring'} className="space-y-6">
        <StatBand>
          <StatCard
            label="Open roles"
            value={formatNumber(hiring.openRoles)}
            icon={BriefcaseBusiness}
            caption={`${formatNumber(hiring.draftRoles)} more approved or in draft`}
            onClick={() => navigate('openings')}
          />
          <StatCard
            label="Candidates in pipeline"
            value={formatNumber(hiring.pipeline)}
            icon={UserPlus}
            caption={`${formatNumber(hiring.staleCandidates)} have not moved in three weeks`}
            variant={hiring.staleCandidates > 0 ? 'warning' : 'default'}
            onClick={() => navigate('candidates')}
          />
          <StatCard
            label="Interviews this week"
            value={formatNumber(hiring.interviewsThisWeek)}
            icon={CalendarCheck}
            caption="Scheduled in the next seven days"
            onClick={() => navigate('interviews')}
          />
          <StatCard
            label="Offers outstanding"
            value={formatNumber(hiring.offersOutstanding)}
            icon={FileSignature}
            variant={hiring.offersOutstanding > 0 ? 'warning' : 'default'}
            caption="Issued, awaiting a response"
            onClick={() => navigate('offers')}
          />
        </StatBand>

        {hiring.offersAwaitingResumption > 0 && (
          <Alert
            tone="warning"
            title={`${formatNumber(hiring.offersAwaitingResumption)} accepted ${hiring.offersAwaitingResumption === 1 ? 'offer has' : 'offers have'} passed their start date`}
          >
            Acceptance is not employment. No employee record exists for any of them, so nothing has reached payroll — record
            the resumption or close the offer as lapsed.
          </Alert>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Recruitment funnel" description="Candidates currently sitting at each stage." />
            <CardBody>
              {hiring.funnel.every((f) => f.count === 0) ? (
                <EmptyState
                  icon={UserPlus}
                  size="sm"
                  bordered
                  title="Nobody is in the pipeline"
                  message="Open roles with no candidates will not fill themselves. Candidates arrive from the careers page, referrals and direct applications."
                />
              ) : (
                <BarList
                  rows={hiring.funnel.map((step) => ({
                    key: step.stage,
                    label: STAGE_LABEL[step.stage],
                    value: step.count,
                    valueLabel: formatNumber(step.count),
                    tone: step.stage === 'hired' ? 'success' : 'accent',
                  }))}
                  emptyMessage="Nobody is in the pipeline."
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Pipeline depth by open role" description="An open role with nobody behind it is the one that slips." />
            <CardBody>
              <BarList
                rows={hiring.byOpening.map((opening) => ({
                  key: opening.id,
                  label: opening.title,
                  value: opening.count,
                  valueLabel: formatNumber(opening.count),
                  tone: opening.count === 0 ? 'danger' : 'accent',
                  note: opening.count === 0 ? `${opening.ref} · nobody in the pipeline` : opening.ref,
                }))}
                emptyMessage="No role is currently open, so there is no pipeline to measure."
              />
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      {/* ---- Workforce --------------------------------------------------- */}
      <TabPanel id="panel-people-workforce" tabId="workforce" active={tab === 'workforce'} className="space-y-6">
        <StatBand>
          <StatCard label="Headcount" value={formatNumber(workforce.headcount)} icon={Users} caption="Everyone not exited" onClick={() => navigate('employees')} />
          <StatCard
            label="Onboarding in progress"
            value={formatNumber(workforce.onboarding)}
            icon={UserCheck}
            caption="Resumed recently or with checklist items open"
            onClick={() => navigate('onboarding')}
          />
          <StatCard
            label="Probation reviews due"
            value={formatNumber(workforce.probationDue)}
            icon={Hourglass}
            variant={workforce.probationDue > 0 ? 'warning' : 'default'}
            caption="Ending within thirty days with no outcome"
            onClick={() => navigate('employees')}
          />
          <StatCard label="Average tenure" value={`${workforce.averageTenure.toFixed(1)} yrs`} icon={TimerReset} caption="Across everyone not exited" />
        </StatBand>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Headcount by unit" description="Which business unit each employee's cost is allocated to." />
            <CardBody className="space-y-4">
              {workforce.byUnit.map((unit) => {
                const key = unitKey(unit.unitId)
                const max = Math.max(1, ...workforce.byUnit.map((u) => u.count))
                return (
                  <div key={unit.unitId}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      {key ? <UnitTag unit={key} size="sm" /> : <span className="text-body-13">{unit.name}</span>}
                      <span className="text-body-12 text-text-secondary tabular-nums">{formatNumber(unit.count)}</span>
                    </div>
                    <ProgressBar value={unit.count} max={max} tone="accent" size="sm" aria-label={`${unit.name} headcount`} />
                  </div>
                )
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Headcount by branch" description="Where people physically report." />
            <CardBody>
              <BarList
                rows={workforce.byBranch.map((branch) => ({
                  key: branch.branchId,
                  label: branch.name,
                  value: branch.count,
                  valueLabel: formatNumber(branch.count),
                  tone: 'neutral',
                }))}
                emptyMessage="No branch has anybody assigned to it."
              />
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Tenure distribution" description="How long the people who are still here have been here." />
          <CardBody>
            <BarList
              rows={workforce.tenure.map((band) => ({
                key: band.label,
                label: band.label,
                value: band.count,
                valueLabel: formatNumber(band.count),
                tone: 'neutral',
              }))}
              emptyMessage="Nobody is on strength."
            />
          </CardBody>
        </Card>
      </TabPanel>

      {/* ---- Time and leave ---------------------------------------------- */}
      <TabPanel id="panel-people-time" tabId="time" active={tab === 'time'} className="space-y-6">
        <StatBand>
          <StatCard
            label="Attendance yesterday"
            value={formatPercent(time.attendanceYesterday.rate)}
            icon={CalendarCheck}
            variant={time.attendanceYesterday.rate >= 85 ? 'success' : 'warning'}
            sparkline={time.trend}
            caption={`${formatNumber(time.attendanceYesterday.present)} of ${formatNumber(time.attendanceYesterday.total)} present`}
            onClick={() => navigate('attendance')}
          />
          <StatCard
            label="On leave today"
            value={formatNumber(time.onLeaveToday.length)}
            icon={CalendarOff}
            caption="Approved leave covering today"
            onClick={() => navigate('leave')}
          />
          <StatCard
            label="Leave awaiting a decision"
            value={formatNumber(time.pendingLeave)}
            icon={Hourglass}
            variant={time.pendingLeave > 0 ? 'warning' : 'default'}
            caption="Requested, not yet approved or rejected"
            onClick={() => navigate('leave')}
          />
          <StatCard
            label="Attendance deductions"
            value="0"
            icon={CalendarCheck}
            caption="Disabled by policy — a breach never touches pay"
            onClick={() => routerNavigate('/payroll/adjustments')}
          />
        </StatBand>

        <Card>
          <CardHeader title="Leave over the next fortnight" description="Approved leave only. A tall bar is a day when cover needs arranging." />
          <CardBody>
            {time.leaveStrip.every((day) => day.people.length === 0) ? (
              <EmptyState
                icon={CalendarOff}
                size="sm"
                bordered
                title="No approved leave in the next fortnight"
                message="Requests appear here once an approver has decided on them."
              />
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(14, minmax(0, 1fr))' }}>
                {time.leaveStrip.map((day) => (
                  <div key={day.date} className="flex flex-col items-center gap-1.5">
                    <div className="flex h-20 w-full items-end">
                      <div
                        className={`w-full rounded-t-md ${day.people.length === 0 ? 'bg-surface-sunken' : 'bg-warning-500'}`}
                        style={{ height: `${Math.max(6, (day.people.length / maxLeave) * 100)}%` }}
                        aria-hidden="true"
                      />
                    </div>
                    <span className="text-body-12 text-text-muted">{formatDate(day.date).slice(0, 2)}</span>
                    <Badge tone={day.people.length === 0 ? 'neutral' : 'warning'} size="sm">
                      {formatNumber(day.people.length)}
                    </Badge>
                    <span className="sr-only">
                      {day.people.length === 0
                        ? `Nobody on leave on ${formatDate(day.date)}`
                        : `${day.people.map((l) => personName(employees.find((e) => e.id === l.employeeId)?.personId ?? null)).join(', ')} on leave on ${formatDate(day.date)}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </TabPanel>

      {/* ---- Exits -------------------------------------------------------- */}
      <TabPanel id="panel-people-exits" tabId="exits" active={tab === 'exits'} className="space-y-6">
        <StatBand>
          <StatCard label="Exits in progress" value={formatNumber(exitFigures.inProgress)} icon={DoorOpen} caption="Not yet closed" onClick={() => navigate('exits')} />
          <StatCard
            label="Departments still to clear"
            value={formatNumber(exitFigures.unclearedDepartments)}
            icon={TriangleAlert}
            variant={exitFigures.unclearedDepartments > 0 ? 'warning' : 'success'}
            caption="Across every open case"
            onClick={() => navigate('exits')}
          />
          <StatCard
            label="Access still active"
            value={formatNumber(exitFigures.accessStillActive)}
            icon={TriangleAlert}
            variant={exitFigures.accessStillActive > 0 ? 'warning' : 'success'}
            caption="Open exits with no revocation timestamp"
            onClick={() => navigate('exits')}
          />
          <StatCard
            label="Settlements not calculated"
            value={formatNumber(exitFigures.settlementsPending)}
            icon={Hourglass}
            caption="Nothing can be paid until clearance completes"
            onClick={() => navigate('exits')}
          />
        </StatBand>

        <Card>
          <CardHeader title="Clearance progress by case" description="Every exit case, and how many of its departments have signed off." />
          <CardBody>
            <BarList
              rows={exitFigures.rows.map((row) => ({
                key: row.id,
                label: `${row.name} · ${row.ref}`,
                value: row.cleared,
                valueLabel: `${formatNumber(row.cleared)} of ${formatNumber(row.total)}`,
                tone: row.cleared === row.total ? 'success' : 'warning',
                note: row.stage.replace(/_/g, ' '),
              }))}
              max={Math.max(1, ...exitFigures.rows.map((r) => r.total))}
              emptyMessage="No exit case has ever been opened."
            />
          </CardBody>
        </Card>
      </TabPanel>
    </Page>
  )
}

function AttentionRow({
  count,
  label,
  detail,
  onOpen,
  actionLabel,
}: {
  count: number
  label: string
  detail: string
  onOpen: () => void
  actionLabel: string
}) {
  if (count === 0) return null
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <span className="min-w-0">
        <span className="text-body-14 text-text">
          <span className="font-semibold tabular-nums">{formatNumber(count)}</span> {label}
        </span>
        <span className="mt-1 block text-body-12 text-text-secondary">{detail}</span>
      </span>
      <Button variant="link" size="sm" className="shrink-0" onClick={onOpen}>
        {actionLabel}
      </Button>
    </li>
  )
}
