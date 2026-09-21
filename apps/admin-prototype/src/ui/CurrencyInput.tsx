import { useState, type ChangeEvent, type FocusEvent, type InputHTMLAttributes } from 'react'
import { KOBO } from '@/lib/format'
import { Input, type InputSize } from './Input'

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'value' | 'onChange' | 'type' | 'prefix'> {
  /** Amount in KOBO — the only unit money is ever stored in. */
  value: number | null
  /** Receives KOBO, or null when the field is cleared. */
  onChange: (kobo: number | null) => void
  /** Allow a decimal part. Off by default: tuition is quoted in whole naira. */
  allowKobo?: boolean
  inputSize?: InputSize
  invalid?: boolean
  containerClassName?: string
}

function koboToDraft(kobo: number | null, allowKobo: boolean): string {
  if (kobo === null) return ''
  const naira = kobo / KOBO
  return allowKobo ? naira.toFixed(2).replace(/\.00$/, '') : String(Math.round(naira))
}

function koboToDisplay(kobo: number | null, allowKobo: boolean): string {
  if (kobo === null) return ''
  return (kobo / KOBO).toLocaleString('en-NG', {
    minimumFractionDigits: allowKobo ? 2 : 0,
    maximumFractionDigits: allowKobo ? 2 : 0,
  })
}

/**
 * Displays naira, stores kobo. The conversion happens here and nowhere else —
 * see src/lib/format.ts on why money never travels as a float.
 */
export function CurrencyInput({
  value,
  onChange,
  allowKobo = false,
  inputSize = 'md',
  invalid = false,
  containerClassName,
  placeholder = '0',
  onFocus,
  onBlur,
  ...rest
}: CurrencyInputProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const handleFocus = (event: FocusEvent<HTMLInputElement>) => {
    setDraft(koboToDraft(value, allowKobo))
    onFocus?.(event)
  }

  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    setDraft(null)
    onBlur?.(event)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const pattern = allowKobo ? /[^\d.]/g : /[^\d]/g
    let cleaned = event.target.value.replace(pattern, '')

    if (allowKobo) {
      const [whole, ...fraction] = cleaned.split('.')
      cleaned = fraction.length > 0 ? `${whole}.${fraction.join('').slice(0, 2)}` : whole
    }

    setDraft(cleaned)

    if (cleaned === '' || cleaned === '.') {
      onChange(null)
      return
    }
    const naira = Number.parseFloat(cleaned)
    onChange(Number.isFinite(naira) ? Math.round(naira * KOBO) : null)
  }

  return (
    <Input
      {...rest}
      type="text"
      inputMode={allowKobo ? 'decimal' : 'numeric'}
      autoComplete="off"
      inputSize={inputSize}
      invalid={invalid}
      containerClassName={containerClassName}
      placeholder={placeholder}
      prefix="₦"
      value={draft ?? koboToDisplay(value, allowKobo)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      className="tabular-nums"
    />
  )
}
