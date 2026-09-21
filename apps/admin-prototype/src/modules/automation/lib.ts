import {
  automationExceptionsCollection,
  automationRunsCollection,
  automationsCollection,
  branchesCollection,
  cohortsCollection,
  messageTemplatesCollection,
  peopleCollection,
  unitsCollection,
  usersCollection,
} from '@/mocks'
import type {
  Automation,
  AutomationActionType,
  AutomationException,
  AutomationExceptionStatus,
  AutomationNode,
  AutomationRun,
  AutomationRunStatus,
  AutomationStatus,
  AutomationTriggerType,
  BranchId,
  ConditionGroup,
  PersonId,
  UnitId,
  UserId,
} from '@/mocks/types'
import type { BadgeTone } from '@/ui'

export interface TriggerMeta {
  label: string
  runsWhen: string
  category: 'Sales' | 'Money' | 'Academy' | 'People' | 'Physical' | 'Schedule'
}

export const TRIGGERS: Record<AutomationTriggerType, TriggerMeta> = {
  lead_created: {
    label: 'Lead created',
    runsWhen: 'Runs when a new lead record is created, from any source.',
    category: 'Sales',
  },
  lead_stage_changed: {
    label: 'Lead stage changed',
    runsWhen: 'Runs when a lead moves from one pipeline stage to another.',
    category: 'Sales',
  },
  deal_won: {
    label: 'Deal won',
    runsWhen: 'Runs when a corporate deal is marked won.',
    category: 'Sales',
  },
  offer_accepted: {
    label: 'Offer accepted',
    runsWhen: 'Runs when a candidate accepts an employment offer.',
    category: 'People',
  },
  payment_received: {
    label: 'Payment received',
    runsWhen: 'Runs when a payment is recorded and matched to an invoice.',
    category: 'Money',
  },
  tuition_fully_paid: {
    label: 'Tuition fully paid',
    runsWhen: "Runs when an invoice's balance reaches zero.",
    category: 'Money',
  },
  invoice_issued: {
    label: 'Invoice issued',
    runsWhen: 'Runs when an invoice leaves draft and is issued to a payer.',
    category: 'Money',
  },
  invoice_overdue: {
    label: 'Invoice overdue',
    runsWhen: 'Runs on the day an invoice passes its due date with a balance outstanding.',
    category: 'Money',
  },
  admission_created: {
    label: 'Admission created',
    runsWhen: 'Runs when an admission record is created against a cohort.',
    category: 'Sales',
  },
  discount_approved: {
    label: 'Discount approved',
    runsWhen: 'Runs when a discount request is approved by its route.',
    category: 'Money',
  },
  commission_earned: {
    label: 'Commission earned',
    runsWhen: 'Runs when a commission moves to the earned state.',
    category: 'Money',
  },
  certificate_issued: {
    label: 'Certificate issued',
    runsWhen: 'Runs when a certificate is issued against a completed enrolment.',
    category: 'Academy',
  },
  course_completed: {
    label: 'Course completed',
    runsWhen: 'Runs when an enrolment reaches 100% progress.',
    category: 'Academy',
  },
  student_absent: {
    label: 'Student absent',
    runsWhen: 'Runs when a student is marked absent for a class session.',
    category: 'Academy',
  },
  attendance_breach_detected: {
    label: 'Attendance breach detected',
    runsWhen:
      'Runs when an attendance policy threshold is crossed. Advisory by default — no financial consequence unless a policy enables one.',
    category: 'Academy',
  },
  card_tapped: {
    label: 'Card tapped',
    runsWhen: 'Runs when an NFC card is tapped on a reader.',
    category: 'Physical',
  },
  employee_exited: {
    label: 'Employee exited',
    runsWhen: "Runs on an employee's recorded exit date.",
    category: 'People',
  },
  birthday: {
    label: 'Birthday',
    runsWhen: "Runs at 08:00 on a person's date of birth.",
    category: 'People',
  },
  work_anniversary: {
    label: 'Work anniversary',
    runsWhen: "Runs at 08:00 on an employee's hire anniversary.",
    category: 'People',
  },
  outcome_recorded: {
    label: 'Outcome recorded',
    runsWhen: 'Runs when an employment or enterprise outcome is recorded for an alumnus.',
    category: 'Academy',
  },
  scheduled: {
    label: 'Scheduled',
    runsWhen: 'Runs on a fixed schedule rather than an event.',
    category: 'Schedule',
  },
}

