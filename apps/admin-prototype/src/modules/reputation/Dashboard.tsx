/**
 * Reputation dashboard.
 *
 * Every figure is derived from the review request, testimonial and proof asset
 * collections. The compliance note at the top is permanent and is the rule the
 * whole module is built around: a request is a well-timed ask, never a trade.
 *
 * It used to render eight stat cards and six panels in one scroll. The four
 * numbers anyone quotes plus the trigger funnel are now the Overview; the
 * review detail and the testimonial/proof pipelines each get a tab, with the
 * tab in the query string so a view is a link.
 */
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BadgeCheck,
  Image,
  MessageSquareQuote,
  Send,
  ShieldAlert,
  ShieldCheck,
  Star,
  Target,
  Upload,
} from 'lucide-react'

import { formatNumber, formatPercent } from '@/lib/format'
import { Alert, Card, CardBody, CardHeader, EmptyState, StatCard, TabPanel, Tabs } from '@/ui'
import { useQueryState } from '@/lib/view-state'
import {
  TODAY,
  proofAssetsCollection,
  reviewRequestsCollection,
  testimonialsCollection,
  useCollection,
} from '@/mocks'

import {
  BarList,
  CHANNEL_LABEL,
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  PROOF_STATUS_LABEL,
  REVIEW_COMPLIANCE_NOTE,
  Screen,
  TESTIMONIAL_STATUS_LABEL,
  TRIGGER_LABEL,
  TRIGGER_ORDER,
  average,
  isWithin30Days,
  monthLabel,
  percent,
  recentMonths,
  useModuleData,
  type BarRow,
} from './parts'
import type { ProofAsset, ReviewRequest, Testimonial } from '@/mocks'

const PROOF_STATUSES: ProofAsset['status'][] = [
  'drafted',
  'in_production',
  'approved',
  'published',
  'discarded',
]

const TESTIMONIAL_STATUSES: Testimonial['status'][] = ['new', 'approved', 'published', 'archived']

/* -------------------------------------------------------------------------- */
/* Bands — one function per theme                                             */
/* -------------------------------------------------------------------------- */

function headlineBand(requests: ReviewRequest[]) {
  const reviewed = requests.filter((r) => r.reviewed)
  const ratings = reviewed.map((r) => r.rating).filter((rating): rating is number => rating !== null)
  const sent30d = requests.filter((r) => isWithin30Days(r.sentAt))

  return {
    sent: requests.length,
    reviewed: reviewed.length,
    ratings,
    averageRating: average(ratings),
    sent30d: sent30d.length,
    reviewed30d: sent30d.filter((r) => r.reviewed).length,
  }
}

/** The funnel is on the Overview because it is the one chart that changes behaviour. */
function funnelBand(requests: ReviewRequest[]) {
  return TRIGGER_ORDER.map((trigger) => {
    const mine = requests.filter((r) => r.triggerMoment === trigger)
    return {
      trigger,
      sent: mine.length,
      opened: mine.filter((r) => r.openedAt !== null).length,
      clicked: mine.filter((r) => r.clickedAt !== null).length,
      reviewed: mine.filter((r) => r.reviewed).length,
    }
  }).filter((row) => row.sent > 0)
}

function reviewDetailBand(requests: ReviewRequest[]) {
  const ratings = requests
    .filter((r) => r.reviewed)
    .map((r) => r.rating)
    .filter((rating): rating is number => rating !== null)

  const months = recentMonths(6).map((month) => {
    const mine = requests.filter((r) => r.sentAt.slice(0, 7) === month.key)
    const monthReviews = mine.filter((r) => r.reviewed)
    const monthRatings = monthReviews
      .map((r) => r.rating)
      .filter((rating): rating is number => rating !== null)
    return { ...month, sent: mine.length, reviews: monthReviews.length, rating: average(monthRatings) }
  })

  const byChannel = (['whatsapp', 'email', 'sms', 'in_app'] as const)
    .map((channel) => {
      const mine = requests.filter((r) => r.channel === channel)
      return { channel, sent: mine.length, reviewed: mine.filter((r) => r.reviewed).length }
    })
    .filter((row) => row.sent > 0)

  return {
    ratings,
    months,
    byChannel,
    opened: requests.filter((r) => r.openedAt !== null).length,
    clicked: requests.filter((r) => r.clickedAt !== null).length,
    ratingSpread: [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: ratings.filter((rating) => Math.round(rating) === star).length,
    })),
  }
}

