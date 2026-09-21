/**
 * Admissions — §2.7.
 *
 * This route used to alias `LeadList`, so "Admissions" showed leads. It now
 * shows Admission records, which is the only way the invoice, the discount
 * approval state and the three attribution fields are visible in one place.
 *
 * Twenty possible columns is well past the point where showing them all is a
 * kindness, so the eight that answer "what is this, and does it need me" are
 * the default and the rest sit behind `ColumnPicker`.
 */

import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Download, GraduationCap, Plus } from 'lucide-react'
import {
  Badge,
  Button,
  ColumnPicker,
  DataTable,
  EmptyState,
  Pagination,
  PersonChip,
  Select,
  SkeletonTable,
  StatusBadge,
  TableToolbar,
  UnitTag,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
} from '@/ui'
import { formatDate, formatNaira } from '@/lib/format'
import {
  TODAY,
  admissionsCollection,
  invoicesCollection,
  useCollection,
} from '@/mocks'
import type { Admission, AdmissionStatus } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import {
  ADMISSION_STATUS_LABELS,
  MODE_LABELS,
  PAYMENT_PLAN_LABELS,
  branchName,
  businessUnitOf,
  cohortCode,
  courseTitle,
  discountPercentLabel,
  unitName,
  useDirectory,
} from '../lib/lookups'
import {
  downloadCsv,
  paginate,
  parseSort,
  serialiseSort,
  useQueryState,
  useScreenLoad,
} from '../lib/view-state'

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'ref', label: 'Admission ref', defaultVisible: true, locked: true },
  { key: 'student', label: 'Student name', defaultVisible: true },
  { key: 'programme', label: 'Programme', defaultVisible: true },
  { key: 'cohort', label: 'Cohort', defaultVisible: false },
  { key: 'mode', label: 'Mode', defaultVisible: false },
  { key: 'branch', label: 'Branch', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: true },
  { key: 'quotedFee', label: 'Quoted fee', defaultVisible: false },
  { key: 'discount', label: 'Discount', defaultVisible: true },
  { key: 'netFee', label: 'Net fee', defaultVisible: true },
  { key: 'plan', label: 'Payment plan', defaultVisible: false },
  { key: 'invoice', label: 'Invoice', defaultVisible: false },
  { key: 'paid', label: 'Amount paid', defaultVisible: false },
  { key: 'balance', label: 'Balance', defaultVisible: true },
  { key: 'owner', label: 'Lead owner', defaultVisible: false },
  { key: 'closer', label: 'Closer', defaultVisible: false },
  { key: 'referrer', label: 'Referrer', defaultVisible: false },
  { key: 'expectedStart', label: 'Expected start', defaultVisible: false },
  { key: 'status', label: 'Status', defaultVisible: true },
]

const STATUSES: AdmissionStatus[] = [
  'draft',
  'pending_discount_approval',
  'invoiced',
  'partially_paid',
  'enrolled',
  'withdrawn',
]

const FILTER_KEYS = ['status', 'course', 'cohort', 'branch', 'unit', 'discount', 'referrer'] as const

