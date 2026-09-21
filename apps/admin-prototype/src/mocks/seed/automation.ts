/**
 * Automation, Engage and Notifications.
 *
 * Flow 4 is built against this file, so three things have to be true in the
 * seed rather than in the UI:
 *
 *  - The PRD's reference journey — *tuition fully paid → clearance → receipt →
 *    commission → notify → LMS access → card* — exists as a real node graph at
 *    v1, with idempotency key fields, retry policy and a stop condition.
 *  - Runs are **never rewritten**. Each run records the `automationVersion`
 *    that executed. Editing an automation creates a new version; the old runs
 *    keep their trace.
 *  - The duplicate guard is visible: there are runs with status
 *    `skipped_duplicate` whose `errorSummary` names the idempotency key that
 *    was already processed.
 */

import {
  automationId as asAutomationId,
  campaignId as asCampaignId,
  exceptionId,
  messageId as asMessageId,
  msgTemplateId as asMsgTemplateId,
  ngn,
  notificationId,
  runId as asRunId,
  segmentId as asSegmentId,
  type Automation,
  type AutomationException,
  type AutomationNode,
  type AutomationRun,
  type AutomationRunStatus,
  type AutomationRunStep,
  type AutomationStatus,
  type AutomationTriggerType,
  type Campaign,
  type Channel,
  type ConditionGroup,
  type Kobo,
  type Message,
  type MessageTemplate,
  type Notification,
  type NotificationCategory,
  type Segment,
} from '@/mocks/types'
import { AUTO, MSGT, SEG, U, UNIT, person } from '@/mocks/seed/ids'
import { fullName } from '@/mocks/seed/people'
import { addDays, at, audit, daysAgo, int, pad, pick, rng, TODAY, weighted } from '@/mocks/seed/_helpers'

const r = rng(808080)

/* -------------------------------------------------------------------------- */
/* Message templates                                                          */
/* -------------------------------------------------------------------------- */

const TEMPLATES: ReadonlyArray<readonly [string, string, Channel, string, string, string]> = [
  [MSGT.paymentReceipt, 'Payment receipt', 'whatsapp', 'Payments', 'Hi {{person.firstName}}, we have received {{payment.amount}} towards {{course.title}}. Your balance is now {{invoice.balance}}.', 'approved'],
  [MSGT.welcomeEnrolment, 'Welcome to your cohort', 'whatsapp', 'Onboarding', 'Welcome {{person.firstName}}! You are enrolled in {{cohort.code}}, starting {{cohort.startDate}}. Your class WhatsApp group link is below.', 'approved'],
  [MSGT.overdueReminder, 'Tuition balance reminder', 'whatsapp', 'Collections', 'Hi {{person.firstName}}, a balance of {{invoice.balance}} on {{invoice.ref}} became due on {{invoice.dueDate}}. You can pay here: {{payment.link}}', 'approved'],
  [MSGT.leadFirstTouch, 'First response — new enquiry', 'whatsapp', 'Sales', 'Hi {{person.firstName}}, thanks for your interest in {{course.title}} at Cirvee. I am {{owner.firstName}} and I will be looking after your application. When is a good time to talk?', 'approved'],
  [MSGT.certificateIssued, 'Your certificate is ready', 'email', 'Academy', 'Congratulations {{person.firstName}} — your certificate for {{course.title}} is issued. Verify it any time at {{certificate.verificationUrl}}.', 'n_a'],
  [MSGT.referrerEarned, 'You have earned a referral commission', 'whatsapp', 'Referral', 'Good news {{person.firstName}} — {{referred.firstName}} has completed payment, so your {{commission.amount}} referral commission is now earned. It goes out in the {{payout.scheduledDate}} run.', 'approved'],
  [MSGT.classReminder, 'Class tomorrow', 'sms', 'Academy', '{{cohort.code}} meets tomorrow at {{session.startTime}}, {{session.room}}. Topic: {{session.topic}}.', 'n_a'],
  [MSGT.reviewRequest, 'How did we do?', 'whatsapp', 'Reputation', 'Hi {{person.firstName}}, congratulations again on finishing {{course.title}}. Would you leave us a short review? {{review.link}}', 'pending'],
]

export const messageTemplates: MessageTemplate[] = TEMPLATES.map(([id, name, channel, category, body, approval], i) => ({
  id: asMsgTemplateId(id),
  name,
  channel,
  category,
  subject: channel === 'email' ? name : null,
  preview: body.slice(0, 70),
  body,
  mergeFields: [...body.matchAll(/\{\{([a-zA-Z.]+)\}\}/g)].map((m) => m[1]),
  language: 'en',
  version: 1 + (i % 3),
  whatsappApprovalStatus: approval as MessageTemplate['whatsappApprovalStatus'],
  usedByCount: int(r, 2, 40),
  ...audit(at('2026-02-11', 10, 0), U.amarachi),
}))

