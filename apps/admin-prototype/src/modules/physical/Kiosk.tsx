import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  MapPin,
  ScanLine,
  ShieldAlert,
  Star,
  UserPlus,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/cn'
import { humanize } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
} from '@/ui'
import {
  branchesCollection,
  coursesCollection,
  peopleCollection,
  useCollection,
  type BranchId,
  type CourseId,
  type Mode,
  type PersonId,
} from '@/mocks'

import {
  createKioskEnquiry,
  findPersonByContact,
  recordKioskTap,
  signInVisitor,
  type KioskTapResult,
} from './writes'

type Tile = 'enquiry' | 'check_in' | 'visitor' | 'review'

const TILES: Array<{ id: Tile; label: string; blurb: string; icon: LucideIcon }> = [
  {
    id: 'enquiry',
    label: 'New enquiry',
    blurb: 'Ask about a course. Somebody calls you back today.',
    icon: ClipboardList,
  },
  { id: 'check_in', label: 'Student check-in', blurb: 'Tap your card or type the number on it.', icon: ScanLine },
  { id: 'visitor', label: 'Visitor sign-in', blurb: 'Here to see someone? Sign in here.', icon: Users },
  { id: 'review', label: 'Leave a review', blurb: 'Tell people how it went, if you would like to.', icon: Star },
]

const WAYFINDING = [
  { where: 'Reception and enquiries', detail: 'Ground floor, straight ahead' },
  { where: 'Classrooms 1 to 4', detail: 'First floor, left at the stairs' },
  { where: 'Computer lab', detail: 'First floor, end of the corridor' },
  { where: 'Payments and accounts', detail: 'Ground floor, first door on the right' },
  { where: 'Prayer room and rest area', detail: 'Ground floor, past reception' },
]

export default function PhysicalKiosk() {
  const [tile, setTile] = useState<Tile | null>(null)

  return (
    <div className="min-h-full bg-canvas">
      <div className="mx-auto w-full max-w-4xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-label-11 text-text-label">Cirvee Academy · Bodija</p>
            <h1 className="mt-1 text-heading-28 text-text">
              {tile ? TILES.find((t) => t.id === tile)?.label : 'Welcome'}
            </h1>
          </div>
          {tile ? (
            <Button variant="secondary" leftIcon={<ArrowLeft size={18} aria-hidden="true" />} onClick={() => setTile(null)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/physical">Leave kiosk mode</Link>
            </Button>
          )}
        </header>

        {tile === null && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              {TILES.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTile(item.id)}
                    className={cn(
                      'flex min-h-[160px] flex-col items-start gap-3 rounded-2xl border border-border bg-surface p-6 text-left',
                      'transition-colors hover:border-accent hover:bg-accent-wash',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
                    )}
                  >
                    <span className="rounded-xl bg-accent-wash p-3 text-accent">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <span className="text-heading-20 text-text">{item.label}</span>
                    <span className="text-body-14 text-text-secondary">{item.blurb}</span>
                  </button>
                )
              })}
            </div>

            <Card className="mt-6">
              <CardHeader title="Finding your way" />
              <CardBody>
                <ul className="divide-y divide-border">
                  {WAYFINDING.map((item) => (
                    <li key={item.where} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <MapPin size={16} aria-hidden="true" className="shrink-0 text-text-muted" />
                      <span className="text-body-15 text-text">{item.where}</span>
                      <span className="ml-auto text-body-14 text-text-secondary">{item.detail}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          </>
        )}

        {tile === 'enquiry' && <EnquiryForm onDone={() => setTile(null)} />}
        {tile === 'check_in' && <CheckIn />}
        {tile === 'visitor' && <VisitorSignIn onDone={() => setTile(null)} />}
        {tile === 'review' && <LeaveAReview />}
      </div>
    </div>
  )
}

