import { X } from 'lucide-react'
import { useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'
import { useBodyScrollLock, useFocusTrap } from './internal/overlay'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  /** Sub-line under the title. Wired to `aria-describedby`. */
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: ModalSize
  /** Element to focus on open. Defaults to the first focusable in the panel. */
  initialFocusRef?: RefObject<HTMLElement | null>
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  hideCloseButton?: boolean
  /** Suppress the panel's own body padding — for tables or full-bleed content. */
  bare?: boolean
  /** Name the dialog when the heading lives in `children` rather than `title`. */
  'aria-label'?: string
  className?: string
}

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/**
 * Focus is trapped while open and returned to the trigger on close; the body
 * scroll lock is reference counted and restores the previous inline style.
 * The source Modal did neither — docs/build-plan.md §5.3.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  hideCloseButton = false,
  bare = false,
  className,
  ...rest
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descriptionId = `${reactId}-description`

  useBodyScrollLock(open)
  useFocusTrap(open, panelRef, {
    onEscape: closeOnEscape ? onClose : undefined,
    initialFocusRef,
  })

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-6">
      <div
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
        className="fixed inset-0 bg-ui-950/50 animate-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : rest['aria-label']}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-10 my-auto w-full rounded-2xl border border-border bg-surface shadow-2xl outline-none',
          'animate-scale-in',
          SIZES[size],
          className,
        )}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="text-heading-20 text-text">
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 text-body-13 text-text-secondary">
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-1.5 -mt-0.5" />
            )}
          </div>
        )}

        {children && <div className={cn(bare ? undefined : 'px-6 py-5')}>{children}</div>}

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
