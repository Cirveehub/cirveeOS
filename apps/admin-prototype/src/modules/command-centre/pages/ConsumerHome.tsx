import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  Award,
  Baby,
  Banknote,
  Building2,
  CalendarCheck,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  MessageSquare,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { useSession } from '@/auth'
import {
  certificatesCollection,
  enrollmentsCollection,
  invoicesCollection,
  peopleCollection,
  relationshipsCollection,
  studentAttendanceCollection,
  coursesCollection,
  cohortsCollection,
  clientOrgsCollection,
  outcomeRecordsCollection,
  classSessionsCollection,
  TODAY,
  type PersonId,
} from '@/mocks'
import { formatDate, formatNaira, initials } from '@/lib/format'
import {
  Alert,
  Card,
  CardHeader,
  EmptyState,
  MoneyCell,
  PageHeader,
  ProgressBar,
  SkeletonCard,
  StatusBadge,
} from '@/ui'

import { useScreenState } from '../lib/screen-state'

export default function ConsumerHome() {
  const session = useSession()
  const { status } = useScreenState('home-consumer')
  const personId = session?.personId

  if (status === 'loading') {
    return (
      <div className="max-w-[820px] space-y-4 px-8 py-6">
        <SkeletonCard variant="stat" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!personId) {
    return (
      <div className="max-w-[600px] px-8 py-20">
        <EmptyState
          icon={AlertTriangle}
          title="No record found for this sign-in"
          message="This persona has no seeded person behind it yet."
        />
      </div>
    )
  }

  const roleId = session.persona.id

  return (
    <div className="max-w-[820px] px-8 py-6">
      <PageHeader
        title={`Welcome, ${session.displayName.split(' ')[0]}`}
        description={consumerDescription(roleId)}
      />

      <div className="mt-6">
        {roleId === 'student' && <StudentBody personId={personId} />}
        {roleId === 'parent' && <ParentBody guardianPersonId={personId} />}
        {roleId === 'corporate-client' && <CorporateClientBody contactPersonId={personId} />}
        {roleId === 'sponsor' && <SponsorBody sponsorPersonId={personId} />}
      </div>
    </div>
  )
}

function consumerDescription(roleId: string): string {
  switch (roleId) {
    case 'student':
      return 'Your course, your grades, your balance.'
    case 'parent':
      return "Your child's attendance and progress this week."
    case 'corporate-client':
      return "Your organisation's participants, attendance and results."
    case 'sponsor':
      return 'Your funded programme and the people it reached.'
    default:
      return ''
  }
}

function StudentBody({ personId }: { personId: PersonId }) {
  const enrolments = enrollmentsCollection.where(
    (e) => e.personId === personId && e.status !== 'withdrawn',
  )
  const active = enrolments.find((e) => e.status === 'active') ?? enrolments[0]
  const course = active ? coursesCollection.find(active.courseId) : undefined
  const cohort = active ? cohortsCollection.find(active.cohortId) : undefined

  const invoices = invoicesCollection.where((i) => i.personId === personId)
  const balanceDue = invoices.reduce((sum, i) => sum + i.balance, 0)
  const overdue = invoices.some((i) => i.status === 'overdue')

  const attendance = active
    ? studentAttendanceCollection.where((a) => a.enrollmentId === active.id)
    : []
  const present = attendance.filter((a) => a.state === 'present').length
  const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null

  const nextSession = active
    ? classSessionsCollection
        .where((s) => s.cohortId === active.cohortId && s.date >= TODAY)
        .sort((a, b) => a.date.localeCompare(b.date))[0]
    : undefined

  const certs = certificatesCollection.where((c) => c.personId === personId && c.status === 'issued')

  if (!active) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="No active enrolment"
        message="You don't have a course in progress right now."
      />
    )
  }

  return (
    <div className="space-y-4">
      {overdue && (
        <Alert tone="warning" title="A payment on your account is overdue">
          Reach out to Finance if you think this is wrong, or make a payment to clear it.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={course?.title ?? 'Your course'}
          description={cohort ? `Cohort ${cohort.code}` : undefined}
          actions={<StatusBadge status={active.status} />}
        />
        <div className="grid grid-cols-2 gap-4 border-t border-border px-6 py-5 sm:grid-cols-3">
          <Fact label="Attendance" value={attendanceRate === null ? '—' : `${attendanceRate}%`} />
          <Fact
            label="Balance"
            value={formatNaira(balanceDue)}
            tone={balanceDue > 0 ? 'warning' : 'success'}
          />
          <Fact
            label="Next class"
            value={nextSession ? formatDate(nextSession.date) : 'None scheduled'}
          />
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Certificates" />
          <div className="px-6 pb-5">
            {certs.length === 0 ? (
              <p className="text-body-13 text-text-secondary">
                Issued once your course, attendance and balance are all clear.
              </p>
            ) : (
              <ul className="space-y-2">
                {certs.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-body-13">
                    <Award size={15} className="shrink-0 text-success-text" />
                    <span className="min-w-0 truncate">{c.certificateId}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Need something?" />
          <div className="space-y-2 px-6 pb-5">
            <QuickLink to="/learn/student" label="Open my course" icon={GraduationCap} />
            <QuickLink
              label="Message my tutor"
              icon={MessageSquare}
              notBuilt="messaging needs a backend to deliver anything, and there is none here."
            />
            <QuickLink
              label="View my invoices"
              icon={Banknote}
              notBuilt="there is no learner-facing billing screen yet. Your balance above is the live figure."
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

function ParentBody({ guardianPersonId }: { guardianPersonId: PersonId }) {
  const guardianRel = relationshipsCollection
    .all()
    .find((r) => r.personId === guardianPersonId && r.type === 'parent_guardian')
  const childId = guardianRel?.linkedPersonId
  const child = childId ? peopleCollection.find(childId) : undefined

  if (!child || !childId) {
    return (
      <EmptyState
        icon={Baby}
        title="No child linked to this account"
        message="A guardian relationship exists but doesn't name a child in the seed."
      />
    )
  }

  const enrolments = enrollmentsCollection.where(
    (e) => e.personId === childId && e.status !== 'withdrawn',
  )
  const active = enrolments.find((e) => e.status === 'active') ?? enrolments[0]
  const course = active ? coursesCollection.find(active.courseId) : undefined

  const attendance = active
    ? studentAttendanceCollection.where((a) => a.enrollmentId === active.id)
    : []
  const recent = [...attendance].sort((a, b) => b.tappedAt?.localeCompare(a.tappedAt ?? '') ?? 0).slice(0, 5)
  const lastTap = recent[0]
  const missedLastSession = lastTap?.state === 'absent'

  const invoices = invoicesCollection.where((i) => i.personId === guardianPersonId || i.personId === childId)
  const balanceDue = invoices.reduce((sum, i) => sum + i.balance, 0)

  return (
    <div className="space-y-4">
      {missedLastSession && (
        <Alert tone="warning" title={`${child.firstName} did not tap in for the last session`}>
          If this was expected — illness, a planned absence — no action is needed. Otherwise, worth a
          quick check with the Teens coordinator.
        </Alert>
      )}

      <Card>
        <CardHeader
          title={`${child.firstName} ${child.lastName}`}
          description={course ? course.title : 'No active course'}
          actions={
            <span className="grid size-9 place-items-center rounded-full bg-accent-subtle text-body-13 font-bold text-accent">
              {initials(`${child.firstName} ${child.lastName}`)}
            </span>
          }
        />
        <div className="border-t border-border px-6 py-5">
          <p className="mb-2 text-label-11 text-text-muted">Recent attendance</p>
          {recent.length === 0 ? (
            <p className="text-body-13 text-text-secondary">No sessions recorded yet.</p>
          ) : (
            <div className="flex gap-1.5">
              {recent.map((a) => (
                <span
                  key={a.id}
                  title={`${a.tappedAt ? formatDate(a.tappedAt) : ''} — ${a.state}`}
                  className={
                    'grid size-8 place-items-center rounded-lg text-body-12 font-bold ' +
                    (a.state === 'present'
                      ? 'bg-success-fill text-success-ink'
                      : a.state === 'absent'
                        ? 'bg-danger-fill text-danger-ink'
                        : 'bg-surface-sunken text-text-secondary')
                  }
                >
                  {a.state === 'present' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="Balance" />
          <div className="px-6 pb-5">
            <MoneyCell kobo={balanceDue} className="text-display-32" />
            <p className="mt-1 text-body-13 text-text-secondary">
              {balanceDue > 0 ? 'Outstanding on your account' : 'Nothing outstanding'}
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="This week" />
          <div className="space-y-2 px-6 pb-5">
            <QuickLink
              label="Message the coordinator"
              icon={MessageSquare}
              notBuilt="messaging needs a backend to deliver anything, and there is none here."
            />
            <QuickLink
              label="View project showcase"
              icon={CalendarCheck}
              notBuilt="nothing in the data layer models a showcase of a child's work yet."
            />
          </div>
        </Card>
      </div>
    </div>
  )
}

function CorporateClientBody({ contactPersonId }: { contactPersonId: PersonId }) {
  const rel = relationshipsCollection
    .all()
    .find((r) => r.personId === contactPersonId && r.type === 'corporate_contact')
  const orgId = rel?.relatedRecordId
  const org = orgId
    ? clientOrgsCollection.find(orgId as Parameters<typeof clientOrgsCollection.find>[0])
    : undefined

  const contacts = org
    ? org.contactPersonIds.map((id) => peopleCollection.find(id)).filter((p) => p !== undefined)
    : []
  const invoices = org ? invoicesCollection.where((i) => i.organisationId === org.id) : []
  const balanceDue = org ? org.outstandingBalance : invoices.reduce((sum, i) => sum + i.balance, 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={org?.name ?? 'Your organisation'}
          description={org ? `${org.participantsTrained} staff trained to date` : undefined}
          actions={<Building2 size={20} className="text-text-muted" />}
        />
        <div className="grid grid-cols-2 gap-4 border-t border-border px-6 py-5 sm:grid-cols-3">
          <Fact label="Staff trained" value={String(org?.participantsTrained ?? 0)} />
          <Fact
            label="Lifetime spend"
            value={formatNaira(org?.lifetimeRevenue ?? 0, { compact: true })}
          />
          <Fact
            label="Balance"
            value={formatNaira(balanceDue)}
            tone={balanceDue > 0 ? 'warning' : 'success'}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Recent invoices" />
        {invoices.length === 0 ? (
          <div className="px-6 pb-5">
            <EmptyState size="sm" title="No invoices on your account" />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {invoices.slice(0, 6).map((i) => (
              <li key={i.id} className="flex items-center justify-between px-6 py-3">
                <span className="font-mono text-body-13 text-text-secondary">{i.ref}</span>
                <span className="text-body-13">{formatNaira(i.total)}</span>
                <StatusBadge status={i.status} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {contacts.length > 0 && (
        <Card>
          <CardHeader title="Registered contacts" />
          <ul className="divide-y divide-border">
            {contacts.map((p) => (
              <li key={p!.id} className="flex items-center gap-2 px-6 py-3 text-body-13">
                <Users size={14} className="text-text-muted" />
                {p!.firstName} {p!.lastName}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

const PLACED_OUTCOMES = new Set(['full_time', 'contract', 'freelance', 'self_employed'])

function SponsorBody({ sponsorPersonId }: { sponsorPersonId: PersonId }) {
  const rel = relationshipsCollection
    .all()
    .find((r) => r.personId === sponsorPersonId && r.type === 'sponsor')
  const unitId = rel?.unitId

  const outcomes = unitId
    ? outcomeRecordsCollection.where((o) => {
        const course = coursesCollection.find(o.courseId)
        return course?.unitId === unitId
      })
    : []
  const placed = outcomes.filter((o) => PLACED_OUTCOMES.has(o.outcomeType)).length

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Your funded programme"
          description={`${outcomes.length} beneficiary outcome${outcomes.length === 1 ? '' : 's'} tracked`}
          actions={<HeartHandshake size={20} className="text-text-muted" />}
        />
        <div className="grid grid-cols-2 gap-4 border-t border-border px-6 py-5 sm:grid-cols-3">
          <Fact label="Beneficiaries" value={String(outcomes.length)} />
          <Fact label="Placed" value={String(placed)} />
          <Fact
            label="Placement rate"
            value={outcomes.length ? `${Math.round((placed / outcomes.length) * 100)}%` : '—'}
          />
        </div>
      </Card>

      {outcomes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No outcomes recorded yet"
          message="Outcome tracking begins once a beneficiary is certified."
        />
      ) : (
        <Card>
          <CardHeader title="Beneficiary outcomes" />
          <div className="space-y-3 px-6 pb-5">
            {outcomes.slice(0, 5).map((o) => (
              <ProgressBar
                key={o.id}
                label={o.outcomeType.replace('_', ' ')}
                value={PLACED_OUTCOMES.has(o.outcomeType) ? 100 : 40}
                tone={PLACED_OUTCOMES.has(o.outcomeType) ? 'success' : 'neutral'}
              />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Fact({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'warning'
}) {
  return (
    <div>
      <p className="text-label-10 text-text-muted">{label}</p>
      <p
        className={
          'mt-1 text-body-15 font-bold ' +
          (tone === 'warning' ? 'text-warning-text' : tone === 'success' ? 'text-success-text' : 'text-text')
        }
      >
        {value}
      </p>
    </div>
  )
}

function QuickLink({
  to,
  label,
  icon: Icon,
  notBuilt,
}: {
  to?: string
  label: string
  icon: LucideIcon
  notBuilt?: string
}) {
  if (!to) {
    return (
      <button
        onClick={() => toast(`Not built in this prototype — ${notBuilt}`)}
        className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-body-13 text-text-secondary transition-colors hover:bg-surface-hover"
      >
        <Icon size={14} className="shrink-0 text-text-muted" aria-hidden="true" />
        {label}
      </button>
    )
  }
  return (
    <Link
      to={to}
      className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2 text-body-13 font-medium text-accent transition-colors hover:bg-accent-wash"
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      {label}
    </Link>
  )
}
