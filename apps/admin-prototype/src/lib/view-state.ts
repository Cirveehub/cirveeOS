import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { demo } from '@/mocks'
import type { SortState } from '@/ui'

export interface QueryState {
  get: (key: string) => string | undefined
  getList: (key: string) => string[]
  set: (key: string, value: string | undefined) => void
  setList: (key: string, values: string[]) => void
  setMany: (patch: Record<string, string | undefined>) => void
  clear: (keep?: string[]) => void
  activeCount: (keys: string[]) => number
  params: URLSearchParams
}

export function useQueryState(): QueryState {
  const [params, setParams] = useSearchParams()

  const set = useCallback(
    (key: string, value: string | undefined) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (value === undefined || value === '') next.delete(key)
          else next.set(key, value)
          if (key !== 'page') next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const setMany = useCallback(
    (patch: Record<string, string | undefined>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === '') next.delete(key)
            else next.set(key, value)
          }
          next.delete('page')
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  return useMemo<QueryState>(
    () => ({
      params,
      get: (key) => params.get(key) ?? undefined,
      getList: (key) => (params.get(key) ?? '').split(',').filter(Boolean),
      set,
      setList: (key, values) => set(key, values.length ? values.join(',') : undefined),
      setMany,
      clear: (keep = []) => {
        setParams(
          (prev) => {
            const next = new URLSearchParams()
            for (const key of keep) {
              const value = prev.get(key)
              if (value) next.set(key, value)
            }
            return next
          },
          { replace: true },
        )
      },
      activeCount: (keys) => keys.filter((key) => Boolean(params.get(key))).length,
    }),
    [params, set, setMany, setParams],
  )
}

export function parseSort(raw: string | undefined): SortState | null {
  if (!raw) return null
  return raw.startsWith('-')
    ? { key: raw.slice(1), direction: 'desc' }
    : { key: raw, direction: 'asc' }
}

export function serialiseSort(sort: SortState | null): string | undefined {
  if (!sort) return undefined
  return sort.direction === 'desc' ? `-${sort.key}` : sort.key
}

export interface ModuleLoadState {
  loading: boolean
  error: string | null
  retry: () => void
}

export function useScreenLoad(scope: string): ModuleLoadState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      if (demo.isErrored(scope) && attempt === 0) {
        setError('Could not load this view. The data source did not respond.')
      }
      setLoading(false)
    }, 400)
    return () => window.clearTimeout(timer)
  }, [scope, attempt])

  const retry = useCallback(() => {
    demo.clearError(scope)
    setAttempt((n) => n + 1)
  }, [scope])

  return { loading, error, retry }
}

export function paginate<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize
  return rows.slice(start, start + pageSize)
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`
  const body = [headers, ...rows].map((row) => row.map(escape).join(',')).join('\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
