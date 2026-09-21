import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { Button, Card, CardHeader } from '@/ui'
import { formatDate, formatPhone, formatRelative } from '@/lib/format'
import { TODAY, followUpsCollection, leadsCollection, useCollection } from '@/mocks'
import type { FollowUp, Lead } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { CompleteFollowUpModal, LogReplyModal } from '../components/ActivityComposer'
import {
  SOURCE_LABELS,
  courseTitle,
  isOpenStage,
  useDirectory,
  waitingLabel,
  whatsappHref,
} from '../lib/lookups'
import { useCrmScope } from '../lib/scope'
import { useScreenLoad } from '../lib/view-state'

export default function Today() {
  const navigate = useNavigate()
  const scope = useCrmScope()
  const directory = useDirectory()
  const { error, retry } = useScreenLoad('crm.today')

  const leads = useCollection(leadsCollection)
  const followUps = useCollection(followUpsCollection)

  const [mine, setMine] = useState(scope.ownOnlyByDefault)
  const [replyTo, setReplyTo] = useState<Lead | null>(null)
  const [doing, setDoing] = useState<FollowUp | null>(null)

  const inScope = (ownerId: string) => !mine || ownerId === scope.userId

  const live = useMemo(() => leads.filter((l) => !l.archivedAt), [leads])

  const waiting = useMemo(
    () =>
      live
        .filter((l) => l.stage === 'new' && !l.firstResponseAt && inScope(l.ownerUserId))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, mine, scope.userId],
  )

  const callbacks = useMemo(() => {
    const byId = new Map(live.map((l) => [l.id as string, l]))
    return followUps
      .filter(
        (f) =>
          (f.status === 'open' || f.status === 'rescheduled') &&
          f.dueAt.slice(0, 10) <= TODAY &&
          inScope(f.ownerUserId),
      )
      .map((f) => ({ followUp: f, lead: byId.get(f.leadId as string) }))
      .filter((row): row is { followUp: FollowUp; lead: Lead } => Boolean(row.lead && isOpenStage(row.lead.stage)))
      .sort((a, b) => a.followUp.dueAt.localeCompare(b.followUp.dueAt))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, followUps, mine, scope.userId])

  const ready = useMemo(
    () =>
      live
        .filter((l) => l.stage === 'payment_pending' && inScope(l.ownerUserId))
        .sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [live, mine, scope.userId],
  )

  const summary = [
    `${waiting.length} to reply to`,
    `${callbacks.length} callback${callbacks.length === 1 ? '' : 's'} due`,
    `${ready.length} ready to enrol`,
  ].join(' · ')

  return (
    <CrmPage
      title={`Hello, ${scope.firstName}`}
      description={summary}
      error={error}
      onRetry={retry}
      actions={
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          <Button size="sm" variant={mine ? 'primary' : 'ghost'} aria-pressed={mine} onClick={() => setMine(true)}>
            Mine
          </Button>
          <Button size="sm" variant={mine ? 'ghost' : 'primary'} aria-pressed={!mine} onClick={() => setMine(false)}>
            Everyone
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <TodayList
          title="New enquiries waiting for a first reply"
          count={waiting.length}
          empty="Nobody is waiting. Every new enquiry has had a reply."
        >
          {waiting.map((lead) => (
            <TodayRow
              key={lead.id}
              lead={lead}
              name={directory.nameOf(lead.personId)}
              phone={directory.personById.get(lead.personId as string)}
              note={`${formatRelative(lead.createdAt)} · ${SOURCE_LABELS[lead.originalSource]}${
                mine ? '' : ` · ${directory.userNameOf(lead.ownerUserId)}`
              }`}
              action={
                <Button size="sm" onClick={() => setReplyTo(lead)}>
                  Reply logged
                </Button>
              }
            />
          ))}
        </TodayList>

        <TodayList title="Callbacks due today" count={callbacks.length} empty="No callbacks due. Your list is clear.">
          {callbacks.map(({ followUp, lead }) => {
            const overdue = followUp.dueAt.slice(0, 10) < TODAY
            return (
              <TodayRow
                key={followUp.id}
                lead={lead}
                name={directory.nameOf(lead.personId)}
                phone={directory.personById.get(lead.personId as string)}
                note={
                  <>
                    <span className={overdue ? 'font-semibold text-danger-text' : undefined}>
                      {overdue ? `Was due ${formatDate(followUp.dueAt)}` : 'Due today'}
                    </span>
                    {' · '}
                    {followUp.action}
                  </>
                }
                action={
                  <Button size="sm" onClick={() => setDoing(followUp)}>
                    Done
                  </Button>
                }
              />
            )
          })}
        </TodayList>

        <TodayList title="Said yes, haven't paid yet" count={ready.length} empty="Nobody is waiting to pay right now.">
          {ready.map((lead) => (
            <TodayRow
              key={lead.id}
              lead={lead}
              name={directory.nameOf(lead.personId)}
              phone={directory.personById.get(lead.personId as string)}
              note={`${waitingLabel(lead.daysInStage)} since saying yes${
                mine ? '' : ` · ${directory.userNameOf(lead.ownerUserId)}`
              }`}
              action={
                <Button size="sm" onClick={() => navigate(`/crm/admissions/new?leadId=${lead.id}`)}>
                  Record payment & enrol
                </Button>
              }
            />
          ))}
        </TodayList>
      </div>

      <LogReplyModal lead={replyTo} open={replyTo !== null} onClose={() => setReplyTo(null)} />
      <CompleteFollowUpModal followUp={doing} open={doing !== null} onClose={() => setDoing(null)} />
    </CrmPage>
  )
}

function TodayList({
  title,
  count,
  empty,
  children,
}: {
  title: string
  count: number
  empty: string
  children: ReactNode
}) {
  return (
    <Card padding="none" className="flex min-h-0 flex-col">
      <CardHeader title={title} actions={<span className="text-body-13 tabular-nums text-text-secondary">{count}</span>} />
      {count === 0 ? (
        <p className="px-4 py-6 text-body-13 text-text-secondary">{empty}</p>
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </Card>
  )
}

function TodayRow({
  lead,
  name,
  phone,
  note,
  action,
}: {
  lead: Lead
  name: string
  phone: { phone: string | null; whatsapp: string | null } | undefined
  note: ReactNode
  action: ReactNode
}) {
  const wa = whatsappHref(phone)
  const number = phone?.whatsapp ?? phone?.phone
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <Link to={`/crm/enquiries/${lead.id}`} className="block truncate text-body-14 font-semibold text-text hover:underline">
          {name}
        </Link>
        <p className="truncate text-body-13 text-text-secondary">{courseTitle(lead.courseInterestId)}</p>
        <p className="truncate text-body-12 text-text-muted">{note}</p>
        {number ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-body-12">
            <span className="text-text-secondary">{formatPhone(number)}</span>
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
              >
                <MessageCircle size={12} aria-hidden="true" />
                WhatsApp
              </a>
            )}
          </p>
        ) : (
          <p className="mt-0.5 text-body-12 text-warning-text">No phone number</p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  )
}
