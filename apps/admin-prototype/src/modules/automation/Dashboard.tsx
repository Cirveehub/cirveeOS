import { useNavigate } from 'react-router-dom'
import { Activity, AlertTriangle, LayoutGrid, Plus, ShieldCheck, Workflow } from 'lucide-react'

import { automationsCollection, automationHealth, useCollection } from '@/mocks'
import { Alert, Button, Card, EmptyState, Tabs, TabPanel, type TabItem } from '@/ui'
import { useQueryState } from '@/lib/view-state'

import { LoadFailed, ModulePage, Screen, useScreenState } from './parts'
import {
  FailureReasonsChart,
  FleetBand,
  OverviewHeadlines,
  ReliabilityBand,
  RunOutcomesChart,
  RunsBand,
  RunsOverTimeChart,
  TopAutomationsChart,
  TriggerMixChart,
} from './dashboard-bands'

const DASHBOARD_TABS: TabItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'fleet', label: 'Fleet', icon: Workflow },
  { id: 'runs', label: 'Runs', icon: Activity },
  { id: 'reliability', label: 'Reliability', icon: ShieldCheck },
]

export default function Dashboard() {
  const automations = useCollection(automationsCollection)
  const navigate = useNavigate()
  const { loading, errored, forcedEmpty, retry } = useScreenState('automation:dashboard')
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  const health = automationHealth()

  if (errored) {
    return (
      <>
        <ModulePage tab="dashboard" title="Automation" />
        <Screen>
          <LoadFailed what="The automation dashboard" onRetry={retry} />
        </Screen>
      </>
    )
  }

  if (forcedEmpty || automations.length === 0) {
    return (
      <>
        <ModulePage tab="dashboard" title="Automation" />
        <Screen>
          <Card>
            <EmptyState
              icon={Workflow}
              title="No automations yet"
              message="Nothing happens on its own until one exists. Receipts, commission calculations, LMS access and card issuing would all be done by hand."
              action={
                <Button onClick={() => navigate('/automation/workflows/new')} leftIcon={<Plus size={16} />}>
                  New automation
                </Button>
              }
              bordered={false}
            />
          </Card>
        </Screen>
      </>
    )
  }

  return (
    <>
      <ModulePage
        tab="dashboard"
        title="Automation"
        description="Trigger, condition, action — with delays, branches, run history and a failure queue."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/automation/exceptions')}
              leftIcon={<AlertTriangle size={16} />}
            >
              Exception queue
            </Button>
            <Button onClick={() => navigate('/automation/workflows/new')} leftIcon={<Plus size={16} />}>
              New automation
            </Button>
          </div>
        }
      />

      <Screen>
        <div className="flex flex-col gap-6">
          {health.exceptionsOpen > 0 && (
            <Alert
              tone="warning"
              title={`${health.exceptionsOpen} exception(s) are waiting on a person`}
              action={
                <Button size="sm" variant="secondary" onClick={() => navigate('/automation/exceptions')}>
                  Open the queue
                </Button>
              }
            >
              These are the failures the retry policy could not fix. Until someone clears them, the work they
              represent has not happened.
            </Alert>
          )}

          <div>
            <Tabs
              tabs={DASHBOARD_TABS}
              value={tab}
              onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
              aria-label="Automation dashboard sections"
              className="mb-6"
            />

            <TabPanel
              id="panel-automation-overview"
              tabId="overview"
              active={tab === 'overview'}
              className="flex flex-col gap-6"
            >
              <OverviewHeadlines loading={loading} />
              <RunsOverTimeChart loading={loading} />
            </TabPanel>

            <TabPanel
              id="panel-automation-fleet"
              tabId="fleet"
              active={tab === 'fleet'}
              className="flex flex-col gap-6"
            >
              <FleetBand loading={loading} />
              <TriggerMixChart loading={loading} />
            </TabPanel>

            <TabPanel
              id="panel-automation-runs"
              tabId="runs"
              active={tab === 'runs'}
              className="flex flex-col gap-6"
            >
              <RunsBand loading={loading} />
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <TopAutomationsChart loading={loading} />
                <RunOutcomesChart loading={loading} />
              </div>
            </TabPanel>

            <TabPanel
              id="panel-automation-reliability"
              tabId="reliability"
              active={tab === 'reliability'}
              className="flex flex-col gap-6"
            >
              <ReliabilityBand loading={loading} />
              <FailureReasonsChart loading={loading} />
            </TabPanel>
          </div>
        </div>
      </Screen>
    </>
  )
}
