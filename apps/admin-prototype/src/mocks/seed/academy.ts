/**
 * Academy: the catalogue (15 courses), the delivery instances (34 cohorts),
 * tutor assignments and the class timetable.
 *
 * Two courses carry real multi-format content — Data Analysis (partial, with a
 * visible gap) and Product Design (complete). The other thirteen are
 * video-only. That gap is the point of the Learn dashboard's coverage matrix,
 * so it is seeded, not faked in the UI.
 *
 * Enrolments, progress and attendance live in `learn.ts`, because an Enrolment
 * needs an Admission and Admissions are created in `crm.ts`.
 */

import {
  cohortId as asCohortId,
  ngn,
  sessionId,
  tutorAssignId,
  type Cohort,
  type CohortStatus,
  type ClassSession,
  type ContentFormat,
  type Course,
  type CourseId,
  type CourseLevel,
  type Mode,
  type PersonId,
  type TutorAssignment,
  type BranchId,
  type UnitId,
  type CertificateEligibilityRules,
} from '@/mocks/types'
import { BR, C, P, TPL, U, UNIT, person } from '@/mocks/seed/ids'
import { addDays, at, audit, dayOfWeek, int, pad, pick, rng, SYSTEM_USER, TODAY } from '@/mocks/seed/_helpers'

const r = rng(90210)

/* -------------------------------------------------------------------------- */
/* Courses                                                                    */
/* -------------------------------------------------------------------------- */

type Coverage = Record<ContentFormat, { have: number; total: number }>

/** Thirteen of the fifteen courses ship video and nothing else. */
function videoOnly(lessons: number): Coverage {
  return {
    video: { have: lessons, total: lessons },
    audio: { have: 0, total: lessons },
    podcast: { have: 0, total: lessons },
    pdf: { have: 0, total: lessons },
    transcript: { have: 0, total: lessons },
  }
}

const defaultCertRules: CertificateEligibilityRules = {
  attendanceThreshold: 75,
  contentCompletionThreshold: 100,
  requiredAssignments: 'all',
  requiredAssignmentIds: [],
  minimumAssignmentCount: null,
  projectRequired: true,
  projectMinimumGrade: 60,
  finalAssessmentRequired: false,
  finalAssessmentPassMark: null,
  financialClearanceRequired: true,
  templateId: TPL.certificate,
  autoIssue: false,
}

interface CourseSpec {
  id: CourseId
  code: string
  title: string
  unit: UnitId
  level: CourseLevel
  weeks: number
  modes: Mode[]
  priceNaira: number
  contentLessons: number
  coverage: Coverage
  outcomes: string[]
  tags: string[]
  summary: string
}

