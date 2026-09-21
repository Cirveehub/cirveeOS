import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'

import { cn } from '@/lib/cn'
import { PERSONAS_BY_DEPARTMENT, signIn, type Persona } from '@/auth'

export default function Login() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return PERSONAS_BY_DEPARTMENT
    return PERSONAS_BY_DEPARTMENT.map((g) => ({
      ...g,
      personas: g.personas.filter((p) => p.label.toLowerCase().includes(q)),
    })).filter((g) => g.personas.length > 0)
  }, [query])

  function enter(persona: Persona) {
    signIn(persona.id)
    navigate('/home', { replace: true })
  }

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto w-full max-w-[1000px] px-6 py-14">
        <header className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-2.5">
            <img src="/favicon.png" alt="" className="size-8" />
            <span className="text-[17px] font-bold tracking-tight">cirvee os</span>
          </div>

          <h1 className="text-display-32">Sign in as</h1>

          <div className="mt-5 w-full max-w-xs">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3">
              <Search size={15} className="shrink-0 text-text-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a role"
                aria-label="Find a role"
                className="h-10 w-full bg-transparent text-body-14 outline-none placeholder:text-text-muted"
              />
            </div>
          </div>
        </header>

        {groups.length === 0 ? (
          <p className="py-16 text-center text-body-14 text-text-secondary">
            No role matches &ldquo;{query}&rdquo;.
          </p>
        ) : (
          <div className="space-y-7">
            {groups.map((group) => (
              <section key={String(group.id)}>
                <h2 className="mb-2.5 text-label-11 text-text-muted">{group.label}</h2>
                <div className="flex flex-wrap gap-2">
                  {group.personas.map((persona) => (
                    <RoleButton key={persona.id} persona={persona} onSelect={() => enter(persona)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RoleButton({ persona, onSelect }: { persona: Persona; onSelect: () => void }) {
  const Icon = persona.icon

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-surface py-2 pl-2.5 pr-3.5 text-body-13 font-medium text-text',
        'transition-colors hover:border-accent hover:bg-accent-wash hover:text-accent',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      )}
    >
      <Icon size={15} className="shrink-0 text-text-muted" />
      {persona.label}
    </button>
  )
}
