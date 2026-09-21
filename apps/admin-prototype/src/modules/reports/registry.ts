import type { ReportDefinition } from './lib/types'
import { unitPnlReport } from './reports/unit-pnl'

/**
 * Every report, in index order.
 *
 * Adding one means writing a `ReportDefinition` and listing it here — the
 * index cards and the detail shell both read from this, so neither needs
 * to know about any particular report.
 */
export const REPORTS: ReportDefinition[] = [unitPnlReport]

export const reportByKey = Object.fromEntries(REPORTS.map((r) => [r.key, r]))
