/**
 * Every write the customer experience module performs.
 *
 * The ticket queue used to render and filter without transacting. It now
 * transacts, under three rules:
 *
 *  1. **The conversation is the record.** A reply, an internal note, an
 *     escalation and a resolution all append to `messages`; nothing in the
 *     thread is ever edited or removed, so reopening a ticket leaves the
 *     original resolution readable rather than overwriting it.
 *  2. **`firstResponseAt` is written once.** It is the SLA's reported metric,
 *     so a second reply must not reset the clock.
 *  3. **Status changes emit an `AuditEvent`** — actor, timestamp, field,
 *     before and after — which is a different record from the `Activity` feed
 *     entry the same action writes.
 */

import {
  TODAY,
  CURRENT_USER_ID,
  activitiesCollection,
  auditEventsCollection,
  peopleCollection,
  rolesCollection,
  ticketsCollection,
  usersCollection,
} from '@/mocks'
import {
  activityId as asActivityId,
  auditId as asAuditId,
  ticketId as asTicketId,
  type Activity,
  type AuditEvent,
  type Channel,
  type PersonId,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type UserId,
} from '@/mocks/types'

/* -------------------------------------------------------------------------- */
/* The clock                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The prototype's now. The date is always the seed's fixed TODAY so relative
 * dates never rot; only the time of day comes from the wall clock, which is
 * what makes a reply land at a plausible hour during a demo.
 */
export function nowIso(): string {
  const d = new Date()
  const pad2 = (n: number) => String(n).padStart(2, '0')
  return `${TODAY}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}+01:00`
}

export function hoursBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 3_600_000
}

/* -------------------------------------------------------------------------- */
/* Names                                                                      */
/* -------------------------------------------------------------------------- */

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
/* Audit — append-only, never updated or removed                              */
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
    id: asAuditId(`aud-cx-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
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

/** The activity feed, which is a separate record from the audit log. */
function logActivity(args: { ticket: Ticket; body: string; system?: boolean; at: string }): Activity {
  return activitiesCollection.insert({
    id: asActivityId(`act-cx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`),
    subjectType: 'ticket',
    subjectId: args.ticket.id,
    type: args.system ? 'system' : 'note',
    body: args.body,
    attachmentIds: [],
    isSystemGenerated: args.system ?? false,
    createdAt: args.at,
    createdBy: CURRENT_USER_ID,
    updatedAt: args.at,
    updatedBy: CURRENT_USER_ID,
  })
}

/* -------------------------------------------------------------------------- */
/* SLA                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The SLA state is derived from the policy's first-response target and the
 * ticket's own clock — not typed into a component and not frozen at seed time.
 * Replying to a breaching ticket has to visibly move it back inside target,
 * or the queue is decoration.
 */
export const FIRST_RESPONSE_TARGET_HOURS: Record<Ticket['priority'], number> = {
  urgent: 2,
  high: 4,
  normal: 8,
  low: 24,
}

export function deriveSlaState(ticket: Ticket, asOf: string = nowIso()): Ticket['slaState'] {
  if (ticket.resolvedAt) return ticket.slaState
  const target = FIRST_RESPONSE_TARGET_HOURS[ticket.priority]
  if (ticket.firstResponseAt) {
    return hoursBetween(ticket.createdAtTime, ticket.firstResponseAt) > target ? 'breached' : 'within'
  }
  const elapsed = hoursBetween(ticket.createdAtTime, asOf)
  if (elapsed > target) return 'breached'
  if (elapsed > target * 0.75) return 'due_soon'
  return 'within'
}

/* -------------------------------------------------------------------------- */
/* References                                                                 */
/* -------------------------------------------------------------------------- */

export function nextTicketRef(): string {
  const year = TODAY.slice(0, 4)
  const prefix = `TKT-${year}-`
  const numbers = ticketsCollection
    .all()
    .map((t) => t.ref)
    .filter((ref) => ref.startsWith(prefix))
    .map((ref) => Number(ref.slice(prefix.length)))
    .filter((n) => Number.isFinite(n))
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1
  return `${prefix}${String(next).padStart(4, '0')}`
}

function message(args: {
  direction: TicketMessage['direction']
  channel: Channel
  body: string
  authorPersonId: PersonId | null
  at: string
}): TicketMessage {
  return {
    id: `msg-ui-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: args.at,
    direction: args.direction,
    authorPersonId: args.authorPersonId,
    channel: args.channel,
    body: args.body,
    attachmentIds: [],
  }
}

