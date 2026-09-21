/**
 * The graduate list — one row per outcome record, which means one row per
 * certificate issued. Nobody drops out of this list for not answering: the
 * consent and response columns say plainly who has been reached and who may
 * be quoted publicly.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
import {
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  EmptyState,
  FilterBar,
  Pagination,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import { TODAY, outcomeRecordsCollection, useCollection } from '@/mocks'
import type { OutcomeRecord } from '@/mocks'

import {
  CHANNEL_LABEL,
  CHECKPOINT_STATUS_LABEL,
  CHECKPOINT_STATUS_TONE,
  ErrorPanel,
  ModuleHeader,
  OUTCOME_TYPE_LABEL,
  OUTCOME_TYPE_ORDER,
  Screen,
  lastContacted,
  monthsBetween,
  nextCheckpoint,
  outcomeTypeTone,
  useCertificateRef,
  useCohortCode,
  useCourseTitle,
  useEmployerName,
  useModuleData,
  usePersonName,
} from './parts'

const PAGE_SIZE = 25

/**
 * Fourteen possible columns, seven shown. The default set answers "who is
 * this, where did they end up, and is anyone chasing them" — the certificate
 * reference, the exact dates and the channel history are opt-in.
 */
const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Graduate', defaultVisible: true, locked: true },
  { key: 'course', label: 'Course', defaultVisible: true },
  { key: 'cohort', label: 'Cohort', defaultVisible: false },
  { key: 'graduated', label: 'Graduated', defaultVisible: false },
  { key: 'certificate', label: 'Certificate', defaultVisible: false },
  { key: 'outcome', label: 'Outcome', defaultVisible: true },
  { key: 'employer', label: 'Employer', defaultVisible: true },
  { key: 'title', label: 'Job title', defaultVisible: false },
  { key: 'placed', label: 'Placement date', defaultVisible: false },
  { key: 'since', label: 'Months since graduation', defaultVisible: false },
  { key: 'next', label: 'Next checkpoint', defaultVisible: true },
  { key: 'contacted', label: 'Last contacted', defaultVisible: false },
  { key: 'response', label: 'Response', defaultVisible: true },
  { key: 'consent', label: 'Consent', defaultVisible: true },
]

