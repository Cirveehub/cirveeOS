import type { ComponentType, ReactNode } from 'react'

import type { PermissionString } from '@/auth'

/**
 * Which modules each persona's sidebar offers — the executable form of
 * `docs/prototype/role-module-matrix.md`.
 *
 * This exists because permission scope alone cannot express it. `roleCan`
 * passes when the scope a role *holds* is greater than or equal to the scope
 * a module *asks for*, which is the right rule in one direction and useless
 * in the other: a module gated at `own` — "your own course", "your own
 * classes" — is satisfied by every role holding that resource at
 * `organisation`. That is how a Super Admin ended up with My learning in
 * their sidebar, and a Sponsor with Academy ops. Seniority is not the same
 * thing as relevance, and no amount of re-scoping fixes it, because the
 * permission model has no notion of "this screen is for the person the
 * record is about."
 *
 * So: which modules a role is *offered* is an explicit, reviewable decision
 * per persona, and permission stays what it is good at — what you may do
 * once inside a module, enforced per route and per subnav entry.
 *
 * A persona with no entry here falls through to the permission filter and
 * sees everything their role's scope covers. That is deliberate for the three
 * oversight personas (Super Admin, CEO, Unit Head) whose job *is* breadth.
 * They are still kept out of the personal modules by `ModuleDef.personas`.
 *
 * The list can only ever narrow: a module named here still has to clear its
 * own `permission` before it renders, so this can never hand someone a module
 * their role cannot actually use.
 *
 * Lives here, not in `AppShell.tsx`, so a module (like `command-centre`) can
 * read it without importing the shell that in turn imports every module —
 * this file has no dependency on `@/modules` and never will.
 */
export const PERSONA_MODULES: Record<string, string[]> = {
  /* Management — Super Admin, CEO and Unit Head are intentionally absent. */
  'exec-assistant': ['command-centre', 'meetings', 'approvals', 'my-referral'],

  /* HR & People */
  hr: ['command-centre', 'people', 'payroll', 'approvals', 'my-referral'],
  recruiter: ['command-centre', 'people', 'my-referral'],

  /* Finance & Legal */
  finance: ['command-centre', 'reports', 'finance', 'payroll', 'referral', 'approvals', 'my-referral'],
  'finance-officer': ['command-centre', 'finance', 'my-referral'],
  legal: ['command-centre', 'approvals', 'people', 'my-referral'],

  /* Growth */
  'growth-head': ['command-centre', 'crm', 'referral', 'engage', 'approvals', 'my-referral'],
  'sales-exec': ['command-centre', 'crm', 'my-referral'],
  partnerships: ['command-centre', 'corporate', 'crm', 'my-referral'],

  /* Customer Experience */
  'student-support': ['command-centre', 'support', 'academy', 'my-referral'],
  'community-manager': ['command-centre', 'support', 'engage', 'reputation', 'my-referral'],

  /* Education */
  'curriculum-lead': ['command-centre', 'learn', 'outcomes', 'my-referral'],
  // `command-centre` is here so `/home` stays reachable — sign-in sends
  // everyone there and it redirects a Tutor straight to `/teaching`. It is
  // kept out of their *sidebar* by `moduleInSidebar`, not out of their reach.
  tutor: ['command-centre', 'teaching', 'my-referral'],

  /* Programs & Delivery */
  'academy-ops': ['command-centre', 'academy', 'learn', 'outcomes', 'my-referral'],
  'programme-coordinator': ['command-centre', 'academy', 'my-referral'],

  /* Media */
  'media-lead': ['command-centre', 'reputation', 'engage', 'learn', 'my-referral'],
  marketing: ['command-centre', 'engage', 'reputation', 'my-referral'],

  /* Technology & Systems */
  'technology-lead': ['command-centre', 'automation', 'physical', 'approvals', 'settings', 'my-referral'],

  /* Learners, parents and clients */
  employee: ['command-centre', 'my-referral'],
  student: ['command-centre', 'my-learning', 'my-referral'],
  parent: ['command-centre', 'my-referral'],
  'corporate-client': ['command-centre', 'my-referral'],
  sponsor: ['command-centre', 'my-referral'],
}

/**
 * Where `/home` sends a persona whose one module already carries its own
 * dashboard, so they get one landing page rather than a generic Home plus a
 * second dashboard one click behind it. These are the two personas whose list
 * above deliberately omits `command-centre`.
 */
export const PERSONA_HOME_PATH: Record<string, string> = {
  student: '/my-learning',
  tutor: '/teaching',
}

/**
 * Does this persona's sidebar offer this module?
 *
 * One function, used by the sidebar, the command palette and the route guard,
 * so a URL can never reach further than the sidebar would have offered.
 */
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

/**
 * Does this module get a row in this persona's sidebar?
 *
 * Everything `moduleVisibleTo` allows, minus Home for the personas whose Home
 * is a redirect into their own module. Reachable and listed are different
 * questions: sign-in sends everyone to `/home`, so a Tutor has to be able to
 * *get* there, but a "Home" row that bounces them back to the page they are
 * already on is the duplicate landing page `PERSONA_HOME_PATH` exists to
 * remove.
 */
