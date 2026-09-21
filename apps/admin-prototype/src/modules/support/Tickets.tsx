import { useMemo, useState } from 'react'
import { Mail, MessageCircle, Monitor, Bot, Plus, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'
import { useQueryState } from '@/lib/view-state'
import { formatDateTime, formatNaira, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ColumnPicker,
  DataTable,
  Drawer,
  Field,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PersonChip,
  Select,
  StatusBadge,
  FilterBar,
  Tabs,
  Textarea,
  useColumnVisibility,
  type BadgeTone,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  invoicesCollection,
  peopleCollection,
  ticketsCollection,
  useCollection,
  usersCollection,
  type Channel,
  type PersonId,
  type Ticket,
  type TicketCategory,
  type UserId,
} from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, useModuleData, usePersonName, useUserName } from './parts'
import {
  FIRST_RESPONSE_TARGET_HOURS,
  addInternalNote,
  assignTicket,
  createTicket,
  escalateTicket,
  reopenTicket,
  replyToTicket,
  resolveTicket,
} from './writes'

const SOURCE_LABEL: Record<Ticket['source'], string> = {
  student_portal: 'Student portal',
  parent_portal: 'Parent portal',
  email: 'Email',
  whatsapp: 'WhatsApp',
  staff: 'Staff',
  automation: 'Automation',
}

const SOURCE_ICON: Record<Ticket['source'], LucideIcon> = {
  student_portal: Monitor,
  parent_portal: Monitor,
  email: Mail,
  whatsapp: MessageCircle,
  staff: Users,
  automation: Bot,
}

const SLA_TONE: Record<Ticket['slaState'], BadgeTone> = {
  within: 'success',
  due_soon: 'warning',
  breached: 'danger',
}

const SLA_LABEL: Record<Ticket['slaState'], string> = {
  within: 'Within target',
  due_soon: 'Due soon',
  breached: 'Breached',
}

const PRIORITY_TONE: Record<Ticket['priority'], BadgeTone> = {
  urgent: 'danger',
  high: 'warning',
  normal: 'neutral',
  low: 'neutral',
}

const CATEGORIES: TicketCategory[] = [
  'payments',
  'class',
  'tutor',
  'certificate',
  'technical',
  'complaint',
  'refund',
  'other',
]

const PRIORITIES: Array<Ticket['priority']> = ['urgent', 'high', 'normal', 'low']

const SOURCES: Array<Ticket['source']> = [
  'student_portal',
  'parent_portal',
  'email',
  'whatsapp',
  'staff',
  'automation',
]

const CHANNELS: Channel[] = ['whatsapp', 'email', 'sms', 'in_app']

const CHANNEL_LABEL: Record<Channel, string> = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  sms: 'SMS',
  in_app: 'In app',
}

const OPEN_STATUSES: Array<Ticket['status']> = ['new', 'open', 'pending_customer', 'escalated', 'reopened']

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Ticket', defaultVisible: true, locked: true },
  { key: 'requester', label: 'Requester', defaultVisible: true },
  { key: 'category', label: 'Category', defaultVisible: false },
  { key: 'priority', label: 'Priority', defaultVisible: true },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'owner', label: 'Owner', defaultVisible: true },
  { key: 'source', label: 'Source', defaultVisible: false },
  { key: 'created', label: 'Created', defaultVisible: false },
  { key: 'first', label: 'First response', defaultVisible: false },
  { key: 'age', label: 'Age', defaultVisible: true },
  { key: 'sla', label: 'SLA', defaultVisible: true },
  { key: 'related', label: 'Related record', defaultVisible: false },
  { key: 'last', label: 'Last message', defaultVisible: false },
]

