/**
 * CRM & Admissions — 312 leads, 300 admissions, the follow-up queue, the
 * activity feed and the duplicate review queue.
 *
 * The one rule this file exists to make visible: **referrer, lead owner and
 * closer are three independent fields.** Nothing here derives one from
 * another, and the Flow 1 deal deliberately has three different people in the
 * three slots.
 *
 * Lead reference numbers run CIR-L-0601 … CIR-L-0912, oldest first. Flow 1
 * creates CIR-L-0913, so the seed stops one short.
 *
 * Admission references are per-year sequences. The 2026 sequence ends at
 * ADM-2026-0187 (Flow 1 creates 0188); numbers 0101–0136 are absent because
 * they were consumed by the legacy import in June.
 */

import {
  activityId,
  admissionId as asAdmissionId,
  dupeId,
  followUpId,
  invoiceId as asInvoiceId,
  leadId as asLeadId,
  ngn,
  approvalId,
  type Activity,
  type Admission,
  type AdmissionStatus,
  type CohortId,
  type CourseId,
  type DiscountType,
  type DuplicateCandidate,
  type FollowUp,
  type Instalment,
  type Kobo,
  type Lead,
  type LeadSource,
  type LeadStage,
  type LossReason,
  type Mode,
  type PaymentPlan,
  type PersonId,
  type UserId,
  type BranchId,
  type UnitId,
} from '@/mocks/types'
import { BR, C, P, U, UNIT, person } from '@/mocks/seed/ids'
import { cohortById, cohortFillOrder, courseById } from '@/mocks/seed/academy'
import { people, personById, referrerPersonIds, SLOTS } from '@/mocks/seed/people'
import {
  addDays,
  at,
  audit,
  chance,
  daysAgo,
  daysBetweenTodayAnd,
  dtAgo,
  int,
  pad,
  pick,
  rng,
  splitInstalments,
  weighted,
  TODAY,
} from '@/mocks/seed/_helpers'

const r = rng(31415)

/* -------------------------------------------------------------------------- */
/* Shared pools                                                               */
/* -------------------------------------------------------------------------- */

const SALES_OWNERS: UserId[] = [U.chidinma, U.blessing, U.aisha, U.folake, U.chukwuemeka, U.ifeoma]
const CLOSERS: UserId[] = [U.adebayo, U.ifeoma, U.chidinma, U.blessing, U.chukwuemeka]

const SOURCE_MIX: ReadonlyArray<readonly [LeadSource, number]> = [
  ['website_form', 22],
  ['whatsapp', 19],
  ['instagram_dm', 13],
  ['referral_link', 12],
  ['walk_in_kiosk', 9],
  ['event_scan', 8],
  ['phone', 7],
  ['facebook_ad', 5],
  ['google_ad', 3],
  ['alumni_word_of_mouth', 2],
]

const NEXT_ACTIONS = [
  'Call to discuss cohort dates',
  'Send the instalment plan by WhatsApp',
  'Follow up on the scholarship question',
  'Confirm laptop availability before enrolment',
  'Share the Data Analysis syllabus PDF',
  'Book a campus visit',
  'Check whether the employer will sponsor',
  'Re-send the payment link — first one expired',
]

const LOSS_REASONS: ReadonlyArray<readonly [LossReason, number]> = [
  ['price', 30],
  ['timing', 22],
  ['chose_competitor', 16],
  ['unresponsive', 14],
  ['not_qualified', 8],
  ['location', 5],
  ['course_not_offered', 5],
]

const COURSE_INTEREST: CourseId[] = [
  C.dataAnalysis, C.dataAnalysis, C.dataAnalysis,
  C.productDesign, C.productDesign,
  C.frontend, C.frontend,
  C.backend, C.digitalMarketing, C.digitalMarketing,
  C.cyber, C.productManagement, C.dataScience, C.cloud,
  C.graphics, C.videoEditing, C.mobile,
  C.teensCoding, C.teensRobotics, C.corporateExcel,
]

/* -------------------------------------------------------------------------- */
/* Lead stage allocation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 310 generated leads plus Chiamaka and Tunde Adeyemi = 312. Heavy at New and
 * Contacted, thin at Enrolled — 43 enrolled admissions over 312 leads is the
 * 13.8% conversion the Home dashboard quotes.
 */
const STAGE_PLAN: ReadonlyArray<readonly [LeadStage, number]> = [
  ['enrolled', 45],
  ['payment_pending', 12],
  ['application', 18],
  ['counselling', 26],
  ['qualified', 38],
  ['not_interested', 9],
  ['lost', 8],
  ['invalid', 4],
  ['unresponsive', 6],
  ['future_nurture', 2],
  ['contacted', 64],
  ['new', 78],
]

