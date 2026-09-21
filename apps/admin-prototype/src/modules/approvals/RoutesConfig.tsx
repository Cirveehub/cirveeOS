import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowDown, ArrowUp, FlaskConical, Plus, Save, Trash2 } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  CurrencyInput,
  Field,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  Select,
  Separator,
  Skeleton,
  Tabs,
} from '@/ui'
import {
  approvalRequestsCollection,
  approvalRoutesCollection,
  branchesCollection,
  rolesCollection,
  unitsCollection,
  useCollection,
  TODAY,
} from '@/mocks'
import type { ApprovalBand, ApprovalRoute, ApprovalType, Kobo } from '@/mocks'
import { routeId as asRouteId } from '@/mocks/types'
import { formatNaira } from '@/lib/format'
import { APPROVAL_TYPE_META, ALL_APPROVAL_TYPES, useActingUser, useScreenState, userName, WorkGroupTabs } from './shared'
import { describeRoute, holderOfRole, markRouteEdited, routeInForce, stepsFromBands, writeAudit } from './engine'

type Qualifiers = NonNullable<ApprovalBand['qualifiers']>

function withQualifier(band: ApprovalBand, key: keyof Qualifiers, value: string): Qualifiers {
  const next: Record<string, unknown> = { ...band.qualifiers }
  if (value) next[key] = value
  else delete next[key]
  return next as Qualifiers
}

interface BandProblem {
  index: number
  message: string
}

function validateBands(bands: ApprovalBand[]): BandProblem[] {
  const problems: BandProblem[] = []
  if (bands.length === 0) {
    problems.push({ index: -1, message: 'A route needs at least one band, or nothing can ever be approved.' })
    return problems
  }
  if (bands[0].fromAmount !== 0) {
    problems.push({ index: 0, message: 'The first band must start at ₦0, or small requests fall through the route.' })
  }
  bands.forEach((band, i) => {
    if (band.approverRoleIds.length === 0) {
      problems.push({ index: i, message: 'Pick at least one approver role.' })
    }
    if (band.toAmount !== null && band.toAmount <= band.fromAmount) {
      problems.push({ index: i, message: 'The upper bound must be above the lower bound.' })
    }
    const next = bands[i + 1]
    if (next && band.toAmount === null) {
      problems.push({ index: i, message: 'Only the last band may be open-ended.' })
    }
    if (next && band.toAmount !== null && band.toAmount !== next.fromAmount) {
      problems.push({
        index: i,
        message: `Gap or overlap: this band ends at ${formatNaira(band.toAmount)} but the next starts at ${formatNaira(next.fromAmount)}.`,
      })
    }
    if (band.slaHours <= 0) {
      problems.push({ index: i, message: 'An SLA of zero hours would breach on arrival.' })
    }
  })
  if (bands[bands.length - 1].toAmount !== null) {
    problems.push({
      index: bands.length - 1,
      message: 'The top band must be open-ended, or a large enough request has no approver.',
    })
  }
  return problems
}

