import {
  approvalRequestsCollection,
  auditEventsCollection,
  canDecide,
  commissionRulesCollection,
  commissionsCollection,
  creditNotesCollection,
  employeesCollection,
  expensesCollection,
  invoicesCollection,
  leaveRequestsCollection,
  notificationsCollection,
  resolveApprovalRoute,
  refundsCollection,
  approvalRoutesCollection,
  usersCollection,
  TODAY,
  atTime,
  nextId,
} from '@/mocks'
import type {
  ApprovalBand,
  ApprovalImpactLine,
  ApprovalRequest,
  ApprovalRoute,
  ApprovalStep,
  ApprovalType,
  AuditEvent,
  CommissionId,
  CreditNote,
  Kobo,
  LeaveRequest,
  Notification,
  Refund,
  UserId,
} from '@/mocks'
import {
  approvalId,
  auditId,
  commissionId as asCommissionId,
  creditNoteId as asCreditNoteId,
  notificationId as asNotificationId,
  refundId as asRefundId,
  type ApprovalRequestId,
  type InvoiceId,
  type PersonId,
} from '@/mocks/types'
import { formatNaira } from '@/lib/format'
import { NOW_ISO, personName, userName, userRoleName } from './shared'
import { commissionReversalPreview } from './impact'

const IP = '102.89.34.17'