export default function SupportTickets() {
  const tickets = useCollection(ticketsCollection)
  const invoices = useCollection(invoicesCollection)
  const personName = usePersonName()
  const userName = useUserName()

  const initial = useQueryState()
  const [filters, setFilters] = useState<FilterValues>(() => ({
    status: initial.get('status'),
    priority: initial.get('priority'),
    category: initial.get('category'),
    sla: initial.get('sla'),
  }))
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)
  const { loading, error, rows, retry } = useModuleData(tickets, 'support.tickets')

  const ageDays = (t: Ticket) =>
    Math.max(
      0,
      Math.round((Date.parse(`${TODAY}T23:59:59Z`) - Date.parse(t.createdAtTime)) / 86_400_000),
    )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((t) => {
        if (filters.status && t.status !== filters.status) return false
        if (filters.priority && t.priority !== filters.priority) return false
        if (filters.category && t.category !== filters.category) return false
        if (filters.sla && t.slaState !== filters.sla) return false
        if (
          q &&
          !t.subject.toLowerCase().includes(q) &&
          !t.ref.toLowerCase().includes(q) &&
          !personName(t.requesterPersonId).toLowerCase().includes(q)
        )
          return false
        return true
      })
      .sort((a, b) => b.createdAtTime.localeCompare(a.createdAtTime))
  }, [rows, filters, search, personName])

  const open = openId ? tickets.find((t) => (t.id as string) === openId) : undefined

  const requesterBalance = useMemo(() => {
    if (!open) return 0
    return invoices
      .filter(
        (i) =>
          (i.personId as string | null) === (open.requesterPersonId as string) &&
          i.status !== 'cancelled',
      )
      .reduce((acc, i) => acc + i.balance, 0)
  }, [open, invoices])

  const pastTickets = open
    ? tickets.filter(
        (t) =>
          (t.requesterPersonId as string) === (open.requesterPersonId as string) && t.id !== open.id,
      )
    : []

  const allColumns: Record<string, Column<Ticket>> = {
    ref: {
      key: 'ref',
      header: 'Ticket',
      sortable: true,
      sortValue: (t) => t.ref,
      cell: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{t.subject}</p>
          <p className="font-mono text-body-12 text-text-secondary">{t.ref}</p>
        </div>
      ),
      minWidth: 320,
    },
    requester: {
      key: 'requester',
      header: 'Requester',
      sortable: true,
      sortValue: (t) => personName(t.requesterPersonId),
      cell: (t) => <PersonChip name={personName(t.requesterPersonId)} size="sm" short />,
      minWidth: 190,
    },
    category: {
      key: 'category',
      header: 'Category',
      sortable: true,
      sortValue: (t) => t.category,
      accessor: (t) => humanize(t.category),
      width: 130,
    },
    priority: {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      sortValue: (t) => ['low', 'normal', 'high', 'urgent'].indexOf(t.priority),
      cell: (t) => <Badge tone={PRIORITY_TONE[t.priority]}>{humanize(t.priority)}</Badge>,
      width: 110,
    },
    status: {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (t) => t.status,
      cell: (t) => <StatusBadge status={t.status} label={humanize(t.status)} />,
      width: 150,
    },
    owner: {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (t) => (t.ownerUserId ? userName(t.ownerUserId) : ''),
      cell: (t) =>
        t.ownerUserId ? (
          userName(t.ownerUserId)
        ) : (
          <Badge tone="warning" size="sm">
            Unassigned
          </Badge>
        ),
      minWidth: 170,
    },
    source: {
      key: 'source',
      header: 'Source',
      sortable: true,
      sortValue: (t) => t.source,
      cell: (t) => {
        const Icon = SOURCE_ICON[t.source]
        return (
          <span className="inline-flex items-center gap-1.5">
            <Icon size={16} aria-hidden="true" className="text-text-muted" />
            {SOURCE_LABEL[t.source]}
          </span>
        )
      },
      width: 160,
    },
    created: {
      key: 'created',
      header: 'Created',
      sortable: true,
      sortValue: (t) => t.createdAtTime,
      accessor: (t) => formatDateTime(t.createdAtTime),
      width: 170,
    },
    first: {
      key: 'first',
      header: 'First response',
      sortable: true,
      sortValue: (t) => t.firstResponseAt ?? '',
      accessor: (t) => (t.firstResponseAt ? formatDateTime(t.firstResponseAt) : 'None yet'),
      width: 170,
    },
    age: {
      key: 'age',
      header: 'Age',
      align: 'right',
      sortable: true,
      sortValue: ageDays,
      accessor: (t) => `${ageDays(t)}d`,
      width: 80,
    },
    sla: {
      key: 'sla',
      header: 'SLA',
      sortable: true,
      sortValue: (t) => t.slaState,
      cell: (t) => <Badge tone={SLA_TONE[t.slaState]}>{SLA_LABEL[t.slaState]}</Badge>,
      width: 140,
    },
    related: {
      key: 'related',
      header: 'Related record',
      accessor: (t) => t.relatedEntityType ?? '—',
      width: 140,
      className: 'text-text-secondary',
    },
    last: {
      key: 'last',
      header: 'Last message',
      accessor: (t) => t.messages[t.messages.length - 1]?.body ?? '—',
      minWidth: 300,
      className: 'text-text-secondary',
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)
  const hasFilters = search.length > 0 || Object.values(filters).some(Boolean)

  return (
    <Screen>
      <ModuleHeader
        title="Tickets"
        description="One queue for every channel, with the SLA clock visible on each row."
        actions={
          <Button size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
            New ticket
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel what="Tickets" onRetry={retry} />
      ) : (
        <Card padding="none">
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
            <div className="min-w-[320px] flex-1">
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search subject, reference or requester"
                values={filters}
                onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
                onClearAll={() => {
                  setFilters({})
                  setSearch('')
                }}
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    options: [
                      'new',
                      'open',
                      'pending_customer',
                      'escalated',
                      'resolved',
                      'closed',
                      'reopened',
                    ].map((s) => ({ value: s, label: humanize(s) })),
                    width: 170,
                  },
                  {
                    key: 'priority',
                    label: 'Priority',
                    options: PRIORITIES.map((p) => ({ value: p, label: humanize(p) })),
                  },
                  {
                    key: 'category',
                    label: 'Category',
                    options: CATEGORIES.map((c) => ({ value: c, label: humanize(c) })),
                  },
                  {
                    key: 'sla',
                    label: 'SLA',
                    options: [
                      { value: 'within', label: 'Within target' },
                      { value: 'due_soon', label: 'Due soon' },
                      { value: 'breached', label: 'Breached' },
                    ],
                  },
                ]}
                className="py-0"
              />
            </div>
            <ColumnPicker
              catalogue={COLUMN_CATALOGUE}
              visible={visible}
              defaultKeys={defaultKeys}
              onChange={setVisible}
            />
          </div>
          <DataTable
            data={filtered}
            columns={columns}
            rowKey={(t) => t.id as string}
            loading={loading}
            density="compact"
            caption="Support tickets"
            onRowClick={(t) => setOpenId(t.id as string)}
            activeRowKey={openId ?? undefined}
            emptyTitle={hasFilters ? 'No tickets match these filters' : 'No tickets yet'}
            emptyMessage={
              hasFilters
                ? 'Clear the filters to see the whole queue.'
                : 'Tickets arrive from the portals, email, WhatsApp, staff and automations. Raise one here when somebody walks in or calls.'
            }
          />
        </Card>
      )}

      <TicketDrawer
        ticket={open}
        onClose={() => setOpenId(null)}
        onNotice={setNotice}
        personName={personName}
        userName={userName}
        requesterBalance={requesterBalance}
        pastTicketCount={pastTickets.length}
      />

      <NewTicketModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(ref, id) => {
          setNotice(`${ref} raised. It is unanswered, so the first-response clock is running.`)
          setCreating(false)
          setOpenId(id)
        }}
      />
    </Screen>
  )
}