/* -------------------------------------------------------------------------- */
/* Segments                                                                   */
/* -------------------------------------------------------------------------- */

function group(operator: 'and' | 'or', rules: Array<{ field: string; op: string; value: unknown }>): ConditionGroup {
  return { operator, rules }
}

export const segments: Segment[] = [
  {
    id: asSegmentId(SEG.alumni),
    name: 'All alumni',
    description: 'Everyone with an active alumnus relationship. The referral programme recruits from here.',
    criteria: group('and', [{ field: 'relationship.type', op: 'is', value: 'alumnus' }, { field: 'relationship.status', op: 'is', value: 'active' }]),
    criteriaSummary: 'Person has an active Alumnus relationship',
    memberCount: 148,
    lastRefreshedAt: at(daysAgo(1), 6, 0),
    usedByCampaignIds: [asCampaignId('cmp-0001'), asCampaignId('cmp-0004')],
    ownerUserId: U.amarachi,
    ...audit(at('2026-03-02', 11, 0), U.amarachi),
  },
  {
    id: asSegmentId(SEG.stalledLeads),
    name: 'Stalled leads — 14 days or more in stage',
    description: 'Open leads that have not moved in a fortnight. Re-engagement target.',
    criteria: group('and', [{ field: 'lead.stage', op: 'not_in', value: ['enrolled', 'lost', 'invalid'] }, { field: 'lead.daysInStage', op: 'gte', value: 14 }]),
    criteriaSummary: 'Lead is still open and has been in the same stage for 14 days or more',
    memberCount: 63,
    lastRefreshedAt: at(daysAgo(1), 6, 0),
    usedByCampaignIds: [asCampaignId('cmp-0002')],
    ownerUserId: U.ifeoma,
    ...audit(at('2026-04-18', 9, 0), U.ifeoma),
  },
  {
    id: asSegmentId(SEG.overdueBalance),
    name: 'Students with an overdue balance',
    description: 'Drives the collections sequence. Excludes anyone on an agreed plan.',
    criteria: group('and', [{ field: 'invoice.status', op: 'is', value: 'overdue' }, { field: 'invoice.balance', op: 'gt', value: 0 }]),
    criteriaSummary: 'Has at least one overdue invoice with a balance above ₦0',
    memberCount: 41,
    lastRefreshedAt: at(daysAgo(1), 6, 0),
    usedByCampaignIds: [asCampaignId('cmp-0003')],
    ownerUserId: U.fatima,
    ...audit(at('2026-02-20', 9, 0), U.fatima),
  },
  {
    id: asSegmentId(SEG.teensParents),
    name: 'Cirvee Teens parents and guardians',
    description: 'Parent-facing communication for the Teens unit.',
    criteria: group('and', [{ field: 'relationship.type', op: 'is', value: 'parent_guardian' }]),
    criteriaSummary: 'Person is a parent or guardian of a Teens student',
    memberCount: 29,
    lastRefreshedAt: at(daysAgo(1), 6, 0),
    usedByCampaignIds: [],
    ownerUserId: U.folake,
    ...audit(at('2026-05-06', 9, 0), U.folake),
  },
  {
    id: asSegmentId(SEG.corporateContacts),
    name: 'Corporate contacts',
    description: 'Named contacts at client organisations.',
    criteria: group('and', [{ field: 'relationship.type', op: 'is', value: 'corporate_contact' }]),
    criteriaSummary: 'Person is a named contact at a client organisation',
    memberCount: 5,
    lastRefreshedAt: at(daysAgo(1), 6, 0),
    usedByCampaignIds: [],
    ownerUserId: U.chukwuemeka,
    ...audit(at('2026-01-30', 9, 0), U.chukwuemeka),
  },
  {
    id: asSegmentId(SEG.lowActivityLearners),
    name: 'Low-activity learners',
    description: 'Active enrolments with no LMS activity for 10 days. Advisory only — never a financial trigger.',
    criteria: group('and', [{ field: 'enrollment.status', op: 'is', value: 'active' }, { field: 'progress.daysInactive', op: 'gte', value: 10 }]),
    criteriaSummary: 'Active enrolment with 10 or more days of LMS inactivity',
    memberCount: 37,
    lastRefreshedAt: at(daysAgo(1), 6, 0),
    usedByCampaignIds: [],
    ownerUserId: U.folake,
    ...audit(at('2026-06-14', 9, 0), U.folake),
  },
]

/* -------------------------------------------------------------------------- */
/* Campaigns                                                                  */
/* -------------------------------------------------------------------------- */

