/**
 * Leads — §2.2. The working list an admissions officer lives in all day.
 *
 * Filters, sort, page and column set all live in the query string, so a view
 * is a link. Stage changes happen inline, and moving a lead into an exit lane
 * is blocked until a loss reason is supplied.
 */

import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Download,
  Lock,
  Rows3,
  Target,
  Upload,
  UserRoundPlus,
} from 'lucide-react'
import {
  Badge,
  Button,
  ColumnPicker,
  DataTable,
  EmptyState,
  Field,
  Input,
  Modal,
  Pagination,
  PersonChip,
  Popover,
  PopoverItem,
  Select,
  SkeletonTable,
  StatusBadge,
  TableToolbar,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type SortState,
  type TableDensity,
} from '@/ui'
import { formatDate, formatNaira, formatPhone, formatRelative } from '@/lib/format'
import { CURRENT_USER_ID, TODAY, leadsCollection, useCollection } from '@/mocks'
import type { Lead, LeadStage, LossReason, UserId } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { LeadFilterBar } from '../components/LeadFilterBar'
import { LossReasonModal, ReassignOwnerModal } from '../components/LeadModals'
import { toast } from '../components/Toasts'
import {
  ALL_STAGES,
  EXIT_STAGES,
  SOURCE_LABELS,
  STAGE_LABELS,
  ageTone,
  businessUnitOf,
  branchName,
  courseTitle,
  unitName,
  useDirectory,
} from '../lib/lookups'
import { FILTER_KEYS, readLeadFilters, useFilteredLeads } from '../lib/lead-filters'
import {
  downloadCsv,
  paginate,
  parseSort,
  serialiseSort,
  useQueryState,
  useScreenLoad,
} from '../lib/view-state'
import { changeStage, reassignOwner, setNextAction } from '../lib/writes'

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Name', defaultVisible: true, locked: true },
  { key: 'contact', label: 'Phone / WhatsApp', defaultVisible: true },
  { key: 'course', label: 'Course of interest', defaultVisible: true },
  { key: 'originalSource', label: 'Original source', defaultVisible: true },
  { key: 'latestSource', label: 'Latest source', defaultVisible: true },
  { key: 'campaign', label: 'Campaign', defaultVisible: false },
  { key: 'referrer', label: 'Referrer', defaultVisible: true },
  { key: 'owner', label: 'Owner', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'daysInStage', label: 'Days in stage', defaultVisible: true },
  { key: 'nextAction', label: 'Next action', defaultVisible: true },
  { key: 'quotedValue', label: 'Quoted value', defaultVisible: true },
  { key: 'branch', label: 'Branch', defaultVisible: true },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'created', label: 'Created', defaultVisible: false },
  { key: 'lastActivity', label: 'Last activity', defaultVisible: true },
]

