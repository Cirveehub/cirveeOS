import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Alert, Button, EmptyState } from '@/ui'
import { CohortHub, type CohortHubTab } from '@/modules/_learning-shared/CohortHub'
import { DiscussionTab } from '@/modules/_learning-shared/DiscussionTab'
import { useCurrentUserId } from '@/auth'
import {
  assignmentsCollection,
  classSessionsCollection,
  cohortDiscussionPostsCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  submissionsCollection,
  tutorAssignmentsCollection,
  useCollection,
  type ContentFormat,
  type LessonId,
} from '@/mocks'

import { Page, personName, useTutorScope } from './shared'
import { deleteDiscussionPost, pinDiscussionPost, postToDiscussion } from './writes'
import AssignmentModal from './AssignmentModal'
import MaterialModal from './MaterialModal'
import RosterTab from './tabs/RosterTab'
import AttendanceTab from './tabs/AttendanceTab'
import MaterialsTab from './tabs/MaterialsTab'
import AssignmentsTab from './tabs/AssignmentsTab'
import TimetableTab from './tabs/TimetableTab'

export interface UploadTarget {
  lessonId: LessonId | null
  format: ContentFormat | null
}

export default function CohortScreen() {
  const { cohortId = '' } = useParams<{ cohortId: string }>()
  const actorUserId = useCurrentUserId()
  const scope = useTutorScope()

  const cohorts = useCollection(cohortsCollection)
  const courses = useCollection(coursesCollection)
  const enrolments = useCollection(enrollmentsCollection)
  const submissions = useCollection(submissionsCollection)
  const assignments = useCollection(assignmentsCollection)
  const sessions = useCollection(classSessionsCollection)
  const tutorAssignments = useCollection(tutorAssignmentsCollection)
  const discussionPosts = useCollection(cohortDiscussionPostsCollection)

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<UploadTarget | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const cohort = cohorts.find((c) => c.id === cohortId)
  const course = cohort ? courses.find((c) => c.id === cohort.courseId) : undefined

  const leadTutorName = useMemo(() => {
    if (!cohort) return undefined
    const lead =
      tutorAssignments.find((a) => a.cohortId === cohort.id && a.status === 'active' && a.role === 'lead') ??
      tutorAssignments.find((a) => a.cohortId === cohort.id && a.status === 'active')
    return lead ? personName(lead.tutorPersonId) : undefined
  }, [cohort, tutorAssignments])

  const cohortEnrolments = useMemo(
    () => enrolments.filter((e) => e.cohortId === cohortId && e.status !== 'withdrawn'),
    [enrolments, cohortId],
  )

  const cohortAssignments = useMemo(
    () =>
      assignments.filter(
        (a) => a.cohortId === cohortId || (a.cohortId === null && a.courseId === cohort?.courseId),
      ),
    [assignments, cohortId, cohort?.courseId],
  )

  const pendingCount = useMemo(() => {
    const assignmentIds = new Set(cohortAssignments.map((a) => a.id))
    const enrolmentIds = new Set(cohortEnrolments.map((e) => e.id))
    return submissions.filter(
      (s) =>
        s.status === 'awaiting_grading' &&
        assignmentIds.has(s.assignmentId) &&
        enrolmentIds.has(s.enrollmentId),
    ).length
  }, [submissions, cohortAssignments, cohortEnrolments])

  const cohortSessions = useMemo(
    () => sessions.filter((s) => s.cohortId === cohortId),
    [sessions, cohortId],
  )

  if (!cohort || !course) {
    return (
      <Page>
        <EmptyState
          title="That cohort is not on your list"
          message="Either it does not exist, or your assignment to it has ended. Ended assignments are kept on the record but are not classes you teach."
          action={
            <Button variant="secondary" asChild>
              <Link to="/teaching/classes">Back to my classes</Link>
            </Button>
          }
        />
      </Page>
    )
  }

  const mine = scope.assignments.some((a) => a.cohortId === cohort.id)

  const tabs: CohortHubTab[] = [
    {
      id: 'roster',
      label: 'Roster',
      badge: cohortEnrolments.length || undefined,
      content: <RosterTab cohort={cohort} enrolments={cohortEnrolments} assignments={cohortAssignments} />,
    },
    {
      id: 'attendance',
      label: 'Attendance',
      content: (
        <AttendanceTab
          cohort={cohort}
          enrolments={cohortEnrolments}
          sessions={cohortSessions}
          actorUserId={actorUserId}
        />
      ),
    },
    {
      id: 'materials',
      label: 'Materials',
      content: (
        <MaterialsTab
          course={course}
          onUpload={(target) => setUploadTarget(target)}
        />
      ),
    },
    {
      id: 'assignments',
      label: 'Assignments',
      badge: pendingCount || undefined,
      content: (
        <AssignmentsTab
          cohort={cohort}
          assignments={cohortAssignments}
          enrolments={cohortEnrolments}
          onCreate={() => setAssignmentModalOpen(true)}
        />
      ),
    },
    {
      id: 'timetable',
      label: 'Timetable',
      content: <TimetableTab cohort={cohort} sessions={cohortSessions} />,
    },
    {
      id: 'discussion',
      label: 'Discussion',
      content: (
        <DiscussionTab
          posts={discussionPosts.filter((p) => p.cohortId === cohort.id)}
          currentPersonId={scope.tutorPersonId}
          onPost={(body) =>
            scope.tutorPersonId && postToDiscussion(cohort.id, scope.tutorPersonId, body, actorUserId)
          }
          onDelete={(postId) => deleteDiscussionPost(postId)}
          onPin={(postId, pinned) => pinDiscussionPost(postId, pinned, actorUserId)}
        />
      ),
    },
  ]

  return (
    <Page>
      {!mine && (
        <Alert tone="warning" title="You are not the assigned tutor on this cohort" className="mb-4">
          You can read it, but marking a register or grading work here would be recorded against your name.
        </Alert>
      )}

      {notice && (
        <Alert tone="success" title="Saved" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <CohortHub
        cohort={cohort}
        course={course}
        facilitatorName={leadTutorName}
        tabs={tabs}
        backTo="/teaching/classes"
        backLabel="My classes"
        defaultTab="roster"
      />

      <AssignmentModal
        open={assignmentModalOpen}
        onClose={() => setAssignmentModalOpen(false)}
        cohort={cohort}
        course={course}
        actorUserId={actorUserId}
        onCreated={(assignment) =>
          setNotice(`"${assignment.title}" is live for ${cohort.code}, due ${assignment.dueDate}.`)
        }
      />

      <MaterialModal
        open={uploadTarget !== null}
        onClose={() => setUploadTarget(null)}
        course={course}
        initialLessonId={uploadTarget?.lessonId ?? null}
        initialFormat={uploadTarget?.format ?? null}
        actorUserId={actorUserId}
        onUploaded={(result) =>
          setNotice(
            `${result.asset.fileName} added to "${result.lesson.title}"${
              result.lessonCreated ? ' — the lesson was created too.' : '.'
            }`,
          )
        }
      />
    </Page>
  )
}
