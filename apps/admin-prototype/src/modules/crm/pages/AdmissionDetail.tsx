import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Coins,
  FileText,
  GraduationCap,
  Lock,
  MessageSquare,
  TriangleAlert,
} from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Field,
  KeyValue,
  KeyValueList,
  PersonChip,
  SkeletonCard,
  StatusBadge,
  Textarea,
  Timeline,
  UnitTag,
  type Column,
  type TimelineItem,
} from '@/ui'
import { formatDate, formatDateTime, formatNaira } from '@/lib/format'
import {
  activitiesCollection,
  admissionsCollection,
  auditEventsCollection,
  commissionsCollection,
  invoicesCollection,
  paymentsCollection,
  relationshipsCollection,
  useCollection,
  useRecord,
} from '@/mocks'
import type { AuditEvent, Commission, Instalment, Payment } from '@/mocks/types'
import { CrmPage } from '../components/CrmPage'
import { ThreePeople } from '../components/ThreePeople'
import { toast } from '../components/Toasts'
import {
  ADMISSION_STATUS_LABELS,
  DISCOUNT_TYPE_LABELS,
  MODE_LABELS,
  PAYMENT_PLAN_LABELS,
  RELATIONSHIP_LABELS,
  ROLE_ON_DEAL_LABELS,
  branchName,
  businessUnitOf,
  cohortCode,
  courseTitle,
  discountPercentLabel,
  useDirectory,
} from '../lib/lookups'
import { useQueryState, useScreenLoad } from '../lib/view-state'
import { withdrawAdmission } from '../lib/writes'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'fee', label: 'Fee & plan' },
  { id: 'invoice', label: 'Invoice & payments' },
  { id: 'commission', label: 'Commission' },
  { id: 'activity', label: 'Activity' },
  { id: 'audit', label: 'Audit' },
] as const

