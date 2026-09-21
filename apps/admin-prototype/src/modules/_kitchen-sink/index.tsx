import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Filter,
  GraduationCap,
  Mail,
  MoreHorizontal,
  Palette,
  Pencil,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  SearchX,
  Send,
  Trash2,
  TrendingDown,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'

import { defineModule, type BusinessUnit } from '@/app/module-registry'
import { cn } from '@/lib/cn'
import { formatDate, formatNaira, formatRelative } from '@/lib/format'
import {
  Alert,
  Avatar,
  AvatarGroup,
  Badge,
  BulkActionBar,
  BUSINESS_UNITS,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  CurrencyInput,
  DataTable,
  Drawer,
  EmptyState,
  Field,
  FieldError,
  FilterBar,
  IconButton,
  Input,
  KeyValue,
  KeyValueList,
  Label,
  LoadingPanel,
  Modal,
  MoneyCell,
  Pagination,
  PageHeader,
  PersonChip,
  Popover,
  PopoverItem,
  PopoverLabel,
  PopoverSeparator,
  ProgressBar,
  Radio,
  RadioGroup,
  SearchInput,
  SectionHeader,
  Select,
  Separator,
  Skeleton,
  SkeletonCard,
  SkeletonTable,
  SkeletonText,
  Spinner,
  StatCard,
  StatusBadge,
  Switch,
  TableToolbar,
  Tabs,
  Textarea,
  Timeline,
  Tooltip,
  UnitTag,
  type Column,
  type FilterValues,
  type TableDensity,
} from '@/ui'

/* ========================================================================== */
/* Demo data                                                                  */
/* ========================================================================== */

interface DemoRow {
  id: string
  name: string
  email: string
  unit: BusinessUnit
  course: string
  cohort: string
  status: string
  owner: string
  source: string
  invoiceKobo: number
  paidKobo: number
  progress: number
  enrolledAt: Date
  lastSeen: Date
}

const FIRST = ['Adebayo', 'Chidinma', 'Ifeoma', 'Tunde', 'Ngozi', 'Emeka', 'Aisha', 'Segun', 'Blessing', 'Kunle', 'Zainab', 'Obinna', 'Folake', 'Musa', 'Temitope']
const LAST = ['Okonkwo', 'Adeyemi', 'Balogun', 'Eze', 'Ibrahim', 'Nwosu', 'Olawale', 'Danjuma', 'Chukwu', 'Adeleke', 'Bello', 'Okafor']
const COURSES = ['Data analytics', 'Product design', 'Frontend engineering', 'Cybersecurity', 'Digital marketing', 'Cloud engineering']
const STATUSES = ['active', 'pending', 'part_paid', 'overdue', 'completed', 'withdrawn', 'draft', 'approved']
const OWNERS = ['Ngozi Eze', 'Kunle Adeleke', 'Aisha Bello', 'Tunde Balogun']
const SOURCES = ['Referral', 'Instagram', 'Walk-in', 'Website', 'Corporate', 'Event']

/** Deterministic pseudo-random so the table looks the same on every reload. */
function makeRows(count: number): DemoRow[] {
  let seed = 20260920
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(next() * list.length)]

  return Array.from({ length: count }, (_, index) => {
    const name = `${pick(FIRST)} ${pick(LAST)}`
    const invoiceKobo = Math.round((150_000 + next() * 1_350_000) / 5_000) * 5_000 * 100
    const paidRatio = next()
    return {
      id: `STU-${String(4200 + index)}`,
      name,
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      unit: pick(BUSINESS_UNITS),
      course: pick(COURSES),
      cohort: `C-${2025 + Math.floor(next() * 2)}${String(1 + Math.floor(next() * 4)).padStart(2, '0')}`,
      status: pick(STATUSES),
      owner: pick(OWNERS),
      source: pick(SOURCES),
      invoiceKobo,
      paidKobo: Math.round(invoiceKobo * (paidRatio > 0.75 ? 1 : paidRatio)),
      progress: Math.round(next() * 100),
      enrolledAt: new Date(2026, Math.floor(next() * 9), 1 + Math.floor(next() * 27)),
      lastSeen: new Date(Date.now() - Math.floor(next() * 1000 * 60 * 60 * 24 * 21)),
    }
  })
}

const ROWS = makeRows(50)

const SPARK_UP = [12, 18, 15, 24, 22, 31, 29, 38, 44, 41, 52, 61]
const SPARK_DOWN = [61, 58, 60, 52, 49, 51, 44, 40, 42, 35, 31, 28]
const SPARK_FLAT = [30, 34, 31, 36, 33, 35, 32, 37, 34, 36, 33, 35]

/* ========================================================================== */
/* Page scaffolding                                                           */
/* ========================================================================== */

interface SectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
}

function Section({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-8">
      <SectionHeader title={title} description={description} divided className="mb-5" />
      <div className="space-y-6">{children}</div>
    </section>
  )
}

function Specimen({
  label,
  note,
  children,
  className,
}: {
  label: string
  note?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <p className="text-label-10 text-text-muted">{label}</p>
        {note && <p className="text-body-12 text-text-secondary">{note}</p>}
      </div>
      <div className={cn('rounded-xl border border-border bg-surface p-5', className)}>{children}</div>
    </div>
  )
}

function Grid({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid gap-4',
        cols === 2 && 'sm:grid-cols-2',
        cols === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        cols === 4 && 'sm:grid-cols-2 lg:grid-cols-4',
      )}
    >
      {children}
    </div>
  )
}

/* ========================================================================== */
/* Sections                                                                   */
/* ========================================================================== */

const ROLE_TOKENS = [
  { name: 'canvas', className: 'bg-canvas' },
  { name: 'surface', className: 'bg-surface' },
  { name: 'surface-sunken', className: 'bg-surface-sunken' },
  { name: 'surface-hover', className: 'bg-surface-hover' },
  { name: 'border', className: 'bg-border' },
  { name: 'border-strong', className: 'bg-border-strong' },
  { name: 'border-interactive', className: 'bg-border-interactive' },
  { name: 'accent', className: 'bg-accent' },
  { name: 'accent-hover', className: 'bg-accent-hover' },
  { name: 'accent-subtle', className: 'bg-accent-subtle' },
  { name: 'accent-wash', className: 'bg-accent-wash' },
  { name: 'text', className: 'bg-text' },
]