function TicketDrawer({
  ticket,
  onClose,
  onNotice,
  personName,
  userName,
  requesterBalance,
  pastTicketCount,
}: {
  ticket: Ticket | undefined
  onClose: () => void
  onNotice: (message: string) => void
  personName: (id: string | null | undefined) => string
  userName: (id: string | null | undefined) => string
  requesterBalance: number
  pastTicketCount: number
}) {
  const users = useCollection(usersCollection)
  const [composer, setComposer] = useState<'reply' | 'note'>('reply')
  const [body, setBody] = useState('')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [touched, setTouched] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [reopening, setReopening] = useState(false)

  const reset = () => {
    setBody('')
    setTouched(false)
  }

  if (!ticket) {
    return <Drawer open={false} onClose={onClose} title="Ticket" size="xl" />
  }

  const isOpen = OPEN_STATUSES.includes(ticket.status)
  const bodyError = touched && body.trim().length < 3 ? 'Write at least a sentence before sending.' : undefined

  const send = () => {
    setTouched(true)
    if (body.trim().length < 3) return
    if (composer === 'reply') {
      replyToTicket(ticket, body.trim(), channel)
      onNotice(`Reply sent on ${CHANNEL_LABEL[channel]}. ${ticket.ref} is now with the requester.`)
    } else {
      addInternalNote(ticket, body.trim())
      onNotice(`Internal note added to ${ticket.ref}. The requester does not see it.`)
    }
    reset()
  }

  return (
    <>
      <Drawer
        open
        onClose={onClose}
        title={ticket.subject}
        description={ticket.ref}
        size="xl"
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            {ticket.slaState === 'breached' && !ticket.resolvedAt && (
              <Alert tone="danger" title="This ticket has breached its first-response target">
                It was raised {formatDateTime(ticket.createdAtTime)} and is still{' '}
                {humanize(ticket.status).toLowerCase()}. The target for a {humanize(ticket.priority).toLowerCase()}{' '}
                ticket is {FIRST_RESPONSE_TARGET_HOURS[ticket.priority]} hours.
              </Alert>
            )}

            <Card padding="none">
              <CardHeader title="Conversation" description={`${ticket.messages.length} messages`} />
              <CardBody className="space-y-3">
                {ticket.messages.map((m) => (
                  <article
                    key={m.id}
                    className={cn(
                      'rounded-xl border p-3',
                      m.direction === 'internal'
                        ? 'border-warning-line bg-warning-fill'
                        : m.direction === 'inbound'
                          ? 'border-border bg-surface-sunken'
                          : 'border-accent-subtle bg-accent-wash',
                    )}
                  >
                    <header className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          'text-body-13 font-semibold',
                          m.direction === 'internal' ? 'text-warning-ink' : 'text-text',
                        )}
                      >
                        {m.authorPersonId ? personName(m.authorPersonId) : 'System'}
                      </span>
                      <Badge
                        size="sm"
                        tone={
                          m.direction === 'internal'
                            ? 'warning'
                            : m.direction === 'inbound'
                              ? 'neutral'
                              : 'accent'
                        }
                      >
                        {m.direction === 'internal'
                          ? 'Internal note'
                          : m.direction === 'inbound'
                            ? 'Inbound'
                            : 'Outbound'}
                      </Badge>
                      <span className="text-body-12 text-text-secondary">
                        {CHANNEL_LABEL[m.channel]} · {formatDateTime(m.at)}
                      </span>
                    </header>
                    <p
                      className={cn(
                        'text-body-14 whitespace-pre-wrap',
                        m.direction === 'internal' ? 'text-warning-ink' : 'text-text',
                      )}
                    >
                      {m.body}
                    </p>
                  </article>
                ))}
              </CardBody>
            </Card>

            {isOpen ? (
              <Card padding="none">
                <CardHeader
                  title={composer === 'reply' ? 'Reply to the requester' : 'Add an internal note'}
                  description={
                    composer === 'reply'
                      ? 'Sending stops the first-response clock the first time only.'
                      : 'Internal notes are never sent and never touch the SLA clock.'
                  }
                />
                <CardBody className="space-y-3">
                  <Tabs
                    aria-label="Composer mode"
                    variant="pill"
                    size="sm"
                    value={composer}
                    onChange={(id) => setComposer(id as 'reply' | 'note')}
                    tabs={[
                      { id: 'reply', label: 'Reply' },
                      { id: 'note', label: 'Internal note' },
                    ]}
                  />

                  {composer === 'reply' && (
                    <Field label="Channel" required>
                      <Select
                        value={channel}
                        options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
                        onChange={(e) => setChannel(e.target.value as Channel)}
                      />
                    </Field>
                  )}

                  <Field label={composer === 'reply' ? 'Message' : 'Note'} required error={bodyError}>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={4}
                      invalid={Boolean(bodyError)}
                      placeholder={
                        composer === 'reply'
                          ? 'I have checked the payment against the invoice and can confirm it landed on Tuesday.'
                          : 'Waiting on the finance team to confirm the reference before replying.'
                      }
                    />
                  </Field>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={send}>
                      {composer === 'reply' ? 'Send reply' : 'Add note'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEscalating(true)}>
                      Escalate
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setResolving(true)}>
                      Resolve
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Alert
                tone="success"
                title={`This ticket is ${humanize(ticket.status).toLowerCase()}`}
                action={
                  <Button size="sm" variant="secondary" onClick={() => setReopening(true)}>
                    Reopen
                  </Button>
                }
              >
                {ticket.resolution ?? 'No resolution note was recorded.'} Reopening keeps the thread and
                records why the resolution did not hold.
              </Alert>
            )}
          </div>

          <aside className="space-y-4">
            <Card padding="none">
              <CardHeader title="Requester" bare />
              <CardBody padding="tight">
                <PersonChip name={personName(ticket.requesterPersonId)} size="md" />
                <KeyValueList className="mt-3">
                  <KeyValue label="Outstanding balance">
                    <span className={requesterBalance > 0 ? 'text-danger-text' : undefined}>
                      {formatNaira(requesterBalance)}
                    </span>
                  </KeyValue>
                  <KeyValue label="Past tickets">{pastTicketCount}</KeyValue>
                </KeyValueList>
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader title="Assignment" bare />
              <CardBody padding="tight" className="space-y-3">
                <Field label="Owner">
                  <Select
                    value={(ticket.ownerUserId as string | null) ?? ''}
                    placeholder="Unassigned"
                    options={users.map((u) => ({ value: u.id as string, label: userName(u.id) }))}
                    onChange={(e) => {
                      if (!e.target.value) return
                      assignTicket(ticket, e.target.value as UserId)
                      onNotice(`${ticket.ref} assigned to ${userName(e.target.value)}.`)
                    }}
                  />
                </Field>
                <KeyValueList>
                  <KeyValue label="Priority">{humanize(ticket.priority)}</KeyValue>
                  <KeyValue label="Category">{humanize(ticket.category)}</KeyValue>
                  <KeyValue label="Source">{SOURCE_LABEL[ticket.source]}</KeyValue>
                  <KeyValue label="Status">
                    <StatusBadge status={ticket.status} label={humanize(ticket.status)} />
                  </KeyValue>
                </KeyValueList>
              </CardBody>
            </Card>

            <Card padding="none">
              <CardHeader title="SLA" bare />
              <CardBody padding="tight">
                <Badge tone={SLA_TONE[ticket.slaState]}>{SLA_LABEL[ticket.slaState]}</Badge>
                <KeyValueList className="mt-3">
                  <KeyValue label="Raised">{formatDateTime(ticket.createdAtTime)}</KeyValue>
                  <KeyValue label="First-response target">
                    {FIRST_RESPONSE_TARGET_HOURS[ticket.priority]} hours
                  </KeyValue>
                  <KeyValue label="First response">
                    {ticket.firstResponseAt ? formatDateTime(ticket.firstResponseAt) : 'None yet'}
                  </KeyValue>
                  <KeyValue label="Resolved">
                    {ticket.resolvedAt ? formatDateTime(ticket.resolvedAt) : 'Still open'}
                  </KeyValue>
                  <KeyValue label="Policy">
                    <code className="font-mono text-body-12">{ticket.slaPolicyId}</code>
                  </KeyValue>
                </KeyValueList>
              </CardBody>
            </Card>
          </aside>
        </div>
      </Drawer>

      <ResolveModal
        ticket={resolving ? ticket : null}
        onClose={() => setResolving(false)}
        onDone={(message) => {
          setResolving(false)
          onNotice(message)
        }}
      />
      <EscalateModal
        ticket={escalating ? ticket : null}
        onClose={() => setEscalating(false)}
        onDone={(message) => {
          setEscalating(false)
          onNotice(message)
        }}
      />
      <ReopenModal
        ticket={reopening ? ticket : null}
        onClose={() => setReopening(false)}
        onDone={(message) => {
          setReopening(false)
          onNotice(message)
        }}
      />
    </>
  )
}

