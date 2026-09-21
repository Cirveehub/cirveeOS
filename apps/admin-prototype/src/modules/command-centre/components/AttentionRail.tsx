import { AlertTriangle, Banknote, Clock, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { needsAttentionStudents, stalledLeads, unmatchedPayments } from '@/mocks'
import { formatDate, formatNumber, humanize, pluralize } from '@/lib/format'
import { Badge, Card, CardHeader, EmptyState, MoneyCell } from '@/ui'

import { personName, userName } from '../lib/names'

const ROWS = 5

interface RailPanelProps {
  title: string
  icon: LucideIcon
  count: number
  viewAllTo: string
  emptyTitle: string
  emptyMessage: string
  children: ReactNode
}

function RailPanel({
  title,
  icon: Icon,
  count,
  viewAllTo,
  emptyTitle,
  emptyMessage,
  children,
}: RailPanelProps) {
  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Icon size={16} aria-hidden="true" className="text-text-muted" />
            {title}
          </span>
        }
        actions={
          count > 0 ? (
            <Link
              to={viewAllTo}
              className="rounded-lg text-body-13 font-semibold text-accent hover:underline underline-offset-2"
            >
              View all {formatNumber(count)}
            </Link>
          ) : undefined
        }
      />
      {count === 0 ? (
        <EmptyState size="sm" title={emptyTitle} message={emptyMessage} />
      ) : (
        <ul className="divide-y divide-border">{children}</ul>
      )}
    </Card>
  )
}

function RailRow({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link to={to} className="block px-6 py-2.5 transition-colors hover:bg-surface-hover">
        {children}
      </Link>
    </li>
  )
}

export function AttentionRail() {
  const students = needsAttentionStudents()
  const payments = unmatchedPayments()
  const stalled = stalledLeads()

  return (
    <div className="space-y-4">
      <RailPanel
        title="Needs-attention students"
        icon={AlertTriangle}
        count={students.length}
        viewAllTo="/academy/students?flagged=true"
        emptyTitle="No students flagged"
        emptyMessage="Flags are advisory and are raised from attendance, LMS activity, assignments and balance. None are open."
      >
        {students.slice(0, ROWS).map((student) => (
          <RailRow key={student.enrollmentId} to={`/academy/students/${student.personId}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body-14 font-medium text-text">{student.name}</span>
              <span className="shrink-0 text-body-12 text-text-secondary tabular-nums">
                {pluralize(student.daysFlagged, 'day')}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-body-12 text-text-secondary">{student.cohortCode}</span>
              {student.flags.map((flag) => (
                <Badge key={flag} tone="warning" size="sm">
                  {humanize(flag)}
                </Badge>
              ))}
            </div>
          </RailRow>
        ))}
      </RailPanel>

      <RailPanel
        title="Unmatched payments"
        icon={Banknote}
        count={payments.length}
        viewAllTo="/finance/reconciliation"
        emptyTitle="Every payment is matched"
        emptyMessage="Unmatched credits are never auto-assigned — they stay here until someone confirms the invoice."
      >
        {payments.slice(0, ROWS).map((payment) => (
          <RailRow key={payment.id} to={`/finance/reconciliation?payment=${payment.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body-14 font-medium text-text">{payment.payerName}</span>
              <MoneyCell kobo={payment.amount} className="w-auto shrink-0" />
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="truncate font-mono text-body-12 text-text-secondary">
                {payment.payerReference}
              </span>
              <span className="shrink-0 text-body-12 text-text-secondary tabular-nums">
                {formatDate(payment.receivedAt)} · {pluralize(payment.daysUnmatched, 'day')} unmatched
              </span>
            </div>
          </RailRow>
        ))}
      </RailPanel>

      <RailPanel
        title="Stalled leads"
        icon={Clock}
        count={stalled.length}
        viewAllTo="/crm/leads?sort=-daysInStage"
        emptyTitle="Nothing has stalled"
        emptyMessage="No open lead has sat in the same stage for fourteen days or more."
      >
        {stalled.slice(0, ROWS).map((lead) => (
          <RailRow key={lead.id} to={`/crm/leads/${lead.id}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-body-14 font-medium text-text">
                {personName(lead.personId)}
              </span>
              <span className="shrink-0 text-body-12 text-danger-text tabular-nums">
                {pluralize(lead.daysInStage, 'day')} in stage
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <Badge tone="neutral" size="sm">
                {humanize(lead.stage)}
              </Badge>
              <span className="truncate text-body-12 text-text-secondary">
                {userName(lead.ownerUserId)}
              </span>
            </div>
          </RailRow>
        ))}
      </RailPanel>
    </div>
  )
}