export const TRIGGER_CATEGORIES: Array<TriggerMeta['category']> = [
  'Sales',
  'Money',
  'Academy',
  'People',
  'Physical',
  'Schedule',
]

export function triggerLabel(t: AutomationTriggerType): string {
  return TRIGGERS[t]?.label ?? t
}

export interface ActionMeta {
  label: string
  blurb: string
  module: string
  disabled?: boolean
}

export const ACTIONS: Record<AutomationActionType, ActionMeta> = {
  send_message: {
    label: 'Send message',
    blurb: 'Send a templated message on a channel to a resolved recipient.',
    module: 'Engage',
  },
  assign_owner: {
    label: 'Assign owner',
    blurb: 'Set the owner of the triggering record by routing rule or by name.',
    module: 'CRM',
  },
  create_task: {
    label: 'Create task',
    blurb: 'Open a task with a due offset and a priority.',
    module: 'Work',
  },
  calculate_commission: {
    label: 'Calculate commission',
    blurb:
      'Evaluate commission rules. Referrer, lead owner and closer are evaluated independently — one deal can produce three rows or none.',
    module: 'Referral',
  },
  change_status: {
    label: 'Change status',
    blurb: 'Move a record to a named status.',
    module: 'CRM',
  },
  generate_document: {
    label: 'Generate document',
    blurb: 'Render a document template and attach it to the record.',
    module: 'Work',
  },
  request_approval: {
    label: 'Request approval',
    blurb: 'Raise a request into the approval engine and wait on its route.',
    module: 'Work',
  },
  issue_card: {
    label: 'Issue card',
    blurb: 'Issue an NFC card of a given type at a branch.',
    module: 'Physical',
  },
  grant_lms_access: {
    label: 'Grant LMS access',
    blurb: 'Enrol the person into a cohort on Cirvee Learn.',
    module: 'Learn',
  },
  add_tag: { label: 'Add tag', blurb: 'Add a tag to the person record.', module: 'CRM' },
  update_field: { label: 'Update field', blurb: 'Write a value to a field on a record.', module: 'CRM' },
  webhook: {
    label: 'Webhook',
    blurb: 'Post the trigger payload to an external URL. Not executable in this prototype.',
    module: 'System',
    disabled: true,
  },
}

export function actionLabel(a: AutomationActionType): string {
  return ACTIONS[a]?.label ?? a
}

export const ACTION_ORDER: AutomationActionType[] = [
  'send_message',
  'assign_owner',
  'create_task',
  'calculate_commission',
  'change_status',
  'generate_document',
  'request_approval',
  'issue_card',
  'grant_lms_access',
  'add_tag',
  'update_field',
  'webhook',
]

export type NodeKind = AutomationNode['kind']

export const NODE_LABEL: Record<NodeKind, string> = {
  trigger: 'Trigger',
  condition: 'Condition',
  delay: 'Delay',
  branch: 'Branch',
  action: 'Action',
  stop: 'Stop condition',
}

export const NODE_STYLE: Record<NodeKind, { chip: string; rail: string; tone: BadgeTone }> = {
  trigger: { chip: 'bg-accent-subtle text-accent', rail: 'bg-accent', tone: 'accent' },
  condition: { chip: 'bg-warning-fill text-warning-ink', rail: 'bg-warning-500', tone: 'warning' },
  delay: { chip: 'bg-surface-sunken text-text-label', rail: 'bg-text-muted', tone: 'neutral' },
  branch: { chip: 'bg-info-fill text-info-ink', rail: 'bg-info-600', tone: 'info' },
  action: { chip: 'bg-success-fill text-success-ink', rail: 'bg-success-600', tone: 'success' },
  stop: { chip: 'bg-danger-fill text-danger-ink', rail: 'bg-danger-600', tone: 'danger' },
}

