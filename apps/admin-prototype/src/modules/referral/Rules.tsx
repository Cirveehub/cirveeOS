/**
 * §3.4 — Commission rules.
 *
 * Two things this screen has to prove, both in about two seconds of demo:
 *
 *  1. Set **in force on** to a past date and the list changes. Alumni referral
 *     v1 is what was paying in March, not v3.
 *  2. **Edit** on a rule with commissions against it refuses to mutate and
 *     offers a new version instead, quoting the exact number of commissions it
 *     would otherwise have rewritten.
 */

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, Copy, FileWarning, History, MoreHorizontal, Plus, Scale, SquarePen } from 'lucide-react'

import {
  TODAY,
  commissionRulesCollection,
  commissionsCollection,
  rulesInForceOn,
  useCollection,
} from '@/mocks'
import type { CommissionRule } from '@/mocks/types'
import {
  Alert,
  Button,
  Card,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Popover,
  PopoverItem,
  SectionHeader,
  SkeletonTable,
  Separator,
} from '@/ui'
import type { Column, FilterValues } from '@/ui'
import { formatDate, formatNaira, formatNumber } from '@/lib/format'

import {
  BENEFICIARY_LABEL,
  BENEFICIARY_TYPES,
  BASIS_LABEL,
  ROLE_LABEL,
  ROLE_ON_DEAL,
  RULE_STATUS_LABEL,
  courseTitle,
  dayBefore,
  diffRules,
  effectiveRange,
  ruleCalculationSentence,
  ruleCode,
  unitName,
  userName,
  versionsOf,
} from './lib'
import { LoadFailed, ModulePage, RoleBadge, RuleStatusBadge, Screen, VersionBadge, useScreenState } from './parts'

const STATUS_ORDER: CommissionRule['status'][] = ['active', 'scheduled', 'superseded', 'draft']

