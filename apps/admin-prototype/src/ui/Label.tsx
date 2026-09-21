import type { LabelHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
  optional?: boolean
  children: ReactNode
}

export function Label({ required, optional, className, children, ...rest }: LabelProps) {
  return (
    <label
      {...rest}
      className={cn('inline-flex items-center gap-1 text-body-13 font-semibold text-text-label', className)}
    >
      {children}
      {required && (
        <span className="text-danger-text" aria-hidden="true">
          *
        </span>
      )}
      {optional && !required && (
        <span className="font-normal text-text-muted">(optional)</span>
      )}
    </label>
  )
}