const COURSE_SPECS: CourseSpec[] = [
  {
    id: C.dataAnalysis,
    code: 'DA-101',
    title: 'Data Analysis',
    unit: UNIT.academy,
    level: 'beginner',
    weeks: 12,
    modes: ['on_campus', 'virtual', 'hybrid'],
    priceNaira: 450_000,
    contentLessons: 14,
    // The flagship course, and still not finished: 5 lessons have no audio.
    coverage: {
      video: { have: 14, total: 14 },
      audio: { have: 9, total: 14 },
      podcast: { have: 4, total: 14 },
      pdf: { have: 14, total: 14 },
      transcript: { have: 11, total: 14 },
    },
    outcomes: [
      'Clean and reshape messy spreadsheets with Power Query',
      'Write SQL that answers a business question, not just returns rows',
      'Build a dashboard a non-analyst can read without you in the room',
      'Run and interpret a linear regression',
    ],
    tags: ['data', 'excel', 'sql', 'power-bi', 'flagship'],
    summary: 'From spreadsheet to decision. Twelve weeks, one portfolio project, one real dataset.',
  },
  {
    id: C.productDesign,
    code: 'PD-101',
    title: 'Product Design (UI/UX)',
    unit: UNIT.academy,
    level: 'beginner',
    weeks: 12,
    modes: ['on_campus', 'virtual', 'hybrid'],
    priceNaira: 420_000,
    contentLessons: 12,
    // The one course that is genuinely production-ready across all five formats.
    coverage: {
      video: { have: 12, total: 12 },
      audio: { have: 12, total: 12 },
      podcast: { have: 12, total: 12 },
      pdf: { have: 12, total: 12 },
      transcript: { have: 12, total: 12 },
    },
    outcomes: [
      'Run a discovery interview without leading the witness',
      'Move from flow to wireframe to high-fidelity in Figma',
      'Build and document a small design system',
      'Defend a design decision with evidence',
    ],
    tags: ['design', 'figma', 'ux', 'multi-format'],
    summary: 'Research, interaction, interface. The only course with every lesson in all five formats.',
  },
  { id: C.frontend, code: 'FE-101', title: 'Frontend Engineering', unit: UNIT.academy, level: 'intermediate', weeks: 16, modes: ['on_campus', 'virtual'], priceNaira: 480_000, contentLessons: 18, coverage: videoOnly(18), outcomes: ['Build and ship a React application', 'Reason about state without a library', 'Write CSS that survives a redesign'], tags: ['engineering', 'react', 'typescript'], summary: 'HTML to a deployed React app in sixteen weeks.' },
  { id: C.backend, code: 'BE-101', title: 'Backend Engineering', unit: UNIT.academy, level: 'intermediate', weeks: 16, modes: ['on_campus', 'virtual'], priceNaira: 520_000, contentLessons: 17, coverage: videoOnly(17), outcomes: ['Design a relational schema that will not need rewriting', 'Build a REST API with real auth', 'Deploy and monitor a service'], tags: ['engineering', 'node', 'postgres'], summary: 'APIs, databases and the parts of production nobody demos.' },
  { id: C.digitalMarketing, code: 'DM-101', title: 'Digital Marketing', unit: UNIT.academy, level: 'beginner', weeks: 8, modes: ['on_campus', 'virtual', 'hybrid'], priceNaira: 280_000, contentLessons: 12, coverage: videoOnly(12), outcomes: ['Plan a campaign against a real budget', 'Read an analytics dashboard honestly', 'Write copy that converts'], tags: ['marketing', 'meta-ads', 'analytics'], summary: 'Paid, organic and the measurement that tells you which one worked.' },
  { id: C.cyber, code: 'CS-101', title: 'Cybersecurity Fundamentals', unit: UNIT.academy, level: 'beginner', weeks: 12, modes: ['virtual', 'hybrid'], priceNaira: 380_000, contentLessons: 15, coverage: videoOnly(15), outcomes: ['Map an attack surface', 'Run a vulnerability scan and triage the output', 'Write an incident report'], tags: ['security', 'soc', 'networking'], summary: 'Defensive security for people who will be first on the call.' },
  { id: C.productManagement, code: 'PM-101', title: 'Product Management', unit: UNIT.academy, level: 'intermediate', weeks: 10, modes: ['on_campus', 'hybrid'], priceNaira: 400_000, contentLessons: 13, coverage: videoOnly(13), outcomes: ['Write a spec someone can build from', 'Prioritise without a spreadsheet fight', 'Run a launch'], tags: ['product', 'discovery', 'roadmap'], summary: 'Discovery, prioritisation, delivery — with the arguments included.' },
  { id: C.dataScience, code: 'DS-201', title: 'Data Science', unit: UNIT.academy, level: 'advanced', weeks: 20, modes: ['virtual'], priceNaira: 650_000, contentLessons: 22, coverage: videoOnly(22), outcomes: ['Build and evaluate a supervised model', 'Engineer features from real, dirty data', 'Explain a model to a sceptical executive'], tags: ['data', 'python', 'ml'], summary: 'The long one. Python, statistics and machine learning end to end.' },
  { id: C.cloud, code: 'CL-201', title: 'Cloud Engineering', unit: UNIT.academy, level: 'advanced', weeks: 18, modes: ['virtual'], priceNaira: 560_000, contentLessons: 19, coverage: videoOnly(19), outcomes: ['Provision infrastructure as code', 'Build a CI/CD pipeline', 'Cost-optimise a running workload'], tags: ['cloud', 'aws', 'terraform'], summary: 'AWS, Terraform and the bill at the end of the month.' },
  { id: C.graphics, code: 'GD-101', title: 'Graphics Design', unit: UNIT.academy, level: 'beginner', weeks: 10, modes: ['on_campus', 'virtual'], priceNaira: 220_000, contentLessons: 11, coverage: videoOnly(11), outcomes: ['Build a brand identity from a brief', 'Work confidently in Illustrator and Photoshop', 'Prepare files for print and screen'], tags: ['design', 'adobe', 'branding'], summary: 'Identity, layout and production art.' },
  { id: C.videoEditing, code: 'VE-101', title: 'Video Editing', unit: UNIT.academy, level: 'beginner', weeks: 8, modes: ['on_campus'], priceNaira: 180_000, contentLessons: 9, coverage: videoOnly(9), outcomes: ['Cut a story, not just footage', 'Colour grade for delivery', 'Mix audio that does not fatigue'], tags: ['media', 'premiere', 'davinci'], summary: 'The cheapest way into the media business, and the most competitive.' },
  { id: C.mobile, code: 'MD-201', title: 'Mobile Development', unit: UNIT.academy, level: 'intermediate', weeks: 16, modes: ['virtual'], priceNaira: 500_000, contentLessons: 16, coverage: videoOnly(16), outcomes: ['Ship a React Native app to both stores', 'Handle offline state properly', 'Instrument and debug on a mid-range Android device'], tags: ['engineering', 'react-native', 'android'], summary: 'Android-first, because that is what Nigeria carries.' },
  { id: C.teensCoding, code: 'TC-101', title: 'Teens Coding (Scratch to Python)', unit: UNIT.teens, level: 'beginner', weeks: 12, modes: ['on_campus'], priceNaira: 120_000, contentLessons: 10, coverage: videoOnly(10), outcomes: ['Build a game in Scratch', 'Write a first Python program', 'Debug without giving up'], tags: ['teens', 'scratch', 'python'], summary: 'Saturdays. Ages 9–15. Billed per term.' },
  { id: C.teensRobotics, code: 'TR-101', title: 'Teens Robotics', unit: UNIT.teens, level: 'beginner', weeks: 12, modes: ['on_campus'], priceNaira: 150_000, contentLessons: 8, coverage: videoOnly(8), outcomes: ['Assemble and program a line-following robot', 'Read a circuit diagram', 'Work in a build team'], tags: ['teens', 'robotics', 'arduino'], summary: 'Saturdays. Ages 11–17. Kit included in the term fee.' },
  { id: C.corporateExcel, code: 'EX-101', title: 'Corporate Excel & Analytics', unit: UNIT.corporate, level: 'beginner', weeks: 4, modes: ['on_campus', 'virtual'], priceNaira: 320_000, contentLessons: 7, coverage: videoOnly(7), outcomes: ['Model a budget that does not break', 'Build pivot reporting that updates itself', 'Present numbers to a board'], tags: ['corporate', 'excel', 'b2b'], summary: 'Four weeks, delivered on the client site. Invoiced to the organisation.' },
]

