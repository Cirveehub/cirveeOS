import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, Send } from 'lucide-react'

import { formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CurrencyInput,
  EmptyState,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  PageHeader,
  Radio,
  RadioGroup,
  Select,
  StatusBadge,
  Textarea,
  UnitTag,
} from '@/ui'
import type { BusinessUnit } from '@/app/module-registry'
import {
  TODAY,
  campaignsCollection,
  messageTemplatesCollection,
  messagesCollection,
  segmentsCollection,
  unitsCollection,
  useCollection,
  type Channel,
} from '@/mocks'

import { CHANNEL_LABEL, EmailDesignPicker, EmailPreviewChrome, Screen, emailDesign, useUserName } from './parts'
import { createCampaign, derivedUtm, updateCampaign } from './writes'

const CHANNELS: Array<{ value: Channel; label: string }> = (['whatsapp', 'email', 'sms', 'in_app'] as Channel[]).map(
  (value) => ({ value, label: CHANNEL_LABEL[value] }),
)

const QUIET_FROM = 21
const QUIET_TO = 8
const FREQUENCY_CAP = 3

const STEPS = ['Basics', 'Audience', 'Channel and template', 'Schedule', 'Budget and review'] as const
type StepIndex = 1 | 2 | 3 | 4 | 5

export default function CampaignBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const campaigns = useCollection(campaignsCollection)
  const segments = useCollection(segmentsCollection)
  const templates = useCollection(messageTemplatesCollection)
  const messages = useCollection(messagesCollection)
  const units = useCollection(unitsCollection)
  const userName = useUserName()

  const existing = id && id !== 'new' ? (campaigns.find((c) => (c.id as string) === id) ?? null) : null
  const editing = existing !== null

  const [step, setStep] = useState<StepIndex>(1)
  const [touched, setTouched] = useState<Record<StepIndex, boolean>>({ 1: false, 2: false, 3: false, 4: false, 5: false })

  const [name, setName] = useState(existing?.name ?? '')
  const [objective, setObjective] = useState(existing?.objective ?? '')
  const [unitId, setUnitId] = useState<string>((existing?.unitId as string) ?? '')
  const [segmentId, setSegmentId] = useState<string>((existing?.segmentId as string) ?? '')
  const [channel, setChannel] = useState<Channel>(existing?.channel ?? 'whatsapp')
  const [templateId, setTemplateId] = useState<string>((existing?.templateId as string) ?? '')
  const [emailDesignId, setEmailDesignId] = useState<string>(existing?.emailDesignId ?? 'plain')
  const [timing, setTiming] = useState<'now' | 'at'>(existing?.scheduledAt ? 'at' : 'now')
  const [sendDate, setSendDate] = useState(existing?.scheduledAt?.slice(0, 10) ?? TODAY)
  const [sendTime, setSendTime] = useState(existing?.scheduledAt?.slice(11, 16) ?? '09:00')
  const [budget, setBudget] = useState<number | null>(existing?.budget ?? null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [utm, setUtm] = useState({
    source: existing?.utm.source ?? '',
    medium: existing?.utm.medium ?? '',
    campaign: existing?.utm.campaign ?? '',
  })
  const [saved, setSaved] = useState<string | null>(null)

  const segment = segments.find((s) => (s.id as string) === segmentId) ?? null
  const template = templates.find((t) => (t.id as string) === templateId) ?? null
  const channelTemplates = useMemo(() => templates.filter((t) => t.channel === channel), [templates, channel])
  const unitCode = (value: string) =>
    (units.find((u) => (u.id as string) === value)?.code.toLowerCase() ?? 'academy') as BusinessUnit

  const audienceSize = segment?.memberCount ?? 0
  const utmDefaults = derivedUtm(name, channel)

  const overCap = useMemo(() => {
    if (!segment) return 0
    const from = new Date(Date.parse(`${TODAY}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)
    const perPerson = new Map<string, number>()
    for (const message of messages) {
      if (message.direction !== 'outbound') continue
      if (message.sentAt.slice(0, 10) < from) continue
      perPerson.set(message.personId as string, (perPerson.get(message.personId as string) ?? 0) + 1)
    }
    return [...perPerson.values()].filter((n) => n >= FREQUENCY_CAP).length
  }, [segment, messages])

  const scheduledAt = timing === 'at' ? `${sendDate}T${sendTime}:00+01:00` : null
  const sendHour = Number(sendTime.slice(0, 2))
  const inQuietHours = timing === 'at' && (sendHour >= QUIET_FROM || sendHour < QUIET_TO)

  const nameError =
    name.trim().length < 4
      ? 'Name the campaign in at least four characters. It is what the attribution report will show.'
      : campaigns.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase() && c.id !== existing?.id)
        ? 'A campaign already carries this name. Attribution becomes unreadable when two share one.'
        : undefined
  const objectiveError =
    objective.trim().length < 8 ? 'Say what this campaign is for. It is the first column of every report about it.' : undefined
  const unitError = unitId ? undefined : 'Pick the unit this campaign belongs to. Attributed revenue lands on it.'
  const segmentError = !segmentId
    ? 'Pick an audience. A campaign has no list of its own — it goes to the people who match the audience rules.'
    : audienceSize === 0
      ? 'This audience currently resolves to nobody. Sending to it would do nothing at all.'
      : undefined
  const templateError = !templateId
    ? 'Pick a template for this channel.'
    : template?.channel !== channel
      ? 'That template belongs to another channel.'
      : template?.whatsappApprovalStatus === 'rejected'
        ? 'This template was rejected by WhatsApp and cannot be sent. Pick another or revise it under Campaigns, Templates.'
        : undefined
  const scheduleError =
    timing === 'at' && `${sendDate}T${sendTime}` < `${TODAY}T00:00`
      ? 'Pick a moment that has not already passed.'
      : undefined

  const stepValid: Record<StepIndex, boolean> = {
    1: !nameError && !objectiveError && !unitError,
    2: !segmentError,
    3: !templateError,
    4: !scheduleError,
    5: true,
  }

  function advance() {
    setTouched((prev) => ({ ...prev, [step]: true }))
    if (!stepValid[step]) return
    setStep((prev) => (Math.min(5, prev + 1) as StepIndex))
  }

  function save() {
    setTouched({ 1: true, 2: true, 3: true, 4: true, 5: true })
    if (!stepValid[1] || !stepValid[2] || !stepValid[3] || !stepValid[4]) return
    const input = {
      name: name.trim(),
      objective: objective.trim(),
      channel,
      segmentId,
      templateId,
      emailDesignId: channel === 'email' ? emailDesignId : null,
      unitId,
      budget,
      scheduledAt,
      status: (timing === 'at' ? 'scheduled' : 'draft') as 'scheduled' | 'draft',
      utm,
    }
    if (editing && existing) {
      updateCampaign(existing.id as string, input)
      setSaved(`${input.name} saved. It is ${input.status === 'scheduled' ? `scheduled for ${formatDateTime(scheduledAt ?? '')}` : 'held as a draft'}.`)
    } else {
      const campaign = createCampaign(input)
      setSaved(
        `${campaign.name} created as a ${campaign.status} campaign over ${formatNumber(campaign.audienceSize)} people. ${segment?.name ?? 'The audience'} now lists it among the campaigns using it.`,
      )
    }
  }

  const locked = editing && (existing.status === 'sent' || existing.status === 'completed' || existing.status === 'sending')

  if (saved) {
    return (
      <Screen>
        <PageHeader
          breadcrumbs={[
            { label: 'Marketing', to: '/engage' },
            { label: 'Campaigns', to: '/engage/campaigns' },
            { label: name },
          ]}
          title="Campaign saved"
        />
        <Alert tone="success" title={name} className="mb-6">
          {saved}
        </Alert>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/engage/campaigns">Back to campaigns</Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(null)
              setStep(1)
              setName('')
              setObjective('')
              setSegmentId('')
              setTemplateId('')
              setEmailDesignId('plain')
              setBudget(null)
              setTouched({ 1: false, 2: false, 3: false, 4: false, 5: false })
            }}
          >
            Build another
          </Button>
        </div>
      </Screen>
    )
  }

  if (id && id !== 'new' && !existing) {
    return (
      <Screen>
        <PageHeader
          breadcrumbs={[
            { label: 'Marketing', to: '/engage' },
            { label: 'Campaigns', to: '/engage/campaigns' },
            { label: id },
          ]}
          title="Campaign not found"
        />
        <EmptyState
          icon={Send}
          title={`No campaign matches ${id}`}
          message="The link may be stale. Every campaign that has ever existed is still on the list — nothing is deleted here."
          action={
            <Button asChild>
              <Link to="/engage/campaigns">Back to campaigns</Link>
            </Button>
          }
          bordered
        />
      </Screen>
    )
  }

  return (
    <Screen>
      <PageHeader
        breadcrumbs={[
          { label: 'Marketing', to: '/engage' },
          { label: 'Campaigns', to: '/engage/campaigns' },
          { label: editing ? existing.name : 'New campaign' },
        ]}
        title={editing ? `Edit ${existing.name}` : 'New campaign'}
        description="Who it goes to, then channel and template, then when, then budget."
        meta={editing ? <StatusBadge status={existing.status} /> : undefined}
        actions={
          <Button variant="ghost" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/engage/campaigns')}>
            Cancel
          </Button>
        }
      />

      {locked && (
        <Alert tone="warning" title="This campaign has already sent" className="mb-6">
          Its audience, template and schedule describe what actually went out, so changing them would rewrite history.
          Build a new campaign instead — the performance figures on this one stay attached to what really happened.
        </Alert>
      )}

      <ol className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        {STEPS.map((label, index) => (
          <StepChip
            key={label}
            index={index + 1}
            label={label}
            state={step === index + 1 ? 'current' : step > index + 1 ? 'done' : 'todo'}
            onClick={step > index + 1 ? () => setStep((index + 1) as StepIndex) : undefined}
          />
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardBody className="space-y-5">
            {/* ------------------------------ 1. Basics ----------------------------- */}
            {step === 1 && (
              <>
                <Field label="Campaign name" required error={touched[1] || name.length > 0 ? nameError : undefined}>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    disabled={locked}
                    placeholder="September alumni re-engagement"
                  />
                </Field>
                <Field
                  label="Objective"
                  required
                  hint="One line. What would make this campaign worth having run?"
                  error={touched[1] ? objectiveError : undefined}
                >
                  <Textarea
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    rows={2}
                    maxLength={160}
                    showCount
                    disabled={locked}
                    placeholder="Bring alumni back for the advanced cohorts starting in October."
                  />
                </Field>
                <Field
                  label="Unit"
                  required
                  hint="Attributed revenue lands on this unit's P&L."
                  error={touched[1] ? unitError : undefined}
                >
                  <Select
                    value={unitId}
                    placeholder="Pick a unit"
                    options={units.map((u) => ({ value: u.id as string, label: u.name }))}
                    onChange={(event) => setUnitId(event.target.value)}
                    disabled={locked}
                  />
                </Field>

                <div className="rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen(!advancedOpen)}
                    aria-expanded={advancedOpen}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-body-13 font-semibold text-text-secondary hover:text-text"
                  >
                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={advancedOpen ? 'rotate-180 transition-transform' : 'transition-transform'}
                    />
                    Advanced
                    <span className="ml-auto font-mono text-body-12 font-normal text-text-muted">
                      {utm.source || utmDefaults.source} / {utm.medium || utmDefaults.medium} /{' '}
                      {utm.campaign || utmDefaults.campaign || '...'}
                    </span>
                  </button>
                  {advancedOpen && (
                    <div className="border-t border-border px-4 py-4">
                      <p className="mb-3 text-body-13 text-text-secondary">
                        Tracking code (UTM) on every link in this campaign. It is filled in from the name and channel;
                        change it only if the link has to match something outside this system.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {(['source', 'medium', 'campaign'] as const).map((key) => (
                          <Field key={key} label={`utm_${key}`} optional>
                            <Input
                              value={utm[key]}
                              placeholder={utmDefaults[key] || (key === 'campaign' ? 'from the name' : '')}
                              onChange={(event) => setUtm({ ...utm, [key]: event.target.value })}
                              disabled={locked}
                              className="font-mono"
                            />
                          </Field>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ----------------------------- 2. Audience ---------------------------- */}
            {step === 2 && (
              <>
                <Field label="Audience" required error={touched[2] ? segmentError : undefined}>
                  <Select
                    value={segmentId}
                    placeholder="Pick an audience"
                    options={segments.map((s) => ({
                      value: s.id as string,
                      label: `${s.name} — ${formatNumber(s.memberCount)} people`,
                    }))}
                    onChange={(event) => setSegmentId(event.target.value)}
                    disabled={locked}
                  />
                </Field>

                {segments.length === 0 && (
                  <EmptyState
                    size="sm"
                    bordered
                    title="No audiences exist yet"
                    message="Nothing can be sent until one does. An audience takes a minute to build."
                    action={
                      <Button asChild size="sm">
                        <Link to="/engage/audiences">Build an audience</Link>
                      </Button>
                    }
                  />
                )}

                {segment && (
                  <div className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-label-11 text-text-muted">People in it right now</span>
                      <span className="text-heading-24 tabular-nums text-text">{formatNumber(audienceSize)}</span>
                    </div>
                    <p className="mt-1 text-body-13 text-text-secondary">{segment.criteriaSummary}</p>
                    <p className="mt-2 text-body-12 text-text-secondary">
                      Last refreshed {formatDateTime(segment.lastRefreshedAt)} · owned by {userName(segment.ownerUserId)}.
                      Membership resolves again at send time, so this number is a forecast, not a frozen list.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ----------------------- 3. Channel and template ---------------------- */}
            {step === 3 && (
              <>
                <RadioGroup legend="Channel" description="The template list below follows the channel." orientation="horizontal">
                  {CHANNELS.map((option) => (
                    <Radio
                      key={option.value}
                      name="campaign-channel"
                      value={option.value}
                      checked={channel === option.value}
                      disabled={locked}
                      onChange={() => {
                        setChannel(option.value)
                        setTemplateId('')
                      }}
                      label={option.label}
                    />
                  ))}
                </RadioGroup>

                {channel === 'email' && (
                  <Field label="Email design" hint="How the message looks — separate from the words in it.">
                    <EmailDesignPicker value={emailDesignId} onChange={setEmailDesignId} disabled={locked} />
                  </Field>
                )}

                <Field label="Template" required error={touched[3] ? templateError : undefined}>
                  <Select
                    value={templateId}
                    placeholder={channelTemplates.length === 0 ? 'No template for this channel' : 'Pick a template'}
                    options={channelTemplates.map((t) => ({
                      value: t.id as string,
                      label: `${t.name}${t.whatsappApprovalStatus === 'approved' ? '' : t.whatsappApprovalStatus === 'pending' ? ' — approval pending' : t.whatsappApprovalStatus === 'rejected' ? ' — rejected' : ''}`,
                    }))}
                    onChange={(event) => setTemplateId(event.target.value)}
                    disabled={locked || channelTemplates.length === 0}
                  />
                </Field>

                {channelTemplates.length === 0 && (
                  <EmptyState
                    size="sm"
                    bordered
                    title={`No ${CHANNEL_LABEL[channel]} template exists`}
                    message="A campaign cannot send without one. Templates carry the merge fields and, on WhatsApp, the approval status that decides whether a send is even possible."
                    action={
                      <Button asChild size="sm">
                        <Link to="/engage/campaigns/templates">Open templates</Link>
                      </Button>
                    }
                  />
                )}

                {template && (
                  <div className="rounded-xl border border-border">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
                      <span className="text-label-11 text-text-muted">Preview</span>
                      <Badge tone="neutral" size="sm">
                        {CHANNEL_LABEL[template.channel]}
                      </Badge>
                      {template.whatsappApprovalStatus !== 'n_a' && (
                        <Badge
                          tone={
                            template.whatsappApprovalStatus === 'approved'
                              ? 'success'
                              : template.whatsappApprovalStatus === 'pending'
                                ? 'warning'
                                : 'danger'
                          }
                          size="sm"
                        >
                          WhatsApp {template.whatsappApprovalStatus}
                        </Badge>
                      )}
                      <Badge tone="neutral" variant="outline" size="sm">
                        v{template.version}
                      </Badge>
                      {channel === 'email' && (
                        <Badge tone="accent" variant="subtle" size="sm">
                          {emailDesign(emailDesignId).name}
                        </Badge>
                      )}
                    </div>
                    {channel === 'email' ? (
                      <EmailPreviewChrome
                        design={emailDesign(emailDesignId)}
                        subject={template.subject}
                        body={template.body}
                      />
                    ) : (
                      <div className="px-4 py-3">
                        {template.subject && <p className="text-body-14 font-semibold text-text">{template.subject}</p>}
                        <p className="mt-1 whitespace-pre-line text-body-13 text-text-secondary">{template.body}</p>
                      </div>
                    )}
                    {template.mergeFields.length > 0 && (
                      <p className="border-t border-border px-4 py-2.5 text-body-12 text-text-secondary">
                        Merge fields: {template.mergeFields.map((f) => `{{${f}}}`).join(', ')} — each resolved from the
                        Person record at send time.
                      </p>
                    )}
                  </div>
                )}

                {template?.whatsappApprovalStatus === 'pending' && (
                  <Alert tone="warning" title="WhatsApp has not approved this template yet">
                    It can be scheduled, but it will not leave the queue until Meta approves it. That is a platform
                    constraint, not a setting in this system.
                  </Alert>
                )}
              </>
            )}

            {/* ----------------------------- 4. Schedule ---------------------------- */}
            {step === 4 && (
              <>
                <RadioGroup legend="When to send" orientation="horizontal">
                  <Radio
                    name="campaign-timing"
                    value="now"
                    checked={timing === 'now'}
                    disabled={locked}
                    onChange={() => setTiming('now')}
                    label="Hold as a draft"
                    description="Nothing is scheduled. Somebody starts it by hand."
                  />
                  <Radio
                    name="campaign-timing"
                    value="at"
                    checked={timing === 'at'}
                    disabled={locked}
                    onChange={() => setTiming('at')}
                    label="Schedule it"
                    description="West Africa Time, the only timezone this system operates in."
                  />
                </RadioGroup>

                {timing === 'at' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date" required error={touched[4] ? scheduleError : undefined}>
                      <Input type="date" value={sendDate} onChange={(event) => setSendDate(event.target.value)} disabled={locked} />
                    </Field>
                    <Field label="Time" required hint="West Africa Time (UTC+1).">
                      <Input type="time" value={sendTime} onChange={(event) => setSendTime(event.target.value)} disabled={locked} />
                    </Field>
                  </div>
                )}

                {inQuietHours && (
                  <Alert tone="warning" icon={AlertTriangle} title="That lands inside quiet hours">
                    Sending between {QUIET_TO}:00 and {QUIET_FROM}:00 is the house rule. A message at {sendTime} will be
                    held until the window opens rather than waking somebody up.
                  </Alert>
                )}

                <div className="rounded-xl border border-border p-4">
                  <p className="text-label-11 text-text-muted">Frequency cap</p>
                  <p className="mt-1 text-body-13 text-text-secondary">
                    The house cap is {FREQUENCY_CAP} messages per person per rolling week.{' '}
                    {overCap > 0
                      ? `${formatNumber(overCap)} ${overCap === 1 ? 'person has' : 'people have'} already hit it in the last seven days, and would be skipped rather than over-messaged.`
                      : 'Nobody has hit it in the last seven days, so this send reaches the whole audience.'}
                  </p>
                  <p className="mt-2 text-body-12 text-text-secondary">
                    No send-frequency policy version is active in Settings, so this figure is observation rather than
                    enforcement — worth fixing before a WhatsApp number gets blocked.
                  </p>
                </div>
              </>
            )}

            {/* -------------------------- 5. Budget and review ---------------------- */}
            {step === 5 && (
              <>
                <Field
                  label="Budget"
                  hint="Optional. Leave empty for an organic send with no media spend behind it."
                >
                  <CurrencyInput value={budget} onChange={setBudget} />
                </Field>

                {budget !== null && budget > 0 && audienceSize > 0 && (
                  <p className="text-body-13 text-text-secondary">
                    {formatNaira(Math.round(budget / audienceSize))} per person reached, at the audience size this
                    segment currently resolves to.
                  </p>
                )}

                <Card padding="none">
                  <CardHeader title="What saving this will do" description="Read it before you commit." />
                  <CardBody>
                    <KeyValueList columns={2}>
                      <KeyValue label="Name" divided>
                        {name || '—'}
                      </KeyValue>
                      <KeyValue label="Objective" divided>
                        {objective || '—'}
                      </KeyValue>
                      <KeyValue label="Unit" divided>
                        {unitId ? <UnitTag unit={unitCode(unitId)} size="sm" /> : '—'}
                      </KeyValue>
                      <KeyValue label="Audience" divided hint="Resolved at send time, not a stored list.">
                        {segment ? `${segment.name} · ${formatNumber(audienceSize)} people` : '—'}
                      </KeyValue>
                      <KeyValue label="Channel" divided>
                        {CHANNEL_LABEL[channel]}
                      </KeyValue>
                      <KeyValue label="Template" divided>
                        {template ? `${template.name} v${template.version}` : '—'}
                      </KeyValue>
                      {channel === 'email' && (
                        <KeyValue label="Email design" divided>
                          {emailDesign(emailDesignId).name}
                        </KeyValue>
                      )}
                      <KeyValue label="Schedule" divided>
                        {scheduledAt ? formatDateTime(scheduledAt) : 'Held as a draft'}
                      </KeyValue>
                      <KeyValue label="Budget" divided>
                        {budget === null || budget === 0 ? 'No budget' : formatNaira(budget)}
                      </KeyValue>
                      <KeyValue label="Tracking code" divided>
                        <code className="font-mono text-body-12">
                          {utm.source || utmDefaults.source} / {utm.medium || utmDefaults.medium} /{' '}
                          {utm.campaign || utmDefaults.campaign}
                        </code>
                      </KeyValue>
                    </KeyValueList>

                    <ul className="mt-4 space-y-1.5 text-body-13 text-text-secondary">
                      <li>
                        A campaign record is created with status {timing === 'at' ? 'Scheduled' : 'Draft'} and every
                        performance figure at zero.
                      </li>
                      <li>{segment?.name ?? 'The audience'} gains this campaign in its "used by" list.</li>
                      <li>Links carry the tracking code above, so enrolments can be traced back to this campaign.</li>
                      <li>Nothing is sent. Dispatch belongs to the automation engine, which journeys and campaigns share.</li>
                    </ul>
                  </CardBody>
                </Card>
              </>
            )}
          </CardBody>
        </Card>

        {/* ---- the rail that carries what earlier steps decided ---- */}
        <Card>
          <CardHeader title="So far" description="What the later steps are reasoning about." />
          <CardBody>
            <KeyValueList>
              <KeyValue label="Name" divided>
                {name || <span className="text-text-secondary">Not set</span>}
              </KeyValue>
              <KeyValue label="Unit" divided>
                {unitId ? <UnitTag unit={unitCode(unitId)} size="sm" /> : <span className="text-text-secondary">Not set</span>}
              </KeyValue>
              <KeyValue label="Audience" divided>
                {segment ? (
                  <span className="tabular-nums">{formatNumber(audienceSize)}</span>
                ) : (
                  <span className="text-text-secondary">No audience yet</span>
                )}
              </KeyValue>
              <KeyValue label="Channel" divided>
                {CHANNEL_LABEL[channel]}
              </KeyValue>
              <KeyValue label="Template" divided>
                {template ? template.name : <span className="text-text-secondary">Not chosen</span>}
              </KeyValue>
              {channel === 'email' && (
                <KeyValue label="Email design" divided>
                  {emailDesign(emailDesignId).name}
                </KeyValue>
              )}
              <KeyValue label="Schedule" divided>
                {scheduledAt ? formatDateTime(scheduledAt) : 'Draft'}
              </KeyValue>
            </KeyValueList>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button variant="ghost" disabled={step === 1} onClick={() => setStep((prev) => (Math.max(1, prev - 1) as StepIndex))}>
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          {step < 5 ? (
            <Button rightIcon={<Check size={16} />} onClick={advance} disabled={locked}>
              Continue
            </Button>
          ) : (
            <Button leftIcon={<Send size={16} />} onClick={save} disabled={locked}>
              {editing ? 'Save campaign' : timing === 'at' ? 'Schedule campaign' : 'Save as draft'}
            </Button>
          )}
        </div>
      </div>
    </Screen>
  )
}

function StepChip({
  index,
  label,
  state,
  onClick,
}: {
  index: number
  label: string
  state: 'current' | 'done' | 'todo'
  onClick?: () => void
}) {
  const body = (
    <>
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
      <span className={state === 'current' ? 'text-body-13 font-semibold text-text' : 'text-body-13 text-text-secondary'}>
        {label}
      </span>
    </>
  )

  return (
    <li>
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          className="flex items-center gap-2 rounded-lg px-1 py-0.5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {body}
        </button>
      ) : (
        <span className="flex items-center gap-2 px-1 py-0.5" aria-current={state === 'current' ? 'step' : undefined}>
          {body}
        </span>
      )}
    </li>
  )
}
