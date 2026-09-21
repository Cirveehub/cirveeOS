import { TrendingUp } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Graduates from './Graduates'
import OutcomeRecordDetail from './OutcomeRecordDetail'
import Employers from './Employers'
import Placements from './Placements'
import FollowUps from './FollowUps'

export default defineModule({
  id: 'outcomes',
  label: 'Outcomes',
  icon: TrendingUp,
  base: '/outcomes',
  group: 'learning',
  depth: 'shallow',
  summary: 'From learning to employment. Graduate outcome records, employers and placements.',
  permission: 'learn.certificate.view.branch',
  routes: [
    { path: '', element: <Dashboard /> },

    { path: 'graduates', element: <Graduates /> },
    { path: 'records/:id', element: <OutcomeRecordDetail /> },

    { path: 'employers', element: <Employers /> },
    { path: 'placements', element: <Placements /> },
    { path: 'follow-ups', element: <FollowUps /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Graduates', to: 'graduates' },
    { label: 'Placements', to: 'placements' },
    { label: 'Employers', to: 'employers' },
    { label: 'Follow-up queue', to: 'follow-ups' },
  ],
})
