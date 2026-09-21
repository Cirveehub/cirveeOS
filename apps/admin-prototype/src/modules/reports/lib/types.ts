import type { ComponentType, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

import type { DateRange, UnitId } from '@/mocks'

export interface ReportScope {
  range: DateRange
  unitId: UnitId | undefined
}

export interface Headline {
  label: string
  value: string
  hint?: string
}

export interface CsvPayload {
  filename: string
  columns: string[]
  rows: Array<Array<string | number | null | undefined>>
}

export interface ReportDefinition {
  key: string
  title: string
  description: string
  icon: LucideIcon
  depth: 'full' | 'outline'
  headline: (scope: ReportScope) => Headline[]
  asOf: () => string | null
  csv: (scope: ReportScope) => CsvPayload
  Body: ComponentType<ReportScope>
}

export type ReportChild = ReactNode
