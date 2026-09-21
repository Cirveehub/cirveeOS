import { ChevronDown } from 'lucide-react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import type { InputSize } from './Input'
import { INPUT_HEIGHTS } from './Input'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options?: SelectOption[]
  /** Rendered as a disabled first option when the value is empty. */
  placeholder?: string
  selectSize?: InputSize
  invalid?: boolean
  leftIcon?: ReactNode
  containerClassName?: string
}

/**
 * Native `<select>`, restyled. Deliberate: the OS is keyboard-first and dense,
 * and a native select beats a hand-rolled listbox on both counts.
 */
export function Select({
  options,
  placeholder,
  selectSize = 'md',
  invalid = false,
  leftIcon,
  className,
  containerClassName,
  children,
  value,
  ...rest
}: SelectProps) {
  return (
    <div
      className={cn(
        'relative flex w-full items-center gap-2 rounded-xl border bg-surface px-3',
        'transition-colors duration-150 focus-within:border-accent',
        'focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2',
        'has-[select:disabled]:cursor-not-allowed has-[select:disabled]:bg-surface-sunken',
        INPUT_HEIGHTS[selectSize],
        invalid ? 'border-danger-500' : 'border-border-strong',
        containerClassName,
      )}
    >
      {leftIcon && <span className="shrink-0 text-text-muted">{leftIcon}</span>}
      <select
        {...rest}
        value={value}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-6 text-text outline-none focus-visible:outline-none',
          'disabled:cursor-not-allowed disabled:text-text-muted',
          value === '' && placeholder ? 'text-text-muted' : undefined,
          className,
        )}
      >
        {placeholder !== undefined && (
          <option value="" disabled={rest.required}>
            {placeholder}
          </option>
        )}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 text-text-muted"
      />
    </div>
  )
}
