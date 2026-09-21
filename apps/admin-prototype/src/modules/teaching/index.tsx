import { GraduationCap, LayoutDashboard, School, Settings } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Classes from './Classes'
import CohortScreen from './CohortScreen'
import Grading from './Grading'
import MaterialScreen from './MaterialScreen'
import Profile from './Profile'

/**
 * The Tutor's whole world — modelled on the legacy `staff-portal`'s "Course"
 * hub, not a permission-scoped view of the admin `academy`/`learn` modules.
 *
 * The legacy portal fuses academy-ops (roster, attendance, timetable) and
 * learn-content (materials, assignments, grading) into one "Course" concept
 * behind a single nav item. Cirvee OS splits those across two admin modules,
 * which is exactly why a tutor's current experience reads as two ops tools
 * bolted together. This module is the fix: five flat pages, one of which — the
 * cohort hub — carries the five tabs a tutor actually works through.
 */
export default defineModule({
  id: 'teaching',
  label: 'My teaching',
  icon: GraduationCap,
  base: '/teaching',
  group: 'learning',
  depth: 'deep',
  summary: 'Your cohorts, your roster, your materials and assignments — one place.',
  permission: 'academy.cohort.view.own',
  // A tutor's own assigned cohorts. Everyone from the CEO down holds
  // `academy.cohort` at a wider scope and would otherwise clear this
  // `own`-scoped gate — Academy ops is where they belong, not here.
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
