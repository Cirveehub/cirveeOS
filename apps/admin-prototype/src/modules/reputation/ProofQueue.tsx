/**
 * The proof queue.
 *
 * Each asset is drafted automatically off a real event — a certificate issued,
 * a placement confirmed — and the source event is visible on every row, per the
 * spec. Nothing leaves the queue without consent: an asset whose subject has
 * not agreed sits in the queue rather than quietly going out.
 */
import { useMemo, useState } from 'react'
import { ExternalLink, Image, ShieldAlert, Wand2 } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import { useQueryState } from '@/lib/view-state'
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
  Input,
  KeyValue,
  KeyValueList,
  Modal,
  Select,
  StatCard,
  TableToolbar,
  Textarea,
  type Column,
  type FilterValues,
} from '@/ui'
import { proofAssetsCollection, useCollection, usersCollection } from '@/mocks'
import type { ProofAsset, ProofAssetType, UserId } from '@/mocks'

import {
  CONSENT_LABEL,
  CONSENT_TONE,
  ErrorPanel,
  ModuleHeader,
  PROOF_STATUS_LABEL,
  PROOF_STATUS_TONE,
  PROOF_TYPE_LABEL,
  REVIEW_COMPLIANCE_NOTE,
  Screen,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'
import { approveProofAsset, canApproveProof, discardProofAsset, startProofProduction } from './writes'

const TYPES: ProofAssetType[] = ['graduation', 'placement', 'standout_project', 'cohort_milestone']
const STATUSES: ProofAsset['status'][] = [
  'drafted',
  'in_production',
  'approved',
  'published',
  'discarded',
]

export default function ProofQueue() {
  const allAssets = useCollection(proofAssetsCollection)
  const { loading, error, rows: assets, retry } = useModuleData(allAssets, 'reputation.proof')

  const personName = usePersonName()
  const userName = useUserName()

  const [search, setSearch] = useState('')
  const initial = useQueryState()
  const [filters, setFilters] = useState<FilterValues>(() => ({
    type: initial.get('type'),
    status: initial.get('status'),
    consent: initial.get('consent'),
    assignment: initial.get('assignment'),
  }))
  const [openId, setOpenId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const figures = useMemo(
    () => ({
      drafted: assets.filter((a) => a.status === 'drafted').length,
      inProduction: assets.filter((a) => a.status === 'in_production').length,
      published: assets.filter((a) => a.status === 'published').length,
      blocked: assets.filter((a) => a.consentStatus !== 'granted' && a.status !== 'discarded').length,
      unassigned: assets.filter((a) => a.assigneeUserId === null && a.status === 'drafted').length,
    }),
    [assets],
  )

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return assets
      .filter((asset) => {
        if (filters.type && asset.type !== filters.type) return false
        if (filters.status && asset.status !== filters.status) return false
        if (filters.consent && asset.consentStatus !== filters.consent) return false
        if (filters.assignment === 'unassigned' && asset.assigneeUserId !== null) return false
        if (filters.assignment === 'assigned' && asset.assigneeUserId === null) return false
        if (!term) return true
        return (
          personName(asset.subjectPersonId).toLowerCase().includes(term) ||
          asset.sourceEventRef.toLowerCase().includes(term) ||
          asset.sourceEventType.toLowerCase().includes(term) ||
          PROOF_TYPE_LABEL[asset.type].toLowerCase().includes(term) ||
          (asset.channel ?? '').toLowerCase().includes(term)
        )
      })
      .sort((a, b) => b.draftedAt.localeCompare(a.draftedAt))
  }, [assets, filters, search, personName])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const columns: Array<Column<ProofAsset>> = [
    {
      key: 'subject',
      header: 'Subject',
      pinned: true,
      minWidth: 200,
      accessor: (row) => personName(row.subjectPersonId),
      sortValue: (row) => personName(row.subjectPersonId),
      sortable: true,
    },
    {
      key: 'type',
      header: 'Type',
      width: 180,
      cell: (row) => (
        <Badge tone="accent" size="sm">
          {PROOF_TYPE_LABEL[row.type]}
        </Badge>
      ),
      sortValue: (row) => PROOF_TYPE_LABEL[row.type],
      sortable: true,
    },
    {
      key: 'source',
      header: 'Source event',
      minWidth: 260,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block text-body-13 text-text">{row.sourceEventType}</span>
          <span className="block font-mono text-body-12 text-text-secondary">{row.sourceEventRef}</span>
        </span>
      ),
      sortValue: (row) => `${row.sourceEventType} ${row.sourceEventRef}`,
      sortable: true,
    },
    {
      key: 'drafted',
      header: 'Drafted',
      width: 180,
      cell: (row) => (
        <span className="min-w-0">
          <span className="block text-body-13">{formatDateTime(row.draftedAt)}</span>
          <span className="block text-body-12 text-text-secondary">Automatically</span>
        </span>
      ),
      sortValue: (row) => row.draftedAt,
      sortable: true,
    },
    {
      key: 'assignee',
      header: 'Assignee',
      minWidth: 180,
      cell: (row) =>
        row.assigneeUserId ? (
          <span>{userName(row.assigneeUserId)}</span>
        ) : (
          <Badge tone="warning" size="sm">
            Unassigned
          </Badge>
        ),
      sortValue: (row) => (row.assigneeUserId ? userName(row.assigneeUserId) : ''),
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 150,
      cell: (row) => (
        <Badge tone={PROOF_STATUS_TONE[row.status]} size="sm">
          {PROOF_STATUS_LABEL[row.status]}
        </Badge>
      ),
      sortValue: (row) => PROOF_STATUS_LABEL[row.status],
      sortable: true,
    },
    {
      key: 'channel',
      header: 'Channel',
      width: 140,
      accessor: (row) => row.channel ?? <span className="text-text-secondary">Not chosen</span>,
      sortValue: (row) => row.channel ?? '',
      sortable: true,
    },
    {
      key: 'link',
      header: 'Published link',
      minWidth: 260,
      cell: (row) =>
        row.publishedUrl ? (
          <a
            href={row.publishedUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1.5 text-body-13 text-accent underline-offset-2 hover:underline"
          >
            <ExternalLink size={14} aria-hidden="true" />
            {row.publishedUrl.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-text-secondary">Not published</span>
        ),
      sortValue: (row) => row.publishedUrl ?? '',
      sortable: true,
    },
    {
      key: 'consent',
      header: 'Consent',
      width: 140,
      cell: (row) => (
        <Badge tone={CONSENT_TONE[row.consentStatus]} size="sm">
          {CONSENT_LABEL[row.consentStatus]}
        </Badge>
      ),
      sortValue: (row) => CONSENT_LABEL[row.consentStatus],
      sortable: true,
    },
    {
      key: 'review',
      header: 'Review',
      width: 130,
      cell: (row) => (
        <Button
          size="sm"
          variant={canApproveProof(row) ? 'primary' : 'secondary'}
          onClick={(event) => {
            event.stopPropagation()
            setOpenId(row.id as string)
          }}
        >
          {canApproveProof(row) ? 'Approve' : 'Open'}
        </Button>
      ),
    },
  ]

  return (
    <Screen>
      <ModuleHeader
        title="Proof queue"
        description="Assets drafted automatically off real events, each one naming the event it came from."
      />

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="The proof queue" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Drafted"
              value={formatNumber(figures.drafted)}
              icon={Wand2}
              variant={figures.drafted > 0 ? 'warning' : 'default'}
              caption={`${formatNumber(figures.unassigned)} of them have no assignee`}
              loading={loading}
            />
            <StatCard
              label="In production"
              value={formatNumber(figures.inProduction)}
              icon={Image}
              caption="Being made right now"
              loading={loading}
            />
            <StatCard
              label="Published"
              value={formatNumber(figures.published)}
              icon={ExternalLink}
              caption="Live, with a link on the row"
              loading={loading}
            />
            <StatCard
              label="Blocked on consent"
              value={formatNumber(figures.blocked)}
              icon={ShieldAlert}
              variant={figures.blocked > 0 ? 'danger' : 'default'}
              caption="Cannot be published as things stand"
              loading={loading}
            />
          </div>

          <Alert className="mt-6" tone="info" icon={Wand2} title="The queue fills itself">
            A certificate being issued or a placement being confirmed drafts an asset within seconds,
            which is why the drafted column reads as a backlog rather than a to-do list. Nothing is
            published without consent from the person it is about, whatever state the asset is in.
          </Alert>

          <Card className="mt-6">
            <CardBody padding="none">
              <TableToolbar>
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search by subject, source event or channel"
                  values={filters}
                  onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                  onClearAll={clear}
                  filters={[
                    {
                      key: 'type',
                      label: 'Type',
                      options: TYPES.map((type) => ({ value: type, label: PROOF_TYPE_LABEL[type] })),
                    },
                    {
                      key: 'status',
                      label: 'Status',
                      options: STATUSES.map((status) => ({
                        value: status,
                        label: PROOF_STATUS_LABEL[status],
                      })),
                    },
                    {
                      key: 'consent',
                      label: 'Consent',
                      options: (['granted', 'pending', 'declined'] as const).map((consent) => ({
                        value: consent,
                        label: CONSENT_LABEL[consent],
                      })),
                    },
                    {
                      key: 'assignment',
                      label: 'Assignment',
                      options: [
                        { value: 'assigned', label: 'Assigned' },
                        { value: 'unassigned', label: 'Unassigned' },
                      ],
                    },
                  ]}
                />
              </TableToolbar>

              <DataTable
                data={rows}
                columns={columns}
                rowKey={(row) => row.id}
                loading={loading}
                onRowClick={(row) => setOpenId(row.id as string)}
                activeRowKey={openId ?? undefined}
                density="compact"
                minWidth={2330}
                bordered={false}
                caption="Proof assets with type, the source event that drafted them, drafted date, assignee, status, channel, published link and consent status"
                empty={
                  filtered ? (
                    <EmptyState
                      variant="search"
                      title="No assets match these filters"
                      message="Try another type, status or consent state, or clear the search."
                      action={
                        <Button size="sm" variant="secondary" onClick={clear}>
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <EmptyState
                      icon={Image}
                      title="Nothing in the proof queue"
                      message="Assets are drafted automatically when a certificate is issued or a placement is confirmed. An empty queue means no such event has happened, not that the engine is off."
                    />
                  )
                }
              />

              {rows.length > 0 && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-body-12 text-text-secondary">
                    {formatNumber(rows.length)} {rows.length === 1 ? 'asset' : 'assets'} · oldest draft{' '}
                    {formatDate(rows[rows.length - 1].draftedAt)}
                  </p>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      )}

      <ReviewAssetModal
        asset={openId ? (allAssets.find((a) => (a.id as string) === openId) ?? null) : null}
        onClose={() => setOpenId(null)}
        onDone={(message) => {
          setOpenId(null)
          setNotice(message)
        }}
      />
    </Screen>
  )
}

/* -------------------------------------------------------------------------- */
/* Review and approve an asset                                                */
/* -------------------------------------------------------------------------- */

const CHANNEL_OPTIONS = ['Instagram', 'LinkedIn', 'WhatsApp status', 'Campus signage', 'Website']

/**
 * Approval is the gate. Consent is checked in `writes.ts` as well as here, so
 * an asset whose subject has not agreed cannot be approved even if this UI
 * were bypassed.
 */
function ReviewAssetModal({
  asset,
  onClose,
  onDone,
}: {
  asset: ProofAsset | null
  onClose: () => void
  onDone: (message: string) => void
}) {
  const users = useCollection(usersCollection)
  const personName = usePersonName()
  const userName = useUserName()

  const [channel, setChannel] = useState('')
  const [assigneeUserId, setAssigneeUserId] = useState('')
  const [discardReason, setDiscardReason] = useState('')
  const [discarding, setDiscarding] = useState(false)
  const [touched, setTouched] = useState(false)

  if (!asset) return <Modal open={false} onClose={onClose} title="Proof asset" />

  const effectiveChannel = channel || asset.channel || ''
  const effectiveAssignee = assigneeUserId || (asset.assigneeUserId as string | null) || ''
  const approvable = canApproveProof(asset)
  const channelError = touched && approvable && !effectiveChannel ? 'Say where this is going before approving it.' : undefined
  const discardError = touched && discarding && discardReason.trim().length < 5 ? 'Say why. The row stays either way.' : undefined

  const reset = () => {
    setChannel('')
    setAssigneeUserId('')
    setDiscardReason('')
    setDiscarding(false)
    setTouched(false)
  }

  const approve = () => {
    setTouched(true)
    if (!approvable || !effectiveChannel) return
    const ok = approveProofAsset(asset, effectiveChannel, effectiveAssignee ? (effectiveAssignee as UserId) : null)
    if (!ok) return
    onDone(`${asset.sourceEventRef} approved for ${effectiveChannel}.`)
    reset()
  }

  const produce = () => {
    setTouched(true)
    if (!effectiveAssignee) return
    startProofProduction(asset, effectiveAssignee as UserId)
    onDone(`${asset.sourceEventRef} moved into production with ${userName(effectiveAssignee)}.`)
    reset()
  }

  const discard = () => {
    setTouched(true)
    if (discardReason.trim().length < 5) return
    discardProofAsset(asset, discardReason.trim())
    onDone(`${asset.sourceEventRef} discarded. The row stays on the queue with the reason.`)
    reset()
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${PROOF_TYPE_LABEL[asset.type]} — ${personName(asset.subjectPersonId)}`}
      description={`Drafted automatically from ${asset.sourceEventType} ${asset.sourceEventRef} on ${formatDateTime(asset.draftedAt)}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {asset.status === 'drafted' && (
            <Button variant="secondary" onClick={produce}>
              Move to production
            </Button>
          )}
          {!discarding && asset.status !== 'discarded' && asset.status !== 'published' && (
            <Button variant="secondary" onClick={() => setDiscarding(true)}>
              Discard
            </Button>
          )}
          {discarding ? (
            <Button variant="danger" onClick={discard}>
              Confirm discard
            </Button>
          ) : (
            <Button onClick={approve} disabled={!approvable}>
              Approve
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <KeyValueList columns={2}>
          <KeyValue label="Subject">{personName(asset.subjectPersonId)}</KeyValue>
          <KeyValue label="Type">{PROOF_TYPE_LABEL[asset.type]}</KeyValue>
          <KeyValue label="Status">
            <Badge tone={PROOF_STATUS_TONE[asset.status]} size="sm">
              {PROOF_STATUS_LABEL[asset.status]}
            </Badge>
          </KeyValue>
          <KeyValue label="Consent">
            <Badge tone={CONSENT_TONE[asset.consentStatus]} size="sm">
              {CONSENT_LABEL[asset.consentStatus]}
            </Badge>
          </KeyValue>
          <KeyValue label="Source event">
            <span className="font-mono text-body-12">{asset.sourceEventRef}</span>
          </KeyValue>
          <KeyValue label="Assignee">
            {asset.assigneeUserId ? userName(asset.assigneeUserId) : 'Unassigned'}
          </KeyValue>
        </KeyValueList>

        {asset.consentStatus !== 'granted' && (
          <Alert
            tone={asset.consentStatus === 'declined' ? 'danger' : 'warning'}
            icon={ShieldAlert}
            title={
              asset.consentStatus === 'declined'
                ? 'The subject declined. This asset can never be published.'
                : 'Consent is still pending'
            }
          >
            Approval is blocked until the person it is about agrees. Ask them directly — a proof asset is
            about someone, and using it without consent is not a process problem, it is a trust one.
          </Alert>
        )}

        {asset.status === 'approved' && (
          <Alert tone="success" title="Already approved">
            This asset is cleared for {asset.channel ?? 'its chosen channel'}. Publishing happens outside
            the prototype; the link comes back onto the row.
          </Alert>
        )}

        {discarding ? (
          <Field label="Why it is being discarded" required error={discardError}>
            <Textarea
              value={discardReason}
              onChange={(e) => setDiscardReason(e.target.value)}
              rows={3}
              invalid={Boolean(discardError)}
              placeholder="Duplicate of the cohort milestone asset already published for this group."
            />
          </Field>
        ) : (
          <>
            <Field
              label="Channel"
              required={approvable}
              error={channelError}
              hint="Where this is going. Type a channel that is not on the list if you need to."
            >
              <Select
                value={CHANNEL_OPTIONS.includes(effectiveChannel) ? effectiveChannel : ''}
                placeholder="Choose a channel"
                options={CHANNEL_OPTIONS.map((option) => ({ value: option, label: option }))}
                onChange={(e) => setChannel(e.target.value)}
              />
            </Field>
            {!CHANNEL_OPTIONS.includes(effectiveChannel) && (
              <Field label="Other channel" optional>
                <Input
                  value={effectiveChannel}
                  onChange={(e) => setChannel(e.target.value)}
                  placeholder="Cohort newsletter"
                />
              </Field>
            )}
            <Field label="Assignee" optional hint="Who is making it. Required before it can move into production.">
              <Select
                value={effectiveAssignee}
                placeholder="Unassigned"
                options={users.map((u) => ({ value: u.id as string, label: userName(u.id) }))}
                onChange={(e) => setAssigneeUserId(e.target.value)}
              />
            </Field>
            <p className="text-body-12 text-text-secondary">{REVIEW_COMPLIANCE_NOTE}</p>
          </>
        )}
      </div>
    </Modal>
  )
}
