import { Send } from 'lucide-react'

import { defineModule } from '@/app/module-registry'

import EngageDashboard from './Dashboard'
import EngageSegments from './Segments'
import EngageCampaigns from './Campaigns'
import EngageCampaignBuilder from './CampaignBuilder'
import EngageTemplates from './Templates'
import EngageMessages from './Messages'

export default defineModule({
  id: 'engage',
  label: 'Engage',
  icon: Send,
  base: '/engage',
  group: 'growth',
  depth: 'shallow',
  summary: 'Segments, campaigns and journeys, built on the same Person records as everything else.',
  permission: 'engage.campaign.view.branch',
  routes: [
    { path: '', element: <EngageDashboard /> },
    { path: 'segments', element: <EngageSegments /> },
    { path: 'campaigns', element: <EngageCampaigns /> },
    { path: 'campaigns/new', element: <EngageCampaignBuilder /> },
    { path: 'campaigns/:id/builder', element: <EngageCampaignBuilder /> },
    { path: 'templates', element: <EngageTemplates /> },
    { path: 'messages', element: <EngageMessages /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Segments', to: 'segments' },
    { label: 'Campaigns', to: 'campaigns' },
    { label: 'Templates', to: 'templates' },
    { label: 'Message history', to: 'messages' },
  ],
})
