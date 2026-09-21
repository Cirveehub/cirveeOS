import type { ComponentType, ReactNode } from 'react'

import type { PermissionString } from '@/auth'

export const PERSONA_MODULES: Record<string, string[]> = {
  'exec-assistant': ['command-centre', 'meetings', 'approvals', 'my-referral', 'my-workspace'],

  hr: ['command-centre', 'people', 'payroll', 'approvals', 'my-referral', 'my-workspace'],
  recruiter: ['command-centre', 'people', 'my-referral', 'my-workspace'],

  finance: ['command-centre', 'reports', 'finance', 'payroll', 'referral', 'approvals', 'my-referral', 'my-workspace'],
  'finance-officer': ['command-centre', 'finance', 'my-referral', 'my-workspace'],
  legal: ['command-centre', 'approvals', 'people', 'my-referral', 'my-workspace'],

  'growth-head': ['command-centre', 'crm', 'referral', 'engage', 'approvals', 'my-referral', 'my-workspace'],
  'sales-exec': ['command-centre', 'crm', 'my-referral', 'my-workspace'],
  partnerships: ['command-centre', 'corporate', 'crm', 'my-referral', 'my-workspace'],

  'student-support': ['command-centre', 'support', 'academy', 'my-referral', 'my-workspace'],
  'community-manager': ['command-centre', 'support', 'engage', 'my-referral', 'my-workspace'],

  'curriculum-lead': ['command-centre', 'learn', 'outcomes', 'my-referral', 'my-workspace'],
  tutor: ['command-centre', 'teaching', 'my-referral', 'my-workspace'],

  'academy-ops': ['command-centre', 'academy', 'learn', 'outcomes', 'my-referral', 'my-workspace'],
  'programme-coordinator': ['command-centre', 'academy', 'my-referral', 'my-workspace'],

  'media-lead': ['command-centre', 'engage', 'learn', 'my-referral', 'my-workspace'],
  marketing: ['command-centre', 'engage', 'my-referral', 'my-workspace'],

  'technology-lead': ['command-centre', 'automation', 'physical', 'approvals', 'settings', 'my-referral', 'my-workspace'],

  employee: ['command-centre', 'my-referral', 'my-workspace'],
  student: ['command-centre', 'my-learning', 'my-referral'],
  parent: ['command-centre', 'my-referral'],
  'corporate-client': ['command-centre', 'my-referral'],
  sponsor: ['command-centre', 'my-referral'],
}

export const PERSONA_HOME_PATH: Record<string, string> = {
  student: '/my-learning',
  tutor: '/teaching',
  employee: '/my-workspace',
}

export function moduleVisibleTo(
  mod: Pick<ModuleDef, 'id' | 'permission' | 'personas'>,
  personaId: string | undefined,
  can: (permission: PermissionString) => boolean,
): boolean {
  if (mod.personas && (!personaId || !mod.personas.includes(personaId))) return false
  const offered = personaId ? PERSONA_MODULES[personaId] : undefined
  if (offered && !offered.includes(mod.id)) return false
  if (!mod.permission) return true
  const required = Array.isArray(mod.permission) ? mod.permission : [mod.permission]
  return required.some((p) => can(p))
}

export function moduleInSidebar(
  mod: Pick<ModuleDef, 'id' | 'base' | 'permission' | 'personas'>,
  personaId: string | undefined,
  can: (permission: PermissionString) => boolean,
): boolean {
  if (!moduleVisibleTo(mod, personaId, can)) return false
  if (mod.base === '/home' && personaId && PERSONA_HOME_PATH[personaId]) return false
  return true
}

export type NavGroup =
  | 'overview'
  | 'growth'
  | 'learning'
  | 'people'
  | 'money'
  | 'operations'
  | 'personal'
  | 'system'

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'growth', label: 'Growth' },
  { id: 'learning', label: 'Learning' },
  { id: 'people', label: 'People' },
  { id: 'money', label: 'Money' },
  { id: 'operations', label: 'Operations' },
  { id: 'personal', label: 'Personal' },
  { id: 'system', label: 'System' },
]

export type BusinessUnit =
  | 'academy'
  | 'teens'
  | 'corporate'
  | 'dexurb'
  | 'africa'
  | 'tcf'

export interface ModuleRoute {
  path: string
  element: ReactNode
  permission?: PermissionString
}

export interface ModuleSubNav {
  label: string
  to: string
  badge?: () => number | undefined
  icon?: ComponentType<{ size?: number | string; className?: string }>
  permission?: PermissionString
}

export interface ModuleDef {
  id: string
  label: string
  icon: ComponentType<{ size?: number | string; className?: string }>
  base: string
  group: NavGroup
  depth: 'deep' | 'shallow'
  summary: string
  permission?: PermissionString | PermissionString[]
  personas?: string[]
  routes: ModuleRoute[]
  subnav?: ModuleSubNav[]
  expandSubnavInSidebar?: boolean
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def
}

export function modulePath(mod: ModuleDef, to: string): string {
  if (!to) return mod.base
  return `${mod.base}/${to}`.replace(/\/+/g, '/')
}
