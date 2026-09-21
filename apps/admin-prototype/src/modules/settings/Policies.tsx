/**
 * Policies — the configuration surface for everything the PRD says must never
 * be hard-coded.
 *
 * Every policy is a **version**, effective-dated. Changing a rule adds a
 * version and end-dates the previous one; it never rewrites what already
 * happened. A commission computed in March keeps March's rule, and an
 * attendance record from June keeps June's grace period.
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Lock, ScrollText } from 'lucide-react'

import { formatDate, formatNaira, formatNumber, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Card,
  CardBody,
  DataTable,
  Drawer,
  EmptyState,
  KeyValue,
  KeyValueList,
  SectionHeader,
  StatusBadge,
  Switch,
  type Column,
} from '@/ui'
import { policyVersionsCollection, useCollection } from '@/mocks'
import type { PolicyKind, PolicyVersion } from '@/mocks'

import {
  DashboardSkeleton,
  ErrorPanel,
  ModuleHeader,
  Screen,
  useModuleData,
  useUserName,
} from './parts'

const KIND_ORDER: PolicyKind[] = [
  'approval_threshold',
  'discount_threshold',
  'attendance',
  'certificate_default',
  'commission_payout',
  'fee_schedule',
  'leave_entitlement',
  'sla',
]

const KIND_LABEL: Record<PolicyKind, string> = {
  approval_threshold: 'Approval thresholds',
  discount_threshold: 'Discount thresholds',
  attendance: 'Attendance policy',
  certificate_default: 'Certificate eligibility defaults',
  commission_payout: 'Commission payout schedule',
  fee_schedule: 'Fee and price list',
  leave_entitlement: 'Leave entitlements',
  sla: 'SLA targets',
}

const KIND_NOTE: Record<PolicyKind, string> = {
  approval_threshold: 'Which amounts need which approver. Read by the approval router on every request.',
  discount_threshold: 'Discount band to approver. Provisional until the founder confirms the numbers.',
  attendance: 'Grace, states and the scope order. Financial consequence ships disabled.',
  certificate_default: 'The organisation-wide fallback. A course may set stricter rules, never looser.',
  commission_payout: 'How quickly a referrer is paid. A programme that pays late dies within one cohort.',
  fee_schedule: 'Course prices and fees. No price is typed into a component anywhere in the system.',
  leave_entitlement: 'Days by leave type and employment type. Accrual is pro rata for contract staff.',
  sla: 'First-response and resolution targets, against which every clock on every dashboard is measured.',
}

/** A readable rendering of a config value, without inventing a format. */
function renderValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return 'Not set'
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled'
  if (typeof value === 'number') {
    /* Money keys in the seed are kobo. Everything else is a plain count. */
    return /above|amount|minimum|cap|payout/i.test(key) ? formatNaira(value) : formatNumber(value)
  }
  if (Array.isArray(value)) return value.map((item) => renderValue(key, item)).join(' · ')
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${humanize(k)}: ${renderValue(k, v)}`)
      .join(', ')
  }
  return String(value)
}

interface DiffRow {
  key: string
  before: string
  after: string
  changed: boolean
}

function diff(current: PolicyVersion, previous: PolicyVersion | null): DiffRow[] {
  const keys = [...new Set([...Object.keys(current.config), ...Object.keys(previous?.config ?? {})])].sort()
  return keys.map((key) => {
    const after = renderValue(key, current.config[key])
    const before = previous ? renderValue(key, previous.config[key]) : 'Not set — first version'
    return { key, before, after, changed: before !== after }
  })
}

export default function Policies() {
  const policies = useCollection(policyVersionsCollection)
  const userName = useUserName()
  const state = useModuleData(policies, 'settings.policies')

  const [openId, setOpenId] = useState<string | null>(null)

  const byKind = useMemo(() => {
    const map = new Map<PolicyKind, PolicyVersion[]>()
    for (const policy of state.rows) {
      map.set(policy.kind, [...(map.get(policy.kind) ?? []), policy])
    }
    for (const [kind, list] of map) {
      map.set(kind, [...list].sort((a, b) => b.version - a.version))
    }
    return map
  }, [state.rows])

  const open = openId ? state.rows.find((p) => p.id === openId) ?? null : null
  const previous = open
    ? (byKind.get(open.kind) ?? []).find((p) => p.version === open.version - 1) ?? null
    : null

  /** The one policy the whole system is judged on. Locked, and visibly so. */
  const attendance = (byKind.get('attendance') ?? []).find((p) => p.status === 'active') ?? null
  const financialConsequence = Boolean(attendance?.config.financialConsequenceEnabled)

  const columns: Array<Column<PolicyVersion>> = [
    {
      key: 'version',
      header: 'Version',
      width: 104,
      accessor: (policy) => <span className="font-mono text-body-13">v{policy.version}</span>,
      sortValue: (policy) => policy.version,
      sortable: true,
    },
    {
      key: 'from',
      header: 'Effective from',
      width: 140,
      accessor: (policy) => formatDate(policy.effectiveFrom),
      sortValue: (policy) => policy.effectiveFrom,
      sortable: true,
    },
    {
      key: 'to',
      header: 'Effective to',
      width: 148,
      accessor: (policy) =>
        policy.effectiveTo ? (
          formatDate(policy.effectiveTo)
        ) : (
          <Badge tone="success" size="sm">
            In force
          </Badge>
        ),
      sortValue: (policy) => policy.effectiveTo ?? '9999-12-31',
      sortable: true,
    },
    {
      key: 'scope',
      header: 'Scope',
      width: 180,
      accessor: (policy) => {
        const entries = Object.entries(policy.scope)
        return entries.length === 0
          ? 'Whole organisation'
          : entries.map(([k, v]) => `${humanize(k)}: ${String(v)}`).join(' · ')
      },
      sortValue: (policy) => Object.keys(policy.scope).length,
      sortable: true,
    },
    {
      key: 'setBy',
      header: 'Set by',
      minWidth: 170,
      accessor: (policy) => userName(policy.setByUserId),
      sortValue: (policy) => userName(policy.setByUserId),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 128,
      cell: (policy) => <StatusBadge status={policy.status} />,
      sortValue: (policy) => policy.status,
      sortable: true,
    },
    {
      key: 'notes',
      header: 'Notes',
      minWidth: 360,
      accessor: (policy) => policy.notes,
      sortValue: (policy) => policy.notes,
    },
  ]

  const header = (
    <ModuleHeader
      title="Policies"
      description="Every threshold, grace period, band and fee in the system, as effective-dated data. Changing a rule adds a version — it never rewrites what already happened."
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Policies" onRetry={state.retry} />
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

  if (state.rows.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={ScrollText}
          title="No policy versions"
          message="Nothing will be calculated until a policy exists. Approvals will not route, discounts will not band, and attendance has no grace period to apply."
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      <Card className="mb-4">
        <SectionHeader
          as="h2"
          size="sm"
          title="Attendance — financial consequence"
          description="The engine exists and calculates. It ships switched off, and only a policy version can switch it on."
          className="mb-4"
        />
        <div className="flex flex-wrap items-center gap-4 rounded-xl bg-surface-sunken p-4">
          <Switch
            checked={financialConsequence}
            onChange={() => undefined}
            disabled
            label="Financial consequence"
            description={financialConsequence ? 'Enabled' : 'Disabled — no attendance breach produces a deduction'}
          />
          <Badge tone="neutral" size="md" icon={<Lock size={12} />}>
            Locked
          </Badge>
        </div>
        <Alert tone="warning" className="mt-4" title="Requires employment-law review before enabling">
          Two incidents in 2025 produced deductions from reader faults that had to be reversed by hand. An attendance breach
          notifies a manager and can open a performance record; it does not touch pay. Decision DEC-0009 in the{' '}
          <Link to="/meetings/decisions" className="underline">
            decision log
          </Link>{' '}
          records why.
        </Alert>
      </Card>

      <div className="space-y-4">
        {KIND_ORDER.map((kind) => {
          const list = byKind.get(kind) ?? []
          return (
            <Card key={kind} padding="none">
              <div className="border-b border-border px-4 py-3">
                <SectionHeader
                  as="h2"
                  size="sm"
                  title={KIND_LABEL[kind]}
                  description={KIND_NOTE[kind]}
                  count={list.length}
                  actions={
                    kind === 'approval_threshold' ? (
                      <Link to="/work/approval-routes" className="text-body-13 text-accent hover:underline">
                        Approval routes
                      </Link>
                    ) : undefined
                  }
                />
              </div>
              <CardBody padding="none">
                <DataTable
                  data={list}
                  columns={columns}
                  rowKey={(policy) => policy.id}
                  onRowClick={(policy) => setOpenId(policy.id)}
                  activeRowKey={open?.id}
                  density="compact"
                  bordered={false}
                  minWidth={1300}
                  defaultSort={{ key: 'version', direction: 'desc' }}
                  caption={`${KIND_LABEL[kind]} versions with effective range, scope, who set it and status`}
                  empty={
                    <EmptyState
                      size="sm"
                      title={`No ${KIND_LABEL[kind].toLowerCase()} configured`}
                      message="Until a version exists this rule has no value to read, so the behaviour it governs is undefined rather than defaulted."
                    />
                  }
                />
              </CardBody>
            </Card>
          )
        })}
      </div>

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open ? `${KIND_LABEL[open.kind]} · v${open.version}` : 'Policy version'}
        description={
          open
            ? `Read-only. Effective ${formatDate(open.effectiveFrom)}${open.effectiveTo ? ` to ${formatDate(open.effectiveTo)}` : ' — still in force'}.`
            : undefined
        }
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Set by">{userName(open.setByUserId)}</KeyValue>
              <KeyValue label="Effective from">{formatDate(open.effectiveFrom)}</KeyValue>
              <KeyValue label="Effective to">
                {open.effectiveTo ? formatDate(open.effectiveTo) : 'Still in force'}
              </KeyValue>
              <KeyValue label="Scope" hint="Most specific wins: organisation, branch, department, employment type, person">
                {Object.keys(open.scope).length === 0
                  ? 'Whole organisation'
                  : Object.entries(open.scope)
                      .map(([k, v]) => `${humanize(k)}: ${String(v)}`)
                      .join(' · ')}
              </KeyValue>
              <KeyValue label="Recorded">{formatDate(open.createdAt)}</KeyValue>
            </KeyValueList>

            <div>
              <h3 className="mb-2 text-heading-18">Notes</h3>
              <p className="text-body-14 text-text-secondary">{open.notes}</p>
            </div>

            <div>
              <h3 className="mb-3 text-heading-18">
                {previous ? `Diff against v${previous.version}` : 'The first version'}
              </h3>
              {!previous && (
                <Alert tone="info" className="mb-3" title="Nothing precedes this version">
                  There is no earlier version to compare against, so every value below is new rather than changed.
                </Alert>
              )}
              <ul className="divide-y divide-border">
                {diff(open, previous).map((row) => (
                  <li key={row.key} className="flex flex-wrap items-baseline gap-2 py-2 text-body-13">
                    <span className="min-w-[180px] font-mono text-text">{row.key}</span>
                    <span className={row.changed ? 'text-text-secondary line-through' : 'text-text-secondary'}>
                      {row.before}
                    </span>
                    <span aria-hidden="true" className="text-text-secondary">
                      &rarr;
                    </span>
                    <span className={row.changed ? 'text-text' : 'text-text-secondary'}>{row.after}</span>
                    {row.changed && (
                      <Badge tone="accent" size="sm">
                        Changed
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <Alert tone="info" title="This version is not editable">
              Records created while it was in force keep it. To change the rule, publish a new version with a later effective
              date — the old one end-dates itself and stays readable for ever.
            </Alert>
          </div>
        )}
      </Drawer>
    </Screen>
  )
}
