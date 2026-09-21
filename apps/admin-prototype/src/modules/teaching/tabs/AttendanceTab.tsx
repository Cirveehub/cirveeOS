/**
 * Attendance — taking a register, in the legacy's shape and under Cirvee OS's
 * rules.
 *
 * Legacy layout: pick the class, a table of students with a control per row,
 * "mark all present", one save. That is kept.
 *
 * Three things the legacy register never had, all of them real here:
 *
 *  1. **The policy in force is read, not assumed.** Grace, late-after and
 *     absent-after come from the active `attendance` policy version in
 *     `policyVersionsCollection`, so raising the grace period in Settings
 *     changes what this screen tells the tutor.
 *  2. **The non-negotiable is stated on the screen.** PRD §7: the consequence
 *     engine exists and ships with `financialConsequenceEnabled = false`. A
 *     tutor marking somebody absent is not touching their bill, and the screen
 *     says so rather than leaving them to guess.
 *  3. **Changing a recorded state is an override.** It needs a reason and it
 *     emits an audit event carrying the previous state beside the new one.
 *     That write is `recordAttendance` — Academy operations' implementation,
 *     re-used rather than re-invented, so there is one version of the rule.
 */
import { useEffect, useMemo, useState } from 'react'
import { CheckCheck, ClipboardCheck, ShieldCheck } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  ProgressBar,
  Select,
  StatusBadge,
  Textarea,
  type Column,
} from '@/ui'
import {
  TODAY,
  studentAttendanceCollection,
  useCollection,
  type ClassSession,
  type Cohort,
  type Enrollment,
  type StudentAttendance,
  type StudentAttendanceState,
  type UserId,
} from '@/mocks'

import { TeachingCard, personName } from '../shared'
import { activeAttendancePolicy, recordAttendance, type AttendanceEntry } from '../writes'

/** `''` means "leave this student unrecorded" — the safe default. */
type DraftState = StudentAttendanceState | ''

const STATE_OPTIONS: Array<{ value: DraftState; label: string }> = [
  { value: '', label: 'Not recorded' },
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'excused', label: 'Excused' },
]

const SOURCE_LABEL: Record<string, string> = {
  nfc_tap: 'NFC tap',
  qr: 'QR',
  tutor_manual: 'Tutor',
  kiosk: 'Kiosk',
}

interface RegisterRow {
  enrolment: Enrollment
  name: string
  existing: StudentAttendance | undefined
  draft: DraftState
}

