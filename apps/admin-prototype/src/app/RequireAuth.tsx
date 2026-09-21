import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/auth'

/**
 * Everything under this needs a persona chosen first. There is no password to
 * check — this exists purely so the app opens on "who are you signing in as"
 * rather than dropping straight into the Super Admin's version of the system,
 * which is what made the first pass of this prototype misleading: every
 * reviewer saw the most powerful role by default and judged the whole product
 * by it.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
