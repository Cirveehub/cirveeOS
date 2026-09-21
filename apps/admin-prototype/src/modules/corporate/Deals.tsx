import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'

import { formatDate, formatNaira, formatNumber, formatPercent, humanize } from '@/lib/format'
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
  Select,
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
  TODAY,
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

/** The PRD's nine stages, in pipeline order. */
const STAGES: Array<CorporateDeal['stage']> = [
  'prospect',
  'discovery',
  'qualified',
  'proposal',
  'negotiation',
  'won',
  'delivery',
  'completed',
  'renewal',
]

/**
 * The probability the pipeline assumes when a deal enters a stage. It is a
 * starting point, not a rule — the field stays editable, and the weighted
 * value follows whatever is actually typed.
 */
const STAGE_PROBABILITY: Record<CorporateDeal['stage'], number> = {
  prospect: 10,
  discovery: 20,
  qualified: 35,
  proposal: 55,
  negotiation: 70,
  won: 100,
  delivery: 100,
  completed: 100,
  renewal: 60,
}

/** Where corporate work actually comes from, as the seed records it. */
const SOURCES = [
  'Inbound — website',
  'Referral — alumnus',
  'Referral — existing client',
  'Outbound',
  'Lagos Tech Week',
  'Existing client',
  'Partner introduction',
]

/**
 * Twelve columns exist; eight are on by default. Probability and weighted
 * value are pipeline-analysis columns — the dashboard answers those — so they
 * sit behind the picker rather than in front of everyone.
 */
const DEAL_COLUMNS: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Deal', defaultVisible: true, locked: true },
  { key: 'org', label: 'Organisation', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'value', label: 'Value', defaultVisible: true },
  { key: 'probability', label: 'Probability', defaultVisible: false },
  { key: 'weighted', label: 'Weighted value', defaultVisible: false },
  { key: 'owner', label: 'Owner', defaultVisible: true },
  { key: 'close', label: 'Expected close', defaultVisible: true },
  { key: 'days', label: 'Days in stage', defaultVisible: true },
  { key: 'next', label: 'Next action', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'source', label: 'Source', defaultVisible: false },
]

