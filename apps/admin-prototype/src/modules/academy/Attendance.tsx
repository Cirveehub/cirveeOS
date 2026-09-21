import { useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, ShieldCheck } from 'lucide-react'

import { formatDate, formatTime } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Modal,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  TableToolbar,
  Textarea,
  type Column,
  type FilterValues,
} from '@/ui'
import { classSessionsCollection, cohortsCollection, studentAttendanceCollection, useCollection } from '@/mocks'
import type { StudentAttendance, StudentAttendanceState } from '@/mocks'

import { ACADEMY_TABS, Page, ScreenError, personName, useModuleNav, useScreenState } from './shared'
import { overrideAttendance } from './writes'

const STATES = ['present', 'late', 'absent', 'excused'] as const
const SOURCES = ['nfc_tap', 'qr', 'tutor_manual', 'kiosk'] as const
const SOURCE_LABELS: Record<string, string> = {
  nfc_tap: 'NFC tap',
  qr: 'QR',
  tutor_manual: 'Tutor manual',
  kiosk: 'Kiosk',
}
const PAGE_SIZE = 30

export default function Attendance() {
  const state = useScreenState()
  const navigate = useModuleNav()

  const attendance = useCollection(studentAttendanceCollection)
  const sessions = useCollection(classSessionsCollection)
  const cohorts = useCollection(cohortsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [overriding, setOverriding] = useState<StudentAttendance | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const sessionOf = (sessionId: string) => sessions.find((s) => s.id === sessionId)
  const cohortCode = (sessionId: string) => {
    const session = sessionOf(sessionId)
    return session ? cohorts.find((c) => c.id === session.cohortId)?.code ?? '—' : '—'
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return attendance
      .filter((row) => {
        if (filters.state && row.state !== filters.state) return false
        if (filters.source && row.source !== filters.source) return false
        if (filters.confirmed === 'yes' && !row.tutorConfirmed) return false
        if (filters.confirmed === 'no' && row.tutorConfirmed) return false
        if (!term) return true
        return personName(row.personId).toLowerCase().includes(term) || cohortCode(row.sessionId).toLowerCase().includes(term)
      })
      .sort((a, b) => (sessionOf(b.sessionId)?.date ?? '').localeCompare(sessionOf(a.sessionId)?.date ?? ''))
  }, [attendance, sessions, cohorts, filters, search])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const columns: Array<Column<StudentAttendance>> = [
    { key: 'student', header: 'Student', pinned: true, minWidth: 190, accessor: (row) => personName(row.personId), sortValue: (row) => personName(row.personId), sortable: true },
    { key: 'cohort', header: 'Cohort', width: 112, accessor: (row) => <span className="font-mono text-body-13">{cohortCode(row.sessionId)}</span>, sortValue: (row) => cohortCode(row.sessionId), sortable: true },
    { key: 'session', header: 'Session', minWidth: 230, accessor: (row) => sessionOf(row.sessionId)?.topic ?? '—', sortValue: (row) => sessionOf(row.sessionId)?.topic ?? '' },
    { key: 'date', header: 'Date', width: 116, accessor: (row) => formatDate(sessionOf(row.sessionId)?.date ?? ''), sortValue: (row) => sessionOf(row.sessionId)?.date ?? '', sortable: true },
    { key: 'state', header: 'State', width: 116, cell: (row) => <StatusBadge status={row.state} />, sortValue: (row) => row.state, sortable: true },
    {
      key: 'source',
      header: 'Source',
      width: 148,
      cell: (row) => (
        <Badge tone={row.source === 'tutor_manual' ? 'warning' : 'neutral'} size="sm" variant="outline">
          {SOURCE_LABELS[row.source] ?? row.source}
        </Badge>
      ),
      sortValue: (row) => row.source,
      sortable: true,
    },
    {
      key: 'tapped',
      header: 'Tap time',
      width: 112,
      accessor: (row) => (row.tappedAt ? formatTime(row.tappedAt) : <span className="text-text-secondary">No tap</span>),
      sortValue: (row) => row.tappedAt ?? '',
      sortable: true,
    },
    {
      key: 'confirmed',
      header: 'Tutor confirmed',
      width: 148,
      cell: (row) => (row.tutorConfirmed ? <Badge tone="success" size="sm">Confirmed</Badge> : <Badge tone="warning" size="sm">Awaiting</Badge>),
      sortValue: (row) => row.tutorConfirmed,
      sortable: true,
    },
    {
      key: 'override',
      header: 'Override reason',
      minWidth: 240,
      accessor: (row) => row.overrideReason ?? <span className="text-text-secondary">Not overridden</span>,
      sortValue: (row) => row.overrideReason ?? '',
    },
    {
      key: 'action',
      header: 'Correct',
      width: 116,
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => setOverriding(row)}>
          Override
        </Button>
      ),
    },
  ]

  return (
    <Page>
      <PageHeader
        title="Class attendance"
        description="Who turned up, how the system knew, and whether the tutor confirmed it."
        tabs={ACADEMY_TABS}
        activeTab="attendance"
        onTabChange={navigate}
      />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title="Attendance overridden" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <Card>
        <CardBody padding="none">
          <TableToolbar>
            <FilterBar
              search={search}
              onSearchChange={(value) => {
                setSearch(value)
                setPage(1)
              }}
              searchPlaceholder="Search by student or cohort code"
              values={filters}
              onFilterChange={(key, value) => {
                setFilters((prev) => ({ ...prev, [key]: value }))
                setPage(1)
              }}
              onClearAll={() => {
                setFilters({})
                setSearch('')
                setPage(1)
              }}
              filters={[
                { key: 'state', label: 'State', options: STATES.map((s) => ({ value: s, label: s })) },
                { key: 'source', label: 'Source', options: SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] })) },
                {
                  key: 'confirmed',
                  label: 'Tutor confirmed',
                  options: [
                    { value: 'yes', label: 'Confirmed' },
                    { value: 'no', label: 'Awaiting confirmation' },
                  ],
                },
              ]}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            density="compact"
            minWidth={1920}
            bordered={false}
            caption="Student attendance records with state, capture source, tap time and tutor confirmation"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No attendance records match these filters"
                  message="Try another state or capture source, or clear the search."
                  action={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setFilters({})
                        setSearch('')
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={ClipboardCheck}
                  title="No attendance has been captured"
                  message="Attendance is recorded by NFC tap, QR, the kiosk or the tutor. Without it, nobody can tell which students are quietly disappearing."
                  action={
                    <Button size="sm" variant="secondary" onClick={() => navigate('classes')}>
                      Open the timetable
                    </Button>
                  }
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="records" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <OverrideModal
        record={overriding}
        onClose={() => setOverriding(null)}
        onDone={(message) => setNotice(message)}
      />
    </Page>
  )
}

