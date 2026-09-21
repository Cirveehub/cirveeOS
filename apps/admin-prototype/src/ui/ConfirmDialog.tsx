import { AlertTriangle, type LucideIcon } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Modal, type ModalSize } from './Modal'

export interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  /** May return a promise — the confirm button shows a loading state until it settles. */
  onConfirm: () => void | Promise<void>
  title: ReactNode
  message?: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red confirm button, warning chip, and focus parked on Cancel. */
  destructive?: boolean
  icon?: LucideIcon | null
  size?: ModalSize
  /** Disable confirm — e.g. until a "type the name to confirm" field matches. */
  confirmDisabled?: boolean
  className?: string
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  size = 'sm',
  confirmDisabled = false,
  className,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  const Icon = icon === null ? null : (icon ?? (destructive ? AlertTriangle : null))

  const handleConfirm = async () => {
    try {
      setBusy(true)
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      size={size}
      hideCloseButton
      aria-label={typeof title === 'string' ? title : confirmLabel}
      className={className}
      // A destructive dialog should not open with the destructive button focused.
      initialFocusRef={destructive ? cancelRef : undefined}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={handleConfirm}
            loading={busy}
            loadingLabel={confirmLabel}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-4">
        {Icon && (
          <span
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-full',
              destructive ? 'bg-danger-fill text-danger-ink' : 'bg-accent-subtle text-accent',
            )}
          >
            <Icon size={20} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-body-15 font-bold text-text">{title}</h2>
          {message && <p className="mt-1.5 text-body-14 text-text-secondary">{message}</p>}
          {children && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </Modal>
  )
}
