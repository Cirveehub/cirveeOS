import { Check, Minus } from 'lucide-react'
import { useEffect, useId, useRef, type InputHTMLAttributes, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
  /** Tri-state: neither checked nor unchecked. Drives `input.indeterminate`. */
  indeterminate?: boolean
  size?: 'sm' | 'md'
  ref?: Ref<HTMLInputElement>
}

const BOX_SIZE = { sm: 'size-4', md: 'size-[18px]' } as const
const ICON_PX = { sm: 11, md: 13 } as const

export function Checkbox({
  label,
  description,
  indeterminate = false,
  size = 'sm',
  className,
  id,
  ref,
  disabled,
  ...rest
}: CheckboxProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`
  const innerRef = useRef<HTMLInputElement | null>(null)

  // `indeterminate` is a DOM property, not an attribute — React will not set it.
  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = indeterminate
  }, [indeterminate])

  const assignRef = (node: HTMLInputElement | null) => {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref && typeof ref === 'object') (ref as { current: HTMLInputElement | null }).current = node
  }

  const control = (
    <span className={cn('relative inline-flex shrink-0 items-center justify-center', BOX_SIZE[size])}>
      <input
        {...rest}
        id={inputId}
        ref={assignRef}
        type="checkbox"
        disabled={disabled}
        aria-describedby={description ? descriptionId : rest['aria-describedby']}
        className={cn(
          'peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-sm border bg-surface',
          'transition-colors duration-150',
          'checked:border-accent checked:bg-accent',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
          indeterminate ? 'border-accent bg-accent' : 'border-border-interactive',
          className,
        )}
      />
      {indeterminate ? (
        <Minus
          size={ICON_PX[size]}
          strokeWidth={3}
          aria-hidden="true"
          className="pointer-events-none relative text-on-accent"
        />
      ) : (
        <Check
          size={ICON_PX[size]}
          strokeWidth={3}
          aria-hidden="true"
          className="pointer-events-none relative text-on-accent opacity-0 peer-checked:opacity-100"
        />
      )}
    </span>
  )

  if (!label && !description) return control

  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-60')}>
      <span className="flex h-5 items-center">{control}</span>
      <span className="min-w-0">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'block text-body-14 text-text',
              disabled ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
          >
            {label}
          </label>
        )}
        {description && (
          <p id={descriptionId} className="mt-0.5 text-body-13 text-text-secondary">
            {description}
          </p>
        )}
      </span>
    </div>
  )
}
