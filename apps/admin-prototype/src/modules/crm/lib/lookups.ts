/**
 * Label and reference resolution for the CRM module.
 *
 * Every function here reads a live `Collection`, never a seed array, so a
 * Person created by the new-lead wizard resolves by name on the very next
 * render. Components that must re-render when identity data changes use
 * `useDirectory()`; everything else calls the plain resolvers.
 */

import { useMemo } from 'react'
import type { BusinessUnit } from '@/app/module-registry'
import {
  branchesCollection,
  cohortsCollection,
  coursesCollection,
  peopleCollection,
  unitsCollection,
  usersCollection,
  useCollection,
  rolesCollection,
} from '@/mocks'
import type {
  AdmissionStatus,
  Branch,
  Cohort,
  Course,
  DiscountType,
  LeadSource,
  LeadStage,
  LossReason,
  Mode,
  PaymentPlan,
  Person,
  PersonId,
  RelationshipType,
  Unit,
  UnitCode,
  UnitId,
  User,
  UserId,
  BranchId,
  CourseId,
  CohortId,
  CommissionRoleOnDeal,
} from '@/mocks/types'

/* -------------------------------------------------------------------------- */
/* Enum labels — sentence case, short                                         */
/* -------------------------------------------------------------------------- */

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  counselling: 'Counselling',
  application: 'Application',
  payment_pending: 'Payment pending',
  enrolled: 'Enrolled',
  not_interested: 'Not interested',
  lost: 'Lost',
  invalid: 'Invalid',
  unresponsive: 'Unresponsive',
  future_nurture: 'Future nurture',
}

/** The seven stages a lead walks forward through. */
export const OPEN_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'counselling',
  'application',
  'payment_pending',
  'enrolled',
]

/** Leaving the pipeline through one of these requires a loss reason. */
export const EXIT_STAGES: LeadStage[] = [
  'not_interested',
  'lost',
  'invalid',
  'unresponsive',
  'future_nurture',
]

export const ALL_STAGES: LeadStage[] = [...OPEN_STAGES, ...EXIT_STAGES]

/** Stages that no longer count as pipeline. */
export const CLOSED_STAGES: LeadStage[] = ['enrolled', 'lost', 'not_interested', 'invalid']

export const SOURCE_LABELS: Record<LeadSource, string> = {
  website_form: 'Website form',
  whatsapp: 'WhatsApp',
  walk_in_kiosk: 'Walk-in kiosk',
  instagram_dm: 'Instagram DM',
  referral_link: 'Referral link',
  event_scan: 'Event scan',
  phone: 'Phone',
  import: 'Import',
  facebook_ad: 'Facebook ad',
  google_ad: 'Google ad',
  alumni_word_of_mouth: 'Alumni word of mouth',
}

export const ALL_SOURCES = Object.keys(SOURCE_LABELS) as LeadSource[]

export const LOSS_REASON_LABELS: Record<LossReason, string> = {
  price: 'Price',
  timing: 'Timing',
  chose_competitor: 'Chose competitor',
  unresponsive: 'Unresponsive',
  not_qualified: 'Not qualified',
  location: 'Location',
  course_not_offered: 'Course not offered',
  duplicate: 'Duplicate',
}

export const ALL_LOSS_REASONS = Object.keys(LOSS_REASON_LABELS) as LossReason[]

export const MODE_LABELS: Record<Mode, string> = {
  on_campus: 'On-campus',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
}

export const ADMISSION_STATUS_LABELS: Record<AdmissionStatus, string> = {
  draft: 'Draft',
  pending_discount_approval: 'Pending discount approval',
  invoiced: 'Invoiced',
  partially_paid: 'Partially paid',
  enrolled: 'Enrolled',
  withdrawn: 'Withdrawn',
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  none: 'None',
  percentage: 'Percentage',
  fixed: 'Fixed',
  scholarship: 'Scholarship',
}

export const PAYMENT_PLAN_LABELS: Record<PaymentPlan, string> = {
  full: 'Full upfront',
  '2_instalments': '2 instalments',
  '3_instalments': '3 instalments',
  '4_instalments': '4 instalments',
  custom: 'Custom',
}

export const PLAN_INSTALMENT_COUNT: Record<PaymentPlan, number> = {
  full: 1,
  '2_instalments': 2,
  '3_instalments': 3,
  '4_instalments': 4,
  custom: 2,
}

export const RELATIONSHIP_LABELS: Record<RelationshipType, string> = {
  lead: 'Lead',
  applicant: 'Applicant',
  student: 'Student',
  alumnus: 'Alumnus',
  parent_guardian: 'Parent or guardian',
  employee: 'Employee',
  candidate: 'Candidate',
  tutor: 'Tutor',
  referrer: 'Referrer',
  corporate_contact: 'Corporate contact',
  event_attendee: 'Event attendee',
  sponsor: 'Sponsor',
}

export const ROLE_ON_DEAL_LABELS: Record<CommissionRoleOnDeal, string> = {
  referrer: 'Referrer',
  lead_owner: 'Lead owner',
  closer: 'Closer',
}

/* -------------------------------------------------------------------------- */
/* Units                                                                      */
/* -------------------------------------------------------------------------- */

const UNIT_CODE_TO_BUSINESS_UNIT: Record<UnitCode, BusinessUnit> = {
  ACADEMY: 'academy',
  TEENS: 'teens',
  CORPORATE: 'corporate',
  DEXURB: 'dexurb',
  AFRICA: 'africa',
  TCF: 'tcf',
}

