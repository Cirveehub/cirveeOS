import { Building2 } from 'lucide-react'

import { formatDate } from '@/lib/format'
import { Alert, Badge, Card, EmptyState, KeyValue, KeyValueList, SectionHeader } from '@/ui'
import { organisationsCollection, useCollection } from '@/mocks'

import { DashboardSkeleton, ErrorPanel, ModuleHeader, Screen, useModuleData } from './parts'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default function Organisation() {
  const organisations = useCollection(organisationsCollection)
  const state = useModuleData(organisations, 'settings.organisation')
  const org = state.rows[0] ?? null

  const header = (
    <ModuleHeader
      title="Organisation"
      description="The legal identity every invoice, contract and certificate is issued under."
    />
  )

  if (state.error) {
    return (
      <Screen>
        {header}
        <ErrorPanel what="The organisation record" onRetry={state.retry} />
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

  if (!org) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={Building2}
          title="No organisation record"
          message="Invoices cannot be issued without a legal name, an RC number and a TIN on them. This is the first thing to configure."
        />
      </Screen>
    )
  }

  return (
    <Screen>
      {header}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader as="h2" size="sm" title="Legal identity" divided className="mb-4" />
          <KeyValueList columns={1}>
            <KeyValue label="Legal name">{org.legalName}</KeyValue>
            <KeyValue label="Trading name">{org.tradingName}</KeyValue>
            <KeyValue label="RC number" hint="Corporate Affairs Commission">
              <span className="font-mono text-body-13">{org.rcNumber}</span>
            </KeyValue>
            <KeyValue label="Tax identification number">
              <span className="font-mono text-body-13">{org.tin}</span>
            </KeyValue>
            <KeyValue label="Registered address">{org.address}</KeyValue>
          </KeyValueList>
        </Card>

        <Card>
          <SectionHeader as="h2" size="sm" title="Reporting and locale" divided className="mb-4" />
          <KeyValueList columns={1}>
            <KeyValue label="Financial year starts" hint="Every year-to-date figure counts from here">
              {MONTHS[org.financialYearStartMonth - 1] ?? 'Not set'}
            </KeyValue>
            <KeyValue label="Default currency" hint="Money is stored in kobo and formatted on the way out">
              {org.currency}
            </KeyValue>
            <KeyValue label="Timezone">{org.timezone}</KeyValue>
            <KeyValue label="Date format" hint="Sentence-case, no ordinals">
              {formatDate(org.createdAt)} — day, short month, year
            </KeyValue>
            <KeyValue label="Record created">{formatDate(org.createdAt)}</KeyValue>
          </KeyValueList>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader
            as="h2"
            size="sm"
            title="Brand"
            description="One purple. The legacy codebase ran six and three neutral ramps; everything reconciles to the single accent below."
            divided
            className="mb-4"
          />
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="size-12 rounded-xl bg-accent" />
              <div>
                <p className="text-body-14 text-text">Brand purple</p>
                <p className="font-mono text-body-13 text-text-secondary">{org.brandPrimary}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="accent">Accent</Badge>
              <Badge tone="neutral">Neutral</Badge>
              <Badge tone="success">Success</Badge>
              <Badge tone="warning">Warning</Badge>
              <Badge tone="danger">Danger</Badge>
              <Badge tone="info">Info</Badge>
            </div>
          </div>

          <Alert tone="info" className="mt-4" title="Changing these values does not rewrite history">
            The organisation record is versioned like every other policy. An invoice issued last year keeps the legal name and
            address that were in force on the day it was raised, whatever this screen says today.
          </Alert>
        </Card>
      </div>
    </Screen>
  )
}