export default function AdmissionDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const query = useQueryState()
  const [params] = useSearchParams()
  const { loading, error, retry } = useScreenLoad(`crm.admission.${id}`)
  const directory = useDirectory()

  const admission = useRecord(admissionsCollection, id)
  const invoices = useCollection(invoicesCollection)
  const payments = useCollection(paymentsCollection)
  const commissions = useCollection(commissionsCollection)
  const activities = useCollection(activitiesCollection)
  const audits = useCollection(auditEventsCollection)
  const relationships = useCollection(relationshipsCollection)

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawReason, setWithdrawReason] = useState('')

  const justCreated = params.get('created') === '1'
  const tab = TABS.some((t) => t.id === query.get('tab')) ? (query.get('tab') as string) : 'overview'

  const invoice = useMemo(
    () => invoices.find((i) => (i.admissionId as string | null) === id),
    [invoices, id],
  )

  const invoicePayments: Payment[] = useMemo(
    () =>
      invoice
        ? payments.filter((p) => p.allocations.some((a) => (a.invoiceId as string) === (invoice.id as string)))
        : [],
    [payments, invoice],
  )

  const admissionCommissions = useMemo(
    () => commissions.filter((c) => (c.admissionId as string) === id),
    [commissions, id],
  )

  const admissionActivities = useMemo(
    () =>
      activities
        .filter((a) => a.subjectType === 'admission' && a.subjectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [activities, id],
  )

  const admissionAudits = useMemo(
    () =>
      audits
        .filter(
          (a) =>
            a.entityId === id ||
            (invoice ? a.entityId === (invoice.id as string) : false) ||
            admissionCommissions.some((c) => (c.id as string) === a.entityId),
        )
        .sort((a, b) => b.at.localeCompare(a.at)),
    [audits, id, invoice, admissionCommissions],
  )

  const studentRelationship = useMemo(
    () =>
      admission
        ? relationships.find(
            (r) => r.personId === admission.personId && r.type === 'student' && r.status === 'active',
          )
        : undefined,
    [relationships, admission],
  )

  if (loading) {
    return (
      <CrmPage
        title="Admission"
        breadcrumbs={[
          { label: 'CRM & admissions', to: '/crm' },
          { label: 'Admissions', to: '/crm/admissions' },
        ]}
      >
        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </CrmPage>
    )
  }

  if (!admission) {
    return (
      <CrmPage
        title="Admission not found"
        breadcrumbs={[
          { label: 'CRM & admissions', to: '/crm' },
          { label: 'Admissions', to: '/crm/admissions' },
        ]}
      >
        <EmptyState
          icon={GraduationCap}
          variant="error"
          title="That admission does not exist"
          message="Nothing is ever deleted here, so a missing record means the link is wrong rather than the record gone."
          action={
            <Button asChild>
              <Link to="/crm/admissions">Back to admissions</Link>
            </Button>
          }
          bordered
        />
      </CrmPage>
    )
  }

  const unit = businessUnitOf(admission.unitId)
  const balance = invoice?.balance ?? admission.netFee
  const withdrawn = admission.status === 'withdrawn'

  return (
    <CrmPage
      title={directory.nameOf(admission.personId)}
      description={`${admission.ref} · ${courseTitle(admission.courseId)} · cohort ${cohortCode(admission.cohortId)}`}
      breadcrumbs={[
        { label: 'CRM & admissions', to: '/crm' },
        { label: 'Admissions', to: '/crm/admissions' },
        { label: admission.ref },
      ]}
      error={error}
      onRetry={retry}
      tabs={TABS.map((t) => ({
        id: t.id,
        label: t.label,
        badge:
          t.id === 'commission'
            ? admissionCommissions.length || undefined
            : t.id === 'audit'
              ? admissionAudits.length || undefined
              : undefined,
      }))}
      activeTab={tab}
      onTabChange={(next) => query.set('tab', next === 'overview' ? undefined : next)}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={admission.status} label={ADMISSION_STATUS_LABELS[admission.status]} />
          <Badge tone="neutral" variant="outline">
            Net {formatNaira(admission.netFee)}
          </Badge>
          <Badge tone={balance > 0 ? 'warning' : 'success'} variant="subtle">
            Balance {formatNaira(balance)}
          </Badge>
          {unit && <UnitTag unit={unit} size="sm" />}
          <Badge tone="neutral" variant="subtle">
            {branchName(admission.branchId)}
          </Badge>
        </div>
      }
      actions={
        <>
          <Button variant="ghost" asChild leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>
            <Link to="/crm/admissions">Back to admissions</Link>
          </Button>
          {!withdrawn && (
            <Button variant="danger" onClick={() => setWithdrawOpen(true)}>
              Withdraw admission
            </Button>
          )}
        </>
      }
    >
      {justCreated && (
        <Alert tone="success" title={`${admission.ref} created — four things just happened`} className="mb-4">
          <ul className="mt-1 flex flex-col gap-1">
            <li>
              The admission was written as{' '}
              <span className="font-semibold">{ADMISSION_STATUS_LABELS[admission.status]}</span>.
            </li>
            <li>
              {directory.nameOf(admission.personId)} gained a student relationship on the{' '}
              <span className="font-semibold">same Person record</span> — no identity was re-entered.
            </li>
            <li>
              {invoice ? (
                <>
                  Invoice <span className="font-semibold">{invoice.ref}</span> was issued for{' '}
                  {formatNaira(invoice.total)}, tagged to {unit ?? 'the unit'}.
                </>
              ) : (
                <>The invoice is held until the discount approval is decided.</>
              )}
            </li>
            <li>
              {admissionCommissions.length
                ? `${admissionCommissions.length} commission row${admissionCommissions.length === 1 ? '' : 's'} were created, each naming the rule version it was computed under.`
                : 'No commission rule in force matched this admission, so no commission was created.'}
            </li>
          </ul>
        </Alert>
      )}

      {withdrawn && (
        <Alert tone="danger" title="This admission was withdrawn" className="mb-4">
          {admission.withdrawnReason ?? 'No reason recorded.'} Nothing was deleted — the invoice is
          voided and the commissions are cancelled, both still visible.
        </Alert>
      )}

      {admission.status === 'pending_discount_approval' && (
        <Alert tone="warning" title="The invoice is held pending discount approval" className="mb-4">
          A {discountPercentLabel(admission)} discount is above the configured threshold, so the
          approval request has to be decided before the invoice issues.{' '}
          <Link to="/work/approvals" className="font-semibold text-accent hover:underline">
            Open approvals
          </Link>
        </Alert>
      )}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <ThreePeople
            referrerPersonId={admission.referrerPersonId}
            ownerUserId={admission.leadOwnerUserId}
            closerUserId={admission.closerUserId}
          />

          <Card padding="none">
            <CardHeader title="Identity" bare />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Person" divided>
                  <PersonChip name={directory.nameOf(admission.personId)} size="sm" />
                </KeyValue>
                <KeyValue label="From lead" divided>
                  {admission.leadId ? (
                    <Link to={`/crm/leads/${admission.leadId}`} className="text-accent hover:underline">
                      Open the lead
                    </Link>
                  ) : (
                    'Direct application'
                  )}
                </KeyValue>
                <KeyValue label="Student since" divided>
                  {studentRelationship
                    ? `${RELATIONSHIP_LABELS[studentRelationship.type]} · ${formatDate(studentRelationship.startDate)}`
                    : 'Relationship ended'}
                </KeyValue>
                <KeyValue label="Enrolment">
                  {admission.enrolmentId ? 'Active' : 'Not created'}
                </KeyValue>
              </KeyValueList>
            </CardBody>
          </Card>
        </div>

        <div>
          {tab === 'overview' && (
            <Card>
              <CardHeader
                title="Overview"
                description="Every field the wizard captured. Edits from here are audited."
              />
              <CardBody>
                <KeyValueList columns={2}>
                  <KeyValue label="Programme" divided>
                    {courseTitle(admission.courseId)}
                  </KeyValue>
                  <KeyValue label="Cohort" divided>
                    {cohortCode(admission.cohortId)}
                  </KeyValue>
                  <KeyValue label="Mode" divided>
                    {MODE_LABELS[admission.mode]}
                  </KeyValue>
                  <KeyValue label="Branch" divided>
                    {branchName(admission.branchId)}
                  </KeyValue>
                  <KeyValue label="Unit" divided>
                    {unit ? <UnitTag unit={unit} size="sm" /> : '—'}
                  </KeyValue>
                  <KeyValue label="Expected start" divided>
                    {formatDate(admission.expectedStartDate)}
                  </KeyValue>
                  <KeyValue label="Created" divided>
                    {formatDateTime(admission.createdAt)}
                  </KeyValue>
                  <KeyValue label="Status" divided>
                    <StatusBadge
                      status={admission.status}
                      label={ADMISSION_STATUS_LABELS[admission.status]}
                    />
                  </KeyValue>
                </KeyValueList>
              </CardBody>
            </Card>
          )}

          {tab === 'fee' && <FeeTab
            quotedFee={admission.quotedFee}
            discountAmount={admission.discountAmount}
            discountLabel={`${DISCOUNT_TYPE_LABELS[admission.discountType]}${admission.discountValue ? ` · ${admission.discountValue}` : ''}`}
            discountReason={admission.discountReason}
            netFee={admission.netFee}
            planLabel={PAYMENT_PLAN_LABELS[admission.paymentPlan]}
            instalments={admission.instalments}
          />}

          {tab === 'invoice' && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader title="Invoice" description="Lines sum to the total; balance is total minus paid." />
                <CardBody>
                  {invoice ? (
                    <>
                      <KeyValueList columns={2}>
                        <KeyValue label="Reference" divided>
                          {invoice.ref}
                        </KeyValue>
                        <KeyValue label="Status" divided>
                          <StatusBadge status={invoice.status} />
                        </KeyValue>
                        <KeyValue label="Issued" divided>
                          {formatDate(invoice.issueDate)}
                        </KeyValue>
                        <KeyValue label="Due" divided>
                          {formatDate(invoice.dueDate)}
                        </KeyValue>
                        <KeyValue label="Subtotal" divided>
                          {formatNaira(invoice.subtotal)}
                        </KeyValue>
                        <KeyValue label="Discount" divided>
                          {formatNaira(invoice.discountAmount)}
                        </KeyValue>
                        <KeyValue label="Total" divided>
                          <span className="font-semibold">{formatNaira(invoice.total)}</span>
                        </KeyValue>
                        <KeyValue label="Balance" divided>
                          <span className={invoice.balance > 0 ? 'text-warning-text' : undefined}>
                            {formatNaira(invoice.balance)}
                          </span>
                        </KeyValue>
                      </KeyValueList>

                      <div className="mt-4 border-t border-border pt-3">
                        <h3 className="text-label-11 text-text-label">Lines</h3>
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {invoice.lines.map((line) => {
                            const lineUnit = businessUnitOf(line.unitId)
                            return (
                              <li
                                key={line.id}
                                className="flex flex-wrap items-center justify-between gap-2 text-body-13"
                              >
                                <span className="flex items-center gap-2 text-text">
                                  {line.description}
                                  {lineUnit && <UnitTag unit={lineUnit} size="sm" />}
                                </span>
                                <span className="tabular-nums text-text">{formatNaira(line.amount)}</span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      icon={FileText}
                      size="sm"
                      title="No invoice yet"
                      message="The invoice is held while the discount approval is outstanding. It issues the moment the approval is decided."
                    />
                  )}
                </CardBody>
              </Card>

              <PaymentsCard payments={invoicePayments} />
            </div>
          )}

          {tab === 'commission' && <CommissionTab rows={admissionCommissions} />}

          {tab === 'activity' && (
            <Card>
              <CardHeader title="Activity" description="Human and system entries on this admission." />
              <CardBody>
                {admissionActivities.length ? (
                  <Timeline
                    items={admissionActivities.map<TimelineItem>((activity) => ({
                      id: activity.id,
                      title: activity.isSystemGenerated ? 'System' : activity.type,
                      description: activity.body,
                      timestamp: activity.createdAt,
                      tone: activity.isSystemGenerated ? 'neutral' : 'accent',
                    }))}
                    timeFormat="relative"
                  />
                ) : (
                  <EmptyState
                    icon={MessageSquare}
                    size="sm"
                    title="Nothing logged yet"
                    message="Conversations about the person usually sit on the lead. This feed carries what happened to the admission itself."
                  />
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'audit' && <AuditCard rows={admissionAudits} />}
        </div>
      </div>

      <ConfirmDialog
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        destructive
        title="Withdraw this admission?"
        confirmLabel="Withdraw admission"
        onConfirm={() => {
          withdrawAdmission(admission, withdrawReason.trim() || 'Withdrawn by the admissions team.')
          toast({
            tone: 'warning',
            title: `${admission.ref} withdrawn`,
            body: 'Invoice voided, pending commissions cancelled, student relationship end-dated. Nothing deleted.',
          })
          setWithdrawOpen(false)
          setWithdrawReason('')
        }}
      >
        <p className="text-body-14 text-text">
          Withdrawing {invoice ? `voids ${invoice.ref} (${formatNaira(balance)} outstanding)` : 'cancels the held invoice'},
          reverses {admissionCommissions.filter((c) => ['tracked', 'pending', 'earned'].includes(c.state)).length}{' '}
          pending commission
          {admissionCommissions.filter((c) => ['tracked', 'pending', 'earned'].includes(c.state)).length === 1
            ? ''
            : 's'}{' '}
          and ends the student relationship. Nothing is deleted.
        </p>
        <Field label="Reason" className="mt-3" hint="Written to the audit log and onto every cancelled record.">
          <Textarea
            rows={2}
            value={withdrawReason}
            onChange={(event) => setWithdrawReason(event.target.value)}
            placeholder="Deferred to the January cohort at the student's request."
          />
        </Field>
      </ConfirmDialog>
    </CrmPage>
  )
}

function FeeTab({
  quotedFee,
  discountAmount,
  discountLabel,
  discountReason,
  netFee,
  planLabel,
  instalments,
}: {
  quotedFee: number
  discountAmount: number
  discountLabel: string
  discountReason: string | null
  netFee: number
  planLabel: string
  instalments: Instalment[]
}) {
  const columns: Column<Instalment>[] = [
    { key: 'number', header: '#', minWidth: 60, accessor: (row) => String(row.number) },
    {
      key: 'due',
      header: 'Due date',
      minWidth: 140,
      sortable: true,
      sortValue: (row) => row.dueDate,
      accessor: (row) => formatDate(row.dueDate),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      minWidth: 140,
      sortable: true,
      sortValue: (row) => row.amount,
      cell: (row) => <span className="tabular-nums">{formatNaira(row.amount)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      minWidth: 120,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  const allocated = instalments.reduce((acc, i) => acc + i.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Fee" description="Quoted, less discount, equals net. All kobo." />
        <CardBody>
          <KeyValueList>
            <KeyValue label="Quoted fee" divided align="right">
              <span className="tabular-nums">{formatNaira(quotedFee)}</span>
            </KeyValue>
            <KeyValue label={`Discount · ${discountLabel}`} divided align="right">
              <span className="tabular-nums text-danger-text">
                {discountAmount ? `− ${formatNaira(discountAmount)}` : formatNaira(0)}
              </span>
            </KeyValue>
            <KeyValue label="Net fee" align="right">
              <span className="text-heading-20 font-semibold tabular-nums text-text">
                {formatNaira(netFee)}
              </span>
            </KeyValue>
          </KeyValueList>
          {discountReason && (
            <p className="mt-3 border-t border-border pt-3 text-body-13 text-text-secondary">
              Discount reason: {discountReason}
            </p>
          )}
        </CardBody>
      </Card>

      <Card padding="none">
        <CardHeader
          title={`Payment plan · ${planLabel}`}
          description={
            allocated === netFee
              ? 'The instalments reconcile against the net fee.'
              : `The instalments allocate ${formatNaira(allocated)} against a net fee of ${formatNaira(netFee)}. That is a reconciliation break.`
          }
        />
        <DataTable
          data={instalments}
          columns={columns}
          rowKey={(row) => String(row.number)}
          caption="Instalment schedule"
          density="compact"
          empty={
            <EmptyState size="sm" title="No instalments" message="This admission is on full upfront payment." />
          }
        />
      </Card>
    </div>
  )
}

function PaymentsCard({ payments }: { payments: Payment[] }) {
  const columns: Column<Payment>[] = [
    { key: 'ref', header: 'Payment', minWidth: 130, accessor: (row) => row.ref },
    {
      key: 'received',
      header: 'Received',
      minWidth: 150,
      sortable: true,
      sortValue: (row) => row.receivedAt,
      accessor: (row) => formatDate(row.receivedAt),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (row) => row.amount,
      cell: (row) => <span className="tabular-nums">{formatNaira(row.amount)}</span>,
    },
    { key: 'method', header: 'Method', minWidth: 150, accessor: (row) => row.method.replace(/_/g, ' ') },
    {
      key: 'status',
      header: 'Status',
      minWidth: 130,
      cell: (row) => <StatusBadge status={row.status} />,
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Payments"
        description="Allocated against this invoice. Unmatched payments stay visible in finance and are never auto-assigned."
      />
      <DataTable
        data={payments}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Payments allocated to this invoice"
        density="compact"
        empty={
          <EmptyState
            size="sm"
            title="Nothing paid yet"
            message="Commission held on a payment condition stays Pending until a payment lands here."
          />
        }
      />
    </Card>
  )
}

function CommissionTab({ rows }: { rows: Commission[] }) {
  const directory = useDirectory()

  const columns: Column<Commission>[] = [
    { key: 'ref', header: 'Commission', minWidth: 150, accessor: (row) => row.ref },
    {
      key: 'beneficiary',
      header: 'Beneficiary',
      minWidth: 170,
      sortValue: (row) => directory.nameOf(row.beneficiaryPersonId),
      cell: (row) => <PersonChip name={directory.nameOf(row.beneficiaryPersonId)} size="sm" short />,
    },
    {
      key: 'role',
      header: 'Role on deal',
      minWidth: 130,
      sortValue: (row) => row.roleOnDeal,
      cell: (row) => (
        <Badge tone="accent" variant="subtle" size="sm">
          {ROLE_ON_DEAL_LABELS[row.roleOnDeal]}
        </Badge>
      ),
    },
    {
      key: 'rule',
      header: 'Rule + version',
      minWidth: 190,
      cell: (row) => (
        <Link to={`/referral/rules/${row.ruleId}`} className="text-accent hover:underline">
          {row.ruleKey} v{row.ruleVersion}
        </Link>
      ),
    },
    { key: 'basis', header: 'Basis', minWidth: 150, accessor: (row) => row.basis.replace(/_/g, ' ') },
    {
      key: 'basisAmount',
      header: 'Basis amount',
      align: 'right',
      minWidth: 140,
      sortValue: (row) => row.basisAmount,
      cell: (row) => <span className="tabular-nums">{formatNaira(row.basisAmount)}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      minWidth: 130,
      sortable: true,
      sortValue: (row) => row.amount,
      cell: (row) => <span className="font-semibold tabular-nums">{formatNaira(row.amount)}</span>,
    },
    {
      key: 'state',
      header: 'State',
      minWidth: 120,
      sortValue: (row) => row.state,
      cell: (row) => <StatusBadge status={row.state} />,
    },
    {
      key: 'eligibility',
      header: 'Eligibility note',
      minWidth: 220,
      accessor: (row) => row.eligibilityNote ?? 'No condition outstanding',
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Commission"
        description="The rows this admission generated. Referrer, lead owner and closer are evaluated separately, so two people can earn on the same deal."
        actions={
          <Button size="sm" variant="ghost" asChild>
            <Link to="/referral/commissions">Open the ledger</Link>
          </Button>
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Commissions generated by this admission"
        density="compact"
        minWidth={1200}
        empty={
          <EmptyState
            icon={Coins}
            size="sm"
            title="No commission on this admission"
            message="Either no rule version was in force when it was created, or none of the three attribution fields matched a rule's beneficiary."
          />
        }
      />
    </Card>
  )
}

function AuditCard({ rows }: { rows: AuditEvent[] }) {
  const columns: Column<AuditEvent>[] = [
    {
      key: 'at',
      header: 'Timestamp',
      minWidth: 170,
      sortable: true,
      sortValue: (row) => row.at,
      cell: (row) => <span className="font-mono text-body-12">{formatDateTime(row.at)}</span>,
    },
    { key: 'actor', header: 'Actor', minWidth: 160, accessor: (row) => row.actorName },
    {
      key: 'action',
      header: 'Action',
      minWidth: 190,
      cell: (row) => <span className="font-mono text-body-12">{row.action}</span>,
    },
    { key: 'record', header: 'Record', minWidth: 150, accessor: (row) => row.entityRef },
    { key: 'field', header: 'Field', minWidth: 140, accessor: (row) => row.field ?? '—' },
    {
      key: 'before',
      header: 'Before',
      minWidth: 160,
      cell: (row) => <span className="font-mono text-body-12 text-text-secondary">{row.before ?? '—'}</span>,
    },
    {
      key: 'after',
      header: 'After',
      minWidth: 160,
      cell: (row) => <span className="font-mono text-body-12">{row.after ?? '—'}</span>,
    },
  ]

  return (
    <Card padding="none">
      <CardHeader
        title="Audit"
        description="The admission, its invoice and its commissions, in one immutable trail."
        actions={
          <Badge tone="neutral" variant="outline" size="sm" icon={<Lock size={12} aria-hidden="true" />}>
            Read only
          </Badge>
        }
      />
      <DataTable
        data={rows}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Audit trail for this admission"
        density="compact"
        minWidth={1200}
        defaultSort={{ key: 'at', direction: 'desc' }}
        empty={
          <EmptyState
            icon={TriangleAlert}
            size="sm"
            title="No audit events"
            message="Creation itself is normally audited, so an empty trail here means something wrote around the write layer."
          />
        }
      />
    </Card>
  )
}
