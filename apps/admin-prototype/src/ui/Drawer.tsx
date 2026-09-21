import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from './IconButton'
import { useBodyScrollLock, useFocusTrap } from './internal/overlay'

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  size?: DrawerSize
  initialFocusRef?: RefObject<HTMLElement | null>
  closeOnOverlayClick?: boolean
  closeOnEscape?: boolean
  /** Suppress the body padding — for a full-bleed table or timeline. */
  bare?: boolean
  className?: string
}

const SIZES: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

/** Right-hand sheet. Same focus and scroll discipline as Modal. */
export function Drawer({
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
  bare = false,
  className,
}: DrawerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const reactId = useId()
  const titleId = `${reactId}-title`
  const descriptionId = `${reactId}-description`
  const [entered, setEntered] = useState(false)

  useBodyScrollLock(open)
  useFocusTrap(open, panelRef, {
    onEscape: closeOnEscape ? onClose : undefined,
    initialFocusRef,
  })

  // Two frames: mount off-canvas, then transition in.
  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        aria-hidden="true"
        onClick={closeOnOverlayClick ? onClose : undefined}
        className="absolute inset-0 bg-ui-950/50 animate-in"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-surface shadow-2xl outline-none',
          'transition-transform duration-200 ease-out motion-reduce:transition-none',
          entered ? 'translate-x-0' : 'translate-x-full',
          SIZES[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-6 py-4">
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
          <IconButton icon={X} label="Close" size="sm" onClick={onClose} className="-mr-1.5 -mt-0.5" />
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto', bare ? undefined : 'px-6 py-5')}>
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
