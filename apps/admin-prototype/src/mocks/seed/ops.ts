/**
 * The twelve shallow modules' data: physical layer (cards, readers, taps,
 * visitors), employment outcomes, customer experience, corporate/B2B,
 * reputation, and meetings & decisions.
 *
 * These modules render their data rather than transact on it, so the seed is
 * deliberately lighter than CRM or Finance — but every row is real, and the
 * cascading records Flow 5 produces (outcome record, review request, proof
 * asset) have their predecessors here so the "five linked effects" panel has
 * a queue to land in.
 */

import {
  actionItemId,
  cardId as asCardId,
  clientOrgId as asClientOrgId,
  dealId as asDealId,
  decisionId as asDecisionId,
  employerId as asEmployerId,
  meetingId as asMeetingId,
  ngn,
  outcomeId as asOutcomeId,
  proofId,
  readerId as asReaderId,
  reviewReqId,
  tapId,
  testimonialId as asTestimonialId,
  ticketId as asTicketId,
  visitorId,
  certId,
  type ActionItem,
  type Card,
  type ClientOrg,
  type CorporateDeal,
  type Decision,
  type Employer,
  type Kobo,
  type Meeting,
  type OutcomeRecord,
  type ProofAsset,
  type Reader,
  type ReviewRequest,
  type TapEvent,
  type Testimonial,
  type Ticket,
  type TicketCategory,
  type Visitor,
} from '@/mocks/types'
import { BR, C, CO, ORGS, P, U, UNIT, person } from '@/mocks/seed/ids'
import { certificates, enrollments } from '@/mocks/seed/learn'
import { cohortById } from '@/mocks/seed/academy'
import { alumniPersonIds, fullName } from '@/mocks/seed/people'
import { addDays, at, audit, daysAgo, int, pad, pick, rng, TODAY } from '@/mocks/seed/_helpers'

const r = rng(909090)

/* -------------------------------------------------------------------------- */
/* Physical layer — cards and readers                                         */
/* -------------------------------------------------------------------------- */

function hexUid(i: number): string {
  const body = ((i * 7919) % 0xffffff).toString(16).toUpperCase().padStart(6, '0')
  const tail = (i % 255).toString(16).toUpperCase().padStart(2, '0')
  return `04${body}${tail}`
}

const activeEnrolments = enrollments.filter((e) => e.status === 'active')

export const cards: Card[] = [
  ...activeEnrolments.slice(0, 120).map((e, i) => ({
    id: asCardId(`crd-${pad(i + 1, 4)}`),
    cardId: `CRD-${pad(i + 1, 4)}`,
    uid: hexUid(i + 1),
    personId: e.personId,
    holderType: 'student' as const,
    branchId: cohortById.get(e.cohortId)?.branchId ?? BR.ibadan,
    accessProfile: 'Student — campus hours',
    issuedAt: addDays(e.enrolledAt, 2),
    issuedByUserId: U.emeka,
    status: i === 4 ? ('lost' as const) : i === 9 ? ('suspended' as const) : ('active' as const),
    deactivatedAt: i === 4 ? at(daysAgo(11), 10, 0) : null,
    deactivationReason: i === 4 ? 'Reported lost at the Bodija gate' : null,
    replacesCardId: null,
    replacedByCardId: i === 4 ? asCardId('crd-0201') : null,
    lastTapAt: at(daysAgo(int(r, 0, 6)), int(r, 7, 19), int(r, 0, 59)),
    ...audit(at(addDays(e.enrolledAt, 2), 10, 0), U.emeka),
  })),
  // The replacement for the lost card — a new record, the old one preserved.
  {
    id: asCardId('crd-0201'),
    cardId: 'CRD-0201',
    uid: hexUid(201),
    personId: activeEnrolments[4]?.personId ?? P.chiamaka,
    holderType: 'student',
    branchId: BR.ibadan,
    accessProfile: 'Student — campus hours',
    issuedAt: daysAgo(10),
    issuedByUserId: U.emeka,
    status: 'active',
    deactivatedAt: null,
    deactivationReason: null,
    replacesCardId: asCardId('crd-0005'),
    replacedByCardId: null,
    lastTapAt: at(daysAgo(1), 17, 22),
    ...audit(at(daysAgo(10), 11, 0), U.emeka),
  },
  ...Array.from({ length: 48 }, (_, i) => ({
    id: asCardId(`crd-s${pad(i + 1, 3)}`),
    cardId: `CRD-S${pad(i + 1, 3)}`,
    uid: hexUid(500 + i),
    personId: person(1 + (i % 52)),
    holderType: 'employee' as const,
    branchId: i % 5 === 0 ? BR.lagos : BR.ibadan,
    accessProfile: i < 9 ? 'Staff — all areas' : 'Staff — standard',
    issuedAt: daysAgo(int(r, 60, 900)),
    issuedByUserId: U.damilola,
    status: 'active' as const,
    deactivatedAt: null,
    deactivationReason: null,
    replacesCardId: null,
    replacedByCardId: null,
    lastTapAt: at(daysAgo(int(r, 0, 3)), int(r, 7, 18), int(r, 0, 59)),
    ...audit(at(daysAgo(int(r, 60, 900)), 10, 0), U.damilola),
  })),
]

