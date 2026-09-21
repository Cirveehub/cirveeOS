/**
 * Integrations.
 *
 * The services themselves are a fixed registry — the prototype has no
 * connection to any of them. What each row *reports* is derived from the store,
 * so the traffic figures move when the data does rather than sitting still.
 */
import { useMemo } from 'react'
import { Plug } from 'lucide-react'

import { formatDateTime, formatNumber } from '@/lib/format'
import { Alert, Badge, Card, CardBody, DataTable, EmptyState, StatusBadge, type Column } from '@/ui'
import {
  TODAY,
  addDays,
  certificatesCollection,
  generatedDocumentsCollection,
  messagesCollection,
  paymentsCollection,
  reviewRequestsCollection,
  useCollection,
} from '@/mocks'

import { ModuleHeader, Screen } from './parts'

type IntegrationStatus = 'connected' | 'not_configured' | 'pending_verification'

interface IntegrationRow {
  id: string
  name: string
  purpose: string
  account: string
  status: IntegrationStatus
  lastSync: string | null
  events7d: number
  errors7d: number
  note: string | null
}

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: 'Connected',
  not_configured: 'Not configured',
  pending_verification: 'Pending verification',
}

export default function Integrations() {
  const payments = useCollection(paymentsCollection)
  const messages = useCollection(messagesCollection)
  const documents = useCollection(generatedDocumentsCollection)
  const certificates = useCollection(certificatesCollection)
  const reviewRequests = useCollection(reviewRequestsCollection)

  const since = addDays(TODAY, -7)

  const rows = useMemo<IntegrationRow[]>(() => {
    const recent = <T,>(list: T[], at: (item: T) => string | null) =>
      list.filter((item) => {
        const stamp = at(item)
        return stamp !== null && stamp.slice(0, 10) >= since
      })

    const cardPayments = payments.filter((p) => p.method === 'paystack_card' || p.method === 'paystack_transfer')
    const recentCard = recent(cardPayments, (p) => p.receivedAt)
    const whatsapp = messages.filter((m) => m.channel === 'whatsapp')
    const email = messages.filter((m) => m.channel === 'email')
    const recentWhatsapp = recent(whatsapp, (m) => m.sentAt)
    const recentEmail = recent(email, (m) => m.sentAt)
    const recentDocs = recent(documents, (d) => d.generatedAt)
    const recentCertificates = recent(certificates, (c) => c.issuedAt)
    const recentReviews = recent(reviewRequests, (r) => r.sentAt)

    const latest = (values: Array<string | null>) =>
      values.filter((v): v is string => Boolean(v)).sort((a, b) => b.localeCompare(a))[0] ?? null

    return [
      {
        id: 'paystack',
        name: 'Paystack',
        purpose: 'Card and transfer collection, and the webhook that matches a payment to its invoice. Errors counts reversals.',
        account: 'cirvee-academy',
        status: 'connected',
        lastSync: latest(recentCard.map((p) => p.receivedAt)),
        events7d: recentCard.length,
        errors7d: payments.filter((p) => p.status === 'reversed' && p.receivedAt.slice(0, 10) >= since).length,
        note: null,
      },
      {
        id: 'whatsapp',
        name: 'WhatsApp Cloud API',
        purpose: 'Template messages for follow-ups, receipts, checkpoint surveys and review requests.',
        account: 'Cirvee Academy · +234 803 000 0000',
        status: 'pending_verification',
        lastSync: latest(recentWhatsapp.map((m) => m.sentAt)),
        events7d: recentWhatsapp.length,
        errors7d: whatsapp.filter((m) => m.status === 'failed' && (m.sentAt ?? '').slice(0, 10) >= since).length,
        note: 'Pending Meta business verification. Sends run against the test number until it clears, so template approval times are not yet representative.',
      },
      {
        id: 'resend',
        name: 'Resend',
        purpose: 'Transactional email — invoices, payslips, certificates and outcome follow-ups.',
        account: 'mail.cirvee.com',
        status: 'connected',
        lastSync: latest(recentEmail.map((m) => m.sentAt)),
        events7d: recentEmail.length,
        errors7d: email.filter((m) => m.status === 'bounced' && (m.sentAt ?? '').slice(0, 10) >= since).length,
        note: null,
      },
      {
        id: 'zenith',
        name: 'Zenith bank feed',
        purpose: 'Statement import for reconciliation. Errors counts the lines still unmatched — they stay visible and are never auto-assigned.',
        account: 'Cirvee Academy Ltd · current account',
        status: 'connected',
        lastSync: latest(payments.map((p) => p.receivedAt)),
        events7d: recent(payments, (p) => p.receivedAt).length,
        errors7d: payments.filter((p) => p.status === 'unmatched').length,
        note: null,
      },
      {
        id: 'cloudinary',
        name: 'Cloudinary',
        purpose: 'Lesson video transcoding, including the 240p low-data variant, and generated document storage.',
        account: 'cirvee-media',
        status: 'connected',
        lastSync: latest(recentDocs.map((d) => d.generatedAt)),
        events7d: recentDocs.length + recentCertificates.length,
        errors7d: 0,
        note: null,
      },
      {
        id: 'google-reviews',
        name: 'Google Reviews',
        purpose: 'Reads the public listing rating and review count. Requests are sent from here; reviews are never bought.',
        account: 'Cirvee Academy · Ibadan',
        status: 'connected',
        lastSync: latest(recentReviews.map((r) => r.sentAt)),
        events7d: recentReviews.length,
        errors7d: 0,
        note: 'Read-only. Offering a reward for a review breaches Google policy and gets the listing penalised, so no incentive field exists on this integration.',
      },
      {
        id: 'zoom',
        name: 'Zoom',
        purpose: 'Virtual class sessions and the attendance log they produce.',
        account: 'Not connected',
        status: 'not_configured',
        lastSync: null,
        events7d: 0,
        errors7d: 0,
        note: 'Virtual sessions currently run on the in-house room. Connecting Zoom would add a second attendance source, which the attendance policy scope order already allows for.',
      },
    ]
  }, [payments, messages, documents, certificates, reviewRequests, since])

  const columns: Array<Column<IntegrationRow>> = [
    {
      key: 'name',
      header: 'Integration',
      pinned: true,
      minWidth: 220,
      cell: (row) => (
        <div className="min-w-0">
          <div className="truncate text-body-13 text-text">{row.name}</div>
          <div className="truncate text-body-12 text-text-secondary">{row.purpose}</div>
        </div>
      ),
      sortValue: (row) => row.name,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 184,
      cell: (row) =>
        row.status === 'connected' ? (
          <StatusBadge status="active" label="Connected" />
        ) : row.status === 'pending_verification' ? (
          <Badge tone="warning" size="md">
            Pending verification
          </Badge>
        ) : (
          <Badge tone="neutral" size="md">
            Not configured
          </Badge>
        ),
      sortValue: (row) => STATUS_LABEL[row.status],
      sortable: true,
    },
    {
      key: 'account',
      header: 'Account',
      minWidth: 240,
      accessor: (row) => <span className="font-mono text-body-12">{row.account}</span>,
      sortValue: (row) => row.account,
      sortable: true,
    },
    {
      key: 'lastSync',
      header: 'Last activity',
      width: 184,
      accessor: (row) =>
        row.lastSync ? formatDateTime(row.lastSync) : <span className="text-text-secondary">Never</span>,
      sortValue: (row) => row.lastSync ?? '',
      sortable: true,
    },
    {
      key: 'events',
      header: 'Events, 7 days',
      align: 'right',
      width: 148,
      accessor: (row) => <span className="tabular-nums">{formatNumber(row.events7d)}</span>,
      sortValue: (row) => row.events7d,
      sortable: true,
    },
    {
      key: 'errors',
      header: 'Errors, 7 days',
      align: 'right',
      width: 148,
      accessor: (row) => (
        <span className={`tabular-nums ${row.errors7d > 0 ? 'text-danger-text' : 'text-text-secondary'}`}>
          {formatNumber(row.errors7d)}
        </span>
      ),
      sortValue: (row) => row.errors7d,
      sortable: true,
    },
    {
      key: 'note',
      header: 'Note',
      minWidth: 380,
      accessor: (row) => row.note ?? <span className="text-text-secondary">—</span>,
      sortValue: (row) => row.note ?? '',
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Integrations"
        description="Seven external services. The traffic figures are counted from the store, so they move with the data rather than sitting still."
      />

      <Alert tone="warning" className="mb-4" title="WhatsApp is pending Meta business verification">
        This is the real state, and it sets expectations: until verification clears, template approvals are slow and sends run
        against the test number. Every WhatsApp-dependent automation is built and testable, but not yet live.
      </Alert>

      <Card>
        <CardBody padding="none">
          <DataTable
            data={rows}
            columns={columns}
            rowKey={(row) => row.id}
            density="compact"
            bordered={false}
            minWidth={1660}
            defaultSort={{ key: 'events', direction: 'desc' }}
            caption="Integrations with status, account, last activity, seven-day event and error counts"
            empty={
              <EmptyState
                icon={Plug}
                title="No integrations configured"
                message="Payments, messages and documents would all have to be recorded by hand. At minimum a payment provider and an email sender need connecting."
              />
            }
          />
        </CardBody>
      </Card>
    </Screen>
  )
}
