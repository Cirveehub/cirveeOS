/**
 * Candidate profile — `/people/candidates/:id` (screen-spec §9).
 *
 * The stage rail across the top is the point of this screen, and the **Stage
 * history** tab is the proof behind it: the record carries one current stage,
 * but every move it has ever made is still on file in the audit log, in order,
 * with who moved it and why. A later move cannot overwrite an earlier one
 * because the trail is append-only — the same discipline the commission ledger
 * and the compensation history use.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, ClipboardList, FileSignature, History, Route, UserPlus } from 'lucide-react'

import { formatDate, formatDateTime, formatNaira, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  Field,
  KeyValue,
  KeyValueList,
  PageHeader,
  Select,
  StatusBadge,
  TabPanel,
  Tabs,
  Textarea,
  Timeline,
  UnitTag,
  type Column,
  type TabItem,
  type TimelineItem,
} from '@/ui'
import { useQueryState } from '@/lib/view-state'
import {
  auditEventsCollection,
  candidatesCollection,
  interviewsCollection,
  jobOpeningsCollection,
  offersCollection,
  peopleCollection,
  scorecardsCollection,
  useCollection,
} from '@/mocks'
import type { CandidateStage, Interview, Scorecard } from '@/mocks'

import {
  ALL_STAGES,
  EXIT_STAGES,
  INTERVIEW_TYPE_LABEL,
  PIPELINE_STAGES,
  Page,
  PeopleGroupTabs,
  RECOMMENDATION_LABEL,
  RECOMMENDATION_TONE,
  STAGE_LABEL,
  STAGE_TONE,
  branchName,
  departmentName,
  isClosedStage,
  personName,
  unitKey,
  userName,
} from './shared'
import { auditTrail, averageOf, candidateTrail, moveCandidateStage, offerGross } from './writes'

export default function CandidateProfile() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const query = useQueryState()
  const tab = query.get('tab') ?? 'profile'

  const candidates = useCollection(candidatesCollection)
  const openings = useCollection(jobOpeningsCollection)
  const interviews = useCollection(interviewsCollection)
  const scorecards = useCollection(scorecardsCollection)
  const offers = useCollection(offersCollection)
  useCollection(peopleCollection)
  const auditEvents = useCollection(auditEventsCollection)

  const [moving, setMoving] = useState(false)
  const [nextStage, setNextStage] = useState<CandidateStage | ''>('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const candidate = candidates.find((c) => c.id === id)
  const opening = candidate ? openings.find((o) => o.id === candidate.openingId) : undefined
  const person = candidate ? peopleCollection.find(candidate.personId) : undefined

  const myInterviews = useMemo(
    () => (candidate ? interviews.filter((i) => i.candidateId === candidate.id).sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt)) : []),
    [interviews, candidate],
  )
  const interviewIds = useMemo(() => new Set(myInterviews.map((i) => i.id as string)), [myInterviews])
  const myScorecards = useMemo(
    () => scorecards.filter((s) => interviewIds.has(s.interviewId as string)),
    [scorecards, interviewIds],
  )
  const myOffers = useMemo(
    () => (candidate ? offers.filter((o) => o.candidateId === candidate.id) : []),
    [offers, candidate],
  )
  const trail = useMemo(() => (candidate ? candidateTrail(candidate.id) : []), [candidate, auditEvents])
  const audit = useMemo(() => (candidate ? auditTrail('Candidate', candidate.id as string) : []), [candidate, auditEvents])

  if (!candidate) {
    return (
      <Page>
        <PageHeader
          title="Candidate"
          breadcrumbs={[
            { label: 'People', to: '/people' },
            { label: 'Candidates', to: '/people/candidates' },
          ]}
        />
        <PeopleGroupTabs group="hiring" active="candidates" />
        <EmptyState
          icon={UserPlus}
          title="That candidate is not on file"
          message="They may have been opened from a stale link. The pipeline list has everyone currently on record."
          action={
            <Button size="sm" asChild>
              <Link to="/people/candidates">Back to candidates</Link>
            </Button>
          }
        />
      </Page>
    )
  }

  const stageIndex = PIPELINE_STAGES.indexOf(candidate.stage)
  const closedOut = EXIT_STAGES.includes(candidate.stage)

  const tabs: TabItem[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'interviews', label: 'Interviews', badge: myInterviews.length },
    { id: 'scorecards', label: 'Scorecards', badge: myScorecards.length },
    { id: 'offer', label: 'Offer', badge: myOffers.length },
    { id: 'history', label: 'Stage history', badge: trail.length },
    { id: 'audit', label: 'Audit', badge: audit.length },
  ]

  const applyMove = () => {
    setTouched(true)
    if (!nextStage || reason.trim().length === 0) return
    moveCandidateStage(candidate.id, nextStage, reason)
    setMoving(false)
    setNextStage('')
    setReason('')
    setTouched(false)
  }

  const scorecardColumns: Array<Column<Scorecard>> = [
    {
      key: 'interviewer',
      header: 'Interviewer',
      minWidth: 170,
      accessor: (row) => userName(row.interviewerUserId),
      sortValue: (row) => userName(row.interviewerUserId),
      sortable: true,
    },
    {
      key: 'round',
      header: 'Round',
      width: 130,
      accessor: (row) => {
        const interview = myInterviews.find((i) => i.id === row.interviewId)
        return interview ? (INTERVIEW_TYPE_LABEL[interview.type] ?? interview.type) : '—'
      },
      sortValue: (row) => myInterviews.find((i) => i.id === row.interviewId)?.type ?? '',
    },
    {
      key: 'average',
      header: 'Average',
      align: 'right',
      width: 110,
      accessor: (row) => <span className="tabular-nums">{averageOf(row).toFixed(1)} of 5</span>,
      sortValue: (row) => averageOf(row),
      sortable: true,
    },
    {
      key: 'recommendation',
      header: 'Recommendation',
      width: 170,
      cell: (row) => (
        <Badge tone={RECOMMENDATION_TONE[row.recommendation] ?? 'neutral'} size="sm">
          {RECOMMENDATION_LABEL[row.recommendation] ?? row.recommendation}
        </Badge>
      ),
      sortValue: (row) => row.recommendation,
      sortable: true,
    },
    {
      key: 'submitted',
      header: 'Submitted',
      width: 170,
      accessor: (row) => (row.submittedAt ? formatDateTime(row.submittedAt) : <Badge tone="warning" size="sm">Not submitted</Badge>),
      sortValue: (row) => row.submittedAt ?? '',
      sortable: true,
    },
  ]

  const interviewColumns: Array<Column<Interview>> = [
    { key: 'when', header: 'Date and time', width: 190, accessor: (row) => formatDateTime(row.scheduledAt), sortValue: (row) => row.scheduledAt, sortable: true },
    { key: 'type', header: 'Type', width: 130, accessor: (row) => INTERVIEW_TYPE_LABEL[row.type] ?? row.type, sortValue: (row) => row.type, sortable: true },
    {
      key: 'panel',
      header: 'Interviewers',
      minWidth: 220,
      accessor: (row) => row.interviewerUserIds.map((u) => userName(u)).join(', '),
      sortValue: (row) => row.interviewerUserIds.length,
    },
    {
      key: 'mode',
      header: 'Mode',
      width: 160,
      accessor: (row) => (row.mode === 'virtual' ? 'Virtual' : row.mode === 'hybrid' ? 'Hybrid' : (row.location ?? 'On campus')),
      sortValue: (row) => row.mode,
    },
    { key: 'status', header: 'Status', width: 126, cell: (row) => <StatusBadge status={row.status} />, sortValue: (row) => row.status, sortable: true },
    {
      key: 'outcome',
      header: 'Outcome',
      width: 126,
      accessor: (row) =>
        row.outcome === null ? <span className="text-text-secondary">Not recorded</span> : <span className="capitalize">{row.outcome}</span>,
      sortValue: (row) => row.outcome ?? '',
      sortable: true,
    },
    {
      key: 'scorecards',
      header: 'Scorecards',
      align: 'right',
      width: 128,
      accessor: (row) => {
        const submitted = myScorecards.filter((s) => s.interviewId === row.id && s.submittedAt !== null).length
        return `${formatNumber(submitted)} of ${formatNumber(row.interviewerUserIds.length)}`
      },
      sortValue: (row) => myScorecards.filter((s) => s.interviewId === row.id).length,
    },
  ]

  const trailItems: TimelineItem[] = trail
    .slice()
    .reverse()
    .map((move) => ({
      id: move.id,
      title: move.from ? `${move.from} → ${move.to}` : move.to,
      description: `by ${move.actorName}`,
      timestamp: move.at,
      icon: Route,
      tone: 'accent',
    }))

  const auditItems: TimelineItem[] = audit.map((event) => ({
    id: event.id as string,
    title: event.action,
    description: `${event.actorName} · ${event.actorRole}`,
    detail: (
      <span className="text-body-12 text-text-secondary">
        {event.field ?? 'record'}: {event.before ?? 'nothing'} → {event.after ?? 'nothing'}
      </span>
    ),
    timestamp: event.at,
    tone: 'neutral',
  }))

  return (
    <Page>
      <PageHeader
        title={personName(candidate.personId)}
        description={`${opening?.title ?? 'Opening withdrawn'} · applied ${formatDate(candidate.appliedAt)} via ${candidate.source}`}
        breadcrumbs={[
          { label: 'People', to: '/people' },
          { label: 'Candidates', to: '/people/candidates' },
          { label: personName(candidate.personId) },
        ]}
        meta={<Badge tone={STAGE_TONE[candidate.stage]}>{STAGE_LABEL[candidate.stage]}</Badge>}
        actions={
          <>
            <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
              <Link to="/people/candidates">Back to candidates</Link>
            </Button>
            <Button variant="secondary" leftIcon={<CalendarPlus size={16} aria-hidden="true" />} onClick={() => navigate('/people/interviews')}>
              Schedule an interview
            </Button>
            {!isClosedStage(candidate.stage) && (
              <Button leftIcon={<Route size={16} aria-hidden="true" />} onClick={() => setMoving((v) => !v)}>
                Move stage
              </Button>
            )}
          </>
        }
      />

      <PeopleGroupTabs group="hiring" active="candidates" />

      {/* The stage rail — persistent, above the tabs, because it is the one
          thing every tab is read in the context of. */}
      <Card className="mb-6">
        <CardBody>
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-2" aria-label="Pipeline stage">
            {PIPELINE_STAGES.map((stage, index) => {
              const reached = !closedOut && stageIndex >= index
              const current = !closedOut && stageIndex === index
              return (
                <li key={stage} className="flex items-center gap-2">
                  <span
                    className={
                      current
                        ? 'rounded-full bg-accent px-3 py-1 text-label-11 text-on-accent'
                        : reached
                          ? 'rounded-full bg-accent-subtle px-3 py-1 text-label-11 text-accent'
                          : 'rounded-full border border-border px-3 py-1 text-label-11 text-text-secondary'
                    }
                    aria-current={current ? 'step' : undefined}
                  >
                    {STAGE_LABEL[stage]}
                  </span>
                  {index < PIPELINE_STAGES.length - 1 && <span className="h-px w-4 bg-border" aria-hidden="true" />}
                </li>
              )
            })}
          </ol>
          {closedOut && (
            <Alert tone="warning" className="mt-4" title={`Closed out as ${STAGE_LABEL[candidate.stage]}`}>
              Nothing was deleted. The application, its interviews and its scorecards all stay on file, which is what makes a
              talent-pool candidate findable when the next opening is raised.
            </Alert>
          )}
        </CardBody>
      </Card>

      {moving && (
        <Card className="mb-6">
          <CardHeader
            title="Move this candidate"
            description="The record keeps one current stage. This move is appended to the trail — it does not replace what came before it."
          />
          <CardBody>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Move to" required>
                  <Select
                    value={nextStage}
                    placeholder="Choose a stage"
                    options={ALL_STAGES.filter((s) => s !== candidate.stage).map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
                    onChange={(e) => setNextStage(e.target.value as CandidateStage)}
                  />
                </Field>
              </div>
              <Field
                label="Reason"
                required
                hint="Recorded against the move. A rejection with no reason is not reviewable later."
                error={touched && reason.trim().length === 0 ? 'Say why this candidate is moving.' : undefined}
              >
                <Textarea
                  rows={2}
                  value={reason}
                  invalid={touched && reason.trim().length === 0}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Panel agreed on the technical depth. Moving to final review with the hiring manager."
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button onClick={applyMove} disabled={!nextStage}>
                  Record the move
                </Button>
                <Button variant="ghost" onClick={() => setMoving(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      <Tabs tabs={tabs} value={tab} onChange={(id) => query.set('tab', id === 'profile' ? undefined : id)} aria-label="Candidate sections" className="mb-6" />

      <TabPanel id="panel-profile" tabId="profile" active={tab === 'profile'}>
        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Application" description="What they applied for, and where the role sits in the business." />
            <CardBody>
              <KeyValueList columns={2}>
                <KeyValue label="Role applied for">{opening?.title ?? 'Opening withdrawn'}</KeyValue>
                <KeyValue label="Opening reference">
                  <span className="font-mono text-body-13">{opening?.ref ?? '—'}</span>
                </KeyValue>
                <KeyValue label="Department">{departmentName(opening?.departmentId)}</KeyValue>
                <KeyValue label="Branch">{branchName(opening?.branchId)}</KeyValue>
                <KeyValue label="Unit">
                  {(() => {
                    const key = unitKey(opening?.unitId)
                    return key ? <UnitTag unit={key} /> : '—'
                  })()}
                </KeyValue>
                <KeyValue label="Recruiter">{userName(candidate.recruiterUserId)}</KeyValue>
                <KeyValue label="Source">{candidate.source}</KeyValue>
                <KeyValue label="Applied">{formatDate(candidate.appliedAt)}</KeyValue>
                <KeyValue label="In this stage since" hint={formatDateTime(candidate.stageEnteredAt)}>
                  {STAGE_LABEL[candidate.stage]}
                </KeyValue>
                <KeyValue label="Next step">{candidate.nextStep ?? 'Nothing scheduled'}</KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact" description="How to reach them, and what the panel has said so far." />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Email">{person?.email ?? 'Not supplied'}</KeyValue>
                <KeyValue label="Phone">{person?.phone ?? 'Not supplied'}</KeyValue>
                <KeyValue label="Location">{person ? `${person.city}, ${person.state}` : 'Not supplied'}</KeyValue>
                <KeyValue label="CV">
                  <span className="font-mono text-body-12 text-text-secondary">{candidate.cvUrl}</span>
                </KeyValue>
                <KeyValue label="Average scorecard" hint={`${formatNumber(myScorecards.length)} on record`}>
                  {candidate.averageScore === null ? 'Not scored yet' : `${candidate.averageScore.toFixed(1)} of 5`}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="panel-interviews" tabId="interviews" active={tab === 'interviews'}>
        <Card>
          <CardBody padding="none">
            <DataTable
              data={myInterviews}
              columns={interviewColumns}
              rowKey={(row) => row.id}
              density="compact"
              minWidth={1180}
              bordered={false}
              caption={`Interviews for ${personName(candidate.personId)}`}
              empty={
                <EmptyState
                  icon={CalendarPlus}
                  title="No interview has been scheduled"
                  message="A candidate cannot be scored without an interview, and cannot be advanced past Shortlisted without a score."
                  action={
                    <Button size="sm" variant="secondary" asChild>
                      <Link to="/people/interviews">Go to interviews</Link>
                    </Button>
                  }
                />
              }
            />
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="panel-scorecards" tabId="scorecards" active={tab === 'scorecards'} className="space-y-6">
        <Card>
          <CardBody padding="none">
            <DataTable
              data={myScorecards}
              columns={scorecardColumns}
              rowKey={(row) => row.id}
              density="compact"
              minWidth={900}
              bordered={false}
              caption={`Scorecards for ${personName(candidate.personId)}`}
              empty={
                <EmptyState
                  icon={ClipboardList}
                  title="No scorecard has been submitted"
                  message="Without a structured score there is nothing to compare one candidate against another with, and the decision comes down to whoever spoke last."
                />
              }
            />
          </CardBody>
        </Card>

        {myScorecards.map((card) => (
          <Card key={card.id}>
            <CardHeader
              title={`${userName(card.interviewerUserId)} — ${RECOMMENDATION_LABEL[card.recommendation] ?? card.recommendation}`}
              description={card.submittedAt ? `Submitted ${formatDateTime(card.submittedAt)}` : 'Not yet submitted'}
            />
            <CardBody>
              <ul className="flex flex-col gap-3">
                {card.competencies.map((competency) => (
                  <li key={competency.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2 last:border-0">
                    <span className="text-body-14 text-text">{competency.name}</span>
                    <span className="flex items-center gap-3">
                      {competency.note && <span className="text-body-12 text-text-secondary">{competency.note}</span>}
                      <Badge tone={competency.score >= 4 ? 'success' : competency.score <= 2 ? 'danger' : 'neutral'} size="sm">
                        {competency.score} of 5
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
              {card.notes && <p className="mt-4 text-body-13 text-text-secondary">{card.notes}</p>}
            </CardBody>
          </Card>
        ))}
      </TabPanel>

      <TabPanel id="panel-offer" tabId="offer" active={tab === 'offer'}>
        {myOffers.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            bordered
            title="No offer has been generated"
            message="An offer is generated from the offer-letter template once the hiring manager has decided. Generating one moves the candidate to Offer."
            action={
              <Button size="sm" asChild>
                <Link to={`/people/offers/new?candidate=${candidate.id}`}>Generate an offer</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-6 xl:grid-cols-2">
            {myOffers.map((offer) => (
              <Card key={offer.id}>
                <CardHeader title={offer.ref} description={`${offer.jobTitle} · start ${formatDate(offer.startDate)}`} />
                <CardBody>
                  <KeyValueList>
                    <KeyValue label="Status">
                      <StatusBadge status={offer.status} />
                    </KeyValue>
                    <KeyValue label="Gross" hint={`Base ${formatNaira(offer.baseSalary)} plus ${formatNumber(offer.allowances.length)} allowances`}>
                      {formatNaira(offerGross(offer))}
                    </KeyValue>
                    <KeyValue label="Probation">{`${formatNumber(offer.probationMonths)} months`}</KeyValue>
                    <KeyValue label="Issued">{offer.issuedAt ? formatDateTime(offer.issuedAt) : 'Not issued'}</KeyValue>
                    <KeyValue label="Responded">{offer.respondedAt ? formatDateTime(offer.respondedAt) : 'No response yet'}</KeyValue>
                  </KeyValueList>
                  {offer.status === 'lapsed' && (
                    <Alert tone="warning" className="mt-4" title="Accepted but never resumed">
                      No employment record was created, so there is no payroll line, no card and no unit cost to unwind.
                    </Alert>
                  )}
                  <div className="mt-4">
                    <Button size="sm" variant="secondary" asChild>
                      <Link to="/people/offers">Open in offers</Link>
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </TabPanel>

      <TabPanel id="panel-history" tabId="history" active={tab === 'history'}>
        <Card>
          <CardHeader
            title="Stage history"
            description="Rebuilt from the audit log, oldest first. Every move is a new row — nothing here was ever overwritten."
          />
          <CardBody>
            {trailItems.length === 0 ? (
              <EmptyState
                icon={Route}
                size="sm"
                bordered
                title="No stage move has been recorded"
                message="This candidate has not moved since they were added. The first move will appear here and stay here."
              />
            ) : (
              <Timeline items={trailItems} timeFormat="absolute" />
            )}
          </CardBody>
        </Card>
      </TabPanel>

      <TabPanel id="panel-audit" tabId="audit" active={tab === 'audit'}>
        <Card>
          <CardHeader
            title="Audit"
            description="Separate from the stage history above: actor, timestamp, field, previous value and new value on every change."
          />
          <CardBody>
            {auditItems.length === 0 ? (
              <EmptyState
                icon={History}
                size="sm"
                bordered
                title="No audited change yet"
                message="Entries appear here the moment anything on this record moves."
              />
            ) : (
              <Timeline items={auditItems} timeFormat="absolute" dense />
            )}
          </CardBody>
        </Card>
      </TabPanel>
    </Page>
  )
}
