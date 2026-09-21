import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  /** Shows a live "132 / 500" counter. Requires `maxLength`. */
  showCount?: boolean
}

export function Textarea({
  invalid = false,
  showCount = false,
  className,
  rows = 4,
  maxLength,
  value,
  ...rest
}: TextareaProps) {
  const length = typeof value === 'string' ? value.length : 0

  return (
    <div className="w-full">
      <textarea
        {...rest}
        rows={rows}
        value={value}
        maxLength={maxLength}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full resize-y rounded-xl border bg-surface px-3 py-2.5 text-body-14 text-text',
          'placeholder:text-text-muted outline-none transition-colors duration-150',
          'focus:border-accent disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-muted',
          invalid ? 'border-danger-500' : 'border-border-strong',
          className,
        )}
      />
      {showCount && maxLength !== undefined && (
        <p className="mt-1 text-right text-body-12 text-text-muted tabular-nums" aria-live="polite">
          {length} / {maxLength}
        </p>
      )}
    </div>
  )
}
