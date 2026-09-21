import { Target } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import CrmDashboard from './pages/CrmDashboard'
import LeadList from './pages/LeadList'
import NewLead from './pages/NewLead'
import LeadProfile from './pages/LeadProfile'
import AdmissionList from './pages/AdmissionList'
import NewAdmission from './pages/NewAdmission'
import AdmissionDetail from './pages/AdmissionDetail'
import DuplicateQueue from './pages/DuplicateQueue'

export default defineModule({
  id: 'crm',
  label: 'CRM & admissions',
  icon: Target,
  base: '/crm',
  group: 'growth',
  depth: 'deep',
  summary: 'Everything before someone becomes a student: leads, pipeline, follow-ups and admissions.',
  permission: 'crm.lead.view.team',
  routes: [
    { path: '', element: <CrmDashboard /> },

    { path: 'leads', element: <LeadList /> },
    // `new` before `:id` so it matches as a literal.
    { path: 'leads/new', element: <NewLead /> },
    { path: 'leads/:id', element: <LeadProfile /> },

    { path: 'admissions', element: <AdmissionList /> },
    { path: 'admissions/new', element: <NewAdmission /> },
    { path: 'admissions/:id', element: <AdmissionDetail /> },

    { path: 'duplicates', element: <DuplicateQueue /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Leads', to: 'leads' },
    { label: 'Admissions', to: 'admissions' },
    { label: 'Duplicates', to: 'duplicates' },
  ],
})
