/**
 * One report, described once.
 *
 * The index card and the detail screen read the same definition, so a card's
 * three headline figures can never drift from the report they open.
 */

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
  /** Small print under the figure. */
  hint?: string
}

export interface CsvPayload {
  filename: string
  columns: string[]
  rows: Array<Array<string | number | null | undefined>>
}

export interface ReportDefinition {
  /** Route segment — `/reports/unit-pnl`. */
  key: string
  title: string
  /** One line, on the index card and under the detail title. */
  description: string
  icon: LucideIcon
  /** Marks the one report built to depth. */
  depth: 'full' | 'outline'
  /** Three figures for the index card. */
  headline: (scope: ReportScope) => Headline[]
  /** The most recent record the report reads — its "data as of". */
  asOf: () => string | null
  csv: (scope: ReportScope) => CsvPayload
  Body: ComponentType<ReportScope>
}

export type ReportChild = ReactNode
