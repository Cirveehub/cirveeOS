import {
  auditEventsCollection,
  automationExceptionsCollection,
  automationRunsCollection,
  automationsCollection,
  commissionsCollection,
  messageTemplatesCollection,
  messagesCollection,
  rolesCollection,
  usersCollection,
  CURRENT_USER_ID,
} from '@/mocks'
import type {
  Automation,
  AutomationException,
  AutomationNode,
  AutomationRun,
  AutomationRunStep,
  AutomationStatus,
  AuditEvent,
  Message,
  UserId,
} from '@/mocks/types'
import { auditId, automationId as makeAutomationId, messageId as makeMessageId, runId as makeRunId } from '@/mocks/types'

import {
  ACTIONS,
  actionLabel,
  actionSummary,
  branchName,
  cohortCode,
  groupText,
  modulesFor,
  personName,
  templateName,
  triggerLabel,
  userName,
} from './lib'
import { buildContext, evaluateGroup, idempotencyPreviewFor, type TestSubject } from './simulate'

const IP = '102.89.34.17'

export function actingUser(): UserId {
  return CURRENT_USER_ID as UserId
}

function actorRole(id: UserId): string {
  const user = usersCollection.find(id)
  const roleId = user?.roleIds[0]
  return (roleId ? rolesCollection.find(roleId)?.name : null) ?? 'Super Admin'
}

export function writeAudit(args: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): AuditEvent {
  const actor = actingUser()
  const event: AuditEvent = {
    id: auditId(`aud-${Math.random().toString(36).slice(2, 10)}`),
    at: new Date().toISOString(),
    actorUserId: actor,
    actorName: userName(actor),
    actorRole: actorRole(actor),
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    entityRef: args.entityRef,
    field: args.field ?? null,
    before: args.before ?? null,
    after: args.after ?? null,
    source: 'ui',
    ip: IP,
  }
  return auditEventsCollection.insert(event)
}

export function setAutomationStatus(automation: Automation, status: AutomationStatus): Automation | undefined {
  if (automation.status === status) return automation
  const updated = automationsCollection.update(automation.id, {
    status,
    updatedAt: new Date().toISOString(),
    updatedBy: actingUser(),
    ...(status === 'archived'
      ? { archivedAt: new Date().toISOString(), archivedReason: 'Disabled from the workflow list.' }
      : {}),
  })
  writeAudit({
    action: `automation.${status === 'active' ? 'resume' : status}`,
    entityType: 'Automation',
    entityId: automation.id,
    entityRef: `${automation.name} v${automation.version}`,
    field: 'status',
    before: automation.status,
    after: status,
  })
  return updated
}

export interface DraftShape {
  name: string
  description: string
  automationKey: string
  nodes: AutomationNode[]
  reliability: Automation['reliability']
}

function nextVersionNumber(automationKey: string): number {
  const versions = automationsCollection.where((a) => a.automationKey === automationKey)
  return versions.reduce((max, a) => Math.max(max, a.version), 0) + 1
}

function stamp(): { createdAt: string; createdBy: UserId; updatedAt: string; updatedBy: UserId } {
  const now = new Date().toISOString()
  const actor = actingUser()
  return { createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor }
}

export function createAutomation(draft: DraftShape): Automation {
  const created: Automation = {
    id: makeAutomationId(`auto-${draft.automationKey || 'untitled'}-v1-${Math.random().toString(36).slice(2, 6)}`),
    automationKey: draft.automationKey,
    version: 1,
    name: draft.name,
    description: draft.description,
    status: 'draft',
    ownerUserId: actingUser(),
    nodes: draft.nodes,
    modulesTouched: modulesFor(draft.nodes),
    reliability: draft.reliability,
    stats: { runs7d: 0, successRate: 0, lastRunAt: null },
    supersedesVersionId: null,
    ...stamp(),
  }
  automationsCollection.insert(created)
  writeAudit({
    action: 'automation.create',
    entityType: 'Automation',
    entityId: created.id,
    entityRef: `${created.name} v1`,
    field: 'status',
    before: null,
    after: 'draft',
  })
  return created
}