const stageSequence: LeadStage[] = STAGE_PLAN.flatMap(([stage, n]) => Array.from({ length: n }, () => stage))

/* -------------------------------------------------------------------------- */
/* Leads                                                                      */
/* -------------------------------------------------------------------------- */

interface LeadDraft {
  slot: number
  personId: PersonId
  createdAt: string
}

const generatedDrafts: LeadDraft[] = []
for (let slot = SLOTS.leads.from; slot <= SLOTS.leads.to; slot++) {
  const p = personById.get(person(slot))
  if (!p) continue
  generatedDrafts.push({ slot, personId: p.id, createdAt: p.createdAt })
}
generatedDrafts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

/** CIR-L-0601 … CIR-L-0912, with 0642 and 0688 reserved for the named cast. */
const RESERVED_REFS = new Set([642, 688])
const availableRefNumbers = Array.from({ length: 312 }, (_, i) => 601 + i).filter((n) => !RESERVED_REFS.has(n))

function slaMinutes(): number {
  return 120
}

function makeLead(args: {
  refNumber: number
  personId: PersonId
  createdAt: string
  stage: LeadStage
  courseId: CourseId
  branchId: BranchId
  unitId: UnitId
  mode: Mode
  source: LeadSource
  ownerUserId: UserId
  referrerPersonId: PersonId | null
  closerUserId: UserId | null
  referralCode: string | null
  quotedValue: Kobo | null
  firstResponseMinutes: number | null
  lossReason?: LossReason | null
  nextAction?: string | null
}): Lead {
  const {
    refNumber, personId, createdAt, stage, courseId, branchId, unitId, mode, source,
    ownerUserId, referrerPersonId, closerUserId, referralCode, quotedValue, firstResponseMinutes,
  } = args
  const createdDay = createdAt.slice(0, 10)
  const ageDays = daysBetweenTodayAnd(createdDay)
  const advanced = !['new', 'contacted'].includes(stage)
  const stageDay = advanced ? addDays(createdDay, Math.min(ageDays, int(r, 2, 18))) : createdDay
  const closed = ['enrolled', 'lost', 'not_interested', 'invalid'].includes(stage)

  const firstResponseAt =
    firstResponseMinutes === null
      ? null
      : at(createdDay, Number(createdAt.slice(11, 13)) + Math.floor(firstResponseMinutes / 60), Math.min(59, firstResponseMinutes % 60))

  return {
    id: asLeadId(`lead-${pad(refNumber)}`),
    ref: `CIR-L-${pad(refNumber)}`,
    personId,
    courseInterestId: courseId,
    mode,
    branchId,
    unitId,
    stage,
    stageEnteredAt: at(stageDay, int(r, 9, 17), int(r, 0, 59)),
    daysInStage: Math.max(0, daysBetweenTodayAnd(stageDay)),
    quotedValue,
    referrerPersonId,
    ownerUserId,
    closerUserId,
    originalSource: source,
    latestSource: source,
    campaignId: null,
    utm:
      source === 'facebook_ad' || source === 'google_ad'
        ? { source: source === 'google_ad' ? 'google' : 'facebook', medium: 'cpc', campaign: 'q3-enrolment-push' }
        : source === 'referral_link'
          ? { source: 'referral', medium: 'link', campaign: 'alumni-referral' }
          : {},
    landingPage:
      source === 'website_form' ? '/courses/data-analysis' : source === 'referral_link' ? `/r/${referralCode ?? ''}` : null,
    referralCode,
    firstResponseAt,
    firstResponseMinutes,
    responseSlaMinutes: slaMinutes(),
    nextAction: closed ? null : (args.nextAction ?? pick(r, NEXT_ACTIONS)),
    nextActionDueAt: closed ? null : at(addDays(TODAY, int(r, -4, 9)), int(r, 9, 16), 0),
    lastActivityAt: at(stageDay, int(r, 10, 18), int(r, 0, 59)),
    lossReason: args.lossReason ?? null,
    lossNote:
      args.lossReason === 'price'
        ? 'Said the fee was beyond budget this quarter. Asked to be contacted in January.'
        : args.lossReason === 'chose_competitor'
          ? 'Went with a cheaper bootcamp in Lagos.'
          : null,
    ownershipHistory: [
      {
        fromUserId: null,
        toUserId: ownerUserId,
        at: createdAt,
        byUserId: U.adebayo,
        reason: 'Round-robin assignment',
      },
    ],
    ...audit(createdAt, ownerUserId),
  }
}

const leads: Lead[] = []

/* ── The two named leads ────────────────────────────────────────────────── */

