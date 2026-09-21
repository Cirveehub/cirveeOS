import {
  CURRENT_USER_ID,
  TODAY,
  auditEventsCollection,
  commissionRulesCollection,
  commissionsCollection,
  payoutBatchesCollection,
  referrerProfilesCollection,
  rolesCollection,
  usersCollection,
} from '@/mocks'
import { auditId, payoutId as asPayoutId } from '@/mocks/types'
import type {
  AuditEvent,
  Commission,
  CommissionRule,
  CommissionStateChange,
  Kobo,
  PayoutBatch,
  PayoutLine,
  PersonId,
} from '@/mocks/types'

import { candidateRule, dayBefore, findRule, nextRuleId, personName, ruleCode, validateDraft } from './lib'
import type { RuleDraft } from './lib'

export const stamp = (time = '10:00:00') => `${TODAY}T${time}+01:00`

export function currentPersonId(): PersonId | null {
  return usersCollection.find(CURRENT_USER_ID)?.personId ?? null
}

export function approvalBlock(c: Commission): string | null {
  if (c.beneficiaryPersonId === currentPersonId()) return 'This commission is yours. Someone else has to approve it.'
  if (c.state !== 'earned') return `Only earned commissions can be approved. This one is ${c.state}.`
  return null
}

function pushState(c: Commission, to: Commission['state'], note: string, patch: Partial<Commission> = {}) {
  const change: CommissionStateChange = { from: c.state, to, at: stamp(), byUserId: CURRENT_USER_ID, note }
  commissionsCollection.update(c.id, {
    state: to,
    stateHistory: [...c.stateHistory, change],
    updatedAt: stamp(),
    updatedBy: CURRENT_USER_ID,
    ...patch,
  })
}

export function approveCommissions(list: Commission[], note = 'Approved on the Payouts screen.'): Commission[] {
  const done: Commission[] = []
  for (const c of list) {
    if (approvalBlock(c)) continue
    pushState(c, 'approved', note, { approvedByUserId: CURRENT_USER_ID, approvedAt: stamp() })
    const fresh = commissionsCollection.find(c.id)
    if (fresh) done.push(fresh)
  }
  return done
}

export function makePayable(list: Commission[], note = 'Added to a payout.'): Commission[] {
  const done: Commission[] = []
  for (const c of list) {
    if (c.state !== 'approved') continue
    pushState(c, 'payable', note)
    const fresh = commissionsCollection.find(c.id)
    if (fresh) done.push(fresh)
  }
  return done
}

function nextBatchIdentity(): { id: PayoutBatch['id']; ref: string } {
  const numbers = payoutBatchesCollection.all().map((b) => Number(b.ref.split('-').at(-1) ?? 0))
  const next = Math.max(0, ...numbers) + 1
  return { id: asPayoutId(`payb-${String(next).padStart(3, '0')}`), ref: `PAY-B-2026-${String(next).padStart(3, '0')}` }
}

export function linesFor(commissions: Commission[]): PayoutLine[] {
  const byPerson = new Map<PersonId, Commission[]>()
  for (const c of commissions) {
    const list = byPerson.get(c.beneficiaryPersonId) ?? []
    list.push(c)
    byPerson.set(c.beneficiaryPersonId, list)
  }
  return [...byPerson.entries()].map(([personId, list]) => {
    const profile = referrerProfilesCollection.all().find((p) => p.personId === personId)
    return {
      beneficiaryPersonId: personId,
      commissionIds: list.map((c) => c.id),
      amount: list.reduce((acc, c) => acc + c.amount, 0) as Kobo,
      bankName: profile?.payoutMethod.bankName ?? 'GTBank',
      accountLast4: profile?.payoutMethod.accountLast4 ?? '0000',
      status: 'pending',
      failureReason: null,
      bankReference: null,
    }
  })
}

export function createPayoutBatch(
  commissions: Commission[],
  opts: { method: PayoutBatch['method']; scheduledDate: string; status?: PayoutBatch['status'] },
): PayoutBatch {
  const { id, ref } = nextBatchIdentity()
  const lines = linesFor(commissions)
  const batch: PayoutBatch = {
    id,
    ref,
    scheduledDate: opts.scheduledDate,
    method: opts.method,
    status: opts.status ?? 'draft',
    totalAmount: lines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
    beneficiaryCount: lines.length,
    approvalRequestId: null,
    lines,
    createdAt: stamp(),
    createdBy: CURRENT_USER_ID,
    updatedAt: stamp(),
    updatedBy: CURRENT_USER_ID,
  }
  payoutBatchesCollection.insert(batch)
  for (const c of commissions) {
    commissionsCollection.update(c.id, { payoutBatchId: id, updatedAt: stamp(), updatedBy: CURRENT_USER_ID })
  }
  return batch
}

export function writeBatchLines(batch: PayoutBatch, lines: PayoutLine[], patch: Partial<PayoutBatch> = {}) {
  payoutBatchesCollection.update(batch.id, {
    lines,
    totalAmount: lines.reduce((acc, l) => acc + l.amount, 0) as Kobo,
    beneficiaryCount: lines.length,
    updatedAt: stamp(),
    updatedBy: CURRENT_USER_ID,
    ...patch,
  })
}

