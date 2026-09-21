import { useNavigate } from 'react-router-dom'

import { Tabs, type TabItem } from '@/ui'
import { proofAssetsCollection, useCollection } from '@/mocks'

import { ModuleHeader, Screen } from './parts'
import Requests from './reviews/Requests'
import Testimonials from './reviews/Testimonials'
import Stories from './reviews/Stories'

export type ReviewsView = 'requests' | 'testimonials' | 'stories'

export default function EngageReviews({ view }: { view: ReviewsView }) {
  const navigate = useNavigate()
  const stories = useCollection(proofAssetsCollection)
  const toMake = stories.filter((s) => s.status === 'drafted').length

  const tabs: TabItem[] = [
    { id: 'requests', label: 'Ask for a review' },
    { id: 'testimonials', label: 'Testimonials' },
    { id: 'stories', label: 'Stories to make', badge: toMake > 0 ? toMake : undefined },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Reviews & stories"
        description="Turn happy students into visible proof: a Google review, a quote we can use, a story worth posting."
      />

      <Tabs
        tabs={tabs}
        value={view}
        onChange={(id) => navigate(`/engage/reviews/${id}`)}
        size="sm"
        aria-label="Reviews and stories sections"
        className="mb-6"
      />

      {view === 'requests' && <Requests />}
      {view === 'testimonials' && <Testimonials />}
      {view === 'stories' && <Stories />}
    </Screen>
  )
}
