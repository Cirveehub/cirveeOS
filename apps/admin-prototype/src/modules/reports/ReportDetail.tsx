import { useParams } from 'react-router-dom'
import { Download } from 'lucide-react'

import { Button, PageHeader, EmptyState, Badge } from '@/ui'
import { useCollection, unitsCollection } from '@/mocks'

import { reportByKey } from './registry'
import { useReportScope } from './lib/scope'
import { ScopeBar } from './components/ScopeBar'
import { HeadlineStrip } from './components/report-kit'
import { toCsv, downloadCsv } from './lib/csv'

export default function ReportDetail() {
  const { key } = useParams<{ key: string }>()
  const units = useCollection(unitsCollection)
  const scope = useReportScope(units)

  const report = key ? reportByKey[key] : undefined

  if (!report) {
    return (
      <div className="px-8 py-6">
        <EmptyState
          title="Report not found"
          message="This report is not part of the prototype."
          action={<Button onClick={() => history.back()}>Back to reports</Button>}
        />
      </div>
    )
  }

  const reportScope = { range: scope.range, unitId: scope.unitId }
  const asOf = report.asOf()
  const Body = report.Body

  function exportCsv() {
    if (!report) return
    const payload = report.csv(reportScope)
    downloadCsv(payload.filename, toCsv(payload.columns, payload.rows))
  }

  return (
    <div className="px-8 py-6">
      <PageHeader
        breadcrumbs={[{ label: 'Reports', to: '/reports' }, { label: report.title }]}
        title={report.title}
        description={report.description}
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            <Download size={15} />
            Export CSV
          </Button>
        }
      />

      <ScopeBar scope={scope} units={units} />

      {report.depth === 'outline' && (
        <div className="mt-4">
          <Badge tone="neutral">Outline only in this prototype</Badge>
        </div>
      )}

      <div className="mt-6">
        <HeadlineStrip items={report.headline(reportScope)} />
      </div>

      <div className="mt-6">
        <Body {...reportScope} />
      </div>

      {asOf && <p className="mt-6 text-body-12 text-text-muted">Data as of {asOf}</p>}
    </div>
  )
}
