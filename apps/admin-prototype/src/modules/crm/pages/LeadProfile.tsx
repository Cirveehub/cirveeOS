import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  Clock,
  FileText,
  GraduationCap,
  Lock,
  MessageSquare,
  Phone,
  Target,
  TriangleAlert,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  DataTable,
  EmptyState,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  PersonChip,
  Select,
  SkeletonCard,
  StatusBadge,
  Textarea,
  Timeline,
  UnitTag,
  type Column,
  type TimelineItem,
} from '@/ui'
import { formatDate, formatDateTime, formatNaira, formatPhone } from '@/lib/format'
import {
  TODAY,
  activitiesCollection,
  auditEventsCollection,
  admissionsCollection,
  followUpsCollection,
  invoicesCollection,
  leadsCollection,
  relationshipsCollection,
  useCollection,
  useRecord,
} from '@/mocks'
import type {
  Activity,
  ActivityType,
  AuditEvent,
  CallOutcome,
  FollowUp,
  Invoice,
  LeadStage,
  LossReason,
  PersonId,
  UserId,
} from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { ThreePeople } from '../components/ThreePeople'
import {
  ChangeReferrerModal,
  LossReasonModal,
  ReassignOwnerModal,
  SetCloserModal,
} from '../components/LeadModals'
import { toast } from '../components/Toasts'
import {
  EXIT_STAGES,
  OPEN_STAGES,
  RELATIONSHIP_LABELS,
  SOURCE_LABELS,
  STAGE_LABELS,
  ageTone,
  branchName,
  businessUnitOf,
  courseTitle,
  formatMinutes,
  personFullName,
  useDirectory,
} from '../lib/lookups'
import { useQueryState, useScreenLoad } from '../lib/view-state'
import {
  addDaysIso,
  changeStage,
  createFollowUp,
  completeFollowUp,
  logActivity,
  reassignOwner,
  recordLeadTouch,
  setCloser,
  setReferrer,
} from '../lib/writes'

const TABS = [
  { id: 'activity', label: 'Activity' },
  { id: 'follow-ups', label: 'Follow-ups' },
  { id: 'admission', label: 'Admission' },
  { id: 'finance', label: 'Finance' },
  { id: 'audit', label: 'Audit' },
] as const

const ACTIVITY_TYPES: Array<{ value: ActivityType; label: string }> = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
]

