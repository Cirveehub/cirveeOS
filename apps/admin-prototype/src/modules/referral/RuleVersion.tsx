import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, History, Lock, Plus, SquarePen } from 'lucide-react'

import { auditEventsCollection, commissionsCollection, useCollection } from '@/mocks'
import type { Commission } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  KeyValue,
  KeyValueList,
  PageHeader,
} from '@/ui'
import type { Column } from '@/ui'
import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'

import {
  BASIS_LABEL,
  STATE_LABEL,
  commissionsForRule,
  courseTitle,
  describeRule,
  effectiveRange,
  findRule,
  personName,
  ruleCode,
  ruleSentence,
  draftFromRule,
  versionsOf,
} from './lib'
import { RuleStatusBadge, Screen, SimpleStateBadge, VersionBadge } from './parts'

const TABS = [
  { id: 'definition', label: 'Definition' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'versions', label: 'Versions' },
  { id: 'audit', label: 'Audit' },
]

export default function RuleVersion() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  useCollection(commissionsCollection)
  const audit = useCollection(auditEventsCollection)

  const rule = findRule(id)
  const tab = params.get('tab') ?? 'definition'

  if (!rule) {
    return (
      <Screen>
        <PageHeader
          breadcrumbs={[
            { label: 'Referral & commission', to: '/referral' },
            { label: 'Commission rules', to: '/referral/rules' },
            { label: 'Not found' },
          ]}
          title="Rule version not found"
        />
        <Card padding="none">
          <EmptyState
            variant="error"
            title="That rule version does not exist"
            message="It may have been a draft in a session that has since been reset. Rule versions are never deleted, so a missing one is a broken link rather than a removed record."
            action={
              <Button variant="secondary" onClick={() => navigate('/referral/rules')}>
                Back to commission rules
              </Button>
            }
          />
        </Card>
      </Screen>
    )
  }

  const rows = commissionsForRule(rule.id)
  const versions = versionsOf(rule.ruleKey)
  const auditRows = audit
    .filter((e) => e.entityType === 'CommissionRule' && (e.entityId === rule.id || e.entityRef === ruleCode(rule)))
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at))
  const definition = describeRule(rule)
  const reconciles = rows.reduce((acc, c) => acc + c.amount, 0)

  const columns: Array<Column<Commission>> = [
    { key: 'ref', header: 'Commission', accessor: (c) => c.ref, sortValue: (c) => c.ref },
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      accessor: (c) => personName(c.beneficiaryPersonId),
      sortValue: (c) => personName(c.beneficiaryPersonId),
    },
    {
      key: 'basisAmount',
      header: 'Basis amount',
      align: 'right',
      accessor: (c) => <span className="tabular-nums">{formatNaira(c.basisAmount)}</span>,
      sortValue: (c) => c.basisAmount,
    },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      accessor: (c) => (c.rateApplied === null ? 'Flat' : `${c.rateApplied}%`),
      sortValue: (c) => c.rateApplied ?? -1,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      accessor: (c) => <span className="tabular-nums font-medium">{formatNaira(c.amount)}</span>,
      sortValue: (c) => c.amount,
    },
    {
      key: 'state',
      header: 'State',
      cell: (c) => <SimpleStateBadge commission={c} />,
      sortValue: (c) => STATE_LABEL[c.state],
    },
    {
      key: 'earnedAt',
      header: 'Earned',
      accessor: (c) => (c.earnedAt ? formatDate(c.earnedAt) : '—'),
      sortValue: (c) => c.earnedAt ?? '',
    },
  ]

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referral & commission', to: '/referral' },
          { label: 'Commission rules', to: '/referral/rules' },
          { label: `${rule.name} v${rule.version}` },
        ]}
        title={rule.name}
        description={rule.description}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <VersionBadge version={rule.version} size="md" />
            <RuleStatusBadge status={rule.status} size="md" />
            <Badge tone="neutral" variant="outline" size="md">
              {ruleCode(rule)}
            </Badge>
            <span className="text-body-13 tabular-nums text-text-secondary">{effectiveRange(rule)}</span>
          </div>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<SquarePen size={16} />}
              onClick={() =>
                navigate(
                  rule.status === 'draft' && rule.commissionCount === 0
                    ? `/referral/rules/${rule.id}/edit?mode=edit`
                    : `/referral/rules?edit=${rule.id}`,
                )
              }
            >
              Edit
            </Button>
            <Button leftIcon={<Plus size={16} />} onClick={() => navigate(`/referral/rules/${rule.id}/edit?mode=version`)}>
              New version from this
            </Button>
          </>
        }
        tabs={TABS}
        activeTab={tab}
        onTabChange={(id) => {
          const next = new URLSearchParams(params)
          next.set('tab', id)
          setParams(next, { replace: true })
        }}
      />

      {rule.status === 'superseded' && (
        <Alert tone="info" icon={Lock} title="This version is closed" className="mb-5">
          It stopped producing commissions on {rule.effectiveTo ? formatDate(rule.effectiveTo) : 'its end date'}. The{' '}
          {formatNumber(rule.commissionCount)} commissions computed under it keep the amounts they were created with —
          a later version never rewrites them.
        </Alert>
      )}

      {tab === 'definition' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card padding="none">
            <CardHeader title="In plain English" description="Generated from the stored rule, not from a stored sentence." />
            <CardBody>
              <p className="text-body-15 text-text">{ruleSentence(draftFromRule(rule))}</p>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Value computed under it" />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Commissions" divided>
                  <span className="tabular-nums">{formatNumber(rule.commissionCount)}</span>
                </KeyValue>
                <KeyValue label="Total" divided>
                  <span className="tabular-nums">{formatNaira(rule.commissionTotal)}</span>
                </KeyValue>
                <KeyValue label="Ledger reconciles to" divided>
                  <span className={reconciles === rule.commissionTotal ? 'tabular-nums text-success-text' : 'tabular-nums text-danger-text'}>
                    {formatNaira(reconciles)}
                  </span>
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>

          <Card padding="none" className="lg:col-span-2">
            <CardHeader title="Stored definition" description="Every one of these is data. None of it lives in a component." />
            <CardBody>
              <KeyValueList columns={2}>
                {Object.entries(definition).map(([field, value]) => (
                  <KeyValue key={field} label={field} divided>
                    {value}
                  </KeyValue>
                ))}
                {rule.calculation.kind === 'course_specific' && (
                  <KeyValue label="Per-course rates" divided>
                    {rule.calculation.rates.map((r) => `${courseTitle(r.courseId)} → ${r.rate}%`).join(' · ')}
                  </KeyValue>
                )}
                <KeyValue label="Basis" divided>
                  {BASIS_LABEL[rule.basis]}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'commissions' && (
        <Card padding="none">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(c) => c.id}
            density="compact"
            stickyHeader
            caption={`Commissions computed under ${rule.name} v${rule.version}`}
            defaultSort={{ key: 'amount', direction: 'desc' }}
            onRowClick={(c) => navigate(`/referral/commissions?drawer=${c.id}`)}
            empty={
              <EmptyState
                title="Nothing has been computed under this version"
                message={
                  rule.status === 'draft'
                    ? 'It is still a draft. Drafts never calculate.'
                    : 'No admission has matched it yet. Check the unit scope and the role on the deal.'
                }
              />
            }
          />
        </Card>
      )}

      {tab === 'versions' && (
        <Card padding="none">
          <CardHeader title="Every version of this rule key" description="Ranges never overlap. Nothing is deleted." />
          <CardBody>
            <ol className="flex flex-col gap-3">
              {versions.map((version) => (
                <li key={version.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/referral/rules/${version.id}`)}
                    className={`flex w-full flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors hover:bg-surface-hover ${
                      version.id === rule.id ? 'border-accent bg-accent-wash' : 'border-border'
                    }`}
                  >
                    <VersionBadge version={version.version} size="md" />
                    <RuleStatusBadge status={version.status} size="md" />
                    <span className="text-body-13 tabular-nums text-text-secondary">{effectiveRange(version)}</span>
                    <span className="ml-auto text-body-13 tabular-nums text-text-secondary">
                      {formatNumber(version.commissionCount)} commissions · {formatNaira(version.commissionTotal)}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      )}

      {tab === 'audit' && (
        <Card padding="none">
          <CardHeader
            title="Audit"
            description="Immutable. Actor, timestamp, field, before and after. Separate from any activity feed."
          />
          <CardBody padding="none">
            {auditRows.length === 0 ? (
              <EmptyState
                icon={History}
                title="No audit entries for this version yet"
                message="Version creations, activations and end-dates are recorded here as they happen in this session."
              />
            ) : (
              <ul className="divide-y divide-border">
                {auditRows.map((event) => (
                  <li key={event.id} className="px-6 py-3 font-mono text-body-12 text-text-secondary">
                    <span className="text-text">{formatDateTime(event.at)}</span>
                    <span className="px-2">·</span>
                    {event.actorName} ({event.actorRole})
                    <span className="px-2">·</span>
                    <span className="text-text">{event.action}</span>
                    <span className="px-2">·</span>
                    {event.entityRef}
                    {event.field && (
                      <>
                        <span className="px-2">·</span>
                        {event.field}: <span className="text-danger-text">{event.before ?? '—'}</span>
                        <span aria-hidden="true" className="px-1.5">
                          →
                        </span>
                        <span className="text-success-text">{event.after ?? '—'}</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <div className="mt-6">
        <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/referral/rules')}>
          Back to commission rules
        </Button>
      </div>
    </Screen>
  )
}
