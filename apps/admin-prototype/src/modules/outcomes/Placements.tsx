/**
 * Placements — the subset of outcome records that name an employer.
 *
 * The salary band is derived from the figure the graduate volunteered, and
 * every row that carries one is labelled self-reported. A placement with no
 * consent on file reads "Not granted" here and may not be published, however
 * good it looks.
 */
import { useMemo, useState } from 'react'
import { BriefcaseBusiness, Info, Plus } from 'lucide-react'

import { formatDate, formatNaira } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  CurrencyInput,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  Pagination,
  Select,
  TableToolbar,
  Textarea,
  type Column,
  type FilterValues,
} from '@/ui'
import {
  TODAY,
  employersCollection,
  ngn,
  outcomeRecordsCollection,
  useCollection,
} from '@/mocks'
import type { EmployerId, Kobo, OutcomeRecord, OutcomeType } from '@/mocks'

import { EMPLOYER_BACKED_TYPES, recordPlacement } from './writes'

import {
  ErrorPanel,
  ModuleHeader,
  OUTCOME_TYPE_LABEL,
  OUTCOME_TYPE_ORDER,
  RELEVANCE_LABEL,
  Screen,
  isPlaced,
  outcomeTypeTone,
  useCohortCode,
  useCourseTitle,
  useEmployerName,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'

const PAGE_SIZE = 25

/** Bands, not figures — a volunteered salary is never shown to the naira. */
const SALARY_BANDS: ReadonlyArray<{ id: string; label: string; min: number; max: number }> = [
  { id: 'under_150k', label: `Under ${formatNaira(ngn(150_000), { compact: true })}`, min: 0, max: ngn(150_000) },
  {
    id: '150k_300k',
    label: `${formatNaira(ngn(150_000), { compact: true })} to ${formatNaira(ngn(300_000), { compact: true })}`,
    min: ngn(150_000),
    max: ngn(300_000),
  },
  {
    id: '300k_500k',
    label: `${formatNaira(ngn(300_000), { compact: true })} to ${formatNaira(ngn(500_000), { compact: true })}`,
    min: ngn(300_000),
    max: ngn(500_000),
  },
  { id: 'over_500k', label: `Over ${formatNaira(ngn(500_000), { compact: true })}`, min: ngn(500_000), max: Infinity },
]

function salaryBand(record: OutcomeRecord): (typeof SALARY_BANDS)[number] | null {
  const after = record.incomeChange?.after
  if (after === null || after === undefined) return null
  return SALARY_BANDS.find((band) => after >= band.min && after < band.max) ?? null
}

export default function Placements() {
  const allRecords = useCollection(outcomeRecordsCollection)
  const { loading, error, rows: records, retry } = useModuleData(allRecords, 'outcomes.placements')

  const personName = usePersonName()
  const courseTitle = useCourseTitle()
  const cohortCode = useCohortCode()
  const employerName = useEmployerName()
  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [recording, setRecording] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const placements = useMemo(() => records.filter((r) => isPlaced(r) && r.employerId !== null), [records])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return placements
      .filter((record) => {
        if (filters.type && record.outcomeType !== filters.type) return false
        if (filters.relevance && record.relevanceToCourse !== filters.relevance) return false
        if (filters.consent === 'granted' && !record.consentForPublicUse) return false
        if (filters.consent === 'not_granted' && record.consentForPublicUse) return false
        if (filters.verified === 'verified' && record.verifiedByUserId === null) return false
        if (filters.verified === 'unverified' && record.verifiedByUserId !== null) return false
        if (!term) return true
        return (
          personName(record.personId).toLowerCase().includes(term) ||
          employerName(record.employerId).toLowerCase().includes(term) ||
          (record.jobTitle ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => (b.placementDate ?? '').localeCompare(a.placementDate ?? ''))
  }, [placements, filters, search, personName, employerName])

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
    setPage(1)
  }

  const volunteeredCount = rows.filter((r) => salaryBand(r) !== null).length

  const columns: Array<Column<OutcomeRecord>> = [
    {
      key: 'graduate',
      header: 'Graduate',
      pinned: true,
      minWidth: 190,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    {
      key: 'employer',
      header: 'Employer',
      minWidth: 230,
      accessor: (row) => employerName(row.employerId),
      sortValue: (row) => employerName(row.employerId),
      sortable: true,
    },
    {
      key: 'role',
      header: 'Role',
      minWidth: 200,
      accessor: (row) => row.jobTitle ?? <span className="text-text-secondary">Not recorded</span>,
      sortValue: (row) => row.jobTitle ?? '',
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 140,
      cell: (row) => (
        <Badge tone={outcomeTypeTone(row.outcomeType)} size="sm">
          {OUTCOME_TYPE_LABEL[row.outcomeType]}
        </Badge>
      ),
      sortValue: (row) => OUTCOME_TYPE_LABEL[row.outcomeType],
      sortable: true,
    },
    {
      key: 'start',
      header: 'Start date',
      width: 124,
      accessor: (row) => (row.placementDate ? formatDate(row.placementDate) : <span className="text-text-secondary">—</span>),
      sortValue: (row) => row.placementDate ?? '',
      sortable: true,
    },
    {
      key: 'band',
      header: 'Salary band, self-reported',
      width: 220,
      cell: (row) => {
        const band = salaryBand(row)
        if (!band) return <span className="text-text-secondary">Not volunteered</span>
        return (
          <span className="flex items-center gap-2">
            <span className="text-body-13 tabular-nums">{band.label}</span>
            <Badge tone="warning" size="sm">
              Self-reported
            </Badge>
          </span>
        )
      },
      sortValue: (row) => row.incomeChange?.after ?? -1,
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
      key: 'location',
      header: 'Location',
      width: 120,
      accessor: (row) => row.location ?? <span className="text-text-secondary">—</span>,
      sortValue: (row) => row.location ?? '',
      sortable: true,
    },
    {
      key: 'relevance',
      header: 'Relevance to course',
      width: 178,
      cell: (row) =>
        row.relevanceToCourse ? (
          <Badge tone={row.relevanceToCourse === 'direct' ? 'success' : row.relevanceToCourse === 'adjacent' ? 'info' : 'neutral'} size="sm">
            {RELEVANCE_LABEL[row.relevanceToCourse]}
          </Badge>
        ) : (
          <span className="text-text-secondary">Not assessed</span>
        ),
      sortValue: (row) => row.relevanceToCourse ?? '',
      sortable: true,
    },
    {
      key: 'verified',
      header: 'Verified by',
      minWidth: 170,
      accessor: (row) =>
        row.verifiedByUserId ? (
          userName(row.verifiedByUserId)
        ) : (
          <span className="text-text-secondary">Not verified</span>
        ),
      sortValue: (row) => (row.verifiedByUserId ? userName(row.verifiedByUserId) : ''),
      sortable: true,
    },
    {
      key: 'consent',
      header: 'Consent',
      width: 140,
      cell: (row) => (
        <Badge tone={row.consentForPublicUse ? 'success' : 'neutral'} size="sm">
          {row.consentForPublicUse ? 'Granted' : 'Not granted'}
        </Badge>
      ),
      sortValue: (row) => (row.consentForPublicUse ? 1 : 0),
      sortable: true,
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Placements"
        description="Every graduate who named an employer at a follow-up, with the role, the type of work and whether it may be published."
        actions={
          <Button size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setRecording(true)}>
            Record placement
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="Placements" />
      ) : (
        <>
          <Alert tone="info" icon={Info} title="Salary bands are self-reported and unverified">
            {volunteeredCount === 0
              ? 'No graduate on this list has volunteered an income figure. Salary is never a condition of the follow-up, so an empty column here is a normal result, not a gap in the data.'
              : `${volunteeredCount} of ${rows.length} placements carry a band, volunteered by the graduate without being asked. None has been checked against a payslip or a contract.`}
          </Alert>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={(value) => {
                    setSearch(value)
                    setPage(1)
                  }}
                  searchPlaceholder="Search by graduate, employer or role"
                  values={filters}
                  onFilterChange={(key, value) => {
                    setFilters((prev) => ({ ...prev, [key]: value }))
                    setPage(1)
                  }}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'type',
                      label: 'Type',
                      options: OUTCOME_TYPE_ORDER.filter((t) => t !== 'not_yet_placed').map((type) => ({
                        value: type,
                        label: OUTCOME_TYPE_LABEL[type],
                      })),
                    },
                    {
                      key: 'relevance',
                      label: 'Relevance',
                      options: [
                        { value: 'direct', label: 'Direct' },
                        { value: 'adjacent', label: 'Adjacent' },
                        { value: 'unrelated', label: 'Unrelated' },
                      ],
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
                      key: 'verified',
                      label: 'Verification',
                      options: [
                        { value: 'verified', label: 'Verified' },
                        { value: 'unverified', label: 'Not verified' },
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
                density="compact"
                minWidth={2300}
                bordered={false}
                caption="Placements with employer, role, type, start date, self-reported salary band, course, cohort, relevance, verification and consent"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No placements match these filters"
                      message="Try another outcome type or relevance, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={BriefcaseBusiness}
                      title="No placements recorded"
                      message="A placement appears here once a graduate names an employer at a 3, 6 or 12 month checkpoint. Until then the placement rate is zero and should be quoted as zero."
                      action={
                        <Button size="sm" onClick={() => setRecording(true)}>
                          Record the first placement
                        </Button>
                      }
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
                    itemNoun="placements"
                    divided={false}
                  />
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <RecordPlacementModal
        open={recording}
        onClose={() => setRecording(false)}
        onRecorded={(message) => {
          setRecording(false)
          setNotice(message)
        }}
      />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Record a placement                                                         */
/* -------------------------------------------------------------------------- */

/**
 * The income fields are gated behind an explicit "the graduate volunteered a
 * figure" switch, and the panel says in plain words that nothing here is
 * verified. There is deliberately no "verified income" control — verification
 * on this form covers the employer and the role, never the money.
 */
function RecordPlacementModal({
  open,
  onClose,
  onRecorded,
}: {
  open: boolean
  onClose: () => void
  onRecorded: (message: string) => void
}) {
  const records = useCollection(outcomeRecordsCollection)
  const employers = useCollection(employersCollection)
  const personName = usePersonName()
  const courseTitle = useCourseTitle()
  const cohortCode = useCohortCode()

  const [recordId, setRecordId] = useState('')
  const [outcomeType, setOutcomeType] = useState<OutcomeType>('full_time')
  const [employerId, setEmployerId] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [placementDate, setPlacementDate] = useState(TODAY)
  const [location, setLocation] = useState('')
  const [relevance, setRelevance] = useState<'direct' | 'adjacent' | 'unrelated'>('direct')
  const [incomeVolunteered, setIncomeVolunteered] = useState(false)
  const [incomeBefore, setIncomeBefore] = useState<number | null>(null)
  const [incomeAfter, setIncomeAfter] = useState<number | null>(null)
  const [consent, setConsent] = useState(false)
  const [markVerified, setMarkVerified] = useState(false)
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  const record = recordId ? (records.find((r) => (r.id as string) === recordId) ?? null) : null
  const needsEmployer = EMPLOYER_BACKED_TYPES.includes(outcomeType)

  const recordError = touched && !recordId ? 'Choose the graduate whose record this updates.' : undefined
  const employerError =
    touched && needsEmployer && !employerId
      ? 'A full-time, contract, internship or freelance placement names an employer.'
      : undefined
  const roleError = touched && needsEmployer && !jobTitle.trim() ? 'The job title, as the graduate gave it.' : undefined
  const dateError =
    touched && outcomeType !== 'not_yet_placed' && record && placementDate < record.graduatedAt
      ? `A start date before graduation on ${formatDate(record.graduatedAt)} is not a placement.`
      : undefined

  const reset = () => {
    setRecordId('')
    setJobTitle('')
    setEmployerId('')
    setLocation('')
    setNotes('')
    setIncomeVolunteered(false)
    setIncomeBefore(null)
    setIncomeAfter(null)
    setConsent(false)
    setMarkVerified(false)
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (!record) return
    if (needsEmployer && (!employerId || !jobTitle.trim())) return
    if (dateError) return

    recordPlacement(record, {
      recordId: record.id as string,
      employerId: employerId ? (employerId as EmployerId) : null,
      outcomeType,
      jobTitle,
      placementDate,
      location,
      relevanceToCourse: relevance,
      volunteeredIncome:
        incomeVolunteered && (incomeBefore !== null || incomeAfter !== null)
          ? { before: incomeBefore as Kobo | null, after: incomeAfter as Kobo | null }
          : null,
      consentForPublicUse: consent,
      notes,
      markVerified,
    })

    onRecorded(
      `${personName(record.personId)} recorded as ${OUTCOME_TYPE_LABEL[outcomeType].toLowerCase()}. The placement rate on the dashboard has moved.`,
    )
    reset()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Record a placement"
      description="Updates an existing outcome record. Every graduate already has one — it opened when their certificate was issued."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Record placement</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Graduate" required error={recordError}>
          <Select
            value={recordId}
            placeholder="Choose a graduate"
            options={[...records]
              .sort((a, b) => personName(a.personId).localeCompare(personName(b.personId)))
              .slice(0, 400)
              .map((r) => ({
                value: r.id as string,
                label: `${personName(r.personId)} · ${courseTitle(r.courseId)} · ${cohortCode(r.cohortId)} · ${OUTCOME_TYPE_LABEL[r.outcomeType]}`,
              }))}
            onChange={(e) => {
              setRecordId(e.target.value)
              const chosen = records.find((r) => (r.id as string) === e.target.value)
              if (chosen) {
                setOutcomeType(chosen.outcomeType === 'not_yet_placed' ? 'full_time' : chosen.outcomeType)
                setEmployerId((chosen.employerId as string | null) ?? '')
                setJobTitle(chosen.jobTitle ?? '')
                setLocation(chosen.location ?? '')
                setPlacementDate(chosen.placementDate ?? TODAY)
                setRelevance(chosen.relevanceToCourse ?? 'direct')
                setConsent(chosen.consentForPublicUse)
              }
            }}
          />
        </Field>

        {record && (
          <Alert tone="info" icon={Info} title={`Graduated ${formatDate(record.graduatedAt)}`}>
            Currently recorded as {OUTCOME_TYPE_LABEL[record.outcomeType].toLowerCase()}
            {record.employerId ? ` at ${employers.find((e) => e.id === record.employerId)?.name ?? 'an employer'}` : ''}.
            The previous value is kept on the audit trail.
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Outcome type" required>
            <Select
              value={outcomeType}
              options={OUTCOME_TYPE_ORDER.map((type) => ({ value: type, label: OUTCOME_TYPE_LABEL[type] }))}
              onChange={(e) => setOutcomeType(e.target.value as OutcomeType)}
            />
          </Field>

          <Field
            label="Start date"
            required={outcomeType !== 'not_yet_placed'}
            error={dateError}
            hint={outcomeType === 'not_yet_placed' ? 'Cleared when the outcome is not yet placed.' : undefined}
          >
            <Input
              type="date"
              value={placementDate}
              disabled={outcomeType === 'not_yet_placed'}
              invalid={Boolean(dateError)}
              onChange={(e) => setPlacementDate(e.target.value)}
            />
          </Field>
        </div>

        {needsEmployer && (
          <>
            <Field
              label="Employer"
              required
              error={employerError}
              hint="Not on the list? Add it from the Employers screen first, so the hire count stays in one place."
            >
              <Select
                value={employerId}
                placeholder="Choose an employer"
                options={[...employers]
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((e) => ({ value: e.id as string, label: `${e.name} · ${e.industry} · ${e.location}` }))}
                onChange={(e) => setEmployerId(e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job title" required error={roleError}>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  invalid={Boolean(roleError)}
                  placeholder="Junior data analyst"
                />
              </Field>
              <Field label="Location" optional>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lagos" />
              </Field>
            </div>
          </>
        )}

        <Field label="Relevance to the course" required>
          <Select
            value={relevance}
            options={[
              { value: 'direct', label: 'Direct — the role is what the course taught' },
              { value: 'adjacent', label: 'Adjacent — related, but not the same work' },
              { value: 'unrelated', label: 'Unrelated — the course did not lead here' },
            ]}
            onChange={(e) => setRelevance(e.target.value as 'direct' | 'adjacent' | 'unrelated')}
          />
        </Field>

        <div className="rounded-xl border border-border p-4">
          <Checkbox
            checked={incomeVolunteered}
            onChange={(e) => setIncomeVolunteered(e.target.checked)}
            label="The graduate volunteered an income figure"
            description="Income is never asked for as a condition of a follow-up. Tick this only when the graduate offered it unprompted — it is stored as self-reported and is never verified."
          />
          {incomeVolunteered && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Before, self-reported" optional>
                <CurrencyInput value={incomeBefore} onChange={setIncomeBefore} />
              </Field>
              <Field label="After, self-reported" optional>
                <CurrencyInput value={incomeAfter} onChange={setIncomeAfter} />
              </Field>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4 space-y-3">
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label="The graduate consents to this being used publicly"
            description="Without consent the placement counts towards the rate but may not be named, quoted or published anywhere."
          />
          <Checkbox
            checked={markVerified}
            onChange={(e) => setMarkVerified(e.target.checked)}
            label="I confirmed the employer and the role"
            description="Verification covers the employer and the job title only. A volunteered income figure stays self-reported whatever is ticked here."
          />
        </div>

        <Field label="Notes" optional>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={300}
            showCount
            placeholder="Confirmed on the six-month call. Started three weeks after the cohort ended."
          />
        </Field>
      </div>
    </Modal>
  )
}
