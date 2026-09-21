/**
 * Employers who have hired Cirvee graduates.
 *
 * "Graduates hired" is counted live from the outcome records rather than read
 * off the employer row, so recording a placement anywhere in the prototype
 * moves this table. The stored figure is shown beside it when the two differ —
 * a disagreement is worth seeing, not hiding.
 */
import { useMemo, useState } from 'react'
import { Building2, Handshake, Plus } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  ColumnPicker,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FilterBar,
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  Select,
  TableToolbar,
  Textarea,
  Tooltip,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
  type FilterValues,
} from '@/ui'
import { employersCollection, outcomeRecordsCollection, useCollection, usersCollection } from '@/mocks'
import type { Employer, OutcomeRecord, UserId } from '@/mocks'

import { createEmployer, employerNameTaken } from './writes'

import {
  ErrorPanel,
  ModuleHeader,
  OUTCOME_TYPE_LABEL,
  Screen,
  outcomeTypeTone,
  useCohortCode,
  useCourseTitle,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'

const PARTNERSHIP_LABEL: Record<Employer['partnershipStatus'], string> = {
  none: 'No relationship',
  informal: 'Informal',
  partner: 'Partner',
  hiring_partner: 'Hiring partner',
}

const PARTNERSHIP_TONE: Record<Employer['partnershipStatus'], 'neutral' | 'info' | 'accent' | 'success'> = {
  none: 'neutral',
  informal: 'info',
  partner: 'accent',
  hiring_partner: 'success',
}

const SIZE_OPTIONS = ['1 to 10', '11 to 50', '51 to 200', '201 to 1,000', 'Over 1,000']

/** Eleven possible columns, six shown. */
const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'name', label: 'Employer', defaultVisible: true, locked: true },
  { key: 'industry', label: 'Industry', defaultVisible: true },
  { key: 'size', label: 'Size', defaultVisible: false },
  { key: 'location', label: 'Location', defaultVisible: true },
  { key: 'hired', label: 'Graduates hired', defaultVisible: true },
  { key: 'roles', label: 'Roles', defaultVisible: false },
  { key: 'first', label: 'First hire', defaultVisible: false },
  { key: 'last', label: 'Last hire', defaultVisible: false },
  { key: 'owner', label: 'Relationship owner', defaultVisible: true },
  { key: 'partnership', label: 'Partnership', defaultVisible: true },
  { key: 'satisfaction', label: 'Satisfaction', defaultVisible: false },
]

