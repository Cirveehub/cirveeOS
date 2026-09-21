/**
 * Numbering and references.
 *
 * Small screen, but it is where every `INV-`, `PAY-` and `COM-` in the system
 * comes from. The **next number** column is derived from the live collections
 * rather than stored, so raising an invoice elsewhere moves it here.
 */
import { useMemo } from 'react'
import { FileDigit } from 'lucide-react'

import { formatNumber } from '@/lib/format'
import { Alert, Card, CardBody, DataTable, EmptyState, type Column } from '@/ui'
import {
  TODAY,
  certificatesCollection,
  commissionsCollection,
  generatedDocumentsCollection,
  invoicesCollection,
  payrollAdjustmentsCollection,
  paymentsCollection,
  refundsCollection,
  useCollection,
} from '@/mocks'

import { ModuleHeader, Screen } from './parts'

interface SequenceRow {
  id: string
  entity: string
  prefix: string
  format: string
  issued: number
  next: string
  resets: string
}

/** The highest trailing number in a set of refs, so "next" is a real next. */
function highest(refs: string[]): number {
  return refs.reduce((acc, ref) => {
    const match = /(\d+)\s*$/.exec(ref)
    return match ? Math.max(acc, Number(match[1])) : acc
  }, 0)
}

export default function Numbering() {
  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const refunds = useCollection(refundsCollection)
  const commissions = useCollection(commissionsCollection)
  const certificates = useCollection(certificatesCollection)
  const documents = useCollection(generatedDocumentsCollection)
  const adjustments = useCollection(payrollAdjustmentsCollection)

  const year = TODAY.slice(0, 4)

  const rows = useMemo<SequenceRow[]>(
    () => [
      {
        id: 'invoice',
        entity: 'Invoice',
        prefix: 'INV',
        format: 'INV-{year}-{0000}',
        issued: invoices.length,
        next: `INV-${year}-${String(highest(invoices.map((i) => i.ref)) + 1).padStart(4, '0')}`,
        resets: 'Yearly, on the financial year start',
      },
      {
        id: 'payment',
        entity: 'Payment',
        prefix: 'PAY',
        format: 'PAY-{0000}',
        issued: payments.length,
        next: `PAY-${String(highest(payments.map((p) => p.ref)) + 1).padStart(4, '0')}`,
        resets: 'Never — the sequence runs continuously',
      },
      {
        id: 'refund',
        entity: 'Refund',
        prefix: 'REF',
        format: 'REF-{year}-{0000}',
        issued: refunds.length,
        next: `REF-${year}-${String(highest(refunds.map((r) => r.ref)) + 1).padStart(4, '0')}`,
        resets: 'Yearly',
      },
      {
        id: 'commission',
        entity: 'Commission',
        prefix: 'COM',
        format: 'COM-{year}-{0000}',
        issued: commissions.length,
        next: `COM-${year}-${String(highest(commissions.map((c) => c.ref)) + 1).padStart(4, '0')}`,
        resets: 'Yearly',
      },
      {
        id: 'adjustment',
        entity: 'Payroll adjustment',
        prefix: 'ADJ',
        format: 'ADJ-{year}-{0000}',
        issued: adjustments.length,
        next: `ADJ-${year}-${String(highest(adjustments.map((a) => a.ref)) + 1).padStart(4, '0')}`,
        resets: 'Yearly',
      },
      {
        id: 'certificate',
        entity: 'Certificate',
        prefix: 'CRV',
        format: 'CRV-{year}-{00000}',
        issued: certificates.length,
        next: `CRV-${year}-${String(highest(certificates.map((c) => c.certificateId)) + 1).padStart(5, '0')}`,
        resets: 'Never — a certificate id has to stay unique for ever',
      },
      {
        id: 'document',
        entity: 'Generated document',
        prefix: 'DOC',
        format: 'DOC-{0000}',
        issued: documents.length,
        next: `DOC-${String(highest(documents.map((d) => d.ref)) + 1).padStart(4, '0')}`,
        resets: 'Never',
      },
      {
        id: 'decision',
        entity: 'Decision',
        prefix: 'DEC',
        format: 'DEC-{0000}',
        issued: 0,
        next: 'DEC-0020',
        resets: 'Never — a decision reference is cited for years',
      },
    ],
    [invoices, payments, refunds, commissions, certificates, documents, adjustments, year],
  )

  const columns: Array<Column<SequenceRow>> = [
    {
      key: 'entity',
      header: 'Entity',
      pinned: true,
      minWidth: 200,
      accessor: (row) => row.entity,
      sortValue: (row) => row.entity,
      sortable: true,
    },
    {
      key: 'prefix',
      header: 'Prefix',
      width: 108,
      accessor: (row) => <span className="font-mono text-body-13">{row.prefix}</span>,
      sortValue: (row) => row.prefix,
      sortable: true,
    },
    {
      key: 'format',
      header: 'Format',
      width: 200,
      accessor: (row) => <span className="font-mono text-body-12">{row.format}</span>,
      sortValue: (row) => row.format,
    },
    {
      key: 'issued',
      header: 'Issued so far',
      align: 'right',
      width: 144,
      accessor: (row) =>
        row.issued === 0 ? (
          <span className="text-text-secondary">None yet</span>
        ) : (
          <span className="tabular-nums">{formatNumber(row.issued)}</span>
        ),
      sortValue: (row) => row.issued,
      sortable: true,
    },
    {
      key: 'next',
      header: 'Next reference',
      width: 200,
      accessor: (row) => <span className="font-mono text-body-13 text-text">{row.next}</span>,
      sortValue: (row) => row.next,
      sortable: true,
    },
    {
      key: 'resets',
      header: 'Reset cadence',
      minWidth: 320,
      accessor: (row) => row.resets,
      sortValue: (row) => row.resets,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Numbering and references"
        description="Every human-readable reference in the system comes from one of these sequences. The next value is computed from what has actually been issued, not stored in a counter that can drift."
      />

      <Alert tone="info" className="mb-4" title="A reference is never reused">
        Voiding an invoice does not release its number. The voided row keeps it, a credit note gets a new one, and the
        sequence carries on — which is why a gap in the numbers is a question worth asking rather than a bug.
      </Alert>

      <Card>
        <CardBody padding="none">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            density="compact"
            bordered={false}
            minWidth={1240}
            caption="Reference sequences with prefix, format, volume issued, next value and reset cadence"
            empty={
              <EmptyState
                icon={FileDigit}
                title="No sequences defined"
                message="Nothing can be issued a reference, so invoices and receipts would have to be identified by their internal id."
              />
            }
          />
        </CardBody>
      </Card>
    </Screen>
  )
}