export default function LeadList() {
  const query = useQueryState()
  const navigate = useNavigate()
  const { loading, error, retry } = useScreenLoad('crm.leads')
  const directory = useDirectory()

  const allLeads = useCollection(leadsCollection)
  const filters = readLeadFilters(query, CURRENT_USER_ID)
  const rows = useFilteredLeads(filters)

  const [selected, setSelected] = useState<string[]>([])
  const [stageTarget, setStageTarget] = useState<{ leads: Lead[]; stage: LeadStage } | null>(null)
  const [reassignOpen, setReassignOpen] = useState(false)
  const [nextActionOpen, setNextActionOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const density = (query.get('density') as TableDensity) ?? 'comfortable'
  const sort = parseSort(query.get('sort')) ?? { key: 'created', direction: 'desc' as const }
  const page = Number(query.get('page') ?? '1')
  const pageSize = Number(query.get('size') ?? '25')

  const { visible: visibleColumns, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1
    const value = (lead: Lead): string | number => {
      switch (sort.key) {
        case 'name':
          return directory.nameOf(lead.personId)
        case 'stage':
          return ALL_STAGES.indexOf(lead.stage)
        case 'daysInStage':
          return lead.daysInStage
        case 'quotedValue':
          return lead.quotedValue ?? 0
        case 'owner':
          return directory.userNameOf(lead.ownerUserId)
        case 'lastActivity':
          return lead.lastActivityAt ?? ''
        case 'nextAction':
          return lead.nextActionDueAt ?? ''
        default:
          return lead.createdAt
      }
    }
    return [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv)) * factor
    })
  }, [rows, sort, directory])

  const paged = paginate(sorted, page, pageSize)
  const selectedLeads = allLeads.filter((l) => selected.includes(l.id))

  const hasAnyLeads = allLeads.some((l) => !l.archivedAt)
  const filterCount = query.activeCount([...FILTER_KEYS])

  /* ---- actions -------------------------------------------------------- */

  const moveStage = (leads: Lead[], stage: LeadStage) => {
    if (EXIT_STAGES.includes(stage)) {
      setStageTarget({ leads, stage })
      return
    }
    leads.forEach((lead) => changeStage(lead, stage))
    toast({
      tone: 'success',
      title: `Moved ${leads.length === 1 ? directory.nameOf(leads[0].personId) : `${leads.length} leads`} to ${STAGE_LABELS[stage]}`,
      body: 'The stage change is on the audit tab, not the activity feed.',
    })
    setSelected([])
  }

  const confirmLoss = (reason: LossReason, note: string) => {
    if (!stageTarget) return
    stageTarget.leads.forEach((lead) => changeStage(lead, stageTarget.stage, { reason, note }))
    toast({
      tone: 'success',
      title: `${stageTarget.leads.length} lead${stageTarget.leads.length === 1 ? '' : 's'} marked ${STAGE_LABELS[stageTarget.stage].toLowerCase()}`,
      body: 'Loss reason recorded and audited.',
    })
    setStageTarget(null)
    setSelected([])
  }

  const exportCsv = (leads: Lead[]) => {
    downloadCsv(
      `cirvee-leads-${TODAY}.csv`,
      [
        'Reference',
        'Name',
        'Phone',
        'Course of interest',
        'Original source',
        'Latest source',
        'Referrer',
        'Owner',
        'Closer',
        'Stage',
        'Days in stage',
        'Quoted value (kobo)',
        'Branch',
        'Unit',
        'Created',
      ],
      leads.map((lead) => {
        const person = directory.personById.get(lead.personId as string)
        return [
          lead.ref,
          directory.nameOf(lead.personId),
          person?.phone ?? '',
          courseTitle(lead.courseInterestId),
          SOURCE_LABELS[lead.originalSource],
          SOURCE_LABELS[lead.latestSource],
          lead.referrerPersonId ? directory.nameOf(lead.referrerPersonId) : '',
          directory.userNameOf(lead.ownerUserId),
          lead.closerUserId ? directory.userNameOf(lead.closerUserId) : '',
          STAGE_LABELS[lead.stage],
          String(lead.daysInStage),
          String(lead.quotedValue ?? 0),
          branchName(lead.branchId),
          unitName(lead.unitId),
          lead.createdAt.slice(0, 10),
        ]
      }),
    )
    toast({ tone: 'success', title: `Exported ${leads.length} leads`, body: 'CSV downloaded.' })
  }

  /* ---- columns -------------------------------------------------------- */

  const allColumns: Record<string, Column<Lead>> = {
    name: {
      key: 'name',
      header: 'Name',
      sortable: true,
      pinned: true,
      minWidth: 200,
      sortValue: (lead) => directory.nameOf(lead.personId),
      cell: (lead) => {
        const other = directory.people.length ? relationshipCount(lead) : 0
        return (
          <PersonChip
            name={directory.nameOf(lead.personId)}
            size="sm"
            role={lead.ref}
            trailing={
              other > 1 ? (
                <Badge tone="info" variant="subtle" size="sm">
                  {other} roles
                </Badge>
              ) : undefined
            }
          />
        )
      },
    },
    contact: {
      key: 'contact',
      header: 'Phone / WhatsApp',
      minWidth: 150,
      cell: (lead) => {
        const person = directory.personById.get(lead.personId as string)
        if (!person?.phone) return <span className="text-text-muted">No number</span>
        return (
          <span className="whitespace-nowrap text-text">
            {formatPhone(person.phone)}
            {person.whatsapp && person.whatsapp !== person.phone && (
              <span className="ml-1 text-text-muted">· WhatsApp differs</span>
            )}
          </span>
        )
      },
      sortValue: (lead) => directory.personById.get(lead.personId as string)?.phone ?? '',
      sortable: true,
    },
    course: {
      key: 'course',
      header: 'Course of interest',
      minWidth: 170,
      accessor: (lead) => courseTitle(lead.courseInterestId),
      sortable: true,
    },
    originalSource: {
      key: 'originalSource',
      header: 'Original source',
      minWidth: 150,
      sortValue: (lead) => SOURCE_LABELS[lead.originalSource],
      sortable: true,
      cell: (lead) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap text-text-secondary">
          <Lock size={12} aria-hidden="true" />
          {SOURCE_LABELS[lead.originalSource]}
          <span className="sr-only">Immutable</span>
        </span>
      ),
    },
    latestSource: {
      key: 'latestSource',
      header: 'Latest source',
      minWidth: 140,
      sortValue: (lead) => SOURCE_LABELS[lead.latestSource],
      sortable: true,
      cell: (lead) => (
        <Badge tone={lead.latestSource === lead.originalSource ? 'neutral' : 'accent'} variant="subtle">
          {SOURCE_LABELS[lead.latestSource]}
        </Badge>
      ),
    },
    campaign: {
      key: 'campaign',
      header: 'Campaign',
      minWidth: 140,
      accessor: (lead) => lead.utm.campaign ?? '—',
      sortable: true,
    },
    referrer: {
      key: 'referrer',
      header: 'Referrer',
      minWidth: 160,
      sortValue: (lead) => (lead.referrerPersonId ? directory.nameOf(lead.referrerPersonId) : ''),
      sortable: true,
      cell: (lead) =>
        lead.referrerPersonId ? (
          <PersonChip name={directory.nameOf(lead.referrerPersonId)} size="sm" short />
        ) : (
          <span className="text-text-muted">Nobody</span>
        ),
    },
    owner: {
      key: 'owner',
      header: 'Owner',
      minWidth: 160,
      sortable: true,
      sortValue: (lead) => directory.userNameOf(lead.ownerUserId),
      cell: (lead) => <PersonChip name={directory.userNameOf(lead.ownerUserId)} size="sm" short />,
    },
    stage: {
      key: 'stage',
      header: 'Stage',
      minWidth: 150,
      sortable: true,
      sortValue: (lead) => ALL_STAGES.indexOf(lead.stage),
      cell: (lead) => <StageCell lead={lead} onChange={(stage) => moveStage([lead], stage)} />,
    },
    daysInStage: {
      key: 'daysInStage',
      header: 'Days in stage',
      align: 'right',
      minWidth: 110,
      sortable: true,
      sortValue: (lead) => lead.daysInStage,
      cell: (lead) => {
        const tone = ageTone(lead.daysInStage)
        return (
          <span
            className={
              tone === 'danger'
                ? 'font-semibold text-danger-text'
                : tone === 'warning'
                  ? 'font-semibold text-warning-text'
                  : 'text-text'
            }
          >
            {lead.daysInStage}
          </span>
        )
      },
    },
    nextAction: {
      key: 'nextAction',
      header: 'Next action',
      minWidth: 230,
      sortable: true,
      sortValue: (lead) => lead.nextActionDueAt ?? '',
      cell: (lead) => {
        if (!lead.nextAction) {
          return <span className="text-warning-text">No next action set</span>
        }
        const overdue = Boolean(lead.nextActionDueAt && lead.nextActionDueAt.slice(0, 10) < TODAY)
        return (
          <div className="min-w-0">
            <p className="truncate text-text">{lead.nextAction}</p>
            {lead.nextActionDueAt && (
              <p className={overdue ? 'text-body-12 text-danger-text' : 'text-body-12 text-text-muted'}>
                {overdue ? 'Overdue · ' : 'Due '}
                {formatDate(lead.nextActionDueAt)}
              </p>
            )}
          </div>
        )
      },
    },
    quotedValue: {
      key: 'quotedValue',
      header: 'Quoted value',
      align: 'right',
      minWidth: 120,
      sortable: true,
      sortValue: (lead) => lead.quotedValue ?? 0,
      cell: (lead) =>
        lead.quotedValue === null ? (
          <span className="text-text-muted">Not quoted</span>
        ) : (
          <span className="tabular-nums">{formatNaira(lead.quotedValue)}</span>
        ),
    },
    branch: {
      key: 'branch',
      header: 'Branch',
      minWidth: 120,
      accessor: (lead) => branchName(lead.branchId),
      sortable: true,
    },
    unit: {
      key: 'unit',
      header: 'Unit',
      minWidth: 120,
      sortable: true,
      sortValue: (lead) => unitName(lead.unitId),
      cell: (lead) => {
        const unit = businessUnitOf(lead.unitId)
        return unit ? <UnitTag unit={unit} size="sm" /> : <span className="text-text-muted">—</span>
      },
    },
    created: {
      key: 'created',
      header: 'Created',
      minWidth: 120,
      sortable: true,
      sortValue: (lead) => lead.createdAt,
      accessor: (lead) => formatDate(lead.createdAt),
    },
    lastActivity: {
      key: 'lastActivity',
      header: 'Last activity',
      minWidth: 130,
      sortable: true,
      sortValue: (lead) => lead.lastActivityAt ?? '',
      accessor: (lead) =>
        lead.lastActivityAt ? formatRelative(lead.lastActivityAt) : 'Nothing logged',
    },
  }

  const columns = visibleColumns.map((key) => allColumns[key]).filter(Boolean)

  function relationshipCount(lead: Lead): number {
    const person = directory.personById.get(lead.personId as string)
    return person ? 1 + person.mergedFromPersonIds.length : 1
  }

  return (
    <CrmPage
      title="Leads"
      description="Every lead has an owner, a source, a stage and a next action."
      breadcrumbs={[{ label: 'CRM & admissions', to: '/crm' }, { label: 'Leads' }]}
      error={error}
      onRetry={retry}
      actions={
        <>
          <Button
            variant="secondary"
            leftIcon={<Upload size={16} aria-hidden="true" />}
            onClick={() => setImportOpen(true)}
          >
            Import leads
          </Button>
          <Button asChild leftIcon={<UserRoundPlus size={16} aria-hidden="true" />}>
            <Link to="/crm/leads/new">New lead</Link>
          </Button>
        </>
      }
    >
      <TableToolbar
        selectedCount={selected.length}
        itemNoun="lead"
        onClearSelection={() => setSelected([])}
        bulkActions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setReassignOpen(true)}>
              Reassign owner
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setNextActionOpen(true)}>
              Set next action
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Download size={14} aria-hidden="true" />}
              onClick={() => exportCsv(selectedLeads)}
            >
              Export CSV
            </Button>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Rows3 size={14} aria-hidden="true" />}
              onClick={() =>
                query.set('density', density === 'compact' ? undefined : 'compact')
              }
            >
              {density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
            </Button>
            <ColumnPicker
              catalogue={COLUMN_CATALOGUE}
              visible={visibleColumns}
              defaultKeys={defaultKeys}
              onChange={setVisible}
            />
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} aria-hidden="true" />}
              onClick={() => exportCsv(sorted)}
            >
              Export view
            </Button>
          </>
        }
      >
        <LeadFilterBar query={query} />
      </TableToolbar>

      <div className="mt-4">
        {loading ? (
          <SkeletonTable rows={10} columns={Math.min(columns.length, 8)} density={density} />
        ) : !hasAnyLeads ? (
          <EmptyState
            icon={Target}
            title="No leads yet"
            message="Leads arrive from the website form, WhatsApp, the kiosk or an event scan — or you can add one by hand."
            action={
              <Button asChild>
                <Link to="/crm/leads/new">New lead</Link>
              </Button>
            }
            bordered
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            variant="search"
            title="No leads match these filters"
            message={`${filterCount} filter${filterCount === 1 ? '' : 's'} applied. Clearing them brings back all ${allLeads.length} leads.`}
            action={
              <Button variant="secondary" onClick={() => query.clear()}>
                Clear filters
              </Button>
            }
            bordered
          />
        ) : (
          <>
            <DataTable
              data={paged}
              columns={columns}
              rowKey={(lead) => lead.id}
              caption="Leads, with owner, source, stage and next action"
              density={density}
              minWidth={1500}
              maxHeight="calc(100vh - 360px)"
              selectable
              selectedKeys={selected}
              onSelectionChange={setSelected}
              sort={sort}
              onSortChange={(next) => query.set('sort', serialiseSort(next))}
              onRowClick={(lead) => navigate(`/crm/leads/${lead.id}`)}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={sorted.length}
              itemNoun="leads"
              onPageChange={(next) => query.set('page', String(next))}
              onPageSizeChange={(size) => query.set('size', String(size))}
            />
          </>
        )}
      </div>

      <LossReasonModal
        open={stageTarget !== null}
        onClose={() => setStageTarget(null)}
        stage={stageTarget?.stage ?? null}
        count={stageTarget?.leads.length ?? 1}
        onConfirm={confirmLoss}
      />

      <ReassignOwnerModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        currentOwnerUserId={selectedLeads[0]?.ownerUserId ?? null}
        count={selectedLeads.length}
        onConfirm={(toUserId, reason) => {
          selectedLeads.forEach((lead) => reassignOwner(lead, toUserId, reason))
          toast({
            tone: 'success',
            title: `${selectedLeads.length} lead${selectedLeads.length === 1 ? '' : 's'} reassigned`,
            body: 'Ownership history preserved. Referrer and closer untouched.',
          })
          setSelected([])
        }}
      />

      <NextActionModal
        open={nextActionOpen}
        onClose={() => setNextActionOpen(false)}
        count={selectedLeads.length}
        onConfirm={(action, dueAt) => {
          selectedLeads.forEach((lead) => setNextAction(lead, action, dueAt))
          toast({ tone: 'success', title: `Next action set on ${selectedLeads.length} leads` })
          setSelected([])
        }}
      />

      <ImportLeadsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </CrmPage>
  )
}