export default function Rules() {
  const rules = useCollection(commissionRulesCollection)
  useCollection(commissionsCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:rules')

  const [editing, setEditing] = useState<CommissionRule | null>(null)
  const [newVersionFrom, setNewVersionFrom] = useState(TODAY)
  const [endDating, setEndDating] = useState<CommissionRule | null>(null)
  const [endDate, setEndDate] = useState(TODAY)
  const [historyKey, setHistoryKey] = useState<string | null>(null)

  /* `?edit=<id>` opens the refusal dialog directly — the rule version page
     links here rather than duplicating the dialog. */
  const editRequest = params.get('edit')
  useEffect(() => {
    if (!editRequest) return
    const rule = commissionRulesCollection.find(editRequest)
    if (rule) {
      setNewVersionFrom(TODAY)
      setEditing(rule)
    }
  }, [editRequest])

  const highlight = params.get('highlight')
  const [flash, setFlash] = useState<string | null>(highlight)
  useEffect(() => {
    if (!highlight) return
    setFlash(highlight)
    const timer = window.setTimeout(() => setFlash(null), 2000)
    return () => window.clearTimeout(timer)
  }, [highlight])

  const values: FilterValues = {
    beneficiaryType: params.get('beneficiaryType') ?? undefined,
    roleOnDeal: params.get('roleOnDeal') ?? undefined,
    status: params.get('status') ?? undefined,
    unit: params.get('unit') ?? undefined,
  }
  const inForceOn = params.get('inForceOn') ?? ''
  const search = params.get('q') ?? ''

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('highlight')
    setParams(next, { replace: true })
  }

  const source = forcedEmpty ? [] : rules
  const inForceIds = useMemo(
    () => (inForceOn ? new Set(rulesInForceOn(inForceOn).map((r) => r.id)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inForceOn, rules],
  )

  const filtered = source.filter((rule) => {
    if (inForceIds && !inForceIds.has(rule.id)) return false
    if (values.beneficiaryType && rule.beneficiaryType !== values.beneficiaryType) return false
    if (values.roleOnDeal && rule.roleOnDeal !== values.roleOnDeal) return false
    if (values.status && rule.status !== values.status) return false
    if (values.unit && !rule.unitIds.includes(values.unit as CommissionRule['unitIds'][number])) return false
    if (search) {
      const haystack = `${rule.name} ${rule.ruleKey} ${ruleCode(rule)} ${rule.description}`.toLowerCase()
      if (!haystack.includes(search.toLowerCase())) return false
    }
    return true
  })

  const filtersActive =
    Boolean(inForceOn) || Boolean(search) || Object.values(values).some((v) => v !== undefined)

  const units = [...new Set(rules.flatMap((r) => r.unitIds))]

  const columns: Array<Column<CommissionRule>> = [
    {
      key: 'name',
      header: 'Rule',
      pinned: true,
      minWidth: 190,
      cell: (rule) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium text-text">{rule.name}</span>
            <VersionBadge version={rule.version} />
          </span>
          <span className="text-body-12 text-text-muted">{ruleCode(rule)}</span>
        </div>
      ),
      sortValue: (rule) => `${rule.name} ${String(rule.version).padStart(3, '0')}`,
    },
    {
      key: 'beneficiaryType',
      header: 'Beneficiary',
      accessor: (rule) => BENEFICIARY_LABEL[rule.beneficiaryType],
      sortValue: (rule) => BENEFICIARY_LABEL[rule.beneficiaryType],
    },
    {
      key: 'roleOnDeal',
      header: 'Role on deal',
      cell: (rule) => <RoleBadge role={rule.roleOnDeal} />,
      sortValue: (rule) => ROLE_LABEL[rule.roleOnDeal],
    },
    {
      key: 'appliesTo',
      header: 'Applies to',
      minWidth: 140,
      accessor: (rule) => appliesTo(rule),
      sortValue: (rule) => appliesTo(rule),
    },
    {
      key: 'calculation',
      header: 'Calculation',
      minWidth: 300,
      cell: (rule) => <span className="text-text-secondary">{ruleCalculationSentence(rule)}</span>,
      sortValue: (rule) => ruleCalculationSentence(rule),
    },
    {
      key: 'basis',
      header: 'Basis',
      accessor: (rule) => BASIS_LABEL[rule.basis],
      sortValue: (rule) => BASIS_LABEL[rule.basis],
    },
    {
      key: 'eligibility',
      header: 'Eligibility',
      minWidth: 170,
      cell: (rule) => <span className="text-text-secondary">{eligibilityText(rule)}</span>,
      sortValue: (rule) => eligibilityText(rule),
    },
    {
      key: 'effectiveFrom',
      header: 'Effective from',
      accessor: (rule) => <span className="tabular-nums">{formatDate(rule.effectiveFrom)}</span>,
      sortValue: (rule) => rule.effectiveFrom,
    },
    {
      key: 'effectiveTo',
      header: 'Effective to',
      cell: (rule) =>
        rule.effectiveTo ? (
          <span className="tabular-nums">{formatDate(rule.effectiveTo)}</span>
        ) : (
          <span className="text-text-secondary">Open</span>
        ),
      sortValue: (rule) => rule.effectiveTo ?? '9999-12-31',
    },
    {
      key: 'commissionCount',
      header: 'Commissions',
      align: 'right',
      accessor: (rule) => <span className="tabular-nums">{formatNumber(rule.commissionCount)}</span>,
      sortValue: (rule) => rule.commissionCount,
    },
    {
      key: 'commissionTotal',
      header: 'Total value',
      align: 'right',
      accessor: (rule) => <span className="tabular-nums">{formatNaira(rule.commissionTotal)}</span>,
      sortValue: (rule) => rule.commissionTotal,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (rule) => <RuleStatusBadge status={rule.status} />,
      sortValue: (rule) => STATUS_ORDER.indexOf(rule.status),
    },
    {
      key: 'createdBy',
      header: 'Created by',
      accessor: (rule) => userName(rule.createdBy),
      sortValue: (rule) => userName(rule.createdBy),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: 48,
      cell: (rule) => (
        <Popover
          role="menu"
          content={
            <>
              <PopoverItem
                icon={<SquarePen size={16} />}
                onClick={() => {
                  if (rule.status === 'draft' && rule.commissionCount === 0) {
                    navigate(`/referral/rules/${rule.id}/edit?mode=edit`)
                  } else {
                    setNewVersionFrom(TODAY)
                    setEditing(rule)
                  }
                }}
              >
                Edit
              </PopoverItem>
              <PopoverItem icon={<History size={16} />} onClick={() => setHistoryKey(rule.ruleKey)}>
                Version history
              </PopoverItem>
              <PopoverItem
                icon={<Copy size={16} />}
                onClick={() => navigate(`/referral/rules/${rule.id}/edit?mode=duplicate`)}
              >
                Duplicate
              </PopoverItem>
              <PopoverItem
                icon={<CalendarClock size={16} />}
                disabled={rule.effectiveTo !== null}
                onClick={() => {
                  setEndDate(TODAY)
                  setEndDating(rule)
                }}
              >
                End-date
              </PopoverItem>
            </>
          }
        >
          <Button variant="ghost" size="sm" iconOnly aria-label={`Actions for ${rule.name} v${rule.version}`}>
            <MoreHorizontal size={16} />
          </Button>
        </Popover>
      ),
    },
  ]

  const grouped = STATUS_ORDER.map((status) => ({
    status,
    rows: filtered.filter((r) => r.status === status),
  })).filter((group) => group.rows.length > 0)

  const historyVersions = historyKey ? versionsOf(historyKey) : []

  return (
    <Screen>
      <ModulePage
        tab="rules"
        title="Commission rules"
        description="Effective-dated configuration. A version is never edited once money has been computed under it — a new version is created and the old one is end-dated."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/referral/rules/new')}>
            New rule
          </Button>
        }
      />

      {errored && <LoadFailed what="Commission rules" onRetry={retry} />}

      {!errored && (
        <>
          <FilterBar
            search={search}
            onSearchChange={(value) => setParam('q', value || undefined)}
            searchPlaceholder="Search rules by name or key"
            filters={[
              {
                key: 'status',
                label: 'Status',
                options: STATUS_ORDER.map((s) => ({ value: s, label: RULE_STATUS_LABEL[s] })),
              },
              {
                key: 'roleOnDeal',
                label: 'Role on deal',
                options: ROLE_ON_DEAL.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
              },
              {
                key: 'beneficiaryType',
                label: 'Beneficiary',
                options: BENEFICIARY_TYPES.map((t) => ({ value: t, label: BENEFICIARY_LABEL[t] })),
              },
              {
                key: 'unit',
                label: 'Unit',
                options: units.map((u) => ({ value: u, label: unitName(u) })),
              },
            ]}
            values={values}
            onFilterChange={setParam}
            onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
          >
            <Field label="In force on" layout="inline" className="items-center">
              <Input
                type="date"
                inputSize="sm"
                value={inForceOn}
                containerClassName="w-[170px]"
                onChange={(e) => setParam('inForceOn', e.target.value || undefined)}
              />
            </Field>
          </FilterBar>

          {inForceOn && (
            <Alert tone="info" icon={Scale} title={`Showing the rule version in force on ${formatDate(inForceOn)}`} className="mb-5">
              One version per rule key — the one whose effective range contains that date. Drafts are excluded, because a
              draft never calculates anything. Clear the date to see every version.
            </Alert>
          )}

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={8} columns={8} />
            </Card>
          ) : filtered.length === 0 ? (
            <Card padding="none">
              {rules.length === 0 || forcedEmpty ? (
                <EmptyState
                  icon={FileWarning}
                  variant="error"
                  title="No commission rules yet. Nothing will be calculated until one exists."
                  message="Every commission in the system is produced by a rule version. With none configured, referrals are tracked and nobody is ever paid."
                  action={
                    <Button leftIcon={<Plus size={16} />} onClick={() => navigate('/referral/rules/new')}>
                      Create the first rule
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  variant="search"
                  title="No rules match these filters."
                  message={
                    inForceOn
                      ? `No rule version was in force on ${formatDate(inForceOn)} under the other filters you have set.`
                      : 'Widen the filters, or clear them to see every version of every rule.'
                  }
                  action={
                    <Button variant="secondary" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
                      Clear filters
                    </Button>
                  }
                />
              )}
            </Card>
          ) : (
            <div className="flex flex-col gap-7">
              {grouped.map((group) => (
                <section key={group.status}>
                  <SectionHeader
                    title={RULE_STATUS_LABEL[group.status]}
                    count={group.rows.length}
                    size="sm"
                    description={STATUS_DESCRIPTION[group.status]}
                  />
                  <Card padding="none" className="mt-3">
                    <DataTable
                      data={group.rows}
                      columns={columns}
                      rowKey={(rule) => rule.id}
                      density="compact"
                      stickyHeader
                      caption={`${RULE_STATUS_LABEL[group.status]} commission rule versions`}
                      defaultSort={{ key: 'effectiveFrom', direction: 'desc' }}
                      onRowClick={(rule) => navigate(`/referral/rules/${rule.id}`)}
                      rowClassName={(rule) => (flash === rule.id ? 'bg-success-fill' : undefined)}
                    />
                  </Card>
                </section>
              ))}
              {filtersActive && (
                <p className="text-body-13 text-text-secondary">
                  Showing {formatNumber(filtered.length)} of {formatNumber(rules.length)} rule versions. Nothing is
                  hidden permanently — superseded versions stay in the list forever.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* ---- Edit refuses to mutate ---- */}
      <ConfirmDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        onConfirm={() => {
          if (!editing) return
          navigate(`/referral/rules/${editing.id}/edit?mode=version&from=${newVersionFrom}`)
          setEditing(null)
        }}
        title={editing ? `${ruleCode(editing)} v${editing.version} cannot be edited in place` : ''}
        confirmLabel={editing ? `Create v${editing.version + 1}` : 'Create new version'}
        icon={History}
        size="md"
      >
        {editing && (
          <div className="flex flex-col gap-4 text-body-14 text-text-secondary">
            <p>
              <strong className="text-text">
                {ruleCode(editing)} v{editing.version} has {formatNumber(editing.commissionCount)} commissions computed
                under it
              </strong>
              , worth {formatNaira(editing.commissionTotal)}. Editing creates v{editing.version + 1} effective from a
              date you choose. <strong className="text-text">Existing commissions are not recalculated.</strong>
            </p>
            <Field
              label="New version effective from"
              required
              hint={`v${editing.version} will be end-dated ${formatDate(dayBefore(newVersionFrom))} when you activate v${editing.version + 1}.`}
            >
              <Input type="date" value={newVersionFrom} onChange={(e) => setNewVersionFrom(e.target.value)} />
            </Field>
          </div>
        )}
      </ConfirmDialog>

      {/* ---- End-date, never delete ---- */}
      <ConfirmDialog
        open={endDating !== null}
        onClose={() => setEndDating(null)}
        onConfirm={() => {
          if (!endDating) return
          commissionRulesCollection.update(endDating.id, {
            effectiveTo: endDate,
            status: endDate < TODAY ? 'superseded' : endDating.status,
            updatedAt: `${TODAY}T09:00:00+01:00`,
          })
          setEndDating(null)
        }}
        title={endDating ? `End-date ${endDating.name} v${endDating.version}?` : ''}
        confirmLabel="End-date this version"
        icon={CalendarClock}
      >
        {endDating && (
          <div className="flex flex-col gap-4 text-body-14 text-text-secondary">
            <p>
              After {formatDate(endDate)} this version stops producing commissions. It is not deleted: the row stays in
              the list, the {formatNumber(endDating.commissionCount)} commissions computed under it keep their amounts,
              and it can still be opened.
            </p>
            <p className="text-warning-text">
              If no later version covers the dates after {formatDate(endDate)}, nothing will be calculated for this rule
              key at all.
            </p>
            <Field label="Effective to" required>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        )}
      </ConfirmDialog>

      {/* ---- Version history ---- */}
      <Drawer
        open={historyKey !== null}
        onClose={() => setHistoryKey(null)}
        title="Version history"
        description={historyKey ? `Every version of ${historyKey}. Nothing is ever removed.` : undefined}
        size="lg"
      >
        <div className="flex flex-col gap-6">
          {historyVersions.map((version, index) => {
            const previous = index > 0 ? historyVersions[index - 1] : null
            const changes = previous ? diffRules(previous, version) : []
            return (
              <section key={version.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <VersionBadge version={version.version} size="md" />
                  <RuleStatusBadge status={version.status} size="md" />
                  <span className="text-body-13 tabular-nums text-text-secondary">{effectiveRange(version)}</span>
                </div>
                <p className="mt-2 text-body-13 text-text-secondary">{version.description}</p>
                <KeyValueList className="mt-3">
                  <KeyValue label="Commissions computed under it" divided>
                    <span className="tabular-nums">
                      {formatNumber(version.commissionCount)} · {formatNaira(version.commissionTotal)}
                    </span>
                  </KeyValue>
                  <KeyValue label="Created by" divided>
                    {userName(version.createdBy)}
                  </KeyValue>
                </KeyValueList>

                {previous && (
                  <div className="mt-3">
                    <p className="text-label-10 text-text-muted">Changed from v{previous.version}</p>
                    {changes.length === 0 ? (
                      <p className="mt-1 text-body-13 text-text-secondary">No field changed.</p>
                    ) : (
                      <ul className="mt-1.5 flex flex-col gap-1.5">
                        {changes.map((change) => (
                          <li key={change.field} className="text-body-13">
                            <span className="text-text-secondary">{change.field}: </span>
                            <span className="font-mono text-body-12 text-danger-text line-through">{change.before}</span>
                            <span aria-hidden="true" className="px-1.5 text-text-muted">
                              →
                            </span>
                            <span className="font-mono text-body-12 text-success-text">{change.after}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setHistoryKey(null)
                      navigate(`/referral/rules/${version.id}`)
                    }}
                  >
                    Open v{version.version}
                  </Button>
                </div>

                {index < historyVersions.length - 1 && <Separator className="mt-6" />}
              </section>
            )
          })}
        </div>
      </Drawer>
    </Screen>
  )
}

const STATUS_DESCRIPTION: Record<CommissionRule['status'], string> = {
  active: 'In force today. These are the versions producing commissions right now.',
  scheduled: 'Approved and dated, but not yet in force.',
  superseded: 'End-dated by a later version. Kept forever — historical commissions point at them.',
  draft: 'Not calculating anything. A draft has no effect until it is activated.',
}

function appliesTo(rule: CommissionRule): string {
  const scope = rule.unitIds.length ? rule.unitIds.map(unitName).join(', ') : 'All units'
  if (rule.calculation.kind === 'course_specific') {
    const names = rule.calculation.rates.map((r) => courseTitle(r.courseId))
    return `${scope} · ${names.length} course${names.length === 1 ? '' : 's'}`
  }
  if (rule.calculation.kind === 'campaign_specific') {
    return `${scope} · ${rule.calculation.rates.length} campaign${rule.calculation.rates.length === 1 ? '' : 's'}`
  }
  return scope
}

function eligibilityText(rule: CommissionRule): string {
  const parts: string[] = []
  if (rule.eligibility.requiresFullPayment) parts.push('Fully paid')
  else if (rule.eligibility.minimumPercentPaid !== null) parts.push(`${rule.eligibility.minimumPercentPaid}% paid`)
  if (rule.eligibility.paymentAgedDays !== null) parts.push(`aged ${rule.eligibility.paymentAgedDays}d`)
  if (rule.eligibility.requiresManualApproval) parts.push('manual approval')
  return parts.length ? parts.join(' · ') : 'None'
}
