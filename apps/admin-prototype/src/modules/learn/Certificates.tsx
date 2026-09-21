import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Award,
  Check,
  Copy,
  Download,
  QrCode,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Alert,
  Badge,
  BulkActionBar,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  ConfirmDialog,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  SkeletonTable,
  StatusBadge,
  Switch,
  Textarea,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
} from '@/ui'
import {
  certificateEligibility,
  certificatesCollection,
  cohortsCollection,
  coursesCollection,
  enrollmentsCollection,
  outcomeRecordsCollection,
  progressCollection,
  submissionsCollection,
  useCollection,
  type Certificate,
  type CertificateStatus,
  type EnrollmentId,
} from '@/mocks'

import {
  CriterionRow,
  Screen,
  ScreenError,
  learnToast,
  personName,
  userName,
  useScreenError,
  useScreenLoading,
} from './common'
import { issueCertificate, revokeCertificate, type IssueResult } from './writes'

interface CertificateRow {
  key: string
  certificate: Certificate | null
  enrollmentId: EnrollmentId
  personId: string
  courseId: string
  cohortId: string
  publicId: string
  status: CertificateStatus
  issuedAt: string | null
  issuedByUserId: string | null
  criteria: Array<{ criterion: string; required: string; actual: string; met: boolean }>
  blockedBy: string[]
  outcomeRecordId: string | null
  verificationUrl: string
}

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'certificateId', label: 'Certificate ID', defaultVisible: true, locked: true },
  { key: 'student', label: 'Student', defaultVisible: true },
  { key: 'course', label: 'Course', defaultVisible: true },
  { key: 'cohort', label: 'Cohort', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'eligibility', label: 'Eligibility', defaultVisible: true },
  { key: 'issued', label: 'Issued', defaultVisible: true },
  { key: 'issuedBy', label: 'Issued by', defaultVisible: false },
  { key: 'outcome', label: 'Outcome record', defaultVisible: false },
  { key: 'verification', label: 'Verification link', defaultVisible: false },
]