/* -------------------------------------------------------------------------- */
/* Inline stage change                                                        */
/* -------------------------------------------------------------------------- */

function StageCell({ lead, onChange }: { lead: Lead; onChange: (stage: LeadStage) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      role="menu"
      width={210}
      content={
        <div className="max-h-80 overflow-y-auto py-1">
          {ALL_STAGES.map((stage) => (
            <PopoverItem
              key={stage}
              onClick={() => {
                setOpen(false)
                if (stage !== lead.stage) onChange(stage)
              }}
              destructive={EXIT_STAGES.includes(stage)}
            >
              {STAGE_LABELS[stage]}
              {stage === lead.stage ? ' · current' : ''}
            </PopoverItem>
          ))}
        </div>
      }
    >
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        aria-label={`Change stage, currently ${STAGE_LABELS[lead.stage]}`}
        className="inline-flex items-center gap-1 rounded-full"
      >
        <StatusBadge status={lead.stage} label={STAGE_LABELS[lead.stage]} size="sm" />
        <ChevronDown size={12} aria-hidden="true" className="text-text-muted" />
      </button>
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */
/* Bulk next action                                                           */
/* -------------------------------------------------------------------------- */

function NextActionModal({
  open,
  onClose,
  count,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  count: number
  onConfirm: (action: string, dueAt: string) => void
}) {
  const [action, setAction] = useState('')
  const [due, setDue] = useState(TODAY)
  const [touched, setTouched] = useState(false)
  const invalid = !action.trim()

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={`Set next action on ${count} lead${count === 1 ? '' : 's'}`}
      description="Every lead needs a next action. This overwrites whatever is there now."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={invalid}
            onClick={() => {
              setTouched(true)
              if (invalid) return
              onConfirm(action.trim(), `${due}T09:00:00+01:00`)
              setAction('')
              onClose()
            }}
          >
            Set next action
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Action"
          required
          error={touched && invalid ? 'Describe what happens next.' : undefined}
        >
          <Input
            value={action}
            invalid={touched && invalid}
            onChange={(event) => setAction(event.target.value)}
            placeholder="Call to discuss cohort dates"
          />
        </Field>
        <Field label="Due date" required>
          <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

const IMPORT_TARGETS = [
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'course', label: 'Course of interest' },
  { value: 'source', label: 'Source' },
  { value: 'ignore', label: 'Do not import' },
]

const SAMPLE_HEADERS = ['First name', 'Surname', 'Email address', 'Mobile', 'Programme', 'Channel']

function ImportLeadsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const [file, setFile] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({
    'First name': 'firstName',
    Surname: 'lastName',
    'Email address': 'email',
    Mobile: 'phone',
    Programme: 'course',
    Channel: 'source',
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Import leads"
      description="Every row runs through the duplicate check before a Person is created."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!file}
            onClick={() => {
              onClose()
              navigate('/crm/duplicates')
            }}
          >
            Review 23 likely duplicates
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label
          htmlFor="lead-import-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-interactive bg-surface-sunken px-4 py-8 text-center"
        >
          <Upload size={20} aria-hidden="true" className="text-text-muted" />
          <span className="text-body-14 font-medium text-text">
            {file ?? 'Choose a CSV file, or drop one here'}
          </span>
          <span className="text-body-12 text-text-secondary">
            One row per lead. The first row must be the header.
          </span>
          <input
            id="lead-import-file"
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0]?.name ?? null)}
          />
        </label>

        {file && (
          <>
            <div>
              <h3 className="text-label-11 text-text-label">Column mapping</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {SAMPLE_HEADERS.map((header) => (
                  <li key={header} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-body-13 text-text">{header}</span>
                    <Select
                      aria-label={`Map column ${header}`}
                      selectSize="sm"
                      value={mapping[header] ?? 'ignore'}
                      onChange={(event) =>
                        setMapping({ ...mapping, [header]: event.target.value })
                      }
                      options={IMPORT_TARGETS}
                    />
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-info-line bg-info-fill p-3 text-info-ink">
              <p className="text-body-14 font-semibold">312 rows · 289 new · 23 likely duplicates</p>
              <p className="mt-1 text-body-13">
                The 23 matches are held in the duplicate review queue. Nothing is written until each
                one is resolved.
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