export default function Employers() {
  const allEmployers = useCollection(employersCollection)
  const outcomes = useCollection(outcomeRecordsCollection)
  const { loading, error, rows: employers, retry } = useModuleData(allEmployers, 'outcomes.employers')

  const personName = usePersonName()
  const courseTitle = useCourseTitle()
  const cohortCode = useCohortCode()
  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  /** Live placements per employer, keyed by employer id. */
  const placementsByEmployer = useMemo(() => {
    const map = new Map<string, OutcomeRecord[]>()
    for (const record of outcomes) {
      if (!record.employerId) continue
      const key = record.employerId as string
      map.set(key, [...(map.get(key) ?? []), record])
    }
    return map
  }, [outcomes])

  const industries = useMemo(
    () => [...new Set(allEmployers.map((e) => e.industry))].sort((a, b) => a.localeCompare(b)),
    [allEmployers],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return employers
      .filter((employer) => {
        if (filters.partnership && employer.partnershipStatus !== filters.partnership) return false
        if (filters.industry && employer.industry !== filters.industry) return false
        if (!term) return true
        return (
          employer.name.toLowerCase().includes(term) ||
          employer.industry.toLowerCase().includes(term) ||
          employer.location.toLowerCase().includes(term)
        )
      })
      .sort(
        (a, b) =>
          (placementsByEmployer.get(b.id as string)?.length ?? 0) -
            (placementsByEmployer.get(a.id as string)?.length ?? 0) || a.name.localeCompare(b.name),
      )
  }, [employers, filters, search, placementsByEmployer])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const open = openId ? (employers.find((e) => e.id === openId) ?? null) : null
  const openPlacements = open ? (placementsByEmployer.get(open.id as string) ?? []) : []

  const rolesFor = (employer: Employer) => {
    const titles = (placementsByEmployer.get(employer.id as string) ?? [])
      .map((r) => r.jobTitle)
      .filter((t): t is string => Boolean(t))
    return [...new Set(titles)]
  }

  const columnCatalogue: Array<Column<Employer>> = [
    {
      key: 'name',
      header: 'Employer',
      pinned: true,
      minWidth: 250,
      accessor: (row) => row.name,
      sortValue: (row) => row.name,
      sortable: true,
    },
    {
      key: 'industry',
      header: 'Industry',
      width: 150,
      accessor: (row) => row.industry,
      sortValue: (row) => row.industry,
      sortable: true,
    },
    { key: 'size', header: 'Size', width: 120, accessor: (row) => row.size, sortValue: (row) => row.size, sortable: true },
    {
      key: 'location',
      header: 'Location',
      width: 120,
      accessor: (row) => row.location,
      sortValue: (row) => row.location,
      sortable: true,
    },
    {
      key: 'hired',
      header: 'Graduates hired',
      align: 'right',
      width: 168,
      cell: (row) => {
        const live = placementsByEmployer.get(row.id as string)?.length ?? 0
        if (live === row.graduatesHired) return <span className="tabular-nums">{formatNumber(live)}</span>
        return (
          <Tooltip content={`${formatNumber(row.graduatesHired)} on the employer record, ${formatNumber(live)} with an outcome record`}>
            <span className="tabular-nums">
              {formatNumber(live)}{' '}
              <span className="text-text-secondary">of {formatNumber(row.graduatesHired)}</span>
            </span>
          </Tooltip>
        )
      },
      sortValue: (row) => placementsByEmployer.get(row.id as string)?.length ?? 0,
      sortable: true,
    },
    {
      key: 'roles',
      header: 'Roles',
      minWidth: 240,
      cell: (row) => {
        const roles = rolesFor(row)
        if (roles.length === 0) return <span className="text-text-secondary">None on record</span>
        return <span className="text-body-13">{roles.join(' · ')}</span>
      },
      sortValue: (row) => rolesFor(row).length,
      sortable: true,
    },
    {
      key: 'first',
      header: 'First hire',
      width: 124,
      accessor: (row) => (row.firstHireDate ? formatDate(row.firstHireDate) : <span className="text-text-secondary">—</span>),
      sortValue: (row) => row.firstHireDate ?? '',
      sortable: true,
    },
    {
      key: 'last',
      header: 'Last hire',
      width: 124,
      accessor: (row) => (row.lastHireDate ? formatDate(row.lastHireDate) : <span className="text-text-secondary">—</span>),
      sortValue: (row) => row.lastHireDate ?? '',
      sortable: true,
    },
    {
      key: 'owner',
      header: 'Relationship owner',
      minWidth: 180,
      accessor: (row) => userName(row.relationshipOwnerUserId),
      sortValue: (row) => userName(row.relationshipOwnerUserId),
      sortable: true,
    },
    {
      key: 'partnership',
      header: 'Partnership',
      width: 150,
      cell: (row) => (
        <Badge tone={PARTNERSHIP_TONE[row.partnershipStatus]} size="sm">
          {PARTNERSHIP_LABEL[row.partnershipStatus]}
        </Badge>
      ),
      sortValue: (row) => PARTNERSHIP_LABEL[row.partnershipStatus],
      sortable: true,
    },
    {
      key: 'satisfaction',
      header: 'Satisfaction',
      align: 'right',
      width: 132,
      accessor: (row) =>
        row.satisfactionScore === null ? (
          <span className="text-text-secondary">Not surveyed</span>
        ) : (
          <span className="tabular-nums">{row.satisfactionScore.toFixed(1)} of 5</span>
        ),
      sortValue: (row) => row.satisfactionScore ?? -1,
      sortable: true,
    },
  ]

  const byKey = new Map(columnCatalogue.map((column) => [column.key, column]))
  const columns = visible
    .map((key) => byKey.get(key))
    .filter((column): column is Column<Employer> => Boolean(column))

  return (
    <Screen>
      <ModuleHeader
        title="Employers"
        description="Who hires Cirvee graduates, how often, and who owns the relationship."
        actions={
          <Button size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setCreating(true)}>
            Add employer
          </Button>
        }
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="Employers" />
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
                onSearchChange={setSearch}
                searchPlaceholder="Search by employer, industry or location"
                values={filters}
                onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                onClearAll={clear}
                filters={[
                  {
                    key: 'partnership',
                    label: 'Partnership',
                    options: (Object.keys(PARTNERSHIP_LABEL) as Array<Employer['partnershipStatus']>).map(
                      (status) => ({ value: status, label: PARTNERSHIP_LABEL[status] }),
                    ),
                  },
                  {
                    key: 'industry',
                    label: 'Industry',
                    options: industries.map((industry) => ({ value: industry, label: industry })),
                  },
                ]}
              />
            </TableToolbar>

            <DataTable
              data={rows}
              columns={columns}
              rowKey={(row) => row.id}
              loading={loading}
              onRowClick={(row) => setOpenId(row.id)}
              activeRowKey={open?.id}
              density="compact"
              bordered={false}
              caption="Employers with industry, size, location, graduates hired, roles, relationship owner and partnership status"
              empty={
                filtered ? (
                  <EmptyState
                    variant="search"
                    title="No employers match these filters"
                    message="Try another industry or partnership status, or clear the search."
                    action={
                      <Button size="sm" variant="secondary" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={Building2}
                    title="No employers on record"
                    message="An employer is added the first time a graduate reports being hired there. Without one, a placement cannot name where the graduate went."
                    action={
                      <Button size="sm" onClick={() => setCreating(true)}>
                        Add the first employer
                      </Button>
                    }
                  />
                )
              }
            />
          </CardBody>
        </Card>
      )}

      <Drawer
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        size="lg"
        title={open?.name ?? 'Employer'}
        description={open ? `${open.industry} · ${open.size} · ${open.location}` : undefined}
      >
        {open && (
          <div className="space-y-6">
            <KeyValueList columns={2}>
              <KeyValue label="Partnership">
                <Badge tone={PARTNERSHIP_TONE[open.partnershipStatus]} size="sm">
                  {PARTNERSHIP_LABEL[open.partnershipStatus]}
                </Badge>
              </KeyValue>
              <KeyValue label="Relationship owner">{userName(open.relationshipOwnerUserId)}</KeyValue>
              <KeyValue label="First hire">
                {open.firstHireDate ? formatDate(open.firstHireDate) : 'No hire recorded'}
              </KeyValue>
              <KeyValue label="Last hire">
                {open.lastHireDate ? formatDate(open.lastHireDate) : 'No hire recorded'}
              </KeyValue>
              <KeyValue label="Satisfaction" hint="Collected from the hiring manager">
                {open.satisfactionScore === null
                  ? 'Not surveyed'
                  : `${open.satisfactionScore.toFixed(1)} of 5`}
              </KeyValue>
              <KeyValue label="Graduates with an outcome record here">
                {formatNumber(openPlacements.length)}
              </KeyValue>
            </KeyValueList>

            <div>
              <h3 className="mb-3 text-heading-18">Graduates hired</h3>
              {openPlacements.length === 0 ? (
                <EmptyState
                  icon={Handshake}
                  size="sm"
                  bordered
                  title="No graduate has an outcome record against this employer"
                  message="The employer row carries a hire count, but no graduate has yet confirmed this employer at a follow-up. Until one does, this relationship cannot be quoted as a placement."
                />
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {openPlacements.map((record) => (
                    <li key={record.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-body-14 text-text">{personName(record.personId)}</span>
                        <span className="block text-body-12 text-text-secondary">
                          {record.jobTitle ?? 'Role not recorded'} · {courseTitle(record.courseId)} ·{' '}
                          {cohortCode(record.cohortId)}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={outcomeTypeTone(record.outcomeType)} size="sm">
                          {OUTCOME_TYPE_LABEL[record.outcomeType]}
                        </Badge>
                        <span className="text-body-12 text-text-secondary">
                          {record.placementDate ? formatDate(record.placementDate) : 'Start date not recorded'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <NewEmployerModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(name) => {
          setCreating(false)
          setNotice(`${name} added. Record a placement against it from the graduate's outcome record.`)
        }}
      />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* New employer                                                               */
/* -------------------------------------------------------------------------- */

function NewEmployerModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: (name: string) => void
}) {
  const users = useCollection(usersCollection)
  const userName = useUserName()

  const [name, setName] = useState('')
  const [industry, setIndustry] = useState('')
  const [size, setSize] = useState(SIZE_OPTIONS[1])
  const [location, setLocation] = useState('')
  const [ownerUserId, setOwnerUserId] = useState('')
  const [partnership, setPartnership] = useState<Employer['partnershipStatus']>('informal')
  const [contact, setContact] = useState('')
  const [touched, setTouched] = useState(false)

  const duplicate = name.trim().length > 1 && employerNameTaken(name)
  const nameError = touched && !name.trim()
    ? 'An employer needs a name before a placement can point at it.'
    : duplicate
      ? `${name.trim()} is already on the list. Use the existing row so its hires stay in one place.`
      : undefined
  const industryError = touched && !industry.trim() ? 'Industry drives the outcome reporting by sector.' : undefined
  const locationError = touched && !location.trim() ? 'Where the role is based.' : undefined

  const submit = () => {
    setTouched(true)
    if (!name.trim() || !industry.trim() || !location.trim() || duplicate) return
    const employer = createEmployer({
      name,
      industry,
      size,
      location,
      relationshipOwnerUserId: ownerUserId ? (ownerUserId as UserId) : null,
      partnershipStatus: partnership,
      contactNote: contact,
    })
    onCreated(employer.name)
    setName('')
    setIndustry('')
    setLocation('')
    setContact('')
    setOwnerUserId('')
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add employer"
      description="An employer exists so a placement can name where a graduate went. It starts with no hires — the count fills in as outcome records point at it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Add employer</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Employer name" required error={nameError}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={Boolean(nameError)}
            placeholder="Interswitch"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Industry" required error={industryError}>
            <Input
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              invalid={Boolean(industryError)}
              placeholder="Financial technology"
            />
          </Field>

          <Field label="Headcount" required>
            <Select
              value={size}
              options={SIZE_OPTIONS.map((option) => ({ value: option, label: option }))}
              onChange={(e) => setSize(e.target.value)}
            />
          </Field>

          <Field label="Location" required error={locationError}>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              invalid={Boolean(locationError)}
              placeholder="Lagos"
            />
          </Field>

          <Field label="Partnership" required hint="Start informal. It is upgraded once hiring is repeatable.">
            <Select
              value={partnership}
              options={(Object.keys(PARTNERSHIP_LABEL) as Array<Employer['partnershipStatus']>).map((status) => ({
                value: status,
                label: PARTNERSHIP_LABEL[status],
              }))}
              onChange={(e) => setPartnership(e.target.value as Employer['partnershipStatus'])}
            />
          </Field>
        </div>

        <Field
          label="Relationship owner"
          optional
          hint="Leave empty and nobody is accountable for the relationship — which is worth seeing on the list."
        >
          <Select
            value={ownerUserId}
            placeholder="Nobody yet"
            options={users.map((u) => ({ value: u.id as string, label: userName(u.id) }))}
            onChange={(e) => setOwnerUserId(e.target.value)}
          />
        </Field>

        <Field label="Contact" optional hint="Name, role and how to reach them. Held on the audit trail, not published.">
          <Textarea
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            rows={2}
            maxLength={240}
            showCount
            placeholder="Adaeze Nnamdi, talent lead. adaeze.nnamdi@interswitch.example, 0803 000 0000."
          />
        </Field>
      </div>
    </Modal>
  )
}
