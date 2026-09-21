import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronDown, Download, Inbox, LayoutGrid, MessageCircle, Rows3, Upload, UserRoundPlus, Users } from 'lucide-react'
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
  PopoverSeparator,
  Select,
  SkeletonTable,
  StatusBadge,
  TableToolbar,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type TableDensity,
} from '@/ui'
import { formatDate, formatNaira, formatPhone, formatRelative } from '@/lib/format'
import {
  TODAY,
  duplicateCandidatesCollection,
  leadsCollection,
  useCollection,
  usersCollection,
} from '@/mocks'
import type { BranchId, Lead, LeadSource, LossReason, UnitId } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { LeadFilterBar } from '../components/LeadFilterBar'
import { LossReasonModal, ReassignOwnerModal } from '../components/LeadModals'
import { NotNowModal } from '../components/ActivityComposer'
import { toast } from '../components/Toasts'
import {
  ALL_SOURCES,
  SIMPLE_PIPELINE,
  SIMPLE_STAGE_LABEL,
  SIMPLE_STAGE_TONE,
  SIMPLE_STAGE_WRITE,
  SOURCE_LABELS,
  ageTone,
  businessUnitOf,
  branchName,
  courseTitle,
  exitStageForReason,
  simpleStageOf,
  unitName,
  useDirectory,
  waitingLabel,
  whatsappHref,
  type SimpleStage,
} from '../lib/lookups'
import { FILTER_KEYS, readLeadFilters, useFilteredLeads } from '../lib/lead-filters'
import {
  IMPORT_TARGETS,
  analyseImport,
  guessMapping,
  parseCsv,
  runImport,
  type ImportAnalysis,
  type ImportTarget,
  type ParsedCsv,
} from '../lib/import'
import { useCrmScope } from '../lib/scope'
import { downloadCsv, paginate, parseSort, serialiseSort, useQueryState, useScreenLoad } from '../lib/view-state'
import { changeStage, reassignOwner, setNextAction } from '../lib/writes'

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Name', defaultVisible: true, locked: true },
  { key: 'contact', label: 'Phone / WhatsApp', defaultVisible: true },
  { key: 'course', label: 'Course', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'waiting', label: 'Waiting', defaultVisible: true },
  { key: 'nextAction', label: 'Next step', defaultVisible: true },
  { key: 'quotedValue', label: 'Fee quoted', defaultVisible: true },
  { key: 'owner', label: 'Handled by', defaultVisible: true },
  { key: 'referrer', label: 'Referred by', defaultVisible: false },
  { key: 'source', label: 'Came via', defaultVisible: true },
  { key: 'latestSource', label: 'Latest contact via', defaultVisible: false },
  { key: 'campaign', label: 'Campaign', defaultVisible: false },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'created', label: 'Came in', defaultVisible: false },
  { key: 'lastActivity', label: 'Last contact', defaultVisible: true },
  { key: 'ref', label: 'Reference', defaultVisible: false },
]

