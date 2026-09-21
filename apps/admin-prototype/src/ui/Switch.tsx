import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  size?: 'sm' | 'md'
  /** Use when there is no visible `label`. */
  'aria-label'?: string
  id?: string
  className?: string
}

const TRACK = { sm: 'h-4 w-7', md: 'h-5 w-9' } as const
const THUMB = { sm: 'size-3', md: 'size-4' } as const
const TRAVEL = { sm: 'translate-x-3', md: 'translate-x-4' } as const

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className,
  id,
  ...rest
}: SwitchProps) {
  const generatedId = useId()
  const switchId = id ?? generatedId
  const labelId = `${switchId}-label`
  const descriptionId = `${switchId}-description`

  const control = (
    <button
      type="button"
      role="switch"
      id={switchId}
      aria-checked={checked}
      aria-labelledby={label ? labelId : undefined}
      aria-label={rest['aria-label']}
      aria-describedby={description ? descriptionId : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer items-center rounded-full border p-0.5',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55',
        TRACK[size],
        checked ? 'border-accent bg-accent' : 'border-border-interactive bg-surface-sunken',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none rounded-full transition-transform duration-150',
          THUMB[size],
          checked ? cn('bg-on-accent', TRAVEL[size]) : 'translate-x-0 bg-text-muted',
        )}
      />
    </button>
  )

  if (!label && !description) return control

  return (
    <div className={cn('flex items-start gap-3', disabled && 'opacity-60')}>
      {control}
      <span className="min-w-0">
        {label && (
          <label
            id={labelId}
            htmlFor={switchId}
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
