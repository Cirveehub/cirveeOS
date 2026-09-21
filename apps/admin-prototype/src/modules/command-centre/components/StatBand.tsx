/**
 * One of the PRD's four executive questions, and the cards that answer it.
 *
 * The grouping is the point. Twelve stat cards in an undifferentiated grid is
 * a wall of numbers; the same twelve under "Are we making money?", "Are we
 * growing?", "Are students succeeding?" and "Is the organisation
 * functioning?" is a briefing.
 */

import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface StatBandProps {
  question: string
  /** The one-line answer, read off the cards below it. */
  answer: ReactNode
  children: ReactNode
  className?: string
}

export function StatBand({ question, answer, children, className }: StatBandProps) {
  return (
    <section className={cn('space-y-3', className)} aria-label={question}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-heading-18 text-text">{question}</h2>
        <p className="text-body-13 text-text-secondary">{answer}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{children}</div>
    </section>
  )
}
