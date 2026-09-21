/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { useAnchoredPosition, type Align, type Side } from './internal/overlay'

export interface TooltipProps {
  /** The trigger. Cloned to receive hover/focus handlers and `aria-describedby`. */
  children: ReactElement
  content: ReactNode
  side?: Side
  align?: Align
  offset?: number
  /** Milliseconds before showing on hover. Focus shows immediately. */
  delay?: number
  disabled?: boolean
  className?: string
}

/**
 * Describes its trigger — it never holds the only copy of a label, and it never
 * holds interactive content. Opens on hover and on keyboard focus, closes on
 * Escape.
 */
export function Tooltip({
  children,
  content,
  side = 'top',
  align = 'center',
  offset = 6,
  delay = 220,
  disabled = false,
  className,
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const floatingRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const tooltipId = useId()

  const position = useAnchoredPosition(open && !disabled, anchorRef, floatingRef, { side, align, offset })

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const show = useCallback(
    (immediate: boolean) => {
      clearTimer()
      if (immediate || delay === 0) {
        setOpen(true)
        return
      }
      timerRef.current = window.setTimeout(() => setOpen(true), delay)
    },
    [clearTimer, delay],
  )

  const hide = useCallback(() => {
    clearTimer()
    setOpen(false)
  }, [clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, hide])

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<any>, {
        'aria-describedby': open && !disabled ? tooltipId : undefined,
      })
    : children

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onPointerEnter={() => show(false)}
        onPointerLeave={hide}
        onFocusCapture={() => show(true)}
        onBlurCapture={hide}
      >
        {trigger}
      </span>
      {open &&
        !disabled &&
        createPortal(
          <div
            ref={floatingRef}
            id={tooltipId}
            role="tooltip"
            style={{ top: position.top, left: position.left }}
            className={cn(
              'pointer-events-none fixed z-50 max-w-xs rounded-lg bg-ui-900 px-2.5 py-1.5',
              'text-body-12 font-medium text-ui-25 shadow-md animate-in',
              position.ready ? 'opacity-100' : 'opacity-0',
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
