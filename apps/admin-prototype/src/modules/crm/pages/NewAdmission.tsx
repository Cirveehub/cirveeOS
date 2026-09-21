import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Lock,
  ShieldCheck,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CurrencyInput,
  DataTable,
  EmptyState,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  PersonChip,
  Select,
  Separator,
  Textarea,
  UnitTag,
  type Column,
} from '@/ui'
import { formatDate, formatNaira, formatPhone } from '@/lib/format'
import {
  CURRENT_USER_ID,
  TODAY,
  cohortsCollection,
  coursesCollection,
  leadsCollection,
  peopleCollection,
  relationshipsCollection,
  unitsCollection,
  useCollection,
} from '@/mocks'
import type {
  BranchId,
  CohortId,
  CommissionPreview,
  CourseId,
  DiscountType,
  Instalment,
  Kobo,
  Mode,
  PaymentPlan,
  PersonId,
  UnitId,
  UserId,
} from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { PersonPicker, PersonPickerRow, UserPicker } from '../components/Pickers'
import { toast } from '../components/Toasts'
import { previewAdmissionCommissions } from '../lib/admission-preview'
import {
  DISCOUNT_TYPE_LABELS,
  MODE_LABELS,
  PAYMENT_PLAN_LABELS,
  PLAN_INSTALMENT_COUNT,
  RELATIONSHIP_LABELS,
  ROLE_ON_DEAL_LABELS,
  businessUnitOf,
  personFullName,
  useDirectory,
} from '../lib/lookups'
import {
  addDaysIso,
  approverRoleLabel,
  bandForDiscount,
  computeDiscountAmount,
  createAdmission,
  discountPercentOf,
  discountThresholdPercent,
  splitInstalmentAmounts,
} from '../lib/writes'

type Step = 1 | 2 | 3 | 4

const STEPS: Array<{ index: Step; label: string; hint: string }> = [
  { index: 1, label: 'Person', hint: 'Who is enrolling' },
  { index: 2, label: 'Programme', hint: 'Course, cohort and unit' },
  { index: 3, label: 'Money', hint: 'Fee, discount and plan' },
  { index: 4, label: 'Attribution & review', hint: 'Who earns on this' },
]

const DISCOUNT_TYPES: DiscountType[] = ['none', 'percentage', 'fixed', 'scholarship']
const PAYMENT_PLANS: PaymentPlan[] = ['full', '2_instalments', '3_instalments', '4_instalments']

