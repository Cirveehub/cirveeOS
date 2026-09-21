/**
 * Every write the physical layer performs, plus the rule that makes the whole
 * module worth having.
 *
 * **Access derives from status.** `accessDecision()` reads the person's live
 * relationships, enrolment and balance and returns what the reader would do
 * right now. Nobody revokes a card when a student withdraws or stops paying —
 * the card simply stops opening the door, because the rule reads the status
 * rather than a separately maintained access list. The issue screen shows that
 * decision before a card is handed over, so a card is never issued to someone
 * it will not work for.
 *
 * Card issue and deactivation are both audited, per the PRD's audited-actions
 * list. A lost card is never removed — it is deactivated with a reason and the
 * replacement points back at it.
 */

import { formatNaira } from '@/lib/format'
import {
  TODAY,
  CURRENT_USER_ID,
  activitiesCollection,
  auditEventsCollection,
  cardsCollection,
  enrollmentsCollection,
  invoicesCollection,
  leadsCollection,
  peopleCollection,
  readersCollection,
  relationshipsCollection,
  rolesCollection,
  tapEventsCollection,
  unitsCollection,
  usersCollection,
  visitorsCollection,
} from '@/mocks'
import {
  activityId as asActivityId,
  auditId as asAuditId,
  cardId as asCardId,
  leadId as asLeadId,
  pid as asPersonId,
  relId as asRelationshipId,
  tapId as asTapId,
  visitorId as asVisitorId,
  type AuditEvent,
  type BranchId,
  type Card,
  type CardId,
  type CourseId,
  type Lead,
  type LeadStage,
  type Mode,
  type Person,
  type PersonId,
  type ReaderId,
  type UnitId,
  type UserId,
  type Visitor,
} from '@/mocks/types'

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

export function nowIso(): string {
  const d = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}+01:00`
}

function auditable(at: string = nowIso()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

function personName(id: string | null | undefined): string {
  if (!id) return 'Unknown person'
  const person = peopleCollection.find(id)
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
}

function userName(id: string | null | undefined): string {
  if (!id) return 'Unassigned'
  const user = usersCollection.find(id)
  if (!user) return 'Unknown user'
  return personName(user.personId) || user.email
}

/* -------------------------------------------------------------------------- */
/* Audit                                                                      */
/* -------------------------------------------------------------------------- */

let auditSequence = 0

export function emitAudit(input: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): AuditEvent {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0]
    ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff')
    : 'Staff'

  return auditEventsCollection.insert({
    id: asAuditId(`aud-phy-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: nowIso(),
    actorUserId: CURRENT_USER_ID,
    actorName: userName(CURRENT_USER_ID),
    actorRole: roleName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: 'ui',
    ip: '102.89.34.17',
  })
}

/* -------------------------------------------------------------------------- */
/* Access derives from status                                                 */
/* -------------------------------------------------------------------------- */

export interface AccessDecision {
  /** What a reader would do for this person right now. */
  granted: boolean
  /** The status the decision is read from, in plain words. */
  standing: string
  /** Why a reader would deny, matching the tap log's denial reasons. */
  denialReason:
    | 'card_deactivated'
    | 'outside_access_hours'
    | 'status_withdrawn'
    | 'unpaid_balance'
    | 'not_authorised_for_area'
    | null
  /** Worth saying at the desk even when access is granted. */
  notes: string[]
}

/**
 * The rule, in one function. It reads relationships, enrolment and balance —
 * never a stored "has access" flag, because that flag is exactly the thing
 * nobody remembers to turn off.
 */
