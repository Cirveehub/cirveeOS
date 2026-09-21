import { useMemo, useState, type DragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, ChevronDown, Handshake, Plus, Scale, Timer } from 'lucide-react'

import { cn } from '@/lib/cn'
import { formatDate, formatNaira, formatNumber, formatPercent } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  ColumnPicker,
  CurrencyInput,
  DataTable,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  MoneyCell,
  Popover,
  PopoverItem,
  Select,
  StatCard,
  StatusBadge,
  TableToolbar,
  Textarea,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import type { BusinessUnit } from '@/app/module-registry'
import {
  CURRENT_USER_ID,
  TODAY,
  addDays,
  clientOrgsCollection,
  corporateDealsCollection,
  unitsCollection,
  useCollection,
  usersCollection,
  type CorporateDeal,
} from '@/mocks'
import { asKobo, dealId, type ClientOrgId, type UnitId, type UserId } from '@/mocks/types'

import {
  ErrorPanel,
  ModuleHeader,
  Screen,
  corporateStamp,
  emitCorporateAudit,
  useModuleData,
  useUserName,
} from './parts'
import {
  CANONICAL_STAGE,
  SIMPLE_STAGES,
  STAGE_LABEL,
  STAGE_PROBABILITY,
  STALLED_DAYS,
  daysInStage,
  isOpen,
  isRenewal,
  isStalled,
  setDealStage,
  simpleStage,
  type SimpleStage,
} from './stages'

const SOURCES = [
  'Inbound — website',
  'Referral — alumnus',
  'Referral — existing client',
  'Outbound',
  'Lagos Tech Week',
  'Existing client',
  'Partner introduction',
]

const DEAL_COLUMNS: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Deal', defaultVisible: true, locked: true },
  { key: 'org', label: 'Client', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'value', label: 'Value', defaultVisible: true },
  { key: 'probability', label: 'Probability', defaultVisible: false },
  { key: 'weighted', label: 'Likely to close', defaultVisible: false },
  { key: 'owner', label: 'Owner', defaultVisible: true },
  { key: 'close', label: 'Expected close', defaultVisible: true },
  { key: 'days', label: 'Waiting', defaultVisible: true },
  { key: 'next', label: 'Next action', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'source', label: 'Source', defaultVisible: false },
]