export const courses: Course[] = COURSE_SPECS.map((s, i) => ({
  id: s.id,
  code: s.code,
  title: s.title,
  summary: s.summary,
  description: `${s.summary} ${s.outcomes.length} learning outcomes, ${s.weeks} weeks, delivered ${s.modes
    .map((m) => m.replace('_', ' '))
    .join(' / ')}.`,
  unitId: s.unit,
  level: s.level,
  durationWeeks: s.weeks,
  modes: s.modes,
  listPrice: ngn(s.priceNaira),
  coverImageUrl: `/covers/${s.code.toLowerCase()}.jpg`,
  learningOutcomes: s.outcomes,
  prerequisiteCourseIds: s.level === 'advanced' ? [C.dataAnalysis] : [],
  tags: s.tags,
  status: 'published',
  certificateRules:
    s.id === C.dataAnalysis
      ? { ...defaultCertRules, projectMinimumGrade: 60, requiredAssignments: 'all' }
      : s.unit === UNIT.teens
        ? { ...defaultCertRules, attendanceThreshold: 70, projectRequired: false, financialClearanceRequired: true }
        : defaultCertRules,
  stats: {
    activeCohorts: 0, // filled in below, once cohorts exist
    totalEnrolled: 0,
    completionRate: 68 + ((i * 7) % 22),
    formatCoverage: s.coverage,
  },
  ...audit(at('2025-01-15', 10, 0), U.emeka),
}))

/** Content-lesson count per course — `learn.ts` builds the outline from this. */
export const contentLessonCount = new Map<string, number>(COURSE_SPECS.map((s) => [s.id, s.contentLessons]))
export const courseById = new Map<string, Course>(courses.map((c) => [c.id, c]))

/* -------------------------------------------------------------------------- */
/* Cohorts — 34: 19 completed, 11 running, 4 starting soon                    */
/* -------------------------------------------------------------------------- */

