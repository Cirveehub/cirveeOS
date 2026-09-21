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

export default defineModule({
  id: 'my-learning',
  label: 'My learning',
  icon: BookOpen,
  base: '/my-learning',
  group: 'learning',
  depth: 'deep',
  summary: 'Your course, your assignments, your grades, your certificate.',
  permission: 'learn.course.view.own',
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