export function writeAudit(args: {
  actorUserId: UserId
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field?: string | null
  before?: string | null
  after?: string | null
}): AuditEvent {
  const event: AuditEvent = {
    id: auditId(`aud-${Math.random().toString(36).slice(2, 10)}`),
    at: new Date().toISOString(),
    actorUserId: args.actorUserId,
    actorName: userName(args.actorUserId),
    actorRole: userRoleName(args.actorUserId),
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
  auditEventsCollection.insert(event)
  return event
}

function notify(args: {
  userId: UserId
  title: string
  body: string
  request: ApprovalRequest
  actorUserId: UserId
}) {
  const now = new Date().toISOString()
  const notification: Notification = {
    id: asNotificationId(`ntf-${Math.random().toString(36).slice(2, 10)}`),
    userId: args.userId,
    category: 'approvals',
    title: args.title,
    body: args.body,
    channel: 'in_app',
    read: false,
    readAt: null,
    snoozedUntil: null,
    relatedEntityType: 'ApprovalRequest',
    relatedEntityId: args.request.id as string,
    relatedEntityRef: args.request.ref,
    actorUserId: args.actorUserId,
    createdAt: now,
    createdBy: args.actorUserId,
    updatedAt: now,
    updatedBy: args.actorUserId,
  }
  notificationsCollection.insert(notification)
}

function appendThread(request: ApprovalRequest, body: string, actorUserId: UserId | 'system', kind: 'comment' | 'system') {
  approvalRequestsCollection.update(request.id, (current) => ({
    thread: [...current.thread, { at: new Date().toISOString(), actorUserId, body, kind }],
  }))
}

export interface RaiseInput {
  type: ApprovalType
  title: string
  justification: string
  requesterUserId: UserId
  amount: Kobo | null
  unitId: string | null
  branchId: string | null
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityRef: string
  impact: ApprovalImpactLine[]
  routeId: string
  routeVersion: number
  slaHours: number
  escalatesToUserId: UserId | null
  escalateAfterHours: number
  steps: ApprovalStep[]
  status?: ApprovalRequest['status']
}

export function raiseRequest(input: RaiseInput): ApprovalRequest {
  const now = new Date().toISOString()
  const ref = nextId('APR-2026', 400)
  const isDraft = input.status === 'withdrawn'

  const steps = input.steps.map((step, index) => ({
    ...step,
    state: isDraft ? ('not_reached' as const) : index === 0 ? ('pending' as const) : ('not_reached' as const),
  }))

  const request: ApprovalRequest = {
    id: approvalId(`apr-${Math.random().toString(36).slice(2, 10)}`),
    ref,
    type: input.type,
    title: input.title,
    justification: input.justification,
    requesterUserId: input.requesterUserId,
    amount: input.amount,
    unitId: (input.unitId ?? null) as ApprovalRequest['unitId'],
    branchId: (input.branchId ?? null) as ApprovalRequest['branchId'],
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEntityRef: input.relatedEntityRef,
    attachmentIds: [],
    routeId: input.routeId as ApprovalRequest['routeId'],
    routeVersion: input.routeVersion,
    steps,
    currentStepIndex: 0,
    currentApproverUserId: isDraft ? null : (steps[0]?.approverUserId ?? null),
    raisedAt: now,
    ageHours: 0,
    slaHours: input.slaHours,
    slaState: 'within',
    escalatesToUserId: isDraft ? null : input.escalatesToUserId,
    escalatesAt: isDraft ? null : atTime(TODAY, 9 + Math.min(23, input.escalateAfterHours), 0),
    status: input.status ?? 'pending',
    decidedAt: null,
    impact: input.impact,
    thread: [
      { at: now, actorUserId: input.requesterUserId, body: input.justification, kind: 'comment' },
      {
        at: now,
        actorUserId: 'system',
        body: `Routed on ${input.type.replace(/_/g, ' ')} route v${input.routeVersion}. ${steps.length} step${steps.length === 1 ? '' : 's'}. This request keeps this route version even if the configuration changes.`,
        kind: 'system',
      },
    ],
    createdAt: now,
    createdBy: input.requesterUserId,
    updatedAt: now,
    updatedBy: input.requesterUserId,
  }

  approvalRequestsCollection.insert(request)
  writeAudit({
    actorUserId: input.requesterUserId,
    action: 'approval.raise',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'status',
    before: null,
    after: request.status === 'pending' ? 'Pending' : 'Draft',
  })

  if (request.currentApproverUserId) {
    notify({
      userId: request.currentApproverUserId,
      title: `${request.ref} needs your decision`,
      body: `${userName(request.requesterUserId)} raised ${request.title}.`,
      request,
      actorUserId: input.requesterUserId,
    })
  }

  return request
}

export type DecisionOutcome = 'approve' | 'reject' | 'return'

export interface DecisionResult {
  ok: boolean
  reason: string | null
  executed: string[]
  status: ApprovalRequest['status'] | null
  stepsCompleted: number
  stepsTotal: number
}

const REFUSED = (reason: string): DecisionResult => ({
  ok: false,
  reason,
  executed: [],
  status: null,
  stepsCompleted: 0,
  stepsTotal: 0,
})

export function decide(
  requestId: string,
  actorUserId: UserId,
  outcome: DecisionOutcome,
  comment: string,
): DecisionResult {
  const request = approvalRequestsCollection.find(requestId)
  if (!request) return REFUSED('That request no longer exists.')

  const gate = canDecide(request, actorUserId)
  if (!gate.allowed) return REFUSED(gate.reason ?? 'You cannot decide this request.')

  if ((outcome === 'reject' || outcome === 'return') && comment.trim().length === 0) {
    return REFUSED(outcome === 'reject' ? 'A rejection needs a reason.' : 'Say what information is needed.')
  }

  const now = new Date().toISOString()
  const index = request.currentStepIndex
  const steps = request.steps.map((step, i) =>
    i === index
      ? {
          ...step,
          state: (outcome === 'approve' ? 'approved' : outcome === 'reject' ? 'rejected' : 'returned') as ApprovalStep['state'],
          decidedAt: now,
          comment: comment.trim() || null,
        }
      : step,
  )

  if (outcome === 'reject') {
    approvalRequestsCollection.update(request.id, {
      steps,
      status: 'rejected',
      decidedAt: now,
      currentApproverUserId: null,
      updatedAt: now,
      updatedBy: actorUserId,
    })
    writeAudit({
      actorUserId,
      action: 'approval.reject',
      entityType: 'ApprovalRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: 'status',
      before: 'Pending',
      after: 'Rejected',
    })
    if (request.type === 'leave') applyLeaveDecision(request, 'rejected', actorUserId)
    appendThread(request, `Rejected at step ${index + 1}. ${comment.trim()}`, actorUserId, 'system')
    notify({
      userId: request.requesterUserId,
      title: `${request.ref} was rejected`,
      body: comment.trim(),
      request,
      actorUserId,
    })
    return { ok: true, reason: null, executed: [], status: 'rejected', stepsCompleted: index + 1, stepsTotal: steps.length }
  }

  if (outcome === 'return') {
    approvalRequestsCollection.update(request.id, {
      steps: steps.map((s, i) => (i === index ? s : { ...s, state: 'not_reached', decidedAt: null, comment: null })),
      status: 'returned_for_information',
      decidedAt: null,
      currentApproverUserId: null,
      updatedAt: now,
      updatedBy: actorUserId,
    })
    writeAudit({
      actorUserId,
      action: 'approval.return',
      entityType: 'ApprovalRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: 'status',
      before: 'Pending',
      after: 'Returned for information',
    })
    appendThread(
      request,
      `Returned for information. SLA clock paused at ${request.ageHours}h of ${request.slaHours}h. ${comment.trim()}`,
      actorUserId,
      'system',
    )
    notify({
      userId: request.requesterUserId,
      title: `${request.ref} was returned for information`,
      body: comment.trim(),
      request,
      actorUserId,
    })
    return {
      ok: true,
      reason: null,
      executed: [],
      status: 'returned_for_information',
      stepsCompleted: index,
      stepsTotal: steps.length,
    }
  }

  const isFinalStep = index >= steps.length - 1
  if (!isFinalStep) {
    const next = steps[index + 1]
    approvalRequestsCollection.update(request.id, {
      steps: steps.map((s, i) => (i === index + 1 ? { ...s, state: 'pending' } : s)),
      currentStepIndex: index + 1,
      currentApproverUserId: next.approverUserId,
      updatedAt: now,
      updatedBy: actorUserId,
    })
    writeAudit({
      actorUserId,
      action: 'approval.approve.step',
      entityType: 'ApprovalRequest',
      entityId: request.id as string,
      entityRef: request.ref,
      field: `step ${index + 1}`,
      before: 'Pending',
      after: 'Approved',
    })
    appendThread(
      request,
      `Approved at step ${index + 1} of ${steps.length}. Awaiting ${next.approverRole}. ${comment.trim()}`.trim(),
      actorUserId,
      'system',
    )
    notify({
      userId: next.approverUserId,
      title: `${request.ref} needs your decision`,
      body: `${userName(actorUserId)} approved step ${index + 1}.`,
      request,
      actorUserId,
    })
    return {
      ok: true,
      reason: null,
      executed: [],
      status: 'pending',
      stepsCompleted: index + 1,
      stepsTotal: steps.length,
    }
  }

  approvalRequestsCollection.update(request.id, {
    steps,
    status: 'approved',
    decidedAt: now,
    currentApproverUserId: null,
    escalatesAt: null,
    escalatesToUserId: null,
    updatedAt: now,
    updatedBy: actorUserId,
  })
  writeAudit({
    actorUserId,
    action: 'approval.approve',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'status',
    before: 'Pending',
    after: 'Approved',
  })

  const executed = executeDownstream(request, actorUserId)
  appendThread(
    request,
    `Approved at step ${index + 1} of ${steps.length}. ${executed.length ? executed.join(' · ') : 'No downstream record was created.'}`,
    actorUserId,
    'system',
  )
  notify({
    userId: request.requesterUserId,
    title: `${request.ref} was approved`,
    body: executed.join(' · ') || 'Approved in full.',
    request,
    actorUserId,
  })

  return { ok: true, reason: null, executed, status: 'approved', stepsCompleted: steps.length, stepsTotal: steps.length }
}

function executeDownstream(request: ApprovalRequest, actorUserId: UserId): string[] {
  switch (request.type) {
    case 'refund':
      return executeRefund(request, actorUserId)
    case 'expense':
      return executeExpense(request, actorUserId)
    case 'commission_approval':
      return executeCommissionApproval(request, actorUserId)
    case 'leave':
      return executeLeave(request, actorUserId)
    default:
      return []
  }
}

function applyLeaveDecision(
  request: ApprovalRequest,
  status: Extract<LeaveRequest['status'], 'approved' | 'rejected'>,
  actorUserId: UserId,
): LeaveRequest | null {
  if (request.relatedEntityType !== 'LeaveRequest') return null
  const leave = leaveRequestsCollection.find(request.relatedEntityId)
  if (!leave) return null
  const now = new Date().toISOString()

  leaveRequestsCollection.update(leave.id, { status, decidedAt: now, updatedAt: now, updatedBy: actorUserId })

  if (status === 'approved' && leave.type !== 'unpaid') {
    const employee = employeesCollection.find(leave.employeeId)
    if (employee) {
      employeesCollection.update(employee.id, {
        leaveBalances: employee.leaveBalances.map((b) =>
          b.type === leave.type ? { ...b, taken: b.taken + leave.days, remaining: leave.balanceAfter } : b,
        ),
        updatedAt: now,
        updatedBy: actorUserId,
      })
    }
  }

  writeAudit({
    actorUserId,
    action: status === 'approved' ? 'leave.approve' : 'leave.reject',
    entityType: 'LeaveRequest',
    entityId: leave.id as string,
    entityRef: leave.ref,
    field: 'status',
    before: 'Requested',
    after: status === 'approved' ? 'Approved' : 'Rejected',
  })

  return leave
}

function executeLeave(request: ApprovalRequest, actorUserId: UserId): string[] {
  const leave = applyLeaveDecision(request, 'approved', actorUserId)
  return leave ? [`${leave.ref} approved — leave balance updated`] : []
}

function executeRefund(request: ApprovalRequest, actorUserId: UserId): string[] {
  const amount = (request.amount ?? 0) as Kobo
  const now = new Date().toISOString()
  const done: string[] = []

  const invoice =
    request.relatedEntityType === 'Invoice'
      ? invoicesCollection.find(request.relatedEntityId)
      : invoicesCollection.find(refundsCollection.find(request.relatedEntityId)?.invoiceId ?? '')

  if (!invoice) return done

  const existing = refundsCollection.all().find((r) => r.approvalRequestId === request.id)
  const affected = commissionReversalPreview(invoice.id as string, amount)

  let refundRef: string
  if (existing) {
    refundsCollection.update(existing.id, {
      status: 'approved',
      processedAt: now,
      updatedAt: now,
      updatedBy: actorUserId,
    })
    refundRef = existing.ref
  } else {
    const refund: Refund = {
      id: asRefundId(`ref-${Math.random().toString(36).slice(2, 10)}`),
      ref: nextId('REF', 20),
      invoiceId: invoice.id as InvoiceId,
      personId: (invoice.personId ?? '') as PersonId,
      originalAmount: invoice.total,
      refundAmount: amount,
      reason: request.justification,
      requestedByUserId: request.requesterUserId,
      approvalRequestId: request.id as ApprovalRequestId,
      affectedCommissionIds: affected.map((a) => a.commissionId as CommissionId),
      status: 'approved',
      processedAt: now,
      createdAt: now,
      createdBy: actorUserId,
      updatedAt: now,
      updatedBy: actorUserId,
    }
    refundsCollection.insert(refund)
    refundRef = refund.ref
  }
  done.push(`Refund ${refundRef} created`)
  writeAudit({
    actorUserId,
    action: 'refund.create',
    entityType: 'Refund',
    entityId: refundRef,
    entityRef: refundRef,
    field: 'status',
    before: null,
    after: 'Approved',
  })

  const creditNote: CreditNote = {
    id: asCreditNoteId(`cn-${Math.random().toString(36).slice(2, 10)}`),
    ref: nextId('CN', 30),
    invoiceId: invoice.id as InvoiceId,
    amount,
    reason: `Refund ${refundRef} — ${request.justification}`,
    unitId: invoice.unitId,
    approvalRequestId: request.id as ApprovalRequestId,
    createdAt: now,
    createdBy: actorUserId,
    updatedAt: now,
    updatedBy: actorUserId,
  }
  creditNotesCollection.insert(creditNote)
  invoicesCollection.update(invoice.id, (current) => ({
    status: 'refunded',
    creditNoteIds: [...current.creditNoteIds, creditNote.id],
    updatedAt: now,
    updatedBy: actorUserId,
  }))
  done.push(`${invoice.ref} credit note ${creditNote.ref} issued for ${formatNaira(amount)}`)
  writeAudit({
    actorUserId,
    action: 'creditnote.issue',
    entityType: 'Invoice',
    entityId: invoice.id as string,
    entityRef: invoice.ref,
    field: 'status',
    before: 'Paid',
    after: 'Refunded',
  })

  for (const reversal of affected) {
    const original = commissionsCollection.find(reversal.commissionId)
    if (!original) continue
    const rule = commissionRulesCollection.find(original.ruleId)
    const row = {
      ...original,
      id: asCommissionId(`com-rev-${Math.random().toString(36).slice(2, 10)}`),
      ref: nextId('COM-2026', 450),
      amount: -reversal.reversalAmount as Kobo,
      state: 'reversed' as const,
      eligibilityNote: `Proportional reversal per ${rule?.name ?? original.ruleKey} v${original.ruleVersion} — ${reversal.settlement}`,
      earnedAt: null,
      approvalRequestId: request.id as ApprovalRequestId,
      approvedByUserId: actorUserId,
      approvedAt: now,
      payoutBatchId: null,
      paidAt: null,
      stateHistory: [
        ...original.stateHistory,
        {
          from: original.state,
          to: 'reversed' as const,
          at: now,
          byUserId: actorUserId,
          note: `Reversal created on refund ${refundRef}. The original commission is unchanged.`,
        },
      ],
      adjustmentOfCommissionId: null,
      reversalOfCommissionId: original.id,
      reversedByCommissionId: null,
      reversalReason: `Proportional reversal on refund ${refundRef}`,
      triggeringRefundId: null,
      createdAt: now,
      createdBy: actorUserId,
      updatedAt: now,
      updatedBy: actorUserId,
    }
    commissionsCollection.insert(row)
    done.push(`${original.ref} reversal ${row.ref} created for ${formatNaira(reversal.reversalAmount)}`)
    writeAudit({
      actorUserId,
      action: 'commission.reverse',
      entityType: 'Commission',
      entityId: row.id as string,
      entityRef: row.ref,
      field: 'state',
      before: null,
      after: `Reversed — ${formatNaira(-row.amount as Kobo)} against ${original.ref}`,
    })
  }

  return done
}

function executeExpense(request: ApprovalRequest, actorUserId: UserId): string[] {
  const expense = expensesCollection.find(request.relatedEntityId)
  if (!expense) return []
  expensesCollection.update(expense.id, {
    status: 'approved',
    approvalRequestId: request.id as ApprovalRequestId,
    updatedAt: new Date().toISOString(),
    updatedBy: actorUserId,
  })
  writeAudit({
    actorUserId,
    action: 'expense.approve',
    entityType: 'Expense',
    entityId: expense.id as string,
    entityRef: expense.ref,
    field: 'status',
    before: 'Pending approval',
    after: 'Approved',
  })
  return [`${expense.ref} cleared for payment`]
}

function executeCommissionApproval(request: ApprovalRequest, actorUserId: UserId): string[] {
  const rows = commissionsCollection.where((c) => c.approvalRequestId === request.id && c.state === 'earned')
  const now = new Date().toISOString()
  for (const row of rows) {
    commissionsCollection.update(row.id, {
      state: 'approved',
      approvedByUserId: actorUserId,
      approvedAt: now,
      updatedAt: now,
      updatedBy: actorUserId,
    })
    writeAudit({
      actorUserId,
      action: 'commission.state.change',
      entityType: 'Commission',
      entityId: row.id as string,
      entityRef: row.ref,
      field: 'state',
      before: 'Earned',
      after: 'Approved',
    })
  }
  return rows.length ? [`${rows.length} commission${rows.length === 1 ? '' : 's'} moved from Earned to Approved`] : []
}

export function addComment(requestId: string, actorUserId: UserId, body: string): boolean {
  const request = approvalRequestsCollection.find(requestId)
  if (!request || body.trim().length === 0) return false
  appendThread(request, body.trim(), actorUserId, 'comment')
  writeAudit({
    actorUserId,
    action: 'approval.comment',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'thread',
    before: null,
    after: body.trim().slice(0, 80),
  })
  return true
}

export function resubmit(requestId: string, actorUserId: UserId, note: string): DecisionResult {
  const request = approvalRequestsCollection.find(requestId)
  if (!request) return REFUSED('That request no longer exists.')
  if (request.status !== 'returned_for_information') {
    return REFUSED('Only a request returned for information can be resubmitted.')
  }
  if (request.requesterUserId !== actorUserId) {
    return REFUSED('Only the requester can resubmit.')
  }

  const now = new Date().toISOString()
  const steps = request.steps.map((step, i) => ({
    ...step,
    state: (i === 0 ? 'pending' : 'not_reached') as ApprovalStep['state'],
    decidedAt: null,
    comment: null,
  }))

  approvalRequestsCollection.update(request.id, {
    steps,
    status: 'pending',
    currentStepIndex: 0,
    currentApproverUserId: steps[0]?.approverUserId ?? null,
    slaState: 'within',
    escalatesAt: atTime(TODAY, 9 + Math.min(23, Math.round(request.slaHours / 2)), 0),
    updatedAt: now,
    updatedBy: actorUserId,
  })
  appendThread(request, `Resubmitted. SLA clock resumed. ${note.trim()}`.trim(), actorUserId, 'system')
  writeAudit({
    actorUserId,
    action: 'approval.resubmit',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'status',
    before: 'Returned for information',
    after: 'Pending',
  })
  if (steps[0]) {
    notify({
      userId: steps[0].approverUserId,
      title: `${request.ref} was resubmitted`,
      body: note.trim() || 'The requester supplied the information you asked for.',
      request,
      actorUserId,
    })
  }
  return { ok: true, reason: null, executed: [], status: 'pending', stepsCompleted: 0, stepsTotal: steps.length }
}

export function withdraw(requestId: string, actorUserId: UserId, reason: string): DecisionResult {
  const request = approvalRequestsCollection.find(requestId)
  if (!request) return REFUSED('That request no longer exists.')
  if (request.requesterUserId !== actorUserId) return REFUSED('Only the requester can withdraw a request.')
  if (request.status !== 'pending' && request.status !== 'returned_for_information') {
    return REFUSED('Only a live request can be withdrawn.')
  }

  const now = new Date().toISOString()
  approvalRequestsCollection.update(request.id, {
    status: 'withdrawn',
    currentApproverUserId: null,
    escalatesAt: null,
    escalatesToUserId: null,
    decidedAt: now,
    updatedAt: now,
    updatedBy: actorUserId,
  })
  appendThread(request, `Withdrawn by the requester. ${reason.trim()}`.trim(), actorUserId, 'system')
  writeAudit({
    actorUserId,
    action: 'approval.withdraw',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'status',
    before: 'Pending',
    after: 'Withdrawn',
  })
  return { ok: true, reason: null, executed: [], status: 'withdrawn', stepsCompleted: 0, stepsTotal: request.steps.length }
}

export function reassign(requestId: string, actorUserId: UserId, toUserId: UserId, reason: string): DecisionResult {
  const request = approvalRequestsCollection.find(requestId)
  if (!request) return REFUSED('That request no longer exists.')
  if (request.status !== 'pending') return REFUSED('Only a pending request can be reassigned.')
  if (toUserId === request.requesterUserId) {
    return REFUSED('That person raised this request. An approver cannot approve their own request.')
  }

  const before = userName(request.currentApproverUserId)
  const now = new Date().toISOString()
  approvalRequestsCollection.update(request.id, (current) => ({
    steps: current.steps.map((s, i) =>
      i === current.currentStepIndex ? { ...s, approverUserId: toUserId, approverRole: userRoleName(toUserId) } : s,
    ),
    currentApproverUserId: toUserId,
    updatedAt: now,
    updatedBy: actorUserId,
  }))
  appendThread(request, `Reassigned from ${before} to ${userName(toUserId)}. ${reason.trim()}`.trim(), actorUserId, 'system')
  writeAudit({
    actorUserId,
    action: 'approval.reassign',
    entityType: 'ApprovalRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    field: 'currentApproverUserId',
    before,
    after: userName(toUserId),
  })
  notify({
    userId: toUserId,
    title: `${request.ref} was reassigned to you`,
    body: reason.trim() || `Reassigned from ${before}.`,
    request,
    actorUserId,
  })
  return { ok: true, reason: null, executed: [], status: 'pending', stepsCompleted: 0, stepsTotal: request.steps.length }
}

export function escalate(requestId: string, actorUserId: UserId): DecisionResult {
  const request = approvalRequestsCollection.find(requestId)
  if (!request) return REFUSED('That request no longer exists.')
  if (request.status !== 'pending') return REFUSED('Only a pending request escalates.')
  if (!request.escalatesToUserId) {
    return REFUSED('This band has no escalation target configured. Set one on the route before escalating.')
  }
  if (request.escalatesToUserId === request.requesterUserId) {
    return REFUSED(
      'The escalation target raised this request. Reassign it to another approver — an approver cannot approve their own request.',
    )
  }
  return reassign(requestId, actorUserId, request.escalatesToUserId, 'Escalated by policy — the step passed its escalation window.')
}

export function routeInForce(type: ApprovalType, onDate: string = TODAY): ApprovalRoute | undefined {
  return approvalRoutesCollection
    .where((r) => r.type === type && r.effectiveFrom <= onDate && (r.effectiveTo === null || r.effectiveTo > onDate))
    .sort((a, b) => b.version - a.version)[0]
}

export function bandFor(route: ApprovalRoute | undefined, amount: Kobo | null): ApprovalBand | undefined {
  if (!route) return undefined
  const value = amount ?? 0
  return route.bands.find((b) => value >= b.fromAmount && (b.toAmount === null || value < b.toAmount)) ?? route.bands[0]
}

export function holderOfRole(roleId: string): UserId | null {
  const user = usersCollection.all().find((u) => u.roleIds.includes(roleId as never))
  return (user?.id as UserId) ?? null
}

export function stepsFromBands(route: ApprovalRoute, amount: Kobo | null): ApprovalStep[] {
  const band = bandFor(route, amount)
  if (!band) return []
  const upper = band.toAmount === null ? 'and above' : `up to ${formatNaira(band.toAmount)}`
  return band.approverRoleIds
    .map((roleId, index): ApprovalStep | null => {
      const holder = holderOfRole(roleId as string)
      if (!holder) return null
      return {
        sequence: index + 1,
        approverUserId: holder,
        approverRole: userRoleName(holder),
        thresholdLabel: `${formatNaira(band.fromAmount)} ${upper} → ${userRoleName(holder)}${band.mode === 'all_must_approve' ? ' (all must approve)' : ' (any one)'}`,
        state: 'not_reached',
        decidedAt: null,
        comment: null,
      }
    })
    .filter((s): s is ApprovalStep => s !== null)
}

export function previewRoute(type: ApprovalType, amount: Kobo | null): ApprovalStep[] {
  const published = resolveApprovalRoute(type, (amount ?? 0) as Kobo)
  const configured = routeInForce(type)
  if (!configured || !editedRoutes.has(configured.id as string)) return published
  const fromConfig = stepsFromBands(configured, amount)
  return fromConfig.length > 0 ? fromConfig : published
}

const editedRoutes = new Set<string>()

export function markRouteEdited(routeId: string) {
  editedRoutes.add(routeId)
}

export function isRouteEdited(routeId: string): boolean {
  return editedRoutes.has(routeId)
}

export function describeRoute(steps: ApprovalStep[]): string {
  if (steps.length === 0) return 'No route matches. Nothing would be approved.'
  return steps.map((s) => `${userName(s.approverUserId)} (${s.approverRole})`).join(' → ')
}

export { personName, NOW_ISO }
