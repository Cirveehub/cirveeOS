/**
 * The audit log.
 *
 * **This is not the activity feed.** An `AuditEvent` is immutable and
 * append-only: no `updatedAt`, no `archivedAt`, no edit path. The activity
 * feed (`Activity`, in `crm.ts`) is ordinary user-facing content that people
 * write and edit. A lead profile shows both, on separate tabs, and neither
 * contains the other's rows — Flow 1 step 8 has a reviewer open both to check.
 *
 * Every action in the PRD's audited list appears at least five times.
 */

import { auditId, type AuditEvent, type AuditSource, type UserId } from '@/mocks/types'
import { P, U } from '@/mocks/seed/ids'
import { admissions, leads } from '@/mocks/seed/crm'
import { commissionRules, commissions } from '@/mocks/seed/referral'
import { invoices, payments } from '@/mocks/seed/finance'
import { approvalRequests } from '@/mocks/seed/approvals'
import { certificates } from '@/mocks/seed/learn'
import { employees } from '@/mocks/seed/hr'
import { automations } from '@/mocks/seed/automation'
import { fullName } from '@/mocks/seed/people'
import { at, audit, daysAgo, int, pad, pick, rng } from '@/mocks/seed/_helpers'

const r = rng(112233)

const ACTORS: ReadonlyArray<readonly [UserId, string, string]> = [
  [U.adebayo, 'Adebayo Ogunlana', 'Super Admin'],
  [U.chidinma, 'Chidinma Eze', 'Sales Executive'],
  [U.fatima, 'Fatima Abdullahi', 'Finance Manager'],
  [U.oluwaseun, 'Oluwaseun Adeleke', 'Chief Financial Officer'],
  [U.ifeoma, 'Ifeoma Nwosu', 'Head of Growth'],
  [U.emeka, 'Emeka Okafor', 'Academy Operations Manager'],
  [U.yetunde, 'Yetunde Salami', 'HR Manager'],
  [U.ibrahim, 'Ibrahim Sani', 'Finance Officer'],
  [U.damilola, 'Damilola Adeyinka', 'Technology Lead'],
  [U.musa, 'Musa Danjuma', 'Chief Executive'],
]

const IPS = ['102.89.34.17', '105.112.8.44', '197.210.70.9', '41.184.22.163', '102.89.34.201']

const events: AuditEvent[] = []
let seq = 0

function push(args: {
  action: string
  entityType: string
  entityId: string
  entityRef: string
  field: string | null
  before: string | null
  after: string | null
  actorIndex?: number
  daysBack?: number
  source?: AuditSource
}) {
  seq += 1
  const [actorUserId, actorName, actorRole] = ACTORS[args.actorIndex ?? seq % ACTORS.length]
  events.push({
    id: auditId(`aud-${pad(seq, 5)}`),
    at: at(daysAgo(args.daysBack ?? int(r, 0, 90)), int(r, 7, 20), int(r, 0, 59)),
    actorUserId,
    actorName,
    actorRole,
    action: args.action,
    entityType: args.entityType,
    entityId: args.entityId,
    entityRef: args.entityRef,
    field: args.field,
    before: args.before,
    after: args.after,
    source: args.source ?? 'ui',
    ip: pick(r, IPS),
  })
}

/* -------------------------------------------------------------------------- */
/* The Flow 1 trail, hand-written so it reads like a real morning             */
/* -------------------------------------------------------------------------- */

const chiamakaLead = leads.find((l) => l.ref === 'CIR-L-0688')
if (chiamakaLead) {
  push({ action: 'lead.create', entityType: 'Lead', entityId: chiamakaLead.id, entityRef: chiamakaLead.ref, field: null, before: null, after: 'New', actorIndex: 1, daysBack: 47, source: 'api' })
  push({ action: 'lead.owner.change', entityType: 'Lead', entityId: chiamakaLead.id, entityRef: chiamakaLead.ref, field: 'ownerUserId', before: null, after: 'Chidinma Eze', actorIndex: 0, daysBack: 47, source: 'automation' })
  push({ action: 'lead.stage.change', entityType: 'Lead', entityId: chiamakaLead.id, entityRef: chiamakaLead.ref, field: 'stage', before: 'New', after: 'Contacted', actorIndex: 1, daysBack: 47 })
  push({ action: 'lead.stage.change', entityType: 'Lead', entityId: chiamakaLead.id, entityRef: chiamakaLead.ref, field: 'stage', before: 'Contacted', after: 'Qualified', actorIndex: 1, daysBack: 46 })
  push({ action: 'lead.closer.set', entityType: 'Lead', entityId: chiamakaLead.id, entityRef: chiamakaLead.ref, field: 'closerUserId', before: null, after: 'Adebayo Ogunlana', actorIndex: 0, daysBack: 44 })
  push({ action: 'lead.stage.change', entityType: 'Lead', entityId: chiamakaLead.id, entityRef: chiamakaLead.ref, field: 'stage', before: 'Counselling', after: 'Enrolled', actorIndex: 0, daysBack: 43 })
}