// Chiamaka's original journey: scanned at the TCF conference, enrolled four days later.
leads.push(
  makeLead({
    refNumber: 688,
    personId: P.chiamaka,
    createdAt: '2026-08-04T11:26:00+01:00',
    stage: 'enrolled',
    courseId: C.dataAnalysis,
    branchId: BR.ibadan,
    unitId: UNIT.academy,
    mode: 'on_campus',
    source: 'event_scan',
    ownerUserId: U.chidinma,
    referrerPersonId: P.ngozi,
    closerUserId: U.adebayo,
    referralCode: 'NGOZI15',
    quotedValue: ngn(450_000),
    firstResponseMinutes: 41,
    nextAction: null,
  }),
)

leads.push(
  makeLead({
    refNumber: 642,
    personId: P.tundeAdeyemi,
    createdAt: '2026-06-18T14:02:00+01:00',
    stage: 'enrolled',
    courseId: C.dataAnalysis,
    branchId: BR.ibadan,
    unitId: UNIT.academy,
    mode: 'on_campus',
    source: 'walk_in_kiosk',
    ownerUserId: U.folake,
    referrerPersonId: null,
    closerUserId: U.chidinma,
    referralCode: null,
    quotedValue: ngn(450_000),
    firstResponseMinutes: 12,
    nextAction: null,
  }),
)

/* ── The generated 310 ──────────────────────────────────────────────────── */

generatedDrafts.forEach((draft, i) => {
  const stage = stageSequence[i]
  const refNumber = availableRefNumbers[i]
  const courseId = pick(r, COURSE_INTEREST)
  const course = courseById.get(courseId)
  const p = personById.get(draft.personId)
  const branchId = p?.primaryBranchId ?? BR.ibadan
  const source = weighted(r, SOURCE_MIX)
  const advanced = ['enrolled', 'payment_pending', 'application'].includes(stage)
  // Referred leads convert better than cold ones — that is the whole business
  // case for the module, and it has to be true in the data, not just asserted
  // on a dashboard.
  const hasReferrer =
    source === 'referral_link' || source === 'alumni_word_of_mouth' || chance(r, advanced ? 0.45 : 0.2)
  const referrer = hasReferrer ? referrerPersonIds[i % referrerPersonIds.length] : null
  const ownerUserId = SALES_OWNERS[i % SALES_OWNERS.length]
  // Responded to 68% of leads inside the 120-minute SLA; the rest ran late or never.
  const responded = stage !== 'new' && chance(r, 0.86)
  const withinSla = chance(r, 0.68)

  leads.push(
    makeLead({
      refNumber,
      personId: draft.personId,
      createdAt: draft.createdAt,
      stage,
      courseId,
      branchId,
      unitId: course?.unitId ?? UNIT.academy,
      mode: branchId === BR.virtual ? 'virtual' : chance(r, 0.25) ? 'hybrid' : 'on_campus',
      source,
      ownerUserId,
      referrerPersonId: referrer,
      closerUserId: advanced ? CLOSERS[(i + 2) % CLOSERS.length] : null,
      referralCode: referrer ? `REFCODE${pad(i % 90, 2)}` : null,
      quotedValue: course ? course.listPrice : null,
      firstResponseMinutes: responded ? (withinSla ? int(r, 3, 118) : int(r, 130, 2100)) : null,
      lossReason: stage === 'lost' || stage === 'not_interested' ? weighted(r, LOSS_REASONS) : null,
    }),
  )
})

export { leads }
export const leadById = new Map<string, Lead>(leads.map((l) => [l.id, l]))

/** The 47 leads that reached Enrolled, oldest first. Admissions draw from these. */
const enrolledLeads = leads.filter((l) => l.stage === 'enrolled').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
const paymentPendingLeads = leads.filter((l) => l.stage === 'payment_pending')

/* -------------------------------------------------------------------------- */
/* Admissions                                                                 */
/* -------------------------------------------------------------------------- */

const DISCOUNT_REASONS = [
  'Alumni discount — completed Digital Marketing in 2025',
  'Early-bird payment before the cohort opened',
  'Corporate staff rate under the Sterling Bank agreement',
  'Sibling discount — second child in Cirvee Teens',
  'TCF partial scholarship',
  'Referral thank-you, approved by Growth',
]

function instalmentsFor(plan: PaymentPlan, netFee: Kobo, startDate: string): Instalment[] {
  const n = plan === 'full' ? 1 : plan === '2_instalments' ? 2 : plan === '3_instalments' ? 3 : 4
  const parts = splitInstalments(netFee, n)
  return parts.map((amount, i) => {
    const dueDate = addDays(startDate, i * 30)
    return {
      number: i + 1,
      dueDate,
      amount,
      status: dueDate < TODAY ? 'paid' : dueDate <= addDays(TODAY, 14) ? 'due' : 'pending',
    }
  })
}

