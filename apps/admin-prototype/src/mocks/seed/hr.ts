/**
 * People and Payroll — 48 employees, the recruitment pipeline behind them, the
 * attendance ledger, and three payroll periods.
 *
 * Two PRD absolutes are made visible here rather than argued about:
 *
 *  1. **Compensation is versioned, never overwritten.** A pay change appends a
 *     `CompensationVersion` and end-dates the previous one. Every row is
 *     immutable and carries the approval that authorised it.
 *
 *  2. **Attendance has no financial consequence.** `consequence` is `"none"`
 *     on every `AttendanceEvent` in the seed, and the count of
 *     attendance-derived payroll adjustments is **zero**. The engine exists —
 *     there is one voided adjustment to prove the machinery runs — but it
 *     ships switched off, per policy `pol-attendance-v2`.
 */

import {
  attEventId,
  candidateId as asCandidateId,
  compId,
  employeeId as asEmployeeId,
  exitId,
  interviewId as asInterviewId,
  leaveId,
  ngn,
  offerId as asOfferId,
  openingId as asOpeningId,
  payAdjId,
  payItemId,
  payslipId,
  performanceReviewId,
  scorecardId,
  approvalId,
  companyAssetId,
  documentId,
  type AttendanceEvent,
  type AttendanceState,
  type Candidate,
  type CandidateStage,
  type CompensationVersion,
  type Employee,
  type EmployeeStatus,
  type ExitCase,
  type Interview,
  type JobOpening,
  type Kobo,
  type LeaveRequest,
  type LeaveType,
  type Offer,
  type PayrollAdjustment,
  type PayrollItem,
  type PayrollPeriod,
  type Payslip,
  type PerformanceReview,
  type Scorecard,
  type UserId,
} from '@/mocks/types'
import { BR, DEPT, E, PERIOD, POLICY, STAFF_PERSON_SLOTS, TPL, U, UNIT, employee, person, user } from '@/mocks/seed/ids'
import { commissions } from '@/mocks/seed/referral'
import { fullName, personById } from '@/mocks/seed/people'
import { addDays, at, audit, dayOfWeek, daysAgo, int, pad, pick, rng, TODAY } from '@/mocks/seed/_helpers'

const r = rng(606060)

const BANKS = ['GTBank', 'Access Bank', 'Zenith Bank', 'UBA', 'First Bank']

/* -------------------------------------------------------------------------- */
/* Employees                                                                  */
/* -------------------------------------------------------------------------- */

interface StaffSpec {
  title: string
  dept: (typeof DEPT)[keyof typeof DEPT]
  unit: (typeof UNIT)[keyof typeof UNIT]
  branch: (typeof BR)[keyof typeof BR]
  grossNaira: number
  startDate: string
  status: EmployeeStatus
  manager: UserId | null
}

/** The named eighteen, in `STAFF_PERSON_SLOTS` order. */
const NAMED_STAFF: StaffSpec[] = [
  { title: 'Chief Operating Officer', dept: DEPT.exec, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 1_100_000, startDate: '2021-02-01', status: 'active', manager: user(7) },
  { title: 'Sales Executive', dept: DEPT.growth, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 280_000, startDate: '2024-01-15', status: 'probation', manager: user(6) },
  { title: 'Lead Tutor, Data', dept: DEPT.academy, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 450_000, startDate: '2022-06-01', status: 'active', manager: user(9) },
  { title: 'Finance Manager', dept: DEPT.finance, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 600_000, startDate: '2022-02-14', status: 'active', manager: user(5) },
  { title: 'Chief Financial Officer', dept: DEPT.finance, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 1_000_000, startDate: '2021-05-04', status: 'active', manager: user(7) },
  { title: 'Head of Growth', dept: DEPT.growth, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 750_000, startDate: '2021-09-13', status: 'active', manager: user(1) },
  { title: 'Chief Executive', dept: DEPT.exec, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 1_200_000, startDate: '2021-02-01', status: 'active', manager: null },
  { title: 'HR Manager', dept: DEPT.people, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 650_000, startDate: '2022-03-07', status: 'active', manager: user(1) },
  { title: 'Academy Operations Manager', dept: DEPT.academy, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 650_000, startDate: '2021-06-21', status: 'active', manager: user(1) },
  { title: 'Sales Executive', dept: DEPT.corporate, unit: UNIT.corporate, branch: BR.lagos, grossNaira: 280_000, startDate: '2023-06-12', status: 'active', manager: user(14) },
  { title: 'Tutor, Engineering', dept: DEPT.academy, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 450_000, startDate: '2022-08-29', status: 'active', manager: user(9) },
  { title: 'Head of Technology', dept: DEPT.tech, unit: UNIT.dexurb, branch: BR.ibadan, grossNaira: 850_000, startDate: '2021-08-02', status: 'active', manager: user(1) },
  { title: 'Sales Executive, Africa', dept: DEPT.growth, unit: UNIT.africa, branch: BR.virtual, grossNaira: 280_000, startDate: '2024-02-05', status: 'active', manager: user(6) },
  { title: 'Corporate Account Manager', dept: DEPT.corporate, unit: UNIT.corporate, branch: BR.lagos, grossNaira: 600_000, startDate: '2022-03-14', status: 'active', manager: user(1) },
  { title: 'Student Success Advisor', dept: DEPT.academy, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 300_000, startDate: '2023-01-09', status: 'active', manager: user(9) },
  { title: 'Finance Officer', dept: DEPT.finance, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 320_000, startDate: '2024-04-02', status: 'active', manager: user(4) },
  { title: 'Talent Acquisition Lead', dept: DEPT.people, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 350_000, startDate: '2023-02-20', status: 'notice', manager: user(8) },
  { title: 'Marketing Manager', dept: DEPT.marketing, unit: UNIT.academy, branch: BR.ibadan, grossNaira: 450_000, startDate: '2022-11-07', status: 'active', manager: user(1) },
]

