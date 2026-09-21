/**
 * Certificates — `/my-learning/certificates`.
 *
 * The other screen the legacy portal has and Cirvee OS never gave a learner.
 * Two things live here:
 *
 *  1. **Issued certificates** — the real `Certificate` record, with the public
 *     verification id an employer can check and the QR payload that produced
 *     it. Revoked certificates stay listed, labelled, because a verification
 *     id that quietly disappears is worse than one that says why.
 *  2. **What is left before you are certified** — the same live
 *     `certificateEligibility` computation the staff-facing queue runs, shown
 *     per criterion against the course's own configured rules (PRD §4.3),
 *     recomputed from progress, grades, attendance and the money every time
 *     this screen renders.
 *
 * The framing is the whole design decision. The staff screen is an approval
 * queue — who may I issue to. This is the same five rows read the other way
 * round: here is where you are, here is what is outstanding, and here is the
 * screen that fixes it. Where a criterion is unmet, the row links to the
 * place the learner can act — the assignment, the payment page, the content.
 * An eligibility panel that only tells you that you failed is a report card,
 * not a product.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Award, Check, Copy, QrCode, X } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatDateTime } from '@/lib/format'
import { useScreenLoad } from '@/lib/view-state'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Modal,
  PageHeader,
  ProgressBar,
  SkeletonCard,
  StatusBadge,
} from '@/ui'
import {
  branchesCollection,
  certificateEligibility,
  certificatesCollection,
  coursesCollection,
  invoicesCollection,
  progressCollection,
  studentAttendanceCollection,
  submissionsCollection,
  useCollection,
  type Certificate,
  type Enrollment,
} from '@/mocks'

import { detailOf, Screen, studentToast, useStudent } from './common'

/** Where a learner goes to move an unmet criterion. */
const CRITERION_ACTION: Record<string, { label: string; to: string } | undefined> = {
  Attendance: { label: 'See your attendance', to: '/my-learning/course?tab=attendance' },
  'Content completion': { label: 'Open the course content', to: '/my-learning/course?tab=content' },
  Assignments: { label: 'See your assignments', to: '/my-learning/course?tab=assignments' },
  'Project grade': { label: 'See your assignments', to: '/my-learning/course?tab=assignments' },
  'Financial clearance': { label: 'Open your payment page', to: '/my-learning/payment' },
}

