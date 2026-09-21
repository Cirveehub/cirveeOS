import { useEffect, useState } from 'react'
import { CircleCheck, FileText, MapPin, MessageSquare, Phone } from 'lucide-react'
import {
  Button,
  Checkbox,
  EmptyState,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  Timeline,
  type TimelineItem,
} from '@/ui'
import { TODAY, leadsCollection } from '@/mocks'
import type { Activity, ActivityType, CallOutcome, FollowUp, Lead } from '@/mocks/types'
import { toast } from './Toasts'
import { personName } from '../lib/lookups'
import {
  addDaysIso,
  changeStage,
  completeFollowUp,
  createFollowUp,
  logActivity,
  recordLeadTouch,
  setNextAction,
} from '../lib/writes'

export type ComposerType = 'call' | 'whatsapp' | 'note' | 'meeting'

const COMPOSER_TYPES: Array<{ value: ComposerType; label: string; icon: typeof Phone }> = [
  { value: 'call', label: 'Call', icon: Phone },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { value: 'note', label: 'Note', icon: FileText },
  { value: 'meeting', label: 'Visit', icon: MapPin },
]

const CALL_OUTCOMES: Array<{ value: CallOutcome; label: string }> = [
  { value: 'connected', label: 'Spoke to them' },
  { value: 'no_answer', label: 'No answer' },
  { value: 'busy', label: 'Line busy' },
  { value: 'wrong_number', label: 'Wrong number' },
]

const ACTIVITY_ICON: Record<ActivityType, typeof Phone> = {
  note: FileText,
  call: Phone,
  whatsapp: MessageSquare,
  email: MessageSquare,
  meeting: MapPin,
  sms: MessageSquare,
  system: CircleCheck,
}

const ACTIVITY_TITLE: Record<ActivityType, string> = {
  note: 'Note',
  call: 'Call',
  whatsapp: 'WhatsApp',
  email: 'Email',
  meeting: 'Visit',
  sms: 'SMS',
  system: 'System',
}

const PLACEHOLDER: Record<ComposerType, string> = {
  call: 'Spoke about the October cohort. Wants to pay in three parts.',
  whatsapp: 'Sent the fee breakdown and the cohort dates.',
  note: 'Parent will call back after payday.',
  meeting: 'Came in to see the lab. Liked it, asked about laptops.',
}

export interface ActivityComposerProps {
  lead: Lead
  defaultType?: ComposerType
  submitLabel?: string
  onLogged?: () => void
}

export function ActivityComposer({
  lead,
  defaultType = 'whatsapp',
  submitLabel = 'Save',
  onLogged,
}: ActivityComposerProps) {
  const [type, setType] = useState<ComposerType>(defaultType)
  const [body, setBody] = useState('')
  const [outcome, setOutcome] = useState<CallOutcome>('connected')
  const [callBack, setCallBack] = useState(false)
  const [callBackOn, setCallBackOn] = useState(addDaysIso(TODAY, 1))
  const [callBackWhat, setCallBackWhat] = useState('Call back')
  const [touched, setTouched] = useState(false)

  const invalid = !body.trim()
  const callBackInvalid = callBack && (!callBackOn || !callBackWhat.trim())

  const submit = () => {
    setTouched(true)
    if (invalid || callBackInvalid) return

    logActivity({
      subjectType: 'lead',
      subjectId: lead.id,
      type,
      body: body.trim(),
      callOutcome: type === 'call' ? outcome : undefined,
    })
    const fresh = leadsCollection.find(lead.id) ?? lead
    recordLeadTouch(fresh)
    if (callBack) {
      const dueAt = `${callBackOn}T09:00:00+01:00`
      createFollowUp({ leadId: lead.id, ownerUserId: lead.ownerUserId, action: callBackWhat.trim(), dueAt })
      const afterTouch = leadsCollection.find(lead.id) ?? fresh
      setNextAction(afterTouch, callBackWhat.trim(), dueAt)
    }

    setBody('')
    setCallBack(false)
    setTouched(false)
    toast({
      tone: 'success',
      title: callBack ? `Saved. Callback set for ${callBackOn}.` : 'Saved to the conversation.',
    })
    onLogged?.()
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="What happened" className="flex flex-wrap items-center gap-1.5">
        {COMPOSER_TYPES.map((option) => {
          const Icon = option.icon
          const active = option.value === type
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(option.value)}
              className={
                active
                  ? 'inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3 text-body-13 font-semibold text-on-accent'
                  : 'inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-body-13 text-text-secondary hover:border-border-strong hover:text-text'
              }
            >
              <Icon size={14} aria-hidden="true" />
              {option.label}
            </button>
          )
        })}
        {type === 'call' && (
          <Select
            aria-label="How the call went"
            selectSize="sm"
            containerClassName="w-auto min-w-40"
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as CallOutcome)}
            options={CALL_OUTCOMES}
          />
        )}
      </div>

      <Field
        label="What was said"
        required
        error={touched && invalid ? 'Write a line about what happened.' : undefined}
      >
        <Textarea
          rows={3}
          value={body}
          invalid={touched && invalid}
          onChange={(event) => setBody(event.target.value)}
          placeholder={PLACEHOLDER[type]}
        />
      </Field>

      <Checkbox
        checked={callBack}
        onChange={(event) => setCallBack(event.target.checked)}
        label="Call back on…"
      />

      {callBack && (
        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Date" required>
            <Input
              type="date"
              min={TODAY}
              value={callBackOn}
              onChange={(event) => setCallBackOn(event.target.value)}
            />
          </Field>
          <Field
            label="To do"
            required
            error={touched && callBackInvalid ? 'Say what the callback is for.' : undefined}
          >
            <Input
              value={callBackWhat}
              invalid={touched && callBackInvalid}
              onChange={(event) => setCallBackWhat(event.target.value)}
              placeholder="Send the instalment plan"
            />
          </Field>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={submit}>{submitLabel}</Button>
      </div>
    </div>
  )
}

