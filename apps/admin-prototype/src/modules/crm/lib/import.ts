import { branchesCollection, coursesCollection, duplicateCandidatesCollection } from '@/mocks'
import {
  dupeId,
  type BranchId,
  type Course,
  type DuplicateCandidate,
  type LeadSource,
  type UnitId,
} from '@/mocks/types'
import { findDuplicates, type DuplicateMatch } from './duplicates'
import { ALL_SOURCES, SOURCE_LABELS } from './lookups'
import { suggestOwner } from './routing'
import { createLead, createPerson, nowIso } from './writes'

export type ImportTarget =
  | 'name'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'course'
  | 'source'
  | 'ignore'

export const IMPORT_TARGETS: Array<{ value: ImportTarget; label: string }> = [
  { value: 'name', label: 'Full name' },
  { value: 'firstName', label: 'First name' },
  { value: 'lastName', label: 'Last name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'course', label: 'Course' },
  { value: 'source', label: 'Came via' },
  { value: 'ignore', label: 'Skip this column' },
]

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^﻿/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  const [headers = [], ...body] = nonEmpty
  return { headers: headers.map((h) => h.trim()), rows: body }
}

export function guessMapping(headers: string[]): Record<string, ImportTarget> {
  const out: Record<string, ImportTarget> = {}
  for (const header of headers) {
    const h = header.toLowerCase()
    if (/first/.test(h)) out[header] = 'firstName'
    else if (/last|surname|family/.test(h)) out[header] = 'lastName'
    else if (/^(full )?name$|student|contact name/.test(h)) out[header] = 'name'
    else if (/mail/.test(h)) out[header] = 'email'
    else if (/whats/.test(h)) out[header] = 'whatsapp'
    else if (/phone|mobile|tel|number/.test(h)) out[header] = 'phone'
    else if (/course|programme|program|interest/.test(h)) out[header] = 'course'
    else if (/source|channel|came|via|origin/.test(h)) out[header] = 'source'
    else out[header] = 'ignore'
  }
  return out
}

export interface ImportRow {
  index: number
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  whatsapp: string | null
  courseText: string
  course: Course | undefined
  sourceText: string
  source: LeadSource | null
  status: 'new' | 'duplicate' | 'skipped'
  match: DuplicateMatch | null
  problem: string | null
}

export interface ImportAnalysis {
  rows: ImportRow[]
  counts: { total: number; fresh: number; duplicates: number; skipped: number }
}

function matchCourse(text: string): Course | undefined {
  const q = text.trim().toLowerCase()
  if (!q) return undefined
  const courses = coursesCollection.all().filter((c) => c.status !== 'archived')
  return (
    courses.find((c) => c.title.toLowerCase() === q || c.code.toLowerCase() === q) ??
    courses.find((c) => c.title.toLowerCase().includes(q) || q.includes(c.title.toLowerCase()))
  )
}

function matchSource(text: string): LeadSource | null {
  const q = text.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
  if (!q) return null
  const byLabel = ALL_SOURCES.find(
    (s) => SOURCE_LABELS[s].toLowerCase() === q || s.replace(/_/g, ' ') === q,
  )
  if (byLabel) return byLabel
  if (/whatsapp/.test(q)) return 'whatsapp'
  if (/insta/.test(q)) return 'instagram_dm'
  if (/facebook|fb/.test(q)) return 'facebook_ad'
  if (/google/.test(q)) return 'google_ad'
  if (/refer/.test(q)) return 'referral_link'
  if (/event|scan/.test(q)) return 'event_scan'
  if (/walk|kiosk/.test(q)) return 'walk_in_kiosk'
  if (/web|site|form/.test(q)) return 'website_form'
  if (/phone|call/.test(q)) return 'phone'
  if (/alumn|word/.test(q)) return 'alumni_word_of_mouth'
  return null
}

