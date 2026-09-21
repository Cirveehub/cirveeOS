import {
  computeCommission,
  referrerProfilesCollection,
  rulesInForceOn,
  usersCollection,
} from '@/mocks'
import type {
  BranchId,
  CommissionPreview,
  CommissionRoleOnDeal,
  Kobo,
  PersonId,
  UnitId,
  UserId,
} from '@/mocks/types'
import { personName } from './lookups'

export interface AdmissionPreviewInput {
  unitId: UnitId
  branchId: BranchId
  quotedFee: Kobo
  netFee: Kobo
  collected: Kobo
  referrerPersonId: PersonId | null
  leadOwnerUserId: UserId
  closerUserId: UserId | null
  onDate?: string
}

function personIdOfUser(userId: UserId | null): PersonId | null {
  if (!userId) return null
  return usersCollection.find(userId)?.personId ?? null
}

export function previewAdmissionCommissions(input: AdmissionPreviewInput): CommissionPreview[] {
  const beneficiaries: Record<CommissionRoleOnDeal, PersonId | null> = {
    referrer: input.referrerPersonId,
    lead_owner: personIdOfUser(input.leadOwnerUserId),
    closer: personIdOfUser(input.closerUserId),
  }

  const out: CommissionPreview[] = []

  for (const rule of rulesInForceOn(input.onDate)) {
    if (rule.unitIds.length && !rule.unitIds.includes(input.unitId)) continue
    if (rule.branchIds.length && !rule.branchIds.includes(input.branchId)) continue

    const beneficiaryPersonId = beneficiaries[rule.roleOnDeal]
    if (!beneficiaryPersonId) continue

    if (rule.roleOnDeal === 'referrer') {
      const profile = referrerProfilesCollection
        .all()
        .find((p) => p.personId === beneficiaryPersonId)
      if (!profile) continue
      if (rule.beneficiaryType !== 'staff' && profile.type !== rule.beneficiaryType) continue
      if (profile.status !== 'active') continue
    }

    const workings = computeCommission(rule, {
      grossFee: input.quotedFee,
      netAfterDiscount: input.netFee,
      amountCollected: input.collected,
    })

    const paidPercent =
      input.netFee > 0 ? Math.round((input.collected / input.netFee) * 100) : 0
    const fullyPaid = input.netFee > 0 && input.collected >= input.netFee
    const meetsMinimum =
      rule.eligibility.minimumPercentPaid === null ||
      paidPercent >= rule.eligibility.minimumPercentPaid
    const eligible = rule.eligibility.requiresFullPayment ? fullyPaid : meetsMinimum

    out.push({
      beneficiaryPersonId,
      beneficiaryName: personName(beneficiaryPersonId),
      roleOnDeal: rule.roleOnDeal,
      ruleId: rule.id,
      ruleKey: rule.ruleKey,
      ruleName: rule.name,
      ruleVersion: rule.version,
      basis: rule.basis,
      basisAmount: workings.basisAmount,
      rateApplied: workings.rateApplied,
      tierLabel: workings.tierLabel,
      amount: workings.amount,
      state: eligible ? 'earned' : rule.eligibility.stateBeforeEligible,
      eligibilityNote: eligible
        ? rule.approvalRequired
          ? 'Approval required before payable: yes'
          : null
        : rule.eligibility.requiresFullPayment
          ? `Held: ${paidPercent}% paid, rule requires 100%`
          : `Held: ${paidPercent}% paid, rule requires ${rule.eligibility.minimumPercentPaid ?? 0}%`,
      workings: workings.explanation,
    })
  }

  return out
}