interface AdmissionArgs {
  id: string
  ref: string
  leadId: Lead | null
  personId: PersonId
  courseId: CourseId
  cohortId: CohortId
  createdAt: string
  status: AdmissionStatus
  discountType: DiscountType
  discountValue: number
  referrerPersonId: PersonId | null
  leadOwnerUserId: UserId
  closerUserId: UserId | null
  plan: PaymentPlan
  invoiceRefNumber: number | null
  discountApprovalRef?: string
}

function makeAdmission(a: AdmissionArgs): Admission {
  const course = courseById.get(a.courseId)
  const cohort = cohortById.get(a.cohortId)
  const quotedFee = (course?.listPrice ?? ngn(450_000)) as Kobo
  const discountAmount = (
    a.discountType === 'percentage'
      ? Math.round((quotedFee * a.discountValue) / 100)
      : a.discountType === 'fixed' || a.discountType === 'scholarship'
        ? a.discountValue
        : 0
  ) as Kobo
  const netFee = (quotedFee - discountAmount) as Kobo
  const start = cohort?.startDate ?? TODAY
  const enrolled = a.status === 'enrolled'

  return {
    id: asAdmissionId(a.id),
    ref: a.ref,
    leadId: a.leadId ? a.leadId.id : null,
    personId: a.personId,
    courseId: a.courseId,
    cohortId: a.cohortId,
    mode: cohort?.mode ?? 'on_campus',
    branchId: cohort?.branchId ?? BR.ibadan,
    unitId: cohort?.unitId ?? UNIT.academy,
    expectedStartDate: start,
    quotedFee,
    discountType: a.discountType,
    discountValue: a.discountValue,
    discountAmount,
    discountReason: a.discountType === 'none' ? null : pick(r, DISCOUNT_REASONS),
    discountApprovalId: a.discountApprovalRef ? approvalId(a.discountApprovalRef) : null,
    netFee,
    paymentPlan: a.plan,
    instalments: instalmentsFor(a.plan, netFee, start),
    referrerPersonId: a.referrerPersonId,
    leadOwnerUserId: a.leadOwnerUserId,
    closerUserId: a.closerUserId,
    invoiceId: a.invoiceRefNumber === null ? null : asInvoiceId(`inv-${pad(a.invoiceRefNumber)}`),
    status: a.status,
    enrolmentId: enrolled || a.status === 'withdrawn' ? (`enr-${a.id.replace('adm-', '')}` as Admission['enrolmentId']) : null,
    withdrawnAt: a.status === 'withdrawn' ? at(addDays(start, int(r, 8, 40)), 11, 0) : null,
    withdrawnReason:
      a.status === 'withdrawn'
        ? pick(r, [
            'Relocated to Abuja for work',
            'Could not keep up with the evening schedule',
            'Employer withdrew sponsorship',
            'Personal — family bereavement',
          ])
        : null,
    ...audit(a.createdAt, a.leadOwnerUserId),
  }
}

const admissions: Admission[] = []

/* ── The current intake: 51 admissions, ADM-2026-0137 … ADM-2026-0187 ───── */

/**
 * Explicit, because the demo depends on exactly who is where:
 * Chiamaka is 0151 in DA-C12, Tunde Adeyemi is 0149 in DA-C12 with a balance,
 * 0146 is the fully-paid admission Flow 3's refund reverses a commission on.
 */
const CURRENT_PLAN: ReadonlyArray<{ cohort: string; count: number; from: number }> = [
  { cohort: 'coh-tr-t04', count: 3, from: 137 },
  { cohort: 'coh-da-c12', count: 12, from: 140 },
  { cohort: 'coh-tr-t04', count: 2, from: 152 },
  { cohort: 'coh-da-c13', count: 18, from: 154 },
  { cohort: 'coh-ex-b09', count: 2, from: 172 },
  { cohort: 'coh-tc-t06', count: 6, from: 174 },
]

// Chiamaka (0151) and Tunde Adeyemi (0149) are written by hand below, so the
// generated pool must not hand their leads to anyone else.
const PINNED_NUMBERS = new Set([149, 151])
const PINNED_REFS = new Set(['CIR-L-0688', 'CIR-L-0642'])
const enrolledLeadPool = enrolledLeads.filter((l) => !PINNED_REFS.has(l.ref))

let enrolledLeadCursor = 0
function nextEnrolledLead(): Lead {
  const lead = enrolledLeadPool[enrolledLeadCursor % enrolledLeadPool.length]
  enrolledLeadCursor += 1
  return lead
}

let invoiceCursor = 837 // INV-2026-0837 … INV-2026-0932; Flow 1 creates 0933.