export function analyseImport(parsed: ParsedCsv, mapping: Record<string, ImportTarget>): ImportAnalysis {
  const col = (target: ImportTarget) => parsed.headers.findIndex((h) => mapping[h] === target)
  const idx = {
    name: col('name'),
    firstName: col('firstName'),
    lastName: col('lastName'),
    email: col('email'),
    phone: col('phone'),
    whatsapp: col('whatsapp'),
    course: col('course'),
    source: col('source'),
  }
  const read = (row: string[], i: number) => (i >= 0 ? (row[i] ?? '').trim() : '')

  const rows: ImportRow[] = parsed.rows.map((raw, index) => {
    let firstName = read(raw, idx.firstName)
    let lastName = read(raw, idx.lastName)
    if (!firstName && !lastName && idx.name >= 0) {
      const parts = read(raw, idx.name).split(/\s+/).filter(Boolean)
      firstName = parts[0] ?? ''
      lastName = parts.slice(1).join(' ')
    }
    const email = read(raw, idx.email) || null
    const phone = read(raw, idx.phone) || null
    const whatsapp = read(raw, idx.whatsapp) || phone
    const courseText = read(raw, idx.course)
    const sourceText = read(raw, idx.source)

    const base: Omit<ImportRow, 'status' | 'match' | 'problem'> = {
      index,
      firstName,
      lastName,
      email,
      phone,
      whatsapp,
      courseText,
      course: matchCourse(courseText),
      sourceText,
      source: matchSource(sourceText),
    }

    if (!firstName) return { ...base, status: 'skipped', match: null, problem: 'No name' }
    if (!email && !phone) {
      return { ...base, status: 'skipped', match: null, problem: 'No phone or email' }
    }
    const matches = findDuplicates({ email, phone, whatsapp, firstName, lastName })
    if (matches.length) return { ...base, status: 'duplicate', match: matches[0], problem: null }
    return { ...base, status: 'new', match: null, problem: null }
  })

  return {
    rows,
    counts: {
      total: rows.length,
      fresh: rows.filter((r) => r.status === 'new').length,
      duplicates: rows.filter((r) => r.status === 'duplicate').length,
      skipped: rows.filter((r) => r.status === 'skipped').length,
    },
  }
}

export interface ImportOptions {
  branchId: BranchId
  unitId: UnitId
  defaultSource: LeadSource
}

export interface ImportOutcome {
  created: number
  flagged: number
  skipped: number
}

// A duplicate row still lands as a person and an enquiry, paired with its match in the review queue; merging keeps both histories.
export function runImport(analysis: ImportAnalysis, options: ImportOptions): ImportOutcome {
  const branch = branchesCollection.find(options.branchId)
  const today = nowIso().slice(0, 10)
  let created = 0
  let flagged = 0

  for (const row of analysis.rows) {
    if (row.status === 'skipped') continue
    const person = createPerson({
      firstName: row.firstName,
      lastName: row.lastName || '—',
      email: row.email,
      phone: row.phone,
      whatsapp: row.whatsapp,
      city: '',
      state: '',
      primaryBranchId: options.branchId,
    })
    const course = row.course
    const owner = suggestOwner(options.branchId, branch?.name)
    createLead({
      personId: person.id,
      courseInterestId: course?.id ?? null,
      mode: 'on_campus',
      branchId: options.branchId,
      unitId: course?.unitId ?? options.unitId,
      source: row.source ?? options.defaultSource,
      campaignId: null,
      utm: {},
      landingPage: null,
      referrerPersonId: null,
      ownerUserId: owner.ownerUserId,
      quotedValue: course?.listPrice ?? null,
      nextAction: 'First reply',
      nextActionDueAt: `${today}T17:00:00+01:00`,
      notes: row.courseText && !course ? `Asked about: ${row.courseText}` : '',
      routingRule: `${owner.label} · spreadsheet import`,
    })
    created++

    if (row.status === 'duplicate' && row.match) {
      const candidate: DuplicateCandidate = {
        id: dupeId(`dupe-ui-${Date.now().toString(36)}-${row.index}`),
        personAId: person.id,
        personBId: row.match.person.id,
        score: row.match.score as DuplicateCandidate['score'],
        matchedFields: row.match.matchedFields,
        status: 'open',
        resolvedAt: null,
        resolvedBy: null,
        resolutionNote: null,
      }
      duplicateCandidatesCollection.insert(candidate)
      flagged++
    }
  }

  return { created, flagged, skipped: analysis.counts.skipped }
}
