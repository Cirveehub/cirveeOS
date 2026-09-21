import { Link } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'

import { useSession, type HomeShape } from '@/auth'
import { EmptyState } from '@/ui'

export function ShapeGate({
  allow,
  children,
}: {
  allow: HomeShape[]
  children: React.ReactNode
}) {
  const session = useSession()
  const shape = session?.persona.shape

  if (shape && (allow.includes(shape) || shape === 'configurator')) {
    return <>{children}</>
  }

  return (
    <div className="mx-auto max-w-md px-8 py-24">
      <EmptyState
        icon={LayoutDashboard}
        title="Not your home layout"
        message="This is a different role's landing page. Yours is at Home."
        action={
          <Link
            to="/home"
            className="inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-body-13 font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            Go to your home
          </Link>
        }
      />
    </div>
  )
}