const READERS: ReadonlyArray<readonly [string, string, Reader['type'], Reader['status'], string]> = [
  ['RDR-IBA-01', 'Bodija main gate', 'gate', 'online', 'Ibadan HQ — front gate'],
  ['RDR-IBA-02', 'Bodija reception kiosk', 'kiosk', 'online', 'Ibadan HQ — reception'],
  ['RDR-IBA-03', 'Lab 1 door', 'classroom', 'online', 'Ibadan HQ — Bodija Lab 1'],
  ['RDR-IBA-04', 'Lab 2 door', 'classroom', 'online', 'Ibadan HQ — Bodija Lab 2'],
  ['RDR-IBA-05', 'Staff entry', 'staff_entry', 'online', 'Ibadan HQ — side entrance'],
  ['RDR-IBA-06', 'Server room', 'restricted_area', 'online', 'Ibadan HQ — first floor'],
  ['RDR-IBA-07', 'Equipment desk', 'equipment_desk', 'fault', 'Ibadan HQ — store'],
  ['RDR-IBA-08', 'Seminar room', 'meeting_room', 'online', 'Ibadan HQ — ground floor'],
  ['RDR-LAG-01', 'Yaba main door', 'door', 'online', 'Lagos — Herbert Macaulay Way'],
  ['RDR-LAG-02', 'Yaba studio', 'classroom', 'offline', 'Lagos — studio'],
  ['RDR-LAG-03', 'Yaba staff entry', 'staff_entry', 'buffering', 'Lagos — rear entrance'],
  ['RDR-TCF-01', 'TCF conference gate', 'event_gate', 'online', 'Ibadan — event marquee'],
]

export const readers: Reader[] = READERS.map(([readerId, name, type, status, location], i) => ({
  id: asReaderId(readerId.toLowerCase()),
  readerId,
  name,
  type,
  branchId: readerId.includes('LAG') ? BR.lagos : BR.ibadan,
  location,
  status,
  lastHeartbeatAt: status === 'offline' ? at(daysAgo(0), 6, 12) : at(daysAgo(0), 8, 55 - i),
  bufferedEventCount: status === 'buffering' ? 14 : status === 'offline' ? 9 : 0,
  firmware: `2.${4 + (i % 3)}.1`,
  tapsToday: status === 'offline' ? 0 : int(r, 4, 180),
  ...audit(at(daysAgo(int(r, 200, 900)), 10, 0), U.damilola),
}))

export const tapEvents: TapEvent[] = Array.from({ length: 460 }, (_, i) => {
  const card = cards[i % cards.length]
  const reader = readers[i % readers.length]
  const buffered = reader.status === 'buffering' || reader.status === 'offline'
  const at_ = at(daysAgo(i % 7), int(r, 7, 19), int(r, 0, 59))
  const denied = i % 37 === 0
  return {
    id: tapId(`tap-${pad(i + 1, 5)}`),
    cardId: card.id,
    personId: card.personId,
    readerId: reader.id,
    at: at_,
    // A buffered reader syncs late — the timestamps genuinely differ.
    syncedAt: buffered ? at(daysAgo(Math.max(0, (i % 7) - 1)), 9, 4) : at_,
    wasBuffered: buffered,
    result: denied ? 'denied' : 'granted',
    denialReason: denied ? pick(r, ['card_deactivated', 'outside_access_hours', 'not_authorised_for_area', 'status_withdrawn'] as const) : null,
    sessionId: null,
    meetingId: null,
    overrideByUserId: denied && i % 74 === 0 ? U.emeka : null,
    overrideReason: denied && i % 74 === 0 ? 'Admitted by the operations manager — balance cleared at the desk' : null,
  }
})

export const visitors: Visitor[] = Array.from({ length: 34 }, (_, i) => {
  const checkedIn = at(daysAgo(i % 10), int(r, 9, 16), int(r, 0, 59))
  return {
    id: visitorId(`vis-${pad(i + 1, 4)}`),
    name: fullName(person(600 + (i % 40))),
    organisation: i % 3 === 0 ? pick(r, ['Sterling Bank Plc', 'Interswitch', 'IBEDC', 'Flutterwave', null]) : null,
    hostPersonId: person(1 + (i % 20)),
    purpose: pick(r, ['Course enquiry', 'Corporate training discussion', 'Parent meeting', 'Equipment delivery', 'Interview']),
    badgeNumber: `V-${pad(i + 1, 4)}`,
    branchId: i % 4 === 0 ? BR.lagos : BR.ibadan,
    phone: `+234 80${int(r, 3, 9)} ${pad(int(r, 100, 999), 3)} ${pad(int(r, 1000, 9999), 4)}`,
    checkedInAt: checkedIn,
    checkedOutAt: i % 8 === 0 ? null : at(checkedIn.slice(0, 10), Number(checkedIn.slice(11, 13)) + 1, 30),
    ...audit(checkedIn, U.folake),
  }
})

