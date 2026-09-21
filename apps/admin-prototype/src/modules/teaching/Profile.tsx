import { useEffect, useState } from 'react'
import { Mail, MapPin, Phone, ShieldCheck, User } from 'lucide-react'

import { formatDate } from '@/lib/format'
import { Alert, Avatar, Badge, Button, Field, Input, KeyValue, KeyValueList, PageHeader } from '@/ui'
import { useCurrentUserId, useSession } from '@/auth'
import {
  branchesCollection,
  peopleCollection,
  useCollection,
  type PersonId,
} from '@/mocks'

import { Page, TeachingCard, cohortIdsOf, useTutorScope } from './shared'
import { updateTutorProfile } from './writes'

export default function Profile() {
  const session = useSession()
  const actorUserId = useCurrentUserId()
  const scope = useTutorScope()

  const people = useCollection(peopleCollection)
  const branches = useCollection(branchesCollection)

  const personId = (session?.personId ?? scope.tutorPersonId) as PersonId | undefined
  const person = personId ? people.find((p) => p.id === personId) : undefined
  const branch = person?.primaryBranchId ? branches.find((b) => b.id === person.primaryBranchId) : undefined

  const [preferredName, setPreferredName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    if (!person) return
    setPreferredName(person.preferredName ?? '')
    setEmail(person.email ?? '')
    setPhone(person.phone ?? '')
    setCity(person.city)
  }, [person])

  if (!person || !personId) {
    return (
      <Page>
        <PageHeader title="Settings" description="Your profile." />
        <Alert tone="warning" title="No profile is attached to this session">
          Sign in as a member of staff to see a profile here.
        </Alert>
      </Page>
    )
  }

  const dirty =
    preferredName !== (person.preferredName ?? '') ||
    email !== (person.email ?? '') ||
    phone !== (person.phone ?? '') ||
    city !== person.city

  function save() {
    setFailure(null)
    try {
      updateTutorProfile({ personId: personId!, preferredName, email, phone, city, actorUserId })
      setNotice('Your profile was updated. The change is in the audit log.')
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'The profile was not saved.')
    }
  }

  return (
    <Page>
      <PageHeader title="Settings" description="Your profile. Everything else about your account is managed by HR." />

      {notice && (
        <Alert tone="success" title="Saved" className="mb-6" onDismiss={() => setNotice(null)}>
          {notice}
        </Alert>
      )}
      {failure && (
        <Alert tone="danger" title="Not saved" className="mb-6" onDismiss={() => setFailure(null)}>
          {failure}
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <TeachingCard
          title="Profile"
          description="How your name and contact details appear to students and to operations"
          padding="default"
          action={
            <Button size="sm" onClick={save} disabled={!dirty}>
              Save changes
            </Button>
          }
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={`${person.firstName} ${person.lastName}`} size="lg" />
              <div className="min-w-0">
                <p className="text-body-15 font-bold text-text">
                  {person.firstName} {person.lastName}
                </p>
                <p className="text-body-13 text-text-secondary">
                  {session?.persona.label ?? 'Tutor'} · {branch?.name ?? 'No branch'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Preferred name" optional hint="What students are told to call you." id="pf-name">
                <Input
                  id="pf-name"
                  value={preferredName}
                  leftIcon={<User size={14} />}
                  onChange={(e) => setPreferredName(e.target.value)}
                  placeholder={person.firstName}
                />
              </Field>
              <Field label="Email" id="pf-email">
                <Input
                  id="pf-email"
                  type="email"
                  value={email}
                  leftIcon={<Mail size={14} />}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Phone" id="pf-phone">
                <Input
                  id="pf-phone"
                  value={phone}
                  leftIcon={<Phone size={14} />}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field label="City" id="pf-city">
                <Input
                  id="pf-city"
                  value={city}
                  leftIcon={<MapPin size={14} />}
                  onChange={(e) => setCity(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </TeachingCard>

        <TeachingCard
          title="Your teaching record"
          description="Held by Academy operations — read-only here"
          padding="default"
        >
          <KeyValueList columns={2}>
            <KeyValue label="Active cohorts">{cohortIdsOf(scope).length}</KeyValue>
            <KeyValue label="Sessions delivered">
              {scope.assignments.reduce((acc, a) => acc + a.sessionsDelivered, 0)}
            </KeyValue>
            <KeyValue label="Teaching since">
              {scope.assignments.length
                ? formatDate(
                    scope.assignments.map((a) => a.startDate).sort((a, b) => a.localeCompare(b))[0],
                  )
                : '—'}
            </KeyValue>
            <KeyValue label="Primary branch">{branch?.name ?? '—'}</KeyValue>
          </KeyValueList>
          <p className="mt-3 text-body-12 text-text-muted">
            An assignment that has ended stays on your record with the sessions you delivered against
            it. It is never overwritten when someone takes over a cohort.
          </p>
        </TeachingCard>

        <TeachingCard title="What this role can reach" description="Set by your role, not by you" padding="default">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" variant="subtle" icon={<ShieldCheck size={12} />}>
              Your assigned cohorts
            </Badge>
            <Badge tone="success" variant="subtle" icon={<ShieldCheck size={12} />}>
              Rosters, registers and grades
            </Badge>
            <Badge tone="success" variant="subtle" icon={<ShieldCheck size={12} />}>
              Course materials
            </Badge>
            <Badge tone="neutral" variant="outline">
              No student fees or balances
            </Badge>
            <Badge tone="neutral" variant="outline">
              No cohorts you are not assigned to
            </Badge>
          </div>
          <p className="mt-3 text-body-12 text-text-muted">
            A tutor deliberately cannot see who owes money. Attendance you record never changes what a
            student is charged.
          </p>
        </TeachingCard>
      </div>
    </Page>
  )
}
