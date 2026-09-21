import type { ReportDefinition } from './lib/types'
import { unitPnlReport } from './reports/unit-pnl'

export const REPORTS: ReportDefinition[] = [unitPnlReport]

export const reportByKey = Object.fromEntries(REPORTS.map((r) => [r.key, r]))