function ResolveModal({
  ticket,
  onClose,
  onDone,
}: {
  ticket: Ticket | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [resolution, setResolution] = useState('')
  const [notify, setNotify] = useState<Channel | 'none'>('whatsapp')
  const [touched, setTouched] = useState(false)

  const error = touched && resolution.trim().length < 5 ? 'Say what was actually done. The next person reads this.' : undefined

  const submit = () => {
    setTouched(true)
    if (!ticket || resolution.trim().length < 5) return
    resolveTicket(ticket, resolution.trim(), notify === 'none' ? null : notify)
    onDone(`${ticket.ref} resolved.`)
    setResolution('')
    setTouched(false)
  }

  return (
    <Modal
      open={ticket !== null}
      onClose={onClose}
      title="Resolve ticket"
      description={
        ticket
          ? `${ticket.ref} — ${ticket.subject}. The resolution stays on the record and is shown again if anyone reopens it.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Resolve ticket</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Resolution" required error={error}>
          <Textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
            invalid={Boolean(error)}
            placeholder="Payment was matched to invoice INV-2026-0318 and the balance now reads zero."
          />
        </Field>
        <Field
          label="Tell the requester"
          hint="Sending the resolution adds it to the thread as an outbound message."
        >
          <Select
            value={notify}
            options={[
              ...CHANNELS.map((c) => ({ value: c, label: `Send on ${CHANNEL_LABEL[c]}` })),
              { value: 'none', label: 'Do not send — close it quietly' },
            ]}
            onChange={(e) => setNotify(e.target.value as Channel | 'none')}
          />
        </Field>
      </div>
    </Modal>
  )
}

function EscalateModal({
  ticket,
  onClose,
  onDone,
}: {
  ticket: Ticket | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const users = useCollection(usersCollection)
  const userName = useUserName()
  const [toUserId, setToUserId] = useState('')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const toError = touched && !toUserId ? 'Choose who is picking this up.' : undefined
  const reasonError = touched && reason.trim().length < 5 ? 'An escalation without a reason is just a reassignment.' : undefined

  const submit = () => {
    setTouched(true)
    if (!ticket || !toUserId || reason.trim().length < 5) return
    escalateTicket(ticket, toUserId as UserId, reason.trim())
    onDone(`${ticket.ref} escalated to ${userName(toUserId)}.`)
    setToUserId('')
    setReason('')
    setTouched(false)
  }

  return (
    <Modal
      open={ticket !== null}
      onClose={onClose}
      title="Escalate ticket"
      description={
        ticket
          ? `${ticket.ref} — ${ticket.subject}. Escalating moves ownership and records the reason as an internal note.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Escalate</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Escalate to" required error={toError}>
          <Select
            value={toUserId}
            placeholder="Choose a colleague"
            options={users.map((u) => ({ value: u.id as string, label: userName(u.id) }))}
            onChange={(e) => setToUserId(e.target.value)}
          />
        </Field>
        <Field label="Reason" required error={reasonError}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            invalid={Boolean(reasonError)}
            placeholder="Needs a refund decision, which is above my approval limit."
          />
        </Field>
      </div>
    </Modal>
  )
}

function ReopenModal({
  ticket,
  onClose,
  onDone,
}: {
  ticket: Ticket | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)
  const error = touched && reason.trim().length < 5 ? 'Say what came back. This is the reopened-rate number.' : undefined

  const submit = () => {
    setTouched(true)
    if (!ticket || reason.trim().length < 5) return
    reopenTicket(ticket, reason.trim())
    onDone(`${ticket.ref} reopened.`)
    setReason('')
    setTouched(false)
  }

  return (
    <Modal
      open={ticket !== null}
      onClose={onClose}
      size="sm"
      title="Reopen ticket"
      description={ticket ? `${ticket.ref} — the previous resolution is kept in the thread.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Reopen</Button>
        </>
      }
    >
      <Field label="Why it is coming back" required error={error}>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          invalid={Boolean(error)}
          placeholder="The requester says the balance still shows on the portal."
        />
      </Field>
    </Modal>
  )
}

function NewTicketModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (ref: string, id: string) => void
}) {
  const people = useCollection(peopleCollection)
  const users = useCollection(usersCollection)
  const userName = useUserName()

  const [personId, setPersonId] = useState('')
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState<TicketCategory>('payments')
  const [priority, setPriority] = useState<Ticket['priority']>('normal')
  const [source, setSource] = useState<Ticket['source']>('staff')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [body, setBody] = useState('')
  const [touched, setTouched] = useState(false)

  const personError = touched && !personId ? 'Every ticket belongs to a person. Choose who raised it.' : undefined
  const subjectError = touched && subject.trim().length < 5 ? 'A one-line summary the queue can be scanned by.' : undefined
  const bodyError = touched && body.trim().length < 5 ? 'Record what they actually said.' : undefined

  const submit = () => {
    setTouched(true)
    if (!personId || subject.trim().length < 5 || body.trim().length < 5) return
    const ticket = createTicket({
      subject,
      requesterPersonId: personId as PersonId,
      category,
      priority,
      source,
      channel,
      ownerUserId: ownerUserId ? (ownerUserId as UserId) : null,
      body,
      relatedEntityType: category === 'payments' || category === 'refund' ? 'Invoice' : null,
      relatedEntityId: null,
    })
    onCreated(ticket.ref, ticket.id as string)
    setPersonId('')
    setSubject('')
    setBody('')
    setOwnerUserId('')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New ticket"
      description="For a question that arrived somewhere the portals do not reach — a phone call, a conversation at the desk, a message forwarded by a tutor."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Raise ticket</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Requester" required error={personError}>
          <Select
            value={personId}
            placeholder="Choose a person"
            options={people
              .slice(0, 300)
              .map((p) => ({ value: p.id as string, label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ''}` }))}
            onChange={(e) => setPersonId(e.target.value)}
          />
        </Field>

        <Field label="Subject" required error={subjectError}>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            invalid={Boolean(subjectError)}
            placeholder="Payment made on Tuesday still not showing"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" required>
            <Select
              value={category}
              options={CATEGORIES.map((c) => ({ value: c, label: humanize(c) }))}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
            />
          </Field>

          <Field
            label="Priority"
            required
            hint={`First-response target ${FIRST_RESPONSE_TARGET_HOURS[priority]} hours.`}
          >
            <Select
              value={priority}
              options={PRIORITIES.map((p) => ({ value: p, label: humanize(p) }))}
              onChange={(e) => setPriority(e.target.value as Ticket['priority'])}
            />
          </Field>

          <Field label="Source" required>
            <Select
              value={source}
              options={SOURCES.map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
              onChange={(e) => setSource(e.target.value as Ticket['source'])}
            />
          </Field>

          <Field label="Channel of the first message" required>
            <Select
              value={channel}
              options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
              onChange={(e) => setChannel(e.target.value as Channel)}
            />
          </Field>
        </div>

        <Field
          label="Owner"
          optional
          hint="Leave unassigned and it shows on the dashboard's unassigned count until someone picks it up."
        >
          <Select
            value={ownerUserId}
            placeholder="Unassigned"
            options={users.map((u) => ({ value: u.id as string, label: userName(u.id) }))}
            onChange={(e) => setOwnerUserId(e.target.value)}
          />
        </Field>

        <Field label="What they said" required error={bodyError}>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            invalid={Boolean(bodyError)}
            placeholder="Transferred the second instalment on Tuesday morning but the portal still shows a balance."
          />
        </Field>
      </div>
    </Modal>
  )
}
