import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, Search } from 'lucide-react'

import { cn } from '@/lib/cn'
import { modules } from '@/modules'
import { useCan, useSession } from '@/auth'
import { NAV_GROUPS, moduleInSidebar } from './module-registry'

interface Entry {
  id: string
  label: string
  group: string
  summary: string
  to: string
  icon: React.ComponentType<{ size?: number | string; className?: string }>
}

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const can = useCan()
  const session = useSession()

  const entries = useMemo<Entry[]>(() => {
    const out: Entry[] = []
    for (const mod of modules) {
      if (!moduleInSidebar(mod, session?.persona.id, can)) continue
      const groupLabel = NAV_GROUPS.find((g) => g.id === mod.group)?.label ?? ''
      out.push({
        id: mod.id,
        label: mod.label,
        group: groupLabel,
        summary: mod.summary,
        to: mod.base,
        icon: mod.icon,
      })
      for (const sub of mod.subnav ?? []) {
        if (sub.permission && !can(sub.permission)) continue
        out.push({
          id: `${mod.id}:${sub.to}`,
          label: `${mod.label} › ${sub.label}`,
          group: groupLabel,
          summary: '',
          to: `${mod.base}/${sub.to}`.replace(/\/+/g, '/'),
          icon: mod.icon,
        })
      }
    }
    return out
  }, [session?.role?.id, session?.persona.id])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries.slice(0, 40)
    return entries
      .map((e) => {
        const label = e.label.toLowerCase()
        let score = -1
        if (label.startsWith(q)) score = 0
        else if (label.split(/[\s›]+/).some((w) => w.startsWith(q))) score = 1
        else if (label.includes(q)) score = 2
        else if (e.summary.toLowerCase().includes(q)) score = 3
        return { e, score }
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((r) => r.e)
      .slice(0, 40)
  }, [query, entries])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [index])

  if (!open) return null

  function go(entry: Entry | undefined) {
    if (!entry) return
    navigate(entry.to)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ui-950/30 p-4 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search Cirvee OS"
        className="animate-scale-in w-full max-w-[560px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setIndex((i) => Math.min(i + 1, results.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setIndex((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter') {
            e.preventDefault()
            go(results[index])
          }
        }}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search size={16} className="shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules and screens…"
            aria-label="Search"
            className="h-12 flex-1 bg-transparent text-body-14 outline-none placeholder:text-text-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
            esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-body-13 text-text-secondary">
              No matches for “{query}”
            </div>
          ) : (
            results.map((entry, i) => {
              const Icon = entry.icon
              return (
                <button
                  key={entry.id}
                  data-idx={i}
                  onMouseMove={() => setIndex(i)}
                  onClick={() => go(entry)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                    i === index ? 'bg-accent-subtle' : 'hover:bg-surface-hover',
                  )}
                >
                  <Icon
                    size={16}
                    className={cn('shrink-0', i === index ? 'text-accent' : 'text-text-muted')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-13 font-medium">{entry.label}</span>
                    {entry.summary && (
                      <span className="block truncate text-body-12 text-text-muted">
                        {entry.summary}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-label-10 text-text-muted">{entry.group}</span>
                  {i === index && <CornerDownLeft size={13} className="shrink-0 text-accent" />}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