export default function LeadList() {
  const query = useQueryState()
  const navigate = useNavigate()
  const scope = useCrmScope()
  const { loading, error, retry } = useScreenLoad('crm.leads')
  const directory = useDirectory()

  const allLeads = useCollection(leadsCollection)
  const duplicates = useCollection(duplicateCandidatesCollection)
  const openDuplicates = duplicates.filter((d) => d.status === 'open').length

  const scopeParam = query.get('scope')
  const mine = scopeParam ? scopeParam === 'mine' : scope.ownOnlyByDefault
  const layout = query.get('layout') === 'board' ? 'board' : 'list'

  const baseFilters = readLeadFilters(query, scope.userId)
  const filters = useMemo(
    () => (mine ? { ...baseFilters, owners: [scope.userId as string] } : baseFilters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query.params.toString(), mine, scope.userId],
  )
  const rows = useFilteredLeads(filters)
  const boardFilters = useMemo(() => ({ ...filters, includeClosed: true }), [filters])
  const boardRows = useFilteredLeads(boardFilters)

  const [selected, setSelected] = useState<string[]>([])
  const [losing, setLosing] = useState<Lead[] | null>(null)
  const [parking, setParking] = useState<Lead | null>(null)
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
          return SIMPLE_PIPELINE.indexOf(simpleStageOf(lead.stage))
        case 'waiting':
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

  const moveTo = (leads: Lead[], stage: SimpleStage) => {
    if (stage === 'lost') {
      setLosing(leads)
      return
    }
    if (stage === 'not_now') {
      if (leads.length === 1) setParking(leads[0])
      return
    }
    if (stage === 'enrolled') {
      if (leads.length === 1) navigate(`/crm/admissions/new?leadId=${leads[0].id}`)
      return
    }
    leads.forEach((lead) => changeStage(lead, SIMPLE_STAGE_WRITE[stage]))
    toast({
      tone: 'success',
      title: `${leads.length === 1 ? directory.nameOf(leads[0].personId) : `${leads.length} enquiries`} moved to ${SIMPLE_STAGE_LABEL[stage]}`,
    })
    setSelected([])
  }

  const confirmLoss = (reason: LossReason, note: string) => {
    if (!losing) return
    losing.forEach((lead) => changeStage(lead, exitStageForReason(reason), { reason, note }))
    toast({
      tone: 'success',
      title: `${losing.length === 1 ? directory.nameOf(losing[0].personId) : `${losing.length} enquiries`} marked as lost`,
    })
    setLosing(null)
    setSelected([])
  }

  const exportCsv = (leads: Lead[]) => {
    downloadCsv(
      `cirvee-enquiries-${TODAY}.csv`,
      [
        'Reference',
        'Name',
        'Phone',
        'Course',
        'Stage',
        'Waiting (days)',
        'Next step',
        'Fee quoted (kobo)',
        'Handled by',
        'Referred by',
        'Closed by',
        'Came via',
        'Branch',
        'Unit',
        'Came in',
      ],
      leads.map((lead) => {
        const person = directory.personById.get(lead.personId as string)
        return [
          lead.ref,
          directory.nameOf(lead.personId),
          person?.phone ?? '',
          courseTitle(lead.courseInterestId),
          SIMPLE_STAGE_LABEL[simpleStageOf(lead.stage)],
          String(lead.daysInStage),
          lead.nextAction ?? '',
          String(lead.quotedValue ?? 0),
          directory.userNameOf(lead.ownerUserId),
          lead.referrerPersonId ? directory.nameOf(lead.referrerPersonId) : '',
          lead.closerUserId ? directory.userNameOf(lead.closerUserId) : '',
          SOURCE_LABELS[lead.originalSource],
          branchName(lead.branchId),
          unitName(lead.unitId),
          lead.createdAt.slice(0, 10),
        ]
      }),
    )
    toast({ tone: 'success', title: `Exported ${leads.length} enquiries` })
  }

  const allColumns: Record<string, Column<Lead>> = {
    name: {
      key: 'name',
      header: 'Name',
      sortable: true,
      pinned: true,
      minWidth: 200,
      sortValue: (lead) => directory.nameOf(lead.personId),
      cell: (lead) => <PersonChip name={directory.nameOf(lead.personId)} size="sm" />,
    },
    contact: {
      key: 'contact',
      header: 'Phone / WhatsApp',
      minWidth: 170,
      cell: (lead) => {
        const person = directory.personById.get(lead.personId as string)
        if (!person?.phone && !person?.whatsapp) return <span className="text-text-muted">No number</span>
        const wa = whatsappHref(person)
        return (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-text">
            {formatPhone(person.whatsapp ?? person.phone ?? '')}
            {wa && (
              <a
                href={wa}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                aria-label={`WhatsApp ${directory.nameOf(lead.personId)}`}
                className="text-accent hover:text-accent-hover"
              >
                <MessageCircle size={14} aria-hidden="true" />
              </a>
            )}
          </span>
        )
      },
      sortValue: (lead) => directory.personById.get(lead.personId as string)?.phone ?? '',
      sortable: true,
    },
    course: {
      key: 'course',
      header: 'Course',
      minWidth: 170,
      accessor: (lead) => courseTitle(lead.courseInterestId),
      sortable: true,
    },
    stage: {
      key: 'stage',
      header: 'Stage',
      minWidth: 150,
      sortable: true,
      sortValue: (lead) => SIMPLE_PIPELINE.indexOf(simpleStageOf(lead.stage)),
      cell: (lead) => <StageCell lead={lead} onChange={(stage) => moveTo([lead], stage)} />,
    },
    waiting: {
      key: 'waiting',
      header: 'Waiting',
      minWidth: 120,
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
            {lead.daysInStage === 0 ? 'Today' : `${lead.daysInStage} day${lead.daysInStage === 1 ? '' : 's'}`}
          </span>
        )
      },
    },
    nextAction: {
      key: 'nextAction',
      header: 'Next step',
      minWidth: 220,
      sortable: true,
      sortValue: (lead) => lead.nextActionDueAt ?? '',
      cell: (lead) => {
        if (!lead.nextAction) return <span className="text-warning-text">Nothing planned</span>
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
      header: 'Fee quoted',
      align: 'right',
      minWidth: 120,
      sortable: true,
      sortValue: (lead) => lead.quotedValue ?? 0,
      cell: (lead) =>
        lead.quotedValue === null ? (
          <span className="text-text-muted">Not yet</span>
        ) : (
          <span className="tabular-nums">{formatNaira(lead.quotedValue)}</span>
        ),
    },
    owner: {
      key: 'owner',
      header: 'Handled by',
      minWidth: 160,
      sortable: true,
      sortValue: (lead) => directory.userNameOf(lead.ownerUserId),
      cell: (lead) => <PersonChip name={directory.userNameOf(lead.ownerUserId)} size="sm" short />,
    },
    referrer: {
      key: 'referrer',
      header: 'Referred by',
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
    source: {
      key: 'source',
      header: 'Came via',
      minWidth: 140,
      sortValue: (lead) => SOURCE_LABELS[lead.originalSource],
      sortable: true,
      accessor: (lead) => SOURCE_LABELS[lead.originalSource],
    },
    latestSource: {
      key: 'latestSource',
      header: 'Latest contact via',
      minWidth: 150,
      sortValue: (lead) => SOURCE_LABELS[lead.latestSource],
      sortable: true,
      accessor: (lead) => SOURCE_LABELS[lead.latestSource],
    },
    campaign: {
      key: 'campaign',
      header: 'Campaign',
      minWidth: 140,
      accessor: (lead) => lead.utm.campaign ?? '—',
      sortable: true,
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
      header: 'Came in',
      minWidth: 120,
      sortable: true,
      sortValue: (lead) => lead.createdAt,
      accessor: (lead) => formatDate(lead.createdAt),
    },
    lastActivity: {
      key: 'lastActivity',
      header: 'Last contact',
      minWidth: 130,
      sortable: true,
      sortValue: (lead) => lead.lastActivityAt ?? '',
      accessor: (lead) => (lead.lastActivityAt ? formatRelative(lead.lastActivityAt) : 'Never'),
    },
    ref: {
      key: 'ref',
      header: 'Reference',
      minWidth: 120,
      accessor: (lead) => lead.ref,
    },
  }

  const columns = visibleColumns.map((key) => allColumns[key]).filter(Boolean)

  const countLabel = `${sorted.length} ${filters.stages.length || filters.includeClosed ? 'enquir' : 'open enquir'}${
    sorted.length === 1 ? 'y' : 'ies'
  }${mine ? ' · yours' : ''}`

  return (
    <CrmPage
      title="Enquiries"
      description={loading ? undefined : countLabel}
      error={error}
      onRetry={retry}
      actions={
        <>
          <Button variant="secondary" leftIcon={<Upload size={16} aria-hidden="true" />} onClick={() => setImportOpen(true)}>
            Import from a spreadsheet
          </Button>
          <Button asChild leftIcon={<UserRoundPlus size={16} aria-hidden="true" />}>
            <Link to="/crm/enquiries/new">New enquiry</Link>
          </Button>
        </>
      }
    >
      <TableToolbar
        lead={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              <Button size="sm" variant={mine ? 'primary' : 'ghost'} aria-pressed={mine} onClick={() => query.set('scope', 'mine')}>
                Mine
              </Button>
              <Button size="sm" variant={mine ? 'ghost' : 'primary'} aria-pressed={!mine} onClick={() => query.set('scope', 'all')}>
                Everyone
              </Button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
              <Button
                size="sm"
                variant={layout === 'list' ? 'primary' : 'ghost'}
                aria-pressed={layout === 'list'}
                leftIcon={<Rows3 size={14} aria-hidden="true" />}
                onClick={() => query.set('layout', undefined)}
              >
                List
              </Button>
              <Button
                size="sm"
                variant={layout === 'board' ? 'primary' : 'ghost'}
                aria-pressed={layout === 'board'}
                leftIcon={<LayoutGrid size={14} aria-hidden="true" />}
                onClick={() => query.set('layout', 'board')}
              >
                Board
              </Button>
            </div>
            {openDuplicates > 0 && (
              <Button size="sm" variant="secondary" asChild leftIcon={<Users size={14} aria-hidden="true" />}>
                <Link to="/crm/duplicates">
                  {openDuplicates} possible duplicate{openDuplicates === 1 ? '' : 's'} — review
                </Link>
              </Button>
            )}
          </div>
        }
        selectedCount={selected.length}
        itemNoun="enquiry"
        onClearSelection={() => setSelected([])}
        bulkActions={
          <>
            <Button size="sm" variant="secondary" onClick={() => setReassignOpen(true)}>
              Change who handles
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setNextActionOpen(true)}>
              Set next step
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Download size={14} aria-hidden="true" />} onClick={() => exportCsv(selectedLeads)}>
              Export CSV
            </Button>
          </>
        }
        actions={
          layout === 'list' ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => query.set('density', density === 'compact' ? undefined : 'compact')}
              >
                {density === 'compact' ? 'Comfortable rows' : 'Compact rows'}
              </Button>
              <ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visibleColumns} defaultKeys={defaultKeys} onChange={setVisible} />
              <Button variant="secondary" size="sm" leftIcon={<Download size={14} aria-hidden="true" />} onClick={() => exportCsv(sorted)}>
                Export view
              </Button>
            </>
          ) : undefined
        }
      >
        <LeadFilterBar query={query} hideOwner={mine} />
      </TableToolbar>

      <div className="mt-4">
        {loading ? (
          <SkeletonTable rows={10} columns={Math.min(columns.length, 8)} density={density} />
        ) : !hasAnyLeads ? (
          <EmptyState
            icon={Inbox}
            title="No enquiries yet"
            message="Enquiries arrive from WhatsApp, the website, the kiosk or an event — or you can add one by hand."
            action={
              <Button asChild>
                <Link to="/crm/enquiries/new">New enquiry</Link>
              </Button>
            }
            bordered
          />
        ) : layout === 'board' ? (
          <Board rows={boardRows} onOpen={(lead) => navigate(`/crm/enquiries/${lead.id}`)} />
        ) : sorted.length === 0 ? (
          <EmptyState
            variant="search"
            title={mine && filterCount === 0 ? 'Nothing open on your list' : 'No enquiries match'}
            message={
              mine && filterCount === 0
                ? 'Switch to Everyone to see the rest of the team, or add a new enquiry.'
                : `${filterCount} filter${filterCount === 1 ? '' : 's'} applied.`
            }
            action={
              mine && filterCount === 0 ? (
                <Button variant="secondary" onClick={() => query.set('scope', 'all')}>
                  Show everyone
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => query.clear(['scope', 'layout'])}>
                  Clear filters
                </Button>
              )
            }
            bordered
          />
        ) : (
          <>
            <DataTable
              data={paged}
              columns={columns}
              rowKey={(lead) => lead.id}
              caption="Enquiries with stage, who handles them and the next step"
              density={density}
              minWidth={1300}
              maxHeight="calc(100vh - 360px)"
              selectable
              selectedKeys={selected}
              onSelectionChange={setSelected}
              sort={sort}
              onSortChange={(next) => query.set('sort', serialiseSort(next))}
              onRowClick={(lead) => navigate(`/crm/enquiries/${lead.id}`)}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={sorted.length}
              itemNoun="enquiries"
              onPageChange={(next) => query.set('page', String(next))}
              onPageSizeChange={(size) => query.set('size', String(size))}
            />
          </>
        )}
      </div>

      <LossReasonModal open={losing !== null} onClose={() => setLosing(null)} count={losing?.length ?? 1} onConfirm={confirmLoss} />
      <NotNowModal lead={parking} open={parking !== null} onClose={() => setParking(null)} />

      <ReassignOwnerModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        currentOwnerUserId={selectedLeads[0]?.ownerUserId ?? null}
        count={selectedLeads.length}
        onConfirm={(toUserId, reason) => {
          selectedLeads.forEach((lead) => reassignOwner(lead, toUserId, reason))
          toast({
            tone: 'success',
            title: `${selectedLeads.length} enquir${selectedLeads.length === 1 ? 'y' : 'ies'} now handled by ${directory.userNameOf(toUserId)}`,
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
          toast({ tone: 'success', title: `Next step set on ${selectedLeads.length} enquiries` })
          setSelected([])
        }}
      />

      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </CrmPage>
  )
}

