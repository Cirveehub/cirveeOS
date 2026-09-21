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

/**
 * Home / Command Centre.
 *
 * `/` redirects here, and this is the one screen every persona lands on.
 * What each of them sees is not the same page with things hidden — it is a
 * different page, chosen by `HomeShape`:
 *
 *   configurator, executive → the dashboard: revenue, pipeline, attention
 *   ops, frontline          → a work queue: tasks and approvals first
 *   consumer                → the one thing that role came to check
 *
 * This is the fix for the prototype's first pass, which put the executive
 * dashboard on every role's Home regardless of whether the numbers on it
 * meant anything to them. `/home/executive`, `/home/employee` and
 * `/home/brief` stay reachable directly so a reviewer signed in as Super
 * Admin can compare all three without switching accounts — `ShapeGate` is
 * what stops anyone else reaching a layout that isn't theirs by URL.
 *
 * A persona listed in `PERSONA_HOME_PATH` (Tutor, Student) never renders a
 * Home screen at all — it redirects straight to their one real module, whose
 * own index route already is their dashboard. Rendering `ConsumerHome` here
 * for them, in addition to that module's Dashboard page, is exactly the
 * two-stats-pages duplication this was built to remove: one landing page,
 * not a generic Home plus a second dashboard one click away.
 */
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
      // `badge` runs outside render (the shell does not call subnav yet — see
      // module-registry.ts), so it cannot use the `useCurrentUserId` hook.
      // Falls back to the seed's fixed user until the shell renders subnav.
      label: 'My approvals',
      to: 'employee',
      badge: () => approvalsPendingOn(CURRENT_USER_ID).length || undefined,
    },
  ],
})
