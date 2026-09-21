# Cirvee OS — Super Admin prototype

A frontend-only, mock-data prototype of the Super Admin experience. **No backend.** Everything is seeded data in the browser.

The point is to judge feasibility and shape before committing to the real build. Super Admin sees and does everything, so this one persona exercises the entire system surface.

```bash
npm install
npm run dev      # http://localhost:5180
```

## Scope

All **18 modules** appear in the navigation. Six are built to full working depth — real filters, forms, multi-step flows, and state that persists across navigation:

| Deep | Shallow (dashboard + list views only) |
|---|---|
| Command centre | Academy ops · Finance · People · Payroll |
| CRM & admissions | Engage · Corporate · Customer experience |
| Referral & commission | Physical layer · Outcomes · Reputation |
| Cirvee Learn | Meetings · Settings |
| Work & approvals | |
| Automation | |

Shallow modules carry a small dot in the sidebar.

## Architecture

```
src/
├── app/                  Shell, router, command palette. Knows no module by name.
│   └── module-registry.ts  The module contract
├── ui/                   Design system. Every component in the app comes from here.
├── lib/                  cn(), formatNaira(), date helpers
├── mocks/                In-memory data layer (collection.ts) + seeds
└── modules/
    ├── index.ts          The registry — the one shared file
    └── <module-id>/      One folder per module, self-contained
```

### The module contract

A module is a folder that default-exports one `ModuleDef`. The shell derives navigation and routing from the registry, so **adding, building or deleting a module touches only that module's folder and one line of `modules/index.ts`.** Two people can build two modules with zero merge conflicts.

```tsx
import { Target } from 'lucide-react'
import { defineModule } from '@/app/module-registry'

export default defineModule({
  id: 'crm',
  label: 'CRM & admissions',
  icon: Target,
  base: '/crm',
  group: 'growth',
  depth: 'deep',
  summary: 'Everything before someone becomes a student.',
  routes: [
    { path: '', element: <CrmDashboard /> },
    { path: 'leads', element: <LeadList /> },
    { path: 'leads/:id', element: <LeadProfile /> },
  ],
  subnav: [
    { label: 'Dashboard', to: '' },
    { label: 'Leads', to: 'leads' },
  ],
})
```

A module owns every path under its `base`. Bases must be unique.

### Data

There is no API. Each entity lives in a `Collection<T>` (`src/mocks/collection.ts`) — an in-memory array with a subscription, so a mutation anywhere re-renders every screen reading it. Approve a commission on one screen and the payroll preview on another reflects it immediately. That cross-module liveness is most of what makes the prototype convincing.

```tsx
const leads = useCollection(leadsCollection)
const lead  = useRecord(leadsCollection, id)

leadsCollection.update(id, { stage: 'qualified' })
```

State persists to `sessionStorage` — it survives navigation and reload, and resets when the tab closes, so a demo always starts from a known seed.

**Money is stored in kobo**, always, as a plain number. Format with `formatNaira()`. Never hold naira as a float. (The real system needs `BigInt` — see `docs/build-plan.md` §2.3.)

## Design system

Tokens live in `src/styles.css`. Two deliberate corrections to the source system, per `docs/build-plan.md` §5:

1. **One purple.** The existing codebase ran six. Everything reconciles to `#6d00e7`, expanded into a 25–900 ramp.
2. **One neutral ramp.** The existing codebase ran three simultaneously. Only `ui-*` survives.

### Role tokens, not ramp steps

The tokens come in two layers: the ramps (`primary-500`, `ui-600`…) and **role tokens** on top (`surface`, `canvas`, `border`, `text`, `text-secondary`, `accent`, `on-accent`…).

Components reference **role tokens**:

```tsx
<div className="bg-surface text-text border-border" />   // ✅
<div className="bg-white text-ui-900 border-ui-100" />   // ❌
```

The role layer is re-declared once under `[data-theme="dark"]`, so a component built on role tokens gets dark mode for free. Never use a literal hex. Never use Tailwind's built-in `gray-*` — that was one of the three ramps we eliminated.

`/kitchen-sink` renders every component in every state. Review changes there.

## Conventions

- Labels in sentence case, short — "Join class", not "Join Class"
- No emoji in the interface
- Hairline borders (`border-border`), not shadows. `shadow-sm` at rest, `shadow-2xl` for modals only
- Radius: buttons `rounded-lg`, cards and inputs `rounded-xl`, panels and modals `rounded-2xl`
- Icons from `lucide-react` at 16 or 20px, inheriting text colour
- Every list needs a designed empty state; every fetch needs a loading state