export default function AdmissionList() {
  const query = useQueryState()
  const navigate = useNavigate()
  const { loading, error, retry } = useScreenLoad('crm.admissions')
  const directory = useDirectory()

  const admissions = useCollection(admissionsCollection)
  const invoices = useCollection(invoicesCollection)

  const status = query.get('status')
  const courseId = query.get('course')
  const branchId = query.get('branch')
  const unitId = query.get('unit')
  const pendingDiscount = query.get('discount') === 'pending'
  const hasReferrer = query.get('referrer') === 'yes'

  const sort = parseSort(query.get('sort')) ?? { key: 'ref', direction: 'desc' as const }
  const page = Number(query.get('page') ?? '1')
  const pageSize = Number(query.get('size') ?? '25')

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const invoiceOf = useMemo(() => {
    const map = new Map<string, (typeof invoices)[number]>()
    for (const invoice of invoices) {
      if (invoice.admissionId) map.set(invoice.admissionId as string, invoice)
    }
    return map
  }, [invoices])

  const rows = useMemo(
    () =>
      admissions.filter((a) => {
        if (status && a.status !== status) return false
        if (courseId && (a.courseId as string) !== courseId) return false
        if (branchId && (a.branchId as string) !== branchId) return false
        if (unitId && (a.unitId as string) !== unitId) return false
        if (pendingDiscount && a.status !== 'pending_discount_approval') return false
        if (hasReferrer && !a.referrerPersonId) return false
        return true
      }),
    [admissions, status, courseId, branchId, unitId, pendingDiscount, hasReferrer],
  )

  const sorted = useMemo(() => {
    const factor = sort.direction === 'asc' ? 1 : -1
    const value = (a: Admission): string | number => {
      switch (sort.key) {
        case 'student':
          return directory.nameOf(a.personId)
        case 'netFee':
          return a.netFee
        case 'balance':
          return invoiceOf.get(a.id as string)?.balance ?? a.netFee
        case 'discount':
          return a.discountAmount
        case 'expectedStart':
          return a.expectedStartDate
        case 'status':
          return a.status
        default:
          return a.ref
      }
    }
    return [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * factor
      return String(av).localeCompare(String(bv)) * factor
    })
  }, [rows, sort, directory, invoiceOf])

  const paged = paginate(sorted, page, pageSize)
  const filterCount = query.activeCount([...FILTER_KEYS])

  const allColumns: Record<string, Column<Admission>> = {
    ref: {
      key: 'ref',
      header: 'Admission ref',
      minWidth: 150,
      pinned: true,
      sortable: true,
      sortValue: (a) => a.ref,
      cell: (a) => <span className="font-medium text-text">{a.ref}</span>,
    },
    student: {
      key: 'student',
      header: 'Student name',
      minWidth: 190,
      sortable: true,
      sortValue: (a) => directory.nameOf(a.personId),
      cell: (a) => <PersonChip name={directory.nameOf(a.personId)} size="sm" />,
    },
    programme: {
      key: 'programme',
      header: 'Programme',
      minWidth: 190,
      sortable: true,
      accessor: (a) => courseTitle(a.courseId),
    },
    cohort: {
      key: 'cohort',
      header: 'Cohort',
      minWidth: 120,
      accessor: (a) => cohortCode(a.cohortId),
    },
    mode: { key: 'mode', header: 'Mode', minWidth: 110, accessor: (a) => MODE_LABELS[a.mode] },
    branch: { key: 'branch', header: 'Branch', minWidth: 120, accessor: (a) => branchName(a.branchId) },
    unit: {
      key: 'unit',
      header: 'Unit',
      minWidth: 130,
      sortable: true,
      sortValue: (a) => unitName(a.unitId),
      cell: (a) => {
        const unit = businessUnitOf(a.unitId)
        return unit ? <UnitTag unit={unit} size="sm" /> : <span className="text-text-muted">—</span>
      },
    },
    quotedFee: {
      key: 'quotedFee',
      header: 'Quoted fee',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (a) => a.quotedFee,
      accessor: (a) => formatNaira(a.quotedFee),
    },
    discount: {
      key: 'discount',
      header: 'Discount',
      align: 'right',
      minWidth: 190,
      sortable: true,
      sortValue: (a) => a.discountAmount,
      cell: (a) =>
        a.discountAmount ? (
          <div className="flex items-center justify-end gap-1.5">
            <span className="tabular-nums">{formatNaira(a.discountAmount)}</span>
            <Badge tone="neutral" variant="outline" size="sm">
              {discountPercentLabel(a)}
            </Badge>
            {a.status === 'pending_discount_approval' && (
              <Badge tone="warning" variant="subtle" size="sm">
                Awaiting approval
              </Badge>
            )}
          </div>
        ) : (
          <span className="text-text-muted">None</span>
        ),
    },
    netFee: {
      key: 'netFee',
      header: 'Net fee',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (a) => a.netFee,
      cell: (a) => <span className="font-semibold tabular-nums">{formatNaira(a.netFee)}</span>,
    },
    plan: {
      key: 'plan',
      header: 'Payment plan',
      minWidth: 140,
      accessor: (a) => PAYMENT_PLAN_LABELS[a.paymentPlan],
    },
    invoice: {
      key: 'invoice',
      header: 'Invoice',
      minWidth: 170,
      cell: (a) => {
        const invoice = invoiceOf.get(a.id as string)
        if (!invoice) return <span className="text-warning-text">Held</span>
        return (
          <span className="flex items-center gap-1.5">
            <span className="text-text">{invoice.ref}</span>
            <StatusBadge status={invoice.status} size="sm" />
          </span>
        )
      },
    },
    paid: {
      key: 'paid',
      header: 'Amount paid',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (a) => invoiceOf.get(a.id as string)?.paidAmount ?? 0,
      accessor: (a) => formatNaira(invoiceOf.get(a.id as string)?.paidAmount ?? 0),
    },
    balance: {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (a) => invoiceOf.get(a.id as string)?.balance ?? a.netFee,
      cell: (a) => {
        const balance = invoiceOf.get(a.id as string)?.balance ?? a.netFee
        return (
          <span className={balance > 0 ? 'tabular-nums text-warning-text' : 'tabular-nums'}>
            {formatNaira(balance)}
          </span>
        )
      },
    },
    owner: {
      key: 'owner',
      header: 'Lead owner',
      minWidth: 170,
      cell: (a) => <PersonChip name={directory.userNameOf(a.leadOwnerUserId)} size="sm" short />,
      sortValue: (a) => directory.userNameOf(a.leadOwnerUserId),
      sortable: true,
    },
    closer: {
      key: 'closer',
      header: 'Closer',
      minWidth: 170,
      cell: (a) =>
        a.closerUserId ? (
          <PersonChip name={directory.userNameOf(a.closerUserId)} size="sm" short />
        ) : (
          <span className="text-text-muted">Not set</span>
        ),
      sortValue: (a) => (a.closerUserId ? directory.userNameOf(a.closerUserId) : ''),
      sortable: true,
    },
    referrer: {
      key: 'referrer',
      header: 'Referrer',
      minWidth: 170,
      cell: (a) =>
        a.referrerPersonId ? (
          <PersonChip name={directory.nameOf(a.referrerPersonId)} size="sm" short />
        ) : (
          <span className="text-text-muted">Nobody</span>
        ),
      sortValue: (a) => (a.referrerPersonId ? directory.nameOf(a.referrerPersonId) : ''),
      sortable: true,
    },
    expectedStart: {
      key: 'expectedStart',
      header: 'Expected start',
      minWidth: 140,
      sortable: true,
      sortValue: (a) => a.expectedStartDate,
      accessor: (a) => formatDate(a.expectedStartDate),
    },
    status: {
      key: 'status',
      header: 'Status',
      minWidth: 180,
      sortable: true,
      sortValue: (a) => a.status,
      cell: (a) => <StatusBadge status={a.status} label={ADMISSION_STATUS_LABELS[a.status]} />,
    },
  }

  const columns = visible.map((key) => allColumns[key]).filter(Boolean)

  const exportCsv = () => {
    downloadCsv(
      `cirvee-admissions-${TODAY}.csv`,
      [
        'Admission ref',
        'Student',
        'Programme',
        'Cohort',
        'Unit',
        'Quoted fee (kobo)',
        'Discount (kobo)',
        'Net fee (kobo)',
        'Invoice',
        'Balance (kobo)',
        'Lead owner',
        'Closer',
        'Referrer',
        'Status',
      ],
      sorted.map((a) => {
        const invoice = invoiceOf.get(a.id as string)
        return [
          a.ref,
          directory.nameOf(a.personId),
          courseTitle(a.courseId),
          cohortCode(a.cohortId),
          unitName(a.unitId),
          String(a.quotedFee),
          String(a.discountAmount),
          String(a.netFee),
          invoice?.ref ?? '',
          String(invoice?.balance ?? a.netFee),
          directory.userNameOf(a.leadOwnerUserId),
          a.closerUserId ? directory.userNameOf(a.closerUserId) : '',
          a.referrerPersonId ? directory.nameOf(a.referrerPersonId) : '',
          ADMISSION_STATUS_LABELS[a.status],
        ]
      }),
    )
  }

  return (
    <CrmPage
      title="Admissions"
      description="Admission records — not leads. Each one owns an invoice, a discount state and three attribution fields."
      breadcrumbs={[{ label: 'CRM & admissions', to: '/crm' }, { label: 'Admissions' }]}
      error={error}
      onRetry={retry}
      actions={
        <Button asChild leftIcon={<Plus size={16} aria-hidden="true" />}>
          <Link to="/crm/admissions/new">New admission</Link>
        </Button>
      }
    >
      <TableToolbar
        actions={
          <>
            <ColumnPicker
              catalogue={COLUMN_CATALOGUE}
              visible={visible}
              defaultKeys={defaultKeys}
              onChange={setVisible}
            />
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} aria-hidden="true" />}
              onClick={exportCsv}
            >
              Export view
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Status"
            selectSize="sm"
            containerClassName="w-auto min-w-44"
            value={status ?? ''}
            onChange={(event) => query.set('status', event.target.value || undefined)}
            options={[
              { value: '', label: 'All statuses' },
              ...STATUSES.map((s) => ({ value: s, label: ADMISSION_STATUS_LABELS[s] })),
            ]}
          />
          <Select
            aria-label="Programme"
            selectSize="sm"
            containerClassName="w-auto min-w-44"
            value={courseId ?? ''}
            onChange={(event) => query.set('course', event.target.value || undefined)}
            options={[{ value: '', label: 'All programmes' }, ...directory.courseOptions]}
          />
          <Select
            aria-label="Branch"
            selectSize="sm"
            containerClassName="w-auto min-w-36"
            value={branchId ?? ''}
            onChange={(event) => query.set('branch', event.target.value || undefined)}
            options={[{ value: '', label: 'All branches' }, ...directory.branchOptions]}
          />
          <Select
            aria-label="Unit"
            selectSize="sm"
            containerClassName="w-auto min-w-36"
            value={unitId ?? ''}
            onChange={(event) => query.set('unit', event.target.value || undefined)}
            options={[{ value: '', label: 'All units' }, ...directory.unitOptions]}
          />
          <Button
            size="sm"
            variant={pendingDiscount ? 'primary' : 'secondary'}
            onClick={() => query.set('discount', pendingDiscount ? undefined : 'pending')}
            aria-pressed={pendingDiscount}
          >
            Discount pending approval
          </Button>
          <Button
            size="sm"
            variant={hasReferrer ? 'primary' : 'secondary'}
            onClick={() => query.set('referrer', hasReferrer ? undefined : 'yes')}
            aria-pressed={hasReferrer}
          >
            Has referrer
          </Button>
          {filterCount > 0 && (
            <Button size="sm" variant="ghost" onClick={() => query.clear(['cols'])}>
              Clear filters
            </Button>
          )}
        </div>
      </TableToolbar>

      <div className="mt-4">
        {loading ? (
          <SkeletonTable rows={10} columns={Math.min(columns.length, 8)} />
        ) : admissions.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No admissions yet"
            message="An admission is created from a qualified lead. It generates the invoice, adds the student relationship and writes the commission expectations in one step."
            action={
              <Button asChild>
                <Link to="/crm/admissions/new">New admission</Link>
              </Button>
            }
            bordered
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            variant="search"
            title="No admissions match these filters"
            message={`${filterCount} filter${filterCount === 1 ? '' : 's'} applied. Clearing them brings back all ${admissions.length} admissions.`}
            action={
              <Button variant="secondary" onClick={() => query.clear(['cols'])}>
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
              rowKey={(a) => a.id}
              caption="Admissions with fee, discount state, invoice and attribution"
              density="comfortable"
              minWidth={1300}
              maxHeight="calc(100vh - 340px)"
              sort={sort}
              onSortChange={(next) => query.set('sort', serialiseSort(next))}
              onRowClick={(a) => navigate(`/crm/admissions/${a.id}`)}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={sorted.length}
              itemNoun="admissions"
              onPageChange={(next) => query.set('page', String(next))}
              onPageSizeChange={(size) => query.set('size', String(size))}
            />
          </>
        )}
      </div>
    </CrmPage>
  )
}
