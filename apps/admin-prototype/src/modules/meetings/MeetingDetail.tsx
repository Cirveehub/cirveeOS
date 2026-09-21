/**
 * One meeting.
 *
 * The "Live numbers" tab is the point of the module: the review pack is read
 * straight out of the same collections the dashboards read, so the monthly
 * review builds itself and nobody spends two days on slides.
 *
 * Action items show their carried-forward count here too, because an item that
 * has rolled through four agendas is the number that creates accountability.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Gavel,
  ListChecks,
  Nfc,
  Plus,
  Repeat2,
  Scale,
  ScrollText,
  Send,
  Users,
} from 'lucide-react'

import { formatDate, formatDateTime, formatNaira, formatNumber, formatPercent, formatTime } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
  KeyValueList,
  SkeletonCard,
  StatCard,
  StatusBadge,
  Tabs,
  Textarea,
  type TabItem,
} from '@/ui'
import {
  MTD,
  actionItemsCollection,
  admissionsCollection,
  approvalRequestsCollection,
  collectedRevenue,
  collectionRate,
  decisionsCollection,
  enrollmentsCollection,
  invoicedRevenue,
  invoicesCollection,
  leadsCollection,
  meetingsCollection,
  outstandingTuition,
  paymentsCollection,
  ticketsCollection,
  useCollection,
} from '@/mocks'
import type { ActionItem, ActionItemStatus, Decision, LeadStage, MeetingId } from '@/mocks'

import {
  ACTION_STATUS_LABEL,
  ACTION_STATUS_TONE,
  ATTENDANCE_METHOD_LABEL,
  DECISION_STATUS_LABEL,
  DECISION_STATUS_TONE,
  ErrorPanel,
  MEETING_TYPE_LABEL,
  ModuleHeader,
  Screen,
  daysOverdue,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'
import { NewActionModal, NewDecisionModal } from './modals'
import { circulateMinutes, saveMinutes, updateActionStatus } from './writes'

/** A lead is out of the pipeline once it enrols or is closed out. */
const CLOSED_LEAD_STAGES: LeadStage[] = [
  'enrolled',
  'not_interested',
  'lost',
  'invalid',
  'unresponsive',
]

const TABS: TabItem[] = [
  { id: 'agenda', label: 'Agenda', icon: ClipboardList },
  { id: 'attendance', label: 'Attendance', icon: Users },
  { id: 'numbers', label: 'Live numbers', icon: CalendarDays },
  { id: 'actions', label: 'Action items', icon: ListChecks },
  { id: 'decisions', label: 'Decisions', icon: Gavel },
  { id: 'minutes', label: 'Minutes', icon: ScrollText },
]

