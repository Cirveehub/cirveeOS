/**
 * Shared plumbing for the Tutor's module.
 *
 * Three things every screen here needs and nothing else in the app provides:
 *
 *  1. **Who is teaching.** The Tutor persona signs in as a real seeded person
 *     (Tunde Bakare). Every screen is scoped to that person's *active* tutor
 *     assignments — the PRD's rule is that a replaced tutor's assignment is
 *     ended and a new row created, never reassigned in place, so "my cohorts"
 *     is `status === 'active'` and nothing else. A staff persona with no tutor
 *     assignments at all (an operations manager opening this module to look)
 *     falls back to the seeded tutor rather than rendering an empty product.
 *  2. **The one-card-one-concern shell.** Both legacy portals use exactly one
 *     recipe for a list: a white card, a header of title + count + a single
 *     right-aligned action, then a table. `TeachingCard` is that recipe, built
 *     on `Card`/`SectionHeader` so it stays on Cirvee OS's tokens.
 *  3. **Name lookups**, because a cohort row shows a course title and a person,
 *     not two opaque ids.
 */
import type { ReactNode } from 'react'

import { Card, CardBody, SectionHeader } from '@/ui'
import { useSession } from '@/auth'
import {
  coursesCollection,
  peopleCollection,
  tutorAssignmentsCollection,
  useCollection,
  type PersonId,
  type TutorAssignment,
} from '@/mocks'

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export function personName(personId: string | null | undefined): string {
  if (!personId) return '—'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

export function courseTitle(courseId: string | null | undefined): string {
  if (!courseId) return '—'
  return coursesCollection.find(courseId)?.title ?? '—'
}

/* -------------------------------------------------------------------------- */
/* Who is teaching                                                            */
/* -------------------------------------------------------------------------- */

export interface TutorScope {
  /** The person whose teaching load this module is showing. */
  tutorPersonId: PersonId | undefined
  tutorName: string
  /** Active assignments only — an ended one is history, not a class. */
  assignments: TutorAssignment[]
  /** True when the signed-in persona has no assignments of their own. */
  borrowed: boolean
}

/**
 * The signed-in tutor, or — for any other staff persona previewing this module
 * — the first person who genuinely has active assignments in the seed. The
 * fallback is flagged rather than hidden, because a tutor screen silently
 * showing someone else's cohorts would be worse than saying so.
 */
export function useTutorScope(): TutorScope {
  const session = useSession()
  const assignments = useCollection(tutorAssignmentsCollection)

  const active = assignments.filter((a) => a.status === 'active')
  const sessionPersonId = session?.personId
  const mine = sessionPersonId ? active.filter((a) => a.tutorPersonId === sessionPersonId) : []

  if (sessionPersonId && mine.length > 0) {
    return {
      tutorPersonId: sessionPersonId,
      tutorName: personName(sessionPersonId),
      assignments: mine,
      borrowed: false,
    }
  }

  const fallbackPersonId = active[0]?.tutorPersonId
  return {
    tutorPersonId: fallbackPersonId,
    tutorName: personName(fallbackPersonId),
    assignments: fallbackPersonId ? active.filter((a) => a.tutorPersonId === fallbackPersonId) : [],
    borrowed: true,
  }
}

/** Every cohort id this tutor currently holds an active assignment on. */
export function cohortIdsOf(scope: TutorScope): string[] {
  return [...new Set(scope.assignments.map((a) => a.cohortId))]
}

/* -------------------------------------------------------------------------- */
/* Layout                                                                     */
/* -------------------------------------------------------------------------- */

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 pb-16">{children}</div>
}

export interface TeachingCardProps {
  title: ReactNode
  /** Shown as the sub-line, the way both legacy portals count a list. */
  description?: ReactNode
  count?: number
  /** One action. The legacy header never carries two. */
  action?: ReactNode
  /** `none` for a table that draws its own padding. */
  padding?: 'none' | 'default'
  children: ReactNode
}

export function TeachingCard({
  title,
  description,
  count,
  action,
  padding = 'none',
  children,
}: TeachingCardProps) {
  return (
    <Card elevated>
      <div className="border-b border-border px-6 py-4">
        <SectionHeader title={title} description={description} count={count} actions={action} size="sm" />
      </div>
      <CardBody padding={padding}>{children}</CardBody>
    </Card>
  )
}