const GENERATED_TITLES = [
  'Tutor, Product Design', 'Tutor, Frontend', 'Tutor, Digital Marketing', 'Tutor, Cybersecurity',
  'Tutor, Product Management', 'Tutor, Graphics', 'Tutor, Video', 'Tutor, Mobile',
  'Teens Facilitator', 'Corporate Facilitator', 'Student Success Advisor', 'Front Desk Officer',
  'Facilities Officer', 'Software Engineer', 'Product Designer', 'Content Producer',
]

function compensation(employeeId: Employee['id'], grossNaira: number, from: string, to: string | null, reason: string, approvalRef: string | null, seq: number): CompensationVersion {
  const gross = ngn(grossNaira)
  const base = Math.round(gross * 0.6) as Kobo
  const housing = Math.round(gross * 0.2) as Kobo
  const transport = Math.round(gross * 0.13) as Kobo
  const data = (gross - base - housing - transport) as Kobo
  return {
    id: compId(`${employeeId}-c${seq}`),
    employeeId,
    effectiveFrom: from,
    effectiveTo: to,
    baseSalary: base,
    allowances: [
      { label: 'Housing', amount: housing },
      { label: 'Transport', amount: transport },
      { label: 'Data', amount: data },
    ],
    gross,
    reason,
    approvalRequestId: approvalRef ? approvalId(approvalRef) : null,
    approvedByUserId: U.oluwaseun,
    createdAt: at(from, 9, 0),
  }
}

const employees: Employee[] = STAFF_PERSON_SLOTS.map((slot, i) => {
  const n = i + 1
  const named = NAMED_STAFF[i]
  const id = employee(n)
  const title = named?.title ?? GENERATED_TITLES[(i - 18) % GENERATED_TITLES.length]
  const grossNaira = named?.grossNaira ?? 260_000 + ((i * 3) % 7) * 24_000
  const startDate = named?.startDate ?? `202${3 + (i % 3)}-${pad(1 + (i % 12), 2)}-${pad(1 + (i % 27), 2)}`
  const status: EmployeeStatus = named?.status ?? (i % 23 === 0 ? 'probation' : i % 29 === 0 ? 'on_leave' : 'active')
  const dept = named?.dept ?? (i % 3 === 0 ? DEPT.academy : i % 5 === 0 ? DEPT.tech : DEPT.growth)
  const unit = named?.unit ?? (i % 6 === 0 ? UNIT.teens : i % 7 === 0 ? UNIT.dexurb : UNIT.academy)
  const branch = named?.branch ?? (i % 5 === 0 ? BR.lagos : i % 7 === 0 ? BR.virtual : BR.ibadan)

  // Anyone who has been here more than two years has had at least one rise.
  const versions: CompensationVersion[] = []
  const tenureYears = Number(TODAY.slice(0, 4)) - Number(startDate.slice(0, 4))
  if (tenureYears >= 2) {
    versions.push(
      compensation(id, Math.round(grossNaira * 0.82), startDate, '2025-12-31', 'Starting salary on appointment', null, 1),
    )
    versions.push(
      compensation(id, grossNaira, '2026-01-01', null, 'Annual review — 2026 cycle', i < 18 ? 'apr-0308' : null, 2),
    )
  } else {
    versions.push(compensation(id, grossNaira, startDate, null, 'Starting salary on appointment', null, 1))
  }

  const annualTaken = int(r, 2, 14)
  const sickTaken = int(r, 0, 4)

  return {
    id,
    employeeId: `EMP-${pad(n, 4)}`,
    personId: person(slot),
    jobTitle: title,
    departmentId: dept,
    unitId: unit,
    branchId: branch,
    managerUserId: named ? named.manager : user(9),
    employmentType: title.startsWith('Tutor') && i >= 18 ? 'contract' : i % 17 === 0 ? 'part_time' : 'full_time',
    startDate,
    endDate: null,
    status,
    probationEndsAt: status === 'probation' ? addDays(startDate, 180) : null,
    probationOutcome: status === 'probation' ? null : 'confirmed',
    priorEmploymentIds: [],
    compensationVersions: versions,
    leaveBalances: [
      { type: 'annual', entitled: 20, taken: annualTaken, remaining: 20 - annualTaken },
      { type: 'sick', entitled: 7, taken: sickTaken, remaining: 7 - sickTaken },
      { type: 'compassionate', entitled: 3, taken: 0, remaining: 3 },
      { type: 'study', entitled: 5, taken: i % 11 === 0 ? 5 : 0, remaining: i % 11 === 0 ? 0 : 5 },
    ],
    // Named categories, per the PRD, that sit behind a narrower permission
    // than the rest of the record — kept lean, no document storage attached.
    bankDetails:
      i % 13 === 0 ? null : { bankName: pick(r, BANKS), accountLast4: String(1000 + ((n * 37) % 9000)) },
    disciplinaryRecords:
      i % 19 === 0
        ? [
            {
              id: `disc-${pad(n, 4)}`,
              date: addDays(startDate, 400 + (n % 200)),
              category: 'Attendance',
              summary: 'Verbal warning after repeated late arrivals in the same month.',
              issuedByUserId: U.yetunde,
            },
          ]
        : [],
    ...audit(at(startDate, 9, 0), U.yetunde),
  } satisfies Employee
})

