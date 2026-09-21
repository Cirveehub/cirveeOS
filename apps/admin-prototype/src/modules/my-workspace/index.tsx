import { CalendarCheck, CalendarOff, ClipboardList, IdCard, LayoutDashboard, UserRound, Wallet } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Attendance from './Attendance'
import Leave from './Leave'
import Payslips from './Payslips'
import Tasks from './Tasks'
import Profile from './Profile'

/**
 * The personal staff module — every employee's own record, whatever else
 * their role does.
 *
 * The PRD lists Employee as its own row in the role table ("own profile,
 * attendance, leave, payslips, tasks, requests") precisely because it is not a
 * job: a Finance Manager and a Tutor are both also people with a leave balance
 * and a payslip. Before this module only the bare `employee` persona had
 * anywhere to see that, and even then only as cards on a dashboard.
 *
 * No `permission`, for the same reason `my-referral` has none: eligibility is
 * not a role question, and every query inside is already scoped to the
 * signed-in person's own employment record. What decides who gets it is
 * `PERSONA_MODULES` — the staff personas — because a student or a sponsor has
 * no employment record to show.
 *
 * `expandSubnavInSidebar`, so Attendance, Leave, Payslips, Tasks and Profile
 * are each a real page at their own URL rather than tabs inside one row. An
 * employee looking for their payslip should find "My payslips" in the sidebar,
 * not learn that it lives behind a tab on a dashboard.
 */
export default defineModule({
  id: 'my-workspace',
  label: 'My workspace',
  icon: UserRound,
  base: '/my-workspace',
  group: 'personal',
  depth: 'deep',
  summary: 'Your attendance, leave, payslips, tasks and employment record.',
  routes: [
    { path: '', element: <Dashboard /> },
    { path: 'attendance', element: <Attendance /> },
    { path: 'leave', element: <Leave /> },
    { path: 'payslips', element: <Payslips /> },
    { path: 'tasks', element: <Tasks /> },
    { path: 'profile', element: <Profile /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'My workspace', to: '', icon: LayoutDashboard },
    { label: 'My attendance', to: 'attendance', icon: CalendarCheck },
    { label: 'My leave', to: 'leave', icon: CalendarOff },
    { label: 'My payslips', to: 'payslips', icon: Wallet },
    { label: 'My tasks', to: 'tasks', icon: ClipboardList },
    { label: 'My profile', to: 'profile', icon: IdCard },
  ],
})
