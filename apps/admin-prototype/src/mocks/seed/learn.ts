/**
 * Cirvee Learn — enrolments, the course outline, the multi-format content
 * library, assignments and grading, progress, attendance and certificates.
 *
 * The differentiator this file has to make real: **a lesson can exist in five
 * formats, and most of them do not.** Data Analysis is 14/14 video, 9/14
 * audio, 4/14 podcast, 14/14 PDF, 11/14 transcript. Product Design is complete
 * across all five. The other thirteen courses are video-only. Those gaps are
 * seeded, so the coverage matrix means something and so the learner view has
 * real disabled tabs to show.
 *
 * Enrolments live here rather than in `academy.ts` because an Enrolment needs
 * an Admission, and Admissions are created in `crm.ts`.
 */

import {
  assetId,
  assignmentId as asAssignmentId,
  certId,
  discussionPostId,
  enrollmentId as asEnrollmentId,
  lessonId as asLessonId,
  moduleId as asModuleId,
  progressId,
  quizId as asQuizId,
  stuAttId,
  submissionId,
  type Assignment,
  type AttentionFlag,
  type Certificate,
  type CohortDiscussionPost,
  type ContentAsset,
  type ContentFormat,
  type CourseModule,
  type Enrollment,
  type EnrollmentStatus,
  type Lesson,
  type LessonType,
  type Progress,
  type Quiz,
  type StudentAttendance,
  type Submission,
  type ContentAssetId,
  type LessonId,
  type PersonId,
} from '@/mocks/types'
import { BR, C, P, U, UNIT } from '@/mocks/seed/ids'
import { classSessions, cohortById, contentLessonCount, courses, courseById } from '@/mocks/seed/academy'
import { admissions } from '@/mocks/seed/crm'
import { fullName } from '@/mocks/seed/people'
import {
  addDays,
  at,
  audit,
  chance,
  daysAgo,
  daysBetweenTodayAnd,
  int,
  pad,
  pick,
  rng,
  TODAY,
} from '@/mocks/seed/_helpers'

const r = rng(77321)

/* -------------------------------------------------------------------------- */
/* Enrolments                                                                 */
/* -------------------------------------------------------------------------- */

const ADVISORS = [U.folake, U.emeka, U.aisha]

const enrollments: Enrollment[] = []

for (const adm of admissions) {
  if (adm.status !== 'enrolled' && adm.status !== 'withdrawn') continue
  const cohort = cohortById.get(adm.cohortId)
  const id = asEnrollmentId(`enr-${adm.id.replace('adm-', '')}`)
  const status: EnrollmentStatus =
    adm.status === 'withdrawn' ? 'withdrawn' : cohort?.status === 'completed' ? 'completed' : 'active'

  const flags: AttentionFlag[] = []
  if (status === 'active') {
    if (chance(r, 0.12)) flags.push('low_attendance')
    if (chance(r, 0.09)) flags.push('missing_assignments')
    if (chance(r, 0.07)) flags.push('low_lms_activity')
    if (chance(r, 0.06)) flags.push('repeated_absence')
  }

  enrollments.push({
    id,
    personId: adm.personId,
    cohortId: adm.cohortId,
    courseId: adm.courseId,
    admissionId: adm.id,
    unitId: adm.unitId,
    enrolledAt: adm.createdAt.slice(0, 10),
    status,
    advisorUserId: ADVISORS[enrollments.length % ADVISORS.length],
    attentionFlags: flags,
    flaggedAt: flags.length ? at(daysAgo(int(r, 2, 25)), 8, 0) : null,
    ...audit(adm.createdAt, U.emeka),
  })
}

/* Chiamaka carries no flags — Flow 5 step 12 checks for exactly that. */
const chiamakaEnrolment = enrollments.find((e) => e.id === 'enr-0151')
if (chiamakaEnrolment) {
  chiamakaEnrolment.attentionFlags = []
  chiamakaEnrolment.flaggedAt = null
  chiamakaEnrolment.advisorUserId = U.folake
}

/* Tunde Adeyemi's only flag is the balance — academically he is clear. */
const tundeEnrolment = enrollments.find((e) => e.id === 'enr-0149')
if (tundeEnrolment) {
  tundeEnrolment.attentionFlags = ['overdue_balance']
  tundeEnrolment.flaggedAt = at('2026-09-11', 8, 0)
}

export { enrollments }
export const enrollmentById = new Map<string, Enrollment>(enrollments.map((e) => [e.id, e]))
export const enrollmentsByPerson = new Map<string, Enrollment[]>()
for (const e of enrollments) {
  const list = enrollmentsByPerson.get(e.personId) ?? []
  list.push(e)
  enrollmentsByPerson.set(e.personId, list)
}

/* -------------------------------------------------------------------------- */
/* Course outline — Data Analysis, in full                                    */
/* -------------------------------------------------------------------------- */

const courseModules: CourseModule[] = []
const lessons: Lesson[] = []
const contentAssets: ContentAsset[] = []

const authored = audit(at('2026-05-12', 11, 0), U.tundeBakare)

function addModule(courseId: string, seq: number, title: string, summary: string): string {
  const id = `mod-${courseId}-${seq}`
  courseModules.push({
    id: asModuleId(id),
    courseId: courseId as CourseModule['courseId'],
    sequence: seq,
    title,
    summary,
    status: 'published',
    ...authored,
  })
  return id
}

interface LessonSpec {
  title: string
  type: LessonType
  minutes: number
  formats?: ContentFormat[]
}

