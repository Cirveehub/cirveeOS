import type { InputHTMLAttributes, ReactNode, Ref } from 'react'
import { cn } from '@/lib/cn'

export type InputSize = 'sm' | 'md' | 'lg'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  ref?: Ref<HTMLInputElement>
  inputSize?: InputSize
  invalid?: boolean
  /** Icon rendered inside the field, on the leading edge. */
  leftIcon?: ReactNode
  /** Icon or control rendered inside the field, on the trailing edge. */
  rightSlot?: ReactNode
  /** Static text on the leading edge — "₦", "https://". */
  prefix?: ReactNode
  suffix?: ReactNode
  className?: string
  /** Applied to the wrapper rather than the `<input>`. */
  containerClassName?: string
}

export const INPUT_HEIGHTS: Record<InputSize, string> = {
  sm: 'h-8 text-body-13',
  md: 'h-10 text-body-14',
  lg: 'h-11 text-body-15',
}

/*
 * The focus ring is drawn on the SHELL, not the bare `<input>`: the base layer
 * would otherwise outline the inner field at its own radius, inside the
 * rounded-xl border. Same reason Select does it this way.
 */
export const INPUT_SHELL =
  'flex w-full items-center gap-2 rounded-xl border bg-surface px-3 ' +
  'transition-colors duration-150 ' +
  'focus-within:border-accent focus-within:outline-2 focus-within:outline-accent focus-within:outline-offset-2 ' +
  'has-[input:disabled]:bg-surface-sunken has-[input:disabled]:cursor-not-allowed'

export const INPUT_FIELD =
  'peer w-full min-w-0 bg-transparent text-text placeholder:text-text-muted ' +
  'outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:text-text-muted'

export function Input({
  ref,
  inputSize = 'md',
  invalid = false,
  leftIcon,
  rightSlot,
  prefix,
  suffix,
  className,
  containerClassName,
  ...rest
}: InputProps) {
  return (
    <div
      className={cn(
        INPUT_SHELL,
        INPUT_HEIGHTS[inputSize],
        invalid ? 'border-danger-500' : 'border-border-strong',
        containerClassName,
      )}
    >
      {leftIcon && <span className="shrink-0 text-text-muted">{leftIcon}</span>}
      {prefix && <span className="shrink-0 text-text-secondary tabular-nums">{prefix}</span>}
      <input
        {...rest}
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(INPUT_FIELD, className)}
      />
      {suffix && <span className="shrink-0 text-text-secondary">{suffix}</span>}
      {rightSlot && <span className="flex shrink-0 items-center text-text-muted">{rightSlot}</span>}
    </div>
  )
}
