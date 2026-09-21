import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Award,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  Info,
  MessageSquareReply,
  ShieldCheck,
  Timer,
  TrendingUp,
  UserRoundSearch,
} from 'lucide-react'

import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  StatCard,
  TabPanel,
  Tabs,
} from '@/ui'
import { useQueryState } from '@/lib/view-state'
import {
  TODAY,
  branchesCollection,
  cohortsCollection,
  coursesCollection,
  outcomeRecordsCollection,
  useCollection,
} from '@/mocks'
import type { Branch, Cohort, Course, OutcomeRecord } from '@/mocks'

import {
  BarList,
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  OUTCOME_TYPE_LABEL,
  OUTCOME_TYPE_ORDER,
  Screen,
  isPlaced,
  median,
  monthsBetween,
  percent,
  useModuleData,
  type BarRow,
} from './parts'

const TIME_BANDS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: 'Under 1 month', min: 0, max: 1 },
  { label: '1 to 3 months', min: 1, max: 3 },
  { label: '3 to 6 months', min: 3, max: 6 },
  { label: '6 to 12 months', min: 6, max: 12 },
  { label: 'Over 12 months', min: 12, max: Infinity },
]

function timeToPlacement(record: OutcomeRecord): number | null {
  if (!record.placementDate) return null
  return monthsBetween(record.graduatedAt, record.placementDate)
}

function headlineBand(records: OutcomeRecord[]) {
  const total = records.length
  const placed = records.filter(isPlaced)
  const checkpointsReached = records.flatMap((r) => r.checkpoints.filter((c) => c.dueDate <= TODAY))

  return {
    total,
    placedCount: placed.length,
    notYetPlaced: records.filter((r) => r.outcomeType === 'not_yet_placed').length,
    followUpsDue: records.flatMap((r) => r.checkpoints.filter((c) => c.dueDate <= TODAY && c.status !== 'responded'))
      .length,
    checkpointsReached: checkpointsReached.length,
    responded: checkpointsReached.filter((c) => c.status === 'responded').length,
    consented: records.filter((r) => r.consentForPublicUse).length,
  }
}

function mixBand(records: OutcomeRecord[]) {
  const total = records.length
  const byType = OUTCOME_TYPE_ORDER.map((type) => ({
    type,
    count: records.filter((r) => r.outcomeType === type).length,
  }))
  const countOf = (type: string) => byType.find((t) => t.type === type)?.count ?? 0

  return {
    byType,
    fullTime: countOf('full_time'),
    selfEmployedLike: countOf('freelance') + countOf('self_employed'),
    furtherStudy: countOf('further_study'),
    internship: countOf('internship'),
    total,
  }
}

