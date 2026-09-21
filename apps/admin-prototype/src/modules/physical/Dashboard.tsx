import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CreditCard,
  DoorOpen,
  Radio,
  ShieldOff,
  UserCheck,
  WifiOff,
  Package,
  PlusCircle,
  MinusCircle,
} from 'lucide-react'

import { formatNumber, humanize } from '@/lib/format'
import {
  Alert,
  Button,
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
  addDays,
  cardsCollection,
  companyAssetsCollection,
  readersCollection,
  tapEventsCollection,
  useCollection,
  visitorsCollection,
  type Card as AccessCard,
  type Reader,
  type TapEvent,
  type Visitor,
} from '@/mocks'

import { BarList, DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, useModuleData, type BarRow } from './parts'

function headlineBand(cards: AccessCard[], readers: Reader[], taps: TapEvent[], visitors: Visitor[]) {
  const tapsToday = taps.filter((t) => t.at.slice(0, 10) === TODAY)
  const mostRecentDay = taps.reduce((latest, t) => (t.at > latest ? t.at : latest), '').slice(0, 10)
  const tapsMostRecentDay = taps.filter((t) => t.at.slice(0, 10) === mostRecentDay)

  return {
    activeCards: cards.filter((c) => c.status === 'active').length,
    readersOnline: readers.filter((r) => r.status === 'online').length,
    readersTotal: readers.length,
    readersBuffering: readers.filter((r) => r.status === 'buffering' || r.status === 'offline').length,
    bufferedEvents: readers.reduce((acc, r) => acc + r.bufferedEventCount, 0),
    tapsToday: tapsToday.length,
    tapsMostRecentDay: tapsMostRecentDay.length,
    mostRecentDay,
    deniedToday: tapsToday.filter((t) => t.result === 'denied').length,
    deniedMostRecentDay: tapsMostRecentDay.filter((t) => t.result === 'denied').length,
    visitorsOnSite: visitors.filter((v) => v.checkedOutAt === null).length,
    visitorsToday: visitors.filter((v) => v.checkedInAt.slice(0, 10) === TODAY).length,
  }
}

function cardsBand(cards: AccessCard[], assetsOnLoan: number) {
  const thirtyDaysAgo = addDays(TODAY, -30)
  return {
    issued30d: cards.filter((c) => c.issuedAt >= thirtyDaysAgo).length,
    deactivated30d: cards.filter(
      (c) => c.deactivatedAt !== null && c.deactivatedAt.slice(0, 10) >= thirtyDaysAgo,
    ).length,
    lost: cards.filter((c) => c.status === 'lost').length,
    replaced: cards.filter((c) => c.replacedByCardId !== null).length,
    assetsOnLoan,
    byStatus: (['active', 'suspended', 'lost', 'deactivated', 'replaced'] as const)
      .map((status) => ({ status, count: cards.filter((c) => c.status === status).length }))
      .filter((row) => row.count > 0),
  }
}

function trafficBand(taps: TapEvent[], readers: Reader[]) {
  const byHour = new Map<number, number>()
  const byReader = new Map<string, number>()
  for (const t of taps) {
    byHour.set(Number(t.at.slice(11, 13)), (byHour.get(Number(t.at.slice(11, 13))) ?? 0) + 1)
    byReader.set(t.readerId as string, (byReader.get(t.readerId as string) ?? 0) + 1)
  }

  return {
    byHour: [...byHour.entries()]
      .sort((a, b) => a[0] - b[0])
      .map<BarRow>(([hour, count]) => ({
        key: String(hour),
        label: `${String(hour).padStart(2, '0')}:00`,
        value: count,
        valueLabel: formatNumber(count),
        tone: 'accent',
      })),
    byReader: [...byReader.entries()]
      .sort((a, b) => b[1] - a[1])
      .map<BarRow>(([readerId, count]) => {
        const reader = readers.find((r) => (r.id as string) === readerId)
        return {
          key: readerId,
          label: reader?.name ?? readerId,
          value: count,
          valueLabel: formatNumber(count),
          tone: reader?.status === 'online' ? 'accent' : 'warning',
          note: reader ? `${reader.readerId} · ${humanize(reader.status)}` : undefined,
        }
      }),
  }
}

