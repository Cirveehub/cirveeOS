import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '@/auth'

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession()
  const location = useLocation()

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
