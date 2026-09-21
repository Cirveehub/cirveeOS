/**
 * New lead — §2.3.
 *
 * Capture, with the duplicate check happening **before anything is written**.
 * Step 1 cannot write a Person until the reviewer has answered the duplicate
 * panel, which is the gate the whole identity layer rests on.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Lock } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PersonChip,
  Select,
  Separator,
  Textarea,
} from '@/ui'
import { formatNaira } from '@/lib/format'
import {
  CURRENT_USER_ID,
  TODAY,
  branchesCollection,
  campaignsCollection,
  coursesCollection,
  leadsCollection,
  rolesCollection,
  unitsCollection,
  usersCollection,
  useCollection,
} from '@/mocks'
import type {
  BranchId,
  CampaignId,
  CourseId,
  LeadSource,
  Mode,
  Person,
  PersonId,
  UnitId,
  UserId,
} from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { DuplicatePanel } from '../components/DuplicatePanel'
import { PersonPickerRow } from '../components/Pickers'
import { toast } from '../components/Toasts'
import { findDuplicates, type DuplicateMatch } from '../lib/duplicates'
import { ALL_SOURCES, MODE_LABELS, SOURCE_LABELS, personFullName, useDirectory } from '../lib/lookups'
import {
  createLead,
  createPerson,
  emitAudit,
  logDuplicateOverride,
  nowIso,
} from '../lib/writes'

type IdentityDecision = 'pending' | 'use_existing' | 'merged' | 'override' | 'clear'

interface IdentityState {
  firstName: string
  lastName: string
  email: string
  phone: string
  whatsapp: string
  sameWhatsapp: boolean
  city: string
  state: string
}

const EMPTY_IDENTITY: IdentityState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  whatsapp: '',
  sameWhatsapp: true,
  city: '',
  state: '',
}

export default function NewLead() {
  const navigate = useNavigate()
  const directory = useDirectory()
  const leads = useCollection(leadsCollection)
  const users = useCollection(usersCollection)
  const branches = useCollection(branchesCollection)
  const units = useCollection(unitsCollection)
  const courses = useCollection(coursesCollection)
  const campaigns = useCollection(campaignsCollection)

  const [step, setStep] = useState<1 | 2>(1)
  const [identity, setIdentity] = useState<IdentityState>(EMPTY_IDENTITY)
  const [touched, setTouched] = useState(false)

  /* Duplicate state — nothing is written while this is unresolved. */
  const [checking, setChecking] = useState(false)
  const [matches, setMatches] = useState<DuplicateMatch[]>([])
  const [decision, setDecision] = useState<IdentityDecision>('clear')
  const [existingPerson, setExistingPerson] = useState<Person | null>(null)
  const [overrideNote, setOverrideNote] = useState<{ person: Person; reason: string } | null>(null)

  /* Step 2 */
  const [courseId, setCourseId] = useState<CourseId | ''>('')
  const [mode, setMode] = useState<Mode>('on_campus')
  const [branchId, setBranchId] = useState<BranchId | ''>('')
  const [unitId, setUnitId] = useState<UnitId | ''>('')
  const [source, setSource] = useState<LeadSource | ''>('')
  const [campaignId, setCampaignId] = useState<CampaignId | ''>('')
  const [utmOpen, setUtmOpen] = useState(false)
  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '', content: '', term: '' })
  const [landingPage, setLandingPage] = useState('')
  const [referrerPersonId, setReferrerPersonId] = useState<PersonId | null>(null)
  const [ownerOverride, setOwnerOverride] = useState<UserId | null>(null)
  const [nextAction, setNextActionText] = useState('')
  const [nextActionDue, setNextActionDue] = useState(
    new Date(Date.parse(`${TODAY}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10),
  )
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [step2Touched, setStep2Touched] = useState(false)

  const course = courseId ? courses.find((c) => c.id === courseId) : undefined

  /* ---- routing rule --------------------------------------------------- */

  const routing = useMemo(() => {
    const branch = branches.find((b) => b.id === branchId)
    const salesRole = rolesCollection.all().find((r) => r.name === 'Sales Executive')
    const candidates = users.filter(
      (u) =>
        u.status === 'active' &&
        (!branchId || u.primaryBranchId === branchId) &&
        (!salesRole || u.roleIds.includes(salesRole.id)),
    )
    const pool = candidates.length ? candidates : users.filter((u) => u.status === 'active')
    const ranked = [...pool].sort(
      (a, b) =>
        leads.filter((l) => l.ownerUserId === a.id).length -
        leads.filter((l) => l.ownerUserId === b.id).length,
    )
    const chosen = ranked[0]
    return {
      ownerUserId: (chosen?.id ?? CURRENT_USER_ID) as UserId,
      label: `Round-robin · ${branch ? `${branch.name} sales team` : 'all sales teams'}`,
    }
  }, [branches, branchId, users, leads])

  const ownerUserId = ownerOverride ?? routing.ownerUserId

  /* ---- duplicate check ------------------------------------------------ */

  const runDuplicateCheck = () => {
    const probe = {
      email: identity.email,
      phone: identity.phone,
      whatsapp: identity.sameWhatsapp ? identity.phone : identity.whatsapp,
      firstName: identity.firstName,
      lastName: identity.lastName,
    }
    if (!probe.email && !probe.phone && !probe.whatsapp) return
    if (decision === 'use_existing' || decision === 'merged') return

    setChecking(true)
    window.setTimeout(() => {
      const found = findDuplicates(probe)
      setMatches(found)
      setDecision(found.length ? 'pending' : 'clear')
      setChecking(false)
    }, 350)
  }

  const useExisting = (person: Person) => {
    setExistingPerson(person)
    setIdentity({
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email ?? '',
      phone: person.phone ?? '',
      whatsapp: person.whatsapp ?? '',
      sameWhatsapp: person.whatsapp === person.phone,
      city: person.city,
      state: person.state,
    })
    setDecision('use_existing')
    setMatches([])
    if (person.primaryBranchId) setBranchId(person.primaryBranchId)
    toast({
      tone: 'success',
      title: `Using the existing record for ${personFullName(person)}`,
      body: 'No new Person is created. The lead attaches to the record that already exists.',
    })
  }

  /**
   * Merge, in the pre-creation case: fold the newly typed contact details into
   * the record that already exists, one audited field at a time. There is no
   * second Person to merge, and creating one only to merge it away would be
   * exactly the bug this screen exists to prevent.
   */
  const mergeInto = (person: Person) => {
    const changes: Array<[string, string | null, string]> = []
    const whatsapp = identity.sameWhatsapp ? identity.phone : identity.whatsapp
    if (identity.email && identity.email !== person.email)
      changes.push(['email', person.email, identity.email])
    if (identity.phone && identity.phone !== person.phone)
      changes.push(['phone', person.phone, identity.phone])
    if (whatsapp && whatsapp !== person.whatsapp) changes.push(['whatsapp', person.whatsapp, whatsapp])

    changes.forEach(([field, before, after]) =>
      emitAudit({
        action: 'person.merge.field',
        entityType: 'Person',
        entityId: person.id,
        entityRef: personFullName(person),
        field,
        before,
        after,
      }),
    )

    useExisting(person)
    setDecision('merged')
    toast({
      tone: 'success',
      title: changes.length
        ? `${changes.length} field${changes.length === 1 ? '' : 's'} merged into ${personFullName(person)}`
        : `Nothing new to merge into ${personFullName(person)}`,
      body: 'Both timelines stay on the one record. Every changed field is audited.',
    })
  }

  const createAnyway = (person: Person, reason: string) => {
    setOverrideNote({ person, reason })
    setDecision('override')
    setMatches([])
    toast({
      tone: 'warning',
      title: 'A second record will be created',
      body: 'The override reason is written to the audit log against the new Person.',
    })
  }

  /* ---- validation ----------------------------------------------------- */

  const identityErrors = {
    firstName: identity.firstName.trim() ? undefined : 'A first name is required.',
    lastName: identity.lastName.trim() ? undefined : 'A last name is required.',
    contact:
      identity.email.trim() || identity.phone.trim()
        ? undefined
        : 'Give at least an email or a phone number — the duplicate check needs one.',
    email:
      identity.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identity.email.trim())
        ? 'That does not look like an email address.'
        : undefined,
  }
  const step1Valid =
    !identityErrors.firstName &&
    !identityErrors.lastName &&
    !identityErrors.contact &&
    !identityErrors.email &&
    decision !== 'pending'

  const step2Errors = {
    course: courseId ? undefined : 'Choose the course they asked about.',
    branch: branchId ? undefined : 'A branch is required.',
    unit: unitId ? undefined : 'Every lead carries a unit. Per-unit reporting depends on it.',
    source: source ? undefined : 'A source is required, and it locks on save.',
    nextAction: nextAction.trim() ? undefined : 'Every lead needs a next action.',
  }
  const step2Valid = Object.values(step2Errors).every((e) => e === undefined)

  /* ---- save ----------------------------------------------------------- */

  const save = (andAnother: boolean) => {
    setStep2Touched(true)
    if (!step2Valid || !courseId || !branchId || !unitId || !source) return

    setSaving(true)
    setSaveError(null)

    try {
      let personId: PersonId
      if (existingPerson) {
        personId = existingPerson.id
      } else {
        const created = createPerson({
          firstName: identity.firstName,
          lastName: identity.lastName,
          email: identity.email || null,
          phone: identity.phone || null,
          whatsapp: (identity.sameWhatsapp ? identity.phone : identity.whatsapp) || null,
          city: identity.city,
          state: identity.state,
          primaryBranchId: branchId,
        })
        personId = created.id
        if (overrideNote) logDuplicateOverride(created, overrideNote.person, overrideNote.reason)
      }

      const lead = createLead({
        personId,
        courseInterestId: courseId,
        mode,
        branchId,
        unitId,
        source,
        campaignId: null,
        utm: Object.fromEntries(Object.entries(utm).filter(([, v]) => v.trim())),
        landingPage: landingPage.trim() || null,
        referrerPersonId,
        ownerUserId,
        quotedValue: course?.listPrice ?? null,
        nextAction: nextAction.trim(),
        nextActionDueAt: `${nextActionDue}T09:00:00+01:00`,
        notes,
        routingRule: ownerOverride ? 'Assigned by hand during capture' : routing.label,
      })

      if (campaignId) {
        emitAudit({
          action: 'lead.campaign.attach',
          entityType: 'Lead',
          entityId: lead.id,
          entityRef: lead.ref,
          field: 'campaignId',
          before: null,
          after: campaigns.find((c) => c.id === campaignId)?.name ?? campaignId,
        })
      }

      toast({
        tone: 'success',
        title: `Lead ${lead.ref} created`,
        body: `Owner ${directory.userNameOf(ownerUserId)}. Response-time clock started at ${nowIso().slice(11, 16)}.`,
        link: { label: 'Open lead', to: `/crm/leads/${lead.id}` },
      })

      if (andAnother) {
        setIdentity(EMPTY_IDENTITY)
        setExistingPerson(null)
        setOverrideNote(null)
        setDecision('clear')
        setMatches([])
        setNotes('')
        setNextActionText('')
        setStep(1)
        setTouched(false)
        setStep2Touched(false)
      } else {
        navigate(`/crm/leads/${lead.id}`)
      }
    } catch {
      setSaveError('The lead could not be saved. Nothing was written — try again.')
    } finally {
      setSaving(false)
    }
  }

  const identityLocked = decision === 'use_existing' || decision === 'merged'

  return (
    <CrmPage
      title="New lead"
      description="Two steps. The duplicate check runs before a Person is created."
      breadcrumbs={[
        { label: 'CRM & admissions', to: '/crm' },
        { label: 'Leads', to: '/crm/leads' },
        { label: 'New lead' },
      ]}
      hideSectionNav
      actions={
        <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
          <Link to="/crm/leads">Back to leads</Link>
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-[720px]">
        <ol className="mb-4 flex items-center gap-2" aria-label="Progress">
          <StepChip index={1} label="Identity" state={step === 1 ? 'current' : 'done'} />
          <div className="h-px flex-1 bg-border" aria-hidden="true" />
          <StepChip index={2} label="Lead detail" state={step === 2 ? 'current' : 'todo'} />
        </ol>

        {saveError && (
          <Alert
            tone="danger"
            title="Save failed"
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

        {step === 1 && (
          <Card>
            <CardHeader
              title="Identity"
              description="Email, phone and WhatsApp are checked against existing people as you leave each field."
            />
            <CardBody>
              <div className="flex flex-col gap-4">
                {identityLocked && existingPerson && (
                  <Alert tone="success" title="Attached to an existing person">
                    <span className="flex flex-wrap items-center gap-2">
                      These details belong to
                      <PersonChip name={personFullName(existingPerson)} size="sm" />
                      and will not be re-entered. No new Person row is created.
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setExistingPerson(null)
                          setDecision('clear')
                        }}
                      >
                        Use different details
                      </Button>
                    </span>
                  </Alert>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="First name"
                    required
                    error={touched ? identityErrors.firstName : undefined}
                  >
                    <Input
                      value={identity.firstName}
                      disabled={identityLocked}
                      invalid={touched && Boolean(identityErrors.firstName)}
                      onChange={(e) => setIdentity({ ...identity, firstName: e.target.value })}
                      placeholder="Chiamaka"
                    />
                  </Field>
                  <Field
                    label="Last name"
                    required
                    error={touched ? identityErrors.lastName : undefined}
                  >
                    <Input
                      value={identity.lastName}
                      disabled={identityLocked}
                      invalid={touched && Boolean(identityErrors.lastName)}
                      onChange={(e) => setIdentity({ ...identity, lastName: e.target.value })}
                      placeholder="Okonkwo"
                    />
                  </Field>
                </div>

                <Field
                  label="Email"
                  hint="Checked against existing people on blur."
                  error={touched ? (identityErrors.email ?? identityErrors.contact) : undefined}
                >
                  <Input
                    type="email"
                    value={identity.email}
                    disabled={identityLocked}
                    invalid={touched && Boolean(identityErrors.email)}
                    onChange={(e) => setIdentity({ ...identity, email: e.target.value })}
                    onBlur={runDuplicateCheck}
                    placeholder="chiamaka.o@gmail.com"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone">
                    <Input
                      value={identity.phone}
                      disabled={identityLocked}
                      onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
                      onBlur={runDuplicateCheck}
                      placeholder="0803 400 1122"
                    />
                  </Field>
                  <Field label="WhatsApp number">
                    <div className="flex flex-col gap-2">
                      <Input
                        value={identity.sameWhatsapp ? identity.phone : identity.whatsapp}
                        disabled={identityLocked || identity.sameWhatsapp}
                        onChange={(e) => setIdentity({ ...identity, whatsapp: e.target.value })}
                        onBlur={runDuplicateCheck}
                        placeholder="0803 400 1122"
                      />
                      <Checkbox
                        checked={identity.sameWhatsapp}
                        disabled={identityLocked}
                        onChange={(e) =>
                          setIdentity({ ...identity, sameWhatsapp: e.target.checked })
                        }
                        label="Same as phone"
                      />
                    </div>
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" optional>
                    <Input
                      value={identity.city}
                      disabled={identityLocked}
                      onChange={(e) => setIdentity({ ...identity, city: e.target.value })}
                      placeholder="Ibadan"
                    />
                  </Field>
                  <Field label="State" optional>
                    <Input
                      value={identity.state}
                      disabled={identityLocked}
                      onChange={(e) => setIdentity({ ...identity, state: e.target.value })}
                      placeholder="Oyo"
                    />
                  </Field>
                </div>

                <DuplicatePanel
                  checking={checking}
                  matches={matches}
                  onUseExisting={useExisting}
                  onMerge={mergeInto}
                  onCreateAnyway={createAnyway}
                />

                {decision === 'override' && overrideNote && (
                  <Alert tone="warning" title="Duplicate check overridden">
                    A separate record will be created despite the match with{' '}
                    {personFullName(overrideNote.person)}. Reason: {overrideNote.reason}
                  </Alert>
                )}
              </div>
            </CardBody>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader
              title="Lead detail"
              description="Source sets both the original and the latest source. The original then locks forever."
            />
            <CardBody>
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Course of interest"
                    required
                    error={step2Touched ? step2Errors.course : undefined}
                  >
                    <Select
                      value={courseId}
                      invalid={step2Touched && Boolean(step2Errors.course)}
                      onChange={(e) => {
                        const next = e.target.value as CourseId
                        setCourseId(next)
                        const picked = courses.find((c) => c.id === next)
                        if (picked && !unitId) setUnitId(picked.unitId)
                      }}
                      placeholder="Choose a course"
                      options={directory.courseOptions}
                    />
                  </Field>
                  <Field label="Mode" required>
                    <Select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as Mode)}
                      options={(Object.keys(MODE_LABELS) as Mode[]).map((m) => ({
                        value: m,
                        label: MODE_LABELS[m],
                      }))}
                    />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Branch"
                    required
                    error={step2Touched ? step2Errors.branch : undefined}
                  >
                    <Select
                      value={branchId}
                      invalid={step2Touched && Boolean(step2Errors.branch)}
                      onChange={(e) => setBranchId(e.target.value as BranchId)}
                      placeholder="Choose a branch"
                      options={directory.branchOptions}
                    />
                  </Field>
                  <Field
                    label="Unit"
                    required
                    hint="Defaults from the course."
                    error={step2Touched ? step2Errors.unit : undefined}
                  >
                    <Select
                      value={unitId}
                      invalid={step2Touched && Boolean(step2Errors.unit)}
                      onChange={(e) => setUnitId(e.target.value as UnitId)}
                      placeholder="Choose a unit"
                      options={units.map((u) => ({ value: u.id, label: u.name }))}
                    />
                  </Field>
                </div>

                {course && (
                  <p className="text-body-13 text-text-secondary">
                    Quoted value defaults to the course list price:{' '}
                    <span className="font-semibold text-text">{formatNaira(course.listPrice)}</span>
                  </p>
                )}

                <Separator />

                <Field
                  label="Source"
                  required
                  hint="Sets both the original and the latest source. The original is immutable after save."
                  error={step2Touched ? step2Errors.source : undefined}
                >
                  <Select
                    value={source}
                    invalid={step2Touched && Boolean(step2Errors.source)}
                    onChange={(e) => setSource(e.target.value as LeadSource)}
                    placeholder="Choose a source"
                    options={ALL_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
                  />
                </Field>

                {source && (
                  <p className="inline-flex items-center gap-1.5 text-body-12 text-text-secondary">
                    <Lock size={12} aria-hidden="true" />
                    Original source will be locked to {SOURCE_LABELS[source]}. Only the latest source
                    can change later.
                  </p>
                )}

                <Field label="Campaign" optional>
                  <Select
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value as CampaignId)}
                    options={[
                      { value: '', label: 'No campaign' },
                      ...campaigns.map((c) => ({ value: c.id as string, label: c.name })),
                    ]}
                  />
                </Field>

                <div>
                  <button
                    type="button"
                    onClick={() => setUtmOpen(!utmOpen)}
                    aria-expanded={utmOpen}
                    className="inline-flex items-center gap-1 rounded-lg text-body-13 font-medium text-accent"
                  >
                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={utmOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
                    />
                    UTM set
                  </button>
                  {utmOpen && (
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(['source', 'medium', 'campaign', 'content', 'term'] as const).map((key) => (
                        <Field key={key} label={`utm_${key}`} optional>
                          <Input
                            value={utm[key]}
                            onChange={(e) => setUtm({ ...utm, [key]: e.target.value })}
                          />
                        </Field>
                      ))}
                      <Field label="Landing page" optional>
                        <Input
                          value={landingPage}
                          onChange={(e) => setLandingPage(e.target.value)}
                          placeholder="/courses/data-analysis"
                        />
                      </Field>
                    </div>
                  )}
                </div>

                <Separator />

                <Field
                  label="Referrer"
                  optional
                  hint="Who brought this lead — may be nobody. Independent of the owner and the closer."
                >
                  <PersonPickerRow
                    value={referrerPersonId}
                    onChange={setReferrerPersonId}
                    label="Referrer"
                    relationship="referrer"
                  />
                </Field>

                <Field label="Owner" required hint="Who will work this lead.">
                  <Select
                    value={ownerUserId}
                    onChange={(e) => setOwnerOverride(e.target.value as UserId)}
                    options={directory.staffOptions}
                  />
                </Field>
                <p className="-mt-2 text-body-12 text-text-secondary">
                  {ownerOverride
                    ? 'Assigned by hand, overriding the routing rule.'
                    : `${routing.label} → ${directory.userNameOf(routing.ownerUserId)}`}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Next action"
                    required
                    error={step2Touched ? step2Errors.nextAction : undefined}
                  >
                    <Input
                      value={nextAction}
                      invalid={step2Touched && Boolean(step2Errors.nextAction)}
                      onChange={(e) => setNextActionText(e.target.value)}
                      placeholder="Call to discuss cohort dates"
                    />
                  </Field>
                  <Field label="Due" required>
                    <Input
                      type="date"
                      value={nextActionDue}
                      onChange={(e) => setNextActionDue(e.target.value)}
                    />
                  </Field>
                </div>

                <Field label="Notes" optional>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Wants the October cohort. Asked about instalments."
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" asChild>
            <Link to="/crm/leads">Cancel</Link>
          </Button>

          <div className="flex items-center gap-2">
            {step === 2 && (
              <Button
                variant="secondary"
                onClick={() => setStep(1)}
                leftIcon={<ArrowLeft size={16} aria-hidden="true" />}
              >
                Back
              </Button>
            )}
            {step === 1 ? (
              <Button
                onClick={() => {
                  setTouched(true)
                  if (step1Valid) setStep(2)
                }}
                disabled={decision === 'pending'}
                rightIcon={<ArrowRight size={16} aria-hidden="true" />}
              >
                {decision === 'pending' ? 'Resolve the duplicate first' : 'Next: lead detail'}
              </Button>
            ) : (
              <>
                <Button variant="secondary" loading={saving} onClick={() => save(true)}>
                  Save and add another
                </Button>
                <Button loading={saving} onClick={() => save(false)}>
                  Save and open lead
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </CrmPage>
  )
}

function StepChip({
  index,
  label,
  state,
}: {
  index: number
  label: string
  state: 'current' | 'done' | 'todo'
}) {
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
      <span
        className={
          state === 'current' ? 'text-body-13 font-semibold text-text' : 'text-body-13 text-text-secondary'
        }
      >
        {label}
      </span>
      {state === 'done' && (
        <Badge tone="success" variant="subtle" size="sm">
          Done
        </Badge>
      )}
    </li>
  )
}