function OverrideModal({
  record,
  onClose,
  onDone,
}: {
  record: StudentAttendance | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const [state, setState] = useState<StudentAttendanceState>('present')
  const [reason, setReason] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!record) return
    setState(record.state)
    setReason('')
    setTouched(false)
  }, [record])

  const current = record?.state
  const changed = record !== null && state !== current
  const reasonError =
    touched && changed && reason.trim().length < 8
      ? 'An override without a stated reason is not auditable.'
      : touched && !changed
        ? 'Pick a different state — this one is already what the record says.'
        : undefined

  return (
    <Modal
      open={record !== null}
      onClose={onClose}
      title={record ? `Override attendance for ${personName(record.personId)}` : ''}
      description={
        record
          ? `Currently ${record.state}, captured by ${record.source.replace(/_/g, ' ')}${record.overrideReason ? ' and already overridden once' : ''}.`
          : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true)
              if (!record || !changed || reason.trim().length < 8) return
              overrideAttendance(record.id, state, reason.trim())
              onDone(
                `${personName(record.personId)} changed from ${record.state} to ${state}. The reason is on the record and in the audit log.`,
              )
              setReason('')
              setTouched(false)
              onClose()
            }}
          >
            Save override
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="New state" required id="override-state">
          <Select
            id="override-state"
            value={state}
            options={STATES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
            onChange={(e) => setState(e.target.value as StudentAttendanceState)}
          />
        </Field>
        <Field
          label="Reason"
          required
          error={reasonError}
          hint="Eight characters minimum. Shown in the override column and in the audit log."
          id="override-why"
        >
          <Textarea
            id="override-why"
            rows={3}
            value={reason}
            invalid={Boolean(reasonError)}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Card was left at home; the tutor confirmed attendance in person."
          />
        </Field>
      </div>
    </Modal>
  )
}