export default function RoutesConfig() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const acting = useActingUser()

  const routes = useCollection(approvalRoutesCollection)
  const roles = useCollection(rolesCollection)
  const units = useCollection(unitsCollection)
  const branches = useCollection(branchesCollection)
  const requests = useCollection(approvalRequestsCollection)

  const activeType = (params.get('type') ?? 'refund') as ApprovalType
  const published = routeInForce(activeType)

  const [draft, setDraft] = useState<ApprovalBand[] | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)
  const [effectiveFrom, setEffectiveFrom] = useState(TODAY)
  const [testAmount, setTestAmount] = useState<number | null>(75_000_000)
  const [testRequesterRole, setTestRequesterRole] = useState('')

  const bands = draft ?? published?.bands ?? []
  const problems = useMemo(() => validateBands(bands), [bands])
  const dirty = draft !== null
  const inFlight = requests.filter((r) => r.routeId === published?.id && r.status === 'pending').length

  const roleOptions = roles.map((r) => ({ value: r.id as string, label: r.name }))

  const patchBand = (index: number, patch: Partial<ApprovalBand>) => {
    setDraft(bands.map((b, i) => (i === index ? { ...b, ...patch } : b)))
  }

  const addBand = () => {
    const last = bands[bands.length - 1]
    const from = last ? (last.toAmount ?? ((last.fromAmount + 10_000_000) as Kobo)) : (0 as Kobo)
    const next: ApprovalBand = {
      fromAmount: from,
      toAmount: null,
      approverRoleIds: [],
      mode: 'any_one',
      slaHours: 48,
      escalateToRoleId: null,
      escalateAfterHours: 24,
    }
    setDraft([
      ...bands.map((b, i) => (i === bands.length - 1 && b.toAmount === null ? { ...b, toAmount: from } : b)),
      next,
    ])
  }

  const removeBand = (index: number) => {
    const next = bands.filter((_, i) => i !== index)
    if (next.length > 0) next[next.length - 1] = { ...next[next.length - 1], toAmount: null }
    setDraft(next)
  }

  const moveBand = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= bands.length) return
    const next = [...bands]
    const [row] = next.splice(index, 1)
    next.splice(target, 0, row)
    setDraft(next)
  }

  const publish = () => {
    if (!published) return
    if (problems.length > 0) {
      toast.error('Fix the band problems before publishing.')
      return
    }
    const nowIso = new Date().toISOString()
    const version = published.version + 1
    const next: ApprovalRoute = {
      ...published,
      id: asRouteId(`approute-${activeType}-v${version}-${Math.random().toString(36).slice(2, 6)}`),
      version,
      effectiveFrom,
      effectiveTo: null,
      bands,
      createdAt: nowIso,
      createdBy: acting,
      updatedAt: nowIso,
      updatedBy: acting,
    }
    approvalRoutesCollection.update(published.id, { effectiveTo: effectiveFrom, updatedAt: nowIso, updatedBy: acting })
    approvalRoutesCollection.insert(next)
    markRouteEdited(next.id as string)
    writeAudit({
      actorUserId: acting,
      action: 'approval.route.publish',
      entityType: 'ApprovalRoute',
      entityId: next.id as string,
      entityRef: `${APPROVAL_TYPE_META[activeType].label} route v${version}`,
      field: 'bands',
      before: `v${published.version} · ${published.bands.length} bands`,
      after: `v${version} · ${bands.length} bands, effective ${effectiveFrom}`,
    })
    setDraft(null)
    setSaveOpen(false)
    toast.success(`${APPROVAL_TYPE_META[activeType].label} route published as v${version}.`)
  }

  const testSteps = published ? stepsFromBands({ ...published, bands }, (testAmount ?? 0) as Kobo) : []
  const matchedBand = bands.find(
    (b) => (testAmount ?? 0) >= b.fromAmount && (b.toAmount === null || (testAmount ?? 0) < b.toAmount),
  )

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Approval routes"
        description="Where the thresholds live. Nothing in this module reads a rate or a limit from code — it reads it from here."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Approval routes' }]}
        actions={
          dirty && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Discard changes
              </Button>
              <Button leftIcon={<Save size={16} />} onClick={() => setSaveOpen(true)} disabled={problems.length > 0}>
                Save new version
              </Button>
            </div>
          )
        }
      />

      <WorkGroupTabs group="approvals" active="approval-routes" />

      {error && (
        <Alert
          tone="danger"
          title="Could not load the route configuration"
          className="mt-6"
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="mt-6 space-y-4">
          <Skeleton height={44} rounded="lg" />
          <Skeleton height={280} rounded="xl" />
        </div>
      ) : error ? null : (
        <>
          <div className="mt-6">
            <Tabs
              tabs={ALL_APPROVAL_TYPES.map((t) => ({ id: t, label: APPROVAL_TYPE_META[t].label }))}
              value={activeType}
              onChange={(next) => {
                setDraft(null)
                setParams({ type: next }, { replace: true })
              }}
              variant="pill"
              size="sm"
            />
          </div>

          {!published ? (
            <Alert tone="warning" title="No route in force" className="mt-6">
              Nothing of this type can be approved until a route is published for it.
            </Alert>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="space-y-4">
                <Card>
                  <CardHeader
                    title={`${APPROVAL_TYPE_META[activeType].label} route`}
                    description={`Version ${published.version}, effective from ${published.effectiveFrom}. ${inFlight} in-flight request${inFlight === 1 ? '' : 's'} hold this version.`}
                    actions={
                      <div className="flex items-center gap-2">
                        {dirty && <Badge tone="warning" size="sm">Unpublished changes</Badge>}
                        <Badge tone="neutral" size="sm">{bands.length} bands</Badge>
                      </div>
                    }
                  />
                  <CardBody className="space-y-4">
                    {problems.length > 0 && (
                      <Alert tone="danger" title="This route would not be safe to publish">
                        <ul className="space-y-0.5">
                          {problems.map((p, i) => (
                            <li key={i}>
                              {p.index >= 0 ? `Band ${p.index + 1}: ` : ''}
                              {p.message}
                            </li>
                          ))}
                        </ul>
                      </Alert>
                    )}

                    {bands.map((band, index) => {
                      const bandProblems = problems.filter((p) => p.index === index)
                      return (
                        <div key={index} className="rounded-xl border border-border p-4">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <span className="text-body-14 font-semibold text-text">
                              Band {index + 1} ·{' '}
                              {band.toAmount === null
                                ? `${formatNaira(band.fromAmount)} and above`
                                : `${formatNaira(band.fromAmount)} – ${formatNaira(band.toAmount)}`}
                            </span>
                            <span className="flex items-center gap-1">
                              <IconButton
                                icon={ArrowUp}
                                label={`Move band ${index + 1} up`}
                                size="sm"
                                variant="ghost"
                                onClick={() => moveBand(index, -1)}
                                disabled={index === 0}
                              />
                              <IconButton
                                icon={ArrowDown}
                                label={`Move band ${index + 1} down`}
                                size="sm"
                                variant="ghost"
                                onClick={() => moveBand(index, 1)}
                                disabled={index === bands.length - 1}
                              />
                              <IconButton
                                icon={Trash2}
                                label={`Remove band ${index + 1}`}
                                size="sm"
                                variant="ghost"
                                onClick={() => removeBand(index)}
                              />
                            </span>
                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Field label="From amount">
                              <CurrencyInput
                                inputSize="sm"
                                value={band.fromAmount}
                                onChange={(v) => patchBand(index, { fromAmount: (v ?? 0) as Kobo })}
                              />
                            </Field>
                            <Field label="To amount" hint={band.toAmount === null ? 'Open-ended' : undefined}>
                              <CurrencyInput
                                inputSize="sm"
                                value={band.toAmount}
                                onChange={(v) => patchBand(index, { toAmount: v === null ? null : (v as Kobo) })}
                              />
                            </Field>
                            <Field label="SLA hours">
                              <Input
                                inputSize="sm"
                                type="number"
                                min={1}
                                value={band.slaHours}
                                onChange={(e) => patchBand(index, { slaHours: Number(e.target.value) })}
                              />
                            </Field>
                            <Field label="Decision mode">
                              <Select
                                selectSize="sm"
                                value={band.mode}
                                onChange={(e) => patchBand(index, { mode: e.target.value as ApprovalBand['mode'] })}
                                options={[
                                  { value: 'any_one', label: 'Any one approves' },
                                  { value: 'all_must_approve', label: 'All must approve' },
                                ]}
                              />
                            </Field>
                          </div>

                          <fieldset className="mt-3">
                            <legend className="text-label-11 text-text-label">Approver roles</legend>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                              {roles.slice(0, 12).map((role) => (
                                <Checkbox
                                  key={role.id}
                                  size="sm"
                                  label={role.name}
                                  checked={band.approverRoleIds.includes(role.id)}
                                  onChange={(event) =>
                                    patchBand(index, {
                                      approverRoleIds: event.target.checked
                                        ? [...band.approverRoleIds, role.id]
                                        : band.approverRoleIds.filter((r) => r !== role.id),
                                    })
                                  }
                                />
                              ))}
                            </div>
                          </fieldset>

                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <Field label="Escalates to">
                              <Select
                                selectSize="sm"
                                placeholder="No escalation"
                                value={(band.escalateToRoleId as string) ?? ''}
                                onChange={(e) =>
                                  patchBand(index, {
                                    escalateToRoleId: (e.target.value || null) as ApprovalBand['escalateToRoleId'],
                                  })
                                }
                                options={roleOptions}
                              />
                            </Field>
                            <Field label="Escalates after (hours)">
                              <Input
                                inputSize="sm"
                                type="number"
                                min={0}
                                value={band.escalateAfterHours}
                                onChange={(e) => patchBand(index, { escalateAfterHours: Number(e.target.value) })}
                              />
                            </Field>
                            <Field label="Only for unit" optional>
                              <Select
                                selectSize="sm"
                                placeholder="Any unit"
                                value={(band.qualifiers?.unitId as string) ?? ''}
                                onChange={(e) =>
                                  patchBand(index, {
                                    qualifiers: withQualifier(band, 'unitId', e.target.value),
                                  })
                                }
                                options={units.map((u) => ({ value: u.id as string, label: u.name }))}
                              />
                            </Field>
                            <Field label="Only for branch" optional>
                              <Select
                                selectSize="sm"
                                placeholder="Any branch"
                                value={(band.qualifiers?.branchId as string) ?? ''}
                                onChange={(e) =>
                                  patchBand(index, {
                                    qualifiers: withQualifier(band, 'branchId', e.target.value),
                                  })
                                }
                                options={branches.map((b) => ({ value: b.id as string, label: b.name }))}
                              />
                            </Field>
                          </div>

                          {bandProblems.length > 0 && (
                            <p className="mt-2 text-body-13 text-danger-text">
                              {bandProblems.map((p) => p.message).join(' ')}
                            </p>
                          )}

                          <Separator className="mt-3" />
                          <p className="mt-2 text-body-12 text-text-secondary">
                            Resolves to:{' '}
                            {band.approverRoleIds.length === 0
                              ? 'nobody — this band cannot approve anything'
                              : band.approverRoleIds
                                  .map((r) => userName(holderOfRole(r as string)))
                                  .join(band.mode === 'all_must_approve' ? ' then ' : ' or ')}
                          </p>
                        </div>
                      )
                    })}
                  </CardBody>
                  <CardFooter align="start">
                    <Button variant="secondary" leftIcon={<Plus size={16} />} onClick={addBand}>
                      Add band
                    </Button>
                  </CardFooter>
                </Card>
              </div>

              <div className="space-y-4">
                <Card>
                  <CardHeader
                    title="Test harness"
                    description="Resolve the bands above against a hypothetical request before publishing."
                    actions={<FlaskConical size={16} className="text-text-secondary" />}
                  />
                  <CardBody className="space-y-3">
                    <Field label="Amount">
                      <CurrencyInput value={testAmount} onChange={setTestAmount} />
                    </Field>
                    <Field label="Raised by" optional hint="Qualifiers on requester role are configured per band.">
                      <Select
                        placeholder="Any role"
                        value={testRequesterRole}
                        onChange={(e) => setTestRequesterRole(e.target.value)}
                        options={roleOptions}
                      />
                    </Field>
                    <div className="rounded-xl border border-border bg-surface-sunken p-3">
                      <p className="text-label-11 text-text-label">Result</p>
                      <p className="mt-1 text-body-14 text-text">
                        A {formatNaira((testAmount ?? 0) as Kobo)} {APPROVAL_TYPE_META[activeType].label.toLowerCase()}{' '}
                        request
                        {testRequesterRole ? ` raised by a ${roles.find((r) => r.id === testRequesterRole)?.name}` : ''}{' '}
                        routes: {describeRoute(testSteps)}
                      </p>
                      {matchedBand && (
                        <p className="mt-2 text-body-12 text-text-secondary">
                          Matched band {bands.indexOf(matchedBand) + 1} · SLA {matchedBand.slaHours}h ·{' '}
                          {matchedBand.escalateToRoleId
                            ? `escalates to ${userName(holderOfRole(matchedBand.escalateToRoleId as string))} after ${matchedBand.escalateAfterHours}h`
                            : 'no escalation target'}
                        </p>
                      )}
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader title="Version history" description="Routes are effective-dated, never overwritten." />
                  <CardBody>
                    <ul className="space-y-2">
                      {routes
                        .filter((r) => r.type === activeType)
                        .sort((a, b) => b.version - a.version)
                        .map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2 text-body-13">
                            <span className="text-text">v{r.version}</span>
                            <span className="text-text-secondary">
                              {r.effectiveFrom} → {r.effectiveTo ?? 'in force'}
                            </span>
                            <Badge tone={r.effectiveTo === null ? 'success' : 'neutral'} size="sm">
                              {r.effectiveTo === null ? 'In force' : 'Superseded'}
                            </Badge>
                          </li>
                        ))}
                    </ul>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Publish a new route version"
        description="Existing in-flight requests keep the route version they were raised under."
        footer={
          <>
            <Button variant="secondary" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={publish}>Publish v{(published?.version ?? 0) + 1}</Button>
          </>
        }
      >
        <KeyValueList columns={2}>
          <KeyValue label="Type">{APPROVAL_TYPE_META[activeType].label}</KeyValue>
          <KeyValue label="New version">{`v${(published?.version ?? 0) + 1}`}</KeyValue>
          <KeyValue label="Bands">{bands.length}</KeyValue>
          <KeyValue label="In-flight requests kept on v">{`${published?.version} · ${inFlight} request${inFlight === 1 ? '' : 's'}`}</KeyValue>
        </KeyValueList>
        <Field className="mt-4" label="Effective from" required hint="The current version is end-dated on this day. Nothing is overwritten.">
          <Input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
        </Field>
        <p className="mt-3 text-body-13 text-text-secondary">
          After publishing, a new request of this type resolves through v{(published?.version ?? 0) + 1}. The{' '}
          {inFlight} request{inFlight === 1 ? '' : 's'} already moving keep v{published?.version} and their original
          approver chain.
        </p>
      </Modal>
    </div>
  )
}
