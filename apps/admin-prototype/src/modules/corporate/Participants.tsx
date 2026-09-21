import { useMemo, useState } from 'react'

import { formatNumber } from '@/lib/format'
import {
  Badge,
  Card,
  ColumnPicker,
  DataTable,
  FilterBar,
  MoneyCell,
  PersonChip,
  ProgressBar,
  StatCard,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import { clientOrgsCollection, useCollection } from '@/mocks'

import { useParticipants } from './data'
import type { Participant } from './participant-model'
import { ErrorPanel, ModuleHeader, Screen, useModuleData, usePersonName } from './parts'

const PARTICIPANT_COLUMNS: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Participant', defaultVisible: true, locked: true },
  { key: 'org', label: 'Organisation', defaultVisible: true },
  { key: 'cohort', label: 'Cohort', defaultVisible: true },
  { key: 'course', label: 'Course', defaultVisible: true },
  { key: 'invoice', label: 'Paid by', defaultVisible: false },
  { key: 'seat', label: 'Seat price', defaultVisible: false },
  { key: 'attendance', label: 'Attendance', defaultVisible: true },
  { key: 'progress', label: 'Progress', defaultVisible: true },
  { key: 'pre', label: 'Pre-assessment', defaultVisible: false },
  { key: 'post', label: 'Post-assessment', defaultVisible: false },
  { key: 'gain', label: 'Gain', defaultVisible: true },
  { key: 'certificate', label: 'Certificate', defaultVisible: true },
]

