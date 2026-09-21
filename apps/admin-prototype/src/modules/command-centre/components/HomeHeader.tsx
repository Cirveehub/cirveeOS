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
