import { BookOpen } from 'lucide-react'
import { Navigate } from 'react-router-dom'

import { defineModule } from '@/app/module-registry'
import { useSession } from '@/auth'
import { enrollmentsCollection } from '@/mocks'
import { EmptyState } from '@/ui'

import LearnDashboard from './LearnDashboard'
import Courses from './Courses'
import CourseBuilder from './CourseBuilder'
import LessonEditor from './LessonEditor'
import ContentLibrary from './ContentLibrary'
import Assignments from './Assignments'
import Submissions from './Submissions'
import Quizzes, { QuizBuilder } from './Quizzes'
import ProgressScreen from './ProgressScreen'
import CertificateRules from './CertificateRules'
import Certificates from './Certificates'
import StudentView from './StudentView'

/**
 * A student who opens "Cirvee Learn" wants their own course, not the staff
 * dashboard with a course builder and a grading queue — `StudentView` already
 * exists for exactly this, but it takes an enrolment id as a route param
 * because it doubles as the screen a tutor previews a specific learner
 * through. This resolves that id for the signed-in student and lands on it
 * directly, so the module means the same thing to both kinds of visitor
 * without being two different modules.
 */
function LearnIndex() {
  const session = useSession()

  if (session?.persona.shape === 'consumer') {
    const enrolment = session.personId
      ? enrollmentsCollection
          .where((e) => e.personId === session.personId && e.status !== 'withdrawn')
          .sort((a, b) => (a.status === 'active' ? -1 : 1))[0]
      : undefined

    if (!enrolment) {
      return (
        <div className="px-8 py-6">
          <EmptyState title="No enrolment on your record" message="You are not enrolled in a course yet." />
        </div>
      )
    }
    return <Navigate to={`/learn/student/${enrolment.id}`} replace />
  }

  return <LearnDashboard />
}

export default defineModule({
  id: 'learn',
  label: 'Cirvee Learn',
  icon: BookOpen,
  base: '/learn',
  group: 'learning',
  depth: 'deep',
  summary:
    'The learner-facing product: course builder, multi-format content, grading and certificates.',
  permission: 'learn.course.view.own',
  routes: [
    { path: '', element: <LearnIndex /> },

    { path: 'courses', element: <Courses /> },
    // The param names below are the ones the screens actually read through
    // `useParams`. They were `:id` before, which meant every deep link into
    // the builder, the lesson editor, the quiz builder and the student view
    // resolved to a "not found" panel.
    { path: 'courses/:courseId/builder', element: <CourseBuilder /> },
    { path: 'courses/:courseId/certificate', element: <CertificateRules /> },
    { path: 'courses/:courseId/modules/:moduleId/lessons/:lessonId', element: <LessonEditor /> },
    { path: 'courses/:courseId/lessons/:lessonId', element: <LessonEditor /> },

    { path: 'library', element: <ContentLibrary /> },

    { path: 'assignments', element: <Assignments /> },
    { path: 'submissions', element: <Submissions /> },
    { path: 'submissions/:id', element: <Submissions /> },

    { path: 'quizzes', element: <Quizzes /> },
    { path: 'quizzes/:quizId', element: <QuizBuilder /> },

    { path: 'progress', element: <ProgressScreen /> },

    { path: 'certificates', element: <Certificates /> },

    // What a learner sees. Here so the founder can check the student side
    // without a second login.
    { path: 'student', element: <StudentView /> },
    { path: 'student/:enrollmentId', element: <StudentView /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Courses', to: 'courses' },
    { label: 'Content library', to: 'library' },
    { label: 'Assignments', to: 'assignments' },
    { label: 'Grading', to: 'submissions' },
    { label: 'Quizzes', to: 'quizzes' },
    { label: 'Progress', to: 'progress' },
    { label: 'Certificates', to: 'certificates' },
    { label: 'Student view', to: 'student' },
  ],
})