interface CohortSpec {
  code: string
  course: CourseId
  branch: BranchId
  mode: Mode
  start: string
  end: string
  seats: number
  enrolled: number
  waitlist: number
  status: CohortStatus
  schedule: string
  attendance: number
  completion: number
  tutor: PersonId
}

const COHORT_SPECS: CohortSpec[] = [
  /* ── Completed: 19 ───────────────────────────────────────────────────── */
  { code: 'DA-C10', course: C.dataAnalysis, branch: BR.ibadan, mode: 'on_campus', start: '2025-09-08', end: '2025-12-05', seats: 25, enrolled: 10, waitlist: 0, status: 'completed', schedule: 'Tue & Thu, 18:00–20:00', attendance: 84, completion: 90, tutor: P.tundeBakare },
  { code: 'DA-C11', course: C.dataAnalysis, branch: BR.lagos, mode: 'hybrid', start: '2026-01-12', end: '2026-04-10', seats: 25, enrolled: 9, waitlist: 0, status: 'completed', schedule: 'Mon & Wed, 18:00–20:00', attendance: 79, completion: 78, tutor: P.tundeBakare },
  { code: 'PD-C07', course: C.productDesign, branch: BR.ibadan, mode: 'on_campus', start: '2025-10-06', end: '2026-01-09', seats: 20, enrolled: 8, waitlist: 0, status: 'completed', schedule: 'Mon & Fri, 17:00–19:00', attendance: 88, completion: 88, tutor: person(31) },
  { code: 'PD-C08', course: C.productDesign, branch: BR.virtual, mode: 'virtual', start: '2026-02-02', end: '2026-05-01', seats: 30, enrolled: 11, waitlist: 2, status: 'completed', schedule: 'Tue & Sat, 10:00–12:00', attendance: 74, completion: 73, tutor: person(31) },
  { code: 'FE-C05', course: C.frontend, branch: BR.ibadan, mode: 'on_campus', start: '2025-09-15', end: '2026-01-09', seats: 25, enrolled: 10, waitlist: 0, status: 'completed', schedule: 'Mon, Wed & Fri, 18:00–20:00', attendance: 81, completion: 80, tutor: P.kabiru },
  { code: 'FE-C06', course: C.frontend, branch: BR.virtual, mode: 'virtual', start: '2026-01-19', end: '2026-05-15', seats: 30, enrolled: 12, waitlist: 3, status: 'completed', schedule: 'Tue & Thu, 19:00–21:00', attendance: 69, completion: 67, tutor: P.kabiru },
  { code: 'BE-C04', course: C.backend, branch: BR.ibadan, mode: 'on_campus', start: '2025-10-13', end: '2026-02-06', seats: 20, enrolled: 7, waitlist: 0, status: 'completed', schedule: 'Mon & Wed, 18:00–20:30', attendance: 86, completion: 86, tutor: P.kabiru },
  { code: 'DM-C06', course: C.digitalMarketing, branch: BR.ibadan, mode: 'on_campus', start: '2025-11-03', end: '2026-01-02', seats: 30, enrolled: 13, waitlist: 0, status: 'completed', schedule: 'Sat, 10:00–14:00', attendance: 77, completion: 84, tutor: person(33) },
  { code: 'DM-C07', course: C.digitalMarketing, branch: BR.lagos, mode: 'on_campus', start: '2026-02-09', end: '2026-04-10', seats: 30, enrolled: 10, waitlist: 1, status: 'completed', schedule: 'Sat, 10:00–14:00', attendance: 72, completion: 70, tutor: person(33) },
  { code: 'CS-C03', course: C.cyber, branch: BR.virtual, mode: 'virtual', start: '2025-10-20', end: '2026-01-16', seats: 25, enrolled: 8, waitlist: 0, status: 'completed', schedule: 'Tue & Thu, 19:00–21:00', attendance: 66, completion: 63, tutor: person(35) },
  { code: 'PM-C04', course: C.productManagement, branch: BR.ibadan, mode: 'hybrid', start: '2026-01-26', end: '2026-04-06', seats: 20, enrolled: 7, waitlist: 0, status: 'completed', schedule: 'Wed, 18:00–20:30', attendance: 83, completion: 85, tutor: person(37) },
  { code: 'DS-C02', course: C.dataScience, branch: BR.virtual, mode: 'virtual', start: '2025-09-01', end: '2026-01-30', seats: 20, enrolled: 5, waitlist: 0, status: 'completed', schedule: 'Mon, Wed & Sat', attendance: 71, completion: 60, tutor: P.tundeBakare },
  { code: 'GD-C05', course: C.graphics, branch: BR.ibadan, mode: 'on_campus', start: '2026-03-02', end: '2026-05-15', seats: 25, enrolled: 9, waitlist: 0, status: 'completed', schedule: 'Tue & Thu, 16:00–18:00', attendance: 80, completion: 82, tutor: person(39) },
  { code: 'VE-C03', course: C.videoEditing, branch: BR.ibadan, mode: 'on_campus', start: '2026-02-16', end: '2026-04-17', seats: 25, enrolled: 8, waitlist: 0, status: 'completed', schedule: 'Mon & Wed, 16:00–18:00', attendance: 75, completion: 74, tutor: person(41) },
  { code: 'MD-C02', course: C.mobile, branch: BR.virtual, mode: 'virtual', start: '2025-11-10', end: '2026-03-06', seats: 25, enrolled: 7, waitlist: 0, status: 'completed', schedule: 'Tue & Thu, 19:00–21:00', attendance: 68, completion: 64, tutor: person(43) },
  { code: 'TC-T05', course: C.teensCoding, branch: BR.ibadan, mode: 'on_campus', start: '2026-01-10', end: '2026-03-28', seats: 30, enrolled: 14, waitlist: 4, status: 'completed', schedule: 'Sat, 09:00–12:00', attendance: 91, completion: 95, tutor: person(45) },
  { code: 'TR-T03', course: C.teensRobotics, branch: BR.ibadan, mode: 'on_campus', start: '2026-01-10', end: '2026-03-28', seats: 20, enrolled: 8, waitlist: 2, status: 'completed', schedule: 'Sat, 13:00–16:00', attendance: 89, completion: 92, tutor: person(45) },
  { code: 'EX-B08', course: C.corporateExcel, branch: BR.lagos, mode: 'on_campus', start: '2026-03-16', end: '2026-04-10', seats: 40, enrolled: 16, waitlist: 0, status: 'completed', schedule: 'Mon–Thu, 09:00–13:00 (on client site)', attendance: 94, completion: 97, tutor: person(47) },
  { code: 'CL-C02', course: C.cloud, branch: BR.virtual, mode: 'virtual', start: '2025-10-06', end: '2026-02-27', seats: 20, enrolled: 6, waitlist: 0, status: 'completed', schedule: 'Mon & Wed, 19:00–21:00', attendance: 70, completion: 66, tutor: person(49) },

  /* ── Running: 11 ─────────────────────────────────────────────────────── */
  // Chiamaka's cohort. Intensive — it started 10 Aug and finishes 2 Oct.
  { code: 'DA-C12', course: C.dataAnalysis, branch: BR.ibadan, mode: 'on_campus', start: '2026-08-10', end: '2026-10-02', seats: 20, enrolled: 12, waitlist: 1, status: 'running', schedule: 'Mon, Tue & Thu, 17:00–20:00', attendance: 83, completion: 0, tutor: P.tundeBakare },
  { code: 'PD-C09', course: C.productDesign, branch: BR.ibadan, mode: 'hybrid', start: '2026-07-13', end: '2026-10-09', seats: 20, enrolled: 9, waitlist: 0, status: 'running', schedule: 'Mon & Fri, 17:00–19:00', attendance: 81, completion: 0, tutor: person(31) },
  { code: 'FE-C07', course: C.frontend, branch: BR.ibadan, mode: 'on_campus', start: '2026-06-15', end: '2026-10-09', seats: 25, enrolled: 8, waitlist: 0, status: 'running', schedule: 'Mon, Wed & Fri, 18:00–20:00', attendance: 76, completion: 0, tutor: P.kabiru },
  { code: 'BE-C05', course: C.backend, branch: BR.virtual, mode: 'virtual', start: '2026-06-01', end: '2026-09-25', seats: 20, enrolled: 6, waitlist: 0, status: 'running', schedule: 'Tue & Thu, 19:00–21:30', attendance: 64, completion: 0, tutor: P.kabiru },
  { code: 'DM-C08', course: C.digitalMarketing, branch: BR.ibadan, mode: 'on_campus', start: '2026-08-01', end: '2026-09-26', seats: 30, enrolled: 9, waitlist: 0, status: 'running', schedule: 'Sat, 10:00–14:00', attendance: 78, completion: 0, tutor: person(33) },
  { code: 'CS-C04', course: C.cyber, branch: BR.virtual, mode: 'virtual', start: '2026-07-07', end: '2026-09-29', seats: 25, enrolled: 6, waitlist: 0, status: 'running', schedule: 'Tue & Thu, 19:00–21:00', attendance: 62, completion: 0, tutor: person(35) },
  { code: 'PM-C05', course: C.productManagement, branch: BR.ibadan, mode: 'hybrid', start: '2026-07-22', end: '2026-09-30', seats: 20, enrolled: 5, waitlist: 0, status: 'running', schedule: 'Wed, 18:00–20:30', attendance: 85, completion: 0, tutor: person(37) },
  { code: 'DS-C03', course: C.dataScience, branch: BR.virtual, mode: 'virtual', start: '2026-05-04', end: '2026-09-25', seats: 20, enrolled: 4, waitlist: 0, status: 'running', schedule: 'Mon, Wed & Sat', attendance: 69, completion: 0, tutor: P.tundeBakare },
  { code: 'GD-C06', course: C.graphics, branch: BR.ibadan, mode: 'on_campus', start: '2026-07-14', end: '2026-09-24', seats: 25, enrolled: 7, waitlist: 0, status: 'running', schedule: 'Tue & Thu, 16:00–18:00', attendance: 74, completion: 0, tutor: person(39) },
  { code: 'MD-C03', course: C.mobile, branch: BR.virtual, mode: 'virtual', start: '2026-06-09', end: '2026-10-01', seats: 25, enrolled: 5, waitlist: 0, status: 'running', schedule: 'Tue & Thu, 19:00–21:00', attendance: 58, completion: 0, tutor: person(43) },
  { code: 'TC-T06', course: C.teensCoding, branch: BR.ibadan, mode: 'on_campus', start: '2026-07-04', end: '2026-09-26', seats: 30, enrolled: 10, waitlist: 3, status: 'running', schedule: 'Sat, 09:00–12:00', attendance: 90, completion: 0, tutor: person(45) },

  /* ── Starting soon: 4 ────────────────────────────────────────────────── */
  // The Flow 1 destination: starts 5 Oct, 18 of 25 seats taken.
  { code: 'DA-C13', course: C.dataAnalysis, branch: BR.ibadan, mode: 'on_campus', start: '2026-10-05', end: '2026-12-25', seats: 25, enrolled: 18, waitlist: 0, status: 'open', schedule: 'Mon, Wed & Fri, 17:00–19:30', attendance: 0, completion: 0, tutor: P.tundeBakare },
  { code: 'TR-T04', course: C.teensRobotics, branch: BR.ibadan, mode: 'on_campus', start: '2026-10-03', end: '2026-12-19', seats: 20, enrolled: 5, waitlist: 0, status: 'open', schedule: 'Sat, 13:00–16:00', attendance: 0, completion: 0, tutor: person(45) },
  { code: 'EX-B09', course: C.corporateExcel, branch: BR.lagos, mode: 'on_campus', start: '2026-10-12', end: '2026-11-06', seats: 40, enrolled: 2, waitlist: 0, status: 'open', schedule: 'Mon–Thu, 09:00–13:00 (on client site)', attendance: 0, completion: 0, tutor: person(47) },
  { code: 'TC-T07', course: C.teensCoding, branch: BR.lagos, mode: 'on_campus', start: '2026-11-07', end: '2027-01-30', seats: 30, enrolled: 0, waitlist: 0, status: 'planned', schedule: 'Sat, 09:00–12:00', attendance: 0, completion: 0, tutor: person(45) },
]