const TYPE_SPECIMENS = [
  { name: 'display-40', className: 'text-display-40', sample: '₦48.2m' },
  { name: 'display-32', className: 'text-display-32', sample: '1,284' },
  { name: 'heading-24', className: 'text-heading-24', sample: 'Finance overview' },
  { name: 'heading-20', className: 'text-heading-20', sample: 'Invoice CIR-10482' },
  { name: 'heading-18', className: 'text-heading-18', sample: 'Outstanding balances' },
  { name: 'body-15', className: 'text-body-15', sample: 'Card titles sit here at bold weight.' },
  { name: 'body-14', className: 'text-body-14', sample: 'Default copy across the product.' },
  { name: 'body-13', className: 'text-body-13', sample: 'Dense table cells and metadata.' },
  { name: 'body-12', className: 'text-body-12', sample: 'The smallest prose we will set.' },
  { name: 'label-11', className: 'text-label-11', sample: 'Section label' },
  { name: 'label-10', className: 'text-label-10', sample: 'Chip label' },
]

function FoundationsSection() {
  return (
    <Section
      id="foundations"
      title="Foundations"
      description="Role tokens first. Components never reference a ramp step unless there is no role for it."
    >
      <Specimen label="Role tokens" note="Re-declared once under :root[data-theme='dark'] — toggle the theme above.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {ROLE_TOKENS.map((token) => (
            <div key={token.name}>
              <div className={cn('h-12 rounded-lg border border-border', token.className)} />
              <p className="mt-1.5 text-body-12 text-text-secondary">{token.name}</p>
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen label="Semantic ramps" note="Used only for accents that have no role token.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: 'success', wash: 'bg-success-25', ink: 'text-success-700', solid: 'bg-success-600' },
            { name: 'warning', wash: 'bg-warning-25', ink: 'text-warning-700', solid: 'bg-warning-500' },
            { name: 'danger', wash: 'bg-danger-25', ink: 'text-danger-700', solid: 'bg-danger-600' },
            { name: 'info', wash: 'bg-info-25', ink: 'text-info-700', solid: 'bg-info-600' },
          ].map((tone) => (
            <div key={tone.name} className="rounded-lg border border-border overflow-hidden">
              <div className={cn('px-3 py-2.5', tone.wash)}>
                <span className={cn('text-body-13 font-semibold', tone.ink)}>{tone.name}-700</span>
              </div>
              <div className={cn('h-6', tone.solid)} />
            </div>
          ))}
        </div>
      </Specimen>

      <Specimen label="Type scale" note="Weight signals hierarchy before size — 400 → 600 → 700.">
        <dl className="space-y-3">
          {TYPE_SPECIMENS.map((item) => (
            <div key={item.name} className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <dt className="w-28 shrink-0 text-body-12 text-text-muted tabular-nums">{item.name}</dt>
              <dd className={cn('text-text', item.className)}>{item.sample}</dd>
            </div>
          ))}
        </dl>
      </Specimen>

      <Specimen label="Radius" note="Buttons lg, cards and inputs xl, panels and modals 2xl, circular full.">
        <div className="flex flex-wrap items-end gap-4">
          {[
            { name: 'rounded-lg', className: 'rounded-lg' },
            { name: 'rounded-xl', className: 'rounded-xl' },
            { name: 'rounded-2xl', className: 'rounded-2xl' },
            { name: 'rounded-full', className: 'rounded-full' },
          ].map((radius) => (
            <div key={radius.name} className="text-center">
              <div className={cn('size-16 border border-border bg-surface-sunken', radius.className)} />
              <p className="mt-1.5 text-body-12 text-text-secondary">{radius.name}</p>
            </div>
          ))}
        </div>
      </Specimen>
    </Section>
  )
}

function ButtonsSection() {
  const [loading, setLoading] = useState(false)

  return (
    <Section
      id="buttons"
      title="Buttons"
      description="Five variants, three sizes. The secondary variant is the one the source shipped invisible."
    >
      <Specimen label="Variants">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Create invoice</Button>
          <Button variant="secondary">Save draft</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete record</Button>
          <Button variant="link">View audit trail</Button>
        </div>
      </Specimen>

      <Specimen label="Sizes">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />}>
            With icon
          </Button>
          <Button size="md" variant="secondary" rightIcon={<ArrowUpRight size={16} />}>
            Trailing icon
          </Button>
        </div>
      </Specimen>

      <Specimen label="States" note="Loading keeps the button width stable and sets aria-busy.">
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="danger" disabled>
            Disabled
          </Button>
          <Button loading loadingLabel="Posting payment">
            Post payment
          </Button>
          <Button variant="secondary" loading>
            Reconciling
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true)
              window.setTimeout(() => setLoading(false), 1600)
            }}
          >
            Click to load
          </Button>
        </div>
      </Specimen>

      <Specimen label="Icon only and full width">
        <div className="flex flex-wrap items-center gap-3">
          <IconButton icon={Pencil} label="Edit" />
          <IconButton icon={Trash2} label="Delete" variant="danger" />
          <IconButton icon={RefreshCw} label="Refresh" variant="secondary" />
          <IconButton icon={MoreHorizontal} label="More actions" size="sm" variant="secondary" />
          <IconButton icon={Download} label="Export" size="lg" variant="primary" />
          <IconButton icon={Pencil} label="Edit" disabled />
        </div>
        <div className="mt-4 max-w-xs">
          <Button fullWidth leftIcon={<UserPlus size={16} />}>
            Add person
          </Button>
        </div>
      </Specimen>

      <Specimen label="asChild" note="Renders the child element with the button's skin — here, an anchor.">
        <Button asChild variant="secondary" rightIcon={<ArrowUpRight size={16} />}>
          <a href="#foundations">Jump to foundations</a>
        </Button>
      </Specimen>
    </Section>
  )
}