function segmentBand(records: OutcomeRecord[], courses: Course[], cohorts: Cohort[], branches: Branch[]) {
  const byCourse = courses
    .map((course) => {
      const mine = records.filter((r) => r.courseId === course.id)
      return { key: course.id as string, title: course.title, total: mine.length, placed: mine.filter(isPlaced).length }
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => percent(b.placed, b.total) - percent(a.placed, a.total))

  const byCohort = cohorts
    .map((cohort) => {
      const mine = records.filter((r) => r.cohortId === cohort.id)
      return { key: cohort.id as string, code: cohort.code, total: mine.length, placed: mine.filter(isPlaced).length }
    })
    .filter((c) => c.total > 0)
    .sort((a, b) => percent(b.placed, b.total) - percent(a.placed, a.total))

  const byBranch = branches
    .map((branch) => {
      const cohortIds = new Set(cohorts.filter((c) => c.branchId === branch.id).map((c) => c.id as string))
      const mine = records.filter((r) => cohortIds.has(r.cohortId as string))
      return { key: branch.id as string, name: branch.name, total: mine.length, placed: mine.filter(isPlaced).length }
    })
    .filter((b) => b.total > 0)

  return { byCourse, byCohort, byBranch }
}

function timingBand(records: OutcomeRecord[]) {
  const placementMonths = records
    .filter(isPlaced)
    .map(timeToPlacement)
    .filter((m): m is number => m !== null)

  const volunteeredIncome = records.filter((r) => r.incomeChange !== null && r.incomeChange.volunteered)
  const incomeBefore: number[] = volunteeredIncome.flatMap((r) =>
    r.incomeChange?.before == null ? [] : [r.incomeChange.before as number],
  )
  const incomeAfter: number[] = volunteeredIncome.flatMap((r) =>
    r.incomeChange?.after == null ? [] : [r.incomeChange.after as number],
  )

  return {
    medianMonths: median(placementMonths),
    timeBands: TIME_BANDS.map((band) => ({
      label: band.label,
      count: placementMonths.filter((m) => m >= band.min && m < band.max).length,
    })),
    volunteeredIncome,
    medianBefore: median(incomeBefore),
    medianAfter: median(incomeAfter),
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  const allRecords = useCollection(outcomeRecordsCollection)
  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const branches = useCollection(branchesCollection)

  const { loading, error, rows: records, retry } = useModuleData(allRecords, 'outcomes.dashboard')

  const headline = useMemo(() => headlineBand(records), [records])
  const mix = useMemo(() => (tab === 'mix' ? mixBand(records) : null), [records, tab])
  const segments = useMemo(
    () => (tab === 'segments' ? segmentBand(records, courses, cohorts, branches) : null),
    [records, courses, cohorts, branches, tab],
  )
  const timing = useMemo(() => (tab === 'timing' ? timingBand(records) : null), [records, tab])

  const header = (
    <ModuleHeader
      title="Outcomes"
      description="What happened to every graduate after certification — tracked on a 3, 6 and 12 month rhythm."
    />
  )

  if (error) {
    return (
      <Screen>
        {header}
        <ErrorPanel onRetry={retry} what="Outcome records" />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        {header}
        <DashboardSkeleton />
      </Screen>
    )
  }

  if (headline.total === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={GraduationCap}
          title="No outcome records yet"
          message="A record opens by itself the moment a certificate is issued, with follow-ups scheduled at 3, 6 and 12 months. Until a cohort certifies, there is nothing to report and no placement rate to quote."
        />
      </Screen>
    )
  }

  const placementRate = percent(headline.placedCount, headline.total)
  const responseRate = percent(headline.responded, headline.checkpointsReached)

  return (
    <Screen>
      {header}

      <Tabs
        aria-label="Dashboard sections"
        className="mb-6"
        value={tab}
        onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'mix', label: 'Outcome mix' },
          { id: 'segments', label: 'Course, cohort and branch' },
          { id: 'timing', label: 'Time and income' },
        ]}
      />

      <TabPanel id="outcomes-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard
            label="Graduates tracked"
            value={formatNumber(headline.total)}
            icon={GraduationCap}
            caption="One record per certificate issued"
            onClick={() => navigate('/outcomes/graduates')}
          />
          <StatCard
            label="Placement rate"
            value={formatPercent(placementRate)}
            icon={TrendingUp}
            variant={placementRate >= 60 ? 'success' : 'warning'}
            caption={`${formatNumber(headline.placedCount)} of ${formatNumber(headline.total)} in work or study`}
            onClick={() => navigate('/outcomes/placements')}
          />
          <StatCard
            label="Not yet placed"
            value={formatPercent(percent(headline.notYetPlaced, headline.total))}
            icon={UserRoundSearch}
            variant={headline.notYetPlaced > 0 ? 'warning' : 'default'}
            caption={`${formatNumber(headline.notYetPlaced)} graduates still searching`}
            onClick={() => navigate('/outcomes/graduates?outcome=not_yet_placed')}
          />
          <StatCard
            label="Follow-ups due"
            value={formatNumber(headline.followUpsDue)}
            icon={CalendarClock}
            variant={headline.followUpsDue > 0 ? 'warning' : 'default'}
            caption="Checkpoints past their due date with no answer"
            onClick={() => navigate('/outcomes/follow-ups')}
          />
          <StatCard
            label="Consented for public use"
            value={formatNumber(headline.consented)}
            icon={ShieldCheck}
            caption="The only records that may be quoted publicly"
          />
        </div>

        <Card>
          <CardHeader
            title="Response rate"
            description="Checkpoints that came back, out of the checkpoints that have fallen due."
          />
          <CardBody>
            <BarList
              max={100}
              rows={[
                {
                  key: 'response',
                  label: 'Checkpoints answered',
                  value: responseRate,
                  valueLabel: `${formatPercent(responseRate)} · ${formatNumber(headline.responded)} of ${formatNumber(headline.checkpointsReached)}`,
                  tone: responseRate >= 50 ? 'success' : 'warning',
                },
                {
                  key: 'consent',
                  label: 'Graduates who consented to public use',
                  value: percent(headline.consented, headline.total),
                  valueLabel: `${formatPercent(percent(headline.consented, headline.total))} · ${formatNumber(headline.consented)} of ${formatNumber(headline.total)}`,
                  tone: 'neutral',
                },
              ]}
            />
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="outcomes-mix" tabId="mix" active={tab === 'mix'} className="space-y-6">
        {mix && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Full-time"
                value={formatPercent(percent(mix.fullTime, mix.total))}
                icon={BriefcaseBusiness}
                caption={`${formatNumber(mix.fullTime)} graduates on a full-time contract`}
              />
              <StatCard
                label="Freelance or self-employed"
                value={formatPercent(percent(mix.selfEmployedLike, mix.total))}
                icon={UserRoundSearch}
                caption={`${formatNumber(mix.selfEmployedLike)} graduates working for themselves`}
              />
              <StatCard
                label="Internship"
                value={formatPercent(percent(mix.internship, mix.total))}
                icon={BriefcaseBusiness}
                caption={`${formatNumber(mix.internship)} graduates on an internship`}
              />
              <StatCard
                label="Further study"
                value={formatPercent(percent(mix.furtherStudy, mix.total))}
                icon={Award}
                caption={`${formatNumber(mix.furtherStudy)} graduates went on to study`}
              />
            </div>

            <Card>
              <CardHeader
                title="Outcome mix"
                description="Where the whole tracked cohort actually ended up, including the graduates still searching."
              />
              <CardBody>
                <BarList
                  max={mix.total}
                  rows={mix.byType.map<BarRow>((row) => ({
                    key: row.type,
                    label: OUTCOME_TYPE_LABEL[row.type],
                    value: row.count,
                    valueLabel: `${formatNumber(row.count)} · ${formatPercent(percent(row.count, mix.total))}`,
                    tone:
                      row.type === 'not_yet_placed'
                        ? 'warning'
                        : row.type === 'full_time'
                          ? 'success'
                          : 'accent',
                  }))}
                />
              </CardBody>
            </Card>
          </>
        )}
      </TabPanel>

      <TabPanel id="outcomes-segments" tabId="segments" active={tab === 'segments'} className="space-y-6">
        {segments && (
          <>
            <Card>
              <CardHeader
                title="Placement rate by course"
                description="Anything at the bottom of this list is a curriculum conversation, not a marketing one."
              />
              <CardBody>
                <BarList
                  max={100}
                  emptyMessage="No course has a graduate on record yet."
                  rows={segments.byCourse.map<BarRow>((row) => ({
                    key: row.key,
                    label: row.title,
                    value: percent(row.placed, row.total),
                    valueLabel: formatPercent(percent(row.placed, row.total)),
                    tone: percent(row.placed, row.total) >= 60 ? 'success' : 'accent',
                    note: `${formatNumber(row.placed)} of ${formatNumber(row.total)} graduates placed`,
                  }))}
                />
              </CardBody>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Placement rate by cohort"
                  description="The eight strongest cohorts on record. Cohort size is on each row, because a rate over three graduates is not a rate."
                />
                <CardBody>
                  <BarList
                    max={100}
                    emptyMessage="No cohort has certified yet."
                    rows={segments.byCohort.slice(0, 8).map<BarRow>((row) => ({
                      key: row.key,
                      label: row.code,
                      value: percent(row.placed, row.total),
                      valueLabel: formatPercent(percent(row.placed, row.total)),
                      note: `${formatNumber(row.placed)} of ${formatNumber(row.total)} graduates placed`,
                    }))}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Placement rate by branch" description="Where the cohort ran." />
                <CardBody>
                  <BarList
                    max={100}
                    emptyMessage="No branch has a graduate on record yet."
                    rows={segments.byBranch.map<BarRow>((row) => ({
                      key: row.key,
                      label: row.name,
                      value: percent(row.placed, row.total),
                      valueLabel: formatPercent(percent(row.placed, row.total)),
                      tone: 'neutral',
                      note: `${formatNumber(row.placed)} of ${formatNumber(row.total)} graduates placed`,
                    }))}
                  />
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </TabPanel>

      <TabPanel id="outcomes-timing" tabId="timing" active={tab === 'timing'} className="space-y-6">
        {timing && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Median time to placement"
                value={timing.medianMonths === null ? 'No placements yet' : `${timing.medianMonths.toFixed(1)} months`}
                icon={Timer}
                caption="Graduation to start date, across everyone placed"
              />
              <StatCard
                label="Response rate"
                value={formatPercent(responseRate)}
                icon={MessageSquareReply}
                caption={`${formatNumber(headline.responded)} of ${formatNumber(headline.checkpointsReached)} checkpoints answered`}
              />
              <StatCard
                label="Income figures volunteered"
                value={formatNumber(timing.volunteeredIncome.length)}
                icon={Info}
                caption="Never asked for, never verified"
              />
              <StatCard
                label="Follow-ups due"
                value={formatNumber(headline.followUpsDue)}
                icon={CalendarClock}
                variant={headline.followUpsDue > 0 ? 'warning' : 'default'}
                onClick={() => navigate('/outcomes/follow-ups')}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Time to placement"
                  description="Months between graduation and the start date, for graduates who were placed."
                />
                <CardBody>
                  <BarList
                    emptyMessage="Nobody has been placed yet."
                    rows={timing.timeBands.map<BarRow>((band) => ({
                      key: band.label,
                      label: band.label,
                      value: band.count,
                      valueLabel: formatNumber(band.count),
                      tone: 'neutral',
                    }))}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Income change"
                  description="Captured only where a graduate volunteered it."
                  actions={<Badge tone="warning">Self-reported</Badge>}
                />
                <CardBody>
                  {timing.volunteeredIncome.length === 0 ? (
                    <EmptyState
                      icon={Info}
                      size="sm"
                      bordered
                      title="No graduate has volunteered an income figure"
                      message="Income is never asked for as a condition of the follow-up. It is recorded only when a graduate offers it, and it is never verified — so it is labelled self-reported wherever it appears."
                    />
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-surface-sunken px-4 py-3">
                          <p className="text-label-11 text-text-label">Median before</p>
                          <p className="mt-1 text-heading-18 tabular-nums text-text">
                            {timing.medianBefore === null ? 'Not volunteered' : formatNaira(timing.medianBefore)}
                          </p>
                        </div>
                        <div className="rounded-xl bg-surface-sunken px-4 py-3">
                          <p className="text-label-11 text-text-label">Median after</p>
                          <p className="mt-1 text-heading-18 tabular-nums text-text">
                            {timing.medianAfter === null ? 'Not volunteered' : formatNaira(timing.medianAfter)}
                          </p>
                        </div>
                      </div>
                      <p className="text-body-13 text-text-secondary">
                        {formatNumber(timing.volunteeredIncome.length)} of {formatNumber(headline.total)}{' '}
                        graduates volunteered a figure. These are unverified numbers given by the graduates
                        themselves and must be labelled self-reported anywhere they are published.
                      </p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </TabPanel>
    </Screen>
  )
}