/**
 * One rehire, so the "new record, history preserved" rule has a witness:
 * employee 44 left in 2024 and came back in 2026 on a fresh record.
 */
const rehire = employees[43]
if (rehire) {
  const priorId = asEmployeeId('emp-0044-prior')
  rehire.priorEmploymentIds = [priorId]
  employees.push({
    ...rehire,
    id: priorId,
    employeeId: 'EMP-0044-A',
    jobTitle: 'Teens Facilitator',
    startDate: '2023-01-16',
    endDate: '2024-08-30',
    status: 'exited',
    probationOutcome: 'confirmed',
    probationEndsAt: null,
    priorEmploymentIds: [],
    compensationVersions: [compensation(priorId, 190_000, '2023-01-16', '2024-08-30', 'Starting salary on appointment', null, 1)],
    ...audit(at('2023-01-16', 9, 0), U.yetunde),
  })
}

export { employees }
export const employeeById = new Map<string, Employee>(employees.map((e) => [e.id, e]))
const employeeByPerson = new Map<string, Employee>(employees.map((e) => [e.personId, e]))

/* -------------------------------------------------------------------------- */
/* Recruitment                                                                */
/* -------------------------------------------------------------------------- */

interface OpeningSpec {
  title: string
  dept: (typeof DEPT)[keyof typeof DEPT]
  unit: (typeof UNIT)[keyof typeof UNIT]
  branch: (typeof BR)[keyof typeof BR]
  minNaira: number
  maxNaira: number
  status: JobOpening['status']
  manager: UserId
  reason: string
  openedDaysAgo: number | null
}

const OPENINGS: OpeningSpec[] = [
  { title: 'Data Tutor', dept: DEPT.academy, unit: UNIT.academy, branch: BR.ibadan, minNaira: 350_000, maxNaira: 480_000, status: 'open', manager: U.emeka, reason: 'DA-C13 opens with 18 of 25 seats sold and one lead tutor.', openedDaysAgo: 34 },
  { title: 'Reconciliation Officer', dept: DEPT.finance, unit: UNIT.academy, branch: BR.ibadan, minNaira: 260_000, maxNaira: 340_000, status: 'open', manager: U.fatima, reason: 'Nine unmatched payments on a two-person desk.', openedDaysAgo: 28 },
  { title: 'Sales Executive — Lagos', dept: DEPT.corporate, unit: UNIT.corporate, branch: BR.lagos, minNaira: 250_000, maxNaira: 320_000, status: 'open', manager: U.chukwuemeka, reason: 'Lagos pipeline has outgrown one executive.', openedDaysAgo: 51 },
  { title: 'Frontend Engineer', dept: DEPT.tech, unit: UNIT.dexurb, branch: BR.ibadan, minNaira: 450_000, maxNaira: 700_000, status: 'open', manager: U.damilola, reason: 'Cirvee OS build team.', openedDaysAgo: 19 },
  { title: 'Teens Facilitator', dept: DEPT.academy, unit: UNIT.teens, branch: BR.ibadan, minNaira: 180_000, maxNaira: 240_000, status: 'open', manager: U.folake, reason: 'Two Saturday cohorts running, one facilitator.', openedDaysAgo: 12 },
  { title: 'Content Producer', dept: DEPT.marketing, unit: UNIT.academy, branch: BR.ibadan, minNaira: 280_000, maxNaira: 380_000, status: 'on_hold', manager: U.amarachi, reason: 'Thirteen courses are video-only. This role fills the audio and transcript gap.', openedDaysAgo: 62 },
  { title: 'Student Success Advisor', dept: DEPT.academy, unit: UNIT.academy, branch: BR.virtual, minNaira: 260_000, maxNaira: 330_000, status: 'filled', manager: U.folake, reason: 'Twenty-three flagged students across eleven running cohorts.', openedDaysAgo: 140 },
  { title: 'Office Administrator', dept: DEPT.people, unit: UNIT.academy, branch: BR.lagos, minNaira: 200_000, maxNaira: 260_000, status: 'cancelled', manager: U.yetunde, reason: 'Absorbed into the front desk role.', openedDaysAgo: 96 },
]

export const jobOpenings: JobOpening[] = OPENINGS.map((o, i) => ({
  id: asOpeningId(`job-${pad(i + 1, 4)}`),
  ref: `JOB-2026-${pad(i + 1, 4)}`,
  title: o.title,
  departmentId: o.dept,
  unitId: o.unit,
  branchId: o.branch,
  employmentType: o.title.includes('Facilitator') ? 'part_time' : 'full_time',
  headcount: o.title === 'Data Tutor' ? 2 : 1,
  salaryMin: ngn(o.minNaira),
  salaryMax: ngn(o.maxNaira),
  hiringManagerUserId: o.manager,
  approvalRequestId: approvalId(i === 0 ? 'apr-0296' : 'apr-0306'),
  jobDescription: `${o.title} at Cirvee, reporting to ${o.dept === DEPT.academy ? 'Academy Operations' : 'the department head'}. ${o.reason}`,
  reason: o.reason,
  status: o.status,
  openedAt: o.openedDaysAgo === null ? null : daysAgo(o.openedDaysAgo),
  targetStartDate: addDays(TODAY, 30 + i * 7),
  applicantCount: [24, 19, 31, 17, 12, 8, 26, 4][i],
  inPipelineCount: [14, 11, 18, 9, 7, 3, 0, 0][i],
  ...audit(at(daysAgo((o.openedDaysAgo ?? 30) + 10), 10, 0), U.temitope),
}))

