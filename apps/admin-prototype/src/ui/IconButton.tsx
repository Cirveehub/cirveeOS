import type { ButtonHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button, type ButtonSize, type ButtonVariant } from './Button'

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon
  /** Required — becomes the accessible name and the native tooltip. */
  label: string
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  /** Suppress the native `title` when the button is already inside a Tooltip. */
  showTitle?: boolean
}

const ICON_PX: Record<ButtonSize, number> = { sm: 16, md: 16, lg: 20 }

export function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  loading = false,
  showTitle = true,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <Button
      {...rest}
      variant={variant}
      size={size}
      iconOnly
      loading={loading}
      loadingLabel={label}
      aria-label={label}
      title={showTitle ? label : undefined}
      className={cn('shrink-0', className)}
    >
      <Icon size={ICON_PX[size]} aria-hidden="true" />
    </Button>
  )
}
