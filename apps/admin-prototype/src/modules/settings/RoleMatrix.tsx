/**
 * Role and permission matrix editor — the one Settings screen built to depth.
 *
 * Rows are `resource` keys grouped by module; columns are the seven actions;
 * every cell is a **scope selector**, not a checkbox, because `own · team ·
 * department · branch · organisation` is the model and a checkbox cannot say
 * which of them applies. The cells are tinted by breadth so an over-permissioned
 * role is visible before a single label is read — and every cell still carries
 * the scope word, so the colour is never the only carrier.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Archive,
  Info,
  Lock,
  MoreHorizontal,
  RotateCcw,
  Save,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatNumber, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  KeyValue,
  KeyValueList,
  Modal,
  Popover,
  PopoverItem,
  PopoverLabel,
  PopoverSeparator,
  SectionHeader,
  Select,
  Separator,
  type Column,
} from '@/ui'
import {
  CURRENT_USER_ID,
  admissionsCollection,
  approvalRequestsCollection,
  auditEventsCollection,
  automationsCollection,
  campaignsCollection,
  certificatesCollection,
  cohortsCollection,
  commissionRulesCollection,
  commissionsCollection,
  coursesCollection,
  employeesCollection,
  expensesCollection,
  generatedDocumentsCollection,
  invoicesCollection,
  leadsCollection,
  payoutBatchesCollection,
  payrollPeriodsCollection,
  paymentsCollection,
  peopleCollection,
  refundsCollection,
  rolesCollection,
  studentAttendanceCollection,
  submissionsCollection,
  tasksCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type { AuditEvent, PermissionAction, PermissionScope, Role } from '@/mocks'

import { DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, useModuleData, useUserName } from './parts'

/* -------------------------------------------------------------------------- */
/* The model                                                                  */
/* -------------------------------------------------------------------------- */

const ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'approve', 'assign', 'export', 'manage']

/** Ordered by breadth. The order is the heat map. */
const SCOPES: PermissionScope[] = ['none', 'own', 'team', 'department', 'branch', 'organisation']

const SCOPE_LABEL: Record<PermissionScope, string> = {
  none: 'No access',
  own: 'Own',
  team: 'Team',
  department: 'Department',
  branch: 'Branch',
  organisation: 'Organisation',
}

/** The short form the cell shows. `none` is a dash, per the spec. */
const SCOPE_SHORT: Record<PermissionScope, string> = {
  none: '—',
  own: 'Own',
  team: 'Team',
  department: 'Dept',
  branch: 'Branch',
  organisation: 'Org',
}

const SCOPE_RANK: Record<PermissionScope, number> = {
  none: 0,
  own: 1,
  team: 2,
  department: 3,
  branch: 4,
  organisation: 5,
}

/**
 * The breadth ramp. Each entry is a complete tinted triple — fill, ink and
 * line go together and are never mixed with a `*-text` ink.
 */
const SCOPE_TINT: Record<PermissionScope, { shell: string; ink: string }> = {
  none: { shell: 'bg-surface-sunken border-border', ink: 'text-text-secondary' },
  own: { shell: 'bg-success-fill border-success-line', ink: 'text-success-ink' },
  team: { shell: 'bg-info-fill border-info-line', ink: 'text-info-ink' },
  department: { shell: 'bg-accent-subtle border-accent-subtle', ink: 'text-accent' },
  branch: { shell: 'bg-warning-fill border-warning-line', ink: 'text-warning-ink' },
  organisation: { shell: 'bg-danger-fill border-danger-line', ink: 'text-danger-ink' },
}

const MODULE_LABEL: Record<string, string> = {
  crm: 'CRM and admissions',
  referral: 'Referral and commission',
  learn: 'Cirvee Learn',
  academy: 'Academy operations',
  finance: 'Finance',
  work: 'Work and approvals',
  people: 'People',
  payroll: 'Payroll',
  automation: 'Automation',
  engage: 'Engage',
  settings: 'Settings',
}