export const cohorts: Cohort[] = COHORT_SPECS.map((s) => ({
  id: asCohortId(`coh-${s.code.toLowerCase()}`),
  code: s.code,
  courseId: s.course,
  branchId: s.branch,
  unitId: courseById.get(s.course)?.unitId ?? UNIT.academy,
  mode: s.mode,
  startDate: s.start,
  endDate: s.end,
  seats: s.seats,
  enrolledCount: s.enrolled,
  waitlistCount: s.waitlist,
  status: s.status,
  scheduleSummary: s.schedule,
  attendanceRate: s.attendance,
  completionRate: s.completion,
  ...audit(at(addDays(s.start, -45), 11, 0), U.emeka),
}))

export const cohortById = new Map<string, Cohort>(cohorts.map((c) => [c.id, c]))

/** Total seated enrolments across the catalogue — 284. `crm.ts` sizes itself from this. */
export const TOTAL_SEATED = COHORT_SPECS.reduce((acc, s) => acc + s.enrolled, 0)

/** Cohorts in the order `crm.ts` fills them with admissions. */
export const cohortFillOrder = COHORT_SPECS.map((s) => ({
  cohortId: asCohortId(`coh-${s.code.toLowerCase()}`),
  courseId: s.course,
  branchId: s.branch,
  mode: s.mode,
  start: s.start,
  end: s.end,
  enrolled: s.enrolled,
  status: s.status,
  tutor: s.tutor,
}))