const CANDIDATE_STAGES: ReadonlyArray<readonly [CandidateStage, number]> = [
  ['applied', 22],
  ['screening', 14],
  ['shortlisted', 11],
  ['interview', 9],
  ['assessment', 6],
  ['final_review', 4],
  ['offer', 3],
  ['hired', 2],
  ['rejected', 12],
  ['withdrawn', 3],
  ['talent_pool', 5],
  ['no_show', 2],
]

const stageList = CANDIDATE_STAGES.flatMap(([s, n]) => Array.from({ length: n }, () => s))
const CANDIDATE_SOURCES = ['LinkedIn', 'Referral — staff', 'Cirvee alumni network', 'Jobberman', 'Careers page', 'Instagram']

export const candidates: Candidate[] = stageList.map((stage, i) => {
  const personSlot = 210 + i
  const appliedAt = daysAgo(int(r, 3, 70))
  return {
    id: asCandidateId(`cnd-${pad(i + 1, 4)}`),
    personId: person(personSlot),
    openingId: asOpeningId(`job-${pad(1 + (i % 6), 4)}`),
    source: CANDIDATE_SOURCES[i % CANDIDATE_SOURCES.length],
    appliedAt,
    stage,
    stageEnteredAt: at(addDays(appliedAt, int(r, 1, 14)), int(r, 9, 17), 0),
    recruiterUserId: U.temitope,
    cvUrl: `/cvs/${person(personSlot)}.pdf`,
    averageScore: ['interview', 'assessment', 'final_review', 'offer', 'hired'].includes(stage) ? Number((3 + (i % 4) * 0.4).toFixed(1)) : null,
    nextStep: stage === 'applied' ? 'Screening call' : stage === 'interview' ? 'Panel interview' : stage === 'offer' ? 'Awaiting response' : null,
    ...audit(at(appliedAt, 9, 0), U.temitope),
  }
})

const interviewables = candidates.filter((c) => ['interview', 'assessment', 'final_review', 'offer', 'hired'].includes(c.stage))

export const interviews: Interview[] = interviewables.flatMap((c, i) => {
  const rounds: Interview['type'][] = i % 3 === 0 ? ['screening', 'technical', 'panel'] : ['screening', 'technical']
  return rounds.map((type, j) => {
    // Nine of these land inside the current week, for the People dashboard.
    const upcoming = i < 5 && j === rounds.length - 1
    const scheduledDay = upcoming ? addDays(TODAY, int(r, 0, 5)) : daysAgo(int(r, 3, 40))
    return {
      id: asInterviewId(`int-${pad(i * 3 + j + 1, 4)}`),
      candidateId: c.id,
      type,
      scheduledAt: at(scheduledDay, int(r, 9, 16), pick(r, [0, 30])),
      durationMinutes: type === 'screening' ? 30 : 60,
      interviewerUserIds: type === 'panel' ? [U.emeka, U.yetunde, U.damilola] : [U.temitope, U.emeka],
      mode: j === 0 ? 'virtual' : 'on_campus',
      location: j === 0 ? null : 'Bodija Seminar Room',
      meetingUrl: j === 0 ? `https://meet.cirvee.com/int-${pad(i * 3 + j + 1, 4)}` : null,
      status: upcoming ? 'scheduled' : i % 13 === 0 ? 'no_show' : 'completed',
      outcome: upcoming ? null : i % 13 === 0 ? 'reject' : j === rounds.length - 1 ? 'advance' : 'advance',
      ...audit(at(addDays(scheduledDay, -4), 10, 0), U.temitope),
    } satisfies Interview
  })
})

const COMPETENCIES = ['Technical depth', 'Communication', 'Ownership', 'Learning agility', 'Culture add']

export const scorecards: Scorecard[] = interviews
  .filter((iv) => iv.status === 'completed')
  .map((iv, i) => ({
    id: scorecardId(`scr-${pad(i + 1, 4)}`),
    interviewId: iv.id,
    interviewerUserId: iv.interviewerUserIds[0],
    competencies: COMPETENCIES.map((name, j) => ({
      name,
      score: (2 + ((i + j) % 4)) as 1 | 2 | 3 | 4 | 5,
      note: j === 0 ? 'Walked through a real project without prompting.' : j === 1 ? 'Explained a trade-off clearly.' : '',
    })),
    recommendation: (['strong_hire', 'hire', 'hire', 'no_decision', 'no_hire'] as const)[i % 5],
    notes: 'Would work well with the Ibadan faculty. Watch the notice period — currently three months.',
    submittedAt: at(addDays(iv.scheduledAt.slice(0, 10), 1), 17, 0),
    ...audit(iv.scheduledAt, iv.interviewerUserIds[0]),
  }))

const offerCandidates = candidates.filter((c) => c.stage === 'offer' || c.stage === 'hired')

