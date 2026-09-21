/**
 * Engage's write path.
 *
 * Two entities are created here — a `Segment` and a `Campaign` — and both are
 * plain inserts rather than corrections, so the never-mutate rule does not bite
 * the way it does in Finance. What matters instead is the module's own hard
 * rule: a segment's `memberCount` is resolved from Person records at the moment
 * it is saved, never typed in, because there is no contact list to type it from.
 */

import {
  CURRENT_USER_ID,
  TODAY,
  auditEventsCollection,
  campaignsCollection,
  peopleCollection,
  rolesCollection,
  segmentsCollection,
  usersCollection,
} from '@/mocks'
import type { Campaign, CampaignStatus, Channel, Kobo, Segment, UserId } from '@/mocks'
import { auditId as asAuditId, campaignId as asCampaignId, segmentId as asSegmentId } from '@/mocks/types'

import { resolveMembers, summarise, toConditionGroup, type DraftRule } from './segment-fields'

export function engageNow(): string {
  return `${TODAY}T09:15:00+01:00`
}

function stamp(at = engageNow()) {
  return { createdAt: at, createdBy: CURRENT_USER_ID, updatedAt: at, updatedBy: CURRENT_USER_ID }
}

function actorName(userId: UserId): string {
  const user = usersCollection.find(userId)
  if (!user) return 'Unknown user'
  const person = peopleCollection.find(user.personId)
  return person ? `${person.firstName} ${person.lastName}` : user.email
}

let auditSequence = 0

export function emitEngageAudit(input: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}) {
  auditSequence += 1
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Staff') : 'Staff'
  auditEventsCollection.insert({
    id: asAuditId(`aud-eng-${String(auditSequence).padStart(4, '0')}-${Date.now().toString(36)}`),
    at: engageNow(),
    actorUserId: CURRENT_USER_ID,
    actorName: actorName(CURRENT_USER_ID),
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
/* Segments                                                                   */
/* -------------------------------------------------------------------------- */

export interface SegmentInput {
  name: string
  description: string
  operator: 'and' | 'or'
  rules: DraftRule[]
}

/**
 * The member count is resolved, not supplied. That is the whole point: if this
 * function accepted a number, the prototype would be quietly demonstrating the
 * separate contact list the PRD forbids.
 */
export function createSegment(input: SegmentInput): Segment {
  const at = engageNow()
  const members = resolveMembers(input.operator, input.rules)
  const segment: Segment = {
    id: asSegmentId(`segment-ui-${Date.now().toString(36)}`),
    name: input.name,
    description: input.description,
    criteria: toConditionGroup(input.operator, input.rules),
    criteriaSummary: summarise(input.operator, input.rules),
    memberCount: members.size,
    lastRefreshedAt: at,
    usedByCampaignIds: [],
    ownerUserId: CURRENT_USER_ID,
    ...stamp(at),
  }
  segmentsCollection.insert(segment)

  emitEngageAudit({
    action: 'engage.segment.create',
    entityType: 'segment',
    entityId: segment.id,
    entityRef: segment.name,
    field: 'memberCount',
    before: null,
    after: String(segment.memberCount),
  })

  return segment
}

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

export interface CampaignInput {
  name: string
  objective: string
  channel: Channel
  segmentId: string
  templateId: string
  unitId: string
  budget: number | null
  /** `null` means send as soon as it is started. */
  scheduledAt: string | null
  status: CampaignStatus
}

const EMPTY_STATS: Campaign['stats'] = {
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  replied: 0,
  unsubscribed: 0,
  converted: 0,
  enrolments: 0,
  revenueAttributed: 0 as Kobo,
}

function utmFor(name: string, channel: Channel): Campaign['utm'] {
  return {
    source: channel,
    medium: 'campaign',
    campaign: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  }
}

export function createCampaign(input: CampaignInput): Campaign {
  const at = engageNow()
  const segment = segmentsCollection.find(input.segmentId)
  const campaign: Campaign = {
    id: asCampaignId(`campaign-ui-${Date.now().toString(36)}`),
    name: input.name,
    objective: input.objective,
    channel: input.channel,
    segmentId: input.segmentId as Campaign['segmentId'],
    audienceSize: segment?.memberCount ?? 0,
    templateId: input.templateId as Campaign['templateId'],
    ownerUserId: CURRENT_USER_ID,
    unitId: input.unitId as Campaign['unitId'],
    budget: input.budget === null ? null : (input.budget as Kobo),
    scheduledAt: input.scheduledAt,
    status: input.status,
    utm: utmFor(input.name, input.channel),
    stats: { ...EMPTY_STATS },
    ...stamp(at),
  }
  campaignsCollection.insert(campaign)

  /* A segment knows which campaigns use it — keep that link honest. */
  if (segment) {
    segmentsCollection.update(segment.id, {
      usedByCampaignIds: [...segment.usedByCampaignIds, campaign.id],
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  emitEngageAudit({
    action: 'engage.campaign.create',
    entityType: 'campaign',
    entityId: campaign.id,
    entityRef: campaign.name,
    field: 'status',
    before: null,
    after: campaign.status,
  })

  return campaign
}

export function updateCampaign(id: string, input: CampaignInput): Campaign | undefined {
  const at = engageNow()
  const existing = campaignsCollection.find(id)
  if (!existing) return undefined
  const segment = segmentsCollection.find(input.segmentId)

  const updated = campaignsCollection.update(id, {
    name: input.name,
    objective: input.objective,
    channel: input.channel,
    segmentId: input.segmentId as Campaign['segmentId'],
    audienceSize: segment?.memberCount ?? existing.audienceSize,
    templateId: input.templateId as Campaign['templateId'],
    unitId: input.unitId as Campaign['unitId'],
    budget: input.budget === null ? null : (input.budget as Kobo),
    scheduledAt: input.scheduledAt,
    status: input.status,
    utm: utmFor(input.name, input.channel),
    updatedAt: at,
    updatedBy: CURRENT_USER_ID,
  })

  if (segment && !segment.usedByCampaignIds.includes(existing.id)) {
    segmentsCollection.update(segment.id, {
      usedByCampaignIds: [...segment.usedByCampaignIds, existing.id],
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    })
  }

  emitEngageAudit({
    action: 'engage.campaign.update',
    entityType: 'campaign',
    entityId: existing.id,
    entityRef: input.name,
    field: 'status',
    before: existing.status,
    after: input.status,
  })

  return updated
}
