import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, ClipboardList, Video } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  ColumnPicker,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PageHeader,
  Select,
  StatusBadge,
  TableToolbar,
  Textarea,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  CURRENT_USER_ID,
  TODAY,
  addDays,
  candidatesCollection,
  interviewsCollection,
  jobOpeningsCollection,
  scorecardsCollection,
  useCollection,
} from '@/mocks'
import type { CandidateId, HireRecommendation, Interview, InterviewId, InterviewType, Mode, UserId } from '@/mocks'

import {
  INTERVIEW_TYPE_LABEL,
  PeopleGroupTabs,
  Page,
  RECOMMENDATION_LABEL,
  ScreenError,
  isClosedStage,
  personName,
  useScreenState,
  userName,
} from './shared'
import { averageOf, scheduleInterview, setInterviewOutcome, staffOptions, submitScorecard } from './writes'

const TYPES: InterviewType[] = ['screening', 'technical', 'panel', 'final']

const COMPETENCIES = ['Technical depth', 'Communication', 'Ownership', 'Learning agility', 'Culture add']

const RECOMMENDATIONS: HireRecommendation[] = ['strong_hire', 'hire', 'no_decision', 'no_hire', 'strong_no_hire']

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'when', label: 'Date and time', defaultVisible: true, locked: true },
  { key: 'candidate', label: 'Candidate', defaultVisible: true },
  { key: 'role', label: 'Role', defaultVisible: true },
  { key: 'type', label: 'Type', defaultVisible: true },
  { key: 'interviewers', label: 'Interviewers', defaultVisible: false },
  { key: 'mode', label: 'Mode', defaultVisible: false },
  { key: 'where', label: 'Location or link', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'outcome', label: 'Outcome', defaultVisible: true },
  { key: 'scorecards', label: 'Scorecards submitted', defaultVisible: true },
]

