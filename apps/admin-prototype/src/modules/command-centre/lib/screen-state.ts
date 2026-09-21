import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { demo } from '@/mocks'

export type ScreenStatus = 'loading' | 'error' | 'empty' | 'ready'

const booted = new Set<string>()

export interface ScreenState {
  status: ScreenStatus
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
