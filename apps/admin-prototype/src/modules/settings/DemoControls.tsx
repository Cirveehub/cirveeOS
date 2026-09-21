import { useState } from 'react'
import toast from 'react-hot-toast'
import { AlertTriangle, Clock, FlaskConical, Inbox, RotateCcw, Timer, Zap } from 'lucide-react'

import { formatDate, formatNumber } from '@/lib/format'
import {
  Alert,
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  KeyValue,
  KeyValueList,
  SectionHeader,
  Select,
  Separator,
} from '@/ui'
import { TODAY, auditEventsCollection, demo, useCollection } from '@/mocks'

import { ModuleHeader, Screen } from './parts'

const MODULES = [
  'settings',
  'payroll',
  'outcomes',
  'reputation',
  'meetings',
  'crm',
  'referral',
  'finance',
  'people',
] as const

const ERROR_SCOPES = [
  { value: 'settings.roles', label: 'Settings — roles' },
  { value: 'settings.users', label: 'Settings — users' },
  { value: 'settings.policies', label: 'Settings — policies' },
  { value: 'settings.audit', label: 'Settings — audit log' },
  { value: 'outcomes.dashboard', label: 'Outcomes — dashboard' },
  { value: 'reputation.dashboard', label: 'Reputation — dashboard' },
  { value: 'meetings.list', label: 'Meetings — list' },
]

const LATENCIES = [
  { value: '0', label: 'None' },
  { value: '400', label: '400 ms' },
  { value: '1200', label: '1.2 seconds' },
  { value: '3000', label: '3 seconds' },
]

export default function DemoControls() {
  const audit = useCollection(auditEventsCollection)

  const [resetOpen, setResetOpen] = useState(false)
  const [errorScope, setErrorScope] = useState(ERROR_SCOPES[0].value)
  const [emptyModule, setEmptyModule] = useState<string>(MODULES[0])
  const [latency, setLatency] = useState('0')
  const [offset, setOffset] = useState(demo.clockOffsetDays())

  const advance = (days: 30 | 60 | 90) => {
    demo.advanceClock(days)
    setOffset(demo.clockOffsetDays())
    toast.success(`Clock moved ${days} days forward. Ageing, overdue and follow-up states re-derive from ${formatDate(demo.effectiveToday())}.`)
  }

  return (
    <Screen>
      <ModuleHeader
        title="Demo controls"
        description="Scaffolding. None of this exists in the real product — it is here so a demo can reach the states that are otherwise hard to produce on cue."
      />

      <Alert tone="warning" icon={FlaskConical} className="mb-4" title="This screen is not part of the product">
        It ships with the prototype only. Everything below manipulates the in-memory store or the loading behaviour of the
        screens that read it.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Seed data"
            description="Wipes the session and reloads from the same fixed seed, so every demo starts from a known state."
            className="mb-4"
          />
          <KeyValueList columns={1}>
            <KeyValue label="Seed date" hint="Every relative date in the app is derived from this, so nothing rots">
              {formatDate(TODAY)}
            </KeyValue>
            <KeyValue label="Audit entries in the store">{formatNumber(audit.length)}</KeyValue>
          </KeyValueList>
          <Separator className="my-4" />
          <Button variant="secondary" leftIcon={<RotateCcw size={16} />} onClick={() => setResetOpen(true)}>
            Reset seed data
          </Button>
        </Card>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Jump the clock forward"
            description="Moves the effective today, so overdue invoices, stalled leads and due follow-ups appear without waiting."
            className="mb-4"
          />
          <KeyValueList columns={1}>
            <KeyValue label="Effective today">{formatDate(demo.effectiveToday())}</KeyValue>
            <KeyValue label="Offset applied">
              {offset === 0 ? 'None' : `${formatNumber(offset)} days`}
              {offset > 0 && (
                <Badge tone="warning" size="sm" className="ml-2">
                  Clock moved
                </Badge>
              )}
            </KeyValue>
          </KeyValueList>
          <Separator className="my-4" />
          <div className="flex flex-wrap gap-2">
            {([30, 60, 90] as const).map((days) => (
              <Button key={days} size="sm" variant="secondary" leftIcon={<Clock size={16} />} onClick={() => advance(days)}>
                {days} days
              </Button>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Force an error"
            description="Arms the failure path on one screen's next load, so the error state and its retry are reachable in a demo."
            className="mb-4"
          />
          <Field label="Screen" hint="The error fires once, on the next load of that screen.">
            <Select value={errorScope} options={ERROR_SCOPES} onChange={(event) => setErrorScope(event.target.value)} />
          </Field>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<AlertTriangle size={16} />}
              onClick={() => {
                demo.forceError(errorScope)
                toast('Armed. Open that screen to see the error state and its retry.')
              }}
            >
              Arm the error
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                demo.clearError(errorScope)
                toast.success('Disarmed.')
              }}
            >
              Disarm
            </Button>
          </div>
        </Card>

        <Card>
          <SectionHeader
            as="h2"
            size="sm"
            title="Force an empty state"
            description="Hides every row from one module, so the designed empty states can be shown without deleting anything."
            className="mb-4"
          />
          <Field label="Module">
            <Select
              value={emptyModule}
              options={MODULES.map((m) => ({ value: m, label: m }))}
              onChange={(event) => setEmptyModule(event.target.value)}
            />
          </Field>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Inbox size={16} />}
              onClick={() => {
                demo.forceEmpty(emptyModule)
                toast(`${emptyModule} will render empty until you restore it. No rows have been removed.`)
              }}
            >
              Force empty
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                demo.clearEmpty(emptyModule)
                toast.success('Rows restored.')
              }}
            >
              Restore rows
            </Button>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <SectionHeader
            as="h2"
            size="sm"
            title="Artificial latency"
            description="Added to the 400 ms first-mount delay every module already applies, so skeletons are visible for as long as you need them to be."
            className="mb-4"
          />
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Extra delay" className="min-w-[220px]">
              <Select
                value={latency}
                options={LATENCIES}
                onChange={(event) => {
                  setLatency(event.target.value)
                  demo.setLatency(Number(event.target.value))
                  toast.success(
                    Number(event.target.value) === 0
                      ? 'Latency removed.'
                      : `Every screen now waits an extra ${event.target.value} ms before it renders.`,
                  )
                }}
              />
            </Field>
            <Badge tone="neutral" size="md" icon={<Timer size={12} />}>
              Currently {formatNumber(demo.latency())} ms
            </Badge>
            <Badge tone="neutral" size="md" icon={<Zap size={12} />}>
              Base delay 400 ms
            </Badge>
          </div>
        </Card>
      </div>

      <ConfirmDialog
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => demo.reset()}
        destructive
        title="Reset the seed data?"
        confirmLabel="Reset and reload"
        message="Everything changed in this session is discarded — new branches, edited permissions, suspended accounts and any audit entries written from the UI. The page reloads onto the original seed."
      />
    </Screen>
  )
}