function EnquiryForm({ onDone }: { onDone: () => void }) {
  const courses = useCollection(coursesCollection)
  const branches = useCollection(branchesCollection)
  const people = useCollection(peopleCollection)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [courseId, setCourseId] = useState('')
  const [mode, setMode] = useState<Mode>('on_campus')
  const [branchId, setBranchId] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [done, setDone] = useState<{ ref: string; owner: string; matched: boolean } | null>(null)

  const effectiveBranchId = branchId || ((branches[0]?.id as string) ?? '')

  const match = useMemo(() => findPersonByContact(phone, email), [phone, email, people])

  const firstError = touched && !firstName.trim() ? 'We need a name to call you back.' : undefined
  const lastError = touched && !lastName.trim() ? 'And a surname.' : undefined
  const phoneError =
    touched && phone.replace(/\D/g, '').length < 10 ? 'A phone number we can reach you on.' : undefined

  const submit = () => {
    setTouched(true)
    if (!firstName.trim() || !lastName.trim() || phone.replace(/\D/g, '').length < 10) return
    const result = createKioskEnquiry({
      firstName,
      lastName,
      phone,
      email,
      courseInterestId: courseId ? (courseId as CourseId) : null,
      mode,
      branchId: effectiveBranchId as BranchId,
      note,
    })
    setDone({
      ref: result.lead.ref,
      owner: result.routingRule,
      matched: result.matchedExistingPerson,
    })
  }

  if (done) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} aria-hidden="true" className="mt-0.5 shrink-0 text-success-text" />
            <div>
              <h2 className="text-heading-24 text-text">Thank you. Someone will call you today.</h2>
              <p className="mt-2 text-body-15 text-text-secondary">
                Your enquiry is reference {done.ref}. If you do not hear from anyone by the end of the day,
                come back to reception and quote that number.
              </p>
            </div>
          </div>

          <Alert tone="info" title="What just happened, for the demo">
            A real <code className="font-mono">Lead</code> was written to the CRM pipeline with source
            &ldquo;walk-in kiosk&rdquo;, which is locked and can never be rewritten.{' '}
            {done.matched
              ? 'The phone or email matched somebody already on file, so their existing person record was reused rather than duplicated.'
              : 'A new person record was created with a data-processing consent captured at the kiosk.'}{' '}
            {done.owner}.
          </Alert>

          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/crm/leads">See it in the pipeline</Link>
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDone(null)
                setFirstName('')
                setLastName('')
                setPhone('')
                setEmail('')
                setNote('')
                setTouched(false)
              }}
            >
              Take another enquiry
            </Button>
            <Button variant="ghost" onClick={onDone}>
              Back to the kiosk
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Tell us how to reach you"
        description="Five things. Somebody calls you back the same day."
      />
      <CardBody className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required error={firstError}>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              invalid={Boolean(firstError)}
              inputSize="lg"
              autoComplete="given-name"
            />
          </Field>
          <Field label="Surname" required error={lastError}>
            <Input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              invalid={Boolean(lastError)}
              inputSize="lg"
              autoComplete="family-name"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone" required error={phoneError} hint="We will call or send a WhatsApp message.">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              invalid={Boolean(phoneError)}
              inputSize="lg"
              type="tel"
              placeholder="0803 000 0000"
            />
          </Field>
          <Field label="Email" optional>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputSize="lg"
              type="email"
              placeholder="you@example.ng"
            />
          </Field>
        </div>

        {match && (
          <Alert tone="info" title="We think we already have you on file">
            {match.firstName} {match.lastName} matches this phone or email. Your enquiry will be added to
            that existing record rather than creating a second one.
          </Alert>
        )}

        <Field label="Course you are asking about" optional>
          <Select
            value={courseId}
            placeholder="Not sure yet"
            selectSize="lg"
            options={courses.map((c) => ({ value: c.id as string, label: c.title }))}
            onChange={(e) => setCourseId(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How you would like to study" required>
            <Select
              value={mode}
              selectSize="lg"
              options={[
                { value: 'on_campus', label: 'On campus' },
                { value: 'virtual', label: 'Online' },
                { value: 'hybrid', label: 'A mix of both' },
              ]}
              onChange={(e) => setMode(e.target.value as Mode)}
            />
          </Field>
          <Field label="Campus" required>
            <Select
              value={effectiveBranchId}
              selectSize="lg"
              options={branches.map((b) => ({ value: b.id as string, label: b.name }))}
              onChange={(e) => setBranchId(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Anything else" optional>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={300}
            showCount
            placeholder="I work weekdays, so I am asking about the Saturday cohort."
          />
        </Field>

        <Button size="lg" onClick={submit}>
          Send my enquiry
        </Button>
      </CardBody>
    </Card>
  )
}

function CheckIn() {
  const [cardRef, setCardRef] = useState('')
  const [result, setResult] = useState<KioskTapResult | null>(null)

  const submit = () => {
    if (!cardRef.trim()) return
    setResult(recordKioskTap(cardRef, null))
    setCardRef('')
  }

  return (
    <Card>
      <CardHeader
        title="Tap your card, or type the number on it"
        description="There is no reader attached to this browser, so typing the card number stands in for the tap."
      />
      <CardBody className="space-y-4">
        <Field label="Card number or UID" required>
          <Input
            value={cardRef}
            onChange={(e) => setCardRef(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
            inputSize="lg"
            className="font-mono"
            placeholder="CRD-0001"
          />
        </Field>
        <Button size="lg" onClick={submit}>
          Check in
        </Button>

        {result && (
          <Alert
            tone={result.result === 'granted' ? 'success' : 'warning'}
            icon={result.result === 'granted' ? CheckCircle2 : ShieldAlert}
            title={result.result === 'granted' ? 'Checked in' : 'Please see the desk'}
          >
            {result.message}
            {result.decision && result.decision.notes.length > 0 && (
              <ul className="mt-2 list-disc pl-5">
                {result.decision.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}
          </Alert>
        )}

        {result?.card && (
          <p className="text-body-13 text-text-secondary">
            The tap was written to the tap log against{' '}
            <span className="font-mono">{result.card.cardId}</span> with result{' '}
            <Badge tone={result.result === 'granted' ? 'success' : 'danger'} size="sm">
              {humanize(result.result)}
            </Badge>
            . Access was decided from the holder&apos;s live status, not from a stored access flag.
          </p>
        )}
      </CardBody>
    </Card>
  )
}

function VisitorSignIn({ onDone }: { onDone: () => void }) {
  const people = useCollection(peopleCollection)
  const branches = useCollection(branchesCollection)

  const [name, setName] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [hostPersonId, setHostPersonId] = useState('')
  const [purpose, setPurpose] = useState('')
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)
  const [badge, setBadge] = useState<string | null>(null)

  const nameError = touched && !name.trim() ? 'Your name, for the badge.' : undefined
  const hostError = touched && !hostPersonId ? 'Who are you here to see?' : undefined
  const purposeError = touched && !purpose.trim() ? 'One line is enough.' : undefined

  const submit = () => {
    setTouched(true)
    if (!name.trim() || !hostPersonId || !purpose.trim()) return
    const visitor = signInVisitor({
      name,
      organisation,
      hostPersonId: hostPersonId as PersonId,
      purpose,
      phone,
      branchId: ((branches[0]?.id as string) ?? '') as BranchId,
    })
    setBadge(visitor.badgeNumber)
  }

  if (badge) {
    return (
      <Card>
        <CardBody className="space-y-4">
          <h2 className="text-heading-24 text-text">You are signed in. Badge {badge}.</h2>
          <p className="text-body-15 text-text-secondary">
            Please collect the badge from reception and sign out on your way past this screen.
          </p>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to="/physical/visitors">See the visitor log</Link>
            </Button>
            <Button variant="ghost" onClick={onDone}>
              Back to the kiosk
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader title="Who are you here to see?" />
      <CardBody className="space-y-4">
        <Field label="Your name" required error={nameError}>
          <Input value={name} onChange={(e) => setName(e.target.value)} invalid={Boolean(nameError)} inputSize="lg" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organisation" optional>
            <Input
              value={organisation}
              onChange={(e) => setOrganisation(e.target.value)}
              inputSize="lg"
              placeholder="Interswitch"
            />
          </Field>
          <Field label="Phone" optional>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputSize="lg" type="tel" />
          </Field>
        </div>
        <Field label="Host" required error={hostError}>
          <Select
            value={hostPersonId}
            placeholder="Choose who you are visiting"
            selectSize="lg"
            options={people
              .slice(0, 120)
              .map((p) => ({ value: p.id as string, label: `${p.firstName} ${p.lastName}` }))}
            onChange={(e) => setHostPersonId(e.target.value)}
          />
        </Field>
        <Field label="Reason for the visit" required error={purposeError}>
          <Input
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            invalid={Boolean(purposeError)}
            inputSize="lg"
            placeholder="Corporate training discussion"
          />
        </Field>
        <Button size="lg" leftIcon={<UserPlus size={18} aria-hidden="true" />} onClick={submit}>
          Sign in
        </Button>
      </CardBody>
    </Card>
  )
}

function LeaveAReview() {
  return (
    <Card>
      <CardHeader
        title="If today went well, tell people"
        description="It takes about a minute and it helps the next person deciding whether to walk in."
      />
      <CardBody className="space-y-4">
        <p className="text-body-15 text-text-secondary">
          Scan the code at reception, or ask at the desk and somebody will send you the link on WhatsApp.
          Write whatever you actually think — a fair review is worth more to us than a good one.
        </p>
        <Alert tone="info" title="Nothing is offered in return">
          We never give a discount, a reward or anything else in exchange for a review. It would breach
          Google&apos;s policy and put the listing at risk, and it would make every review here worth less.
        </Alert>
      </CardBody>
    </Card>
  )
}