export default function Certificates() {
  const navigate = useNavigate()
  const loading = useScreenLoading('learn:certificates')
  const { errored, retry } = useScreenError()
  const query = useQueryState()

  const certificates = useCollection(certificatesCollection)
  const enrollments = useCollection(enrollmentsCollection)
  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const outcomes = useCollection(outcomeRecordsCollection)
  useCollection(submissionsCollection)
  useCollection(progressCollection)

  const [openKey, setOpenKey] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [confirmIssue, setConfirmIssue] = useState<CertificateRow | null>(null)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [revoking, setRevoking] = useState<CertificateRow | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [revokeTouched, setRevokeTouched] = useState(false)
  const [qrFor, setQrFor] = useState<CertificateRow | null>(null)
  const [issued, setIssued] = useState<IssueResult | null>(null)

  const search = query.get('q') ?? ''
  const status = query.get('status')
  const courseFilter = query.get('course')
  const cohortFilter = query.get('cohort')
  const onlyEligible = query.get('filter') === 'eligible_not_issued'

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const courseTitle = (id: string) => courses.find((c) => c.id === id)?.title ?? '—'
  const cohortCode = (id: string) => cohorts.find((c) => c.id === id)?.code ?? '—'

  const rows = useMemo<CertificateRow[]>(() => {
    const withCertificate = new Set(certificates.map((c) => c.enrollmentId as string))

    const fromCertificates = certificates.map<CertificateRow>((certificate) => {
      const live =
        certificate.status === 'eligible_not_issued'
          ? certificateEligibility(certificate.enrollmentId)
          : null
      return {
        key: certificate.id,
        certificate,
        enrollmentId: certificate.enrollmentId,
        personId: certificate.personId,
        courseId: certificate.courseId,
        cohortId: certificate.cohortId,
        publicId: certificate.certificateId,
        status: certificate.status,
        issuedAt: certificate.issuedAt,
        issuedByUserId: certificate.issuedByUserId,
        criteria: live ? live.criteria : certificate.eligibilitySnapshot,
        blockedBy: live ? live.blockedBy : [],
        outcomeRecordId: certificate.outcomeRecordId,
        verificationUrl: certificate.verificationUrl,
      }
    })

    const candidates = enrollments
      .filter((e) => !withCertificate.has(e.id) && (e.status === 'completed' || e.status === 'active'))
      .map((e) => ({ enrolment: e, result: certificateEligibility(e.id) }))
      .filter((row) => row.result.eligible)
      .map<CertificateRow>(({ enrolment, result }) => ({
        key: `candidate:${enrolment.id}`,
        certificate: null,
        enrollmentId: enrolment.id,
        personId: enrolment.personId,
        courseId: enrolment.courseId,
        cohortId: enrolment.cohortId,
        publicId: 'Not yet allocated',
        status: 'eligible_not_issued',
        issuedAt: null,
        issuedByUserId: null,
        criteria: result.criteria,
        blockedBy: result.blockedBy,
        outcomeRecordId: null,
        verificationUrl: '',
      }))

    return [...fromCertificates, ...candidates]
  }, [certificates, enrollments])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows
      .filter((row) => {
        if (onlyEligible && row.status !== 'eligible_not_issued') return false
        if (status && row.status !== status) return false
        if (courseFilter && row.courseId !== courseFilter) return false
        if (cohortFilter && row.cohortId !== cohortFilter) return false
        if (!term) return true
        return `${row.publicId} ${personName(row.personId)} ${courseTitle(row.courseId)} ${cohortCode(row.cohortId)}`
          .toLowerCase()
          .includes(term)
      })
      .sort((a, b) => {
        const rank = (r: CertificateRow) => (r.status === 'eligible_not_issued' ? 0 : r.status === 'issued' ? 1 : 2)
        return rank(a) - rank(b) || (b.issuedAt ?? '').localeCompare(a.issuedAt ?? '')
      })
  }, [rows, search, status, courseFilter, cohortFilter, onlyEligible, courses, cohorts])

  const open = openKey ? rows.find((r) => r.key === openKey) ?? null : null
  const hasFilters = Boolean(search || status || courseFilter || cohortFilter || onlyEligible)

  const issuableSelection = useMemo(
    () => filtered.filter((r) => selected.includes(r.key) && isIssuable(r)),
    [filtered, selected],
  )

  function copyLink(row: CertificateRow) {
    const url = row.verificationUrl || 'Not yet allocated'
    void navigator.clipboard?.writeText(url)
    learnToast.success('Verification link copied', url)
  }

  function runIssue(row: CertificateRow) {
    try {
      const result = issueCertificate(row.enrollmentId)
      setIssued(result)
      setConfirmIssue(null)
      setOpenKey(result.certificate.id)
      setSelected((keys) => keys.filter((k) => k !== row.key))
    } catch (error) {
      learnToast.error(
        'Certificate not issued',
        error instanceof Error ? error.message : 'The rules refused this one.',
      )
      setConfirmIssue(null)
    }
  }

  function runBulkIssue() {
    let count = 0
    for (const row of issuableSelection) {
      try {
        issueCertificate(row.enrollmentId)
        count += 1
      } catch {
      }
    }
    setConfirmBulk(false)
    setSelected([])
    learnToast.success(
      `${count} ${count === 1 ? 'certificate' : 'certificates'} issued`,
      'Each one opened an outcome record, queued a review request and drafted a proof asset.',
    )
  }

  const allColumns: Record<string, Column<CertificateRow>> = {
    certificateId: {
      key: 'certificateId',
      header: 'Certificate ID',
      pinned: true,
      minWidth: 196,
      cell: (row) => (
        <span
          className={cn(
            'font-mono text-body-12',
            row.certificate ? 'text-text' : 'text-text-muted',
          )}
        >
          {row.publicId}
        </span>
      ),
      sortValue: (row) => row.publicId,
    },
    student: {
      key: 'student',
      header: 'Student',
      minWidth: 180,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
    },
    course: {
      key: 'course',
      header: 'Course',
      minWidth: 190,
      accessor: (row) => courseTitle(row.courseId),
      sortValue: (row) => courseTitle(row.courseId),
    },
    cohort: {
      key: 'cohort',
      header: 'Cohort',
      width: 108,
      accessor: (row) => <span className="font-mono text-body-12">{cohortCode(row.cohortId)}</span>,
      sortValue: (row) => cohortCode(row.cohortId),
    },
    status: {
      key: 'status',
      header: 'Status',
      width: 156,
      cell: (row) => <StatusBadge status={row.status} />,
      sortValue: (row) => row.status,
    },
    eligibility: {
      key: 'eligibility',
      header: 'Eligibility',
      minWidth: 200,
      cell: (row) => <CriteriaChips criteria={row.criteria} />,
      sortValue: (row) => row.criteria.filter((c) => c.met).length,
    },
    issued: {
      key: 'issued',
      header: 'Issued',
      width: 116,
      accessor: (row) => (row.issuedAt ? formatDate(row.issuedAt) : <span className="text-text-muted">—</span>),
      sortValue: (row) => row.issuedAt ?? '',
    },
    issuedBy: {
      key: 'issuedBy',
      header: 'Issued by',
      minWidth: 160,
      accessor: (row) => (row.issuedByUserId ? userName(row.issuedByUserId) : <span className="text-text-muted">—</span>),
      sortValue: (row) => (row.issuedByUserId ? userName(row.issuedByUserId) : ''),
    },
    outcome: {
      key: 'outcome',
      header: 'Outcome record',
      width: 150,
      cell: (row) =>
        row.outcomeRecordId ? (
          <Badge tone="success" size="sm">
            Opened
          </Badge>
        ) : (
          <span className="text-body-12 text-text-muted">Not opened</span>
        ),
      sortValue: (row) => (row.outcomeRecordId ? 1 : 0),
    },
    verification: {
      key: 'verification',
      header: 'Verification link',
      minWidth: 260,
      cell: (row) =>
        row.verificationUrl ? (
          <span className="truncate font-mono text-body-12 text-text-secondary">{row.verificationUrl}</span>
        ) : (
          <span className="text-body-12 text-text-muted">Allocated on issue</span>
        ),
      sortValue: (row) => row.verificationUrl,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  const waiting = rows.filter((r) => r.status === 'eligible_not_issued')
  const readyNow = waiting.filter(isIssuable)

  const blockers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const row of waiting) {
      for (const c of row.criteria) {
        if (!c.met) counts.set(c.criterion, (counts.get(c.criterion) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [waiting])

  return (
    <Screen wide>
      <PageHeader
        title="Certificates"
        description="Who has earned one, who has been issued one, and what each certificate was awarded against."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate('/learn/progress')}>
              Open progress
            </Button>
            <Button
              leftIcon={<Award size={16} />}
              disabled={readyNow.length === 0}
              onClick={() => {
                setSelected(readyNow.map((r) => r.key))
                setConfirmBulk(true)
              }}
            >
              Issue all eligible
            </Button>
          </div>
        }
      />

      {errored ? (
        <ScreenError what="The certificate queue" onRetry={retry} />
      ) : (
        <>
          <Alert
            tone={readyNow.length > 0 ? 'warning' : waiting.length > 0 ? 'info' : 'success'}
            icon={ShieldCheck}
            title={
              readyNow.length > 0
                ? `${readyNow.length} ${readyNow.length === 1 ? 'learner has' : 'learners have'} met every criterion and ${readyNow.length === 1 ? 'is' : 'are'} still waiting`
                : waiting.length > 0
                  ? `${waiting.length} ${waiting.length === 1 ? 'learner is' : 'learners are'} waiting, none of them currently clears every criterion`
                  : 'Nobody is waiting on a certificate'
            }
            className="mt-4"
          >
            {waiting.length === 0 ? (
              'Issuing one adds an alumnus relationship, opens an outcome record with its 3, 6 and 12-month checkpoints, queues a review request and drafts a proof asset.'
            ) : (
              <>
                {blockers.length > 0 && (
                  <>
                    Standing in the way:{' '}
                    {blockers.map(([criterion, count], i) => (
                      <span key={criterion}>
                        {i > 0 ? ', ' : ''}
                        {criterion.toLowerCase()} ({count})
                      </span>
                    ))}
                    .{' '}
                  </>
                )}
                These are recomputed live against each course's rules, so grading the last submission or clearing a
                balance moves a row into the issuable set without a reload.
              </>
            )}
          </Alert>

          <Card className="mt-4">
            <CardBody padding="none">
              <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4">
                <FilterBar
                  search={search}
                  onSearchChange={(value) => query.set('q', value || undefined)}
                  searchPlaceholder="Search by certificate id, student, course or cohort"
                  values={{ status: status ?? undefined, course: courseFilter ?? undefined, cohort: cohortFilter ?? undefined }}
                  onFilterChange={(key, value) => query.set(key, value)}
                  onClearAll={() => query.clear()}
                  filters={[
                    {
                      key: 'status',
                      label: 'Status',
                      width: 190,
                      options: [
                        { value: 'eligible_not_issued', label: 'Eligible, not issued' },
                        { value: 'issued', label: 'Issued' },
                        { value: 'revoked', label: 'Revoked' },
                        { value: 'superseded', label: 'Superseded' },
                      ],
                    },
                    { key: 'course', label: 'Course', width: 200, options: courses.map((c) => ({ value: c.id, label: c.title })) },
                    { key: 'cohort', label: 'Cohort', width: 150, options: cohorts.map((c) => ({ value: c.id, label: c.code })) },
                  ]}
                />
                <div className="flex items-center gap-3 pb-1">
                  <Switch
                    checked={onlyEligible}
                    onChange={(on) => query.set('filter', on ? 'eligible_not_issued' : undefined)}
                    size="sm"
                    label="Eligible but not issued"
                  />
                  <ColumnPicker
                    catalogue={COLUMN_CATALOGUE}
                    visible={visible}
                    defaultKeys={defaultKeys}
                    onChange={setVisible}
                  />
                </div>
              </div>

              {selected.length > 0 && (
                <div className="px-4 pt-3">
                  <BulkActionBar count={selected.length} itemNoun="certificate" onClearSelection={() => setSelected([])}>
                    <Button
                      size="sm"
                      leftIcon={<Award size={14} />}
                      disabled={issuableSelection.length === 0}
                      onClick={() => setConfirmBulk(true)}
                    >
                      Issue {issuableSelection.length} eligible
                    </Button>
                  </BulkActionBar>
                </div>
              )}

              {loading ? (
                <div className="p-4">
                  <SkeletonTable rows={10} columns={7} />
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={Award}
                    variant={hasFilters ? 'search' : 'default'}
                    title={hasFilters ? 'No certificates match these filters' : 'No certificate has been earned yet'}
                    message={
                      hasFilters
                        ? 'Loosen a filter, or clear them all.'
                        : 'A certificate needs a completed enrolment that clears every criterion on its course. Until one does, this queue stays empty and no alumnus relationship exists.'
                    }
                    action={
                      hasFilters ? (
                        <Button variant="secondary" onClick={() => query.clear()}>
                          Clear filters
                        </Button>
                      ) : (
                        <Button variant="secondary" onClick={() => navigate('/learn/progress')}>
                          Open progress
                        </Button>
                      )
                    }
                  />
                </div>
              ) : (
                <DataTable
                  data={filtered}
                  columns={columns}
                  rowKey={(row) => row.key}
                  density="compact"
                  stickyHeader
                  minWidth={1280}
                  bordered={false}
                  selectable
                  selectedKeys={selected}
                  onSelectionChange={setSelected}
                  onRowClick={(row) => setOpenKey(row.key)}
                  activeRowKey={open?.key}
                  caption="Certificates with their student, course, cohort, eligibility and status"
                />
              )}
            </CardBody>
          </Card>
        </>
      )}

      {/* ---- The record, its criteria and its actions ---------------------- */}
      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenKey(null)}
        size="lg"
        title={open ? open.publicId : 'Certificate'}
        description={open ? `${personName(open.personId)} · ${courseTitle(open.courseId)} · ${cohortCode(open.cohortId)}` : undefined}
      >
        {open && (
          <div className="space-y-5">
            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Issued">
                {open.issuedAt ? `${formatDate(open.issuedAt)} by ${userName(open.issuedByUserId)}` : 'Not issued'}
              </KeyValue>
              <KeyValue label="Verification">
                {open.verificationUrl ? (
                  <span className="font-mono text-body-12">{open.verificationUrl}</span>
                ) : (
                  'Allocated on issue'
                )}
              </KeyValue>
              <KeyValue label="Outcome record">
                {open.outcomeRecordId ? (
                  <Link
                    className="text-accent underline underline-offset-2"
                    to={`/outcomes/records/${open.outcomeRecordId}`}
                  >
                    Opened — view in Outcomes
                  </Link>
                ) : (
                  'Not opened'
                )}
              </KeyValue>
            </KeyValueList>

            {open.certificate?.status === 'revoked' && open.certificate.revokedReason && (
              <Alert tone="danger" icon={ShieldX} title="This certificate has been revoked">
                {open.certificate.revokedReason} The verification page still resolves, and says revoked — that is what
                makes the public checker worth anything.
              </Alert>
            )}

            {open.status === 'eligible_not_issued' && open.blockedBy.length > 0 && (
              <Alert tone="warning" title={`Not issuable yet — blocked by ${open.blockedBy.join(', ').toLowerCase()}`}>
                Each criterion below is re-evaluated against this course's rules every time the underlying record
                moves. Nothing here can be ticked off by hand.
              </Alert>
            )}

            <div>
              <h3 className="mb-2 text-label-11 text-text-label">
                {open.status === 'issued' || open.status === 'revoked'
                  ? 'What it was awarded against'
                  : 'Evaluated live against this course’s rules'}
              </h3>
              <div className="rounded-xl border border-border px-3">
                {open.criteria.map((c) => (
                  <CriterionRow
                    key={c.criterion}
                    criterion={c.criterion}
                    required={c.required}
                    actual={c.actual}
                    met={c.met}
                    note={
                      c.criterion === 'Financial clearance' && !c.met
                        ? 'Financial clearance is a course rule. Issuing anyway needs an approval request, not a checkbox here.'
                        : undefined
                    }
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {isIssuable(open) && (
                <Button leftIcon={<Award size={16} />} onClick={() => setConfirmIssue(open)}>
                  Issue certificate
                </Button>
              )}
              {open.status === 'issued' && (
                <Button
                  variant="secondary"
                  leftIcon={<ShieldX size={16} />}
                  onClick={() => {
                    setRevoking(open)
                    setRevokeReason('')
                    setRevokeTouched(false)
                  }}
                >
                  Revoke
                </Button>
              )}
              {open.verificationUrl && (
                <>
                  <Button variant="secondary" leftIcon={<Copy size={16} />} onClick={() => copyLink(open)}>
                    Copy link
                  </Button>
                  <Button variant="secondary" leftIcon={<QrCode size={16} />} onClick={() => setQrFor(open)}>
                    QR
                  </Button>
                </>
              )}
              {open.status === 'issued' && (
                <Button
                  variant="ghost"
                  leftIcon={<Download size={16} />}
                  onClick={() =>
                    learnToast.info(
                      'Certificate PDF',
                      'Rendered from the course’s certificate template. No file is generated in this prototype.',
                    )
                  }
                >
                  Download PDF
                </Button>
              )}
              <Button variant="ghost" asChild>
                <Link to={`/learn/courses/${open.courseId}/certificate`}>Course rules</Link>
              </Button>
            </div>
          </div>
        )}
      </Drawer>

      {/* ---- Issue, with the criteria restated -------------------------- */}
      <ConfirmDialog
        open={confirmIssue !== null}
        onClose={() => setConfirmIssue(null)}
        title={confirmIssue ? `Issue ${confirmIssue.publicId === 'Not yet allocated' ? 'a certificate' : confirmIssue.publicId}?` : ''}
        confirmLabel="Issue certificate"
        icon={Award}
        size="lg"
        onConfirm={() => {
          if (confirmIssue) runIssue(confirmIssue)
        }}
      >
        {confirmIssue && (
          <div className="space-y-4">
            <p className="text-body-13 text-text-secondary">
              {personName(confirmIssue.personId)} on {courseTitle(confirmIssue.courseId)}, cohort{' '}
              {cohortCode(confirmIssue.cohortId)}. Issuing is not reversible by editing — a mistake is revoked with a
              reason and stays on the record.
            </p>
            <div className="rounded-xl border border-border px-3">
              {confirmIssue.criteria.map((c) => (
                <CriterionRow key={c.criterion} criterion={c.criterion} required={c.required} actual={c.actual} met={c.met} />
              ))}
            </div>
            <Alert tone="info" title="This will also">
              Add an alumnus relationship, open an outcome record with 3, 6 and 12-month follow-ups, queue a review
              request and draft a graduation proof asset with consent pending.
            </Alert>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirmBulk}
        onClose={() => setConfirmBulk(false)}
        title={`Issue ${issuableSelection.length} ${issuableSelection.length === 1 ? 'certificate' : 'certificates'}?`}
        confirmLabel="Issue them"
        icon={Award}
        confirmDisabled={issuableSelection.length === 0}
        onConfirm={runBulkIssue}
      >
        <div className="space-y-3">
          <p className="text-body-13 text-text-secondary">
            Each one runs the same cascade: alumnus relationship, outcome record with its checkpoints, review request
            and a drafted proof asset. Anything blocked on financial clearance is skipped and stays in the queue.
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border p-3">
            {issuableSelection.map((row) => (
              <li key={row.key} className="text-body-13 text-text">
                {personName(row.personId)} · {courseTitle(row.courseId)}
              </li>
            ))}
          </ul>
        </div>
      </ConfirmDialog>

      {/* ---- Revoke, reason required ------------------------------------ */}
      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        title={revoking ? `Revoke ${revoking.publicId}?` : ''}
        description="The row is never removed. The public verification page keeps resolving and reports it as revoked."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setRevokeTouched(true)
                if (!revoking || revokeReason.trim().length < 8) return
                revokeCertificate(revoking.certificate?.id ?? revoking.key, revokeReason.trim())
                learnToast.success(
                  'Certificate revoked',
                  'The alumnus relationship was end-dated and the outcome record closed with the same reason.',
                )
                setRevoking(null)
                setOpenKey(null)
              }}
            >
              Revoke certificate
            </Button>
          </>
        }
      >
        <Field
          label="Reason"
          required
          id="revoke-reason"
          hint="Written to the audit log and shown on the certificate record. Eight characters minimum."
          error={revokeTouched && revokeReason.trim().length < 8 ? 'A revocation without a stated reason is not auditable.' : undefined}
        >
          <Textarea
            id="revoke-reason"
            rows={3}
            value={revokeReason}
            onChange={(e) => setRevokeReason(e.target.value)}
            invalid={revokeTouched && revokeReason.trim().length < 8}
          />
        </Field>
      </Modal>

      {/* ---- QR ---------------------------------------------------------- */}
      <Modal
        open={qrFor !== null}
        onClose={() => setQrFor(null)}
        size="sm"
        title={qrFor ? qrFor.publicId : ''}
        description={qrFor ? `Encodes ${qrFor.verificationUrl}` : undefined}
      >
        {qrFor && (
          <div className="flex flex-col items-center gap-4">
            <QrPattern payload={qrFor.verificationUrl} />
            <p className="text-center font-mono text-body-13 text-text">{qrFor.verificationUrl}</p>
            <p className="text-center text-body-12 text-text-secondary">
              Printed on the certificate. Scanning it lands on the public verification page, which shows only the
              holder, the course, the issue date and the issuing branch.
            </p>
          </div>
        )}
      </Modal>

      {/* ---- What the cascade produced ---------------------------------- */}
      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={issued ? `${issued.certificate.certificateId} issued` : ''}
        description={issued ? `${personName(issued.certificate.personId)} is now an alumnus.` : undefined}
        footer={<Button onClick={() => setIssued(null)}>Close</Button>}
      >
        {issued && (
          <ul className="space-y-2">
            {issued.cascade.map((item) => (
              <li key={item.label} className="flex items-start gap-3 rounded-xl border border-border px-3 py-2.5">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-fill text-success-ink">
                  <Check size={13} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body-13 font-medium text-text">{item.label}</div>
                  <div className="text-body-12 text-text-secondary">{item.ref}</div>
                </div>
                <Button size="sm" variant="link" asChild>
                  <Link to={item.to}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </Screen>
  )
}

function isIssuable(row: CertificateRow): boolean {
  return row.status === 'eligible_not_issued' && row.criteria.every((c) => c.met)
}

function CriteriaChips({ criteria }: { criteria: Array<{ criterion: string; met: boolean }> }) {
  if (criteria.length === 0) return <span className="text-body-12 text-text-muted">Not evaluated</span>
  return (
    <div className="flex flex-wrap gap-1">
      {criteria.map((c) => (
        <span
          key={c.criterion}
          title={`${c.criterion} — ${c.met ? 'met' : 'not met'}`}
          className={cn(
            'rounded-sm px-1.5 text-body-12 font-semibold leading-5',
            c.met ? 'bg-success-fill text-success-ink' : 'bg-danger-fill text-danger-ink',
          )}
        >
          {SHORT_CRITERION[c.criterion] ?? c.criterion.slice(0, 3)}
        </span>
      ))}
    </div>
  )
}

const SHORT_CRITERION: Record<string, string> = {
  Attendance: 'Att',
  'Content completion': 'Content',
  Assignments: 'Assign',
  'Project grade': 'Project',
  'Financial clearance': 'Money',
}

function QrPattern({ payload }: { payload: string }) {
  const size = 21
  let hash = 2166136261
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  const isFinder = (r: number, c: number) => {
    const inBox = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7
    return inBox(0, 0) || inBox(0, size - 7) || inBox(size - 7, 0)
  }
  const finderOn = (r: number, c: number) => {
    const lr = r < 7 ? r : r - (size - 7)
    const lc = c < 7 ? c : c - (size - 7)
    const ring = Math.max(Math.abs(lr - 3), Math.abs(lc - 3))
    return ring === 3 || ring <= 1
  }
  const cells: boolean[] = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (isFinder(r, c)) cells.push(finderOn(r, c))
      else cells.push((Math.imul(hash ^ (r * 31 + c * 17), 2654435761) >>> 0 & 0x40) !== 0)
    }
  }
  return (
    <div
      role="img"
      aria-label={`QR pattern encoding ${payload}`}
      className="grid gap-px rounded-xl border border-border bg-surface p-3"
      style={{ gridTemplateColumns: `repeat(${size}, 8px)` }}
    >
      {cells.map((on, i) => (
        <span key={i} className={on ? 'size-2 bg-text' : 'size-2 bg-surface'} />
      ))}
    </div>
  )
}
