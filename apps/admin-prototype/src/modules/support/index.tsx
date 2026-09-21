import { LifeBuoy } from 'lucide-react'

import { defineModule } from '@/app/module-registry'

import SupportDashboard from './Dashboard'
import SupportTickets from './Tickets'
import SupportSla from './Sla'

export default defineModule({
  id: 'support',
  label: 'Customer experience',
  icon: LifeBuoy,
  base: '/support',
  group: 'operations',
  depth: 'shallow',
  summary: 'Tickets and resolution, with SLA tracking across every inbound channel.',
  permission: 'crm.person.view.branch',
  routes: [
    { path: '', element: <SupportDashboard /> },
    { path: 'tickets', element: <SupportTickets /> },
    { path: 'sla', element: <SupportSla /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Tickets', to: 'tickets' },
    { label: 'SLA report', to: 'sla' },
  ],
})
