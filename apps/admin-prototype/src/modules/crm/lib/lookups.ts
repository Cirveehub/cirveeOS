import { useMemo } from 'react'
import type { BusinessUnit } from '@/app/module-registry'
import type { BadgeTone } from '@/ui'
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
  Lead,
} from '@/mocks/types'

export const STAGE_LABELS: Record<LeadStage, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  counselling: 'Counselling',
  application: 'Application',
  payment_pending: 'Ready to pay',
  enrolled: 'Enrolled',
  not_interested: 'Not interested',
  lost: 'Lost',
  invalid: 'Invalid',
  unresponsive: 'Unresponsive',
  future_nurture: 'Not now',
}

export const OPEN_STAGES: LeadStage[] = [
  'new',
  'contacted',
  'qualified',
  'counselling',
  'application',
  'payment_pending',
  'enrolled',
]

export const EXIT_STAGES: LeadStage[] = [
  'not_interested',
  'lost',
  'invalid',
  'unresponsive',
  'future_nurture',
]

export const ALL_STAGES: LeadStage[] = [...OPEN_STAGES, ...EXIT_STAGES]

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
  lead: 'Enquiry',
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
  referrer: 'Referred by',
  lead_owner: 'Handled by',
  closer: 'Closed by',
}

const UNIT_CODE_TO_BUSINESS_UNIT: Record<UnitCode, BusinessUnit> = {
  ACADEMY: 'academy',
  TEENS: 'teens',
  CORPORATE: 'corporate',
  DEXURB: 'dexurb',
  AFRICA: 'africa',
  TCF: 'tcf',
}

export function businessUnitOf(id: UnitId | null | undefined): BusinessUnit | null {
  if (!id) return null
  const unit = unitsCollection.find(id)
  return unit ? UNIT_CODE_TO_BUSINESS_UNIT[unit.code] : null
}

export function personFullName(person: Person | undefined): string {
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
}

export function personName(id: PersonId | null | undefined): string {
  if (!id) return '—'
  return personFullName(peopleCollection.find(id))
}

export function personIdForUser(id: UserId | null | undefined): PersonId | null {
  if (!id) return null
  return usersCollection.find(id)?.personId ?? null
}

export function userName(id: UserId | null | undefined): string {
  if (!id) return '—'
  const user = usersCollection.find(id)
  return user ? personName(user.personId) : 'Unknown user'
}

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

export interface Directory {
  people: Person[]
  users: User[]
  courses: Course[]
  cohorts: Cohort[]
  units: Unit[]
  branches: Branch[]
  personById: Map<string, Person>
  userById: Map<string, User>
  staffOptions: Array<{ value: string; label: string }>
  courseOptions: Array<{ value: string; label: string }>
  branchOptions: Array<{ value: string; label: string }>
  unitOptions: Array<{ value: string; label: string }>
  nameOf: (id: PersonId | null | undefined) => string
  userNameOf: (id: UserId | null | undefined) => string
}

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

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const rest = Math.round(minutes % 60)
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

export function discountPercentLabel(admission: {
  quotedFee: number
  discountAmount: number
}): string {
  if (!admission.quotedFee || !admission.discountAmount) return '0%'
  return `${((admission.discountAmount / admission.quotedFee) * 100).toFixed(1)}%`
}

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

export type SimpleStage = 'new' | 'talking' | 'ready_to_pay' | 'enrolled' | 'not_now' | 'lost'

export const SIMPLE_STAGE: Record<LeadStage, SimpleStage> = {
  new: 'new',
  contacted: 'talking',
  qualified: 'talking',
  counselling: 'talking',
  application: 'talking',
  payment_pending: 'ready_to_pay',
  enrolled: 'enrolled',
  future_nurture: 'not_now',
  not_interested: 'lost',
  lost: 'lost',
  invalid: 'lost',
  unresponsive: 'lost',
}

export const SIMPLE_STAGE_LABEL: Record<SimpleStage, string> = {
  new: 'New',
  talking: 'Talking',
  ready_to_pay: 'Ready to pay',
  enrolled: 'Enrolled',
  not_now: 'Not now',
  lost: 'Lost',
}

