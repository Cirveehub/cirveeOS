import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, ArrowRight, Paperclip } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CurrencyInput,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from '@/ui'
import {
  admissionsCollection,
  approvalRoutesCollection,
  branchesCollection,
  commissionsCollection,
  employeesCollection,
  invoicesCollection,
  jobOpeningsCollection,
  procurementRequestsCollection,
  unitsCollection,
  useCollection,
  TODAY,
} from '@/mocks'
import type { ApprovalRoute, ApprovalStep, ApprovalType, Kobo } from '@/mocks'
import { formatNaira } from '@/lib/format'
import { cn } from '@/lib/cn'
import { APPROVAL_TYPE_META, RAISABLE_TYPES, personName, useActingUser, userName, WorkGroupTabs } from './shared'
import { ImpactPreview, RouteVisualiser } from './components'
import { buildImpact, type ImpactDraft } from './impact'
import { bandFor, describeRoute, holderOfRole, previewRoute, raiseRequest, routeInForce } from './engine'

/* -------------------------------------------------------------------------- */
/* Field specification — one form engine, nine shapes                         */
/* -------------------------------------------------------------------------- */

type FieldKind = 'text' | 'money' | 'select' | 'date' | 'number' | 'textarea'

interface FieldSpec {
  name: string
  label: string
  kind: FieldKind
  required?: boolean
  hint?: string
  placeholder?: string
  /** Supplies options for `select`. */
  optionsKey?: 'invoices' | 'admissions' | 'employees' | 'units' | 'branches' | 'procurement' | 'openings' | 'commissions' | 'leaveTypes' | 'expenseCategories'
  /** The field that carries the request amount. */
  isAmount?: boolean
  /** The field that carries the related record. */
  isRelated?: boolean
}

const COMMON_TAIL: FieldSpec[] = [
  { name: 'justification', label: 'Justification', kind: 'textarea', required: true, hint: 'The approver reads this first. Say why, not what.' },
]

const FORMS: Record<string, FieldSpec[]> = {
  expense: [
    { name: 'amount', label: 'Amount', kind: 'money', required: true, isAmount: true },
    { name: 'category', label: 'Category', kind: 'select', required: true, optionsKey: 'expenseCategories' },
    { name: 'unitId', label: 'Unit', kind: 'select', required: true, optionsKey: 'units', hint: 'Every money value carries a unit. There is no "unallocated".' },
    { name: 'branchId', label: 'Branch', kind: 'select', required: true, optionsKey: 'branches' },
    { name: 'vendor', label: 'Vendor', kind: 'text', required: true, placeholder: 'Slot Systems Limited' },
    { name: 'date', label: 'Date of spend', kind: 'date', required: true },
    { name: 'budgetLine', label: 'Budget line', kind: 'text', required: true, placeholder: 'Marketing — FY2026' },
    ...COMMON_TAIL,
  ],
  refund: [
    { name: 'relatedEntityId', label: 'Invoice', kind: 'select', required: true, optionsKey: 'invoices', isRelated: true, hint: 'The invoice the money was collected against. It is never edited — a credit note is issued instead.' },
    { name: 'amount', label: 'Refund amount', kind: 'money', required: true, isAmount: true, hint: 'Watch the route panel as the amount crosses a band.' },
    ...COMMON_TAIL,
  ],
  discount: [
    { name: 'relatedEntityId', label: 'Admission', kind: 'select', required: true, optionsKey: 'admissions', isRelated: true },
    { name: 'amount', label: 'Discount value', kind: 'money', required: true, isAmount: true, hint: 'The fee forgone, in naira. Bands are configured on that value.' },
    ...COMMON_TAIL,
  ],
  leave: [
    { name: 'leaveType', label: 'Leave type', kind: 'select', required: true, optionsKey: 'leaveTypes' },
    { name: 'startDate', label: 'First day', kind: 'date', required: true },
    { name: 'leaveDays', label: 'Working days', kind: 'number', required: true },
    { name: 'cover', label: 'Cover', kind: 'text', required: true, placeholder: 'Fatima Bello covers reconciliation' },
    ...COMMON_TAIL,
  ],
  hire: [
    { name: 'relatedEntityId', label: 'Requisition', kind: 'select', required: true, optionsKey: 'openings', isRelated: true },
    { name: 'amount', label: 'Annual payroll cost', kind: 'money', required: true, isAmount: true },
    { name: 'unitId', label: 'Unit', kind: 'select', required: true, optionsKey: 'units' },
    ...COMMON_TAIL,
  ],
  salary_change: [
    { name: 'relatedEntityId', label: 'Employee', kind: 'select', required: true, optionsKey: 'employees', isRelated: true },
    { name: 'amount', label: 'Proposed annual gross', kind: 'money', required: true, isAmount: true },
    { name: 'effectiveFrom', label: 'Effective from', kind: 'date', required: true, hint: 'The current compensation version is end-dated on this date, never overwritten.' },
    ...COMMON_TAIL,
  ],
  procurement: [
    { name: 'relatedEntityId', label: 'Procurement request', kind: 'select', required: true, optionsKey: 'procurement', isRelated: true },
    { name: 'amount', label: 'Estimated cost', kind: 'money', required: true, isAmount: true },
    { name: 'vendor', label: 'Vendor', kind: 'text', placeholder: 'Slot Systems Limited' },
    { name: 'budgetLine', label: 'Budget line', kind: 'text', placeholder: 'IT equipment — FY2026' },
    ...COMMON_TAIL,
  ],
  contract_signature: [
    { name: 'counterparty', label: 'Counterparty', kind: 'text', required: true, placeholder: 'Sterling Bank Plc' },
    { name: 'amount', label: 'Contract value', kind: 'money', required: true, isAmount: true },
    { name: 'startDate', label: 'Effective from', kind: 'date', required: true },
    ...COMMON_TAIL,
  ],
  commission_dispute: [
    { name: 'relatedEntityId', label: 'Commission', kind: 'select', required: true, optionsKey: 'commissions', isRelated: true },
    { name: 'amount', label: 'Amount in dispute', kind: 'money', required: true, isAmount: true },
    ...COMMON_TAIL,
  ],
}

