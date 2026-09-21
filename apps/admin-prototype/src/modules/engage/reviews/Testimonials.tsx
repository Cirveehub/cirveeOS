import { useMemo, useState } from 'react'
import { Image, MessageSquareQuote, Plus, ShieldOff, Video } from 'lucide-react'

import { formatDate, formatDateTime, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
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
  type Column,
  type FilterValues,
} from '@/ui'
import {
  cohortsCollection,
  coursesCollection,
  peopleCollection,
  testimonialsCollection,
  useCollection,
} from '@/mocks'
import type { Channel, CohortId, CourseId, PersonId, Testimonial } from '@/mocks'

import {
  CHANNEL_LABEL,
  ErrorPanel,
  TESTIMONIAL_STATUS_LABEL,
  TESTIMONIAL_STATUS_TONE,
  useCohortCode,
  useCourseTitle,
  useModuleData,
  usePersonName,
  useUserName,
} from './parts'
import { createTestimonial } from './writes'

const STATUSES: Testimonial['status'][] = ['new', 'approved', 'published', 'archived']

function preview(quote: string): string {
  return quote.length <= 120 ? quote : `${quote.slice(0, 119)}…`
}

function isVideo(url: string): boolean {
  return /\.(mp4|mov|webm)$/i.test(url)
}

