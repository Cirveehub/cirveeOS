import { GraduationCap } from 'lucide-react'
import { defineModule } from '@/app/module-registry'
import { enrollmentsCollection } from '@/mocks'

import Attendance from './Attendance'
import Classes from './Classes'
import Cohorts from './Cohorts'
import Courses from './Courses'
import Dashboard from './Dashboard'
import Students from './Students'
import Tutors from './Tutors'

export default defineModule({
  id: 'academy',
  label: 'Academy ops',
  icon: GraduationCap,
  base: '/academy',
  group: 'learning',
  depth: 'shallow',
  summary: 'Courses, cohorts, timetable, tutors and attendance — the delivery side of the academy.',
  permission: 'academy.cohort.view.own',
  routes: [
    { path: '', element: <Dashboard /> },
    { path: 'courses', element: <Courses /> },
    { path: 'cohorts', element: <Cohorts /> },
    { path: 'students', element: <Students /> },
    { path: 'tutors', element: <Tutors /> },
    { path: 'classes', element: <Classes /> },
    { path: 'attendance', element: <Attendance /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Courses', to: 'courses' },
    { label: 'Cohorts', to: 'cohorts' },
    {
      label: 'Students',
      to: 'students',
      badge: () => enrollmentsCollection.count((e) => e.status === 'active' && e.attentionFlags.length > 0) || undefined,
    },
    { label: 'Tutors', to: 'tutors' },
    { label: 'Classes', to: 'classes' },
    { label: 'Attendance', to: 'attendance' },
  ],
})
