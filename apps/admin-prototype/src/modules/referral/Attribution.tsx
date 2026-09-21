import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Users } from 'lucide-react'

import {
  admissionsCollection,
  commissionsCollection,
  invoicesCollection,
  useCollection,
} from '@/mocks'
import type { Admission, Commission, CommissionRoleOnDeal, Kobo } from '@/mocks/types'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  ColumnPicker,
  DataTable,
  EmptyState,
  PersonChip,
  Select,
  SkeletonTable,
  StatCard,
  TableToolbar,
  useColumnVisibility,
  type Column,
  type ColumnCatalogueEntry,
} from '@/ui'
import { formatNaira, formatNumber, formatPercent } from '@/lib/format'
import { downloadCsv, useQueryState } from '@/lib/view-state'

import { ROLE_LABEL, courseTitle, personName, unitName, userName, userPersonId } from './lib'
import { LoadFailed, ModulePage, Screen, useScreenState } from './parts'

interface AttributionRow {
  admission: Admission
  studentName: string
  referrerName: string | null
  ownerName: string
  closerName: string | null
  revenue: Kobo
  referrerCommission: Kobo
  ownerCommission: Kobo
  closerCommission: Kobo
  totalCommission: Kobo
  share: number
  allThreeDiffer: boolean
}

const COLUMN_CATALOGUE: ColumnCatalogueEntry[] = [
  { key: 'admission', label: 'Admission', defaultVisible: true, locked: true },
  { key: 'student', label: 'Student', defaultVisible: true },
  { key: 'course', label: 'Programme', defaultVisible: false },
  { key: 'unit', label: 'Unit', defaultVisible: false },
  { key: 'referrer', label: 'Referrer', defaultVisible: true },
  { key: 'owner', label: 'Lead owner', defaultVisible: true },
  { key: 'closer', label: 'Closer', defaultVisible: true },
  { key: 'revenue', label: 'Revenue', defaultVisible: true },
  { key: 'referrerCommission', label: 'Referrer commission', defaultVisible: true },
  { key: 'ownerCommission', label: 'Owner commission', defaultVisible: true },
  { key: 'closerCommission', label: 'Closer commission', defaultVisible: true },
  { key: 'totalCommission', label: 'Total commission', defaultVisible: true },
  { key: 'share', label: 'Commission % of revenue', defaultVisible: true },
]

const COUNTED_STATES: Commission['state'][] = [
  'tracked',
  'pending',
  'earned',
  'approved',
  'payable',
  'paid',
]

