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

export interface AccessDecision {
  granted: boolean
  standing: string
  denialReason:
    | 'card_deactivated'
    | 'outside_access_hours'
    | 'status_withdrawn'
    | 'unpaid_balance'
    | 'not_authorised_for_area'
    | null
  notes: string[]
}

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

export function nextCardRef(): { id: string; cardId: string } {
  const numbers = cardsCollection
    .all()
    .map((c) => Number(c.cardId.replace(/^CRD-/, '')))
    .filter((n) => Number.isFinite(n))
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  const padded = String(next).padStart(4, '0')
  return { id: `crd-ui-${padded}-${Date.now().toString(36)}`, cardId: `CRD-${padded}` }
}

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
  replacesCardId: CardId | null
}

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
  matchedExistingPerson: boolean
  ownerUserId: UserId
  routingRule: string
}

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

export interface KioskTapResult {
  card: Card | null
  decision: AccessDecision | null
  result: 'granted' | 'denied'
  message: string
}

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