export function saveDraft(
  existing: Automation,
  draft: DraftShape,
): { automation: Automation; newVersion: boolean } {
  if (existing.status === 'draft') {
    const updated = automationsCollection.update(existing.id, {
      name: draft.name,
      description: draft.description,
      nodes: draft.nodes,
      reliability: draft.reliability,
      modulesTouched: modulesFor(draft.nodes),
      updatedAt: new Date().toISOString(),
      updatedBy: actingUser(),
    })
    writeAudit({
      action: 'automation.edit',
      entityType: 'Automation',
      entityId: existing.id,
      entityRef: `${draft.name} v${existing.version}`,
      field: 'nodes',
      before: `${existing.nodes.length} node(s)`,
      after: `${draft.nodes.length} node(s)`,
    })
    return { automation: updated ?? existing, newVersion: false }
  }

  const version = nextVersionNumber(existing.automationKey)
  const created: Automation = {
    id: makeAutomationId(`${existing.automationKey}-v${version}-${Math.random().toString(36).slice(2, 6)}`),
    automationKey: existing.automationKey,
    version,
    name: draft.name,
    description: draft.description,
    status: 'draft',
    ownerUserId: existing.ownerUserId,
    nodes: draft.nodes,
    modulesTouched: modulesFor(draft.nodes),
    reliability: draft.reliability,
    stats: { runs7d: 0, successRate: 0, lastRunAt: null },
    supersedesVersionId: existing.id,
    ...stamp(),
  }
  automationsCollection.insert(created)
  writeAudit({
    action: 'automation.version.create',
    entityType: 'Automation',
    entityId: created.id,
    entityRef: `${created.name} v${version}`,
    field: 'version',
    before: `v${existing.version}`,
    after: `v${version}`,
  })
  return { automation: created, newVersion: true }
}

export function activate(draft: Automation): Automation | undefined {
  const previous = automationsCollection
    .where((a) => a.automationKey === draft.automationKey && a.id !== draft.id && a.status === 'active')
    .sort((a, b) => b.version - a.version)[0]

  if (previous) {
    automationsCollection.update(previous.id, {
      status: 'archived',
      archivedAt: new Date().toISOString(),
      archivedReason: `Superseded by v${draft.version}.`,
      updatedAt: new Date().toISOString(),
      updatedBy: actingUser(),
    })
    writeAudit({
      action: 'automation.supersede',
      entityType: 'Automation',
      entityId: previous.id,
      entityRef: `${previous.name} v${previous.version}`,
      field: 'status',
      before: 'active',
      after: 'archived',
    })
  }

  const updated = automationsCollection.update(draft.id, {
    status: 'active',
    updatedAt: new Date().toISOString(),
    updatedBy: actingUser(),
  })
  writeAudit({
    action: 'automation.activate',
    entityType: 'Automation',
    entityId: draft.id,
    entityRef: `${draft.name} v${draft.version}`,
    field: 'status',
    before: 'draft',
    after: 'active',
  })
  return updated
}

function nowIso(): string {
  return new Date().toISOString()
}

export function existingRunForKey(key: string): AutomationRun | undefined {
  return automationRunsCollection.where((r) => r.idempotencyKey === key && r.status !== 'skipped_duplicate')[0]
}

export interface FireResult {
  run: AutomationRun
  duplicate: boolean
}

