import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { shortName as toShortName } from '@/lib/format'
import { Avatar, type AvatarSize } from './Avatar'

export interface PersonChipProps {
  name: string
  src?: string | null
  /** Second line — "Tutor", "Sales executive", or an email. */
  role?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Shorten to "Adebayo O." for dense table cells. */
  short?: boolean
  /** Renders as a button. Use inside a table only when the row is not clickable. */
  onClick?: () => void
  trailing?: ReactNode
  className?: string
}

const AVATAR_SIZE: Record<'sm' | 'md' | 'lg', AvatarSize> = { sm: 'sm', md: 'md', lg: 'lg' }
const NAME_SIZE = { sm: 'text-body-13', md: 'text-body-14', lg: 'text-body-15' } as const

export function PersonChip({
  name,
  src,
  role,
  size = 'md',
  short = false,
  onClick,
  trailing,
  className,
}: PersonChipProps) {
  const content = (
    <>
      <Avatar name={name} src={src} size={AVATAR_SIZE[size]} />
      <span className="min-w-0">
        <span className={cn('block truncate font-medium text-text', NAME_SIZE[size])}>
          {short ? toShortName(name) : name}
        </span>
        {role && <span className="block truncate text-body-12 text-text-secondary">{role}</span>}
      </span>
      {trailing}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-0.5 -mx-1 text-left',
          'transition-colors hover:bg-surface-hover',
          className,
        )}
      >
        {content}
      </button>
    )
  }

  return <span className={cn('inline-flex min-w-0 items-center gap-2.5', className)}>{content}</span>
}
