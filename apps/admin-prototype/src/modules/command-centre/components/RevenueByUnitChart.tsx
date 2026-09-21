/**
 * Revenue by unit — stacked bars, six months, six units (screen-spec §1.1).
 *
 * Each bar segment is `collectedRevenue(month, unitId)`. Match a payment
 * anywhere in the app and the September stack grows.
 */

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { TODAY, collectedRevenue } from '@/mocks'
import type { Unit } from '@/mocks'
import { formatNaira } from '@/lib/format'
import { EmptyState } from '@/ui'

import { monthWindows } from '../lib/series'
import { unitTagKey } from '../lib/scope'
import { AXIS, ChartCard, ChartLegend, ChartTooltip, UNIT_COLOUR } from './chart-kit'

export function RevenueByUnitChart({ units, className }: { units: Unit[]; className?: string }) {
  const months = monthWindows(6, TODAY)

  const data = months.map((month) => {
    const row: Record<string, string | number> = { month: month.label }
    let total = 0
    for (const unit of units) {
      const value = collectedRevenue(month.range, unit.id)
      row[unit.name] = value
      total += value
    }
    row.__total = total
    return row
  })

  const grandTotal = data.reduce((acc, row) => acc + Number(row.__total), 0)

  return (
    <ChartCard
      title="Revenue by unit"
      description="Collected, by month, across the six business units."
      className={className}
      footer={
        <ChartLegend
          keys={units.map((unit) => ({ label: unit.name, colour: UNIT_COLOUR[unitTagKey(unit.code)] }))}
        />
      }
    >
      {grandTotal === 0 ? (
        <EmptyState
          size="sm"
          title="No collections in the last six months"
          message="Revenue appears here as payments are matched in Finance. Nothing has been matched in this window."
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={AXIS.stroke} />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: AXIS.stroke }} tick={AXIS.tick} />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={58}
              tick={AXIS.tick}
              tickFormatter={(value: number) => formatNaira(value, { compact: true })}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-sunken)' }}
              content={<ChartTooltip format={(value) => formatNaira(value)} />}
            />
            {units.map((unit, index) => (
              <Bar
                key={unit.id}
                dataKey={unit.name}
                stackId="revenue"
                fill={UNIT_COLOUR[unitTagKey(unit.code)]}
                radius={index === units.length - 1 ? [4, 4, 0, 0] : undefined}
                maxBarSize={44}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