export function fireAutomation(automation: Automation, subject: TestSubject): FireResult {
  const key = idempotencyPreviewFor(
    automation.automationKey,
    automation.reliability.idempotencyKeyFields,
    subject,
  )
  const prior = existingRunForKey(key)
  const ctx = buildContext(subject)
  const startedAt = nowIso()
  const label = personName(subject.personId)

  if (prior) {
    const refused: AutomationRun = {
      id: makeRunId(`run-${Math.random().toString(36).slice(2, 9)}`),
      automationId: automation.id,
      automationKey: automation.automationKey,
      automationVersion: automation.version,
      triggerType: triggerTypeOf(automation),
      triggerPayload: { personId: subject.personId, invoiceId: subject.invoiceId, at: startedAt },
      subjectType: 'Person',
      subjectId: subject.personId,
      subjectLabel: label,
      startedAt,
      endedAt: startedAt,
      durationMs: 3,
      status: 'skipped_duplicate',
      idempotencyKey: key,
      actionsExecuted: 0,
      actionsTotal: automation.nodes.filter((n) => n.kind === 'action').length,
      errorSummary: `Idempotency key already processed: ${key}`,
      steps: [
        {
          nodeId: 'guard',
          kind: 'guard',
          label: 'Idempotency guard',
          at: startedAt,
          durationMs: 3,
          inputs: {
            key,
            fields: automation.reliability.idempotencyKeyFields,
            matchedRun: prior.id,
          },
          outcome: `Refused — run ${prior.id} already processed this key.`,
          outputs: [{ type: 'AutomationRun', id: prior.id, ref: prior.id }],
          error: null,
          skippedReason: 'The trigger fired twice for the same subject. The second one does no work.',
        },
      ],
    }
    automationRunsCollection.insert(refused)
    return { run: refused, duplicate: true }
  }

  const runId = makeRunId(`run-${Math.random().toString(36).slice(2, 9)}`)
  const steps: AutomationRunStep[] = []
  let executed = 0
  let halted = false

  const commissionRows = subject.admissionId
    ? commissionsCollection.where((c) => c.admissionId === subject.admissionId)
    : []

  const pushAction = (node: Extract<AutomationNode, { kind: 'action' }>) => {
    if (halted || ACTIONS[node.actionType].disabled) {
      steps.push(step(node.id, 'action', actionLabel(node.actionType), {
        outcome: 'Not executed',
        skippedReason: halted ? 'An earlier node stopped the run.' : 'Webhooks are disabled in this prototype.',
      }))
      return
    }
    executed += 1

    const outputs: AutomationRunStep['outputs'] = []
    if (node.actionType === 'send_message' && ctx.person) {
      const message = createMessage(node, runId, ctx.person.id, ctx.person.firstName)
      outputs.push({ type: 'Message', id: message.id, ref: message.id.toUpperCase() })
    }
    if (node.actionType === 'calculate_commission') {
      for (const c of commissionRows) outputs.push({ type: 'Commission', id: c.id, ref: c.ref })
    }
    if (node.actionType === 'grant_lms_access' && ctx.admission) {
      outputs.push({
        type: 'Cohort',
        id: ctx.admission.cohortId,
        ref: cohortCode(ctx.admission.cohortId),
      })
    }
    if (node.actionType === 'issue_card' && ctx.admission) {
      outputs.push({
        type: 'Branch',
        id: ctx.admission.branchId,
        ref: branchName(ctx.admission.branchId),
      })
    }

    steps.push(
      step(node.id, 'action', actionLabel(node.actionType), {
        inputs: actionInputs(node),
        outcome: actionSummary(node),
        outputs,
      }),
    )
  }

  for (const node of automation.nodes) {
    if (node.kind === 'trigger') {
      steps.push(
        step(node.id, 'trigger', triggerLabel(node.triggerType), {
          inputs: { personId: subject.personId, invoiceId: subject.invoiceId, admissionId: subject.admissionId },
          outcome: `Trigger payload assembled for ${label}.`,
        }),
      )
    } else if (node.kind === 'condition') {
      const result = evaluateGroup(node.group, ctx)
      steps.push(
        step(node.id, 'condition', 'Condition', {
          inputs: Object.fromEntries(result.lines.map((l, i) => [`row ${i + 1}`, l.text])),
          outcome: `${result.passed ? 'true' : 'false'} — ${groupText(node.group)}`,
        }),
      )
      if (!result.passed) halted = true
    } else if (node.kind === 'branch') {
      const taken = node.lanes.findIndex((lane) => !lane.condition || evaluateGroup(lane.condition, ctx).passed)
      const index = taken >= 0 ? taken : node.lanes.length - 1
      steps.push(
        step(node.id, 'branch', node.label, {
          outcome: `Took lane "${node.lanes[index]?.label ?? '—'}".`,
        }),
      )
      node.lanes.forEach((lane, i) => {
        for (const childId of lane.nodeIds) {
          const child = automation.nodes.find((n) => n.id === childId)
          if (!child) continue
          if (i !== index) {
            steps.push(
              step(child.id, child.kind, child.kind === 'action' ? actionLabel(child.actionType) : 'Node', {
                outcome: 'Not on the lane this record took',
                skippedReason: `Lane "${lane.label}" was not taken.`,
              }),
            )
            continue
          }
          if (child.kind === 'action') pushAction(child)
        }
      })
    } else if (node.kind === 'action') {
      const nestedIds = automation.nodes.flatMap((n) => (n.kind === 'branch' ? n.lanes.flatMap((l) => l.nodeIds) : []))
      if (!nestedIds.includes(node.id)) pushAction(node)
    } else if (node.kind === 'stop') {
      const result = evaluateGroup(node.condition, ctx)
      steps.push(
        step(node.id, 'stop', 'Stop condition', {
          outcome: result.passed && node.condition.rules.length
            ? 'Stop condition is true — the automation stops here for this person.'
            : 'Stop condition is false — the automation stays live for this person.',
        }),
      )
    } else if (node.kind === 'delay') {
      steps.push(step(node.id, 'delay', 'Delay', { outcome: 'Delay satisfied.' }))
    }
  }

  const actionsTotal = automation.nodes.filter((n) => n.kind === 'action').length
  const endedAt = nowIso()
  const run: AutomationRun = {
    id: runId,
    automationId: automation.id,
    automationKey: automation.automationKey,
    automationVersion: automation.version,
    triggerType: triggerTypeOf(automation),
    triggerPayload: { personId: subject.personId, invoiceId: subject.invoiceId, at: startedAt },
    subjectType: 'Person',
    subjectId: subject.personId,
    subjectLabel: label,
    startedAt,
    endedAt,
    durationMs: Math.max(1, Date.parse(endedAt) - Date.parse(startedAt)) + 340,
    status: halted ? 'skipped_conditions_not_met' : 'succeeded',
    idempotencyKey: key,
    actionsExecuted: executed,
    actionsTotal,
    errorSummary: halted ? 'Conditions not met — the run stopped before any action.' : null,
    steps,
  }
  automationRunsCollection.insert(run)

  automationsCollection.update(automation.id, {
    stats: { ...automation.stats, runs7d: automation.stats.runs7d + 1, lastRunAt: startedAt },
  })

  return { run, duplicate: false }
}

