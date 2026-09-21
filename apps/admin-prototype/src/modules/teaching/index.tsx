import { GraduationCap, LayoutDashboard, School, Settings } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Classes from './Classes'
import CohortScreen from './CohortScreen'
import Grading from './Grading'
import MaterialScreen from './MaterialScreen'
import Profile from './Profile'

export default defineModule({
  id: 'teaching',
  label: 'My teaching',
  icon: GraduationCap,
  base: '/teaching',
  group: 'learning',
  depth: 'deep',
  summary: 'Your cohorts, your roster, your materials and assignments — one place.',
  permission: 'academy.cohort.view.own',
  personas: ['tutor'],
  routes: [
    { path: '', element: <Dashboard /> },
    { path: 'classes', element: <Classes /> },
    { path: 'classes/:cohortId', element: <CohortScreen /> },
    { path: 'assignments/:assignmentId', element: <Grading /> },
    { path: 'materials/:lessonId', element: <MaterialScreen /> },
    { path: 'settings', element: <Profile /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Dashboard', to: '', icon: LayoutDashboard },
    { label: 'My classes', to: 'classes', icon: School },
    { label: 'Settings', to: 'settings', icon: Settings },
  ],
})