/* Backfill the per-course cohort and enrolment stats. */
for (const course of courses) {
  const mine = COHORT_SPECS.filter((s) => s.course === course.id)
  course.stats.activeCohorts = mine.filter((s) => s.status === 'running' || s.status === 'open').length
  course.stats.totalEnrolled = mine.reduce((acc, s) => acc + s.enrolled, 0)
}

/* -------------------------------------------------------------------------- */
/* Tutor assignments — ended, never reassigned in place                       */
/* -------------------------------------------------------------------------- */

const tutorAssignments: TutorAssignment[] = []
let taSeq = 0

for (const s of COHORT_SPECS) {
  taSeq += 1
  const id = tutorAssignId(`ta-${pad(taSeq)}`)
  tutorAssignments.push({
    id,
    cohortId: asCohortId(`coh-${s.code.toLowerCase()}`),
    tutorPersonId: s.tutor,
    role: 'lead',
    startDate: s.start,
    endDate: s.status === 'completed' ? s.end : null,
    sessionsDelivered: s.status === 'completed' ? int(r, 18, 36) : s.status === 'running' ? int(r, 6, 22) : 0,
    status: s.status === 'completed' ? 'ended' : 'active',
    endReason: s.status === 'completed' ? 'Cohort completed' : null,
    replacedByAssignmentId: null,
    ...audit(at(addDays(s.start, -20), 10, 0), U.emeka),
  })
}