/* -------------------------------------------------------------------------- */
/* Employment outcomes                                                        */
/* -------------------------------------------------------------------------- */

const EMPLOYERS: ReadonlyArray<readonly [string, string, string, string, number]> = [
  ['Sterling Bank Plc', 'Banking', '1,000+', 'Lagos', 7],
  ['Interswitch', 'Fintech', '1,000+', 'Lagos', 5],
  ['Flutterwave', 'Fintech', '500–1,000', 'Lagos', 4],
  ['Ibadan Electricity Distribution Company', 'Utilities', '1,000+', 'Ibadan', 6],
  ['Sycamore', 'Fintech', '50–200', 'Lagos', 3],
  ['Oando', 'Energy', '1,000+', 'Lagos', 2],
  ['MTN Nigeria', 'Telecoms', '1,000+', 'Lagos', 3],
  ['Dangote Industries', 'Manufacturing', '1,000+', 'Lagos', 2],
  ['Kobo360', 'Logistics', '200–500', 'Lagos', 2],
  ['Paystack', 'Fintech', '200–500', 'Lagos', 3],
  ['Andela', 'Technology', '500–1,000', 'Lagos', 2],
  ['Bodija Retail Group', 'Retail', '50–200', 'Ibadan', 4],
]

export const employers: Employer[] = EMPLOYERS.map(([name, industry, size, location, hired], i) => ({
  id: asEmployerId(`emp-org-${pad(i + 1, 3)}`),
  name,
  industry,
  size,
  location,
  graduatesHired: hired,
  firstHireDate: daysAgo(int(r, 300, 900)),
  lastHireDate: daysAgo(int(r, 10, 200)),
  relationshipOwnerUserId: i < 6 ? U.chukwuemeka : null,
  partnershipStatus: i < 3 ? 'hiring_partner' : i < 6 ? 'partner' : i < 9 ? 'informal' : 'none',
  satisfactionScore: i < 6 ? 4 + (i % 2) : null,
  ...audit(at(daysAgo(int(r, 300, 900)), 10, 0), U.chukwuemeka),
}))

const issuedCertificates = certificates.filter((c) => c.status === 'issued')

export const outcomeRecords: OutcomeRecord[] = issuedCertificates.slice(0, 39).map((cert, i) => {
  const graduatedAt = cert.issuedAt?.slice(0, 10) ?? daysAgo(60)
  const placed = i % 3 !== 0
  const employer = employers[i % employers.length]
  return {
    id: asOutcomeId(`out-${pad(380 + i, 4)}`),
    personId: cert.personId,
    certificateId: cert.id,
    courseId: cert.courseId,
    cohortId: cert.cohortId,
    graduatedAt,
    outcomeType: placed ? pick(r, ['full_time', 'full_time', 'contract', 'freelance', 'internship', 'self_employed'] as const) : 'not_yet_placed',
    employerId: placed ? employer.id : null,
    jobTitle: placed ? pick(r, ['Data Analyst', 'Junior Product Designer', 'Frontend Developer', 'Business Analyst', 'Reporting Officer', 'Digital Marketing Executive']) : null,
    placementDate: placed ? addDays(graduatedAt, int(r, 20, 140)) : null,
    location: placed ? employer.location : null,
    incomeChange: placed && i % 4 === 0 ? { before: ngn(int(r, 80, 180) * 1000), after: ngn(int(r, 250, 550) * 1000), selfReported: true, volunteered: true } : null,
    relevanceToCourse: placed ? pick(r, ['direct', 'direct', 'adjacent', 'unrelated'] as const) : null,
    consentForPublicUse: placed && i % 3 === 1,
    consentCapturedAt: placed && i % 3 === 1 ? at(addDays(graduatedAt, 30), 12, 0) : null,
    checkpoints: ([3, 6, 12] as const).map((month) => {
      const dueDate = addDays(graduatedAt, month * 30)
      const past = dueDate < TODAY
      return {
        month,
        dueDate,
        status: past ? (i % 4 === 0 ? ('no_response' as const) : ('responded' as const)) : ('scheduled' as const),
        respondedAt: past && i % 4 !== 0 ? at(addDays(dueDate, 3), 14, 0) : null,
        attempts: past ? (i % 4 === 0 ? 3 : 1) : 0,
        lastChannel: past ? ('whatsapp' as const) : null,
      }
    }),
    verifiedByUserId: placed ? U.folake : null,
    notes: placed ? 'Confirmed by the graduate and cross-checked against their LinkedIn profile.' : 'Still searching. Referred to the September employer clinic.',
    ...audit(at(graduatedAt, 12, 0), U.folake),
  }
})

/* -------------------------------------------------------------------------- */
/* Reputation                                                                 */
/* -------------------------------------------------------------------------- */