export const AUTOMATION_STATUS_LABEL: Record<AutomationStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  archived: 'Archived',
}

export const AUTOMATION_STATUS_TONE: Record<AutomationStatus, BadgeTone> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  archived: 'neutral',
}

export const RUN_STATUS_LABEL: Record<AutomationRunStatus, string> = {
  succeeded: 'Succeeded',
  failed: 'Failed',
  running: 'Running',
  waiting_delay: 'Waiting on delay',
  waiting_approval: 'Waiting on approval',
  stopped_by_condition: 'Stopped by stop condition',
  skipped_conditions_not_met: 'Skipped, conditions not met',
  skipped_duplicate: 'Skipped, duplicate',
}

export const RUN_STATUS_TONE: Record<AutomationRunStatus, BadgeTone> = {
  succeeded: 'success',
  failed: 'danger',
  running: 'info',
  waiting_delay: 'warning',
  waiting_approval: 'warning',
  stopped_by_condition: 'neutral',
  skipped_conditions_not_met: 'neutral',
  skipped_duplicate: 'info',
}

export const RUN_STATUS_ORDER: AutomationRunStatus[] = [
  'succeeded',
  'failed',
  'running',
  'waiting_delay',
  'waiting_approval',
  'stopped_by_condition',
  'skipped_conditions_not_met',
  'skipped_duplicate',
]

export const EXCEPTION_STATUS_LABEL: Record<AutomationExceptionStatus, string> = {
  open: 'Open',
  retrying: 'Retrying',
  resolved: 'Resolved',
  ignored: 'Ignored',
}

export const EXCEPTION_STATUS_TONE: Record<AutomationExceptionStatus, BadgeTone> = {
  open: 'danger',
  retrying: 'warning',
  resolved: 'success',
  ignored: 'neutral',
}