export default function Attribution() {
  const navigate = useNavigate()
  const query = useQueryState()
  const { loading, errored, forcedEmpty, retry } = useScreenState('referral:attribution')

  const admissions = useCollection(admissionsCollection)
  const commissions = useCollection(commissionsCollection)
  const invoices = useCollection(invoicesCollection)

  const unitFilter = query.get('unit')
  const view = query.get('view') ?? 'all'

  const { visible, defaultKeys, setVisible } = useColumnVisibility(COLUMN_CATALOGUE)

  const rows: AttributionRow[] = useMemo(() => {
    const byAdmission = new Map<string, Commission[]>()
    for (const commission of commissions) {
      if (!COUNTED_STATES.includes(commission.state)) continue
      const key = commission.admissionId as string
      byAdmission.set(key, [...(byAdmission.get(key) ?? []), commission])
    }

    const totalFor = (list: Commission[], role: CommissionRoleOnDeal): Kobo =>
      list.filter((c) => c.roleOnDeal === role).reduce((acc, c) => acc + c.amount, 0) as Kobo

    return admissions.map((admission) => {
      const list = byAdmission.get(admission.id as string) ?? []
      const invoice = admission.invoiceId
        ? invoices.find((i) => i.id === admission.invoiceId)
        : undefined
      const revenue = (invoice?.total ?? admission.netFee) as Kobo

      const referrerCommission = totalFor(list, 'referrer')
      const ownerCommission = totalFor(list, 'lead_owner')
      const closerCommission = totalFor(list, 'closer')
      const totalCommission = (referrerCommission + ownerCommission + closerCommission) as Kobo

      const ownerPersonId = userPersonId(admission.leadOwnerUserId)
      const closerPersonId = userPersonId(admission.closerUserId)
      const distinct = new Set(
        [admission.referrerPersonId, ownerPersonId, closerPersonId].filter(Boolean) as string[],
      )

      return {
        admission,
        studentName: personName(admission.personId),
        referrerName: admission.referrerPersonId ? personName(admission.referrerPersonId) : null,
        ownerName: userName(admission.leadOwnerUserId),
        closerName: admission.closerUserId ? userName(admission.closerUserId) : null,
        revenue,
        referrerCommission,
        ownerCommission,
        closerCommission,
        totalCommission,
        share: revenue > 0 ? Number(((totalCommission / revenue) * 100).toFixed(1)) : 0,
        allThreeDiffer:
          Boolean(admission.referrerPersonId) &&
          Boolean(closerPersonId) &&
          distinct.size === 3,
      }
    })
  }, [admissions, commissions, invoices])

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (unitFilter && (row.admission.unitId as string) !== unitFilter) return false
        if (view === 'independent' && !row.allThreeDiffer) return false
        if (view === 'no-referrer' && row.referrerName !== null) return false
        return true
      }),
    [rows, unitFilter, view],
  )

  const unitOptions = useMemo(() => {
    const ids = [...new Set(rows.map((r) => r.admission.unitId as string))]
    return ids.map((id) => ({ value: id, label: unitName(id as Admission['unitId']) }))
  }, [rows])

  const independentCount = rows.filter((r) => r.allThreeDiffer).length
  const noReferrerCount = rows.filter((r) => r.referrerName === null).length
  const totalRevenue = filtered.reduce((acc, r) => acc + r.revenue, 0)
  const totalCommission = filtered.reduce((acc, r) => acc + r.totalCommission, 0)

  const columns: Record<string, Column<AttributionRow>> = {
    admission: {
      key: 'admission',
      header: 'Admission',
      minWidth: 150,
      pinned: true,
      sortValue: (r) => r.admission.ref,
      cell: (r) => <span className="font-medium text-text">{r.admission.ref}</span>,
    },
    student: {
      key: 'student',
      header: 'Student',
      minWidth: 180,
      sortValue: (r) => r.studentName,
      cell: (r) => <PersonChip name={r.studentName} size="sm" />,
    },
    course: {
      key: 'course',
      header: 'Programme',
      minWidth: 180,
      accessor: (r) => courseTitle(r.admission.courseId),
      sortValue: (r) => courseTitle(r.admission.courseId),
    },
    unit: {
      key: 'unit',
      header: 'Unit',
      minWidth: 150,
      accessor: (r) => unitName(r.admission.unitId),
      sortValue: (r) => unitName(r.admission.unitId),
    },
    referrer: {
      key: 'referrer',
      header: 'Referrer',
      minWidth: 170,
      sortValue: (r) => r.referrerName ?? '',
      cell: (r) =>
        r.referrerName ? (
          <PersonChip name={r.referrerName} size="sm" short />
        ) : (
          <span className="text-text-muted">Nobody</span>
        ),
    },
    owner: {
      key: 'owner',
      header: 'Lead owner',
      minWidth: 170,
      sortValue: (r) => r.ownerName,
      cell: (r) => <PersonChip name={r.ownerName} size="sm" short />,
    },
    closer: {
      key: 'closer',
      header: 'Closer',
      minWidth: 170,
      sortValue: (r) => r.closerName ?? '',
      cell: (r) =>
        r.closerName ? (
          <PersonChip name={r.closerName} size="sm" short />
        ) : (
          <span className="text-text-muted">Not set</span>
        ),
    },
    revenue: {
      key: 'revenue',
      header: 'Revenue',
      align: 'right',
      minWidth: 140,
      sortValue: (r) => r.revenue,
      cell: (r) => <span className="tabular-nums">{formatNaira(r.revenue)}</span>,
    },
    referrerCommission: {
      key: 'referrerCommission',
      header: 'Referrer commission',
      align: 'right',
      minWidth: 170,
      sortValue: (r) => r.referrerCommission,
      cell: (r) => (
        <span className={r.referrerCommission ? 'tabular-nums' : 'tabular-nums text-text-muted'}>
          {formatNaira(r.referrerCommission)}
        </span>
      ),
    },
    ownerCommission: {
      key: 'ownerCommission',
      header: 'Owner commission',
      align: 'right',
      minWidth: 170,
      sortValue: (r) => r.ownerCommission,
      cell: (r) => (
        <span className={r.ownerCommission ? 'tabular-nums' : 'tabular-nums text-text-muted'}>
          {formatNaira(r.ownerCommission)}
        </span>
      ),
    },
    closerCommission: {
      key: 'closerCommission',
      header: 'Closer commission',
      align: 'right',
      minWidth: 170,
      sortValue: (r) => r.closerCommission,
      cell: (r) => (
        <span className={r.closerCommission ? 'tabular-nums' : 'tabular-nums text-text-muted'}>
          {formatNaira(r.closerCommission)}
        </span>
      ),
    },
    totalCommission: {
      key: 'totalCommission',
      header: 'Total commission',
      align: 'right',
      minWidth: 160,
      sortValue: (r) => r.totalCommission,
      cell: (r) => (
        <span className="font-semibold tabular-nums">{formatNaira(r.totalCommission)}</span>
      ),
    },
    share: {
      key: 'share',
      header: 'Commission % of revenue',
      align: 'right',
      minWidth: 180,
      sortValue: (r) => r.share,
      cell: (r) => (
        <span className={r.share > 15 ? 'tabular-nums text-warning-text' : 'tabular-nums'}>
          {formatPercent(r.share)}
        </span>
      ),
    },
  }

  const exportCsv = () => {
    downloadCsv(
      'cirvee-attribution.csv',
      [
        'Admission',
        'Student',
        'Programme',
        'Unit',
        'Referrer',
        'Lead owner',
        'Closer',
        'Revenue (kobo)',
        'Referrer commission (kobo)',
        'Owner commission (kobo)',
        'Closer commission (kobo)',
        'Total commission (kobo)',
        'Commission % of revenue',
      ],
      filtered.map((r) => [
        r.admission.ref,
        r.studentName,
        courseTitle(r.admission.courseId),
        unitName(r.admission.unitId),
        r.referrerName ?? '',
        r.ownerName,
        r.closerName ?? '',
        String(r.revenue),
        String(r.referrerCommission),
        String(r.ownerCommission),
        String(r.closerCommission),
        String(r.totalCommission),
        String(r.share),
      ]),
    )
  }

  if (errored) {
    return (
      <Screen>
        <ModulePage title="Attribution" />
        <LoadFailed what="The attribution report" onRetry={retry} />
      </Screen>
    )
  }

  if (loading) {
    return (
      <Screen>
        <ModulePage title="Attribution" />
        <Card padding="none">
          <SkeletonTable rows={8} columns={7} />
        </Card>
      </Screen>
    )
  }

  return (
    <Screen>
      <ModulePage
        title="Attribution"
        description="Referrer, lead owner and closer on the same deals, evaluated separately. Read-only."
        actions={
          <Button
            variant="secondary"
            leftIcon={<Download size={16} aria-hidden="true" />}
            onClick={exportCsv}
          >
            Export
          </Button>
        }
      />

      <Alert tone="info" title="Three fields, three answers" className="mb-5">
        Nothing on this page derives one field from another. {formatNumber(independentCount)} admission
        {independentCount === 1 ? ' has' : 's have'} a referrer, an owner and a closer who are three
        different people, and {formatNumber(noReferrerCount)} have no referrer at all — which is a
        normal outcome, not missing data.
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Admissions in view"
          value={formatNumber(filtered.length)}
          caption={`${formatNumber(rows.length)} in total`}
          icon={Users}
        />
        <StatCard
          label="Revenue in view"
          value={formatNaira(totalRevenue)}
          caption="Invoiced total, or net fee where the invoice is still held"
        />
        <StatCard
          label="Commission in view"
          value={formatNaira(totalCommission)}
          caption="Every state except reversed and cancelled"
        />
        <StatCard
          label="Commission as % of revenue"
          value={formatPercent(totalRevenue > 0 ? (totalCommission / totalRevenue) * 100 : 0)}
          variant={
            totalRevenue > 0 && totalCommission / totalRevenue > 0.15 ? 'warning' : 'default'
          }
          caption="Across every role on the deal"
        />
      </div>

      <div className="mt-6">
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
          <div className="flex flex-wrap items-center gap-2">
            <Select
              aria-label="View"
              selectSize="sm"
              containerClassName="w-auto min-w-56"
              value={view}
              onChange={(event) => query.set('view', event.target.value === 'all' ? undefined : event.target.value)}
              options={[
                { value: 'all', label: 'All admissions' },
                { value: 'independent', label: 'Referrer, owner and closer all differ' },
                { value: 'no-referrer', label: 'No referrer' },
              ]}
            />
            <Select
              aria-label="Unit"
              selectSize="sm"
              containerClassName="w-auto min-w-44"
              value={unitFilter ?? ''}
              onChange={(event) => query.set('unit', event.target.value || undefined)}
              options={[{ value: '', label: 'All units' }, ...unitOptions]}
            />
            {(unitFilter || view !== 'all') && (
              <Button size="sm" variant="ghost" onClick={() => query.clear(['cols'])}>
                Clear filters
              </Button>
            )}
          </div>
        </TableToolbar>
      </div>

      <Card padding="none" className="mt-4">
        <CardHeader
          title="Attribution by admission"
          description="A row per admission. A blank commission column means no rule pays that role on this deal — which is the independence rule working, not a gap."
          actions={
            <Badge tone="neutral" variant="outline" size="sm">
              Read only
            </Badge>
          }
        />
        <DataTable
          data={forcedEmpty ? [] : filtered}
          columns={visible.map((key) => columns[key]).filter(Boolean)}
          rowKey={(r) => r.admission.id}
          caption="Referrer, lead owner and closer with their separate commission totals, by admission"
          density="compact"
          minWidth={1500}
          defaultSort={{ key: 'totalCommission', direction: 'desc' }}
          onRowClick={(r) => navigate(`/crm/admissions/${r.admission.id}`)}
          empty={
            <EmptyState
              icon={Users}
              title={
                view === 'all' ? 'No admissions to report on' : 'No admissions match this view'
              }
              message={
                view === 'all'
                  ? 'Attribution is reported from admissions. Until one exists there is nothing to evaluate a rule against.'
                  : 'Widen the view — the full list shows every admission, including the ones where the same person owned and closed the deal.'
              }
              action={
                <Button variant="secondary" onClick={() => query.clear(['cols'])}>
                  Show all admissions
                </Button>
              }
            />
          }
        />
      </Card>

      <p className="mt-4 text-body-13 text-text-secondary">
        Roles on the deal: {ROLE_LABEL.referrer} · {ROLE_LABEL.lead_owner} · {ROLE_LABEL.closer}. A
        rule that pays one of them does not pay the others; a second rule has to exist for that.
      </p>
    </Screen>
  )
}
