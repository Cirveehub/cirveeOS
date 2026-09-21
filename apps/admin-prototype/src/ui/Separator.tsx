import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical'
  /** Optional caption set into the rule. Horizontal only. */
  label?: ReactNode
  /** Purely visual — omitted from the accessibility tree. */
  decorative?: boolean
  className?: string
}

export function Separator({
  orientation = 'horizontal',
  label,
  decorative = true,
  className,
}: SeparatorProps) {
  if (orientation === 'vertical') {
    return (
      <span
        role={decorative ? undefined : 'separator'}
        aria-orientation={decorative ? undefined : 'vertical'}
        aria-hidden={decorative || undefined}
        className={cn('inline-block w-px shrink-0 self-stretch bg-border', className)}
      />
    )
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span className="text-label-11 text-text-muted">{label}</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
    )
  }

  return (
    <hr
      role={decorative ? 'presentation' : 'separator'}
      aria-hidden={decorative || undefined}
      className={cn('h-px w-full border-0 bg-border', className)}
    />
  )
}
