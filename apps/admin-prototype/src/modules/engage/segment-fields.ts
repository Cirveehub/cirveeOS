/**
 * What a segment can actually be built from.
 *
 * The PRD's hard rule for this module is that **there is no separate marketing
 * contact list** — a segment is a saved query over `Person` records. So every
 * field below resolves to a set of `PersonId`s by reading the same collections
 * the rest of the app reads: relationships, leads, enrolments, invoices. There
 * is no membership table anywhere, and the member count a segment shows is
 * computed here rather than typed in.
 *
 * Only fields the seed can genuinely answer appear. A field nobody can query
 * is worse than a missing one, because it makes the count a lie.
 */

import {
  branchesCollection,
  coursesCollection,
  enrollmentsCollection,
  invoicesCollection,
  leadsCollection,
  peopleCollection,
  relationshipsCollection,
  unitsCollection,
} from '@/mocks'
import type { ConditionGroup } from '@/mocks'

export interface FieldOption {
  value: string
  label: string
}

export type OperatorKey = 'is' | 'is_not' | 'gte' | 'gt'

export interface SegmentField {
  key: string
  label: string
  /** Which side of the "attribute or behaviour" split this sits on. */
  group: 'Person attribute' | 'Lead behaviour' | 'Enrolment' | 'Payment'
  hint: string
  input: 'select' | 'number'
  operators: OperatorKey[]
  options: () => FieldOption[]
  /** The people matching this one rule, resolved live over the collections. */
  resolve: (operator: OperatorKey, value: string) => Set<string>
  /** Plain English, for `criteriaSummary`. */
  describe: (operator: OperatorKey, value: string) => string
}

const OPERATOR_LABEL: Record<OperatorKey, string> = {
  is: 'is',
  is_not: 'is not',
  gte: 'is at least',
  gt: 'is more than',
}

export function operatorLabel(key: OperatorKey): string {
  return OPERATOR_LABEL[key]
}

function humanise(value: string): string {
  return value.replace(/_/g, ' ')
}

function distinct(values: string[]): FieldOption[] {
  return [...new Set(values)].sort().map((value) => ({ value, label: humanise(value) }))
}

function setOf<T>(rows: T[], pick: (row: T) => string): Set<string> {
  return new Set(rows.map(pick))
}

/** `is_not` over a person-scoped field means "everyone except the matches". */
function invert(matches: Set<string>): Set<string> {
  const all = new Set(peopleCollection.all().map((p) => p.id as string))
  for (const id of matches) all.delete(id)
  return all
}

