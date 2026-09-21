import { Navigate, Route, Routes } from 'react-router-dom'

import { modules } from '@/modules'
import AppShell from './AppShell'
import Login from './Login'
import RequireAuth from './RequireAuth'
import ModuleGuard from './ModuleGuard'
import NotFound from './NotFound'
import PhysicalKiosk from '@/modules/physical/Kiosk'
import PublicVerify from '@/modules/learn/PublicVerify'

/**
 * Routes are assembled from the module registry. A module owns every path
 * under its `base`, so two modules can never collide and adding one never
 * touches this file.
 *
 * `/login` and `/public/*` are the routes outside the shell — everything
 * else needs a persona chosen first (`RequireAuth`), and every module route
 * is further checked against that persona's permission (`ModuleGuard`) so a
 * typed or bookmarked URL cannot reach further than the sidebar would have
 * offered.
 *
 * `/public/kiosk` is the real walk-in terminal the PRD puts outside the
 * shell — no module can mount a route outside its own `base`, so this is the
 * one place it can live. `/physical/kiosk` still exists separately as the
 * signed-in staff preview of the same screen; both render the same
 * self-contained, chrome-free component, which was built anticipating
 * exactly this split.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/public/kiosk" element={<PhysicalKiosk />} />
      <Route path="/public/verify/:certificateId" element={<PublicVerify />} />

      <Route
        path="*"
        element={
          <RequireAuth>
            <AppShell>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />

                {modules.map((mod) =>
                  mod.routes.map((route) => (
                    <Route
                      key={`${mod.id}:${route.path}`}
                      path={`${mod.base}/${route.path}`
                        .replace(/\/+$/, '')
                        .replace(/\/+/g, '/') || '/'}
                      element={
                        <ModuleGuard mod={mod} permission={route.permission}>
                          {route.element}
                        </ModuleGuard>
                      }
                    />
                  )),
                )}

                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          </RequireAuth>
        }
      />
    </Routes>
  )
}
