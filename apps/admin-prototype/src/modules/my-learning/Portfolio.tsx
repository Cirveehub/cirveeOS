/**
 * Portfolio — `/my-learning/portfolio`.
 *
 * Genuinely auto-generated: there is no editor here, nothing to arrange or
 * write. One entry per course, taken as the course's own capstone: the last
 * gradable assignment in course order, once it is graded and passed. This is
 * deliberately not "every `lesson.type === 'project'`" — the seed's own
 * comment on Data Analysis's capstone lesson says why that would find
 * nothing: "The capstone lesson is the presentation of the final project
 * assignment, not a seventh assignment of its own." Product Design's project
 * lesson does carry its own assignment, so both shapes are covered by the
 * same rule: whichever assignment sits last in the course outline is the
 * portfolio piece. Failed or ungraded work is excluded on purpose — a
 * portfolio showcases finished work, and the full submission history already
 * lives on the Assignments tab and `AssignmentDetail`.
 */
import { FileText, Sparkles } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import { Badge, EmptyState, PageHeader } from '@/ui'
import {
  assignmentsCollection,
  courseModulesCollection,
  coursesCollection,
  lessonsCollection,
  submissionsCollection,
  useCollection,
} from '@/mocks'

import { Screen, useStudent } from './common'

export default function Portfolio() {
  const { enrolments } = useStudent()
  const modules = useCollection(courseModulesCollection)
  const lessons = useCollection(lessonsCollection)
  const submissions = useCollection(submissionsCollection)

  const entries = enrolments.flatMap((enrolment) => {
    const course = coursesCollection.find(enrolment.courseId)

    // Lesson `sequence` resets per module, so ordering within a course needs
    // the module's own sequence as the primary key.
    const candidates = lessons
      .filter(
        (l) =>
          l.courseId === enrolment.courseId && (l.type === 'assignment' || l.type === 'project') && l.assignmentId,
      )
      .map((l) => ({ lesson: l, moduleSeq: modules.find((m) => m.id === l.moduleId)?.sequence ?? 0 }))
      .sort((a, b) => b.moduleSeq - a.moduleSeq || b.lesson.sequence - a.lesson.sequence)

    for (const { lesson } of candidates) {
      const assignment = assignmentsCollection.find(lesson.assignmentId!)
      if (!assignment) continue
      const submission = submissions.find((s) => s.assignmentId === assignment.id && s.enrollmentId === enrolment.id)
      if (submission && submission.status === 'graded' && submission.passed === true) {
        return [{ course, lesson, assignment, submission }]
      }
    }
    return []
  })

  return (
    <Screen>
      <PageHeader
        title="Portfolio"
        description="Your graded projects, gathered automatically — nothing here is written by hand."
      />

      {entries.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={Sparkles}
            title="Nothing to show yet"
            message="Your graded, passing projects will appear here automatically."
            bordered
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {entries.map(({ course, lesson, assignment, submission }) => (
            <article key={submission.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
              <div>
                <p className="text-label-10 text-text-label">{course?.title ?? 'Course'}</p>
                <h2 className="mt-1 text-body-16 font-bold text-text">{lesson.title}</h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="success" variant="subtle" size="sm">
                  Passed
                </Badge>
                <Badge tone="neutral" variant="subtle" size="sm">
                  {submission.totalScore}/{assignment.maxScore}
                </Badge>
                <span className="text-body-12 text-text-muted">
                  Graded {submission.gradedAt ? formatDate(submission.gradedAt) : ''}
                </span>
              </div>

              {assignment.brief && (
                <p className="line-clamp-3 text-body-13 text-text-secondary">{assignment.brief}</p>
              )}

              {submission.files.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {submission.files.map((file) => (
                    <li
                      key={file.url}
                      className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent">
                        <FileText size={13} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-body-13 font-medium">{file.fileName}</span>
                    </li>
                  ))}
                </ul>
              )}

              {submission.feedback && (
                <p className="rounded-xl border border-border bg-surface-sunken p-3 text-body-13 text-text-secondary">
                  "{submission.feedback}"
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {entries.length > 0 && (
        <p className="mt-6 text-body-12 text-text-muted">
          {formatNumber(entries.length)} project{entries.length === 1 ? '' : 's'} shown — updated automatically as
          more of your projects are graded.
        </p>
      )}
    </Screen>
  )
}
