import {
  admissionsCollection,
  automationRunsCollection,
  commissionsCollection,
  invoicesCollection,
  messagesCollection,
  peopleCollection,
  unitsCollection,
} from '@/mocks'
import type { Admission, AutomationNode, ConditionGroup, Invoice, Person } from '@/mocks/types'
import { formatNaira } from '@/lib/format'

import {
  ACTIONS,
  actionLabel,
  actionSummary,
  branchName,
  cohortCode,
  delaySummary,
  fieldMeta,
  groupText,
  idempotencyPreview,
  isGroup,
  laneChildIds,
  operatorArity,
  operatorLabel,
  personName,
  recipientLabel,
  templateName,
  triggerLabel,
  valueText,
  type ConditionRule,
} from './lib'

export interface TestSubject {
  id: string
  label: string
  personId: string
  invoiceId: string
  admissionId: string | null
}

export function testSubjects(limit = 24): TestSubject[] {
  const invoices = invoicesCollection
    .where((i) => i.personId !== null && i.voidedAt === null)
    .sort((a, b) => {
      const rank = (inv: Invoice) => (inv.balance === 0 ? 0 : 1)
      return rank(a) - rank(b) || a.ref.localeCompare(b.ref)
    })
    .slice(0, limit)

  return invoices.map((inv) => {
    const admission = inv.admissionId ? admissionsCollection.find(inv.admissionId) : undefined
    return {
      id: inv.id,
      label: `${personName(inv.personId)} · ${inv.ref} · ${formatNaira(inv.total)}${
        inv.balance === 0 ? ' · fully paid' : ` · ${formatNaira(inv.balance)} outstanding`
      }`,
      personId: String(inv.personId),
      invoiceId: inv.id,
      admissionId: admission?.id ?? null,
    }
  })
}

export interface TestContext {
  person: Person | undefined
  invoice: Invoice | undefined
  admission: Admission | undefined
  values: Record<string, unknown>
}

function optedOut(person: Person | undefined): boolean {
  if (!person) return false
  const consent = person.consents.find((c) => c.type === 'communications')
  return consent ? !consent.granted : false
}

export function buildContext(subject: TestSubject): TestContext {
  const person = peopleCollection.find(subject.personId)
  const invoice = invoicesCollection.find(subject.invoiceId)
  const admission = subject.admissionId ? admissionsCollection.find(subject.admissionId) : undefined
  const unitCode = invoice ? (unitsCollection.find(invoice.unitId)?.code ?? null) : null

  const values: Record<string, unknown> = {
    'person.optedOut': optedOut(person),
    'person.whatsapp': person?.whatsapp ?? null,
    'person.branch': person?.primaryBranchId ? branchName(person.primaryBranchId) : null,
    'person.tags': person?.tags ?? [],
    'invoice.unit': unitCode,
    'invoice.balance': invoice?.balance ?? null,
    'invoice.total': invoice?.total ?? null,
    'invoice.status': invoice?.status ?? null,
    'invoice.daysOverdue': invoice?.daysOverdue ?? null,
    'admission.status': admission?.status ?? null,
    'admission.referrerPersonId': admission?.referrerPersonId ?? null,
    'admission.cohortId': admission?.cohortId ?? null,
    'admission.branchId': admission?.branchId ?? null,
    'enrolment.unit': unitCode,
    'enrolment.status': admission?.status === 'enrolled' ? 'active' : null,
  }

  return { person, invoice, admission, values }
}

function same(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) return b === null || b === undefined || b === ''
  if (typeof a === 'boolean' || typeof b === 'boolean') return Boolean(a) === Boolean(b)
  return String(a).toLowerCase() === String(b).toLowerCase()
}

