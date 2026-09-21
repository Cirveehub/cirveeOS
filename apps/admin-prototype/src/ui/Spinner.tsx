import { cn } from '@/lib/cn'

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface SpinnerProps {
  size?: SpinnerSize
  /** Announced to screen readers. The old Spinner announced nothing at all. */
  label?: string
  className?: string
}

const SIZES: Record<SpinnerSize, string> = {
  xs: 'size-3',
  sm: 'size-4',
  md: 'size-5',
  lg: 'size-7',
  xl: 'size-10',
}

export function Spinner({ size = 'md', label = 'Loading', className }: SpinnerProps) {
  return (
    <span role="status" className={cn('inline-flex items-center justify-center text-accent', className)}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className={cn('animate-spin', SIZES[size])}
      >
        <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="2.25" className="opacity-20" />
        <path
          d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export interface LoadingPanelProps {
  label?: string
  className?: string
}

/** A centred spinner for a panel that is still fetching. */
export function LoadingPanel({ label = 'Loading', className }: LoadingPanelProps) {
  return (
    <div
      aria-busy="true"
      className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12', className)}
    >
      <Spinner size="lg" label={label} />
      <p className="text-body-13 text-text-secondary">{label}</p>
    </div>
  )
}