/**
 * The never-reassign-in-place demonstration: FE-C07's original lead tutor was
 * ended mid-cohort and a *new* assignment row created. The old row keeps its
 * session count.
 */
const feC07 = asCohortId('coh-fe-c07')
const original = tutorAssignments.find((t) => t.cohortId === feC07)
if (original) {
  const replacement = tutorAssignId('ta-0035')
  original.endDate = '2026-08-14'
  original.status = 'ended'
  original.endReason = 'Tutor moved to the Lagos campus. Assignment ended, not overwritten.'
  original.replacedByAssignmentId = replacement
  original.sessionsDelivered = 16
  tutorAssignments.push({
    id: replacement,
    cohortId: feC07,
    tutorPersonId: person(51),
    role: 'lead',
    startDate: '2026-08-17',
    endDate: null,
    sessionsDelivered: 9,
    status: 'active',
    endReason: null,
    replacedByAssignmentId: null,
    ...audit(at('2026-08-15', 12, 30), U.emeka),
  })
}

// A couple of assistants and one guest, so the role filter has something to do.
tutorAssignments.push(
  {
    id: tutorAssignId('ta-0036'),
    cohortId: asCohortId('coh-da-c12'),
    tutorPersonId: P.kabiru,
    role: 'assistant',
    startDate: '2026-08-10',
    endDate: null,
    sessionsDelivered: 11,
    status: 'active',
    endReason: null,
    replacedByAssignmentId: null,
    ...audit(at('2026-08-05', 9, 30), U.emeka),
  },
  {
    id: tutorAssignId('ta-0037'),
    cohortId: asCohortId('coh-pd-c09'),
    tutorPersonId: person(53),
    role: 'guest',
    startDate: '2026-09-07',
    endDate: '2026-09-07',
    sessionsDelivered: 1,
    status: 'ended',
    endReason: 'Single guest session on design systems',
    replacedByAssignmentId: null,
    ...audit(at('2026-09-01', 15, 0), U.emeka),
  },
)

export { tutorAssignments }

/* -------------------------------------------------------------------------- */
/* Class sessions — the timetable                                             */
/* -------------------------------------------------------------------------- */