/** The Data Analysis outline: 6 modules, 28 lessons, 14 of them content. */
const DA_OUTLINE: Array<{ title: string; summary: string; lessons: LessonSpec[] }> = [
  {
    title: 'Foundations',
    summary: 'What an analyst actually does, and the tools you will live in.',
    lessons: [
      { title: 'Course orientation and the analyst mindset', type: 'content', minutes: 22, formats: ['video', 'audio', 'podcast', 'pdf', 'transcript'] },
      { title: 'Spreadsheets that do not lie', type: 'content', minutes: 38, formats: ['video', 'audio', 'podcast', 'pdf', 'transcript'] },
      { title: 'Asking a question a dataset can answer', type: 'content', minutes: 31, formats: ['video', 'audio', 'pdf', 'transcript'] },
      { title: 'Module 1 knowledge check', type: 'quiz', minutes: 15 },
      { title: 'Warm-up: profile the Bodija retail extract', type: 'assignment', minutes: 90 },
    ],
  },
  {
    title: 'Data wrangling',
    summary: 'Real data is filthy. This module is where most of the job happens.',
    lessons: [
      { title: 'Power Query: cleaning the Lagos sales extract', type: 'content', minutes: 46, formats: ['video', 'audio', 'pdf', 'transcript'] },
      { title: 'Joins, lookups and the duplicated-row disaster', type: 'content', minutes: 41, formats: ['video', 'audio', 'podcast', 'pdf', 'transcript'] },
      { title: 'Dates, currencies and Nigerian address data', type: 'content', minutes: 35, formats: ['video', 'pdf', 'transcript'] },
      { title: 'Clean and document a supplied dataset', type: 'assignment', minutes: 180 },
      { title: 'Live clinic: bring your messiest file', type: 'live_session', minutes: 90 },
    ],
  },
  {
    title: 'SQL',
    summary: 'Enough SQL to stop asking someone else for an extract.',
    lessons: [
      { title: 'Relational thinking and your first JOIN', type: 'content', minutes: 44, formats: ['video', 'audio', 'podcast', 'pdf', 'transcript'] },
      { title: 'Aggregations, window functions and the GROUP BY trap', type: 'content', minutes: 52, formats: ['video', 'pdf'] },
      { title: 'SQL practical', type: 'assignment', minutes: 150 },
      { title: 'SQL knowledge check', type: 'quiz', minutes: 20 },
      { title: 'Live session: query review', type: 'live_session', minutes: 90 },
    ],
  },
  {
    title: 'Statistics that matter',
    summary: 'The four ideas you will use every week, without the notation.',
    lessons: [
      { title: 'Descriptive statistics without the jargon', type: 'content', minutes: 33, formats: ['video', 'audio', 'pdf', 'transcript'] },
      { title: 'Distributions, outliers and what to do about them', type: 'content', minutes: 39, formats: ['video', 'pdf', 'transcript'] },
      { title: 'Correlation, causation and the regression line', type: 'content', minutes: 48, formats: ['video', 'audio', 'podcast', 'pdf', 'transcript'] },
      { title: 'Statistics knowledge check', type: 'quiz', minutes: 20 },
      { title: 'Regression mini-project', type: 'assignment', minutes: 150 },
    ],
  },
  {
    title: 'Visualisation and reporting',
    summary: 'Charts people act on, not charts people admire.',
    lessons: [
      { title: 'Building a Power BI model', type: 'content', minutes: 50, formats: ['video', 'audio', 'pdf', 'transcript'] },
      { title: 'Dashboard design for people who hate dashboards', type: 'content', minutes: 37, formats: ['video', 'pdf', 'transcript'] },
      { title: 'Dashboard build', type: 'assignment', minutes: 210 },
      { title: 'Visualisation knowledge check', type: 'quiz', minutes: 15 },
      { title: 'Live critique of cohort dashboards', type: 'live_session', minutes: 120 },
    ],
  },
  {
    title: 'Capstone',
    summary: 'One dataset, one question, one presentation.',
    lessons: [
      { title: 'Storytelling with a single chart', type: 'content', minutes: 28, formats: ['video', 'pdf'] },
      { title: 'Final project — sales dataset analysis', type: 'assignment', minutes: 480 },
      { title: 'Portfolio project and presentation', type: 'project', minutes: 600 },
    ],
  },
]

/* ── Content assets ──────────────────────────────────────────────────────── */

const TRANSCRIPTS: Record<string, string> = {
  'Correlation, causation and the regression line':
    'So the first thing to say about regression is that it does not prove anything caused anything. What a regression line gives you is a best guess at how one number moves when another moves. If we plot weekly advertising spend against weekly sales for the Bodija branch, the regression line tells us that every extra ten thousand naira of spend is associated with roughly forty thousand naira of sales — associated with, not causing. Before you report a regression coefficient to a manager, check three things: the residuals, the range of the data, and whether anything else changed in the same period.',
  'Distributions, outliers and what to do about them':
    'Most real datasets are not normally distributed and pretending otherwise will embarrass you. Nigerian retail sales data is almost always right-skewed: a long tail of very large transactions sits above a dense cluster of small ones. If you run a regression on that without transforming it, the tail drags your line. The usual move is a log transform, then check whether the relationship still holds. An outlier is not automatically an error — the ₦4.2 million transaction in row 8,119 was a genuine corporate order, and deleting it would have hidden the most profitable customer in the file.',
  'Building a Power BI model':
    'A model is not a pile of tables. Before you drag a single field onto a canvas, decide which table is your fact table and which are dimensions. In the retail extract, transactions are the facts; stores, products and dates are dimensions. Get the relationships right and every measure you write afterwards is one line. Get them wrong and you will spend the rest of the course writing defensive DAX.',
  'Power Query: cleaning the Lagos sales extract':
    'The Lagos extract arrives as a CSV with merged header rows, three different date formats and a currency column that is text. We will fix all three in Power Query rather than by hand, because the file arrives again every Monday and hand-fixing it is how analysts lose their evenings.',
  'Relational thinking and your first JOIN':
    'A JOIN is a sentence: for each row on the left, find the matching rows on the right. The question that trips everyone up is what happens when there is no match, and the answer depends on which kind of join you asked for. Start every query by writing the sentence in English.',
  'Joins, lookups and the duplicated-row disaster':
    'If your row count goes up after a join, you did not make more data — you made duplicates. Nine times in ten the key you joined on is not unique on one side. Count distinct keys on both sides before you join, every time.',
  'Course orientation and the analyst mindset':
    'Over the next twelve weeks you will be given real, unhelpful data and asked to make a decision from it. The skill we are building is not Excel and it is not SQL. It is the habit of asking what decision this number is going to change before you spend three hours producing it.',
  'Spreadsheets that do not lie':
    'Three habits separate a spreadsheet that survives from one that quietly breaks: one purpose per sheet, never hard-code a number inside a formula, and put your assumptions in a visible block at the top. Everything else in this lesson is a consequence of those three.',
  'Asking a question a dataset can answer':
    'Which branch is performing badly is not a question a dataset can answer. Which branch had the largest month-on-month fall in gross margin between June and August is. The second one takes ten minutes; the first one takes a week and ends in an argument.',
  'Descriptive statistics without the jargon':
    'Mean, median, spread, shape. If you can describe a column with those four things you can hold your own in almost any meeting. The mean of Nigerian salary data is almost always misleading; lead with the median and show the spread.',
  'Dashboard design for people who hate dashboards':
    'Your reader has about eight seconds. One headline number, one comparison, one thing they can click. If your dashboard needs a walkthrough it is a report, not a dashboard.',
}