export const reviewRequests: ReviewRequest[] = issuedCertificates.slice(0, 44).map((cert, i) => {
  const sentAt = at(addDays(cert.issuedAt?.slice(0, 10) ?? daysAgo(40), 1), 10, 0)
  const opened = i % 3 !== 0
  return {
    id: reviewReqId(`rvq-${pad(i + 1, 4)}`),
    personId: cert.personId,
    triggerMoment: i % 5 === 0 ? 'strong_grade' : i % 7 === 0 ? 'placement_confirmed' : 'certificate_issued',
    sourceEventType: 'Certificate',
    sourceEventId: cert.id,
    sentAt,
    channel: i % 4 === 0 ? 'email' : 'whatsapp',
    openedAt: opened ? at(addDays(sentAt.slice(0, 10), 1), 12, 0) : null,
    clickedAt: opened && i % 2 === 0 ? at(addDays(sentAt.slice(0, 10), 1), 12, 4) : null,
    reviewed: opened && i % 2 === 0,
    rating: opened && i % 2 === 0 ? 4 + (i % 2) : null,
    branchId: cert.issuingBranchId,
    cohortId: cert.cohortId,
    ...audit(sentAt, U.amarachi),
  }
})

const TESTIMONIAL_QUOTES: ReadonlyArray<readonly [string, string]> = [
  ['Data Analyst at Sterling Bank', 'I came in able to make a pivot table and left able to defend a recommendation to a head of department. The difference was the project work, not the lectures.'],
  ['Junior Product Designer at Sycamore', 'The usability test module changed how I argue. I stopped saying "I think" and started saying "five people did this".'],
  ['Frontend Developer, freelance', 'Three months after the cohort I had two retainer clients. The portfolio review sessions are what made that possible.'],
  ['Reporting Officer at IBEDC', 'The SQL module paid for the course in the first month. I stopped waiting four days for an extract.'],
  ['Digital Marketing Executive at Kobo360', 'I had run ads before. What I had not done was read the numbers honestly afterwards.'],
  ['Business Analyst at Interswitch', 'Tunde marks hard and explains why. That is worth more than a certificate.'],
  ['Self-employed — Bodija Retail Group', 'I analysed my own shop’s sales for the capstone and found ₦400,000 a month leaking through one supplier.'],
  ['Data Analyst at Flutterwave', 'The low-data video option mattered more than I expected. I did half the course on my phone on the bus.'],
]

export const testimonials: Testimonial[] = TESTIMONIAL_QUOTES.map(([outcome, quote], i) => {
  const personId = alumniPersonIds[i * 7] ?? P.ngozi
  const enrolment = enrollments.find((e) => e.personId === personId)
  const capturedAt = at(daysAgo(int(r, 10, 220)), 14, 0)
  return {
    id: asTestimonialId(`tst-${pad(i + 1, 4)}`),
    personId,
    courseId: enrolment?.courseId ?? C.dataAnalysis,
    cohortId: enrolment?.cohortId ?? CO.daC12,
    outcome,
    quote,
    capturedAt,
    capturedByUserId: U.amarachi,
    channel: i % 3 === 0 ? 'email' : 'whatsapp',
    consentGranted: i !== 5,
    consentCapturedAt: i !== 5 ? capturedAt : null,
    mediaUrls: i % 4 === 0 ? [`/testimonials/${pad(i + 1, 4)}.jpg`] : [],
    tags: ['outcome', i < 4 ? 'placement' : 'skills'],
    usage: i < 3 ? [{ where: 'Course landing page', publishedAt: addDays(capturedAt.slice(0, 10), 14) }] : [],
    status: i < 3 ? 'published' : i < 6 ? 'approved' : 'new',
    ...audit(capturedAt, U.amarachi),
  }
})

export const proofAssets: ProofAsset[] = [
  ...issuedCertificates.slice(0, 22).map((cert, i) => ({
    id: proofId(`prf-${pad(i + 1, 4)}`),
    type: 'graduation' as const,
    subjectPersonId: cert.personId,
    sourceEventType: 'Certificate',
    sourceEventId: cert.id,
    sourceEventRef: cert.certificateId,
    // Drafted automatically, seconds after the certificate was issued.
    draftedAt: at(cert.issuedAt?.slice(0, 10) ?? daysAgo(40), 12, 1),
    assigneeUserId: i < 6 ? U.amarachi : null,
    status: (i < 4 ? 'published' : i < 9 ? 'approved' : i < 14 ? 'in_production' : 'drafted') as ProofAsset['status'],
    channel: i < 9 ? pick(r, ['Instagram', 'LinkedIn', 'Website']) : null,
    publishedUrl: i < 4 ? `https://instagram.com/p/cirvee-${pad(i + 1, 4)}` : null,
    consentStatus: (i % 5 === 0 ? 'pending' : i % 11 === 0 ? 'declined' : 'granted') as ProofAsset['consentStatus'],
    ...audit(at(cert.issuedAt?.slice(0, 10) ?? daysAgo(40), 12, 1), U.amarachi),
  })),
  ...outcomeRecords.filter((o) => o.employerId !== null).slice(0, 10).map((o, i) => ({
    id: proofId(`prf-p${pad(i + 1, 3)}`),
    type: 'placement' as const,
    subjectPersonId: o.personId,
    sourceEventType: 'OutcomeRecord',
    sourceEventId: o.id,
    sourceEventRef: o.id.toUpperCase(),
    draftedAt: at(o.placementDate ?? daysAgo(30), 9, 5),
    assigneeUserId: U.amarachi,
    status: (i < 3 ? 'approved' : 'drafted') as ProofAsset['status'],
    channel: i < 3 ? 'LinkedIn' : null,
    publishedUrl: null,
    consentStatus: (o.consentForPublicUse ? 'granted' : 'pending') as ProofAsset['consentStatus'],
    ...audit(at(o.placementDate ?? daysAgo(30), 9, 5), U.amarachi),
  })),
]