const CAMPAIGNS: ReadonlyArray<{
  name: string
  objective: string
  channel: Channel
  segment: string
  template: string
  status: Campaign['status']
  budgetNaira: number | null
  sent: number
  enrolments: number
  revenueNaira: number
  daysAgo: number
}> = [
  { name: 'October intake — alumni referral push', objective: 'Get 25 referral-sourced leads for the October cohorts', channel: 'whatsapp', segment: SEG.alumni, template: MSGT.referrerEarned, status: 'sent', budgetNaira: 180_000, sent: 148, enrolments: 6, revenueNaira: 2_430_000, daysAgo: 21 },
  { name: 'Stalled lead re-engagement — September', objective: 'Move 40 stalled leads back into an active stage', channel: 'whatsapp', segment: SEG.stalledLeads, template: MSGT.leadFirstTouch, status: 'sent', budgetNaira: 60_000, sent: 63, enrolments: 3, revenueNaira: 1_230_000, daysAgo: 9 },
  { name: 'Balance reminder — overdue 30 days', objective: 'Recover ₦4m of overdue tuition', channel: 'whatsapp', segment: SEG.overdueBalance, template: MSGT.overdueReminder, status: 'sending', budgetNaira: null, sent: 28, enrolments: 0, revenueNaira: 1_840_000, daysAgo: 1 },
  { name: 'Alumni Q4 newsletter', objective: 'Keep alumni warm ahead of the advanced-course launch', channel: 'email', segment: SEG.alumni, template: MSGT.certificateIssued, status: 'scheduled', budgetNaira: 0, sent: 0, enrolments: 0, revenueNaira: 0, daysAgo: -6 },
  { name: 'Teens term 2 — early bird', objective: 'Fill TC-T07 before 7 November', channel: 'whatsapp', segment: SEG.teensParents, template: MSGT.welcomeEnrolment, status: 'draft', budgetNaira: 90_000, sent: 0, enrolments: 0, revenueNaira: 0, daysAgo: -1 },
  { name: 'Lagos Tech Week follow-up', objective: 'Convert the 84 leads captured at the stand', channel: 'email', segment: SEG.stalledLeads, template: MSGT.leadFirstTouch, status: 'completed', budgetNaira: 40_000, sent: 84, enrolments: 5, revenueNaira: 2_050_000, daysAgo: 74 },
  { name: 'Certificate congratulations — August graduates', objective: 'Trigger review requests off the certificate moment', channel: 'email', segment: SEG.alumni, template: MSGT.certificateIssued, status: 'sent', budgetNaira: 0, sent: 38, enrolments: 0, revenueNaira: 0, daysAgo: 33 },
  { name: 'Low-activity nudge — running cohorts', objective: 'Bring inactive learners back before the flag becomes a withdrawal', channel: 'in_app', segment: SEG.lowActivityLearners, template: MSGT.classReminder, status: 'paused', budgetNaira: null, sent: 19, enrolments: 0, revenueNaira: 0, daysAgo: 5 },
]