let assetSeq = 0
function makeAsset(
  lessonId: LessonId,
  format: ContentFormat,
  lessonTitle: string,
  minutes: number,
): ContentAssetId {
  assetSeq += 1
  const id = assetId(`asset-${pad(assetSeq, 4)}`)
  const slug = lessonTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)
  const base: ContentAsset = {
    id,
    lessonId,
    format,
    fileName: `${slug}.${format === 'video' ? 'mp4' : format === 'audio' || format === 'podcast' ? 'm4a' : format === 'pdf' ? 'pdf' : 'txt'}`,
    fileSizeBytes: 0,
    language: 'en',
    status: 'published',
    downloadCount: int(r, 4, 310),
    offlineEnabled: true,
    ...authored,
  }

  if (format === 'video') {
    base.fileSizeBytes = minutes * 11_500_000
    base.durationSeconds = minutes * 60
    base.variants = [
      { label: '1080p', fileSizeBytes: minutes * 11_500_000, bitrateKbps: 4200, status: 'ready' },
      { label: '720p', fileSizeBytes: minutes * 6_200_000, bitrateKbps: 2200, status: 'ready' },
      { label: '480p', fileSizeBytes: minutes * 3_100_000, bitrateKbps: 1100, status: 'ready' },
      // The one that matters on a Nigerian data plan. Its absence is an error.
      { label: '240p_low_data', fileSizeBytes: minutes * 900_000, bitrateKbps: 320, status: 'ready' },
    ]
  } else if (format === 'audio') {
    base.fileSizeBytes = minutes * 900_000
    base.durationSeconds = minutes * 60
    base.audioOrigin = chance(r, 0.7) ? 'generated_from_video' : 'recorded_separately'
    base.voice = base.audioOrigin === 'generated_from_video' ? 'Cirvee Narrator (en-NG)' : 'Tunde Bakare'
  } else if (format === 'podcast') {
    assetPodcastSeq += 1
    base.fileSizeBytes = minutes * 950_000
    base.durationSeconds = minutes * 60
    base.podcast = {
      feedName: 'Cirvee Data Clinic',
      episodeNumber: assetPodcastSeq,
      episodeTitle: lessonTitle,
      publishedAt: addDays('2026-05-12', assetPodcastSeq * 7),
      publicFeedUrl: 'https://feeds.cirvee.com/data-clinic.xml',
    }
  } else if (format === 'pdf') {
    base.fileSizeBytes = int(r, 400_000, 3_400_000)
    base.pageCount = int(r, 8, 34)
  } else {
    const body = TRANSCRIPTS[lessonTitle]
    base.fileSizeBytes = (body?.length ?? 900) * 2
    base.transcriptBody =
      body ??
      `Transcript for "${lessonTitle}". Auto-generated from the video track and not yet reviewed by the tutor.`
    base.transcriptOrigin = body ? 'human_reviewed' : 'auto_generated'
  }

  contentAssets.push(base)
  return id
}

let assetPodcastSeq = 0

/* ── Build the Data Analysis tree ───────────────────────────────────────── */

let daLessonSeq = 0
const daAssignmentLessonIds: LessonId[] = []
const daQuizLessonIds: LessonId[] = []

DA_OUTLINE.forEach((mod, mi) => {
  const moduleId = addModule('da-101', mi + 1, mod.title, mod.summary)
  mod.lessons.forEach((spec, li) => {
    daLessonSeq += 1
    const id = asLessonId(`les-da-${pad(daLessonSeq, 3)}`)
    const formats: Partial<Record<ContentFormat, ContentAssetId>> = {}
    for (const f of spec.formats ?? []) formats[f] = makeAsset(id, f, spec.title, spec.minutes)
    const hasLowData = spec.formats?.includes('video') ?? false
    lessons.push({
      id,
      moduleId: asModuleId(moduleId),
      courseId: C.dataAnalysis,
      sequence: li + 1,
      title: spec.title,
      type: spec.type,
      durationMinutes: spec.minutes,
      status: 'published',
      formats,
      offlineEnabled: true,
      androidCheck: hasLowData
        ? { passes: true, issues: [] }
        : { passes: true, issues: [] },
      resources:
        spec.type === 'content'
          ? [{ label: 'Worked example workbook', url: `/library/da/${pad(daLessonSeq, 3)}-workbook.xlsx` }]
          : [],
      quizId: spec.type === 'quiz' ? asQuizId(`quiz-da-${pad(daQuizLessonIds.length + 1, 2)}`) : null,
      // The capstone lesson is the presentation of the final project assignment,
      // not a seventh assignment of its own.
      assignmentId: spec.type === 'assignment' ? asAssignmentId(`asg-da-${pad(daAssignmentLessonIds.length + 1, 2)}`) : null,
      ...authored,
    })
    if (spec.type === 'quiz') daQuizLessonIds.push(id)
    if (spec.type === 'assignment') daAssignmentLessonIds.push(id)
  })
})

/* ── Product Design: the one complete course ────────────────────────────── */

const PD_LESSONS: string[] = [
  'What research is for',
  'Running a discovery interview',
  'Synthesis: from transcript to insight',
  'Job stories and problem framing',
  'Flows before screens',
  'Wireframing at speed',
  'Type, spacing and the 4-point grid',
  'Colour, contrast and accessibility',
  'Components and the first design system',
  'Prototyping for a usability test',
  'Running a usability test with five people',
  'Presenting and defending a design decision',
]

const pdModuleTitles = [
  ['Discovery', 'Talking to people without leading them.'],
  ['Definition', 'Turning what you heard into something to build.'],
  ['Interface', 'The craft layer: type, colour, spacing, components.'],
  ['Validation', 'Prototypes, tests and the argument at the end.'],
]