export default function Testimonials() {
  const allTestimonials = useCollection(testimonialsCollection)
  const courses = useCollection(coursesCollection)
  const { loading, error, rows: testimonials, retry } = useModuleData(
    allTestimonials,
    'reputation.testimonials',
  )

  const personName = usePersonName()
  const courseTitle = useCourseTitle()
  const cohortCode = useCohortCode()
  const userName = useUserName()

  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [openId, setOpenId] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const courseOptions = useMemo(() => {
    const used = new Set(allTestimonials.map((t) => t.courseId as string))
    return courses
      .filter((course) => used.has(course.id as string))
      .map((course) => ({ value: course.id as string, label: course.title }))
  }, [courses, allTestimonials])

  const consented = testimonials.filter((t) => t.consentGranted).length

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return testimonials
      .filter((testimonial) => {
        if (filters.status && testimonial.status !== filters.status) return false
        if (filters.course && (testimonial.courseId as string) !== filters.course) return false
        if (filters.consent === 'granted' && !testimonial.consentGranted) return false
        if (filters.consent === 'not_granted' && testimonial.consentGranted) return false
        if (filters.media === 'with' && testimonial.mediaUrls.length === 0) return false
        if (filters.media === 'without' && testimonial.mediaUrls.length > 0) return false
        if (!term) return true
        return (
          personName(testimonial.personId).toLowerCase().includes(term) ||
          testimonial.quote.toLowerCase().includes(term) ||
          testimonial.outcome.toLowerCase().includes(term) ||
          courseTitle(testimonial.courseId).toLowerCase().includes(term) ||
          testimonial.tags.some((tag) => tag.toLowerCase().includes(term))
        )
      })
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
  }, [testimonials, filters, search, personName, courseTitle])

  const filtered = Boolean(search) || Object.values(filters).some(Boolean)
  const clear = () => {
    setFilters({})
    setSearch('')
  }

  const open = openId ? (testimonials.find((t) => t.id === openId) ?? null) : null

  const columns: Array<Column<Testimonial>> = [
    {
      key: 'person',
      header: 'Person',
      pinned: true,
      minWidth: 190,
      accessor: (row) => personName(row.personId),
      sortValue: (row) => personName(row.personId),
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
      key: 'outcome',
      header: 'Outcome',
      minWidth: 240,
      accessor: (row) => row.outcome,
      sortValue: (row) => row.outcome,
      sortable: true,
    },
    {
      key: 'quote',
      header: 'Quote',
      minWidth: 380,
      accessor: (row) => <span className="text-body-13 text-text-secondary">{preview(row.quote)}</span>,
      sortValue: (row) => row.quote,
      sortable: true,
    },
    {
      key: 'captured',
      header: 'Captured',
      width: 124,
      accessor: (row) => formatDate(row.capturedAt),
      sortValue: (row) => row.capturedAt,
      sortable: true,
    },
    {
      key: 'capturedBy',
      header: 'Captured by',
      minWidth: 170,
      accessor: (row) => userName(row.capturedByUserId),
      sortValue: (row) => userName(row.capturedByUserId),
      sortable: true,
    },
    {
      key: 'channel',
      header: 'Channel',
      width: 120,
      accessor: (row) => CHANNEL_LABEL[row.channel],
      sortValue: (row) => CHANNEL_LABEL[row.channel],
      sortable: true,
    },
    {
      key: 'consent',
      header: 'Consent',
      width: 196,
      cell: (row) =>
        row.consentGranted ? (
          <Badge tone="success" size="sm">
            Granted{row.consentCapturedAt ? ` · ${formatDate(row.consentCapturedAt)}` : ''}
          </Badge>
        ) : (
          <Badge tone="danger" size="sm" icon={<ShieldOff size={12} />}>
            Not granted
          </Badge>
        ),
      sortValue: (row) => (row.consentGranted ? 1 : 0),
      sortable: true,
    },
    {
      key: 'media',
      header: 'Media',
      width: 128,
      cell: (row) => {
        if (row.mediaUrls.length === 0) return <span className="text-text-secondary">Text only</span>
        const video = row.mediaUrls.some(isVideo)
        return (
          <Badge tone="neutral" size="sm" icon={video ? <Video size={12} /> : <Image size={12} />}>
            {video ? 'Video' : 'Photo'}
          </Badge>
        )
      },
      sortValue: (row) => row.mediaUrls.length,
      sortable: true,
    },
    {
      key: 'tags',
      header: 'Tags',
      minWidth: 170,
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.tags.map((tag) => (
            <Badge key={tag} tone="neutral" variant="outline" size="sm">
              {tag}
            </Badge>
          ))}
        </span>
      ),
      sortValue: (row) => row.tags.join(' '),
      sortable: true,
    },
    {
      key: 'usage',
      header: 'Published where',
      minWidth: 230,
      accessor: (row) =>
        row.usage.length === 0 ? (
          <span className="text-text-secondary">Not published</span>
        ) : (
          row.usage.map((use) => use.where).join(' · ')
        ),
      sortValue: (row) => row.usage.length,
      sortable: true,
    },
    {
      key: 'status',
      header: 'Status',
      width: 136,
      cell: (row) => (
        <Badge tone={TESTIMONIAL_STATUS_TONE[row.status]} size="sm">
          {TESTIMONIAL_STATUS_LABEL[row.status]}
        </Badge>
      ),
      sortValue: (row) => TESTIMONIAL_STATUS_LABEL[row.status],
      sortable: true,
    },
  ]

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-13 text-text-secondary">
          {formatNumber(testimonials.length)} captured · {formatNumber(consented)} with consent to publish
        </p>
        <Button size="sm" leftIcon={<Plus size={16} aria-hidden="true" />} onClick={() => setCapturing(true)}>
          Add testimonial
        </Button>
      </div>

      {notice && (
        <Alert tone="success" className="mb-4" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error ? (
        <ErrorPanel onRetry={retry} what="Testimonials" />
      ) : (
        <Card>
          <CardBody padding="none">
            <TableToolbar>
              <FilterBar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search the quote, the outcome, the course or a tag"
                values={filters}
                onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
                onClearAll={clear}
                filters={[
                  {
                    key: 'status',
                    label: 'Status',
                    options: STATUSES.map((status) => ({
                      value: status,
                      label: TESTIMONIAL_STATUS_LABEL[status],
                    })),
                  },
                  { key: 'course', label: 'Course', options: courseOptions },
                  {
                    key: 'consent',
                    label: 'Consent',
                    options: [
                      { value: 'granted', label: 'Granted' },
                      { value: 'not_granted', label: 'Not granted' },
                    ],
                  },
                  {
                    key: 'media',
                    label: 'Media',
                    options: [
                      { value: 'with', label: 'With photo or video' },
                      { value: 'without', label: 'Text only' },
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
              onRowClick={(row) => setOpenId(row.id)}
              activeRowKey={open?.id}
              density="compact"
              minWidth={2600}
              bordered={false}
              caption="Testimonials with course, cohort, outcome, quote, capture details, consent status, media, tags, usage and status"
              empty={
                filtered ? (
                  <EmptyState
                    variant="search"
                    title="No testimonial matches"
                    message="The search covers the quote, the outcome line, the course and the tags. Try a course name or an employer."
                    action={
                      <Button size="sm" variant="secondary" onClick={clear}>
                        Clear filters
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={MessageSquareQuote}
                    title="No testimonials captured"
                    message="Ask for one in the same conversation as a review: after a certificate, a strong grade or a placement."
                    action={
                      <Button size="sm" onClick={() => setCapturing(true)}>
                        Capture the first one
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
        title={open ? personName(open.personId) : 'Testimonial'}
        description={open ? open.outcome : undefined}
      >
        {open && (
          <div className="space-y-6">
            {!open.consentGranted && (
              <div className="flex items-start gap-3 rounded-xl border border-danger-line bg-danger-fill px-4 py-3">
                <ShieldOff size={16} className="mt-0.5 shrink-0 text-danger-ink" aria-hidden="true" />
                <p className="text-body-13 text-danger-ink">
                  No consent on file. This quote may not be published on the website, on social, in a
                  proposal or in a proof asset until consent is given and the date recorded.
                </p>
              </div>
            )}

            <blockquote className="rounded-xl border-l-2 border-accent bg-surface-sunken px-4 py-3 text-body-14 text-text">
              {open.quote}
            </blockquote>

            <KeyValueList columns={2}>
              <KeyValue label="Course">{courseTitle(open.courseId)}</KeyValue>
              <KeyValue label="Cohort">{cohortCode(open.cohortId)}</KeyValue>
              <KeyValue label="Captured">{formatDateTime(open.capturedAt)}</KeyValue>
              <KeyValue label="Captured by">{userName(open.capturedByUserId)}</KeyValue>
              <KeyValue label="Channel">{CHANNEL_LABEL[open.channel]}</KeyValue>
              <KeyValue label="Status">
                <Badge tone={TESTIMONIAL_STATUS_TONE[open.status]} size="sm">
                  {TESTIMONIAL_STATUS_LABEL[open.status]}
                </Badge>
              </KeyValue>
              <KeyValue label="Consent">
                <Badge tone={open.consentGranted ? 'success' : 'danger'} size="sm">
                  {open.consentGranted ? 'Granted' : 'Not granted'}
                </Badge>
              </KeyValue>
              <KeyValue label="Consent captured">
                {open.consentCapturedAt ? formatDateTime(open.consentCapturedAt) : 'Not captured'}
              </KeyValue>
            </KeyValueList>

            <div>
              <h3 className="mb-3 text-heading-18">Media</h3>
              {open.mediaUrls.length === 0 ? (
                <p className="text-body-13 text-text-secondary">
                  Text only. A quote with a face beside it carries further, but only where the person
                  has agreed to both.
                </p>
              ) : (
                <ul className="space-y-2">
                  {open.mediaUrls.map((url) => (
                    <li
                      key={url}
                      className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5"
                    >
                      {isVideo(url) ? (
                        <Video size={16} aria-hidden="true" />
                      ) : (
                        <Image size={16} aria-hidden="true" />
                      )}
                      <span className="font-mono text-body-12 text-text-secondary">{url}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="mb-3 text-heading-18">Where it has been used</h3>
              {open.usage.length === 0 ? (
                <p className="text-body-13 text-text-secondary">
                  Not published anywhere yet.{' '}
                  {open.consentGranted
                    ? 'Consent is on file, so it is cleared for use.'
                    : 'It cannot be, without consent.'}
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-xl border border-border">
                  {open.usage.map((use) => (
                    <li key={`${use.where}-${use.publishedAt}`} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <span className="text-body-13 text-text">{use.where}</span>
                      <span className="text-body-12 text-text-secondary">{formatDate(use.publishedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {open.tags.length > 0 && (
              <div>
                <h3 className="mb-3 text-heading-18">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {open.tags.map((tag) => (
                    <Badge key={tag} tone="neutral" variant="outline" size="sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="text-body-12 text-text-secondary">
              {formatNumber(open.usage.length)} recorded {open.usage.length === 1 ? 'use' : 'uses'} of
              this quote.
            </p>
          </div>
        )}
      </Drawer>

      <NewTestimonialModal
        open={capturing}
        onClose={() => setCapturing(false)}
        onCaptured={(message) => {
          setCapturing(false)
          setNotice(message)
        }}
      />
    </>
  )
}

function NewTestimonialModal({
  open,
  onClose,
  onCaptured,
}: {
  open: boolean
  onClose: () => void
  onCaptured: (message: string) => void
}) {
  const people = useCollection(peopleCollection)
  const courses = useCollection(coursesCollection)
  const cohorts = useCollection(cohortsCollection)
  const personName = usePersonName()

  const [personId, setPersonId] = useState('')
  const [courseId, setCourseId] = useState('')
  const [cohortId, setCohortId] = useState('')
  const [outcome, setOutcome] = useState('')
  const [quote, setQuote] = useState('')
  const [channel, setChannel] = useState<Channel>('whatsapp')
  const [tags, setTags] = useState('')
  const [consent, setConsent] = useState(false)
  const [touched, setTouched] = useState(false)

  const cohortsForCourse = courseId ? cohorts.filter((c) => (c.courseId as string) === courseId) : cohorts

  const personError = touched && !personId ? 'A quote belongs to a named person.' : undefined
  const courseError = touched && !courseId ? 'The course this is about.' : undefined
  const cohortError = touched && !cohortId ? 'The cohort they were in.' : undefined
  const quoteError = touched && quote.trim().length < 15 ? 'Record what they actually said, in their words.' : undefined
  const outcomeError = touched && !outcome.trim() ? 'One line on what happened for them.' : undefined

  const submit = () => {
    setTouched(true)
    if (!personId || !courseId || !cohortId || quote.trim().length < 15 || !outcome.trim()) return
    createTestimonial({
      personId: personId as PersonId,
      courseId: courseId as CourseId,
      cohortId: cohortId as CohortId,
      outcome,
      quote,
      channel,
      consentGranted: consent,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    })
    onCaptured(
      consent
        ? `${personName(personId)}'s testimonial captured with consent. It can be approved and published.`
        : `${personName(personId)}'s testimonial captured without consent. It is on the list but may not be published.`,
    )
    setPersonId('')
    setQuote('')
    setOutcome('')
    setTags('')
    setConsent(false)
    setTouched(false)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Add a testimonial"
      description="What somebody said about the course, in their words, with their permission recorded alongside it."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit}>Save testimonial</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Person" required error={personError}>
          <Select
            value={personId}
            placeholder="Choose a person"
            options={people
              .slice(0, 300)
              .map((p) => ({ value: p.id as string, label: `${p.firstName} ${p.lastName}` }))}
            onChange={(e) => setPersonId(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course" required error={courseError}>
            <Select
              value={courseId}
              placeholder="Choose a course"
              options={courses.map((c) => ({ value: c.id as string, label: c.title }))}
              onChange={(e) => {
                setCourseId(e.target.value)
                setCohortId('')
              }}
            />
          </Field>

          <Field label="Cohort" required error={cohortError}>
            <Select
              value={cohortId}
              placeholder={courseId ? 'Choose a cohort' : 'Choose a course first'}
              disabled={!courseId}
              options={cohortsForCourse.map((c) => ({ value: c.id as string, label: c.code }))}
              onChange={(e) => setCohortId(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Outcome"
          required
          error={outcomeError}
          hint="What changed for them. Searchable, alongside the course."
        >
          <Input
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            invalid={Boolean(outcomeError)}
            placeholder="Hired as a junior data analyst three weeks after finishing"
          />
        </Field>

        <Field label="Quote" required error={quoteError}>
          <Textarea
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            rows={4}
            maxLength={600}
            showCount
            invalid={Boolean(quoteError)}
            placeholder="The Saturday classes meant I could keep working while I retrained. My tutor called me the week I finished to check how the interviews were going."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Captured over" required>
            <Select
              value={channel}
              options={(['whatsapp', 'email', 'sms', 'in_app'] as const).map((c) => ({
                value: c,
                label: CHANNEL_LABEL[c],
              }))}
              onChange={(e) => setChannel(e.target.value as Channel)}
            />
          </Field>

          <Field label="Tags" optional hint="Comma separated. Used to find a quote that fits a given story.">
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="career change, weekend cohort, parent"
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border p-4">
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            label="They agreed this may be used publicly"
            description="Recorded with today's date and the channel it was given on. Without it the quote is kept but can never be published — approving it later will not unlock it."
          />
        </div>
      </div>
    </Modal>
  )
}
