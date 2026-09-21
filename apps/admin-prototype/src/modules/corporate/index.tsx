import { Building2, Handshake, Users } from 'lucide-react'

import { defineModule } from '@/app/module-registry'

import CorporateOrganisations from './Organisations'
import CorporateDeals from './Deals'
import CorporateParticipants from './Participants'

export default defineModule({
  id: 'corporate',
  label: 'Corporate',
  icon: Building2,
  base: '/corporate',
  group: 'growth',
  depth: 'shallow',
  summary: 'B2B training contracts, invoiced to the organisation and delivered to its people.',
  permission: 'crm.admission.view.branch',
  routes: [
    { path: '', element: <CorporateDeals /> },
    { path: 'deals', element: <CorporateDeals /> },
    { path: 'organisations', element: <CorporateOrganisations /> },
    { path: 'participants', element: <CorporateParticipants /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Deals', to: 'deals', icon: Handshake },
    { label: 'Clients', to: 'organisations', icon: Building2 },
    { label: 'Participants', to: 'participants', icon: Users },
  ],
})
