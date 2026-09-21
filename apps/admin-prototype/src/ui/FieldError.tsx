import { AlertCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface FieldErrorProps {
  id?: string
  children?: ReactNode
  className?: string
}

/**
 * `danger-600` rather than `danger-500`: 6.6:1 on `surface` against 4.6:1, and
 * this is prose, not decoration.
 */
export function FieldError({ id, children, className }: FieldErrorProps) {
  if (!children) return null
  return (
    <p
      id={id}
      role="alert"
      className={cn('flex items-start gap-1.5 text-body-12 font-medium text-danger-text', className)}
    >
      <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
