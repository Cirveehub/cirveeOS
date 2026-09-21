import { useMemo } from 'react'
import { TODAY, leadsCollection, peopleCollection, useCollection } from '@/mocks'
import type { Lead, LeadSource, LeadStage, Person } from '@/mocks/types'
import { OPEN_RAW_STAGES, isOpenStage } from './lookups'
import type { QueryState } from './view-state'

export const FILTER_KEYS = [
  'q',
  'stage',
  'owner',
  'source',
  'referrer',
  'course',
  'branch',
  'unit',
  'created',
  'days',
  'next',
  'view',
  'closed',
] as const

export interface SavedView {
  key: string
  label: string
  description: string
  params: Record<string, string | undefined>
}

const OPEN = OPEN_RAW_STAGES.join(',')

export const SAVED_VIEWS: SavedView[] = [
  {
    key: 'waiting',
    label: 'Waiting 15+ days',
    description: 'Open enquiries that have not moved in over two weeks.',
    params: { days: '15', stage: OPEN },
  },
  {
    key: 'nothing-planned',
    label: 'Nothing planned',
    description: 'Open enquiries with no next step written down.',
    params: { next: 'none', stage: OPEN },
  },
  {
    key: 'this-week',
    label: 'New this week',
    description: 'Enquiries that came in during the last seven days.',
    params: { created: '7d', closed: '1' },
  },
  {
    key: 'ready',
    label: 'Ready to pay',
    description: 'They have said yes and we are waiting for the money.',
    params: { stage: 'payment_pending' },
  },
  {
    key: 'not-now',
    label: 'Not now',
    description: 'Parked with a date to check back.',
    params: { stage: 'future_nurture' },
  },
]

export const CREATED_RANGES: Array<{ value: string; label: string; days: number }> = [
  { value: '7d', label: 'Last 7 days', days: 7 },
  { value: '30d', label: 'Last 30 days', days: 30 },
  { value: '90d', label: 'Last 90 days', days: 90 },
  { value: '365d', label: 'Last 12 months', days: 365 },
]

export const NEXT_ACTION_OPTIONS = [
  { value: 'yes', label: 'Has a next step' },
  { value: 'none', label: 'Nothing planned' },
  { value: 'overdue', label: 'Next step overdue' },
]

export function dateDaysAgo(days: number): string {
  return new Date(Date.parse(`${TODAY}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
}

export interface LeadFilterInput {
  q: string
  stages: LeadStage[]
  owners: string[]
  sources: LeadSource[]
  referrer?: string
  course?: string
  branch?: string
  unit?: string
  created?: string
  minDaysInStage?: number
  nextAction?: string
  /** When false and no stage is chosen, only open enquiries are returned. */
  includeClosed: boolean
}

export function readLeadFilters(query: QueryState, currentUserId: string): LeadFilterInput {
  const owners = query.getList('owner').map((o) => (o === 'me' ? currentUserId : o))
  const days = Number(query.get('days'))
  return {
    q: query.get('q') ?? '',
    stages: query.getList('stage') as LeadStage[],
    owners,
    sources: query.getList('source') as LeadSource[],
    referrer: query.get('referrer'),
    course: query.get('course'),
    branch: query.get('branch'),
    unit: query.get('unit'),
    created: query.get('created'),
    minDaysInStage: Number.isFinite(days) && days > 0 ? days : undefined,
    nextAction: query.get('next'),
    includeClosed: query.get('closed') === '1',
  }
}

export function applyLeadFilters(
  leads: Lead[],
  filters: LeadFilterInput,
  personById: Map<string, Person>,
): Lead[] {
  const q = filters.q.trim().toLowerCase()
  const createdFrom = filters.created
    ? dateDaysAgo(CREATED_RANGES.find((r) => r.value === filters.created)?.days ?? 30)
    : null

  return leads.filter((lead) => {
    if (lead.archivedAt) return false
    if (filters.stages.length) {
      if (!filters.stages.includes(lead.stage)) return false
    } else if (!filters.includeClosed && !isOpenStage(lead.stage)) {
      return false
    }
    if (filters.owners.length && !filters.owners.includes(lead.ownerUserId)) return false
    if (filters.sources.length && !filters.sources.includes(lead.originalSource)) return false
    if (filters.referrer && lead.referrerPersonId !== filters.referrer) return false
    if (filters.course && lead.courseInterestId !== filters.course) return false
    if (filters.branch && lead.branchId !== filters.branch) return false
    if (filters.unit && lead.unitId !== filters.unit) return false
    if (createdFrom && lead.createdAt.slice(0, 10) < createdFrom) return false
    if (filters.minDaysInStage !== undefined && lead.daysInStage < filters.minDaysInStage) return false

    if (filters.nextAction === 'yes' && !lead.nextAction) return false
    if (filters.nextAction === 'none' && lead.nextAction) return false
    if (filters.nextAction === 'overdue') {
      if (!lead.nextActionDueAt) return false
      if (lead.nextActionDueAt.slice(0, 10) >= TODAY) return false
    }

    if (q) {
      const person = personById.get(lead.personId as string)
      const haystack = [
        lead.ref,
        person ? `${person.firstName} ${person.lastName}` : '',
        person?.email ?? '',
        person?.phone ?? '',
        person?.whatsapp ?? '',
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }

    return true
  })
}

export function useFilteredLeads(filters: LeadFilterInput): Lead[] {
  const leads = useCollection(leadsCollection)
  const people = useCollection(peopleCollection)

  return useMemo(() => {
    const personById = new Map(people.map((p) => [p.id as string, p]))
    return applyLeadFilters(leads, filters, personById)
  }, [leads, people, filters])
}

export function isOpenLead(lead: Lead): boolean {
  return isOpenStage(lead.stage)
}