/* -------------------------------------------------------------------------- */
/* Customer experience                                                        */
/* -------------------------------------------------------------------------- */

const TICKET_SUBJECTS: ReadonlyArray<readonly [string, TicketCategory, string]> = [
  ['Payment made but balance still showing', 'payments', 'I transferred ₦202,500 on Tuesday from GTBank but my portal still shows the full balance.'],
  ['Cannot download the lesson videos offline', 'technical', 'The download button spins and then fails on my Tecno. Wi-fi is fine.'],
  ['Certificate not issued after completing everything', 'certificate', 'I have finished all assignments and my attendance is 84%. What is outstanding?'],
  ['Tutor missed two sessions', 'tutor', 'Wednesday and Friday last week were both cancelled at short notice.'],
  ['Request to move to the evening cohort', 'class', 'My work hours changed. Can I switch from the morning group?'],
  ['Refund request — withdrew after two weeks', 'refund', 'I can no longer continue and would like the pro-rata refund discussed.'],
  ['No audio version for module 3 lessons', 'technical', 'Some lessons have audio and some do not. Is that deliberate?'],
  ['Wrong name on my certificate', 'certificate', 'My surname is spelt Okonkwo, not Okonwko.'],
  ['Class WhatsApp group link expired', 'class', 'The invite in the welcome message no longer works.'],
  ['Complaint about the Lagos venue', 'complaint', 'The studio had no power for the first hour on Saturday.'],
]

export const tickets: Ticket[] = Array.from({ length: 58 }, (_, i) => {
  const [subject, category, body] = TICKET_SUBJECTS[i % TICKET_SUBJECTS.length]
  const created = at(daysAgo(int(r, 0, 45)), int(r, 8, 19), int(r, 0, 59))
  const status: Ticket['status'] =
    i < 9 ? (['new', 'open', 'pending_customer'] as const)[i % 3] : i < 12 ? 'escalated' : i < 16 ? 'reopened' : i % 2 === 0 ? 'resolved' : 'closed'
  const open = ['new', 'open', 'pending_customer', 'escalated', 'reopened'].includes(status)
  const responded = status !== 'new'
  const requesterPersonId = person(53 + (i % 240))
  return {
    id: asTicketId(`tkt-${pad(i + 1, 4)}`),
    ref: `TKT-2026-${pad(i + 1, 4)}`,
    subject,
    requesterPersonId,
    category,
    priority: i < 4 ? 'urgent' : i < 12 ? 'high' : i % 3 === 0 ? 'low' : 'normal',
    status,
    ownerUserId: status === 'new' ? null : [U.folake, U.ibrahim, U.emeka][i % 3],
    source: (['student_portal', 'whatsapp', 'email', 'parent_portal', 'staff'] as const)[i % 5],
    relatedEntityType: category === 'payments' || category === 'refund' ? 'Invoice' : null,
    relatedEntityId: null,
    createdAtTime: created,
    firstResponseAt: responded ? at(created.slice(0, 10), Number(created.slice(11, 13)) + int(r, 1, 6), 0) : null,
    slaPolicyId: 'sla-cx-standard',
    slaState: i < 2 ? 'breached' : i < 5 ? 'due_soon' : 'within',
    resolvedAt: open ? null : at(daysAgo(int(r, 1, 30)), 16, 0),
    resolution: open ? null : 'Resolved and confirmed with the requester.',
    messages: [
      { id: `${i}-1`, at: created, direction: 'inbound', authorPersonId: requesterPersonId, channel: 'whatsapp', body, attachmentIds: [] },
      ...(responded
        ? [
            {
              id: `${i}-2`,
              at: at(created.slice(0, 10), Number(created.slice(11, 13)) + 2, 0),
              direction: 'outbound' as const,
              authorPersonId: P.folake,
              channel: 'whatsapp' as const,
              body: 'Thanks for flagging this — I am checking with the team now and will come back to you today.',
              attachmentIds: [],
            },
          ]
        : []),
    ],
    ...audit(created, U.folake),
  }
})

