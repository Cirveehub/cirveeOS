import { useCan, useSession } from '@/auth'
import { CURRENT_USER_ID } from '@/mocks'
import type { UserId } from '@/mocks/types'
import { firstNameOf } from './lookups'

export interface CrmScope {
  userId: UserId
  firstName: string
  /** Sales Executives see their own enquiries by default. */
  ownOnlyByDefault: boolean
  canSeeTeam: boolean
}

export function useCrmScope(): CrmScope {
  const session = useSession()
  const can = useCan()
  const userId = (session?.userId ?? CURRENT_USER_ID) as UserId
  return {
    userId,
    firstName: firstNameOf(session?.displayName),
    ownOnlyByDefault: session?.persona.id === 'sales-exec' || !can('crm.lead.view.branch'),
    canSeeTeam: can('crm.lead.edit.branch'),
  }
}