export default function NewAdmission() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const leadId = params.get('leadId')

  const directory = useDirectory()
  const leads = useCollection(leadsCollection)
  const people = useCollection(peopleCollection)
  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const units = useCollection(unitsCollection)
  const relationships = useCollection(relationshipsCollection)

  const lead = leadId ? leads.find((l) => (l.id as string) === leadId) : undefined

  const [step, setStep] = useState<Step>(1)
  const [touched, setTouched] = useState<Record<Step, boolean>>({ 1: false, 2: false, 3: false, 4: false })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [personId, setPersonId] = useState<PersonId | null>(lead?.personId ?? null)

  const [courseId, setCourseId] = useState<CourseId | ''>(lead?.courseInterestId ?? '')
  const [cohortId, setCohortId] = useState<CohortId | ''>('')
  const [mode, setMode] = useState<Mode>(lead?.mode ?? 'on_campus')
  const [branchId, setBranchId] = useState<BranchId | ''>(lead?.branchId ?? '')
  const [unitId, setUnitId] = useState<UnitId | ''>(lead?.unitId ?? '')
  const [expectedStart, setExpectedStart] = useState<string>(addDaysIso(TODAY, 21))

  const [quotedFee, setQuotedFee] = useState<number | null>(lead?.quotedValue ?? null)
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState<number>(0)
  const [discountReason, setDiscountReason] = useState('')
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>('full')
  const [instalments, setInstalments] = useState<Instalment[]>([])

  const [referrerPersonId, setReferrerPersonId] = useState<PersonId | null>(
    lead?.referrerPersonId ?? null,
  )
  const [leadOwnerUserId, setLeadOwnerUserId] = useState<UserId | null>(lead?.ownerUserId ?? null)
  const [closerUserId, setCloserUserId] = useState<UserId | null>(
    lead?.closerUserId ?? (CURRENT_USER_ID as UserId),
  )

  const person = personId ? people.find((p) => p.id === personId) : undefined
  const course = courseId ? courses.find((c) => c.id === courseId) : undefined
  const cohort = cohortId ? cohorts.find((c) => c.id === cohortId) : undefined

  useEffect(() => {
    if (!course) return
    setQuotedFee((current) => (current === null ? course.listPrice : current))
    setUnitId((current) => (current === '' ? course.unitId : current))
  }, [courseId, course])

  const openCohorts = useMemo(
    () =>
      cohorts
        .filter((c) => c.courseId === courseId)
        .filter((c) => c.status === 'open' || c.status === 'planned' || c.status === 'running')
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [cohorts, courseId],
  )

  useEffect(() => {
    if (!cohortId) return
    const picked = cohortsCollection.find(cohortId)
    if (!picked) return
    setMode(picked.mode)
    setBranchId(picked.branchId)
    setUnitId(picked.unitId)
    setExpectedStart(picked.startDate)
  }, [cohortId])

  const fee = quotedFee ?? 0
  const discountAmount = computeDiscountAmount(fee, discountType, discountValue)
  const netFee = Math.max(0, fee - discountAmount)
  const discountPercent = discountPercentOf({
    quotedFee: fee,
    discountType,
    discountValue,
    discountAmount,
  })
  const threshold = discountThresholdPercent()
  const band = bandForDiscount(discountPercent)
  const needsApproval = band !== null && band.approverRoleId !== null

  useEffect(() => {
    const count = PLAN_INSTALMENT_COUNT[paymentPlan]
    const amounts = splitInstalmentAmounts(netFee, count)
    setInstalments(
      amounts.map((amount, index) => ({
        number: index + 1,
        dueDate: index === 0 ? TODAY : addDaysIso(TODAY, index * 30),
        amount: amount as Kobo,
        status: 'due' as Instalment['status'],
      })),
    )
  }, [paymentPlan, netFee])

  const allocated = instalments.reduce((acc, i) => acc + i.amount, 0)
  const balanced = allocated === netFee

  const preview: CommissionPreview[] = useMemo(() => {
    if (!unitId || !branchId || !leadOwnerUserId) return []
    return previewAdmissionCommissions({
      unitId,
      branchId,
      quotedFee: fee as Kobo,
      netFee: netFee as Kobo,
      collected: 0 as Kobo,
      referrerPersonId,
      leadOwnerUserId,
      closerUserId,
    })
  }, [unitId, branchId, fee, netFee, referrerPersonId, leadOwnerUserId, closerUserId])

  const atFullPayment = useMemo(() => {
    if (!unitId || !branchId || !leadOwnerUserId) return new Map<string, Kobo>()
    const rows = previewAdmissionCommissions({
      unitId,
      branchId,
      quotedFee: fee as Kobo,
      netFee: netFee as Kobo,
      collected: netFee as Kobo,
      referrerPersonId,
      leadOwnerUserId,
      closerUserId,
    })
    return new Map(rows.map((row) => [`${row.ruleId}-${row.beneficiaryPersonId}`, row.amount]))
  }, [unitId, branchId, fee, netFee, referrerPersonId, leadOwnerUserId, closerUserId])

  const errors = {
    person: personId ? undefined : 'Choose the person enrolling. Nobody is created here.',
    course: courseId ? undefined : 'Choose the programme.',
    cohort: cohortId ? undefined : 'Choose a cohort. The seats left are shown beside each one.',
    branch: branchId ? undefined : 'A branch is required.',
    unit: unitId ? undefined : 'Every admission carries a unit. Per-unit P&L depends on it.',
    fee: fee > 0 ? undefined : 'A quoted fee is required, even when it matches the list price.',
    discountReason:
      discountType !== 'none' && !discountReason.trim()
        ? 'A reason is required on any discount. It goes on the approval request.'
        : undefined,
    instalments: balanced
      ? undefined
      : `The instalments allocate ${formatNaira(allocated)} of ${formatNaira(netFee)}. They must balance before you continue.`,
    owner: leadOwnerUserId ? undefined : 'A lead owner is required.',
  }

  const stepValid: Record<Step, boolean> = {
    1: !errors.person,
    2: !errors.course && !errors.cohort && !errors.branch && !errors.unit,
    3: !errors.fee && !errors.discountReason && !errors.instalments,
    4: !errors.owner,
  }

  const goNext = () => {
    setTouched((t) => ({ ...t, [step]: true }))
    if (!stepValid[step]) return
    if (step < 4) setStep((step + 1) as Step)
  }

  const save = () => {
    setTouched({ 1: true, 2: true, 3: true, 4: true })
    if (!stepValid[1] || !stepValid[2] || !stepValid[3] || !stepValid[4]) return
    if (!personId || !courseId || !cohortId || !branchId || !unitId || !leadOwnerUserId) return

    setSaving(true)
    setSaveError(null)
    try {
      const result = createAdmission(
        {
          leadId: leadId ?? null,
          personId,
          courseId,
          cohortId,
          mode,
          branchId,
          unitId,
          expectedStartDate: expectedStart,
          quotedFee: fee as Kobo,
          discountType,
          discountValue,
          discountAmount: discountAmount as Kobo,
          discountReason: discountReason.trim() || null,
          netFee: netFee as Kobo,
          paymentPlan,
          instalments,
          referrerPersonId,
          leadOwnerUserId,
          closerUserId,
        },
        preview,
      )

      toast({
        tone: 'success',
        title: `Admission ${result.admission.ref} created`,
        body: result.invoice
          ? `${result.invoice.ref} issued for ${formatNaira(result.invoice.total)}. ${result.commissions.length} commission row${result.commissions.length === 1 ? '' : 's'} written.`
          : `Invoice held — ${result.approval?.ref ?? 'an approval request'} is with ${approverRoleLabel(discountPercent)}.`,
        link: { label: 'Open admission', to: `/crm/admissions/${result.admission.id}` },
      })

      navigate(`/crm/admissions/${result.admission.id}?created=1`)
    } catch {
      setSaveError('The admission could not be created. Nothing was written — try again.')
    } finally {
      setSaving(false)
    }
  }

  const unitKey = businessUnitOf(unitId || null)

  return (
    <CrmPage
      title="New admission"
      description="Four steps. Identity the person already has is never re-entered."
      breadcrumbs={[
        { label: 'Admissions', to: '/crm' },
        { label: 'Enrolled', to: '/crm/enrolled' },
        { label: 'New admission' },
      ]}
      actions={
        <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
          <Link to={lead ? `/crm/leads/${lead.id}` : '/crm/admissions'}>
            {lead ? 'Back to lead' : 'Back to admissions'}
          </Link>
        </Button>
      }
    >
      {saveError && (
        <Alert
          tone="danger"
          title="Create failed"
          className="mb-4"
          action={
            <Button size="sm" variant="secondary" onClick={save}>
              Retry
            </Button>
          }
        >
          {saveError}
        </Alert>
      )}

      <div className="grid gap-5 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
        {/* ---- progress rail ---- */}
        <nav aria-label="Admission steps">
          <ol className="flex flex-col gap-1">
            {STEPS.map((s) => {
              const state = s.index === step ? 'current' : s.index < step ? 'done' : 'todo'
              return (
                <li key={s.index}>
                  <button
                    type="button"
                    onClick={() => s.index < step && setStep(s.index)}
                    disabled={s.index > step}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={
                      state === 'current'
                        ? 'flex w-full items-start gap-2 rounded-lg bg-accent-subtle px-2.5 py-2 text-left'
                        : 'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left disabled:cursor-default'
                    }
                  >
                    <span
                      className={
                        state === 'current'
                          ? 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent text-body-12 font-bold text-on-accent'
                          : state === 'done'
                            ? 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-subtle text-accent'
                            : 'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-border text-body-12 font-bold text-text-muted'
                      }
                    >
                      {state === 'done' ? <Check size={12} aria-hidden="true" /> : s.index}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={
                          state === 'current'
                            ? 'block text-body-13 font-semibold text-accent'
                            : 'block text-body-13 font-medium text-text'
                        }
                      >
                        {s.label}
                      </span>
                      <span className="block text-body-12 text-text-secondary">{s.hint}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* ---- step content ---- */}
        <div className="min-w-0">
          {step === 1 && (
            <Card>
              <CardHeader
                title="Person"
                description={
                  lead
                    ? 'Pulled from the lead. This is the same Person record — a second one is never created.'
                    : 'Pick the person enrolling. Creating a new person happens on the lead wizard, behind the duplicate check.'
                }
              />
              <CardBody>
                <div className="flex flex-col gap-4">
                  {lead && (
                    <Alert tone="success" title={`Pulled from lead ${lead.ref} — no re-entry`}>
                      Name, email, phone, WhatsApp and location all come from the Person this lead
                      already points at. Creating this admission adds a student relationship to that
                      same record.
                    </Alert>
                  )}

                  {!lead && (
                    <Field
                      label="Person"
                      required
                      hint="Search by name, email or phone."
                      error={touched[1] ? errors.person : undefined}
                    >
                      <PersonPicker
                        value={personId}
                        onChange={setPersonId}
                        label="Person enrolling"
                      />
                    </Field>
                  )}

                  {person ? (
                    <div className="rounded-xl border border-border bg-surface-sunken p-3">
                      <PersonChip
                        name={personFullName(person)}
                        role={person.email ?? (person.phone ? formatPhone(person.phone) : 'No contact details')}
                      />
                      <KeyValueList columns={2} className="mt-3">
                        <KeyValue label="Phone" divided>
                          {person.phone ? formatPhone(person.phone) : 'Not recorded'}
                        </KeyValue>
                        <KeyValue label="WhatsApp" divided>
                          {person.whatsapp ? formatPhone(person.whatsapp) : 'Not recorded'}
                        </KeyValue>
                        <KeyValue label="Email" divided>
                          {person.email ?? 'Not recorded'}
                        </KeyValue>
                        <KeyValue label="Location" divided>
                          {`${person.city}, ${person.state}`}
                        </KeyValue>
                      </KeyValueList>
                      <div className="mt-3">
                        <h3 className="text-label-11 text-text-label">Existing relationships</h3>
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {relationships
                            .filter((r) => r.personId === person.id && r.status === 'active')
                            .map((r) => (
                              <li key={r.id}>
                                <Badge tone="neutral" variant="subtle" size="sm">
                                  {RELATIONSHIP_LABELS[r.type]}
                                </Badge>
                              </li>
                            ))}
                          {!relationships.some(
                            (r) => r.personId === person.id && r.status === 'active',
                          ) && (
                            <li className="text-body-13 text-text-secondary">
                              None recorded yet.
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <EmptyState
                      size="sm"
                      title="No person chosen"
                      message="Pick someone above, or start from a lead — that way the identity comes across with the record rather than being typed again."
                      action={
                        <Button variant="secondary" asChild>
                          <Link to="/crm/leads">Open the lead list</Link>
                        </Button>
                      }
                    />
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardHeader
                title="Programme"
                description="The cohort settles mode, branch, unit and the expected start. Every one of them stays editable."
              />
              <CardBody>
                <div className="flex flex-col gap-4">
                  <Field
                    label="Programme"
                    required
                    error={touched[2] ? errors.course : undefined}
                  >
                    <Select
                      value={courseId}
                      invalid={touched[2] && Boolean(errors.course)}
                      onChange={(event) => {
                        setCourseId(event.target.value as CourseId)
                        setCohortId('')
                      }}
                      placeholder="Choose a programme"
                      options={directory.courseOptions}
                    />
                  </Field>

                  <Field
                    label="Cohort"
                    required
                    hint="Only cohorts on this programme that are still taking students."
                    error={touched[2] ? errors.cohort : undefined}
                  >
                    {courseId ? (
                      openCohorts.length ? (
                        <Select
                          value={cohortId}
                          invalid={touched[2] && Boolean(errors.cohort)}
                          onChange={(event) => setCohortId(event.target.value as CohortId)}
                          placeholder="Choose a cohort"
                          options={openCohorts.map((c) => ({
                            value: c.id as string,
                            label: `${c.code} · starts ${formatDate(c.startDate)} · ${MODE_LABELS[c.mode]} · ${c.enrolledCount} of ${c.seats} taken`,
                          }))}
                        />
                      ) : (
                        <p className="text-body-13 text-warning-text">
                          No open cohort on this programme. Academy ops has to open one before an
                          admission can be created against it.
                        </p>
                      )
                    ) : (
                      <p className="text-body-13 text-text-secondary">Choose a programme first.</p>
                    )}
                  </Field>

                  {cohort && (
                    <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2">
                      <p className="text-body-13 text-text">
                        {cohort.scheduleSummary} · {cohort.seats - cohort.enrolledCount} seat
                        {cohort.seats - cohort.enrolledCount === 1 ? '' : 's'} left
                      </p>
                    </div>
                  )}

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Mode" required>
                      <Select
                        value={mode}
                        onChange={(event) => setMode(event.target.value as Mode)}
                        options={(Object.keys(MODE_LABELS) as Mode[]).map((m) => ({
                          value: m,
                          label: MODE_LABELS[m],
                        }))}
                      />
                    </Field>
                    <Field label="Branch" required error={touched[2] ? errors.branch : undefined}>
                      <Select
                        value={branchId}
                        invalid={touched[2] && Boolean(errors.branch)}
                        onChange={(event) => setBranchId(event.target.value as BranchId)}
                        placeholder="Choose a branch"
                        options={directory.branchOptions}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Unit"
                      required
                      hint="Tags the admission, the enrolment and every invoice line."
                      error={touched[2] ? errors.unit : undefined}
                    >
                      <Select
                        value={unitId}
                        invalid={touched[2] && Boolean(errors.unit)}
                        onChange={(event) => setUnitId(event.target.value as UnitId)}
                        placeholder="Choose a unit"
                        options={units.map((u) => ({ value: u.id as string, label: u.name }))}
                      />
                    </Field>
                    <Field label="Expected start" required>
                      <Input
                        type="date"
                        value={expectedStart}
                        onChange={(event) => setExpectedStart(event.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {step === 3 && (
            <Card>
              <CardHeader
                title="Money"
                description="Kobo throughout. The net fee is computed, and the instalments have to balance against it."
              />
              <CardBody>
                <div className="flex flex-col gap-4">
                  <Field
                    label="Quoted fee"
                    required
                    hint={course ? `List price is ${formatNaira(course.listPrice)}.` : undefined}
                    error={touched[3] ? errors.fee : undefined}
                  >
                    <CurrencyInput
                      value={quotedFee}
                      onChange={setQuotedFee}
                      invalid={touched[3] && Boolean(errors.fee)}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Discount type" required>
                      <Select
                        value={discountType}
                        onChange={(event) => {
                          const next = event.target.value as DiscountType
                          setDiscountType(next)
                          if (next === 'none') setDiscountValue(0)
                        }}
                        options={DISCOUNT_TYPES.map((t) => ({
                          value: t,
                          label: DISCOUNT_TYPE_LABELS[t],
                        }))}
                      />
                    </Field>

                    {discountType !== 'none' && (
                      <Field
                        label={discountType === 'fixed' ? 'Discount amount' : 'Discount percentage'}
                        required
                      >
                        {discountType === 'fixed' ? (
                          <CurrencyInput
                            value={discountValue}
                            onChange={(kobo) => setDiscountValue(kobo ?? 0)}
                          />
                        ) : (
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={String(discountValue)}
                            onChange={(event) => setDiscountValue(Number(event.target.value))}
                          />
                        )}
                      </Field>
                    )}
                  </div>

                  {discountType !== 'none' && (
                    <Field
                      label="Discount reason"
                      required
                      hint="Carried onto the approval request when one is raised."
                      error={touched[3] ? errors.discountReason : undefined}
                    >
                      <Textarea
                        rows={2}
                        value={discountReason}
                        invalid={touched[3] && Boolean(errors.discountReason)}
                        onChange={(event) => setDiscountReason(event.target.value)}
                        placeholder="Second sibling on the same cohort. Agreed with the branch lead."
                      />
                    </Field>
                  )}

                  {discountType !== 'none' && (
                    <div className="rounded-xl border border-border bg-surface-sunken px-3 py-2.5">
                      <p className="text-body-13 text-text-secondary">
                        Net fee{' '}
                        <span className="text-heading-20 font-semibold tabular-nums text-text">
                          {formatNaira(netFee)}
                        </span>{' '}
                        · {discountPercent}% off {formatNaira(fee)}
                      </p>
                    </div>
                  )}

                  {needsApproval && band && (
                    <Alert
                      tone="warning"
                      icon={ShieldCheck}
                      title={`A ${discountPercent}% discount exceeds the ${threshold}% threshold`}
                    >
                      This admission will be created as pending discount approval and an approval
                      request routed to {band.label} before the invoice issues. The threshold is read
                      from the active discount policy, not typed into this screen.
                    </Alert>
                  )}

                  <Separator />

                  <Field label="Payment plan" required>
                    <Select
                      value={paymentPlan}
                      onChange={(event) => setPaymentPlan(event.target.value as PaymentPlan)}
                      options={PAYMENT_PLANS.map((p) => ({
                        value: p,
                        label: PAYMENT_PLAN_LABELS[p],
                      }))}
                    />
                  </Field>

                  <div>
                    <h3 className="text-label-11 text-text-label">Instalments</h3>
                    <table className="mt-2 w-full border-separate border-spacing-0">
                      <caption className="sr-only">
                        Instalment schedule, editable, reconciled against the net fee
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-label-11 text-text-label">
                            #
                          </th>
                          <th scope="col" className="border-b border-border px-2 py-1.5 text-left text-label-11 text-text-label">
                            Due date
                          </th>
                          <th scope="col" className="border-b border-border px-2 py-1.5 text-right text-label-11 text-text-label">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {instalments.map((instalment, index) => (
                          <tr key={instalment.number}>
                            <td className="border-b border-border px-2 py-1.5 text-body-13 text-text">
                              {instalment.number}
                            </td>
                            <td className="border-b border-border px-2 py-1.5">
                              <Input
                                type="date"
                                inputSize="sm"
                                aria-label={`Instalment ${instalment.number} due date`}
                                value={instalment.dueDate}
                                onChange={(event) =>
                                  setInstalments((rows) =>
                                    rows.map((r, i) =>
                                      i === index ? { ...r, dueDate: event.target.value } : r,
                                    ),
                                  )
                                }
                              />
                            </td>
                            <td className="border-b border-border px-2 py-1.5">
                              <CurrencyInput
                                inputSize="sm"
                                aria-label={`Instalment ${instalment.number} amount`}
                                value={instalment.amount}
                                onChange={(kobo) =>
                                  setInstalments((rows) =>
                                    rows.map((r, i) =>
                                      i === index ? { ...r, amount: (kobo ?? 0) as Kobo } : r,
                                    ),
                                  )
                                }
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <p
                      className={
                        balanced
                          ? 'mt-2 text-body-13 text-success-text'
                          : 'mt-2 text-body-13 text-danger-text'
                      }
                    >
                      Allocated {formatNaira(allocated)} of {formatNaira(netFee)}
                      {balanced ? ' — balanced.' : ` — ${formatNaira(netFee - allocated)} still to allocate.`}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader
                  title="Attribution"
                  description="Three independent fields. A rule that pays the closer does not pay the referrer."
                />
                <CardBody>
                  <div className="flex flex-col gap-4">
                    <Field
                      label="Referrer"
                      optional
                      hint="Who brought this person to Cirvee. Often an alumna or a parent. May be nobody."
                    >
                      <PersonPickerRow
                        value={referrerPersonId}
                        onChange={setReferrerPersonId}
                        label="Referrer"
                        relationship="referrer"
                      />
                    </Field>

                    <Field
                      label="Lead owner"
                      required
                      hint="Who has been working the lead."
                      error={touched[4] ? errors.owner : undefined}
                    >
                      <UserPicker
                        value={leadOwnerUserId}
                        onChange={setLeadOwnerUserId}
                        invalid={touched[4] && Boolean(errors.owner)}
                        aria-label="Lead owner"
                      />
                    </Field>

                    <Field
                      label="Closer"
                      optional
                      hint="Who actually closed it. Frequently not the owner — confirm rather than accept the default."
                    >
                      <UserPicker
                        value={closerUserId}
                        onChange={setCloserUserId}
                        allowEmpty
                        emptyLabel="Nobody — not closed by a named person"
                        aria-label="Closer"
                      />
                    </Field>
                  </div>
                </CardBody>
              </Card>

              <CommissionPreviewCard rows={preview} atFullPayment={atFullPayment} />

              <Card>
                <CardHeader title="Review" description="What is about to be written." />
                <CardBody>
                  <KeyValueList columns={2}>
                    <KeyValue label="Person" divided>
                      {personFullName(person)}
                    </KeyValue>
                    <KeyValue label="From lead" divided>
                      {lead ? lead.ref : 'Direct application'}
                    </KeyValue>
                    <KeyValue label="Programme" divided>
                      {course?.title ?? '—'}
                    </KeyValue>
                    <KeyValue label="Cohort" divided>
                      {cohort?.code ?? '—'}
                    </KeyValue>
                    <KeyValue label="Mode" divided>
                      {MODE_LABELS[mode]}
                    </KeyValue>
                    <KeyValue label="Expected start" divided>
                      {formatDate(expectedStart)}
                    </KeyValue>
                    <KeyValue label="Quoted fee" divided>
                      {formatNaira(fee)}
                    </KeyValue>
                    <KeyValue label="Discount" divided>
                      {discountType === 'none'
                        ? 'None'
                        : `${formatNaira(discountAmount)} · ${discountPercent}% · ${DISCOUNT_TYPE_LABELS[discountType]}`}
                    </KeyValue>
                    <KeyValue label="Net fee" divided>
                      <span className="font-semibold">{formatNaira(netFee)}</span>
                    </KeyValue>
                    <KeyValue label="Payment plan" divided>
                      {PAYMENT_PLAN_LABELS[paymentPlan]}
                    </KeyValue>
                    <KeyValue label="Unit" divided>
                      {unitKey ? <UnitTag unit={unitKey} size="sm" /> : '—'}
                    </KeyValue>
                    <KeyValue label="Invoice" divided>
                      {needsApproval
                        ? 'Held until the discount is approved'
                        : `Issued immediately for ${formatNaira(netFee)}`}
                    </KeyValue>
                  </KeyValueList>
                </CardBody>
              </Card>
            </div>
          )}

          {/* ---- navigation ---- */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" asChild>
              <Link to={lead ? `/crm/leads/${lead.id}` : '/crm/admissions'}>Cancel</Link>
            </Button>
            <div className="flex items-center gap-2">
              {step > 1 && (
                <Button
                  variant="secondary"
                  onClick={() => setStep((step - 1) as Step)}
                  leftIcon={<ArrowLeft size={16} aria-hidden="true" />}
                >
                  Back
                </Button>
              )}
              {step < 4 ? (
                <Button onClick={goNext} rightIcon={<ArrowRight size={16} aria-hidden="true" />}>
                  Next: {STEPS[step].label.toLowerCase()}
                </Button>
              ) : (
                <Button loading={saving} onClick={save}>
                  Create admission
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ---- sticky summary ---- */}
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <Card padding="none">
            <CardHeader title="Running total" bare />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Quoted fee" divided align="right">
                  <span className="tabular-nums">{formatNaira(fee)}</span>
                </KeyValue>
                <KeyValue label="Discount" divided align="right">
                  <span className="tabular-nums text-danger-text">
                    {discountAmount ? `− ${formatNaira(discountAmount)}` : formatNaira(0)}
                  </span>
                </KeyValue>
                <KeyValue label="Net fee" divided align="right">
                  <span className="text-heading-20 font-semibold tabular-nums text-text">
                    {formatNaira(netFee)}
                  </span>
                </KeyValue>
                <KeyValue label="Plan" divided align="right">
                  {PAYMENT_PLAN_LABELS[paymentPlan]}
                </KeyValue>
                <KeyValue label="First instalment" divided align="right">
                  <span className="tabular-nums">
                    {instalments[0] ? formatNaira(instalments[0].amount) : '—'}
                  </span>
                </KeyValue>
                <KeyValue
                  label="Commission"
                  hint="At full payment, across every role on the deal"
                  align="right"
                >
                  <span className="tabular-nums">
                    {formatNaira([...atFullPayment.values()].reduce((acc, amount) => acc + amount, 0))}
                  </span>
                </KeyValue>
              </KeyValueList>

              <div className="mt-3 border-t border-border pt-3">
                {needsApproval ? (
                  <p className="flex items-start gap-1.5 text-body-12 text-warning-text">
                    <CircleAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                    Invoice held. Approval routes to {band?.label ?? 'an approver'}.
                  </p>
                ) : (
                  <p className="flex items-start gap-1.5 text-body-12 text-text-secondary">
                    <Lock size={14} aria-hidden="true" className="mt-0.5 shrink-0" />
                    Invoice issues on create. Nothing here is editable afterwards without an audit
                    entry.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>
    </CrmPage>
  )
}

function CommissionPreviewCard({
  rows,
  atFullPayment,
}: {
  rows: CommissionPreview[]
  atFullPayment: Map<string, Kobo>
}) {
  const columns: Column<CommissionPreview>[] = [
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      minWidth: 170,
      cell: (row) => <PersonChip name={row.beneficiaryName} size="sm" short />,
      sortValue: (row) => row.beneficiaryName,
    },
    {
      key: 'role',
      header: 'Role on deal',
      minWidth: 130,
      cell: (row) => (
        <Badge tone="accent" variant="subtle" size="sm">
          {ROLE_ON_DEAL_LABELS[row.roleOnDeal]}
        </Badge>
      ),
      sortValue: (row) => row.roleOnDeal,
    },
    {
      key: 'rule',
      header: 'Rule',
      minWidth: 190,
      accessor: (row) => `${row.ruleName} v${row.ruleVersion}`,
    },
    { key: 'basis', header: 'Basis', minWidth: 150, accessor: (row) => row.basis.replace(/_/g, ' ') },
    {
      key: 'rate',
      header: 'Rate',
      align: 'right',
      minWidth: 80,
      accessor: (row) => (row.rateApplied === null ? 'Flat' : `${row.rateApplied}%`),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      minWidth: 170,
      sortValue: (row) => row.amount,
      cell: (row) => {
        const full = atFullPayment.get(`${row.ruleId}-${row.beneficiaryPersonId}`) ?? row.amount
        return (
          <div>
            <span className="tabular-nums font-semibold">{formatNaira(row.amount)}</span>
            {full !== row.amount && (
              <p className="text-body-12 text-text-secondary">
                {formatNaira(full)} once fully paid
              </p>
            )}
          </div>
        )
      },
    },
    {
      key: 'state',
      header: 'Created as',
      minWidth: 200,
      cell: (row) => (
        <div className="min-w-0">
          <Badge tone={row.state === 'earned' ? 'success' : 'warning'} variant="subtle" size="sm">
            {row.state === 'earned' ? 'Earned on issue' : 'Pending'}
          </Badge>
          {row.eligibilityNote && (
            <p className="mt-0.5 text-body-12 text-text-secondary">{row.eligibilityNote}</p>
          )}
        </div>
      ),
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Commission preview"
        description="Evaluated live against the rule versions in force today. Each of the three fields is tested separately, so one admission can pay two different people."
      />
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => `${row.ruleId}-${row.beneficiaryPersonId}`}
        caption="Commissions this admission will create"
        density="compact"
        empty={
          <EmptyState
            size="sm"
            title="No commission will be created"
            message="No rule in force today matches this unit, branch and set of beneficiaries. That may be correct — or it may mean a rule version has lapsed."
          />
        }
      />
    </Card>
  )
}