const RESOURCE_LABEL: Record<string, string> = {
  'crm.lead': 'Leads',
  'crm.admission': 'Admissions',
  'crm.person': 'People records',
  'referral.rule': 'Commission rules',
  'referral.commission': 'Commissions',
  'referral.payout': 'Payout batches',
  'learn.course': 'Courses',
  'learn.submission': 'Submissions',
  'learn.certificate': 'Certificates',
  'academy.cohort': 'Cohorts',
  'academy.attendance': 'Student attendance',
  'finance.invoice': 'Invoices',
  'finance.payment': 'Payments',
  'finance.refund': 'Refunds',
  'finance.expense': 'Expenses',
  'work.approval': 'Approval requests',
  'work.task': 'Tasks',
  'work.document': 'Generated documents',
  'people.employee': 'Employee records',
  'people.compensation': 'Compensation',
  'payroll.period': 'Payroll periods',
  'automation.workflow': 'Workflows',
  'engage.campaign': 'Campaigns',
  'settings.role': 'Roles and permissions',
}

type Draft = Record<string, Record<PermissionAction, PermissionScope>>

interface Change {
  resource: string
  action: PermissionAction
  before: PermissionScope
  after: PermissionScope
}

function cloneDraft(role: Role): Draft {
  const next: Draft = {}
  for (const [resource, actions] of Object.entries(role.permissions)) {
    next[resource] = { ...actions }
  }
  return next
}

function diffDraft(role: Role, draft: Draft): Change[] {
  const changes: Change[] = []
  for (const [resource, actions] of Object.entries(draft)) {
    for (const action of ACTIONS) {
      const before = role.permissions[resource]?.[action] ?? 'none'
      const after = actions[action]
      if (before !== after) changes.push({ resource, action, before, after })
    }
  }
  return changes
}

/* -------------------------------------------------------------------------- */
/* Record volumes — so the impact preview quotes a real number                */
/* -------------------------------------------------------------------------- */

interface Volume {
  count: number
  noun: string
}