function FormsSection() {
  const [text, setText] = useState('Adebayo Okonkwo')
  const [notes, setNotes] = useState('Requested a two-part payment plan.')
  const [unit, setUnit] = useState('academy')
  const [search, setSearch] = useState('')
  const [amount, setAmount] = useState<number | null>(45_000_00)
  const [terms, setTerms] = useState(false)
  const [plan, setPlan] = useState('full')
  const [notify, setNotify] = useState(true)
  const [digest, setDigest] = useState(false)

  return (
    <Section id="forms" title="Form controls" description="Every control is labelled, described and keyboard operable.">
      <Grid cols={2}>
        <Specimen label="Text inputs">
          <div className="space-y-4">
            <Field label="Full name" hint="As it appears on the certificate." required>
              <Input value={text} onChange={(event) => setText(event.target.value)} />
            </Field>
            <Field label="Email" error="That address is already on another Person record.">
              <Input defaultValue="adebayo@example.com" leftIcon={<Mail size={16} />} />
            </Field>
            <Field label="Referral code" hint="Optional — leave blank if none." optional>
              <Input placeholder="CIR-XXXX" />
            </Field>
            <Field label="Read only">
              <Input defaultValue="STU-4207" disabled />
            </Field>
          </div>
        </Specimen>

        <Specimen label="Select, textarea, search, currency">
          <div className="space-y-4">
            <Field label="Business unit" required>
              <Select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                options={BUSINESS_UNITS.map((value) => ({ value, label: value }))}
              />
            </Field>
            <Field label="Invoice total" hint="Displayed in naira, stored in kobo.">
              <CurrencyInput value={amount} onChange={setAmount} />
            </Field>
            <p className="text-body-12 text-text-muted tabular-nums">
              Stored value: {amount === null ? 'null' : `${amount} kobo`} · {amount === null ? '—' : formatNaira(amount)}
            </p>
            <Field label="Internal note" hint="Not visible to the student.">
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={240}
                showCount
              />
            </Field>
            <SearchInput value={search} onChange={setSearch} placeholder="Search people, invoices, courses" />
          </div>
        </Specimen>
      </Grid>

      <Grid cols={2}>
        <Specimen label="Choice controls">
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Checkbox
                label="Send the welcome email"
                description="Goes out as soon as the first payment clears."
                checked={terms}
                onChange={(event) => setTerms(event.target.checked)}
              />
              <Checkbox label="Indeterminate" indeterminate onChange={() => undefined} checked={false} />
              <Checkbox label="Disabled" disabled checked={false} onChange={() => undefined} />
              <Checkbox label="Disabled and checked" disabled checked onChange={() => undefined} />
            </div>

            <Separator />

            <RadioGroup legend="Payment plan" description="Determines how the invoice is split.">
              <Radio
                name="plan"
                value="full"
                checked={plan === 'full'}
                onChange={() => setPlan('full')}
                label="Pay in full"
                description="One invoice, due on enrolment."
              />
              <Radio
                name="plan"
                value="two"
                checked={plan === 'two'}
                onChange={() => setPlan('two')}
                label="Two instalments"
              />
              <Radio name="plan" value="four" disabled label="Four instalments" description="Corporate accounts only." />
            </RadioGroup>
          </div>
        </Specimen>

        <Specimen label="Switches and inline layout">
          <div className="space-y-5">
            <Switch
              checked={notify}
              onChange={setNotify}
              label="Notify the lead owner"
              description="Sends an in-app notification on every status change."
            />
            <Switch checked={digest} onChange={setDigest} label="Weekly parent digest" size="sm" />
            <Switch checked={false} onChange={() => undefined} label="Disabled" disabled />
            <Switch checked onChange={() => undefined} label="Disabled and on" disabled />

            <Separator label="Inline fields" />

            <Field layout="inline" label="Cohort code" hint="Format C-YYYYNN.">
              <Input defaultValue="C-202603" />
            </Field>
            <Field layout="inline" label="Discount" error="Above your approval threshold.">
              <Input defaultValue="35%" />
            </Field>
          </div>
        </Specimen>
      </Grid>

      <Specimen label="Label and FieldError on their own">
        <div className="flex flex-wrap items-center gap-8">
          <Label>Plain label</Label>
          <Label required>Required label</Label>
          <Label optional>Optional label</Label>
          <FieldError>Enter an amount greater than zero.</FieldError>
        </div>
      </Specimen>
    </Section>
  )
}