function accessBand(taps: TapEvent[]) {
  const byReason = new Map<string, number>()
  for (const t of taps) {
    if (t.result !== 'denied' || !t.denialReason) continue
    byReason.set(t.denialReason, (byReason.get(t.denialReason) ?? 0) + 1)
  }

  return {
    denied: taps.filter((t) => t.result === 'denied').length,
    overrides: taps.filter((t) => t.overrideByUserId !== null).length,
    buffered: taps.filter((t) => t.wasBuffered).length,
    byReason: [...byReason.entries()]
      .sort((a, b) => b[1] - a[1])
      .map<BarRow>(([reason, count]) => ({
        key: reason,
        label: humanize(reason),
        value: count,
        valueLabel: formatNumber(count),
        tone: 'danger',
      })),
  }
}

export default function PhysicalDashboard() {
  const cards = useCollection(cardsCollection)
  const readers = useCollection(readersCollection)
  const taps = useCollection(tapEventsCollection)
  const visitors = useCollection(visitorsCollection)
  const assets = useCollection(companyAssetsCollection)

  const { loading, error, rows, retry } = useModuleData(readers, 'physical.dashboard')
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  const headline = useMemo(() => headlineBand(cards, rows, taps, visitors), [cards, rows, taps, visitors])
  const cardsView = useMemo(
    () => (tab === 'cards' ? cardsBand(cards, assets.filter((a) => a.status === 'assigned').length) : null),
    [cards, assets, tab],
  )
  const traffic = useMemo(() => (tab === 'traffic' ? trafficBand(taps, rows) : null), [taps, rows, tab])
  const access = useMemo(() => (tab === 'access' ? accessBand(taps) : null), [taps, tab])

  const buffering = rows.filter((r) => r.bufferedEventCount > 0)

  return (
    <Screen>
      <ModuleHeader
        title="Physical layer"
        description="Cards, readers and taps. An operations and attendance system, not a security system."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/physical/kiosk">Open the kiosk</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorPanel what="The physical layer dashboard" onRetry={retry} />
      ) : loading ? (
        <DashboardSkeleton />
      ) : rows.length === 0 && cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No cards or readers yet"
          message="The physical layer records who was where and when. Until a reader is installed and a card issued, there is nothing to record."
          action={
            <Button size="sm" asChild>
              <Link to="/physical/cards">Issue the first card</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {buffering.length > 0 && (
            <Alert tone="warning" icon={WifiOff} title="Readers are buffering">
              {buffering.map((r) => `${r.readerId} holds ${formatNumber(r.bufferedEventCount)} events`).join('; ')}.
              A reader that loses its connection keeps accepting taps and stores them locally; they sync on
              reconnect and arrive with their original timestamp, not the time they reached the server.
              Attendance is never lost because the network was.
            </Alert>
          )}

          <Tabs
            aria-label="Dashboard sections"
            value={tab}
            onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'cards', label: 'Cards' },
              { id: 'traffic', label: 'Traffic' },
              { id: 'access', label: 'Denials and overrides' },
            ]}
          />

          <TabPanel id="phy-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Active cards"
                value={formatNumber(headline.activeCards)}
                icon={CreditCard}
                caption="Every issue and deactivation is audited"
              />
              <StatCard
                label="Readers online"
                value={`${formatNumber(headline.readersOnline)}/${formatNumber(headline.readersTotal)}`}
                icon={Radio}
                variant={headline.readersOnline === headline.readersTotal ? 'success' : 'warning'}
                caption={
                  headline.readersBuffering > 0
                    ? `${formatNumber(headline.bufferedEvents)} events waiting to sync`
                    : 'Every reader is reporting'
                }
              />
              <StatCard
                label="Taps today"
                value={formatNumber(headline.tapsToday)}
                icon={DoorOpen}
                caption={
                  headline.tapsToday === 0 && headline.mostRecentDay
                    ? `${formatNumber(headline.tapsMostRecentDay)} on ${headline.mostRecentDay}, the last day with traffic`
                    : `${formatNumber(headline.deniedToday)} denied`
                }
              />
              <StatCard
                label="Visitors on site"
                value={formatNumber(headline.visitorsOnSite)}
                icon={UserCheck}
                caption={`${formatNumber(headline.visitorsToday)} signed in today`}
              />
            </div>
          </TabPanel>

          <TabPanel id="phy-cards" tabId="cards" active={tab === 'cards'} className="space-y-6">
            {cardsView && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Issued, 30 days"
                    value={formatNumber(cardsView.issued30d)}
                    icon={PlusCircle}
                    caption="Each issue is an audit event"
                  />
                  <StatCard
                    label="Deactivated, 30 days"
                    value={formatNumber(cardsView.deactivated30d)}
                    icon={MinusCircle}
                    caption="Each deactivation needs a reason"
                  />
                  <StatCard
                    label="Reported lost"
                    value={formatNumber(cardsView.lost)}
                    icon={ShieldOff}
                    variant={cardsView.lost > 0 ? 'warning' : 'default'}
                    caption={`${formatNumber(cardsView.replaced)} cards have been replaced`}
                  />
                  <StatCard label="Assets on loan" value={formatNumber(cardsView.assetsOnLoan)} icon={Package} />
                </div>

                <Card padding="none">
                  <CardHeader
                    title="Cards by status"
                    description="Nothing is deleted — a lost card keeps its history and points at its replacement."
                    actions={
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/physical/cards">Open the card list</Link>
                      </Button>
                    }
                  />
                  <CardBody>
                    <BarList
                      emptyMessage="No cards issued."
                      rows={cardsView.byStatus.map<BarRow>((row) => ({
                        key: row.status,
                        label: humanize(row.status),
                        value: row.count,
                        valueLabel: formatNumber(row.count),
                        tone:
                          row.status === 'active'
                            ? 'success'
                            : row.status === 'lost'
                              ? 'danger'
                              : 'neutral',
                      }))}
                    />
                  </CardBody>
                </Card>
              </>
            )}
          </TabPanel>

          <TabPanel id="phy-traffic" tabId="traffic" active={tab === 'traffic'} className="space-y-6">
            {traffic && (
              <div className="grid gap-4 lg:grid-cols-2">
                <Card padding="none">
                  <CardHeader
                    title="Taps by hour"
                    description="The daily rhythm of the building, across every day in the log."
                  />
                  <CardBody>
                    <BarList rows={traffic.byHour} emptyMessage="No taps recorded." />
                  </CardBody>
                </Card>

                <Card padding="none">
                  <CardHeader
                    title="Taps by reader"
                    description="Which doors people actually use."
                    actions={
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/physical/taps">Open the tap log</Link>
                      </Button>
                    }
                  />
                  <CardBody>
                    <BarList rows={traffic.byReader} emptyMessage="No taps recorded." />
                  </CardBody>
                </Card>
              </div>
            )}
          </TabPanel>

          <TabPanel id="phy-access" tabId="access" active={tab === 'access'} className="space-y-6">
            {access && (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <StatCard
                    label="Denied, all time"
                    value={formatNumber(access.denied)}
                    icon={ShieldOff}
                    variant={access.denied > 0 ? 'warning' : 'default'}
                    caption="Almost always an operational fact"
                  />
                  <StatCard
                    label="Denied today"
                    value={formatNumber(headline.deniedToday)}
                    icon={ShieldOff}
                    caption={
                      headline.tapsToday === 0 && headline.mostRecentDay
                        ? `${formatNumber(headline.deniedMostRecentDay)} on ${headline.mostRecentDay}`
                        : undefined
                    }
                  />
                  <StatCard
                    label="Manual overrides"
                    value={formatNumber(access.overrides)}
                    icon={ShieldOff}
                    caption="All logged with a reason and an actor"
                  />
                  <StatCard
                    label="Buffered then synced"
                    value={formatNumber(access.buffered)}
                    icon={WifiOff}
                    caption="Taps taken while a reader was offline"
                  />
                </div>

                <Card padding="none">
                  <CardHeader
                    title="Denials by reason"
                    description="Almost every denial is an operational fact, not an intrusion attempt."
                    actions={
                      <Button variant="secondary" size="sm" asChild>
                        <Link to="/physical/taps?result=denied">See the denied taps</Link>
                      </Button>
                    }
                  />
                  <CardBody>
                    <BarList
                      rows={access.byReason}
                      emptyMessage="No tap has been denied. Nothing here needs attention."
                    />
                  </CardBody>
                </Card>
              </>
            )}
          </TabPanel>
        </div>
      )}
    </Screen>
  )
}