export const offers: Offer[] = offerCandidates.map((c, i) => {
  const opening = jobOpenings.find((o) => o.id === c.openingId) ?? jobOpenings[0]
  const issuedDay = daysAgo(int(r, 4, 30))
  // One Lapsed offer: accepted, then never resumed. No Employee record exists.
  const status: Offer['status'] = c.stage === 'hired' ? (i === 0 ? 'accepted' : 'lapsed') : i === 2 ? 'declined' : 'issued'
  const gross = Math.round((opening.salaryMin + opening.salaryMax) / 2) as Kobo
  return {
    id: asOfferId(`ofr-${pad(i + 1, 4)}`),
    ref: `OFR-2026-${pad(i + 1, 4)}`,
    candidateId: c.id,
    personId: c.personId,
    jobTitle: opening.title,
    unitId: opening.unitId,
    branchId: opening.branchId,
    departmentId: opening.departmentId,
    managerUserId: opening.hiringManagerUserId,
    baseSalary: Math.round(gross * 0.6) as Kobo,
    allowances: [
      { label: 'Housing', amount: Math.round(gross * 0.2) as Kobo },
      { label: 'Transport', amount: Math.round(gross * 0.13) as Kobo },
      { label: 'Data', amount: Math.round(gross * 0.07) as Kobo },
    ],
    startDate: addDays(TODAY, 21 + i * 7),
    probationMonths: 6,
    approvalRequestId: approvalId('apr-0306'),
    documentId: documentId(`doc-${pad(4 + i, 4)}`),
    issuedAt: at(issuedDay, 14, 0),
    expiresAt: addDays(issuedDay, 14),
    status,
    respondedAt: status === 'issued' ? null : at(addDays(issuedDay, 4), 11, 0),
    ...audit(at(issuedDay, 14, 0), U.temitope),
  }
})

/* -------------------------------------------------------------------------- */
/* Attendance — no financial consequence, on every single row                 */
/* -------------------------------------------------------------------------- */

const attendanceEvents: AttendanceEvent[] = []
let attSeq = 0

for (let back = 19; back >= 0; back--) {
  const date = daysAgo(back)
  const dow = dayOfWeek(date)
  if (dow === 0 || dow === 6) continue
  for (const emp of employees) {
    if (emp.status === 'exited') continue
    attSeq += 1
    const roll = r() * 100
    const state: AttendanceState =
      roll < 78 ? 'present' : roll < 88 ? 'late' : roll < 92 ? 'remote_approved' : roll < 95 ? 'approved_leave' : roll < 97 ? 'missing_clock_out' : roll < 99 ? 'early_departure' : 'absent'
    const lateBy = state === 'late' ? int(r, 16, 75) : null
    const clockIn = ['absent', 'approved_leave'].includes(state) ? null : at(date, 8, state === 'late' ? int(r, 16, 59) : int(r, 0, 14))
    const clockOut = clockIn && state !== 'missing_clock_out' ? at(date, state === 'early_departure' ? 15 : 17, int(r, 0, 59)) : null

    attendanceEvents.push({
      id: attEventId(`att-${pad(attSeq, 5)}`),
      employeeId: emp.id,
      personId: emp.personId,
      date,
      clockInAt: clockIn,
      clockOutAt: clockOut,
      hours: clockIn && clockOut ? Number(((Date.parse(clockOut) - Date.parse(clockIn)) / 3_600_000).toFixed(1)) : null,
      state,
      source: state === 'remote_approved' ? 'approved_device' : r() > 0.3 ? 'nfc_tap' : r() > 0.5 ? 'office_network' : 'qr',
      tapEventId: null,
      lateByMinutes: lateBy,
      policyVersionId: POLICY.attendanceV2,
      // SEEDED "none" ON EVERY ROW. The deduction engine ships switched off.
      consequence: 'none',
      proposedAdjustmentId: null,
      overrideReason: state === 'missing_clock_out' ? 'Left through the side gate — reader not passed' : null,
      overriddenByUserId: state === 'missing_clock_out' ? U.yetunde : null,
      ...audit(at(date, 20, 0), U.yetunde),
    })
  }
}

export { attendanceEvents }

/* -------------------------------------------------------------------------- */
/* Leave                                                                      */
/* -------------------------------------------------------------------------- */

const LEAVE_REASONS: Record<LeaveType, string> = {
  annual: 'Family event in Kaduna. Handover note attached.',
  sick: 'Malaria — doctor’s note attached.',
  compassionate: 'Bereavement in the family.',
  maternity: 'Statutory maternity leave.',
  paternity: 'Statutory paternity leave.',
  study: 'Certification exam window.',
  unpaid: 'Extended personal leave, agreed with the line manager.',
}

const LEAVE_MIX: LeaveType[] = ['annual', 'annual', 'annual', 'sick', 'sick', 'study', 'compassionate', 'paternity', 'maternity', 'unpaid']

