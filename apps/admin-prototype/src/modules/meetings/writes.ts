import {
  CURRENT_USER_ID,
  TODAY,
  actionItemsCollection,
  decisionsCollection,
  meetingsCollection,
} from '@/mocks'
import {
  actionItemId as asActionItemId,
  decisionId as asDecisionId,
  meetingId as asMeetingId,
} from '@/mocks/types'
import type {
  ActionItem,
  ActionItemStatus,
  Decision,
  DecisionId,
  Meeting,
  MeetingId,
  MeetingType,
  PersonId,
  UserId,
} from '@/mocks'

const ACTOR = CURRENT_USER_ID as UserId

function stamp(date: string = TODAY, hour = 9, minute = 0): string {
  const hh = String(hour).padStart(2, '0')
  const mm = String(minute).padStart(2, '0')
  return `${date.slice(0, 10)}T${hh}:${mm}:00+01:00`
}

function audit(at: string) {
  return { createdAt: at, createdBy: ACTOR, updatedAt: at, updatedBy: ACTOR }
}

let sequence = 0
function newId(): string {
  sequence += 1
  return `${Date.now().toString(36)}-${sequence}`
}

function nextSequence(prefix: string, existing: string[]): string {
  const numbers = existing.map((ref) => Number(ref.split('-').pop() ?? 0)).filter((n) => !Number.isNaN(n))
  return `${prefix}${String(Math.max(0, ...numbers) + 1).padStart(4, '0')}`
}

export interface LogMeetingInput {
  title: string
  type: MeetingType
  date: string
  time: string
  durationMinutes: number
  chairUserId: UserId
  location: string
  meetingUrl: string
  attendeePersonIds: PersonId[]
  agendaItems: Array<{ title: string; ownerUserId: UserId; timeboxMinutes: number; notes: string }>
  status: Meeting['status']
}

export interface LogMeetingResult {
  meeting: Meeting
  carriedForward: ActionItem[]
}

export function logMeeting(input: LogMeetingInput): LogMeetingResult {
  const startAt = stamp(input.date, Number(input.time.slice(0, 2)), Number(input.time.slice(3, 5)))
  const id = asMeetingId(`meeting-${newId()}`) as MeetingId

  const previousOfType = new Set(
    meetingsCollection
      .where((m) => m.type === input.type && m.startAt < startAt)
      .map((m) => m.id as string),
  )
  const carriedForward = actionItemsCollection.where(
    (item) => item.status !== 'done' && previousOfType.has(item.meetingId as string),
  )

  const agendaItems = input.agendaItems.map((item, index) => ({
    sequence: index + 1,
    title: item.title,
    ownerUserId: item.ownerUserId,
    timeboxMinutes: item.timeboxMinutes,
    notes: item.notes,
  }))

  if (carriedForward.length > 0) {
    agendaItems.unshift({
      sequence: 0,
      title: `Carried-forward actions (${carriedForward.length})`,
      ownerUserId: input.chairUserId,
      timeboxMinutes: Math.max(5, carriedForward.length * 2),
      notes: carriedForward.map((item) => item.title).join(' · '),
    })
    agendaItems.forEach((item, index) => {
      item.sequence = index + 1
    })
  }

  const meeting: Meeting = {
    id,
    title: input.title.trim(),
    type: input.type,
    startAt,
    durationMinutes: input.durationMinutes,
    chairUserId: input.chairUserId,
    location: input.location.trim() || null,
    meetingUrl: input.meetingUrl.trim() || null,
    agendaItems,
    attendance: input.attendeePersonIds.map((personId) => ({
      personId,
      method: 'platform_log' as const,
      arrivedAt: input.status === 'held' ? startAt : null,
    })),
    minutesCirculatedAt: null,
    status: input.status,
    ...audit(stamp()),
  }

  meetingsCollection.insert(meeting)

  for (const item of carriedForward) {
    actionItemsCollection.update(item.id, {
      carriedForwardCount: item.carriedForwardCount + 1,
      status: item.status === 'open' ? 'carried_forward' : item.status,
      lastUpdateAt: stamp(),
      lastUpdateNote: `Carried forward onto ${meeting.title}.`,
      updatedAt: stamp(),
      updatedBy: ACTOR,
    })
  }

  return { meeting, carriedForward }
}

