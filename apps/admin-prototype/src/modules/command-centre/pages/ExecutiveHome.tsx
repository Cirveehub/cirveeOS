/**
 * Executive Home — `/home` (screen-spec §1.1).
 *
 * The landing point, and the screen that has to make the case in ten seconds
 * that nine apps became one. It used to make that case by showing everything
 * at once — sixteen stat cards across four un-deferred bands plus six more
 * chart panels, all in one scroll, with no `Tabs` anywhere in the module. An
 * information-density audit flagged this as the single worst offender in the
 * app: ~22 individual widgets on the first screen anyone sees.
 *
 * The fix keeps every one of those numbers — nothing here was cut — and
 * changes how many are visible without a click. **Overview** (the tab this
 * page opens on) shows one headline card per PRD question plus the brief and
 * the attention rail: the "ten-second read." Each question then gets its own
 * tab with the full stat band and its charts, for whoever wants to go deeper
 * on exactly one of the four questions rather than all of them at once.
 *
 * Every figure is still a selector call against the live store. Complete
 * Flow 1 in CRM and Finance and the collected-revenue card here moves on its
 * own, because the collections this page subscribes to are the same objects
 * those screens wrote to.
 */

import { Banknote, LayoutGrid, RotateCcw, TrendingUp, Users2, Workflow } from 'lucide-react'

import { LAST_90D } from '@/mocks'
import { Alert, Button, EmptyState, Tabs, TabPanel, type TabItem } from '@/ui'
import { useQueryState } from '@/lib/view-state'

import { AttentionRail } from '../components/AttentionRail'
import { BriefPanel } from '../components/BriefPanel'
import { EnrolmentsByBranchChart } from '../components/EnrolmentsByBranchChart'
import {
  GrowthBand,
  MoneyBand,
  OrganisationBand,
  OverviewHeadlines,
  StudentsBand,
} from '../components/ExecutiveStats'
import { FunnelPanel } from '../components/FunnelPanel'
import { ExecutiveHomeSkeleton } from '../components/HomeSkeleton'
import { HomeHeader } from '../components/HomeHeader'
import { RevenueByUnitChart } from '../components/RevenueByUnitChart'
import { ScopeBar } from '../components/ScopeBar'
import { UnitMarginPanel } from '../components/UnitMarginPanel'
import { useExecutiveLive } from '../lib/live'
import { useScope } from '../lib/scope'
import { useScreenState } from '../lib/screen-state'

const HOME_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'money', label: 'Money', icon: Banknote },
  { id: 'growth', label: 'Growth', icon: TrendingUp },
  { id: 'students', label: 'Students', icon: Users2 },
  { id: 'organisation', label: 'Organisation', icon: Workflow },
]

/**
 * The spec's empty state: "shows 'No data for this period' per card rather
 * than a whole-page empty", because a founder who has just reset the demo
 * still needs to see the shape of the screen.
 */
function NoDataBand({ question }: { question: string }) {
  return (
    <section className="space-y-3" aria-label={question}>
      <h2 className="text-heading-18 text-text">{question}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <EmptyState
            key={index}
            bordered
            size="sm"
            title="No data for this period"
            message="Widen the date range or clear the unit filter."
          />
        ))}
      </div>
    </section>
  )
}

export default function ExecutiveHome() {
  const { units, branches } = useExecutiveLive()
  const scope = useScope(units)
  const { status, retry } = useScreenState('home')
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  return (
    <div className="px-8 py-6">
      <HomeHeader
        active="executive"
        description="Are we making money, are we growing, are students succeeding, is the organisation functioning."
      />

      <div className="mb-6">
        <ScopeBar scope={scope} units={units} />
      </div>

      {status === 'error' && (
        <Alert
          tone="danger"
          title="The command centre could not finish loading"
          className="mb-6"
          action={
            <Button size="sm" variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={retry}>
              Retry
            </Button>
          }
        >
          One or more figures failed to derive. The cards below keep their last known values until the
          load succeeds.
        </Alert>
      )}

      {status === 'loading' ? (
        <ExecutiveHomeSkeleton />
      ) : status === 'empty' ? (
        <div className="space-y-8">
          <Alert tone="info" title="No records in this period">
            The demo data has been reset, or the date range and unit filter together exclude every
            record. Every card keeps its place so the shape of the screen stays readable.
          </Alert>
          <NoDataBand question="Are we making money?" />
          <NoDataBand question="Are we growing?" />
          <NoDataBand question="Are students succeeding?" />
          <NoDataBand question="Is the organisation functioning?" />
        </div>
      ) : (
        <div>
          <Tabs
            tabs={HOME_TABS}
            value={tab}
            onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
            aria-label="Home sections"
            className="mb-6"
          />

          <TabPanel id="panel-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
            <OverviewHeadlines range={scope.range} unitId={scope.unitId} />
            <div className="grid gap-4 xl:grid-cols-3">
              <BriefPanel rangeLabel={scope.rangeLabel} className="xl:col-span-2" />
              <AttentionRail />
            </div>
          </TabPanel>

          <TabPanel id="panel-money" tabId="money" active={tab === 'money'} className="space-y-6">
            <MoneyBand range={scope.range} unitId={scope.unitId} />
            <div className="grid gap-4 xl:grid-cols-3">
              <RevenueByUnitChart units={units} className="xl:col-span-2" />
              <UnitMarginPanel range={scope.range} />
            </div>
          </TabPanel>

          <TabPanel id="panel-growth" tabId="growth" active={tab === 'growth'} className="space-y-6">
            <GrowthBand range={scope.range} unitId={scope.unitId} />
            <div className="grid gap-4 xl:grid-cols-3">
              <EnrolmentsByBranchChart branches={branches} className="xl:col-span-2" />
              <FunnelPanel range={LAST_90D} unitId={scope.unitId} />
            </div>
          </TabPanel>

          <TabPanel id="panel-students" tabId="students" active={tab === 'students'}>
            <StudentsBand range={scope.range} unitId={scope.unitId} />
          </TabPanel>

          <TabPanel id="panel-organisation" tabId="organisation" active={tab === 'organisation'}>
            <OrganisationBand range={scope.range} unitId={scope.unitId} />
          </TabPanel>
        </div>
      )}
    </div>
  )
}
