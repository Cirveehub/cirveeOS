import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  CornerUpLeft,
  MessageSquarePlus,
  ShieldAlert,
  UserCog,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  EmptyState,
  Field,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  StatusBadge,
  Tabs,
  Textarea,
  Timeline,
  Tooltip,
  UnitTag,
  type TimelineItem,
} from '@/ui'
import {
  approvalRequestsCollection,
  approvalRoutesCollection,
  auditEventsCollection,
  canDecide,
  useCollection,
  useRecord,
} from '@/mocks'
import { formatDateTime, formatNaira } from '@/lib/format'
import { ActingUserSwitch, ImpactPreview, RouteVisualiser } from './components'
import { DecisionDialog } from './DecisionDialog'
import { addComment, escalate, reassign, resubmit, withdraw, type DecisionResult } from './engine'
import { impactForRequest } from './impact'
import {
  APPROVAL_TYPE_META,
  SLA_LABEL,
  SLA_TONE,
  STATUS_LABEL,
  ageLabel,
  branchName,
  escalationLabel,
  slaIsPaused,
  unitKey,
  unitName,
  useActingUser,
  useScreenState,
  userName,
  userOptions,
  userRoleName,
  WorkGroupTabs,
} from './shared'

type DecisionKind = 'approve' | 'reject' | 'return'

