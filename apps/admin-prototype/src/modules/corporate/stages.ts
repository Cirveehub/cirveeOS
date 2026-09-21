import { TODAY, corporateDealsCollection, type CorporateDeal, type DealStage } from '@/mocks'
import { asKobo } from '@/mocks/types'

import { corporateStamp, emitCorporateAudit } from './parts'

export type SimpleStage = 'prospect' | 'proposal' | 'negotiating' | 'won' | 'delivering'

export const SIMPLE_STAGES: SimpleStage[] = ['prospect', 'proposal', 'negotiating', 'won', 'delivering']

export const STAGE_LABEL: Record<SimpleStage, string> = {
  prospect: 'Prospect',
  proposal: 'Proposal sent',
  negotiating: 'Negotiating',
  won: 'Won',
  delivering: 'Delivering',
}

export const STAGE_PROBABILITY: Record<SimpleStage, number> = {
  prospect: 15,
  proposal: 50,
  negotiating: 70,
  won: 100,
  delivering: 100,
}

export const CANONICAL_STAGE: Record<SimpleStage, DealStage> = {
  prospect: 'prospect',
  proposal: 'proposal',
  negotiating: 'negotiation',
  won: 'won',
  delivering: 'delivery',
}

const TO_SIMPLE: Record<DealStage, SimpleStage> = {
  prospect: 'prospect',
  discovery: 'prospect',
  qualified: 'prospect',
  proposal: 'proposal',
  negotiation: 'negotiating',
  renewal: 'negotiating',
  won: 'won',
  delivery: 'delivering',
  completed: 'delivering',
}

export const STALLED_DAYS = 45

export function simpleStage(deal: Pick<CorporateDeal, 'stage'>): SimpleStage {
  return TO_SIMPLE[deal.stage]
}

export function isOpen(deal: Pick<CorporateDeal, 'stage'>): boolean {
  const s = simpleStage(deal)
  return s !== 'won' && s !== 'delivering'
}

export function isRenewal(deal: Pick<CorporateDeal, 'stage'>): boolean {
  return deal.stage === 'renewal'
}

export function daysInStage(deal: Pick<CorporateDeal, 'stageEnteredAt'>): number {
  return Math.max(0, Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(deal.stageEnteredAt)) / 86_400_000))
}

export function isStalled(deal: Pick<CorporateDeal, 'stage' | 'stageEnteredAt'>): boolean {
  return isOpen(deal) && daysInStage(deal) > STALLED_DAYS
}

export function setDealStage(dealId: string, to: SimpleStage, probabilityOverride?: number): void {
  const deal = corporateDealsCollection.find(dealId)
  if (!deal) return
  const from = simpleStage(deal)
  if (from === to && probabilityOverride === undefined) return

  const probability = probabilityOverride ?? STAGE_PROBABILITY[to]
  const stamp = corporateStamp()
  corporateDealsCollection.update(dealId, {
    stage: CANONICAL_STAGE[to],
    stageEnteredAt: from === to ? deal.stageEnteredAt : stamp.updatedAt,
    probability,
    weightedValue: asKobo(Math.round((deal.value * probability) / 100)),
    updatedAt: stamp.updatedAt,
    updatedBy: stamp.updatedBy,
  })
  emitCorporateAudit({
    action: 'corporate_deal.stage.change',
    entityType: 'CorporateDeal',
    entityId: dealId,
    entityRef: deal.ref,
    field: 'stage',
    before: STAGE_LABEL[from],
    after: STAGE_LABEL[to],
  })
}