export function ActivityFeed({ items }: { items: Activity[] }) {
  const timeline: TimelineItem[] = items.map((activity) => ({
    id: activity.id,
    title: activity.isSystemGenerated
      ? 'System'
      : `${ACTIVITY_TITLE[activity.type]}${
          activity.callOutcome
            ? ` · ${
                CALL_OUTCOMES.find((o) => o.value === activity.callOutcome)?.label.toLowerCase() ??
                activity.callOutcome
              }`
            : ''
        }`,
    description: activity.body,
    timestamp: activity.createdAt,
    icon: ACTIVITY_ICON[activity.type],
    tone: activity.isSystemGenerated ? 'neutral' : 'accent',
  }))

  if (!timeline.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        size="sm"
        title="No conversation yet"
        message="Nothing has been logged for this person. The first reply goes above."
      />
    )
  }
  return <Timeline items={timeline} timeFormat="relative" />
}

export function LogReplyModal({
  lead,
  open,
  onClose,
  defaultType = 'whatsapp',
}: {
  lead: Lead | null
  open: boolean
  onClose: () => void
  defaultType?: ComposerType
}) {
  if (!lead) return null
  return (
    <Modal open={open} onClose={onClose} size="md" title={`Reply to ${personName(lead.personId)}`}>
      <ActivityComposer lead={lead} defaultType={defaultType} submitLabel="Reply logged" onLogged={onClose} />
    </Modal>
  )
}

export function CompleteFollowUpModal({
  followUp,
  open,
  onClose,
}: {
  followUp: FollowUp | null
  open: boolean
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [nextDate, setNextDate] = useState('')
  const [nextWhat, setNextWhat] = useState('Call back')

  useEffect(() => {
    if (open) {
      setNote('')
      setNextDate('')
      setNextWhat('Call back')
    }
  }, [open])

  if (!followUp) return null
  const lead = leadsCollection.find(followUp.leadId)

  const submit = () => {
    completeFollowUp(followUp, 'Done', note)
    if (nextDate && lead) {
      const dueAt = `${nextDate}T09:00:00+01:00`
      createFollowUp({
        leadId: lead.id,
        ownerUserId: lead.ownerUserId,
        action: nextWhat.trim() || 'Call back',
        dueAt,
      })
      const fresh = leadsCollection.find(lead.id) ?? lead
      setNextAction(fresh, nextWhat.trim() || 'Call back', dueAt)
    }
    toast({ tone: 'success', title: nextDate ? `Done. Next callback ${nextDate}.` : 'Done.' })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Done: ${followUp.action}`}
      description={lead ? personName(lead.personId) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Mark done</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="How did it go" optional>
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Sent the schedule on WhatsApp. She will confirm on Monday."
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Call back again on" optional>
            <Input
              type="date"
              min={TODAY}
              value={nextDate}
              onChange={(event) => setNextDate(event.target.value)}
            />
          </Field>
          <Field label="To do" optional>
            <Input
              value={nextWhat}
              disabled={!nextDate}
              onChange={(event) => setNextWhat(event.target.value)}
            />
          </Field>
        </div>
      </div>
    </Modal>
  )
}

export function NotNowModal({
  lead,
  open,
  onClose,
}: {
  lead: Lead | null
  open: boolean
  onClose: () => void
}) {
  const [revisit, setRevisit] = useState(addDaysIso(TODAY, 60))
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setRevisit(addDaysIso(TODAY, 60))
      setNote('')
      setTouched(false)
    }
  }, [open])

  if (!lead) return null
  const invalid = !revisit

  const submit = () => {
    setTouched(true)
    if (invalid) return
    changeStage(lead, 'future_nurture', { reason: 'timing', note: note.trim() })
    const dueAt = `${revisit}T09:00:00+01:00`
    createFollowUp({ leadId: lead.id, ownerUserId: lead.ownerUserId, action: 'Check back in', dueAt })
    const fresh = leadsCollection.find(lead.id) ?? lead
    setNextAction(fresh, 'Check back in', dueAt)
    toast({ tone: 'success', title: `Marked not now. Reminder set for ${revisit}.` })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Not now"
      description={`${personName(lead.personId)} is not going ahead yet. Pick when to check back.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Check back on" required error={touched && invalid ? 'Pick a date.' : undefined}>
          <Input
            type="date"
            min={TODAY}
            value={revisit}
            invalid={touched && invalid}
            onChange={(event) => setRevisit(event.target.value)}
          />
        </Field>
        <Field label="Why not now" optional>
          <Textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Waiting for the next cohort. Money is tight until January."
          />
        </Field>
      </div>
    </Modal>
  )
}
