import { useNavigate } from 'react-router-dom'
import {
  Building2,
  CalendarClock,
  FileDigit,
  FlaskConical,
  GitBranch,
  Layers,
  type LucideIcon,
  Plug,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react'

import { formatNumber } from '@/lib/format'
import { Card, EmptyState, SectionHeader } from '@/ui'
import {
  auditEventsCollection,
  branchesCollection,
  departmentsCollection,
  organisationsCollection,
  policyVersionsCollection,
  rolesCollection,
  teamsCollection,
  unitsCollection,
  useCollection,
  usersCollection,
} from '@/mocks'

import { DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, useModuleData } from './parts'

interface SectionCard {
  to: string
  label: string
  description: string
  figure: string
  icon: LucideIcon
}

export default function Home() {
  const navigate = useNavigate()

  const organisations = useCollection(organisationsCollection)
  const branches = useCollection(branchesCollection)
  const units = useCollection(unitsCollection)
  const departments = useCollection(departmentsCollection)
  const teams = useCollection(teamsCollection)
  const users = useCollection(usersCollection)
  const roles = useCollection(rolesCollection)
  const policies = useCollection(policyVersionsCollection)
  const audit = useCollection(auditEventsCollection)

  const state = useModuleData(organisations, 'settings.home')
  const configured = state.rows.length > 0

  const sections: SectionCard[] = [
    {
      to: 'organisation',
      label: 'Organisation',
      description: 'Legal identity, registration, brand and the financial year the whole system reports against.',
      figure: organisations[0]?.tradingName ?? 'Not configured',
      icon: Building2,
    },
    {
      to: 'branches',
      label: 'Branches',
      description: 'Physical and virtual campuses. Every employee, enrolment and invoice is attached to one.',
      figure: `${formatNumber(branches.length)} ${branches.length === 1 ? 'branch' : 'branches'}`,
      icon: GitBranch,
    },
    {
      to: 'units',
      label: 'Business units',
      description: 'The six units every naira of revenue and cost is allocated to. Unit P&L depends on this list.',
      figure: `${formatNumber(units.length)} units`,
      icon: Layers,
    },
    {
      to: 'departments',
      label: 'Departments and teams',
      description: 'The reporting structure permission scopes resolve against — department, then team.',
      figure: `${formatNumber(departments.length)} departments · ${formatNumber(teams.length)} teams`,
      icon: Users,
    },
    {
      to: 'users',
      label: 'Users',
      description: 'Accounts, the roles they hold, and the branch their scope is evaluated from.',
      figure: `${formatNumber(users.length)} users · ${formatNumber(users.filter((u) => u.status === 'active').length)} active`,
      icon: Users,
    },
    {
      to: 'roles',
      label: 'Roles and permissions',
      description: 'Resource, action and scope. The one screen here built to full depth.',
      figure: `${formatNumber(roles.length)} roles`,
      icon: ShieldCheck,
    },
    {
      to: 'policies',
      label: 'Policies',
      description: 'Every threshold, grace period and fee as effective-dated data. Nothing is typed into code.',
      figure: `${formatNumber(policies.filter((p) => p.status === 'active').length)} active · ${formatNumber(policies.length)} versions`,
      icon: CalendarClock,
    },
    {
      to: 'audit',
      label: 'Audit log',
      description: 'Immutable and append-only. Actor, timestamp, field, before and after. No edit, no delete.',
      figure: `${formatNumber(audit.length)} entries`,
      icon: ScrollText,
    },
    {
      to: 'integrations',
      label: 'Integrations',
      description: 'Payments, messaging, mail, the bank feed, media and reviews — with what each one is really doing.',
      figure: 'Seven services',
      icon: Plug,
    },
    {
      to: 'numbering',
      label: 'Numbering and references',
      description: 'Where every INV-, PAY- and COM- reference in the system comes from.',
      figure: 'Eight sequences',
      icon: FileDigit,
    },
    {
      to: 'demo',
      label: 'Demo controls',
      description: 'Prototype scaffolding: reset the seed, move the clock, force an error or an empty state.',
      figure: 'Scaffolding',
      icon: FlaskConical,
    },
  ]

  const header = (
    <ModuleHeader
      title="Settings"
      description="Everything the system treats as configuration rather than code. Policies are effective-dated and versioned, so changing a rule today never rewrites what already happened."
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="Settings" onRetry={state.retry} />
      </Screen>
    )
  }

  if (state.loading) {
    return (
      <Screen>
        {header}
        <DashboardSkeleton />
      </Screen>
    )
  }

  if (!configured) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Building2}
          title="No organisation is configured"
          message="Nothing else in Settings can be set up until the organisation record exists — branches, units and policies all hang off it."
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      <SectionHeader
        as="h2"
        size="sm"
        title="Configuration"
        description="Each card shows what is currently set, derived from the store rather than written here."
        className="mb-4"
      />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <li key={section.to}>
              <Card
                interactive
                padding="tight"
                role="link"
                tabIndex={0}
                className="h-full cursor-pointer"
                onClick={() => navigate(`/settings/${section.to}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    navigate(`/settings/${section.to}`)
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-body-14 text-text">{section.label}</h3>
                    <p className="mt-0.5 text-body-13 text-text-secondary">{section.description}</p>
                    <p className="mt-2 text-label-11 text-text-label">{section.figure}</p>
                  </div>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </Screen>
  )
}