export function markBatchPaid(batch: PayoutBatch, bankReference: string): PayoutBatch | undefined {
  const lines = batch.lines.map((line, index) =>
    line.status === 'failed'
      ? line
      : { ...line, status: 'paid' as const, bankReference: `${bankReference}/${String(index + 1).padStart(2, '0')}` },
  )
  for (const line of lines) {
    if (line.status !== 'paid') continue
    for (const commissionId of line.commissionIds) {
      const commission = commissionsCollection.find(commissionId)
      if (!commission || commission.state === 'paid') continue
      pushState(commission, 'paid', `Paid in ${batch.ref}, bank reference ${line.bankReference}.`, { paidAt: stamp() })
    }
  }
  writeBatchLines(batch, lines, { status: lines.some((l) => l.status === 'failed') ? 'partially_failed' : 'paid' })
  return payoutBatchesCollection.find(batch.id)
}

export interface PayNowResult {
  batch: PayoutBatch | undefined
  paid: Commission[]
  skipped: Array<{ commission: Commission; reason: string }>
}

export function payNow(commissions: Commission[], bankReference: string): PayNowResult {
  const skipped: PayNowResult['skipped'] = []
  const ready: Commission[] = []

  for (const c of commissions) {
    if (c.payoutBatchId) {
      const existing = payoutBatchesCollection.find(c.payoutBatchId)
      if (existing && existing.status !== 'paid') {
        skipped.push({ commission: c, reason: `Already in ${existing.ref}.` })
        continue
      }
    }
    if (c.state === 'earned') {
      const block = approvalBlock(c)
      if (block) {
        skipped.push({ commission: c, reason: block })
        continue
      }
      const [approved] = approveCommissions([c])
      if (!approved) continue
      const [payable] = makePayable([approved])
      if (payable) ready.push(payable)
      continue
    }
    if (c.state === 'approved') {
      const [payable] = makePayable([c])
      if (payable) ready.push(payable)
      continue
    }
    if (c.state === 'payable') {
      ready.push(c)
      continue
    }
    skipped.push({ commission: c, reason: `Not owed: it is ${c.state}.` })
  }

  if (!ready.length) return { batch: undefined, paid: [], skipped }

  const batch = createPayoutBatch(ready, { method: 'bank_transfer', scheduledDate: TODAY, status: 'approved' })
  const paidBatch = markBatchPaid(batch, bankReference)
  const paid = ready.map((c) => commissionsCollection.find(c.id)).filter((c): c is Commission => Boolean(c))
  return { batch: paidBatch, paid, skipped }
}

function actorMeta(): { actorName: string; actorRole: string } {
  const actor = usersCollection.find(CURRENT_USER_ID)
  const role = actor?.roleIds[0] ? (rolesCollection.find(actor.roleIds[0])?.name ?? 'Super Admin') : 'Super Admin'
  return { actorName: actor ? personName(actor.personId) : 'Super Admin', actorRole: role }
}

export function writeRuleAudit(rule: CommissionRule, previous: CommissionRule | undefined, action?: string) {
  const event: AuditEvent = {
    id: auditId(`audit-rule-${rule.id}-${Date.now()}`),
    at: stamp('09:00:00'),
    actorUserId: CURRENT_USER_ID,
    ...actorMeta(),
    action: action ?? (previous ? 'commission_rule.version_created' : 'commission_rule.created'),
    entityType: 'CommissionRule',
    entityId: rule.id,
    entityRef: ruleCode(rule),
    field: previous ? 'version' : null,
    before: previous ? String(previous.version) : null,
    after: String(rule.version),
    source: 'ui',
    ip: '102.89.34.17',
  }
  auditEventsCollection.insert(event)
}

export type CommitOutcome = { ok: true; rule: CommissionRule } | { ok: false; errors: Partial<Record<string, string>> }

export function commitRule(draft: RuleDraft): CommitOutcome {
  const errors = validateDraft(draft)
  if (Object.keys(errors).length) return { ok: false, errors }

  const status: CommissionRule['status'] = draft.effectiveFrom > TODAY ? 'scheduled' : 'active'
  const rule = candidateRule(draft, { id: nextRuleId(draft), status, actor: CURRENT_USER_ID, now: stamp('09:00:00') })
  if (commissionRulesCollection.find(rule.id)) {
    return { ok: false, errors: { name: 'A version with this number already exists. Reload and try again.' } }
  }
  commissionRulesCollection.insert(rule)

  const previous = draft.supersedesVersionId ? findRule(draft.supersedesVersionId) : undefined
  if (previous) {
    commissionRulesCollection.update(previous.id, {
      effectiveTo: dayBefore(rule.effectiveFrom),
      status: 'superseded',
      updatedAt: stamp('09:00:00'),
      updatedBy: CURRENT_USER_ID,
    })
  }
  writeRuleAudit(rule, previous)
  return { ok: true, rule }
}

export function endDateRule(rule: CommissionRule, effectiveTo: string) {
  commissionRulesCollection.update(rule.id, {
    effectiveTo,
    status: effectiveTo < TODAY ? 'superseded' : rule.status,
    updatedAt: stamp('09:00:00'),
    updatedBy: CURRENT_USER_ID,
  })
  const event: AuditEvent = {
    id: auditId(`audit-rule-${rule.id}-end-${Date.now()}`),
    at: stamp('09:00:00'),
    actorUserId: CURRENT_USER_ID,
    ...actorMeta(),
    action: 'commission_rule.end_dated',
    entityType: 'CommissionRule',
    entityId: rule.id,
    entityRef: ruleCode(rule),
    field: 'effectiveTo',
    before: rule.effectiveTo,
    after: effectiveTo,
    source: 'ui',
    ip: '102.89.34.17',
  }
  auditEventsCollection.insert(event)
}