push({ action: 'admission.create', entityType: 'Admission', entityId: 'adm-0151', entityRef: 'ADM-2026-0151', field: null, before: null, after: 'Invoiced', actorIndex: 0, daysBack: 43 })
push({ action: 'invoice.issue', entityType: 'Invoice', entityId: 'inv-0851', entityRef: 'INV-2026-0851', field: 'status', before: 'Draft', after: 'Issued', actorIndex: 7, daysBack: 43 })
push({ action: 'payment.match', entityType: 'Payment', entityId: 'pay-1110', entityRef: 'PAY-1110', field: 'status', before: 'Unmatched', after: 'Matched (INV-2026-0851)', actorIndex: 7, daysBack: 42 })
push({ action: 'commission.create', entityType: 'Commission', entityId: 'com-0441', entityRef: 'COM-2026-0441', field: 'state', before: null, after: 'Pending', actorIndex: 2, daysBack: 42, source: 'automation' })
push({ action: 'commission.state.change', entityType: 'Commission', entityId: 'com-0441', entityRef: 'COM-2026-0441', field: 'state', before: 'Pending', after: 'Earned', actorIndex: 2, daysBack: 12, source: 'automation' })
push({ action: 'commission.approve', entityType: 'Commission', entityId: 'com-0441', entityRef: 'COM-2026-0441', field: 'state', before: 'Earned', after: 'Approved', actorIndex: 2, daysBack: 10 })
push({ action: 'commission.pay', entityType: 'Commission', entityId: 'com-0441', entityRef: 'COM-2026-0441', field: 'state', before: 'Payable', after: 'Paid', actorIndex: 3, daysBack: 8 })
push({ action: 'commission_rule.version_created', entityType: 'CommissionRule', entityId: 'cr-004-v3', entityRef: 'CR-004', field: 'version', before: '2', after: '3', actorIndex: 9, daysBack: 82 })
push({ action: 'commission_rule.version_created', entityType: 'CommissionRule', entityId: 'cr-004-v2', entityRef: 'CR-004', field: 'version', before: '1', after: '2', actorIndex: 9, daysBack: 173 })
push({ action: 'person.merge', entityType: 'Person', entityId: P.chiamaka, entityRef: 'Chiamaka Okonkwo', field: 'mergedFromPersonIds', before: '[]', after: '[per-0300]', actorIndex: 5, daysBack: 101 })

/* -------------------------------------------------------------------------- */
/* Breadth: every audited action, at least five times                         */
/* -------------------------------------------------------------------------- */

interface Spec {
  action: string
  entityType: string
  field: string | null
  before: string | null
  after: string | null
  source?: AuditSource
  rows: () => Array<{ id: string; ref: string }>
  count: number
}