function StageCell({ lead, onChange }: { lead: Lead; onChange: (stage: SimpleStage) => void }) {
  const [open, setOpen] = useState(false)
  const current = simpleStageOf(lead.stage)

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      role="menu"
      width={200}
      content={
        <div className="py-1">
          {SIMPLE_PIPELINE.map((stage) => (
            <PopoverItem
              key={stage}
              onClick={() => {
                setOpen(false)
                if (stage !== current) onChange(stage)
              }}
            >
              {SIMPLE_STAGE_LABEL[stage]}
              {stage === current ? ' · now' : ''}
            </PopoverItem>
          ))}
          <PopoverSeparator />
          <PopoverItem
            onClick={() => {
              setOpen(false)
              onChange('not_now')
            }}
          >
            Not now
          </PopoverItem>
          <PopoverItem
            destructive
            onClick={() => {
              setOpen(false)
              onChange('lost')
            }}
          >
            Mark as lost
          </PopoverItem>
        </div>
      }
    >
      <button
        type="button"
        onClick={(event) => event.stopPropagation()}
        aria-label={`Change stage, currently ${SIMPLE_STAGE_LABEL[current]}`}
        className="inline-flex items-center gap-1 rounded-full"
      >
        <StatusBadge status={current} tone={SIMPLE_STAGE_TONE[current]} label={SIMPLE_STAGE_LABEL[current]} size="sm" />
        <ChevronDown size={12} aria-hidden="true" className="text-text-muted" />
      </button>
    </Popover>
  )
}

