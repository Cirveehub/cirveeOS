/**
 * Who is signed in, and what that entitles them to see.
 *
 * ```tsx
 * const session = useSession()
 * const can = useCan()
 * if (can('finance.invoice.view')) { … }
 * ```
 */
export {
  PERSONAS,
  PERSONAS_BY_DEPARTMENT,
  DEPARTMENTS,
  personaById,
  resolvePersona,
  DEFAULT_PERSONA_ID,
} from './personas'
export type { Persona, HomeShape, ResolvedPersona } from './personas'

export {
  signIn,
  signOut,
  useSession,
  useSessionPersonaId,
  useCurrentUserId,
  useCan,
  roleCan,
  grantsOf,
  scopeFor,
  parsePermission,
} from './session'
export type { Session, PermissionString } from './session'