for (const block of CURRENT_PLAN) {
  const cohortId = block.cohort as CohortId
  for (let i = 0; i < block.count; i++) {
    const n = block.from + i
    if (PINNED_NUMBERS.has(n)) {
      invoiceCursor += 1 // reserve inv-0849 and inv-0851 for the two named deals
      continue
    }
    const lead = nextEnrolledLead()
    const cohort = cohortById.get(cohortId)
    const discountRoll = r()
    const discountType: DiscountType =
      discountRoll > 0.82 ? 'percentage' : discountRoll > 0.76 ? 'scholarship' : 'none'
    admissions.push(
      makeAdmission({
        id: `adm-${pad(n)}`,
        ref: `ADM-2026-${pad(n)}`,
        leadId: lead,
        personId: lead.personId,
        courseId: cohort?.courseId ?? C.dataAnalysis,
        cohortId,
        createdAt: at(daysAgo(int(r, 6, 80)), int(r, 9, 17), int(r, 0, 59)),
        status: 'enrolled',
        discountType,
        discountValue: discountType === 'percentage' ? pick(r, [5, 10, 10, 15]) : discountType === 'scholarship' ? ngn(100_000) : 0,
        referrerPersonId: lead.referrerPersonId,
        leadOwnerUserId: lead.ownerUserId,
        closerUserId: lead.closerUserId,
        plan: weighted(r, [
          ['full', 42],
          ['2_instalments', 38],
          ['3_instalments', 16],
          ['4_instalments', 4],
        ] as const),
        invoiceRefNumber: invoiceCursor++,
      }),
    )
  }
}

/* ── The two named admissions, written by hand ──────────────────────────── */

/**
 * Chiamaka. ₦450,000 less a 10% discount = **₦405,000**, two instalments of
 * ₦202,500, both paid. Balance ₦0, which is what lets Flow 5 issue her
 * certificate — and what lets Flow 3 refund ₦180,000 against a fully-paid
 * invoice and force a *proportional reversal of an already-paid commission*.
 */
admissions.push(
  makeAdmission({
    id: 'adm-0151',
    ref: 'ADM-2026-0151',
    leadId: leads.find((l) => l.ref === 'CIR-L-0688') ?? null,
    personId: P.chiamaka,
    courseId: C.dataAnalysis,
    cohortId: 'coh-da-c12' as CohortId,
    createdAt: '2026-08-08T10:22:00+01:00',
    status: 'enrolled',
    discountType: 'percentage',
    discountValue: 10,
    referrerPersonId: P.ngozi,
    leadOwnerUserId: U.chidinma,
    closerUserId: U.adebayo,
    plan: '2_instalments',
    invoiceRefNumber: 851,
  }),
)

/**
 * Tunde Adeyemi. ₦450,000 across three instalments, two and a bit paid —
 * **₦120,000 still outstanding**, which blocks his certificate in Flow 5
 * step 14 even though he meets every academic criterion.
 */
admissions.push(
  makeAdmission({
    id: 'adm-0149',
    ref: 'ADM-2026-0149',
    leadId: leads.find((l) => l.ref === 'CIR-L-0642') ?? null,
    personId: P.tundeAdeyemi,
    courseId: C.dataAnalysis,
    cohortId: 'coh-da-c12' as CohortId,
    createdAt: '2026-06-29T09:41:00+01:00',
    status: 'enrolled',
    discountType: 'none',
    discountValue: 0,
    referrerPersonId: null,
    leadOwnerUserId: U.folake,
    closerUserId: U.chidinma,
    plan: '3_instalments',
    invoiceRefNumber: 849,
  }),
)

/* Four sitting on a discount approval — over the 15% threshold. */
paymentPendingLeads.slice(0, 4).forEach((lead, i) => {
  const n = 180 + i
  admissions.push(
    makeAdmission({
      id: `adm-${pad(n)}`,
      ref: `ADM-2026-${pad(n)}`,
      leadId: lead,
      personId: lead.personId,
      courseId: lead.courseInterestId ?? C.dataAnalysis,
      cohortId: 'coh-da-c13' as CohortId,
      createdAt: at(daysAgo(int(r, 2, 11)), int(r, 9, 17), int(r, 0, 59)),
      status: 'pending_discount_approval',
      discountType: 'percentage',
      discountValue: pick(r, [20, 22, 25, 30]),
      referrerPersonId: lead.referrerPersonId,
      leadOwnerUserId: lead.ownerUserId,
      closerUserId: lead.closerUserId,
      plan: '2_instalments',
      invoiceRefNumber: null,
      discountApprovalRef: `apr-${pad(292 + i)}`,
    }),
  )
})

