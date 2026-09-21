import { useSyncExternalStore } from 'react'

import {
  CURRENT_USER_ID,
  rolesCollection,
  type PermissionAction,
  type PermissionScope,
  type Role,
  type UserId,
} from '@/mocks'
import { personaById, resolvePersona, type ResolvedPersona } from './personas'

const STORAGE_KEY = 'cirvee-os:session'

let currentPersonaId: string | null = restore()
const listeners = new Set<() => void>()

function restore(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw && personaById[raw] ? raw : null
  } catch {
    return null
  }
}

function emit() {
  try {
    if (currentPersonaId) sessionStorage.setItem(STORAGE_KEY, currentPersonaId)
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
  }
  listeners.forEach((l) => l())
}

export function signIn(personaId: string) {
  if (!personaById[personaId]) return
  currentPersonaId = personaId
  emit()
}

export function signOut() {
  currentPersonaId = null
  emit()
}

export function currentPersonaId_(): string | null {
  return currentPersonaId
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot() {
  return currentPersonaId
}

export function useSessionPersonaId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export interface Session extends ResolvedPersona {
  role: Role | undefined
  signedIn: boolean
}

export function useSession(): Session | null {
  const id = useSessionPersonaId()
  if (!id) return null

  const persona = personaById[id]
  if (!persona) return null

  const resolved = resolvePersona(persona)
  return {
    ...resolved,
    role: rolesCollection.find(persona.roleId),
    signedIn: true,
  }
}

export function useCurrentUserId(): UserId {
  const session = useSession()
  return session?.userId ?? CURRENT_USER_ID
}

const SCOPE_RANK: Record<PermissionScope, number> = {
  none: 0,
  own: 1,
  team: 2,
  department: 3,
  branch: 4,
  organisation: 5,
}

export type PermissionString = string

export function scopeFor(
  role: Role | undefined,
  resource: string,
  action: PermissionAction,
): PermissionScope {
  if (!role) return 'none'
  return role.permissions[resource]?.[action] ?? 'none'
}

export function parsePermission(
  permission: PermissionString,
): { resource: string; action: PermissionAction; scope: PermissionScope | undefined } | null {
  const parts = permission.split('.')
  if (parts.length < 3) return null

  const resource = `${parts[0]}.${parts[1]}`
  const action = parts[2] as PermissionAction
  const scope = parts[3] as PermissionScope | undefined
  return { resource, action, scope }
}

export function roleCan(role: Role | undefined, permission: PermissionString): boolean {
  const parsed = parsePermission(permission)
  if (!parsed) return false

  const held = scopeFor(role, parsed.resource, parsed.action)
  if (held === 'none') return false

  if (!parsed.scope) return true
  return SCOPE_RANK[held] >= SCOPE_RANK[parsed.scope]
}

export function grantsOf(role: Role | undefined): PermissionString[] {
  if (!role) return []
  const out: PermissionString[] = []
  for (const [resource, actions] of Object.entries(role.permissions)) {
    for (const [action, scope] of Object.entries(actions)) {
      if (scope !== 'none') out.push(`${resource}.${action}.${scope}`)
    }
  }
  return out
}

export function useCan(): (permission: PermissionString) => boolean {
  const session = useSession()
  return (permission) => roleCan(session?.role, permission)
}
