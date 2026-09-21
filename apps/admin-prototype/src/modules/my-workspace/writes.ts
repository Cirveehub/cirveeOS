import {
  TODAY,
  attendanceEventsCollection,
  employeesCollection,
  leaveRequestsCollection,
  payslipsCollection,
  type AttendanceEvent,
  type Employee,
  type Kobo,
  type LeaveRequest,
  type LeaveType,
  type UserId,
} from '@/mocks'
import { leaveId } from '@/mocks/types'
import { formatDate, pluralize } from '@/lib/format'
import { emitAudit, nowIso, raiseRequest } from '@/modules/people/writes'

import { LEAVE_TYPE_LABEL, personName, userName, workingDays } from './shared'

export interface RequestLeaveInput {
  employee: Employee
  userId: UserId
  type: LeaveType
  fromDate: string
  toDate: string
  reason: string
}

export interface RequestLeaveResult {
  ok: boolean
  reason?: string
  request?: LeaveRequest
  routed?: boolean
}

function nextLeaveRef(): string {
  const year = TODAY.slice(0, 4)
  const highest = leaveRequestsCollection.all().reduce((max, r) => {
    const n = Number(r.ref.split('-')[2])
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `LV-${year}-${String(highest + 1).padStart(4, '0')}`
}

export function remainingFor(employee: Employee, type: LeaveType): number {
  if (type === 'unpaid') return Number.POSITIVE_INFINITY
  return employee.leaveBalances.find((b) => b.type === type)?.remaining ?? 0
}

export function requestLeave(input: RequestLeaveInput): RequestLeaveResult {
  const { employee, userId, type, fromDate, toDate } = input
  const reason = input.reason.trim()
  const days = workingDays(fromDate, toDate)

  if (days === 0) {
    return { ok: false, reason: 'Pick a range with at least one working day in it, ending on or after it starts.' }
  }
  if (!reason) {
    return { ok: false, reason: 'Say why. The approver decides on this alone.' }
  }
  const remaining = remainingFor(employee, type)
  if (days > remaining) {
    return {
      ok: false,
      reason: `Only ${pluralize(remaining, 'day')} of ${LEAVE_TYPE_LABEL[type].toLowerCase()} leave remain. Shorten the range, or request unpaid leave instead.`,
    }
  }

  const stamp = nowIso()
  const ref = nextLeaveRef()
  const id = leaveId(`leave-ui-${Date.now().toString(36)}`)
  const before = type === 'unpaid' ? 0 : remaining

  leaveRequestsCollection.insert({
    id,
    ref,
    employeeId: employee.id,
    type,
    fromDate,
    toDate,
    days,
    balanceBefore: before,
    balanceAfter: type === 'unpaid' ? 0 : before - days,
    reason,
    approvalRequestId: null,
    status: 'requested',
    decidedAt: null,
    createdAt: stamp,
    createdBy: userId,
    updatedAt: stamp,
    updatedBy: userId,
  })

  const approval = raiseRequest({
    type: 'leave',
    title: `${LEAVE_TYPE_LABEL[type]} leave — ${personName(employee.personId)}, ${pluralize(days, 'day')}`,
    justification: reason,
    amount: 0 as Kobo,
    unitId: employee.unitId,
    branchId: employee.branchId,
    relatedEntityType: 'LeaveRequest',
    relatedEntityId: id as string,
    relatedEntityRef: ref,
    requesterUserId: userId,
    impact: [
      {
        text: `${pluralize(days, 'day')} of ${LEAVE_TYPE_LABEL[type].toLowerCase()} leave, ${formatDate(fromDate)} to ${formatDate(toDate)}.`,
        entityType: 'LeaveRequest',
        entityId: id as string,
        entityRef: ref,
      },
    ],
  })

  if (approval) {
    leaveRequestsCollection.update(id, {
      approvalRequestId: approval.id,
      updatedAt: nowIso(),
      updatedBy: userId,
    })
  }

  emitAudit({
    entityType: 'LeaveRequest',
    entityId: id as string,
    entityRef: ref,
    action: 'Leave requested',
    field: 'status',
    before: null,
    after: 'requested',
    actorUserId: userId,
  })

  return { ok: true, request: leaveRequestsCollection.find(id), routed: Boolean(approval) }
}

export function cancelLeaveRequest(id: string, userId: UserId): { ok: boolean; reason?: string } {
  const request = leaveRequestsCollection.find(id)
  if (!request) return { ok: false, reason: 'That request is no longer on file.' }
  if (request.status !== 'requested') {
    return { ok: false, reason: `This request was already ${request.status}. Only one still awaiting a decision can be withdrawn.` }
  }

  const stamp = nowIso()
  leaveRequestsCollection.update(request.id, {
    status: 'cancelled',
    decidedAt: stamp,
    updatedAt: stamp,
    updatedBy: userId,
  })

  emitAudit({
    entityType: 'LeaveRequest',
    entityId: request.id as string,
    entityRef: request.ref,
    action: 'Leave request withdrawn',
    field: 'status',
    before: 'requested',
    after: 'cancelled',
    actorUserId: userId,
  })

  return { ok: true }
}

export const EXPLAINABLE_STATES: AttendanceEvent['state'][] = [
  'absent',
  'late',
  'missing_clock_out',
  'early_departure',
]

export function needsExplaining(row: AttendanceEvent): boolean {
  return EXPLAINABLE_STATES.includes(row.state) && !row.overrideReason
}

export function explainAttendance(
  rowId: string,
  note: string,
  userId: UserId,
): { ok: boolean; reason?: string } {
  const row = attendanceEventsCollection.find(rowId)
  if (!row) return { ok: false, reason: 'That day is no longer on file.' }
  const trimmed = note.trim()
  if (!trimmed) return { ok: false, reason: 'Say what happened — an empty note tells the reviewer nothing.' }

  const stamp = nowIso()
  attendanceEventsCollection.update(row.id, {
    overrideReason: trimmed,
    overriddenByUserId: null,
    updatedAt: stamp,
    updatedBy: userId,
  })

  emitAudit({
    entityType: 'AttendanceEvent',
    entityId: row.id as string,
    entityRef: row.date,
    action: 'Attendance explained by employee',
    field: 'overrideReason',
    before: row.overrideReason,
    after: trimmed,
    actorUserId: userId,
  })

  return { ok: true }
}

export function acceptAttendanceExplanation(
  rowId: string,
  state: AttendanceEvent['state'],
  actorUserId: UserId,
): { ok: boolean; reason?: string } {
  const row = attendanceEventsCollection.find(rowId)
  if (!row) return { ok: false, reason: 'That day is no longer on file.' }
  if (!row.overrideReason) {
    return { ok: false, reason: 'There is nothing to accept — no explanation has been given for this day.' }
  }

  const stamp = nowIso()
  attendanceEventsCollection.update(row.id, {
    state,
    overriddenByUserId: actorUserId,
    updatedAt: stamp,
    updatedBy: actorUserId,
  })

  emitAudit({
    entityType: 'AttendanceEvent',
    entityId: row.id as string,
    entityRef: row.date,
    action: 'Attendance explanation accepted',
    field: 'state',
    before: row.state,
    after: state,
    actorUserId,
  })

  return { ok: true }
}

export function markPayslipViewed(payslipId: string, userId: UserId): void {
  const payslip = payslipsCollection.find(payslipId)
  if (!payslip || payslip.viewedAt) return

  const stamp = nowIso()
  payslipsCollection.update(payslip.id, { viewedAt: stamp, updatedAt: stamp, updatedBy: userId })
  emitAudit({
    entityType: 'Payslip',
    entityId: payslip.id as string,
    entityRef: payslip.id as string,
    action: 'Payslip opened',
    field: 'viewedAt',
    before: null,
    after: stamp,
    actorUserId: userId,
  })
}

export function markPayslipDownloaded(payslipId: string, userId: UserId): void {
  const payslip = payslipsCollection.find(payslipId)
  if (!payslip) return

  const stamp = nowIso()
  payslipsCollection.update(payslip.id, {
    downloadedAt: stamp,
    viewedAt: payslip.viewedAt ?? stamp,
    updatedAt: stamp,
    updatedBy: userId,
  })
  emitAudit({
    entityType: 'Payslip',
    entityId: payslip.id as string,
    entityRef: payslip.id as string,
    action: 'Payslip downloaded',
    field: 'downloadedAt',
    before: payslip.downloadedAt,
    after: stamp,
    actorUserId: userId,
  })
}

export function myAttendance(employeeId: string): AttendanceEvent[] {
  return attendanceEventsCollection
    .where((a) => a.employeeId === employeeId)
    .sort((a, b) => b.date.localeCompare(a.date))
}

export function myLeave(employeeId: string): LeaveRequest[] {
  return leaveRequestsCollection
    .where((l) => l.employeeId === employeeId)
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate))
}

export function myPayslips(employeeId: string) {
  return payslipsCollection
    .where((p) => p.employeeId === employeeId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
}

export function managerOf(employee: Employee | undefined): string {
  if (!employee?.managerUserId) return 'No manager on record'
  return userName(employee.managerUserId)
}