/* Four withdrawals from the current intake. */
for (let i = 0; i < 4; i++) {
  const n = 184 + i
  const lead = nextEnrolledLead()
  admissions.push(
    makeAdmission({
      id: `adm-${pad(n)}`,
      ref: `ADM-2026-${pad(n)}`,
      leadId: lead,
      personId: lead.personId,
      courseId: lead.courseInterestId ?? C.digitalMarketing,
      cohortId: (i < 2 ? 'coh-fe-c07' : 'coh-dm-c08') as CohortId,
      createdAt: at(daysAgo(int(r, 40, 86)), int(r, 9, 17), int(r, 0, 59)),
      status: 'withdrawn',
      discountType: 'none',
      discountValue: 0,
      referrerPersonId: lead.referrerPersonId,
      leadOwnerUserId: lead.ownerUserId,
      closerUserId: lead.closerUserId,
      plan: '2_instalments',
      invoiceRefNumber: invoiceCursor++,
    }),
  )
}

/* ── Historical admissions: 249, filling the older cohorts ──────────────── */

/** Cohort ids already fully covered by the current intake. */
const CURRENT_COHORT_QUOTA: Record<string, number> = {
  'coh-tr-t04': 5,
  'coh-da-c12': 12,
  'coh-da-c13': 18,
  'coh-ex-b09': 2,
  'coh-tc-t06': 6,
}

let alumniSlot = SLOTS.alumni.from
let hist2025 = 0
let hist2026 = 0
let historicalIndex = 0

for (const spec of cohortFillOrder) {
  const already = CURRENT_COHORT_QUOTA[spec.cohortId] ?? 0
  const remaining = spec.enrolled - already
  for (let i = 0; i < remaining; i++) {
    if (alumniSlot > SLOTS.alumni.to) break
    const personId = person(alumniSlot)
    alumniSlot += 1
    historicalIndex += 1
    const createdDay = addDays(spec.start, -int(r, 52, 88))
    const year = createdDay.slice(0, 4)
    const n = year === '2025' ? ++hist2025 : ++hist2026
    const id = year === '2025' ? `adm-2025-${pad(n)}` : `adm-${pad(n)}`
    const discountRoll = r()
    const discountType: DiscountType = discountRoll > 0.85 ? 'percentage' : 'none'
    admissions.push(
      makeAdmission({
        id,
        ref: `ADM-${year}-${pad(n)}`,
        leadId: null,
        personId,
        courseId: spec.courseId,
        cohortId: spec.cohortId,
        createdAt: at(createdDay, int(r, 9, 17), int(r, 0, 59)),
        status: 'enrolled',
        discountType,
        discountValue: discountType === 'percentage' ? pick(r, [5, 10, 12]) : 0,
        referrerPersonId: chance(r, 0.22) ? referrerPersonIds[alumniSlot % referrerPersonIds.length] : null,
        leadOwnerUserId: SALES_OWNERS[alumniSlot % SALES_OWNERS.length],
        closerUserId: CLOSERS[alumniSlot % CLOSERS.length],
        plan: weighted(r, [
          ['full', 50],
          ['2_instalments', 34],
          ['3_instalments', 13],
          ['4_instalments', 3],
        ] as const),
        // Only a slice of the historical intake carries an invoice in Cirvee OS;
        // the rest were migrated from the legacy ledger without theirs. Every
        // fifth one, deterministically, until the 0884–0928 block is used up.
        invoiceRefNumber: invoiceCursor <= 928 && historicalIndex % 5 === 0 ? invoiceCursor++ : null,
      }),
    )
  }
}

/* Eight historical withdrawals, so the withdrawn filter has depth. */
for (let i = 0; i < 8 && alumniSlot <= SLOTS.alumni.to; i++) {
  const personId = person(alumniSlot)
  alumniSlot += 1
  const spec = cohortFillOrder[i * 2]
  const createdDay = addDays(spec.start, -30)
  const year = createdDay.slice(0, 4)
  const n = year === '2025' ? ++hist2025 : ++hist2026
  const id = year === '2025' ? `adm-2025-${pad(n)}` : `adm-${pad(n)}`
  admissions.push(
    makeAdmission({
      id,
      ref: `ADM-${year}-${pad(n)}`,
      leadId: null,
      personId,
      courseId: spec.courseId,
      cohortId: spec.cohortId,
      createdAt: at(createdDay, 12, 0),
      status: 'withdrawn',
      discountType: 'none',
      discountValue: 0,
      referrerPersonId: null,
      leadOwnerUserId: SALES_OWNERS[i % SALES_OWNERS.length],
      closerUserId: null,
      plan: 'full',
      invoiceRefNumber: null,
    }),
  )
}

export { admissions }
export const admissionById = new Map<string, Admission>(admissions.map((a) => [a.id, a]))

/** Admissions that carry an invoice — `finance.ts` builds one invoice per entry. */
export const invoicedAdmissions = admissions.filter((a) => a.invoiceId !== null)

/* -------------------------------------------------------------------------- */
/* Follow-ups                                                                 */
/* -------------------------------------------------------------------------- */

const followUps: FollowUp[] = []
let fuSeq = 0

