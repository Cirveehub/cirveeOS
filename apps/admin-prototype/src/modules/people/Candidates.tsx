/**
 * Candidates — `/people/candidates` (screen-spec §9).
 *
 * The pipeline as a list. Every candidate is attached to a job opening, so a
 * candidate cannot exist without an approved reason for the role to exist —
 * that link is what stops the pipeline filling with speculative applications
 * nobody has budget for.
 */

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, UserPlus } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TableToolbar,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import {
  CURRENT_USER_ID,
  TODAY,
  candidatesCollection,
  jobOpeningsCollection,
  peopleCollection,
  useCollection,
} from '@/mocks'
import type { Candidate, JobOpeningId, PersonId, UserId } from '@/mocks'

import {
  ALL_STAGES,
  PeopleGroupTabs,
  Page,
  STAGE_LABEL,
  STAGE_TONE,
  ScreenError,
  branchName,
  isClosedStage,
  personName,
  unitKey,
  useScreenState,
  userName,
} from './shared'
import { createCandidate, staffOptions } from './writes'

const PAGE_SIZE = 25

const SOURCES = [
  'LinkedIn',
  'Referral — staff',
  'Cirvee alumni network',
  'Jobberman',
  'Careers page',
  'Instagram',
  'Walk-in',
]

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Name', defaultVisible: true, locked: true },
  { key: 'role', label: 'Role applied for', defaultVisible: true },
  { key: 'stage', label: 'Stage', defaultVisible: true },
  { key: 'daysInStage', label: 'Days in stage', defaultVisible: true },
  { key: 'score', label: 'Average scorecard', defaultVisible: true },
  { key: 'nextStep', label: 'Next step', defaultVisible: true },
  { key: 'source', label: 'Source', defaultVisible: false },
  { key: 'applied', label: 'Applied', defaultVisible: false },
  { key: 'recruiter', label: 'Recruiter', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'opening', label: 'Opening reference', defaultVisible: false },
]

function daysInStage(candidate: Candidate): number {
  return Math.round((Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(candidate.stageEnteredAt)) / 86_400_000)
}

