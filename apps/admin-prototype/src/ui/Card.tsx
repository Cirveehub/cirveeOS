import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type CardPadding = 'none' | 'tight' | 'default' | 'roomy'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hairline border is the default separation; `shadow-sm` only where a card must lift. */
  elevated?: boolean
  /** Adds hover lift. Only meaningful when the whole card is a link or button. */
  interactive?: boolean
  padding?: CardPadding
  children?: ReactNode
}

const PADDING: Record<CardPadding, string> = {
  none: '',
  tight: 'p-4',
  default: 'p-6',
  roomy: 'p-8',
}

export function Card({
  elevated = false,
  interactive = false,
  padding = 'none',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        'rounded-xl border border-border bg-surface',
        elevated && 'shadow-sm',
        interactive && 'cursor-pointer transition-shadow duration-150 hover:shadow-md',
        PADDING[padding],
        className,
      )}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  /** Drop the hairline under the header — for headers that sit on their own body. */
  bare?: boolean
}

export function CardHeader({
  title,
  description,
  actions,
  bare = false,
  className,
  children,
  ...rest
}: CardHeaderProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex items-start justify-between gap-4 px-6 py-4',
        !bare && 'border-b border-border',
        className,
      )}
    >
      <div className="min-w-0">
        {title && <h3 className="text-body-15 font-bold text-text">{title}</h3>}
        {description && <p className="mt-0.5 text-body-13 text-text-secondary">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding
}

export function CardBody({ padding = 'default', className, children, ...rest }: CardBodyProps) {
  return (
    <div {...rest} className={cn(PADDING[padding], className)}>
      {children}
    </div>
  )
}

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'between' | 'end'
}

export function CardFooter({ align = 'end', className, children, ...rest }: CardFooterProps) {
  return (
    <div
      {...rest}
      className={cn(
        'flex items-center gap-2 border-t border-border px-6 py-3.5',
        align === 'end' && 'justify-end',
        align === 'between' && 'justify-between',
        className,
      )}
    >
      {children}
    </div>
  )
}
