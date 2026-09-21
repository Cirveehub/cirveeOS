import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { initials as toInitials } from '@/lib/format'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps {
  name: string
  src?: string | null
  size?: AvatarSize
  /** Ring in the surface colour — used when avatars overlap. */
  ring?: boolean
  className?: string
  title?: string
}

const SIZES: Record<AvatarSize, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-[11px]',
  lg: 'size-10 text-body-13',
  xl: 'size-12 text-body-15',
}

/* Six stable tints, picked deterministically from the name so a person keeps
   the same colour on every screen. All are fixed ramp pairs, legible in both
   themes because neither side of the pair moves. */
const TINTS = [
  'bg-accent-subtle text-accent',
  'bg-teal-100 text-teal-700',
  'bg-info-fill text-info-ink',
  'bg-success-fill text-success-ink',
  'bg-warning-fill text-warning-ink',
  'bg-ui-100 text-ui-700',
] as const

function tintFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return TINTS[hash % TINTS.length]
}

export function Avatar({ name, src, size = 'md', ring = false, className, title }: AvatarProps) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <span
      title={title ?? name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-bold uppercase',
        SIZES[size],
        !showImage && tintFor(name),
        ring && 'ring-2 ring-surface',
        className,
      )}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name}
          onError={() => setFailed(true)}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{toInitials(name)}</span>
      )}
      {!showImage && <span className="sr-only">{name}</span>}
    </span>
  )
}

export interface AvatarGroupProps {
  people: Array<{ name: string; src?: string | null }>
  max?: number
  size?: AvatarSize
  className?: string
  /** Rendered after the overflow counter — e.g. "+3 more". */
  children?: ReactNode
}

export function AvatarGroup({ people, max = 4, size = 'md', className, children }: AvatarGroupProps) {
  const shown = people.slice(0, max)
  const overflow = people.length - shown.length

  return (
    <span className={cn('inline-flex items-center', className)}>
      {shown.map((person, index) => (
        <Avatar
          key={`${person.name}-${index}`}
          name={person.name}
          src={person.src}
          size={size}
          ring
          className={index === 0 ? undefined : '-ml-2'}
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            '-ml-2 inline-flex shrink-0 items-center justify-center rounded-full bg-surface-sunken font-bold text-text-secondary ring-2 ring-surface',
            SIZES[size],
          )}
          title={people.slice(max).map((p) => p.name).join(', ')}
        >
          +{overflow}
        </span>
      )}
      {children}
    </span>
  )
}