export default function Certificates() {
  const { loading } = useScreenLoad('my-learning-certificates')
  const { personId, enrolments, displayName } = useStudent()

  const allCertificates = useCollection(certificatesCollection)
  const [qrFor, setQrFor] = useState<Certificate | null>(null)

  const issued = useMemo(
    () =>
      allCertificates
        .filter((c) => c.personId === personId && c.status !== 'eligible_not_issued')
        .sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? '')),
    [allCertificates, personId],
  )

  const pending = useMemo(
    () => enrolments.filter((e) => !issued.some((c) => c.enrollmentId === e.id)),
    [enrolments, issued],
  )

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      studentToast.success('Verification link copied.')
    } catch {
      studentToast.error('Could not copy the link.')
    }
  }

  return (
    <Screen>
      <PageHeader
        title="Certificates"
        description="What you have earned, and what is left before the next one."
      />

      <div className="mt-6 flex flex-col gap-6">
        {loading ? (
          <SkeletonCard />
        ) : (
          <>
            {/* 1 — what you hold. */}
            <section className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="border-b border-border px-6 py-5">
                <p className="text-body-15 font-bold">Your certificates</p>
                <p className="text-body-12 text-text-muted">
                  {issued.length} issued to {displayName}
                </p>
              </div>

              {issued.length === 0 ? (
                <EmptyState
                  icon={Award}
                  title="No certificate yet"
                  message="Once every criterion below is met, the academy issues your certificate and it appears here with a verification link."
                  size="sm"
                />
              ) : (
                <ul className="divide-y divide-border">
                  {issued.map((certificate) => {
                    const course = coursesCollection.find(certificate.courseId)
                    const branch = branchesCollection.find(certificate.issuingBranchId)
                    return (
                      <li key={certificate.id} className="px-6 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="flex min-w-0 items-start gap-4">
                            <span
                              className={cn(
                                'grid size-11 shrink-0 place-items-center rounded-xl',
                                certificate.status === 'revoked'
                                  ? 'bg-danger-fill text-danger-ink'
                                  : 'bg-accent-subtle text-accent',
                              )}
                            >
                              <Award size={20} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-body-15 font-bold">{course?.title ?? 'Course'}</p>
                              <p className="font-mono text-body-13 text-text-secondary">
                                {certificate.certificateId}
                              </p>
                              <p className="mt-1 text-body-12 text-text-muted">
                                {certificate.issuedAt
                                  ? `Issued ${formatDate(certificate.issuedAt)}`
                                  : 'Not yet issued'}
                                {branch ? ` · ${branch.name}` : ''}
                              </p>
                              {certificate.status === 'revoked' && certificate.revokedReason && (
                                <p className="mt-2 text-body-13 text-danger-text">
                                  Revoked {certificate.revokedAt ? formatDateTime(certificate.revokedAt) : ''} —{' '}
                                  {certificate.revokedReason}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <StatusBadge status={certificate.status} size="sm" />
                            <Button
                              size="sm"
                              variant="secondary"
                              leftIcon={<Copy size={14} />}
                              onClick={() => copyLink(certificate.verificationUrl)}
                            >
                              Copy link
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              leftIcon={<QrCode size={14} />}
                              onClick={() => setQrFor(certificate)}
                            >
                              QR code
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            {/* 2 — what is left, per enrolment. */}
            {pending.map((enrolment) => (
              <EligibilityCard key={enrolment.id} enrolment={enrolment} />
            ))}

            {pending.length === 0 && issued.length > 0 && (
              <Alert tone="success" title="Nothing outstanding">
                Every course on your record has been certified.
              </Alert>
            )}
          </>
        )}
      </div>

      <Modal
        open={qrFor !== null}
        onClose={() => setQrFor(null)}
        title="Verification code"
        description={qrFor?.certificateId}
        size="sm"
      >
        {qrFor && (
          <div className="flex flex-col items-center gap-4">
            <div className="grid size-48 place-items-center rounded-2xl border border-border bg-surface-sunken text-text-muted">
              <QrCode size={96} />
            </div>
            <p className="break-all text-center font-mono text-body-12 text-text-secondary">
              {qrFor.qrPayload}
            </p>
            <p className="text-center text-body-13 text-text-secondary">
              Anyone scanning this sees only your name, the course, the issue date and the issuing
              branch.
            </p>
          </div>
        )}
      </Modal>
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */

function EligibilityCard({ enrolment }: { enrolment: Enrollment }) {
  /* `certificateEligibility` reads progress, submissions, attendance and
     invoices directly rather than taking them as arguments, so this
     subscribes to all four. Without them the card would render a snapshot and
     the copy underneath — "this page moves the moment a grade, a payment or
     an attendance record does" — would be a lie. */
  const certificates = useCollection(certificatesCollection)
  useCollection(submissionsCollection)
  useCollection(invoicesCollection)
  useCollection(studentAttendanceCollection)
  useCollection(progressCollection)

  const result = certificateEligibility(enrolment.id)
  const { cohort, course } = detailOf(enrolment)

  const met = result.criteria.filter((c) => c.met).length
  const total = result.criteria.length
  const reserved = certificates.find(
    (c) => c.enrollmentId === enrolment.id && c.status === 'eligible_not_issued',
  )

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div className="min-w-0">
          <p className="text-body-15 font-bold">
            {result.eligible ? 'You have met every criterion' : 'What is left before you are certified'}
          </p>
          <p className="text-body-12 text-text-muted">
            {course?.title ?? 'Course'} · {cohort?.code ?? ''}
          </p>
        </div>
        <Badge tone={result.eligible ? 'success' : 'warning'} variant="subtle">
          {met} of {total} met
        </Badge>
      </div>

      <div className="px-6 pt-5">
        <ProgressBar
          value={met}
          max={total}
          tone={result.eligible ? 'success' : 'accent'}
          size="sm"
          aria-label="Certificate criteria met"
        />
      </div>

      <ul className="mt-4 divide-y divide-border">
        {result.criteria.map((criterion) => {
          const action = criterion.met ? undefined : CRITERION_ACTION[criterion.criterion]
          return (
            <li key={criterion.criterion} className="flex flex-wrap items-center gap-4 px-6 py-4">
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full',
                  criterion.met ? 'bg-success-fill text-success-ink' : 'bg-warning-fill text-warning-ink',
                )}
                aria-hidden="true"
              >
                {criterion.met ? <Check size={15} /> : <X size={15} />}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-body-14 font-semibold">{criterion.criterion}</p>
                <p className="text-body-13 text-text-secondary">
                  {criterion.required === 'Not required'
                    ? 'Not required for this course'
                    : `Requires ${criterion.required} — you are at ${criterion.actual}`}
                </p>
              </div>

              {action && (
                <Button size="sm" variant="ghost" asChild>
                  <Link to={action.to}>{action.label}</Link>
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <div className="border-t border-border px-6 py-5">
        {result.eligible ? (
          <Alert tone="success" title="Ready to be issued">
            {reserved
              ? `Your certificate ${reserved.certificateId} is prepared and waiting on the academy to issue it. Nothing more is needed from you.`
              : 'Everything on your side is done. The academy issues certificates at the end of the cohort.'}
          </Alert>
        ) : (
          <p className="text-body-13 text-text-secondary">
            {result.blockedBy.length === 1
              ? `One criterion is outstanding: ${result.blockedBy[0]}.`
              : `${result.blockedBy.length} criteria are outstanding: ${result.blockedBy.join(', ')}.`}{' '}
            These are the course's own published rules, checked live — this page moves the moment a
            grade, a payment or an attendance record does.
          </p>
        )}
      </div>
    </section>
  )
}