export default function Interviews() {
  const state = useScreenState()

  const interviews = useCollection(interviewsCollection)
  const candidates = useCollection(candidatesCollection)
  const openings = useCollection(jobOpeningsCollection)
  const scorecards = useCollection(scorecardsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [thisWeekOnly, setThisWeekOnly] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [scoring, setScoring] = useState<Interview | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const candidateOf = (id: CandidateId) => candidates.find((c) => c.id === id)
  const roleOf = (id: CandidateId) => {
    const candidate = candidateOf(id)
    return candidate ? (openings.find((o) => o.id === candidate.openingId)?.title ?? 'Opening withdrawn') : '—'
  }
  const submittedFor = (interview: Interview) =>
    scorecards.filter((s) => s.interviewId === interview.id && s.submittedAt !== null).length

  const weekEnd = addDays(TODAY, 7)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return interviews
      .filter((interview) => {
        if (filters.type && interview.type !== filters.type) return false
        if (filters.status && interview.status !== filters.status) return false
        if (thisWeekOnly) {
          const day = interview.scheduledAt.slice(0, 10)
          if (day < TODAY || day > weekEnd) return false
        }
        if (!term) return true
        const candidate = candidateOf(interview.candidateId)
        return (
          (candidate ? personName(candidate.personId).toLowerCase().includes(term) : false) ||
          roleOf(interview.candidateId).toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt))
  }, [interviews, filters, search, thisWeekOnly, candidates, openings]) // eslint-disable-line react-hooks/exhaustive-deps

  const open = openId ? (interviews.find((i) => i.id === openId) ?? null) : null
  const filtered = Boolean(search) || Object.values(filters).some(Boolean) || thisWeekOnly

  const allColumns: Record<string, Column<Interview>> = {
    when: {
      key: 'when',
      header: 'Date and time',
      pinned: true,
      width: 195,
      accessor: (row) => formatDateTime(row.scheduledAt),
      sortValue: (row) => row.scheduledAt,
      sortable: true,
    },
    candidate: {
      key: 'candidate',
      header: 'Candidate',
      minWidth: 180,
      accessor: (row) => {
        const candidate = candidateOf(row.candidateId)
        return candidate ? personName(candidate.personId) : 'Candidate withdrawn'
      },
      sortValue: (row) => {
        const candidate = candidateOf(row.candidateId)
        return candidate ? personName(candidate.personId) : ''
      },
      sortable: true,
    },
    role: { key: 'role', header: 'Role', minWidth: 190, accessor: (row) => roleOf(row.candidateId), sortValue: (row) => roleOf(row.candidateId), sortable: true },
    type: { key: 'type', header: 'Type', width: 126, accessor: (row) => INTERVIEW_TYPE_LABEL[row.type] ?? row.type, sortValue: (row) => row.type, sortable: true },
    interviewers: {
      key: 'interviewers',
      header: 'Interviewers',
      minWidth: 230,
      accessor: (row) => row.interviewerUserIds.map((u) => userName(u)).join(', '),
      sortValue: (row) => row.interviewerUserIds.length,
      sortable: true,
    },
    mode: {
      key: 'mode',
      header: 'Mode',
      width: 118,
      accessor: (row) => (row.mode === 'on_campus' ? 'On campus' : row.mode === 'virtual' ? 'Virtual' : 'Hybrid'),
      sortValue: (row) => row.mode,
      sortable: true,
    },
    where: {
      key: 'where',
      header: 'Location or link',
      minWidth: 220,
      accessor: (row) =>
        row.meetingUrl ? (
          <span className="inline-flex items-center gap-1.5 text-body-12">
            <Video size={14} aria-hidden="true" />
            {row.meetingUrl}
          </span>
        ) : (
          (row.location ?? <span className="text-text-secondary">Not set</span>)
        ),
      sortValue: (row) => row.location ?? row.meetingUrl ?? '',
    },
    status: { key: 'status', header: 'Status', width: 126, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    outcome: {
      key: 'outcome',
      header: 'Outcome',
      width: 130,
      cell: (row) =>
        row.outcome === null ? (
          <span className="text-body-13 text-text-secondary">Not recorded</span>
        ) : (
          <Badge tone={row.outcome === 'advance' ? 'success' : row.outcome === 'reject' ? 'danger' : 'warning'} size="sm">
            {row.outcome === 'advance' ? 'Advance' : row.outcome === 'reject' ? 'Reject' : 'Hold'}
          </Badge>
        ),
      sortValue: (row) => row.outcome ?? '',
      sortable: true,
    },
    scorecards: {
      key: 'scorecards',
      header: 'Scorecards submitted',
      align: 'right',
      width: 186,
      accessor: (row) => {
        const done = submittedFor(row)
        const total = row.interviewerUserIds.length
        return <span className={`tabular-nums ${done < total && row.status === 'completed' ? 'text-warning-text' : ''}`}>{`${formatNumber(done)} of ${formatNumber(total)}`}</span>
      },
      sortValue: (row) => submittedFor(row) - row.interviewerUserIds.length,
      sortable: true,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)
  const openCandidate = open ? candidateOf(open.candidateId) : undefined
  const openScorecards = open ? scorecards.filter((s) => s.interviewId === open.id) : []
  const liveCandidates = candidates.filter((c) => !isClosedStage(c.stage))

  return (
    <Page>
      <PageHeader
        title="Interviews"
        description="Every round scheduled and held, and whether the panel has actually written its scorecards up afterwards."
        actions={
          <Button leftIcon={<CalendarPlus size={16} aria-hidden="true" />} onClick={() => setScheduling(true)} disabled={liveCandidates.length === 0}>
            Schedule an interview
          </Button>
        }
      />

      <PeopleGroupTabs group="hiring" active="interviews" />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title={notice} className="mb-6" onDismiss={() => setNotice(null)} />
      )}

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by candidate or role"
              values={filters}
              onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setThisWeekOnly(false)
              }}
              filters={[
                { key: 'type', label: 'Type', options: TYPES.map((t) => ({ value: t, label: INTERVIEW_TYPE_LABEL[t] })) },
                {
                  key: 'status',
                  label: 'Status',
                  options: [
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' },
                    { value: 'no_show', label: 'No show' },
                  ],
                },
              ]}
              right={<ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />}
            >
              <Checkbox checked={thisWeekOnly} onChange={(e) => setThisWeekOnly(e.target.checked)} label="Next seven days only" />
            </FilterBar>
          </TableToolbar>

          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => setOpenId(row.id)}
            activeRowKey={open?.id}
            density="compact"
            minWidth={1280}
            bordered={false}
            caption="Interviews with candidate, round, panel, status, outcome and scorecards submitted"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No interviews match these filters"
                  message="Try another round or status, clear the date filter, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                        setThisWeekOnly(false)
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={CalendarPlus}
                  title="No interview has been scheduled"
                  message="Shortlisted candidates who are never interviewed quietly age out of the pipeline. Scheduling a round is what starts the clock on a decision."
                  action={
                    <Button size="sm" onClick={() => setScheduling(true)} disabled={liveCandidates.length === 0}>
                      Schedule an interview
                    </Button>
                  }
                />
              )
            }
          />
        </CardBody>
      </Card>

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open && openCandidate ? personName(openCandidate.personId) : 'Interview'}
        description={open ? `${INTERVIEW_TYPE_LABEL[open.type] ?? open.type} · ${formatDateTime(open.scheduledAt)}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Status">
                <StatusBadge status={open.status} />
              </KeyValue>
              <KeyValue label="Outcome">{open.outcome ? <span className="capitalize">{open.outcome}</span> : 'Not recorded'}</KeyValue>
              <KeyValue label="Role">{roleOf(open.candidateId)}</KeyValue>
              <KeyValue label="Duration">{`${formatNumber(open.durationMinutes)} minutes`}</KeyValue>
              <KeyValue label="Panel">{open.interviewerUserIds.map((u) => userName(u)).join(', ')}</KeyValue>
              <KeyValue label="Where">{open.meetingUrl ?? open.location ?? 'Not set'}</KeyValue>
            </KeyValueList>

            {openCandidate && (
              <Button size="sm" variant="secondary" asChild>
                <Link to={`/people/candidates/${openCandidate.id}`}>Open the candidate profile</Link>
              </Button>
            )}

            <div>
              <h3 className="mb-3 text-heading-18">Scorecards</h3>
              {openScorecards.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  size="sm"
                  bordered
                  title="No scorecard yet"
                  message="A round with no scorecard cannot be compared against any other round, so the decision rests on memory."
                  action={
                    <Button size="sm" onClick={() => setScoring(open)}>
                      Record a scorecard
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {openScorecards.map((card) => (
                    <div key={card.id} className="rounded-xl border border-border p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-body-14 font-semibold text-text">{userName(card.interviewerUserId)}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone="neutral" size="sm">{averageOf(card).toFixed(1)} of 5</Badge>
                          <Badge tone={card.recommendation.includes('no') ? 'danger' : 'success'} size="sm">
                            {RECOMMENDATION_LABEL[card.recommendation] ?? card.recommendation}
                          </Badge>
                        </span>
                      </div>
                      <ul className="flex flex-col gap-1.5">
                        {card.competencies.map((competency) => (
                          <li key={competency.name} className="flex items-baseline justify-between gap-3 text-body-13">
                            <span className="text-text-secondary">{competency.name}</span>
                            <span className="tabular-nums text-text">{competency.score} of 5</span>
                          </li>
                        ))}
                      </ul>
                      {card.notes && <p className="mt-3 text-body-12 text-text-secondary">{card.notes}</p>}
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" onClick={() => setScoring(open)}>
                    Add another scorecard
                  </Button>
                </div>
              )}
            </div>

            {open.status !== 'cancelled' && (
              <div className="rounded-xl border border-border p-4">
                <h3 className="mb-3 text-heading-18">Record the outcome</h3>
                <p className="mb-3 text-body-13 text-text-secondary">
                  The outcome closes the round. Moving the candidate along the pipeline is a separate, audited act on their
                  profile — one panel does not silently advance anybody.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setInterviewOutcome(open.id as InterviewId, 'completed', 'advance')
                      setNotice('Outcome recorded as advance.')
                    }}
                  >
                    Advance
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setInterviewOutcome(open.id as InterviewId, 'completed', 'hold')
                      setNotice('Outcome recorded as hold.')
                    }}
                  >
                    Hold
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      setInterviewOutcome(open.id as InterviewId, 'completed', 'reject')
                      setNotice('Outcome recorded as reject.')
                    }}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setInterviewOutcome(open.id as InterviewId, 'no_show', null)
                      setNotice('Recorded as a no show.')
                    }}
                  >
                    No show
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <ScheduleModal
        open={scheduling}
        onClose={() => setScheduling(false)}
        onScheduled={(name) => {
          setScheduling(false)
          setNotice(`Interview scheduled with ${name}.`)
        }}
      />

      <ScorecardModal
        interview={scoring}
        onClose={() => setScoring(null)}
        onSubmitted={() => {
          setScoring(null)
          setNotice('Scorecard submitted. The candidate average recomputed from every scorecard on record.')
        }}
      />
    </Page>
  )
}

function ScheduleModal({
  open,
  onClose,
  onScheduled,
}: {
  open: boolean
  onClose: () => void
  onScheduled: (candidateName: string) => void
}) {
  const candidates = useCollection(candidatesCollection)
  const openings = useCollection(jobOpeningsCollection)

  const [candidateId, setCandidateId] = useState('')
  const [type, setType] = useState<InterviewType>('screening')
  const [date, setDate] = useState(addDays(TODAY, 3))
  const [time, setTime] = useState('10:00')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [mode, setMode] = useState<Mode>('virtual')
  const [location, setLocation] = useState('Bodija Seminar Room')
  const [meetingUrl, setMeetingUrl] = useState('https://meet.cirvee.com/')
  const [panel, setPanel] = useState<string[]>([CURRENT_USER_ID as string])
  const [touched, setTouched] = useState(false)

  const staff = useMemo(() => staffOptions(), [])
  const live = candidates.filter((c) => !isClosedStage(c.stage))

  const errors = {
    candidate: candidateId ? undefined : 'Choose the candidate being interviewed.',
    date: date >= TODAY ? undefined : 'An interview cannot be scheduled into the past.',
    panel: panel.length > 0 ? undefined : 'At least one interviewer has to be on the panel.',
    where:
      mode === 'on_campus' && !location.trim()
        ? 'An on-campus round needs a room.'
        : mode !== 'on_campus' && !meetingUrl.trim()
          ? 'A virtual round needs a link.'
          : undefined,
  }
  const valid = Object.values(errors).every((e) => e === undefined)

  const submit = () => {
    setTouched(true)
    if (!valid || !candidateId) return
    scheduleInterview({
      candidateId: candidateId as CandidateId,
      type,
      date,
      time,
      durationMinutes,
      interviewerUserIds: panel as UserId[],
      mode,
      location,
      meetingUrl,
    })
    const candidate = candidates.find((c) => c.id === candidateId)
    const name = candidate ? personName(candidate.personId) : 'the candidate'
    setCandidateId('')
    setTouched(false)
    onScheduled(name)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule an interview"
      description="One round, one panel, one time. The scorecard comes after."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Schedule</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Candidate" required error={touched ? errors.candidate : undefined}>
          <Select
            value={candidateId}
            invalid={touched && Boolean(errors.candidate)}
            placeholder="Choose a candidate"
            options={live.map((c) => ({
              value: c.id as string,
              label: `${personName(c.personId)} · ${openings.find((o) => o.id === c.openingId)?.title ?? 'Opening withdrawn'}`,
            }))}
            onChange={(e) => setCandidateId(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Round" required>
            <Select
              value={type}
              options={TYPES.map((t) => ({ value: t, label: INTERVIEW_TYPE_LABEL[t] }))}
              onChange={(e) => {
                const next = e.target.value as InterviewType
                setType(next)
                setDurationMinutes(next === 'screening' ? 30 : 60)
              }}
            />
          </Field>
          <Field label="Duration" required>
            <Select
              value={String(durationMinutes)}
              options={[30, 45, 60, 90, 120].map((m) => ({ value: String(m), label: `${m} minutes` }))}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required error={touched ? errors.date : undefined}>
            <Input type="date" value={date} invalid={touched && Boolean(errors.date)} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Start time" required>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>

        <Field label="Mode" required>
          <Select
            value={mode}
            options={[
              { value: 'virtual', label: 'Virtual' },
              { value: 'on_campus', label: 'On campus' },
              { value: 'hybrid', label: 'Hybrid' },
            ]}
            onChange={(e) => setMode(e.target.value as Mode)}
          />
        </Field>

        {mode === 'on_campus' ? (
          <Field label="Room" required error={touched ? errors.where : undefined}>
            <Input value={location} invalid={touched && Boolean(errors.where)} onChange={(e) => setLocation(e.target.value)} />
          </Field>
        ) : (
          <Field label="Meeting link" required error={touched ? errors.where : undefined}>
            <Input value={meetingUrl} invalid={touched && Boolean(errors.where)} onChange={(e) => setMeetingUrl(e.target.value)} />
          </Field>
        )}

        <Field label="Panel" required hint="Each interviewer writes their own scorecard." error={touched ? errors.panel : undefined}>
          <div className="flex flex-col gap-2 rounded-xl border border-border p-3">
            {staff.slice(0, 12).map((member) => (
              <Checkbox
                key={member.value}
                checked={panel.includes(member.value)}
                onChange={() =>
                  setPanel((prev) => (prev.includes(member.value) ? prev.filter((v) => v !== member.value) : [...prev, member.value]))
                }
                label={member.label}
              />
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  )
}

function ScorecardModal({
  interview,
  onClose,
  onSubmitted,
}: {
  interview: Interview | null
  onClose: () => void
  onSubmitted: () => void
}) {
  const [interviewerUserId, setInterviewerUserId] = useState<string>('')
  const [scores, setScores] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>(
    Object.fromEntries(COMPETENCIES.map((c) => [c, 3 as const])),
  )
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [recommendation, setRecommendation] = useState<HireRecommendation>('hire')
  const [summary, setSummary] = useState('')
  const [touched, setTouched] = useState(false)

  const panel = interview ? interview.interviewerUserIds.map((u) => ({ value: u as string, label: userName(u) })) : []
  const effectiveInterviewer = interviewerUserId || (panel[0]?.value ?? '')

  const errors = {
    interviewer: effectiveInterviewer ? undefined : 'Say whose scorecard this is.',
    summary: summary.trim().length >= 10 ? undefined : 'Write at least a sentence. A bare score explains nothing later.',
  }
  const valid = Object.values(errors).every((e) => e === undefined)

  const average = COMPETENCIES.reduce((acc, c) => acc + scores[c], 0) / COMPETENCIES.length

  const submit = () => {
    setTouched(true)
    if (!interview || !valid) return
    submitScorecard({
      interviewId: interview.id as InterviewId,
      interviewerUserId: effectiveInterviewer as UserId,
      competencies: COMPETENCIES.map((name) => ({ name, score: scores[name], note: notes[name] ?? '' })),
      recommendation,
      notes: summary,
    })
    setSummary('')
    setNotes({})
    setTouched(false)
    onSubmitted()
  }

  return (
    <Modal
      open={Boolean(interview)}
      onClose={onClose}
      size="lg"
      title="Record a scorecard"
      description="Score each competency on the same five-point scale everybody else uses, then give one recommendation."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Submit scorecard</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Interviewer" required error={touched ? errors.interviewer : undefined}>
          <Select
            value={effectiveInterviewer}
            invalid={touched && Boolean(errors.interviewer)}
            placeholder="Choose an interviewer"
            options={panel}
            onChange={(e) => setInterviewerUserId(e.target.value)}
          />
        </Field>

        <fieldset className="rounded-xl border border-border p-4">
          <legend className="px-1 text-label-11 text-text-label">Competencies</legend>
          <div className="flex flex-col gap-4">
            {COMPETENCIES.map((name) => (
              <div key={name} className="grid gap-2 sm:grid-cols-[1fr_120px]">
                <Field label={name}>
                  <Input
                    value={notes[name] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [name]: e.target.value }))}
                    placeholder="What you actually saw"
                  />
                </Field>
                <Field label="Score">
                  <Select
                    value={String(scores[name])}
                    options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} of 5` }))}
                    onChange={(e) => setScores((prev) => ({ ...prev, [name]: Number(e.target.value) as 1 | 2 | 3 | 4 | 5 }))}
                  />
                </Field>
              </div>
            ))}
          </div>
          <p className="mt-3 text-body-13 text-text-secondary">
            Average so far: <span className="font-semibold text-text tabular-nums">{average.toFixed(1)} of 5</span>
          </p>
        </fieldset>

        <Field label="Recommendation" required>
          <Select
            value={recommendation}
            options={RECOMMENDATIONS.map((r) => ({ value: r, label: RECOMMENDATION_LABEL[r] }))}
            onChange={(e) => setRecommendation(e.target.value as HireRecommendation)}
          />
        </Field>

        <Field label="Summary" required hint="Read by everyone else on the panel before the final review." error={touched ? errors.summary : undefined}>
          <Textarea
            rows={3}
            value={summary}
            invalid={touched && Boolean(errors.summary)}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={400}
            showCount
            placeholder="Walked through a reconciliation they had actually run, including what they got wrong the first time."
          />
        </Field>

        {interview && (
          <p className="text-body-12 text-text-secondary">
            Against the {INTERVIEW_TYPE_LABEL[interview.type] ?? interview.type} round on {formatDate(interview.scheduledAt)}.
            Submitting marks the round completed if it was still scheduled.
          </p>
        )}
      </div>
    </Modal>
  )
}