export function accessDecision(personId: PersonId): AccessDecision {
  const notes: string[] = []

  const relationships = relationshipsCollection.where((r) => r.personId === personId)
  const active = relationships.filter((r) => r.status === 'active')
  const student = active.find((r) => r.type === 'student')
  const staff = active.find((r) => r.type === 'employee' || r.type === 'tutor')
  const alumnus = active.find((r) => r.type === 'alumnus')

  const enrolments = enrollmentsCollection.where((e) => e.personId === personId)
  const withdrawn = enrolments.length > 0 && enrolments.every((e) => e.status === 'withdrawn')

  const invoices = invoicesCollection.where((i) => i.personId === personId && i.status !== 'cancelled')
  const balance = invoices.reduce((acc, i) => acc + i.balance, 0)
  const overdue = invoices.some((i) => i.daysOverdue > 0 && i.balance > 0)

  if (!student && !staff && !alumnus) {
    const ended = relationships.find((r) => r.status === 'ended')
    return {
      granted: false,
      standing: ended
        ? `No active relationship — ${ended.type.replace(/_/g, ' ')} ended ${ended.endDate ?? 'previously'}`
        : 'No active relationship on record',
      denialReason: 'status_withdrawn',
      notes: ['A card issued now would not open anything. Access follows the relationship, not the card.'],
    }
  }

  if (withdrawn && !staff) {
    return {
      granted: false,
      standing: 'Every enrolment is withdrawn',
      denialReason: 'status_withdrawn',
      notes: ['Access stopped when the enrolment did. Nobody had to revoke the card.'],
    }
  }

  if (overdue && !staff) {
    return {
      granted: false,
      standing: `Unpaid balance of ${formatNaira(balance)}, past its due date`,
      denialReason: 'unpaid_balance',
      notes: [
        'The desk can override for a single entry, with a reason, and the override is logged against the tap.',
      ],
    }
  }

  if (balance > 0) notes.push('Carries a balance that is not yet overdue. Access is unaffected today.')
  if (alumnus && !student && !staff) {
    notes.push('Alumnus access is limited to the events and alumni areas of the access profile.')
  }

  return {
    granted: true,
    standing: staff
      ? `Active ${staff.type === 'tutor' ? 'tutor' : 'employee'}`
      : student
        ? 'Active student'
        : 'Active alumnus',
    denialReason: null,
    notes,
  }
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

export function nextCardRef(): { id: string; cardId: string } {
  const numbers = cardsCollection
    .all()
    .map((c) => Number(c.cardId.replace(/^CRD-/, '')))
    .filter((n) => Number.isFinite(n))
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  const padded = String(next).padStart(4, '0')
  return { id: `crd-ui-${padded}-${Date.now().toString(36)}`, cardId: `CRD-${padded}` }
}

/** A plausible 14-character hex UID, derived from the card reference. */
export function suggestUid(cardRef: string): string {
  let hash = 2166136261
  for (let i = 0; i < cardRef.length; i++) {
    hash ^= cardRef.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const part = (seed: number) =>
    (Math.imul(hash ^ seed, 2654435761) >>> 0).toString(16).toUpperCase().padStart(8, '0')
  return `04${part(1)}${part(2)}`.slice(0, 14)
}

export function uidTaken(uid: string): boolean {
  const normalised = uid.trim().toUpperCase()
  return cardsCollection.all().some((c) => c.uid.toUpperCase() === normalised)
}

export const ACCESS_PROFILES = [
  'Student — campus hours',
  'Student — extended hours',
  'Staff — all areas',
  'Tutor — teaching areas',
  'Contractor — escorted',
  'Visitor — reception only',
]

export interface IssueCardInput {
  personId: PersonId
  holderType: Card['holderType']
  branchId: BranchId
  accessProfile: string
  uid: string
  /** Set when this card replaces a lost or damaged one. */
  replacesCardId: CardId | null
}

/**
 * Issuing is audited, and so is the deactivation of the card being replaced.
 * The two events are what makes "instant deactivation plus replacement, both
 * logged" visible on the card list rather than a claim in a slide.
 */
export function issueCard(input: IssueCardInput): Card {
  const at = nowIso()
  const ref = nextCardRef()

  const card: Card = {
    id: asCardId(ref.id),
    cardId: ref.cardId,
    uid: input.uid.trim().toUpperCase(),
    personId: input.personId,
    holderType: input.holderType,
    branchId: input.branchId,
    accessProfile: input.accessProfile,
    issuedAt: TODAY,
    issuedByUserId: CURRENT_USER_ID,
    status: 'active',
    deactivatedAt: null,
    deactivationReason: null,
    replacesCardId: input.replacesCardId,
    replacedByCardId: null,
    lastTapAt: null,
    ...auditable(at),
  }
  cardsCollection.insert(card)

  emitAudit({
    action: 'card.issue',
    entityType: 'Card',
    entityId: card.id,
    entityRef: card.cardId,
    field: 'status',
    before: null,
    after: `active — ${personName(input.personId)}, ${input.accessProfile}`,
  })

  if (input.replacesCardId) {
    const previous = cardsCollection.find(input.replacesCardId)
    if (previous && previous.status !== 'deactivated') {
      deactivateCard(previous, `Replaced by ${card.cardId}`, 'replaced')
    }
    cardsCollection.update(input.replacesCardId, { replacedByCardId: card.id })
  }

  return card
}

/** Never removed. A deactivated card keeps its history and its tap log. */
export function deactivateCard(
  card: Card,
  reason: string,
  status: Extract<Card['status'], 'deactivated' | 'lost' | 'suspended' | 'replaced'> = 'deactivated',
): void {
  const at = nowIso()
  cardsCollection.update(card.id, {
    status,
    deactivatedAt: at,
    deactivationReason: reason,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'card.deactivate',
    entityType: 'Card',
    entityId: card.id,
    entityRef: card.cardId,
    field: 'status',
    before: card.status,
    after: `${status} — ${reason}`,
  })
}

/* -------------------------------------------------------------------------- */
/* Kiosk — a walk-in enquiry becomes a real lead                              */
/* -------------------------------------------------------------------------- */

export interface KioskEnquiryInput {
  firstName: string
  lastName: string
  phone: string
  email: string
  courseInterestId: CourseId | null
  mode: Mode
  branchId: BranchId
  note: string
}

export interface KioskEnquiryResult {
  lead: Lead
  person: Person
  /** True when the phone or email matched somebody already on file. */
  matchedExistingPerson: boolean
  ownerUserId: UserId
  routingRule: string
}

/**
 * The same shape `crm/pages/NewLead.tsx` writes, reduced to what a walk-in
 * gives you at the desk. A phone or email that matches an existing person
 * reuses that record rather than creating a second one — the cheap version of
 * the wizard's duplicate check, and the difference between a demo that looks
 * real and one that quietly grows two Chiamakas.
 */
export function findPersonByContact(phone: string, email: string): Person | null {
  const normalisedPhone = phone.replace(/\D/g, '').slice(-10)
  const normalisedEmail = email.trim().toLowerCase()
  if (!normalisedPhone && !normalisedEmail) return null

  return (
    peopleCollection.all().find((p) => {
      if (p.mergedIntoPersonId) return false
      const theirPhone = (p.phone ?? '').replace(/\D/g, '').slice(-10)
      const theirEmail = (p.email ?? '').trim().toLowerCase()
      return (
        (normalisedPhone.length === 10 && theirPhone === normalisedPhone) ||
        (normalisedEmail.length > 0 && theirEmail === normalisedEmail)
      )
    }) ?? null
  )
}

function nextLeadRef(): string {
  const prefix = 'CIR-L-'
  const numbers = leadsCollection
    .all()
    .map((l) => Number(l.ref.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

/**
 * Routing is a real rule, not a constant: the lead goes to whoever is carrying
 * the fewest live leads, and the rule is named in the ownership history so the
 * profile can say why.
 */
/** Stages that no longer count as pipeline weight when routing. */
const CLOSED_STAGES: LeadStage[] = ['enrolled', 'not_interested', 'lost', 'invalid', 'unresponsive']

function routeOwner(): { ownerUserId: UserId; rule: string } {
  const open = new Map<string, number>()
  for (const lead of leadsCollection.all()) {
    if (lead.archivedAt || CLOSED_STAGES.includes(lead.stage)) continue
    open.set(lead.ownerUserId as string, (open.get(lead.ownerUserId as string) ?? 0) + 1)
  }
  const candidates = usersCollection.all().filter((u) => open.has(u.id as string))
  if (candidates.length === 0) {
    return { ownerUserId: CURRENT_USER_ID, rule: 'Walk-in kiosk — no owner had an open lead, assigned to the desk' }
  }
  const lightest = candidates.reduce((best, user) =>
    (open.get(user.id as string) ?? 0) < (open.get(best.id as string) ?? 0) ? user : best,
  )
  return {
    ownerUserId: lightest.id,
    rule: `Walk-in kiosk — routed to the lightest open pipeline (${open.get(lightest.id as string) ?? 0} open leads)`,
  }
}

export function createKioskEnquiry(input: KioskEnquiryInput): KioskEnquiryResult {
  const at = nowIso()
  const existing = findPersonByContact(input.phone, input.email)

  const person: Person =
    existing ??
    peopleCollection.insert({
      id: asPersonId(`per-kiosk-${Date.now().toString(36)}`),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim() || null,
      phone: input.phone.trim() || null,
      whatsapp: input.phone.trim() || null,
      dateOfBirth: null,
      city: 'Ibadan',
      state: 'Oyo',
      country: 'Nigeria',
      avatarInitials: `${input.firstName.trim()[0] ?? ''}${input.lastName.trim()[0] ?? ''}`.toUpperCase(),
      primaryBranchId: input.branchId,
      tags: ['Walk-in'],
      mergedIntoPersonId: null,
      mergedFromPersonIds: [],
      consents: [
        {
          type: 'data_processing',
          granted: true,
          capturedAt: at,
          capturedVia: 'kiosk',
          capturedBy: CURRENT_USER_ID,
        },
      ],
      ...auditable(at),
    })

  if (!existing) {
    emitAudit({
      action: 'person.create',
      entityType: 'Person',
      entityId: person.id,
      entityRef: `${person.firstName} ${person.lastName}`,
      field: null,
      before: null,
      after: 'Created at the walk-in kiosk',
    })
  }

  const { ownerUserId, rule } = routeOwner()
  const unitId = (unitsCollection.all()[0]?.id ?? null) as UnitId
  const ref = nextLeadRef()

  const lead: Lead = {
    id: asLeadId(`lead-kiosk-${Date.now().toString(36)}`),
    ref,
    personId: person.id,
    courseInterestId: input.courseInterestId,
    mode: input.mode,
    branchId: input.branchId,
    unitId,
    stage: 'new',
    stageEnteredAt: at,
    daysInStage: 0,
    quotedValue: null,
    /* The three attribution fields stay independent — a walk-in has no referrer. */
    referrerPersonId: null,
    ownerUserId,
    closerUserId: null,
    originalSource: 'walk_in_kiosk',
    latestSource: 'walk_in_kiosk',
    campaignId: null,
    utm: {},
    landingPage: null,
    referralCode: null,
    firstResponseAt: null,
    firstResponseMinutes: null,
    responseSlaMinutes: 120,
    nextAction: 'Call back about the walk-in enquiry',
    nextActionDueAt: `${TODAY}T17:00:00+01:00`,
    lastActivityAt: at,
    lossReason: null,
    lossNote: null,
    ownershipHistory: [{ fromUserId: null, toUserId: ownerUserId, at, byUserId: CURRENT_USER_ID, reason: rule }],
    ...auditable(at),
  }
  leadsCollection.insert(lead)

  const hasLeadRelationship = relationshipsCollection
    .where((r) => r.personId === person.id && r.type === 'lead' && r.status === 'active')
    .length > 0
  if (!hasLeadRelationship) {
    relationshipsCollection.insert({
      id: asRelationshipId(`rel-kiosk-${Date.now().toString(36)}`),
      personId: person.id,
      type: 'lead',
      startDate: TODAY,
      endDate: null,
      status: 'active',
      unitId,
      branchId: input.branchId,
      relatedRecordId: lead.id,
      ...auditable(at),
    })
  }

  activitiesCollection.insert({
    id: asActivityId(`act-kiosk-${Date.now().toString(36)}`),
    subjectType: 'lead',
    subjectId: lead.id,
    type: 'system',
    body: `Walk-in enquiry taken at the kiosk. ${rule}.${input.note.trim() ? ` Note: ${input.note.trim()}` : ''}`,
    attachmentIds: [],
    isSystemGenerated: true,
    ...auditable(at),
  })

  emitAudit({
    action: 'lead.create',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: ref,
    field: null,
    before: null,
    after: 'New — walk-in kiosk',
  })
  emitAudit({
    action: 'lead.source.locked',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: ref,
    field: 'originalSource',
    before: null,
    after: 'walk_in_kiosk — immutable after creation',
  })
  emitAudit({
    action: 'lead.owner.change',
    entityType: 'Lead',
    entityId: lead.id,
    entityRef: ref,
    field: 'ownerUserId',
    before: null,
    after: `${userName(ownerUserId)} — ${rule}`,
  })

  return { lead, person, matchedExistingPerson: existing !== null, ownerUserId, routingRule: rule }
}

/* -------------------------------------------------------------------------- */
/* Kiosk — check-in and visitor sign-in                                       */
/* -------------------------------------------------------------------------- */

export interface KioskTapResult {
  card: Card | null
  decision: AccessDecision | null
  /** What the reader did, once the card and the status are both considered. */
  result: 'granted' | 'denied'
  message: string
}

/**
 * A tap at the kiosk. The card must exist and be active, and the holder's
 * status must allow it — two separate checks, which is why a deactivated card
 * and a withdrawn student produce different denial reasons.
 */
export function recordKioskTap(cardRef: string, readerId: ReaderId | null): KioskTapResult {
  const normalised = cardRef.trim().toUpperCase()
  const card =
    cardsCollection.all().find((c) => c.cardId.toUpperCase() === normalised || c.uid.toUpperCase() === normalised) ??
    null

  if (!card) {
    return {
      card: null,
      decision: null,
      result: 'denied',
      message: 'No card with that reference. Check the number printed on the card.',
    }
  }

  const at = nowIso()
  const decision = accessDecision(card.personId)
  const cardBlocked = card.status !== 'active'
  const granted = !cardBlocked && decision.granted
  const denialReason = cardBlocked ? 'card_deactivated' : decision.denialReason

  /* The tap is only logged against a real reader — a phantom reader id would
     poison the tap log, which is the one place attendance is reconstructed from. */
  const reader =
    (readerId ? readersCollection.find(readerId) : null) ??
    readersCollection.all().find((r) => r.type === 'kiosk') ??
    readersCollection.all()[0]

  if (reader) {
    tapEventsCollection.insert({
      id: asTapId(`tap-ui-${Date.now().toString(36)}`),
      cardId: card.id,
      personId: card.personId,
      readerId: reader.id,
      at,
      syncedAt: at,
      wasBuffered: false,
      result: granted ? 'granted' : 'denied',
      denialReason: granted ? null : denialReason,
      sessionId: null,
      meetingId: null,
      overrideByUserId: null,
      overrideReason: null,
    })
  }

  if (granted) cardsCollection.update(card.id, { lastTapAt: at })

  return {
    card,
    decision,
    result: granted ? 'granted' : 'denied',
    message: granted
      ? `Welcome, ${personName(card.personId)}. Checked in at ${at.slice(11, 16)}.`
      : cardBlocked
        ? `This card is ${card.status}. Please see the desk — a replacement takes a minute.`
        : `Access is held: ${decision.standing.toLowerCase()}. Please see the desk.`,
  }
}

export interface VisitorSignInInput {
  name: string
  organisation: string
  hostPersonId: PersonId
  purpose: string
  phone: string
  branchId: BranchId
}

export function signInVisitor(input: VisitorSignInInput): Visitor {
  const at = nowIso()
  const onSite = visitorsCollection.all().filter((v) => v.checkedOutAt === null).length
  const visitor: Visitor = {
    id: asVisitorId(`vis-ui-${Date.now().toString(36)}`),
    name: input.name.trim(),
    organisation: input.organisation.trim() || null,
    hostPersonId: input.hostPersonId,
    purpose: input.purpose.trim(),
    badgeNumber: `V-${String(onSite + 1).padStart(3, '0')}`,
    branchId: input.branchId,
    phone: input.phone.trim(),
    checkedInAt: at,
    checkedOutAt: null,
    ...auditable(at),
  }
  visitorsCollection.insert(visitor)
  emitAudit({
    action: 'visitor.sign_in',
    entityType: 'Visitor',
    entityId: visitor.id,
    entityRef: visitor.name,
    field: 'checkedInAt',
    before: null,
    after: `${at} — hosted by ${personName(input.hostPersonId)}`,
  })
  return visitor
}

export function signOutVisitor(visitor: Visitor): void {
  const at = nowIso()
  visitorsCollection.update(visitor.id, { checkedOutAt: at, updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'visitor.sign_out',
    entityType: 'Visitor',
    entityId: visitor.id,
    entityRef: visitor.name,
    field: 'checkedOutAt',
    before: null,
    after: at,
  })
}

export function reactivateCard(card: Card, reason: string): void {
  const at = nowIso()
  cardsCollection.update(card.id, {
    status: 'active',
    deactivatedAt: null,
    deactivationReason: null,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'card.reactivate',
    entityType: 'Card',
    entityId: card.id,
    entityRef: card.cardId,
    field: 'status',
    before: card.status,
    after: `active — ${reason}`,
  })
}
