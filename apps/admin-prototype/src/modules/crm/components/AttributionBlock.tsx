/**
 * The three-field block.
 *
 * Referrer, lead owner and closer, boxed and labelled so nobody misses that
 * they are three independent fields holding three different people. The PRD
 * calls this out as a non-negotiable because the current system derives the
 * closer from the owner and loses the referrer entirely.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Button, PersonChip } from '@/ui'
import type { PersonId, UserId } from '@/mocks/types'
import { personIdForUser, useDirectory, userRoleName } from '../lib/lookups'

export interface AttributionBlockProps {
  referrerPersonId: PersonId | null
  ownerUserId: UserId | null
  closerUserId: UserId | null
  onChangeReferrer?: () => void
  onReassignOwner?: () => void
  onSetCloser?: () => void
  /** Extra line under the block — the referral code, say. */
  footnote?: ReactNode
}

export function AttributionBlock({
  referrerPersonId,
  ownerUserId,
  closerUserId,
  onChangeReferrer,
  onReassignOwner,
  onSetCloser,
  footnote,
}: AttributionBlockProps) {
  const { nameOf, userNameOf } = useDirectory()

  const ownerPersonId = personIdForUser(ownerUserId)
  const closerPersonId = personIdForUser(closerUserId)

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-3 py-2">
        <h3 className="text-label-11 text-text-label">Attribution</h3>
        <p className="mt-1 text-body-12 text-text-secondary">
          Three independent fields. The person who brought the lead is frequently not the person who
          closed it.
        </p>
      </div>

      <dl className="divide-y divide-border">
        <Row
          term="Referrer"
          hint="Who brought this person to Cirvee"
          action={onChangeReferrer ? { label: 'Change', onClick: onChangeReferrer } : undefined}
        >
          {referrerPersonId ? (
            <Link to="/crm/leads" className="rounded-lg">
              <PersonChip name={nameOf(referrerPersonId)} size="sm" role="Referrer" />
            </Link>
          ) : (
            <NotSet />
          )}
        </Row>

        <Row
          term="Lead owner"
          hint="Who is working the lead"
          action={onReassignOwner ? { label: 'Reassign', onClick: onReassignOwner } : undefined}
        >
          {ownerUserId ? (
            <Link to="/crm/leads" className="rounded-lg">
              <PersonChip
                name={userNameOf(ownerUserId)}
                size="sm"
                role={userRoleName(ownerUserId) || 'Staff'}
              />
            </Link>
          ) : (
            <NotSet />
          )}
        </Row>

        <Row
          term="Closer"
          hint="Who actually closed it"
          action={onSetCloser ? { label: closerUserId ? 'Change' : 'Set', onClick: onSetCloser } : undefined}
        >
          {closerUserId ? (
            <Link to="/crm/leads" className="rounded-lg">
              <PersonChip
                name={userNameOf(closerUserId)}
                size="sm"
                role={userRoleName(closerUserId) || 'Staff'}
              />
            </Link>
          ) : (
            <NotSet />
          )}
        </Row>
      </dl>

      {footnote && <div className="border-t border-border px-3 py-2 text-body-12 text-text-secondary">{footnote}</div>}
    </div>
  )
}

function Row({
  term,
  hint,
  action,
  children,
}: {
  term: string
  hint: string
  action?: { label: string; onClick: () => void }
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <div className="w-24 shrink-0">
        <dt className="text-body-13 font-semibold text-text">{term}</dt>
        <p className="mt-0.5 text-body-12 text-text-muted">{hint}</p>
      </div>
      <dd className="min-w-0 flex-1">{children}</dd>
      {action && (
        <Button variant="link" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

function NotSet() {
  return <span className="text-body-13 text-text-secondary">— not set —</span>
}