let pdLessonSeq = 0
pdModuleTitles.forEach(([title, summary], mi) => {
  const moduleId = addModule('pd-101', mi + 1, title, summary)
  for (let li = 0; li < 3; li++) {
    pdLessonSeq += 1
    const lessonTitle = PD_LESSONS[pdLessonSeq - 1]
    const id = asLessonId(`les-pd-${pad(pdLessonSeq, 3)}`)
    const minutes = 28 + ((pdLessonSeq * 5) % 24)
    const formats: Partial<Record<ContentFormat, ContentAssetId>> = {
      video: makeAsset(id, 'video', lessonTitle, minutes),
      audio: makeAsset(id, 'audio', lessonTitle, minutes),
      podcast: makeAsset(id, 'podcast', lessonTitle, minutes),
      pdf: makeAsset(id, 'pdf', lessonTitle, minutes),
      transcript: makeAsset(id, 'transcript', lessonTitle, minutes),
    }
    lessons.push({
      id,
      moduleId: asModuleId(moduleId),
      courseId: C.productDesign,
      sequence: li + 1,
      title: lessonTitle,
      type: 'content',
      durationMinutes: minutes,
      status: 'published',
      formats,
      offlineEnabled: true,
      androidCheck: { passes: true, issues: [] },
      resources: [{ label: 'Figma starter file', url: `/library/pd/${pad(pdLessonSeq, 3)}-starter.fig` }],
      quizId: null,
      assignmentId: null,
      ...authored,
    })
  }
})

// Two assignments on Product Design, so its grading queue is not empty.
const pdAssignmentLessons: LessonId[] = []
for (let i = 0; i < 2; i++) {
  pdLessonSeq += 1
  const id = asLessonId(`les-pd-${pad(pdLessonSeq, 3)}`)
  pdAssignmentLessons.push(id)
  lessons.push({
    id,
    moduleId: asModuleId('mod-pd-101-4'),
    courseId: C.productDesign,
    sequence: 4 + i,
    title: i === 0 ? 'Usability test write-up' : 'Portfolio case study',
    type: i === 0 ? 'assignment' : 'project',
    durationMinutes: i === 0 ? 180 : 600,
    status: 'published',
    formats: {},
    offlineEnabled: false,
    androidCheck: { passes: true, issues: [] },
    resources: [],
    quizId: null,
    assignmentId: asAssignmentId(`asg-pd-${pad(i + 1, 2)}`),
    ...authored,
  })
}

/* ── The thirteen video-only courses ────────────────────────────────────── */

for (const course of courses) {
  if (course.id === C.dataAnalysis || course.id === C.productDesign) continue
  const total = contentLessonCount.get(course.id) ?? 10
  const perModule = 4
  const moduleCount = Math.ceil(total / perModule)
  let seq = 0
  for (let mi = 0; mi < moduleCount; mi++) {
    const moduleId = addModule(course.id, mi + 1, `Module ${mi + 1}`, `${course.title} — part ${mi + 1} of ${moduleCount}.`)
    for (let li = 0; li < perModule && seq < total; li++) {
      seq += 1
      const id = asLessonId(`les-${course.code.toLowerCase()}-${pad(seq, 3)}`)
      const title = `${course.title}: lesson ${seq}`
      const minutes = 24 + ((seq * 7) % 30)
      lessons.push({
        id,
        moduleId: asModuleId(moduleId),
        courseId: course.id,
        sequence: li + 1,
        title,
        type: 'content',
        durationMinutes: minutes,
        status: 'published',
        // Video and nothing else. This is the gap the coverage matrix exposes.
        formats: { video: makeAsset(id, 'video', title, minutes) },
        offlineEnabled: true,
        androidCheck: { passes: true, issues: [] },
        resources: [],
        quizId: null,
        assignmentId: null,
        ...authored,
      })
    }
  }
  // One assignment per course, so every course has a grading queue.
  const asgId = asLessonId(`les-${course.code.toLowerCase()}-asg`)
  lessons.push({
    id: asgId,
    moduleId: asModuleId(`mod-${course.id}-${moduleCount}`),
    courseId: course.id,
    sequence: 99,
    title: `${course.title} — final assessment`,
    type: 'assignment',
    durationMinutes: 240,
    status: 'published',
    formats: {},
    offlineEnabled: false,
    androidCheck: { passes: true, issues: [] },
    resources: [],
    quizId: null,
    assignmentId: asAssignmentId(`asg-${course.code.toLowerCase()}-01`),
    ...authored,
  })
}

export { courseModules, lessons, contentAssets }
export const lessonById = new Map<string, Lesson>(lessons.map((l) => [l.id, l]))
export const assetById = new Map<string, ContentAsset>(contentAssets.map((a) => [a.id, a]))

/* -------------------------------------------------------------------------- */
/* Assignments                                                                */
/* -------------------------------------------------------------------------- */

const DA_RUBRIC = [
  { criterion: 'Data cleaning', weight: 20, description: 'Handled missing values, duplicates and type errors, and documented what was changed.' },
  { criterion: 'Analysis', weight: 30, description: 'Chose appropriate methods and interpreted the output honestly.' },
  { criterion: 'Visualisation', weight: 25, description: 'Charts answer the question without decoration. Labels and units present.' },
  { criterion: 'Communication', weight: 25, description: 'A reader outside the cohort could act on the conclusion.' },
]

const assignments: Assignment[] = []

const DA_ASSIGNMENT_TITLES = [
  'Warm-up: profile the Bodija retail extract',
  'Clean and document a supplied dataset',
  'SQL practical',
  'Regression mini-project',
  'Dashboard build',
  'Final project — sales dataset analysis',
]

DA_ASSIGNMENT_TITLES.forEach((title, i) => {
  const lessonId = daAssignmentLessonIds[i]
  assignments.push({
    id: asAssignmentId(`asg-da-${pad(i + 1, 2)}`),
    lessonId,
    courseId: C.dataAnalysis,
    cohortId: null,
    title,
    brief:
      i === 5
        ? 'Take the supplied three-year sales dataset from a Bodija retail chain. Find one decision the owner should make differently, support it with analysis, and present it in no more than five slides.'
        : `Complete the ${title.toLowerCase()} exercise using the dataset supplied in the lesson. Submit your working file and a one-page summary.`,
    acceptedFormats: i === 5 ? ['pdf', 'pptx', 'xlsx'] : ['xlsx', 'csv', 'sql', 'pdf'],
    maxFileSizeMb: 25,
    // One offset per week of the 8-week cohort, matching the titles' own
    // progression (warm-up → ... → final project) — not one flat number for
    // all six, which put every assignment on the same due date regardless of
    // where it actually falls in the course.
    dueOffsetDays: 7 * (i + 1),
    dueDate: null,
    maxScore: 100,
    rubric: DA_RUBRIC,
    latePolicy: i === 5 ? 'accept_with_penalty' : 'accept',
    latePenaltyPercent: i === 5 ? 10 : null,
    tutorGuidance:
      'Mark the reasoning, not the tool. A clean answer in Excel beats a messy one in Python. Pass line is 60.',
    ...authored,
  })
})

