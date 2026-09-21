/**
 * My course — `/my-learning/course`.
 *
 * The legacy portal drills from a course list into a cohort detail page with
 * a purple hero and a tab strip. A learner on one cohort would be clicking
 * through a one-row table to get there, so this resolves straight to their
 * enrolment and renders the hub itself; the course list only appears, as a
 * switcher, when somebody genuinely holds more than one enrolment.
 *
 * The hero and the tab strip come from `_learning-shared/CohortHub`, which
 * the Tutor module uses for the same page at the other end of the room. The
 * tabs below are student-scoped: read the content, see your own marks, see
 * your own attendance, see when the next class is. Nothing on this screen
 * creates or grades anything.
 */

import { useMemo } from 'react'

import { useQueryState } from '@/lib/view-state'
import { EmptyState, Select } from '@/ui'
import { GraduationCap } from 'lucide-react'
import { CohortHub, type CohortHubTab } from '@/modules/_learning-shared/CohortHub'
import { DiscussionTab } from '@/modules/_learning-shared/DiscussionTab'
import {
  assignmentsCollection,
  cohortDiscussionPostsCollection,
  submissionsCollection,
  useCollection,
  type Enrollment,
} from '@/mocks'

import { assignmentsFor, detailOf, Screen, useStudent } from './common'
import { deleteDiscussionPost, postToDiscussion } from './writes'
import { ContentTab } from './tabs/ContentTab'
import { AssignmentsTab } from './tabs/AssignmentsTab'
import { AttendanceTab } from './tabs/AttendanceTab'
import { TimetableTab } from './tabs/TimetableTab'

export default function MyCourse() {
  const query = useQueryState()
  const { enrolments, primary } = useStudent()

  const requested = query.get('enrolment')
  const enrolment = enrolments.find((e) => e.id === requested) ?? primary

  if (!enrolment) {
    return (
      <Screen>
        <EmptyState
          icon={GraduationCap}
          title="No enrolment on your record"
          message="You are not enrolled on a course yet. Your admissions contact can help."
          bordered
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {enrolments.length > 1 && (
        <div className="mb-4 max-w-sm">
          <Select
            aria-label="Choose a course"
            value={enrolment.id}
            onChange={(e) => query.set('enrolment', e.target.value)}
            options={enrolments.map((e) => {
              const { cohort, course } = detailOf(e)
              return { value: e.id, label: `${course?.title ?? 'Course'} · ${cohort?.code ?? ''}` }
            })}
          />
        </div>
      )}
      <CourseHub key={enrolment.id} enrolment={enrolment} />
    </Screen>
  )
}

function CourseHub({ enrolment }: { enrolment: Enrollment }) {
  const assignments = useCollection(assignmentsCollection)
  const submissions = useCollection(submissionsCollection)
  const discussionPosts = useCollection(cohortDiscussionPostsCollection)
  const { cohort, course, tutorName } = detailOf(enrolment)

  const outstanding = useMemo(
    () =>
      assignmentsFor(enrolment, assignments, submissions).filter(
        (row) => row.state === 'pending' || row.state === 'overdue' || row.state === 'returned',
      ).length,
    [enrolment, assignments, submissions],
  )

  if (!cohort || !course) {
    return (
      <EmptyState
        title="This cohort is no longer available"
        message="Your enrolment points at a cohort that is not in the catalogue."
        bordered
      />
    )
  }

  const tabs: CohortHubTab[] = [
    { id: 'content', label: 'Content', content: <ContentTab enrolment={enrolment} /> },
    {
      id: 'assignments',
      label: 'Assignments',
      badge: outstanding || undefined,
      content: <AssignmentsTab enrolment={enrolment} />,
    },
    { id: 'attendance', label: 'Attendance', content: <AttendanceTab enrolment={enrolment} /> },
    { id: 'timetable', label: 'Timetable', content: <TimetableTab enrolment={enrolment} /> },
    {
      id: 'discussion',
      label: 'Discussion',
      content: (
        <DiscussionTab
          posts={discussionPosts.filter((p) => p.cohortId === cohort.id)}
          currentPersonId={enrolment.personId}
          onPost={(body) => postToDiscussion(cohort.id, enrolment.personId, body)}
          onDelete={(postId) => deleteDiscussionPost(postId)}
        />
      ),
    },
  ]

  return (
    <CohortHub
      cohort={cohort}
      course={course}
      facilitatorName={tutorName}
      tabs={tabs}
      backTo="/my-learning"
      backLabel="Back to dashboard"
      defaultTab="content"
    />
  )
}