export function errorClassLabel(cls: string): string {
  const spaced = cls.replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

export type FieldType = 'text' | 'number' | 'money' | 'enum' | 'boolean' | 'date' | 'reference'

export interface FieldMeta {
  path: string
  label: string
  entity: string
  type: FieldType
  options?: Array<{ value: string; label: string }>
}

export const FIELDS: FieldMeta[] = [
  { path: 'lead.stage', label: 'Lead stage', entity: 'Lead', type: 'enum', options: [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'proposal', label: 'Proposal' },
    { value: 'enrolled', label: 'Enrolled' },
    { value: 'lost', label: 'Lost' },
  ] },
  { path: 'lead.course', label: 'Lead course of interest', entity: 'Lead', type: 'text' },
  { path: 'lead.source', label: 'Lead source', entity: 'Lead', type: 'text' },
  { path: 'lead.daysInStage', label: 'Days in stage', entity: 'Lead', type: 'number' },
  { path: 'lead.ownerUserId', label: 'Lead owner', entity: 'Lead', type: 'reference' },

  { path: 'person.branch', label: 'Person branch', entity: 'Person', type: 'reference' },
  { path: 'person.optedOut', label: 'Person has opted out', entity: 'Person', type: 'boolean' },
  { path: 'person.whatsapp', label: 'Person WhatsApp number', entity: 'Person', type: 'text' },
  { path: 'person.tags', label: 'Person tags', entity: 'Person', type: 'text' },

  { path: 'invoice.unit', label: 'Invoice business unit', entity: 'Invoice', type: 'enum', options: [
    { value: 'ACADEMY', label: 'Academy' },
    { value: 'TEENS', label: 'Cirvee Teens' },
    { value: 'CORPORATE', label: 'Corporate Training' },
    { value: 'DEXURB', label: 'Dexurb' },
    { value: 'AFRICA', label: 'Cirvee Africa' },
    { value: 'TCF', label: 'Tech Cirvee Fest' },
  ] },
  { path: 'invoice.balance', label: 'Invoice balance', entity: 'Invoice', type: 'money' },
  { path: 'invoice.total', label: 'Invoice total', entity: 'Invoice', type: 'money' },
  { path: 'invoice.daysOverdue', label: 'Days overdue', entity: 'Invoice', type: 'number' },
  { path: 'invoice.status', label: 'Invoice status', entity: 'Invoice', type: 'enum', options: [
    { value: 'draft', label: 'Draft' },
    { value: 'issued', label: 'Issued' },
    { value: 'partial', label: 'Partly paid' },
    { value: 'paid', label: 'Paid' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'void', label: 'Void' },
  ] },

  { path: 'admission.status', label: 'Admission status', entity: 'Admission', type: 'enum', options: [
    { value: 'applied', label: 'Applied' },
    { value: 'offered', label: 'Offered' },
    { value: 'enrolled', label: 'Enrolled' },
    { value: 'deferred', label: 'Deferred' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ] },
  { path: 'admission.referrerPersonId', label: 'Admission referrer', entity: 'Admission', type: 'reference' },
  { path: 'admission.cohortId', label: 'Admission cohort', entity: 'Admission', type: 'reference' },
  { path: 'admission.branchId', label: 'Admission branch', entity: 'Admission', type: 'reference' },

  { path: 'enrolment.unit', label: 'Enrolment business unit', entity: 'Enrolment', type: 'enum', options: [
    { value: 'ACADEMY', label: 'Academy' },
    { value: 'TEENS', label: 'Cirvee Teens' },
    { value: 'CORPORATE', label: 'Corporate Training' },
  ] },
  { path: 'enrolment.status', label: 'Enrolment status', entity: 'Enrolment', type: 'enum', options: [
    { value: 'active', label: 'Active' },
    { value: 'completed', label: 'Completed' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ] },
  { path: 'progress.percent', label: 'Course progress', entity: 'Progress', type: 'number' },

  { path: 'employee.role', label: 'Employee role', entity: 'Employee', type: 'reference' },
  { path: 'employee.department', label: 'Employee department', entity: 'Employee', type: 'reference' },

  { path: 'commission.amount', label: 'Commission amount', entity: 'Commission', type: 'money' },
]

export function fieldMeta(path: string): FieldMeta | undefined {
  return FIELDS.find((f) => f.path === path)
}

export function fieldLabel(path: string): string {
  return fieldMeta(path)?.label ?? path
}

export interface OperatorMeta {
  op: string
  label: string
  arity: 'one' | 'many' | 'two' | 'none'
}

const TEXT_OPS: OperatorMeta[] = [
  { op: 'is', label: 'is', arity: 'one' },
  { op: 'is_not', label: 'is not', arity: 'one' },
  { op: 'contains', label: 'contains', arity: 'one' },
  { op: 'in', label: 'is one of', arity: 'many' },
  { op: 'not_in', label: 'is not one of', arity: 'many' },
  { op: 'is_empty', label: 'is empty', arity: 'none' },
  { op: 'is_not_empty', label: 'is not empty', arity: 'none' },
]

const NUMBER_OPS: OperatorMeta[] = [
  { op: 'is', label: 'is', arity: 'one' },
  { op: 'gt', label: 'is greater than', arity: 'one' },
  { op: 'gte', label: 'is at least', arity: 'one' },
  { op: 'lt', label: 'is less than', arity: 'one' },
  { op: 'lte', label: 'is at most', arity: 'one' },
  { op: 'between', label: 'is between', arity: 'two' },
]

const ENUM_OPS: OperatorMeta[] = [
  { op: 'is', label: 'is', arity: 'one' },
  { op: 'is_not', label: 'is not', arity: 'one' },
  { op: 'in', label: 'is one of', arity: 'many' },
  { op: 'not_in', label: 'is not one of', arity: 'many' },
  { op: 'changed_to', label: 'changed to', arity: 'one' },
]

const BOOLEAN_OPS: OperatorMeta[] = [
  { op: 'is', label: 'is', arity: 'one' },
  { op: 'is_not', label: 'is not', arity: 'one' },
]

const REFERENCE_OPS: OperatorMeta[] = [
  { op: 'is', label: 'is', arity: 'one' },
  { op: 'is_not', label: 'is not', arity: 'one' },
  { op: 'is_empty', label: 'is empty', arity: 'none' },
  { op: 'is_not_empty', label: 'is not empty', arity: 'none' },
]

const DATE_OPS: OperatorMeta[] = [
  { op: 'is', label: 'is', arity: 'one' },
  { op: 'gt', label: 'is after', arity: 'one' },
  { op: 'lt', label: 'is before', arity: 'one' },
  { op: 'between', label: 'is between', arity: 'two' },
]

export function operatorsFor(type: FieldType | undefined): OperatorMeta[] {
  switch (type) {
    case 'number':
    case 'money':
      return NUMBER_OPS
    case 'enum':
      return ENUM_OPS
    case 'boolean':
      return BOOLEAN_OPS
    case 'reference':
      return REFERENCE_OPS
    case 'date':
      return DATE_OPS
    default:
      return TEXT_OPS
  }
}

export function operatorLabel(op: string, type?: FieldType): string {
  const all = [...TEXT_OPS, ...NUMBER_OPS, ...ENUM_OPS, ...BOOLEAN_OPS, ...REFERENCE_OPS, ...DATE_OPS]
  const scoped = operatorsFor(type).find((o) => o.op === op)
  return (scoped ?? all.find((o) => o.op === op))?.label ?? op.replace(/_/g, ' ')
}

export function operatorArity(op: string): OperatorMeta['arity'] {
  const all = [...TEXT_OPS, ...NUMBER_OPS, ...ENUM_OPS, ...BOOLEAN_OPS, ...REFERENCE_OPS, ...DATE_OPS]
  return all.find((o) => o.op === op)?.arity ?? 'one'
}

export type ConditionRule = { field: string; op: string; value: unknown }

export function isGroup(r: ConditionRule | ConditionGroup): r is ConditionGroup {
  return typeof r === 'object' && r !== null && 'operator' in r && 'rules' in r
}

export function valueText(value: unknown, meta?: FieldMeta): string {
  if (value === null || value === undefined || value === '') return 'nothing'
  if (Array.isArray(value)) return value.map((v) => valueText(v, meta)).join(', ')
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  const raw = String(value)
  const option = meta?.options?.find((o) => o.value === raw)
  return option ? option.label : raw
}

export function ruleText(rule: ConditionRule): string {
  const meta = fieldMeta(rule.field)
  const arity = operatorArity(rule.op)
  const head = `${meta?.label ?? rule.field} ${operatorLabel(rule.op, meta?.type)}`
  if (arity === 'none') return head
  return `${head} ${valueText(rule.value, meta)}`
}

export function groupText(group: ConditionGroup): string {
  if (!group.rules.length) return 'No conditions — every trigger passes'
  const joiner = group.operator === 'and' ? ' AND ' : ' OR '
  return group.rules
    .map((r) => (isGroup(r) ? `(${groupText(r)})` : ruleText(r as ConditionRule)))
    .join(joiner)
}

export function countRules(group: ConditionGroup): number {
  return group.rules.reduce<number>((n, r) => n + (isGroup(r) ? countRules(r) : 1), 0)
}

export function emptyGroup(operator: 'and' | 'or' = 'and'): ConditionGroup {
  return { operator, rules: [] }
}

export function templateName(id: unknown): string {
  if (typeof id !== 'string') return 'no template selected'
  return messageTemplatesCollection.find(id)?.name ?? id
}

export const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  in_app: 'In-app',
}

export const RECIPIENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'trigger.person', label: 'The person on the trigger' },
  { value: 'lead.owner', label: 'The lead owner' },
  { value: 'admission.referrer', label: 'The referrer' },
  { value: 'admission.closer', label: 'The closer' },
  { value: 'role.finance', label: 'Everyone with the Finance role' },
  { value: 'role.growth', label: 'Everyone with the Growth role' },
]

