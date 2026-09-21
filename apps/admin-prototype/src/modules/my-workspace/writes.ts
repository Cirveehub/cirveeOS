/**
 * Everything this module writes.
 *
 * Kept out of the screens for the reason the rest of the app does it: a write
 * that lives in a component is a write nothing else can reuse and no test can
 * reach. The leave path in particular was previously inline in
 * `command-centre/pages/EmployeeHome.tsx`, which meant the only way to request
 * leave was from one card on one dashboard.
 *
 * Two rules hold throughout:
 *
 * - **Nothing here decides anything.** An employee raises a request; somebody
 *   with the authority to approve it decides. Leave routes through the same
 *   approval engine every other request type uses, and an attendance
 *   correction is an explanation attached to the row, not an edit of it.
 * - **Balances move on approval, never on request.** `approvals/engine.ts`
 *   decrements the entitlement when the request is approved. Deducting at
 *   request time would let a rejected request cost somebody their days.
 */

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

/* -------------------------------------------------------------------------- */
/* Leave                                                                      */
/* -------------------------------------------------------------------------- */

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
  /** False when the record saved but no approver chain was configured. */
  routed?: boolean
}

/** Next `LV-<year>-<n>` in sequence, so refs stay readable and unique. */
function nextLeaveRef(): string {
  const year = TODAY.slice(0, 4)
  const highest = leaveRequestsCollection.all().reduce((max, r) => {
    const n = Number(r.ref.split('-')[2])
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
  return `LV-${year}-${String(highest + 1).padStart(4, '0')}`
}

export function remainingFor(employee: Employee, type: LeaveType): number {
  // Unpaid leave is not drawn from an entitlement, so it never runs out.
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
    // Projected, not applied — the engine moves the real balance on approval.
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

  // Without this the request sits on the record and never reaches anybody's
  // queue — nothing else in the app raises it.
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

/**
 * Withdraw a request that nobody has decided yet.
 *
 * Cancelled, not deleted: the row stays with its history, the same way a
 * rejected candidate or a lapsed offer does. An approved request is somebody
 * else's decision and is not the requester's to undo here.
 */
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

/* -------------------------------------------------------------------------- */
/* Attendance                                                                 */
/* -------------------------------------------------------------------------- */

/** A day an employee can be asked to account for. */
export const EXPLAINABLE_STATES: AttendanceEvent['state'][] = [
  'absent',
  'late',
  'missing_clock_out',
  'early_departure',
]

export function needsExplaining(row: AttendanceEvent): boolean {
  return EXPLAINABLE_STATES.includes(row.state) && !row.overrideReason
}

/**
 * The employee's account of a flagged day.
 *
 * This deliberately does **not** change the attendance state. The readers,
 * taps and office network produce the record; letting the person it judges
 * rewrite it would remove the point of having the hardware at all. What it
 * writes is an explanation, with `overriddenByUserId` left null so HR's own
 * Attendance screen can tell an unreviewed account from an accepted one —
 * that column already existed there with nothing to fill it.
 */
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

/**
 * HR accepting an employee's account of a flagged day.
 *
 * The counterpart to `explainAttendance`, and the write the People module's
 * Attendance screen was missing — it showed an "Override reason" column and a
 * "needs an override before the period closes" figure with no way to actually
 * record one.
 */
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

/* -------------------------------------------------------------------------- */
/* Payslips                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Opening a payslip is itself a record. Payroll's own screens report on who
 * has and has not looked at theirs, and that figure is only true if the act of
 * reading one writes it down. Stamped once — the first time.
 */
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

/* -------------------------------------------------------------------------- */
/* Reads the screens share                                                    */
/* -------------------------------------------------------------------------- */

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
