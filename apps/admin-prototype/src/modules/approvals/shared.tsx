/**
 * Shared vocabulary for the Work, Documents & Approvals module.
 *
 * Nothing in here renders a screen. It holds the lookups every screen needs
 * (who is this user, what unit is this, how long until escalation), the type
 * metadata that keeps one engine looking like one engine across nine request
 * types, and the four standard states wrapped into one hook.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Banknote,
  BadgePercent,
  CalendarDays,
  FileSignature,
  Gavel,
  PackageSearch,
  ReceiptText,
  Scale,
  TrendingUp,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { BusinessUnit } from '@/app/module-registry'
import { Tabs, type BadgeTone, type TabItem } from '@/ui'
import {
  branchesCollection,
  peopleCollection,
  rolesCollection,
  unitsCollection,
  usersCollection,
  CURRENT_USER_ID,
  TODAY,
  atTime,
} from '@/mocks'
import type { ApprovalRequest, ApprovalType, SlaState, UserId } from '@/mocks'

/* -------------------------------------------------------------------------- */
/* The acting user                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Prototype scaffolding. Flow 3 needs the reviewer to stop being the requester
 * so the self-approval block can be lifted legitimately — the spec puts that
 * control in `/settings/demo`, which this module does not own, so it lives
 * here as a header affordance until Settings ships one.
 */
const ACTING_KEY = 'cirvee-os:acting-user'

function readActing(): UserId {
  try {
    const raw = sessionStorage.getItem(ACTING_KEY)
    if (raw) return raw as UserId
  } catch {
    /* storage blocked — fall through to the signed-in user */
  }
  return CURRENT_USER_ID as UserId
}

let actingUser: UserId = readActing()
const actingListeners = new Set<() => void>()

export function setActingUser(id: UserId) {
  actingUser = id
  try {
    sessionStorage.setItem(ACTING_KEY, id)
  } catch {
    /* in-memory only */
  }
  actingListeners.forEach((l) => l())
}

function subscribeActing(listener: () => void) {
  actingListeners.add(listener)
  return () => {
    actingListeners.delete(listener)
  }
}

function getActing(): UserId {
  return actingUser
}

export function useActingUser(): UserId {
  return useSyncExternalStore(subscribeActing, getActing, getActing)
}

/** Non-reactive read, for engine functions called from event handlers. */
export function currentActingUser(): UserId {
  return actingUser
}

/* -------------------------------------------------------------------------- */
/* Lookups                                                                    */
/* -------------------------------------------------------------------------- */

export function userName(userId: string | null | undefined): string {
  if (!userId) return 'Unassigned'
  if (userId === 'system') return 'Cirvee OS'
  const user = usersCollection.find(userId)
  if (!user) return 'Unknown user'
  const person = peopleCollection.find(user.personId)
  return person ? `${person.firstName} ${person.lastName}` : user.email
}

export function userRoleName(userId: string | null | undefined): string {
  if (!userId) return ''
  if (userId === 'system') return 'Automation'
  const user = usersCollection.find(userId)
  const role = user?.roleIds[0] ? rolesCollection.find(user.roleIds[0]) : undefined
  return role?.name ?? ''
}

export function personName(personId: string | null | undefined): string {
  if (!personId) return 'Unknown'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown'
}

export function roleName(roleId: string | null | undefined): string {
  if (!roleId) return 'No escalation'
  return rolesCollection.find(roleId)?.name ?? roleId
}

export function branchName(branchId: string | null | undefined): string {
  if (!branchId) return '—'
  return branchesCollection.find(branchId)?.name ?? '—'
}

export function unitName(unitId: string | null | undefined): string {
  if (!unitId) return '—'
  return unitsCollection.find(unitId)?.name ?? '—'
}

/** `UnitTag` takes the lowercase business-unit key; the store holds the code. */
export function unitKey(unitId: string | null | undefined): BusinessUnit | null {
  if (!unitId) return null
  const code = unitsCollection.find(unitId)?.code
  return code ? (code.toLowerCase() as BusinessUnit) : null
}

