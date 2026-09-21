/* eslint-disable @typescript-eslint/no-explicit-any */
import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { FieldError } from './FieldError'
import { Label } from './Label'

export interface FieldProps {
  label?: ReactNode
  /** Helper text under the control. Hidden while an error is showing. */
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  optional?: boolean
  /** Supply to control the id yourself; otherwise one is generated. */
  id?: string
  children: ReactNode
  className?: string
  /** Label to the left of the control rather than above it. */
  layout?: 'stacked' | 'inline'
}

/**
 * Wires label/hint/error to the control it wraps: `id`, `aria-describedby` and
 * `aria-invalid` are injected into the single child element unless already set.
 */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  id,
  children,
  className,
  layout = 'stacked',
}: FieldProps) {
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const hintId = `${fieldId}-hint`
  const errorId = `${fieldId}-error`

  const describedBy = [error ? errorId : null, hint && !error ? hintId : null]
    .filter(Boolean)
    .join(' ')

  const only = Children.count(children) === 1 ? Children.only(children) : null
  let control: ReactNode = children

  if (only && isValidElement(only)) {
    const element = only as ReactElement<any>
    // A host element (`<input>`) would warn on an unknown `invalid` attribute;
    // only our own components understand that prop.
    const isHost = typeof element.type === 'string'
    control = cloneElement(element, {
      id: element.props.id ?? fieldId,
      'aria-describedby': element.props['aria-describedby'] ?? (describedBy || undefined),
      ...(isHost
        ? { 'aria-invalid': element.props['aria-invalid'] ?? (error ? true : undefined) }
        : { invalid: element.props.invalid ?? Boolean(error) }),
    })
  }

  return (
    <div
      className={cn(
        layout === 'inline' ? 'grid grid-cols-[minmax(0,180px)_1fr] items-start gap-x-4 gap-y-1' : 'flex flex-col gap-1.5',
        className,
      )}
    >
      {label && (
        <Label htmlFor={fieldId} required={required} optional={optional} className={layout === 'inline' ? 'pt-2.5' : undefined}>
          {label}
        </Label>
      )}
      <div className="min-w-0">
        {control}
        {error ? (
          <FieldError id={errorId} className="mt-1.5">
            {error}
          </FieldError>
        ) : (
          hint && (
            <p id={hintId} className="mt-1.5 text-body-12 text-text-secondary">
              {hint}
            </p>
          )
        )}
      </div>
    </div>
  )
}
