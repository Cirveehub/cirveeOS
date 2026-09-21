import { useMemo, useState } from 'react'
import { CreditCard, Plus, ShieldAlert, ShieldCheck } from 'lucide-react'

import { formatDate, formatDateTime, humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card as UiCard,
  CardBody,
  ColumnPicker,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  PersonChip,
  Select,
  TableToolbar,
  Textarea,
  useColumnVisibility,
  type BadgeTone,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  branchesCollection,
  cardsCollection,
  peopleCollection,
  useCollection,
  type BranchId,
  type Card,
  type CardId,
  type PersonId,
} from '@/mocks'

import { ErrorPanel, ModuleHeader, Screen, useModuleData, usePersonName, useUserName } from './parts'
import {
  ACCESS_PROFILES,
  accessDecision,
  deactivateCard,
  issueCard,
  nextCardRef,
  reactivateCard,
  suggestUid,
  uidTaken,
} from './writes'

const STATUS_TONE: Record<Card['status'], BadgeTone> = {
  active: 'success',
  suspended: 'warning',
  lost: 'danger',
  deactivated: 'neutral',
  replaced: 'neutral',
}

const HOLDER_TYPES: Array<Card['holderType']> = ['student', 'employee', 'tutor', 'visitor', 'contractor']

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'card', label: 'Card', defaultVisible: true, locked: true },
  { key: 'uid', label: 'Card UID', defaultVisible: false },
  { key: 'holder', label: 'Holder', defaultVisible: true },
  { key: 'holderType', label: 'Holder type', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'profile', label: 'Access profile', defaultVisible: true },
  { key: 'issued', label: 'Issued', defaultVisible: false },
  { key: 'issuedBy', label: 'Issued by', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
  { key: 'lastTap', label: 'Last tap', defaultVisible: true },
  { key: 'chain', label: 'Replaces or replaced by', defaultVisible: true },
]

