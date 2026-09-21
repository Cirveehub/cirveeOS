/**
 * Certificate eligibility editor — `/learn/courses/:courseId/certificate`.
 *
 * Small screen, large point: every threshold that gates a certificate is data
 * on the course, and the evaluator proves it by re-running the rules against a
 * real enrolled student on every keystroke.
 */

import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  SkeletonCard,
  Switch,
} from '@/ui'
import {
  certificateEligibility,
  CURRENT_USER_ID,
  coursesCollection,
  documentTemplatesCollection,
  enrollmentsCollection,
  progressCollection,
  submissionsCollection,
  useCollection,
  useRecord,
  type CertificateEligibilityRules,
  type EnrollmentId,
} from '@/mocks'

import {
  CriterionRow,
  Screen,
  ScreenError,
  learnToast,
  nowIso,
  personName,
  useScreenError,
  useScreenLoading,
} from './common'

export default function CertificateRules() {
  const { courseId = '' } = useParams()
  const navigate = useNavigate()
  const loading = useScreenLoading(`learn:certificate-rules:${courseId}`)
  const { errored, retry } = useScreenError()

  const course = useRecord(coursesCollection, courseId)
  const enrollments = useCollection(enrollmentsCollection).filter((e) => e.courseId === courseId)
  const templates = useCollection(documentTemplatesCollection)
  useCollection(progressCollection)
  useCollection(submissionsCollection)

  const [evaluatee, setEvaluatee] = useState<string>('')

  const candidates = useMemo(
    () =>
      [...enrollments]
        .filter((e) => e.status !== 'withdrawn')
        .sort((a, b) => personName(a.personId).localeCompare(personName(b.personId))),
    [enrollments],
  )

  const selected = evaluatee || candidates[0]?.id || ''
  const result = selected ? certificateEligibility(selected as EnrollmentId) : null

  if (!course && !loading) {
    return (
      <Screen>
        <Alert tone="danger" title="Course not found">
          Nothing to configure. <Button variant="link" onClick={() => navigate('/learn/courses')}>Back to courses</Button>
        </Alert>
      </Screen>
    )
  }

  const rules = course?.certificateRules

  function patchRules(delta: Partial<CertificateEligibilityRules>) {
    if (!course) return
    coursesCollection.update(course.id, {
      certificateRules: { ...course.certificateRules, ...delta },
      updatedAt: nowIso(),
      updatedBy: CURRENT_USER_ID,
    })
  }

  return (
    <Screen>
      <PageHeader
        title="Certificate eligibility"
        description={course ? `${course.code} — ${course.title}` : undefined}
        breadcrumbs={[
          { label: 'Cirvee Learn', to: '/learn' },
          { label: 'Courses', to: '/learn/courses' },
          { label: course?.title ?? 'Course', to: `/learn/courses/${courseId}/builder` },
          { label: 'Certificate' },
        ]}
        actions={
          <Button
            variant="secondary"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(`/learn/courses/${courseId}/builder`)}
          >
            Back to builder
          </Button>
        }
      />

      {errored ? (
        <ScreenError what="The certificate rules" onRetry={retry} />
      ) : loading || !rules || !course ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <Card>
              <CardHeader
                title="Rules"
                description="These thresholds are stored on the course. Change one and the evaluator on the right re-runs immediately."
              />
              <CardBody className="space-y-5">
                <div className="space-y-2">
                  <Switch
                    checked={rules.attendanceThreshold !== null}
                    onChange={(on) => patchRules({ attendanceThreshold: on ? 75 : null })}
                    label="Attendance threshold"
                    description="Share of delivered sessions the learner must have attended."
                  />
                  {rules.attendanceThreshold !== null && (
                    <Field label="Minimum attendance" id="rule-attendance">
                      <Input
                        id="rule-attendance"
                        type="number"
                        min={0}
                        max={100}
                        suffix="%"
                        value={rules.attendanceThreshold}
                        onChange={(e) => patchRules({ attendanceThreshold: clamp(Number(e.target.value)) })}
                      />
                    </Field>
                  )}
                </div>

                <div className="space-y-2">
                  <Switch
                    checked={rules.contentCompletionThreshold !== null}
                    onChange={(on) => patchRules({ contentCompletionThreshold: on ? 100 : null })}
                    label="Content completion"
                    description="Share of the course's lessons marked complete."
                  />
                  {rules.contentCompletionThreshold !== null && (
                    <Field label="Minimum content completed" id="rule-content">
                      <Input
                        id="rule-content"
                        type="number"
                        min={0}
                        max={100}
                        suffix="%"
                        value={rules.contentCompletionThreshold}
                        onChange={(e) => patchRules({ contentCompletionThreshold: clamp(Number(e.target.value)) })}
                      />
                    </Field>
                  )}
                </div>

                <div className="space-y-2">
                  <Field label="Required assignments" id="rule-assignments">
                    <Select
                      id="rule-assignments"
                      value={rules.requiredAssignments}
                      onChange={(e) =>
                        patchRules({
                          requiredAssignments: e.target.value as CertificateEligibilityRules['requiredAssignments'],
                        })
                      }
                      options={[
                        { value: 'all', label: 'All assignments passed' },
                        { value: 'listed', label: 'Only the listed assignments' },
                        { value: 'minimum_count', label: 'A minimum number passed' },
                      ]}
                    />
                  </Field>
                  {rules.requiredAssignments === 'minimum_count' && (
                    <Field label="Minimum assignments passed" id="rule-assignment-count">
                      <Input
                        id="rule-assignment-count"
                        type="number"
                        min={0}
                        value={rules.minimumAssignmentCount ?? 0}
                        onChange={(e) => patchRules({ minimumAssignmentCount: Number(e.target.value) || 0 })}
                      />
                    </Field>
                  )}
                </div>

                <div className="space-y-2">
                  <Switch
                    checked={rules.projectRequired}
                    onChange={(on) => patchRules({ projectRequired: on })}
                    label="Project passed"
                    description="The capstone or portfolio project must be graded above the minimum."
                  />
                  {rules.projectRequired && (
                    <Field label="Minimum project grade" id="rule-project">
                      <Input
                        id="rule-project"
                        type="number"
                        min={0}
                        max={100}
                        suffix="%"
                        value={rules.projectMinimumGrade ?? 60}
                        onChange={(e) => patchRules({ projectMinimumGrade: clamp(Number(e.target.value)) })}
                      />
                    </Field>
                  )}
                </div>

                <div className="space-y-2">
                  <Switch
                    checked={rules.finalAssessmentRequired}
                    onChange={(on) => patchRules({ finalAssessmentRequired: on })}
                    label="Final assessment passed"
                  />
                  {rules.finalAssessmentRequired && (
                    <Field label="Pass mark" id="rule-final">
                      <Input
                        id="rule-final"
                        type="number"
                        min={0}
                        max={100}
                        suffix="%"
                        value={rules.finalAssessmentPassMark ?? 60}
                        onChange={(e) => patchRules({ finalAssessmentPassMark: clamp(Number(e.target.value)) })}
                      />
                    </Field>
                  )}
                </div>

                <Switch
                  checked={rules.financialClearanceRequired}
                  onChange={(on) => patchRules({ financialClearanceRequired: on })}
                  label="Financial clearance required"
                  description="Blocks certificate issue while a balance is outstanding."
                />

                <Field label="Certificate template" id="rule-template">
                  <Select
                    id="rule-template"
                    value={rules.templateId}
                    onChange={(e) => patchRules({ templateId: e.target.value as CertificateEligibilityRules['templateId'] })}
                    options={templates.map((t) => ({ value: t.id, label: t.name }))}
                    placeholder="Choose a template"
                  />
                </Field>

                <Switch
                  checked={rules.autoIssue}
                  onChange={(on) => patchRules({ autoIssue: on })}
                  label="Auto-issue on eligibility"
                  description="Off means a human issues each certificate from the certificates queue."
                />
              </CardBody>
            </Card>

            <Alert tone="info" title="Why this screen exists">
              Every number above is stored on the course record, not in code. Two courses can require different
              attendance and the same engine evaluates both.
            </Alert>
          </div>

          <Card className="h-fit">
            <CardHeader
              title="Evaluator"
              description="Pick an enrolled student and watch the rules run against their real record."
              actions={
                <Select
                  aria-label="Student to evaluate"
                  selectSize="sm"
                  value={selected}
                  onChange={(e) => setEvaluatee(e.target.value)}
                  options={candidates.map((e) => ({
                    value: e.id,
                    label: personName(e.personId),
                  }))}
                  containerClassName="w-52"
                />
              }
            />
            <CardBody>
              {!result ? (
                <EmptyState
                  size="sm"
                  icon={ShieldCheck}
                  title="Nobody is enrolled on this course yet"
                  message="The rules cannot be tested until at least one learner is enrolled."
                />
              ) : (
                <>
                  <Alert
                    tone={result.eligible ? 'success' : 'warning'}
                    title={
                      result.eligible
                        ? `${personName(result.personId)} is eligible`
                        : `${personName(result.personId)} is not eligible`
                    }
                    className="mb-3"
                  >
                    {result.eligible
                      ? 'Every criterion below is met. A certificate can be issued from the certificates queue.'
                      : `Blocked by: ${result.blockedBy.join(', ')}.`}
                  </Alert>

                  <div className="rounded-xl border border-border px-3">
                    {result.criteria.map((c) => (
                      <CriterionRow
                        key={c.criterion}
                        criterion={c.criterion}
                        required={c.required}
                        actual={c.actual}
                        met={c.met}
                        note={
                          c.criterion === 'Financial clearance' && !c.met
                            ? 'Financial clearance is a course rule, not a global one. Override requires an approval request.'
                            : undefined
                        }
                      />
                    ))}
                  </div>

                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/learn/certificates?course=${courseId}&filter=eligible_not_issued`)}
                    >
                      Open certificates queue
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        learnToast.success('Rules saved', 'Every evaluation from now on uses these thresholds.')
                      }}
                    >
                      Save rules
                    </Button>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </Screen>
  )
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.min(100, Math.max(0, n))
}