export function recipientLabel(value: unknown): string {
  const raw = typeof value === 'string' ? value : ''
  return RECIPIENT_OPTIONS.find((o) => o.value === raw)?.label ?? 'no recipient selected'
}

function param(node: Extract<AutomationNode, { kind: 'action' }>, key: string): unknown {
  return node.params[key]
}

export function actionSummary(node: Extract<AutomationNode, { kind: 'action' }>): string {
  switch (node.actionType) {
    case 'send_message': {
      const channel = CHANNEL_LABEL[String(param(node, 'channel') ?? '')] ?? 'no channel'
      return `Send the "${templateName(param(node, 'templateId'))}" ${channel} message to ${recipientLabel(
        param(node, 'recipient'),
      ).toLowerCase()}.`
    }
    case 'calculate_commission':
      return param(node, 'scope') === 'all_rules_in_force'
        ? 'Evaluate every commission rule in force — referrer, lead owner and closer are evaluated independently.'
        : 'Evaluate one named commission rule.'
    case 'grant_lms_access':
      return 'Grant Cirvee Learn access for the cohort on the admission.'
    case 'issue_card':
      return `Issue a ${String(param(node, 'holderType') ?? 'student')} NFC card at the branch on the admission.`
    case 'create_task':
      return `Create a task: "${String(param(node, 'title') ?? 'untitled')}", due in ${String(
        param(node, 'dueOffsetDays') ?? 1,
      )} day(s).`
    case 'assign_owner':
      return 'Assign an owner to the triggering record.'
    case 'change_status':
      return `Set ${String(param(node, 'entity') ?? 'the record')}.${String(param(node, 'field') ?? 'status')} to ${String(
        param(node, 'value') ?? '—',
      )}.`
    case 'generate_document':
      return 'Generate a document from a template and attach it to the record.'
    case 'request_approval':
      return 'Raise an approval request and wait for its route to decide.'
    case 'add_tag':
      return `Add the tag "${String(param(node, 'tag') ?? '—')}" to the person.`
    case 'update_field':
      return `Write ${String(param(node, 'value') ?? '—')} to ${String(param(node, 'field') ?? 'a field')}.`
    case 'webhook':
      return 'Post the trigger payload to an external URL. Disabled in this prototype.'
  }
}

