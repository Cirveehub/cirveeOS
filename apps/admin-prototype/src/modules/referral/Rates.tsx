import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarOff, ChevronDown, ChevronUp, History, Percent, Plus, SquarePen, Trash2 } from 'lucide-react'

import { TODAY, commissionRulesCollection, commissionsCollection, coursesCollection, rolesCollection, useCollection } from '@/mocks'
import type { CommissionBasis, CommissionRule, Kobo } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ConfirmDialog,
  CurrencyInput,
  EmptyState,
  Field,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  SkeletonTable,
  Switch,
} from '@/ui'
import { formatDate, formatNaira, formatNumber } from '@/lib/format'

import {
  BASIS_HINT,
  BASIS_LABEL,
  BASIS_OPTIONS,
  BENEFICIARY_PLURAL,
  IF_PAID_LABEL,
  ON_REFUND_LABEL,
  PAYOUT_SCHEDULES,
  REFERRER_TYPES,
  SCHEDULE_LABEL,
  blankDraft,
  courseTitle,
  diffRules,
  nextVersionDraft,
  rateSentence,
  ruleRateSentence,
  roleName,
  slugify,
  unitName,
  userName,
  validateDraft,
  versionsOf,
  whoGetsPaid,
} from './lib'
import type { IfAlreadyPaid, OnRefund, PayoutSchedule, RuleDraft, TierDraft } from './lib'
import { LoadFailed, ModulePage, RuleStatusBadge, Screen, VersionBadge, useScreenState } from './parts'
import { commitRule, endDateRule } from './writes'

interface RateRow {
  ruleKey: string
  current: CommissionRule
  versions: CommissionRule[]
  enrolments: number
}