function triggerTypeOf(automation: Automation): AutomationRun['triggerType'] {
  const trigger = automation.nodes.find((n) => n.kind === 'trigger')
  return trigger && trigger.kind === 'trigger' ? trigger.triggerType : 'scheduled'
}

function step(
  nodeId: string,
  kind: string,
  label: string,
  opts: {
    inputs?: Record<string, unknown>
    outcome: string
    outputs?: AutomationRunStep['outputs']
    skippedReason?: string
  },
): AutomationRunStep {
  return {
    nodeId,
    kind,
    label,
    at: nowIso(),
    durationMs: 40 + Math.floor(Math.random() * 300),
    inputs: opts.inputs ?? {},
    outcome: opts.outcome,
    outputs: opts.outputs ?? [],
    error: null,
    skippedReason: opts.skippedReason ?? null,
  }
}

function actionInputs(node: Extract<AutomationNode, { kind: 'action' }>): Record<string, unknown> {
  if (node.actionType === 'send_message') {
    return {
      channel: node.params.channel ?? null,
      template: templateName(node.params.templateId),
      recipient: node.params.recipient ?? null,
    }
  }
  return node.params
}

function createMessage(
  node: Extract<AutomationNode, { kind: 'action' }>,
  runId: string,
  personId: string,
  firstName: string,
): Message {
  const templateIdValue = typeof node.params.templateId === 'string' ? node.params.templateId : null
  const template = templateIdValue ? (messageTemplatesCollection.find(templateIdValue) ?? null) : null
  const body = (template?.body ?? 'Automated message.').replace('{{person.firstName}}', firstName)
  const now = nowIso()
  const message: Message = {
    id: makeMessageId(`msg-${Math.random().toString(36).slice(2, 9)}`),
    personId: personId as Message['personId'],
    channel: (node.params.channel as Message['channel']) ?? 'whatsapp',
    direction: 'outbound',
    sourceType: 'automation',
    sourceId: runId,
    templateId: template?.id ?? null,
    subject: template?.subject ?? null,
    preview: body.slice(0, 70),
    body,
    sentAt: now,
    status: 'sent',
    failureReason: null,
    retryCount: 0,
    createdAt: now,
    createdBy: actingUser(),
    updatedAt: now,
    updatedBy: actingUser(),
  }
  return messagesCollection.insert(message)
}

