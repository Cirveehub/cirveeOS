/**
 * People — 640 Person records and the relationships that hang off them.
 *
 * One row per human being, ever. The same Person appears as lead, student,
 * alumna, referrer and parent where the story needs it; the Relationship rows
 * carry the dates, and they are **end-dated, never deleted**.
 *
 * Person slots, so every other seed file can address them:
 *
 * | Slots     | Who                                        | Count |
 * |-----------|--------------------------------------------|-------|
 * | 1–52      | The named cast and the 48 staff            |    52 |
 * | 53–301    | Historical students and alumni             |   249 |
 * | 302–611   | Leads from the trailing 90 days            |   310 |
 * | 612–640   | Parents and guardians of Teens students    |    29 |
 */

import {
  pid,
  relId,
  type Consent,
  type Person,
  type Relationship,
  type RelationshipType,
  type BranchId,
  type PersonId,
} from '@/mocks/types'
import { BR, P, STAFF_PERSON_SLOTS, UNIT, U, person } from '@/mocks/seed/ids'
import {
  audit,
  at,
  daysAgo,
  dtAgo,
  initialsOf,
  int,
  pad,
  personalEmail,
  phone,
  pick,
  rng,
  SYSTEM_USER,
  weighted,
} from '@/mocks/seed/_helpers'

/* -------------------------------------------------------------------------- */
/* Name pools                                                                 */
/* -------------------------------------------------------------------------- */

const YORUBA_FIRST = [
  'Adebayo', 'Oluwaseun', 'Yetunde', 'Damilola', 'Folake', 'Temitope', 'Tunde', 'Bukola',
  'Kehinde', 'Taiwo', 'Segun', 'Funmilayo', 'Olamide', 'Bolanle', 'Ayodeji', 'Simisola',
  'Gbenga', 'Morenike', 'Tobiloba', 'Adenike', 'Femi', 'Ronke', 'Wale', 'Yemisi',
  'Sade', 'Kunle', 'Toyin', 'Niyi', 'Bisi', 'Dele', 'Abiodun', 'Titilayo',
] as const

const YORUBA_LAST = [
  'Ogunlana', 'Adeyemi', 'Bakare', 'Adeleke', 'Salami', 'Adesina', 'Alabi', 'Adeyinka',
  'Ogundipe', 'Afolabi', 'Ajayi', 'Oyelaran', 'Balogun', 'Sotubo', 'Oyedepo', 'Adebisi',
  'Ogunyemi', 'Akinwale', 'Oladipo', 'Fashola', 'Oyetunde', 'Aderibigbe', 'Olaniyan', 'Sowunmi',
] as const

const IGBO_FIRST = [
  'Chidinma', 'Chiamaka', 'Ifeoma', 'Emeka', 'Blessing', 'Chukwuemeka', 'Amarachi', 'Nkechi',
  'Obinna', 'Adaeze', 'Uchenna', 'Chinelo', 'Ikenna', 'Ngozi', 'Somtochukwu', 'Chinwe',
  'Kelechi', 'Ebube', 'Ozioma', 'Nnamdi', 'Chidera', 'Oluchi', 'Ifeanyi', 'Adaobi',
] as const

const IGBO_LAST = [
  'Eze', 'Okonkwo', 'Nwosu', 'Okafor', 'Uche', 'Obi', 'Nwachukwu', 'Anyanwu',
  'Madu', 'Chukwu', 'Okoro', 'Nnaji', 'Iheanacho', 'Onyeka', 'Ezeani', 'Udeh',
  'Agu', 'Okeke', 'Mbanefo', 'Nwankwo',
] as const

const HAUSA_FIRST = [
  'Fatima', 'Musa', 'Aisha', 'Kabiru', 'Ibrahim', 'Hauwa', 'Zainab', 'Bashir',
  'Halima', 'Yusuf', 'Maryam', 'Abubakar', 'Amina', 'Nasiru', 'Rukayya', 'Suleiman',
  'Hadiza', 'Aliyu', 'Safiya', 'Jamila',
] as const