export default function Graduates() {
  const navigate = useNavigate()

  const allRecords = useCollection(outcomeRecordsCollection)
  const { loading, error, rows: records, retry } = useModuleData(allRecords, 'outcomes.graduates')

  const personName = usePersonName()
  const courseTitle = useCourseTitle()
  const cohortCode = useCohortCode()
  const employerName = useEmployerName()
  const certificateRef = useCertificateRef()

  const [search, setSearch] = useState('')
  /* Seeded from the query string, so ?outcome=not_yet_placed on a stat card
     arrives here already filtered. */
  const initial = useQueryState()
  const [filters, setFilters] = useState<FilterValues>(() => ({
    outcome: initial.get('outcome'),
    consent: initial.get('consent'),
    checkpoint: initial.get('checkpoint'),
  }))
  const [page, setPage] = useState(1)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return records
      .filter((record) => {
        if (filters.outcome && record.outcomeType !== filters.outcome) return false
        if (filters.consent === 'granted' && !record.consentForPublicUse) return false
        if (filters.consent === 'not_granted' && record.consentForPublicUse) return false
        if (filters.checkpoint) {
          const next = nextCheckpoint(record)
          if (filters.checkpoint === 'complete' ? next !== null : String(next?.month) !== filters.checkpoint) {
            return false
          }
        }
        if (!term) return true
        return (
          personName(record.personId).toLowerCase().includes(term) ||
          certificateRef(record.certificateId).toLowerCase().includes(term) ||
          employerName(record.employerId).toLowerCase().includes(term) ||
          (record.jobTitle ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.graduatedAt.localeCompare(a.graduatedAt))
  }, [records, filters, search, personName, certificateRef, employerName])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const clear = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const columnCatalogue: Array<Column<OutcomeRecord>> = [
    {
      key: 'name',
      header: 'Graduate',
      pinned: true,
      minWidth: 190,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    {
      key: 'course',
      header: 'Course',
      minWidth: 200,
      accessor: (row) => courseTitle(row.courseId),
      sortValue: (row) => courseTitle(row.courseId),
      sortable: true,
    },
    {
      key: 'cohort',
      header: 'Cohort',
      width: 110,
      accessor: (row) => cohortCode(row.cohortId),
      sortValue: (row) => cohortCode(row.cohortId),
      sortable: true,
    },
    {
      key: 'graduated',
      header: 'Graduated',
      width: 124,
      accessor: (row) => formatDate(row.graduatedAt),
      sortValue: (row) => row.graduatedAt,
      sortable: true,
    },
    {
      key: 'certificate',
      header: 'Certificate ID',
      width: 178,
      accessor: (row) => <span className="font-mono text-body-12">{certificateRef(row.certificateId)}</span>,
      sortValue: (row) => certificateRef(row.certificateId),
      sortable: true,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      width: 142,
      cell: (row) => (
        <Badge tone={outcomeTypeTone(row.outcomeType)} size="sm">
          {OUTCOME_TYPE_LABEL[row.outcomeType]}
        </Badge>
      ),
      sortValue: (row) => OUTCOME_TYPE_LABEL[row.outcomeType],
      sortable: true,
    },
    {
      key: 'employer',
      header: 'Employer',
      minWidth: 200,
      accessor: (row) =>
        row.employerId ? (
          employerName(row.employerId)
        ) : (
          <span className="text-text-secondary">—</span>
        ),
      sortValue: (row) => (row.employerId ? employerName(row.employerId) : ''),
      sortable: true,
    },
    {
      key: 'title',
      header: 'Job title',
      minWidth: 190,
      accessor: (row) => row.jobTitle ?? <span className="text-text-secondary">—</span>,
      sortValue: (row) => row.jobTitle ?? '',
      sortable: true,
    },
    {
      key: 'placed',
      header: 'Placed on',
      width: 124,
      accessor: (row) =>
        row.placementDate ? formatDate(row.placementDate) : <span className="text-text-secondary">—</span>,
      sortValue: (row) => row.placementDate ?? '',
      sortable: true,
    },
    {
      key: 'since',
      header: 'Months since graduation',
      align: 'right',
      width: 196,
      accessor: (row) => (
        <span className="tabular-nums">{monthsBetween(row.graduatedAt, TODAY).toFixed(1)}</span>
      ),
      sortValue: (row) => monthsBetween(row.graduatedAt, TODAY),
      sortable: true,
    },
    {
      key: 'next',
      header: 'Next checkpoint',
      width: 166,
      cell: (row) => {
        const next = nextCheckpoint(row)
        if (!next) return <span className="text-text-secondary">All three closed</span>
        return (
          <span className="text-body-13">
            {next.month} month · {formatDate(next.dueDate)}
          </span>
        )
      },
      sortValue: (row) => nextCheckpoint(row)?.dueDate ?? '',
      sortable: true,
    },
    {
      key: 'contacted',
      header: 'Last contacted',
      width: 168,
      cell: (row) => {
        const last = lastContacted(row)
        if (!last) return <span className="text-text-secondary">Not yet contacted</span>
        return (
          <span className="text-body-13">
            {last.lastChannel ? CHANNEL_LABEL[last.lastChannel] : 'Unknown channel'} ·{' '}
            {formatNumber(last.attempts)} {last.attempts === 1 ? 'attempt' : 'attempts'}
          </span>
        )
      },
      sortValue: (row) => lastContacted(row)?.attempts ?? -1,
      sortable: true,
    },
    {
      key: 'response',
      header: 'Response',
      width: 142,
      cell: (row) => {
        const reached = row.checkpoints.filter((c) => c.dueDate <= TODAY)
        if (reached.length === 0) return <Badge tone="neutral" size="sm">Not due yet</Badge>
        const latest = reached[reached.length - 1]
        return (
          <Badge tone={CHECKPOINT_STATUS_TONE[latest.status]} size="sm">
            {CHECKPOINT_STATUS_LABEL[latest.status]}
          </Badge>
        )
      },
      sortValue: (row) => {
        const reached = row.checkpoints.filter((c) => c.dueDate <= TODAY)
        return reached.length === 0 ? '' : reached[reached.length - 1].status
      },
      sortable: true,
    },
    {
      key: 'consent',
      header: 'Consent for public use',
      width: 196,
      cell: (row) =>
        row.consentForPublicUse ? (
          <Badge tone="success" size="sm">
            Granted{row.consentCapturedAt ? ` · ${formatDate(row.consentCapturedAt)}` : ''}
          </Badge>
        ) : (
          <Badge tone="neutral" size="sm">
            Not granted
          </Badge>
        ),
      sortValue: (row) => (row.consentForPublicUse ? 1 : 0),
      sortable: true,
    },
  ]

  const byKey = new Map(columnCatalogue.map((column) => [column.key, column]))
  const columns = visible
    .map((key) => byKey.get(key))
    .filter((column): column is Column<OutcomeRecord> => Boolean(column))

  return (
    <Screen>
      <ModuleHeader
        title="Graduates"
        description="Every certificate issued has a row here. A graduate who never answers a follow-up stays on the list."
      />

      {error ? (
        <ErrorPanel onRetry={retry} what="Graduate outcome records" />
      ) : (
        <Card>
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
                onSearchChange={(value) => {
                  setSearch(value)
                  setPage(1)
                }}
                searchPlaceholder="Search by graduate, certificate ID, employer or job title"
                values={filters}
                onFilterChange={(key, value) => {
                  setFilters((prev) => ({ ...prev, [key]: value }))
                  setPage(1)
                }}
                onClearAll={clear}
                filters={[
                  {
                    key: 'outcome',
                    label: 'Outcome',
                    options: OUTCOME_TYPE_ORDER.map((type) => ({
                      value: type,
                      label: OUTCOME_TYPE_LABEL[type],
                    })),
                  },
                  {
                    key: 'consent',
                    label: 'Consent',
                    options: [
                      { value: 'granted', label: 'Granted' },
                      { value: 'not_granted', label: 'Not granted' },
                    ],
                  },
                  {
                    key: 'checkpoint',
                    label: 'Next checkpoint',
                    options: [
                      { value: '3', label: '3 month' },
                      { value: '6', label: '6 month' },
                      { value: '12', label: '12 month' },
                      { value: 'complete', label: 'All three closed' },
                    ],
                  },
                ]}
              />
            </TableToolbar>

            <DataTable
              data={pageRows}
              columns={columns}
              rowKey={(row) => row.id}
              loading={loading}
              onRowClick={(row) => navigate(`/outcomes/records/${row.id}`)}
              density="compact"

              bordered={false}
              caption="Graduates with course, cohort, certificate, outcome type, employer, checkpoint progress and consent status"
              empty={
                filtered ? (
                  <EmptyState
                    variant="search"
                    title="No graduates match these filters"
                    message="Try another outcome type or checkpoint, or clear the search."
                    action={
                      <Button size="sm" variant="secondary" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={GraduationCap}
                    title="No outcome records yet"
                    message="A record opens by itself when a certificate is issued. Until a cohort certifies, there is no placement rate to quote and nothing to follow up."
                  />
                )
              }
            />

            {rows.length > 0 && (
              <div className="px-4 py-3">
                <Pagination
                  page={page}
                  pageSize={PAGE_SIZE}
                  total={rows.length}
                  onPageChange={setPage}
                  itemNoun="graduates"
                  divided={false}
                />
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </Screen>
  )
}
