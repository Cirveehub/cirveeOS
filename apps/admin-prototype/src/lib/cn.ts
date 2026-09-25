import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * `tailwind-merge` only recognises Tailwind's stock palette and type scale.
 * This app's design tokens — `text-on-accent`, `text-body-14`, `bg-canvas`,
 * `text-success-ink` and the rest — are unknown to it, so it fell back to
 * treating every `text-*` class as one ambiguous group and silently dropped
 * whichever came first. That is how every `<Button>` variant lost its text
 * colour: `text-on-accent` (colour) was always followed by `text-body-14`
 * (size) in the same `cn()` call, and only the size survived.
 *
 * Registering the custom colour names and the hand-written type scale here
 * teaches it the difference, so the two coexist the way `text-red-500` and
 * `text-sm` already do for stock Tailwind classes.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        'canvas',
        'surface', 'surface-raised', 'surface-sunken', 'surface-hover',
        'border', 'border-strong', 'border-interactive',
        'text', 'text-secondary', 'text-muted', 'text-label', 'text-disabled',
        'accent', 'accent-hover', 'accent-wash', 'accent-subtle',
        'on-accent', 'on-danger', 'on-warning',
        'danger-text', 'success-text', 'warning-text', 'info-text',
        'success-fill', 'success-ink', 'success-line',
        'warning-fill', 'warning-ink', 'warning-line',
        'danger-fill', 'danger-ink', 'danger-line',
        'info-fill', 'info-ink', 'info-line',
      ],
      // The font-size class group reads from `theme.text` (Tailwind v4's
      // `--text-*` namespace), not `classGroups['font-size']` — the hand
      // -written type scale in styles.css belongs here, not there.
      text: [
        'display-40', 'display-32',
        'heading-24', 'heading-20', 'heading-18',
        'body-15', 'body-14', 'body-13', 'body-12',
        'label-11', 'label-10',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