export const SIMPLE_STAGE_TONE: Record<SimpleStage, BadgeTone> = {
  new: 'info',
  talking: 'accent',
  ready_to_pay: 'warning',
  enrolled: 'success',
  not_now: 'neutral',
  lost: 'danger',
}

export const SIMPLE_PIPELINE: SimpleStage[] = ['new', 'talking', 'ready_to_pay', 'enrolled']
export const SIMPLE_OUTCOMES: SimpleStage[] = ['not_now', 'lost']
export const SIMPLE_OPEN: SimpleStage[] = ['new', 'talking', 'ready_to_pay']

// The raw stage written when a user picks a simple stage.
export const SIMPLE_STAGE_WRITE: Record<SimpleStage, LeadStage> = {
  new: 'new',
  talking: 'contacted',
  ready_to_pay: 'payment_pending',
  enrolled: 'enrolled',
  not_now: 'future_nurture',
  lost: 'lost',
}

export const RAW_STAGES_OF: Record<SimpleStage, LeadStage[]> = (
  Object.keys(SIMPLE_STAGE) as LeadStage[]
).reduce(
  (acc, raw) => {
    acc[SIMPLE_STAGE[raw]].push(raw)
    return acc
  },
  { new: [], talking: [], ready_to_pay: [], enrolled: [], not_now: [], lost: [] } as Record<SimpleStage, LeadStage[]>,
)

export const OPEN_RAW_STAGES: LeadStage[] = SIMPLE_OPEN.flatMap((s) => RAW_STAGES_OF[s])

export function simpleStageOf(stage: LeadStage): SimpleStage {
  return SIMPLE_STAGE[stage]
}

export function isOpenStage(stage: LeadStage): boolean {
  return SIMPLE_OPEN.includes(SIMPLE_STAGE[stage])
}

export function exitStageForReason(reason: LossReason): LeadStage {
  if (reason === 'unresponsive') return 'unresponsive'
  if (reason === 'not_qualified' || reason === 'duplicate') return 'invalid'
  return 'lost'
}

export function waitingLabel(days: number): string {
  if (days <= 0) return 'Waiting since today'
  return `Waiting ${days} day${days === 1 ? '' : 's'}`
}

export type ReplySpeed = 'fast' | 'slow' | 'none'

export function replySpeedOf(lead: Pick<Lead, 'firstResponseMinutes' | 'responseSlaMinutes' | 'stage'>): ReplySpeed {
  if (lead.firstResponseMinutes === null) return 'none'
  return lead.firstResponseMinutes <= lead.responseSlaMinutes ? 'fast' : 'slow'
}

export const REPLY_SPEED_LABEL: Record<ReplySpeed, string> = {
  fast: 'Replied within 2 hours',
  slow: 'Slow to reply',
  none: 'No reply yet',
}

export const REPLY_SPEED_TONE: Record<ReplySpeed, BadgeTone> = {
  fast: 'success',
  slow: 'warning',
  none: 'danger',
}

const SOURCE_PHRASE: Record<LeadSource, string> = {
  website_form: 'the website form',
  whatsapp: 'WhatsApp',
  walk_in_kiosk: 'a walk-in at the kiosk',
  instagram_dm: 'an Instagram message',
  referral_link: 'a referral link',
  event_scan: 'a scan at an event',
  phone: 'a phone call',
  import: 'a spreadsheet import',
  facebook_ad: 'a Facebook ad',
  google_ad: 'a Google ad',
  alumni_word_of_mouth: 'an alumnus telling them',
}

export function sourceSentence(lead: Pick<Lead, 'originalSource' | 'latestSource'>): string {
  const first = SOURCE_PHRASE[lead.originalSource]
  if (lead.latestSource === lead.originalSource) return `Came via ${first}`
  return `Came via ${SOURCE_PHRASE[lead.latestSource]} · first heard through ${first}`
}

export function whatsappHref(person: Pick<Person, 'phone' | 'whatsapp'> | undefined): string | null {
  const raw = person?.whatsapp ?? person?.phone
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = `234${digits.slice(1)}`
  return digits ? `https://wa.me/${digits}` : null
}

export function firstNameOf(fullName: string | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'there'
}