export function moduleInSidebar(
  mod: Pick<ModuleDef, 'id' | 'base' | 'permission' | 'personas'>,
  personaId: string | undefined,
  can: (permission: PermissionString) => boolean,
): boolean {
  if (!moduleVisibleTo(mod, personaId, can)) return false
  if (mod.base === '/home' && personaId && PERSONA_HOME_PATH[personaId]) return false
  return true
}

/**
 * The module contract.
 *
 * Every module in Cirvee OS is a self-contained folder under `src/modules/<id>/`
 * that default-exports one `ModuleDef`. The shell assembles navigation and
 * routing from the registry in `src/modules/index.ts` — nothing else in the app
 * needs to know a module exists.
 *
 * This is deliberate: it means a module can be built, reviewed or deleted
 * without touching the router, the sidebar, or any other module's files.
 */

export type NavGroup =
  | 'overview'
  | 'growth'
  | 'learning'
  | 'people'
  | 'money'
  | 'operations'
  | 'system'

export const NAV_GROUPS: { id: NavGroup; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'growth', label: 'Growth' },
  { id: 'learning', label: 'Learning' },
  { id: 'people', label: 'People' },
  { id: 'money', label: 'Money' },
  { id: 'operations', label: 'Operations' },
  { id: 'system', label: 'System' },
]

/** One of the six business units every revenue and cost record carries. */
export type BusinessUnit =
  | 'academy'
  | 'teens'
  | 'corporate'
  | 'dexurb'
  | 'africa'
  | 'tcf'

export interface ModuleRoute {
  /** Path relative to the module base. `''` is the module index. */
  path: string
  element: ReactNode
  /** Narrower than the module's own requirement, where one screen needs more. */
  permission?: PermissionString
}

export interface ModuleSubNav {
  label: string
  /** Path relative to the module base. */
  to: string
  /** Optional live count shown as a pill, e.g. pending approvals. */
  badge?: () => number | undefined
  /** Only used when the module sets `expandSubnavInSidebar` — see below. */
  icon?: ComponentType<{ size?: number | string; className?: string }>
  /**
   * Narrower than the module's own requirement, mirroring `ModuleRoute.permission`.
   * Without this, a module whose routes carry different permissions (like
   * `people`, split between recruitment and employee-lifecycle screens) would
   * show every entry to everyone in the command palette and in an expanded
   * sidebar, including ones `ModuleGuard` immediately bounces the role out of.
   */
  permission?: PermissionString
}

export interface ModuleDef {
  /** Stable id, kebab-case. Matches the folder name. */
  id: string
  /** Sidebar label. Sentence case, short — "My courses", not "My Courses". */
  label: string
  icon: ComponentType<{ size?: number | string; className?: string }>
  /** Root path, e.g. `/crm`. Must be unique. */
  base: string
  group: NavGroup
  /**
   * `deep`    — fully interactive: filters, forms, flows, persisted state.
   * `shallow` — dashboard and list views only, to show shape.
   */
  depth: 'deep' | 'shallow'
  /** One line, shown on the module index and in the command palette. */
  summary: string
  /**
   * What a role must hold to reach this module at all, as
   * `resource.action[.scope]`. Omit for modules everyone gets.
   *
   * The scope segment is what separates an operations module from a personal
   * one. A student holds `finance.invoice.view` at `own` scope — enough to see
   * their own balance, nowhere near enough to open the Finance module, which
   * asks for `branch`. Getting this wrong is how an interface ends up showing
   * a learner nineteen menu items.
   *
   * An array means "any one of these is enough". `people` needs it: its
   * recruitment screens and its employee-lifecycle screens are separate
   * resources on purpose, and a role holding only one of them — Talent
   * Acquisition has candidates and not employees, Legal has employees and not
   * candidates — must still be able to get through the module's front door,
   * with the per-route and per-subnav permissions deciding what they find
   * once inside.
   */
  permission?: PermissionString | PermissionString[]
  /**
   * Restricts this module to named personas outright, whatever their scope.
   *
   * For the modules that are somebody's *own* record rather than a view of
   * everybody's — a student's course, a tutor's classes. Permission scope
   * cannot express this: see the note on `PERSONA_MODULES` above.
   */
  personas?: string[]
  routes: ModuleRoute[]
  /** Secondary nav shown inside the module. Omit for single-screen modules. */
  subnav?: ModuleSubNav[]
  /**
   * Render every `subnav` entry as its own row in the real sidebar, instead
   * of the module getting one row and `subnav` staying reachable only from
   * the command palette.
   *
   * Default (unset) is right for the admin modules: a Super Admin's sidebar
   * showing one line per module, with each module's own internal sections
   * one click away, is the correct density for nineteen modules. It is the
   * wrong shape for a role whose *entire* app is one module — `teaching` and
   * `my-learning` set this so Dashboard / My course / Payment / Certificates
   * / Settings are each a first-class, independently reachable page, the way
   * a phone-first PWA needs them to be, rather than being buried behind an
   * in-page tab strip standing in for the sidebar the shell already has.
   */
  expandSubnavInSidebar?: boolean
}

export function defineModule(def: ModuleDef): ModuleDef {
  return def
}

/** Resolve a module-relative path to an absolute one. */
export function modulePath(mod: ModuleDef, to: string): string {
  if (!to) return mod.base
  return `${mod.base}/${to}`.replace(/\/+/g, '/')
}
