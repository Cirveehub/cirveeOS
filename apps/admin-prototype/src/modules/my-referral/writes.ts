import {
  CURRENT_USER_ID,
  TODAY,
  auditEventsCollection,
  peopleCollection,
  referrerProfilesCollection,
  rolesCollection,
  usersCollection,
  type PersonId,
  type ReferrerProfile,
  type ReferrerType,
} from '@/mocks'
import { auditId, referrerId } from '@/mocks/types'

function nowIso(): string {
  return new Date().toISOString()
}

function emitAudit(input: {
  action: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}) {
  const user = usersCollection.find(CURRENT_USER_ID)
  const roleName = user?.roleIds[0] ? (rolesCollection.find(user.roleIds[0])?.name ?? 'Referrer') : 'Referrer'
  const actor = user ? peopleCollection.find(user.personId) : undefined

  auditEventsCollection.insert({
    id: auditId(`aud-myreferral-${Date.now().toString(36)}`),
    at: nowIso(),
    actorUserId: CURRENT_USER_ID,
    actorName: actor ? `${actor.firstName} ${actor.lastName}` : 'Referrer',
    actorRole: roleName,
    action: input.action,
    entityType: 'ReferrerProfile',
    entityId: input.entityId,
    entityRef: input.entityRef,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    source: 'ui',
    ip: '102.89.34.17',
  })
}

function suggestCode(name: string, taken: Set<string>): string {
  const stem = (name.split(/\s+/)[0] ?? 'CIRVEE').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6) || 'CIRVEE'
  for (let n = 1; n < 100; n++) {
    const candidate = `${stem}${String(n).padStart(2, '0')}`
    if (!taken.has(candidate)) return candidate
  }
  return `${stem}${Date.now() % 100}`
}

export function generateMyReferralCode(
  personId: PersonId,
  displayName: string,
  type: ReferrerType,
): ReferrerProfile {
  const profiles = referrerProfilesCollection.all()
  const taken = new Set(profiles.flatMap((p) => [p.code, ...p.supersededCodes]))
  const code = suggestCode(displayName, taken)

  const numbers = profiles.map((p) => Number(p.ref.split('-')[1] ?? 0))
  const next = Math.max(0, ...numbers) + 1
  const ref = `REF-${String(next).padStart(4, '0')}`
  const stamp = `${TODAY}T09:00:00+01:00`

  const profile = referrerProfilesCollection.insert({
    id: referrerId(`ref-${String(next).padStart(4, '0')}`),
    ref,
    personId,
    type,
    code,
    supersededCodes: [],
    trackedUrl: `https://cirvee.com/r/${code}`,
    qrPayload: `https://cirvee.com/r/${code}`,
    status: 'active',
    joinedAt: TODAY,
    payoutMethod: { kind: 'bank_transfer', verified: false },
    taxNote: null,
    stats: { clicks: 0, signups: 0, converted: 0, earned: 0, paid: 0, outstanding: 0 } as ReferrerProfile['stats'],
    createdAt: stamp,
    createdBy: CURRENT_USER_ID,
    updatedAt: stamp,
    updatedBy: CURRENT_USER_ID,
  })

  emitAudit({
    action: 'referrer.profile.generated',
    entityId: profile.id,
    entityRef: profile.ref,
    field: 'code',
    before: null,
    after: code,
  })

  return profile
}

export interface PayoutDetailsInput {
  bankName: string
  accountNumber: string
}

export function updateMyPayoutDetails(profileId: string, input: PayoutDetailsInput): void {
  const before = referrerProfilesCollection.find(profileId)
  if (!before) return

  const accountLast4 = input.accountNumber.trim().slice(-4)
  referrerProfilesCollection.update(profileId, (item) => ({
    payoutMethod: { ...item.payoutMethod, kind: 'bank_transfer', bankName: input.bankName.trim(), accountLast4, verified: false },
    updatedAt: nowIso(),
    updatedBy: CURRENT_USER_ID,
  }))

  emitAudit({
    action: 'referrer.payout_method.updated',
    entityId: before.id,
    entityRef: before.ref,
    field: 'payoutMethod.bankName',
    before: before.payoutMethod.bankName ?? null,
    after: input.bankName.trim(),
  })
}
