import type { CSSProperties } from 'react'
import { cn } from '@/lib/cn'

export interface SkeletonProps {
  className?: string
  width?: number | string
  height?: number | string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  style?: CSSProperties
}

const RADIUS = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
} as const

/** Uses the `shimmer` keyframe declared in styles.css. */
export function Skeleton({ className, width, height, rounded = 'md', style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      style={{ width, height, ...style }}
      className={cn(
        'relative block overflow-hidden bg-surface-sunken',
        RADIUS[rounded],
        height === undefined && 'h-4',
        className,
      )}
    >
      <span
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-surface to-transparent opacity-70"
      />
    </span>
  )
}

export interface SkeletonTextProps {
  lines?: number
  className?: string
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cn('block space-y-2', className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} height={12} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  )
}

export interface SkeletonCardProps {
  /** Renders the icon chip and delta of a StatCard rather than a text card. */
  variant?: 'text' | 'stat'
  className?: string
}

export function SkeletonCard({ variant = 'text', className }: SkeletonCardProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      className={cn('rounded-xl border border-border bg-surface p-5', className)}
    >
      {variant === 'stat' ? (
        <>
          <div className="flex items-start justify-between">
            <Skeleton width={96} height={12} />
            <Skeleton width={36} height={36} rounded="lg" />
          </div>
          <Skeleton width={128} height={32} className="mt-4" />
          <Skeleton width={72} height={12} className="mt-3" />
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Skeleton width={36} height={36} rounded="full" />
            <span className="flex-1 space-y-2">
              <Skeleton width="45%" height={12} />
              <Skeleton width="28%" height={10} />
            </span>
          </div>
          <SkeletonText lines={3} className="mt-4" />
        </>
      )}
    </div>
  )
}

export interface SkeletonTableProps {
  rows?: number
  columns?: number
  /** Match the DataTable density you are standing in for. */
  density?: 'comfortable' | 'compact'
  showHeader?: boolean
  className?: string
}

export function SkeletonTable({
  rows = 8,
  columns = 5,
  density = 'comfortable',
  showHeader = true,
  className,
}: SkeletonTableProps) {
  const cellPad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3.5'

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading table"
      className={cn('overflow-hidden rounded-xl border border-border bg-surface', className)}
    >
      {showHeader && (
        <div className="flex border-b border-border bg-surface-sunken">
          {Array.from({ length: columns }, (_, index) => (
            <div key={index} className={cn('flex-1', cellPad)}>
              <Skeleton height={10} width={index === 0 ? '55%' : '40%'} />
            </div>
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex border-b border-border last:border-b-0">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <div key={columnIndex} className={cn('flex-1', cellPad)}>
              <Skeleton
                height={12}
                width={columnIndex === 0 ? '78%' : columnIndex % 3 === 0 ? '45%' : '62%'}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
