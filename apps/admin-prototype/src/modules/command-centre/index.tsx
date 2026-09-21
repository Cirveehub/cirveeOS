import { LayoutDashboard } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { defineModule, PERSONA_HOME_PATH } from '@/app/module-registry'
import { useSession, type HomeShape } from '@/auth'
import { CURRENT_USER_ID, approvalsPendingOn } from '@/mocks'

import BriefPage from './pages/BriefPage'
import ConsumerHome from './pages/ConsumerHome'
import EmployeeHome from './pages/EmployeeHome'
import ExecutiveHome from './pages/ExecutiveHome'
import { ShapeGate } from './components/ShapeGate'

function HomeDispatch() {
  const session = useSession()
  const overridePath = session ? PERSONA_HOME_PATH[session.persona.id] : undefined
  if (overridePath) return <Navigate to={overridePath} replace />

  const shape: HomeShape = session?.persona.shape ?? 'configurator'
  if (shape === 'consumer') return <ConsumerHome />
  if (shape === 'ops' || shape === 'frontline') return <EmployeeHome />
  return <ExecutiveHome />
}

export default defineModule({
  id: 'command-centre',
  label: 'Home',
  icon: LayoutDashboard,
  base: '/home',
  group: 'overview',
  depth: 'deep',
  summary:
    'Role-aware landing. What each person actually needs today, not the same dashboard for everyone.',
  routes: [
    { path: '', element: <HomeDispatch /> },
    {
      path: 'executive',
      element: (
        <ShapeGate allow={['configurator', 'executive']}>
          <ExecutiveHome />
        </ShapeGate>
      ),
    },
    {
      path: 'employee',
      element: (
        <ShapeGate allow={['configurator', 'executive', 'ops', 'frontline']}>
          <EmployeeHome />
        </ShapeGate>
      ),
    },
    {
      path: 'brief',
      element: (
        <ShapeGate allow={['configurator', 'executive']}>
          <BriefPage />
        </ShapeGate>
      ),
    },
  ],
  subnav: [
    { label: 'Home', to: '' },
    {
      label: 'My approvals',
      to: 'employee',
      badge: () => approvalsPendingOn(CURRENT_USER_ID).length || undefined,
    },
  ],
})
