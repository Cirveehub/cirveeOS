/**
 * One graduate's outcome record.
 *
 * Three PRD rules are load-bearing on this screen:
 *   1. the record was opened automatically at certification, with checkpoints
 *      already scheduled at 3, 6 and 12 months;
 *   2. income change is shown only where the graduate volunteered it, and is
 *      labelled self-reported wherever it appears;
 *   3. consent is required and recorded before the record is used publicly —
 *      so the consent panel is stated at the top, not buried.
 */
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, CheckCircle2, FileBadge, ShieldCheck, ShieldOff } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  KeyValue,
  KeyValueList,
  SkeletonCard,
  SkeletonText,
  Timeline,
  type TimelineItem,
} from '@/ui'
import { TODAY, outcomeRecordsCollection, useCollection } from '@/mocks'

import {
  CHANNEL_LABEL,
  CHECKPOINT_STATUS_LABEL,
  CHECKPOINT_STATUS_TONE,
  ErrorPanel,
  ModuleHeader,
  OUTCOME_TYPE_LABEL,
  RELEVANCE_LABEL,
  Screen,
  monthsBetween,
  outcomeTypeTone,
  useCertificateRef,
  useCohortCode,
  useCourseTitle,
  useEmployerName,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'

export default function OutcomeRecordDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()

  const allRecords = useCollection(outcomeRecordsCollection)
  const { loading, error, rows: records, retry } = useModuleData(allRecords, 'outcomes.record')

  const personName = usePersonName()
  const courseTitle = useCourseTitle()
  const cohortCode = useCohortCode()
  const employerName = useEmployerName()
  const certificateRef = useCertificateRef()
  const userName = useUserName()

  const record = records.find((r) => r.id === id) ?? null

  const checkpointItems: TimelineItem[] = useMemo(() => {
    if (!record) return []
    return [...record.checkpoints]
      .sort((a, b) => a.month - b.month)
      .map((checkpoint) => ({
        id: `cp-${checkpoint.month}`,
        title: `${checkpoint.month} month checkpoint`,
        description: (
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={CHECKPOINT_STATUS_TONE[checkpoint.status]} size="sm">
              {CHECKPOINT_STATUS_LABEL[checkpoint.status]}
            </Badge>
            <span className="text-body-13 text-text-secondary">
              Due {formatDate(checkpoint.dueDate)}
            </span>
          </span>
        ),
        detail: (
          <span className="text-body-13 text-text-secondary">
            {formatNumber(checkpoint.attempts)}{' '}
            {checkpoint.attempts === 1 ? 'attempt' : 'attempts'}
            {checkpoint.lastChannel ? ` · last by ${CHANNEL_LABEL[checkpoint.lastChannel]}` : ''}
            {checkpoint.respondedAt ? ` · answered ${formatDateTime(checkpoint.respondedAt)}` : ''}
          </span>
        ),
        icon:
          checkpoint.status === 'responded'
            ? CheckCircle2
            : checkpoint.status === 'scheduled'
              ? CalendarClock
              : undefined,
        tone:
          checkpoint.status === 'responded'
            ? 'success'
            : checkpoint.status === 'no_response'
              ? 'danger'
              : checkpoint.status === 'sent'
                ? 'info'
                : 'neutral',
      }))
  }, [record])

  const header = (
    <ModuleHeader
      title={record ? personName(record.personId) : 'Outcome record'}
      description={
        record
          ? `${courseTitle(record.courseId)} · ${cohortCode(record.cohortId)} · graduated ${formatDate(record.graduatedAt)}`
          : 'One graduate, from certification to the twelve-month checkpoint.'
      }
      actions={
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<ArrowLeft size={16} />}
          onClick={() => navigate('/outcomes/graduates')}
        >
          All graduates
        </Button>
      }
    />
  )

  if (error) {
    return (
      <Screen>
        {header}
        <ErrorPanel onRetry={retry} what="This outcome record" />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        {header}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-6 xl:col-span-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonText lines={8} />
        </div>
      </Screen>
    )
  }

  if (!record) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={FileBadge}
          title="No outcome record with that reference"
          message="It may have been opened under a different certificate, or the link is stale. The graduate list holds every record that exists."
          action={
            <Button size="sm" asChild>
              <Link to="/outcomes/graduates">Open the graduate list</Link>
            </Button>
          }
        />
      </Screen>
    )
  }

  const income = record.incomeChange
  const consentGranted = record.consentForPublicUse

  return (
    <Screen>
      {header}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge tone={outcomeTypeTone(record.outcomeType)}>{OUTCOME_TYPE_LABEL[record.outcomeType]}</Badge>
        <Badge tone="neutral" icon={<FileBadge size={12} />}>
          {certificateRef(record.certificateId)}
        </Badge>
        <Badge tone={consentGranted ? 'success' : 'neutral'} icon={consentGranted ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}>
          {consentGranted ? 'Consented for public use' : 'No consent for public use'}
        </Badge>
        <span className="text-body-13 text-text-secondary">
          {monthsBetween(record.graduatedAt, TODAY).toFixed(1)} months since graduation
        </span>
      </div>

      {!consentGranted && (
        <Alert tone="warning" icon={ShieldOff} title="This record may not be used publicly">
          Consent has not been captured. Nothing here may appear in a testimonial, a proof asset, a
          placement claim or a marketing figure until the graduate has given it and the date has been
          recorded. It still counts in the internal placement rate.
        </Alert>
      )}

      <div className={`grid gap-6 xl:grid-cols-3 ${consentGranted ? '' : 'mt-6'}`}>
        <div className="space-y-6 xl:col-span-2">
          <Card>
            <CardHeader
              title="Outcome"
              description="What the graduate is doing now, and how close it sits to what they were taught."
            />
            <CardBody>
              <KeyValueList columns={2}>
                <KeyValue label="Outcome type">
                  <Badge tone={outcomeTypeTone(record.outcomeType)} size="sm">
                    {OUTCOME_TYPE_LABEL[record.outcomeType]}
                  </Badge>
                </KeyValue>
                <KeyValue label="Employer">
                  {record.employerId ? (
                    <Link
                      to="/outcomes/employers"
                      className="text-accent underline-offset-2 hover:underline"
                    >
                      {employerName(record.employerId)}
                    </Link>
                  ) : (
                    'No employer recorded'
                  )}
                </KeyValue>
                <KeyValue label="Job title">{record.jobTitle ?? 'Not recorded'}</KeyValue>
                <KeyValue
                  label="Start date"
                  hint={
                    record.placementDate
                      ? `${monthsBetween(record.graduatedAt, record.placementDate).toFixed(1)} months after graduation`
                      : undefined
                  }
                >
                  {record.placementDate ? formatDate(record.placementDate) : 'Not placed'}
                </KeyValue>
                <KeyValue label="Location">{record.location ?? 'Not recorded'}</KeyValue>
                <KeyValue
                  label="Relevance to course"
                  hint="How closely the role uses what was taught"
                >
                  {record.relevanceToCourse ? RELEVANCE_LABEL[record.relevanceToCourse] : 'Not assessed'}
                </KeyValue>
                <KeyValue label="Course">{courseTitle(record.courseId)}</KeyValue>
                <KeyValue label="Cohort">{cohortCode(record.cohortId)}</KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Income change"
              description="Volunteered by the graduate. Never asked for as a condition of the follow-up, and never verified."
              actions={<Badge tone="warning">Self-reported, volunteered</Badge>}
            />
            <CardBody>
              {income === null ? (
                <EmptyState
                  size="sm"
                  bordered
                  title="No income figure volunteered"
                  message="The follow-up asks whether the graduate would like to share an income change. This one did not, and that is a complete answer — the outcome still counts."
                />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl bg-surface-sunken px-4 py-3">
                      <p className="text-label-11 text-text-label">Before</p>
                      <p className="mt-1 text-heading-18 tabular-nums text-text">
                        {income.before === null ? 'Not shared' : formatNaira(income.before)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-sunken px-4 py-3">
                      <p className="text-label-11 text-text-label">After</p>
                      <p className="mt-1 text-heading-18 tabular-nums text-text">
                        {income.after === null ? 'Not shared' : formatNaira(income.after)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-surface-sunken px-4 py-3">
                      <p className="text-label-11 text-text-label">Change</p>
                      <p className="mt-1 text-heading-18 tabular-nums text-text">
                        {income.before === null || income.after === null
                          ? 'Cannot be computed'
                          : formatNaira(income.after - income.before)}
                      </p>
                    </div>
                  </div>
                  <p className="text-body-13 text-text-secondary">
                    Self-reported by the graduate and volunteered without being asked. This figure has
                    not been verified against a payslip or a contract, and must carry the
                    self-reported label anywhere it is published.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Notes" description="What the follow-up conversation actually established." />
            <CardBody>
              {record.notes.trim() === '' ? (
                <p className="text-body-13 text-text-secondary">No notes recorded against this record.</p>
              ) : (
                <p className="text-body-14 text-text">{record.notes}</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Checkpoints"
              description="Opened automatically at certification, at 3, 6 and 12 months."
            />
            <CardBody>
              <Timeline items={checkpointItems} timeFormat="absolute" />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Consent" description="Required before this record is used publicly." />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Public use">
                  <Badge tone={consentGranted ? 'success' : 'neutral'} size="sm">
                    {consentGranted ? 'Granted' : 'Not granted'}
                  </Badge>
                </KeyValue>
                <KeyValue label="Captured on">
                  {record.consentCapturedAt ? formatDateTime(record.consentCapturedAt) : 'Not captured'}
                </KeyValue>
                <KeyValue label="Captured how">
                  {consentGranted
                    ? 'Follow-up conversation, confirmed in writing'
                    : 'Not captured — no permission on file'}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Provenance" description="Where this record came from and who checked it." />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Certificate">
                  <span className="font-mono text-body-13">{certificateRef(record.certificateId)}</span>
                </KeyValue>
                <KeyValue label="Opened" hint="Automatically, at certification">
                  {formatDateTime(record.createdAt)}
                </KeyValue>
                <KeyValue label="Verified by">
                  {record.verifiedByUserId ? userName(record.verifiedByUserId) : 'Not yet verified'}
                </KeyValue>
                <KeyValue label="Last updated">{formatDateTime(record.updatedAt)}</KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>
        </div>
      </div>
    </Screen>
  )
}