function DisplaySection() {
  return (
    <Section id="display" title="Display" description="Cards, stats, badges and the domain chips the ERP leans on.">
      <Specimen label="Card" className="bg-canvas">
        <Grid cols={2}>
          <Card>
            <CardHeader
              title="Invoice CIR-10482"
              description="Corporate · Lagos branch"
              actions={<IconButton icon={MoreHorizontal} label="Invoice actions" size="sm" />}
            />
            <CardBody>
              <KeyValueList>
                <KeyValue label="Account">Northbridge Ltd</KeyValue>
                <KeyValue label="Issued">{formatDate(new Date(2026, 7, 27))}</KeyValue>
                <KeyValue label="Due">{formatDate(new Date(2026, 8, 26))}</KeyValue>
                <KeyValue label="Total" align="right">
                  <MoneyCell kobo={4_250_000_00} strong />
                </KeyValue>
              </KeyValueList>
            </CardBody>
            <CardFooter align="between">
              <StatusBadge status="part_paid" />
              <div className="flex gap-2">
                <Button variant="secondary" size="sm">
                  Download
                </Button>
                <Button size="sm">Record payment</Button>
              </div>
            </CardFooter>
          </Card>

          <Card elevated padding="default">
            <p className="text-body-15 font-bold text-text">Elevated card</p>
            <p className="mt-1 text-body-14 text-text-secondary">
              `shadow-sm` at rest. The hairline border still does the separating.
            </p>
            <Separator className="my-4" />
            <Card interactive padding="tight">
              <p className="text-body-14 font-medium text-text">Interactive card</p>
              <p className="mt-0.5 text-body-13 text-text-secondary">Lifts to `shadow-md` on hover.</p>
            </Card>
          </Card>
        </Grid>
      </Specimen>

      <Specimen label="StatCard" note="Four variants pulled apart on chip, sparkline and rule — not one shared fill.">
        <Grid cols={4}>
          <StatCard
            label="Collected this month"
            value="₦48.2m"
            icon={Wallet}
            sparkline={SPARK_UP}
            delta={{ value: 12.4, label: 'vs last month' }}
          />
          <StatCard
            label="Enrolments"
            value="284"
            variant="success"
            icon={GraduationCap}
            sparkline={SPARK_UP}
            delta={{ value: 8.1, label: 'vs last month' }}
          />
          <StatCard
            label="Invoices due in 7 days"
            value="31"
            variant="warning"
            icon={Receipt}
            sparkline={SPARK_FLAT}
            delta={{ value: 2.3, tone: 'negative', label: 'vs last week' }}
          />
          <StatCard
            label="Overdue balance"
            value="₦6.4m"
            variant="danger"
            icon={TrendingDown}
            sparkline={SPARK_DOWN}
            delta={{ value: -18.6, label: 'vs last month' }}
          />
        </Grid>
        <div className="mt-4">
          <Grid cols={4}>
            <StatCard label="No delta, no spark" value="1,284" icon={Users} />
            <StatCard label="Flat" value="₦12.0m" icon={Banknote} delta={{ value: 0, direction: 'flat', label: 'unchanged' }} />
            <StatCard label="Clickable" value="92%" icon={CheckCircle2} onClick={() => undefined} caption="Opens the report" />
            <StatCard label="Loading" value="" loading />
          </Grid>
        </div>
      </Specimen>

      <Specimen label="Badge">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const).map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const).map((tone) => (
              <Badge key={tone} tone={tone} variant="solid">
                {tone}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {(['neutral', 'accent', 'success', 'warning', 'danger', 'info'] as const).map((tone) => (
              <Badge key={tone} tone={tone} variant="outline">
                {tone}
              </Badge>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="success" dot>
              with dot
            </Badge>
            <Badge tone="accent" size="sm">
              small
            </Badge>
            <Badge tone="info" icon={<Send size={11} />}>
              with icon
            </Badge>
          </div>
        </div>
      </Specimen>

      <Specimen label="StatusBadge" note="Maps any enum-ish string to a tone. Unmapped statuses stay neutral.">
        <div className="flex flex-wrap items-center gap-2">
          {[
            'active',
            'pending',
            'PART_PAID',
            'overdue',
            'approved',
            'rejected',
            'draft',
            'completed',
            'withdrawn',
            'in_progress',
            'refunded',
            'scheduled',
            'paid',
            'archived',
            'something_we_never_mapped',
          ].map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Specimen>

      <Specimen label="UnitTag" note="Six units, six stable tones. Red is reserved for failure.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {BUSINESS_UNITS.map((unit) => (
              <UnitTag key={unit} unit={unit} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {BUSINESS_UNITS.map((unit) => (
              <UnitTag key={unit} unit={unit} size="sm" />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {BUSINESS_UNITS.map((unit) => (
              <UnitTag key={unit} unit={unit} dotOnly />
            ))}
            <span className="text-body-12 text-text-secondary">dotOnly, for very dense rows</span>
          </div>
        </div>
      </Specimen>

      <Specimen label="People">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
              <Avatar key={size} name="Adebayo Okonkwo" size={size} />
            ))}
            <Avatar name="Broken image" src="/does-not-exist.png" size="lg" />
          </div>
          <AvatarGroup
            people={[
              { name: 'Ngozi Eze' },
              { name: 'Kunle Adeleke' },
              { name: 'Aisha Bello' },
              { name: 'Tunde Balogun' },
              { name: 'Emeka Nwosu' },
              { name: 'Folake Okafor' },
            ]}
            max={4}
          />
          <div className="flex flex-wrap items-center gap-8">
            <PersonChip name="Chidinma Adeyemi" role="Tutor · Data analytics" />
            <PersonChip name="Kunle Adeleke" role="Sales executive" size="sm" />
            <PersonChip name="Aisha Bello" size="lg" role="Head of admissions" />
            <PersonChip name="Temitope Chukwu" short role="Student" onClick={() => undefined} />
          </div>
        </div>
      </Specimen>

      <Specimen label="MoneyCell, ProgressBar, KeyValue">
        <Grid cols={2}>
          <div className="max-w-56 space-y-1">
            <MoneyCell kobo={4_250_000_00} strong />
            <MoneyCell kobo={1_275_500_00} decimals />
            <MoneyCell kobo={-320_000_00} />
            <MoneyCell kobo={0} />
            <MoneyCell kobo={48_200_000_00} compact tone="positive" />
            <MoneyCell kobo={225_000_00} sub="of ₦450,000" />
            <MoneyCell kobo={95_000_00} signed tone="positive" />
          </div>
          <div className="space-y-4">
            <ProgressBar value={72} label="Cohort C-202603" showValue />
            <ProgressBar value={96} max={100} label="Collection rate" tone="success" showValue />
            <ProgressBar value={48} label="Attendance" tone="warning" showValue />
            <ProgressBar value={12} label="Reconciled" tone="danger" showValue size="sm" />
            <ProgressBar value={0} label="Not started" tone="neutral" showValue />
          </div>
        </Grid>
        <Separator label="Detail pane" className="my-6" />
        <KeyValueList columns={2}>
          <KeyValue label="Person">
            <PersonChip name="Adebayo Okonkwo" size="sm" />
          </KeyValue>
          <KeyValue label="Unit">
            <UnitTag unit="corporate" size="sm" />
          </KeyValue>
          <KeyValue label="Status">
            <StatusBadge status="part_paid" size="sm" />
          </KeyValue>
          <KeyValue label="Invoice total" align="right">
            <MoneyCell kobo={4_250_000_00} />
          </KeyValue>
          <KeyValue label="Created" hint="by Ngozi Eze">
            {formatDate(new Date(2026, 7, 27))}
          </KeyValue>
          <KeyValue label="Reference" layout="stacked">
            CIR-10482 / PST-9930114
          </KeyValue>
        </KeyValueList>
      </Specimen>
    </Section>
  )
}

const TIMELINE_ITEMS = [
  {
    id: '1',
    title: 'Invoice CIR-10482 marked part paid',
    description: '₦2,000,000 of ₦4,250,000 received via Paystack.',
    timestamp: new Date(Date.now() - 1000 * 60 * 24),
    icon: CreditCard,
    tone: 'success' as const,
  },
  {
    id: '2',
    title: 'Discount raised from 10% to 35%',
    description: 'Above threshold — routed to the Head of Admissions for approval.',
    detail: (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral" size="sm">
          was 10%
        </Badge>
        <Badge tone="warning" size="sm">
          now 35%
        </Badge>
      </div>
    ),
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6),
    icon: Filter,
    tone: 'warning' as const,
  },
  {
    id: '3',
    title: 'Ngozi Eze took ownership of the lead',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 30),
    actor: { name: 'Ngozi Eze' },
  },
  {
    id: '4',
    title: 'Lead created from a referral link',
    description: 'Referrer CIR-7781 · Instagram campaign',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 4),
    icon: UserPlus,
    tone: 'accent' as const,
  },
]

function FeedbackSection() {
  const [dismissed, setDismissed] = useState(false)

  return (
    <Section id="feedback" title="Feedback" description="Alerts, empty states, spinners and skeletons — every loading and empty case.">
      <Specimen label="Alert">
        <div className="space-y-3">
          <Alert tone="info" title="Reconciliation runs at 02:00">
            Bank statements imported after midnight are matched in the next run.
          </Alert>
          <Alert tone="success" title="Payment posted">
            ₦2,000,000 allocated to CIR-10482. The student ledger is up to date.
          </Alert>
          <Alert
            tone="warning"
            title="Three invoices could not be matched"
            action={
              <>
                <Button size="sm" variant="secondary">
                  Review queue
                </Button>
                <Button size="sm" variant="ghost">
                  Ignore
                </Button>
              </>
            }
          >
            Unmatched items stay visible until someone resolves them.
          </Alert>
          <Alert tone="danger" title="Paystack webhook rejected">
            Signature mismatch on event evt_8812. The payment was not recorded.
          </Alert>
          {!dismissed && (
            <Alert tone="info" onDismiss={() => setDismissed(true)}>
              A dismissible alert with no title.
            </Alert>
          )}
          {dismissed && (
            <Button variant="link" size="sm" onClick={() => setDismissed(false)}>
              Restore dismissed alert
            </Button>
          )}
        </div>
      </Specimen>

      <Specimen label="EmptyState" className="p-0">
        <Grid cols={3}>
          <div className="border-b border-border p-2 sm:border-b-0 sm:border-r">
            <EmptyState
              icon={FileText}
              title="No invoices yet"
              message="Invoices appear here once an enrolment is confirmed."
              action={<Button size="sm" leftIcon={<Plus size={14} />}>New invoice</Button>}
            />
          </div>
          <div className="border-b border-border p-2 sm:border-b-0 sm:border-r">
            <EmptyState
              variant="search"
              icon={SearchX}
              title="No results for “northbridge”"
              message="Try a different spelling, or clear the unit filter."
              action={<Button size="sm" variant="secondary">Clear filters</Button>}
            />
          </div>
          <div className="p-2">
            <EmptyState
              variant="error"
              title="Could not load invoices"
              message="The finance service did not respond. Nothing has been changed."
              action={<Button size="sm" variant="secondary" leftIcon={<RefreshCw size={14} />}>Try again</Button>}
            />
          </div>
        </Grid>
      </Specimen>

      <Specimen label="Spinner" note="role=status with an sr-only label — the source announced nothing.">
        <div className="flex flex-wrap items-end gap-8">
          {(['xs', 'sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <div key={size} className="text-center">
              <Spinner size={size} />
              <p className="mt-2 text-body-12 text-text-secondary">{size}</p>
            </div>
          ))}
          <div className="min-w-56 rounded-xl border border-border">
            <LoadingPanel label="Loading ledger" />
          </div>
        </div>
      </Specimen>

      <Specimen label="Skeleton">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <Skeleton width={160} height={12} />
            <Skeleton width={80} height={28} rounded="lg" />
            <Skeleton width={40} height={40} rounded="full" />
          </div>
          <Grid cols={3}>
            <SkeletonCard />
            <SkeletonCard variant="stat" />
            <div className="rounded-xl border border-border bg-surface p-5">
              <SkeletonText lines={5} />
            </div>
          </Grid>
          <SkeletonTable rows={4} columns={6} />
          <SkeletonTable rows={4} columns={6} density="compact" />
        </div>
      </Specimen>

      <Specimen label="Timeline" note="Activity feed on the left, audit trail (absolute timestamps) on the right.">
        <Grid cols={2}>
          <Timeline items={TIMELINE_ITEMS} />
          <Timeline items={TIMELINE_ITEMS} timeFormat="absolute" dense />
        </Grid>
      </Specimen>
    </Section>
  )
}

function OverlaysSection() {
  const [modalSize, setModalSize] = useState<'sm' | 'md' | 'lg' | 'xl' | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [destructiveOpen, setDestructiveOpen] = useState(false)
  const [nestedOpen, setNestedOpen] = useState(false)
  const [tab, setTab] = useState('overview')
  const [pillTab, setPillTab] = useState('all')

  return (
    <Section
      id="overlays"
      title="Overlays and navigation"
      description="Focus is trapped while open, returned to the trigger on close, and the body scroll lock is reference counted."
    >
      <Specimen label="Modal" note="Try Tab, Shift+Tab and Escape. Open the nested dialog to check the scroll lock.">
        <div className="flex flex-wrap items-center gap-3">
          {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
            <Button key={size} variant="secondary" onClick={() => setModalSize(size)}>
              Open {size}
            </Button>
          ))}
        </div>
      </Specimen>

      <Specimen label="Drawer and confirm dialogs">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open drawer
          </Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Confirm
          </Button>
          <Button variant="danger" onClick={() => setDestructiveOpen(true)}>
            Destructive confirm
          </Button>
        </div>
      </Specimen>

      <Specimen label="Popover and Tooltip" note="Both are portalled and position-fixed, so neither clips inside a scroll container.">
        <div className="flex flex-wrap items-center gap-4">
          <Popover
            role="menu"
            content={
              <>
                <PopoverLabel>Invoice</PopoverLabel>
                <PopoverItem icon={<Download size={15} />}>Download PDF</PopoverItem>
                <PopoverItem icon={<Send size={15} />}>Send reminder</PopoverItem>
                <PopoverItem icon={<Pencil size={15} />}>Edit lines</PopoverItem>
                <PopoverSeparator />
                <PopoverItem icon={<Trash2 size={15} />} destructive>
                  Void invoice
                </PopoverItem>
              </>
            }
          >
            <Button variant="secondary" rightIcon={<MoreHorizontal size={16} />}>
              Row actions
            </Button>
          </Popover>

          <Popover
            side="bottom"
            align="end"
            width={288}
            content={
              <div className="p-2.5">
                <p className="text-body-14 font-bold text-text">Column visibility</p>
                <p className="mt-1 text-body-13 text-text-secondary">A dialog popover traps focus.</p>
                <div className="mt-3 space-y-2">
                  <Checkbox label="Owner" defaultChecked />
                  <Checkbox label="Source" defaultChecked />
                  <Checkbox label="Last seen" />
                </div>
              </div>
            }
          >
            <Button variant="secondary" leftIcon={<Filter size={16} />}>
              Columns
            </Button>
          </Popover>

          <Tooltip content="Recalculates commission for every eligible payment.">
            <Button variant="ghost" leftIcon={<RefreshCw size={16} />}>
              Hover me
            </Button>
          </Tooltip>

          <Tooltip content="Tooltips open on keyboard focus too." side="right">
            <IconButton icon={Search} label="Search" variant="secondary" showTitle={false} />
          </Tooltip>
        </div>
      </Specimen>

      <Specimen label="Tabs" note="Roving tabindex; arrows, Home and End move between tabs.">
        <div className="space-y-6">
          <Tabs
            aria-label="Record sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'invoices', label: 'Invoices', badge: 12 },
              { id: 'attendance', label: 'Attendance', icon: CheckCircle2 },
              { id: 'audit', label: 'Audit trail' },
              { id: 'locked', label: 'Payroll', disabled: true },
            ]}
          />
          <Tabs
            aria-label="Filter preset"
            variant="pill"
            size="sm"
            value={pillTab}
            onChange={setPillTab}
            className="w-fit"
            tabs={[
              { id: 'all', label: 'All' },
              { id: 'mine', label: 'Mine', badge: 4 },
              { id: 'overdue', label: 'Overdue', badge: 31 },
            ]}
          />
        </div>
      </Specimen>

      <Modal
        open={modalSize !== null}
        onClose={() => setModalSize(null)}
        size={modalSize ?? 'md'}
        title={`Record a payment (${modalSize ?? ''})`}
        description="Allocated against the oldest open invoice line first."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalSize(null)}>
              Cancel
            </Button>
            <Button onClick={() => setNestedOpen(true)}>Post payment</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Amount" required>
            <CurrencyInput value={200_000_00} onChange={() => undefined} />
          </Field>
          <Field label="Method" required>
            <Select
              defaultValue="transfer"
              options={[
                { value: 'transfer', label: 'Bank transfer' },
                { value: 'paystack', label: 'Paystack' },
                { value: 'cash', label: 'Cash' },
              ]}
            />
          </Field>
          <Field label="Reference" hint="From the bank statement.">
            <Input defaultValue="PST-9930114" />
          </Field>
          <Alert tone="info">Posting a payment writes an immutable audit row.</Alert>
        </div>
      </Modal>

      <ConfirmDialog
        open={nestedOpen}
        onClose={() => setNestedOpen(false)}
        onConfirm={() => new Promise((resolve) => window.setTimeout(resolve, 900))}
        title="Post ₦200,000 to CIR-10482?"
        message="This cannot be edited afterwards — it can only be reversed with a credit note."
        confirmLabel="Post payment"
      />

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Adebayo Okonkwo"
        description="STU-4207 · Academy"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button leftIcon={<Pencil size={16} />}>Edit person</Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status="active" />
            <UnitTag unit="academy" />
            <Badge tone="accent">Referrer</Badge>
          </div>
          <KeyValueList>
            <KeyValue label="Email">adebayo.okonkwo@example.com</KeyValue>
            <KeyValue label="Phone">0803 411 9920</KeyValue>
            <KeyValue label="Course">Data analytics</KeyValue>
            <KeyValue label="Cohort">C-202603</KeyValue>
            <KeyValue label="Outstanding" align="right">
              <MoneyCell kobo={2_250_000_00} />
            </KeyValue>
          </KeyValueList>
          <div>
            <SectionHeader title="Activity" size="sm" className="mb-3" />
            <Timeline items={TIMELINE_ITEMS} />
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => setConfirmOpen(false)}
        title="Send 31 payment reminders?"
        message="Each student with an overdue balance receives one email and one WhatsApp message."
        confirmLabel="Send reminders"
      />

      <ConfirmDialog
        open={destructiveOpen}
        onClose={() => setDestructiveOpen(false)}
        onConfirm={() => new Promise((resolve) => window.setTimeout(resolve, 1200))}
        destructive
        title="Void invoice CIR-10482?"
        message="Voiding reverses the commission accrued against it. Focus opens on Cancel, not Confirm."
        confirmLabel="Void invoice"
      />
    </Section>
  )
}

