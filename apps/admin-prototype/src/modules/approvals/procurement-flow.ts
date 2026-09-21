/**
 * The procurement stage machine.
 *
 * The PRD's flow is Request → Approval → Quote and vendor → Purchase →
 * Payment → Asset or expense record, and each hop has a precondition that has
 * to be satisfied by data rather than by a person clicking through. Keeping the
 * rules here rather than in the screen means the register renders the reason a
 * stage cannot advance in the same words the guard uses to refuse it.
 *
 * Nothing here removes a row. A request that does not proceed is `rejected`,
 * which is terminal and stays on the register.
 */

import type { ProcurementRequest, ProcurementStage } from '@/mocks'

export const STAGE_ORDER: ProcurementStage[] = [
  'requested',
  'approved',
  'quoting',
  'ordered',
  'received',
  'paid',
  'closed',
]

export const STAGE_LABEL: Record<ProcurementStage, string> = {
  requested: 'Requested',
  approved: 'Approved',
  quoting: 'Quoting',
  ordered: 'Ordered',
  received: 'Received',
  paid: 'Paid',
  closed: 'Closed',
  rejected: 'Rejected',
}

/** The six phases of the PRD flow, each covering one or more stored stages. */
export interface ProcurementPhase {
  id: string
  label: string
  stages: ProcurementStage[]
  blurb: string
}

export const PHASES: ProcurementPhase[] = [
  {
    id: 'request',
    label: 'Request',
    stages: ['requested'],
    blurb: 'Raised by a person, not yet approved.',
  },
  {
    id: 'approval',
    label: 'Approval',
    stages: ['approved'],
    blurb: 'Approved through the engine, no vendor chosen yet.',
  },
  {
    id: 'quote',
    label: 'Quote and vendor',
    stages: ['quoting'],
    blurb: 'Collecting quotes. Nothing is committed.',
  },
  {
    id: 'purchase',
    label: 'Purchase',
    stages: ['ordered', 'received'],
    blurb: 'Ordered from the chosen vendor, and delivered.',
  },
  {
    id: 'payment',
    label: 'Payment',
    stages: ['paid'],
    blurb: 'Vendor paid at the actual cost.',
  },
  {
    id: 'record',
    label: 'Asset or expense record',
    stages: ['closed'],
    blurb: 'Closed against a company asset or an expense.',
  },
]

export function phaseOf(stage: ProcurementStage): ProcurementPhase | null {
  return PHASES.find((phase) => phase.stages.includes(stage)) ?? null
}

/** Categories that produce a durable company asset rather than a consumed expense. */
const ASSET_CATEGORIES = ['IT equipment', 'AV equipment', 'Furniture', 'Facilities']

export function producesAsset(request: ProcurementRequest): boolean {
  return ASSET_CATEGORIES.includes(request.category)
}

export function nextStage(stage: ProcurementStage): ProcurementStage | null {
  const index = STAGE_ORDER.indexOf(stage)
  if (index === -1 || index === STAGE_ORDER.length - 1) return null
  return STAGE_ORDER[index + 1]
}

export interface AdvanceCheck {
  /** The stage this request would move to, or null if it is already terminal. */
  to: ProcurementStage | null
  allowed: boolean
  /** Why not — rendered verbatim next to the disabled button. */
  reason: string | null
}

/**
 * `approvalStatus` is the status of the linked approval request, or null when
 * nothing is linked. The register resolves it; the guard only reads it.
 */
export function canAdvance(
  request: ProcurementRequest,
  approvalStatus: string | null,
): AdvanceCheck {
  if (request.stage === 'rejected') {
    return { to: null, allowed: false, reason: 'This request was rejected. Rejection is terminal.' }
  }
  if (request.stage === 'closed') {
    return { to: null, allowed: false, reason: 'This request is closed. Nothing follows it.' }
  }

  const to = nextStage(request.stage)
  if (!to) return { to: null, allowed: false, reason: 'Nothing follows this stage.' }

  switch (request.stage) {
    case 'requested':
      if (approvalStatus === null) {
        return {
          to,
          allowed: false,
          reason: 'No approval request is linked. Procurement cannot be approved from this register.',
        }
      }
      if (approvalStatus !== 'approved') {
        return {
          to,
          allowed: false,
          reason: `The linked approval is ${approvalStatus.replace(/_/g, ' ')}. It has to be approved first.`,
        }
      }
      return { to, allowed: true, reason: null }

    case 'quoting':
      if (!request.vendor) {
        return { to, allowed: false, reason: 'Attach a quote first — an order needs a vendor.' }
      }
      if (request.actualCost === null) {
        return { to, allowed: false, reason: 'Attach a quote first — an order needs a quoted cost.' }
      }
      return { to, allowed: true, reason: null }

    case 'received':
      if (request.actualCost === null) {
        return { to, allowed: false, reason: 'Record the actual cost before paying the vendor.' }
      }
      return { to, allowed: true, reason: null }

    case 'paid':
      if (!request.resultingAssetId && !request.resultingExpenseId) {
        return {
          to,
          allowed: false,
          reason: producesAsset(request)
            ? 'Create the asset record before closing. A purchase with no asset behind it is untraceable.'
            : 'Create the expense record before closing. A payment with no expense behind it never reaches the accounts.',
        }
      }
      return { to, allowed: true, reason: null }

    default:
      return { to, allowed: true, reason: null }
  }
}

/** Variance of actual against estimate, in kobo. Positive means an overspend. */
export function variance(request: ProcurementRequest): number | null {
  if (request.actualCost === null) return null
  return request.actualCost - request.estimatedCost
}

export function isRejectable(stage: ProcurementStage): boolean {
  return stage === 'requested' || stage === 'approved' || stage === 'quoting'
}
