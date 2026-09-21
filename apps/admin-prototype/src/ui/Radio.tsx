import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: ReactNode
  description?: ReactNode
}

export function Radio({ label, description, className, id, disabled, ...rest }: RadioProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const descriptionId = `${inputId}-description`

  const control = (
    <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
      <input
        {...rest}
        id={inputId}
        type="radio"
        disabled={disabled}
        aria-describedby={description ? descriptionId : rest['aria-describedby']}
        className={cn(
          'peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-full border border-border-interactive bg-surface',
          'transition-colors duration-150 checked:border-accent',
          'disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60',
          className,
        )}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none relative size-2 scale-0 rounded-full bg-accent transition-transform duration-150 peer-checked:scale-100"
      />
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
            className={cn('block text-body-14 text-text', disabled ? 'cursor-not-allowed' : 'cursor-pointer')}
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

export interface RadioGroupProps {
  legend?: ReactNode
  description?: ReactNode
  orientation?: 'vertical' | 'horizontal'
  children: ReactNode
  className?: string
}

export function RadioGroup({
  legend,
  description,
  orientation = 'vertical',
  children,
  className,
}: RadioGroupProps) {
  return (
    <fieldset className={cn('min-w-0', className)}>
      {legend && (
        <legend className="mb-1 text-body-13 font-semibold text-text-label">{legend}</legend>
      )}
      {description && <p className="mb-2 text-body-13 text-text-secondary">{description}</p>}
      <div
        className={cn(
          'flex',
          orientation === 'vertical' ? 'flex-col gap-2.5' : 'flex-row flex-wrap gap-x-6 gap-y-2.5',
        )}
      >
        {children}
      </div>
    </fieldset>
  )
}
