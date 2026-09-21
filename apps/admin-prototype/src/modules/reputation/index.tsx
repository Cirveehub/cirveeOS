import { Star } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Requests from './Requests'
import Testimonials from './Testimonials'
import ProofQueue from './ProofQueue'

export default defineModule({
  id: 'reputation',
  label: 'Reputation',
  icon: Star,
  base: '/reputation',
  group: 'growth',
  depth: 'shallow',
  summary: 'Review capture at high-satisfaction moments, testimonials and the proof queue.',
  permission: 'engage.campaign.view.branch',
  routes: [
    { path: '', element: <Dashboard /> },
    { path: 'requests', element: <Requests /> },
    { path: 'testimonials', element: <Testimonials /> },
    { path: 'proof', element: <ProofQueue /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Review requests', to: 'requests' },
    { label: 'Testimonials', to: 'testimonials' },
    { label: 'Proof queue', to: 'proof' },
  ],
})