pdAssignmentLessons.forEach((lessonId, i) => {
  assignments.push({
    id: asAssignmentId(`asg-pd-${pad(i + 1, 2)}`),
    lessonId,
    courseId: C.productDesign,
    cohortId: null,
    title: i === 0 ? 'Usability test write-up' : 'Portfolio case study',
    brief:
      i === 0
        ? 'Run a five-participant usability test on your prototype. Submit the script, the raw notes and a prioritised list of findings.'
        : 'Write up one project end to end: the problem, the research, the decisions you made and what you would change.',
    acceptedFormats: ['pdf', 'fig', 'docx'],
    maxFileSizeMb: 40,
    dueOffsetDays: 10,
    dueDate: null,
    maxScore: 100,
    rubric: [
      { criterion: 'Method', weight: 30, description: 'The test was run properly and the questions were not leading.' },
      { criterion: 'Insight', weight: 40, description: 'Findings are specific and traceable to something a participant did.' },
      { criterion: 'Communication', weight: 30, description: 'A developer could act on this without a meeting.' },
    ],
    latePolicy: 'accept_with_penalty',
    latePenaltyPercent: 10,
    tutorGuidance: 'Reward evidence over opinion. Ask "how do you know?" of every finding.',
    ...authored,
  })
})

for (const course of courses) {
  if (course.id === C.dataAnalysis || course.id === C.productDesign) continue
  assignments.push({
    id: asAssignmentId(`asg-${course.code.toLowerCase()}-01`),
    lessonId: asLessonId(`les-${course.code.toLowerCase()}-asg`),
    courseId: course.id,
    cohortId: null,
    title: `${course.title} — final assessment`,
    brief: `Apply everything from ${course.title} to the supplied brief. Submit your work and a short reflection.`,
    acceptedFormats: ['pdf', 'zip'],
    maxFileSizeMb: 50,
    dueOffsetDays: 14,
    dueDate: null,
    maxScore: 100,
    rubric: [
      { criterion: 'Correctness', weight: 50, description: 'Does it work, and does it do what the brief asked?' },
      { criterion: 'Craft', weight: 30, description: 'Quality of execution.' },
      { criterion: 'Reflection', weight: 20, description: 'Honest account of what was hard.' },
    ],
    latePolicy: 'accept',
    latePenaltyPercent: null,
    tutorGuidance: 'Pass line is 60.',
    ...authored,
  })
}

export { assignments }

/* -------------------------------------------------------------------------- */
/* Submissions and grading                                                    */
/* -------------------------------------------------------------------------- */

const submissions: Submission[] = []
let subSeq = 0

const FEEDBACK = [
  'Strong cleaning step — the documented assumptions are exactly what I asked for. The chart on slide 3 needs axis labels.',
  'Good analysis, weak conclusion. You found the pattern and then did not say what to do about it.',
  'The join is duplicating rows. Count distinct keys before you join and re-run.',
  'Clear, confident and correct. Use this one in your portfolio.',
  'Late, and the penalty applies, but the work itself is above the pass line comfortably.',
  'The regression is fine; the causal language in the summary is not. Rewrite the last paragraph.',
]

function makeSubmission(args: {
  assignmentId: string
  enrollment: Enrollment
  submittedDaysAgo: number
  status: Submission['status']
  score?: number
  gradedBy?: PersonId
  fileName: string
  note?: string
  withVoiceNote?: boolean
}): Submission {
  subSeq += 1
  const submittedAt = at(daysAgo(args.submittedDaysAgo), int(r, 18, 23), int(r, 0, 59))
  const graded = args.status === 'graded'
  const total = args.score ?? null
  const rubric = assignments.find((a) => a.id === args.assignmentId)?.rubric ?? DA_RUBRIC
  return {
    id: submissionId(`sub-${pad(subSeq, 4)}`),
    assignmentId: asAssignmentId(args.assignmentId),
    enrollmentId: args.enrollment.id,
    personId: args.enrollment.personId,
    attempt: 1,
    submittedAt,
    isLate: chance(r, 0.18),
    files: [{ fileName: args.fileName, sizeBytes: int(r, 220_000, 8_400_000), url: `/submissions/${args.fileName}` }],
    note: args.note ?? null,
    status: args.status,
    rubricScores: graded && total !== null
      ? rubric.map((row) => ({
          criterion: row.criterion,
          score: Math.round((total * row.weight) / 100),
          comment: '',
        }))
      : [],
    totalScore: graded ? total : null,
    passed: graded && total !== null ? total >= 60 : null,
    feedback: graded ? pick(r, FEEDBACK) : null,
    voiceNote: graded && args.withVoiceNote ? { url: `/voice/${subSeq}.m4a`, durationSeconds: int(r, 35, 180) } : null,
    gradedByPersonId: graded ? (args.gradedBy ?? P.tundeBakare) : null,
    gradedAt: graded ? at(daysAgo(Math.max(0, args.submittedDaysAgo - int(r, 1, 4))), 20, 0) : null,
    daysWaiting: graded ? 0 : args.submittedDaysAgo,
    ...audit(submittedAt, U.tundeBakare),
  }
}

/* ── Chiamaka: five graded, one awaiting — the Flow 5 grading target ─────── */

if (chiamakaEnrolment) {
  const scores = [86, 81, 79, 88, 85]
  scores.forEach((score, i) => {
    submissions.push(
      makeSubmission({
        assignmentId: `asg-da-${pad(i + 1, 2)}`,
        enrollment: chiamakaEnrolment,
        submittedDaysAgo: 34 - i * 6,
        status: 'graded',
        score,
        fileName: `chiamaka-okonkwo-${DA_ASSIGNMENT_TITLES[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30)}.xlsx`,
        withVoiceNote: i === 3,
      }),
    )
  })
  // The one sitting in the queue, four days old, that Flow 5 step 11 grades.
  submissions.push(
    makeSubmission({
      assignmentId: 'asg-da-06',
      enrollment: chiamakaEnrolment,
      submittedDaysAgo: 4,
      status: 'awaiting_grading',
      fileName: 'chiamaka-okonkwo-final-project-sales-dataset.pdf',
      note: 'Focused on the Bodija branch. The margin fall in July is the headline — I think it is the supplier change, not footfall.',
    }),
  )
}