export function saveMinutes(meeting: Meeting, notes: Record<number, string>): void {
  meetingsCollection.update(meeting.id, {
    agendaItems: meeting.agendaItems.map((item) => ({
      ...item,
      notes: notes[item.sequence] ?? item.notes,
    })),
    updatedAt: stamp(),
    updatedBy: ACTOR,
  })
}

export interface CirculateResult {
  recipients: number
  at: string
}

export function circulateMinutes(meeting: Meeting): CirculateResult {
  const at = stamp()
  meetingsCollection.update(meeting.id, {
    minutesCirculatedAt: at,
    status: meeting.status === 'scheduled' ? 'held' : meeting.status,
    updatedAt: at,
    updatedBy: ACTOR,
  })
  return { recipients: meeting.attendance.length, at }
}

export interface AddActionInput {
  title: string
  meetingId: MeetingId
  ownerUserId: UserId
  deadline: string
  status: ActionItemStatus
  note: string
  relatedEntityType: string | null
  relatedEntityId: string | null
}

export function addActionItem(input: AddActionInput): ActionItem {
  const at = stamp()
  const item: ActionItem = {
    id: asActionItemId(`actionitem-${newId()}`),
    title: input.title.trim(),
    meetingId: input.meetingId,
    ownerUserId: input.ownerUserId,
    deadline: input.deadline,
    status: input.status,
    carriedForwardCount: 0,
    lastUpdateAt: at,
    lastUpdateNote: input.note.trim() || 'Raised in the meeting.',
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    ...audit(at),
  }
  actionItemsCollection.insert(item)
  return item
}

export function updateActionStatus(item: ActionItem, status: ActionItemStatus, note: string): void {
  const at = stamp()
  actionItemsCollection.update(item.id, {
    status,
    lastUpdateAt: at,
    lastUpdateNote: note.trim() || `Status changed to ${status.replace(/_/g, ' ')}.`,
    updatedAt: at,
    updatedBy: ACTOR,
  })
}

export interface LogDecisionInput {
  title: string
  decision: string
  rationale: string
  alternativesConsidered: string[]
  decidedByUserIds: UserId[]
  decidedOn: string
  meetingId: MeetingId | null
  affectedAreas: string[]
  reviewDate: string | null
  replaces: { id: DecisionId; as: 'superseded' | 'reversed' } | null
}

export function logDecision(input: LogDecisionInput): Decision {
  const at = stamp(input.decidedOn)
  const ref = nextSequence(
    'DEC-',
    decisionsCollection.all().map((d) => d.ref),
  )
  const decision: Decision = {
    id: asDecisionId(`decision-${newId()}`),
    ref,
    title: input.title.trim(),
    decision: input.decision.trim(),
    rationale: input.rationale.trim(),
    alternativesConsidered: input.alternativesConsidered.filter((a) => a.trim() !== ''),
    decidedByUserIds: input.decidedByUserIds,
    decidedOn: input.decidedOn,
    meetingId: input.meetingId,
    affectedAreas: input.affectedAreas,
    supersedesDecisionId: input.replaces?.id ?? null,
    supersededByDecisionId: null,
    status: 'active',
    reviewDate: input.reviewDate,
    ...audit(at),
  }

  decisionsCollection.insert(decision)

  if (input.replaces) {
    decisionsCollection.update(input.replaces.id, {
      status: input.replaces.as,
      supersededByDecisionId: decision.id,
      updatedAt: at,
      updatedBy: ACTOR,
    })
  }

  return decision
}