export const leaveRequests: LeaveRequest[] = Array.from({ length: 46 }, (_, i) => {
  const emp = employees[i % employees.length]
  const type = LEAVE_MIX[i % LEAVE_MIX.length]
  const days = type === 'maternity' ? 120 : type === 'paternity' ? 10 : int(r, 1, 8)
  const fromDate = i < 6 ? addDays(TODAY, int(r, 1, 30)) : daysAgo(int(r, 5, 200))
  const balance = emp.leaveBalances.find((b) => b.type === type)
  const before = balance?.remaining ?? 10
  const status: LeaveRequest['status'] = i < 4 ? 'requested' : i % 17 === 0 ? 'rejected' : i % 19 === 0 ? 'cancelled' : 'approved'
  return {
    id: leaveId(`lv-${pad(i + 1, 4)}`),
    ref: `LV-2026-${pad(i + 1, 4)}`,
    employeeId: emp.id,
    type,
    fromDate,
    toDate: addDays(fromDate, days - 1),
    days,
    balanceBefore: before,
    balanceAfter: Math.max(0, before - days),
    reason: LEAVE_REASONS[type],
    approvalRequestId: approvalId(i < 4 ? 'apr-0299' : 'apr-0305'),
    status,
    decidedAt: status === 'requested' ? null : at(daysAgo(int(r, 6, 210)), 11, 0),
    ...audit(at(daysAgo(int(r, 6, 220)), 9, 30), U.yetunde),
  }
})

/* -------------------------------------------------------------------------- */
/* The one exit in progress                                                   */
/* -------------------------------------------------------------------------- */

const leaver = employees.find((e) => e.status === 'notice') ?? employees[16]

export const exitCases: ExitCase[] = [
  {
    id: exitId('ext-0001'),
    ref: 'EXT-2026-0001',
    employeeId: leaver.id,
    type: 'resignation',
    noticeDate: daysAgo(21),
    lastWorkingDay: addDays(TODAY, 9),
    stage: 'commission_reconciliation',
    clearances: [
      { department: 'IT', clearedByUserId: U.damilola, clearedAt: at(daysAgo(6), 15, 0), note: 'Accounts disabled, laptop wiped pending return.' },
      { department: 'Finance', clearedByUserId: null, clearedAt: null, note: 'Awaiting the commission reconciliation below.' },
      { department: 'HR', clearedByUserId: U.yetunde, clearedAt: at(daysAgo(4), 10, 0), note: 'Exit interview booked for 28 Sep.' },
      { department: 'Line manager', clearedByUserId: U.yetunde, clearedAt: at(daysAgo(9), 16, 30), note: 'Handover document signed off.' },
      { department: 'Assets', clearedByUserId: null, clearedAt: null, note: 'One laptop and one access card outstanding.' },
    ],
    outstandingAssetIds: [companyAssetId('ast-0007'), companyAssetId('ast-0031')],
    outstandingFinanceAmount: ngn(85_000),
    // The reason Finance cannot sign off: a paid commission was later reversed.
    commissionReconciliationStatus: 'receivable',
    finalSettlement: null,
    accessRevokedAt: at(daysAgo(6), 15, 0),
    cardDeactivatedAt: null,
    exitInterviewDone: false,
    approvalRequestId: null,
    ...audit(at(daysAgo(21), 9, 0), U.yetunde),
  },
]

/* -------------------------------------------------------------------------- */
/* Payroll                                                                    */
/* -------------------------------------------------------------------------- */

/** Commissions that belong on a payslip: staff beneficiaries, made payable. */
const payrollCommissions = commissions.filter(
  (c) => (c.state === 'payable' || c.state === 'paid') && employeeByPerson.has(c.beneficiaryPersonId) && c.amount > 0,
)

function currentComp(emp: Employee): CompensationVersion {
  return emp.compensationVersions.find((v) => v.effectiveTo === null) ?? emp.compensationVersions[0]
}

function buildItems(periodId: PayrollPeriod['id'], includeCommissions: boolean): PayrollItem[] {
  return employees
    .filter((e) => e.status !== 'exited')
    .map((emp, i) => {
      const comp = currentComp(emp)
      const commissionLines = includeCommissions
        ? payrollCommissions
            .filter((c) => c.beneficiaryPersonId === emp.personId)
            .map((c) => ({ commissionId: c.id, amount: c.amount, ref: c.ref }))
        : []
      const bonusLines =
        i % 9 === 0 ? [{ label: 'Performance bonus — Q3', amount: ngn(50_000), sourceRef: 'PERF-2026-Q3' }] : []
      const allowanceLines = comp.allowances
      const commissionTotal = commissionLines.reduce((acc, l) => acc + l.amount, 0)
      const bonusTotal = bonusLines.reduce((acc, l) => acc + l.amount, 0)
      const gross = (comp.baseSalary + allowanceLines.reduce((acc, a) => acc + a.amount, 0) + commissionTotal + bonusTotal) as Kobo
      const paye = Math.round(gross * 0.06) as Kobo
      const pension = Math.round(comp.baseSalary * 0.08) as Kobo
      const nhf = Math.round(comp.baseSalary * 0.025) as Kobo
      const deductions = (paye + pension + nhf) as Kobo
      return {
        id: payItemId(`${periodId}-${emp.id}`),
        periodId,
        employeeId: emp.id,
        unitId: emp.unitId,
        base: comp.baseSalary,
        commissionLines,
        bonusLines,
        allowanceLines,
        adjustmentIds: [],
        statutoryLines: [
          { label: 'PAYE' as const, amount: paye },
          { label: 'Pension' as const, amount: pension },
          { label: 'NHF' as const, amount: nhf },
        ],
        gross,
        deductions,
        net: (gross - deductions) as Kobo,
        ...audit(at(daysAgo(10), 9, 0), U.fatima),
      } satisfies PayrollItem
    })
}

