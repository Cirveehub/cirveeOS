import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { TODAY, admissionsCollection, enrollmentsCollection } from '@/mocks'
import type { Branch } from '@/mocks'
import { formatNumber } from '@/lib/format'
import { EmptyState } from '@/ui'

import { monthWindows } from '../lib/series'
import { AXIS, BRANCH_COLOUR, ChartCard, ChartLegend, ChartTooltip } from './chart-kit'

export function EnrolmentsByBranchChart({ branches, className }: { branches: Branch[]; className?: string }) {
  const months = monthWindows(6, TODAY)

  const data = months.map((month) => {
    const row: Record<string, string | number> = { month: month.label }
    for (const branch of branches) row[branch.name] = 0

    for (const enrolment of enrollmentsCollection.all()) {
      if (enrolment.enrolledAt < month.range.from || enrolment.enrolledAt > month.range.to) continue
      const admission = admissionsCollection.find(enrolment.admissionId)
      const branch = branches.find((b) => b.id === admission?.branchId)
      if (!branch) continue
      row[branch.name] = Number(row[branch.name]) + 1
    }
    return row
  })

  const total = data.reduce(
    (acc, row) => acc + branches.reduce((sum, branch) => sum + Number(row[branch.name]), 0),
    0,
  )

  return (
    <ChartCard
      title="Enrolments by branch"
      description="Enrolments started each month, by the branch on the admission."
      className={className}
      footer={
        <ChartLegend
          keys={branches.map((branch, index) => ({
            label: branch.name,
            colour: BRANCH_COLOUR[index % BRANCH_COLOUR.length],
          }))}
        />
      }
    >
      {total === 0 ? (
        <EmptyState
          size="sm"
          title="No enrolments in the last six months"
          message="An enrolment is created when an admission is completed in CRM and admissions."
        />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke={AXIS.stroke} />
            <XAxis dataKey="month" tickLine={false} axisLine={{ stroke: AXIS.stroke }} tick={AXIS.tick} />
            <YAxis tickLine={false} axisLine={false} width={34} tick={AXIS.tick} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'var(--color-surface-sunken)' }}
              content={<ChartTooltip format={(value) => formatNumber(value)} />}
            />
            {branches.map((branch, index) => (
              <Bar
                key={branch.id}
                dataKey={branch.name}
                fill={BRANCH_COLOUR[index % BRANCH_COLOUR.length]}
                radius={[3, 3, 0, 0]}
                maxBarSize={22}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
