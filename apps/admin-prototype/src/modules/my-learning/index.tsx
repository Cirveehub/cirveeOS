import { Award, BookOpen, LayoutDashboard, Settings as SettingsIcon, Sparkles, Wallet } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import Dashboard from './Dashboard'
import MyCourse from './MyCourse'
import AssignmentDetail from './AssignmentDetail'
import QuizAttempt from './QuizAttempt'
import Payment from './Payment'
import Certificates from './Certificates'
import Portfolio from './Portfolio'
import Settings from './Settings'

/**
 * The Student's real course experience — modelled on the legacy
 * `student-portal`, not the admin-preview `learn/StudentView.tsx` (which
 * stays exactly as it is, as an internal content-coverage tool for the
 * founder). See `docs/prototype`'s build plan for the full brief.
 *
 * Six screens, flat, every one a full page — the legacy portal's navigation
 * shape. Two of them (Payment, Certificates) have no legacy counterpart at
 * all: Cirvee OS already holds the invoices, the payments and the live
 * certificate-eligibility computation for this exact person, and a learner
 * who has to phone the office to ask what they owe is a worse product than
 * the data underneath already supports.
 */
export default defineModule({
  id: 'my-learning',
  label: 'My learning',
  icon: BookOpen,
  base: '/my-learning',
  group: 'learning',
  depth: 'deep',
  summary: 'Your course, your assignments, your grades, your certificate.',
  permission: 'learn.course.view.own',
  // A student's own enrolment, not a view of everybody's. Without this, every
  // role holding `learn.course` at a wider scope clears an `own`-scoped gate
  // and a Super Admin's sidebar grows a "My learning".
  personas: ['student'],
  routes: [
    { path: '', element: <Dashboard /> },
    { path: 'course', element: <MyCourse /> },
    { path: 'assignments/:assignmentId', element: <AssignmentDetail /> },
    { path: 'quizzes/:quizId', element: <QuizAttempt /> },
    { path: 'payment', element: <Payment /> },
    { path: 'certificates', element: <Certificates /> },
    { path: 'portfolio', element: <Portfolio /> },
    { path: 'settings', element: <Settings /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Dashboard', to: '', icon: LayoutDashboard },
    { label: 'My course', to: 'course', icon: BookOpen },
    { label: 'Payment', to: 'payment', icon: Wallet },
    { label: 'Certificates', to: 'certificates', icon: Award },
    { label: 'Portfolio', to: 'portfolio', icon: Sparkles },
    { label: 'Settings', to: 'settings', icon: SettingsIcon },
  ],
})