function actingPersonId(): PersonId | null {
  return usersCollection.find(CURRENT_USER_ID)?.personId ?? null
}

/* -------------------------------------------------------------------------- */
/* Transitions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A reply. It appends to the thread, stops the first-response clock the first
 * time only, and moves a new ticket to open — the three things that made the
 * disabled button worth wiring.
 */
export function replyToTicket(ticket: Ticket, body: string, channel: Channel): void {
  const at = nowIso()
  const isFirstResponse = ticket.firstResponseAt === null

  const next: Partial<Ticket> = {
    messages: [...ticket.messages, message({ direction: 'outbound', channel, body, authorPersonId: actingPersonId(), at })],
    firstResponseAt: ticket.firstResponseAt ?? at,
    status: ticket.status === 'new' ? 'open' : ticket.status,
    ownerUserId: ticket.ownerUserId ?? CURRENT_USER_ID,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  }
  const projected: Ticket = { ...ticket, ...next }
  ticketsCollection.update(ticket.id, { ...next, slaState: deriveSlaState(projected, at) })

  logActivity({ ticket, body: `Replied on ${channelLabel(channel)}: ${body}`, at })

  if (isFirstResponse) {
    emitAudit({
      action: 'ticket.first_response',
      entityType: 'Ticket',
      entityId: ticket.id,
      entityRef: ticket.ref,
      field: 'firstResponseAt',
      before: null,
      after: at,
    })
  }
  if (ticket.status === 'new') {
    emitAudit({
      action: 'ticket.status.change',
      entityType: 'Ticket',
      entityId: ticket.id,
      entityRef: ticket.ref,
      field: 'status',
      before: 'new',
      after: 'open',
    })
  }
  if (ticket.ownerUserId === null) {
    emitAudit({
      action: 'ticket.owner.change',
      entityType: 'Ticket',
      entityId: ticket.id,
      entityRef: ticket.ref,
      field: 'ownerUserId',
      before: null,
      after: userName(CURRENT_USER_ID),
    })
  }
}

