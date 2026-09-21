/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** What a screen reader hears while `loading` is true. */
  loadingLabel?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** Square button holding a single icon. Pass an `aria-label` with it. */
  iconOnly?: boolean
  fullWidth?: boolean
  /**
   * Render the single child element instead of a `<button>`, merging classes
   * and props onto it — for wrapping a react-router `<Link>` in button skin.
   */
  asChild?: boolean
}

const BASE =
  'relative inline-flex items-center justify-center gap-2 rounded-lg font-semibold whitespace-nowrap ' +
  'transition-colors duration-150 select-none ' +
  'disabled:pointer-events-none disabled:opacity-55 aria-disabled:pointer-events-none aria-disabled:opacity-55'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-hover',
  // The source shipped `bg-secondary-default`, a token that was never declared,
  // so this variant rendered with no background at all. Now: a real outlined button.
  secondary: 'bg-surface text-text border border-border-strong hover:bg-surface-hover active:bg-surface-sunken',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-hover hover:text-text active:bg-surface-sunken',
  danger: 'bg-danger-600 text-on-danger hover:bg-danger-700 active:bg-danger-700',
  link: 'bg-transparent text-accent hover:text-accent-hover hover:underline underline-offset-4 decoration-2',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-body-13',
  md: 'h-10 px-4 text-body-14',
  lg: 'h-11 px-5 text-body-15',
}

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: 'size-8 px-0',
  md: 'size-10 px-0',
  lg: 'size-11 px-0',
}

const SPINNER_SIZE: Record<ButtonSize, 'xs' | 'sm'> = { sm: 'xs', md: 'sm', lg: 'sm' }

export function Button({
  ref,
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel = 'Working',
  leftIcon,
  rightIcon,
  iconOnly = false,
  fullWidth = false,
  asChild = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = cn(
    BASE,
    VARIANTS[variant],
    iconOnly ? ICON_SIZES[size] : SIZES[size],
    variant === 'link' && 'h-auto px-0 gap-1.5',
    fullWidth && 'w-full',
    className,
  )

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<any>
    return cloneElement(child, {
      ...rest,
      ref,
      className: cn(classes, child.props.className),
      children: (
        <>
          {leftIcon}
          {child.props.children}
          {rightIcon}
        </>
      ),
    })
  }

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner size={SPINNER_SIZE[size]} label={loadingLabel} className="text-current" />
        </span>
      )}
      {/* Kept in flow while loading so the button does not resize mid-action. */}
      <span className={cn('contents', loading && 'invisible')}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </button>
  )
}