const DA_TOPICS = [
  'Course orientation and the analyst mindset',
  'Spreadsheets that do not lie',
  'Power Query: cleaning the Lagos sales extract',
  'Relational thinking and your first JOIN',
  'Aggregations, window functions and the GROUP BY trap',
  'Descriptive statistics without the jargon',
  'Distributions, outliers and what to do about them',
  'Correlation, causation and the regression line',
  'Building a Power BI model',
  'Dashboard design for people who hate dashboards',
  'Storytelling with a single chart',
  'The portfolio project brief',
  'Project clinic and peer review',
  'Final presentations',
]

const GENERIC_TOPICS = [
  'Orientation and tooling setup',
  'Core concepts, part one',
  'Core concepts, part two',
  'Hands-on lab',
  'Case study walkthrough',
  'Peer review clinic',
  'Mid-programme assessment',
  'Applied project work',
  'Advanced topics',
  'Integration workshop',
  'Portfolio clinic',
  'Final presentations',
]

const classSessions: ClassSession[] = []
let sessSeq = 0

for (const s of COHORT_SPECS) {
  if (s.status === 'planned') continue
  const cid = asCohortId(`coh-${s.code.toLowerCase()}`)
  const topics = s.course === C.dataAnalysis ? DA_TOPICS : GENERIC_TOPICS
  // Two or three sessions a week, capped so the seed stays a sensible size.
  const totalSessions = s.status === 'open' ? 0 : Math.min(topics.length, s.status === 'completed' ? 8 : 14)
  const stepDays = s.status === 'completed' ? 7 : 4

  for (let i = 0; i < totalSessions; i++) {
    let date = addDays(s.start, i * stepDays)
    // Nudge weekend dates for weekday cohorts, except the Teens Saturday classes.
    if (!s.schedule.startsWith('Sat') && dayOfWeek(date) === 0) date = addDays(date, 1)
    sessSeq += 1
    const delivered = date < TODAY
    const expected = s.enrolled
    const present = delivered ? Math.max(0, Math.round((expected * s.attendance) / 100) + int(r, -1, 1)) : 0
    // Most delivered sessions have a recording within a day or two; the most
    // recent one or two are plausibly still processing, so this isn't 100%.
    const daysSinceDelivered = delivered ? Math.round((Date.parse(TODAY) - Date.parse(date)) / 86_400_000) : 0
    const hasRecording = delivered && daysSinceDelivered >= 2 && int(r, 1, 10) <= 8
    classSessions.push({
      id: sessionId(`ses-${pad(sessSeq, 4)}`),
      cohortId: cid,
      sequence: i + 1,
      topic: topics[i % topics.length],
      date,
      startTime: s.schedule.includes('09:00') ? '09:00' : s.schedule.includes('10:00') ? '10:00' : s.schedule.includes('16:00') ? '16:00' : s.schedule.includes('19:00') ? '19:00' : '17:00',
      endTime: s.schedule.includes('09:00') ? '12:00' : s.schedule.includes('10:00') ? '14:00' : s.schedule.includes('16:00') ? '18:00' : s.schedule.includes('19:00') ? '21:00' : '20:00',
      room: s.mode === 'virtual' ? null : pick(r, ['Bodija Lab 1', 'Bodija Lab 2', 'Yaba Studio', 'Bodija Seminar Room']),
      meetingUrl: s.mode === 'on_campus' ? null : `https://meet.cirvee.com/${s.code.toLowerCase()}-${i + 1}`,
      recordingUrl: hasRecording ? `https://recordings.cirvee.com/${s.code.toLowerCase()}/session-${i + 1}` : null,
      tutorPersonId: s.tutor,
      expectedCount: expected,
      presentCount: present,
      status: delivered ? 'delivered' : date === TODAY ? 'in_progress' : 'scheduled',
      ...audit(at(addDays(date, -10), 9, 0), U.emeka),
    })
  }
}

/** One cancelled and one rescheduled session, so those states exist in the list. */
const cancelTarget = classSessions.find((s) => s.status === 'scheduled')
if (cancelTarget) {
  cancelTarget.status = 'cancelled'
  cancelTarget.presentCount = 0
}
const rescheduleTarget = classSessions.filter((s) => s.status === 'scheduled')[3]
if (rescheduleTarget) rescheduleTarget.status = 'rescheduled'

export { classSessions }

export const sessionsByCohort = new Map<string, ClassSession[]>()
for (const s of classSessions) {
  const list = sessionsByCohort.get(s.cohortId) ?? []
  list.push(s)
  sessionsByCohort.set(s.cohortId, list)
}

void SYSTEM_USER