/* ========================================================================== */
/* The data-dense section                                                     */
/* ========================================================================== */

function columnsFor(): Array<Column<DemoRow>> {
  return [
    {
      key: 'name',
      header: 'Person',
      pinned: true,
      minWidth: 220,
      sortable: true,
      sortValue: (row) => row.name,
      cell: (row) => <PersonChip name={row.name} role={row.id} size="sm" />,
    },
    {
      key: 'email',
      header: 'Email',
      minWidth: 220,
      sortable: true,
      accessor: (row) => row.email,
      cell: (row) => <span className="text-text-secondary">{row.email}</span>,
    },
    {
      key: 'unit',
      header: 'Unit',
      width: 140,
      sortable: true,
      sortValue: (row) => row.unit,
      cell: (row) => <UnitTag unit={row.unit} size="sm" />,
    },
    { key: 'course', header: 'Course', minWidth: 180, sortable: true, accessor: (row) => row.course },
    { key: 'cohort', header: 'Cohort', width: 110, sortable: true, accessor: (row) => row.cohort },
    {
      key: 'status',
      header: 'Status',
      width: 140,
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'invoice',
      header: 'Invoiced',
      align: 'right',
      width: 130,
      sortable: true,
      sortValue: (row) => row.invoiceKobo,
      cell: (row) => <MoneyCell kobo={row.invoiceKobo} />,
    },
    {
      key: 'paid',
      header: 'Paid',
      align: 'right',
      width: 130,
      sortable: true,
      sortValue: (row) => row.paidKobo,
      cell: (row) => <MoneyCell kobo={row.paidKobo} tone="muted" />,
    },
    {
      key: 'balance',
      header: 'Balance',
      align: 'right',
      width: 130,
      sortable: true,
      sortValue: (row) => row.invoiceKobo - row.paidKobo,
      cell: (row) => {
        const balance = row.invoiceKobo - row.paidKobo
        return <MoneyCell kobo={balance} tone={balance > 0 ? 'negative' : 'positive'} strong={balance > 0} />
      },
    },
    {
      key: 'progress',
      header: 'Progress',
      width: 150,
      sortable: true,
      sortValue: (row) => row.progress,
      cell: (row) => (
        <ProgressBar
          value={row.progress}
          size="sm"
          aria-label={`Course progress for ${row.name}`}
          tone={row.progress > 66 ? 'success' : row.progress > 33 ? 'accent' : 'warning'}
        />
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      minWidth: 170,
      sortable: true,
      sortValue: (row) => row.owner,
      cell: (row) => <PersonChip name={row.owner} short size="sm" />,
    },
    { key: 'source', header: 'Source', width: 120, sortable: true, accessor: (row) => row.source },
    {
      key: 'enrolled',
      header: 'Enrolled',
      width: 130,
      sortable: true,
      sortValue: (row) => row.enrolledAt,
      cell: (row) => <span className="tabular-nums">{formatDate(row.enrolledAt)}</span>,
    },
    {
      key: 'lastSeen',
      header: 'Last seen',
      width: 130,
      sortable: true,
      sortValue: (row) => row.lastSeen,
      cell: (row) => <span className="text-text-muted">{formatRelative(row.lastSeen)}</span>,
    },
    {
      key: 'actions',
      header: '',
      width: 56,
      align: 'center',
      // Stops the row-click handler firing when the menu is opened.
      cell: () => (
        <span onClick={(event) => event.stopPropagation()}>
          <Popover
            role="menu"
            align="end"
            content={
              <>
                <PopoverItem icon={<FileText size={15} />}>Open record</PopoverItem>
                <PopoverItem icon={<Send size={15} />}>Send reminder</PopoverItem>
                <PopoverSeparator />
                <PopoverItem icon={<Trash2 size={15} />} destructive>
                  Withdraw
                </PopoverItem>
              </>
            }
          >
            <IconButton icon={MoreHorizontal} label="Row actions" size="sm" showTitle={false} />
          </Popover>
        </span>
      ),
    },
  ]
}

function DataTableSection() {
  const [density, setDensity] = useState<TableDensity>('comfortable')
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [activeRow, setActiveRow] = useState<DemoRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [state, setState] = useState<'loaded' | 'loading' | 'empty'>('loaded')

  const columns = useMemo(() => columnsFor(), [])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return ROWS.filter((row) => {
      if (filters.unit && row.unit !== filters.unit) return false
      if (filters.status && row.status !== filters.status) return false
      if (filters.owner && row.owner !== filters.owner) return false
      if (!term) return true
      return (
        row.name.toLowerCase().includes(term) ||
        row.email.toLowerCase().includes(term) ||
        row.id.toLowerCase().includes(term) ||
        row.course.toLowerCase().includes(term)
      )
    })
  }, [search, filters])

  const paged = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize],
  )

  const visible = state === 'empty' ? [] : paged
  const selectedTotal = ROWS.filter((row) => selected.includes(row.id)).reduce(
    (sum, row) => sum + row.invoiceKobo - row.paidKobo,
    0,
  )

  const setFilter = (key: string, value: string | undefined) => {
    setFilters((previous) => ({ ...previous, [key]: value }))
    setPage(1)
  }

  return (
    <Section
      id="data"
      title="Data-dense"
      description="Fifteen columns, fifty rows, client-side sort, selection with an indeterminate header checkbox, sticky header, pinned first column."
    >
      <Specimen label="State" note="Switch between the loaded, loading and empty renderings of the same table.">
        <div className="flex flex-wrap items-center gap-6">
          <Tabs
            aria-label="Table state"
            variant="pill"
            size="sm"
            value={state}
            onChange={(next) => setState(next as typeof state)}
            className="w-fit"
            tabs={[
              { id: 'loaded', label: 'Loaded' },
              { id: 'loading', label: 'Loading' },
              { id: 'empty', label: 'Empty' },
            ]}
          />
          <Tabs
            aria-label="Density"
            variant="pill"
            size="sm"
            value={density}
            onChange={(next) => setDensity(next as TableDensity)}
            className="w-fit"
            tabs={[
              { id: 'comfortable', label: 'Comfortable' },
              { id: 'compact', label: 'Compact' },
            ]}
          />
        </div>
      </Specimen>

      <div className="space-y-4">
        <TableToolbar
          selectedCount={selected.length}
          onClearSelection={() => setSelected([])}
          itemNoun="student"
          actions={
            <>
              <Button variant="secondary" leftIcon={<Download size={16} />}>
                Export
              </Button>
              <Button leftIcon={<Plus size={16} />}>Add student</Button>
            </>
          }
          bulkActions={
            <>
              <Button size="sm" variant="secondary" leftIcon={<Send size={14} />}>
                Send reminder
              </Button>
              <Button size="sm" variant="secondary" leftIcon={<Building2 size={14} />}>
                Reassign unit
              </Button>
              <Button
                size="sm"
                variant="danger"
                leftIcon={<Trash2 size={14} />}
                onClick={() => setConfirmDelete(true)}
              >
                Withdraw
              </Button>
              <span className="text-body-13 text-text-secondary tabular-nums">
                {formatNaira(selectedTotal)} outstanding
              </span>
            </>
          }
        >
          <FilterBar
            search={search}
            onSearchChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            searchPlaceholder="Search name, email, ID or course"
            values={filters}
            onFilterChange={setFilter}
            onClearAll={() => {
              setFilters({})
              setSearch('')
              setPage(1)
            }}
            filters={[
              {
                key: 'unit',
                label: 'Unit',
                options: BUSINESS_UNITS.map((unit) => ({ value: unit, label: unit })),
              },
              {
                key: 'status',
                label: 'Status',
                options: STATUSES.map((status) => ({ value: status, label: status.replace(/_/g, ' ') })),
              },
              {
                key: 'owner',
                label: 'Owner',
                options: OWNERS.map((owner) => ({ value: owner, label: owner })),
              },
            ]}
          />
        </TableToolbar>

        <DataTable<DemoRow>
          caption="Students, with invoice and collection status"
          data={visible}
          columns={columns}
          rowKey={(row) => row.id}
          loading={state === 'loading'}
          skeletonRows={8}
          density={density}
          selectable
          selectedKeys={selected}
          onSelectionChange={setSelected}
          onRowClick={(row) => setActiveRow(row)}
          activeRowKey={activeRow?.id}
          defaultSort={{ key: 'name', direction: 'asc' }}
          stickyHeader
          maxHeight={560}
          minWidth={1960}
          emptyTitle="No students match these filters"
          emptyMessage="Three filters are active. Clearing the unit filter usually brings most of them back."
          emptyAction={
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setFilters({})
                setSearch('')
                setState('loaded')
              }}
            >
              Clear filters
            </Button>
          }
        />

        <Pagination
          page={page}
          pageSize={pageSize}
          total={state === 'empty' ? 0 : filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size)
            setPage(1)
          }}
          itemNoun="students"
        />
      </div>

      <Specimen label="Compact table without selection" note="How a 6-column panel table reads inside a Card.">
        <DataTable<DemoRow>
          data={ROWS.slice(0, 6)}
          columns={columns.slice(0, 6)}
          rowKey={(row) => row.id}
          density="compact"
          bordered
          stickyHeader={false}
        />
      </Specimen>

      <Specimen label="BulkActionBar, floating">
        <BulkActionBar count={7} itemNoun="invoice" variant="inline" onClearSelection={() => undefined}>
          <Button size="sm" variant="secondary" leftIcon={<Send size={14} />}>
            Send
          </Button>
          <Button size="sm" variant="danger" leftIcon={<Trash2 size={14} />}>
            Void
          </Button>
        </BulkActionBar>
        <p className="mt-3 text-body-13 text-text-secondary">
          The same bar with <code className="text-body-12">variant=&quot;floating&quot;</code> docks to the bottom of
          the viewport — select a row above to see it in the toolbar form.
        </p>
      </Specimen>

      <Drawer
        open={activeRow !== null}
        onClose={() => setActiveRow(null)}
        title={activeRow?.name ?? ''}
        description={activeRow ? `${activeRow.id} · ${activeRow.course}` : undefined}
        footer={
          <Button variant="secondary" onClick={() => setActiveRow(null)}>
            Close
          </Button>
        }
      >
        {activeRow && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={activeRow.status} />
              <UnitTag unit={activeRow.unit} />
            </div>
            <KeyValueList>
              <KeyValue label="Email">{activeRow.email}</KeyValue>
              <KeyValue label="Cohort">{activeRow.cohort}</KeyValue>
              <KeyValue label="Owner">
                <PersonChip name={activeRow.owner} size="sm" />
              </KeyValue>
              <KeyValue label="Invoiced" align="right">
                <MoneyCell kobo={activeRow.invoiceKobo} />
              </KeyValue>
              <KeyValue label="Paid" align="right">
                <MoneyCell kobo={activeRow.paidKobo} tone="muted" />
              </KeyValue>
              <KeyValue label="Balance" align="right">
                <MoneyCell kobo={activeRow.invoiceKobo - activeRow.paidKobo} strong />
              </KeyValue>
            </KeyValueList>
            <ProgressBar value={activeRow.progress} label="Course progress" showValue />
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          setSelected([])
          setConfirmDelete(false)
        }}
        destructive
        title={`Withdraw ${selected.length} students?`}
        message="Withdrawing reverses any commission accrued against their enrolments."
        confirmLabel="Withdraw"
      />
    </Section>
  )
}