const sepItems = buildItems(PERIOD.sep2026, true)
const augItems = buildItems(PERIOD.aug2026, false)
const julItems = buildItems(PERIOD.jul2026, false)

export const payrollItems: PayrollItem[] = [...sepItems, ...augItems, ...julItems]

function totals(items: PayrollItem[]) {
  return {
    employeeCount: items.length,
    grossTotal: items.reduce((acc, i) => acc + i.gross, 0) as Kobo,
    deductionTotal: items.reduce((acc, i) => acc + i.deductions, 0) as Kobo,
    netTotal: items.reduce((acc, i) => acc + i.net, 0) as Kobo,
  }
}

export const payrollPeriods: PayrollPeriod[] = [
  {
    id: PERIOD.jul2026,
    label: 'Jul 2026',
    month: 7,
    year: 2026,
    status: 'closed',
    ...totals(julItems),
    openedAt: at('2026-07-01', 8, 0),
    closedAt: at('2026-07-28', 17, 0),
    approvedByUserId: U.oluwaseun,
    payslipsIssued: julItems.length,
    ...audit(at('2026-07-01', 8, 0), U.fatima),
  },
  {
    id: PERIOD.aug2026,
    label: 'Aug 2026',
    month: 8,
    year: 2026,
    status: 'closed',
    ...totals(augItems),
    openedAt: at('2026-08-01', 8, 0),
    closedAt: at('2026-08-27', 17, 0),
    approvedByUserId: U.oluwaseun,
    payslipsIssued: augItems.length,
    ...audit(at('2026-08-01', 8, 0), U.fatima),
  },
  {
    id: PERIOD.sep2026,
    label: 'Sep 2026',
    month: 9,
    year: 2026,
    status: 'open',
    ...totals(sepItems),
    openedAt: at('2026-09-01', 8, 0),
    closedAt: null,
    approvedByUserId: null,
    payslipsIssued: 0,
    ...audit(at('2026-09-01', 8, 0), U.fatima),
  },
]

/* -------------------------------------------------------------------------- */
/* Payroll adjustments — zero from attendance, and one voided to prove it     */
/* -------------------------------------------------------------------------- */

const payrollAdjustments: PayrollAdjustment[] = []

payrollCommissions.slice(0, 14).forEach((c, i) => {
  const emp = employeeByPerson.get(c.beneficiaryPersonId)
  if (!emp) return
  payrollAdjustments.push({
    id: payAdjId(`adj-${pad(i + 1, 4)}`),
    ref: `ADJ-2026-${pad(i + 1, 4)}`,
    periodId: PERIOD.sep2026,
    employeeId: emp.id,
    type: 'commission',
    amount: c.amount,
    sourceEventType: 'Commission',
    sourceEventId: c.id,
    sourceEventRef: c.ref,
    policyVersionId: POLICY.commissionPayout,
    formulaUsed: `commission.amount (${c.ruleKey} v${c.ruleVersion})`,
    status: i < 3 ? 'proposed' : 'applied',
    disputeWindowEndsAt: i < 3 ? at(addDays(TODAY, 7), 23, 59) : null,
    voidedReason: null,
    ...audit(at(daysAgo(8), 9, 0), U.fatima),
  })
})

/* -------------------------------------------------------------------------- */
/* Performance reviews                                                       */
/* -------------------------------------------------------------------------- */

/**
 * `perf-2026-q3-0008` is not a free choice — it's the id the payroll
 * adjustment below (`adj-0090`) already names as its source event. Without
 * this row, that adjustment pointed at nothing.
 */
const performanceReviews: PerformanceReview[] = [
  {
    id: performanceReviewId('perf-2026-q3-0008'),
    employeeId: employees[8].id,
    reviewerUserId: U.yetunde,
    periodLabel: 'Q3 2026',
    competencies: [
      { name: 'Delivery quality', score: 5, note: 'Cohort completion and attendance both up this quarter.' },
      { name: 'Collaboration', score: 4, note: 'Works well across tutors, still building the cross-branch habit.' },
      { name: 'Ownership', score: 5, note: 'Took the DA-C12 rollout end to end with no escalation.' },
    ],
    overallNote: 'Strong quarter. Agreed a flat bonus at the Q3 calibration rather than a base-salary change.',
    recommendedBonus: ngn(50_000),
    status: 'acknowledged',
    submittedAt: at(daysAgo(9), 14, 0),
    acknowledgedAt: at(daysAgo(7), 10, 30),
    ...audit(at(daysAgo(9), 14, 0), U.yetunde),
  },
  {
    id: performanceReviewId('perf-2026-q3-0003'),
    employeeId: employees[2].id,
    reviewerUserId: U.emeka,
    periodLabel: 'Q3 2026',
    competencies: [
      { name: 'Teaching quality', score: 4, note: 'Consistently high marks in cohort feedback.' },
      { name: 'Punctuality', score: 3, note: 'Two late starts flagged in the attendance log this quarter.' },
    ],
    overallNote: 'Solid quarter overall. Punctuality is the one thing to watch.',
    recommendedBonus: null,
    status: 'submitted',
    submittedAt: at(daysAgo(4), 16, 0),
    acknowledgedAt: null,
    ...audit(at(daysAgo(4), 16, 0), U.emeka),
  },
  {
    id: performanceReviewId('perf-2026-q3-0015'),
    employeeId: employees[14].id,
    reviewerUserId: U.folake,
    periodLabel: 'Q3 2026',
    competencies: [{ name: 'Response time', score: 4, note: 'Tickets closed within SLA all quarter.' }],
    overallNote: 'Draft — waiting on one more month of data before the calibration meeting.',
    recommendedBonus: null,
    status: 'draft',
    submittedAt: null,
    acknowledgedAt: null,
    ...audit(at(daysAgo(1), 11, 0), U.folake),
  },
]

