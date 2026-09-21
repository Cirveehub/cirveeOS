import { useEffect, useState } from 'react'
import { Button, Checkbox, Field, Modal, Select, Textarea } from '@/ui'
import type { LossReason, PersonId, UserId } from '@/mocks/types'
import { ALL_LOSS_REASONS, LOSS_REASON_LABELS, useDirectory } from '../lib/lookups'
import { PersonPickerRow, UserPicker } from './Pickers'

export interface LossReasonModalProps {
  open: boolean
  onClose: () => void
  count?: number
  onConfirm: (reason: LossReason, note: string) => void
}

export function LossReasonModal({ open, onClose, count = 1, onConfirm }: LossReasonModalProps) {
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
      title={count === 1 ? 'Why are they not going ahead?' : `Why are these ${count} not going ahead?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={invalid}>
            Mark as lost
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Reason" required error={touched && invalid ? 'Choose a reason.' : undefined}>
          <Select
            value={reason}
            invalid={touched && invalid}
            onChange={(event) => setReason(event.target.value as LossReason)}
            placeholder="Choose a reason"
            options={ALL_LOSS_REASONS.map((r) => ({ value: r, label: LOSS_REASON_LABELS[r] }))}
          />
        </Field>

        <Field label="What happened" optional>
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
      title={count === 1 ? 'Change who handles this' : `Change who handles these ${count}`}
      description={
        currentOwnerUserId && count === 1
          ? `Currently handled by ${userNameOf(currentOwnerUserId)}.`
          : undefined
      }
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
            Hand over
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Hand to"
          required
          error={touched && !owner ? 'Choose the person taking this over.' : undefined}
        >
          <UserPicker value={owner} onChange={setOwner} invalid={touched && !owner} aria-label="Hand to" />
        </Field>

        <Field label="Why" required error={touched && !reason.trim() ? 'Say why it is moving.' : undefined}>
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Chidinma is on leave until 4 October."
          />
        </Field>

        <Checkbox
          checked={notify}
          onChange={(event) => setNotify(event.target.checked)}
          label="Let them know"
        />
      </div>
    </Modal>
  )
}

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
      title="Who referred them?"
      description="The person named here is the one paid the referral commission."
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
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Referred by" optional hint="Leave empty when nobody referred them.">
          <PersonPickerRow value={value} onChange={setValue} label="Referred by" relationship="referrer" />
        </Field>

        <Field label="Why the change" required error={touched && invalid ? 'Say why.' : undefined}>
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
      title="Who closed it?"
      description="Often not the person who handled the enquiry."
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
            Save
          </Button>
        </>
      }
    >
      <Field label="Closed by" optional>
        <UserPicker
          value={value}
          onChange={setValue}
          allowEmpty
          emptyLabel="Not yet"
          aria-label="Closed by"
        />
      </Field>
    </Modal>
  )
}
