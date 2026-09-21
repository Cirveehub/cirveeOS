import type { ReactNode } from 'react'
import toast, { Toaster } from 'react-hot-toast'

import { useSession } from '@/auth'
import {
  asKobo,
  commissionsCollection,
  referralsCollection,
  referrerProfilesCollection,
  useCollection,
  type Commission,
  type Kobo,
  type PersonId,
  type Referral,
  type ReferrerProfile,
  type ReferrerType,
} from '@/mocks'

export interface MyReferralState {
  personId: PersonId | undefined
  displayName: string
  profile: ReferrerProfile | undefined
  referrals: Referral[]
  commissions: Commission[]
  earned: Kobo
  paid: Kobo
  outstanding: Kobo
  converted: number
  signups: number
}

export function useMyReferral(): MyReferralState {
  const session = useSession()
  const profiles = useCollection(referrerProfilesCollection)
  const allReferrals = useCollection(referralsCollection)
  const allCommissions = useCollection(commissionsCollection)

  const personId = session?.personId
  const profile = personId ? profiles.find((p) => p.personId === personId) : undefined
  const referrals = profile ? allReferrals.filter((r) => r.referrerProfileId === profile.id) : []
  const commissions = personId ? allCommissions.filter((c) => c.beneficiaryPersonId === personId) : []

  const earned = asKobo(commissions.filter((c) => c.state !== 'cancelled').reduce((acc, c) => acc + c.amount, 0))
  const paid = asKobo(commissions.filter((c) => c.state === 'paid').reduce((acc, c) => acc + c.amount, 0))
  const outstanding = asKobo(earned - paid)
  const converted = referrals.filter((r) => r.admissionId !== null).length
  const signups = profile ? profile.stats.signups || referrals.length : 0

  return {
    personId,
    displayName: session?.displayName ?? 'You',
    profile,
    referrals,
    commissions,
    earned,
    paid,
    outstanding,
    converted,
    signups,
  }
}

export function referrerTypeForPersona(personaId: string | undefined): ReferrerType {
  switch (personaId) {
    case 'student':
      return 'student'
    case 'tutor':
      return 'tutor'
    case 'parent':
      return 'parent'
    case 'corporate-client':
      return 'corporate_partner'
    case 'sponsor':
      return 'partner'
    default:
      return 'employee'
  }
}

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto max-w-300 px-6 py-6">{children}</div>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          className:
            '!rounded-xl !border !border-border !bg-surface !text-text !text-[13px] !font-medium !shadow-lg',
        }}
      />
    </div>
  )
}

export const referralToast = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
}