const LEAVE_TYPES = ['Annual', 'Study', 'Compassionate', 'Sick', 'Unpaid']
const EXPENSE_CATEGORIES = [
  'Marketing',
  'Diesel & power',
  'Refreshments',
  'IT equipment',
  'Facilities',
  'Travel',
  'Professional fees',
]

type FormValues = Record<string, string | number | null>

/* -------------------------------------------------------------------------- */
/* Threshold sentence, read off the configured route                          */
/* -------------------------------------------------------------------------- */

export function thresholdSentence(route: ApprovalRoute | undefined): string {
  if (!route || route.bands.length === 0) return 'No route configured yet.'
  if (route.bands.length === 1) {
    const steps = previewRoute(route.type, 0 as Kobo)
    return `Routes to ${steps.map((s) => s.approverRole).join(' and ') || 'nobody'} at any amount.`
  }
  const top = route.bands[route.bands.length - 1]
  const topSteps = previewRoute(route.type, top.fromAmount)
  const last = topSteps[topSteps.length - 1]
  return `Routes to ${last?.approverRole ?? 'a second approver'} above ${formatNaira(top.fromAmount)}.`
}

/* -------------------------------------------------------------------------- */

export default function RaiseRequest() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const acting = useActingUser()

  const routes = useCollection(approvalRoutesCollection)
  const invoices = useCollection(invoicesCollection)
  const admissions = useCollection(admissionsCollection)
  const employees = useCollection(employeesCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)
  const procurement = useCollection(procurementRequestsCollection)
  const openings = useCollection(jobOpeningsCollection)
  const commissions = useCollection(commissionsCollection)

  const type = (params.get('type') ?? '') as ApprovalType | ''
  const [values, setValues] = useState<FormValues>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [addedStepIds, setAddedStepIds] = useState<number[]>([])
  const previousStepCount = useRef(0)

  const fields = type ? (FORMS[type] ?? COMMON_TAIL) : []
  const amountField = fields.find((f) => f.isAmount)
  const relatedField = fields.find((f) => f.isRelated)

  const amount = amountField ? ((values[amountField.name] as number | null) ?? null) : null
  const steps: ApprovalStep[] = useMemo(
    () => (type ? previewRoute(type, (amount ?? null) as Kobo | null) : []),
    // `routes` is a dependency because republishing a route must move this panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, amount, routes],
  )

  // The demo moment: as the amount crosses a band the new step is highlighted
  // for a couple of seconds so the re-route is visible rather than silent.
  useEffect(() => {
    const before = previousStepCount.current
    previousStepCount.current = steps.length
    if (steps.length <= before) return
    setAddedStepIds(steps.slice(before).map((s) => s.sequence))
    const timer = window.setTimeout(() => setAddedStepIds([]), 2500)
    return () => window.clearTimeout(timer)
  }, [steps])

  const optionsFor = (key: FieldSpec['optionsKey']) => {
    switch (key) {
      case 'invoices':
        return invoices
          .filter((i) => i.paidAmount > 0 && i.status !== 'cancelled')
          .slice(0, 60)
          .map((i) => ({
            value: i.id as string,
            label: `${i.ref} · ${personName(i.personId)} · paid ${formatNaira(i.paidAmount)}`,
          }))
      case 'admissions':
        return admissions
          .slice(0, 60)
          .map((a) => ({ value: a.id as string, label: `${a.ref} · ${personName(a.personId)} · ${formatNaira(a.quotedFee)}` }))
      case 'employees':
        return employees
          .filter((e) => e.status !== 'exited')
          .slice(0, 60)
          .map((e) => ({ value: e.id as string, label: `${e.employeeId} · ${personName(e.personId)} · ${e.jobTitle}` }))
      case 'units':
        return units.map((u) => ({ value: u.id as string, label: u.name }))
      case 'branches':
        return branches.map((b) => ({ value: b.id as string, label: b.name }))
      case 'procurement':
        return procurement.map((p) => ({ value: p.id as string, label: `${p.ref} · ${p.item} ×${p.quantity}` }))
      case 'openings':
        return openings.map((o) => ({ value: o.id as string, label: `${o.ref} · ${o.title}` }))
      case 'commissions':
        return commissions
          .filter((c) => c.amount > 0)
          .slice(0, 60)
          .map((c) => ({ value: c.id as string, label: `${c.ref} · ${personName(c.beneficiaryPersonId)} · ${formatNaira(c.amount)}` }))
      case 'leaveTypes':
        return LEAVE_TYPES.map((l) => ({ value: l, label: l }))
      case 'expenseCategories':
        return EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))
      default:
        return []
    }
  }

  const relatedRef = (): string => {
    if (!relatedField) return '—'
    const id = values[relatedField.name] as string | undefined
    if (!id) return '—'
    const option = optionsFor(relatedField.optionsKey).find((o) => o.value === id)
    return option ? option.label.split(' · ')[0] : id
  }

  const relatedEntityType = (): string => {
    switch (type) {
      case 'refund':
        return 'Invoice'
      case 'discount':
        return 'Admission'
      case 'salary_change':
        return 'Employee'
      case 'procurement':
        return 'ProcurementRequest'
      case 'hire':
        return 'JobOpening'
      case 'commission_dispute':
        return 'Commission'
      case 'expense':
        return 'Expense'
      case 'contract_signature':
        return 'ClientOrg'
      default:
        return 'LeaveRequest'
    }
  }

  const draft: ImpactDraft | null = type
    ? {
        type,
        amount: (amount ?? null) as Kobo | null,
        relatedEntityType: relatedEntityType(),
        relatedEntityId: (values[relatedField?.name ?? ''] as string) ?? '',
        relatedEntityRef: relatedRef(),
        unitId: (values.unitId as string) ?? null,
        budgetLine: (values.budgetLine as string) ?? undefined,
        vendor: (values.vendor as string) ?? undefined,
        category: (values.category as string) ?? undefined,
        effectiveFrom: (values.effectiveFrom as string) ?? undefined,
        employeeId: type === 'salary_change' ? ((values.relatedEntityId as string) ?? undefined) : undefined,
        leaveDays: typeof values.leaveDays === 'number' ? values.leaveDays : Number(values.leaveDays ?? 0),
        leaveType: (values.leaveType as string) ?? undefined,
        counterparty: (values.counterparty as string) ?? undefined,
      }
    : null

  const impactLines = draft ? buildImpact(draft) : []

  const route = type ? routeInForce(type) : undefined

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    for (const field of fields) {
      if (!field.required) continue
      const value = values[field.name]
      if (value === undefined || value === null || value === '' || (field.kind === 'money' && value === 0)) {
        next[field.name] = `${field.label} is required.`
      }
    }
    if (steps.length === 0) {
      next.__route = 'No route band matches this request. Configure the route before raising it.'
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = (asDraft: boolean) => {
    if (!type || !draft) return
    if (!asDraft && !validate()) return

    const band = bandFor(route, (amount ?? null) as Kobo | null)

    const request = raiseRequest({
      type,
      title: buildTitle(type, values, relatedRef(), amount),
      justification: (values.justification as string) ?? 'No justification given.',
      requesterUserId: acting,
      amount: (amount ?? null) as Kobo | null,
      unitId: (values.unitId as string) ?? (units[0]?.id as string) ?? null,
      branchId: (values.branchId as string) ?? (branches[0]?.id as string) ?? null,
      relatedEntityType: relatedEntityType(),
      relatedEntityId: (values[relatedField?.name ?? ''] as string) ?? '',
      relatedEntityRef: relatedRef(),
      impact: impactLines,
      routeId: (route?.id as string) ?? '',
      routeVersion: route?.version ?? 1,
      slaHours: band?.slaHours ?? 48,
      escalatesToUserId: band?.escalateToRoleId ? holderOfRole(band.escalateToRoleId as string) : null,
      escalateAfterHours: band?.escalateAfterHours ?? 24,
      steps,
      status: asDraft ? 'withdrawn' : 'pending',
    })

    if (asDraft) {
      toast.success(`${request.ref} saved as a draft. Nothing has been routed yet.`)
      navigate('/work/requests')
    } else {
      toast.success(`${request.ref} raised. Now with ${userName(steps[0]?.approverUserId ?? null)}.`)
      navigate(`/work/approvals/${request.id}`)
    }
  }

  /* ---- Step 1 — type picker --------------------------------------------- */

  if (!type) {
    return (
      <div className="px-8 py-6">
        <PageHeader
          title="Raise request"
          description="Step 1 of 2 — pick the type. Every type runs through the same engine; only the form and the bands differ."
          breadcrumbs={[
            { label: 'Work', to: '/work' },
            { label: 'Approvals', to: '/work/approvals' },
            { label: 'Raise request' },
          ]}
          actions={
            <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/work/approvals')}>
              Cancel
            </Button>
          }
        />

        <WorkGroupTabs group="approvals" active="approvals" />

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {RAISABLE_TYPES.map((candidate) => {
            const meta = APPROVAL_TYPE_META[candidate]
            const Icon = meta.icon
            const candidateRoute = routeInForce(candidate)
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setParams({ type: candidate }, { replace: true })}
                className="rounded-xl border border-border bg-surface p-4 text-left transition-colors hover:border-border-interactive hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-accent-subtle text-accent">
                  <Icon size={18} />
                </span>
                <span className="mt-3 block text-body-15 font-semibold text-text">{meta.label}</span>
                <span className="mt-1 block text-body-13 text-text-secondary">{meta.blurb}</span>
                <span className="mt-2 block text-body-12 text-text-secondary">{thresholdSentence(candidateRoute)}</span>
              </button>
            )
          })}
        </div>

        <p className="mt-6 text-body-12 text-text-secondary">
          Commission approvals and payout batches use the same engine but are raised by the referral and finance modules
          rather than by hand.
        </p>
      </div>
    )
  }

  /* ---- Step 2 — the form, with the route computing live ------------------ */

  const meta = APPROVAL_TYPE_META[type]

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={`Raise a ${meta.label.toLowerCase()} request`}
        description="Step 2 of 2 — the route panel recomputes as the amount changes."
        breadcrumbs={[
          { label: 'Work', to: '/work' },
          { label: 'Approvals', to: '/work/approvals' },
          { label: 'Raise request', to: '/work/approvals/new' },
          { label: meta.label },
        ]}
        actions={
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => setParams({}, { replace: true })}
          >
            Change type
          </Button>
        }
      />

      <WorkGroupTabs group="approvals" active="approvals" />

      {errors.__route && (
        <Alert tone="danger" title="Nothing would be approved" className="mt-6">
          {errors.__route}
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader title={`${meta.label} details`} description={meta.blurb} />
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const error = errors[field.name]
                const value = values[field.name]
                const set = (next: string | number | null) => {
                  setValues((v) => ({ ...v, [field.name]: next }))
                  setErrors((e) => {
                    const { [field.name]: _removed, ...rest } = e
                    return rest
                  })
                }
                return (
                  <Field
                    key={field.name}
                    label={field.label}
                    required={field.required}
                    optional={!field.required}
                    hint={field.hint}
                    error={error}
                    className={field.kind === 'textarea' ? 'sm:col-span-2' : undefined}
                  >
                    {field.kind === 'money' ? (
                      <CurrencyInput
                        value={(value as number | null) ?? null}
                        onChange={set}
                        invalid={Boolean(error)}
                      />
                    ) : field.kind === 'select' ? (
                      <Select
                        placeholder={`Pick ${field.label.toLowerCase()}`}
                        value={(value as string) ?? ''}
                        onChange={(event) => set(event.target.value)}
                        options={optionsFor(field.optionsKey)}
                        invalid={Boolean(error)}
                      />
                    ) : field.kind === 'textarea' ? (
                      <Textarea
                        rows={3}
                        value={(value as string) ?? ''}
                        onChange={(event) => set(event.target.value)}
                        invalid={Boolean(error)}
                        placeholder="Withdrew after 2 weeks — pro-rata per policy."
                      />
                    ) : (
                      <Input
                        type={field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'}
                        value={(value as string) ?? (field.kind === 'date' ? TODAY : '')}
                        onChange={(event) =>
                          set(field.kind === 'number' ? Number(event.target.value) : event.target.value)
                        }
                        invalid={Boolean(error)}
                        placeholder={field.placeholder}
                      />
                    )}
                  </Field>
                )
              })}

              <Field label="Attachment" optional hint="Not wired in the prototype — the approver sees the name only." className="sm:col-span-2">
                <Button variant="secondary" leftIcon={<Paperclip size={15} />} type="button" onClick={() => toast('Not built in this prototype — this would attach a file to the request.')}>
                  Attach a file
                </Button>
              </Field>
            </CardBody>
            <CardFooter>
              <Button variant="ghost" onClick={() => navigate('/work/approvals')}>
                Cancel
              </Button>
              <Button variant="secondary" onClick={() => submit(true)}>
                Save draft
              </Button>
              <Button rightIcon={<ArrowRight size={16} />} onClick={() => submit(false)}>
                Submit
              </Button>
            </CardFooter>
          </Card>

          <ImpactPreview
            lines={impactLines}
            live
            title="What approving this will do"
            lead={
              <p className="mb-3 text-body-13 text-text-secondary">
                The approver sees exactly this panel before the decision buttons become live.
              </p>
            }
          />
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Route"
              description={route ? `${meta.label} route v${route.version}` : 'No route configured'}
              actions={<Badge tone="accent" size="sm">Live</Badge>}
            />
            <CardBody>
              <RouteVisualiser steps={steps} currentStepIndex={0} addedStepIds={addedStepIds} />
              <div
                className={cn(
                  'mt-4 rounded-xl border p-3 text-body-13',
                  steps.length === 0 ? 'border-danger-line bg-danger-fill text-danger-ink' : 'border-border bg-surface-sunken text-text-secondary',
                )}
              >
                {steps.length === 0
                  ? 'No band matches this amount. Nothing would be approved.'
                  : describeRoute(steps)}
              </div>
              <p className="mt-3 text-body-12 text-text-secondary">
                {thresholdSentence(route)} Thresholds are configuration — edit them on{' '}
                <a
                  href="/work/approval-routes"
                  className="rounded-sm text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover"
                >
                  approval routes
                </a>
                , never in code.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function buildTitle(type: ApprovalType, values: FormValues, relatedRef: string, amount: number | null): string {
  const money = amount === null ? '' : formatNaira(amount as Kobo)
  switch (type) {
    case 'refund':
      return `Refund ${money} — ${relatedRef}`
    case 'expense':
      return `${(values.category as string) ?? 'Expense'} — ${(values.vendor as string) ?? 'vendor'}`
    case 'discount':
      return `Discount ${money} — ${relatedRef}`
    case 'leave':
      return `${(values.leaveType as string) ?? 'Annual'} leave — ${values.leaveDays ?? 0} days`
    case 'hire':
      return `Hire — ${relatedRef}`
    case 'salary_change':
      return `Salary change to ${money} — ${relatedRef}`
    case 'procurement':
      return `Procurement ${money} — ${relatedRef}`
    case 'contract_signature':
      return `Contract signature — ${(values.counterparty as string) ?? relatedRef}`
    case 'commission_dispute':
      return `Commission dispute — ${relatedRef}`
    default:
      return `${APPROVAL_TYPE_META[type].label} request`
  }
}