export default function Rates() {
  const rules = useCollection(commissionRulesCollection)
  const commissions = useCollection(commissionsCollection)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:rates')

  const [formRule, setFormRule] = useState<CommissionRule | null | 'new'>(null)
  const [turningOff, setTurningOff] = useState<CommissionRule | null>(null)
  const [endDate, setEndDate] = useState(TODAY)
  const [historyOpen, setHistoryOpen] = useState<string | null>(null)
  const [showOff, setShowOff] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(params.get('highlight'))

  const editId = params.get('edit')
  const wantsNew = params.get('new')
  useEffect(() => {
    if (editId) {
      const rule = commissionRulesCollection.find(editId)
      if (rule) setFormRule(rule)
    } else if (wantsNew) {
      setFormRule('new')
    }
    if (editId || wantsNew) {
      const next = new URLSearchParams(params)
      next.delete('edit')
      next.delete('new')
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, wantsNew])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2500)
    return () => window.clearTimeout(timer)
  }, [flash])

  const rows = useMemo(() => {
    const keys = [...new Set(rules.map((r) => r.ruleKey))]
    return keys
      .map((ruleKey): RateRow => {
        const versions = rules.filter((r) => r.ruleKey === ruleKey).slice().sort((a, b) => b.version - a.version)
        const current = versions.find((v) => v.status === 'active') ?? versions.find((v) => v.status === 'scheduled') ?? versions[0]
        const enrolments = new Set(
          commissions.filter((c) => c.ruleId === current.id && c.state !== 'cancelled').map((c) => c.admissionId),
        ).size
        return { ruleKey, current, versions, enrolments }
      })
      .sort((a, b) => a.current.name.localeCompare(b.current.name))
  }, [rules, commissions])

  const live = (forcedEmpty ? [] : rows).filter((r) => r.current.status === 'active' || r.current.status === 'scheduled')
  const off = (forcedEmpty ? [] : rows).filter((r) => r.current.status !== 'active' && r.current.status !== 'scheduled')

  return (
    <Screen>
      <ModulePage
        title="Rates"
        description="What each kind of referrer earns, and when. Change a number here and every new enrolment uses it from the date you pick."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setFormRule('new')}>
            Add a rate
          </Button>
        }
      />

      {errored && <LoadFailed what="Rates" onRetry={retry} />}

      {!errored && (
        <>
          {notice && (
            <Alert tone="success" className="mb-5" onDismiss={() => setNotice(null)}>
              {notice}
            </Alert>
          )}

          {loading ? (
            <Card padding="none">
              <SkeletonTable rows={5} columns={3} />
            </Card>
          ) : live.length === 0 ? (
            <Card padding="none">
              <EmptyState
                icon={Percent}
                title="No rates set"
                message="Nobody earns anything until a rate exists. Add one to say who gets paid, how much, and when."
                action={
                  <Button leftIcon={<Plus size={16} />} onClick={() => setFormRule('new')}>
                    Add the first rate
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {live.map((row) => (
                <RateCard
                  key={row.ruleKey}
                  row={row}
                  flash={flash === row.current.id}
                  historyOpen={historyOpen === row.ruleKey}
                  onToggleHistory={() => setHistoryOpen((k) => (k === row.ruleKey ? null : row.ruleKey))}
                  onEdit={() => setFormRule(row.current)}
                  onTurnOff={() => {
                    setEndDate(TODAY)
                    setTurningOff(row.current)
                  }}
                  onOpenVersion={(id) => navigate(`/referral/rules/${id}`)}
                />
              ))}
            </ul>
          )}

          {!loading && off.length > 0 && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => setShowOff((v) => !v)}
                className="flex items-center gap-2 text-body-13 font-medium text-text-secondary hover:text-text"
              >
                {showOff ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {formatNumber(off.length)} turned off
              </button>
              {showOff && (
                <ul className="mt-3 flex flex-col gap-3">
                  {off.map((row) => (
                    <RateCard
                      key={row.ruleKey}
                      row={row}
                      flash={false}
                      historyOpen={historyOpen === row.ruleKey}
                      onToggleHistory={() => setHistoryOpen((k) => (k === row.ruleKey ? null : row.ruleKey))}
                      onEdit={() => setFormRule(row.current)}
                      onOpenVersion={(id) => navigate(`/referral/rules/${id}`)}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      <RateForm
        open={formRule !== null}
        source={formRule === 'new' ? null : formRule}
        onClose={() => setFormRule(null)}
        onSaved={(rule, previous) => {
          setFlash(rule.id)
          setNotice(
            previous
              ? `Saved. From ${formatDate(rule.effectiveFrom)}: ${ruleRateSentence(rule)} Enrolments before that keep the old rate.`
              : `Added. From ${formatDate(rule.effectiveFrom)}: ${ruleRateSentence(rule)}`,
          )
        }}
      />

      <ConfirmDialog
        open={turningOff !== null}
        onClose={() => setTurningOff(null)}
        onConfirm={() => {
          if (!turningOff) return
          endDateRule(turningOff, endDate)
          setNotice(`${turningOff.name} stops after ${formatDate(endDate)}. Anything already earned under it is still owed.`)
          setTurningOff(null)
        }}
        title={turningOff ? `Turn off "${turningOff.name}"?` : ''}
        confirmLabel="Turn off"
        icon={CalendarOff}
        destructive
      >
        {turningOff && (
          <div className="flex flex-col gap-4 text-body-14 text-text-secondary">
            <p>
              New enrolments after the date below earn nothing under this rate. Anything already earned keeps its amount and
              still gets paid.
            </p>
            <Field label="Last day it applies" required>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
        )}
      </ConfirmDialog>
    </Screen>
  )
}

function RateCard({
  row,
  flash,
  historyOpen,
  onToggleHistory,
  onEdit,
  onTurnOff,
  onOpenVersion,
}: {
  row: RateRow
  flash: boolean
  historyOpen: boolean
  onToggleHistory: () => void
  onEdit: () => void
  onTurnOff?: () => void
  onOpenVersion: (id: string) => void
}) {
  const { current, versions, enrolments } = row
  const previous = versions.find((v) => v.version === current.version - 1)
  const isOff = current.status !== 'active' && current.status !== 'scheduled'
  const endsSoon = current.effectiveTo !== null && current.status === 'active'

  return (
    <li>
      <Card padding="none" className={flash ? 'ring-2 ring-success' : undefined}>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-body-15 font-medium text-text">{ruleRateSentence(current)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-body-13 text-text-secondary">
                <span>{current.name}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {current.status === 'scheduled' ? 'Starts' : 'Since'} {formatDate(current.effectiveFrom)}
                </span>
                {endsSoon && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-warning-text">Ends {formatDate(current.effectiveTo as string)}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  Paid on {formatNumber(enrolments)} enrolment{enrolments === 1 ? '' : 's'}
                </span>
                {current.unitIds.length > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{current.unitIds.map(unitName).join(', ')} only</span>
                  </>
                )}
                {current.approvalRequired && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>Sign-off from {roleName(current.approverRoleId)}</span>
                  </>
                )}
              </div>
              {current.version > 1 && (
                <p className="mt-1 text-body-12 text-text-muted">
                  Changed on {formatDate(current.createdAt)} by {userName(current.createdBy)} (v{current.version}
                  {previous ? `, was v${previous.version}` : ''})
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {isOff && <RuleStatusBadge status={current.status} size="md" />}
              {current.status === 'scheduled' && <RuleStatusBadge status="scheduled" size="md" />}
              <Button size="sm" variant="ghost" leftIcon={<History size={14} />} onClick={onToggleHistory}>
                History
              </Button>
              {onTurnOff && !current.effectiveTo && (
                <Button size="sm" variant="ghost" leftIcon={<CalendarOff size={14} />} onClick={onTurnOff}>
                  Turn off
                </Button>
              )}
              <Button size="sm" variant="secondary" leftIcon={<SquarePen size={14} />} onClick={onEdit}>
                {isOff ? 'Turn back on' : 'Edit'}
              </Button>
            </div>
          </div>

          {historyOpen && (
            <ol className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              {versions.map((version, index) => {
                const older = versions[index + 1]
                const changes = older ? diffRules(older, version) : []
                return (
                  <li key={version.id} className="rounded-xl border border-border px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <VersionBadge version={version.version} />
                      <RuleStatusBadge status={version.status} />
                      <span className="text-body-13 tabular-nums text-text-secondary">
                        {formatDate(version.effectiveFrom)} – {version.effectiveTo ? formatDate(version.effectiveTo) : 'open'}
                      </span>
                      <span className="text-body-12 text-text-muted">
                        set on {formatDate(version.createdAt)} by {userName(version.createdBy)}
                      </span>
                      <Button size="sm" variant="ghost" className="ml-auto" onClick={() => onOpenVersion(version.id)}>
                        Open
                      </Button>
                    </div>
                    <p className="mt-1.5 text-body-13 text-text">{ruleRateSentence(version)}</p>
                    {older && changes.length > 0 && (
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {changes.map((change) => (
                          <li key={change.field} className="text-body-12 text-text-secondary">
                            {change.field}: <span className="line-through">{change.before}</span> → <span className="text-text">{change.after}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </CardBody>
      </Card>
    </li>
  )
}

type WhoKey = `referrer:${string}` | 'closer:staff' | 'lead_owner:staff'

const WHO_OPTIONS: Array<{ value: WhoKey; label: string }> = [
  ...REFERRER_TYPES.map((t) => ({ value: `referrer:${t}` as WhoKey, label: `${BENEFICIARY_PLURAL[t]} who refer someone` })),
  { value: 'closer:staff', label: 'Staff who close a sale' },
  { value: 'lead_owner:staff', label: 'Staff who handle the enquiry' },
]

type WhenKey = 'full' | 'issued' | 'partial'

function whenKeyOf(draft: RuleDraft): WhenKey {
  if (draft.requiresFullPayment) return 'full'
  if (draft.minimumPercentPaid !== null) return 'partial'
  return 'issued'
}

function RateForm({
  open,
  source,
  onClose,
  onSaved,
}: {
  open: boolean
  source: CommissionRule | null
  onClose: () => void
  onSaved: (rule: CommissionRule, previous: CommissionRule | null) => void
}) {
  const courses = useCollection(coursesCollection)
  const roles = useCollection(rolesCollection)
  const [draft, setDraft] = useState<RuleDraft>(() => blankDraft())
  const [more, setMore] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [minPaid, setMinPaid] = useState(50)

  useEffect(() => {
    if (!open) return
    const next = source ? nextVersionDraft(source, TODAY) : blankDraft()
    if (!source) {
      next.approverRoleId = roles.find((r) => r.name === 'Finance Manager')?.id ?? roles[0]?.id ?? null
    }
    setDraft(next)
    setMore(false)
    setNameTouched(Boolean(source))
    setErrors({})
    setMinPaid(next.minimumPercentPaid ?? 50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source?.id])

  const patch = (next: Partial<RuleDraft>) => {
    setDraft((current) => {
      const merged = { ...current, ...next }
      if (!nameTouched && !source) {
        const auto = defaultName(merged)
        merged.name = auto
        merged.ruleKey = slugify(auto)
      }
      return merged
    })
    setErrors({})
  }

  const whoKey: WhoKey = `${draft.roleOnDeal ?? 'referrer'}:${draft.beneficiaryType}` as WhoKey
  const setWho = (key: WhoKey) => {
    const [role, type] = key.split(':') as [RuleDraft['roleOnDeal'], RuleDraft['beneficiaryType']]
    patch({ roleOnDeal: role, beneficiaryType: type })
  }

  const whenKey = whenKeyOf(draft)
  const setWhen = (key: WhenKey) => {
    if (key === 'full') patch({ requiresFullPayment: true, minimumPercentPaid: null })
    else if (key === 'issued') patch({ requiresFullPayment: false, minimumPercentPaid: null })
    else patch({ requiresFullPayment: false, minimumPercentPaid: minPaid })
  }

  const usesPercent = draft.calcKind !== 'fixed'
  const howMuch: 'percentage' | 'fixed' = draft.calcKind === 'fixed' ? 'fixed' : 'percentage'
  const setHowMuch = (kind: 'percentage' | 'fixed') => patch({ calcKind: kind })

  const save = () => {
    const problems = validateDraft(draft)
    if (Object.keys(problems).length) {
      setErrors(problems)
      if (problems.tiers || problems.courseRates || problems.approverRoleId || problems.name) setMore(true)
      return
    }
    const outcome = commitRule(draft)
    if (!outcome.ok) {
      setErrors(outcome.errors)
      return
    }
    onSaved(outcome.rule, source)
    onClose()
  }

  const addTier = () => {
    const last = draft.tiers.at(-1)
    const from = last ? (last.toAmount ?? ((last.fromAmount + 10_000_000) as Kobo)) : (0 as Kobo)
    const tiers: TierDraft[] = [
      ...draft.tiers.map((t, i) => (i === draft.tiers.length - 1 && t.toAmount === null ? { ...t, toAmount: from } : t)),
      { fromAmount: from, toAmount: null, rate: last ? last.rate + 2 : 8 },
    ]
    patch({ tiers })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={source ? `Change "${source.name}"` : 'Add a rate'}
      description={
        source
          ? `The current rate stays in force until the day before your start date. Enrolments already recorded keep what they earned.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>{source ? 'Save new rate' : 'Add rate'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-xl border border-border bg-canvas px-4 py-3">
          <p className="text-label-10 text-text-muted">This means</p>
          <p className="mt-1 text-body-14 text-text">{rateSentence(draft)}</p>
        </div>

        <Field label="Who gets paid" required error={errors.roleOnDeal}>
          <Select value={whoKey} options={WHO_OPTIONS} onChange={(e) => setWho(e.target.value as WhoKey)} />
        </Field>

        <Field label="How much" required error={errors.percentageRate ?? errors.fixedAmount}>
          <div className="flex flex-col gap-3">
            <RadioGroup orientation="horizontal">
              <Radio
                name="how-much"
                label="A percentage"
                checked={howMuch === 'percentage'}
                onChange={() => setHowMuch('percentage')}
              />
              <Radio name="how-much" label="A fixed amount" checked={howMuch === 'fixed'} onChange={() => setHowMuch('fixed')} />
            </RadioGroup>
            {draft.calcKind === 'percentage' && (
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={draft.percentageRate}
                onChange={(e) => patch({ percentageRate: Number(e.target.value) })}
                rightSlot={<span className="text-body-13 text-text-secondary">%</span>}
                containerClassName="w-40"
                invalid={Boolean(errors.percentageRate)}
              />
            )}
            {draft.calcKind === 'fixed' && (
              <CurrencyInput
                value={draft.fixedAmount}
                onChange={(kobo) => patch({ fixedAmount: kobo as Kobo | null })}
                containerClassName="w-56"
                invalid={Boolean(errors.fixedAmount)}
              />
            )}
            {draft.calcKind === 'tiered' && (
              <p className="text-body-13 text-text-secondary">Using rate steps — set them under More options.</p>
            )}
            {draft.calcKind === 'course_specific' && (
              <p className="text-body-13 text-text-secondary">Using per-course rates — set them under More options.</p>
            )}
          </div>
        </Field>

        {usesPercent && (
          <Field label="Of what" required>
            <RadioGroup>
              {BASIS_OPTIONS.map((basis) => (
                <Radio
                  key={basis}
                  name="basis"
                  label={BASIS_LABEL[basis]}
                  description={BASIS_HINT[basis]}
                  checked={draft.basis === basis}
                  onChange={() => patch({ basis })}
                />
              ))}
            </RadioGroup>
          </Field>
        )}

        <Field label="When it's paid" required error={errors.minimumPercentPaid}>
          <RadioGroup>
            <Radio name="when" label="Once the invoice is fully paid" checked={whenKey === 'full'} onChange={() => setWhen('full')} />
            <Radio name="when" label="Once the invoice is issued" checked={whenKey === 'issued'} onChange={() => setWhen('issued')} />
            <Radio
              name="when"
              label={
                <span className="flex items-center gap-2">
                  Once
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    inputSize="sm"
                    value={minPaid}
                    disabled={whenKey !== 'partial'}
                    onChange={(e) => {
                      const value = Number(e.target.value)
                      setMinPaid(value)
                      if (whenKey === 'partial') patch({ minimumPercentPaid: value })
                    }}
                    containerClassName="w-20"
                  />
                  % of the invoice is paid
                </span>
              }
              checked={whenKey === 'partial'}
              onChange={() => setWhen('partial')}
            />
          </RadioGroup>
        </Field>

        <Field
          label="From when"
          required
          error={errors.effectiveFrom}
          hint={source ? `"${source.name}" v${source.version} applies up to the day before.` : 'Enrolments from this date use the rate.'}
        >
          <Input
            type="date"
            value={draft.effectiveFrom}
            onChange={(e) => patch({ effectiveFrom: e.target.value })}
            containerClassName="w-48"
            invalid={Boolean(errors.effectiveFrom)}
          />
        </Field>

        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          className="flex items-center gap-1.5 self-start text-body-13 font-medium text-accent hover:underline"
        >
          {more ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          More options
        </button>

        {more && (
          <div className="flex flex-col gap-5 rounded-xl border border-border p-4">
            <Field label="Name" required error={errors.name} hint="Shows on every commission row this rate produces.">
              <Input
                value={draft.name}
                onChange={(e) => {
                  setNameTouched(true)
                  setDraft((d) => ({ ...d, name: e.target.value, ruleKey: source ? d.ruleKey : slugify(e.target.value) }))
                }}
                invalid={Boolean(errors.name)}
              />
            </Field>

            <Switch
              checked={draft.calcKind === 'tiered'}
              onChange={(on) => patch({ calcKind: on ? 'tiered' : 'percentage' })}
              label="Rate steps"
              description="A different percentage depending on how big the fee is."
            />
            {draft.calcKind === 'tiered' && (
              <div className="flex flex-col gap-2 pl-1">
                {errors.tiers && <p className="text-body-13 text-danger-text">{errors.tiers}</p>}
                {draft.tiers.map((tier, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <CurrencyInput
                      aria-label={`Step ${i + 1} from`}
                      value={tier.fromAmount}
                      onChange={(kobo) => patch({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, fromAmount: (kobo ?? 0) as Kobo } : t)) })}
                      inputSize="sm"
                      containerClassName="w-40"
                    />
                    <span className="text-body-13 text-text-secondary">to</span>
                    <CurrencyInput
                      aria-label={`Step ${i + 1} to`}
                      value={tier.toAmount}
                      placeholder="no upper limit"
                      onChange={(kobo) => patch({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, toAmount: kobo as Kobo | null } : t)) })}
                      inputSize="sm"
                      containerClassName="w-40"
                    />
                    <span className="text-body-13 text-text-secondary">→</span>
                    <Input
                      aria-label={`Step ${i + 1} rate`}
                      type="number"
                      inputSize="sm"
                      min={0}
                      max={100}
                      step={0.5}
                      value={tier.rate}
                      onChange={(e) => patch({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, rate: Number(e.target.value) } : t)) })}
                      rightSlot={<span className="text-body-12 text-text-secondary">%</span>}
                      containerClassName="w-24"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      aria-label={`Remove step ${i + 1}`}
                      onClick={() => patch({ tiers: draft.tiers.filter((_, j) => j !== i) })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} className="self-start" onClick={addTier}>
                  Add a step
                </Button>
              </div>
            )}

            <Switch
              checked={draft.calcKind === 'course_specific'}
              onChange={(on) => patch({ calcKind: on ? 'course_specific' : 'percentage' })}
              label="Per-course rates"
              description="A different percentage for particular courses."
            />
            {draft.calcKind === 'course_specific' && (
              <div className="flex flex-col gap-2 pl-1">
                {errors.courseRates && <p className="text-body-13 text-danger-text">{errors.courseRates}</p>}
                {draft.courseRates.map((row, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Course ${i + 1}`}
                      selectSize="sm"
                      containerClassName="w-72"
                      value={row.courseId}
                      placeholder="Choose a course"
                      options={courses.map((c) => ({ value: c.id, label: c.title }))}
                      onChange={(e) => patch({ courseRates: draft.courseRates.map((r, j) => (j === i ? { ...r, courseId: e.target.value } : r)) })}
                    />
                    <Input
                      aria-label={`Rate for course ${i + 1}`}
                      type="number"
                      inputSize="sm"
                      min={0}
                      max={100}
                      step={0.5}
                      value={row.rate}
                      onChange={(e) => patch({ courseRates: draft.courseRates.map((r, j) => (j === i ? { ...r, rate: Number(e.target.value) } : r)) })}
                      rightSlot={<span className="text-body-12 text-text-secondary">%</span>}
                      containerClassName="w-24"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      aria-label={`Remove ${courseTitle(row.courseId)}`}
                      onClick={() => patch({ courseRates: draft.courseRates.filter((_, j) => j !== i) })}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    leftIcon={<Plus size={14} />}
                    onClick={() => patch({ courseRates: [...draft.courseRates, { courseId: courses[0]?.id ?? '', rate: draft.courseFallback }] })}
                  >
                    Add a course
                  </Button>
                  <span className="text-body-13 text-text-secondary">Any other course:</span>
                  <Input
                    aria-label="Rate for any other course"
                    type="number"
                    inputSize="sm"
                    min={0}
                    max={100}
                    step={0.5}
                    value={draft.courseFallback}
                    onChange={(e) => patch({ courseFallback: Number(e.target.value) })}
                    rightSlot={<span className="text-body-12 text-text-secondary">%</span>}
                    containerClassName="w-24"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="If the student is refunded">
                <Select
                  value={draft.onRefund}
                  options={(Object.keys(ON_REFUND_LABEL) as OnRefund[]).map((v) => ({ value: v, label: ON_REFUND_LABEL[v] }))}
                  onChange={(e) => patch({ onRefund: e.target.value as OnRefund })}
                />
              </Field>
              <Field label="If we had already paid the referrer">
                <Select
                  value={draft.ifAlreadyPaid}
                  options={(Object.keys(IF_PAID_LABEL) as IfAlreadyPaid[]).map((v) => ({ value: v, label: IF_PAID_LABEL[v] }))}
                  onChange={(e) => patch({ ifAlreadyPaid: e.target.value as IfAlreadyPaid })}
                />
              </Field>
              <Field label="How often we pay">
                <Select
                  value={draft.payoutSchedule}
                  options={PAYOUT_SCHEDULES.map((v) => ({ value: v, label: SCHEDULE_LABEL[v] }))}
                  onChange={(e) => patch({ payoutSchedule: e.target.value as PayoutSchedule })}
                />
              </Field>
              <Field label="Wait for the money to settle" hint="Days after payment before it counts. Blank means no wait.">
                <Input
                  type="number"
                  min={0}
                  value={draft.paymentAgedDays ?? ''}
                  placeholder="0"
                  onChange={(e) => patch({ paymentAgedDays: e.target.value === '' ? null : Number(e.target.value) })}
                />
              </Field>
            </div>

            <Switch
              checked={draft.approvalRequired}
              onChange={(on) => patch({ approvalRequired: on })}
              label="Someone signs off before it's paid"
              description="Earned commission waits for approval before it can be paid out."
            />
            {draft.approvalRequired && (
              <Field label="Who signs off" required error={errors.approverRoleId}>
                <Select
                  value={draft.approverRoleId ?? ''}
                  placeholder="Choose a role"
                  options={roles.map((r) => ({ value: r.id, label: r.name }))}
                  onChange={(e) => patch({ approverRoleId: (e.target.value || null) as RuleDraft['approverRoleId'] })}
                />
              </Field>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function defaultName(draft: RuleDraft): string {
  if (draft.roleOnDeal === 'closer') return 'Closer bonus'
  if (draft.roleOnDeal === 'lead_owner') return 'Enquiry handler bonus'
  return `${BENEFICIARY_PLURAL[draft.beneficiaryType]} referral`
}