function proofBand(testimonials: Testimonial[], proofAssets: ProofAsset[]) {
  return {
    testimonials: testimonials.length,
    testimonialsConsented: testimonials.filter((t) => t.consentGranted).length,
    testimonialsByStatus: TESTIMONIAL_STATUSES.map((status) => ({
      status,
      count: testimonials.filter((t) => t.status === status).length,
    })),
    proofDrafted: proofAssets.filter((p) => p.status === 'drafted').length,
    proofPublished: proofAssets.filter((p) => p.status === 'published').length,
    proofByStatus: PROOF_STATUSES.map((status) => ({
      status,
      count: proofAssets.filter((p) => p.status === status).length,
    })),
    proofPendingConsent: proofAssets.filter((p) => p.consentStatus === 'pending').length,
  }
}

/* -------------------------------------------------------------------------- */

export default function Dashboard() {
  const navigate = useNavigate()
  const query = useQueryState()
  const tab = query.get('tab') ?? 'overview'

  const allRequests = useCollection(reviewRequestsCollection)
  const testimonials = useCollection(testimonialsCollection)
  const proofAssets = useCollection(proofAssetsCollection)

  const { loading, error, rows: requests, retry } = useModuleData(allRequests, 'reputation.dashboard')

  const headline = useMemo(() => headlineBand(requests), [requests])
  const funnel = useMemo(() => (tab === 'overview' ? funnelBand(requests) : null), [requests, tab])
  const detail = useMemo(() => (tab === 'reviews' ? reviewDetailBand(requests) : null), [requests, tab])
  const proof = useMemo(
    () => (tab === 'proof' ? proofBand(testimonials, proofAssets) : null),
    [testimonials, proofAssets, tab],
  )

  const header = (
    <ModuleHeader
      title="Reputation"
      description="Reviews, testimonials and proof — asked for at the moments people are already happy."
    />
  )

  const compliance = (
    <Alert tone="warning" icon={ShieldAlert} title="Never incentivise a review">
      {REVIEW_COMPLIANCE_NOTE} Offering anything of value in exchange for a Google review breaches
      Google&apos;s policy and puts the listing itself at risk. Every request in this module is a
      well-timed ask attached to an event that already went well — nothing is traded for it.
    </Alert>
  )

  if (error) {
    return (
      <Screen>
        {header}
        {compliance}
        <div className="mt-6">
          <ErrorPanel onRetry={retry} what="Review requests" />
        </div>
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        {header}
        {compliance}
        <div className="mt-6">
          <DashboardSkeleton />
        </div>
      </Screen>
    )
  }

  if (headline.sent === 0) {
    return (
      <Screen>
        {header}
        {compliance}
        <div className="mt-6">
          <EmptyState
            icon={Star}
            title="No review requests sent yet"
            message="A request fires on a high-satisfaction moment — a certificate issued, a strong grade returned, a placement confirmed. Until one of those happens there is nothing to ask about, and asking anyway is how a listing collects two-star reviews."
          />
        </div>
      </Screen>
    )
  }

  const conversion = percent(headline.reviewed, headline.sent)

  return (
    <Screen>
      {header}
      {compliance}

      <Tabs
        aria-label="Dashboard sections"
        className="mt-6 mb-6"
        value={tab}
        onChange={(id) => query.set('tab', id === 'overview' ? undefined : id)}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'reviews', label: 'Review detail' },
          { id: 'proof', label: 'Testimonials and proof' },
        ]}
      />

      <TabPanel id="rep-overview" tabId="overview" active={tab === 'overview'} className="space-y-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Average rating"
            value={headline.averageRating === null ? 'No ratings yet' : `${headline.averageRating.toFixed(1)} of 5`}
            icon={Star}
            variant={(headline.averageRating ?? 0) >= 4.5 ? 'success' : 'default'}
            caption={`Across ${formatNumber(headline.ratings.length)} rated reviews`}
          />
          <StatCard
            label="Reviews left"
            value={formatNumber(headline.reviewed)}
            icon={BadgeCheck}
            caption={`${formatNumber(headline.reviewed30d)} in the last 30 days`}
            onClick={() => navigate('/reputation/requests?outcome=reviewed')}
          />
          <StatCard
            label="Conversion to review"
            value={formatPercent(conversion)}
            icon={Target}
            variant={conversion >= 20 ? 'success' : 'default'}
            caption={`${formatNumber(headline.reviewed)} of ${formatNumber(headline.sent)} requests`}
          />
          <StatCard
            label="Requests sent, 30 days"
            value={formatNumber(headline.sent30d)}
            icon={Send}
            caption="Each one attached to a real event"
            onClick={() => navigate('/reputation/requests')}
          />
        </div>

        {funnel && (
          <Card>
            <CardHeader
              title="Request to review, by trigger moment"
              description="Which moments actually produce reviews. A moment that converts badly is a moment we should stop asking at, not one to push harder."
            />
            <CardBody>
              <BarList
                max={Math.max(1, ...funnel.map((row) => row.sent))}
                emptyMessage="No request has fired from any trigger moment yet."
                rows={funnel.flatMap<BarRow>((row) => [
                  {
                    key: `${row.trigger}-sent`,
                    label: <span className="font-semibold">{TRIGGER_LABEL[row.trigger]}</span>,
                    value: row.sent,
                    valueLabel: `${formatNumber(row.sent)} sent`,
                    tone: 'neutral',
                  },
                  {
                    key: `${row.trigger}-opened`,
                    label: 'Opened',
                    value: row.opened,
                    valueLabel: `${formatNumber(row.opened)} · ${formatPercent(percent(row.opened, row.sent))}`,
                    tone: 'accent',
                  },
                  {
                    key: `${row.trigger}-clicked`,
                    label: 'Clicked through',
                    value: row.clicked,
                    valueLabel: `${formatNumber(row.clicked)} · ${formatPercent(percent(row.clicked, row.sent))}`,
                    tone: 'accent',
                  },
                  {
                    key: `${row.trigger}-reviewed`,
                    label: 'Left a review',
                    value: row.reviewed,
                    valueLabel: `${formatNumber(row.reviewed)} · ${formatPercent(percent(row.reviewed, row.sent))}`,
                    tone: 'success',
                    note: `Conversion from this moment: ${formatPercent(percent(row.reviewed, row.sent))}`,
                  },
                ])}
              />
            </CardBody>
          </Card>
        )}
      </TabPanel>

      <TabPanel id="rep-reviews" tabId="reviews" active={tab === 'reviews'} className="space-y-6">
        {detail && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Requests sent"
                value={formatNumber(headline.sent)}
                icon={Send}
                onClick={() => navigate('/reputation/requests')}
              />
              <StatCard
                label="Opened"
                value={formatPercent(percent(detail.opened, headline.sent))}
                icon={Send}
                caption={`${formatNumber(detail.opened)} of ${formatNumber(headline.sent)} requests`}
              />
              <StatCard
                label="Clicked through"
                value={formatPercent(percent(detail.clicked, headline.sent))}
                icon={Target}
                caption={`${formatNumber(detail.clicked)} reached the review page`}
              />
              <StatCard
                label="Ratings attributable"
                value={formatNumber(detail.ratings.length)}
                icon={Star}
                caption="Where a posted review matched back to a request"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader
                  title="Review volume by month"
                  description={`Reviews left against requests sent, over the last six months, ending ${detail.months[detail.months.length - 1]?.label ?? monthLabel(TODAY)}.`}
                />
                <CardBody>
                  <BarList
                    max={Math.max(1, ...detail.months.map((m) => m.sent))}
                    emptyMessage="No requests in the last six months."
                    rows={detail.months.map<BarRow>((month) => ({
                      key: month.key,
                      label: month.label,
                      value: month.reviews,
                      valueLabel: `${formatNumber(month.reviews)} of ${formatNumber(month.sent)}`,
                      tone: 'success',
                      note:
                        month.rating === null
                          ? 'No rating recorded this month'
                          : `Average rating ${month.rating.toFixed(1)} of 5`,
                    }))}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader
                  title="Rating spread"
                  description="Every rating we can attribute to a request. A thin tail below four stars is what a well-timed ask buys."
                />
                <CardBody>
                  {detail.ratings.length === 0 ? (
                    <EmptyState
                      icon={Star}
                      size="sm"
                      bordered
                      title="No ratings recorded"
                      message="A rating is only known when the reviewer's post can be matched back to the request. Requests that converted anonymously still count as reviews, just without a star."
                    />
                  ) : (
                    <BarList
                      rows={detail.ratingSpread.map<BarRow>((row) => ({
                        key: String(row.star),
                        label: `${row.star} star`,
                        value: row.count,
                        valueLabel: formatNumber(row.count),
                        tone: row.star >= 4 ? 'success' : row.star === 3 ? 'warning' : 'danger',
                      }))}
                    />
                  )}
                </CardBody>
              </Card>
            </div>

            <Card>
              <CardHeader title="Conversion by channel" description="Where the ask lands best." />
              <CardBody>
                <BarList
                  max={100}
                  emptyMessage="No requests sent on any channel."
                  rows={detail.byChannel.map<BarRow>((row) => ({
                    key: row.channel,
                    label: CHANNEL_LABEL[row.channel],
                    value: percent(row.reviewed, row.sent),
                    valueLabel: formatPercent(percent(row.reviewed, row.sent)),
                    tone: 'accent',
                    note: `${formatNumber(row.reviewed)} reviews from ${formatNumber(row.sent)} requests`,
                  }))}
                />
              </CardBody>
            </Card>
          </>
        )}
      </TabPanel>

      <TabPanel id="rep-proof" tabId="proof" active={tab === 'proof'} className="space-y-6">
        {proof && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                label="Testimonials captured"
                value={formatNumber(proof.testimonials)}
                icon={MessageSquareQuote}
                caption={`${formatNumber(proof.testimonialsConsented)} with consent on file`}
                onClick={() => navigate('/reputation/testimonials')}
              />
              <StatCard
                label="Publishable testimonials"
                value={formatNumber(proof.testimonialsConsented)}
                icon={ShieldCheck}
                caption="The rest are kept but may not be quoted"
              />
              <StatCard
                label="Proof assets drafted"
                value={formatNumber(proof.proofDrafted)}
                icon={Image}
                variant={proof.proofDrafted > 0 ? 'warning' : 'default'}
                caption="Auto-drafted, waiting on someone"
                onClick={() => navigate('/reputation/proof?status=drafted')}
              />
              <StatCard
                label="Proof assets published"
                value={formatNumber(proof.proofPublished)}
                icon={Upload}
                caption={`${formatNumber(proof.proofPendingConsent)} more are blocked on consent`}
                onClick={() => navigate('/reputation/proof')}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader title="Testimonials" description="Captured in conversation, never traded for." />
                <CardBody>
                  <BarList
                    emptyMessage="No testimonials captured yet."
                    rows={proof.testimonialsByStatus.map<BarRow>((row) => ({
                      key: row.status,
                      label: TESTIMONIAL_STATUS_LABEL[row.status],
                      value: row.count,
                      valueLabel: formatNumber(row.count),
                      tone: row.status === 'published' ? 'success' : 'accent',
                    }))}
                  />
                </CardBody>
              </Card>

              <Card>
                <CardHeader title="Proof queue" description="Drafted automatically off real events." />
                <CardBody>
                  <BarList
                    emptyMessage="Nothing in the proof queue."
                    rows={proof.proofByStatus.map<BarRow>((row) => ({
                      key: row.status,
                      label: PROOF_STATUS_LABEL[row.status],
                      value: row.count,
                      valueLabel: formatNumber(row.count),
                      tone:
                        row.status === 'published'
                          ? 'success'
                          : row.status === 'discarded'
                            ? 'neutral'
                            : 'accent',
                    }))}
                  />
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </TabPanel>
    </Screen>
  )
}