for (const lead of leads) {
  if (['enrolled', 'lost', 'invalid', 'not_interested'].includes(lead.stage)) continue
  if (!chance(r, 0.55)) continue
  fuSeq += 1
  const overdue = chance(r, 0.28)
  const dueDay = overdue ? daysAgo(int(r, 1, 9)) : addDays(TODAY, int(r, 0, 10))
  followUps.push({
    id: followUpId(`fu-${pad(fuSeq, 4)}`),
    leadId: lead.id,
    ownerUserId: lead.ownerUserId,
    action: lead.nextAction ?? pick(r, NEXT_ACTIONS),
    dueAt: at(dueDay, int(r, 9, 16), 0),
    status: 'open',
    outcome: null,
    completedAt: null,
    ...audit(lead.stageEnteredAt, lead.ownerUserId),
  })
}

/* A tail of completed and rescheduled follow-ups, so the status filter works. */
for (let i = 0; i < 64; i++) {
  const lead = leads[(i * 7) % leads.length]
  fuSeq += 1
  const status = i % 8 === 0 ? 'rescheduled' : i % 11 === 0 ? 'cancelled' : 'completed'
  const doneDay = daysAgo(int(r, 2, 60))
  followUps.push({
    id: followUpId(`fu-${pad(fuSeq, 4)}`),
    leadId: lead.id,
    ownerUserId: lead.ownerUserId,
    action: pick(r, NEXT_ACTIONS),
    dueAt: at(doneDay, 11, 0),
    status,
    outcome:
      status === 'completed'
        ? pick(r, ['Spoke — sending the plan', 'No answer, left a WhatsApp message', 'Booked a campus visit for Saturday'])
        : null,
    completedAt: status === 'completed' ? at(doneDay, int(r, 12, 17), 0) : null,
    ...audit(at(addDays(doneDay, -3), 10, 0), lead.ownerUserId),
  })
}

export { followUps }

/* -------------------------------------------------------------------------- */
/* Activity feed — ordinary, editable, and separate from the audit log        */
/* -------------------------------------------------------------------------- */

const activities: Activity[] = []
let actSeq = 0

function activity(
  subjectType: Activity['subjectType'],
  subjectId: string,
  type: Activity['type'],
  body: string,
  when: string,
  by: UserId,
  extra: Partial<Activity> = {},
): Activity {
  actSeq += 1
  return {
    id: activityId(`act-${pad(actSeq, 4)}`),
    subjectType,
    subjectId,
    type,
    body,
    attachmentIds: [],
    isSystemGenerated: type === 'system',
    ...audit(when, by),
    ...extra,
  }
}

/* Chiamaka's arc, hand-written — this is the timeline Flow 5 step 17 opens. */
const chiamakaLead = leads.find((l) => l.ref === 'CIR-L-0688')
if (chiamakaLead) {
  activities.push(
    activity('lead', chiamakaLead.id, 'system', 'Lead created from an event scan at TCF 2026, Ibadan.', '2026-08-04T11:26:00+01:00', U.chidinma),
    activity('lead', chiamakaLead.id, 'call', 'Called back. Wants the August intensive, not October. Asked about instalments and whether a laptop is provided.', '2026-08-04T12:07:00+01:00', U.chidinma, { callOutcome: 'connected', durationMinutes: 9 }),
    activity('lead', chiamakaLead.id, 'whatsapp', 'Sent the Data Analysis syllabus and the two-instalment schedule.', '2026-08-04T12:31:00+01:00', U.chidinma),
    activity('lead', chiamakaLead.id, 'note', 'Referred by Ngozi Adeyemi (DA Cohort 6). Ngozi vouched for her — worth prioritising.', '2026-08-05T09:14:00+01:00', U.chidinma),
    activity('lead', chiamakaLead.id, 'meeting', 'Campus visit. Met Tunde Bakare, sat in on the last hour of DA-C11 revision.', '2026-08-06T16:00:00+01:00', U.adebayo, { durationMinutes: 45 }),
    activity('lead', chiamakaLead.id, 'system', 'Stage changed to Enrolled. Admission ADM-2026-0151 created.', '2026-08-08T10:22:00+01:00', U.adebayo),
    activity('person', P.chiamaka, 'note', 'Strong Excel background already. Advised to skip ahead on Module 1 and spend the time on SQL.', '2026-08-12T15:40:00+01:00', U.tundeBakare),
    activity('person', P.chiamaka, 'note', 'Final project topic agreed: sales dataset analysis for a Bodija retail chain.', '2026-09-08T11:05:00+01:00', U.tundeBakare),
  )
}

/* Tunde Adeyemi — the balance conversation that blocks his certificate. */
activities.push(
  activity('person', P.tundeAdeyemi, 'call', 'Discussed the outstanding ₦120,000. Says the money comes in October. Reminded him certificates need financial clearance.', '2026-09-11T14:22:00+01:00', U.ibrahim, { callOutcome: 'connected', durationMinutes: 6 }),
  activity('person', P.tundeAdeyemi, 'whatsapp', 'Sent the balance statement and the payment link again.', '2026-09-11T14:31:00+01:00', U.ibrahim),
)