payrollAdjustments.push(
  {
    id: payAdjId('adj-0090'),
    ref: 'ADJ-2026-0090',
    periodId: PERIOD.sep2026,
    employeeId: employees[8].id,
    type: 'performance_bonus',
    amount: ngn(50_000),
    sourceEventType: 'PerformanceReview',
    sourceEventId: 'perf-2026-q3-0008',
    sourceEventRef: 'PERF-2026-Q3',
    policyVersionId: null,
    formulaUsed: 'flat bonus agreed at the Q3 calibration',
    status: 'finance_reviewed',
    disputeWindowEndsAt: null,
    voidedReason: null,
    ...audit(at(daysAgo(6), 10, 0), U.yetunde),
  },
  {
    id: payAdjId('adj-0091'),
    ref: 'ADJ-2026-0091',
    periodId: PERIOD.sep2026,
    employeeId: employees[11].id,
    type: 'advance_repayment',
    amount: -ngn(75_000) as Kobo,
    sourceEventType: 'SalaryAdvance',
    sourceEventId: 'adv-0004',
    sourceEventRef: 'ADV-2026-0004',
    policyVersionId: null,
    formulaUsed: 'advance.amount / 4 instalments',
    status: 'applied',
    disputeWindowEndsAt: null,
    voidedReason: null,
    ...audit(at(daysAgo(12), 10, 0), U.fatima),
  },
  /**
   * The only attendance-derived adjustment in the seed, and it is **voided**.
   * The engine proposed it, the attendance record was corrected, and the
   * proposal was withdrawn automatically. Net financial effect: zero — which
   * is the recommendation the build plan wants seen working rather than read
   * about.
   */
  {
    id: payAdjId('adj-0092'),
    ref: 'ADJ-2026-0092',
    periodId: PERIOD.sep2026,
    employeeId: employees[5].id,
    type: 'attendance',
    amount: 0 as Kobo,
    sourceEventType: 'AttendanceEvent',
    sourceEventId: attendanceEvents[3]?.id ?? 'att-00004',
    sourceEventRef: `Late arrival ${daysAgo(6)} 08:47`,
    policyVersionId: POLICY.attendanceV2,
    formulaUsed: 'dailyRate * 0.5',
    status: 'voided',
    disputeWindowEndsAt: at(addDays(daysAgo(6), 7), 23, 59),
    voidedReason: 'Attendance corrected 15 Sep — adjustment voided automatically. Policy pol-attendance-v2 has financialConsequenceEnabled = false, so no deduction was ever applied.',
    ...audit(at(daysAgo(6), 9, 0), U.yetunde),
  },
)

export { payrollAdjustments, performanceReviews }

/* Link the adjustments back onto their payroll items. */
const itemByEmployee = new Map(sepItems.map((i) => [i.employeeId, i]))
for (const adj of payrollAdjustments) {
  const item = itemByEmployee.get(adj.employeeId)
  if (item) item.adjustmentIds = [...item.adjustmentIds, adj.id]
}

/* -------------------------------------------------------------------------- */
/* Payslips — issued for the two closed periods                               */
/* -------------------------------------------------------------------------- */

export const payslips: Payslip[] = [...julItems, ...augItems].map((item, i) => {
  const closed = item.periodId === PERIOD.jul2026
  const issuedAt = closed ? at('2026-07-28', 18, 0) : at('2026-08-27', 18, 0)
  return {
    id: payslipId(`pls-${pad(i + 1, 4)}`),
    periodId: item.periodId,
    employeeId: item.employeeId,
    payrollItemId: item.id,
    issuedAt,
    viewedAt: i % 4 === 0 ? null : at(addDays(issuedAt.slice(0, 10), 1), 9, 30),
    downloadedAt: i % 3 === 0 ? at(addDays(issuedAt.slice(0, 10), 1), 9, 35) : null,
    ytdGross: (item.gross * (closed ? 7 : 8)) as Kobo,
    ytdDeductions: (item.deductions * (closed ? 7 : 8)) as Kobo,
    ytdNet: (item.net * (closed ? 7 : 8)) as Kobo,
    documentId: documentId(`doc-${pad(1 + (i % 146), 4)}`),
    ...audit(issuedAt, U.fatima),
  }
})

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const HR_COUNTS = {
  employees: employees.length,
  activeEmployees: employees.filter((e) => e.status !== 'exited').length,
  openings: jobOpenings.filter((o) => o.status === 'open').length,
  candidates: candidates.length,
  interviews: interviews.length,
  offersOutstanding: offers.filter((o) => o.status === 'issued').length,
  leaveRequests: leaveRequests.length,
  attendanceEvents: attendanceEvents.length,
  performanceReviews: performanceReviews.length,
  /** Zero, by policy. The count is derived so nobody can quietly change it. */
  attendanceDerivedAdjustments: payrollAdjustments.filter((a) => a.type === 'attendance' && a.status === 'applied').length,
} as const

void fullName
void personById