export function userOptions(): Array<{ value: string; label: string }> {
  return usersCollection
    .all()
    .map((u) => ({ value: u.id as string, label: `${userName(u.id)} · ${userRoleName(u.id)}` }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/* -------------------------------------------------------------------------- */
/* Request types                                                              */
/* -------------------------------------------------------------------------- */

export interface ApprovalTypeMeta {
  label: string
  icon: LucideIcon
  /** Financial types carry an amount; the rest leave the column blank. */
  financial: boolean
  /** Raised by a person, rather than produced by another module. */
  raisable: boolean
  blurb: string
}

export const APPROVAL_TYPE_META: Record<ApprovalType, ApprovalTypeMeta> = {
  expense: { label: 'Expense', icon: ReceiptText, financial: true, raisable: true, blurb: 'Spend against a budget line.' },
  refund: { label: 'Refund', icon: Banknote, financial: true, raisable: true, blurb: 'Return tuition already collected.' },
  discount: { label: 'Discount', icon: BadgePercent, financial: true, raisable: true, blurb: 'Reduce a quoted fee before invoicing.' },
  leave: { label: 'Leave', icon: CalendarDays, financial: false, raisable: true, blurb: 'Annual, study, compassionate or sick leave.' },
  hire: { label: 'Hire', icon: UserPlus, financial: true, raisable: true, blurb: 'Open a role and commit annual payroll.' },
  salary_change: { label: 'Salary change', icon: TrendingUp, financial: true, raisable: true, blurb: 'Confirm, promote or adjust compensation.' },
  procurement: { label: 'Procurement', icon: PackageSearch, financial: true, raisable: true, blurb: 'Buy equipment, furniture or services.' },
  contract_signature: { label: 'Contract signature', icon: FileSignature, financial: true, raisable: true, blurb: 'Countersign a client or vendor agreement.' },
  commission_dispute: { label: 'Commission dispute', icon: Scale, financial: true, raisable: true, blurb: 'Contest how a commission was computed.' },
  commission_approval: { label: 'Commission approval', icon: Wallet, financial: true, raisable: false, blurb: 'Raised by the referral module when commissions are earned.' },
  payout: { label: 'Payout', icon: Gavel, financial: true, raisable: false, blurb: 'Raised by Finance when a payout batch is prepared.' },
}

export const RAISABLE_TYPES: ApprovalType[] = (Object.keys(APPROVAL_TYPE_META) as ApprovalType[]).filter(
  (t) => APPROVAL_TYPE_META[t].raisable,
)

export const ALL_APPROVAL_TYPES: ApprovalType[] = Object.keys(APPROVAL_TYPE_META) as ApprovalType[]

export function typeLabel(type: ApprovalType): string {
  return APPROVAL_TYPE_META[type].label
}

export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'returned_for_information',
  'withdrawn',
  'expired',
] as const

export const STATUS_LABEL: Record<ApprovalRequest['status'], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  returned_for_information: 'Returned for information',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
}

/* -------------------------------------------------------------------------- */
/* SLA and escalation                                                         */
/* -------------------------------------------------------------------------- */

export const NOW_ISO = atTime(TODAY, 9, 0)

export const SLA_LABEL: Record<SlaState, string> = {
  within: 'Within SLA',
  due_today: 'Due today',
  breached: 'Breached',
}

export const SLA_TONE: Record<SlaState, BadgeTone> = {
  within: 'success',
  due_today: 'warning',
  breached: 'danger',
}

/** Returned-for-information pauses the clock — the PRD's third outcome. */
export function slaIsPaused(request: ApprovalRequest): boolean {
  return request.status === 'returned_for_information'
}

export function hoursUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.round((Date.parse(iso) - Date.parse(NOW_ISO)) / 3_600_000)
}

export function formatHours(hours: number): string {
  if (hours <= 0) return 'now'
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/** "Escalates to Musa Ibrahim in 6h", or the overdue equivalent. */
export function escalationLabel(request: ApprovalRequest): string | null {
  if (request.status !== 'pending' || !request.escalatesToUserId) return null
  const hours = hoursUntil(request.escalatesAt)
  const target = userName(request.escalatesToUserId)
  if (hours === null) return `Escalates to ${target}`
  if (hours <= 0) return `Escalation to ${target} is due`
  return `Escalates to ${target} in ${formatHours(hours)}`
}

export function ageLabel(request: ApprovalRequest): string {
  const hours = request.ageHours
  if (hours < 48) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}

/* -------------------------------------------------------------------------- */
/* The four standard states                                                   */
/* -------------------------------------------------------------------------- */

export interface ScreenState {
  loading: boolean
  error: string | null
  retry: () => void
}

/**
 * Every DEEP screen shows a skeleton on first mount, and can be pushed into a
 * recoverable error by appending `?demo=error` to the URL — the spec puts that
 * switch in Settings → Demo controls, which this module does not own.
 */
export function useScreenState(forceError = false): ScreenState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      setLoading(false)
      if (forceError && attempt === 0) {
        setError('Could not load this view. The approval service did not respond.')
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [forceError, attempt])

  return {
    loading,
    error,
    retry: () => setAttempt((a) => a + 1),
  }
}

/* -------------------------------------------------------------------------- */
/* Small presentational helpers reused across the module                      */
/* -------------------------------------------------------------------------- */

export const STEP_STATE_TONE: Record<string, BadgeTone> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  returned: 'info',
  not_reached: 'neutral',
  skipped: 'neutral',
}

export const STEP_STATE_LABEL: Record<string, string> = {
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
  returned: 'Returned',
  not_reached: 'Not yet reached',
  skipped: 'Skipped',
}

export const BREACH_ICON = AlertTriangle

/* -------------------------------------------------------------------------- */
/* Page-level navigation                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Each of these is now its own real sidebar row (`index.tsx`'s
 * `expandSubnavInSidebar` subnav), not a tab on a shared dashboard — the
 * same pattern already used for Teaching and for People's Hiring/Workforce/
 * Time-and-leave groups. Two of those rows still cover more than one screen
 * apiece — "Approvals" is the inbox plus the requester's own request list
 * plus the routing config that decides who an approval goes to next, and
 * "Documents" is the generated-document register plus the templates it is
 * rendered from — so those two keep a second-row tab strip, wired to real
 * navigation instead of a query-param view switch.
 */
export type WorkGroup = 'approvals' | 'documents'

export const WORK_GROUP_CHILDREN: Record<WorkGroup, TabItem[]> = {
  approvals: [
    { id: 'approvals', label: 'Inbox' },
    { id: 'requests', label: 'My requests' },
    { id: 'approval-routes', label: 'Routes' },
  ],
  documents: [
    { id: 'documents', label: 'Documents' },
    { id: 'templates', label: 'Templates' },
  ],
}

export function WorkGroupTabs({ group, active }: { group: WorkGroup; active: string }) {
  const navigate = useNavigate()
  return (
    <Tabs
      tabs={WORK_GROUP_CHILDREN[group]}
      value={active}
      onChange={(id) => navigate(`/work/${id}`)}
      size="sm"
      aria-label={`${group} sections`}
      className="mb-6"
    />
  )
}
