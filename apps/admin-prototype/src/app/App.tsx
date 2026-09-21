import { Navigate, Route, Routes } from 'react-router-dom'

import { modules } from '@/modules'
import AppShell from './AppShell'
import Login from './Login'
import RequireAuth from './RequireAuth'
import ModuleGuard from './ModuleGuard'
import NotFound from './NotFound'
import PhysicalKiosk from '@/modules/physical/Kiosk'
import PublicVerify from '@/modules/learn/PublicVerify'

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
