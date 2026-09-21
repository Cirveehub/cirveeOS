import { CalendarCheck, CalendarOff, ClipboardList, IdCard, LayoutDashboard, UserRound, Wallet } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import Attendance from './Attendance'
import Leave from './Leave'
import Payslips from './Payslips'
import Tasks from './Tasks'
import Profile from './Profile'

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