/* -------------------------------------------------------------------------- */
/* Corporate / B2B                                                            */
/* -------------------------------------------------------------------------- */

const CLIENT_ORGS: ReadonlyArray<readonly [string, string, string, string, number, number, number]> = [
  [ORGS.sterling, 'Sterling Bank Plc', 'Banking', '1,000+', 52_000_000, 19_830_000, 128],
  [ORGS.interswitch, 'Interswitch', 'Fintech', '1,000+', 14_400_000, 1_280_000, 44],
  [ORGS.flutterwave, 'Flutterwave', 'Fintech', '500–1,000', 9_600_000, 0, 30],
  [ORGS.oando, 'Oando', 'Energy', '1,000+', 6_400_000, 0, 20],
  [ORGS.mtn, 'MTN Nigeria', 'Telecoms', '1,000+', 24_000_000, 0, 75],
  [ORGS.dangote, 'Dangote Industries', 'Manufacturing', '1,000+', 3_200_000, 0, 10],
  [ORGS.ibedc, 'Ibadan Electricity Distribution Company', 'Utilities', '1,000+', 11_200_000, 960_000, 35],
  [ORGS.sycamore, 'Sycamore', 'Fintech', '50–200', 2_400_000, 0, 8],
]

export const clientOrgs: ClientOrg[] = CLIENT_ORGS.map(([id, name, industry, size, lifetime, outstanding, trained], i) => ({
  id: asClientOrgId(id),
  name,
  industry,
  size,
  primaryContactPersonId: person(636 + (i % 5)),
  accountOwnerUserId: U.chukwuemeka,
  contactPersonIds: [person(636 + (i % 5)), person(612 + i)],
  lifetimeRevenue: ngn(lifetime),
  outstandingBalance: ngn(outstanding),
  participantsTrained: trained,
  renewalDate: i < 5 ? addDays(TODAY, 30 + i * 45) : null,
  portalAccessEnabled: i < 3,
  ...audit(at(daysAgo(int(r, 300, 1000)), 10, 0), U.chukwuemeka),
}))

/** [org, title, stage, value ₦, probability %, owner, days in stage, close offset days, next action, source, created days ago] */
const DEALS: ReadonlyArray<
  readonly [string, string, CorporateDeal['stage'], number, number, (typeof U)[keyof typeof U], number, number, string | null, string, number]
> = [
  [ORGS.sterling, 'Data & Analytics upskilling — 40 seats', 'delivery', 19_800_000, 100, U.blessing, 28, -35, null, 'Existing client', 160],
  [ORGS.mtn, 'Graduate trainee technical academy — 60 seats', 'completed', 18_000_000, 100, U.chukwuemeka, 12, -120, null, 'Outbound', 300],
  [ORGS.interswitch, 'Product design bootcamp for the design team — 15 seats', 'won', 7_500_000, 100, U.blessing, 6, 14, 'Confirm the cohort start date with the L&D lead', 'Referral — alumnus', 90],
  [ORGS.flutterwave, 'Frontend engineering conversion programme — 20 seats', 'negotiation', 9_600_000, 70, U.blessing, 18, 21, 'Chase the signed contract', 'Inbound — website', 75],
  [ORGS.ibedc, 'Excel & reporting for branch managers — 30 seats', 'renewal', 6_000_000, 70, U.chukwuemeka, 9, 40, 'Send renewal terms for the second cohort', 'Existing client', 30],
  [ORGS.oando, 'Cybersecurity awareness for all staff — 50 seats', 'proposal', 12_000_000, 50, U.blessing, 62, 10, 'Follow up on the proposal sent in July', 'Lagos Tech Week', 110],
  [ORGS.dangote, 'Digital marketing for the retail team — 12 seats', 'proposal', 3_600_000, 50, U.blessing, 11, 30, 'Walk the HR lead through the proposal', 'Outbound', 40],
  [ORGS.sycamore, 'Cloud migration readiness — 10 seats', 'qualified', 2_400_000, 35, U.blessing, 51, 45, 'Book the scoping call', 'Partner introduction', 70],
  [ORGS.sterling, 'Python for credit risk analysts — 25 seats', 'discovery', 11_250_000, 20, U.blessing, 14, 60, 'Send discovery notes and a draft outline', 'Existing client', 20],
  [ORGS.mtn, 'Customer support AI tooling workshop — 35 seats', 'prospect', 8_750_000, 15, U.chukwuemeka, 5, 75, 'Qualify the budget with the head of customer operations', 'Referral — existing client', 5],
]

export const corporateDeals: CorporateDeal[] = DEALS.map(
  ([org, title, stage, naira, probability, owner, daysInStage, closeOffset, nextAction, source, createdDaysAgo], i) => {
    const value = ngn(naira)
    return {
      id: asDealId(`dl-${pad(i + 1, 4)}`),
      ref: `DEAL-2026-${pad(i + 1, 4)}`,
      organisationId: asClientOrgId(org),
      title,
      stage,
      value,
      probability,
      weightedValue: Math.round((value * probability) / 100) as Kobo,
      ownerUserId: owner,
      unitId: UNIT.corporate,
      source,
      expectedCloseDate: addDays(TODAY, closeOffset),
      stageEnteredAt: at(daysAgo(daysInStage), 11, 0),
      nextAction,
      ...audit(at(daysAgo(createdDaysAgo), 10, 0), owner),
    }
  },
)