function useResourceVolumes(): Record<string, Volume> {
  const leads = useCollection(leadsCollection)
  const admissions = useCollection(admissionsCollection)
  const people = useCollection(peopleCollection)
  const rules = useCollection(commissionRulesCollection)
  const commissions = useCollection(commissionsCollection)
  const payouts = useCollection(payoutBatchesCollection)
  const courses = useCollection(coursesCollection)
  const submissions = useCollection(submissionsCollection)
  const certificates = useCollection(certificatesCollection)
  const cohorts = useCollection(cohortsCollection)
  const attendance = useCollection(studentAttendanceCollection)
  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const refunds = useCollection(refundsCollection)
  const expenses = useCollection(expensesCollection)
  const approvals = useCollection(approvalRequestsCollection)
  const tasks = useCollection(tasksCollection)
  const documents = useCollection(generatedDocumentsCollection)
  const employees = useCollection(employeesCollection)
  const periods = useCollection(payrollPeriodsCollection)
  const automations = useCollection(automationsCollection)
  const campaigns = useCollection(campaignsCollection)
  const roles = useCollection(rolesCollection)

  return useMemo(
    () => ({
      'crm.lead': { count: leads.length, noun: 'leads' },
      'crm.admission': { count: admissions.length, noun: 'admissions' },
      'crm.person': { count: people.length, noun: 'people records' },
      'referral.rule': { count: rules.length, noun: 'commission rules' },
      'referral.commission': { count: commissions.length, noun: 'commissions' },
      'referral.payout': { count: payouts.length, noun: 'payout batches' },
      'learn.course': { count: courses.length, noun: 'courses' },
      'learn.submission': { count: submissions.length, noun: 'submissions' },
      'learn.certificate': { count: certificates.length, noun: 'certificates' },
      'academy.cohort': { count: cohorts.length, noun: 'cohorts' },
      'academy.attendance': { count: attendance.length, noun: 'attendance records' },
      'finance.invoice': { count: invoices.length, noun: 'invoices' },
      'finance.payment': { count: payments.length, noun: 'payments' },
      'finance.refund': { count: refunds.length, noun: 'refunds' },
      'finance.expense': { count: expenses.length, noun: 'expenses' },
      'work.approval': { count: approvals.length, noun: 'approval requests' },
      'work.task': { count: tasks.length, noun: 'tasks' },
      'work.document': { count: documents.length, noun: 'generated documents' },
      'people.employee': { count: employees.length, noun: 'employee records' },
      'people.compensation': {
        count: employees.reduce((acc, e) => acc + e.compensationVersions.length, 0),
        noun: 'compensation versions',
      },
      'payroll.period': { count: periods.length, noun: 'payroll periods' },
      'automation.workflow': { count: automations.length, noun: 'workflows' },
      'engage.campaign': { count: campaigns.length, noun: 'campaigns' },
      'settings.role': { count: roles.length, noun: 'roles' },
    }),
    [
      leads, admissions, people, rules, commissions, payouts, courses, submissions,
      certificates, cohorts, attendance, invoices, payments, refunds, expenses,
      approvals, tasks, documents, employees, periods, automations, campaigns, roles,
    ],
  )
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export default function RoleMatrix() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const roles = useCollection(rolesCollection)
  const users = useCollection(usersCollection)
  const userName = useUserName()
  const volumes = useResourceVolumes()
  const state = useModuleData(roles, 'settings.roles')

  const role = state.rows.find((r) => r.id === id) ?? null
  const readOnly = role?.name === 'Super Admin'

  const [draft, setDraft] = useState<Draft | null>(null)
  const [compareId, setCompareId] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [lastChange, setLastChange] = useState<Change | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [guardTarget, setGuardTarget] = useState<string | null>(null)
  const [testRoleId, setTestRoleId] = useState('')
  const [testResource, setTestResource] = useState('crm.lead')

  /* A new role means a fresh draft. Nothing carries across. */
  useEffect(() => {
    setDraft(role ? cloneDraft(role) : null)
    setLastChange(null)
    setCompareId('')
  }, [role?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const changes = useMemo(() => (role && draft ? diffDraft(role, draft) : []), [role, draft])
  const dirty = changes.length > 0

  /* The unsaved-changes guard, for the one exit the module does not own. */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const compareRole = roles.find((r) => r.id === compareId) ?? null
  const testRole = roles.find((r) => r.id === testRoleId) ?? null

  const resources = useMemo(() => (draft ? Object.keys(draft).sort() : []), [draft])

  const groups = useMemo(() => {
    const byModule = new Map<string, string[]>()
    for (const resource of resources) {
      const key = resource.split('.')[0]
      byModule.set(key, [...(byModule.get(key) ?? []), resource])
    }
    return [...byModule.entries()].map(([key, items]) => ({ key, items }))
  }, [resources])

  const setCell = useCallback(
    (resource: string, action: PermissionAction, scope: PermissionScope) => {
      setDraft((prev) => {
        if (!prev) return prev
        const before = prev[resource][action]
        if (before === scope) return prev
        setLastChange({ resource, action, before, after: scope })
        return { ...prev, [resource]: { ...prev[resource], [action]: scope } }
      })
    },
    [],
  )

  const setRow = (resource: string, scope: PermissionScope) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next = { ...prev[resource] }
      for (const action of ACTIONS) next[action] = scope
      return { ...prev, [resource]: next }
    })
    setLastChange(null)
  }

  const setColumn = (action: PermissionAction, scope: PermissionScope) => {
    setDraft((prev) => {
      if (!prev) return prev
      const next: Draft = {}
      for (const [resource, actions] of Object.entries(prev)) next[resource] = { ...actions, [action]: scope }
      return next
    })
    setLastChange(null)
  }

  const copyFrom = (sourceId: string) => {
    const source = roles.find((r) => r.id === sourceId)
    if (!source) return
    setDraft(cloneDraft(source))
    setLastChange(null)
    toast.success(`Copied every scope from ${source.name}. Nothing is saved until you review the diff.`)
  }

  const discard = () => {
    setDraft(role ? cloneDraft(role) : null)
    setLastChange(null)
  }

  const save = () => {
    if (!role || !draft) return
    const at = new Date().toISOString()
    rolesCollection.update(role.id, { permissions: draft, updatedAt: at, updatedBy: CURRENT_USER_ID })
    /* Every changed scope is an audit row. The Audit log screen shows them. */
    for (const change of changes) {
      auditEventsCollection.insert({
        id: `aud-role-${role.id}-${change.resource}-${change.action}-${Date.now()}` as AuditEvent['id'],
        at,
        actorUserId: CURRENT_USER_ID,
        actorName: userName(CURRENT_USER_ID),
        actorRole: 'Super Admin',
        action: 'role.permission.change',
        entityType: 'Role',
        entityId: role.id,
        entityRef: role.name,
        field: `${change.resource}.${change.action}`,
        before: change.before,
        after: change.after,
        source: 'ui',
        ip: '102.89.34.17',
      })
    }
    setSaveOpen(false)
    setLastChange(null)
    toast.success(`${formatNumber(changes.length)} permission changes saved to ${role.name}.`)
  }

  const duplicate = () => {
    if (!role || !draft) return
    const at = new Date().toISOString()
    const copy: Role = {
      ...role,
      id: `role-copy-${Date.now().toString(36)}` as Role['id'],
      name: `${role.name} (copy)`,
      description: `Duplicated from ${role.name}. Nobody holds it yet.`,
      type: 'custom',
      permissions: draft,
      userCount: 0,
      createdAt: at,
      createdBy: CURRENT_USER_ID,
      updatedAt: at,
      updatedBy: CURRENT_USER_ID,
    }
    rolesCollection.insert(copy)
    toast.success(`${copy.name} created as a custom role.`)
    navigate(`/settings/roles/${copy.id}`)
  }

  const archive = () => {
    if (!role) return
    rolesCollection.update(role.id, {
      archivedAt: new Date().toISOString(),
      archivedReason: 'Archived from the role editor. Nothing is deleted — the row stays visible as archived.',
    })
    setArchiveOpen(false)
    toast.success(`${role.name} archived. The row stays on the list.`)
  }

  const exportCsv = () => {
    if (!role || !draft) return
    const header = ['resource', ...ACTIONS].join(',')
    const body = resources.map((resource) => [resource, ...ACTIONS.map((a) => draft[resource][a])].join(','))
    const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${role.name.toLowerCase().replace(/\s+/g, '-')}-permissions.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Matrix exported as CSV.')
  }

  const switchRole = (nextId: string) => {
    if (nextId === id) return
    if (dirty) {
      setGuardTarget(nextId)
      return
    }
    navigate(`/settings/roles/${nextId}`)
  }

  const holders = (roleId: string) => users.filter((u) => u.roleIds.includes(roleId as Role['id'])).length

  /* ------------------------------------------------------------------ */

  const header = (
    <ModuleHeader
      title="Roles and permissions"
      description="Permissions are resource, action and scope. A checkbox cannot say whether someone sees their own leads or everybody's, so every cell here is a scope."
      actions={
        role && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="ghost" leftIcon={<Download size={16} />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Popover
              role="menu"
              content={
                <>
                  <PopoverLabel>Role actions</PopoverLabel>
                  <PopoverItem icon={<Copy size={16} />} onClick={duplicate}>
                    Duplicate this role
                  </PopoverItem>
                  <PopoverSeparator />
                  <PopoverItem
                    icon={<Archive size={16} />}
                    destructive
                    disabled={role.userCount > 0 || readOnly}
                    onClick={() => setArchiveOpen(true)}
                  >
                    {role.userCount > 0 ? `Cannot archive — ${formatNumber(role.userCount)} hold it` : 'Archive role'}
                  </PopoverItem>
                </>
              }
            >
              <Button size="sm" variant="ghost" iconOnly aria-label="More role actions">
                <MoreHorizontal size={16} />
              </Button>
            </Popover>
            <Button size="sm" variant="secondary" leftIcon={<RotateCcw size={16} />} disabled={!dirty} onClick={discard}>
              Discard
            </Button>
            <Button size="sm" leftIcon={<Save size={16} />} disabled={!dirty || readOnly} onClick={() => setSaveOpen(true)}>
              Save {dirty ? `${formatNumber(changes.length)} changes` : 'changes'}
            </Button>
          </div>
        )
      }
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="The role matrix" onRetry={state.retry} />
      </Screen>
    )
  }

  if (state.loading) {
    return (
      <Screen>
        {header}
        <DashboardSkeleton />
      </Screen>
    )
  }

  if (!role || !draft) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={ShieldCheck}
          title="That role no longer exists"
          message="It may have been archived. Every role that ever existed stays on the list, so it is still reachable from there."
          action={
            <Button size="sm" variant="secondary" onClick={() => navigate('/settings/roles')}>
              Back to all roles
            </Button>
          }
        />
      </Screen>
    )
  }

  const columns: Array<Column<string>> = [
    {
      key: 'resource',
      header: 'Resource',
      pinned: true,
      minWidth: 260,
      cell: (resource) => (
        <div className="flex items-center gap-2">
          <Popover
            role="menu"
            content={
              <>
                <PopoverLabel>Set every action on {resource}</PopoverLabel>
                {SCOPES.map((scope) => (
                  <PopoverItem key={scope} onClick={() => setRow(resource, scope)}>
                    {SCOPE_LABEL[scope]}
                  </PopoverItem>
                ))}
              </>
            }
          >
            <Button size="sm" variant="ghost" iconOnly disabled={readOnly} aria-label={`Bulk-set every action on ${resource}`}>
              <MoreHorizontal size={16} />
            </Button>
          </Popover>
          <div className="min-w-0">
            <div className="truncate text-body-13 text-text">{RESOURCE_LABEL[resource] ?? humanize(resource)}</div>
            <div className="truncate font-mono text-body-12 text-text-secondary">{resource}</div>
          </div>
          {role.name === 'Tutor' && resource.startsWith('finance.') && (
            <Badge tone="info" size="sm" icon={<Info size={12} />}>
              Deliberate default
            </Badge>
          )}
        </div>
      ),
    },
    ...ACTIONS.map<Column<string>>((action) => ({
      key: action,
      header: (
        <Popover
          role="menu"
          content={
            <>
              <PopoverLabel>Set {action} on every resource</PopoverLabel>
              {SCOPES.map((scope) => (
                <PopoverItem key={scope} onClick={() => setColumn(action, scope)}>
                  {SCOPE_LABEL[scope]}
                </PopoverItem>
              ))}
            </>
          }
        >
          <button
            type="button"
            disabled={readOnly}
            className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 capitalize text-text-label hover:text-text disabled:cursor-not-allowed"
          >
            {action}
            <ChevronDown size={12} aria-hidden="true" />
          </button>
        </Popover>
      ),
      width: 132,
      cell: (resource) => {
        const scope = draft[resource][action]
        const tint = SCOPE_TINT[scope]
        const compareScope = compareRole?.permissions[resource]?.[action]
        return (
          <div className="space-y-1">
            <Select
              selectSize="sm"
              aria-label={`${resource} ${action} scope`}
              value={scope}
              disabled={readOnly}
              options={SCOPES.map((s) => ({ value: s, label: SCOPE_SHORT[s] }))}
              onChange={(event) => setCell(resource, action, event.target.value as PermissionScope)}
              containerClassName={cn('px-2', tint.shell)}
              className={cn('text-label-11', tint.ink)}
            />
            {compareRole && (
              <div className="text-label-10 text-text-secondary">
                {compareScope === scope ? (
                  <span>Same as {compareRole.name.split(' ')[0]}</span>
                ) : (
                  <span className={SCOPE_TINT[compareScope ?? 'none'].ink}>
                    {compareRole.name.split(' ')[0]}: {SCOPE_SHORT[compareScope ?? 'none']}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      },
    })),
  ]

  const impact = lastChange ? volumes[lastChange.resource] : undefined
  const narrowing = lastChange ? SCOPE_RANK[lastChange.after] < SCOPE_RANK[lastChange.before] : false

  return (
    <Screen>
      {header}

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Left pane — the roles */}
        <nav aria-label="Roles" className="lg:sticky lg:top-6 lg:self-start">
          <Card padding="none">
            <div className="border-b border-border px-4 py-3">
              <p className="text-label-11 text-text-label">All roles</p>
              <p className="text-body-12 text-text-secondary">{formatNumber(roles.length)} defined</p>
            </div>
            <ul className="max-h-[70vh] overflow-y-auto py-1">
              {roles.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => switchRole(item.id)}
                    aria-current={item.id === role.id ? 'page' : undefined}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-body-13',
                      'hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-[-2px]',
                      item.id === role.id
                        ? 'border-l-2 border-accent bg-accent-wash text-text'
                        : 'border-l-2 border-transparent text-text-secondary',
                    )}
                  >
                    <span className="truncate">
                      {item.name}
                      {item.archivedAt && <span className="ml-1 text-body-12">· archived</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-body-12 text-text-secondary">
                      {formatNumber(holders(item.id))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </nav>

        {/* Right pane — the matrix */}
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-heading-18 text-text">{role.name}</h2>
                  <Badge tone={role.type === 'system' ? 'neutral' : 'accent'} size="sm">
                    {role.type === 'system' ? 'System role' : 'Custom role'}
                  </Badge>
                  {role.archivedAt && (
                    <Badge tone="warning" size="sm">
                      Archived
                    </Badge>
                  )}
                </div>
                <p className="mt-1 max-w-2xl text-body-13 text-text-secondary">{role.description}</p>
              </div>
              <KeyValueList columns={2} className="w-full max-w-md">
                <KeyValue label="Users holding it">
                  <span className="inline-flex items-center gap-1.5">
                    <Users size={14} aria-hidden="true" />
                    {formatNumber(holders(role.id))}
                  </span>
                </KeyValue>
                <KeyValue label="Resources in the matrix">{formatNumber(resources.length)}</KeyValue>
              </KeyValueList>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-end gap-4">
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-label-11 text-text-label">Compare with</span>
                <Select
                  selectSize="sm"
                  value={compareId}
                  placeholder="No comparison"
                  options={roles.filter((r) => r.id !== role.id).map((r) => ({ value: r.id, label: r.name }))}
                  onChange={(event) => setCompareId(event.target.value)}
                />
              </label>
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-label-11 text-text-label">Copy every scope from</span>
                <Select
                  selectSize="sm"
                  value=""
                  disabled={readOnly}
                  placeholder="Pick a role to copy"
                  options={roles.filter((r) => r.id !== role.id).map((r) => ({ value: r.id, label: r.name }))}
                  onChange={(event) => copyFrom(event.target.value)}
                />
              </label>

              <ul className="flex flex-wrap items-center gap-1.5" aria-label="Scope breadth legend">
                {SCOPES.map((scope) => (
                  <li
                    key={scope}
                    className={cn(
                      'inline-flex h-6 items-center rounded-full border px-2 text-label-10',
                      SCOPE_TINT[scope].shell,
                      SCOPE_TINT[scope].ink,
                    )}
                  >
                    {SCOPE_LABEL[scope]}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {readOnly && (
            <Alert tone="info" icon={Lock} title="Super Admin is read-only, and everything is at organisation scope">
              Someone has to be able to repair a locked-out system. Narrowing this role is how an organisation loses access to
              its own configuration, so the matrix below is shown but not editable.
            </Alert>
          )}

          <Alert tone="warning" icon={ShieldCheck} title="This matrix configures the server">
            Hiding a button is not security. Every scope here is evaluated where the data is read, not where it is drawn.
          </Alert>

          {dirty && (
            <Alert
              tone="warning"
              title={`${formatNumber(changes.length)} unsaved permission ${changes.length === 1 ? 'change' : 'changes'}`}
              action={
                <Button size="sm" variant="secondary" onClick={() => setSaveOpen(true)}>
                  Review the diff
                </Button>
              }
            >
              Nothing is written until you review the diff and confirm. Leaving this screen discards the changes.
            </Alert>
          )}

          {lastChange && impact && (
            <Alert
              tone={narrowing ? 'info' : 'warning'}
              title={`${narrowing ? 'Narrowing' : 'Widening'} ${lastChange.resource}.${lastChange.action} from ${SCOPE_LABEL[
                lastChange.before
              ].toLowerCase()} to ${SCOPE_LABEL[lastChange.after].toLowerCase()}`}
              onDismiss={() => setLastChange(null)}
            >
              {`Affects ${formatNumber(holders(role.id))} ${holders(role.id) === 1 ? 'user' : 'users'} holding ${role.name}. There are ${formatNumber(impact.count)} ${impact.noun} in the organisation; at ${SCOPE_LABEL[lastChange.after].toLowerCase()} scope a holder is evaluated against that subset only.`}
            </Alert>
          )}

          {groups.map((group) => {
            const isCollapsed = collapsed.includes(group.key)
            return (
              <Card key={group.key} padding="none">
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    aria-expanded={!isCollapsed}
                    onClick={() =>
                      setCollapsed((prev) =>
                        prev.includes(group.key) ? prev.filter((k) => k !== group.key) : [...prev, group.key],
                      )
                    }
                  >
                    {MODULE_LABEL[group.key] ?? humanize(group.key)}
                  </Button>
                  <span className="text-body-12 text-text-secondary">
                    {formatNumber(group.items.length)} {group.items.length === 1 ? 'resource' : 'resources'}
                  </span>
                </div>
                {!isCollapsed && (
                  <DataTable
                    data={group.items}
                    columns={columns}
                    rowKey={(resource) => resource}
                    density="compact"
                    bordered={false}
                    minWidth={1180}
                    caption={`${MODULE_LABEL[group.key] ?? group.key} permissions for ${role.name}`}
                    empty={
                      <EmptyState
                        size="sm"
                        title="No resources in this module"
                        message="A module with no resources cannot be permissioned. Add one in the resource registry."
                      />
                    }
                  />
                )}
              </Card>
            )
          })}

          {/* Test as */}
          <Card>
            <SectionHeader
              as="h3"
              size="sm"
              title="Test as"
              description="Pick a role and a resource and the matrix states what a holder can actually do, in words."
            />
            <div className="mt-4 flex flex-wrap items-end gap-4">
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-label-11 text-text-label">Role</span>
                <Select
                  selectSize="sm"
                  value={testRoleId}
                  placeholder="Pick a role"
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  onChange={(event) => setTestRoleId(event.target.value)}
                />
              </label>
              <label className="flex min-w-[240px] flex-col gap-1">
                <span className="text-label-11 text-text-label">Resource</span>
                <Select
                  selectSize="sm"
                  value={testResource}
                  options={resources.map((r) => ({ value: r, label: `${RESOURCE_LABEL[r] ?? r} · ${r}` }))}
                  onChange={(event) => setTestResource(event.target.value)}
                />
              </label>
            </div>
            <div className="mt-4 rounded-xl bg-surface-sunken p-4">
              {!testRole ? (
                <p className="text-body-13 text-text-secondary">Pick a role to see the plain-English reading.</p>
              ) : (
                <ul className="space-y-1.5 text-body-13 text-text">
                  {ACTIONS.map((action) => {
                    const scope = testRole.permissions[testResource]?.[action] ?? 'none'
                    const label = RESOURCE_LABEL[testResource]?.toLowerCase() ?? testResource
                    return (
                      <li key={action}>
                        {scope === 'none' ? (
                          <span className="text-text-secondary">
                            {testRole.name} cannot {action} {label}.
                          </span>
                        ) : scope === 'organisation' ? (
                          <span>
                            {testRole.name} can {action} every record in {label}, across the whole organisation.
                          </span>
                        ) : scope === 'own' ? (
                          <span>
                            {testRole.name} can {action} {label} where they are the owner. Not anybody else's.
                          </span>
                        ) : (
                          <span>
                            {testRole.name} can {action} {label} within their own {SCOPE_LABEL[scope].toLowerCase()}.
                          </span>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Card>

          <p className="text-body-13 text-text-secondary">
            Looking for who holds what?{' '}
            <Link to="/settings/users" className="text-accent hover:underline">
              Users
            </Link>{' '}
            lists every account with its roles and scope.
          </p>
        </div>
      </div>

      {/* Save diff */}
      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        size="lg"
        title={`Save ${formatNumber(changes.length)} permission ${changes.length === 1 ? 'change' : 'changes'}`}
        description={`Every line below is written to the audit log against ${role.name}, with the actor, the field and both values.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>
              Keep editing
            </Button>
            <Button onClick={save} disabled={!dirty}>
              Save and write to the audit log
            </Button>
          </>
        }
      >
        {changes.length === 0 ? (
          <EmptyState size="sm" title="Nothing has changed" message="Adjust a scope in the matrix and the diff appears here." />
        ) : (
          <ul className="divide-y divide-border font-mono text-body-13">
            {changes.map((change) => (
              <li key={`${change.resource}.${change.action}`} className="flex flex-wrap items-center gap-2 py-2">
                <span className="text-text">
                  {change.resource}.{change.action}
                </span>
                <span className="text-text-secondary">:</span>
                <span className={SCOPE_TINT[change.before].ink}>{change.before}</span>
                <span className="text-text-secondary">&rarr;</span>
                <span className={SCOPE_TINT[change.after].ink}>{change.after}</span>
                {SCOPE_RANK[change.after] > SCOPE_RANK[change.before] && (
                  <Badge tone="warning" size="sm">
                    Widens access
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* Unsaved-changes guard */}
      <ConfirmDialog
        open={guardTarget !== null}
        onClose={() => setGuardTarget(null)}
        onConfirm={() => {
          const target = guardTarget
          setGuardTarget(null)
          if (target) navigate(`/settings/roles/${target}`)
        }}
        destructive
        title="Discard unsaved permission changes?"
        confirmLabel="Discard and switch role"
        cancelLabel="Stay here"
        message={`${formatNumber(changes.length)} scope ${changes.length === 1 ? 'change has' : 'changes have'} not been saved. Switching role throws them away — nothing has been written to ${role.name}.`}
      />

      {/* Archive */}
      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={archive}
        destructive
        title={`Archive ${role.name}?`}
        confirmLabel="Archive the role"
        message="Archiving end-dates the role. It is not deleted: the row stays on the list marked archived, and every audit entry that names it keeps working."
      />
    </Screen>
  )
}