const SPECS: Spec[] = [
  { action: 'lead.create', entityType: 'Lead', field: null, before: null, after: 'New', source: 'api', rows: () => leads.map((l) => ({ id: l.id, ref: l.ref })), count: 220 },
  { action: 'lead.stage.change', entityType: 'Lead', field: 'stage', before: 'Contacted', after: 'Qualified', rows: () => leads.map((l) => ({ id: l.id, ref: l.ref })), count: 260 },
  { action: 'lead.owner.change', entityType: 'Lead', field: 'ownerUserId', before: 'Chidinma Eze', after: 'Blessing Uche', rows: () => leads.map((l) => ({ id: l.id, ref: l.ref })), count: 40 },
  { action: 'lead.source.locked', entityType: 'Lead', field: 'originalSource', before: null, after: 'Immutable after creation', source: 'api', rows: () => leads.map((l) => ({ id: l.id, ref: l.ref })), count: 30 },
  { action: 'admission.create', entityType: 'Admission', field: null, before: null, after: 'Invoiced', rows: () => admissions.map((a) => ({ id: a.id, ref: a.ref })), count: 190 },
  { action: 'admission.discount.request', entityType: 'Admission', field: 'discountValue', before: '0', after: '25', rows: () => admissions.map((a) => ({ id: a.id, ref: a.ref })), count: 24 },
  { action: 'admission.withdraw', entityType: 'Admission', field: 'status', before: 'Enrolled', after: 'Withdrawn', rows: () => admissions.filter((a) => a.status === 'withdrawn').map((a) => ({ id: a.id, ref: a.ref })), count: 12 },
  { action: 'invoice.issue', entityType: 'Invoice', field: 'status', before: 'Draft', after: 'Issued', rows: () => invoices.map((i) => ({ id: i.id, ref: i.ref })), count: 96 },
  { action: 'invoice.void', entityType: 'Invoice', field: 'status', before: 'Issued', after: 'Cancelled', rows: () => invoices.map((i) => ({ id: i.id, ref: i.ref })), count: 8 },
  { action: 'payment.record', entityType: 'Payment', field: null, before: null, after: 'Unmatched', source: 'import', rows: () => payments.map((p) => ({ id: p.id, ref: p.ref })), count: 170 },
  { action: 'payment.match', entityType: 'Payment', field: 'status', before: 'Unmatched', after: 'Matched', rows: () => payments.filter((p) => p.status === 'matched').map((p) => ({ id: p.id, ref: p.ref })), count: 150 },
  { action: 'payment.reverse', entityType: 'Payment', field: 'status', before: 'Matched', after: 'Reversed', rows: () => payments.filter((p) => p.status === 'reversed').map((p) => ({ id: p.id, ref: p.ref })), count: 6 },
  { action: 'commission.create', entityType: 'Commission', field: 'state', before: null, after: 'Pending', source: 'automation', rows: () => commissions.map((c) => ({ id: c.id, ref: c.ref })), count: 88 },
  { action: 'commission.state.change', entityType: 'Commission', field: 'state', before: 'Pending', after: 'Earned', source: 'automation', rows: () => commissions.map((c) => ({ id: c.id, ref: c.ref })), count: 70 },
  { action: 'commission.approve', entityType: 'Commission', field: 'state', before: 'Earned', after: 'Approved', rows: () => commissions.map((c) => ({ id: c.id, ref: c.ref })), count: 46 },
  { action: 'commission.pay', entityType: 'Commission', field: 'state', before: 'Payable', after: 'Paid', rows: () => commissions.filter((c) => c.state === 'paid').map((c) => ({ id: c.id, ref: c.ref })), count: 30 },
  { action: 'commission.reverse', entityType: 'Commission', field: 'state', before: 'Paid', after: 'Reversed', rows: () => commissions.filter((c) => c.state === 'reversed').map((c) => ({ id: c.id, ref: c.ref })), count: 8 },
  { action: 'commission_rule.version_created', entityType: 'CommissionRule', field: 'version', before: '1', after: '2', rows: () => commissionRules.map((rl) => ({ id: rl.id, ref: rl.ruleKey.toUpperCase() })), count: 11 },
  { action: 'approval.raise', entityType: 'ApprovalRequest', field: null, before: null, after: 'Pending', rows: () => approvalRequests.map((a) => ({ id: a.id, ref: a.ref })), count: 62 },
  { action: 'approval.decide', entityType: 'ApprovalRequest', field: 'status', before: 'Pending', after: 'Approved', rows: () => approvalRequests.map((a) => ({ id: a.id, ref: a.ref })), count: 48 },
  { action: 'approval.return', entityType: 'ApprovalRequest', field: 'status', before: 'Pending', after: 'Returned for information', rows: () => approvalRequests.map((a) => ({ id: a.id, ref: a.ref })), count: 9 },
  { action: 'certificate.issue', entityType: 'Certificate', field: 'status', before: 'Eligible, not issued', after: 'Issued', rows: () => certificates.map((c) => ({ id: c.id, ref: c.certificateId })), count: 39 },
  { action: 'certificate.revoke', entityType: 'Certificate', field: 'status', before: 'Issued', after: 'Revoked', rows: () => certificates.filter((c) => c.status === 'revoked').map((c) => ({ id: c.id, ref: c.certificateId })), count: 5 },
  { action: 'employee.compensation.version_created', entityType: 'Employee', field: 'compensationVersions', before: '1 version', after: '2 versions', rows: () => employees.map((e) => ({ id: e.id, ref: e.employeeId })), count: 34 },
  { action: 'employee.status.change', entityType: 'Employee', field: 'status', before: 'Probation', after: 'Active', rows: () => employees.map((e) => ({ id: e.id, ref: e.employeeId })), count: 22 },
  { action: 'automation.activate', entityType: 'Automation', field: 'status', before: 'Draft', after: 'Active', rows: () => automations.map((a) => ({ id: a.id, ref: a.automationKey })), count: 23 },
  { action: 'automation.pause', entityType: 'Automation', field: 'status', before: 'Active', after: 'Paused', rows: () => automations.map((a) => ({ id: a.id, ref: a.automationKey })), count: 7 },
  { action: 'automation.version_created', entityType: 'Automation', field: 'version', before: '1', after: '2', rows: () => automations.map((a) => ({ id: a.id, ref: a.automationKey })), count: 9 },
  { action: 'role.permission.change', entityType: 'Role', field: 'permissions', before: 'finance.invoice.view = branch', after: 'finance.invoice.view = organisation', rows: () => [{ id: 'role-finance-manager', ref: 'Finance Manager' }, { id: 'role-sales-exec', ref: 'Sales Executive' }, { id: 'role-tutor', ref: 'Tutor' }], count: 12 },
  { action: 'user.login', entityType: 'User', field: null, before: null, after: 'Signed in', rows: () => ACTORS.map(([id, name]) => ({ id, ref: name })), count: 180 },
  { action: 'user.permission.denied', entityType: 'User', field: null, before: null, after: 'Denied: people.compensation.view', rows: () => ACTORS.map(([id, name]) => ({ id, ref: name })), count: 14 },
  { action: 'export.run', entityType: 'Report', field: null, before: null, after: 'CSV export — 312 rows', rows: () => [{ id: 'rpt-sales', ref: 'Sales report' }, { id: 'rpt-unit-pl', ref: 'Unit P&L' }, { id: 'rpt-outcomes', ref: 'Outcomes' }], count: 18 },
  { action: 'policy.version_created', entityType: 'PolicyVersion', field: 'version', before: '1', after: '2', rows: () => [{ id: 'pol-attendance-v2', ref: 'Attendance policy' }, { id: 'pol-approval-v2', ref: 'Approval thresholds' }], count: 6 },
  { action: 'refund.process', entityType: 'Refund', field: 'status', before: 'Approved', after: 'Processed', rows: () => Array.from({ length: 13 }, (_, i) => ({ id: `ref-${pad(i + 1, 4)}`, ref: `REF-${pad(i + 1, 4)}` })), count: 13 },
  { action: 'credit_note.issue', entityType: 'CreditNote', field: null, before: null, after: 'Issued', rows: () => Array.from({ length: 20 }, (_, i) => ({ id: `cn-${pad(i + 1, 4)}`, ref: `CN-${pad(i + 1, 4)}` })), count: 20 },
  { action: 'card.issue', entityType: 'Card', field: 'status', before: null, after: 'Active', rows: () => Array.from({ length: 30 }, (_, i) => ({ id: `crd-${pad(i + 1, 4)}`, ref: `CRD-${pad(i + 1, 4)}` })), count: 30 },
  { action: 'card.deactivate', entityType: 'Card', field: 'status', before: 'Active', after: 'Deactivated', rows: () => Array.from({ length: 8 }, (_, i) => ({ id: `crd-${pad(i + 1, 4)}`, ref: `CRD-${pad(i + 1, 4)}` })), count: 8 },
  { action: 'attendance.override', entityType: 'AttendanceEvent', field: 'state', before: 'Missing clock-out', after: 'Present', rows: () => Array.from({ length: 20 }, (_, i) => ({ id: `att-${pad(i + 1, 5)}`, ref: `ATT-${pad(i + 1, 5)}` })), count: 20 },
  { action: 'payroll.period.close', entityType: 'PayrollPeriod', field: 'status', before: 'Approved', after: 'Closed', rows: () => [{ id: 'per-2026-07', ref: 'Jul 2026' }, { id: 'per-2026-08', ref: 'Aug 2026' }], count: 6 },
  { action: 'payout.mark_paid', entityType: 'PayoutBatch', field: 'status', before: 'Processing', after: 'Paid', rows: () => Array.from({ length: 5 }, (_, i) => ({ id: `payb-${pad(13 + i, 3)}`, ref: `PAY-B-2026-${pad(13 + i, 3)}` })), count: 10 },
  { action: 'duplicate.resolve', entityType: 'DuplicateCandidate', field: 'status', before: 'Open', after: 'Merged', rows: () => Array.from({ length: 8 }, (_, i) => ({ id: `dup-${pad(i + 1, 4)}`, ref: `DUP-${pad(i + 1, 4)}` })), count: 8 },
]

for (const spec of SPECS) {
  const rows = spec.rows()
  if (!rows.length) continue
  for (let i = 0; i < spec.count; i++) {
    const row = rows[(i * 3 + 1) % rows.length]
    push({
      action: spec.action,
      entityType: spec.entityType,
      entityId: row.id,
      entityRef: row.ref,
      field: spec.field,
      before: spec.before,
      after: spec.after,
      source: spec.source,
    })
  }
}

/* Newest first — every audit screen reads it in this order. */
events.sort((a, b) => b.at.localeCompare(a.at))

export const auditEvents: AuditEvent[] = events

export const AUDIT_COUNTS = {
  events: auditEvents.length,
  distinctActions: new Set(auditEvents.map((e) => e.action)).size,
} as const

void audit
void fullName