export function retryRun(run: AutomationRun, fromFailedNodeOnly: boolean): AutomationRun {
  const automation = automationsCollection.find(run.automationId)
  const startedAt = nowIso()
  const failedIndex = run.steps.findIndex((s) => s.error !== null)
  const replayed = fromFailedNodeOnly && failedIndex >= 0 ? run.steps.slice(failedIndex) : run.steps

  const retry: AutomationRun = {
    ...run,
    id: makeRunId(`run-${Math.random().toString(36).slice(2, 9)}`),
    startedAt,
    endedAt: nowIso(),
    durationMs: 480,
    status: 'succeeded',
    actionsExecuted: run.actionsTotal,
    errorSummary: null,
    steps: replayed.map((s) => ({
      ...s,
      at: nowIso(),
      error: null,
      skippedReason: null,
      outcome: s.error ? `Retried — ${s.label} succeeded on attempt ${s.error.attempts + 1}.` : s.outcome,
    })),
  }
  automationRunsCollection.insert(retry)
  writeAudit({
    action: 'automation.run.retry',
    entityType: 'AutomationRun',
    entityId: run.id,
    entityRef: run.id,
    field: 'status',
    before: run.status,
    after: `retried as ${retry.id}`,
  })
  void automation
  return retry
}

export function isPermanentFailure(exception: AutomationException): boolean {
  return /no whatsapp number/i.test(exception.errorMessage)
}

export function markRetrying(exception: AutomationException): void {
  automationExceptionsCollection.update(exception.id, {
    status: 'retrying',
    lastAttemptAt: nowIso(),
    retryAttempts: exception.retryAttempts + 1,
    updatedAt: nowIso(),
    updatedBy: actingUser(),
  })
}

export function settleRetry(exception: AutomationException): void {
  const current = automationExceptionsCollection.find(exception.id)
  if (!current) return
  const permanent = isPermanentFailure(current)
  automationExceptionsCollection.update(current.id, {
    status: permanent ? 'open' : 'resolved',
    lastAttemptAt: nowIso(),
    updatedAt: nowIso(),
    updatedBy: actingUser(),
  })
  writeAudit({
    action: permanent ? 'automation.exception.retry_failed' : 'automation.exception.resolve',
    entityType: 'AutomationException',
    entityId: current.id,
    entityRef: current.id,
    field: 'status',
    before: 'retrying',
    after: permanent ? 'open' : 'resolved',
  })
}

export function assignException(exception: AutomationException, userId: UserId | null): void {
  automationExceptionsCollection.update(exception.id, {
    assigneeUserId: userId,
    updatedAt: nowIso(),
    updatedBy: actingUser(),
  })
  writeAudit({
    action: 'automation.exception.assign',
    entityType: 'AutomationException',
    entityId: exception.id,
    entityRef: exception.id,
    field: 'assigneeUserId',
    before: exception.assigneeUserId ? userName(exception.assigneeUserId) : null,
    after: userId ? userName(userId) : null,
  })
}

export function ignoreException(exception: AutomationException, reason: string): void {
  automationExceptionsCollection.update(exception.id, {
    status: 'ignored',
    ignoreReason: reason,
    updatedAt: nowIso(),
    updatedBy: actingUser(),
  })
  writeAudit({
    action: 'automation.exception.ignore',
    entityType: 'AutomationException',
    entityId: exception.id,
    entityRef: exception.id,
    field: 'status',
    before: exception.status,
    after: 'ignored',
  })
}
