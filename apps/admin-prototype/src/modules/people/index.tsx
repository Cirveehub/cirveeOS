import { CalendarCheck, DoorOpen, LayoutDashboard, UserPlus, Users, Users2 } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import PeopleDashboard from './Dashboard'
import Openings from './Openings'
import NewOpening from './NewOpening'
import Candidates from './Candidates'
import CandidateProfile from './CandidateProfile'
import Interviews from './Interviews'
import Offers from './Offers'
import NewOffer from './NewOffer'
import Onboarding from './Onboarding'
import Employees from './Employees'
import Performance from './Performance'
import Attendance from './Attendance'
import Leave from './Leave'
import Exits from './Exits'

/**
 * Two permission tiers live in this one module, not one.
 *
 * `people.candidate` (recruitment: openings/candidates/interviews/offers) and
 * `people.employee` (the employee lifecycle: onboarding/employees/performance/
 * attendance/leave/exits) are deliberately separate resources. Talent
 * Acquisition holds the first and explicitly not the second — the PRD scopes
 * them to the hiring funnel only ("no access to employee records"). The
 * module's own top-level `permission` lists both, meaning "either one gets you
 * through the front door": Talent Acquisition enters on candidates, Legal on
 * employees (exit-case clearance), and neither is handed the other's screens
 * because each route carries its own real requirement via
 * `ModuleRoute.permission`, enforced by `ModuleGuard`.
 *
 * `expandSubnavInSidebar` — eleven flat screens were genuinely too many for
 * one module's worth of tabs, and a tab is not where a founder looks for a
 * page. So this collapses to five real sidebar rows instead: Dashboard,
 * Hiring (openings/candidates/interviews/offers), Workforce (employees/
 * onboarding/performance), Time and leave (attendance/leave), Exit cases.
 * Each row is a real page at its own URL, not a tab hidden inside "People."
 * Hiring/Workforce/Time and leave still cover more than one screen each, so
 * those pages carry their own second-row tabs (`PeopleGroupTabs` in
 * `shared.tsx`) to move between siblings without going back to the sidebar.
 */
const RECRUITMENT_PERMISSION = 'people.candidate.view.own'
const EMPLOYEE_PERMISSION = 'people.employee.view.department'

export default defineModule({
  id: 'people',
  label: 'People',
  icon: Users,
  base: '/people',
  group: 'people',
  depth: 'shallow',
  summary: 'The employee lifecycle, from job opening through onboarding, probation and exit.',
  permission: [RECRUITMENT_PERMISSION, EMPLOYEE_PERMISSION],
  routes: [
    { path: '', element: <PeopleDashboard /> },

    { path: 'openings', element: <Openings />, permission: RECRUITMENT_PERMISSION },
    { path: 'openings/new', element: <NewOpening />, permission: RECRUITMENT_PERMISSION },

    { path: 'candidates', element: <Candidates />, permission: RECRUITMENT_PERMISSION },
    { path: 'candidates/:id', element: <CandidateProfile />, permission: RECRUITMENT_PERMISSION },

    { path: 'interviews', element: <Interviews />, permission: RECRUITMENT_PERMISSION },

    { path: 'offers', element: <Offers />, permission: RECRUITMENT_PERMISSION },
    { path: 'offers/new', element: <NewOffer />, permission: RECRUITMENT_PERMISSION },

    { path: 'onboarding', element: <Onboarding />, permission: EMPLOYEE_PERMISSION },

    { path: 'employees', element: <Employees />, permission: EMPLOYEE_PERMISSION },
    { path: 'performance', element: <Performance />, permission: EMPLOYEE_PERMISSION },
    { path: 'attendance', element: <Attendance />, permission: EMPLOYEE_PERMISSION },
    { path: 'leave', element: <Leave />, permission: EMPLOYEE_PERMISSION },
    { path: 'exits', element: <Exits />, permission: EMPLOYEE_PERMISSION },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Dashboard', to: '', icon: LayoutDashboard },
    { label: 'Hiring', to: 'openings', icon: UserPlus, permission: RECRUITMENT_PERMISSION },
    { label: 'Workforce', to: 'employees', icon: Users2, permission: EMPLOYEE_PERMISSION },
    { label: 'Time and leave', to: 'attendance', icon: CalendarCheck, permission: EMPLOYEE_PERMISSION },
    { label: 'Exit cases', to: 'exits', icon: DoorOpen, permission: EMPLOYEE_PERMISSION },
  ],
})