export const SEGMENT_FIELDS: SegmentField[] = [
  {
    key: 'relationship.type',
    label: 'Relationship',
    group: 'Person attribute',
    hint: 'One person can hold several at once — a lead who became a student and later an alumnus is one record with three relationships.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => distinct(relationshipsCollection.all().map((r) => r.type)),
    resolve: (operator, value) => {
      const matches = setOf(
        relationshipsCollection.where((r) => r.type === value && r.status === 'active'),
        (r) => r.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) => `Person ${operator === 'is_not' ? 'has no' : 'has an'} active ${humanise(value)} relationship`,
  },
  {
    key: 'person.primaryBranchId',
    label: 'Branch',
    group: 'Person attribute',
    hint: 'The branch on the Person record, not on any one enrolment.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => branchesCollection.all().map((b) => ({ value: b.id as string, label: b.name })),
    resolve: (operator, value) => {
      const matches = setOf(
        peopleCollection.where((p) => p.primaryBranchId === value),
        (p) => p.id as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) =>
      `Primary branch ${OPERATOR_LABEL[operator]} ${branchesCollection.find(value)?.name ?? value}`,
  },
  {
    key: 'person.state',
    label: 'State',
    group: 'Person attribute',
    hint: 'Where the person lives, as captured on their record.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => distinct(peopleCollection.all().map((p) => p.state)),
    resolve: (operator, value) => {
      const matches = setOf(
        peopleCollection.where((p) => p.state === value),
        (p) => p.id as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) => `State ${OPERATOR_LABEL[operator]} ${value}`,
  },
  {
    key: 'lead.stage',
    label: 'Lead stage',
    group: 'Lead behaviour',
    hint: 'The stage of any lead this person holds.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => distinct(leadsCollection.all().map((l) => l.stage)),
    resolve: (operator, value) => {
      const matches = setOf(
        leadsCollection.where((l) => l.stage === value),
        (l) => l.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) => `Lead stage ${OPERATOR_LABEL[operator]} ${humanise(value)}`,
  },
  {
    key: 'lead.courseInterestId',
    label: 'Course interest',
    group: 'Lead behaviour',
    hint: 'What the lead enquired about, which is not the same as what they enrolled on.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => coursesCollection.all().map((c) => ({ value: c.id as string, label: c.title })),
    resolve: (operator, value) => {
      const matches = setOf(
        leadsCollection.where((l) => l.courseInterestId === value),
        (l) => l.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) =>
      `Course interest ${OPERATOR_LABEL[operator]} ${coursesCollection.find(value)?.title ?? value}`,
  },
  {
    key: 'lead.daysInStage',
    label: 'Days in current lead stage',
    group: 'Lead behaviour',
    hint: 'How long a lead has sat still. The usual re-engagement trigger.',
    input: 'number',
    operators: ['gte', 'gt'],
    options: () => [],
    resolve: (operator, value) => {
      const threshold = Number(value)
      if (!Number.isFinite(threshold)) return new Set<string>()
      return setOf(
        leadsCollection.where((l) => (operator === 'gt' ? l.daysInStage > threshold : l.daysInStage >= threshold)),
        (l) => l.personId as string,
      )
    },
    describe: (operator, value) => `Has been in the same lead stage for ${OPERATOR_LABEL[operator]} ${value} days`,
  },
  {
    key: 'enrollment.status',
    label: 'Enrolment status',
    group: 'Enrolment',
    hint: 'Across every cohort this person has ever joined.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => distinct(enrollmentsCollection.all().map((e) => e.status)),
    resolve: (operator, value) => {
      const matches = setOf(
        enrollmentsCollection.where((e) => e.status === value),
        (e) => e.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) => `Enrolment status ${OPERATOR_LABEL[operator]} ${humanise(value)}`,
  },
  {
    key: 'enrollment.courseId',
    label: 'Enrolled on course',
    group: 'Enrolment',
    hint: 'What they actually joined.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => coursesCollection.all().map((c) => ({ value: c.id as string, label: c.title })),
    resolve: (operator, value) => {
      const matches = setOf(
        enrollmentsCollection.where((e) => e.courseId === value),
        (e) => e.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) =>
      `Enrolled on ${coursesCollection.find(value)?.title ?? value}${operator === 'is_not' ? ' — excluded' : ''}`,
  },
  {
    key: 'enrollment.unitId',
    label: 'Unit',
    group: 'Enrolment',
    hint: 'Which business unit the person belongs to through an enrolment.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => unitsCollection.all().map((u) => ({ value: u.id as string, label: u.name })),
    resolve: (operator, value) => {
      const matches = setOf(
        enrollmentsCollection.where((e) => e.unitId === value),
        (e) => e.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) => `Unit ${OPERATOR_LABEL[operator]} ${unitsCollection.find(value)?.name ?? value}`,
  },
  {
    key: 'invoice.status',
    label: 'Invoice status',
    group: 'Payment',
    hint: 'Any invoice raised against this person.',
    input: 'select',
    operators: ['is', 'is_not'],
    options: () => distinct(invoicesCollection.all().map((i) => i.status)),
    resolve: (operator, value) => {
      const matches = setOf(
        invoicesCollection.where((i) => i.status === value && i.personId !== null),
        (i) => i.personId as string,
      )
      return operator === 'is_not' ? invert(matches) : matches
    },
    describe: (operator, value) => `Has an invoice whose status ${OPERATOR_LABEL[operator]} ${humanise(value)}`,
  },
  {
    key: 'invoice.balance',
    label: 'Outstanding balance, in naira',
    group: 'Payment',
    hint: 'Sums every open invoice against the person. Entered in naira; stored in kobo like all money.',
    input: 'number',
    operators: ['gte', 'gt'],
    options: () => [],
    resolve: (operator, value) => {
      const threshold = Number(value) * 100
      if (!Number.isFinite(threshold)) return new Set<string>()
      const byPerson = new Map<string, number>()
      for (const invoice of invoicesCollection.all()) {
        if (!invoice.personId || invoice.status === 'cancelled') continue
        byPerson.set(invoice.personId as string, (byPerson.get(invoice.personId as string) ?? 0) + invoice.balance)
      }
      const matches = new Set<string>()
      for (const [personId, balance] of byPerson) {
        if (operator === 'gt' ? balance > threshold : balance >= threshold) matches.add(personId)
      }
      return matches
    },
    describe: (operator, value) => `Outstanding balance ${OPERATOR_LABEL[operator]} ₦${Number(value).toLocaleString('en-NG')}`,
  },
]

export function findField(key: string): SegmentField | undefined {
  return SEGMENT_FIELDS.find((field) => field.key === key)
}

export interface DraftRule {
  id: string
  field: string
  operator: OperatorKey
  value: string
}

/** The people a draft segment would resolve to, right now. */
export function resolveMembers(operator: 'and' | 'or', rules: DraftRule[]): Set<string> {
  const usable = rules.filter((rule) => rule.value !== '')
  if (usable.length === 0) return new Set<string>()

  let accumulator: Set<string> | null = null
  for (const rule of usable) {
    const field = findField(rule.field)
    if (!field) continue
    const matches = field.resolve(rule.operator, rule.value)
    if (accumulator === null) {
      accumulator = new Set(matches)
      continue
    }
    if (operator === 'and') {
      accumulator = new Set([...accumulator].filter((id) => matches.has(id)))
    } else {
      for (const id of matches) accumulator.add(id)
    }
  }
  return accumulator ?? new Set<string>()
}

export function summarise(operator: 'and' | 'or', rules: DraftRule[]): string {
  const parts = rules
    .filter((rule) => rule.value !== '')
    .map((rule) => findField(rule.field)?.describe(rule.operator, rule.value))
    .filter((part): part is string => Boolean(part))
  if (parts.length === 0) return 'No criteria yet'
  return parts.join(operator === 'and' ? ', and ' : ', or ')
}

export function toConditionGroup(operator: 'and' | 'or', rules: DraftRule[]): ConditionGroup {
  return {
    operator,
    rules: rules
      .filter((rule) => rule.value !== '')
      .map((rule) => ({
        field: rule.field,
        op: rule.operator,
        value: findField(rule.field)?.input === 'number' ? Number(rule.value) : rule.value,
      })),
  }
}