/* A realistic tail across the working leads. */
const ACTIVITY_BODIES = [
  'Called — no answer. Will try again tomorrow morning.',
  'Sent the course brochure and the instalment plan.',
  'Wants to start in January, not October. Moving to nurture.',
  'Asked whether the certificate is recognised by employers. Sent the outcomes page.',
  'Employer may sponsor. Asked for a pro-forma invoice addressed to the company.',
  'Confirmed they have a laptop. Cleared the only blocker.',
  'Compared us with a Lagos bootcamp on price. Explained the cohort size difference.',
  'WhatsApp read but no reply for four days.',
  'Walked in at the Bodija campus. Toured the lab.',
  'Asked about the Saturday option — none running for this course right now.',
]

for (let i = 0; i < 380; i++) {
  const lead = leads[(i * 13 + 5) % leads.length]
  const type = weighted(r, [
    ['call', 34],
    ['whatsapp', 27],
    ['note', 20],
    ['email', 12],
    ['meeting', 4],
    ['sms', 3],
  ] as const)
  const when = at(daysAgo(int(r, 0, 88)), int(r, 9, 18), int(r, 0, 59))
  activities.push(
    activity('lead', lead.id, type, pick(r, ACTIVITY_BODIES), when, lead.ownerUserId, {
      callOutcome: type === 'call' ? weighted(r, [['connected', 52], ['no_answer', 31], ['busy', 11], ['wrong_number', 6]] as const) : undefined,
      durationMinutes: type === 'call' ? int(r, 1, 18) : type === 'meeting' ? int(r, 20, 60) : undefined,
    }),
  )
}

export { activities }

/* -------------------------------------------------------------------------- */
/* Duplicate review queue                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fourteen pairs. The first is the one Flow 1 relies on: two Chiamaka Okonkwo
 * records sharing a phone number. The wizard's duplicate panel resolves
 * against Person directly, but this queue is where an ops lead clears the
 * backlog — and it must never be empty in a demo.
 */
export const duplicateCandidates: DuplicateCandidate[] = [
  {
    id: dupeId('dup-0001'),
    personAId: P.chiamaka,
    personBId: P.chiamakaDupe,
    score: 92,
    matchedFields: ['name', 'phone', 'dob'],
    status: 'open',
    resolvedAt: null,
    resolvedBy: null,
    resolutionNote: null,
  },
  {
    id: dupeId('dup-0002'),
    personAId: person(299),
    personBId: person(300),
    score: 97,
    matchedFields: ['email', 'phone', 'name'],
    status: 'merged',
    resolvedAt: at('2026-06-11', 14, 5),
    resolvedBy: U.folake,
    resolutionNote: 'Same person — the second record came from the February CSV import.',
  },
  ...Array.from({ length: 12 }, (_, i) => {
    const a = person(320 + i * 9)
    const b = person(321 + i * 9)
    const status = i < 6 ? 'open' : i < 9 ? 'not_duplicate' : i < 11 ? 'merged' : 'skipped'
    return {
      id: dupeId(`dup-${pad(i + 3, 4)}`),
      personAId: a,
      personBId: b,
      score: 62 + ((i * 7) % 33),
      matchedFields: (i % 3 === 0 ? ['phone', 'name'] : i % 3 === 1 ? ['email'] : ['whatsapp', 'name']) as DuplicateCandidate['matchedFields'],
      status: status as DuplicateCandidate['status'],
      resolvedAt: status === 'open' ? null : at(daysAgo(int(r, 3, 40)), 10, 0),
      resolvedBy: status === 'open' ? null : U.folake,
      resolutionNote:
        status === 'not_duplicate'
          ? 'Two brothers, same surname and household phone. Left separate.'
          : status === 'merged'
            ? 'Merged — the older record kept its timeline.'
            : status === 'skipped'
              ? 'Skipped for now. Needs the parent contacted first.'
              : null,
    }
  }),
]

/* -------------------------------------------------------------------------- */
/* Figures other modules read                                                 */
/* -------------------------------------------------------------------------- */

/** People with no lead, admission or relationship left behind — sanity aid. */
export const CRM_COUNTS = {
  leads: leads.length,
  admissions: admissions.length,
  enrolledAdmissions: admissions.filter((a) => a.status === 'enrolled').length,
  withdrawnAdmissions: admissions.filter((a) => a.status === 'withdrawn').length,
  pendingDiscount: admissions.filter((a) => a.status === 'pending_discount_approval').length,
  totalPeople: people.length,
} as const

void dtAgo
