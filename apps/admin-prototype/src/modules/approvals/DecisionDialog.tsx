/**
 * The decision dialog. Approve, reject and return all pass through here, so
 * the consequence is always restated and the block is always enforced at the
 * call rather than by hiding a button.
 */

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Alert, Button, Field, Modal, Textarea } from '@/ui'
import { approvalRequestsCollection, canDecide, useRecord } from '@/mocks'
import type { UserId } from '@/mocks'
import { consequenceSentence, impactForRequest } from './impact'
import { decide, type DecisionOutcome, type DecisionResult } from './engine'
import { userName } from './shared'

const TITLES: Record<DecisionOutcome, string> = {
  approve: 'Approve this request',
  reject: 'Reject this request',
  return: 'Return for information',
}

const VERBS: Record<DecisionOutcome, string> = {
  approve: 'Approve',
  reject: 'Reject',
  return: 'Return for information',
}

export interface DecisionDialogProps {
  open: boolean
  onClose: () => void
  requestId: string | null
  outcome: DecisionOutcome
  actorUserId: UserId
  onDecided?: (result: DecisionResult) => void
}

export function DecisionDialog({
  open,
  onClose,
  requestId,
  outcome,
  actorUserId,
  onDecided,
}: DecisionDialogProps) {
  const request = useRecord(approvalRequestsCollection, requestId ?? undefined)
  const [comment, setComment] = useState('')
  const [validation, setValidation] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setComment('')
      setValidation(null)
    }
  }, [open, requestId, outcome])

  if (!request) return null

  const gate = canDecide(request, actorUserId)
  const impact = impactForRequest(request)
  const commentRequired = outcome !== 'approve'

  const submit = () => {
    if (commentRequired && comment.trim().length === 0) {
      setValidation(outcome === 'reject' ? 'A rejection needs a reason.' : 'Say what information is needed.')
      return
    }
    const result = decide(request.id as string, actorUserId, outcome, comment)
    if (!result.ok) {
      setValidation(result.reason)
      return
    }
    onDecided?.(result)
    onClose()
    if (result.status === 'approved') {
      toast.success(`${request.ref} approved. ${result.executed.length} downstream record${result.executed.length === 1 ? '' : 's'} written.`)
    } else if (result.status === 'pending') {
      toast.success(`${request.ref} approved at step ${result.stepsCompleted} of ${result.stepsTotal}.`)
    } else if (result.status === 'returned_for_information') {
      toast.success(`${request.ref} returned. SLA clock paused.`)
    } else {
      toast.success(`${request.ref} rejected.`)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={TITLES[outcome]}
      description={`${request.ref} · ${request.title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={outcome === 'reject' ? 'danger' : 'primary'}
            onClick={submit}
            disabled={!gate.allowed}
          >
            {VERBS[outcome]}
          </Button>
        </>
      }
    >
      {!gate.allowed && (
        <Alert tone="danger" title="This decision is blocked" className="mb-4">
          {gate.reason} Raised by {userName(request.requesterUserId)}.
        </Alert>
      )}

      {outcome === 'approve' && (
        <>
          <p className="text-body-14 text-text">{consequenceSentence(request)}</p>
          <ul className="mt-3 space-y-1.5 rounded-xl border border-border bg-surface-sunken p-3">
            {impact.lines.map((line, i) => (
              <li key={i} className="text-body-13 text-text-secondary">
                · {line.text} <span className="text-text-label">{line.entityRef}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {outcome === 'reject' && (
        <p className="text-body-14 text-text">
          Rejecting closes {request.ref}. No downstream record is created, and the requester is notified with your
          reason. A rejected request is never deleted — it stays in the queue with its history.
        </p>
      )}

      {outcome === 'return' && (
        <p className="text-body-14 text-text">
          Returning sends {request.ref} back to {userName(request.requesterUserId)} and{' '}
          <span className="font-semibold">pauses the SLA clock</span> at {request.ageHours}h of {request.slaHours}h. The
          route restarts at step 1 when they resubmit.
        </p>
      )}

      <Field
        className="mt-4"
        label="Comment"
        required={commentRequired}
        optional={!commentRequired}
        error={validation}
        hint={
          commentRequired
            ? 'Stored on the decision with your name and the timestamp.'
            : 'Optional. Stored on the decision with your name and the timestamp.'
        }
      >
        <Textarea
          rows={3}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value)
            setValidation(null)
          }}
          invalid={Boolean(validation)}
          placeholder={
            outcome === 'return'
              ? 'Confirm the pro-rata calculation against the attendance record.'
              : 'What the next reader needs to know.'
          }
        />
      </Field>
    </Modal>
  )
}