/** An internal note never touches the first-response clock — nobody was told. */
export function addInternalNote(ticket: Ticket, body: string): void {
  const at = nowIso()
  ticketsCollection.update(ticket.id, {
    messages: [...ticket.messages, message({ direction: 'internal', channel: 'in_app', body, authorPersonId: actingPersonId(), at })],
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  logActivity({ ticket, body: `Internal note: ${body}`, at })
}

export function escalateTicket(ticket: Ticket, toUserId: UserId, reason: string): void {
  const at = nowIso()
  ticketsCollection.update(ticket.id, {
    status: 'escalated',
    ownerUserId: toUserId,
    messages: [
      ...ticket.messages,
      message({
        direction: 'internal',
        channel: 'in_app',
        body: `Escalated to ${userName(toUserId)}. ${reason}`,
        authorPersonId: actingPersonId(),
        at,
      }),
    ],
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'ticket.escalate',
    entityType: 'Ticket',
    entityId: ticket.id,
    entityRef: ticket.ref,
    field: 'status',
    before: ticket.status,
    after: 'escalated',
  })
  if (ticket.ownerUserId !== toUserId) {
    emitAudit({
      action: 'ticket.owner.change',
      entityType: 'Ticket',
      entityId: ticket.id,
      entityRef: ticket.ref,
      field: 'ownerUserId',
      before: ticket.ownerUserId ? userName(ticket.ownerUserId) : null,
      after: userName(toUserId),
    })
  }
  logActivity({
    ticket,
    body: `Escalated to ${userName(toUserId)}. Reason: ${reason}`,
    system: true,
    at,
  })
}

export function resolveTicket(ticket: Ticket, resolution: string, notifyOn: Channel | null): void {
  const at = nowIso()
  const messages = [...ticket.messages]
  if (notifyOn) {
    messages.push(
      message({ direction: 'outbound', channel: notifyOn, body: resolution, authorPersonId: actingPersonId(), at }),
    )
  }
  messages.push(
    message({
      direction: 'internal',
      channel: 'in_app',
      body: `Resolved by ${userName(CURRENT_USER_ID)}. ${resolution}`,
      authorPersonId: actingPersonId(),
      at,
    }),
  )

  ticketsCollection.update(ticket.id, {
    status: 'resolved',
    resolvedAt: at,
    resolution,
    firstResponseAt: ticket.firstResponseAt ?? (notifyOn ? at : ticket.firstResponseAt),
    ownerUserId: ticket.ownerUserId ?? CURRENT_USER_ID,
    messages,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'ticket.resolve',
    entityType: 'Ticket',
    entityId: ticket.id,
    entityRef: ticket.ref,
    field: 'status',
    before: ticket.status,
    after: 'resolved',
  })
  logActivity({ ticket, body: `Resolved. ${resolution}`, system: true, at })
}

/**
 * Reopening keeps the previous resolution in the thread rather than erasing
 * it — a resolution that did not hold is the most useful thing on the record.
 */
export function reopenTicket(ticket: Ticket, reason: string): void {
  const at = nowIso()
  ticketsCollection.update(ticket.id, {
    status: 'reopened',
    resolvedAt: null,
    resolution: null,
    messages: [
      ...ticket.messages,
      message({
        direction: 'internal',
        channel: 'in_app',
        body: `Reopened. ${reason}${ticket.resolution ? ` Previous resolution: ${ticket.resolution}` : ''}`,
        authorPersonId: actingPersonId(),
        at,
      }),
    ],
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })
  emitAudit({
    action: 'ticket.reopen',
    entityType: 'Ticket',
    entityId: ticket.id,
    entityRef: ticket.ref,
    field: 'status',
    before: ticket.status,
    after: 'reopened',
  })
  logActivity({ ticket, body: `Reopened. Reason: ${reason}`, system: true, at })
}

export function assignTicket(ticket: Ticket, toUserId: UserId): void {
  if (ticket.ownerUserId === toUserId) return
  const at = nowIso()
  ticketsCollection.update(ticket.id, { ownerUserId: toUserId, updatedAt: at, updatedBy: CURRENT_USER_ID })
  emitAudit({
    action: 'ticket.owner.change',
    entityType: 'Ticket',
    entityId: ticket.id,
    entityRef: ticket.ref,
    field: 'ownerUserId',
    before: ticket.ownerUserId ? userName(ticket.ownerUserId) : null,
    after: userName(toUserId),
  })
  logActivity({ ticket, body: `Assigned to ${userName(toUserId)}.`, system: true, at })
}

/* -------------------------------------------------------------------------- */
/* Creation                                                                   */
/* -------------------------------------------------------------------------- */

export interface NewTicketInput {
  subject: string
  requesterPersonId: PersonId
  category: TicketCategory
  priority: Ticket['priority']
  source: Ticket['source']
  channel: Channel
  ownerUserId: UserId | null
  body: string
  relatedEntityType: string | null
  relatedEntityId: string | null
}

export function createTicket(input: NewTicketInput): Ticket {
  const at = nowIso()
  const ref = nextTicketRef()

  const ticket: Ticket = {
    id: asTicketId(`tkt-ui-${Date.now().toString(36)}`),
    ref,
    subject: input.subject.trim(),
    requesterPersonId: input.requesterPersonId,
    category: input.category,
    priority: input.priority,
    status: 'new',
    ownerUserId: input.ownerUserId,
    source: input.source,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    createdAtTime: at,
    firstResponseAt: null,
    slaPolicyId: 'sla-cx-standard',
    slaState: 'within',
    resolvedAt: null,
    resolution: null,
    messages: [
      message({
        direction: 'inbound',
        channel: input.channel,
        body: input.body.trim(),
        authorPersonId: input.requesterPersonId,
        at,
      }),
    ],
    createdAt: at,
    createdBy: CURRENT_USER_ID,
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  }

  ticketsCollection.insert(ticket)

  emitAudit({
    action: 'ticket.create',
    entityType: 'Ticket',
    entityId: ticket.id,
    entityRef: ref,
    field: 'status',
    before: null,
    after: 'new',
  })
  logActivity({
    ticket,
    body: `Ticket raised for ${personName(input.requesterPersonId)} on ${channelLabel(input.channel)}. First response target ${FIRST_RESPONSE_TARGET_HOURS[input.priority]}h.`,
    system: true,
    at,
  })

  return ticket
}

export function channelLabel(channel: Channel): string {
  return channel === 'in_app'
    ? 'in app'
    : channel === 'whatsapp'
      ? 'WhatsApp'
      : channel === 'sms'
        ? 'SMS'
        : 'email'
}