const HAUSA_LAST = [
  'Abdullahi', 'Danjuma', 'Bello', 'Lawal', 'Sani', 'Usman', 'Garba', 'Mohammed',
  'Yakubu', 'Shehu', 'Tanko', 'Adamu', 'Umar', 'Gambo',
] as const

/** A handful of non-Nigerian corporate contacts, per §B.1. */
const INTERNATIONAL = [
  ['Kwame', 'Mensah', 'Accra', 'Greater Accra', 'Ghana'],
  ['Wanjiru', 'Kamau', 'Nairobi', 'Nairobi', 'Kenya'],
  ['Thierno', 'Diallo', 'Dakar', 'Dakar', 'Senegal'],
  ['Claire', 'Dubois', 'Lagos', 'Lagos', 'France'],
  ['Rajesh', 'Patel', 'Lagos', 'Lagos', 'India'],
] as const

const PLACES: ReadonlyArray<readonly [string, string]> = [
  ['Ibadan', 'Oyo'], ['Ibadan', 'Oyo'], ['Ibadan', 'Oyo'],
  ['Lagos', 'Lagos'], ['Lagos', 'Lagos'],
  ['Abeokuta', 'Ogun'], ['Ilorin', 'Kwara'], ['Osogbo', 'Osun'],
  ['Abuja', 'FCT'], ['Port Harcourt', 'Rivers'], ['Enugu', 'Enugu'],
  ['Benin City', 'Edo'], ['Akure', 'Ondo'], ['Kano', 'Kano'], ['Kaduna', 'Kaduna'],
]

/* -------------------------------------------------------------------------- */
/* The named cast                                                             */
/* -------------------------------------------------------------------------- */

interface CastMember {
  slot: number
  first: string
  last: string
  email: string
  phone: string
  city: string
  state: string
  gender: 'male' | 'female'
  dob: string
  branch: BranchId
  tags: string[]
  createdAt: string
}

