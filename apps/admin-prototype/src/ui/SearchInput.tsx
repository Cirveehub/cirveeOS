import { Search, X } from 'lucide-react'
import { useRef, type InputHTMLAttributes, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { Input, type InputSize } from './Input'

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value' | 'type' | 'prefix'> {
  value: string
  onChange: (value: string) => void
  inputSize?: InputSize
  placeholder?: string
  /** Label for the clear button. */
  clearLabel?: string
  containerClassName?: string
}

export function SearchInput({
  value,
  onChange,
  inputSize = 'md',
  placeholder = 'Search',
  clearLabel = 'Clear search',
  containerClassName,
  onKeyDown,
  ...rest
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape' && value) {
      event.preventDefault()
      event.stopPropagation()
      onChange('')
    }
    onKeyDown?.(event)
  }

  return (
    <Input
      {...rest}
      ref={inputRef}
      type="text"
      role="searchbox"
      value={value}
      inputSize={inputSize}
      placeholder={placeholder}
      containerClassName={containerClassName}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      leftIcon={<Search size={16} aria-hidden="true" />}
      rightSlot={
        value ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => {
              onChange('')
              inputRef.current?.focus()
            }}
            className={cn(
              'grid size-5 place-items-center rounded-full text-text-muted',
              'transition-colors hover:bg-surface-sunken hover:text-text',
            )}
          >
            <X size={14} aria-hidden="true" />
          </button>
        ) : undefined
      }
    />
  )
}
