/**
 * The four standard states (screen-spec §0.5), made reachable.
 *
 * Loading is a real 400ms first-mount delay so the skeleton is visible in a
 * demo rather than theoretical. Error and empty are driven by the store's demo
 * controls (`demo.forceError` / `demo.forceEmpty`, wired from Settings) and,
 * because Settings is another team's module, also by `?state=` on the URL so a
 * reviewer can reach every state from a link today.
 */

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { demo } from '@/mocks'

export type ScreenStatus = 'loading' | 'error' | 'empty' | 'ready'

/** First mount per scope, per tab — a demo should see the skeleton once. */
const booted = new Set<string>()

export interface ScreenState {
  status: ScreenStatus
  /** Clears the forced error and re-runs the load. */
  retry: () => void
}

export function useScreenState(scope: string): ScreenState {
  const [params] = useSearchParams()
  const forced = params.get('state')

  const [booting, setBooting] = useState(() => !booted.has(scope))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!booting) return
    const timer = window.setTimeout(() => {
      booted.add(scope)
      setBooting(false)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [booting, scope, attempt])

  const retry = useCallback(() => {
    demo.clearError(scope)
    setBooting(true)
    setAttempt((n) => n + 1)
  }, [scope])

  let status: ScreenStatus = 'ready'
  if (booting || forced === 'loading') status = 'loading'
  else if (forced === 'error' || demo.isErrored(scope)) status = 'error'
  else if (forced === 'empty' || demo.isEmpty(scope)) status = 'empty'

  return { status, retry }
}