export default function AttendanceTab({
  cohort,
  enrolments,
  sessions,
  actorUserId,
}: {
  cohort: Cohort
  enrolments: Enrollment[]
  sessions: ClassSession[]
  actorUserId: UserId
}) {
  const attendance = useCollection(studentAttendanceCollection)
  const policy = useMemo(() => activeAttendancePolicy(), [])

  const openSessions = useMemo(
    () => sessions.filter((s) => s.status !== 'cancelled').sort((a, b) => a.sequence - b.sequence),
    [sessions],
  )

  /* Today's class if there is one, otherwise the most recent one that has
     already happened — a tutor opening this tab is nearly always here to mark
     the class they just taught. */
  const defaultSessionId = useMemo(() => {
    const today = openSessions.find((s) => s.date === TODAY)
    if (today) return today.id
    const past = openSessions.filter((s) => s.date <= TODAY)
    return (past[past.length - 1] ?? openSessions[0])?.id ?? ''
  }, [openSessions])

  const [sessionId, setSessionId] = useState<string>(defaultSessionId)
  const [draft, setDraft] = useState<Record<string, DraftState>>({})
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    setSessionId((current) => (current ? current : defaultSessionId))
  }, [defaultSessionId])

  const session = openSessions.find((s) => s.id === sessionId)

  const sessionAttendance = useMemo(
    () => attendance.filter((a) => a.sessionId === sessionId),
    [attendance, sessionId],
  )

  /* Reset the draft whenever the chosen session changes, so a tutor never
     saves one class's marks against another's. */
  useEffect(() => {
    const next: Record<string, DraftState> = {}
    for (const enrolment of enrolments) {
      next[enrolment.id] = sessionAttendance.find((a) => a.enrollmentId === enrolment.id)?.state ?? ''
    }
    setDraft(next)
    setReason('')
    setTouched(false)
    setNotice(null)
    setFailure(null)
    // Deliberately keyed on the session alone. Re-running whenever the
    // attendance collection changes would wipe marks the tutor has made but
    // not saved — and it changes the moment they do save.
  }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo<RegisterRow[]>(
    () =>
      enrolments
        .filter((e) => e.status === 'active')
        .map((enrolment) => ({
          enrolment,
          name: personName(enrolment.personId),
          existing: sessionAttendance.find((a) => a.enrollmentId === enrolment.id),
          draft: draft[enrolment.id] ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [enrolments, sessionAttendance, draft],
  )

  const newMarks = rows.filter((r) => r.draft !== '' && !r.existing)
  const overrides = rows.filter((r) => r.draft !== '' && r.existing && r.existing.state !== r.draft)
  const changeCount = newMarks.length + overrides.length

  const reasonError =
    touched && overrides.length > 0 && reason.trim().length < 8
      ? 'A correction to a recorded state is not auditable without a stated reason.'
      : undefined

  function markAllPresent() {
    setDraft((prev) => {
      const next = { ...prev }
      for (const row of rows) next[row.enrolment.id] = 'present'
      return next
    })
  }

  function save() {
    setTouched(true)
    setFailure(null)
    if (!session || changeCount === 0) return
    if (overrides.length > 0 && reason.trim().length < 8) return

    const entries: AttendanceEntry[] = [...newMarks, ...overrides].map((row) => ({
      enrollmentId: row.enrolment.id,
      personId: row.enrolment.personId,
      state: row.draft as StudentAttendanceState,
      overrideReason: row.existing ? reason.trim() : undefined,
    }))

    try {
      const result = recordAttendance(session.id, entries, 'tutor_manual')
      setNotice(
        `${formatNumber(result.created)} recorded and ${formatNumber(result.overridden)} corrected on ${session.sequence}. ${session.topic}.` +
          (result.overridden > 0 ? ' Each correction is in the audit log with the previous state.' : ''),
      )
      setReason('')
      setTouched(false)
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The register could not be saved.')
    }
  }

  const columns: Array<Column<RegisterRow>> = [
    {
      key: 'student',
      header: 'Student',
      pinned: true,
      minWidth: 220,
      accessor: (row) => row.name,
      sortValue: (row) => row.name,
      sortable: true,
    },
    {
      key: 'recorded',
      header: 'On record',
      width: 190,
      cell: (row) =>
        row.existing ? (
          <span className="flex items-center gap-2">
            <StatusBadge status={row.existing.state} size="sm" />
            <span className="text-body-12 text-text-muted">
              {SOURCE_LABEL[row.existing.source] ?? row.existing.source}
            </span>
          </span>
        ) : (
          <span className="text-body-13 text-text-muted">Nothing yet</span>
        ),
      sortValue: (row) => row.existing?.state ?? '',
      sortable: true,
    },
    {
      key: 'mark',
      header: 'Mark',
      width: 190,
      cell: (row) => (
        <Select
          selectSize="sm"
          aria-label={`Attendance for ${row.name}`}
          value={row.draft}
          options={STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          onChange={(e) =>
            setDraft((prev) => ({ ...prev, [row.enrolment.id]: e.target.value as DraftState }))
          }
        />
      ),
    },
    {
      key: 'change',
      header: 'Change',
      minWidth: 200,
      cell: (row) => {
        if (row.draft === '') return <span className="text-body-13 text-text-muted">—</span>
        if (!row.existing) {
          return (
            <Badge tone="accent" variant="subtle" size="sm">
              New mark
            </Badge>
          )
        }
        if (row.existing.state === row.draft) {
          return <span className="text-body-13 text-text-muted">Unchanged</span>
        }
        return (
          <Badge tone="warning" variant="subtle" size="sm">
            Override: {row.existing.state} → {row.draft}
          </Badge>
        )
      },
    },
  ]

  const historyColumns: Array<Column<ClassSession>> = [
    {
      key: 'session',
      header: 'Session',
      pinned: true,
      minWidth: 280,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate text-body-14 text-text">
            {row.sequence}. {row.topic}
          </p>
          <p className="text-body-12 text-text-muted">{formatDate(row.date)}</p>
        </div>
      ),
      sortValue: (row) => row.sequence,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 120,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
      sortValue: (row) => row.status,
      sortable: true,
    },
    {
      key: 'present',
      header: 'Present',
      width: 110,
      align: 'right',
      accessor: (row) => `${row.presentCount}/${row.expectedCount}`,
      sortValue: (row) => row.presentCount,
      sortable: true,
    },
    {
      key: 'rate',
      header: 'Turnout',
      width: 160,
      cell: (row) => {
        const rate = row.expectedCount ? Math.round((row.presentCount / row.expectedCount) * 100) : 0
        return (
          <ProgressBar
            value={rate}
            showValue
            size="sm"
            tone={rate >= 80 ? 'success' : rate >= 60 ? 'warning' : 'danger'}
            aria-label={`Turnout for session ${row.sequence}`}
          />
        )
      },
      sortValue: (row) => (row.expectedCount ? row.presentCount / row.expectedCount : 0),
      sortable: true,
    },
    {
      key: 'action',
      header: '',
      width: 130,
      align: 'right',
      cell: (row) => (
        <Button
          size="sm"
          variant={row.id === sessionId ? 'primary' : 'secondary'}
          onClick={() => setSessionId(row.id)}
        >
          {row.id === sessionId ? 'Marking' : 'Take register'}
        </Button>
      ),
    },
  ]

  if (openSessions.length === 0) {
    return (
      <TeachingCard title="Register" description="No sessions to mark">
        <EmptyState
          icon={ClipboardCheck}
          title="This cohort has no class sessions yet"
          message="Attendance is taken against a scheduled session. Academy operations schedules the timetable."
        />
      </TeachingCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Alert tone="info" icon={ShieldCheck} title="Attendance is a teaching signal, not a billing one">
        Policy version {policy.version} is in force: {policy.graceMinutes} minutes of grace, late after{' '}
        {policy.lateAfterMinutes} minutes, absent after {policy.absentAfterMinutes}.{' '}
        {policy.financialConsequenceEnabled
          ? 'A financial consequence is enabled on this policy.'
          : 'No consequence is financial — repeated absence raises an advisory flag for the advisor, and nothing else.'}{' '}
        Correcting a state the system already recorded is an override: it needs a reason and it goes to
        the audit log with the previous state beside the new one.
      </Alert>

      {notice && (
        <Alert tone="success" title="Register saved" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {failure && (
        <Alert tone="danger" title="The register was not saved" onDismiss={() => setFailure(null)}>
          {failure}
        </Alert>
      )}

      <TeachingCard
        title="Register"
        description={
          session
            ? `${session.sequence}. ${session.topic} · ${formatDate(session.date)} · ${session.startTime}–${session.endTime}`
            : 'Pick a session'
        }
        action={
          <div className="flex items-center gap-2">
            <Select
              selectSize="sm"
              aria-label="Session to mark"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              options={openSessions.map((s) => ({
                value: s.id,
                label: `${s.sequence}. ${s.topic.slice(0, 38)} — ${formatDate(s.date)}`,
              }))}
              containerClassName="w-72"
            />
            <Button size="sm" variant="secondary" leftIcon={<CheckCheck size={14} />} onClick={markAllPresent}>
              Mark all present
            </Button>
            <Button size="sm" onClick={save} disabled={changeCount === 0}>
              Save register
            </Button>
          </div>
        }
      >
        <DataTable
          data={rows}
          columns={columns}
          rowKey={(row) => row.enrolment.id}
          bordered={false}
          minWidth={900}
          density="compact"
          caption={`Register for session ${session?.sequence ?? ''}`}
          empty={
            <EmptyState
              icon={ClipboardCheck}
              title="Nobody is enrolled on this cohort"
              message="There is nobody to mark until students are enrolled."
            />
          }
        />

        <div className="border-t border-border px-6 py-4">
          {overrides.length > 0 ? (
            <Field
              label={`Reason for ${overrides.length} correction${overrides.length === 1 ? '' : 's'}`}
              required
              error={reasonError}
              hint="Eight characters minimum. Stored on each corrected record and in the audit log."
              id="register-reason"
            >
              <Textarea
                id="register-reason"
                rows={2}
                value={reason}
                invalid={Boolean(reasonError)}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Cards were left at home; I confirmed both students in the room."
              />
            </Field>
          ) : (
            <p className="text-body-13 text-text-secondary">
              {changeCount === 0
                ? 'Nothing to save yet. Mark a student, or use "Mark all present".'
                : `${formatNumber(changeCount)} new mark${changeCount === 1 ? '' : 's'} ready to save. No reason is needed — none of these overwrites an existing record.`}
            </p>
          )}
        </div>
      </TeachingCard>

      <TeachingCard
        title="Attendance by session"
        description={`Cohort rate ${cohort.attendanceRate}% across ${formatNumber(openSessions.length)} sessions`}
      >
        <DataTable
          data={openSessions}
          columns={historyColumns}
          rowKey={(row) => row.id}
          bordered={false}
          minWidth={960}
          density="compact"
          activeRowKey={sessionId}
          caption="Sessions on this cohort with turnout"
        />
      </TeachingCard>
    </div>
  )
}