function compare(op: string, actual: unknown, expected: unknown): boolean {
  const list = Array.isArray(expected) ? expected : [expected]
  const num = typeof actual === 'number' ? actual : Number(actual)
  const target = typeof expected === 'number' ? expected : Number(expected)

  switch (op) {
    case 'is':
    case 'changed_to':
      return same(actual, expected)
    case 'is_not':
      return !same(actual, expected)
    case 'in':
      return list.some((v) => same(actual, v))
    case 'not_in':
      return !list.some((v) => same(actual, v))
    case 'contains':
      return Array.isArray(actual)
        ? actual.some((v) => same(v, expected))
        : String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase())
    case 'is_empty':
      return actual === null || actual === undefined || actual === '' || (Array.isArray(actual) && actual.length === 0)
    case 'is_not_empty':
      return !(actual === null || actual === undefined || actual === '' || (Array.isArray(actual) && actual.length === 0))
    case 'gt':
      return Number.isFinite(num) && num > target
    case 'gte':
      return Number.isFinite(num) && num >= target
    case 'lt':
      return Number.isFinite(num) && num < target
    case 'lte':
      return Number.isFinite(num) && num <= target
    case 'between': {
      const [lo, hi] = Array.isArray(expected) ? expected : [expected, expected]
      return Number.isFinite(num) && num >= Number(lo) && num <= Number(hi)
    }
    default:
      return false
  }
}

export function actualText(path: string, ctx: TestContext): string {
  const raw = ctx.values[path]
  const meta = fieldMeta(path)
  if (raw === undefined) return 'not present on this record'
  if (raw === null) return 'empty'
  if (meta?.type === 'money' && typeof raw === 'number') return formatNaira(raw)
  if (path === 'admission.referrerPersonId') return personName(String(raw))
  if (path === 'admission.cohortId') return cohortCode(String(raw))
  if (path === 'admission.branchId') return branchName(String(raw))
  return valueText(raw, meta)
}

export interface GroupResult {
  passed: boolean
  lines: Array<{ text: string; passed: boolean }>
}

export function evaluateGroup(group: ConditionGroup, ctx: TestContext): GroupResult {
  if (!group.rules.length) return { passed: true, lines: [{ text: 'No rows — every trigger passes.', passed: true }] }

  const lines: Array<{ text: string; passed: boolean }> = []
  const results = group.rules.map((r) => {
    if (isGroup(r)) {
      const nested = evaluateGroup(r, ctx)
      lines.push({ text: `(${groupText(r)}) → ${nested.passed ? 'true' : 'false'}`, passed: nested.passed })
      return nested.passed
    }
    const rule = r as ConditionRule
    const meta = fieldMeta(rule.field)
    const actual = ctx.values[rule.field]
    const passed = compare(rule.op, actual, rule.value)
    const arity = operatorArity(rule.op)
    const expected = arity === 'none' ? '' : ` ${valueText(rule.value, meta)}`
    lines.push({
      text: `${meta?.label ?? rule.field} is ${actualText(rule.field, ctx)} — needs to be ${operatorLabel(
        rule.op,
        meta?.type,
      )}${expected} → ${passed ? 'true' : 'false'}`,
      passed,
    })
    return passed
  })

  const passed = group.operator === 'and' ? results.every(Boolean) : results.some(Boolean)
  return { passed, lines }
}

export type StepVerdict = 'evaluated' | 'would_execute' | 'skipped' | 'stopped' | 'waiting'

export interface SimStep {
  nodeId: string
  kind: AutomationNode['kind']
  title: string
  verdict: StepVerdict
  inputs: Array<{ label: string; value: string }>
  outcome: string
  detail: Array<{ text: string; passed: boolean }>
  wouldProduce: string[]
  skippedReason: string | null
}

export interface SimResult {
  steps: SimStep[]
  idempotencyKey: string
  reached: 'end' | 'stopped' | 'conditions_not_met'
  actionsWouldRun: number
  actionsTotal: number
  before: StoreCounts
  after: StoreCounts
}

export interface StoreCounts {
  runs: number
  messages: number
  commissions: number
}