/* ── Tunde Adeyemi: academically complete, all six graded ───────────────── */

if (tundeEnrolment) {
  ;[74, 68, 71, 80, 66, 77].forEach((score, i) => {
    submissions.push(
      makeSubmission({
        assignmentId: `asg-da-${pad(i + 1, 2)}`,
        enrollment: tundeEnrolment,
        submittedDaysAgo: 40 - i * 6,
        status: 'graded',
        score,
        fileName: `tunde-adeyemi-assignment-${i + 1}.xlsx`,
      }),
    )
  })
}

/* ── The rest: 37 awaiting grading across the catalogue, plus a graded tail ─ */

const activeEnrolments = enrollments.filter((e) => e.status === 'active' && e.id !== 'enr-0151' && e.id !== 'enr-0149')
const daActive = activeEnrolments.filter((e) => e.courseId === C.dataAnalysis)

// Five more Data Analysis submissions in the queue, so Flow 5 step 10 shows six rows.
daActive.slice(0, 5).forEach((e, i) => {
  submissions.push(
    makeSubmission({
      assignmentId: 'asg-da-06',
      enrollment: e,
      submittedDaysAgo: 1 + i,
      status: 'awaiting_grading',
      fileName: `${fullName(e.personId).toLowerCase().replace(/\s+/g, '-')}-final-project.pdf`,
    }),
  )
})

// 32 more across the other courses, to reach the dashboard's 37.
activeEnrolments
  .filter((e) => e.courseId !== C.dataAnalysis)
  .slice(0, 32)
  .forEach((e, i) => {
    const course = courseById.get(e.courseId)
    const asg =
      e.courseId === C.productDesign ? 'asg-pd-01' : `asg-${(course?.code ?? 'da-101').toLowerCase()}-01`
    submissions.push(
      makeSubmission({
        assignmentId: asg,
        enrollment: e,
        submittedDaysAgo: 1 + (i % 9),
        status: 'awaiting_grading',
        fileName: `${fullName(e.personId).toLowerCase().replace(/\s+/g, '-')}-final.pdf`,
      }),
    )
  })

// A graded history, so turnaround and average-grade charts have data.
enrollments
  .filter((e) => e.status === 'completed')
  .slice(0, 180)
  .forEach((e, i) => {
    const course = courseById.get(e.courseId)
    const asg =
      e.courseId === C.dataAnalysis ? `asg-da-${pad((i % 6) + 1, 2)}`
      : e.courseId === C.productDesign ? `asg-pd-0${(i % 2) + 1}`
      : `asg-${(course?.code ?? 'DA-101').toLowerCase()}-01`
    submissions.push(
      makeSubmission({
        assignmentId: asg,
        enrollment: e,
        submittedDaysAgo: int(r, 40, 300),
        status: i % 17 === 0 ? 'returned_for_revision' : 'graded',
        score: 55 + ((i * 13) % 42),
        fileName: `${fullName(e.personId).toLowerCase().replace(/\s+/g, '-')}-submission.pdf`,
        withVoiceNote: i % 5 === 0,
      }),
    )
  })

export { submissions }

/* -------------------------------------------------------------------------- */
/* Quizzes                                                                    */
/* -------------------------------------------------------------------------- */

const quizzes: Quiz[] = daQuizLessonIds.map((lessonId, i) => ({
  id: asQuizId(`quiz-da-${pad(i + 1, 2)}`),
  lessonId,
  courseId: C.dataAnalysis,
  title: ['Module 1 knowledge check', 'SQL knowledge check', 'Statistics knowledge check', 'Visualisation knowledge check'][i],
  passMark: 60,
  timeLimitMinutes: [15, 20, 20, 15][i],
  attemptsAllowed: 2,
  randomiseQuestions: true,
  randomiseAnswers: true,
  showAnswersAfter: 'after_submission',
  status: 'published',
  questions: [
    {
      id: `q${i}-1`,
      sequence: 1,
      type: 'multiple_choice',
      stem: i === 2
        ? 'A regression coefficient of 4.0 on advertising spend means:'
        : 'Which statement is true?',
      points: 10,
      explanation: i === 2
        ? 'Regression describes association. Causation needs a design that rules out the alternatives.'
        : 'Read the stem carefully — two of the options are true of the tool but not of the question.',
      options: [
        { id: 'a', text: i === 2 ? 'Every ₦1 of spend causes ₦4 of sales' : 'A JOIN can never increase the row count', correct: false },
        { id: 'b', text: i === 2 ? 'Every ₦1 of spend is associated with ₦4 of sales' : 'A JOIN can increase the row count when the key is not unique', correct: true },
        { id: 'c', text: i === 2 ? 'Sales cause advertising spend' : 'LEFT JOIN and INNER JOIN always return the same rows', correct: false },
        { id: 'd', text: 'None of the above', correct: false },
      ],
    },
    {
      id: `q${i}-2`,
      sequence: 2,
      type: 'true_false',
      stem: 'The mean is a better summary than the median for Nigerian salary data.',
      points: 5,
      explanation: 'Salary data is right-skewed. The median is the honest headline; show the spread alongside it.',
      options: [
        { id: 't', text: 'True', correct: false },
        { id: 'f', text: 'False', correct: true },
      ],
    },
    {
      id: `q${i}-3`,
      sequence: 3,
      type: 'short_answer',
      stem: 'Name one check you should run before joining two tables.',
      points: 5,
      explanation: 'Count distinct keys on both sides, or check for nulls in the join column.',
      options: [],
    },
  ],
  stats: {
    attempts: int(r, 40, 180),
    passRate: 68 + ((i * 6) % 22),
    averageScore: 64 + ((i * 5) % 20),
    averageMinutes: 9 + i,
  },
  ...authored,
}))

export { quizzes }

/* -------------------------------------------------------------------------- */
/* Progress                                                                   */
/* -------------------------------------------------------------------------- */

const DEVICES = ['Android · Tecno Spark 10', 'Android · Infinix Hot 40', 'Android · Samsung A15', 'Windows · Chrome', 'iOS · Safari']

const lessonsByCourse = new Map<string, Lesson[]>()
for (const l of lessons) {
  const list = lessonsByCourse.get(l.courseId) ?? []
  list.push(l)
  lessonsByCourse.set(l.courseId, list)
}
const modulesByCourse = new Map<string, number>()
for (const m of courseModules) modulesByCourse.set(m.courseId, (modulesByCourse.get(m.courseId) ?? 0) + 1)

