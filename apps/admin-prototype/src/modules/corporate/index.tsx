import { Building2 } from 'lucide-react'

import { defineModule } from '@/app/module-registry'

import CorporateDashboard from './Dashboard'
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
    { path: '', element: <CorporateDashboard /> },
    { path: 'organisations', element: <CorporateOrganisations /> },
    { path: 'deals', element: <CorporateDeals /> },
    { path: 'participants', element: <CorporateParticipants /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Organisations', to: 'organisations' },
    { label: 'Deals', to: 'deals' },
    { label: 'Participants', to: 'participants' },
  ],
})