export function storeCounts(): StoreCounts {
  return {
    runs: automationRunsCollection.count(),
    messages: messagesCollection.count(),
    commissions: commissionsCollection.count(),
  }
}

function wouldProduceFor(
  node: Extract<AutomationNode, { kind: 'action' }>,
  ctx: TestContext,
): string[] {
  switch (node.actionType) {
    case 'send_message': {
      const to =
        node.params.recipient === 'admission.referrer'
          ? personName(ctx.admission?.referrerPersonId ?? null)
          : personName(ctx.person?.id ?? null)
      return [`One message to ${to} from the "${templateName(node.params.templateId)}" template — not sent.`]
    }
    case 'calculate_commission': {
      const rows: string[] = []
      if (ctx.admission?.referrerPersonId) rows.push(`Referrer — ${personName(ctx.admission.referrerPersonId)}`)
      if (ctx.admission?.leadOwnerUserId) rows.push('Lead owner — evaluated independently')
      if (ctx.admission?.closerUserId) rows.push('Closer — evaluated independently')
      return rows.length
        ? [`${rows.length} commission row(s) would be evaluated: ${rows.join('; ')} — none created.`]
        : ['No commission row would be created — this deal has no referrer, lead owner or closer in force.']
    }
    case 'grant_lms_access':
      return [`Cirvee Learn access for cohort ${cohortCode(ctx.admission?.cohortId ?? null)} — not granted.`]
    case 'issue_card':
      return [`One student card at ${branchName(ctx.admission?.branchId ?? null)} — not issued.`]
    case 'create_task':
      return ['One task — not created.']
    case 'generate_document':
      return ['One document — not generated.']
    case 'request_approval':
      return ['One approval request — not raised.']
    case 'webhook':
      return ['Nothing. Webhooks are disabled in this prototype.']
    default:
      return [`${actionLabel(node.actionType)} — not executed.`]
  }
}

