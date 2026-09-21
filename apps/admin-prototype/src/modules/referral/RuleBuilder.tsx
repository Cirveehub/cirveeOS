/**
 * §3.5 — Commission rule builder. The centrepiece.
 *
 * Left: seven numbered sections of form. Right: a sticky live preview and
 * simulator that regenerates a plain-English sentence on every keystroke and
 * works a real example against a seeded admission.
 *
 * The arithmetic is never done here. `simulateRule` and `backTestRule` both run
 * the store's `computeCommission`, which is the same function the seed used to
 * produce the 88 existing commissions. If the simulator and the ledger ever
 * disagreed, that would be a bug in the engine, not in two implementations.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  Check,
  FlaskConical,
  Info,
  Plus,
  Trash2,
  Users,
} from 'lucide-react'

import {
  CURRENT_USER_ID,
  LAST_90D,
  TODAY,
  admissionsCollection,
  auditEventsCollection,
  backTestRule,
  branchesCollection,
  campaignsCollection,
  commissionRulesCollection,
  coursesCollection,
  evaluateCommissionRules,
  rolesCollection,
  unitsCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import { auditId, ngn } from '@/mocks/types'
import type { AuditEvent, BranchId, CommissionRule, Kobo, RoleId, UnitId } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  CurrencyInput,
  DataTable,
  Field,
  FieldError,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  Label,
  PageHeader,
  Radio,
  RadioGroup,
  Select,
  Separator,
  Switch,
  Tabs,
  Textarea,
} from '@/ui'
import type { Column } from '@/ui'
import { formatDate, formatNaira, formatNumber } from '@/lib/format'

import {
  BASIS_HELP,
  BASIS_LABEL,
  BASIS_OPTIONS,
  BENEFICIARY_LABEL,
  BENEFICIARY_TYPES,
  CALCULATION_KINDS,
  CALCULATION_LABEL,
  IF_PAID_LABEL,
  ON_REFUND_LABEL,
  PAYOUT_SCHEDULES,
  ROLE_HELP,
  ROLE_LABEL,
  ROLE_ON_DEAL,
  SCHEDULE_LABEL,
  STATE_LABEL,
  amountsForAdmission,
  basisComparison,
  beneficiaryFor,
  blankDraft,
  candidateRule,
  dayBefore,
  draftFromRule,
  duplicateDraft,
  effectiveRange,
  findRule,
  nextRuleId,
  nextVersionDraft,
  payrollFloor,
  personName,
  ruleCode,
  ruleSentence,
  simulateRule,
  simulatableAdmissions,
  tierSummary,
  tierWarning,
  validateDraft,
  validateTiers,
} from './lib'
import type { IfAlreadyPaid, OnRefund, RuleDraft, TierDraft } from './lib'
import { RoleBadge, Screen, StateBadge } from './parts'

const k = (n: number | null): Kobo => (n ?? 0) as Kobo

export default function RuleBuilder() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  /* Keep the builder subscribed so an activation elsewhere is reflected here. */
  useCollection(commissionRulesCollection)

  const source = findRule(id)
  const mode = params.get('mode') ?? (source ? 'version' : 'new')
  const requestedFrom = params.get('from')

  const [draft, setDraft] = useState<RuleDraft>(() => {
    if (!source) return blankDraft()
    if (mode === 'duplicate') return duplicateDraft(source, `${source.ruleKey}-copy`)
    if (mode === 'edit') return draftFromRule(source)
    return nextVersionDraft(source, requestedFrom ?? TODAY)
  })

  const [showValidation, setShowValidation] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [saved, setSaved] = useState<{ ref: string; status: CommissionRule['status'] } | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)

  const patch = (next: Partial<RuleDraft>) => {
    setDraft((current) => ({ ...current, ...next }))
    setSaved(null)
  }

  const problems = validateDraft(draft)
  const errorFor = (key: string) => (showValidation ? problems.fields[key] : undefined)
  const blocked = Object.keys(problems.fields).length > 0

  const now = `${TODAY}T09:00:00+01:00`
  const candidate = useMemo(
    () => candidateRule(draft, { id: nextRuleId(draft), status: 'draft', actor: CURRENT_USER_ID, now }),
    [draft, now],
  )

  const versionLabel = `v${draft.version}${mode === 'edit' ? '' : ' draft'}`
  const isNewVersion = mode === 'version' && Boolean(source)

  /* ---- writes --------------------------------------------------------- */

  function writeAudit(rule: CommissionRule, previous: CommissionRule | undefined) {
    const actor = usersCollection.find(CURRENT_USER_ID)
    const role = actor?.roleIds[0] ? (rolesCollection.find(actor.roleIds[0])?.name ?? 'Super Admin') : 'Super Admin'
    const event: AuditEvent = {
      id: auditId(`audit-rule-${rule.id}-${Date.now()}`),
      at: now,
      actorUserId: CURRENT_USER_ID,
      actorName: actor ? personName(actor.personId) : 'Super Admin',
      actorRole: role,
      action: previous ? 'commission_rule.version_created' : 'commission_rule.created',
      entityType: 'CommissionRule',
      entityId: rule.id,
      entityRef: ruleCode(rule),
      field: previous ? 'version' : null,
      before: previous ? String(previous.version) : null,
      after: String(rule.version),
      source: 'ui',
      ip: '102.89.34.17',
    }
    auditEventsCollection.insert(event)
  }

  function commit(status: CommissionRule['status']) {
    setShowValidation(true)
    if (Object.keys(validateDraft(draft).fields).length) {
      setSaveFailed(true)
      return
    }
    setSaveFailed(false)

    const rule = candidateRule(draft, { id: nextRuleId(draft), status, actor: CURRENT_USER_ID, now })
    if (commissionRulesCollection.find(rule.id)) {
      setSaveFailed(true)
      return
    }
    commissionRulesCollection.insert(rule)

    const previous = draft.supersedesVersionId ? findRule(draft.supersedesVersionId) : undefined
    if (status !== 'draft' && previous) {
      /* The predecessor is end-dated and marked superseded. It is never removed,
         and none of its commissions are touched. */
      commissionRulesCollection.update(previous.id, {
        effectiveTo: dayBefore(rule.effectiveFrom),
        status: 'superseded',
        updatedAt: now,
        updatedBy: CURRENT_USER_ID,
      })
    }
    if (status !== 'draft') writeAudit(rule, previous)

    setSaved({ ref: `${ruleCode(rule)} v${rule.version}`, status })
    setConfirming(false)
    if (status !== 'draft') navigate(`/referral/rules?highlight=${rule.id}`)
  }

  const activationStatus: CommissionRule['status'] = draft.effectiveFrom > TODAY ? 'scheduled' : 'active'
  const predecessor = draft.supersedesVersionId ? findRule(draft.supersedesVersionId) : undefined

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Referral & commission', to: '/referral' },
          { label: 'Commission rules', to: '/referral/rules' },
          { label: source ? `${source.name} v${draft.version}` : 'New rule' },
        ]}
        title={draft.name.trim() || 'New commission rule'}
        description="Commission is configuration, not code. Everything on this page is stored as data and every commission names the version it was computed under."
        meta={
          <div className="flex items-center gap-2">
            <Badge tone="accent" variant="subtle" size="md" className="tabular-nums">
              {versionLabel}
            </Badge>
            {isNewVersion && source && (
              <Badge tone="neutral" variant="outline" size="md">
                supersedes v{source.version}
              </Badge>
            )}
          </div>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate('/referral/rules')}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={() => commit('draft')}>
              Save as draft
            </Button>
            <Button
              onClick={() => {
                setShowValidation(true)
                if (Object.keys(validateDraft(draft).fields).length) {
                  setSaveFailed(true)
                  return
                }
                setSaveFailed(false)
                setConfirming(true)
              }}
            >
              Activate
            </Button>
          </>
        }
      />

      {saveFailed && blocked && (
        <Alert tone="danger" title="This rule cannot be saved yet" className="mb-5">
          {Object.keys(problems.fields).length === 1
            ? 'One section still needs attention. The field is marked below.'
            : `${Object.keys(problems.fields).length} fields still need attention. They are marked below.`}
        </Alert>
      )}

      {saved && (
        <Alert tone="success" title={`${saved.ref} saved as ${saved.status}`} className="mb-5">
          {saved.status === 'draft'
            ? 'Nothing is calculated under a draft. Activate it when the effective-from date is settled.'
            : 'Existing commissions were not recalculated.'}
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {/* ---------------- Left: the seven sections ---------------- */}
        <div className="flex flex-col gap-5">
          <IdentitySection draft={draft} patch={patch} errorFor={errorFor} />
          <BeneficiarySection draft={draft} patch={patch} errorFor={errorFor} />
          <CalculationSection draft={draft} patch={patch} errorFor={errorFor} />
          <BasisSection draft={draft} patch={patch} />
          <EligibilitySection draft={draft} patch={patch} errorFor={errorFor} />
          <ReversalSection draft={draft} patch={patch} />
          <DatingSection draft={draft} patch={patch} errorFor={errorFor} />
        </div>

        {/* ---------------- Right: preview + simulator ---------------- */}
        <div className="xl:sticky xl:top-6">
          <SimulatorPane draft={draft} candidate={candidate} predecessor={predecessor} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => commit(activationStatus)}
        title={`Activate ${draft.name || 'this rule'} v${draft.version}?`}
        confirmLabel={activationStatus === 'scheduled' ? 'Schedule this version' : 'Activate this version'}
        icon={CalendarClock}
      >
        <div className="flex flex-col gap-3 text-body-14 text-text-secondary">
          <p>
            v{draft.version} takes effect <strong className="text-text">{formatDate(draft.effectiveFrom)}</strong>
            {activationStatus === 'scheduled' ? ' and stays Scheduled until then.' : ' and becomes the version in force today.'}
          </p>
          {predecessor && (
            <p>
              v{predecessor.version} is end-dated{' '}
              <strong className="text-text">{formatDate(dayBefore(draft.effectiveFrom))}</strong> and marked superseded.
              It is not deleted.
            </p>
          )}
          {predecessor && predecessor.commissionCount > 0 && (
            <p>
              The <strong className="text-text">{formatNumber(predecessor.commissionCount)} commissions</strong> computed
              under v{predecessor.version}, totalling{' '}
              <strong className="text-text">{formatNaira(predecessor.commissionTotal)}</strong>, are{' '}
              <strong className="text-text">not recalculated</strong>. They keep their amounts and continue to name
              v{predecessor.version}.
            </p>
          )}
        </div>
      </ConfirmDialog>
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Section shell                                                              */
/* -------------------------------------------------------------------------- */

function Section({
  number,
  title,
  description,
  children,
  aside,
}: {
  number: number
  title: string
  description?: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <Card padding="none" id={`section-${number}`}>
      <CardHeader
        title={
          <span className="flex items-center gap-2.5">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-subtle text-label-10 text-accent">
              {number}
            </span>
            {title}
          </span>
        }
        description={description}
        actions={aside}
      />
      <CardBody>{children}</CardBody>
    </Card>
  )
}

interface SectionProps {
  draft: RuleDraft
  patch: (next: Partial<RuleDraft>) => void
  errorFor: (key: string) => string | undefined
}

/* -------------------------------------------------------------------------- */
/* 1 — Identity                                                               */
/* -------------------------------------------------------------------------- */

function IdentitySection({ draft, patch, errorFor }: SectionProps) {
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  return (
    <Section
      number={1}
      title="Identity"
      description="What this rule is called, and where it applies."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rule name" required error={errorFor('name')} hint="Shown on every commission row this rule produces.">
            <Input
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Alumni referral"
            />
          </Field>
          <Field
            label="Rule key"
            required
            error={errorFor('ruleKey')}
            hint="Stable across every version. Versions of one key never overlap in time."
          >
            <Input
              value={draft.ruleKey}
              onChange={(e) => patch({ ruleKey: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              placeholder="alumni-referral"
              disabled={draft.supersedesVersionId !== null}
            />
          </Field>
        </div>

        <Field label="Internal description" optional hint="Why this version exists. Read by whoever reviews the next change.">
          <Textarea
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            rows={3}
            maxLength={400}
            showCount
            placeholder="Moved from a flat 10% to a tiered structure so a ₦900,000 referral is worth more than a ₦250,000 one."
          />
        </Field>

        <fieldset>
          <legend className="mb-2 text-body-13 font-semibold text-text-label">
            Units it applies to{' '}
            <span className="font-normal text-text-muted">— leave all unticked for every unit</span>
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            {units.map((unit) => (
              <Checkbox
                key={unit.id}
                label={unit.name}
                checked={draft.unitIds.includes(unit.id)}
                onChange={() => patch({ unitIds: toggle<UnitId>(draft.unitIds, unit.id) })}
              />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-body-13 font-semibold text-text-label">
            Branches <span className="font-normal text-text-muted">— leave all unticked for every branch</span>
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2.5">
            {branches.map((branch) => (
              <Checkbox
                key={branch.id}
                label={branch.name}
                checked={draft.branchIds.includes(branch.id)}
                onChange={() => patch({ branchIds: toggle<BranchId>(draft.branchIds, branch.id) })}
              />
            ))}
          </div>
        </fieldset>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* 2 — Beneficiary and the role on the deal                                   */
/* -------------------------------------------------------------------------- */

function BeneficiarySection({ draft, patch, errorFor }: SectionProps) {
  const roleError = errorFor('roleOnDeal')

  return (
    <Section
      number={2}
      title="Beneficiary"
      description="Who gets paid, and which of the three fields on the deal earns it."
    >
      <div className="flex flex-col gap-5">
        <RadioGroup legend="Beneficiary type" orientation="horizontal">
          {BENEFICIARY_TYPES.map((type) => (
            <Radio
              key={type}
              name="beneficiaryType"
              value={type}
              label={BENEFICIARY_LABEL[type]}
              checked={draft.beneficiaryType === type}
              onChange={() => patch({ beneficiaryType: type })}
            />
          ))}
        </RadioGroup>

        <Separator />

        <div>
          <RadioGroup
            legend={
              <span className="flex items-center gap-2">
                Role on the deal <span className="text-danger-text">*</span>
              </span>
            }
            description={ROLE_HELP}
            orientation="horizontal"
          >
            {ROLE_ON_DEAL.map((role) => (
              <Radio
                key={role}
                name="roleOnDeal"
                value={role}
                label={ROLE_LABEL[role]}
                checked={draft.roleOnDeal === role}
                onChange={() => patch({ roleOnDeal: role })}
                aria-invalid={roleError ? true : undefined}
              />
            ))}
          </RadioGroup>
          {roleError && <FieldError>{roleError}</FieldError>}
        </div>

        {draft.roleOnDeal && (
          <Alert tone="info" icon={Users} title={`This rule pays the ${ROLE_LABEL[draft.roleOnDeal].toLowerCase()} only`}>
            The other two fields on an admission are untouched by it.{' '}
            {draft.roleOnDeal !== 'referrer' && 'A referrer on the same admission earns nothing from this rule. '}
            {draft.roleOnDeal !== 'closer' && 'A closer on the same admission earns nothing from this rule. '}
            Create a separate rule for each role you want to pay.
          </Alert>
        )}
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* 3 — Calculation                                                            */
/* -------------------------------------------------------------------------- */

function CalculationSection({ draft, patch, errorFor }: SectionProps) {
  const courses = useCollection(coursesCollection)
  const campaigns = useCollection(campaignsCollection)
  const tierProblems = validateTiers(draft.tiers)
  const warning = tierWarning(draft.tiers)

  const setTier = (index: number, next: Partial<TierDraft>) =>
    patch({ tiers: draft.tiers.map((t, i) => (i === index ? { ...t, ...next } : t)) })

  const addTier = () => {
    const last = draft.tiers.at(-1)
    const from = last ? (last.toAmount ?? ((last.fromAmount + ngn(300_000)) as Kobo)) : ((0 as number) as Kobo)
    patch({
      tiers: [
        ...draft.tiers.map((t, i) => (i === draft.tiers.length - 1 && t.toAmount === null ? { ...t, toAmount: from } : t)),
        { fromAmount: from, toAmount: null, rate: 10 },
      ],
    })
  }

  const removeTier = (index: number) => patch({ tiers: draft.tiers.filter((_, i) => i !== index) })

  return (
    <Section number={3} title="Calculation" description="How much the beneficiary earns.">
      <Tabs
        tabs={CALCULATION_KINDS.map((kind) => ({ id: kind, label: CALCULATION_LABEL[kind] }))}
        value={draft.calcKind}
        onChange={(id) => patch({ calcKind: id as RuleDraft['calcKind'] })}
        variant="pill"
        size="sm"
        aria-label="Calculation type"
      />

      <div className="mt-5">
        {draft.calcKind === 'percentage' && (
          <Field
            label="Rate"
            required
            error={errorFor('percentageRate')}
            hint="Applied to whichever basis section 4 selects."
            className="max-w-xs"
          >
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={String(draft.percentageRate)}
              onChange={(e) => patch({ percentageRate: Number(e.target.value) })}
              suffix="%"
            />
          </Field>
        )}

        {draft.calcKind === 'fixed' && (
          <Field
            label="Amount"
            required
            error={errorFor('fixedAmount')}
            hint="A flat sum, regardless of the deal size."
            className="max-w-xs"
          >
            <CurrencyInput value={draft.fixedAmount} onChange={(kobo) => patch({ fixedAmount: k(kobo) })} />
          </Field>
        )}

        {draft.calcKind === 'tiered' && (
          <div className="flex flex-col gap-4">
            <table className="w-full text-body-13" aria-label="Commission bands">
              <caption className="sr-only">
                Commission bands. Each band must start where the previous one ends.
              </caption>
              <thead>
                <tr className="border-b border-border text-label-10 text-text-muted">
                  <th scope="col" className="py-2 pr-3 text-left font-bold">
                    From
                  </th>
                  <th scope="col" className="py-2 pr-3 text-left font-bold">
                    To
                  </th>
                  <th scope="col" className="py-2 pr-3 text-left font-bold">
                    Rate
                  </th>
                  <th scope="col" className="py-2 text-right font-bold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {draft.tiers.map((tier, index) => {
                  const problem = tierProblems.find((p) => p.index === index)
                  return (
                    <tr key={index} className="border-b border-border align-top last:border-0">
                      <td className="py-2.5 pr-3">
                        <Label htmlFor={`tier-from-${index}`} className="sr-only">
                          Band {index + 1} from
                        </Label>
                        <CurrencyInput
                          id={`tier-from-${index}`}
                          inputSize="sm"
                          value={tier.fromAmount}
                          invalid={Boolean(problem)}
                          onChange={(kobo) => setTier(index, { fromAmount: k(kobo) })}
                        />
                      </td>
                      <td className="py-2.5 pr-3">
                        <Label htmlFor={`tier-to-${index}`} className="sr-only">
                          Band {index + 1} to
                        </Label>
                        {tier.toAmount === null ? (
                          <Input id={`tier-to-${index}`} inputSize="sm" value="No upper limit" readOnly />
                        ) : (
                          <CurrencyInput
                            id={`tier-to-${index}`}
                            inputSize="sm"
                            value={tier.toAmount}
                            invalid={Boolean(problem)}
                            onChange={(kobo) => setTier(index, { toAmount: k(kobo) })}
                          />
                        )}
                      </td>
                      <td className="w-28 py-2.5 pr-3">
                        <Label htmlFor={`tier-rate-${index}`} className="sr-only">
                          Band {index + 1} rate
                        </Label>
                        <Input
                          id={`tier-rate-${index}`}
                          inputSize="sm"
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          suffix="%"
                          value={String(tier.rate)}
                          onChange={(e) => setTier(index, { rate: Number(e.target.value) })}
                        />
                      </td>
                      <td className="w-10 py-2.5 text-right">
                        <IconButton
                          icon={Trash2}
                          label={`Remove band ${index + 1}`}
                          variant="ghost"
                          size="sm"
                          disabled={draft.tiers.length === 1}
                          onClick={() => removeTier(index)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div>
              <Button variant="secondary" size="sm" leftIcon={<Plus size={16} />} onClick={addTier}>
                Add band
              </Button>
            </div>

            {tierProblems.length > 0 ? (
              <Alert tone="danger" title="Bands must be contiguous and must not overlap">
                <ul className="list-disc pl-4">
                  {tierProblems.map((p, i) => (
                    <li key={i}>{p.message}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <div className="rounded-xl bg-surface-sunken px-4 py-3">
                <p className="text-label-10 text-text-muted">Bands</p>
                <p className="mt-1 text-body-14 font-semibold tabular-nums text-text">{tierSummary(draft.tiers)}</p>
              </div>
            )}

            {warning && !tierProblems.length && (
              <Alert tone="warning" title="Top band is closed">
                {warning}
              </Alert>
            )}
          </div>
        )}

        {draft.calcKind === 'course_specific' && (
          <RateTable
            label="Course"
            options={courses.map((c) => ({ value: c.id, label: `${c.code} · ${c.title}` }))}
            rows={draft.courseRates.map((r) => ({ id: r.courseId, rate: r.rate }))}
            fallback={draft.courseFallback}
            error={errorFor('courseRates')}
            onChange={(rows) => patch({ courseRates: rows.map((r) => ({ courseId: r.id, rate: r.rate })) })}
            onFallbackChange={(rate) => patch({ courseFallback: rate })}
          />
        )}

        {draft.calcKind === 'campaign_specific' && (
          <RateTable
            label="Campaign"
            options={campaigns.map((c) => ({ value: c.id, label: c.name }))}
            rows={draft.campaignRates.map((r) => ({ id: r.campaignId, rate: r.rate }))}
            fallback={draft.campaignFallback}
            error={errorFor('campaignRates')}
            onChange={(rows) => patch({ campaignRates: rows.map((r) => ({ campaignId: r.id, rate: r.rate })) })}
            onFallbackChange={(rate) => patch({ campaignFallback: rate })}
          />
        )}

        {(draft.calcKind === 'course_specific' || draft.calcKind === 'campaign_specific') && (
          <Alert tone="info" icon={Info} title="Simulator note" className="mt-4">
            The prototype's calculation engine resolves the fallback rate for this calculation type. The per-
            {draft.calcKind === 'course_specific' ? 'course' : 'campaign'} rates above are stored on the rule and shown
            on the version page, but the worked example on the right will quote the fallback.
          </Alert>
        )}
      </div>
    </Section>
  )
}

function RateTable({
  label,
  options,
  rows,
  fallback,
  error,
  onChange,
  onFallbackChange,
}: {
  label: string
  options: Array<{ value: string; label: string }>
  rows: Array<{ id: string; rate: number }>
  fallback: number
  error?: string
  onChange: (rows: Array<{ id: string; rate: number }>) => void
  onFallbackChange: (rate: number) => void
}) {
  const available = options.filter((o) => !rows.some((r) => r.id === o.value))

  return (
    <div className="flex flex-col gap-4">
      <table className="w-full text-body-13" aria-label={`${label} rates`}>
        <caption className="sr-only">Per-{label.toLowerCase()} rates, with a fallback for everything else.</caption>
        <thead>
          <tr className="border-b border-border text-label-10 text-text-muted">
            <th scope="col" className="py-2 pr-3 text-left font-bold">
              {label}
            </th>
            <th scope="col" className="w-28 py-2 pr-3 text-left font-bold">
              Rate
            </th>
            <th scope="col" className="w-10 py-2 text-right font-bold">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-3">
                <Label htmlFor={`rate-target-${index}`} className="sr-only">
                  {label} {index + 1}
                </Label>
                <Select
                  id={`rate-target-${index}`}
                  selectSize="sm"
                  value={row.id}
                  options={[
                    { value: row.id, label: options.find((o) => o.value === row.id)?.label ?? row.id },
                    ...available,
                  ]}
                  onChange={(e) =>
                    onChange(rows.map((r, i) => (i === index ? { ...r, id: e.target.value } : r)))
                  }
                />
              </td>
              <td className="py-2.5 pr-3">
                <Label htmlFor={`rate-value-${index}`} className="sr-only">
                  {label} {index + 1} rate
                </Label>
                <Input
                  id={`rate-value-${index}`}
                  inputSize="sm"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  suffix="%"
                  value={String(row.rate)}
                  onChange={(e) => onChange(rows.map((r, i) => (i === index ? { ...r, rate: Number(e.target.value) } : r)))}
                />
              </td>
              <td className="py-2.5 text-right">
                <IconButton
                  icon={Trash2}
                  label={`Remove ${label.toLowerCase()} rate ${index + 1}`}
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                />
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2.5 pr-3 text-body-13 text-text-secondary">All other {label.toLowerCase()}s</td>
            <td className="py-2.5 pr-3">
              <Label htmlFor="rate-fallback" className="sr-only">
                Fallback rate
              </Label>
              <Input
                id="rate-fallback"
                inputSize="sm"
                type="number"
                min={0}
                max={100}
                step={0.5}
                suffix="%"
                value={String(fallback)}
                onChange={(e) => onFallbackChange(Number(e.target.value))}
              />
            </td>
            <td />
          </tr>
        </tbody>
      </table>

      {error && <FieldError>{error}</FieldError>}

      <div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<Plus size={16} />}
          disabled={!available.length}
          onClick={() => available[0] && onChange([...rows, { id: available[0].value, rate: fallback }])}
        >
          Add {label.toLowerCase()} rate
        </Button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 4 — Basis                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The spec is explicit that this panel is not decoration: it is how a
 * non-technical founder checks a rule means what they think it means. The three
 * lines are computed live, in naira, from whatever the simulator is pointed at.
 */
function BasisSection({ draft, patch }: { draft: RuleDraft; patch: (next: Partial<RuleDraft>) => void }) {
  const gross = ngn(500_000)
  const discount = ngn(50_000)
  const collected = ngn(250_000)
  const rows = basisComparison(
    draft,
    { grossFee: gross, netAfterDiscount: (gross - discount) as Kobo, amountCollected: collected },
    CURRENT_USER_ID,
  )

  return (
    <Section
      number={4}
      title="Basis"
      description="Which number the calculation is applied to. This is the difference between paying on what we quoted and paying on what we actually have."
    >
      <div className="flex flex-col gap-5">
        <RadioGroup legend="Calculate on">
          {BASIS_OPTIONS.map((basis) => (
            <Radio
              key={basis}
              name="basis"
              value={basis}
              label={BASIS_LABEL[basis]}
              description={BASIS_HELP[basis]}
              checked={draft.basis === basis}
              onChange={() => patch({ basis })}
            />
          ))}
        </RadioGroup>

        <div className="rounded-xl border border-border bg-surface-sunken p-4">
          <p className="text-label-10 text-text-muted">
            Worked example — a {formatNaira(gross)} fee with a {formatNaira(discount)} discount and{' '}
            {formatNaira(collected)} collected
          </p>
          <table className="mt-3 w-full text-body-14" aria-label="What each basis would pay">
            <caption className="sr-only">
              The same rule applied to each of the three bases, on a {formatNaira(gross)} fee.
            </caption>
            <tbody>
              {rows.map((row) => (
                <tr key={row.basis} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2 pr-4 text-left font-normal text-text-secondary">
                    <span className="flex items-center gap-2">
                      {row.selected && <Check size={14} aria-hidden="true" className="text-accent" />}
                      <span className={row.selected ? 'font-semibold text-text' : undefined}>
                        {BASIS_LABEL[row.basis]}
                      </span>
                      {row.selected && (
                        <Badge tone="accent" variant="subtle" size="sm">
                          Selected
                        </Badge>
                      )}
                    </span>
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums text-text-secondary">{formatNaira(row.amount)}</td>
                  <td className="w-6 py-2 text-center text-text-muted" aria-hidden="true">
                    <ArrowRight size={14} className="inline" />
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${row.selected ? 'font-semibold text-text' : 'text-text-secondary'}`}
                  >
                    {formatNaira(row.commission)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* 5 — Eligibility                                                            */
/* -------------------------------------------------------------------------- */

function EligibilitySection({ draft, patch, errorFor }: SectionProps) {
  return (
    <Section
      number={5}
      title="Eligibility"
      description="What has to be true before the commission is earned rather than merely tracked."
    >
      <div className="flex flex-col gap-4">
        <Checkbox
          label="Full payment received"
          description="Nothing is earned until the invoice balance reaches zero."
          checked={draft.requiresFullPayment}
          onChange={(e) =>
            patch({
              requiresFullPayment: e.target.checked,
              minimumPercentPaid: e.target.checked ? null : draft.minimumPercentPaid,
            })
          }
        />

        <div>
          <Checkbox
            label="Minimum percentage paid"
            description="Earned once part of the invoice is settled."
            disabled={draft.requiresFullPayment}
            checked={!draft.requiresFullPayment && draft.minimumPercentPaid !== null}
            onChange={(e) => patch({ minimumPercentPaid: e.target.checked ? 50 : null })}
          />
          {!draft.requiresFullPayment && draft.minimumPercentPaid !== null && (
            <Field
              label="Minimum paid"
              error={errorFor('minimumPercentPaid')}
              className="ml-7 mt-2.5 max-w-[180px]"
            >
              <Input
                inputSize="sm"
                type="number"
                min={1}
                max={100}
                suffix="%"
                value={String(draft.minimumPercentPaid)}
                onChange={(e) => patch({ minimumPercentPaid: Number(e.target.value) })}
              />
            </Field>
          )}
        </div>

        <div>
          <Checkbox
            label="Payment aged"
            description="A hold against chargebacks — the money has to stay settled for a while first."
            checked={draft.paymentAgedDays !== null}
            onChange={(e) => patch({ paymentAgedDays: e.target.checked ? 30 : null })}
          />
          {draft.paymentAgedDays !== null && (
            <Field label="Days settled" error={errorFor('paymentAgedDays')} className="ml-7 mt-2.5 max-w-[180px]">
              <Input
                inputSize="sm"
                type="number"
                min={0}
                suffix="days"
                value={String(draft.paymentAgedDays)}
                onChange={(e) => patch({ paymentAgedDays: Number(e.target.value) })}
              />
            </Field>
          )}
        </div>

        <Checkbox
          label="Manual approval required"
          description="Someone has to look at it before it can move past Earned, even when the money is in."
          checked={draft.requiresManualApproval}
          onChange={(e) => patch({ requiresManualApproval: e.target.checked })}
        />

        <Separator />

        <Field
          label="Commission state before eligibility is met"
          hint="Tracked is invisible to the referrer; Pending shows on their profile as coming."
          className="max-w-xs"
        >
          <Select
            value={draft.stateBeforeEligible}
            options={[
              { value: 'pending', label: 'Pending (default)' },
              { value: 'tracked', label: 'Tracked' },
            ]}
            onChange={(e) => patch({ stateBeforeEligible: e.target.value as 'pending' | 'tracked' })}
          />
        </Field>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* 6 — Reversal                                                               */
/* -------------------------------------------------------------------------- */

function ReversalSection({ draft, patch }: { draft: RuleDraft; patch: (next: Partial<RuleDraft>) => void }) {
  return (
    <Section
      number={6}
      title="Reversal"
      description="What happens to the commission when the money goes back out. A reversal is always a new record — the original commission keeps its amount."
    >
      <div className="flex flex-col gap-5">
        <RadioGroup legend="On refund or chargeback">
          {(Object.keys(ON_REFUND_LABEL) as OnRefund[]).map((value) => (
            <Radio
              key={value}
              name="onRefund"
              value={value}
              label={ON_REFUND_LABEL[value]}
              checked={draft.onRefund === value}
              onChange={() => patch({ onRefund: value })}
            />
          ))}
        </RadioGroup>

        <Separator />

        <Field label="If the commission has already been paid out" className="max-w-md">
          <Select
            value={draft.ifAlreadyPaid}
            options={(Object.keys(IF_PAID_LABEL) as IfAlreadyPaid[]).map((value) => ({
              value,
              label: IF_PAID_LABEL[value],
            }))}
            onChange={(e) => patch({ ifAlreadyPaid: e.target.value as IfAlreadyPaid })}
            disabled={draft.onRefund === 'none'}
          />
        </Field>
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* 7 — Effective dating and payout                                            */
/* -------------------------------------------------------------------------- */

function DatingSection({ draft, patch, errorFor }: SectionProps) {
  const roles = useCollection(rolesCollection)
  const floor = payrollFloor()
  const fromError = errorFor('effectiveFrom')

  return (
    <Section
      number={7}
      title="Effective dating and payout"
      description="When this version starts paying, and how the money leaves."
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Effective from"
            required
            error={fromError}
            hint={floor ? `Earliest allowed: ${formatDate(floor.firstAllowed)} — ${floor.label} payroll is closed.` : undefined}
          >
            <Input
              type="date"
              value={draft.effectiveFrom}
              onChange={(e) => patch({ effectiveFrom: e.target.value })}
            />
          </Field>
          <Field label="Effective to" optional error={errorFor('effectiveTo')} hint="Leave blank to stay in force until a later version supersedes it.">
            <Input
              type="date"
              value={draft.effectiveTo ?? ''}
              onChange={(e) => patch({ effectiveTo: e.target.value || null })}
            />
          </Field>
        </div>

        <Field label="Payout schedule" className="max-w-xs">
          <Select
            value={draft.payoutSchedule}
            options={PAYOUT_SCHEDULES.map((value) => ({ value, label: SCHEDULE_LABEL[value] }))}
            onChange={(e) => patch({ payoutSchedule: e.target.value as RuleDraft['payoutSchedule'] })}
          />
        </Field>

        <Separator />

        <Switch
          checked={draft.approvalRequired}
          onChange={(checked) => patch({ approvalRequired: checked })}
          label="Approval required before payable"
          description="An approval request is routed before any of this rule's commissions can join a payout batch."
        />

        {draft.approvalRequired && (
          <Field label="Approver role" required error={errorFor('approverRoleId')} className="max-w-sm">
            <Select
              value={draft.approverRoleId ?? ''}
              placeholder="Choose a role"
              options={roles.map((role) => ({ value: role.id, label: role.name }))}
              onChange={(e) => patch({ approverRoleId: (e.target.value || null) as RoleId | null })}
            />
          </Field>
        )}
      </div>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* The simulator pane                                                         */
/* -------------------------------------------------------------------------- */

function SimulatorPane({
  draft,
  candidate,
  predecessor,
}: {
  draft: RuleDraft
  candidate: CommissionRule
  predecessor: CommissionRule | undefined
}) {
  const admissions = useCollection(admissionsCollection)
  const [admissionId, setAdmissionId] = useState('')
  const [manual, setManual] = useState(false)
  const [manualFee, setManualFee] = useState<number | null>(ngn(500_000))
  const [manualDiscount, setManualDiscount] = useState<number | null>(ngn(50_000))
  const [manualCollected, setManualCollected] = useState<number | null>(ngn(250_000))
  const [backTestOpen, setBackTestOpen] = useState(false)

  const options = useMemo(
    () =>
      simulatableAdmissions().map((a) => ({
        value: a.id,
        label: `${a.ref} · ${personName(a.personId)} · ${formatNaira(a.netFee, { compact: true })}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [admissions.length],
  )

  const admission = admissionId ? admissionsCollection.find(admissionId) : undefined
  const picked = Boolean(admission) || manual

  const amounts = manual
    ? {
        grossFee: k(manualFee),
        netAfterDiscount: Math.max(0, (manualFee ?? 0) - (manualDiscount ?? 0)) as Kobo,
        amountCollected: k(manualCollected),
        invoiceTotal: Math.max(0, (manualFee ?? 0) - (manualDiscount ?? 0)) as Kobo,
      }
    : admission
      ? amountsForAdmission(admission)
      : { grossFee: k(0), netAfterDiscount: k(0), amountCollected: k(0), invoiceTotal: k(0) }

  const beneficiary = manual ? null : beneficiaryFor(candidate, admission ?? null)
  const result = picked ? simulateRule(candidate, admission ?? null, amounts, manual ? null : beneficiary) : null

  /* What the rules already in force would do to the same admission — the
     three-field independence, straight from the store's engine. */
  const inForce = admission ? evaluateCommissionRules({ admissionId: admission.id }) : []

  const admissionsInWindow = admissions.filter(
    (a) => a.createdAt.slice(0, 10) >= LAST_90D.from && a.createdAt.slice(0, 10) <= LAST_90D.to,
  ).length

  const backTest = backTestOpen ? backTestRule(candidate, LAST_90D) : null
  const baseline = backTestOpen && predecessor ? backTestRule(predecessor, LAST_90D) : null
  const delta = backTest && baseline ? backTest.total - baseline.total : null

  const backTestColumns: Array<Column<{ admissionId: string; ref: string; amount: Kobo }>> = [
    { key: 'ref', header: 'Admission', accessor: (r) => r.ref, sortValue: (r) => r.ref },
    {
      key: 'student',
      header: 'Student',
      accessor: (r) => personName(admissionsCollection.find(r.admissionId)?.personId ?? null),
      sortValue: (r) => personName(admissionsCollection.find(r.admissionId)?.personId ?? null),
    },
    {
      key: 'amount',
      header: 'Commission',
      align: 'right',
      accessor: (r) => <span className="tabular-nums">{formatNaira(r.amount)}</span>,
      sortValue: (r) => r.amount,
    },
  ]

  return (
    <div className="flex max-h-[calc(100vh-7rem)] flex-col gap-5 overflow-y-auto pb-2">
      {/* ---- the sentence ---- */}
      <Card padding="none">
        <CardHeader
          title="In plain English"
          description="Regenerated from the form on every keystroke."
          actions={
            <Badge tone="accent" variant="subtle" size="md" className="tabular-nums">
              v{draft.version}
            </Badge>
          }
        />
        <CardBody>
          <p className="text-body-15 text-text">{ruleSentence(draft)}</p>
        </CardBody>
      </Card>

      {/* ---- the simulator ---- */}
      <Card padding="none">
        <CardHeader
          title="Test against a real admission"
          description="Nothing is written. This is the rule applied to seeded money."
        />
        <CardBody>
          <div className="flex flex-col gap-4">
            <Field label="Seeded admission">
              <Select
                value={admissionId}
                placeholder="Pick an admission to test against"
                options={options}
                disabled={manual}
                onChange={(e) => setAdmissionId(e.target.value)}
              />
            </Field>

            <Checkbox
              label="Enter figures by hand instead"
              checked={manual}
              onChange={(e) => setManual(e.target.checked)}
            />

            {manual && (
              <div className="grid grid-cols-1 gap-3 rounded-xl bg-surface-sunken p-4 sm:grid-cols-3">
                <Field label="Fee">
                  <CurrencyInput inputSize="sm" value={manualFee} onChange={setManualFee} />
                </Field>
                <Field label="Discount">
                  <CurrencyInput inputSize="sm" value={manualDiscount} onChange={setManualDiscount} />
                </Field>
                <Field label="Collected">
                  <CurrencyInput inputSize="sm" value={manualCollected} onChange={setManualCollected} />
                </Field>
              </div>
            )}

            {!picked && (
              <div className="rounded-xl border border-dashed border-border-strong px-4 py-8 text-center">
                <FlaskConical size={20} aria-hidden="true" className="mx-auto mb-2 text-text-muted" />
                <p className="text-body-14 font-semibold text-text">Pick an admission to test against</p>
                <p className="mx-auto mt-1 max-w-xs text-body-13 text-text-secondary">
                  The simulator works the rule against real seeded money and shows whether it would pay, who, and how
                  much.
                </p>
              </div>
            )}

            {result && (
              <div className="flex flex-col gap-4">
                <div
                  className={`rounded-xl border p-4 ${
                    result.applies ? 'border-success-line bg-success-fill' : 'border-warning-line bg-warning-fill'
                  }`}
                >
                  <p className={`text-label-10 ${result.applies ? 'text-success-ink' : 'text-warning-ink'}`}>
                    {result.applies ? 'This rule applies' : 'This rule does not apply'}
                  </p>
                  <p className={`mt-1.5 text-display-32 tabular-nums ${result.applies ? 'text-success-ink' : 'text-warning-ink'}`}>
                    {result.applies ? formatNaira(result.amount) : '—'}
                  </p>
                  {result.applies && (
                    <p className="mt-1 text-body-13 text-success-ink">to {result.beneficiaryName}</p>
                  )}
                </div>

                <ul className="flex flex-col gap-1.5">
                  {result.reasons.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-body-13 text-text-secondary">
                      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-text-muted" />
                      {reason}
                    </li>
                  ))}
                </ul>

                <KeyValueList>
                  <KeyValue label={`Basis — ${BASIS_LABEL[draft.basis].toLowerCase()}`} divided>
                    <span className="tabular-nums">{formatNaira(result.basisAmount)}</span>
                  </KeyValue>
                  <KeyValue label="Rate applied" divided>
                    {result.tierLabel ? (
                      <span className="tabular-nums">
                        {result.rateApplied}% <span className="text-text-secondary">· band {result.tierLabel}</span>
                      </span>
                    ) : result.rateApplied !== null ? (
                      <span className="tabular-nums">{result.rateApplied}%</span>
                    ) : (
                      <span className="text-text-secondary">Flat amount</span>
                    )}
                  </KeyValue>
                  <KeyValue label="Arithmetic" divided>
                    <span className="font-mono text-body-13 tabular-nums">{result.workings}</span>
                  </KeyValue>
                  <KeyValue label="Commission" divided>
                    <span className="font-semibold tabular-nums">{formatNaira(result.amount)}</span>
                  </KeyValue>
                  <KeyValue label="Created in state" divided>
                    <StateBadge state={result.state} />
                  </KeyValue>
                  <KeyValue label="Eligibility outstanding" divided>
                    {result.eligibilityOutstanding ? (
                      <span className="text-warning-text">{result.eligibilityOutstanding}</span>
                    ) : (
                      <span className="text-success-text">None — it would be earned immediately</span>
                    )}
                  </KeyValue>
                </KeyValueList>
              </div>
            )}

            {admission && inForce.length > 0 && (
              <div>
                <Separator label="What the rules already in force would pay on this admission" />
                <ul className="mt-3 flex flex-col gap-2">
                  {inForce.map((preview) => (
                    <li
                      key={`${preview.ruleId}-${preview.beneficiaryPersonId}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-sunken px-3 py-2"
                    >
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <RoleBadge role={preview.roleOnDeal} />
                        <span className="truncate text-body-13 text-text">{preview.beneficiaryName}</span>
                        <span className="text-body-12 text-text-secondary">
                          {preview.ruleName} v{preview.ruleVersion}
                        </span>
                      </span>
                      <span className="text-body-13 font-semibold tabular-nums text-text">
                        {formatNaira(preview.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-body-12 text-text-secondary">
                  Three independent fields, evaluated separately. One admission can pay more than one person.
                </p>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* ---- back-test ---- */}
      <Card padding="none">
        <CardHeader
          title="Back-test"
          description={`Run this rule over the ${formatNumber(admissionsInWindow)} admissions created in the last 90 days.`}
          actions={
            <Button size="sm" variant={backTestOpen ? 'secondary' : 'primary'} onClick={() => setBackTestOpen((o) => !o)}>
              {backTestOpen ? 'Hide' : 'Run back-test'}
            </Button>
          }
        />
        {backTest && (
          <CardBody>
            <p className="text-body-15 text-text">
              Applied to the {formatNumber(admissionsInWindow)} admissions in the last 90 days, this rule would have
              produced <strong>{formatNumber(backTest.count)} commissions</strong> totalling{' '}
              <strong className="tabular-nums">{formatNaira(backTest.total)}</strong>
              {delta !== null && predecessor && (
                <>
                  {' — '}
                  <strong className="tabular-nums">
                    {formatNaira(Math.abs(delta))} {delta >= 0 ? 'more' : 'less'}
                  </strong>{' '}
                  than v{predecessor.version}.
                </>
              )}
              {delta === null && '.'}
            </p>
            <p className="mt-2 text-body-13 text-text-secondary">
              A back-test writes nothing. No commission is created, amended or recalculated by running it.
            </p>

            {backTest.rows.length > 0 ? (
              <div className="mt-4">
                <DataTable
                  data={backTest.rows}
                  columns={backTestColumns}
                  rowKey={(r) => r.admissionId}
                  density="compact"
                  maxHeight={280}
                  stickyHeader
                  caption="Admissions this rule would have produced a commission for"
                />
              </div>
            ) : (
              <Alert tone="warning" title="This rule would have produced nothing" className="mt-4">
                No admission in the last 90 days matches it. Check the unit scope in section 1 and the role on the deal
                in section 2 — a rule that pays the closer produces nothing on admissions with no closer recorded.
              </Alert>
            )}
          </CardBody>
        )}
      </Card>

      {predecessor && (
        <Card padding="tight">
          <p className="text-label-10 text-text-muted">Currently in force</p>
          <p className="mt-1.5 text-body-14 text-text">
            {predecessor.name} v{predecessor.version} · {effectiveRange(predecessor)}
          </p>
          <p className="mt-1 text-body-13 text-text-secondary">
            {formatNumber(predecessor.commissionCount)} commissions totalling {formatNaira(predecessor.commissionTotal)}{' '}
            were computed under it. Activating this version does not recalculate any of them.
          </p>
        </Card>
      )}

      <p className="px-1 text-body-12 text-text-secondary">
        States a new commission can be created in: {STATE_LABEL.tracked}, {STATE_LABEL.pending} or {STATE_LABEL.earned},
        depending on section 5.
      </p>
    </div>
  )
}
