import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, GraduationCap, Inbox, Wallet } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, DataTable, EmptyState, Select, StatCard, type Column } from '@/ui'
import { formatNumber, formatPercent } from '@/lib/format'
import { TODAY, admissionsCollection, leadsCollection, useCollection } from '@/mocks'
import type { Lead, LeadSource, UserId } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { BarList, type BarRow } from '../components/BarList'
import { dateDaysAgo } from '../lib/lead-filters'
import {
  SOURCE_LABELS,
  courseTitle,
  isOpenStage,
  replySpeedOf,
  useDirectory,
  waitingLabel,
} from '../lib/lookups'
import { useQueryState, useScreenLoad } from '../lib/view-state'
import { daysBetween } from '../lib/writes'

const RANGES = [
  { value: 'month', label: 'This month' },
  { value: '90d', label: 'Last 90 days' },
]

interface OwnerRow {
  userId: UserId
  name: string
  open: number
  fastReply: number | null
  enrolled: number
  conversion: number | null
}

export default function Team() {
  const query = useQueryState()
  const navigate = useNavigate()
  const { error, retry } = useScreenLoad('crm.team')
  const { userNameOf, nameOf } = useDirectory()

  const leads = useCollection(leadsCollection)
  const admissions = useCollection(admissionsCollection)

  const rangeKey = RANGES.some((r) => r.value === query.get('range')) ? (query.get('range') as string) : 'month'
  const from = rangeKey === 'month' ? `${TODAY.slice(0, 7)}-01` : dateDaysAgo(90)
  const rangeLabel = RANGES.find((r) => r.value === rangeKey)?.label.toLowerCase() ?? 'this month'
  const inRange = (iso: string) => iso.slice(0, 10) >= from

  const live = useMemo(() => leads.filter((l) => !l.archivedAt), [leads])
  const open = useMemo(() => live.filter((l) => isOpenStage(l.stage)), [live])
  const arrived = useMemo(() => live.filter((l) => inRange(l.createdAt)), [live, from]) // eslint-disable-line react-hooks/exhaustive-deps
  const enrolments = useMemo(
    () => admissions.filter((a) => a.status !== 'withdrawn' && a.status !== 'draft' && inRange(a.createdAt)),
    [admissions, from], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const slow = arrived.filter((l) => replySpeedOf(l) !== 'fast')
  const ready = live.filter((l) => l.stage === 'payment_pending')

  const leadById = useMemo(() => new Map(live.map((l) => [l.id as string, l])), [live])

  const channelRows: BarRow[] = useMemo(() => {
    const tally = new Map<LeadSource, { enquiries: number; enrolled: number }>()
    const bump = (source: LeadSource, key: 'enquiries' | 'enrolled') => {
      const row = tally.get(source) ?? { enquiries: 0, enrolled: 0 }
      row[key] += 1
      tally.set(source, row)
    }
    for (const lead of arrived) bump(lead.originalSource, 'enquiries')
    for (const admission of enrolments) {
      const lead = admission.leadId ? leadById.get(admission.leadId as string) : undefined
      if (lead) bump(lead.originalSource, 'enrolled')
    }
    return [...tally.entries()]
      .sort((a, b) => b[1].enrolled - a[1].enrolled || b[1].enquiries - a[1].enquiries)
      .map(([source, row]) => ({
        key: source,
        label: SOURCE_LABELS[source],
        value: row.enrolled,
        secondary: row.enquiries ? (row.enrolled / row.enquiries) * 100 : null,
        secondaryLabel: `of ${formatNumber(row.enquiries)} enquiries`,
        tone: row.enrolled > 0 ? 'success' : 'neutral',
        to: `/crm/enquiries?source=${source}&scope=all&closed=1`,
      }))
  }, [arrived, enrolments, leadById])

  const ownerRows: OwnerRow[] = useMemo(() => {
    const ids = new Set<string>()
    for (const lead of live) ids.add(lead.ownerUserId as string)
    for (const admission of enrolments) ids.add(admission.leadOwnerUserId as string)
    return [...ids]
      .map((id) => {
        const mineArrived = arrived.filter((l) => (l.ownerUserId as string) === id)
        const fast = mineArrived.filter((l) => replySpeedOf(l) === 'fast').length
        const enrolled = enrolments.filter((a) => (a.leadOwnerUserId as string) === id).length
        return {
          userId: id as UserId,
          name: userNameOf(id as UserId),
          open: open.filter((l) => (l.ownerUserId as string) === id).length,
          fastReply: mineArrived.length ? (fast / mineArrived.length) * 100 : null,
          enrolled,
          conversion: mineArrived.length ? (enrolled / mineArrived.length) * 100 : null,
        }
      })
      .sort((a, b) => b.enrolled - a.enrolled || b.open - a.open)
  }, [live, arrived, enrolments, open, userNameOf])

  const sitting = useMemo(() => {
    const rows = open
      .filter((l) => !l.nextAction || !l.lastActivityAt || daysBetween(l.lastActivityAt, TODAY) >= 7)
      .sort((a, b) => (a.lastActivityAt ?? '').localeCompare(b.lastActivityAt ?? ''))
    const byOwner = new Map<string, Lead[]>()
    for (const lead of rows) {
      const key = lead.ownerUserId as string
      byOwner.set(key, [...(byOwner.get(key) ?? []), lead])
    }
    return [...byOwner.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [open])

  const ownerColumns: Column<OwnerRow>[] = [
    { key: 'name', header: 'Who', accessor: (row) => row.name, sortable: true, minWidth: 180 },
    {
      key: 'open',
      header: 'Open enquiries',
      align: 'right',
      accessor: (row) => formatNumber(row.open),
      sortValue: (row) => row.open,
      sortable: true,
    },
    {
      key: 'fast',
      header: 'Replied within 2 hours',
      align: 'right',
      cell: (row) =>
        row.fastReply === null ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className={row.fastReply < 60 ? 'text-danger-text' : undefined}>{formatPercent(row.fastReply)}</span>
        ),
      sortValue: (row) => row.fastReply ?? -1,
      sortable: true,
    },
    {
      key: 'enrolled',
      header: `Enrolled ${rangeLabel}`,
      align: 'right',
      accessor: (row) => formatNumber(row.enrolled),
      sortValue: (row) => row.enrolled,
      sortable: true,
    },
    {
      key: 'conversion',
      header: 'Enquiries that enrol',
      align: 'right',
      accessor: (row) => (row.conversion === null ? '—' : formatPercent(row.conversion)),
      sortValue: (row) => row.conversion ?? -1,
      sortable: true,
    },
  ]

  return (
    <CrmPage
      title="Team"
      description="How the enquiries are turning into students, and who needs a hand."
      error={error}
      onRetry={retry}
      actions={
        <Select
          aria-label="Period"
          selectSize="sm"
          containerClassName="w-auto min-w-36"
          value={rangeKey}
          onChange={(event) => query.set('range', event.target.value === 'month' ? undefined : event.target.value)}
          options={RANGES}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={`Enrolled ${rangeLabel}`}
            value={formatNumber(enrolments.length)}
            icon={GraduationCap}
            variant="success"
            onClick={() => navigate('/crm/enrolled')}
          />
          <StatCard
            label="Enquiries open"
            value={formatNumber(open.length)}
            icon={Inbox}
            onClick={() => navigate('/crm/enquiries?scope=all')}
          />
          <StatCard
            label="Slow to reply"
            value={formatNumber(slow.length)}
            caption={`No reply, or more than 2 hours, ${rangeLabel}`}
            icon={Clock}
            variant={slow.length > 0 ? 'warning' : 'success'}
            onClick={() => navigate(`/crm/enquiries?scope=all&created=${rangeKey === 'month' ? '30d' : '90d'}&closed=1`)}
          />
          <StatCard
            label="Ready to pay"
            value={formatNumber(ready.length)}
            icon={Wallet}
            onClick={() => navigate('/crm/enquiries?scope=all&stage=payment_pending')}
          />
        </div>

        <Card>
          <CardHeader
            title="Which channels bring paying students"
            description={`Enrolments ${rangeLabel}, by where the enquiry first came from.`}
          />
          <CardBody>
            <BarList rows={channelRows} emptyMessage={`No enquiries came in ${rangeLabel}.`} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="The team" description="Click a name to see their enquiries." />
          <CardBody>
            <DataTable
              data={ownerRows}
              columns={ownerColumns}
              rowKey={(row) => row.userId}
              caption="Each salesperson's open enquiries, reply speed and enrolments"
              density="compact"
              defaultSort={{ key: 'enrolled', direction: 'desc' }}
              emptyTitle="Nobody is handling enquiries yet"
              onRowClick={(row) => navigate(`/crm/enquiries?owner=${row.userId}&scope=all`)}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sitting on enquiries"
            description="Open enquiries with nothing planned, or no contact for a week or more."
            actions={
              <Button size="sm" variant="ghost" asChild>
                <Link to="/crm/enquiries?scope=all&next=none">See all with nothing planned</Link>
              </Button>
            }
          />
          <CardBody>
            {sitting.length === 0 ? (
              <EmptyState size="sm" title="Nothing is sitting" message="Every open enquiry has a next step and recent contact." />
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {sitting.map(([ownerId, rows]) => (
                  <div key={ownerId} className="rounded-xl border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2">
                      <span className="text-body-13 font-semibold text-text">{userNameOf(ownerId as UserId)}</span>
                      <span className="text-body-12 tabular-nums text-text-secondary">{rows.length}</span>
                    </div>
                    <ul className="divide-y divide-border">
                      {rows.slice(0, 5).map((lead) => (
                        <li key={lead.id}>
                          <Link
                            to={`/crm/enquiries/${lead.id}`}
                            className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-surface-hover"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-body-13 font-medium text-text">{nameOf(lead.personId)}</span>
                              <span className="block truncate text-body-12 text-text-secondary">
                                {courseTitle(lead.courseInterestId)}
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-body-12 text-text-secondary">
                              <span className="block">
                                {lead.lastActivityAt
                                  ? `No contact for ${daysBetween(lead.lastActivityAt, TODAY)} days`
                                  : 'Never contacted'}
                              </span>
                              <span className="block">
                                {lead.nextAction ? waitingLabel(lead.daysInStage) : 'Nothing planned'}
                              </span>
                            </span>
                          </Link>
                        </li>
                      ))}
                      {rows.length > 5 && (
                        <li className="px-3 py-2">
                          <Link
                            to={`/crm/enquiries?owner=${ownerId}&scope=all&next=none`}
                            className="text-body-12 font-medium text-accent hover:underline"
                          >
                            and {rows.length - 5} more
                          </Link>
                        </li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </CrmPage>
  )
}
