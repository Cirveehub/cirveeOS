import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

import { useCan, useSession } from '@/auth'
import type { PermissionString } from '@/auth'
import { moduleVisibleTo, type ModuleDef } from './module-registry'

export default function ModuleGuard({
  mod,
  permission,
  children,
}: {
  mod: Pick<ModuleDef, 'id' | 'permission' | 'personas'>
  permission?: PermissionString
  children: React.ReactNode
}) {
  const can = useCan()
  const session = useSession()

  const allowed =
    moduleVisibleTo(mod, session?.persona.id, can) && (!permission || can(permission))

  if (!allowed) {
    return (
      <div className="grid min-h-full place-items-center px-8 py-24">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 grid size-11 place-items-center rounded-full bg-surface-sunken text-text-muted">
            <Lock size={20} />
          </div>
          <h1 className="text-heading-20">Not part of your role</h1>
          <p className="mt-1.5 text-body-14 text-text-secondary">
            This module isn&rsquo;t in your permission set. If you need it, ask whoever
            configures roles to widen your access.
          </p>
          <Link
            to="/home"
            className="mt-5 inline-flex h-9 items-center rounded-lg bg-accent px-3.5 text-body-13 font-semibold text-on-accent transition-colors hover:bg-accent-hover"
          >
            Back to home
          </Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
