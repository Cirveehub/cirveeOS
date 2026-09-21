import type { ReactNode } from 'react'
import { Button, PersonChip } from '@/ui'
import type { PersonId, UserId } from '@/mocks/types'
import { useDirectory, userRoleName } from '../lib/lookups'

export interface ThreePeopleProps {
  referrerPersonId: PersonId | null
  ownerUserId: UserId | null
  closerUserId: UserId | null
  onChangeReferrer?: () => void
  onReassignOwner?: () => void
  onSetCloser?: () => void
  footer?: ReactNode
}

export function ThreePeople({
  referrerPersonId,
  ownerUserId,
  closerUserId,
  onChangeReferrer,
  onReassignOwner,
  onSetCloser,
  footer,
}: ThreePeopleProps) {
  const { nameOf, userNameOf } = useDirectory()

  return (
    <div className="rounded-xl border border-border bg-surface">
      <dl className="divide-y divide-border">
        <Row term="Referred by" action={onChangeReferrer ? { label: 'Change', onClick: onChangeReferrer } : undefined}>
          {referrerPersonId ? (
            <PersonChip name={nameOf(referrerPersonId)} size="sm" />
          ) : (
            <Muted>Nobody</Muted>
          )}
        </Row>
        <Row term="Handled by" action={onReassignOwner ? { label: 'Change', onClick: onReassignOwner } : undefined}>
          {ownerUserId ? (
            <PersonChip name={userNameOf(ownerUserId)} size="sm" role={userRoleName(ownerUserId) || undefined} />
          ) : (
            <Muted>Nobody yet</Muted>
          )}
        </Row>
        <Row term="Closed by" action={onSetCloser ? { label: closerUserId ? 'Change' : 'Set', onClick: onSetCloser } : undefined}>
          {closerUserId ? (
            <PersonChip name={userNameOf(closerUserId)} size="sm" role={userRoleName(closerUserId) || undefined} />
          ) : (
            <Muted>Not yet</Muted>
          )}
        </Row>
      </dl>
      {footer && <div className="border-t border-border px-3 py-2 text-body-12 text-text-secondary">{footer}</div>}
    </div>
  )
}

function Row({
  term,
  action,
  children,
}: {
  term: string
  action?: { label: string; onClick: () => void }
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <dt className="w-24 shrink-0 text-body-13 font-semibold text-text">{term}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
      {action && (
        <Button variant="link" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-body-13 text-text-secondary">{children}</span>
}