export function simulate(
  nodes: AutomationNode[],
  automationKey: string,
  idempotencyFields: string[],
  subject: TestSubject,
): SimResult {
  const before = storeCounts()
  const ctx = buildContext(subject)
  const nested = laneChildIds(nodes)
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const steps: SimStep[] = []

  let halted: SimResult['reached'] = 'end'
  let haltReason: string | null = null

  const runAction = (node: Extract<AutomationNode, { kind: 'action' }>) => {
    if (halted !== 'end') {
      steps.push({
        nodeId: node.id,
        kind: 'action',
        title: actionLabel(node.actionType),
        verdict: 'skipped',
        inputs: [],
        outcome: 'Not reached',
        detail: [],
        wouldProduce: [],
        skippedReason: haltReason,
      })
      return
    }
    const disabled = ACTIONS[node.actionType].disabled
    steps.push({
      nodeId: node.id,
      kind: 'action',
      title: actionLabel(node.actionType),
      verdict: disabled ? 'skipped' : 'would_execute',
      inputs: inputsForAction(node, ctx),
      outcome: disabled ? 'Disabled in this prototype' : actionSummary(node),
      detail: [],
      wouldProduce: wouldProduceFor(node, ctx),
      skippedReason: disabled ? 'Webhooks are not executed in a frontend-only prototype.' : null,
    })
  }

  for (const node of nodes) {
    if (nested.has(node.id)) continue

    if (halted !== 'end' && node.kind !== 'stop') {
      steps.push({
        nodeId: node.id,
        kind: node.kind,
        title: nodeHeading(node),
        verdict: 'skipped',
        inputs: [],
        outcome: 'Not reached',
        detail: [],
        wouldProduce: [],
        skippedReason: haltReason,
      })
      continue
    }

    switch (node.kind) {
      case 'trigger': {
        steps.push({
          nodeId: node.id,
          kind: 'trigger',
          title: triggerLabel(node.triggerType),
          verdict: 'evaluated',
          inputs: [
            { label: 'Subject', value: personName(subject.personId) },
            { label: 'Invoice', value: ctx.invoice?.ref ?? '—' },
            { label: 'Admission', value: ctx.admission?.ref ?? 'none' },
          ],
          outcome: `Trigger payload assembled for ${personName(subject.personId)}.`,
          detail: [],
          wouldProduce: [],
          skippedReason: null,
        })
        break
      }
      case 'condition': {
        const result = evaluateGroup(node.group, ctx)
        steps.push({
          nodeId: node.id,
          kind: 'condition',
          title: 'Condition',
          verdict: 'evaluated',
          inputs: node.group.rules
            .filter((r): r is ConditionRule => !isGroup(r))
            .map((r) => ({ label: fieldMeta(r.field)?.label ?? r.field, value: actualText(r.field, ctx) })),
          outcome: result.passed ? 'true — the run continues' : 'false — the run stops here',
          detail: result.lines,
          wouldProduce: [],
          skippedReason: null,
        })
        if (!result.passed) {
          halted = 'conditions_not_met'
          haltReason = 'Conditions were not met, so nothing after this point runs.'
        }
        break
      }
      case 'delay': {
        steps.push({
          nodeId: node.id,
          kind: 'delay',
          title: 'Delay',
          verdict: 'waiting',
          inputs: [],
          outcome: `${delaySummary(node)} A test run does not wait — it carries straight on.`,
          detail: [],
          wouldProduce: [],
          skippedReason: null,
        })
        break
      }
      case 'branch': {
        const laneResults = node.lanes.map((lane) =>
          lane.condition ? evaluateGroup(lane.condition, ctx) : { passed: true, lines: [] },
        )
        const takenIndex = laneResults.findIndex((r) => r.passed)
        const taken = takenIndex >= 0 ? takenIndex : node.lanes.length - 1
        steps.push({
          nodeId: node.id,
          kind: 'branch',
          title: node.label,
          verdict: 'evaluated',
          inputs: [],
          outcome: `Takes lane "${node.lanes[taken]?.label ?? '—'}".`,
          detail: node.lanes.flatMap((lane, i) => [
            { text: `${lane.label}: ${laneResults[i].passed ? 'true' : 'false'}`, passed: laneResults[i].passed },
            ...laneResults[i].lines,
          ]),
          wouldProduce: [],
          skippedReason: null,
        })
        node.lanes.forEach((lane, i) => {
          for (const childId of lane.nodeIds) {
            const child = byId.get(childId)
            if (!child) continue
            if (i !== taken) {
              steps.push({
                nodeId: child.id,
                kind: child.kind,
                title: nodeHeading(child),
                verdict: 'skipped',
                inputs: [],
                outcome: 'Not on the lane this record took',
                detail: [],
                wouldProduce: [],
                skippedReason: `Lane "${lane.label}" was not taken.`,
              })
              continue
            }
            if (child.kind === 'action') runAction(child)
          }
        })
        break
      }
      case 'action':
        runAction(node)
        break
      case 'stop': {
        const result = evaluateGroup(node.condition, ctx)
        const fired = node.condition.rules.length > 0 && result.passed
        steps.push({
          nodeId: node.id,
          kind: 'stop',
          title: 'Stop condition',
          verdict: fired ? 'stopped' : 'evaluated',
          inputs: [],
          outcome: fired
            ? 'Stop condition is true for this record — the automation would stop here.'
            : 'Stop condition is false — the automation stays live for this record.',
          detail: result.lines,
          wouldProduce: [],
          skippedReason: null,
        })
        if (fired && halted === 'end') {
          halted = 'stopped'
          haltReason = 'The stop condition fired.'
        }
        break
      }
    }
  }

  const actionsTotal = nodes.filter((n) => n.kind === 'action').length
  const actionsWouldRun = steps.filter((s) => s.verdict === 'would_execute').length

  return {
    steps,
    idempotencyKey: idempotencyPreviewFor(automationKey, idempotencyFields, subject),
    reached: halted,
    actionsWouldRun,
    actionsTotal,
    before,
    after: storeCounts(),
  }
}