function Board({ rows, onOpen }: { rows: Lead[]; onOpen: (lead: Lead) => void }) {
  const directory = useDirectory()
  const recent = (lead: Lead) => lead.stageEnteredAt.slice(0, 10) >= new Date(Date.parse(`${TODAY}T00:00:00Z`) - 30 * 86_400_000).toISOString().slice(0, 10)
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {SIMPLE_PIPELINE.map((stage) => {
        const cards = rows
          .filter((l) => simpleStageOf(l.stage) === stage && (stage !== 'enrolled' || recent(l)))
          .sort((a, b) => b.daysInStage - a.daysInStage)
        return (
          <section key={stage} aria-label={SIMPLE_STAGE_LABEL[stage]} className="flex min-h-64 flex-col rounded-xl border border-border bg-surface-sunken">
            <header className="flex items-center justify-between px-3 py-2">
              <span className="inline-flex items-center gap-2">
                <StatusBadge status={stage} tone={SIMPLE_STAGE_TONE[stage]} label={SIMPLE_STAGE_LABEL[stage]} size="sm" />
                {stage === 'enrolled' && <span className="text-body-12 text-text-muted">last 30 days</span>}
              </span>
              <span className="text-body-12 tabular-nums text-text-secondary">{cards.length}</span>
            </header>
            <ul className="flex flex-col gap-2 px-2 pb-2">
              {cards.map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(lead)}
                    className="w-full rounded-lg border border-border bg-surface p-2.5 text-left transition-colors hover:border-border-strong"
                  >
                    <span className="block truncate text-body-13 font-semibold text-text">{directory.nameOf(lead.personId)}</span>
                    <span className="block truncate text-body-12 text-text-secondary">{courseTitle(lead.courseInterestId)}</span>
                    <span className="mt-1 flex items-center justify-between text-body-12 text-text-muted">
                      <span>{directory.userNameOf(lead.ownerUserId).split(' ')[0]}</span>
                      <span className={ageTone(lead.daysInStage) === 'danger' ? 'text-danger-text' : undefined}>
                        {waitingLabel(lead.daysInStage)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {cards.length === 0 && <li className="px-1 py-4 text-center text-body-12 text-text-muted">Nobody here</li>}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

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
      title={`Set the next step on ${count} enquir${count === 1 ? 'y' : 'ies'}`}
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
            Set next step
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What" required error={touched && invalid ? 'Say what happens next.' : undefined}>
          <Input value={action} invalid={touched && invalid} onChange={(event) => setAction(event.target.value)} placeholder="Call to confirm the cohort date" />
        </Field>
        <Field label="When" required>
          <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const scope = useCrmScope()
  const directory = useDirectory()
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<Record<string, ImportTarget>>({})
  const [branchId, setBranchId] = useState<BranchId | ''>('')
  const [source, setSource] = useState<LeadSource>('import')
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFileName(null)
    setParsed(null)
    setMapping({})
    setImporting(false)
    const me = usersCollection.find(scope.userId)
    setBranchId(me?.primaryBranchId ?? (directory.branches[0]?.id as BranchId) ?? '')
  }, [open, scope.userId, directory.branches])

  const analysis: ImportAnalysis | null = useMemo(
    () => (parsed ? analyseImport(parsed, mapping) : null),
    [parsed, mapping],
  )

  const onFile = (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const csv = parseCsv(String(reader.result ?? ''))
      setParsed(csv)
      setMapping(guessMapping(csv.headers))
    }
    reader.readAsText(file)
  }

  const mappedContact = Object.values(mapping).some((t) => t === 'email' || t === 'phone' || t === 'whatsapp')
  const mappedName = Object.values(mapping).some((t) => t === 'name' || t === 'firstName')
  const importable = analysis ? analysis.counts.fresh + analysis.counts.duplicates : 0
  const canImport = Boolean(parsed && branchId && mappedContact && mappedName && importable > 0)

  const submit = () => {
    if (!analysis || !branchId) return
    setImporting(true)
    const branch = directory.branches.find((b) => b.id === branchId)
    const unitId = (branch as { unitId?: UnitId } | undefined)?.unitId ?? (directory.units[0]?.id as UnitId)
    const outcome = runImport(analysis, { branchId, unitId, defaultSource: source })
    toast({
      tone: 'success',
      title: `${outcome.created} enquir${outcome.created === 1 ? 'y' : 'ies'} added`,
      body:
        outcome.flagged > 0
          ? `${outcome.flagged} look like people we already have — they are in the review queue.`
          : outcome.skipped > 0
            ? `${outcome.skipped} row${outcome.skipped === 1 ? '' : 's'} skipped for having no name or contact.`
            : undefined,
      link: outcome.flagged > 0 ? { label: 'Review possible duplicates', to: '/crm/duplicates' } : undefined,
    })
    setImporting(false)
    onClose()
    if (outcome.flagged > 0) navigate('/crm/duplicates')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Import enquiries from a spreadsheet"
      description="A CSV with one person per row. Each row is checked against people we already have."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canImport} loading={importing} onClick={submit}>
            {analysis ? `Import ${importable} enquir${importable === 1 ? 'y' : 'ies'}` : 'Import'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label
          htmlFor="lead-import-file"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-interactive bg-surface-sunken px-4 py-6 text-center"
        >
          <Upload size={20} aria-hidden="true" className="text-text-muted" />
          <span className="text-body-14 font-medium text-text">{fileName ?? 'Choose a CSV file'}</span>
          <span className="text-body-12 text-text-secondary">The first row must be the column names.</span>
          <input
            id="lead-import-file"
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0])}
          />
        </label>

        {parsed && analysis && (
          <>
            <div>
              <h3 className="text-label-11 text-text-label">Which column is which</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {parsed.headers.map((header) => (
                  <li key={header} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate text-body-13 text-text" title={header}>
                      {header}
                    </span>
                    <Select
                      aria-label={`Column ${header}`}
                      selectSize="sm"
                      value={mapping[header] ?? 'ignore'}
                      onChange={(event) => setMapping({ ...mapping, [header]: event.target.value as ImportTarget })}
                      options={IMPORT_TARGETS}
                    />
                  </li>
                ))}
              </ul>
              {(!mappedName || !mappedContact) && (
                <p className="mt-2 text-body-12 text-danger-text">
                  {!mappedName ? 'Pick which column holds the name. ' : ''}
                  {!mappedContact ? 'Pick a phone, WhatsApp or email column so duplicates can be checked.' : ''}
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Branch" required>
                <Select
                  selectSize="sm"
                  value={branchId}
                  onChange={(event) => setBranchId(event.target.value as BranchId)}
                  placeholder="Choose a branch"
                  options={directory.branchOptions}
                />
              </Field>
              <Field label="Came via, when the file does not say" required>
                <Select
                  selectSize="sm"
                  value={source}
                  onChange={(event) => setSource(event.target.value as LeadSource)}
                  options={ALL_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] }))}
                />
              </Field>
            </div>

            <div className="rounded-xl border border-border bg-surface-sunken p-3">
              <p className="text-body-14 font-semibold text-text">
                {analysis.counts.total} row{analysis.counts.total === 1 ? '' : 's'} · {analysis.counts.fresh} new ·{' '}
                {analysis.counts.duplicates} possible duplicate{analysis.counts.duplicates === 1 ? '' : 's'}
                {analysis.counts.skipped > 0 ? ` · ${analysis.counts.skipped} skipped` : ''}
              </p>
              <ul className="mt-2 divide-y divide-border">
                {analysis.rows.slice(0, 6).map((row) => (
                  <li key={row.index} className="flex items-center justify-between gap-3 py-1.5 text-body-13">
                    <span className="min-w-0 truncate text-text">
                      {row.firstName} {row.lastName}
                      <span className="ml-2 text-text-muted">{row.phone ?? row.email ?? ''}</span>
                      {row.courseText && (
                        <span className="ml-2 text-text-secondary">
                          · {row.course ? row.course.title : `“${row.courseText}” (no matching course)`}
                        </span>
                      )}
                    </span>
                    {row.status === 'new' && (
                      <Badge tone="success" variant="subtle" size="sm">
                        New
                      </Badge>
                    )}
                    {row.status === 'duplicate' && row.match && (
                      <Badge tone="warning" variant="subtle" size="sm">
                        Looks like {row.match.person.firstName} {row.match.person.lastName}
                      </Badge>
                    )}
                    {row.status === 'skipped' && (
                      <Badge tone="neutral" variant="subtle" size="sm">
                        Skipped · {row.problem}
                      </Badge>
                    )}
                  </li>
                ))}
                {analysis.rows.length > 6 && (
                  <li className="py-1.5 text-body-12 text-text-muted">and {analysis.rows.length - 6} more</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