/* -------------------------------------------------------------------------- */
/* Meetings and decisions                                                     */
/* -------------------------------------------------------------------------- */

const MEETINGS: ReadonlyArray<readonly [string, Meeting['type'], number, string[]]> = [
  ['Weekly leadership', 'weekly_leadership', 0, ['Collected vs invoiced — where is the 26%?', 'Exception queue: 11 open', 'DA-C13 tutor cover', 'Exit EXT-2026-0001 blocked on commissions']],
  ['Weekly admissions stand-up', 'weekly_admissions', 2, ['Median first response is 4h 12m', 'Four discount requests over 15%', 'October intake seat count']],
  ['Monthly business review — August', 'monthly_business_review', 21, ['Unit P&L by the six units', 'Referral conversion 21.9% vs 13.8% overall', 'Payroll close and adjustments']],
  ['Quarterly reset — Q4 2026', 'quarterly_reset', -8, ['Content coverage: 13 of 15 courses are video-only', 'Commission rule v4 proposal', 'Lagos campus capacity']],
  ['Weekly leadership', 'weekly_leadership', 7, ['Refund policy threshold review', 'Attendance policy — consequence stays off', 'Corporate pipeline']],
  ['Ad hoc — reconciliation backlog', 'ad_hoc', 4, ['Nine unmatched payments', 'Hiring a reconciliation officer']],
]

export const meetings: Meeting[] = MEETINGS.map(([title, type, daysOffset, agenda], i) => {
  const day = daysOffset >= 0 ? daysAgo(daysOffset) : addDays(TODAY, -daysOffset)
  const held = day <= TODAY
  return {
    id: asMeetingId(`mtg-${pad(i + 1, 4)}`),
    title,
    type,
    startAt: at(day, 9, 0),
    durationMinutes: type === 'monthly_business_review' || type === 'quarterly_reset' ? 180 : 60,
    chairUserId: type === 'weekly_admissions' ? U.ifeoma : U.musa,
    location: 'Bodija Seminar Room',
    meetingUrl: 'https://meet.cirvee.com/leadership',
    agendaItems: agenda.map((agendaTitle, j) => ({
      sequence: j + 1,
      title: agendaTitle,
      ownerUserId: [U.oluwaseun, U.damilola, U.emeka, U.yetunde][j % 4],
      timeboxMinutes: 15,
      notes: held ? 'Discussed. Action recorded.' : '',
    })),
    attendance: [P.musa, P.adebayo, P.oluwaseun, P.ifeoma, P.yetunde, P.damilola].map((personId, j) => ({
      personId,
      method: (j === 5 ? 'apology' : j % 2 === 0 ? 'nfc_tap' : 'platform_log') as 'nfc_tap' | 'platform_log' | 'apology',
      arrivedAt: j === 5 ? null : at(day, 9, j),
    })),
    minutesCirculatedAt: held ? at(day, 16, 0) : null,
    status: held ? 'held' : 'scheduled',
    ...audit(at(addDays(day, -5), 10, 0), U.musa),
  }
})

const ACTION_ITEMS: ReadonlyArray<readonly [string, ActionItem['status'], number, number]> = [
  ['Publish the Unit P&L definition so everyone computes margin the same way', 'in_progress', 0, 1],
  ['Decide whether lead owners are ever paid commission, or the field is attribution only', 'open', 0, 3],
  ['Fill the audio gap on the five Data Analysis lessons', 'in_progress', 1, 2],
  ['Hire a second Data tutor before DA-C13 starts', 'blocked', 0, 1],
  ['Clear the eleven automation exceptions', 'open', 0, 0],
  ['Close the Aug payroll adjustment queries', 'done', 2, 0],
  ['Agree the discount threshold bands with the founder', 'carried_forward', 2, 4],
  ['Settle the commission receivable blocking EXT-2026-0001', 'open', 0, 1],
  ['Confirm the response-time SLA target — 120 minutes is a placeholder', 'carried_forward', 1, 5],
  ['Review the Lagos studio power contract', 'open', 5, 0],
  ['Draft the Q4 corporate pipeline plan', 'in_progress', 2, 0],
  ['Decide on a parent-facing surface for Cirvee Teens', 'open', 3, 2],
]