function nodeHeading(node: AutomationNode): string {
  switch (node.kind) {
    case 'trigger':
      return triggerLabel(node.triggerType)
    case 'action':
      return actionLabel(node.actionType)
    case 'branch':
      return node.label
    case 'condition':
      return 'Condition'
    case 'delay':
      return 'Delay'
    case 'stop':
      return 'Stop condition'
  }
}

function inputsForAction(
  node: Extract<AutomationNode, { kind: 'action' }>,
  ctx: TestContext,
): Array<{ label: string; value: string }> {
  switch (node.actionType) {
    case 'send_message':
      return [
        { label: 'Channel', value: String(node.params.channel ?? '—') },
        { label: 'Template', value: templateName(node.params.templateId) },
        { label: 'Recipient', value: recipientLabel(node.params.recipient) },
        {
          label: 'Resolved to',
          value:
            node.params.recipient === 'admission.referrer'
              ? personName(ctx.admission?.referrerPersonId ?? null)
              : personName(ctx.person?.id ?? null),
        },
      ]
    case 'grant_lms_access':
      return [{ label: 'Cohort', value: cohortCode(ctx.admission?.cohortId ?? null) }]
    case 'issue_card':
      return [
        { label: 'Card type', value: String(node.params.holderType ?? 'student') },
        { label: 'Branch', value: branchName(ctx.admission?.branchId ?? null) },
      ]
    case 'calculate_commission':
      return [
        { label: 'Referrer', value: personName(ctx.admission?.referrerPersonId ?? null) },
        { label: 'Lead owner', value: ctx.admission?.leadOwnerUserId ? 'Set on the admission' : 'None' },
        { label: 'Closer', value: ctx.admission?.closerUserId ? 'Set on the admission' : 'None' },
      ]
    default:
      return []
  }
}

export function idempotencyPreviewFor(
  automationKey: string,
  fields: string[],
  subject: TestSubject,
): string {
  if (!fields.length) return idempotencyPreview(automationKey, fields)
  const parts = fields.map((f) => {
    if (f === 'person.id') return subject.personId.replace(/^per-/, 'per_')
    if (f === 'invoice.id') return subject.invoiceId.replace(/^inv-/, 'inv_')
    if (f === 'admission.id') return (subject.admissionId ?? 'none').replace(/^adm-/, 'adm_')
    return f
  })
  return `${automationKey || 'automation-key'}:${parts.join(':')}`
}

export function renderTemplatePreview(body: string, subject: TestSubject | undefined): {
  text: string
  unresolved: string[]
} {
  if (!subject) return { text: body, unresolved: [] }
  const ctx = buildContext(subject)
  const unresolved: string[] = []

  const lookup: Record<string, string | null> = {
    'person.firstName': ctx.person?.firstName ?? null,
    'person.lastName': ctx.person?.lastName ?? null,
    'invoice.ref': ctx.invoice?.ref ?? null,
    'invoice.balance': ctx.invoice ? formatNaira(ctx.invoice.balance) : null,
    'invoice.dueDate': ctx.invoice?.dueDate ?? null,
    'payment.amount': ctx.invoice ? formatNaira(ctx.invoice.paidAmount) : null,
    'cohort.code': cohortCode(ctx.admission?.cohortId ?? null),
    'course.title': ctx.admission ? 'the course on the admission' : null,
    'referred.firstName': ctx.person?.firstName ?? null,
  }

  const text = body.replace(/\{\{([a-zA-Z.]+)\}\}/g, (_match, field: string) => {
    const value = lookup[field]
    if (value === null || value === undefined) {
      unresolved.push(field)
      return `{{${field}}}`
    }
    return value
  })

  return { text, unresolved }
}