export default function CorporateDeals() {
  const deals = useCollection(corporateDealsCollection)
  const orgs = useCollection(clientOrgsCollection)
  const units = useCollection(unitsCollection)
  const userName = useUserName()

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'table' | 'board'>('table')
  const [logging, setLogging] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { loading, error, rows, retry } = useModuleData(deals, 'corporate.deals')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(DEAL_COLUMNS)

  const orgName = (id: string) => orgs.find((o) => (o.id as string) === id)?.name ?? 'Unknown client'
  const unitCode = (id: string) =>
    (units.find((u) => (u.id as string) === id)?.code.toLowerCase() ?? 'corporate') as BusinessUnit

  const daysInStage = (d: CorporateDeal) =>
    Math.max(
      0,
      Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(d.stageEnteredAt)) / 86_400_000),
    )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((d) => {
      if (filters.stage && d.stage !== filters.stage) return false
      if (filters.organisation && (d.organisationId as string) !== filters.organisation) return false
      if (q && !d.title.toLowerCase().includes(q) && !d.ref.toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, filters, search])

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
      header: 'Organisation',
      sortable: true,
      sortValue: (d) => orgName(d.organisationId as string),
      accessor: (d) => orgName(d.organisationId as string),
      minWidth: 220,
    },
    stage: {
      key: 'stage',
      header: 'Stage',
      sortable: true,
      sortValue: (d) => STAGES.indexOf(d.stage),
      cell: (d) => <StatusBadge status={d.stage} label={humanize(d.stage)} />,
      width: 130,
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
      header: 'Weighted value',
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
      header: 'Days in stage',
      align: 'right',
      sortable: true,
      sortValue: daysInStage,
      cell: (d) => (
        <span className={daysInStage(d) > 45 ? 'text-warning-text tabular-nums' : 'tabular-nums'}>
          {formatNumber(daysInStage(d))}
        </span>
      ),
      width: 120,
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
  /* A hand-edited ?cols= that names nothing real would otherwise blank the table. */
  const columns = resolved.length > 0 ? resolved : defaultKeys.map((key) => allColumns[key]).filter(Boolean)

  const board = STAGES.map((stage) => ({
    stage,
    deals: filtered.filter((d) => d.stage === stage),
  })).filter((column) => column.deals.length > 0)

  return (
    <Screen>
      <ModuleHeader
        title="Deals"
        description="The corporate pipeline, weighted by probability."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === 'table' ? 'primary' : 'secondary'}
              onClick={() => setView('table')}
              aria-pressed={view === 'table'}
            >
              Table
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

      {notice && (
        <Alert tone="success" className="mb-5" onDismiss={() => setNotice(null)}>
          {notice}
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
              searchPlaceholder="Search deals"
              values={filters}
              onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
              onClearAll={() => {
                setFilters({})
                setSearch('')
              }}
              filters={[
                {
                  key: 'stage',
                  label: 'Stage',
                  options: STAGES.map((s) => ({ value: s, label: humanize(s) })),
                },
                {
                  key: 'organisation',
                  label: 'Organisation',
                  options: orgs.map((o) => ({ value: o.id as string, label: o.name })),
                  width: 220,
                },
              ]}
            />
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
              emptyTitle={
                search || Object.values(filters).some(Boolean)
                  ? 'No deals match these filters'
                  : 'No deals yet'
              }
              emptyMessage={
                search || Object.values(filters).some(Boolean)
                  ? 'Clear the filters to see the whole pipeline.'
                  : 'A deal is the unit of corporate work. Nothing is forecast until one exists.'
              }
            />
          ) : (
            <div className="overflow-x-auto p-4">
              {board.length === 0 ? (
                <p className="py-8 text-center text-body-13 text-text-secondary">
                  No deals match these filters.
                </p>
              ) : (
                <div className="flex gap-3">
                  {board.map((column) => (
                    <section
                      key={column.stage}
                      className="w-64 shrink-0 rounded-xl border border-border bg-surface-sunken p-3"
                    >
                      <header className="mb-3 flex items-center justify-between gap-2">
                        <h3 className="text-label-11 text-text-label">{humanize(column.stage)}</h3>
                        <Badge size="sm" tone="neutral">
                          {formatNumber(column.deals.length)}
                        </Badge>
                      </header>
                      <ul className="space-y-2">
                        {column.deals.map((d) => (
                          <li
                            key={d.id as string}
                            className="rounded-lg border border-border bg-surface p-3"
                          >
                            <p className="text-body-13 font-medium text-text">{d.title}</p>
                            <p className="mt-0.5 text-body-12 text-text-secondary">
                              {orgName(d.organisationId as string)}
                            </p>
                            <p className="mt-2 text-body-13 text-text tabular-nums">
                              {formatNaira(d.value, { compact: true })}
                              <span className="ml-2 text-body-12 text-text-secondary">
                                {formatPercent(d.probability, 0)}
                              </span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </div>
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

/* -------------------------------------------------------------------------- */
/* Log a deal                                                                 */
/* -------------------------------------------------------------------------- */

/** Already says how many seats, e.g. "Data & Analytics upskilling — 40 seats". */
const SEATS_STATED = /\b\d+\s*(seats?|participants?)\b/i

/**
 * `CorporateDeal` carries no participants field, and this module cannot add
 * one. The seed's own titles state the seat count ("— 40 seats"), so that is
 * where the number goes, visibly, with the composed title previewed in the
 * modal before anything is written. Flagged for the real schema.
 */
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
  const [stage, setStage] = useState<CorporateDeal['stage']>('prospect')
  const [value, setValue] = useState<number | null>(null)
  const [probability, setProbability] = useState<string>(String(STAGE_PROBABILITY.prospect))
  const [ownerId, setOwnerId] = useState('')
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

  const probabilityNumber = probability.trim() === '' ? null : Number(probability)
  const seats = participants.trim() === '' ? null : Number(participants)

  /* Derived, never typed. */
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

  const titleError = touched && title.trim() === '' ? 'Name the engagement. The title is what the pipeline is read by.' : undefined
  const orgError = touched && organisationId === '' ? 'A deal belongs to a client organisation. Add the organisation first if it is not listed.' : undefined
  const valueError =
    touched && (value === null || value <= 0) ? 'A deal with no value cannot be forecast. Enter the contract value.' : undefined
  const probabilityError =
    probabilityNumber === null || !Number.isFinite(probabilityNumber) || probabilityNumber < 0 || probabilityNumber > 100
      ? touched || probability.trim() !== ''
        ? 'Probability is a whole percentage between 0 and 100.'
        : undefined
      : undefined
  const ownerError = touched && ownerId === '' ? 'Name the owner. An unowned deal is nobody’s to chase.' : undefined
  const unitError = touched && unitId === '' ? 'Choose the business unit this revenue lands in.' : undefined
  const sourceError = touched && source === '' ? 'Record where the deal came from — source drives the referral and marketing reporting.' : undefined
  const closeError =
    touched && closeDate === ''
      ? 'An expected close date is what makes this a forecast rather than a wish.'
      : closeDate !== '' && closeDate < TODAY
        ? 'The expected close date is in the past. Move it forward, or move the deal to Completed.'
        : undefined
  const participantsError =
    touched && (seats === null || !Number.isFinite(seats) || seats < 1)
      ? 'How many people is this for? Seat count sets the delivery plan and the per-seat price.'
      : undefined

  const invalid =
    title.trim() === '' ||
    organisationId === '' ||
    value === null ||
    value <= 0 ||
    probabilityError !== undefined ||
    probabilityNumber === null ||
    ownerId === '' ||
    unitId === '' ||
    source === '' ||
    closeDate === '' ||
    closeDate < TODAY ||
    seats === null ||
    !Number.isFinite(seats) ||
    seats < 1

  const reset = () => {
    setOrganisationId('')
    setTitle('')
    setStage('prospect')
    setValue(null)
    setProbability(String(STAGE_PROBABILITY.prospect))
    setOwnerId('')
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
      stage,
      value: asKobo(value),
      probability: probabilityNumber,
      weightedValue: asKobo(Math.round((value * probabilityNumber) / 100)),
      ownerUserId: ownerId as UserId,
      unitId: unitId as UnitId,
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
      description={`A deal is the unit of corporate work: one organisation, one engagement, one forecast. It will be saved as ${nextRef}.`}
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
        <Field label="Organisation" required error={orgError}>
          <Select
            value={organisationId}
            placeholder="Choose a client"
            invalid={Boolean(orgError)}
            options={orgs.map((o) => ({ value: o.id as string, label: `${o.name} · ${o.industry}` }))}
            onChange={(e) => setOrganisationId(e.target.value)}
          />
        </Field>

        <Field
          label="Title"
          required
          error={titleError}
          hint="What is being delivered, in the client's language."
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={Boolean(titleError)}
            placeholder="Risk analytics upskilling for the credit team"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Stage"
            required
            hint="Changing the stage refreshes the suggested probability. Override it freely."
          >
            <Select
              value={stage}
              options={STAGES.map((s) => ({ value: s, label: humanize(s) }))}
              onChange={(e) => {
                const next = e.target.value as CorporateDeal['stage']
                setStage(next)
                setProbability(String(STAGE_PROBABILITY[next]))
              }}
            />
          </Field>

          <Field label="Expected close" required error={closeError}>
            <Input
              type="date"
              value={closeDate}
              min={TODAY}
              invalid={Boolean(closeError)}
              onChange={(e) => setCloseDate(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contract value" required error={valueError} hint="Naira in, kobo stored.">
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

        <div className="rounded-xl border border-border bg-surface-sunken p-3">
          <KeyValueList columns={2}>
            <KeyValue label="Weighted value">
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
          <p className="mt-2 text-body-12 text-text-secondary">
            Weighted value is value × probability. It is always derived and never typed, so the pipeline
            forecast cannot disagree with the deals it is made of.
          </p>
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
              value={unitId}
              placeholder="Choose a unit"
              invalid={Boolean(unitError)}
              options={units.map((u) => ({ value: u.id as string, label: u.name }))}
              onChange={(e) => setUnitId(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Source" required error={sourceError}>
          <Select
            value={source}
            placeholder="Where did this come from?"
            invalid={Boolean(sourceError)}
            options={SOURCES.map((s) => ({ value: s, label: s }))}
            onChange={(e) => setSource(e.target.value)}
          />
        </Field>

        <Field
          label="Participants expected"
          required
          error={participantsError}
          hint="Seats the client expects to fill. Drives the per-seat price above and the delivery plan."
        >
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

        <Alert tone="info" title="Where the seat count is recorded">
          The deal record has no participants field yet, so the seat count is written into the deal title —
          the same convention the existing pipeline uses ("— 40 seats"). It is captured against the deal's
          delivery plan and stays visible in every list.{' '}
          {title.trim() === '' ? (
            'The composed title will be previewed here once a title is entered.'
          ) : (
            <>
              This deal will be saved as <span className="font-medium">{composed}</span>.
            </>
          )}
        </Alert>

        <Field label="Next action" optional hint="The single next thing someone has to do. Not the seat count.">
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
