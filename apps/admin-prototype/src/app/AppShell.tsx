import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell,
  ChevronsLeft,
  Command,
  LogOut,
  Moon,
  Search,
  Sun,
} from 'lucide-react'

import { cn } from '@/lib/cn'
import { initials } from '@/lib/format'
import { modules } from '@/modules'
import { signOut, useCan, useSession } from '@/auth'
import { NAV_GROUPS, moduleInSidebar, modulePath } from './module-registry'
import CommandPalette from './CommandPalette'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const location = useLocation()
  const navigate = useNavigate()
  const session = useSession()
  const can = useCan()

  const visibleModules = useMemo(
    () => modules.filter((m) => moduleInSidebar(m, session?.persona.id, can)),
    [session?.role?.id, session?.persona.id],
  )

  const grouped = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: visibleModules.filter((m) => m.group === group.id),
    })).filter((g) => g.items.length > 0)
  }, [visibleModules])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        setCollapsed((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const active = modules.find(
    (m) => location.pathname === m.base || location.pathname.startsWith(`${m.base}/`),
  )

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200',
          collapsed ? 'w-[68px]' : 'w-[248px]',
        )}
      >
        <div className="flex h-14 items-center gap-2 px-4">
          <Link to="/home" className="flex min-w-0 items-center gap-2.5">
            <img src="/favicon.png" alt="" className="size-7 shrink-0" />
            {!collapsed && (
              <span className="truncate text-[15px] font-bold tracking-tight">cirvee</span>
            )}
          </Link>
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="ml-auto grid size-7 place-items-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              aria-label="Collapse sidebar"
              title="Collapse sidebar  ⌘B"
            >
              <ChevronsLeft size={16} />
            </button>
          )}
        </div>

        {!collapsed && (
          <div className="px-3 pb-2">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex w-full items-center gap-2 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-body-13 text-text-muted transition-colors hover:border-border-strong hover:text-text-secondary"
            >
              <Search size={14} />
              <span>Search</span>
              <kbd className="ml-auto flex items-center gap-0.5 rounded border border-border bg-surface px-1 py-0.5 text-[10px] font-medium text-text-muted">
                <Command size={9} />K
              </kbd>
            </button>
          </div>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {grouped.map((group) => (
            <div key={group.id} className="mb-1">
              {!collapsed && (
                <div className="px-2.5 pb-1 pt-3 text-label-10 text-text-muted">{group.label}</div>
              )}
              {collapsed && <div className="my-2 h-px bg-border" />}
              <ul className="space-y-0.5">
                {group.items.flatMap((mod) =>
                  mod.expandSubnavInSidebar && mod.subnav?.length
                    ? mod.subnav
                        .filter((item) => !item.permission || can(item.permission))
                        .map((item) => (
                        <NavItem
                          key={`${mod.id}:${item.to}`}
                          to={modulePath(mod, item.to)}
                          end={item.to === ''}
                          label={item.label}
                          icon={item.icon ?? mod.icon}
                          collapsed={collapsed}
                        />
                      ))
                    : (
                        <NavItem
                          key={mod.id}
                          to={mod.base}
                          label={mod.label}
                          icon={mod.icon}
                          collapsed={collapsed}
                          shallow={mod.depth === 'shallow'}
                        />
                      ),
                )}
              </ul>
            </div>
          ))}
        </nav>

        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-auto mb-3 grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            aria-label="Expand sidebar"
          >
            <ChevronsLeft size={16} className="rotate-180" />
          </button>
        )}
      </aside>

      {/* `min-h-0` overrides the flexbox default of `min-height: auto`, under
          which a column flex item refuses to shrink below its content's
          natural height. Without it, a tall page pushes this column (and the
          document behind it) taller than the viewport instead of leaving
          `<main>` to scroll internally — the whole window would scroll along
          with the sidebar and topbar rather than just the content well. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-6">
          <div className="min-w-0">
            <div className="truncate text-body-14 font-semibold">{active?.label ?? 'Cirvee OS'}</div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>

            <button
              className="relative grid size-8 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
              aria-label="Notifications"
            >
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent ring-2 ring-surface" />
            </button>

            <div className="ml-2 flex items-center gap-2.5 border-l border-border pl-3">
              <div className="text-right leading-tight">
                <div className="truncate text-body-13 font-semibold">{session?.displayName}</div>
                <div className="truncate text-body-12 text-text-muted">{session?.persona.label}</div>
              </div>
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-subtle text-body-12 font-bold text-accent">
                {session ? initials(session.displayName) : ''}
              </div>
              <button
                onClick={() => {
                  signOut()
                  navigate('/login', { replace: true })
                }}
                className="grid size-8 shrink-0 place-items-center rounded-lg text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                aria-label="Switch role"
                title="Switch role"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function NavItem({
  to,
  end,
  label,
  icon: Icon,
  collapsed,
  shallow,
}: {
  to: string
  end?: boolean
  label: string
  icon: ComponentType<{ size?: number | string; className?: string }>
  collapsed: boolean
  shallow?: boolean
}) {
  return (
    <li>
      <NavLink
        to={to}
        end={end}
        title={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-body-13 font-medium transition-colors',
            collapsed && 'justify-center px-0',
            isActive
              ? 'bg-accent-subtle text-accent'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text',
          )
        }
      >
        <Icon size={16} className="shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{label}</span>
            {shallow && (
              <span
                className="ml-auto size-1.5 shrink-0 rounded-full bg-border-interactive"
                title="Outline only in this prototype"
              />
            )}
          </>
        )}
      </NavLink>
    </li>
  )
}