export default function CorporateParticipants() {
  const participants = useParticipants()
  const orgs = useCollection(clientOrgsCollection)
  const personName = usePersonName()

  const [filters, setFilters] = useState<FilterValues>({})
  const [search, setSearch] = useState('')

  const { loading, error, rows, retry } = useModuleData(participants, 'corporate.participants')
  const { visible, defaultKeys, setVisible } = useColumnVisibility(PARTICIPANT_COLUMNS)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((p) => {
      if (filters.organisation && p.organisationId !== filters.organisation) return false
      if (filters.certificate === 'issued' && !p.certificateIssued) return false
      if (filters.certificate === 'pending' && p.certificateIssued) return false
      if (q && !personName(p.personId).toLowerCase().includes(q) && !p.cohortCode.toLowerCase().includes(q))
        return false
      return true
    })
  }, [rows, filters, search, personName])

  const withGain = filtered.filter((p) => p.gain !== null)
  const averageGain =
    withGain.length === 0
      ? null
      : Number((withGain.reduce((acc, p) => acc + (p.gain ?? 0), 0) / withGain.length).toFixed(1))

  const allColumns: Record<string, Column<Participant>> = {
    name: {
      key: 'name',
      header: 'Participant',
      sortable: true,
      sortValue: (p) => personName(p.personId),
      cell: (p) => <PersonChip name={personName(p.personId)} size="sm" />,
      minWidth: 210,
    },
    org: {
      key: 'org',
      header: 'Organisation',
      sortable: true,
      sortValue: (p) => p.organisationName,
      accessor: (p) => p.organisationName,
      minWidth: 220,
    },
    cohort: {
      key: 'cohort',
      header: 'Cohort',
      sortable: true,
      sortValue: (p) => p.cohortCode,
      accessor: (p) => p.cohortCode,
      width: 110,
    },
    course: {
      key: 'course',
      header: 'Course',
      sortable: true,
      sortValue: (p) => p.courseTitle,
      accessor: (p) => p.courseTitle,
      minWidth: 220,
      className: 'text-text-secondary',
    },
    invoice: {
      key: 'invoice',
      header: 'Paid by',
      sortable: true,
      sortValue: (p) => p.invoiceRef,
      cell: (p) => <span className="font-mono text-body-12">{p.invoiceRef}</span>,
      width: 150,
    },
    seat: {
      key: 'seat',
      header: 'Seat price',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.seatPrice,
      cell: (p) => <MoneyCell kobo={p.seatPrice} tone="muted" />,
      width: 130,
    },
    attendance: {
      key: 'attendance',
      header: 'Attendance',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.attendancePercent ?? -1,
      accessor: (p) => (p.attendancePercent === null ? '—' : `${p.attendancePercent}%`),
      width: 115,
    },
    progress: {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      sortValue: (p) => p.progressPercent,
      cell: (p) => (
        <ProgressBar
          value={p.progressPercent}
          size="sm"
          tone={p.progressPercent >= 80 ? 'success' : 'accent'}
          valueLabel={`${p.progressPercent}%`}
        />
      ),
      width: 150,
    },
    pre: {
      key: 'pre',
      header: 'Pre-assessment',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.preScore ?? -1,
      accessor: (p) => (p.preScore === null ? '—' : String(p.preScore)),
      width: 140,
    },
    post: {
      key: 'post',
      header: 'Post-assessment',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.postScore ?? -1,
      accessor: (p) => (p.postScore === null ? '—' : String(p.postScore)),
      width: 150,
    },
    gain: {
      key: 'gain',
      header: 'Gain',
      align: 'right',
      sortable: true,
      sortValue: (p) => p.gain ?? -999,
      cell: (p) =>
        p.gain === null ? (
          <span className="text-text-secondary">—</span>
        ) : (
          <span className={p.gain >= 0 ? 'text-success-text tabular-nums' : 'text-danger-text tabular-nums'}>
            {p.gain >= 0 ? `+${p.gain}` : p.gain}
          </span>
        ),
      width: 100,
    },
    certificate: {
      key: 'certificate',
      header: 'Certificate',
      sortable: true,
      sortValue: (p) => (p.certificateIssued ? 1 : 0),
      cell: (p) => (
        <Badge tone={p.certificateIssued ? 'success' : 'neutral'}>
          {p.certificateIssued ? 'Issued' : 'Not yet'}
        </Badge>
      ),
      width: 130,
    },
  }

  const resolved = visible.map((key) => allColumns[key]).filter(Boolean)
  const columns = resolved.length > 0 ? resolved : defaultKeys.map((key) => allColumns[key]).filter(Boolean)

  const hasFilters = search.length > 0 || Object.values(filters).some(Boolean)

  return (
    <Screen>
      <ModuleHeader
        title="Participants"
        description="Everyone a client has paid to train, with their attendance, progress and certificate."
      />

      <div className="mt-6">
        <StatCard
          label="Average skill gain"
          value={averageGain === null ? '—' : `${averageGain >= 0 ? '+' : ''}${averageGain} pts`}
          caption={`Across ${formatNumber(withGain.length)} participants with two graded pieces of work`}
        />
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorPanel what="Participants" onRetry={retry} />
        ) : (
          <Card padding="none">
            <TableToolbar
              className="px-4 py-3"
              actions={
                <ColumnPicker
                  catalogue={PARTICIPANT_COLUMNS}
                  visible={visible}
                  defaultKeys={defaultKeys}
                  onChange={setVisible}
                />
              }
            >
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search participants or cohorts"
                values={filters}
                onFilterChange={(key, value) => setFilters((f) => ({ ...f, [key]: value }))}
                onClearAll={() => {
                  setFilters({})
                  setSearch('')
                }}
                filters={[
                  {
                    key: 'organisation',
                    label: 'Organisation',
                    options: orgs.map((o) => ({ value: o.id as string, label: o.name })),
                    width: 220,
                  },
                  {
                    key: 'certificate',
                    label: 'Certificate',
                    options: [
                      { value: 'issued', label: 'Issued' },
                      { value: 'pending', label: 'Not yet issued' },
                    ],
                  },
                ]}
              />
            </TableToolbar>
            <DataTable
              data={filtered}
              columns={columns}
              rowKey={(p) => p.id}
              loading={loading}
              density="compact"
              minWidth={Math.max(1000, columns.length * 160)}
              caption="Corporate participants with attendance, progress and assessment"
              emptyTitle={hasFilters ? 'No participants match these filters' : 'No participants yet'}
              emptyMessage={
                hasFilters
                  ? 'Clear the filters to see every sponsored seat.'
                  : 'A participant appears here once their seat has been invoiced to their organisation.'
              }
            />
          </Card>
        )}
      </div>
    </Screen>
  )
}
