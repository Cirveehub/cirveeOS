import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Lock } from 'lucide-react'

import { formatDate, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CurrencyInput,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  PageHeader,
  Select,
  Separator,
} from '@/ui'
import {
  TODAY,
  addDays,
  branchesCollection,
  candidatesCollection,
  departmentsCollection,
  jobOpeningsCollection,
  offersCollection,
  unitsCollection,
  useCollection,
} from '@/mocks'
import type { BranchId, CandidateId, DepartmentId, Kobo, UnitId, UserId } from '@/mocks'

import { PeopleGroupTabs, Page, isClosedStage, personName, userName } from './shared'
import { createOffer, staffOptions } from './writes'

interface AllowanceDraft {
  label: string
  amount: number | null
}

const DEFAULT_ALLOWANCES: AllowanceDraft[] = [
  { label: 'Housing', amount: null },
  { label: 'Transport', amount: null },
  { label: 'Data', amount: null },
]

export default function NewOffer() {
  const routerNavigate = useNavigate()
  const [params] = useSearchParams()

  const candidates = useCollection(candidatesCollection)
  const openings = useCollection(jobOpeningsCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)
  const departments = useCollection(departmentsCollection)
  const offers = useCollection(offersCollection)

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [touched1, setTouched1] = useState(false)
  const [touched2, setTouched2] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [candidateId, setCandidateId] = useState<string>(params.get('candidate') ?? '')
  const [jobTitle, setJobTitle] = useState('')
  const [unitId, setUnitId] = useState<UnitId | ''>('')
  const [branchId, setBranchId] = useState<BranchId | ''>('')
  const [departmentId, setDepartmentId] = useState<DepartmentId | ''>('')
  const [managerUserId, setManagerUserId] = useState<UserId | ''>('')

  const [baseSalary, setBaseSalary] = useState<number | null>(null)
  const [allowances, setAllowances] = useState<AllowanceDraft[]>(DEFAULT_ALLOWANCES)
  const [startDate, setStartDate] = useState(addDays(TODAY, 30))
  const [probationMonths, setProbationMonths] = useState(6)
  const [expiresAt, setExpiresAt] = useState(addDays(TODAY, 14))

  const managers = useMemo(() => staffOptions(), [])

  const eligible = useMemo(
    () =>
      candidates.filter(
        (c) =>
          !isClosedStage(c.stage) &&
          !offers.some((o) => o.candidateId === c.id && ['draft', 'issued', 'accepted'].includes(o.status)),
      ),
    [candidates, offers],
  )

  const candidate = candidates.find((c) => c.id === candidateId)
  const opening = candidate ? openings.find((o) => o.id === candidate.openingId) : undefined

  const applyOpeningDefaults = (nextCandidateId: string) => {
    setCandidateId(nextCandidateId)
    const next = candidates.find((c) => c.id === nextCandidateId)
    const nextOpening = next ? openings.find((o) => o.id === next.openingId) : undefined
    if (!nextOpening) return
    setJobTitle(nextOpening.title)
    setUnitId(nextOpening.unitId)
    setBranchId(nextOpening.branchId)
    setDepartmentId(nextOpening.departmentId)
    setManagerUserId(nextOpening.hiringManagerUserId)
    const midpoint = Math.round((nextOpening.salaryMin + nextOpening.salaryMax) / 2)
    setBaseSalary(Math.round(midpoint * 0.6))
    setAllowances([
      { label: 'Housing', amount: Math.round(midpoint * 0.2) },
      { label: 'Transport', amount: Math.round(midpoint * 0.13) },
      { label: 'Data', amount: Math.round(midpoint * 0.07) },
    ])
    setStartDate(nextOpening.targetStartDate)
  }

  const allowanceTotal = allowances.reduce((acc, a) => acc + (a.amount ?? 0), 0)
  const gross = (baseSalary ?? 0) + allowanceTotal

  const inBand =
    opening && gross > 0 ? gross >= opening.salaryMin && gross <= opening.salaryMax : true

  const errors1 = {
    candidate: candidateId ? undefined : 'Choose the candidate this offer is for.',
    title: jobTitle.trim() ? undefined : 'The job title on the letter is required.',
    unit: unitId ? undefined : 'A unit is required — payroll cost is allocated by unit.',
    branch: branchId ? undefined : 'A branch is required.',
    department: departmentId ? undefined : 'A department is required.',
    manager: managerUserId ? undefined : 'Name the manager they will report to.',
  }
  const step1Valid = Object.values(errors1).every((e) => e === undefined)

  const errors2 = {
    base: baseSalary && baseSalary > 0 ? undefined : 'A base salary is required — payroll has nothing to calculate from without it.',
    startDate: startDate >= TODAY ? undefined : 'A start date in the past cannot be offered.',
    expiry: expiresAt > TODAY ? undefined : 'Give the candidate a real window to respond in.',
  }
  const step2Valid = Object.values(errors2).every((e) => e === undefined)

  const save = (issueNow: boolean) => {
    setTouched2(true)
    if (!step2Valid || !candidateId || !unitId || !branchId || !departmentId || !managerUserId || !baseSalary) return
    setSaving(true)
    setSaveError(null)
    try {
      const offer = createOffer({
        candidateId: candidateId as CandidateId,
        jobTitle,
        unitId,
        branchId,
        departmentId,
        managerUserId,
        baseSalary: baseSalary as Kobo,
        allowances: allowances.filter((a) => (a.amount ?? 0) > 0).map((a) => ({ label: a.label, amount: a.amount as Kobo })),
        startDate,
        probationMonths,
        expiresAt,
        issueNow,
      })
      routerNavigate(`/people/offers?created=${encodeURIComponent(offer.ref)}`)
    } catch {
      setSaveError('The offer could not be generated. Nothing was written — try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Page>
      <PageHeader
        title="Generate an offer"
        description="Three steps. The letter is rendered from the offer-letter template and the terms you set, and you see it before anything is committed."
        breadcrumbs={[
          { label: 'People', to: '/people' },
          { label: 'Offers', to: '/people/offers' },
          { label: 'Generate an offer' },
        ]}
        actions={
          <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
            <Link to="/people/offers">Back to offers</Link>
          </Button>
        }
      />

      <PeopleGroupTabs group="hiring" active="offers" />

      <div className="mx-auto w-full max-w-[760px]">
        <ol className="mb-4 flex items-center gap-2" aria-label="Progress">
          <StepChip index={1} label="Role" state={step === 1 ? 'current' : 'done'} />
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
          <StepChip index={2} label="Terms" state={step === 2 ? 'current' : step > 2 ? 'done' : 'todo'} />
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
          <StepChip index={3} label="Review" state={step === 3 ? 'current' : 'todo'} />
        </ol>

        {saveError && (
          <Alert
            tone="danger"
            title="Could not generate the offer"
            className="mb-4"
            action={
              <Button size="sm" variant="secondary" onClick={() => save(false)}>
                Retry
              </Button>
            }
          >
            {saveError}
          </Alert>
        )}

        {eligible.length === 0 && (
          <Alert tone="info" title="No candidate is waiting on an offer" className="mb-4">
            Every live candidate either already holds an open offer or has been closed out. An offer is generated against a
            candidate, so there is nothing to generate one for.
          </Alert>
        )}

        {step === 1 && (
          <Card>
            <CardHeader title="Who, and for what role" description="Choosing the candidate fills the rest of this step from the opening they applied against." />
            <CardBody>
              <div className="flex flex-col gap-4">
                <Field label="Candidate" required error={touched1 ? errors1.candidate : undefined}>
                  <Select
                    value={candidateId}
                    invalid={touched1 && Boolean(errors1.candidate)}
                    placeholder="Choose a candidate"
                    options={eligible.map((c) => ({
                      value: c.id as string,
                      label: `${personName(c.personId)} · ${openings.find((o) => o.id === c.openingId)?.title ?? 'Opening withdrawn'}`,
                    }))}
                    onChange={(e) => applyOpeningDefaults(e.target.value)}
                  />
                </Field>

                <Field label="Job title" required hint="What appears on the letter." error={touched1 ? errors1.title : undefined}>
                  <Input value={jobTitle} invalid={touched1 && Boolean(errors1.title)} onChange={(e) => setJobTitle(e.target.value)} />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Department" required error={touched1 ? errors1.department : undefined}>
                    <Select
                      value={departmentId}
                      invalid={touched1 && Boolean(errors1.department)}
                      placeholder="Choose a department"
                      options={departments.map((d) => ({ value: d.id as string, label: d.name }))}
                      onChange={(e) => setDepartmentId(e.target.value as DepartmentId)}
                    />
                  </Field>
                  <Field label="Unit" required error={touched1 ? errors1.unit : undefined}>
                    <Select
                      value={unitId}
                      invalid={touched1 && Boolean(errors1.unit)}
                      placeholder="Choose a unit"
                      options={units.map((u) => ({ value: u.id as string, label: u.name }))}
                      onChange={(e) => setUnitId(e.target.value as UnitId)}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Branch" required error={touched1 ? errors1.branch : undefined}>
                    <Select
                      value={branchId}
                      invalid={touched1 && Boolean(errors1.branch)}
                      placeholder="Choose a branch"
                      options={branches.map((b) => ({ value: b.id as string, label: b.name }))}
                      onChange={(e) => setBranchId(e.target.value as BranchId)}
                    />
                  </Field>
                  <Field label="Reports to" required error={touched1 ? errors1.manager : undefined}>
                    <Select
                      value={managerUserId}
                      invalid={touched1 && Boolean(errors1.manager)}
                      placeholder="Choose a manager"
                      options={managers}
                      onChange={(e) => setManagerUserId(e.target.value as UserId)}
                    />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader
              title="Terms"
              description="Base plus allowances make the gross, and the gross is what the first compensation version will be written from if they resume."
            />
            <CardBody>
              <div className="flex flex-col gap-4">
                <Field label="Base salary" required hint="Gross, per month." error={touched2 ? errors2.base : undefined}>
                  <CurrencyInput value={baseSalary} onChange={setBaseSalary} invalid={touched2 && Boolean(errors2.base)} />
                </Field>

                <fieldset className="rounded-xl border border-border p-4">
                  <legend className="px-1 text-label-11 text-text-label">Allowances</legend>
                  <div className="flex flex-col gap-3">
                    {allowances.map((allowance, index) => (
                      <Field key={allowance.label} label={allowance.label} optional>
                        <CurrencyInput
                          value={allowance.amount}
                          onChange={(value) =>
                            setAllowances((prev) => prev.map((a, i) => (i === index ? { ...a, amount: value } : a)))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                  <p className="mt-3 text-body-13 text-text-secondary">
                    Allowances total <span className="font-semibold text-text">{formatNaira(allowanceTotal)}</span>, gross{' '}
                    <span className="font-semibold text-text">{formatNaira(gross)}</span> per month.
                  </p>
                </fieldset>

                {opening && gross > 0 && !inBand && (
                  <Alert tone="warning" title="Outside the approved band">
                    The requisition {opening.ref} was approved at {formatNaira(opening.salaryMin)} –{' '}
                    {formatNaira(opening.salaryMax)}. This offer is {formatNaira(gross)}. That is allowed, but it is a
                    different decision from the one that was approved and will read that way on the record.
                  </Alert>
                )}

                <Separator />

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Start date" required error={touched2 ? errors2.startDate : undefined}>
                    <Input type="date" value={startDate} invalid={touched2 && Boolean(errors2.startDate)} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  <Field label="Probation" required hint="Months.">
                    <Select
                      value={String(probationMonths)}
                      options={[0, 3, 6, 12].map((m) => ({ value: String(m), label: m === 0 ? 'No probation' : `${m} months` }))}
                      onChange={(e) => setProbationMonths(Number(e.target.value))}
                    />
                  </Field>
                  <Field label="Offer expires" required error={touched2 ? errors2.expiry : undefined}>
                    <Input type="date" value={expiresAt} invalid={touched2 && Boolean(errors2.expiry)} onChange={(e) => setExpiresAt(e.target.value)} />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="The letter that will be generated" description="Rendered from the offer-letter template, version 3." />
              <CardBody>
                <div className="rounded-xl border border-border bg-surface-sunken p-6">
                  <p className="text-body-14 text-text">Dear {candidate ? personName(candidate.personId).split(' ')[0] : 'candidate'},</p>
                  <p className="mt-3 text-body-14 text-text">
                    We are pleased to offer you the role of <span className="font-semibold">{jobTitle || 'the role'}</span> at a
                    gross monthly salary of <span className="font-semibold">{formatNaira(gross)}</span>, starting{' '}
                    <span className="font-semibold">{formatDate(startDate)}</span>
                    {probationMonths > 0 ? `, subject to a probationary period of ${formatNumber(probationMonths)} months` : ''}.
                  </p>
                  <p className="mt-3 text-body-13 text-text-secondary">
                    This offer is open until {formatDate(expiresAt)}.
                  </p>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="What this will and will not do" description="Read this before issuing." />
              <CardBody>
                <KeyValueList columns={2}>
                  <KeyValue label="Candidate">{candidate ? personName(candidate.personId) : '—'}</KeyValue>
                  <KeyValue label="Moves the candidate to">
                    <Badge tone="accent" size="sm">
                      Offer
                    </Badge>
                  </KeyValue>
                  <KeyValue label="Reports to">{userName(managerUserId || null)}</KeyValue>
                  <KeyValue label="Unit">{units.find((u) => u.id === unitId)?.name ?? '—'}</KeyValue>
                  <KeyValue label="Gross, per month" hint="Behind a restricted view in production.">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock size={12} aria-hidden="true" className="text-text-secondary" />
                      {formatNaira(gross)}
                    </span>
                  </KeyValue>
                  <KeyValue label="Document">Offer of employment, template v3</KeyValue>
                </KeyValueList>

                <Alert tone="info" className="mt-4" title="No employee record will be created">
                  Not when this is issued, and not when the candidate accepts. An employment record only exists once somebody
                  records that they actually resumed — so an offer accepted and then never taken up closes as lapsed with
                  nothing downstream to unwind.
                </Alert>
              </CardBody>
            </Card>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" asChild>
            <Link to="/people/offers">Cancel</Link>
          </Button>

          <div className="flex items-center gap-2">
            {step > 1 && (
              <Button variant="secondary" onClick={() => setStep(step === 3 ? 2 : 1)} leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
                Back
              </Button>
            )}
            {step === 1 && (
              <Button
                onClick={() => {
                  setTouched1(true)
                  if (step1Valid) setStep(2)
                }}
                rightIcon={<ArrowRight size={16} aria-hidden="true" />}
              >
                Next: terms
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => {
                  setTouched2(true)
                  if (step2Valid) setStep(3)
                }}
                rightIcon={<ArrowRight size={16} aria-hidden="true" />}
              >
                Next: review the letter
              </Button>
            )}
            {step === 3 && (
              <>
                <Button variant="secondary" loading={saving} onClick={() => save(false)}>
                  Save as draft
                </Button>
                <Button loading={saving} onClick={() => save(true)}>
                  Generate and issue
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </Page>
  )
}

function StepChip({ index, label, state }: { index: number; label: string; state: 'current' | 'done' | 'todo' }) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={
          state === 'current'
            ? 'grid size-6 place-items-center rounded-full bg-accent text-body-12 font-bold text-on-accent'
            : state === 'done'
              ? 'grid size-6 place-items-center rounded-full bg-accent-subtle text-accent'
              : 'grid size-6 place-items-center rounded-full border border-border text-body-12 font-bold text-text-muted'
        }
      >
        {state === 'done' ? <Check size={13} aria-hidden="true" /> : index}
      </span>
      <span className={state === 'current' ? 'text-body-13 font-semibold text-text' : 'text-body-13 text-text-secondary'}>{label}</span>
    </li>
  )
}