export default function PhysicalCards() {
  const allCards = useCollection(cardsCollection)
  const branches = useCollection(branchesCollection)
  const personName = usePersonName()
  const userName = useUserName()

  const { loading, error, rows: cards, retry } = useModuleData(allCards, 'physical.cards')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [issuing, setIssuing] = useState(false)
  const [replacing, setReplacing] = useState<Card | null>(null)
  const [deactivating, setDeactivating] = useState<Card | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const branchName = (id: string) => branches.find((b) => (b.id as string) === id)?.name ?? 'Unknown branch'
  const cardRef = (id: string | null) =>
    id ? (allCards.find((c) => (c.id as string) === id)?.cardId ?? 'Unknown card') : null

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return cards
      .filter((card) => {
        if (filters.status && card.status !== filters.status) return false
        if (filters.holderType && card.holderType !== filters.holderType) return false
        if (filters.branch && (card.branchId as string) !== filters.branch) return false
        if (!term) return true
        return (
          card.cardId.toLowerCase().includes(term) ||
          card.uid.toLowerCase().includes(term) ||
          personName(card.personId).toLowerCase().includes(term) ||
          card.accessProfile.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
  }, [cards, filters, search, personName])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const catalogue: Array<Column<Card>> = [
    {
      key: 'card',
      header: 'Card',
      pinned: true,
      minWidth: 150,
      accessor: (row) => <span className="font-mono text-body-13">{row.cardId}</span>,
      sortValue: (row) => row.cardId,
      sortable: true,
    },
    {
      key: 'uid',
      header: 'Card UID',
      width: 170,
      accessor: (row) => <span className="font-mono text-body-12">{row.uid}</span>,
      sortValue: (row) => row.uid,
      sortable: true,
    },
    {
      key: 'holder',
      header: 'Holder',
      minWidth: 200,
      cell: (row) => <PersonChip name={personName(row.personId)} size="sm" short />,
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    {
      key: 'holderType',
      header: 'Holder type',
      width: 140,
      accessor: (row) => humanize(row.holderType),
      sortValue: (row) => row.holderType,
      sortable: true,
    },
    {
      key: 'branch',
      header: 'Branch',
      width: 150,
      accessor: (row) => branchName(row.branchId as string),
      sortValue: (row) => branchName(row.branchId as string),
      sortable: true,
    },
    {
      key: 'profile',
      header: 'Access profile',
      minWidth: 210,
      accessor: (row) => row.accessProfile,
      sortValue: (row) => row.accessProfile,
      sortable: true,
    },
    {
      key: 'issued',
      header: 'Issued',
      width: 124,
      accessor: (row) => formatDate(row.issuedAt),
      sortValue: (row) => row.issuedAt,
      sortable: true,
    },
    {
      key: 'issuedBy',
      header: 'Issued by',
      minWidth: 170,
      accessor: (row) => userName(row.issuedByUserId),
      sortValue: (row) => userName(row.issuedByUserId),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 190,
      cell: (row) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <Badge tone={STATUS_TONE[row.status]} size="sm">
            {humanize(row.status)}
          </Badge>
          {row.deactivationReason && (
            <span className="truncate text-body-12 text-text-secondary">{row.deactivationReason}</span>
          )}
        </span>
      ),
      sortValue: (row) => row.status,
      sortable: true,
    },
    {
      key: 'lastTap',
      header: 'Last tap',
      width: 180,
      accessor: (row) =>
        row.lastTapAt ? formatDateTime(row.lastTapAt) : <span className="text-text-secondary">Never tapped</span>,
      sortValue: (row) => row.lastTapAt ?? '',
      sortable: true,
    },
    {
      key: 'chain',
      header: 'Replaces or replaced by',
      minWidth: 220,
      cell: (row) => {
        const replaces = cardRef(row.replacesCardId as string | null)
        const replacedBy = cardRef(row.replacedByCardId as string | null)
        if (!replaces && !replacedBy) return <span className="text-text-secondary">—</span>
        return (
          <span className="flex min-w-0 flex-col gap-0.5 text-body-12">
            {replaces && <span className="text-text-secondary">Replaces {replaces}</span>}
            {replacedBy && <span className="text-text-secondary">Replaced by {replacedBy}</span>}
          </span>
        )
      },
      sortValue: (row) => (row.replacedByCardId ? 1 : row.replacesCardId ? 2 : 0),
      sortable: true,
    },
    {
      key: 'actions',
      header: 'Actions',
      width: 200,
      cell: (row) => (
        <span className="flex gap-1.5">
          {row.status === 'active' ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                setDeactivating(row)
              }}
            >
              Deactivate
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation()
                reactivateCard(row, 'Reactivated at the desk')
                setNotice(`${row.cardId} is active again. The change is on the audit log.`)
              }}
            >
              Reactivate
            </Button>
          )}
          {row.replacedByCardId === null && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(event) => {
                event.stopPropagation()
                setReplacing(row)
              }}
            >
              Replace
            </Button>
          )}
        </span>
      ),
    },
  ]

  const byKey = new Map(catalogue.map((column) => [column.key, column]))
  const columns = [
    ...visible.map((key) => byKey.get(key)).filter((column): column is Column<Card> => Boolean(column)),
    byKey.get('actions') as Column<Card>,
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Cards"
        description="Who holds a card, what it opens, and what happened to the ones that were lost."
        actions={
          <Button size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setIssuing(true)}>
            Issue card
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel what="Cards" onRetry={retry} />
      ) : (
        <UiCard>
          <CardBody padding="none">
            <TableToolbar
              actions={
                <ColumnPicker
                  catalogue={COLUMN_CATALOGUE}
                  visible={visible}
                  defaultKeys={defaultKeys}
                  onChange={setVisible}
                />
              }
            >
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search by card, UID, holder or access profile"
                values={filters}
                onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                onClearAll={clear}
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    options: (['active', 'suspended', 'lost', 'deactivated', 'replaced'] as const).map(
                      (status) => ({ value: status, label: humanize(status) }),
                    ),
                  },
                  {
                    key: 'holderType',
                    label: 'Holder type',
                    options: HOLDER_TYPES.map((type) => ({ value: type, label: humanize(type) })),
                  },
                  {
                    key: 'branch',
                    label: 'Branch',
                    options: branches.map((branch) => ({ value: branch.id as string, label: branch.name })),
                  },
                ]}
              />
            </TableToolbar>

            <DataTable
              data={rows}
              columns={columns}
              rowKey={(row) => row.id as string}
              loading={loading}
              density="compact"
              bordered={false}
              caption="Cards with holder, access profile, issue details, status and the replacement chain"
              empty={
                filtered ? (
                  <EmptyState
                    variant="search"
                    title="No cards match these filters"
                    message="Try another status or branch, or clear the search."
                    action={
                      <Button size="sm" variant="secondary" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={CreditCard}
                    title="No cards issued"
                    message="Until a card is issued, nobody can tap in and attendance has to be taken by hand."
                    action={
                      <Button size="sm" onClick={() => setIssuing(true)}>
                        Issue the first card
                      </Button>
                    }
                  />
                )
              }
            />
          </CardBody>
        </UiCard>
      )}

      <IssueCardModal
        open={issuing || replacing !== null}
        replacing={replacing}
        onClose={() => {
          setIssuing(false)
          setReplacing(null)
        }}
        onIssued={(message) => {
          setIssuing(false)
          setReplacing(null)
          setNotice(message)
        }}
      />

      <DeactivateModal
        card={deactivating}
        onClose={() => setDeactivating(null)}
        onDone={(message) => {
          setDeactivating(null)
          setNotice(message)
        }}
      />
    </Screen>
  )
}