export const campaigns: Campaign[] = CAMPAIGNS.map((c, i) => {
  const delivered = Math.round(c.sent * 0.96)
  const opened = Math.round(delivered * 0.62)
  const clicked = Math.round(opened * 0.31)
  return {
    id: asCampaignId(`cmp-${pad(i + 1, 4)}`),
    name: c.name,
    objective: c.objective,
    channel: c.channel,
    segmentId: asSegmentId(c.segment),
    audienceSize: segments.find((s) => s.id === c.segment)?.memberCount ?? c.sent,
    templateId: asMsgTemplateId(c.template),
    ownerUserId: U.amarachi,
    unitId: c.segment === SEG.teensParents ? UNIT.teens : UNIT.academy,
    budget: c.budgetNaira === null ? null : ngn(c.budgetNaira),
    scheduledAt: at(c.daysAgo >= 0 ? daysAgo(c.daysAgo) : addDays(TODAY, -c.daysAgo), 9, 0),
    status: c.status,
    utm: { source: c.channel, medium: 'campaign', campaign: c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') },
    stats: {
      sent: c.sent,
      delivered,
      opened,
      clicked,
      replied: Math.round(clicked * 0.24),
      unsubscribed: Math.round(delivered * 0.02),
      converted: c.enrolments,
      enrolments: c.enrolments,
      revenueAttributed: ngn(c.revenueNaira),
    },
    ...audit(at(daysAgo(Math.abs(c.daysAgo) + 7), 10, 0), U.amarachi),
  }
})

/* -------------------------------------------------------------------------- */
/* The automations                                                            */
/* -------------------------------------------------------------------------- */

/** The PRD's reference journey, node by node. Flow 4 rebuilds this by hand. */
const TUITION_PAID_NODES: AutomationNode[] = [
  { id: 'n1', kind: 'trigger', triggerType: 'tuition_fully_paid', params: { scope: 'invoice' }, summary: "Runs when an invoice's balance reaches zero." },
  {
    id: 'n2',
    kind: 'condition',
    group: group('and', [
      { field: 'invoice.unit', op: 'is', value: 'ACADEMY' },
      { field: 'admission.status', op: 'is_not', value: 'withdrawn' },
    ]),
    summary: 'Only for Academy invoices, and only if the admission has not been withdrawn.',
  },
  { id: 'n3', kind: 'action', actionType: 'send_message', params: { channel: 'whatsapp', templateId: MSGT.paymentReceipt, recipient: 'trigger.person' }, summary: 'WhatsApp the payment receipt to the person on the trigger.' },
  { id: 'n4', kind: 'action', actionType: 'calculate_commission', params: { scope: 'all_rules_in_force' }, summary: 'Evaluate every commission rule in force — referrer, lead owner and closer are evaluated independently.' },
  {
    id: 'n5',
    kind: 'branch',
    label: 'Does this deal have a referrer?',
    lanes: [
      { label: 'If a referrer exists', condition: group('and', [{ field: 'admission.referrerPersonId', op: 'is_not', value: null }]), nodeIds: ['n5a'] },
      { label: 'Otherwise', condition: null, nodeIds: [] },
    ],
  },
  { id: 'n5a', kind: 'action', actionType: 'send_message', params: { channel: 'whatsapp', templateId: MSGT.referrerEarned, recipient: 'admission.referrer' }, summary: 'Tell the referrer their commission is earned.' },
  { id: 'n6', kind: 'action', actionType: 'grant_lms_access', params: { cohortFrom: 'admission.cohortId' }, summary: 'Grant Cirvee Learn access for the admission’s cohort.' },
  { id: 'n7', kind: 'action', actionType: 'issue_card', params: { holderType: 'student', branchFrom: 'admission.branchId' }, summary: 'Issue a student NFC card at the admission’s branch.' },
  {
    id: 'n8',
    kind: 'stop',
    condition: group('or', [
      { field: 'admission.status', op: 'is', value: 'withdrawn' },
      { field: 'person.optedOut', op: 'is', value: true },
    ]),
    summary: 'This automation stops for a person as soon as: admission withdrawn OR contact opted out.',
  },
]

interface AutomationSpec {
  id: string
  key: string
  name: string
  description: string
  status: AutomationStatus
  trigger: AutomationTriggerType
  modules: string[]
  nodes?: AutomationNode[]
  runs7d: number
  successRate: number
}

const AUTOMATION_SPECS: AutomationSpec[] = [
  { id: AUTO.tuitionPaid, key: 'tuition-fully-paid-activation', name: 'Tuition fully paid — enrolment activation', description: 'The reference journey: clearance, receipt, commission, notifications, LMS access, card.', status: 'active', trigger: 'tuition_fully_paid', modules: ['Finance', 'Referral', 'Learn', 'Physical', 'Engage'], nodes: TUITION_PAID_NODES, runs7d: 41, successRate: 97.6 },
  { id: AUTO.leadFirstTouch, key: 'lead-first-touch', name: 'New lead — first touch inside 15 minutes', description: 'Assigns an owner by round robin and sends the first WhatsApp before the response clock turns amber.', status: 'active', trigger: 'lead_created', modules: ['CRM', 'Engage'], runs7d: 187, successRate: 98.4 },
  { id: AUTO.overdueChase, key: 'invoice-overdue-chase', name: 'Invoice overdue — collections sequence', description: 'Three nudges at 3, 10 and 21 days, then a task for the Finance desk.', status: 'active', trigger: 'invoice_overdue', modules: ['Finance', 'Engage', 'Work'], runs7d: 64, successRate: 94.1 },
  { id: AUTO.certificateCascade, key: 'certificate-issued-cascade', name: 'Certificate issued — alumnus cascade', description: 'Adds the alumnus relationship, opens an outcome record, schedules 3/6/12-month checkpoints, queues a review request and drafts a proof asset.', status: 'active', trigger: 'certificate_issued', modules: ['Learn', 'CRM', 'Outcomes', 'Reputation'], runs7d: 18, successRate: 100 },
]

const EXTRA_AUTOMATIONS: ReadonlyArray<readonly [string, string, AutomationStatus, AutomationTriggerType, string]> = [
  ['welcome-enrolment', 'Admission created — welcome sequence', 'active', 'admission_created', 'CRM'],
  ['discount-approved-notify', 'Discount approved — notify the sales owner', 'active', 'discount_approved', 'Work'],
  ['payment-received-receipt', 'Payment received — send a receipt', 'active', 'payment_received', 'Finance'],
  ['class-reminder', 'Class tomorrow — SMS reminder', 'active', 'scheduled', 'Academy'],
  ['student-absent-advisor', 'Student absent twice — notify the advisor', 'active', 'student_absent', 'Academy'],
  ['birthday-greeting', 'Birthday greeting', 'active', 'birthday', 'Engage'],
  ['work-anniversary', 'Work anniversary — notify the team', 'active', 'work_anniversary', 'People'],
  ['offer-accepted-onboarding', 'Offer accepted — open onboarding checklist', 'active', 'offer_accepted', 'People'],
  ['employee-exited-revoke', 'Employee exited — revoke access and deactivate the card', 'active', 'employee_exited', 'Physical'],
  ['commission-earned-notify', 'Commission earned — notify the beneficiary', 'active', 'commission_earned', 'Referral'],
  ['course-completed-survey', 'Course completed — satisfaction survey', 'active', 'course_completed', 'Reputation'],
  ['deal-won-contract', 'Corporate deal won — generate the contract', 'active', 'deal_won', 'Corporate'],
  ['card-tapped-attendance', 'Card tapped at a classroom reader — mark attendance', 'active', 'card_tapped', 'Academy'],
  ['outcome-recorded-proof', 'Outcome recorded — draft a proof asset', 'active', 'outcome_recorded', 'Reputation'],
  ['lead-stage-qualified-task', 'Lead qualified — create a counselling task', 'active', 'lead_stage_changed', 'CRM'],
  ['invoice-issued-send', 'Invoice issued — email the PDF', 'active', 'invoice_issued', 'Finance'],
  ['weekly-pipeline-digest', 'Weekly pipeline digest to the growth team', 'active', 'scheduled', 'CRM'],
  ['monthly-unit-pl', 'Monthly unit P&L snapshot', 'active', 'scheduled', 'Finance'],
  ['attendance-breach-notify', 'Attendance breach detected — notify the manager only', 'active', 'attendance_breach_detected', 'People'],
  ['teens-no-tap-alert', 'Teens — no tap-in by 09:30, alert the parent', 'paused', 'scheduled', 'Physical'],
  ['nps-followup', 'NPS detractor follow-up', 'paused', 'course_completed', 'Reputation'],
  ['dormant-lead-archive', 'Dormant lead — move to future nurture', 'paused', 'scheduled', 'CRM'],
  ['referrer-monthly-statement', 'Referrer monthly statement', 'paused', 'scheduled', 'Referral'],
  ['waitlist-seat-released', 'Seat released — offer it to the waitlist', 'draft', 'admission_created', 'Academy'],
  ['alumni-advanced-course', 'Alumni — advanced course upsell', 'draft', 'certificate_issued', 'Engage'],
  ['expense-receipt-chase', 'Expense approved without a receipt — chase it', 'draft', 'scheduled', 'Finance'],
  ['tutor-feedback-reminder', 'Tutor grading backlog reminder', 'draft', 'scheduled', 'Learn'],
  ['corporate-renewal-90d', 'Corporate contract renewal — 90-day warning', 'draft', 'scheduled', 'Corporate'],
  ['exit-asset-return', 'Exit — chase outstanding assets', 'draft', 'employee_exited', 'Work'],
]

function simpleNodes(trigger: AutomationTriggerType, name: string): AutomationNode[] {
  return [
    { id: 'n1', kind: 'trigger', triggerType: trigger, params: {}, summary: `Runs on ${trigger.replace(/_/g, ' ')}.` },
    { id: 'n2', kind: 'condition', group: group('and', [{ field: 'person.optedOut', op: 'is', value: false }]), summary: 'Only for contacts who have not opted out.' },
    { id: 'n3', kind: 'action', actionType: 'send_message', params: { channel: 'whatsapp' }, summary: `Send the "${name}" message.` },
  ]
}

export const automations: Automation[] = [
  ...AUTOMATION_SPECS.map((s, i) => ({
    id: asAutomationId(s.id),
    automationKey: s.key,
    version: 1,
    name: s.name,
    description: s.description,
    status: s.status,
    ownerUserId: U.damilola,
    nodes: s.nodes ?? simpleNodes(s.trigger, s.name),
    modulesTouched: s.modules,
    reliability: {
      idempotencyKeyFields: s.key === 'tuition-fully-paid-activation' ? ['person.id', 'invoice.id'] : ['person.id'],
      retryAttempts: 3,
      retryBackoff: 'exponential' as const,
      onFailure: 'retry_then_exception' as const,
      maxRunsPerPersonPerPeriod: s.key === 'lead-first-touch' ? 1 : null,
    },
    stats: { runs7d: s.runs7d, successRate: s.successRate, lastRunAt: at(daysAgo(0), 8 + i, int(r, 0, 59)) },
    supersedesVersionId: null,
    ...audit(at('2026-06-02', 11, 0), U.damilola),
  })),
  ...EXTRA_AUTOMATIONS.map(([key, name, status, trigger, module], i) => ({
    id: asAutomationId(`auto-${key}-v1`),
    automationKey: key,
    version: 1,
    name,
    description: `${name}. Owned by ${module}.`,
    status,
    ownerUserId: [U.damilola, U.amarachi, U.fatima, U.emeka][i % 4],
    nodes: simpleNodes(trigger, name),
    modulesTouched: [module],
    reliability: {
      idempotencyKeyFields: ['person.id'],
      retryAttempts: status === 'draft' ? 1 : 3,
      retryBackoff: 'exponential' as const,
      onFailure: 'retry_then_exception' as const,
      maxRunsPerPersonPerPeriod: null,
    },
    stats: {
      runs7d: status === 'active' ? int(r, 4, 160) : 0,
      successRate: status === 'active' ? 90 + int(r, 0, 9) : 0,
      lastRunAt: status === 'active' ? at(daysAgo(int(r, 0, 6)), int(r, 7, 20), int(r, 0, 59)) : null,
    },
    supersedesVersionId: null,
    ...audit(at(daysAgo(int(r, 40, 300)), 11, 0), U.damilola),
  })),
]

/* -------------------------------------------------------------------------- */
/* Runs — 1,412 over seven days                                               */
/* -------------------------------------------------------------------------- */

const activeAutomations = automations.filter((a) => a.status === 'active')

const RUN_STATUS_MIX: ReadonlyArray<readonly [AutomationRunStatus, number]> = [
  ['succeeded', 1359],
  ['failed', 38],
  ['skipped_conditions_not_met', 3],
  ['waiting_delay', 2],
  ['waiting_approval', 2],
  ['stopped_by_condition', 1],
  // The duplicate guard, made countable: "Idempotency collisions prevented 7".
  ['skipped_duplicate', 7],
]

const FAILURE_CLASSES: ReadonlyArray<readonly [string, string]> = [
  ['MessageDeliveryFailed', 'Recipient has no WhatsApp number on record'],
  ['MessageDeliveryFailed', 'WhatsApp template not approved for this locale'],
  ['ConditionDataMissing', 'admission.cohortId was null on the trigger payload'],
  ['DownstreamRecordLocked', 'Payroll period Aug 2026 is closed and cannot accept an adjustment'],
  ['ApprovalTimedOut', 'Approval APR-2026-0301 was not decided inside 48 hours'],
  ['TemplateRenderError', 'Merge field {{invoice.balance}} resolved to undefined'],
]

const automationRuns: AutomationRun[] = []
let runSeq = 0

const statusSequence = RUN_STATUS_MIX.flatMap(([s, n]) => Array.from({ length: n }, () => s))

for (let i = 0; i < statusSequence.length; i++) {
  const status = statusSequence[i]
  const automation = activeAutomations[i % activeAutomations.length]
  runSeq += 1
  const subjectSlot = 53 + (i % 560)
  const subjectLabel = fullName(person(subjectSlot))
  const back = i % 7
  const startedAt = at(daysAgo(back), int(r, 6, 22), int(r, 0, 59))
  const duration = int(r, 120, 4200)
  const failed = status === 'failed'
  const [errorClass, errorMessage] = FAILURE_CLASSES[i % FAILURE_CLASSES.length]
  const trigger = automation.nodes[0]
  const triggerType: AutomationTriggerType = trigger.kind === 'trigger' ? trigger.triggerType : 'scheduled'
  const idempotencyKey = `${automation.automationKey}:per_${pad(subjectSlot)}`

  // Only the most recent runs carry a full step trace; older ones keep their
  // summary. Traces are what a reviewer opens, and they are never rewritten.
  const withTrace = i < 160
  const actionNodes = automation.nodes.filter((n) => n.kind === 'action')
  const steps: AutomationRunStep[] = withTrace
    ? automation.nodes.slice(0, 5).map((node, j) => ({
        nodeId: node.id,
        kind: node.kind,
        label: node.kind === 'branch' ? node.label : node.summary,
        at: at(startedAt.slice(0, 10), Number(startedAt.slice(11, 13)), Number(startedAt.slice(14, 16)) + j),
        durationMs: int(r, 20, 900),
        inputs: node.kind === 'trigger' ? { personId: person(subjectSlot) } : { subject: subjectLabel },
        outcome:
          node.kind === 'condition'
            ? 'true — invoice.unit = ACADEMY, admission.status = enrolled'
            : node.kind === 'action'
              ? 'executed'
              : 'evaluated',
        outputs:
          node.kind === 'action'
            ? [{ type: 'Message', id: `msg-${pad(runSeq, 4)}`, ref: `MSG-${pad(runSeq, 4)}` }]
            : [],
        error: failed && j === 2 ? { class: errorClass, message: errorMessage, attempts: 3 } : null,
        skippedReason: null,
      }))
    : []

  automationRuns.push({
    id: asRunId(`run-${pad(runSeq, 5)}`),
    automationId: automation.id,
    automationKey: automation.automationKey,
    automationVersion: automation.version,
    triggerType,
    triggerPayload: { personId: person(subjectSlot), at: startedAt },
    subjectType: 'Person',
    subjectId: person(subjectSlot),
    subjectLabel,
    startedAt,
    endedAt: status === 'waiting_delay' || status === 'waiting_approval' ? null : at(startedAt.slice(0, 10), Number(startedAt.slice(11, 13)), Number(startedAt.slice(14, 16)) + 1),
    durationMs: status === 'waiting_delay' || status === 'waiting_approval' ? null : duration,
    status,
    idempotencyKey,
    actionsExecuted: failed ? Math.max(0, actionNodes.length - 2) : status === 'succeeded' ? actionNodes.length : 0,
    actionsTotal: actionNodes.length,
    errorSummary:
      status === 'failed'
        ? `${errorClass}: ${errorMessage}`
        : status === 'skipped_duplicate'
          ? `Idempotency key already processed: ${idempotencyKey}`
          : status === 'skipped_conditions_not_met'
            ? 'Conditions not met — invoice.unit was not ACADEMY'
            : null,
    steps,
  })
}

export { automationRuns }

/* -------------------------------------------------------------------------- */
/* Exception queue — 11 open, four of one error class                         */
/* -------------------------------------------------------------------------- */

const failedRuns = automationRuns.filter((run) => run.status === 'failed')

export const automationExceptions: AutomationException[] = failedRuns.slice(0, 16).map((run, i) => {
  const [errorClass, errorMessage] = FAILURE_CLASSES[i % FAILURE_CLASSES.length]
  // The first four share the "Message delivery failed" class Flow 4 filters on.
  const cls = i < 4 ? 'MessageDeliveryFailed' : errorClass
  const msg = i < 4 ? (i === 0 ? 'Recipient has no WhatsApp number on record' : 'WhatsApp template not approved for this locale') : errorMessage
  const status: AutomationException['status'] = i < 11 ? 'open' : i < 14 ? 'resolved' : 'ignored'
  return {
    id: exceptionId(`exc-${pad(i + 1, 4)}`),
    runId: run.id,
    automationId: run.automationId,
    subjectLabel: run.subjectLabel,
    failedNodeId: 'n3',
    failedNodeLabel: 'Send message — WhatsApp',
    errorClass: cls,
    errorMessage: msg,
    firstFailedAt: run.startedAt,
    lastAttemptAt: at(run.startedAt.slice(0, 10), Number(run.startedAt.slice(11, 13)) + 1, 0),
    retryAttempts: 3,
    assigneeUserId: i % 3 === 0 ? U.damilola : null,
    status,
    ignoreReason: status === 'ignored' ? 'Duplicate of exc-0003. Same subject, same node.' : null,
    ...audit(run.startedAt, U.damilola),
  }
})

/* -------------------------------------------------------------------------- */
/* Messages                                                                   */
/* -------------------------------------------------------------------------- */

const MESSAGE_STATUS: ReadonlyArray<readonly [Message['status'], number]> = [
  ['delivered', 52],
  ['read', 30],
  ['sent', 8],
  ['failed', 4],
  ['bounced', 3],
  ['queued', 2],
  ['unsubscribed', 1],
]

export const messages: Message[] = Array.from({ length: 420 }, (_, i) => {
  const template = messageTemplates[i % messageTemplates.length]
  const slot = 53 + (i % 560)
  const status = weighted(r, MESSAGE_STATUS)
  return {
    id: asMessageId(`msg-${pad(i + 1, 4)}`),
    personId: person(slot),
    channel: template.channel,
    direction: i % 11 === 0 ? 'inbound' : 'outbound',
    sourceType: i % 5 === 0 ? 'campaign' : i % 3 === 0 ? 'manual' : 'automation',
    sourceId: i % 5 === 0 ? `cmp-${pad(1 + (i % 8), 4)}` : i % 3 === 0 ? null : `run-${pad(1 + (i % 1412), 5)}`,
    templateId: i % 3 === 0 ? null : template.id,
    subject: template.subject,
    preview: template.preview,
    body: template.body.replace('{{person.firstName}}', fullName(person(slot)).split(' ')[0]),
    sentAt: at(daysAgo(int(r, 0, 30)), int(r, 7, 21), int(r, 0, 59)),
    status,
    failureReason: status === 'failed' ? 'Recipient has no WhatsApp number on record' : status === 'bounced' ? 'Mailbox does not exist' : null,
    retryCount: status === 'failed' ? 3 : 0,
    ...audit(at(daysAgo(int(r, 0, 30)), 9, 0), U.amarachi),
  }
})

/* -------------------------------------------------------------------------- */
/* Notifications for the signed-in user                                       */
/* -------------------------------------------------------------------------- */

const NOTIFICATIONS: ReadonlyArray<readonly [NotificationCategory, string, string, Channel, string, string, string]> = [
  ['approvals', 'Refund APR-2026-0311 is waiting on you', 'You raised this request, so you cannot approve it. Reassign or ask Finance to decide.', 'in_app', 'ApprovalRequest', 'apr-0311', 'APR-2026-0311'],
  ['approvals', '25% discount request from Chidinma Eze', 'Over the 15% threshold — routes to Head of Growth.', 'in_app', 'ApprovalRequest', 'apr-0292', 'APR-2026-0292'],
  ['finance', '9 payments have been unmatched for more than 48 hours', 'Nothing is auto-assigned on a guess. A human has to resolve these.', 'in_app', 'Payment', 'pay-1235', 'PAY-1235'],
  ['finance', 'Sterling Bank milestone 2 invoice is due in 14 days', 'INV-2026-0932 · ₦19,830,000', 'email', 'Invoice', 'inv-0932', 'INV-2026-0932'],
  ['crm', '9 leads advanced and 2 were lost yesterday', 'Pipeline value moved by ₦1,340,000.', 'in_app', 'Lead', 'lead-0688', 'CIR-L-0688'],
  ['crm', 'Median first response is 4h 12m against a 2h target', 'Six leads went more than a day without a first touch.', 'in_app', 'Lead', 'lead-0701', 'CIR-L-0701'],
  ['academy', 'Chiamaka Okonkwo is eligible for a certificate', 'All five criteria met, including financial clearance.', 'in_app', 'Certificate', 'cert-0419', 'CIR-CERT-2026-0419'],
  ['academy', '37 submissions are awaiting grading', 'Median turnaround is 3.2 days.', 'in_app', 'Submission', 'sub-0006', 'SUB-0006'],
  ['automation', '11 items in the automation exception queue', 'Four are message delivery failures and can be retried together.', 'in_app', 'AutomationException', 'exc-0001', 'EXC-0001'],
  ['people', 'Two probation reviews are due this week', 'Chidinma Eze and one other.', 'in_app', 'Employee', 'emp-0002', 'EMP-0002'],
  ['people', 'Exit EXT-2026-0001 is blocked on commission reconciliation', 'A paid commission was later reversed; Finance cannot clear until it is settled.', 'in_app', 'ExitCase', 'ext-0001', 'EXT-2026-0001'],
  ['system', 'Reader RDR-LAG-02 has been offline for 3 hours', 'Buffered 14 tap events. They will sync on reconnect.', 'in_app', 'Reader', 'rdr-lag-02', 'RDR-LAG-02'],
  ['finance', 'Payout batch PAY-B-2026-018 is still in draft', 'Seven commissions are payable. Average Earned → Paid is 11.4 days against a 14-day target.', 'in_app', 'PayoutBatch', 'payb-018', 'PAY-B-2026-018'],
  ['approvals', 'Hire approval for a second Data tutor is 9 days old', 'DA-C13 opens on 5 October.', 'whatsapp', 'ApprovalRequest', 'apr-0296', 'APR-2026-0296'],
]

export const notifications: Notification[] = [
  ...NOTIFICATIONS.map(([category, title, body, channel, entityType, entityId, entityRef], i) => ({
    id: notificationId(`ntf-${pad(i + 1, 4)}`),
    userId: U.adebayo,
    category,
    title,
    body,
    channel,
    read: i > 6,
    readAt: i > 6 ? at(daysAgo(int(r, 0, 3)), int(r, 8, 18), 0) : null,
    snoozedUntil: i === 5 ? at(addDays(TODAY, 1), 9, 0) : null,
    relatedEntityType: entityType,
    relatedEntityId: entityId,
    relatedEntityRef: entityRef,
    actorUserId: 'system' as const,
    ...audit(at(daysAgo(i % 5), int(r, 7, 20), int(r, 0, 59)), U.adebayo),
  })),
  // A tail for the other users, so the inbox filter counts are not all one person.
  ...Array.from({ length: 46 }, (_, i) => {
    const category = pick(r, ['approvals', 'finance', 'crm', 'academy', 'people', 'automation', 'system'] as const)
    return {
      id: notificationId(`ntf-${pad(i + 15, 4)}`),
      userId: [U.fatima, U.chidinma, U.emeka, U.ifeoma, U.yetunde][i % 5],
      category,
      title: `${category === 'approvals' ? 'An approval' : category === 'finance' ? 'A payment' : 'A record'} needs your attention`,
      body: 'Opened from the daily digest.',
      channel: 'in_app' as const,
      read: i % 3 !== 0,
      readAt: i % 3 !== 0 ? at(daysAgo(int(r, 0, 6)), 10, 0) : null,
      snoozedUntil: null,
      relatedEntityType: null,
      relatedEntityId: null,
      relatedEntityRef: null,
      actorUserId: 'system' as const,
      ...audit(at(daysAgo(i % 7), int(r, 7, 20), 0), U.adebayo),
    }
  }),
]

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const AUTOMATION_COUNTS = {
  automations: automations.length,
  active: automations.filter((a) => a.status === 'active').length,
  paused: automations.filter((a) => a.status === 'paused').length,
  draft: automations.filter((a) => a.status === 'draft').length,
  runs7d: automationRuns.length,
  failed: automationRuns.filter((run) => run.status === 'failed').length,
  exceptionsOpen: automationExceptions.filter((e) => e.status === 'open').length,
  idempotencyCollisionsPrevented: automationRuns.filter((run) => run.status === 'skipped_duplicate').length,
  messages: messages.length,
  notifications: notifications.length,
} as const

void ngn
