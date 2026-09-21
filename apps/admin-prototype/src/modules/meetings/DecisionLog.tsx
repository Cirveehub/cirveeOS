/**
 * The decision log.
 *
 * The module's stated purpose is that you can find out what was decided, by
 * whom, when and why — so search here runs across the full decision body, the
 * rationale and the alternatives, not just the title, and the matched text is
 * marked in the result. Everything else on the screen is in service of that.
 */
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { CalendarClock, Gavel, Plus, Scale, Search } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  SectionHeader,
  Separator,
  SkeletonCard,
  StatCard,
  TableToolbar,
  type FilterValues,
} from '@/ui'
import { TODAY, decisionsCollection, meetingsCollection, useCollection } from '@/mocks'
import type { Decision } from '@/mocks'

import {
  DECISION_STATUS_LABEL,
  DECISION_STATUS_TONE,
  ErrorPanel,
  ModuleHeader,
  Screen,
  daysBetween,
  useModuleData,
  useUserName,
} from './parts'
import { NewDecisionModal } from './modals'

/** Marks every occurrence of the search term so the hit is visible in the body. */
function highlight(text: string, term: string): ReactNode {
  if (term.trim() === '') return text
  const safe = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${safe})`, 'ig'))
  return parts.map((part, index) =>
    part.toLowerCase() === term.trim().toLowerCase() ? (
      <mark key={index} className="rounded-sm bg-accent-subtle px-0.5 text-accent">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export default function DecisionLog() {
  const allDecisions = useCollection(decisionsCollection)
  const meetings = useCollection(meetingsCollection)
  const { loading, error, rows: decisions, retry } = useModuleData(allDecisions, 'meetings.decisions')

  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [creating, setCreating] = useState(false)
  const [replacing, setReplacing] = useState<Decision | null>(null)

  const meetingById = useMemo(() => new Map(meetings.map((m) => [m.id as string, m])), [meetings])
  const decisionById = useMemo(
    () => new Map(allDecisions.map((d) => [d.id as string, d])),
    [allDecisions],
  )

  const areas = useMemo(
    () => [...new Set(allDecisions.flatMap((d) => d.affectedAreas))].sort((a, b) => a.localeCompare(b)),
    [allDecisions],
  )

  const figures = useMemo(
    () => ({
      active: decisions.filter((d) => d.status === 'active').length,
      superseded: decisions.filter((d) => d.status === 'superseded').length,
      reversed: decisions.filter((d) => d.status === 'reversed').length,
      reviewDue: decisions.filter(
        (d) => d.status === 'active' && d.reviewDate !== null && daysBetween(TODAY, d.reviewDate) <= 90,
      ).length,
    }),
    [decisions],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return decisions
      .filter((decision) => {
        if (filters.status && decision.status !== filters.status) return false
        if (filters.area && !decision.affectedAreas.includes(filters.area)) return false
        if (!term) return true
        // Full-text: the decision body and rationale are the point, not the title.
        return (
          decision.ref.toLowerCase().includes(term) ||
          decision.title.toLowerCase().includes(term) ||
          decision.decision.toLowerCase().includes(term) ||
          decision.rationale.toLowerCase().includes(term) ||
          decision.alternativesConsidered.some((alt) => alt.toLowerCase().includes(term)) ||
          decision.affectedAreas.some((area) => area.toLowerCase().includes(term))
        )
      })
      .sort((a, b) => b.decidedOn.localeCompare(a.decidedOn))
  }, [decisions, filters, search])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const bodyMatch = (decision: Decision) =>
    search.trim() !== '' &&
    !decision.title.toLowerCase().includes(search.trim().toLowerCase()) &&
    (decision.decision.toLowerCase().includes(search.trim().toLowerCase()) ||
      decision.rationale.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <Screen>
      <ModuleHeader
        title="Decision log"
        description="What was decided, by whom, when and why — searchable across the full text of every decision."
        actions={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
            Log a decision
          </Button>
        }
      />

      {error ? (
        <ErrorPanel onRetry={retry} what="The decision log" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Active"
              value={formatNumber(figures.active)}
              icon={Gavel}
              caption="In force right now"
              loading={loading}
            />
            <StatCard
              label="Superseded"
              value={formatNumber(figures.superseded)}
              icon={Scale}
              caption="Replaced by a later decision, kept for the record"
              loading={loading}
            />
            <StatCard
              label="Reversed"
              value={formatNumber(figures.reversed)}
              icon={Scale}
              caption="Taken back, and visibly so"
              loading={loading}
            />
            <StatCard
              label="Up for review"
              value={formatNumber(figures.reviewDue)}
              icon={CalendarClock}
              variant={figures.reviewDue > 0 ? 'warning' : 'default'}
              caption="Review date within 90 days"
              loading={loading}
            />
          </div>

          <Alert className="mt-6" tone="info" icon={Search} title="Search runs across the decision body">
            Not just titles. Type "attendance", "commission" or "purple" and the log returns every
            decision whose text or rationale mentions it, with the match marked. Nothing is ever
            deleted from this log — a decision that no longer holds is superseded or reversed and
            stays visible.
          </Alert>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search the full text of every decision, its rationale and its alternatives"
                  values={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'status',
                      label: 'Status',
                      options: (['active', 'superseded', 'reversed'] as Decision['status'][]).map(
                        (status) => ({ value: status, label: DECISION_STATUS_LABEL[status] }),
                      ),
                    },
                    {
                      key: 'area',
                      label: 'Affected area',
                      options: areas.map((area) => ({ value: area, label: area })),
                    },
                  ]}
                />
              </TableToolbar>
            </CardBody>
          </Card>

          {loading ? (
            <div className="mt-6 space-y-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : rows.length === 0 ? (
            <Card className="mt-6">
              <CardBody>
                {filtered ? (
                  <EmptyState
                    variant="search"
                    title="No decision mentions that"
                    message="The search covers the decision text, the rationale, the alternatives considered and the affected areas. If nothing came back, the decision was either never taken or never written down."
                    action={
                      <Button size="sm" variant="secondary" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Gavel}
                    title="No decisions logged"
                    message="An unrecorded decision gets relitigated at the next meeting. Decisions are logged from inside the meeting that took them, with the rationale and what was rejected."
                    action={
                      <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setCreating(true)}>
                        Log the first decision
                      </Button>
                    }
                  />
                )}
              </CardBody>
            </Card>
          ) : (
            <>
              <p className="mt-6 text-body-13 text-text-secondary">
                {formatNumber(rows.length)} {rows.length === 1 ? 'decision' : 'decisions'}
                {search.trim() !== '' ? ` matching "${search.trim()}"` : ''}
              </p>

              <ul className="mt-3 space-y-4">
                {rows.map((decision) => {
                  const meeting = meetingById.get((decision.meetingId ?? '') as string)
                  const supersededBy = decision.supersededByDecisionId
                    ? decisionById.get(decision.supersededByDecisionId as string)
                    : null
                  const supersedes = decision.supersedesDecisionId
                    ? decisionById.get(decision.supersedesDecisionId as string)
                    : null

                  return (
                    <li key={decision.id}>
                      <Card>
                        <CardBody>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-body-12 text-text-secondary">
                                  {highlight(decision.ref, search)}
                                </span>
                                <Badge tone={DECISION_STATUS_TONE[decision.status]} size="sm">
                                  {DECISION_STATUS_LABEL[decision.status]}
                                </Badge>
                                {bodyMatch(decision) && (
                                  <Badge tone="accent" size="sm" icon={<Search size={12} />}>
                                    Matched in the body
                                  </Badge>
                                )}
                              </div>
                              <h3 className="mt-1 text-heading-18 text-text">
                                {highlight(decision.title, search)}
                              </h3>
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                              {decision.affectedAreas.map((area) => (
                                <Badge key={area} tone="neutral" size="sm">
                                  {area}
                                </Badge>
                              ))}
                              {decision.status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  leftIcon={<Scale size={16} />}
                                  onClick={() => setReplacing(decision)}
                                >
                                  Supersede or reverse
                                </Button>
                              )}
                            </div>
                          </div>

                          <SectionHeader
                            className="mt-5"
                            size="sm"
                            as="h4"
                            title="What was decided"
                            description="The full text, exactly as it was recorded."
                          />
                          <p className="mt-2 text-body-14 text-text">
                            {highlight(decision.decision, search)}
                          </p>

                          <Separator className="my-5" />

                          <KeyValueList columns={2}>
                            <KeyValue label="Decided by">
                              {decision.decidedByUserIds.map(userName).join(', ')}
                            </KeyValue>
                            <KeyValue label="Decided on">{formatDate(decision.decidedOn)}</KeyValue>
                            <KeyValue label="Meeting">
                              {meeting ? (
                                <Link
                                  to={`/meetings/${meeting.id}?tab=decisions`}
                                  className="text-accent underline-offset-2 hover:underline"
                                >
                                  {meeting.title} · {formatDate(meeting.startAt)}
                                </Link>
                              ) : (
                                'Not taken in a meeting'
                              )}
                            </KeyValue>
                            <KeyValue label="Review date">
                              {decision.reviewDate ? formatDate(decision.reviewDate) : 'No review scheduled'}
                            </KeyValue>
                            <KeyValue label="Supersedes">
                              {supersedes ? `${supersedes.ref} · ${supersedes.title}` : 'Nothing'}
                            </KeyValue>
                            <KeyValue label="Superseded by">
                              {supersededBy
                                ? `${supersededBy.ref} · ${supersededBy.title}`
                                : decision.supersededByDecisionId
                                  ? String(decision.supersededByDecisionId).toUpperCase()
                                  : 'Still stands'}
                            </KeyValue>
                          </KeyValueList>

                          <SectionHeader
                            className="mt-5"
                            size="sm"
                            as="h4"
                            title="Why"
                            description="The reasoning at the time, not reconstructed afterwards."
                          />
                          <p className="mt-2 text-body-13 text-text-secondary">
                            {highlight(decision.rationale, search)}
                          </p>

                          {decision.alternativesConsidered.length > 0 && (
                            <>
                              <SectionHeader
                                className="mt-5"
                                size="sm"
                                as="h4"
                                title="Alternatives considered"
                                description="What was rejected, so it is not proposed again as if it were new."
                              />
                              <ul className="mt-2 flex flex-wrap gap-2">
                                {decision.alternativesConsidered.map((alt) => (
                                  <li key={alt}>
                                    <Badge tone="neutral" variant="outline" size="sm">
                                      {highlight(alt, search)}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </CardBody>
                      </Card>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </>
      )}

      <NewDecisionModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(decision) => toast.success(`${decision.ref} logged. It is searchable by its full text.`)}
      />

      <NewDecisionModal
        key={(replacing?.id as string) ?? 'no-replacement'}
        open={replacing !== null}
        replacing={replacing}
        onClose={() => setReplacing(null)}
        onCreated={(decision) => {
          toast.success(
            `${decision.ref} logged. ${replacing?.ref ?? 'The original'} stays in the log, linked forward to it.`,
          )
          setReplacing(null)
        }}
      />
    </Screen>
  )
}
