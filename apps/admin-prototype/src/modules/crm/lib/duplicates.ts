import {
  admissionsCollection,
  activitiesCollection,
  invoicesCollection,
  leadsCollection,
  peopleCollection,
  relationshipsCollection,
} from '@/mocks'
import type { DuplicateMatchField, Person, PersonId } from '@/mocks/types'

export function normalisePhone(value: string | null | undefined): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '')
  return digits.length >= 9 ? digits.slice(-9) : digits
}

export function normaliseEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export interface DuplicateMatch {
  person: Person
  score: number
  matchedFields: DuplicateMatchField[]
}

const FIELD_WEIGHT: Record<DuplicateMatchField, number> = {
  email: 55,
  phone: 40,
  whatsapp: 30,
  name: 20,
  dob: 10,
}

export interface DuplicateProbe {
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  firstName?: string | null
  lastName?: string | null
  excludePersonId?: PersonId | null
}

export function findDuplicates(probe: DuplicateProbe): DuplicateMatch[] {
  const email = normaliseEmail(probe.email)
  const phone = normalisePhone(probe.phone)
  const whatsapp = normalisePhone(probe.whatsapp)
  const first = (probe.firstName ?? '').trim().toLowerCase()
  const last = (probe.lastName ?? '').trim().toLowerCase()

  if (!email && !phone && !whatsapp) return []

  const matches: DuplicateMatch[] = []

  for (const person of peopleCollection.all()) {
    if (person.mergedIntoPersonId) continue
    if (probe.excludePersonId && person.id === probe.excludePersonId) continue

    const fields: DuplicateMatchField[] = []
    if (email && normaliseEmail(person.email) === email) fields.push('email')
    if (phone && normalisePhone(person.phone) === phone) fields.push('phone')
    if (whatsapp && normalisePhone(person.whatsapp) === whatsapp) fields.push('whatsapp')
    if (!fields.length) continue

    if (
      first &&
      last &&
      person.firstName.toLowerCase() === first &&
      person.lastName.toLowerCase() === last
    ) {
      fields.push('name')
    }

    const raw = fields.reduce((acc, f) => acc + FIELD_WEIGHT[f], 0)
    matches.push({ person, score: Math.min(99, raw), matchedFields: fields })
  }

  return matches.sort((a, b) => b.score - a.score)
}

export interface AttachedRecords {
  leads: number
  admissions: number
  invoices: number
  activities: number
  relationships: number
  lastActivityAt: string | null
}

export function attachedRecords(personId: PersonId): AttachedRecords {
  const activities = activitiesCollection.where(
    (a) => a.subjectType === 'person' && a.subjectId === (personId as string),
  )
  const leads = leadsCollection.where((l) => l.personId === personId)
  const leadActivities = activitiesCollection.where(
    (a) => a.subjectType === 'lead' && leads.some((l) => (l.id as string) === a.subjectId),
  )
  const all = [...activities, ...leadActivities]
  const lastActivityAt = all.length
    ? all.map((a) => a.createdAt).sort((a, b) => b.localeCompare(a))[0]
    : null

  return {
    leads: leads.length,
    admissions: admissionsCollection.count((a) => a.personId === personId),
    invoices: invoicesCollection.count((i) => i.personId === personId),
    activities: all.length,
    relationships: relationshipsCollection.count((r) => r.personId === personId),
    lastActivityAt,
  }
}

export function describeAttached(records: AttachedRecords): string {
  const parts: string[] = []
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`)
  }
  add(records.leads, 'lead', 'leads')
  add(records.admissions, 'admission', 'admissions')
  add(records.invoices, 'invoice', 'invoices')
  add(records.activities, 'activity', 'activities')
  if (!parts.length) return 'Nothing is attached to this record'
  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}