export default function CorporateDeals() {
  const deals = useCollection(corporateDealsCollection)
  const orgs = useCollection(clientOrgsCollection)
  const units = useCollection(unitsCollection)
  const users = useCollection(usersCollection)
  const userName = useUserName()
  const navigate = useNavigate()

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')
  const [stalledOnly, setStalledOnly] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [view, setView] = useState<'table' | 'board'>('table')
  const [logging, setLogging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { loading, error, rows, retry } = useModuleData(deals, 'corporate.deals')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(DEAL_COLUMNS)

  const orgName = (id: string) => orgs.find((o) => (o.id as string) === id)?.name ?? 'Unknown client'
  const unitCode = (id: string) =>
    (units.find((u) => (u.id as string) === id)?.code.toLowerCase() ?? 'corporate') as BusinessUnit

  const figures = useMemo(() => {
    const open = rows.filter(isOpen)
    const thisYear = TODAY.slice(0, 4)
    const won = rows.filter((d) => !isOpen(d) && d.stageEnteredAt.slice(0, 4) === thisYear)
    const horizon = addDays(TODAY, 90)
    return {
      openCount: open.length,
      openValue: open.reduce((acc, d) => acc + d.value, 0),
      likely: open.reduce((acc, d) => acc + d.weightedValue, 0),
      wonValue: won.reduce((acc, d) => acc + d.value, 0),
      wonCount: won.length,
      stalled: rows.filter(isStalled),
      renewalsDue: orgs.filter((o) => o.renewalDate !== null && o.renewalDate <= horizon).length,
    }
  }, [rows, orgs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((d) => {
      if (filters.stage && simpleStage(d) !== filters.stage) return false
      if (filters.organisation && (d.organisationId as string) !== filters.organisation) return false
      if (filters.owner && (d.ownerUserId as string) !== filters.owner) return false
      if (stalledOnly && !isStalled(d)) return false
      if (mineOnly && (d.ownerUserId as string) !== (CURRENT_USER_ID as string)) return false
      if (q && !d.title.toLowerCase().includes(q) && !d.ref.toLowerCase().includes(q) && !orgName(d.organisationId as string).toLowerCase().includes(q))
        return false
      return true
    })
  }, [rows, filters, search, stalledOnly, mineOnly, orgs])

  const hasFilters = search !== '' || stalledOnly || mineOnly || Object.values(filters).some(Boolean)

  const move = (deal: CorporateDeal, to: SimpleStage) => {
    if (simpleStage(deal) === to) return
    setDealStage(deal.id as string, to)
    setNotice(`${deal.ref} moved to ${STAGE_LABEL[to]}.`)
  }

  const allColumns: Record<string, Column<CorporateDeal>> = {
    ref: {
      key: 'ref',
      header: 'Deal',
      sortable: true,
      sortValue: (d) => d.ref,
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-text">{d.title}</p>
          <p className="font-mono text-body-12 text-text-secondary">{d.ref}</p>
        </div>
      ),
      minWidth: 300,
    },
    org: {
      key: 'org',
      header: 'Client',
      sortable: true,
      sortValue: (d) => orgName(d.organisationId as string),
      accessor: (d) => orgName(d.organisationId as string),
      minWidth: 200,
    },
    stage: {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      sortValue: (d) => SIMPLE_STAGES.indexOf(simpleStage(d)),
      cell: (d) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <StageCell deal={d} onChange={(to) => move(d, to)} />
          {isRenewal(d) && (
            <Badge size="sm" tone="warning">
              Renewal due
            </Badge>
          )}
        </div>
      ),
      minWidth: 190,
    },
    value: {
      key: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      sortValue: (d) => d.value,
      cell: (d) => <MoneyCell kobo={d.value} strong />,
      width: 150,
    },
    probability: {
      key: 'probability',
      header: 'Probability',
      align: 'right',
      sortable: true,
      sortValue: (d) => d.probability,
      accessor: (d) => formatPercent(d.probability, 0),
      width: 110,
    },
    weighted: {
      key: 'weighted',
      header: 'Likely to close',
      align: 'right',
      sortable: true,
      sortValue: (d) => d.weightedValue,
      cell: (d) => <MoneyCell kobo={d.weightedValue} tone="muted" />,
      width: 150,
    },
    owner: {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      sortValue: (d) => userName(d.ownerUserId),
      accessor: (d) => userName(d.ownerUserId),
      minWidth: 170,
    },
    close: {
      key: 'close',
      header: 'Expected close',
      sortable: true,
      sortValue: (d) => d.expectedCloseDate,
      accessor: (d) => formatDate(d.expectedCloseDate),
      width: 150,
    },
    days: {
      key: 'days',
      header: 'Waiting',
      sortable: true,
      sortValue: daysInStage,
      cell: (d) => <WaitingCell deal={d} />,
      width: 150,
    },
    next: {
      key: 'next',
      header: 'Next action',
      accessor: (d) => d.nextAction ?? 'None recorded',
      minWidth: 220,
      className: 'text-text-secondary',
    },
    unit: {
      key: 'unit',
      header: 'Unit',
      sortable: true,
      sortValue: (d) => d.unitId as string,
      cell: (d) => <UnitTag unit={unitCode(d.unitId as string)} size="sm" />,
      width: 120,
    },
    source: {
      key: 'source',
      header: 'Source',
      sortable: true,
      sortValue: (d) => d.source,
      accessor: (d) => d.source,
      minWidth: 170,
      className: 'text-text-secondary',
    },
  }

  const resolved = visible.map((key) => allColumns[key]).filter(Boolean)
  const columns = resolved.length > 0 ? resolved : defaultKeys.map((key) => allColumns[key]).filter(Boolean)

  const owners = useMemo(() => {
    const ids = [...new Set(rows.map((d) => d.ownerUserId as string))]
    return ids
      .filter((id) => users.some((u) => (u.id as string) === id))
      .map((id) => ({ value: id, label: userName(id) }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, users, userName])

  return (
    <Screen>
      <ModuleHeader
        title="Deals"
        description="Every company you are talking to, from first conversation to delivery."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === 'table' ? 'primary' : 'secondary'}
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
            >
              List
            </Button>
            <Button
              size="sm"
              variant={view === 'board' ? 'primary' : 'secondary'}
              onClick={() => setView('board')}
              aria-pressed={view === 'board'}
            >
              Board
            </Button>
            <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setLogging(true)}>
              Log a deal
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Open deals"
          value={formatNumber(figures.openCount)}
          icon={Handshake}
          caption={`${formatNaira(figures.openValue, { compact: true })} on the table`}
          loading={loading}
        />
        <StatCard
          label="Likely to close (₦)"
          value={formatNaira(figures.likely, { compact: true })}
          icon={Scale}
          caption="Each open deal's value at its probability"
          loading={loading}
        />
        <StatCard
          label="Won this year (₦)"
          value={formatNaira(figures.wonValue, { compact: true })}
          icon={Handshake}
          variant="success"
          caption={`${formatNumber(figures.wonCount)} deal${figures.wonCount === 1 ? '' : 's'} won or delivering`}
          loading={loading}
        />
        <StatCard
          label="Renewals due in 90 days"
          value={formatNumber(figures.renewalsDue)}
          icon={CalendarClock}
          variant={figures.renewalsDue > 0 ? 'warning' : 'default'}
          caption="Clients whose contract ends soon or has ended"
          onClick={() => navigate('/corporate/organisations?renewal=due')}
          loading={loading}
        />
      </div>

      {notice && (
        <Alert tone="success" className="mb-5" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {!loading && !stalledOnly && figures.stalled.length > 0 && (
        <Alert
          tone="warning"
          className="mb-5"
          title={`${formatNumber(figures.stalled.length)} deal${figures.stalled.length === 1 ? ' has' : 's have'} been waiting more than ${STALLED_DAYS} days`}
          action={
            <Button size="sm" variant="secondary" onClick={() => setStalledOnly(true)}>
              Show them
            </Button>
          }
        >
          {figures.stalled.map((d) => `${orgName(d.organisationId as string)} · ${d.nextAction ?? d.title}`).join(' — ')}
        </Alert>
      )}

      {error ? (
        <ErrorPanel what="Deals" onRetry={retry} />
      ) : (
        <Card padding="none">
          <TableToolbar
            className="px-4 py-3"
            actions={
              view === 'table' ? (
                <ColumnPicker
                  catalogue={DEAL_COLUMNS}
                  visible={visible}
                  defaultKeys={defaultKeys}
                  onChange={setVisible}
                />
              ) : undefined
            }
          >
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search deals or clients"
              values={filters}
              onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setStalledOnly(false)
                setMineOnly(false)
              }}
              filters={[
                {
                  key: 'stage',
                  label: 'Stage',
                  options: SIMPLE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })),
                },
                {
                  key: 'organisation',
                  label: 'Client',
                  options: orgs.map((o) => ({ value: o.id as string, label: o.name })),
                  width: 220,
                },
                { key: 'owner', label: 'Owner', options: owners, width: 190 },
              ]}
            >
              <Button
                size="sm"
                variant={mineOnly ? 'primary' : 'secondary'}
                onClick={() => setMineOnly((v) => !v)}
                aria-pressed={mineOnly}
              >
                Mine
              </Button>
              <Button
                size="sm"
                variant={stalledOnly ? 'primary' : 'secondary'}
                onClick={() => setStalledOnly((v) => !v)}
                aria-pressed={stalledOnly}
                leftIcon={<Timer size={14} />}
              >
                Waiting more than {STALLED_DAYS} days
              </Button>
            </FilterBar>
          </TableToolbar>

          {view === 'table' ? (
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(d) => d.id as string}
              loading={loading}
              density="compact"
              minWidth={Math.max(1000, columns.length * 165)}
              caption="Corporate deals"
              emptyTitle={hasFilters ? 'No deals match these filters' : 'No deals yet'}
              emptyMessage={
                hasFilters
                  ? 'Clear the filters to see the whole pipeline.'
                  : 'Log the first company you are talking to and it will appear here.'
              }
              emptyAction={
                hasFilters ? undefined : (
                  <Button size="sm" leftIcon={<Plus size={16} />} onClick={() => setLogging(true)}>
                    Log a deal
                  </Button>
                )
              }
            />
          ) : (
            <Board deals={filtered} orgName={orgName} onMove={move} loading={loading} />
          )}
        </Card>
      )}

      <LogDealModal
        open={logging}
        onClose={() => setLogging(false)}
        onCreated={(ref, title) => setNotice(`${ref} logged — ${title}.`)}
      />
    </Screen>
  )
}