const progress: Progress[] = enrollments.map((e, i) => {
  const courseLessons = lessonsByCourse.get(e.courseId) ?? []
  const lessonsTotal = courseLessons.length
  const modulesTotal = modulesByCourse.get(e.courseId) ?? 1
  const isChiamaka = e.id === 'enr-0151'
  const isTunde = e.id === 'enr-0149'

  const pct = isChiamaka || isTunde
    ? 100
    : e.status === 'completed'
      ? int(r, 82, 100)
      : e.status === 'withdrawn'
        ? int(r, 5, 45)
        : int(r, 12, 92)

  const lessonsCompleted = Math.round((lessonsTotal * pct) / 100)
  const lastActivity = isChiamaka ? at(daysAgo(1), 21, 14) : at(daysAgo(int(r, 0, 34)), int(r, 18, 23), int(r, 0, 59))

  return {
    id: progressId(`prg-${e.id.replace('enr-', '')}`),
    enrollmentId: e.id,
    personId: e.personId,
    courseId: e.courseId,
    lessonsCompleted,
    lessonsTotal,
    modulesCompleted: Math.round((modulesTotal * pct) / 100),
    modulesTotal,
    percentComplete: pct,
    lastLessonId: courseLessons[Math.max(0, lessonsCompleted - 1)]?.id ?? null,
    lastDevice: DEVICES[i % DEVICES.length],
    lastActivityAt: lastActivity,
    daysInactive: Math.max(0, daysBetweenTodayAnd(lastActivity.slice(0, 10))),
    perLesson: courseLessons.map((l, li) => ({
      lessonId: l.id,
      state: li < lessonsCompleted ? ('complete' as const) : li === lessonsCompleted ? ('in_progress' as const) : ('not_started' as const),
      formatUsed: li < lessonsCompleted ? ((Object.keys(l.formats)[0] as ContentFormat) ?? null) : null,
      completedAt: li < lessonsCompleted ? at(daysAgo(int(r, 1, 60)), 20, 0) : null,
    })),
    ...audit(e.createdAt, U.emeka),
  }
})

export { progress }

/* -------------------------------------------------------------------------- */
/* Student attendance — running cohorts only, to keep the seed a sane size    */
/* -------------------------------------------------------------------------- */

const studentAttendance: StudentAttendance[] = []
let attSeq = 0

const enrolmentsByCohort = new Map<string, Enrollment[]>()
for (const e of enrollments) {
  if (e.status === 'withdrawn') continue
  const list = enrolmentsByCohort.get(e.cohortId) ?? []
  list.push(e)
  enrolmentsByCohort.set(e.cohortId, list)
}

for (const session of classSessions) {
  if (session.status !== 'delivered') continue
  const cohort = cohortById.get(session.cohortId)
  if (!cohort || cohort.status !== 'running') continue
  const roster = enrolmentsByCohort.get(session.cohortId) ?? []
  for (const e of roster) {
    attSeq += 1
    const roll = r() * 100
    const state = roll < cohort.attendanceRate ? 'present' : roll < cohort.attendanceRate + 9 ? 'late' : roll < cohort.attendanceRate + 13 ? 'excused' : 'absent'
    const source = cohort.mode === 'virtual' ? 'kiosk' : chance(r, 0.72) ? 'nfc_tap' : chance(r, 0.5) ? 'qr' : 'tutor_manual'
    studentAttendance.push({
      id: stuAttId(`sat-${pad(attSeq, 5)}`),
      sessionId: session.id,
      enrollmentId: e.id,
      personId: e.personId,
      state,
      source,
      tapEventId: null,
      tappedAt: state === 'present' || state === 'late' ? at(session.date, Number(session.startTime.slice(0, 2)), state === 'late' ? int(r, 16, 40) : int(r, 0, 12)) : null,
      tutorConfirmed: source === 'tutor_manual' ? true : chance(r, 0.8),
      overrideReason: state === 'excused' ? 'Tutor marked excused — notified in advance' : null,
      ...audit(at(session.date, 20, 0), U.tundeBakare),
    })
  }
}

export { studentAttendance }

/* -------------------------------------------------------------------------- */
/* Certificates                                                               */
/* -------------------------------------------------------------------------- */

function snapshot(attendance: number, content: number, assignments6: string, project: number, cleared: boolean, balanceText: string) {
  return [
    { criterion: 'Attendance', required: '≥ 75%', actual: `${attendance}%`, met: attendance >= 75 },
    { criterion: 'Content completion', required: '100%', actual: `${content}%`, met: content >= 100 },
    { criterion: 'Assignments', required: 'All graded', actual: assignments6, met: assignments6.startsWith('6/6') || assignments6.startsWith('All') },
    { criterion: 'Project grade', required: '≥ 60%', actual: `${project}%`, met: project >= 60 },
    { criterion: 'Financial clearance', required: 'Balance ₦0', actual: balanceText, met: cleared },
  ]
}

const certificates: Certificate[] = []

/* ── 39 already issued, CIR-CERT-2026-0380 … 0418 ───────────────────────── */

const completedEnrolments = enrollments.filter((e) => e.status === 'completed')
for (let i = 0; i < 39; i++) {
  const e = completedEnrolments[i % completedEnrolments.length]
  const n = 380 + i
  const publicId = `CIR-CERT-2026-${pad(n)}`
  // The last eighteen were issued this month — the dashboard's "18 MTD".
  const issuedDay = i >= 21 ? at(`2026-09-${pad(1 + ((i - 21) % 19), 2)}`, int(r, 10, 17), int(r, 0, 59)) : at(daysAgo(int(r, 35, 220)), 12, 0)
  const revoked = n === 0x18a // CIR-CERT-2026-0394
  certificates.push({
    id: certId(`cert-${pad(n)}`),
    certificateId: publicId,
    personId: e.personId,
    enrollmentId: e.id,
    courseId: e.courseId,
    cohortId: e.cohortId,
    issuedAt: issuedDay,
    issuedByUserId: U.emeka,
    issuingBranchId: cohortById.get(e.cohortId)?.branchId ?? BR.ibadan,
    status: revoked ? 'revoked' : 'issued',
    eligibilitySnapshot: snapshot(int(r, 76, 96), 100, 'All graded', int(r, 62, 94), true, '₦0'),
    verificationUrl: `/public/verify/${publicId}`,
    qrPayload: `/public/verify/${publicId}`,
    outcomeRecordId: null,
    revokedAt: revoked ? at('2026-07-22', 15, 10) : null,
    revokedReason: revoked ? 'Issued against the wrong cohort. Superseded by CIR-CERT-2026-0402.' : null,
    ...audit(issuedDay, U.emeka),
  })
}

