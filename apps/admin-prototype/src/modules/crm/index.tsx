import { GraduationCap, Inbox, Sun, Users } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Today from './pages/Today'
import LeadList from './pages/LeadList'
import NewLead from './pages/NewLead'
import LeadProfile from './pages/LeadProfile'
import AdmissionList from './pages/AdmissionList'
import NewAdmission from './pages/NewAdmission'
import AdmissionDetail from './pages/AdmissionDetail'
import DuplicateQueue from './pages/DuplicateQueue'
import Team from './pages/Team'

// Sales Executives hold crm.lead.edit at "own"; the growth lead, unit heads and executives hold branch or wider.
const TEAM_PERMISSION = 'crm.lead.edit.branch'

export default defineModule({
  id: 'crm',
  label: 'Admissions',
  icon: GraduationCap,
  base: '/crm',
  group: 'growth',
  depth: 'deep',
  summary: 'Enquiries, the people handling them, and who has enrolled.',
  permission: 'crm.lead.view.team',
  routes: [
    { path: '', element: <Today /> },

    { path: 'enquiries', element: <LeadList /> },
    { path: 'enquiries/new', element: <NewLead /> },
    { path: 'enquiries/:id', element: <LeadProfile /> },
    { path: 'leads', element: <LeadList /> },
    { path: 'leads/new', element: <NewLead /> },
    { path: 'leads/:id', element: <LeadProfile /> },

    { path: 'enrolled', element: <AdmissionList /> },
    { path: 'admissions', element: <AdmissionList /> },
    { path: 'admissions/new', element: <NewAdmission /> },
    { path: 'admissions/:id', element: <AdmissionDetail /> },

    { path: 'duplicates', element: <DuplicateQueue /> },

    { path: 'team', element: <Team />, permission: TEAM_PERMISSION },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Today', to: '', icon: Sun },
    { label: 'Enquiries', to: 'enquiries', icon: Inbox },
    { label: 'Enrolled', to: 'enrolled', icon: GraduationCap },
    { label: 'Team', to: 'team', icon: Users, permission: TEAM_PERMISSION },
  ],
})
