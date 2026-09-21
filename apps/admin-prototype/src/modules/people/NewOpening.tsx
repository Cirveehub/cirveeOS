import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react'

import { formatDate, formatNaira } from '@/lib/format'
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
  PageHeader,
  Select,
  Separator,
  Textarea,
} from '@/ui'
import {
  TODAY,
  addDays,
  branchesCollection,
  departmentsCollection,
  unitsCollection,
  useCollection,
} from '@/mocks'
import type { BranchId, DepartmentId, EmploymentType, Kobo, UnitId, UserId } from '@/mocks'

import { EMPLOYMENT_TYPE_LABEL, PeopleGroupTabs, Page, userName } from './shared'
import { createJobOpening, previewRoute, routeVersionFor, staffOptions } from './writes'

const TYPES: EmploymentType[] = ['full_time', 'part_time', 'contract', 'intern']

export default function NewOpening() {
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)
  const departments = useCollection(departmentsCollection)

  const [step, setStep] = useState<1 | 2>(1)
  const [touched1, setTouched1] = useState(false)
  const [touched2, setTouched2] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ ref: string; approvalRef: string | null; approvalId: string | null } | null>(null)

  const [title, setTitle] = useState('')
  const [departmentId, setDepartmentId] = useState<DepartmentId | ''>('')
  const [unitId, setUnitId] = useState<UnitId | ''>('')
  const [branchId, setBranchId] = useState<BranchId | ''>('')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('full_time')
  const [headcount, setHeadcount] = useState(1)
  const [targetStartDate, setTargetStartDate] = useState(addDays(TODAY, 45))

  const [salaryMin, setSalaryMin] = useState<number | null>(null)
  const [salaryMax, setSalaryMax] = useState<number | null>(null)
  const [hiringManagerUserId, setHiringManagerUserId] = useState<UserId | ''>('')
  const [reason, setReason] = useState('')
  const [jobDescription, setJobDescription] = useState('')

  const managers = useMemo(() => staffOptions(), [])

  const annualised = ((salaryMax ?? 0) * 12 * Math.max(1, headcount)) as Kobo
  const route = useMemo(() => previewRoute('hire', annualised), [annualised])
  const routeMeta = useMemo(() => routeVersionFor('hire'), [])

  const errors1 = {
    title: title.trim().length >= 3 ? undefined : 'Give the role a title someone would recognise.',
    department: departmentId ? undefined : 'Every requisition belongs to a department.',
    unit: unitId ? undefined : 'A unit is required — payroll cost is allocated by unit.',
    branch: branchId ? undefined : 'A branch is required.',
    headcount: headcount >= 1 ? undefined : 'Ask for at least one position.',
    targetStart: targetStartDate > TODAY ? undefined : 'A target start date in the past cannot be planned for.',
  }
  const step1Valid = Object.values(errors1).every((e) => e === undefined)

  const errors2 = {
    salaryMin: salaryMin && salaryMin > 0 ? undefined : 'The bottom of the band is required.',
    salaryMax:
      salaryMax && salaryMax > 0
        ? salaryMin && salaryMax < salaryMin
          ? 'The top of the band cannot be below the bottom.'
          : undefined
        : 'The top of the band is required — it is what the approval route is resolved against.',
    manager: hiringManagerUserId ? undefined : 'Name the hiring manager who will own this role.',
    reason: reason.trim().length >= 10 ? undefined : 'Say what is happening that makes this role necessary.',
  }
  const step2Valid = Object.values(errors2).every((e) => e === undefined)

  const save = (seekApproval: boolean) => {
    setTouched2(true)
    if (!step2Valid || !departmentId || !unitId || !branchId || !hiringManagerUserId || !salaryMin || !salaryMax) return

    setSaving(true)
    setSaveError(null)
    try {
      const result = createJobOpening({
        title,
        departmentId,
        unitId,
        branchId,
        employmentType,
        headcount,
        salaryMin: salaryMin as Kobo,
        salaryMax: salaryMax as Kobo,
        hiringManagerUserId,
        jobDescription:
          jobDescription.trim() ||
          `${title.trim()} at Cirvee, reporting to ${departments.find((d) => d.id === departmentId)?.name ?? 'the department head'}.`,
        reason,
        targetStartDate,
        seekApproval,
      })
      setSaved({
        ref: result.opening.ref,
        approvalRef: result.approval?.ref ?? null,
        approvalId: (result.approval?.id as string | undefined) ?? null,
      })
    } catch {
      setSaveError('The requisition could not be saved. Nothing was written — try again.')
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <Page>
        <PageHeader
          title="Job opening raised"
          breadcrumbs={[
            { label: 'People', to: '/people' },
            { label: 'Job openings', to: '/people/openings' },
            { label: saved.ref },
          ]}
        />
        <div className="mx-auto w-full max-w-[720px]">
          <Alert tone="success" title={`Requisition ${saved.ref} created as a draft`}>
            {saved.approvalRef
              ? `It is sitting with the first approver on request ${saved.approvalRef}. The requisition stays in draft until that request is approved — nothing can be advertised against an unapproved headcount.`
              : 'No approval was raised, so it stays a draft. Raise one before advertising the role or bringing candidates into the pipeline.'}
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/people/openings">Back to job openings</Link>
            </Button>
            {saved.approvalRef && saved.approvalId && (
              <Button variant="secondary" asChild>
                <Link to={`/work/approvals/${saved.approvalId}`}>See the approval request</Link>
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setSaved(null)
                setStep(1)
                setTitle('')
                setReason('')
                setJobDescription('')
                setSalaryMin(null)
                setSalaryMax(null)
                setHeadcount(1)
                setTouched1(false)
                setTouched2(false)
              }}
            >
              Raise another
            </Button>
          </div>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      <PageHeader
        title="Add a job opening"
        description="Two steps. The approver chain is resolved from the configured hire route as you set the band, so you can see who has to sign before you commit."
        breadcrumbs={[
          { label: 'People', to: '/people' },
          { label: 'Job openings', to: '/people/openings' },
          { label: 'Add a job opening' },
        ]}
        actions={
          <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
            <Link to="/people/openings">Back to job openings</Link>
          </Button>
        }
      />

      <PeopleGroupTabs group="hiring" active="openings" />

      <div className="mx-auto w-full max-w-[760px]">
        <ol className="mb-4 flex items-center gap-2" aria-label="Progress">
          <StepChip index={1} label="The role" state={step === 1 ? 'current' : 'done'} />
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
          <StepChip index={2} label="Band and case" state={step === 2 ? 'current' : 'todo'} />
        </ol>

        {saveError && (
          <Alert
            tone="danger"
            title="Save failed"
            className="mb-4"
            action={
              <Button size="sm" variant="secondary" onClick={() => save(true)}>
                Retry
              </Button>
            }
          >
            {saveError}
          </Alert>
        )}

        {step === 1 && (
          <Card>
            <CardHeader title="The role" description="What is being asked for, where the cost sits and where the person will report." />
            <CardBody>
              <div className="flex flex-col gap-4">
                <Field label="Job title" required error={touched1 ? errors1.title : undefined}>
                  <Input
                    value={title}
                    invalid={touched1 && Boolean(errors1.title)}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Reconciliation Officer"
                  />
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
                  <Field
                    label="Unit"
                    required
                    hint="Payroll cost is allocated by unit, so this decides whose P&L carries the role."
                    error={touched1 ? errors1.unit : undefined}
                  >
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
                  <Field label="Employment type" required>
                    <Select
                      value={employmentType}
                      options={TYPES.map((t) => ({ value: t, label: EMPLOYMENT_TYPE_LABEL[t] }))}
                      onChange={(e) => setEmploymentType(e.target.value as EmploymentType)}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Headcount" required hint="How many people this requisition is asking for." error={touched1 ? errors1.headcount : undefined}>
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={headcount}
                      invalid={touched1 && Boolean(errors1.headcount)}
                      onChange={(e) => setHeadcount(Math.max(0, Number(e.target.value)))}
                    />
                  </Field>
                  <Field label="Target start date" required error={touched1 ? errors1.targetStart : undefined}>
                    <Input
                      type="date"
                      value={targetStartDate}
                      invalid={touched1 && Boolean(errors1.targetStart)}
                      onChange={(e) => setTargetStartDate(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader title="Band and case" description="The band's ceiling, annualised across the headcount, is what the approval route is resolved against." />
              <CardBody>
                <div className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Bottom of the band" required hint="Gross, per month." error={touched2 ? errors2.salaryMin : undefined}>
                      <CurrencyInput value={salaryMin} onChange={setSalaryMin} invalid={touched2 && Boolean(errors2.salaryMin)} />
                    </Field>
                    <Field label="Top of the band" required hint="Gross, per month." error={touched2 ? errors2.salaryMax : undefined}>
                      <CurrencyInput value={salaryMax} onChange={setSalaryMax} invalid={touched2 && Boolean(errors2.salaryMax)} />
                    </Field>
                  </div>

                  <Field label="Hiring manager" required error={touched2 ? errors2.manager : undefined}>
                    <Select
                      value={hiringManagerUserId}
                      invalid={touched2 && Boolean(errors2.manager)}
                      placeholder="Choose the hiring manager"
                      options={managers}
                      onChange={(e) => setHiringManagerUserId(e.target.value as UserId)}
                    />
                  </Field>

                  <Separator />

                  <Field
                    label="Why this role is needed"
                    required
                    hint="This is the justification the approver reads. Say what is happening, not what the role is called."
                    error={touched2 ? errors2.reason : undefined}
                  >
                    <Textarea
                      rows={3}
                      value={reason}
                      invalid={touched2 && Boolean(errors2.reason)}
                      onChange={(e) => setReason(e.target.value)}
                      maxLength={300}
                      showCount
                      placeholder="Nine unmatched payments sitting on a two-person desk, and the backlog has grown every week this quarter."
                    />
                  </Field>

                  <Field label="Job description" optional hint="Defaults to a one-line summary if left blank.">
                    <Textarea
                      rows={3}
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Owns daily bank reconciliation across three accounts, escalates unmatched payments within 48 hours."
                    />
                  </Field>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="What raising this will do"
                description="Resolved live from the hire route in force today, against the band this figure falls into."
              />
              <CardBody>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-heading-24 text-text">{formatNaira(annualised)}</span>
                    <span className="text-body-13 text-text-secondary">
                      a year at the top of the band, across {Math.max(1, headcount)}{' '}
                      {headcount === 1 ? 'position' : 'positions'}
                    </span>
                  </div>

                  {route.length === 0 ? (
                    <Alert tone="warning" title="No approval route matches this amount">
                      Nothing would be routed, so the requisition can only be saved as a draft. Configure a hire route band
                      that covers this figure first.
                    </Alert>
                  ) : (
                    <div className="rounded-xl bg-surface-sunken p-4">
                      <p className="mb-3 inline-flex items-center gap-2 text-label-11 text-text-label">
                        <ShieldCheck size={14} aria-hidden="true" />
                        Approver chain{routeMeta ? ` · hire route v${routeMeta.version}` : ''}
                      </p>
                      <ol className="flex flex-col gap-2">
                        {route.map((stepItem, index) => (
                          <li key={`${stepItem.approverUserId}-${index}`} className="flex flex-wrap items-center gap-2">
                            <Badge tone="neutral" size="sm">
                              Step {index + 1}
                            </Badge>
                            <span className="text-body-13 text-text">{userName(stepItem.approverUserId)}</span>
                            <span className="text-body-12 text-text-secondary">{stepItem.thresholdLabel}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="mt-3 text-body-12 text-text-secondary">
                        The request keeps this route version even if the bands are reconfigured afterwards.
                      </p>
                    </div>
                  )}

                  <p className="text-body-13 text-text-secondary">
                    Target start {formatDate(targetStartDate)}. The requisition is created as a draft either way — approval is
                    what lets it be opened and advertised.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" asChild>
            <Link to="/people/openings">Cancel</Link>
          </Button>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <Button variant="secondary" onClick={() => setStep(1)} leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
                Back
              </Button>
            )}
            {step === 1 ? (
              <Button
                onClick={() => {
                  setTouched1(true)
                  if (step1Valid) setStep(2)
                }}
                rightIcon={<ArrowRight size={16} aria-hidden="true" />}
              >
                Next: band and case
              </Button>
            ) : (
              <>
                <Button variant="secondary" loading={saving} onClick={() => save(false)}>
                  Save as draft
                </Button>
                <Button loading={saving} disabled={route.length === 0} onClick={() => save(true)}>
                  Raise for approval
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