/** `unit-academy` → `academy`, the key `UnitTag` wants. */
export function businessUnitOf(id: UnitId | null | undefined): BusinessUnit | null {
  if (!id) return null
  const unit = unitsCollection.find(id)
  return unit ? UNIT_CODE_TO_BUSINESS_UNIT[unit.code] : null
}

/* -------------------------------------------------------------------------- */
/* People, users, catalogue                                                   */
/* -------------------------------------------------------------------------- */

export function personFullName(person: Person | undefined): string {
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
}

export function personName(id: PersonId | null | undefined): string {
  if (!id) return '—'
  return personFullName(peopleCollection.find(id))
}

/** The Person behind a staff login. Staff are people too — one record each. */
export function personIdForUser(id: UserId | null | undefined): PersonId | null {
  if (!id) return null
  return usersCollection.find(id)?.personId ?? null
}

export function userName(id: UserId | null | undefined): string {
  if (!id) return '—'
  const user = usersCollection.find(id)
  return user ? personName(user.personId) : 'Unknown user'
}

/** "Sales Executive" — the first role on the user, for a PersonChip's second line. */
export function userRoleName(id: UserId | null | undefined): string {
  if (!id) return ''
  const user = usersCollection.find(id)
  const roleId = user?.roleIds[0]
  return roleId ? (rolesCollection.find(roleId)?.name ?? '') : ''
}

export function courseTitle(id: CourseId | null | undefined): string {
  if (!id) return '—'
  return coursesCollection.find(id)?.title ?? 'Unknown course'
}

export function cohortCode(id: CohortId | null | undefined): string {
  if (!id) return '—'
  return cohortsCollection.find(id)?.code ?? 'Unknown cohort'
}

export function branchName(id: BranchId | null | undefined): string {
  if (!id) return '—'
  return branchesCollection.find(id)?.name ?? 'Unknown branch'
}

export function unitName(id: UnitId | null | undefined): string {
  if (!id) return '—'
  return unitsCollection.find(id)?.name ?? 'Unknown unit'
}

/* -------------------------------------------------------------------------- */
/* The reactive directory                                                     */
/* -------------------------------------------------------------------------- */

export interface Directory {
  people: Person[]
  users: User[]
  courses: Course[]
  cohorts: Cohort[]
  units: Unit[]
  branches: Branch[]
  personById: Map<string, Person>
  userById: Map<string, User>
  /** Staff options for an owner or closer picker, sorted by name. */
  staffOptions: Array<{ value: string; label: string }>
  courseOptions: Array<{ value: string; label: string }>
  branchOptions: Array<{ value: string; label: string }>
  unitOptions: Array<{ value: string; label: string }>
  nameOf: (id: PersonId | null | undefined) => string
  userNameOf: (id: UserId | null | undefined) => string
}

/**
 * Subscribes to every reference collection a CRM screen resolves labels
 * against, so a newly created Person or a reassigned owner re-renders the
 * rows that name them.
 */
export function useDirectory(): Directory {
  const people = useCollection(peopleCollection)
  const users = useCollection(usersCollection)
  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  return useMemo(() => {
    const personById = new Map(people.map((p) => [p.id as string, p]))
    const userById = new Map(users.map((u) => [u.id as string, u]))

    const nameOf = (id: PersonId | null | undefined) =>
      id ? personFullName(personById.get(id)) : '—'
    const userNameOf = (id: UserId | null | undefined) => {
      if (!id) return '—'
      const user = userById.get(id)
      return user ? nameOf(user.personId) : 'Unknown user'
    }

    const staffOptions = users
      .filter((u) => u.status === 'active')
      .map((u) => ({ value: u.id as string, label: nameOf(u.personId) }))
      .sort((a, b) => a.label.localeCompare(b.label))

    return {
      people,
      users,
      courses,
      cohorts,
      units,
      branches,
      personById,
      userById,
      staffOptions,
      courseOptions: courses
        .filter((c) => c.status !== 'archived')
        .map((c) => ({ value: c.id as string, label: c.title }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      branchOptions: branches.map((b) => ({ value: b.id as string, label: b.name })),
      unitOptions: units.map((u) => ({ value: u.id as string, label: u.name })),
      nameOf,
      userNameOf,
    }
  }, [people, users, courses, cohorts, units, branches])
}

/* -------------------------------------------------------------------------- */
/* Small formatting helpers                                                   */
/* -------------------------------------------------------------------------- */

/** 251 → "4h 11m". Used by every response-time surface in the module. */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** "18.0%" — the discount as a share of the quoted fee, for a list cell. */
export function discountPercentLabel(admission: {
  quotedFee: number
  discountAmount: number
}): string {
  if (!admission.quotedFee || !admission.discountAmount) return '0%'
  return `${((admission.discountAmount / admission.quotedFee) * 100).toFixed(1)}%`
}

/** Days in stage colour banding, per §2.2: amber at 8, red at 15. */
export function ageTone(days: number): 'default' | 'warning' | 'danger' {
  if (days >= 15) return 'danger'
  if (days >= 8) return 'warning'
  return 'default'
}

export const AGE_BUCKETS = [
  { key: '0-2', label: '0–2 days', min: 0, max: 2 },
  { key: '3-7', label: '3–7 days', min: 3, max: 7 },
  { key: '8-14', label: '8–14 days', min: 8, max: 14 },
  { key: '15+', label: '15+ days', min: 15, max: Number.POSITIVE_INFINITY },
] as const
