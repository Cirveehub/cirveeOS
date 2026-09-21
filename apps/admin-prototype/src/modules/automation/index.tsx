import { Workflow } from 'lucide-react'
import { defineModule } from '@/app/module-registry'
import { automationExceptionsCollection } from '@/mocks'

import Dashboard from './Dashboard'
import Workflows from './Workflows'
import Builder from './Builder'
import Runs from './Runs'
import RunDetail from './RunDetail'
import Exceptions from './Exceptions'

export default defineModule({
  id: 'automation',
  label: 'Automation',
  icon: Workflow,
  base: '/automation',
  group: 'operations',
  depth: 'deep',
  summary: 'Trigger, condition, action. With delays, branches, run history and a failure queue.',
  permission: 'automation.workflow.view',
  routes: [
    { path: '', element: <Dashboard /> },

    { path: 'workflows', element: <Workflows /> },
    // `new` precedes `:id` so it is matched as a literal, not as an id.
    { path: 'workflows/new', element: <Builder /> },
    { path: 'workflows/:id/builder', element: <Builder /> },
    { path: 'workflows/:id', element: <Builder /> },

    { path: 'runs', element: <Runs /> },
    { path: 'runs/:id', element: <RunDetail /> },

    { path: 'exceptions', element: <Exceptions /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Workflows', to: 'workflows' },
    { label: 'Run history', to: 'runs' },
    {
      label: 'Exceptions',
      to: 'exceptions',
      badge: () => automationExceptionsCollection.count((e) => e.status === 'open') || undefined,
    },
  ],
})