/* ========================================================================== */
/* The page                                                                   */
/* ========================================================================== */

const NAV = [
  { id: 'foundations', label: 'Foundations' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'forms', label: 'Forms' },
  { id: 'display', label: 'Display' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'overlays', label: 'Overlays' },
  { id: 'data', label: 'Data-dense' },
]

function KitchenSink() {
  return (
    <div className="px-8 py-8 pb-24">
      <PageHeader
        title="Kitchen sink"
        breadcrumbs={[{ label: 'System', to: '/kitchen-sink' }, { label: 'Kitchen sink' }]}
        description="Every component in the Cirvee OS design system, in every variant and state. Everything here is built on the role tokens, so the moon icon in the topbar repaints the whole page without a single dark: class."
        meta={<Badge tone="accent">v0.1</Badge>}
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={16} />}
            onClick={() => window.location.reload()}
          >
            Reload
          </Button>
        }
      />

      <nav aria-label="Sections" className="mb-8 flex flex-wrap gap-2">
        {NAV.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 text-body-13 font-semibold text-text-secondary transition-colors hover:bg-surface-hover hover:text-text"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="space-y-14">
        <FoundationsSection />
        <ButtonsSection />
        <FormsSection />
        <DisplaySection />
        <FeedbackSection />
        <OverlaysSection />
        <DataTableSection />
      </div>
    </div>
  )
}

export default defineModule({
  id: '_kitchen-sink',
  label: 'Kitchen sink',
  icon: Palette,
  base: '/kitchen-sink',
  group: 'system',
  depth: 'deep',
  summary: 'Every design-system component in every variant and state, on one page.',
  // A review tool, not a business module — gated so it doesn't leak into
  // every role's sidebar. Held by Super Admin, CEO and the Technology Lead.
  permission: 'settings.role.view',
  routes: [{ path: '', element: <KitchenSink /> }],
})
