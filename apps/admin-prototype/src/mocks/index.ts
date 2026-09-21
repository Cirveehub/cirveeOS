/**
 * The data layer's front door.
 *
 * ```tsx
 * import { leadsCollection, useCollection, select, formatNaira } from '@/mocks'
 * ```
 *
 * Everything a screen needs comes from here: the entity types, the
 * collections, the hooks that subscribe to them, and the derived selectors.
 * Screens should never import a file under `mocks/seed/` — the seed is an
 * implementation detail, and importing it directly is how a dashboard ends up
 * reading a constant instead of a live number.
 */

/* Types ------------------------------------------------------------------- */
export type * from '@/mocks/types'
export { asKobo, ngn } from '@/mocks/types'

/* The collection primitive and its hooks ---------------------------------- */
export { Collection, useCollection, useRecord, useQuery, nextId, uid, resetAllData } from '@/mocks/collection'
export type { Entity } from '@/mocks/collection'

/* Collections, selectors, validation and demo controls -------------------- */
export * from '@/mocks/store'

/* Well-known ids — the cast the five scripted flows use ------------------- */
export { P, U, E, C, CO, BR, UNIT, DEPT, ROLE, TEAM, RULE, FLOW, ORGS, TPL, PERIOD, POLICY, ROUTE, SEG, MSGT, AUTO, NGOZI_REFERRER } from '@/mocks/seed/ids'

/* The fixed clock and the standard date windows --------------------------- */
export { TODAY, LAST_30D, LAST_90D, MTD, LAST_MONTH } from '@/mocks/seed/_helpers'
export { daysAgo, daysAhead, addDays, daysBetweenTodayAnd, at as atTime } from '@/mocks/seed/_helpers'

/* Row counts per domain, for the demo panel ------------------------------- */
export { CRM_COUNTS } from '@/mocks/seed/crm'
export { REFERRAL_COUNTS } from '@/mocks/seed/referral'
export { LEARN_COUNTS } from '@/mocks/seed/learn'
export { FINANCE_COUNTS } from '@/mocks/seed/finance'
export { WORK_COUNTS } from '@/mocks/seed/approvals'
export { HR_COUNTS } from '@/mocks/seed/hr'
export { AUTOMATION_COUNTS } from '@/mocks/seed/automation'
export { OPS_COUNTS } from '@/mocks/seed/ops'
export { AUDIT_COUNTS } from '@/mocks/seed/audit'
