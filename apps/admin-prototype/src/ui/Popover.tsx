/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import {
  useAnchoredPosition,
  useFocusTrap,
  useOnClickOutside,
  type Align,
  type Side,
} from './internal/overlay'

export interface PopoverProps {
  /** The trigger. Cloned to receive `onClick` and the expanded state. */
  children: ReactElement
  content: ReactNode
  /** Controlled open state. Omit to let the Popover manage it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  side?: Side
  align?: Align
  offset?: number
  /** Fixed width for the surface. Otherwise it sizes to its content. */
  width?: number | string
  /** `dialog` traps focus; `menu` does not. Both close on Escape and outside click. */
  role?: 'dialog' | 'menu'
  className?: string
}

/**
 * Position-fixed and portalled to the body, so a popover opened from a cell in
 * a horizontally scrolling DataTable is not clipped by the scroll container.
 */
export function Popover({
  children,
  content,
  open: controlledOpen,
  onOpenChange,
  side = 'bottom',
  align = 'start',
  offset = 8,
  width,
  role = 'dialog',
  className,
}: PopoverProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const floatingRef = useRef<HTMLDivElement | null>(null)
  const surfaceId = useId()

  const setOpen = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange],
  )

  const close = useCallback(() => setOpen(false), [setOpen])

  const position = useAnchoredPosition(open, anchorRef, floatingRef, { side, align, offset })
  useOnClickOutside(open, [anchorRef, floatingRef], close)
  useFocusTrap(open && role === 'dialog', floatingRef, { onEscape: close })

  // A menu does not trap focus, but Escape must still close it.
  useEffect(() => {
    if (!open || role === 'dialog') return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, role, close])

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        'aria-expanded': open,
        'aria-haspopup': role,
        'aria-controls': open ? surfaceId : undefined,
        onClick: (event: MouseEvent) => {
          const childOnClick = (children as ReactElement<any>).props.onClick
          childOnClick?.(event)
          if (!event.defaultPrevented) setOpen(!open)
        },
      })
    : children

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {trigger}
      </span>
      {open &&
        createPortal(
          <div
            ref={floatingRef}
            id={surfaceId}
            role={role}
            tabIndex={-1}
            style={{ top: position.top, left: position.left, width }}
            className={cn(
              'fixed z-50 min-w-48 rounded-xl border border-border bg-surface p-1.5 shadow-md outline-none',
              'animate-scale-in',
              position.ready ? 'opacity-100' : 'pointer-events-none opacity-0',
              className,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  )
}

export interface PopoverItemProps {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  /** Red label for a destructive action. */
  destructive?: boolean
  disabled?: boolean
  className?: string
}

/** A row inside a Popover used as a menu. */
export function PopoverItem({
  children,
  onClick,
  icon,
  destructive = false,
  disabled = false,
  className,
}: PopoverItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-body-14',
        'transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-55',
        destructive ? 'text-danger-text hover:bg-danger-fill' : 'text-text',
        className,
      )}
    >
      {icon && <span className="shrink-0 text-text-muted">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

export function PopoverSeparator() {
  return <div role="separator" className="my-1.5 h-px bg-border" />
}

export function PopoverLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pb-1 pt-2 text-label-10 text-text-muted">{children}</p>
}