export default function ApprovalDetail() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')
  const navigate = useNavigate()
  const acting = useActingUser()

  const request = useRecord(approvalRequestsCollection, id)
  const routes = useCollection(approvalRoutesCollection)
  const auditEvents = useCollection(auditEventsCollection)

  const [dialog, setDialog] = useState<DecisionKind | null>(null)
  const [result, setResult] = useState<DecisionResult | null>(null)
  const [comment, setComment] = useState('')
  const [reassignOpen, setReassignOpen] = useState(false)
  const [reassignTo, setReassignTo] = useState('')
  const [reassignReason, setReassignReason] = useState('')
  const [reassignError, setReassignError] = useState<string | null>(null)
  const [blocked, setBlocked] = useState<string | null>(null)

  const tab = params.get('tab') ?? 'activity'

  const impact = useMemo(() => (request ? impactForRequest(request) : { lines: [], live: false }), [request])

  const audit = useMemo(
    () =>
      auditEvents
        .filter((event) => event.entityId === id || event.entityRef === request?.ref)
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    [auditEvents, id, request?.ref],
  )

  if (loading) {
    return (
      <div className="px-8 py-6">
        <Skeleton height={72} rounded="xl" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton height={200} rounded="xl" />
            <Skeleton height={240} rounded="xl" />
          </div>
          <Skeleton height={420} rounded="xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-8 py-6">
        <Alert
          tone="danger"
          title="Could not load this request"
          action={
            <Button size="sm" variant="secondary" onClick={retry}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          variant="error"
          title="That request does not exist"
          message="It may have been raised in a different demo session. The queue has everything that does exist."
          action={
            <Button onClick={() => navigate('/work/approvals')} leftIcon={<ArrowLeft size={16} />}>
              Back to approvals
            </Button>
          }
        />
      </div>
    )
  }

  const gate = canDecide(request, acting)
  const route = routes.find((r) => r.id === request.routeId)
  const meta = APPROVAL_TYPE_META[request.type]
  const isRequester = request.requesterUserId === acting
  const decided = request.status !== 'pending' && request.status !== 'returned_for_information'
  const unit = unitKey(request.unitId)

  const escalationPolicy = route
    ? (() => {
        const amount = request.amount ?? 0
        const matched =
          route.bands.find((b) => amount >= b.fromAmount && (b.toAmount === null || amount < b.toAmount)) ?? route.bands[0]
        if (!matched) return 'No band matches this amount.'
        if (!matched.escalateToRoleId) {
          return `This band has no escalation target. A step that stalls is reassigned by hand, and the reassignment is audited.`
        }
        return `If the step is not decided within ${matched.escalateAfterHours} hours it reassigns to ${userName(request.escalatesToUserId)} automatically, so a pending request is never left without a live approver.`
      })()
    : 'The route this request was raised under is no longer published. The request keeps it regardless.'

  const threadItems: TimelineItem[] = request.thread
    .slice()
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((entry, index) => ({
      id: `thread-${index}`,
      title: entry.kind === 'system' ? 'Routing' : userName(entry.actorUserId),
      description: entry.body,
      timestamp: entry.at,
      tone: entry.kind === 'system' ? 'info' : 'neutral',
    }))

  const doReassign = () => {
    if (!reassignTo) {
      setReassignError('Pick the approver who takes this step.')
      return
    }
    const res = reassign(request.id as string, acting, reassignTo as typeof acting, reassignReason)
    if (!res.ok) {
      setReassignError(res.reason)
      return
    }
    setReassignOpen(false)
    setReassignTo('')
    setReassignReason('')
    setReassignError(null)
    toast.success(`${request.ref} reassigned. The route is unchanged; only the holder moved.`)
  }

  const doEscalate = () => {
    const res = escalate(request.id as string, acting)
    if (!res.ok) {
      setBlocked(res.reason)
      return
    }
    setBlocked(null)
    toast.success(`${request.ref} escalated by policy.`)
  }

  const doResubmit = () => {
    const res = resubmit(request.id as string, acting, comment)
    if (!res.ok) {
      setBlocked(res.reason)
      return
    }
    setComment('')
    setBlocked(null)
    toast.success(`${request.ref} resubmitted. SLA clock resumed, route restarted at step 1.`)
  }

  const doWithdraw = () => {
    const res = withdraw(request.id as string, acting, comment || 'Withdrawn by the requester.')
    if (!res.ok) {
      setBlocked(res.reason)
      return
    }
    setComment('')
    toast.success(`${request.ref} withdrawn. The row stays visible with its history.`)
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        title={request.title}
        description={`${request.ref} · ${meta.label}`}
        breadcrumbs={[
          { label: 'Work', to: '/work' },
          { label: 'Approvals', to: '/work/approvals' },
          { label: request.ref },
        ]}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={request.status} label={STATUS_LABEL[request.status]} />
            {slaIsPaused(request) ? (
              <Badge tone="info">SLA clock paused</Badge>
            ) : request.status === 'pending' ? (
              <Badge tone={SLA_TONE[request.slaState]}>{SLA_LABEL[request.slaState]}</Badge>
            ) : null}
            <ActingUserSwitch />
          </div>
        }
        actions={
          <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/work/approvals')}>
            Back to queue
          </Button>
        }
      />

      <WorkGroupTabs group="approvals" active="approvals" />

      {blocked && (
        <Alert tone="danger" title="Blocked" className="mt-6" onDismiss={() => setBlocked(null)}>
          {blocked}
        </Alert>
      )}

      {result && result.status === 'approved' && (
        <Alert tone="success" title={`Approved at step ${result.stepsCompleted} of ${result.stepsTotal}`} className="mt-6">
          {result.executed.length > 0 ? (
            <ul className="space-y-0.5">
              {result.executed.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            'No downstream record needed to be created.'
          )}
        </Alert>
      )}

      {result && result.status === 'pending' && (
        <Alert tone="success" title={`Approved at step ${result.stepsCompleted} of ${result.stepsTotal}`} className="mt-6">
          Awaiting {userName(request.currentApproverUserId)}.
        </Alert>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left — request, impact, thread */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader title="Request" description={meta.blurb} />
            <CardBody className="space-y-4">
              <KeyValueList columns={2}>
                <KeyValue label="Type">{meta.label}</KeyValue>
                <KeyValue label="Requester">{`${userName(request.requesterUserId)} · ${userRoleName(request.requesterUserId)}`}</KeyValue>
                <KeyValue label="Raised">{formatDateTime(request.raisedAt)}</KeyValue>
                <KeyValue label="Amount">{request.amount === null ? 'Not a financial request' : formatNaira(request.amount)}</KeyValue>
                <KeyValue label="Unit">{unit ? <UnitTag unit={unit} size="sm" /> : unitName(request.unitId)}</KeyValue>
                <KeyValue label="Branch">{branchName(request.branchId)}</KeyValue>
                <KeyValue label="Age">{ageLabel(request)}</KeyValue>
                <KeyValue label="SLA">{`${request.slaHours} hours`}</KeyValue>
                <KeyValue label="Related record">{`${request.relatedEntityType} · ${request.relatedEntityRef}`}</KeyValue>
              </KeyValueList>

              <div>
                <p className="text-label-11 text-text-label">Justification</p>
                <p className="mt-1 text-body-14 text-text">{request.justification}</p>
              </div>

              <p className="text-body-12 text-text-secondary">
                Raised on {meta.label.toLowerCase()} route v{request.routeVersion}. Republishing the route does not
                re-route this request.
              </p>
            </CardBody>
          </Card>

          <ImpactPreview {...impact} />

          <Card>
            <CardHeader
              title="History"
              description="The thread is the human record. The audit strip beside it is immutable and never merged with it."
            />
            <CardBody padding="none">
              <div className="px-6 pt-4">
                <Tabs
                  tabs={[
                    { id: 'activity', label: 'Activity', badge: request.thread.length },
                    { id: 'audit', label: 'Audit', badge: audit.length },
                  ]}
                  value={tab}
                  onChange={(next) => {
                    const p = new URLSearchParams(params)
                    p.set('tab', next)
                    setParams(p, { replace: true })
                  }}
                />
              </div>
              <div className="px-6 py-4">
                {tab === 'activity' ? (
                  threadItems.length === 0 ? (
                    <EmptyState size="sm" title="Nothing said yet" message="Comments and routing steps appear here." />
                  ) : (
                    <Timeline items={threadItems} timeFormat="absolute" />
                  )
                ) : audit.length === 0 ? (
                  <EmptyState
                    size="sm"
                    title="No audit rows yet"
                    message="Every state change on this request writes one. They appear as soon as a decision is taken."
                  />
                ) : (
                  <ul className="space-y-1.5">
                    {audit.map((event) => (
                      <li
                        key={event.id}
                        className="grid grid-cols-[10.5rem_1fr] gap-3 rounded-lg border border-border px-3 py-2 font-mono text-body-12"
                      >
                        <span className="text-text-secondary">{formatDateTime(event.at)}</span>
                        <span className="text-text">
                          {event.actorName} · {event.action}
                          {event.field ? ` · ${event.field}` : ''}
                          {event.before || event.after ? (
                            <>
                              {' '}
                              <span className="text-text-secondary">{event.before ?? '—'}</span> →{' '}
                              <span className="text-text">{event.after ?? '—'}</span>
                            </>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right — route and decision */}
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Route"
              description={
                route
                  ? `${APPROVAL_TYPE_META[route.type].label} route v${route.version}, effective from ${route.effectiveFrom}`
                  : 'Route version no longer published'
              }
              actions={
                <Link
                  to="/work/approval-routes"
                  className="rounded-sm text-body-13 text-accent underline decoration-2 underline-offset-4 hover:text-accent-hover"
                >
                  Configure
                </Link>
              }
            />
            <CardBody>
              <RouteVisualiser
                steps={request.steps}
                currentStepIndex={request.currentStepIndex}
                escalation={escalationLabel(request)}
              />
              <p className="mt-4 rounded-xl border border-border bg-surface-sunken p-3 text-body-13 text-text-secondary">
                {escalationPolicy}
              </p>
            </CardBody>
            {request.status === 'pending' && (
              <CardFooter align="start">
                <Button size="sm" variant="secondary" leftIcon={<UserCog size={15} />} onClick={() => setReassignOpen(true)}>
                  Reassign approver
                </Button>
                <Button size="sm" variant="ghost" leftIcon={<ShieldAlert size={15} />} onClick={doEscalate}>
                  Escalate now
                </Button>
              </CardFooter>
            )}
          </Card>

          <Card>
            <CardHeader title="Decision" description={`Acting as ${userName(acting)} · ${userRoleName(acting)}`} />
            <CardBody className="space-y-3">
              {!gate.allowed && (
                <Alert tone={isRequester ? 'danger' : 'info'} title={isRequester ? 'Blocked' : 'Not your step'}>
                  {gate.reason}
                </Alert>
              )}

              {decided ? (
                <p className="text-body-14 text-text-secondary">
                  This request was {STATUS_LABEL[request.status].toLowerCase()}
                  {request.decidedAt ? ` on ${formatDateTime(request.decidedAt)}` : ''}. It is read-only — decisions are
                  never edited, only superseded by a new request.
                </p>
              ) : (
                <Tooltip content={gate.allowed ? '' : (gate.reason ?? '')} disabled={gate.allowed}>
                  <div className="flex flex-col gap-2">
                    <Button fullWidth disabled={!gate.allowed} aria-disabled={!gate.allowed} onClick={() => setDialog('approve')}>
                      Approve
                    </Button>
                    <Button
                      fullWidth
                      variant="danger"
                      disabled={!gate.allowed}
                      aria-disabled={!gate.allowed}
                      onClick={() => setDialog('reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      fullWidth
                      variant="secondary"
                      leftIcon={<CornerUpLeft size={16} />}
                      disabled={!gate.allowed}
                      aria-disabled={!gate.allowed}
                      onClick={() => setDialog('return')}
                    >
                      Return for information
                    </Button>
                  </div>
                </Tooltip>
              )}

              <p className="text-body-12 text-text-secondary">
                Rejecting and returning both require a comment. Returning pauses the SLA clock until the requester
                resubmits.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={isRequester ? 'Your request' : 'Comment'}
              description={
                isRequester
                  ? 'You raised this. You can comment, resubmit if it was returned, or withdraw it.'
                  : 'Add to the thread without deciding.'
              }
            />
            <CardBody className="space-y-3">
              <Field label="Comment" optional>
                <Textarea
                  rows={3}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Pro-rata computed against 2 of 8 attended sessions."
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  leftIcon={<MessageSquarePlus size={15} />}
                  onClick={() => {
                    if (addComment(request.id as string, acting, comment)) {
                      setComment('')
                      toast.success('Comment added to the thread.')
                    } else {
                      setBlocked('Write something before adding a comment.')
                    }
                  }}
                >
                  Add comment
                </Button>
                {isRequester && request.status === 'returned_for_information' && (
                  <Button size="sm" onClick={doResubmit}>
                    Resubmit
                  </Button>
                )}
                {isRequester && (request.status === 'pending' || request.status === 'returned_for_information') && (
                  <Button size="sm" variant="ghost" onClick={doWithdraw}>
                    Withdraw
                  </Button>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <DecisionDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        requestId={request.id as string}
        outcome={dialog ?? 'approve'}
        actorUserId={acting}
        onDecided={setResult}
      />

      <Modal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        title="Reassign this step"
        description="The route is configuration and does not change. Only the person holding the live step moves, and the move is audited."
        footer={
          <>
            <Button variant="secondary" onClick={() => setReassignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doReassign}>Reassign</Button>
          </>
        }
      >
        <Field label="New approver" required error={reassignError}>
          <Select
            placeholder="Pick an approver"
            value={reassignTo}
            onChange={(event) => {
              setReassignTo(event.target.value)
              setReassignError(null)
            }}
            options={userOptions()}
            invalid={Boolean(reassignError)}
          />
        </Field>
        <Field className="mt-3" label="Reason" optional>
          <Textarea
            rows={2}
            value={reassignReason}
            onChange={(event) => setReassignReason(event.target.value)}
            placeholder="Fatima is on approved leave until 28 Sep."
          />
        </Field>
      </Modal>
    </div>
  )
}