export function delaySummary(node: Extract<AutomationNode, { kind: 'delay' }>): string {
  const hours = node.workingHoursOnly ? ', counting working hours only' : ''
  if ('amount' in node.wait) return `Wait ${node.wait.amount} ${node.wait.unit}${hours}.`
  if ('untilField' in node.wait) return `Wait until ${fieldLabel(node.wait.untilField)}${hours}.`
  return `Wait until ${groupText(node.wait.untilCondition)}, giving up after ${node.wait.giveUpAfterHours} hours${hours}.`
}

export function nodeTitle(node: AutomationNode): string {
  switch (node.kind) {
    case 'trigger':
      return triggerLabel(node.triggerType)
    case 'condition':
      return 'Condition'
    case 'delay':
      return 'Delay'
    case 'branch':
      return node.label
    case 'action':
      return actionLabel(node.actionType)
    case 'stop':
      return 'Stop condition'
  }
}

export function nodeSummary(node: AutomationNode): string {
  switch (node.kind) {
    case 'trigger':
      return node.summary || TRIGGERS[node.triggerType].runsWhen
    case 'condition':
      return groupText(node.group)
    case 'delay':
      return delaySummary(node)
    case 'branch':
      return node.lanes.map((l) => l.label).join(' · ')
    case 'action':
      return actionSummary(node)
    case 'stop':
      return `This automation stops for a person as soon as: ${groupText(node.condition)}.`
  }
}