export default function MeetingDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') ?? 'agenda'

  const [addingAction, setAddingAction] = useState(false)
  const [loggingDecision, setLoggingDecision] = useState(false)
  const [replacing, setReplacing] = useState<Decision | null>(null)
  /** Minutes are edited in place, keyed by agenda sequence, until saved. */
  const [draftNotes, setDraftNotes] = useState<Record<number, string>>({})
  const [editingMinutes, setEditingMinutes] = useState(false)

  const allMeetings = useCollection(meetingsCollection)
  const { loading, error, rows: meetings, retry } = useModuleData(allMeetings, 'meetings.detail')

  const actions = useCollection(actionItemsCollection)
  const decisions = useCollection(decisionsCollection)

  /* The live review pack reads the same collections every dashboard reads. */
  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const leads = useCollection(leadsCollection)
  const admissions = useCollection(admissionsCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const approvals = useCollection(approvalRequestsCollection)
  const tickets = useCollection(ticketsCollection)

  const personName = usePersonName()
  const userName = useUserName()

  const meeting = meetings.find((m) => m.id === id) ?? null

  const meetingActions = useMemo(
    () => (meeting ? actions.filter((a) => a.meetingId === meeting.id) : []),
    [actions, meeting],
  )
  const meetingDecisions = useMemo(
    () => (meeting ? decisions.filter((d) => d.meetingId === meeting.id) : []),
    [decisions, meeting],
  )

  const pack = useMemo(
    () => ({
      collected: collectedRevenue(MTD),
      invoiced: invoicedRevenue(MTD),
      collectionRate: collectionRate(MTD),
      outstanding: outstandingTuition(),
      enrolled: enrollments.filter((e) => e.status === 'active').length,
      openLeads: leads.filter(
        (l) => !CLOSED_LEAD_STAGES.includes(l.stage),
      ).length,
      admissions: admissions.filter((a) => a.status === 'enrolled').length,
      pendingApprovals: approvals.filter((a) => a.status === 'pending').length,
      openTickets: tickets.filter((t) =>
        ['new', 'open', 'pending_customer', 'escalated', 'reopened'].includes(t.status),
      ).length,
    }),
    // Every collection is a dependency so the pack re-derives when any of them moves.
    [invoices, payments, leads, admissions, enrollments, approvals, tickets],
  )

  /* The draft follows whichever meeting is on screen, and is discarded on leaving. */
  const agendaNotes = useMemo(
    () => (meeting ? meeting.agendaItems.map((item) => [item.sequence, item.notes] as const) : []),
    [meeting],
  )
  useEffect(() => {
    setDraftNotes(Object.fromEntries(agendaNotes))
    setEditingMinutes(false)
  }, [agendaNotes])

  const header = (
    <ModuleHeader
      title={meeting?.title ?? 'Meeting'}
      description={
        meeting
          ? `${MEETING_TYPE_LABEL[meeting.type]} · ${formatDate(meeting.startAt)} ${formatTime(meeting.startAt)} · ${formatNumber(meeting.durationMinutes)} minutes · chaired by ${userName(meeting.chairUserId)}`
          : 'Agenda, attendance, the live review pack, actions and decisions.'
      }
      actions={
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/meetings')}
        >
          All meetings
        </Button>
      }
    />
  )

  if (error) {
    return (
      <Screen>
        {header}
        <ErrorPanel onRetry={retry} what="This meeting" />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        {header}
        <div className="space-y-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </Screen>
    )
  }

  if (!meeting) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={CalendarDays}
          title="No meeting with that reference"
          message="It may have been cancelled, or the link is stale. Every sitting that exists is on the meeting list."
          action={
            <Button size="sm" asChild>
              <Link to="/meetings">Open the meeting list</Link>
            </Button>
          }
        />
      </Screen>
    )
  }

  const present = meeting.attendance.filter((a) => a.method !== 'apology')
  const carried = meetingActions.filter((a) => a.carriedForwardCount > 0)

  return (
    <Screen>
      {header}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={meeting.status} />
        <Badge tone="accent">{MEETING_TYPE_LABEL[meeting.type]}</Badge>
        <Badge tone="neutral">
          {formatNumber(present.length)} of {formatNumber(meeting.attendance.length)} attended
        </Badge>
        {meeting.minutesCirculatedAt ? (
          <Badge tone="success">Minutes circulated {formatDate(meeting.minutesCirculatedAt)}</Badge>
        ) : meeting.status === 'held' ? (
          <Badge tone="warning">Minutes not circulated</Badge>
        ) : null}
      </div>

      <Tabs
        tabs={TABS.map((item) =>
          item.id === 'actions'
            ? { ...item, badge: meetingActions.length }
            : item.id === 'decisions'
              ? { ...item, badge: meetingDecisions.length }
              : item,
        )}
        value={tab}
        onChange={(next) => setParams({ tab: next }, { replace: true })}
      />

      <div className="mt-6">
        {tab === 'agenda' && (
          <Card>
            <CardHeader
              title="Agenda"
              description={`Built from the ${MEETING_TYPE_LABEL[meeting.type].toLowerCase()} template, with an owner and a time-box on every item.`}
            />
            <CardBody padding="none">
              {meeting.agendaItems.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={ClipboardList}
                    size="sm"
                    bordered
                    title="No agenda yet"
                    message="A meeting with no agenda has no time-boxes and no owners, and it will overrun. The template for this meeting type supplies the standing items."
                  />
                </div>
              ) : (
                <ol className="divide-y divide-border">
                  {[...meeting.agendaItems]
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((item) => (
                      <li key={item.sequence} className="flex flex-wrap items-start gap-4 px-6 py-4">
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-label-11 text-text-label tabular-nums">
                          {item.sequence}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-body-14 text-text">{item.title}</span>
                          <span className="block text-body-12 text-text-secondary">
                            {userName(item.ownerUserId)} · {formatNumber(item.timeboxMinutes)} minute
                            time-box
                          </span>
                          {item.notes && (
                            <span className="mt-1 block text-body-13 text-text-secondary">{item.notes}</span>
                          )}
                        </span>
                      </li>
                    ))}
                </ol>
              )}
            </CardBody>
          </Card>
        )}

        {tab === 'attendance' && (
          <Card>
            <CardHeader
              title="Attendance"
              description="How each person was recorded — an NFC tap at the room door, a platform log, or an apology."
            />
            <CardBody padding="none">
              {meeting.attendance.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Users}
                    size="sm"
                    bordered
                    title="Nobody recorded"
                    message="Attendance is captured by the reader on the seminar room door and by the platform for anyone joining remotely. Neither has reported against this meeting."
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {meeting.attendance.map((entry) => (
                    <li
                      key={entry.personId}
                      className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                    >
                      <span className="min-w-0">
                        <span className="block text-body-14 text-text">{personName(entry.personId)}</span>
                        <span className="block text-body-12 text-text-secondary">
                          {ATTENDANCE_METHOD_LABEL[entry.method]}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {entry.method === 'nfc_tap' && (
                          <Badge tone="accent" size="sm" icon={<Nfc size={12} />}>
                            Tapped in
                          </Badge>
                        )}
                        {entry.method === 'apology' && (
                          <Badge tone="neutral" size="sm">
                            Apology
                          </Badge>
                        )}
                        <span className="text-body-13 tabular-nums text-text-secondary">
                          {entry.arrivedAt ? formatTime(entry.arrivedAt) : 'Did not attend'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}

        {tab === 'numbers' && (
          <div className="space-y-6">
            <Alert tone="info" title="The review pack builds itself">
              Every figure below is read from the same collections the dashboards read, at the moment
              this tab is opened. Nothing is pasted in, nothing is exported to slides, and nothing
              goes stale between the pack being prepared and the meeting starting.
            </Alert>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              <StatCard
                label="Collected this month"
                value={formatNaira(pack.collected, { compact: true })}
                caption="Money actually received"
              />
              <StatCard
                label="Invoiced this month"
                value={formatNaira(pack.invoiced, { compact: true })}
                caption="Never netted against collected"
              />
              <StatCard
                label="Collection rate"
                value={formatPercent(pack.collectionRate)}
                variant={pack.collectionRate >= 80 ? 'success' : 'warning'}
                caption="Collected as a share of invoiced"
              />
              <StatCard
                label="Outstanding tuition"
                value={formatNaira(pack.outstanding, { compact: true })}
                variant={pack.outstanding > 0 ? 'warning' : 'default'}
                caption="Owed by students right now"
              />
              <StatCard
                label="Active enrolments"
                value={formatNumber(pack.enrolled)}
                caption="Students currently on a cohort"
              />
              <StatCard
                label="Admissions enrolled"
                value={formatNumber(pack.admissions)}
                caption="Admissions that reached enrolment"
              />
              <StatCard
                label="Open leads"
                value={formatNumber(pack.openLeads)}
                caption="Still in the pipeline"
              />
              <StatCard
                label="Approvals pending"
                value={formatNumber(pack.pendingApprovals)}
                variant={pack.pendingApprovals > 0 ? 'warning' : 'default'}
                caption="Waiting on a decision"
              />
              <StatCard
                label="Open tickets"
                value={formatNumber(pack.openTickets)}
                variant={pack.openTickets > 0 ? 'warning' : 'default'}
                caption="Unresolved customer issues"
              />
            </div>
          </div>
        )}

        {tab === 'actions' && (
          <Card>
            <CardHeader
              title="Action items"
              description="Raised in this meeting. Anything not done carries forward to the next agenda by itself."
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/meetings/actions">Open the action register</Link>
                  </Button>
                  <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setAddingAction(true)}>
                    Add an action item
                  </Button>
                </div>
              }
            />
            <CardBody padding="none">
              {meetingActions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={ListChecks}
                    size="sm"
                    bordered
                    title="No actions raised here"
                    message="A meeting that produces no action and no decision produced nothing. If that is right, say so in the minutes."
                    action={
                      <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setAddingAction(true)}>
                        Add an action item
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {meetingActions.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-start justify-between gap-4 px-6 py-4">
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-14 text-text">{item.title}</span>
                        <span className="block text-body-12 text-text-secondary">
                          {userName(item.ownerUserId)} · due {formatDate(item.deadline)}
                          {item.status !== 'done' && daysOverdue(item.deadline) > 0
                            ? ` · ${formatNumber(daysOverdue(item.deadline))} days overdue`
                            : ''}
                        </span>
                        <span className="mt-1 block text-body-13 text-text-secondary">
                          {item.lastUpdateNote} · {formatDateTime(item.lastUpdateAt)}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center gap-2">
                        {item.carriedForwardCount > 0 && (
                          <Badge tone="warning" size="sm" icon={<Repeat2 size={12} />}>
                            Carried {formatNumber(item.carriedForwardCount)} times
                          </Badge>
                        )}
                        <Badge tone={ACTION_STATUS_TONE[item.status]} size="sm">
                          {ACTION_STATUS_LABEL[item.status]}
                        </Badge>
                        <ActionStatusControl item={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
            {carried.length > 0 && (
              <CardBody>
                <p className="text-body-13 text-text-secondary">
                  {formatNumber(carried.length)} of {formatNumber(meetingActions.length)} items raised
                  here have already rolled through at least one later agenda.
                </p>
              </CardBody>
            )}
          </Card>
        )}

        {tab === 'decisions' && (
          <Card>
            <CardHeader
              title="Decisions"
              description="What was decided in this meeting, by whom and why."
              actions={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" asChild>
                    <Link to="/meetings/decisions">Open the decision log</Link>
                  </Button>
                  <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setLoggingDecision(true)}>
                    Log a decision
                  </Button>
                </div>
              }
            />
            <CardBody padding="none">
              {meetingDecisions.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Gavel}
                    size="sm"
                    bordered
                    title="No decision logged against this meeting"
                    message="A decision that is not written down is a decision that will be relitigated. Anything settled here belongs in the log with its rationale."
                    action={
                      <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setLoggingDecision(true)}>
                        Log a decision
                      </Button>
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {meetingDecisions.map((decision) => (
                    <li key={decision.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-body-12 text-text-secondary">{decision.ref}</span>
                        <span className="text-body-14 text-text">{decision.title}</span>
                        <Badge tone={DECISION_STATUS_TONE[decision.status]} size="sm">
                          {DECISION_STATUS_LABEL[decision.status]}
                        </Badge>
                      </div>
                      <p className="mt-2 text-body-13 text-text-secondary">{decision.decision}</p>
                      <p className="mt-2 text-body-12 text-text-secondary">
                        Decided {formatDate(decision.decidedOn)} by{' '}
                        {decision.decidedByUserIds.map(userName).join(', ')}
                      </p>
                      {decision.status === 'active' && (
                        <Button
                          className="mt-3"
                          size="sm"
                          variant="secondary"
                          leftIcon={<Scale size={16} />}
                          onClick={() => setReplacing(decision)}
                        >
                          Supersede or reverse
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}

        {tab === 'minutes' && (
          <Card>
            <CardHeader
              title="Minutes"
              description="The record of the sitting. Minutes stay editable after the fact — the meeting happened, the record catches up — and circulating them sends the record to everyone who was invited."
              actions={
                <div className="flex flex-wrap gap-2">
                  {editingMinutes ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDraftNotes(Object.fromEntries(agendaNotes))
                          setEditingMinutes(false)
                        }}
                      >
                        Discard changes
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          saveMinutes(meeting, draftNotes)
                          setEditingMinutes(false)
                          toast.success('Minutes saved.')
                        }}
                      >
                        Save minutes
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => setEditingMinutes(true)}>
                      {meeting.minutesCirculatedAt ? 'Edit minutes' : 'Write the minutes'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    leftIcon={<Send size={16} />}
                    disabled={meeting.attendance.length === 0}
                    onClick={() => {
                      const result = circulateMinutes(meeting)
                      toast.success(
                        `Minutes circulated to ${formatNumber(result.recipients)} ${
                          result.recipients === 1 ? 'attendee' : 'attendees'
                        }.`,
                      )
                    }}
                  >
                    {meeting.minutesCirculatedAt ? 'Recirculate' : 'Circulate minutes'}
                  </Button>
                </div>
              }
            />
            <CardBody>
              <div className="space-y-6">
                {meeting.minutesCirculatedAt === null ? (
                  <Alert
                    tone="warning"
                    title={meeting.status === 'held' ? 'Minutes have not gone out' : 'This meeting has not sat yet'}
                  >
                    {meeting.status === 'held'
                      ? 'Until the minutes circulate, the actions raised here are only known to the people who were in the room.'
                      : 'Minutes are written and circulated after the meeting. Circulating one early marks it held.'}
                  </Alert>
                ) : (
                  <KeyValueList columns={2}>
                    <KeyValue label="Circulated">{formatDateTime(meeting.minutesCirculatedAt)}</KeyValue>
                    <KeyValue label="Chaired by">{userName(meeting.chairUserId)}</KeyValue>
                    <KeyValue label="Attended">
                      {formatNumber(present.length)} of {formatNumber(meeting.attendance.length)} invited
                    </KeyValue>
                    <KeyValue label="Produced">
                      {formatNumber(meetingActions.length)} actions ·{' '}
                      {formatNumber(meetingDecisions.length)} decisions
                    </KeyValue>
                  </KeyValueList>
                )}

                <div>
                  <h3 className="mb-3 text-heading-18">What each item settled</h3>
                  {meeting.agendaItems.length === 0 ? (
                    <EmptyState
                      icon={ScrollText}
                      size="sm"
                      bordered
                      title="No agenda to minute"
                      message="Minutes are written against the agenda items. This meeting has none."
                      action={
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setParams({ tab: 'agenda' }, { replace: true })}
                        >
                          Open the agenda
                        </Button>
                      }
                    />
                  ) : (
                    <ol className="divide-y divide-border rounded-xl border border-border">
                      {[...meeting.agendaItems]
                        .sort((a, b) => a.sequence - b.sequence)
                        .map((item) => (
                          <li key={item.sequence} className="px-4 py-3">
                            <span className="block text-body-14 text-text">
                              {item.sequence}. {item.title}
                            </span>
                            {editingMinutes ? (
                              <Textarea
                                className="mt-2"
                                aria-label={`Minute for ${item.title}`}
                                rows={2}
                                value={draftNotes[item.sequence] ?? ''}
                                onChange={(event) =>
                                  setDraftNotes((prev) => ({
                                    ...prev,
                                    [item.sequence]: event.target.value,
                                  }))
                                }
                                placeholder="What this item settled, and anything it left open."
                              />
                            ) : (
                              <span className="block text-body-13 text-text-secondary">
                                {item.notes || 'No note recorded against this item.'}
                              </span>
                            )}
                          </li>
                        ))}
                    </ol>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </div>

      <NewActionModal
        open={addingAction}
        onClose={() => setAddingAction(false)}
        meetingId={meeting.id as MeetingId}
        onCreated={(title) => toast.success(`"${title}" raised against this meeting.`)}
      />

      <NewDecisionModal
        open={loggingDecision}
        onClose={() => setLoggingDecision(false)}
        meetingId={meeting.id as MeetingId}
        onCreated={(decision) => toast.success(`${decision.ref} logged against this meeting.`)}
      />

      <NewDecisionModal
        key={(replacing?.id as string) ?? 'no-replacement'}
        open={replacing !== null}
        replacing={replacing}
        meetingId={meeting.id as MeetingId}
        onClose={() => setReplacing(null)}
        onCreated={(decision) => {
          toast.success(
            `${decision.ref} logged. ${replacing?.ref ?? 'The original'} stays in the log, linked forward to it.`,
          )
          setReplacing(null)
        }}
      />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Action status — closed or re-opened, never removed                         */
/* -------------------------------------------------------------------------- */

const NEXT_STATUS: Record<ActionItemStatus, { to: ActionItemStatus; label: string; note: string }> = {
  open: { to: 'in_progress', label: 'Start', note: 'Picked up by the owner.' },
  in_progress: { to: 'done', label: 'Mark done', note: 'Completed and confirmed in the meeting.' },
  blocked: { to: 'in_progress', label: 'Unblock', note: 'The blocker cleared.' },
  carried_forward: { to: 'in_progress', label: 'Start', note: 'Picked up after carrying forward.' },
  done: { to: 'open', label: 'Reopen', note: 'Reopened — the outcome did not hold.' },
}

function ActionStatusControl({ item }: { item: ActionItem }) {
  const next = NEXT_STATUS[item.status]
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={() => {
        updateActionStatus(item, next.to, next.note)
        toast.success(`"${item.title}" is now ${ACTION_STATUS_LABEL[next.to].toLowerCase()}.`)
      }}
    >
      {next.label}
    </Button>
  )
}
