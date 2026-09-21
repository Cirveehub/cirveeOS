/**
 * The plain page header shared by Home's three surfaces (executive, employee,
 * the standalone brief).
 *
 * This used to also render a tab strip switching between those three —
 * "Executive / Employee view / Daily brief" — sitting directly above
 * `ExecutiveHome`'s own Overview/Money/Growth/… tabs. That made sense before
 * real sign-in existed, when there was one fixed persona and this was the
 * only way to preview another role's layout. It stopped making sense the
 * moment role-based login shipped: a Super Admin now switches layouts by
 * signing in as a different role at `/login`, and a tab on their own Home
 * page labelled "Employee view" reads as a stray control on the admin
 * dashboard rather than what it actually was — a reviewer's shortcut.
 *
 * `/home/executive`, `/home/employee` and `/home/brief` are all still
 * reachable directly (a reviewer can still type the URL, and `ShapeGate`
 * still keeps a non-configurator role out of layouts that aren't theirs) —
 * only the visible switcher is gone.
 */

import type { ReactNode } from 'react'

import { PageHeader } from '@/ui'

export type HomeTab = 'executive' | 'employee' | 'brief'

const TITLES: Record<HomeTab, string> = {
  executive: 'Command centre',
  employee: 'Your home',
  brief: 'Daily executive brief',
}

export interface HomeHeaderProps {
  active: HomeTab
  description?: ReactNode
  actions?: ReactNode
}

export function HomeHeader({ active, description, actions }: HomeHeaderProps) {
  return <PageHeader title={TITLES[active]} description={description} actions={actions} />
}