export function laneChildIds(nodes: AutomationNode[]): Set<string> {
  const ids = new Set<string>()
  for (const n of nodes) {
    if (n.kind === 'branch') for (const lane of n.lanes) for (const id of lane.nodeIds) ids.add(id)
  }
  return ids
}

export function topLevelNodes(nodes: AutomationNode[]): AutomationNode[] {
  const nested = laneChildIds(nodes)
  return nodes.filter((n) => !nested.has(n.id))
}

export function findNode(nodes: AutomationNode[], id: string | null): AutomationNode | undefined {
  return id ? nodes.find((n) => n.id === id) : undefined
}

export function countKind(nodes: AutomationNode[], kind: NodeKind): number {
  return nodes.filter((n) => n.kind === kind).length
}

export function actionCount(nodes: AutomationNode[]): number {
  return countKind(nodes, 'action')
}

export function conditionCount(nodes: AutomationNode[]): number {
  return nodes.reduce((n, node) => n + (node.kind === 'condition' ? countRules(node.group) : 0), 0)
}

export function triggerOf(a: Automation): AutomationTriggerType {
  const first = a.nodes.find((n) => n.kind === 'trigger')
  return first && first.kind === 'trigger' ? first.triggerType : 'scheduled'
}

export function modulesFor(nodes: AutomationNode[]): string[] {
  const set = new Set<string>()
  for (const n of nodes) if (n.kind === 'action') set.add(ACTIONS[n.actionType].module)
  return [...set].sort()
}