function WaitingCell({ deal }: { deal: CorporateDeal }) {
  const days = daysInStage(deal)
  if (!isOpen(deal)) return <span className="text-text-secondary">—</span>
  if (isStalled(deal)) {
    return (
      <Badge size="sm" tone="warning" icon={<Timer size={12} aria-hidden="true" />}>
        waiting {formatNumber(days)} days
      </Badge>
    )
  }
  return <span className="tabular-nums text-text-secondary">{formatNumber(days)} days</span>
}

function StageCell({
  deal,
  onChange,
  size = 'sm',
}: {
  deal: CorporateDeal
  onChange: (stage: SimpleStage) => void
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)
  const current = simpleStage(deal)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      role="menu"
      width={200}
      content={
        <div className="py-1">
          {SIMPLE_STAGES.map((stage) => (
            <PopoverItem
              key={stage}
              onClick={() => {
                setOpen(false)
                if (stage !== current) onChange(stage)
              }}
            >
              {STAGE_LABEL[stage]}
              {stage === current ? ' · current' : ''}
            </PopoverItem>
          ))}
        </div>
      }
    >
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        aria-label={`Move deal, currently ${STAGE_LABEL[current]}`}
        className="inline-flex items-center gap-1 rounded-full"
      >
        <StatusBadge status={deal.stage} label={STAGE_LABEL[current]} size={size} />
        <ChevronDown size={12} aria-hidden="true" className="text-text-muted" />
      </button>
    </Popover>
  )
}

