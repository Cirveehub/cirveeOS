import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'

import type { BusinessUnit } from '@/app/module-registry'
import type { TabItem } from '@/ui'
import { Alert, Button } from '@/ui'
import { branchesCollection, peopleCollection, unitsCollection, usersCollection } from '@/mocks'
import type { UnitCode } from '@/mocks'

/* -------------------------------------------------------------------------- */
/* Reference lookups                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The store keys units by `UnitId` and carries a `UnitCode`; `UnitTag` keys off
 * the registry's lowercase `BusinessUnit`. This bridges the two.
 *
 * FLAG: belongs in `src/ui/UnitTag.tsx` — every module that renders a money row
 * needs it.
 */
const UNIT_KEY: Record<UnitCode, BusinessUnit> = {
  ACADEMY: 'academy',
  TEENS: 'teens',
  CORPORATE: 'corporate',
  DEXURB: 'dexurb',
  AFRICA: 'africa',
  TCF: 'tcf',
}

export function unitKey(unitId: string | null | undefined): BusinessUnit | null {
  if (!unitId) return null
  const code = unitsCollection.find(unitId)?.code
  return code ? UNIT_KEY[code] : null
}

export function unitName(unitId: string | null | undefined): string {
  if (!unitId) return 'Unassigned'
  return unitsCollection.find(unitId)?.name ?? 'Unassigned'
}

export function branchName(branchId: string | null | undefined): string {
  if (!branchId) return '—'
  return branchesCollection.find(branchId)?.name ?? '—'
}

export function personName(personId: string | null | undefined): string {
  if (!personId) return '—'
  const person = peopleCollection.find(personId)
  return person ? `${person.firstName} ${person.lastName}` : '—'
}

export function userName(userId: string | null | undefined): string {
  if (!userId) return '—'
  const user = usersCollection.find(userId)
  return user ? personName(user.personId) : '—'
}

/* -------------------------------------------------------------------------- */
/* Screen state                                                               */
/* -------------------------------------------------------------------------- */

const FORCE_ERROR_KEY = 'cirvee-os:force-error'

function consumeForcedError(): boolean {
  try {
    if (sessionStorage.getItem(FORCE_ERROR_KEY) !== '1') return false
    sessionStorage.removeItem(FORCE_ERROR_KEY)
    return true
  } catch {
    return false
  }
}

export interface ScreenState {
  loading: boolean
  error: string | null
  retry: () => void
}

/**
 * The spec's §0.5 loading contract: a short delay on mount so the skeleton is
 * visible in a demo, and a failure path reachable from Settings → Demo controls
 * → "Force error on next load".
 */
export function useScreenState(delayMs = 400): ScreenState {
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      setLoading(false)
      if (consumeForcedError()) setError('Could not reach the finance ledger. Nothing was changed.')
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [attempt, delayMs])

  return { loading, error, retry: () => setAttempt((n) => n + 1) }
}

export function ScreenError({ state }: { state: ScreenState }) {
  if (!state.error) return null
  return (
    <Alert
      tone="danger"
      title="This view could not load"
      className="mb-6"
      action={
        <Button size="sm" variant="secondary" leftIcon={<RefreshCw size={16} />} onClick={state.retry}>
          Retry
        </Button>
      }
    >
      {state.error}
    </Alert>
  )
}

/* -------------------------------------------------------------------------- */
/* Module navigation                                                          */
/* -------------------------------------------------------------------------- */

export const FINANCE_TABS: TabItem[] = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'unit-pl', label: 'Unit P&L' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'accounts', label: 'Student accounts' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'payments', label: 'Payments' },
  { id: 'bank-transactions', label: 'Bank feed' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'refunds', label: 'Refunds' },
]

export function useModuleNav() {
  const navigate = useNavigate()
  // `PageHeader` hides its whole tab strip when `activeTab` is falsy, so the
  // dashboard tab can't use `id: ''` the way its own route does — it uses the
  // sentinel `'overview'` instead, mapped back to the bare module path here.
  return (id: string) => navigate(id === 'overview' ? '/finance' : `/finance/${id}`)
}

/* -------------------------------------------------------------------------- */
/* Small layout helpers                                                       */
/* -------------------------------------------------------------------------- */

export function Page({ children }: { children: ReactNode }) {
  return <div className="px-8 py-8 pb-16">{children}</div>
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{children}</div>
}

/** Matches `text-label-11` headings used above dense sub-lists. */
export function Caption({ children }: { children: ReactNode }) {
  return <p className="text-body-13 text-text-secondary">{children}</p>
}
