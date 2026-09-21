import { Settings2 } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

import SettingsHome from './Home'
import Organisation from './Organisation'
import Branches from './Branches'
import Units from './Units'
import Departments from './Departments'
import Users from './Users'
import Roles from './Roles'
import RoleMatrix from './RoleMatrix'
import Policies from './Policies'
import AuditLog from './AuditLog'
import Integrations from './Integrations'
import Numbering from './Numbering'
import DemoControls from './DemoControls'

export default defineModule({
  id: 'settings',
  label: 'Settings',
  icon: Settings2,
  base: '/settings',
  group: 'system',
  depth: 'shallow',
  summary: 'Organisation, branches, units, roles and permissions, policies and integrations.',
  permission: 'settings.role.view',
  routes: [
    { path: '', element: <SettingsHome /> },

    { path: 'organisation', element: <Organisation /> },
    { path: 'branches', element: <Branches /> },
    { path: 'units', element: <Units /> },
    { path: 'departments', element: <Departments /> },
    { path: 'users', element: <Users /> },

    { path: 'roles', element: <Roles /> },
    { path: 'roles/:id', element: <RoleMatrix /> },

    { path: 'policies', element: <Policies /> },
    { path: 'audit', element: <AuditLog /> },
    { path: 'integrations', element: <Integrations /> },
    { path: 'numbering', element: <Numbering /> },
    { path: 'demo', element: <DemoControls /> },
  ],
  subnav: [
    { label: 'Overview', to: '' },
    { label: 'Organisation', to: 'organisation' },
    { label: 'Branches', to: 'branches' },
    { label: 'Business units', to: 'units' },
    { label: 'Departments', to: 'departments' },
    { label: 'Users', to: 'users' },
    { label: 'Roles and permissions', to: 'roles' },
    { label: 'Policies', to: 'policies' },
    { label: 'Audit log', to: 'audit' },
    { label: 'Integrations', to: 'integrations' },
    { label: 'Numbering', to: 'numbering' },
    { label: 'Demo controls', to: 'demo' },
  ],
})