function IssueCardModal({
  open,
  replacing,
  onClose,
  onIssued,
}: {
  open: boolean
  replacing: Card | null
  onClose: () => void
  onIssued: (message: string) => void
}) {
  const people = useCollection(peopleCollection)
  const branches = useCollection(branchesCollection)
  const cards = useCollection(cardsCollection)
  const personName = usePersonName()

  const [personId, setPersonId] = useState('')
  const [holderType, setHolderType] = useState<Card['holderType']>('student')
  const [branchId, setBranchId] = useState('')
  const [profile, setProfile] = useState(ACCESS_PROFILES[0])
  const [uid, setUid] = useState('')
  const [touched, setTouched] = useState(false)

  const effectivePersonId = replacing ? (replacing.personId as string) : personId
  const effectiveBranchId = branchId || (replacing ? (replacing.branchId as string) : (branches[0]?.id as string) || '')
  const suggestedRef = useMemo(() => nextCardRef(), [cards.length])
  const effectiveUid = (uid || suggestUid(suggestedRef.cardId)).toUpperCase()

  const decision = effectivePersonId ? accessDecision(effectivePersonId as PersonId) : null
  const existing = cards.filter(
    (c) => (c.personId as string) === effectivePersonId && c.status === 'active' && c.id !== replacing?.id,
  )

  const personError = touched && !effectivePersonId ? 'Choose who the card belongs to.' : undefined
  const uidError =
    effectiveUid && uidTaken(effectiveUid) && effectiveUid !== replacing?.uid
      ? `${effectiveUid} is already on another card. A UID is physically unique.`
      : undefined

  const submit = () => {
    setTouched(true)
    if (!effectivePersonId || uidError) return
    const card = issueCard({
      personId: effectivePersonId as PersonId,
      holderType: replacing ? replacing.holderType : holderType,
      branchId: effectiveBranchId as BranchId,
      accessProfile: profile,
      uid: effectiveUid,
      replacesCardId: replacing ? (replacing.id as CardId) : null,
    })
    onIssued(
      replacing
        ? `${card.cardId} issued to replace ${replacing.cardId}. Both the issue and the deactivation are on the audit log.`
        : `${card.cardId} issued to ${personName(effectivePersonId)}. The issue is an audit event.`,
    )
    setPersonId('')
    setUid('')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={replacing ? `Replace ${replacing.cardId}` : 'Issue an access card'}
      description={
        replacing
          ? 'The old card is deactivated as part of this, with the reason recorded and both cards pointing at each other.'
          : 'A card is the physical token. What it opens is decided by the holder’s status at the moment of the tap, not by this form.'
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>{replacing ? 'Issue replacement' : 'Issue card'}</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {replacing ? (
          <KeyValueList columns={2}>
            <KeyValue label="Holder">{personName(replacing.personId)}</KeyValue>
            <KeyValue label="Card being replaced">
              <span className="font-mono text-body-13">{replacing.cardId}</span>
            </KeyValue>
          </KeyValueList>
        ) : (
          <Field label="Holder" required error={personError}>
            <Select
              value={personId}
              placeholder="Choose a person"
              options={people
                .slice(0, 300)
                .map((p) => ({ value: p.id as string, label: `${p.firstName} ${p.lastName}` }))}
              onChange={(e) => setPersonId(e.target.value)}
            />
          </Field>
        )}

        {decision && (
          <Alert
            tone={decision.granted ? 'success' : 'warning'}
            icon={decision.granted ? ShieldCheck : ShieldAlert}
            title={
              decision.granted
                ? `Access would be granted — ${decision.standing.toLowerCase()}`
                : `Access would be denied — ${decision.standing.toLowerCase()}`
            }
          >
            {decision.granted
              ? 'Read from this person’s live status, not from a stored access flag.'
              : `A reader would deny this card right now (${humanize(decision.denialReason ?? 'status_withdrawn').toLowerCase()}). Issuing it is allowed — it starts working the moment the status does.`}
            {decision.notes.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {decision.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {existing.length > 0 && !replacing && (
          <Alert tone="warning" title="This person already holds an active card">
            {existing.map((c) => c.cardId).join(', ')}. Issuing a second one leaves both working — replace
            the old card instead unless a second is genuinely intended.
          </Alert>
        )}

        {!replacing && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Holder type" required>
              <Select
                value={holderType}
                options={HOLDER_TYPES.map((type) => ({ value: type, label: humanize(type) }))}
                onChange={(e) => setHolderType(e.target.value as Card['holderType'])}
              />
            </Field>
            <Field label="Branch" required>
              <Select
                value={effectiveBranchId}
                options={branches.map((branch) => ({ value: branch.id as string, label: branch.name }))}
                onChange={(e) => setBranchId(e.target.value)}
              />
            </Field>
          </div>
        )}

        <Field
          label="Access profile"
          required
          hint="The set of doors and hours this card is for. Status still decides whether any of them open."
        >
          <Select
            value={profile}
            options={ACCESS_PROFILES.map((option) => ({ value: option, label: option }))}
            onChange={(e) => setProfile(e.target.value)}
          />
        </Field>

        <Field
          label="Card UID"
          required
          error={uidError}
          hint={`Read off the card at the encoder. Suggested for ${suggestedRef.cardId} until one is scanned.`}
        >
          <Input
            value={uid || suggestUid(suggestedRef.cardId)}
            onChange={(e) => setUid(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''))}
            invalid={Boolean(uidError)}
            className="font-mono"
          />
        </Field>
      </div>
    </Modal>
  )
}

function DeactivateModal({
  card,
  onClose,
  onDone,
}: {
  card: Card | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [status, setStatus] = useState<'lost' | 'suspended' | 'deactivated'>('lost')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  const error = touched && reason.trim().length < 5 ? 'A reason is required. Every deactivation is audited.' : undefined

  const submit = () => {
    setTouched(true)
    if (!card || reason.trim().length < 5) return
    deactivateCard(card, reason.trim(), status)
    onDone(`${card.cardId} is ${humanize(status).toLowerCase()}. The reason and the actor are on the audit log.`)
    setReason('')
    setTouched(false)
  }

  return (
    <Modal
      open={card !== null}
      onClose={onClose}
      size="sm"
      title="Deactivate card"
      description={card ? `${card.cardId}. The card is never deleted — its tap history stays attached.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={submit}>
            Deactivate card
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What happened" required>
          <Select
            value={status}
            options={[
              { value: 'lost', label: 'Lost — stops working immediately' },
              { value: 'suspended', label: 'Suspended — temporarily out of use' },
              { value: 'deactivated', label: 'Deactivated — retired for good' },
            ]}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          />
        </Field>
        <Field label="Reason" required error={error}>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            invalid={Boolean(error)}
            placeholder="Reported lost at the Bodija gate this morning."
          />
        </Field>
      </div>
    </Modal>
  )
}