const CALL_OUTCOMES: Array<{ value: CallOutcome; label: string }> = [
  { value: 'connected', label: 'Connected' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Busy' },
  { value: 'wrong_number', label: 'Wrong number' },
]

const ACTIVITY_ICON: Record<ActivityType, typeof Phone> = {
  note: FileText,
  call: Phone,
  whatsapp: MessageSquare,
  email: MessageSquare,
  meeting: Clock,
  sms: MessageSquare,
  system: CircleCheck,
}

export default function LeadProfile() {
  const { id = '' } = useParams<{ id: string }>()
  const query = useQueryState()
  const { loading, error, retry } = useScreenLoad(`crm.lead.${id}`)
  const directory = useDirectory()

  const lead = useRecord(leadsCollection, id)
  const activities = useCollection(activitiesCollection)
  const followUps = useCollection(followUpsCollection)
  const admissions = useCollection(admissionsCollection)
  const invoices = useCollection(invoicesCollection)
  const audits = useCollection(auditEventsCollection)
  const relationships = useCollection(relationshipsCollection)

  const [lossOpen, setLossOpen] = useState(false)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [referrerOpen, setReferrerOpen] = useState(false)
  const [closerOpen, setCloserOpen] = useState(false)

  const tab = TABS.some((t) => t.id === query.get('tab'))
    ? (query.get('tab') as string)
    : 'activity'

  const person = lead ? directory.personById.get(lead.personId as string) : undefined

  const leadActivities = useMemo(
    () =>
      activities
        .filter((a) => a.subjectType === 'lead' && a.subjectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activities, id],
  )

  const leadFollowUps = useMemo(
    () => followUps.filter((f) => (f.leadId as string) === id).sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    [followUps, id],
  )

  const admission = useMemo(() => admissions.find((a) => (a.leadId as string) === id), [admissions, id])

  const personInvoices = useMemo(
    () => (lead ? invoices.filter((i) => i.personId === lead.personId) : []),
    [invoices, lead],
  )

  const leadAudits = useMemo(
    () =>
      audits
        .filter((a) => a.entityId === id || (lead ? a.entityId === (lead.personId as string) : false))
        .sort((a, b) => b.at.localeCompare(a.at)),
    [audits, id, lead],
  )

  const otherRelationships = useMemo(
    () =>
      lead
        ? relationships.filter((r) => r.personId === lead.personId && r.status === 'active')
        : [],
    [relationships, lead],
  )

  if (loading) {
    return (
      <CrmPage
        title="Lead"
        breadcrumbs={[{ label: 'CRM & admissions', to: '/crm' }, { label: 'Leads', to: '/crm/leads' }]}
      >
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </CrmPage>
    )
  }

  if (!lead) {
    return (
      <CrmPage
        title="Lead not found"
        breadcrumbs={[{ label: 'CRM & admissions', to: '/crm' }, { label: 'Leads', to: '/crm/leads' }]}
      >
        <EmptyState
          icon={Target}
          variant="error"
          title="That lead does not exist"
          message="The reference may have been merged into another person, or the link is out of date. The lead list has every live lead."
          action={
            <Button asChild>
              <Link to="/crm/leads">Back to leads</Link>
            </Button>
          }
          bordered
        />
      </CrmPage>
    )
  }

  const stageIndex = OPEN_STAGES.indexOf(lead.stage)
  const isExit = EXIT_STAGES.includes(lead.stage)
  const nextStage: LeadStage | null =
    stageIndex >= 0 && stageIndex < OPEN_STAGES.length - 1 ? OPEN_STAGES[stageIndex + 1] : null
  const unit = businessUnitOf(lead.unitId)
  const tone = ageTone(lead.daysInStage)

  const responded = lead.firstResponseMinutes !== null
  const withinSla = responded && (lead.firstResponseMinutes ?? 0) <= lead.responseSlaMinutes
  const waitingMinutes = Math.max(
    0,
    Math.round((Date.parse(`${TODAY}T09:00:00+01:00`) - Date.parse(lead.createdAt)) / 60_000),
  )

  const advance = (to: LeadStage) => {
    if (EXIT_STAGES.includes(to)) {
      setLossOpen(true)
      return
    }
    changeStage(lead, to)
    toast({
      tone: 'success',
      title: `Moved to ${STAGE_LABELS[to]}`,
      body: 'The stage change is on the Audit tab, not the activity feed.',
    })
  }

  return (
    <CrmPage
      title={personFullName(person)}
      description={`${lead.ref} · ${courseTitle(lead.courseInterestId)}`}
      breadcrumbs={[
        { label: 'CRM & admissions', to: '/crm' },
        { label: 'Leads', to: '/crm/leads' },
        { label: lead.ref },
      ]}
      error={error}
      onRetry={retry}
      tabs={TABS.map((t) => ({
        id: t.id,
        label: t.label,
        badge:
          t.id === 'follow-ups'
            ? leadFollowUps.filter((f) => f.status === 'open').length || undefined
            : t.id === 'audit'
              ? leadAudits.length || undefined
              : undefined,
      }))}
      activeTab={tab}
      onTabChange={(next) => query.set('tab', next === 'activity' ? undefined : next)}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={lead.stage} label={STAGE_LABELS[lead.stage]} />
          <Badge
            tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'neutral'}
            variant="subtle"
          >
            {lead.daysInStage} day{lead.daysInStage === 1 ? '' : 's'} in stage
          </Badge>
          <Badge tone={responded ? (withinSla ? 'success' : 'warning') : 'danger'} variant="subtle">
            {responded
              ? `First response ${formatMinutes(lead.firstResponseMinutes ?? 0)} — ${withinSla ? 'within SLA' : 'outside SLA'}`
              : `Not yet contacted — ${formatMinutes(waitingMinutes)}`}
          </Badge>
          {lead.quotedValue !== null && (
            <Badge tone="neutral" variant="outline">
              Quoted {formatNaira(lead.quotedValue)}
            </Badge>
          )}
          {unit && <UnitTag unit={unit} size="sm" />}
          <Badge tone="neutral" variant="subtle">
            {branchName(lead.branchId)}
          </Badge>
        </div>
      }
      actions={
        <>
          <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
            <Link to="/crm/leads">Back to leads</Link>
          </Button>
          {!isExit && (
            <Button variant="secondary" onClick={() => setLossOpen(true)}>
              Mark lost
            </Button>
          )}
          {admission ? (
            <Button asChild leftIcon={<GraduationCap size={16} aria-hidden="true" />}>
              <Link to={`/crm/admissions/${admission.id}`}>Open admission</Link>
            </Button>
          ) : (
            <Button asChild leftIcon={<GraduationCap size={16} aria-hidden="true" />}>
              <Link to={`/crm/admissions/new?leadId=${lead.id}`}>Create admission</Link>
            </Button>
          )}
        </>
      }
    >
      {/* ---- stage rail ---- */}
      <Card padding="tight" className="mb-4">
        {isExit ? (
          <Alert tone="warning" title={`This lead left the pipeline as ${STAGE_LABELS[lead.stage]}`}>
            {lead.lossReason
              ? `Loss reason: ${lead.lossReason.replace(/_/g, ' ')}.${lead.lossNote ? ` ${lead.lossNote}` : ''}`
              : 'No loss reason was recorded.'}
          </Alert>
        ) : (
          <ol className="flex flex-wrap items-center gap-1.5" aria-label="Stage progress">
            {OPEN_STAGES.map((stage, index) => {
              const state =
                index < stageIndex ? 'done' : index === stageIndex ? 'current' : 'todo'
              return (
                <li key={stage} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stage !== lead.stage && advance(stage)}
                    aria-current={state === 'current' ? 'step' : undefined}
                    className={
                      state === 'current'
                        ? 'rounded-full bg-accent px-3 py-1 text-body-13 font-semibold text-on-accent'
                        : state === 'done'
                          ? 'rounded-full bg-accent-subtle px-3 py-1 text-body-13 font-medium text-accent'
                          : 'rounded-full border border-border px-3 py-1 text-body-13 text-text-secondary hover:border-border-strong hover:text-text'
                    }
                  >
                    {STAGE_LABELS[stage]}
                  </button>
                  {index < OPEN_STAGES.length - 1 && (
                    <span className="h-px w-3 bg-border" aria-hidden="true" />
                  )}
                </li>
              )
            })}
            {nextStage && (
              <li className="ml-auto">
                <Button
                  size="sm"
                  variant="secondary"
                  rightIcon={<ArrowRight size={14} aria-hidden="true" />}
                  onClick={() => advance(nextStage)}
                >
                  Advance to {STAGE_LABELS[nextStage].toLowerCase()}
                </Button>
              </li>
            )}
          </ol>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* ---- left rail ---- */}
        <div className="flex flex-col gap-4">
          <ThreePeople
            referrerPersonId={lead.referrerPersonId}
            ownerUserId={lead.ownerUserId}
            closerUserId={lead.closerUserId}
            onChangeReferrer={() => setReferrerOpen(true)}
            onReassignOwner={() => setReassignOpen(true)}
            onSetCloser={() => setCloserOpen(true)}
            footer={lead.referralCode ? `Arrived on referral code ${lead.referralCode}.` : undefined}
          />

          <Card padding="none">
            <CardHeader title="Source and campaign" bare />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Original source" hint="Immutable after creation" divided>
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    <Lock size={12} aria-hidden="true" />
                    {SOURCE_LABELS[lead.originalSource]}
                  </span>
                </KeyValue>
                <KeyValue label="Latest source" divided>
                  <Badge
                    tone={lead.latestSource === lead.originalSource ? 'neutral' : 'accent'}
                    variant="subtle"
                  >
                    {SOURCE_LABELS[lead.latestSource]}
                  </Badge>
                </KeyValue>
                <KeyValue label="Campaign" divided>
                  {lead.utm.campaign ?? 'None'}
                </KeyValue>
                <KeyValue label="Landing page" divided>
                  {lead.landingPage ?? 'Not recorded'}
                </KeyValue>
                <KeyValue label="Created" divided>
                  {formatDateTime(lead.createdAt)}
                </KeyValue>
                <KeyValue label="Next action">
                  {lead.nextAction ? (
                    <span>
                      {lead.nextAction}
                      {lead.nextActionDueAt && (
                        <span
                          className={
                            lead.nextActionDueAt.slice(0, 10) < TODAY
                              ? 'block text-body-12 text-danger-text'
                              : 'block text-body-12 text-text-muted'
                          }
                        >
                          {lead.nextActionDueAt.slice(0, 10) < TODAY ? 'Overdue · ' : 'Due '}
                          {formatDate(lead.nextActionDueAt)}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-warning-text">No next action set</span>
                  )}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>

          <Card padding="none">
            <CardHeader title="Contact" bare />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Phone" divided>
                  {person?.phone ? formatPhone(person.phone) : 'No number'}
                </KeyValue>
                <KeyValue label="WhatsApp" divided>
                  {person?.whatsapp ? formatPhone(person.whatsapp) : 'Not recorded'}
                </KeyValue>
                <KeyValue label="Email" divided>
                  {person?.email ?? 'Not recorded'}
                </KeyValue>
                <KeyValue label="Location">
                  {person ? `${person.city}, ${person.state}` : 'Not recorded'}
                </KeyValue>
              </KeyValueList>

              <div className="mt-3 border-t border-border pt-3">
                <h3 className="text-label-11 text-text-label">Other relationships on this person</h3>
                {otherRelationships.length ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {otherRelationships.map((rel) => (
                      <li key={rel.id}>
                        <Badge tone="neutral" variant="subtle" size="sm">
                          {RELATIONSHIP_LABELS[rel.type]} since {formatDate(rel.startDate)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-body-13 text-text-secondary">
                    Only a lead so far. Creating an admission adds a student relationship to this same
                    person rather than a second record.
                  </p>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ---- tabbed main ---- */}
        <div>
          {tab === 'activity' && (
            <ActivityTab
              leadId={id}
              ownerUserId={lead.ownerUserId}
              items={leadActivities}
              onLogged={() => {
                const fresh = leadsCollection.find(id)
                if (fresh) recordLeadTouch(fresh)
              }}
            />
          )}

          {tab === 'follow-ups' && <FollowUpsTab rows={leadFollowUps} />}

          {tab === 'admission' && (
            <Card>
              <CardHeader
                title="Admission"
                description="One admission per lead. It creates the invoice and the student relationship."
              />
              <CardBody>
                {admission ? (
                  <KeyValueList columns={2}>
                    <KeyValue label="Reference" divided>
                      <Link to={`/crm/admissions/${admission.id}`} className="text-accent hover:underline">
                        {admission.ref}
                      </Link>
                    </KeyValue>
                    <KeyValue label="Status" divided>
                      <StatusBadge status={admission.status} />
                    </KeyValue>
                    <KeyValue label="Quoted fee" divided>
                      {formatNaira(admission.quotedFee)}
                    </KeyValue>
                    <KeyValue label="Discount" divided>
                      {admission.discountAmount ? formatNaira(admission.discountAmount) : 'None'}
                    </KeyValue>
                    <KeyValue label="Net fee" divided>
                      <span className="font-semibold">{formatNaira(admission.netFee)}</span>
                    </KeyValue>
                    <KeyValue label="Payment plan" divided>
                      {admission.paymentPlan.replace(/_/g, ' ')}
                    </KeyValue>
                    <KeyValue label="Expected start">
                      {formatDate(admission.expectedStartDate)}
                    </KeyValue>
                    <KeyValue label="Invoice">
                      {admission.invoiceId
                        ? (invoices.find((i) => i.id === admission.invoiceId)?.ref ?? 'Issued')
                        : 'Held until the discount is approved'}
                    </KeyValue>
                  </KeyValueList>
                ) : (
                  <EmptyState
                    icon={GraduationCap}
                    title="No admission yet"
                    message="Creating the admission generates the invoice, adds the student relationship to this person and writes the commission expectations. None of the identity data is re-entered."
                    action={
                      <Button asChild>
                        <Link to={`/crm/admissions/new?leadId=${lead.id}`}>Create admission</Link>
                      </Button>
                    }
                  />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'finance' && <FinanceTab invoices={personInvoices} />}

          {tab === 'audit' && <AuditTab rows={leadAudits} />}
        </div>
      </div>

      <LossReasonModal
        open={lossOpen}
        onClose={() => setLossOpen(false)}
        onConfirm={(reason: LossReason, note: string) => {
          changeStage(lead, 'lost', { reason, note })
          toast({
            tone: 'success',
            title: `${lead.ref} marked lost`,
            body: 'Loss reason recorded and audited. Nothing is deleted.',
          })
        }}
      />

      <ReassignOwnerModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        currentOwnerUserId={lead.ownerUserId}
        onConfirm={(toUserId: UserId, reason: string) => {
          reassignOwner(lead, toUserId, reason)
          toast({
            tone: 'success',
            title: `Owner is now ${directory.userNameOf(toUserId)}`,
            body: 'Ownership history preserved. Referrer and closer untouched.',
          })
        }}
      />

      <ChangeReferrerModal
        open={referrerOpen}
        onClose={() => setReferrerOpen(false)}
        current={lead.referrerPersonId}
        onConfirm={(referrerPersonId: PersonId | null, reason: string) => {
          setReferrer(lead, referrerPersonId, reason)
          toast({
            tone: 'warning',
            title: 'Referrer changed',
            body: 'Commission attributes to the new referrer from here. The change is audited.',
          })
        }}
      />

      <SetCloserModal
        open={closerOpen}
        onClose={() => setCloserOpen(false)}
        current={lead.closerUserId}
        onConfirm={(closerUserId: UserId | null) => {
          setCloser(lead, closerUserId)
          toast({
            tone: 'success',
            title: closerUserId ? `Closer set to ${directory.userNameOf(closerUserId)}` : 'Closer cleared',
            body: 'The closer is evaluated for commission separately from the owner.',
          })
        }}
      />
    </CrmPage>
  )
}

function ActivityTab({
  leadId,
  ownerUserId,
  items,
  onLogged,
}: {
  leadId: string
  ownerUserId: UserId
  items: Activity[]
  onLogged: () => void
}) {
  const [type, setType] = useState<ActivityType>('note')
  const [body, setBody] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [followUp, setFollowUp] = useState(false)
  const [followUpAction, setFollowUpAction] = useState('')
  const [followUpDue, setFollowUpDue] = useState(addDaysIso(TODAY, 2))
  const [touched, setTouched] = useState(false)

  const invalid = !body.trim()
  const followUpInvalid = followUp && !followUpAction.trim()

  const submit = () => {
    setTouched(true)
    if (invalid || followUpInvalid) return

    logActivity({
      subjectType: 'lead',
      subjectId: leadId,
      type,
      body: body.trim(),
      callOutcome: type === 'call' ? outcome : undefined,
    })
    if (followUp) {
      createFollowUp({
        leadId,
        ownerUserId,
        action: followUpAction.trim(),
        dueAt: `${followUpDue}T09:00:00+01:00`,
      })
    }
    onLogged()
    setBody('')
    setFollowUp(false)
    setFollowUpAction('')
    setTouched(false)
    toast({
      tone: 'success',
      title: 'Activity logged',
      body: 'The response-time clock stops on the first human touch and never restarts.',
    })
  }

  const timeline: TimelineItem[] = items.map((activity) => ({
    id: activity.id,
    title: activity.isSystemGenerated
      ? 'System'
      : `${activity.type[0].toUpperCase()}${activity.type.slice(1)}${
          activity.callOutcome ? ` · ${activity.callOutcome.replace(/_/g, ' ')}` : ''
        }`,
    description: activity.body,
    timestamp: activity.createdAt,
    icon: ACTIVITY_ICON[activity.type],
    tone: activity.isSystemGenerated ? 'neutral' : 'accent',
  }))

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Log an activity"
          description="Calls, notes, WhatsApp, email and meetings. Stage changes live on the audit tab instead."
        />
        <CardBody>
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Type" required>
                <Select
                  value={type}
                  onChange={(event) => setType(event.target.value as ActivityType)}
                  options={ACTIVITY_TYPES}
                />
              </Field>
              {type === 'call' && (
                <Field label="Outcome" required>
                  <Select
                    value={outcome}
                    onChange={(event) => setOutcome(event.target.value as CallOutcome)}
                    options={CALL_OUTCOMES}
                  />
                </Field>
              )}
            </div>

            <Field
              label="What happened"
              required
              error={touched && invalid ? 'Say what happened — an empty note helps nobody.' : undefined}
            >
              <Textarea
                rows={3}
                value={body}
                invalid={touched && invalid}
                onChange={(event) => setBody(event.target.value)}
                placeholder="Spoke about the October cohort. Wants to pay in three instalments."
              />
            </Field>

            <Checkbox
              checked={followUp}
              onChange={(event) => setFollowUp(event.target.checked)}
              label="Create a follow-up"
            />

            {followUp && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Follow-up action"
                  required
                  error={
                    touched && followUpInvalid ? 'Describe what happens next.' : undefined
                  }
                >
                  <Input
                    value={followUpAction}
                    invalid={touched && followUpInvalid}
                    onChange={(event) => setFollowUpAction(event.target.value)}
                    placeholder="Send the instalment schedule"
                  />
                </Field>
                <Field label="Due" required>
                  <Input
                    type="date"
                    value={followUpDue}
                    onChange={(event) => setFollowUpDue(event.target.value)}
                  />
                </Field>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={submit}>Log activity</Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Activity feed" description="Human, editable, chronological." />
        <CardBody>
          {timeline.length ? (
            <Timeline items={timeline} timeFormat="relative" />
          ) : (
            <EmptyState
              icon={MessageSquare}
              size="sm"
              title="Nothing logged yet"
              message="No call, note or message has been recorded against this lead. The response-time clock is still running."
            />
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function FollowUpsTab({ rows }: { rows: FollowUp[] }) {
  const directory = useDirectory()
  const [completing, setCompleting] = useState<FollowUp | null>(null)
  const [note, setNote] = useState('')

  const columns: Column<FollowUp>[] = [
    { key: 'action', header: 'Action', accessor: (row) => row.action, minWidth: 220, sortable: true },
    {
      key: 'due',
      header: 'Due',
      minWidth: 140,
      sortable: true,
      sortValue: (row) => row.dueAt,
      cell: (row) => {
        const overdue = row.status === 'open' && row.dueAt.slice(0, 10) < TODAY
        return (
          <span className={overdue ? 'font-semibold text-danger-text' : 'text-text'}>
            {formatDate(row.dueAt)}
            {overdue && ' · overdue'}
          </span>
        )
      },
    },
    {
      key: 'owner',
      header: 'Owner',
      minWidth: 170,
      sortable: true,
      sortValue: (row) => directory.userNameOf(row.ownerUserId),
      cell: (row) => <PersonChip name={directory.userNameOf(row.ownerUserId)} size="sm" short />,
    },
    {
      key: 'status',
      header: 'Status',
      minWidth: 120,
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      minWidth: 180,
      accessor: (row) => row.outcome ?? '—',
    },
    {
      key: 'act',
      header: '',
      minWidth: 110,
      cell: (row) =>
        row.status === 'open' ? (
          <Button size="sm" variant="secondary" onClick={() => setCompleting(row)}>
            Complete
          </Button>
        ) : null,
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Follow-ups"
        description="Overdue in red. Completing one logs an activity and clears the lead's next action."
      />
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Follow-ups scheduled on this lead"
        density="compact"
        empty={
          <EmptyState
            icon={Clock}
            size="sm"
            title="No follow-up scheduled"
            message="A lead with nothing scheduled is a lead nobody is chasing. Log an activity and tick 'create a follow-up'."
          />
        }
      />

      {completing && (
        <div className="border-t border-border p-4">
          <Field label={`Outcome of "${completing.action}"`} hint="Goes on the activity feed.">
            <Textarea
              rows={2}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Sent the schedule on WhatsApp. She will confirm on Monday."
            />
          </Field>
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCompleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                completeFollowUp(completing, 'Completed', note)
                toast({ tone: 'success', title: 'Follow-up completed' })
                setCompleting(null)
                setNote('')
              }}
            >
              Mark complete
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}

function FinanceTab({ invoices }: { invoices: Invoice[] }) {
  const columns: Column<Invoice>[] = [
    { key: 'ref', header: 'Invoice', accessor: (row) => row.ref, minWidth: 140, sortable: true },
    {
      key: 'issued',
      header: 'Issued',
      minWidth: 120,
      sortable: true,
      sortValue: (row) => row.issueDate,
      accessor: (row) => formatDate(row.issueDate),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (row) => row.total,
      accessor: (row) => formatNaira(row.total),
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (row) => row.paidAmount,
      accessor: (row) => formatNaira(row.paidAmount),
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (row) => row.balance,
      cell: (row) => (
        <span className={row.balance > 0 ? 'tabular-nums text-warning-text' : 'tabular-nums'}>
          {formatNaira(row.balance)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      minWidth: 130,
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Invoices"
        description="Read through to finance. Lines sum to the total; balance is total minus paid."
      />
      <DataTable
        data={invoices}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Invoices raised against this person"
        density="compact"
        empty={
          <EmptyState
            icon={FileText}
            size="sm"
            title="No invoice yet"
            message="An invoice appears here the moment the admission is created — unless the discount needs approval first, in which case it is held."
          />
        }
      />
    </Card>
  )
}

function AuditTab({ rows }: { rows: AuditEvent[] }) {
  const columns: Column<AuditEvent>[] = [
    {
      key: 'at',
      header: 'Timestamp',
      minWidth: 170,
      sortable: true,
      sortValue: (row) => row.at,
      cell: (row) => <span className="font-mono text-body-12">{formatDateTime(row.at)}</span>,
    },
    { key: 'actor', header: 'Actor', minWidth: 160, accessor: (row) => row.actorName, sortable: true },
    {
      key: 'action',
      header: 'Action',
      minWidth: 180,
      sortable: true,
      sortValue: (row) => row.action,
      cell: (row) => <span className="font-mono text-body-12">{row.action}</span>,
    },
    { key: 'field', header: 'Field', minWidth: 140, accessor: (row) => row.field ?? '—' },
    {
      key: 'before',
      header: 'Before',
      minWidth: 170,
      cell: (row) => <span className="font-mono text-body-12 text-text-secondary">{row.before ?? '—'}</span>,
    },
    {
      key: 'after',
      header: 'After',
      minWidth: 170,
      cell: (row) => <span className="font-mono text-body-12">{row.after ?? '—'}</span>,
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Audit"
        description="Immutable. Actor, timestamp, field, before and after. Separate from the activity feed, and there is no edit affordance on this tab by design."
        actions={
          <Badge tone="neutral" variant="outline" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
            Read only
          </Badge>
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Audit trail for this lead"
        density="compact"
        defaultSort={{ key: 'at', direction: 'desc' }}
        empty={
          <EmptyState
            icon={TriangleAlert}
            size="sm"
            title="No audit events"
            message="Nothing audited has happened to this lead yet, which is unusual — creation itself is normally audited."
          />
        }
      />
    </Card>
  )
}
