import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { ShieldCheck } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber, formatPercent, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  SkeletonTable,
  type Column,
} from '@/ui'
import {
  TODAY,
  policyVersionsCollection,
  ticketsCollection,
  useCollection,
  type Ticket,
} from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, percent, useModuleData, usePersonName, useUserName } from './parts'

const PRIORITIES: Array<Ticket['priority']> = ['urgent', 'high', 'normal', 'low']

interface PolicyRow {
  priority: Ticket['priority']
  firstResponseTarget: string
  resolutionTarget: string
  tickets: number
  met: number
  breached: number
  compliance: number
}

export default function SupportSla() {
  const tickets = useCollection(ticketsCollection)
  const policies = useCollection(policyVersionsCollection)
  const personName = usePersonName()
  const userName = useUserName()

  const { loading, error, rows, retry } = useModuleData(tickets, 'support.sla')

  const activeSla = useMemo(
    () =>
      policies.find(
        (p) =>
          p.kind === 'sla' &&
          p.status === 'active' &&
          p.effectiveFrom <= TODAY &&
          (p.effectiveTo === null || p.effectiveTo >= TODAY),
      ),
    [policies],
  )

  const firstResponseHours =
    typeof activeSla?.config.ticketFirstResponseHours === 'number'
      ? activeSla.config.ticketFirstResponseHours
      : null

  const policyRows: PolicyRow[] = useMemo(
    () =>
      PRIORITIES.map((priority) => {
        const mine = rows.filter((t) => t.priority === priority)
        const met = mine.filter((t) => t.slaState === 'within').length
        const breached = mine.filter((t) => t.slaState === 'breached').length
        return {
          priority,
          firstResponseTarget:
            firstResponseHours === null ? 'Not set' : `${firstResponseHours} hours`,
          resolutionTarget: 'Not set',
          tickets: mine.length,
          met,
          breached,
          compliance: percent(met, mine.length),
        }
      }).filter((row) => row.tickets > 0),
    [rows, firstResponseHours],
  )

  const breaches = useMemo(
    () => rows.filter((t) => t.slaState === 'breached').sort((a, b) => a.createdAtTime.localeCompare(b.createdAtTime)),
    [rows],
  )

  const policyColumns: Array<Column<PolicyRow>> = [
    {
      key: 'priority',
      header: 'Priority',
      cell: (r) => <Badge tone={r.priority === 'urgent' ? 'danger' : r.priority === 'high' ? 'warning' : 'neutral'}>{humanize(r.priority)}</Badge>,
      sortValue: (r) => PRIORITIES.indexOf(r.priority),
      width: 130,
    },
    {
      key: 'first',
      header: 'First-response target',
      accessor: (r) => r.firstResponseTarget,
      width: 190,
    },
    {
      key: 'resolution',
      header: 'Resolution target',
      cell: (r) => <span className="text-text-secondary">{r.resolutionTarget}</span>,
      sortValue: (r) => r.resolutionTarget,
      width: 170,
    },
    {
      key: 'tickets',
      header: 'Tickets in period',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.tickets,
      accessor: (r) => formatNumber(r.tickets),
      width: 150,
    },
    {
      key: 'met',
      header: 'Met',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.met,
      accessor: (r) => formatNumber(r.met),
      width: 90,
    },
    {
      key: 'breached',
      header: 'Breached',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.breached,
      cell: (r) => (
        <span className={r.breached > 0 ? 'text-danger-text tabular-nums' : 'tabular-nums'}>
          {formatNumber(r.breached)}
        </span>
      ),
      width: 110,
    },
    {
      key: 'compliance',
      header: 'Compliance',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.compliance,
      cell: (r) => (
        <span
          className={
            r.compliance >= 90 ? 'text-success-text tabular-nums' : 'text-warning-text tabular-nums'
          }
        >
          {formatPercent(r.compliance)}
        </span>
      ),
      width: 130,
    },
  ]

  const breachColumns: Array<Column<Ticket>> = [
    {
      key: 'ref',
      header: 'Ticket',
      sortable: true,
      sortValue: (t) => t.ref,
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate text-body-13 text-text">{t.subject}</p>
          <p className="font-mono text-body-12 text-text-secondary">{t.ref}</p>
        </div>
      ),
      minWidth: 300,
    },
    {
      key: 'requester',
      header: 'Requester',
      sortable: true,
      sortValue: (t) => personName(t.requesterPersonId),
      accessor: (t) => personName(t.requesterPersonId),
      minWidth: 180,
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      sortValue: (t) => PRIORITIES.indexOf(t.priority),
      accessor: (t) => humanize(t.priority),
      width: 110,
    },
    {
      key: 'raised',
      header: 'Raised',
      sortable: true,
      sortValue: (t) => t.createdAtTime,
      accessor: (t) => formatDateTime(t.createdAtTime),
      width: 170,
    },
    {
      key: 'first',
      header: 'First response',
      sortable: true,
      sortValue: (t) => t.firstResponseAt ?? '',
      accessor: (t) => (t.firstResponseAt ? formatDateTime(t.firstResponseAt) : 'Never'),
      width: 170,
    },
    {
      key: 'age',
      header: 'Open for',
      align: 'right',
      sortable: true,
      sortValue: (t) => t.createdAtTime,
      accessor: (t) =>
        `${Math.max(
          0,
          Math.round((Date.parse(`${TODAY}T23:59:59Z`) - Date.parse(t.createdAtTime)) / 86_400_000),
        )}d`,
      width: 110,
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (t) => (t.ownerUserId ? userName(t.ownerUserId) : ''),
      accessor: (t) => (t.ownerUserId ? userName(t.ownerUserId) : 'Unassigned'),
      minWidth: 170,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (t) => t.status,
      accessor: (t) => humanize(t.status),
      width: 150,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="SLA report"
        description="Compliance against the targets held in the active SLA policy version."
        actions={
          <Button variant="secondary" size="sm" asChild>
            <Link to="/settings/policies">Open policies</Link>
          </Button>
        }
      />

      {error ? (
        <ErrorPanel what="The SLA report" onRetry={retry} />
      ) : loading ? (
        <SkeletonTable rows={6} columns={7} />
      ) : (
        <div className="space-y-6">
          {activeSla ? (
            <Alert tone="info" title={`Targets come from SLA policy version ${activeSla.version}`}>
              Effective from {formatDate(activeSla.effectiveFrom)}
              {activeSla.effectiveTo ? ` to ${formatDate(activeSla.effectiveTo)}` : ' with no end date'}.
              The active version sets one organisation-wide first-response target and no resolution
              target, so the per-priority rows below share it. Varying the target by priority is a policy
              change, not a code change.
            </Alert>
          ) : (
            <Alert tone="warning" title="No SLA policy version is active">
              Nothing defines a target, so compliance below is measured only against the state already
              recorded on each ticket.
            </Alert>
          )}

          <Card padding="none">
            <CardHeader title="Compliance by priority" />
            <DataTable
              data={policyRows}
              columns={policyColumns}
              rowKey={(r) => r.priority}
              caption="SLA compliance by priority"
              emptyTitle="No tickets in this period"
              emptyMessage="Compliance cannot be measured until tickets exist."
            />
          </Card>

          <Card padding="none">
            <CardHeader
              title="Breaches"
              description="Every ticket currently past its target, oldest first."
            />
            {breaches.length === 0 ? (
              <CardBody>
                <EmptyState
                  icon={ShieldCheck}
                  title="Nothing is breaching"
                  message="Every open ticket is inside its target. This is the state to keep."
                  size="sm"
                  bordered={false}
                />
              </CardBody>
            ) : (
              <DataTable
                data={breaches}
                columns={breachColumns}
                rowKey={(t) => t.id as string}
                density="compact"
                minWidth={1500}
                caption="Tickets breaching their SLA"
              />
            )}
          </Card>
        </div>
      )}
    </Screen>
  )
}