export const actionItems: ActionItem[] = ACTION_ITEMS.map(([title, status, meetingIdx, carried], i) => ({
  id: actionItemId(`act-item-${pad(i + 1, 4)}`),
  title,
  meetingId: meetings[meetingIdx].id,
  ownerUserId: [U.oluwaseun, U.ifeoma, U.emeka, U.damilola, U.yetunde, U.amarachi][i % 6],
  deadline: addDays(TODAY, [7, 14, 10, 5, 3, -20, 21, 9, 28, 30, 18, 45][i]),
  status,
  carriedForwardCount: carried,
  lastUpdateAt: at(daysAgo(int(r, 0, 12)), 15, 0),
  lastUpdateNote: status === 'blocked' ? 'Blocked on the hire approval, which is nine days old.' : status === 'carried_forward' ? 'Moved again — still waiting on a founder decision.' : 'On track.',
  relatedEntityType: null,
  relatedEntityId: null,
  ...audit(meetings[meetingIdx].startAt, U.musa),
}))

const DECISIONS: ReadonlyArray<readonly [string, string, string, string[], string[], number, Decision['status']]> = [
  [
    'DEC-0009',
    'Attendance never produces an automatic salary deduction',
    'The attendance policy engine will calculate and surface consequences, but financialConsequenceEnabled ships as false and stays false until the board revisits it. Managers are notified; payroll is not touched.',
    ['Two incidents in 2025 where a reader fault produced a deduction that had to be reversed by hand.', 'Nigerian labour practice and staff trust both argue against automated deductions.'],
    ['Deduct automatically with a dispute window', 'Deduct only above a threshold', 'Notify only'],
    120,
    'active',
  ],
  [
    'DEC-0011',
    'Referrer, lead owner and closer stay three independent fields',
    'No rule derives one from another. A commission rule declares which role it pays. One admission may produce commissions for more than one role.',
    ['Collapsing them lost attribution in the legacy system and caused four disputes in Q1.'],
    ['Single "attributed to" field', 'Referrer and owner only'],
    210,
    'active',
  ],
  [
    'DEC-0014',
    'Commission rules are effective-dated configuration, never code',
    'Editing a rule creates a new version with its own effective range. Existing commissions keep their version and their computed amount and are never recalculated.',
    ['A rate change in March 2025 silently rewrote 60 historical commissions and cost two days of reconciliation.'],
    ['Edit in place with an audit trail', 'Edit in place and recalculate'],
    180,
    'active',
  ],
  [
    'DEC-0016',
    'Collected and invoiced revenue are always reported separately',
    'No screen nets one against the other. The collection rate is shown as a ratio so the gap is visible rather than hidden.',
    ['Leadership was reading invoiced revenue as cash for most of 2025.'],
    ['Report collected only', 'Report a single "revenue" figure'],
    95,
    'active',
  ],
  [
    'DEC-0018',
    'Discount threshold: 15% to Head of Growth, 30% to the Chief Executive',
    'Provisional bands pending the founder’s decision. Seeded so the vertical slice can be demonstrated end to end.',
    ['The vertical slice needs a threshold to exist. These numbers are a placeholder, not a policy.'],
    ['10% / 25%', 'Flat 20% single approver'],
    40,
    'active',
  ],
  [
    'DEC-0007',
    'Nothing is ever hard-deleted',
    'Financial, payroll, attendance and approval records are corrected by new records — credit notes, reversals, adjustments — never by editing or removing the original.',
    ['Auditability, and two disputes that could not be resolved because a row had been deleted.'],
    ['Soft delete with an undo window', 'Delete with an audit log'],
    300,
    'active',
  ],
  [
    'DEC-0004',
    'One purple across the whole product',
    'Superseded by DEC-0012. Kept for the record.',
    ['Six purples were in use across the legacy codebase.'],
    ['Keep the existing palette'],
    400,
    'superseded',
  ],
]

export const decisions: Decision[] = DECISIONS.map(([ref, title, decision, rationale, alternatives, daysBack, status], i) => ({
  id: asDecisionId(ref.toLowerCase()),
  ref,
  title,
  decision,
  rationale: rationale.join(' '),
  alternativesConsidered: [...alternatives],
  decidedByUserIds: [U.musa, U.adebayo, U.oluwaseun],
  decidedOn: daysAgo(daysBack),
  meetingId: meetings[i % meetings.length].id,
  affectedAreas: ['Payroll', 'Referral', 'Finance', 'Learn', 'CRM'].slice(0, 2 + (i % 3)),
  supersedesDecisionId: null,
  supersededByDecisionId: status === 'superseded' ? asDecisionId('dec-0012') : null,
  status,
  reviewDate: status === 'active' ? addDays(TODAY, 90 + i * 30) : null,
  ...audit(at(daysAgo(daysBack), 11, 0), U.musa),
}))

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const OPS_COUNTS = {
  cards: cards.length,
  readers: readers.length,
  tapEvents: tapEvents.length,
  visitors: visitors.length,
  employers: employers.length,
  outcomeRecords: outcomeRecords.length,
  tickets: tickets.length,
  clientOrgs: clientOrgs.length,
  corporateDeals: corporateDeals.length,
  reviewRequests: reviewRequests.length,
  testimonials: testimonials.length,
  proofAssets: proofAssets.length,
  meetings: meetings.length,
  decisions: decisions.length,
} as const

void certId