const CAST: CastMember[] = [
  { slot: 1, first: 'Adebayo', last: 'Ogunlana', email: 'adebayo.ogunlana@cirvee.com', phone: '+234 803 221 9041', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1988-03-14', branch: BR.ibadan, tags: ['staff', 'executive'], createdAt: '2021-02-01T09:00:00+01:00' },
  { slot: 2, first: 'Chidinma', last: 'Eze', email: 'chidinma.eze@cirvee.com', phone: '+234 806 114 2277', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1996-11-02', branch: BR.ibadan, tags: ['staff', 'sales'], createdAt: '2024-01-15T09:00:00+01:00' },
  { slot: 3, first: 'Ngozi', last: 'Adeyemi', email: 'ngozi.adeyemi@gmail.com', phone: '+234 805 663 1120', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1994-06-21', branch: BR.ibadan, tags: ['alumna', 'referrer', 'top-referrer'], createdAt: '2024-09-03T10:12:00+01:00' },
  { slot: 4, first: 'Chiamaka', last: 'Okonkwo', email: 'chiamaka.o@gmail.com', phone: '+234 807 442 9015', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1999-04-08', branch: BR.ibadan, tags: ['student', 'tcf-2026'], createdAt: '2026-08-04T11:26:00+01:00' },
  { slot: 5, first: 'Tunde', last: 'Bakare', email: 'tunde.bakare@cirvee.com', phone: '+234 803 990 4412', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1990-01-30', branch: BR.ibadan, tags: ['staff', 'tutor', 'data'], createdAt: '2022-06-01T09:00:00+01:00' },
  { slot: 6, first: 'Fatima', last: 'Abdullahi', email: 'fatima.abdullahi@cirvee.com', phone: '+234 810 227 6634', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1991-08-19', branch: BR.ibadan, tags: ['staff', 'finance'], createdAt: '2022-02-14T09:00:00+01:00' },
  { slot: 7, first: 'Oluwaseun', last: 'Adeleke', email: 'oluwaseun.adeleke@cirvee.com', phone: '+234 803 551 8890', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1984-12-05', branch: BR.ibadan, tags: ['staff', 'executive', 'finance'], createdAt: '2021-05-04T09:00:00+01:00' },
  { slot: 8, first: 'Ifeoma', last: 'Nwosu', email: 'ifeoma.nwosu@cirvee.com', phone: '+234 806 334 2218', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1989-02-27', branch: BR.ibadan, tags: ['staff', 'growth'], createdAt: '2021-09-13T09:00:00+01:00' },
  { slot: 9, first: 'Musa', last: 'Danjuma', email: 'musa.danjuma@cirvee.com', phone: '+234 805 118 7742', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1981-07-11', branch: BR.ibadan, tags: ['staff', 'executive', 'founder'], createdAt: '2021-02-01T09:00:00+01:00' },
  { slot: 10, first: 'Yetunde', last: 'Salami', email: 'yetunde.salami@cirvee.com', phone: '+234 813 664 1907', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1987-05-23', branch: BR.ibadan, tags: ['staff', 'people'], createdAt: '2022-03-07T09:00:00+01:00' },
  { slot: 11, first: 'Emeka', last: 'Okafor', email: 'emeka.okafor@cirvee.com', phone: '+234 807 229 5561', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1986-10-16', branch: BR.ibadan, tags: ['staff', 'academy'], createdAt: '2021-06-21T09:00:00+01:00' },
  { slot: 12, first: 'Blessing', last: 'Uche', email: 'blessing.uche@cirvee.com', phone: '+234 814 772 3309', city: 'Lagos', state: 'Lagos', gender: 'female', dob: '1995-09-09', branch: BR.lagos, tags: ['staff', 'sales'], createdAt: '2023-06-12T09:00:00+01:00' },
  { slot: 13, first: 'Kabiru', last: 'Lawal', email: 'kabiru.lawal@cirvee.com', phone: '+234 808 445 1182', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1992-12-01', branch: BR.ibadan, tags: ['staff', 'tutor', 'engineering'], createdAt: '2022-08-29T09:00:00+01:00' },
  { slot: 14, first: 'Damilola', last: 'Adeyinka', email: 'damilola.adeyinka@cirvee.com', phone: '+234 816 003 7724', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1993-03-03', branch: BR.ibadan, tags: ['staff', 'technology'], createdAt: '2021-08-02T09:00:00+01:00' },
  { slot: 15, first: 'Aisha', last: 'Bello', email: 'aisha.bello@cirvee.com', phone: '+234 703 556 8841', city: 'Abuja', state: 'FCT', gender: 'female', dob: '1994-01-18', branch: BR.virtual, tags: ['staff', 'sales', 'africa'], createdAt: '2024-02-05T09:00:00+01:00' },
  { slot: 16, first: 'Chukwuemeka', last: 'Obi', email: 'chukwuemeka.obi@cirvee.com', phone: '+234 706 118 2290', city: 'Lagos', state: 'Lagos', gender: 'male', dob: '1985-11-27', branch: BR.lagos, tags: ['staff', 'corporate'], createdAt: '2022-03-14T09:00:00+01:00' },
  { slot: 17, first: 'Folake', last: 'Adesina', email: 'folake.adesina@cirvee.com', phone: '+234 905 227 6613', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1997-07-07', branch: BR.ibadan, tags: ['staff', 'advisor'], createdAt: '2023-01-09T09:00:00+01:00' },
  { slot: 18, first: 'Ibrahim', last: 'Sani', email: 'ibrahim.sani@cirvee.com', phone: '+234 901 334 7751', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '1998-04-25', branch: BR.ibadan, tags: ['staff', 'finance'], createdAt: '2024-04-02T09:00:00+01:00' },
  { slot: 19, first: 'Temitope', last: 'Alabi', email: 'temitope.alabi@cirvee.com', phone: '+234 803 667 2214', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1992-02-11', branch: BR.ibadan, tags: ['staff', 'people', 'recruiting'], createdAt: '2023-02-20T09:00:00+01:00' },
  { slot: 20, first: 'Amarachi', last: 'Eze', email: 'amarachi.eze@cirvee.com', phone: '+234 806 990 1145', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1995-06-30', branch: BR.ibadan, tags: ['staff', 'marketing'], createdAt: '2022-11-07T09:00:00+01:00' },
  // Flow 5 side path: eligible on merit, blocked by a ₦120,000 outstanding balance.
  { slot: 21, first: 'Tunde', last: 'Adeyemi', email: 'tunde.adeyemi@yahoo.com', phone: '+234 805 771 2264', city: 'Ibadan', state: 'Oyo', gender: 'male', dob: '2000-09-12', branch: BR.ibadan, tags: ['student', 'balance-outstanding'], createdAt: '2026-06-18T14:02:00+01:00' },
  // The open duplicate of Chiamaka: same name, same phone, different email.
  { slot: 22, first: 'Chiamaka', last: 'Okonkwo', email: 'c.okonkwo@yahoo.com', phone: '+234 807 442 9015', city: 'Ibadan', state: 'Oyo', gender: 'female', dob: '1999-04-08', branch: BR.ibadan, tags: ['duplicate-candidate'], createdAt: '2026-09-02T16:41:00+01:00' },
]

/* -------------------------------------------------------------------------- */
/* Generated persons                                                          */
/* -------------------------------------------------------------------------- */

const r = rng(20260920)

function generatedName(i: number): { first: string; last: string; gender: 'male' | 'female' } {
  const group = weighted(r, [
    ['yoruba', 44],
    ['igbo', 34],
    ['hausa', 22],
  ] as const)
  const first =
    group === 'yoruba' ? pick(r, YORUBA_FIRST) : group === 'igbo' ? pick(r, IGBO_FIRST) : pick(r, HAUSA_FIRST)
  const last =
    group === 'yoruba' ? pick(r, YORUBA_LAST) : group === 'igbo' ? pick(r, IGBO_LAST) : pick(r, HAUSA_LAST)
  const feminine = /a$|e$|u$/.test(first) && !['Emeka', 'Obinna', 'Ikenna', 'Musa', 'Kabiru'].includes(first)
  void i
  return { first, last, gender: feminine ? 'female' : 'male' }
}

function consentsFor(createdAt: string, granted: boolean, guardian?: PersonId): Consent[] {
  const base: Consent[] = [
    { type: 'data_processing', granted: true, capturedAt: createdAt, capturedVia: 'form', capturedBy: null },
    { type: 'communications', granted, capturedAt: createdAt, capturedVia: 'form', capturedBy: null },
  ]
  if (guardian) {
    base.push({
      type: 'photography',
      granted: true,
      capturedAt: createdAt,
      capturedVia: 'parent_portal',
      capturedBy: null,
      guardianPersonId: guardian,
    })
  }
  return base
}

/** Slot ranges, so the rest of the seed can address blocks by name. */
export const SLOTS = {
  cast: { from: 1, to: 52 },
  /** Students and alumni from before the current 90-day window. */
  alumni: { from: 53, to: 301 },
  /** One person per generated lead. */
  leads: { from: 302, to: 611 },
  /** Parents and guardians of Teens students. */
  guardians: { from: 612, to: 640 },
} as const

const persons: Person[] = []

/* ── 1–52: the named cast, then the generated staff tail ────────────────── */

for (const c of CAST) {
  persons.push({
    id: person(c.slot),
    firstName: c.first,
    lastName: c.last,
    email: c.email,
    phone: c.phone,
    whatsapp: c.phone,
    dateOfBirth: c.dob,
    gender: c.gender,
    city: c.city,
    state: c.state,
    country: 'Nigeria',
    avatarInitials: initialsOf(c.first, c.last),
    primaryBranchId: c.branch,
    tags: c.tags,
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: consentsFor(c.createdAt, true),
    ...audit(c.createdAt, SYSTEM_USER),
  })
}

// Slots 23–52: the 30 staff who are not part of the named cast.
for (let slot = 23; slot <= 52; slot++) {
  const { first, last, gender } = generatedName(slot)
  const [city, state] = pick(r, PLACES)
  const createdAt = at(daysAgo(int(r, 400, 1400)), 9, 0)
  const ph = phone(r)
  persons.push({
    id: person(slot),
    firstName: first,
    lastName: last,
    email: `${first.toLowerCase()}.${last.toLowerCase()}@cirvee.com`,
    phone: ph,
    whatsapp: ph,
    dateOfBirth: `19${int(r, 85, 99)}-${pad(int(r, 1, 12), 2)}-${pad(int(r, 1, 28), 2)}`,
    gender,
    city,
    state,
    country: 'Nigeria',
    avatarInitials: initialsOf(first, last),
    primaryBranchId: slot % 6 === 0 ? BR.lagos : slot % 9 === 0 ? BR.virtual : BR.ibadan,
    tags: ['staff'],
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: consentsFor(createdAt, true),
    ...audit(createdAt, SYSTEM_USER),
  })
}

/* ── 53–301: historical students and alumni ─────────────────────────────── */

for (let slot = SLOTS.alumni.from; slot <= SLOTS.alumni.to; slot++) {
  const { first, last, gender } = generatedName(slot)
  const [city, state] = pick(r, PLACES)
  const age = int(r, 200, 900)
  const createdAt = at(daysAgo(age), int(r, 8, 18), int(r, 0, 59))
  const ph = phone(r)
  const isAlumnus = slot <= 200
  persons.push({
    id: person(slot),
    firstName: first,
    lastName: last,
    email: personalEmail(r, first, last, slot),
    phone: ph,
    whatsapp: ph,
    dateOfBirth: `${int(r, 1988, 2006)}-${pad(int(r, 1, 12), 2)}-${pad(int(r, 1, 28), 2)}`,
    gender,
    city,
    state,
    country: 'Nigeria',
    avatarInitials: initialsOf(first, last),
    primaryBranchId: slot % 5 === 0 ? BR.lagos : slot % 7 === 0 ? BR.virtual : BR.ibadan,
    tags: isAlumnus ? ['alumnus'] : ['student'],
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: consentsFor(createdAt, r() > 0.18),
    ...audit(createdAt, SYSTEM_USER),
  })
}

/* ── 302–611: one person per lead in the trailing 90 days ───────────────── */

for (let slot = SLOTS.leads.from; slot <= SLOTS.leads.to; slot++) {
  const { first, last, gender } = generatedName(slot)
  const [city, state] = pick(r, PLACES)
  const ageDays = Math.floor(90 * Math.pow(r(), 1.6))
  const createdAt = at(daysAgo(ageDays), int(r, 7, 21), int(r, 0, 59))
  const ph = phone(r)
  const hasEmail = r() > 0.06
  persons.push({
    id: person(slot),
    firstName: first,
    lastName: last,
    email: hasEmail ? personalEmail(r, first, last, slot) : null,
    phone: ph,
    whatsapp: r() > 0.12 ? ph : null,
    dateOfBirth: r() > 0.35 ? `${int(r, 1990, 2007)}-${pad(int(r, 1, 12), 2)}-${pad(int(r, 1, 28), 2)}` : null,
    gender,
    city,
    state,
    country: 'Nigeria',
    avatarInitials: initialsOf(first, last),
    primaryBranchId: slot % 5 === 0 ? BR.lagos : slot % 6 === 0 ? BR.virtual : BR.ibadan,
    tags: ['lead'],
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: consentsFor(createdAt, r() > 0.25),
    ...audit(createdAt, SYSTEM_USER),
  })
}

/* ── 612–640: guardians, plus the five international corporate contacts ── */

for (let slot = SLOTS.guardians.from; slot <= SLOTS.guardians.to; slot++) {
  const intl = INTERNATIONAL[slot - SLOTS.guardians.to + 4]
  const useIntl = slot > SLOTS.guardians.to - 5 && intl !== undefined
  const gen = generatedName(slot)
  const first = useIntl ? intl[0] : gen.first
  const last = useIntl ? intl[1] : gen.last
  const [city, state] = useIntl ? [intl[2], intl[3]] : pick(r, PLACES)
  const country = useIntl ? intl[4] : 'Nigeria'
  const createdAt = at(daysAgo(int(r, 60, 700)), int(r, 8, 19), int(r, 0, 59))
  const ph = phone(r)
  persons.push({
    id: person(slot),
    firstName: first,
    lastName: last,
    email: useIntl
      ? `${first.toLowerCase()}.${last.toLowerCase()}@${last.toLowerCase()}group.com`
      : personalEmail(r, first, last, slot),
    phone: ph,
    whatsapp: ph,
    dateOfBirth: `${int(r, 1972, 1990)}-${pad(int(r, 1, 12), 2)}-${pad(int(r, 1, 28), 2)}`,
    gender: gen.gender,
    city,
    state,
    country,
    avatarInitials: initialsOf(first, last),
    primaryBranchId: useIntl ? BR.virtual : BR.ibadan,
    tags: useIntl ? ['corporate-contact'] : ['parent', 'teens'],
    mergedIntoPersonId: null,
    mergedFromPersonIds: [],
    consents: consentsFor(createdAt, true),
    ...audit(createdAt, SYSTEM_USER),
  })
}

/* ── One completed merge, so Person 360 has a merged timeline to show ───── */

// per-0300 lost a merge into per-0299 back in June. The row stays forever.
const loser = persons.find((p) => p.id === person(300))
const winner = persons.find((p) => p.id === person(299))
if (loser && winner) {
  loser.mergedIntoPersonId = winner.id
  loser.tags = [...loser.tags, 'merged']
  loser.archivedAt = at('2026-06-11', 14, 5)
  loser.archivedReason = 'Merged into per-0299 — same phone and date of birth.'
  winner.mergedFromPersonIds = [loser.id]
}

/* ── 641: the one sponsor the seed names — funds the Teens scholarship line ── */

const SPONSOR_PERSON_ID = person(641)

persons.push({
  id: SPONSOR_PERSON_ID,
  firstName: 'Aderonke',
  lastName: 'Fashola-Bello',
  email: 'aderonke@fashola-bellofoundation.org',
  phone: '+2348021234567',
  whatsapp: '+2348021234567',
  dateOfBirth: null,
  gender: 'female',
  city: 'Lagos',
  state: 'Lagos',
  country: 'Nigeria',
  avatarInitials: initialsOf('Aderonke', 'Fashola-Bello'),
  primaryBranchId: BR.lagos,
  tags: ['sponsor'],
  mergedIntoPersonId: null,
  mergedFromPersonIds: [],
  consents: consentsFor('2025-02-01T09:00:00+01:00', true),
  ...audit('2025-02-01T09:00:00+01:00', SYSTEM_USER),
})

export const people: Person[] = persons

/** Lookup used by selectors and by the seed itself. */
export const personById = new Map<string, Person>(people.map((p) => [p.id, p]))

export function fullName(id: PersonId): string {
  const p = personById.get(id)
  return p ? `${p.firstName} ${p.lastName}` : id
}

/* -------------------------------------------------------------------------- */
/* Relationships                                                              */
/* -------------------------------------------------------------------------- */

let relSeq = 0
function rel(
  personId: PersonId,
  type: RelationshipType,
  startDate: string,
  extra: Partial<Relationship> = {},
): Relationship {
  relSeq += 1
  return {
    id: relId(`rel-${pad(relSeq, 4)}`),
    personId,
    type,
    startDate,
    endDate: null,
    status: 'active',
    unitId: null,
    branchId: null,
    relatedRecordId: null,
    ...audit(at(startDate, 9, 0), SYSTEM_USER),
    ...extra,
  }
}

const relationships: Relationship[] = []

/* ── Chiamaka's arc — the one Flow 5 step 17 inspects ───────────────────── */

relationships.push(
  rel(P.chiamaka, 'event_attendee', '2026-08-04', {
    unitId: UNIT.tcf,
    branchId: BR.ibadan,
    relatedRecordId: 'EVT-TCF-2026',
  }),
  rel(P.chiamaka, 'lead', '2026-08-04', {
    endDate: '2026-08-08',
    status: 'ended',
    endReason: 'Converted to admission ADM-2026-0151',
    unitId: UNIT.academy,
    branchId: BR.ibadan,
    relatedRecordId: 'CIR-L-0688',
  }),
  rel(P.chiamaka, 'student', '2026-08-08', {
    unitId: UNIT.academy,
    branchId: BR.ibadan,
    relatedRecordId: 'enr-0151',
  }),
)

/* ── Ngozi: alumna and the top referrer ─────────────────────────────────── */

relationships.push(
  rel(P.ngozi, 'lead', '2024-09-03', {
    endDate: '2024-09-19',
    status: 'ended',
    endReason: 'Converted',
    unitId: UNIT.academy,
    branchId: BR.ibadan,
  }),
  rel(P.ngozi, 'student', '2024-09-19', {
    endDate: '2025-02-28',
    status: 'ended',
    endReason: 'Completed Data Analysis Cohort 6',
    unitId: UNIT.academy,
    branchId: BR.ibadan,
  }),
  rel(P.ngozi, 'alumnus', '2025-02-28', { unitId: UNIT.academy, branchId: BR.ibadan }),
  rel(P.ngozi, 'referrer', '2025-03-11', {
    unitId: UNIT.academy,
    branchId: BR.ibadan,
    relatedRecordId: 'ref-0142',
  }),
)

/* ── Tunde Adeyemi: current student with a balance ──────────────────────── */

relationships.push(
  rel(P.tundeAdeyemi, 'lead', '2026-06-18', {
    endDate: '2026-06-29',
    status: 'ended',
    endReason: 'Converted',
    unitId: UNIT.academy,
    branchId: BR.ibadan,
  }),
  rel(P.tundeAdeyemi, 'student', '2026-06-29', {
    unitId: UNIT.academy,
    branchId: BR.ibadan,
    relatedRecordId: 'enr-0149',
  }),
)

/* ── Staff ──────────────────────────────────────────────────────────────── */

STAFF_PERSON_SLOTS.forEach((slot, i) => {
  const p = personById.get(person(slot))
  if (!p) return
  relationships.push(
    rel(p.id, 'employee', p.createdAt.slice(0, 10), {
      branchId: p.primaryBranchId,
      unitId: i % 4 === 0 ? UNIT.dexurb : UNIT.academy,
      relatedRecordId: `emp-${pad(i + 1)}`,
    }),
  )
  // The two named tutors also carry a tutor relationship.
  if (slot === 5 || slot === 13) {
    relationships.push(rel(p.id, 'tutor', p.createdAt.slice(0, 10), { branchId: BR.ibadan, unitId: UNIT.academy }))
  }
})

/* ── Alumni and historical students ─────────────────────────────────────── */

for (let slot = SLOTS.alumni.from; slot <= SLOTS.alumni.to; slot++) {
  const p = personById.get(person(slot))
  if (!p) continue
  const start = p.createdAt.slice(0, 10)
  const alumnus = p.tags.includes('alumnus')
  const studyEnd = daysAgo(int(r, 30, 260))
  relationships.push(
    rel(p.id, 'lead', start, {
      endDate: start,
      status: 'ended',
      endReason: 'Converted',
      branchId: p.primaryBranchId,
      unitId: UNIT.academy,
    }),
    rel(p.id, 'student', start, {
      endDate: alumnus ? studyEnd : null,
      status: alumnus ? 'ended' : 'active',
      endReason: alumnus ? 'Completed programme' : undefined,
      branchId: p.primaryBranchId,
      unitId: UNIT.academy,
      // The enrolment id is derived from the admission, which does not exist
      // yet at this point in the seed. Person 360 resolves it by personId.
      relatedRecordId: null,
    }),
  )
  if (alumnus) {
    relationships.push(rel(p.id, 'alumnus', studyEnd, { branchId: p.primaryBranchId, unitId: UNIT.academy }))
    // Every graduate is issued a referral code on the day they graduate — that
    // is why there are 180-odd active referrers against 15 courses.
    relationships.push(
      rel(p.id, 'referrer', studyEnd, {
        branchId: p.primaryBranchId,
        unitId: UNIT.academy,
        // referral.ts owns the profile id; Person 360 resolves it by personId.
        relatedRecordId: null,
      }),
    )
  }
}

/* ── Leads ──────────────────────────────────────────────────────────────── */

for (let slot = SLOTS.leads.from; slot <= SLOTS.leads.to; slot++) {
  const p = personById.get(person(slot))
  if (!p) continue
  relationships.push(
    rel(p.id, 'lead', p.createdAt.slice(0, 10), {
      branchId: p.primaryBranchId,
      unitId: UNIT.academy,
      relatedRecordId: `lead-${pad(slot)}`,
    }),
  )
}

/* ── Guardians and corporate contacts ───────────────────────────────────── */

for (let slot = SLOTS.guardians.from; slot <= SLOTS.guardians.to; slot++) {
  const p = personById.get(person(slot))
  if (!p) continue
  const type: RelationshipType = p.tags.includes('corporate-contact') ? 'corporate_contact' : 'parent_guardian'
  relationships.push(
    rel(p.id, type, p.createdAt.slice(0, 10), {
      branchId: p.primaryBranchId,
      unitId: p.tags.includes('corporate-contact') ? UNIT.corporate : UNIT.teens,
      linkedPersonId: type === 'parent_guardian' ? person(slot - 500) : undefined,
    }),
  )
  // Teens parents refer other parents — the strongest channel the unit has.
  if (type === 'parent_guardian') {
    relationships.push(
      rel(p.id, 'referrer', p.createdAt.slice(0, 10), {
        branchId: p.primaryBranchId,
        unitId: UNIT.teens,
        relatedRecordId: null,
      }),
    )
  }
}

/* Five staff also carry a referrer relationship — the staff-referral rule. */
for (const slot of [23, 27, 31, 35, 39]) {
  const p = personById.get(person(slot))
  if (!p) continue
  relationships.push(
    rel(p.id, 'referrer', '2026-01-04', { branchId: p.primaryBranchId, unitId: UNIT.academy, relatedRecordId: null }),
  )
}

/* ── One suspended referrer, so the status filter has something to find ── */

relationships.push(
  rel(person(205), 'referrer', '2026-02-14', {
    status: 'suspended',
    branchId: BR.ibadan,
    unitId: UNIT.academy,
    relatedRecordId: null,
    endReason: 'Self-referral attempt under review',
    ...audit(at('2026-02-14', 9, 0), U.ifeoma),
  }),
)

// Academy, not Teens: every seeded OutcomeRecord sits under Academy courses,
// and a sponsor whose home page shows no beneficiaries is a worse demo of the
// role than a sponsor whose unit happens not to match the brief description.
relationships.push(
  rel(SPONSOR_PERSON_ID, 'sponsor', '2025-02-01', {
    branchId: BR.lagos,
    unitId: UNIT.academy,
    relatedRecordId: 'sponsorship-academy-2025',
  }),
)

export const personRelationships: Relationship[] = relationships

/** Convenience index for Person 360 and the selectors. */
export const relationshipsByPerson = new Map<string, Relationship[]>()
for (const rl of personRelationships) {
  const list = relationshipsByPerson.get(rl.personId) ?? []
  list.push(rl)
  relationshipsByPerson.set(rl.personId, list)
}

/** Person ids that are currently referrers — referral.ts builds profiles from this. */
export const referrerPersonIds: PersonId[] = personRelationships
  .filter((rl) => rl.type === 'referrer')
  .map((rl) => rl.personId)

/** Person ids that are alumni — outcomes, testimonials and campaigns read this. */
export const alumniPersonIds: PersonId[] = personRelationships
  .filter((rl) => rl.type === 'alumnus')
  .map((rl) => rl.personId)

/** Every person slot that carries a student relationship, in slot order. */
export const studentPersonIds: PersonId[] = personRelationships
  .filter((rl) => rl.type === 'student')
  .map((rl) => rl.personId)

void pid
void dtAgo
