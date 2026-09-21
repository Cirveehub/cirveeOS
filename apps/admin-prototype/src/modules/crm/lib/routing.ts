import { CURRENT_USER_ID, leadsCollection, rolesCollection, usersCollection } from '@/mocks'
import type { BranchId, UserId } from '@/mocks/types'

export interface OwnerSuggestion {
  ownerUserId: UserId
  label: string
}

// Round-robin: the active Sales Executive in the branch carrying the fewest enquiries.
export function suggestOwner(branchId: BranchId | '' | null, branchName?: string): OwnerSuggestion {
  const users = usersCollection.all()
  const leads = leadsCollection.all()
  const salesRole = rolesCollection.all().find((r) => r.name === 'Sales Executive')
  const candidates = users.filter(
    (u) =>
      u.status === 'active' &&
      (!branchId || u.primaryBranchId === branchId) &&
      (!salesRole || u.roleIds.includes(salesRole.id)),
  )
  const pool = candidates.length ? candidates : users.filter((u) => u.status === 'active')
  const load = new Map<string, number>()
  for (const lead of leads) {
    load.set(lead.ownerUserId as string, (load.get(lead.ownerUserId as string) ?? 0) + 1)
  }
  const ranked = [...pool].sort(
    (a, b) => (load.get(a.id as string) ?? 0) - (load.get(b.id as string) ?? 0),
  )
  return {
    ownerUserId: (ranked[0]?.id ?? CURRENT_USER_ID) as UserId,
    label: `Shared out in turn · ${branchName ? `${branchName} team` : 'all sales teams'}`,
  }
}
