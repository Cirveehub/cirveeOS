import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

export interface StatBandProps {
  question: string
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