export function nextNodeId(nodes: AutomationNode[]): string {
  let max = 0
  for (const n of nodes) {
    const m = /^n(\d+)/.exec(n.id)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return `n${max + 1}`
}

export interface Issue {
  id: string
  severity: 'error' | 'warning'
  message: string
  nodeId?: string
}

export function validate(name: string, nodes: AutomationNode[]): Issue[] {
  const issues: Issue[] = []
  if (!name.trim()) issues.push({ id: 'name', severity: 'error', message: 'Give the automation a name.' })

  const trigger = nodes.find((n) => n.kind === 'trigger')
  if (!trigger) issues.push({ id: 'trigger', severity: 'error', message: 'A trigger is required. Nothing runs without one.' })

  if (!nodes.some((n) => n.kind === 'action'))
    issues.push({ id: 'action', severity: 'error', message: 'Add at least one action. A trigger with no action does nothing.' })

  for (const n of nodes) {
    if (n.kind === 'condition' && n.group.rules.length === 0)
      issues.push({ id: `cond-${n.id}`, severity: 'warning', nodeId: n.id, message: 'A condition with no rows lets every trigger through.' })
    if (n.kind === 'branch')
      for (const lane of n.lanes)
        if (lane.nodeIds.length === 0)
          issues.push({
            id: `lane-${n.id}-${lane.label}`,
            severity: 'warning',
            nodeId: n.id,
            message: `Branch lane "${lane.label}" is empty — the automation simply carries on.`,
          })
    if (n.kind === 'action' && n.actionType === 'send_message' && !n.params.templateId)
      issues.push({ id: `tpl-${n.id}`, severity: 'error', nodeId: n.id, message: 'Send message needs a template.' })
    if (n.kind === 'action' && n.actionType === 'send_message' && !n.params.recipient)
      issues.push({ id: `rcp-${n.id}`, severity: 'error', nodeId: n.id, message: 'Send message needs a recipient.' })
  }

  const top = topLevelNodes(nodes)
  const stopAt = top.findIndex((n) => n.kind === 'stop')
  if (stopAt >= 0 && stopAt < top.length - 1)
    issues.push({
      id: 'unreachable',
      severity: 'warning',
      message: `${top.length - stopAt - 1} node(s) sit after the stop condition and can never be reached.`,
    })

  return issues
}

export const IDEMPOTENCY_FIELDS: Array<{ path: string; label: string; sample: string }> = [
  { path: 'person.id', label: 'Person', sample: 'per_0142' },
  { path: 'invoice.id', label: 'Invoice', sample: 'inv_0933' },
  { path: 'admission.id', label: 'Admission', sample: 'adm_0311' },
  { path: 'cohort.id', label: 'Cohort', sample: 'coh_0007' },
  { path: 'payment.id', label: 'Payment', sample: 'pay_1243' },
  { path: 'lead.id', label: 'Lead', sample: 'lead_0688' },
  { path: 'run.date', label: 'Run date', sample: '2026-09-20' },
]

export function idempotencyPreview(key: string, fields: string[]): string {
  const slug = key.trim() ? key.trim() : 'automation-key'
  if (!fields.length) return `${slug}:<no fields — every trigger would run again>`
  const parts = fields.map((f) => IDEMPOTENCY_FIELDS.find((i) => i.path === f)?.sample ?? f)
  return `${slug}:${parts.join(':')}`
}

export const ON_FAILURE_LABEL: Record<Automation['reliability']['onFailure'], string> = {
  retry_then_exception: 'Retry, then send to the exception queue',
  skip: 'Skip the action and carry on',
  stop_automation: 'Stop the automation for this subject',
}

export function retrySentence(r: Automation['reliability']): string {
  const attempts = `${r.retryAttempts} attempt${r.retryAttempts === 1 ? '' : 's'}`
  const backoff = r.retryBackoff === 'exponential' ? 'exponential backoff' : 'a fixed interval'
  return `${attempts} with ${backoff}, then: ${ON_FAILURE_LABEL[r.onFailure].toLowerCase()}.`
}

export function versionsOf(automationKey: string): Automation[] {
  return automationsCollection
    .where((a) => a.automationKey === automationKey)
    .sort((a, b) => b.version - a.version)
}

export function latestVersion(automationKey: string): Automation | undefined {
  return versionsOf(automationKey)[0]
}

export function automationForRun(run: AutomationRun): Automation | undefined {
  const byVersion = automationsCollection.where(
    (a) => a.automationKey === run.automationKey && a.version === run.automationVersion,
  )[0]
  return byVersion ?? automationsCollection.find(run.automationId)
}

export function versionDrift(run: AutomationRun): { current: number } | null {
  const current = latestVersion(run.automationKey)
  if (!current || current.version <= run.automationVersion) return null
  return { current: current.version }
}

export function automationName(id: string): string {
  return automationsCollection.find(id)?.name ?? 'Unknown automation'
}

export function runsFor(automationId: string): AutomationRun[] {
  return automationRunsCollection.where((r) => r.automationId === automationId)
}

export function openExceptionsFor(automationId: string): AutomationException[] {
  return automationExceptionsCollection.where((e) => e.automationId === automationId && e.status === 'open')
}

export function hasTrace(run: AutomationRun): boolean {
  return run.steps.length > 0
}

export function runDuration(run: AutomationRun): string {
  if (run.durationMs === null) return 'Still running'
  if (run.durationMs < 1000) return `${run.durationMs} ms`
  return `${(run.durationMs / 1000).toFixed(1)} s`
}

export function personName(id: PersonId | string | null | undefined): string {
  if (!id) return 'Unassigned'
  const p = peopleCollection.find(id)
  return p ? `${p.firstName} ${p.lastName}` : String(id)
}

export function userName(id: UserId | null | undefined): string {
  if (!id) return 'Unassigned'
  const u = usersCollection.find(id)
  return u ? personName(u.personId) : String(id)
}

export function unitName(id: UnitId | string | null | undefined): string {
  if (!id) return '—'
  return unitsCollection.find(String(id))?.name ?? String(id)
}

export function branchName(id: BranchId | string | null | undefined): string {
  if (!id) return '—'
  return branchesCollection.find(String(id))?.name ?? String(id)
}

export function cohortCode(id: string | null | undefined): string {
  if (!id) return '—'
  return cohortsCollection.find(id)?.code ?? String(id)
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

export function titleCaseFromKey(key: string): string {
  return key.replace(/[-_]/g, ' ')
}
