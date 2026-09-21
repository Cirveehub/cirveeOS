import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeft, BookOpen, CalendarClock, CheckCircle2, ShieldCheck } from 'lucide-react'

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  EmptyState,
  FilterBar,
  KeyValue,
  KeyValueList,
  PageHeader,
  ProgressBar,
  Skeleton,
  StatCard,
  type Column,
} from '@/ui'
import { TODAY, atTime, knowledgeArticlesCollection, useCollection } from '@/mocks'
import type { KnowledgeArticle, UserId } from '@/mocks'
import { formatDate, formatDateTime, formatNumber } from '@/lib/format'

import { writeAudit } from './engine'
import { currentActingUser, userName, userRoleName, useScreenState } from './shared'

const UNIVERSAL_AUDIENCE = 'All staff'

function readCount(article: KnowledgeArticle): number {
  return article.readReceipts.filter((r) => r.readAt !== null).length
}

function reviewIsOverdue(article: KnowledgeArticle): boolean {
  return article.nextReviewDue < TODAY
}

export default function Knowledge() {
  const [params, setParams] = useSearchParams()
  const { loading, error, retry } = useScreenState(params.get('demo') === 'error')

  const articles = useCollection(knowledgeArticlesCollection)

  const actor = currentActingUser()
  const actorRole = userRoleName(actor)

  const set = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const audience = params.get('audience') ?? ''
  const state = params.get('state') ?? ''
  const articleId = params.get('article')
  const open = articles.find((a) => a.id === articleId) ?? null

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const article of articles) {
      counts.set(article.category, (counts.get(article.category) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [articles])

  const audiences = useMemo(
    () => [...new Set(articles.flatMap((a) => a.audience))].sort((a, b) => a.localeCompare(b)),
    [articles],
  )

  const figures = useMemo(() => {
    const policies = articles.filter((a) => a.requiresAcknowledgement)
    const receipts = policies.flatMap((a) => a.readReceipts)
    return {
      total: articles.length,
      policies: policies.length,
      read: receipts.filter((r) => r.readAt !== null).length,
      expected: receipts.length,
      overdue: articles.filter(reviewIsOverdue).length,
    }
  }, [articles])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return articles
      .filter(
        (a) =>
          !needle ||
          a.title.toLowerCase().includes(needle) ||
          a.category.toLowerCase().includes(needle) ||
          a.bodyHtml.toLowerCase().includes(needle),
      )
      .filter((a) => !category || a.category === category)
      .filter((a) => !audience || a.audience.includes(audience))
      .filter((a) => {
        if (state === 'policies') return a.requiresAcknowledgement
        if (state === 'overdue') return reviewIsOverdue(a)
        if (state === 'unread') {
          return (
            a.requiresAcknowledgement &&
            !a.readReceipts.some((r) => r.userId === actor && r.readAt !== null)
          )
        }
        return true
      })
      .sort((a, b) => a.title.localeCompare(b.title))
  }, [articles, q, category, audience, state, actor])

  const filtersActive = Boolean(q || category || audience || state)

  const acknowledge = (article: KnowledgeArticle) => {
    const stamp = atTime(TODAY, 11, 0)
    const existing = article.readReceipts.find((r) => r.userId === actor)
    if (existing?.readAt) {
      toast('You acknowledged this article on ' + formatDate(existing.readAt) + '.')
      return
    }
    const receipts = existing
      ? article.readReceipts.map((r) => (r.userId === actor ? { ...r, readAt: stamp } : r))
      : [...article.readReceipts, { userId: actor as UserId, readAt: stamp }]

    knowledgeArticlesCollection.update(article.id, {
      readReceipts: receipts,
      updatedAt: stamp,
      updatedBy: actor,
    })
    writeAudit({
      actorUserId: actor,
      action: 'knowledge.article.acknowledge',
      entityType: 'KnowledgeArticle',
      entityId: article.id as string,
      entityRef: article.title,
      field: 'readReceipts',
      before: `${readCount(article)} of ${article.readReceipts.length}`,
      after: `${readCount(article) + 1} of ${receipts.length}`,
    })
    toast.success('Acknowledged. Your name now appears on the read receipt for this article.')
  }

  const columns: Array<Column<KnowledgeArticle>> = [
    {
      key: 'title',
      header: 'Title',
      pinned: true,
      minWidth: 320,
      cell: (a) => (
        <span className="min-w-0">
          <span className="block text-body-14 text-text">{a.title}</span>
          {a.requiresAcknowledgement && (
            <span className="block text-body-12 text-text-secondary">
              Acknowledgement required
            </span>
          )}
        </span>
      ),
      sortValue: (a) => a.title,
      sortable: true,
    },
    { key: 'category', header: 'Category', width: 160, accessor: (a) => a.category, sortable: true },
    {
      key: 'audience',
      header: 'Audience',
      minWidth: 220,
      cell: (a) => (
        <span className="flex flex-wrap gap-1">
          {a.audience.map((who) => (
            <Badge
              key={who}
              size="sm"
              tone={who === UNIVERSAL_AUDIENCE ? 'accent' : 'neutral'}
              variant="subtle"
            >
              {who}
            </Badge>
          ))}
        </span>
      ),
      sortValue: (a) => a.audience.join(', '),
      sortable: true,
    },
    {
      key: 'version',
      header: 'Version',
      align: 'right',
      width: 96,
      accessor: (a) => <span className="tabular-nums">v{a.version}</span>,
      sortValue: (a) => a.version,
      sortable: true,
    },
    {
      key: 'owner',
      header: 'Owner',
      width: 180,
      accessor: (a) => userName(a.ownerUserId),
      sortValue: (a) => userName(a.ownerUserId),
      sortable: true,
    },
    {
      key: 'reviewed',
      header: 'Last reviewed',
      width: 140,
      accessor: (a) => formatDate(a.lastReviewedAt),
      sortValue: (a) => a.lastReviewedAt,
      sortable: true,
    },
    {
      key: 'due',
      header: 'Next review due',
      width: 160,
      cell: (a) =>
        reviewIsOverdue(a) ? (
          <span className="text-body-13 text-danger-text">{formatDate(a.nextReviewDue)} · overdue</span>
        ) : (
          formatDate(a.nextReviewDue)
        ),
      sortValue: (a) => a.nextReviewDue,
      sortable: true,
    },
    {
      key: 'receipts',
      header: 'Read receipts',
      width: 200,
      cell: (a) =>
        !a.requiresAcknowledgement ? (
          <span className="text-text-secondary">Not tracked</span>
        ) : (
          <ProgressBar
            value={readCount(a)}
            max={Math.max(1, a.readReceipts.length)}
            size="sm"
            tone={readCount(a) === a.readReceipts.length ? 'success' : 'warning'}
            valueLabel={`${formatNumber(readCount(a))}/${formatNumber(a.readReceipts.length)}`}
          />
        ),
      sortValue: (a) => (a.requiresAcknowledgement ? readCount(a) / Math.max(1, a.readReceipts.length) : -1),
      sortable: true,
    },
  ]

  const myAudience = (article: KnowledgeArticle) =>
    article.audience.includes(UNIVERSAL_AUDIENCE) || article.audience.includes(actorRole)

  return (
    <div className="px-8 py-6">
      <PageHeader
        title="Knowledge base"
        description="The SOPs, policies and scripts the organisation runs on — and, for anything that requires it, who has actually read them."
        breadcrumbs={[{ label: 'Work', to: '/work' }, { label: 'Knowledge base' }]}
      />

      <div className="mt-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Articles"
          value={formatNumber(figures.total)}
          icon={BookOpen}
          caption="Across every category"
          loading={loading}
        />
        <StatCard
          label="Require acknowledgement"
          value={formatNumber(figures.policies)}
          icon={ShieldCheck}
          caption="Policies with a read receipt behind them"
          loading={loading}
        />
        <StatCard
          label="Acknowledgements recorded"
          value={`${formatNumber(figures.read)} of ${formatNumber(figures.expected)}`}
          icon={CheckCircle2}
          variant={figures.read < figures.expected ? 'warning' : 'success'}
          caption="Named people, not a publish count"
          loading={loading}
        />
        <StatCard
          label="Review overdue"
          value={formatNumber(figures.overdue)}
          icon={CalendarClock}
          variant={figures.overdue > 0 ? 'danger' : 'default'}
          caption="Past their next review date"
          loading={loading}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Categories" />
          <CardBody padding="none">
            <ul className="divide-y divide-border">
              <li>
                <CategoryButton
                  label="All articles"
                  count={articles.length}
                  active={category === ''}
                  onClick={() => set('category', undefined)}
                />
              </li>
              {categories.map(([name, count]) => (
                <li key={name}>
                  <CategoryButton
                    label={name}
                    count={count}
                    active={category === name}
                    onClick={() => set('category', category === name ? undefined : name)}
                  />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="min-w-0">
          {open ? (
            <ArticleView
              article={open}
              actor={actor}
              inMyAudience={myAudience(open)}
              onBack={() => set('article', undefined)}
              onAcknowledge={() => acknowledge(open)}
            />
          ) : (
            <Card>
              <CardBody padding="none">
                <div className="px-4 pb-2">
                  <FilterBar
                    search={q}
                    onSearchChange={(v) => set('q', v)}
                    searchPlaceholder="Search titles and article text"
                    values={{ audience, state }}
                    onFilterChange={set}
                    onClearAll={() => setParams(new URLSearchParams(), { replace: true })}
                    filters={[
                      {
                        key: 'audience',
                        label: 'Audience',
                        width: 220,
                        options: audiences.map((a) => ({ value: a, label: a })),
                      },
                      {
                        key: 'state',
                        label: 'Shortlist',
                        options: [
                          { value: 'policies', label: 'Requires acknowledgement' },
                          { value: 'unread', label: 'I have not acknowledged' },
                          { value: 'overdue', label: 'Review overdue' },
                        ],
                      },
                    ]}
                  />
                </div>

                {loading ? (
                  <div className="space-y-2 p-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} height={40} rounded="lg" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="p-6">
                    <EmptyState
                      variant="error"
                      title="Could not load the knowledge base"
                      message={error}
                      action={<Button onClick={retry}>Retry</Button>}
                    />
                  </div>
                ) : (
                  <DataTable
                    data={filtered}
                    columns={columns}
                    rowKey={(a) => a.id as string}
                    caption="Knowledge base articles with category, audience, version, owner, review dates and read receipts"
                    density="compact"
                    minWidth={1400}
                    onRowClick={(a) => set('article', a.id as string)}
                    empty={
                      filtersActive ? (
                        <EmptyState
                          variant="search"
                          title="No article matches these filters"
                          message="Try another category or audience, or clear the search."
                          action={
                            <Button
                              variant="secondary"
                              onClick={() => setParams(new URLSearchParams(), { replace: true })}
                            >
                              Clear filters
                            </Button>
                          }
                        />
                      ) : (
                        <EmptyState
                          icon={BookOpen}
                          title="No articles yet"
                          message="With nothing written down, every procedure lives in one person's head and leaves when they do."
                        />
                      )
                    }
                  />
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

function CategoryButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-body-13 transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
        active ? 'bg-accent-subtle text-accent' : 'text-text hover:bg-surface-sunken'
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 tabular-nums text-text-secondary">{formatNumber(count)}</span>
    </button>
  )
}

function ArticleView({
  article,
  actor,
  inMyAudience,
  onBack,
  onAcknowledge,
}: {
  article: KnowledgeArticle
  actor: UserId
  inMyAudience: boolean
  onBack: () => void
  onAcknowledge: () => void
}) {
  const mine = article.readReceipts.find((r) => r.userId === actor)
  const read = article.readReceipts.filter((r) => r.readAt !== null)
  const unread = article.readReceipts.filter((r) => r.readAt === null)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={article.title}
          description={`${article.category} · version ${article.version} · owned by ${userName(article.ownerUserId)}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={onBack}>
                All articles
              </Button>
              {article.requiresAcknowledgement && (
                <Button
                  onClick={onAcknowledge}
                  disabled={Boolean(mine?.readAt)}
                  leftIcon={<CheckCircle2 size={16} />}
                >
                  {mine?.readAt ? 'Acknowledged' : 'Acknowledge'}
                </Button>
              )}
            </div>
          }
        />
        <CardBody className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {article.audience.map((who) => (
              <Badge key={who} tone={who === UNIVERSAL_AUDIENCE ? 'accent' : 'neutral'} size="sm">
                {who}
              </Badge>
            ))}
            {!inMyAudience && (
              <Badge tone="warning" size="sm">
                Outside your audience
              </Badge>
            )}
            {reviewIsOverdue(article) && (
              <Badge tone="danger" size="sm">
                Review overdue
              </Badge>
            )}
          </div>

          {/* Seeded article bodies are authored as HTML in the mock data layer. */}
          <div
            className="space-y-3 text-body-14 leading-relaxed text-text [&_h2]:text-heading-18 [&_h2]:text-text [&_p]:text-text-secondary"
            dangerouslySetInnerHTML={{ __html: article.bodyHtml }}
          />

          <KeyValueList columns={2}>
            <KeyValue label="Version">v{article.version}</KeyValue>
            <KeyValue label="Owner">{userName(article.ownerUserId)}</KeyValue>
            <KeyValue label="Last reviewed">{formatDate(article.lastReviewedAt)}</KeyValue>
            <KeyValue label="Next review due">{formatDate(article.nextReviewDue)}</KeyValue>
          </KeyValueList>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Read receipts"
          description={
            article.requiresAcknowledgement
              ? 'Who has read this policy and who has not. The second list is the one that matters.'
              : 'This article does not require acknowledgement, so nothing is tracked against it.'
          }
        />
        <CardBody>
          {!article.requiresAcknowledgement ? (
            <EmptyState
              icon={ShieldCheck}
              size="sm"
              bordered
              title="Acknowledgement not required"
              message="Reference material is not tracked. Turn acknowledgement on for anything someone can be held to."
            />
          ) : (
            <div className="space-y-4">
              <ProgressBar
                value={read.length}
                max={Math.max(1, article.readReceipts.length)}
                tone={unread.length === 0 ? 'success' : 'warning'}
                label="Acknowledged"
                valueLabel={`${formatNumber(read.length)} of ${formatNumber(article.readReceipts.length)}`}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-label-11 text-text-label">Has read</p>
                  {read.length === 0 ? (
                    <p className="mt-1.5 text-body-13 text-text-secondary">
                      Nobody yet. A policy nobody has acknowledged cannot be enforced.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1.5">
                      {read.map((receipt) => (
                        <li
                          key={receipt.userId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-body-13"
                        >
                          <span className="text-text">{userName(receipt.userId)}</span>
                          <span className="text-text-secondary">
                            {receipt.readAt ? formatDateTime(receipt.readAt) : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-label-11 text-text-label">Has not read</p>
                  {unread.length === 0 ? (
                    <p className="mt-1.5 text-body-13 text-text-secondary">
                      Everyone on the distribution has acknowledged this article.
                    </p>
                  ) : (
                    <ul className="mt-1.5 space-y-1.5">
                      {unread.map((receipt) => (
                        <li
                          key={receipt.userId}
                          className="flex items-center justify-between gap-3 rounded-lg border border-warning-line bg-warning-fill px-3 py-2 text-body-13"
                        >
                          <span className="text-warning-ink">{userName(receipt.userId)}</span>
                          <span className="text-warning-ink">Outstanding</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
