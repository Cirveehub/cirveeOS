import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'

/* -------------------------------------------------------------------------- */
/* Focus                                                                      */
/* -------------------------------------------------------------------------- */

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) =>
      !el.hasAttribute('aria-hidden') &&
      (el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement),
  )
}

export interface FocusTrapOptions {
  onEscape?: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  /** Return focus to whatever was focused before the overlay opened. */
  restoreFocus?: boolean
}

/**
 * Traps Tab within `containerRef` while `active`, focuses into it on open and
 * returns focus to the previously focused element on close.
 *
 * The old Modal did none of this — see docs/build-plan.md §5.3.
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  options: FocusTrapOptions = {},
): void {
  const { onEscape, initialFocusRef, restoreFocus = true } = options

  const escapeRef = useRef(onEscape)
  escapeRef.current = onEscape
  const initialRef = useRef(initialFocusRef)
  initialRef.current = initialFocusRef

  useEffect(() => {
    if (!active) return

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const frame = requestAnimationFrame(() => {
      const container = containerRef.current
      const target =
        initialRef.current?.current ?? getFocusable(container)[0] ?? container ?? null
      target?.focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        escapeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return

      const container = containerRef.current
      if (!container) return
      const items = getFocusable(container)

      if (items.length === 0) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const inside = current !== null && container.contains(current)

      if (event.shiftKey && (!inside || current === first)) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      } else if (!event.shiftKey && (!inside || current === last)) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown, true)
      if (restoreFocus) previouslyFocused?.focus({ preventScroll: true })
    }
  }, [active, containerRef, restoreFocus])
}

/* -------------------------------------------------------------------------- */
/* Body scroll lock                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Reference-counted so nested overlays (a ConfirmDialog over a Drawer) do not
 * leave the body locked, and StrictMode's double-invoked effects cancel out.
 * The old Modal restored `overflow: ''` unconditionally on unmount.
 */
let lockCount = 0
let savedBodyStyle: { overflow: string; paddingRight: string } | null = null

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return

    if (lockCount === 0) {
      const body = document.body
      savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight }
      const gutter = window.innerWidth - document.documentElement.clientWidth
      if (gutter > 0) body.style.paddingRight = `${gutter}px`
      body.style.overflow = 'hidden'
    }
    lockCount += 1

    return () => {
      lockCount = Math.max(0, lockCount - 1)
      if (lockCount === 0 && savedBodyStyle) {
        document.body.style.overflow = savedBodyStyle.overflow
        document.body.style.paddingRight = savedBodyStyle.paddingRight
        savedBodyStyle = null
      }
    }
  }, [active])
}

/* -------------------------------------------------------------------------- */
/* Outside click                                                              */
/* -------------------------------------------------------------------------- */

export function useOnClickOutside(
  active: boolean,
  refs: Array<RefObject<HTMLElement | null>>,
  handler: () => void,
): void {
  const refsRef = useRef(refs)
  refsRef.current = refs
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!active) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (refsRef.current.some((ref) => ref.current?.contains(target))) return
      handlerRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [active])
}

/* -------------------------------------------------------------------------- */
/* Anchored positioning                                                       */
/* -------------------------------------------------------------------------- */

export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'

export interface AnchoredPosition {
  top: number
  left: number
  ready: boolean
}

export interface AnchorOptions {
  side?: Side
  align?: Align
  offset?: number
}

const VIEWPORT_PADDING = 8

/**
 * Position-fixed placement relative to an anchor, computed from rects rather
 * than CSS `absolute`, so a popover inside a scrolling table body is not
 * clipped by its `overflow-auto` ancestor.
 */
export function useAnchoredPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  floatingRef: RefObject<HTMLElement | null>,
  options: AnchorOptions = {},
): AnchoredPosition {
  const { side = 'bottom', align = 'start', offset = 8 } = options
  const [position, setPosition] = useState<AnchoredPosition>({ top: 0, left: 0, ready: false })

  useLayoutEffect(() => {
    if (!open) {
      setPosition((prev) => (prev.ready ? { top: 0, left: 0, ready: false } : prev))
      return
    }

    const update = () => {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const floating = floatingRef.current?.getBoundingClientRect()
      if (!anchor || !floating) return

      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight

      let resolved: Side = side
      if (side === 'bottom' && anchor.bottom + offset + floating.height > vh && anchor.top - offset - floating.height > 0) {
        resolved = 'top'
      } else if (side === 'top' && anchor.top - offset - floating.height < 0 && anchor.bottom + offset + floating.height < vh) {
        resolved = 'bottom'
      } else if (side === 'right' && anchor.right + offset + floating.width > vw) {
        resolved = 'left'
      } else if (side === 'left' && anchor.left - offset - floating.width < 0) {
        resolved = 'right'
      }

      const alignOn = (start: number, size: number, floatSize: number) =>
        align === 'start' ? start : align === 'end' ? start + size - floatSize : start + size / 2 - floatSize / 2

      let top: number
      let left: number

      if (resolved === 'bottom' || resolved === 'top') {
        top = resolved === 'bottom' ? anchor.bottom + offset : anchor.top - offset - floating.height
        left = alignOn(anchor.left, anchor.width, floating.width)
      } else {
        left = resolved === 'right' ? anchor.right + offset : anchor.left - offset - floating.width
        top = alignOn(anchor.top, anchor.height, floating.height)
      }

      left = Math.min(Math.max(VIEWPORT_PADDING, left), Math.max(VIEWPORT_PADDING, vw - floating.width - VIEWPORT_PADDING))
      top = Math.min(Math.max(VIEWPORT_PADDING, top), Math.max(VIEWPORT_PADDING, vh - floating.height - VIEWPORT_PADDING))

      setPosition((prev) =>
        prev.ready && Math.abs(prev.top - top) < 0.5 && Math.abs(prev.left - left) < 0.5
          ? prev
          : { top, left, ready: true },
      )
    }

    update()

    const observer = new ResizeObserver(update)
    if (floatingRef.current) observer.observe(floatingRef.current)
    if (anchorRef.current) observer.observe(anchorRef.current)
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)

    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef, floatingRef, side, align, offset])

  return position
}
