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

export function personName(personId: string | null | undefined): string {
  if (!personId) return '—'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

export function courseTitle(courseId: string | null | undefined): string {
  if (!courseId) return '—'
  return coursesCollection.find(courseId)?.title ?? '—'
}

export interface TutorScope {
  tutorPersonId: PersonId | undefined
  tutorName: string
  assignments: TutorAssignment[]
  borrowed: boolean
}

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

export function cohortIdsOf(scope: TutorScope): string[] {
  return [...new Set(scope.assignments.map((a) => a.cohortId))]
}

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 pb-16">{children}</div>
}

export interface TeachingCardProps {
  title: ReactNode
  description?: ReactNode
  count?: number
  action?: ReactNode
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
