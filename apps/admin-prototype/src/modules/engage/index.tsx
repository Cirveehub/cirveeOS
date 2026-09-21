import { Navigate } from 'react-router-dom'
import { Megaphone, MessageSquare, Star, Users } from 'lucide-react'

import { defineModule } from '@/app/module-registry'

import EngageCampaigns from './Campaigns'
import EngageCampaignBuilder from './CampaignBuilder'
import EngageAudiences from './Audiences'
import EngageReviews from './Reviews'
import EngageMessages from './Messages'

export default defineModule({
  id: 'engage',
  label: 'Marketing',
  icon: Megaphone,
  base: '/engage',
  group: 'growth',
  depth: 'shallow',
  summary: 'Campaigns, audiences, reviews and success stories, built on the same Person records as everything else.',
  permission: 'engage.campaign.view.branch',
  routes: [
    { path: '', element: <Navigate to="/engage/campaigns" replace /> },

    { path: 'campaigns', element: <EngageCampaigns view="campaigns" /> },
    { path: 'campaigns/performance', element: <EngageCampaigns view="performance" /> },
    { path: 'campaigns/templates', element: <EngageCampaigns view="templates" /> },
    { path: 'campaigns/new', element: <EngageCampaignBuilder /> },
    { path: 'campaigns/:id/builder', element: <EngageCampaignBuilder /> },
    { path: 'templates', element: <Navigate to="/engage/campaigns/templates" replace /> },

    { path: 'audiences', element: <EngageAudiences /> },
    { path: 'segments', element: <Navigate to="/engage/audiences" replace /> },

    { path: 'reviews', element: <EngageReviews view="requests" /> },
    { path: 'reviews/requests', element: <EngageReviews view="requests" /> },
    { path: 'reviews/testimonials', element: <EngageReviews view="testimonials" /> },
    { path: 'reviews/stories', element: <EngageReviews view="stories" /> },

    { path: 'messages', element: <EngageMessages /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Campaigns', to: 'campaigns', icon: Megaphone },
    { label: 'Audiences', to: 'audiences', icon: Users },
    { label: 'Reviews & stories', to: 'reviews', icon: Star },
    { label: 'Messages', to: 'messages', icon: MessageSquare },
  ],
})