/* ── Chiamaka: eligible, not yet issued. Flow 5 step 15 issues it. ──────── */

if (chiamakaEnrolment) {
  certificates.push({
    id: certId('cert-0419'),
    certificateId: 'CIR-CERT-2026-0419',
    personId: P.chiamaka,
    enrollmentId: chiamakaEnrolment.id,
    courseId: C.dataAnalysis,
    cohortId: chiamakaEnrolment.cohortId,
    issuedAt: null,
    issuedByUserId: null,
    issuingBranchId: BR.ibadan,
    status: 'eligible_not_issued',
    // Five of six graded: the final project is still in the queue. Flow 5
    // step 11 grades it, and this row becomes issuable.
    eligibilitySnapshot: snapshot(82, 100, '5/6 graded — final project awaiting grading', 88, true, '₦0'),
    verificationUrl: '/public/verify/CIR-CERT-2026-0419',
    qrPayload: '/public/verify/CIR-CERT-2026-0419',
    outcomeRecordId: null,
    revokedAt: null,
    revokedReason: null,
    ...audit(at(daysAgo(1), 7, 30), U.emeka),
  })
}

/* ── Tunde Adeyemi: blocked on financial clearance. Flow 5 step 14. ─────── */

if (tundeEnrolment) {
  certificates.push({
    id: certId('cert-0420'),
    certificateId: 'CIR-CERT-2026-0420',
    personId: P.tundeAdeyemi,
    enrollmentId: tundeEnrolment.id,
    courseId: C.dataAnalysis,
    cohortId: tundeEnrolment.cohortId,
    issuedAt: null,
    issuedByUserId: null,
    issuingBranchId: BR.ibadan,
    status: 'eligible_not_issued',
    // Every academic criterion met. The money is the only thing in the way.
    eligibilitySnapshot: snapshot(79, 100, '6/6 graded', 77, false, '₦120,000 outstanding'),
    verificationUrl: '/public/verify/CIR-CERT-2026-0420',
    qrPayload: '/public/verify/CIR-CERT-2026-0420',
    outcomeRecordId: null,
    revokedAt: null,
    revokedReason: null,
    ...audit(at(daysAgo(1), 7, 30), U.emeka),
  })
}

/* ── Five more waiting to be issued, so the filter has a real queue ─────── */

completedEnrolments.slice(40, 45).forEach((e, i) => {
  const n = 421 + i
  const publicId = `CIR-CERT-2026-${pad(n)}`
  const cleared = i !== 2
  certificates.push({
    id: certId(`cert-${pad(n)}`),
    certificateId: publicId,
    personId: e.personId,
    enrollmentId: e.id,
    courseId: e.courseId,
    cohortId: e.cohortId,
    issuedAt: null,
    issuedByUserId: null,
    issuingBranchId: cohortById.get(e.cohortId)?.branchId ?? BR.ibadan,
    status: 'eligible_not_issued',
    eligibilitySnapshot: snapshot(int(r, 76, 92), 100, '6/6 graded', int(r, 62, 90), cleared, cleared ? '₦0' : '₦85,000 outstanding'),
    verificationUrl: `/public/verify/${publicId}`,
    qrPayload: `/public/verify/${publicId}`,
    outcomeRecordId: null,
    revokedAt: null,
    revokedReason: null,
    ...audit(at(daysAgo(int(r, 2, 12)), 8, 0), U.emeka),
  })
})

export { certificates }
export const certificateById = new Map<string, Certificate>(certificates.map((c) => [c.id, c]))

/* -------------------------------------------------------------------------- */
/* Cohort discussion — a small illustrative seed, not a full history         */
/* -------------------------------------------------------------------------- */

export const discussionPosts: CohortDiscussionPost[] = []

if (chiamakaEnrolment) {
  const cohortId = chiamakaEnrolment.cohortId
  const seedPosts: Array<{
    id: string
    authorPersonId: PersonId
    authorRole: 'tutor' | 'student'
    body: string
    daysAgoPosted: number
    pinned?: boolean
  }> = [
    {
      id: 'disc-0001',
      authorPersonId: P.tundeBakare,
      authorRole: 'tutor',
      body: "Welcome to the cohort! Post here if you get stuck on this week's exercises — I check daily.",
      daysAgoPosted: 12,
      pinned: true,
    },
    {
      id: 'disc-0002',
      authorPersonId: P.chiamaka,
      authorRole: 'student',
      body: 'Is the dataset for the pandas exercise the same one from the lecture, or a new one?',
      daysAgoPosted: 6,
    },
    {
      id: 'disc-0003',
      authorPersonId: P.tundeBakare,
      authorRole: 'tutor',
      body: 'Same one — check the Materials tab, I re-uploaded it with cleaner column names.',
      daysAgoPosted: 6,
    },
    {
      id: 'disc-0004',
      authorPersonId: P.chiamaka,
      authorRole: 'student',
      body: 'Got it, thank you!',
      daysAgoPosted: 5,
    },
  ]

  for (const post of seedPosts) {
    const stamp = at(daysAgo(post.daysAgoPosted), 10, 15)
    discussionPosts.push({
      id: discussionPostId(post.id),
      cohortId,
      authorPersonId: post.authorPersonId,
      authorRole: post.authorRole,
      body: post.body,
      postedAt: stamp,
      pinned: post.pinned ?? false,
      ...audit(stamp, U.tundeBakare),
    })
  }
}

/* -------------------------------------------------------------------------- */
/* Figures the dashboards read                                                */
/* -------------------------------------------------------------------------- */

export const LEARN_COUNTS = {
  enrollments: enrollments.length,
  activeEnrollments: enrollments.filter((e) => e.status === 'active').length,
  enrolledStudents: enrollments.filter((e) => e.status !== 'withdrawn').length,
  lessons: lessons.length,
  contentAssets: contentAssets.length,
  awaitingGrading: submissions.filter((s) => s.status === 'awaiting_grading').length,
  certificatesIssued: certificates.filter((c) => c.status === 'issued').length,
} as const

void UNIT
void TODAY