export default function Candidates() {
  const state = useScreenState()
  const routerNavigate = useNavigate()

  const candidates = useCollection(candidatesCollection)
  const openings = useCollection(jobOpeningsCollection)

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const openingOf = (id: JobOpeningId) => openings.find((o) => o.id === id)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return candidates
      .filter((candidate) => {
        if (filters.stage && candidate.stage !== filters.stage) return false
        if (filters.opening && candidate.openingId !== filters.opening) return false
        if (filters.status === 'live' && isClosedStage(candidate.stage)) return false
        if (filters.status === 'closed' && !isClosedStage(candidate.stage)) return false
        if (!term) return true
        const opening = openingOf(candidate.openingId)
        return (
          personName(candidate.personId).toLowerCase().includes(term) ||
          (opening?.title ?? '').toLowerCase().includes(term) ||
          candidate.source.toLowerCase().includes(term)
        )
      })
      .sort((a, b) => daysInStage(b) - daysInStage(a))
  }, [candidates, filters, search, openings]) // eslint-disable-line react-hooks/exhaustive-deps

  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const filtered = Boolean(search) || Object.values(filters).some(Boolean)

  const allColumns: Record<string, Column<Candidate>> = {
    name: {
      key: 'name',
      header: 'Name',
      pinned: true,
      minWidth: 190,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
      sortable: true,
    },
    role: {
      key: 'role',
      header: 'Role applied for',
      minWidth: 200,
      accessor: (row) => openingOf(row.openingId)?.title ?? 'Opening withdrawn',
      sortValue: (row) => openingOf(row.openingId)?.title ?? '',
      sortable: true,
    },
    stage: {
      key: 'stage',
      header: 'Stage',
      width: 140,
      cell: (row) => (
        <Badge tone={STAGE_TONE[row.stage]} size="sm">
          {STAGE_LABEL[row.stage]}
        </Badge>
      ),
      sortValue: (row) => ALL_STAGES.indexOf(row.stage),
      sortable: true,
    },
    daysInStage: {
      key: 'daysInStage',
      header: 'Days in stage',
      align: 'right',
      width: 134,
      accessor: (row) => {
        const days = daysInStage(row)
        const stale = days > 14 && !isClosedStage(row.stage)
        return <span className={`tabular-nums ${stale ? 'text-warning-text' : ''}`}>{formatNumber(days)}</span>
      },
      sortValue: (row) => daysInStage(row),
      sortable: true,
    },
    score: {
      key: 'score',
      header: 'Average scorecard',
      align: 'right',
      width: 168,
      accessor: (row) =>
        row.averageScore === null ? (
          <span className="text-text-secondary">Not scored</span>
        ) : (
          <span className="tabular-nums">{row.averageScore.toFixed(1)} of 5</span>
        ),
      sortValue: (row) => row.averageScore ?? -1,
      sortable: true,
    },
    nextStep: {
      key: 'nextStep',
      header: 'Next step',
      minWidth: 190,
      accessor: (row) => row.nextStep ?? <span className="text-text-secondary">Nothing scheduled</span>,
      sortValue: (row) => row.nextStep ?? '',
    },
    source: { key: 'source', header: 'Source', minWidth: 170, accessor: (row) => row.source, sortValue: (row) => row.source, sortable: true },
    applied: { key: 'applied', header: 'Applied', width: 124, accessor: (row) => formatDate(row.appliedAt), sortValue: (row) => row.appliedAt, sortable: true },
    recruiter: { key: 'recruiter', header: 'Recruiter', minWidth: 170, accessor: (row) => userName(row.recruiterUserId), sortValue: (row) => userName(row.recruiterUserId), sortable: true },
    unit: {
      key: 'unit',
      header: 'Unit',
      width: 132,
      cell: (row) => {
        const key = unitKey(openingOf(row.openingId)?.unitId)
        return key ? <UnitTag unit={key} size="sm" /> : null
      },
      sortValue: (row) => unitKey(openingOf(row.openingId)?.unitId) ?? '',
      sortable: true,
    },
    branch: {
      key: 'branch',
      header: 'Branch',
      width: 132,
      accessor: (row) => branchName(openingOf(row.openingId)?.branchId),
      sortValue: (row) => branchName(openingOf(row.openingId)?.branchId),
      sortable: true,
    },
    opening: {
      key: 'opening',
      header: 'Opening reference',
      width: 160,
      accessor: (row) => <span className="font-mono text-body-12">{openingOf(row.openingId)?.ref ?? '—'}</span>,
      sortValue: (row) => openingOf(row.openingId)?.ref ?? '',
      sortable: true,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)
  const hireable = openings.filter((o) => o.status === 'open' || o.status === 'approved')

  return (
    <Page>
      <PageHeader
        title="Candidates"
        description="Everyone in the hiring pipeline, and how long they have been waiting at whichever stage they are at."
        actions={
          <Button leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)} disabled={hireable.length === 0}>
            Add a candidate
          </Button>
        }
      />

      <PeopleGroupTabs group="hiring" active="candidates" />

      <ScreenError state={state} />

      {notice && (
        <Alert tone="success" title={notice} className="mb-6" onDismiss={() => setNotice(null)}>
          They enter the pipeline at Applied. Every move from here is written to the audit log, so the stage history can
          never be overwritten by a later move.
        </Alert>
      )}

      {hireable.length === 0 && !state.loading && (
        <Alert tone="warning" title="No opening is accepting candidates" className="mb-6">
          A candidate is always attached to a job opening. Open or approve a requisition first, so the headcount behind the
          hire is authorised before anybody is contacted.
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
              searchPlaceholder="Search by name, role or source"
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
                { key: 'stage', label: 'Stage', options: ALL_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] })) },
                {
                  key: 'status',
                  label: 'Pipeline',
                  options: [
                    { value: 'live', label: 'Still live' },
                    { value: 'closed', label: 'Closed out' },
                  ],
                },
                { key: 'opening', label: 'Opening', options: openings.map((o) => ({ value: o.id as string, label: o.title })) },
              ]}
              right={<ColumnPicker catalogue={COLUMN_CATALOGUE} visible={visible} defaultKeys={defaultKeys} onChange={setVisible} />}
            />
          </TableToolbar>

          <DataTable
            data={pageRows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={state.loading}
            onRowClick={(row) => routerNavigate(`/people/candidates/${row.id}`)}
            density="compact"
            minWidth={1300}
            bordered={false}
            caption="Candidates with the role applied for, current stage, days in stage and average scorecard"
            empty={
              filtered ? (
                <EmptyState
                  variant="search"
                  title="No candidates match these filters"
                  message="Try another stage or opening, or clear the search."
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
                  icon={UserPlus}
                  title="Nobody is in the pipeline"
                  message="Open roles with no candidates will not fill themselves. Candidates arrive from the careers page, referrals and direct applications — or you can add one by hand."
                  action={
                    <Button size="sm" onClick={() => setCreating(true)} disabled={hireable.length === 0}>
                      Add a candidate
                    </Button>
                  }
                />
              )
            }
          />

          {rows.length > 0 && (
            <div className="px-4 py-3">
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPageChange={setPage} itemNoun="candidates" divided={false} />
            </div>
          )}
        </CardBody>
      </Card>

      <NewCandidateModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(name, id) => {
          setNotice(`${name} added to the pipeline.`)
          setCreating(false)
          routerNavigate(`/people/candidates/${id}`)
        }}
      />
    </Page>
  )
}

function NewCandidateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string, id: string) => void
}) {
  const people = useCollection(peopleCollection)
  const openings = useCollection(jobOpeningsCollection)
  const candidates = useCollection(candidatesCollection)

  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [personId, setPersonId] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('Ibadan')
  const [stateName, setStateName] = useState('Oyo')
  const [openingId, setOpeningId] = useState('')
  const [source, setSource] = useState(SOURCES[0])
  const [recruiterUserId, setRecruiterUserId] = useState<string>(CURRENT_USER_ID as string)
  const [nextStep, setNextStep] = useState('Screening call')
  const [touched, setTouched] = useState(false)

  const recruiters = useMemo(() => staffOptions(), [])
  const hireable = openings.filter((o) => o.status === 'open' || o.status === 'approved')

  const alreadyApplied =
    mode === 'existing' && personId && openingId
      ? candidates.some((c) => c.personId === personId && c.openingId === openingId)
      : false

  const errors = {
    person:
      mode === 'existing'
        ? personId
          ? alreadyApplied
            ? 'This person is already in the pipeline for that opening. Open their profile instead of creating a second record.'
            : undefined
          : 'Choose the person applying.'
        : firstName.trim() && lastName.trim()
          ? undefined
          : 'A first and last name are required.',
    email:
      mode === 'new' && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? 'That does not look like an email address.'
        : mode === 'new' && !email.trim() && !phone.trim()
          ? 'Give at least an email or a phone number — a candidate you cannot contact is not a candidate.'
          : undefined,
    opening: openingId ? undefined : 'Every candidate applies to a specific opening.',
  }
  const valid = Object.values(errors).every((e) => e === undefined)

  const reset = () => {
    setMode('new')
    setPersonId('')
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setOpeningId('')
    setNextStep('Screening call')
    setTouched(false)
  }

  const submit = () => {
    setTouched(true)
    if (!valid || !openingId) return
    const candidate = createCandidate({
      personId: mode === 'existing' ? (personId as PersonId) : null,
      firstName,
      lastName,
      email,
      phone,
      city,
      state: stateName,
      openingId: openingId as JobOpeningId,
      source,
      recruiterUserId: recruiterUserId as UserId,
      nextStep,
    })
    const name = mode === 'existing' ? personName(personId) : `${firstName.trim()} ${lastName.trim()}`
    reset()
    onCreated(name, candidate.id as string)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Add a candidate"
      description="A candidate is a person plus the opening they applied to. They enter at Applied and every move after that is audited."
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
          <Button onClick={submit}>Add to pipeline</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Who is applying" required>
          <Select
            value={mode}
            options={[
              { value: 'new', label: 'Someone new to Cirvee' },
              { value: 'existing', label: 'Someone already on record' },
            ]}
            onChange={(e) => setMode(e.target.value as 'new' | 'existing')}
          />
        </Field>

        {mode === 'existing' ? (
          <Field label="Person" required error={touched ? errors.person : undefined}>
            <Select
              value={personId}
              invalid={touched && Boolean(errors.person)}
              placeholder="Choose a person"
              options={people
                .slice(0, 300)
                .map((p) => ({ value: p.id as string, label: `${p.firstName} ${p.lastName}${p.email ? ` · ${p.email}` : ''}` }))}
              onChange={(e) => setPersonId(e.target.value)}
            />
          </Field>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" required error={touched ? errors.person : undefined}>
                <Input value={firstName} invalid={touched && Boolean(errors.person)} onChange={(e) => setFirstName(e.target.value)} placeholder="Adaeze" />
              </Field>
              <Field label="Last name" required>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nwankwo" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" error={touched ? errors.email : undefined}>
                <Input
                  type="email"
                  value={email}
                  invalid={touched && Boolean(errors.email)}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="adaeze.nwankwo@gmail.com"
                />
              </Field>
              <Field label="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 400 1122" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="City" optional>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="State" optional>
                <Input value={stateName} onChange={(e) => setStateName(e.target.value)} />
              </Field>
            </div>
          </>
        )}

        <Field
          label="Opening"
          required
          hint="Only openings that are approved or open accept candidates."
          error={touched ? errors.opening : undefined}
        >
          <Select
            value={openingId}
            invalid={touched && Boolean(errors.opening)}
            placeholder="Choose an opening"
            options={hireable.map((o) => ({ value: o.id as string, label: `${o.ref} · ${o.title}` }))}
            onChange={(e) => setOpeningId(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source" required hint="Where they came from. Referral sources feed the referral module's attribution.">
            <Select value={source} options={SOURCES.map((s) => ({ value: s, label: s }))} onChange={(e) => setSource(e.target.value)} />
          </Field>
          <Field label="Recruiter" required>
            <Select value={recruiterUserId} options={recruiters} onChange={(e) => setRecruiterUserId(e.target.value)} />
          </Field>
        </div>

        <Field label="Next step" required hint="What happens next, so nobody sits in Applied untouched.">
          <Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Screening call" />
        </Field>
      </div>
    </Modal>
  )
}