function Board({
  deals,
  orgName,
  onMove,
  loading,
}: {
  deals: CorporateDeal[]
  orgName: (id: string) => string
  onMove: (deal: CorporateDeal, to: SimpleStage) => void
  loading: boolean
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<SimpleStage | null>(null)

  const columns = SIMPLE_STAGES.map((stage) => {
    const mine = deals.filter((d) => simpleStage(d) === stage)
    return { stage, deals: mine, value: mine.reduce((acc, d) => acc + d.value, 0) }
  })

  const drop = (event: DragEvent, stage: SimpleStage) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || dragging
    setOver(null)
    setDragging(null)
    if (!id) return
    const deal = deals.find((d) => (d.id as string) === id)
    if (deal) onMove(deal, stage)
  }

  if (loading) {
    return <p className="p-6 text-center text-body-13 text-text-secondary">Loading the board…</p>
  }

  return (
    <div className="overflow-x-auto p-4">
      <div className="flex gap-3">
        {columns.map((column) => (
          <section
            key={column.stage}
            aria-label={`${STAGE_LABEL[column.stage]} column`}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              if (over !== column.stage) setOver(column.stage)
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null)
            }}
            onDrop={(event) => drop(event, column.stage)}
            className={cn(
              'flex w-64 shrink-0 flex-col rounded-xl border bg-surface-sunken p-3 transition-colors',
              over === column.stage && dragging ? 'border-accent bg-accent-wash' : 'border-border',
            )}
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-label-11 text-text-label">{STAGE_LABEL[column.stage]}</h3>
                <p className="text-body-12 tabular-nums text-text-secondary">
                  {formatNaira(column.value, { compact: true })}
                </p>
              </div>
              <Badge size="sm" tone="neutral">
                {formatNumber(column.deals.length)}
              </Badge>
            </header>
            <ul className="min-h-24 flex-1 space-y-2">
              {column.deals.length === 0 && (
                <li className="rounded-lg border border-dashed border-border p-3 text-center text-body-12 text-text-muted">
                  Drop a deal here
                </li>
              )}
              {column.deals.map((d) => (
                <li
                  key={d.id as string}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', d.id as string)
                    event.dataTransfer.effectAllowed = 'move'
                    setDragging(d.id as string)
                  }}
                  onDragEnd={() => {
                    setDragging(null)
                    setOver(null)
                  }}
                  className={cn(
                    'cursor-grab rounded-lg border border-border bg-surface p-3 active:cursor-grabbing',
                    dragging === (d.id as string) && 'opacity-50',
                  )}
                >
                  <p className="text-body-13 font-medium text-text">{d.title}</p>
                  <p className="mt-0.5 text-body-12 text-text-secondary">{orgName(d.organisationId as string)}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-13 tabular-nums text-text">
                      {formatNaira(d.value, { compact: true })}
                      <span className="ml-2 text-body-12 text-text-secondary">{formatPercent(d.probability, 0)}</span>
                    </p>
                    <StageCell deal={d} onChange={(to) => onMove(d, to)} />
                  </div>
                  {(isStalled(d) || isRenewal(d)) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {isStalled(d) && (
                        <Badge size="sm" tone="warning" icon={<Timer size={12} aria-hidden="true" />}>
                          waiting {formatNumber(daysInStage(d))} days
                        </Badge>
                      )}
                      {isRenewal(d) && (
                        <Badge size="sm" tone="warning">
                          Renewal due
                        </Badge>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}

const SEATS_STATED = /\b\d+\s*(seats?|participants?)\b/i

function composeTitle(title: string, seats: number | null): string {
  const trimmed = title.trim()
  if (seats === null || seats <= 0 || SEATS_STATED.test(trimmed)) return trimmed
  return `${trimmed} — ${seats} seat${seats === 1 ? '' : 's'}`
}

function LogDealModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (ref: string, title: string) => void
}) {
  const deals = useCollection(corporateDealsCollection)
  const orgs = useCollection(clientOrgsCollection)
  const units = useCollection(unitsCollection)
  const users = useCollection(usersCollection)
  const userName = useUserName()

  const [organisationId, setOrganisationId] = useState('')
  const [title, setTitle] = useState('')
  const [stage, setStage] = useState<SimpleStage>('prospect')
  const [value, setValue] = useState<number | null>(null)
  const [probability, setProbability] = useState<string>(String(STAGE_PROBABILITY.prospect))
  const [ownerId, setOwnerId] = useState(CURRENT_USER_ID as string)
  const [unitId, setUnitId] = useState('')
  const [source, setSource] = useState('')
  const [closeDate, setCloseDate] = useState('')
  const [participants, setParticipants] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [touched, setTouched] = useState(false)

  const ownerOptions = useMemo(
    () =>
      users
        .filter((u) => u.status === 'active')
        .map((u) => ({ value: u.id as string, label: `${userName(u.id)} · ${u.email}` })),
    [users, userName],
  )

  const corporateUnit = units.find((u) => u.code.toLowerCase() === 'corporate')
  const effectiveUnitId = unitId || (corporateUnit ? (corporateUnit.id as string) : '')

  const probabilityNumber = probability.trim() === '' ? null : Number(probability)
  const seats = participants.trim() === '' ? null : Number(participants)

  const weighted =
    value !== null && probabilityNumber !== null && Number.isFinite(probabilityNumber)
      ? Math.round((value * probabilityNumber) / 100)
      : null
  const seatPrice = value !== null && seats !== null && seats > 0 ? Math.round(value / seats) : null
  const composed = composeTitle(title, seats)

  const nextRef = useMemo(() => {
    const prefix = `DEAL-${TODAY.slice(0, 4)}-`
    const highest = deals
      .filter((d) => d.ref.startsWith(prefix))
      .reduce((acc, d) => Math.max(acc, Number(d.ref.slice(prefix.length)) || 0), 0)
    return `${prefix}${String(highest + 1).padStart(4, '0')}`
  }, [deals])

  const titleError = touched && title.trim() === '' ? 'Name the engagement — this is how the deal is read in the pipeline.' : undefined
  const orgError = touched && organisationId === '' ? 'A deal belongs to a client. Add the client first if it is not listed.' : undefined
  const valueError =
    touched && (value === null || value <= 0) ? 'Enter the contract value so the deal can be forecast.' : undefined
  const probabilityError =
    probabilityNumber === null || !Number.isFinite(probabilityNumber) || probabilityNumber < 0 || probabilityNumber > 100
      ? touched || probability.trim() !== ''
        ? 'Probability is a whole percentage between 0 and 100.'
        : undefined
      : undefined
  const ownerError = touched && ownerId === '' ? 'Name the owner. An unowned deal is nobody’s to chase.' : undefined
  const unitError = touched && effectiveUnitId === '' ? 'Choose the business unit this revenue lands in.' : undefined
  const sourceError = touched && source === '' ? 'Record where the deal came from.' : undefined
  const closeError =
    touched && closeDate === ''
      ? 'An expected close date is what makes this a forecast rather than a wish.'
      : closeDate !== '' && closeDate < TODAY && stage !== 'won' && stage !== 'delivering'
        ? 'The expected close date is in the past. Move it forward, or log the deal as Won.'
        : undefined
  const participantsError =
    touched && (seats === null || !Number.isFinite(seats) || seats < 1)
      ? 'How many people is this for? Seat count sets the per-seat price.'
      : undefined

  const invalid =
    title.trim() === '' ||
    organisationId === '' ||
    value === null ||
    value <= 0 ||
    probabilityError !== undefined ||
    probabilityNumber === null ||
    ownerId === '' ||
    effectiveUnitId === '' ||
    source === '' ||
    closeDate === '' ||
    closeError !== undefined ||
    seats === null ||
    !Number.isFinite(seats) ||
    seats < 1

  const reset = () => {
    setOrganisationId('')
    setTitle('')
    setStage('prospect')
    setValue(null)
    setProbability(String(STAGE_PROBABILITY.prospect))
    setOwnerId(CURRENT_USER_ID as string)
    setUnitId('')
    setSource('')
    setCloseDate('')
    setParticipants('')
    setNextAction('')
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (invalid || value === null || probabilityNumber === null) return

    const takenIds = new Set(deals.map((d) => d.id as string))
    let sequence = deals.length + 1
    while (takenIds.has(`dl-${String(sequence).padStart(4, '0')}`)) sequence += 1
    const id = dealId(`dl-${String(sequence).padStart(4, '0')}`)

    corporateDealsCollection.insert({
      id,
      ref: nextRef,
      organisationId: organisationId as ClientOrgId,
      title: composed,
      stage: CANONICAL_STAGE[stage],
      value: asKobo(value),
      probability: probabilityNumber,
      weightedValue: asKobo(Math.round((value * probabilityNumber) / 100)),
      ownerUserId: ownerId as UserId,
      unitId: effectiveUnitId as UnitId,
      source,
      expectedCloseDate: closeDate,
      stageEnteredAt: `${TODAY}T09:00:00+01:00`,
      nextAction: nextAction.trim() === '' ? null : nextAction.trim(),
      ...corporateStamp(),
    })
    emitCorporateAudit({
      action: 'corporate_deal.created',
      entityType: 'CorporateDeal',
      entityId: id as string,
      entityRef: nextRef,
      field: 'ownerUserId',
      before: null,
      after: userName(ownerId),
    })

    onCreated(nextRef, composed)
    reset()
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      size="lg"
      title="Log a deal"
      description={`One client, one engagement. It will be saved as ${nextRef}.`}
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancel
          </Button>
          <Button leftIcon={<Plus size={16} />} onClick={submit}>
            Log deal
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Client" required error={orgError}>
          <Select
            value={organisationId}
            placeholder="Choose a client"
            invalid={Boolean(orgError)}
            options={orgs.map((o) => ({ value: o.id as string, label: `${o.name} · ${o.industry}` }))}
            onChange={(e) => setOrganisationId(e.target.value)}
          />
        </Field>

        <Field label="Title" required error={titleError} hint="What is being delivered, in the client's words.">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(titleError)}
            placeholder="Risk analytics upskilling for the credit team"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stage" required hint="Sets a suggested probability you can change.">
            <Select
              value={stage}
              options={SIMPLE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
              onChange={(e) => {
                const next = e.target.value as SimpleStage
                setStage(next)
                setProbability(String(STAGE_PROBABILITY[next]))
              }}
            />
          </Field>

          <Field label="Expected close" required error={closeError}>
            <Input
              type="date"
              value={closeDate}
              invalid={Boolean(closeError)}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contract value" required error={valueError}>
            <CurrencyInput value={value} onChange={setValue} invalid={Boolean(valueError)} />
          </Field>

          <Field label="Probability" required error={probabilityError} hint="Whole percent, 0 to 100.">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={5}
              value={probability}
              invalid={Boolean(probabilityError)}
              onChange={(e) => setProbability(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seats" required error={participantsError} hint="How many people the client expects to send.">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={participants}
              invalid={Boolean(participantsError)}
              onChange={(e) => setParticipants(e.target.value)}
            />
          </Field>

          <Field label="Source" required error={sourceError}>
            <Select
              value={source}
              placeholder="Where did this come from?"
              invalid={Boolean(sourceError)}
              options={SOURCES.map((s) => ({ value: s, label: s }))}
              onChange={(e) => setSource(e.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border bg-surface-sunken p-3">
          <KeyValueList columns={2}>
            <KeyValue label="Likely to close">
              <span className="tabular-nums">
                {weighted === null ? 'Enter a value and a probability' : formatNaira(weighted)}
              </span>
            </KeyValue>
            <KeyValue label="Per seat">
              <span className="tabular-nums">
                {seatPrice === null ? 'Enter a value and a seat count' : formatNaira(seatPrice)}
              </span>
            </KeyValue>
          </KeyValueList>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Owner" required error={ownerError}>
            <Select
              value={ownerId}
              placeholder="Choose a user"
              invalid={Boolean(ownerError)}
              options={ownerOptions}
              onChange={(e) => setOwnerId(e.target.value)}
            />
          </Field>

          <Field label="Business unit" required error={unitError}>
            <Select
              value={effectiveUnitId}
              placeholder="Choose a unit"
              invalid={Boolean(unitError)}
              options={units.map((u) => ({ value: u.id as string, label: u.name }))}
              onChange={(e) => setUnitId(e.target.value)}
            />
          </Field>
        </div>

        {title.trim() !== '' && (
          <p className="text-body-13 text-text-secondary">
            This deal will be saved as <span className="font-medium">{composed}</span>.
          </p>
        )}

        <Field label="Next action" optional hint="The single next thing someone has to do.">
          <Textarea
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            rows={2}
            maxLength={160}
            showCount
            placeholder="Book the scoping call with the learning and development lead"
          />
        </Field>
      </div>
    </Modal>
  )
}
