/**
 * The four audited lead dialogs.
 *
 * `LossReasonModal` is the one the founder will test: a lead cannot leave the
 * pipeline without a reason, and the form genuinely blocks rather than
 * defaulting to "Other".
 */

import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Field, Modal, Select, Textarea } from '@/ui'
import type { LeadStage, LossReason, PersonId, UserId } from '@/mocks/types'
import { ALL_LOSS_REASONS, LOSS_REASON_LABELS, STAGE_LABELS, useDirectory } from '../lib/lookups'
import { PersonPickerRow, UserPicker } from './Pickers'

/* -------------------------------------------------------------------------- */
/* Loss reason — mandatory on exit                                            */
/* -------------------------------------------------------------------------- */

export interface LossReasonModalProps {
  open: boolean
  onClose: () => void
  /** The exit stage being moved into. */
  stage: LeadStage | null
  /** How many leads the reason will be applied to. */
  count?: number
  onConfirm: (reason: LossReason, note: string) => void
}

export function LossReasonModal({ open, onClose, stage, count = 1, onConfirm }: LossReasonModalProps) {
  const [reason, setReason] = useState<LossReason | ''>('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setNote('')
      setTouched(false)
    }
  }, [open])

  const invalid = !reason
  const submit = () => {
    setTouched(true)
    if (invalid) return
    onConfirm(reason, note.trim())
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Why is this lead leaving the pipeline?"
      description={
        stage
          ? `Moving ${count === 1 ? 'this lead' : `${count} leads`} to ${STAGE_LABELS[stage]}. A loss reason is required and is written to the audit log.`
          : undefined
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={invalid}>
            Record and move stage
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Loss reason"
          required
          error={touched && invalid ? 'Choose a loss reason. The stage cannot change without one.' : undefined}
        >
          <Select
            value={reason}
            invalid={touched && invalid}
            onChange={(event) => setReason(event.target.value as LossReason)}
            placeholder="Choose a reason"
            options={ALL_LOSS_REASONS.map((r) => ({ value: r, label: LOSS_REASON_LABELS[r] }))}
          />
        </Field>

        <Field
          label="What happened"
          optional
          hint="Free text. Goes on the lead's activity feed, not the audit log."
        >
          <Textarea
            rows={3}
            value={note}
            maxLength={400}
            showCount
            onChange={(event) => setNote(event.target.value)}
            placeholder="Said the fee was beyond budget this quarter. Asked to be contacted in January."
          />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Reassign owner — attribution is preserved                                  */
/* -------------------------------------------------------------------------- */

export interface ReassignOwnerModalProps {
  open: boolean
  onClose: () => void
  currentOwnerUserId: UserId | null
  count?: number
  onConfirm: (toUserId: UserId, reason: string, notify: boolean) => void
}

export function ReassignOwnerModal({
  open,
  onClose,
  currentOwnerUserId,
  count = 1,
  onConfirm,
}: ReassignOwnerModalProps) {
  const { userNameOf } = useDirectory()
  const [owner, setOwner] = useState<UserId | null>(null)
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(true)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setOwner(null)
      setReason('')
      setNotify(true)
      setTouched(false)
    }
  }, [open])

  const invalid = !owner || !reason.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={count === 1 ? 'Reassign lead owner' : `Reassign ${count} leads`}
      description="Ownership history is preserved. The previous owner stays visible on the audit tab."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (invalid || !owner) return
              onConfirm(owner, reason.trim(), notify)
              onClose()
            }}
            disabled={invalid}
          >
            Reassign
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="info" title="This does not touch attribution">
          The referrer and the closer are separate fields and are left exactly as they are.
          Reassigning the owner changes who works the lead, not who earns on it.
        </Alert>

        {currentOwnerUserId && (
          <p className="text-body-13 text-text-secondary">
            Current owner: <span className="font-semibold text-text">{userNameOf(currentOwnerUserId)}</span>
          </p>
        )}

        <Field
          label="New owner"
          required
          error={touched && !owner ? 'Choose the person taking this over.' : undefined}
        >
          <UserPicker value={owner} onChange={setOwner} invalid={touched && !owner} aria-label="New owner" />
        </Field>

        <Field
          label="Reason"
          required
          hint="Written to the audit log as the reason for the ownership change."
          error={touched && !reason.trim() ? 'A reason is required for an audited change.' : undefined}
        >
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Chidinma is on leave until 4 October. Moving her Ibadan pipeline to Blessing."
          />
        </Field>

        <Checkbox
          checked={notify}
          onChange={(event) => setNotify(event.target.checked)}
          label="Notify the new owner"
        />
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Change referrer                                                            */
/* -------------------------------------------------------------------------- */

export interface ChangeReferrerModalProps {
  open: boolean
  onClose: () => void
  current: PersonId | null
  onConfirm: (referrerPersonId: PersonId | null, reason: string) => void
}

export function ChangeReferrerModal({ open, onClose, current, onConfirm }: ChangeReferrerModalProps) {
  const [value, setValue] = useState<PersonId | null>(current)
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(current)
      setReason('')
      setTouched(false)
    }
  }, [open, current])

  const invalid = !reason.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Change referrer"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (invalid) return
              onConfirm(value, reason.trim())
              onClose()
            }}
            disabled={invalid}
          >
            Change referrer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Alert tone="warning" title="This changes who commission attributes to">
          Commission is evaluated against the referrer field independently of the owner and the
          closer. This change is audited.
        </Alert>

        <Field label="Referrer" optional hint="Leave empty when nobody brought this lead.">
          <PersonPickerRow value={value} onChange={setValue} label="Referrer" relationship="referrer" />
        </Field>

        <Field
          label="Reason"
          required
          error={touched && invalid ? 'A reason is required for an audited change.' : undefined}
        >
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ngozi confirmed she made the introduction, not Damilola."
          />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Set closer                                                                 */
/* -------------------------------------------------------------------------- */

export interface SetCloserModalProps {
  open: boolean
  onClose: () => void
  current: UserId | null
  onConfirm: (closerUserId: UserId | null) => void
}

export function SetCloserModal({ open, onClose, current, onConfirm }: SetCloserModalProps) {
  const [value, setValue] = useState<UserId | null>(current)

  useEffect(() => {
    if (open) setValue(current)
  }, [open, current])

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Set closer"
      description="Who actually closed this deal. Frequently not the lead owner."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(value)
              onClose()
            }}
          >
            Save closer
          </Button>
        </>
      }
    >
      <Field label="Closer" optional hint="Clear this field when the deal has not closed yet.">
        <UserPicker
          value={value}
          onChange={setValue}
          allowEmpty
          emptyLabel="Not set"
          aria-label="Closer"
        />
      </Field>
    </Modal>
  )
}
