import { BookOpen, CheckSquare, ClipboardList, FileText, LayoutDashboard, Laptop, PackageSearch } from 'lucide-react'
import { defineModule } from '@/app/module-registry'
import { approvalsPendingOn } from '@/mocks'
import { currentActingUser } from './shared'

import WorkDashboard from './WorkDashboard'
import ApprovalsList from './ApprovalsList'
import ApprovalDetail from './ApprovalDetail'
import RaiseRequest from './RaiseRequest'
import RoutesConfig from './RoutesConfig'
import Requests from './Requests'
import Tasks from './Tasks'
import Documents from './Documents'
import Assets from './Assets'
import Procurement from './Procurement'
import Knowledge from './Knowledge'
import { TemplateList, TemplateEditor } from './Templates'

export default defineModule({
  id: 'approvals',
  label: 'Work & approvals',
  icon: CheckSquare,
  base: '/work',
  group: 'operations',
  depth: 'deep',
  summary:
    'One reusable approval engine, plus tasks, documents, assets and procurement.',
  permission: 'work.approval.view.department',
  routes: [
    { path: '', element: <WorkDashboard /> },

    { path: 'approvals', element: <ApprovalsList /> },
    { path: 'approvals/new', element: <RaiseRequest /> },
    { path: 'approvals/:id', element: <ApprovalDetail /> },
    { path: 'approval-routes', element: <RoutesConfig /> },

    { path: 'requests', element: <Requests /> },
    { path: 'procurement', element: <Procurement /> },

    { path: 'tasks', element: <Tasks /> },

    { path: 'documents', element: <Documents /> },
    { path: 'templates', element: <TemplateList /> },
    { path: 'templates/:id', element: <TemplateEditor /> },

    { path: 'assets', element: <Assets /> },
    { path: 'knowledge', element: <Knowledge /> },
  ],
  expandSubnavInSidebar: true,
  subnav: [
    { label: 'Dashboard', to: '', icon: LayoutDashboard },
    {
      label: 'Approvals',
      to: 'approvals',
      icon: CheckSquare,
      badge: () => approvalsPendingOn(currentActingUser()).length || undefined,
    },
    { label: 'Tasks', to: 'tasks', icon: ClipboardList },
    { label: 'Documents', to: 'documents', icon: FileText },
    { label: 'Assets', to: 'assets', icon: Laptop },
    { label: 'Procurement', to: 'procurement', icon: PackageSearch },
    { label: 'Knowledge base', to: 'knowledge', icon: BookOpen },
  ],
})
