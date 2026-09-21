import { Link } from 'react-router-dom'
import { Lock } from 'lucide-react'

import { useCan, useSession } from '@/auth'
import type { PermissionString } from '@/auth'
import { moduleVisibleTo, type ModuleDef } from './module-registry'

/**
 * Enforces a module's reach on direct navigation.
 *
 * The sidebar already hides what a role cannot reach, but a URL can still be
 * typed or bookmarked — the PRD's fourth non-negotiable is that hiding a
 * button is not security, and the same logic applies to hiding a nav item.
 * This is still presentation only (there is no server here to authorise
 * against), but it means the same rule holds everywhere in the prototype
 * rather than only where a person happens to click.
 *
 * It asks `moduleVisibleTo` — the same question the sidebar and the command
 * palette ask — and then, where a single screen needs more than the module
 * does, checks that route's own narrower permission on top.
 */
export default function ModuleGuard({
  mod,
  permission,
  children,
}: {
  mod: Pick<ModuleDef, 'id' | 'permission' | 'personas'>
  /** The route's own requirement, where it is narrower than the module's. */
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
